import { Database, type SQLQueryBindings, type Statement } from 'bun:sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ApiError } from './errors'
import { z } from 'zod'
import {
  builtinPermissions,
  permissionCatalog,
  type BuiltInRole,
  type Permission,
} from './permissions'

export type Member = {
  id: string
  name: string
  role: BuiltInRole | 'custom'
  permissions: Permission[]
  roleId?: string
  roleName?: string
}

export type WorkspaceRole = {
  id: string
  name: string
  permissions: Permission[]
  version: number
  createdAt: string
  updatedAt: string
}
type RoleRow = {
  id: string
  name: string
  permissions: string
  version: number
  created_at: string
  updated_at: string
}
type MemberRow = { id: string; name: string; role: BuiltInRole }

export type RuntimePermission = 'rest' | 'query' | 'mutation'

export type RuntimeKey = {
  id: string
  name: string
  flowId: string
  permissions: RuntimePermission[]
  expiresAt: string
  createdAt: string
  revokedAt: string | null
  managedBy?: 'load-test'
}

type RuntimeKeyRow = {
  id: string
  name: string
  flow_id: string
  permissions: string
  expires_at: string
  created_at: string
  revoked_at: string | null
}

function runtimeKey(row: RuntimeKeyRow): RuntimeKey {
  return {
    id: row.id,
    name: row.name,
    flowId: row.flow_id,
    permissions: JSON.parse(row.permissions),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }
}

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export function openStore(path: string, adminToken?: string) {
  if (adminToken !== undefined && adminToken.length < 32)
    throw new Error('BESH_ADMIN_TOKEN must contain at least 32 characters')

  mkdirSync(dirname(path), { recursive: true })

  const db = new Database(path, { create: true, strict: true })
  const statements = new Map<string, { finalize(): void }>()

  function query<
    T = unknown,
    Params extends SQLQueryBindings[] = SQLQueryBindings[],
  >(sql: string) {
    const cached = statements.get(sql) as Statement<T, Params> | undefined
    if (cached) return cached

    const statement = db.prepare<T, Params>(sql)
    statements.set(sql, statement)
    return statement
  }
  db.exec(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;',
  )
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  db.transaction(() => {
    if (!query('SELECT version FROM migrations WHERE version = 1').get()) {
      db.exec(`
        CREATE TABLE members (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
          token_hash TEXT NOT NULL UNIQUE
        );
      `)
      query('INSERT INTO migrations VALUES (1, ?, ?)').run(
        'workspace identity',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 2').get()) {
      db.exec(`CREATE TABLE audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`)
      query('INSERT INTO migrations VALUES (2, ?, ?)').run(
        'audit history',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 3').get()) {
      db.exec(`
        CREATE TABLE flows (
          id TEXT PRIMARY KEY,
          definition TEXT NOT NULL,
          revision INTEGER NOT NULL,
          published TEXT,
          published_revision INTEGER
        );
        CREATE UNIQUE INDEX published_route ON flows (
          json_extract(published, '$.method'), json_extract(published, '$.path')
        ) WHERE published IS NOT NULL;
        CREATE TABLE releases (
          flow_id TEXT NOT NULL REFERENCES flows(id),
          revision INTEGER NOT NULL,
          definition TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (flow_id, revision)
        );
      `)
      query('INSERT INTO migrations VALUES (3, ?, ?)').run(
        'flow drafts and releases',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 4').get()) {
      db.exec(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO settings VALUES ('workspace', 'My workspace');",
      )
      query('INSERT INTO migrations VALUES (4, ?, ?)').run(
        'workspace setup',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 5').get()) {
      db.exec(`
        DROP INDEX published_route;
        CREATE UNIQUE INDEX published_route ON flows (
          (json_extract(published, '$.graphql') IS NOT NULL),
          json_extract(published, '$.method'), json_extract(published, '$.path')
        ) WHERE published IS NOT NULL;
      `)
      query('INSERT INTO migrations VALUES (5, ?, ?)').run(
        'GraphQL endpoint routes',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 6').get()) {
      db.exec(`
        CREATE TABLE runtime_keys (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          flow_id TEXT NOT NULL REFERENCES flows(id),
          permissions TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          revoked_at TEXT
        );
      `)
      query('INSERT INTO migrations VALUES (6, ?, ?)').run(
        'scoped runtime credentials',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 7').get()) {
      db.exec(`
        CREATE TABLE data_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('upload', 'google-sheets')),
          columns TEXT NOT NULL,
          rows TEXT NOT NULL,
          row_count INTEGER NOT NULL,
          version INTEGER NOT NULL,
          source_url TEXT,
          sheet_name TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
      query('INSERT INTO migrations VALUES (7, ?, ?)').run(
        'spreadsheet data snapshots',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 8').get()) {
      db.exec(`
        CREATE TABLE accounts (
          member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL
        );
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        CREATE TABLE login_limits (
          identity_hash TEXT PRIMARY KEY,
          attempts INTEGER NOT NULL,
          reset_at INTEGER NOT NULL
        );
      `)
      query('INSERT INTO migrations VALUES (8, ?, ?)').run(
        'workspace accounts and sessions',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 9').get()) {
      db.exec(`
        CREATE TABLE auth_connections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT NOT NULL CHECK (provider = 'github'),
          client_id TEXT NOT NULL,
          secret TEXT NOT NULL,
          redirect_uri TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE oauth_attempts (
          state_hash TEXT PRIMARY KEY,
          proof_hash TEXT NOT NULL,
          verifier TEXT NOT NULL,
          flow_id TEXT NOT NULL REFERENCES flows(id),
          revision INTEGER NOT NULL,
          scope TEXT NOT NULL,
          connection_id TEXT NOT NULL REFERENCES auth_connections(id),
          connection_version INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE INDEX oauth_attempt_scope ON oauth_attempts(scope, flow_id);
      `)
      query('INSERT INTO migrations VALUES (9, ?, ?)').run(
        'generated product OAuth connections',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 10').get()) {
      db.exec(`
        CREATE TABLE load_tests (
          id TEXT PRIMARY KEY,
          metadata TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'canceled', 'interrupted')),
          runtime_key_id TEXT NOT NULL REFERENCES runtime_keys(id),
          actor TEXT NOT NULL
        );
        CREATE UNIQUE INDEX one_running_load_test ON load_tests((1)) WHERE status = 'running';
      `)
      query('INSERT INTO migrations VALUES (10, ?, ?)').run(
        'built-in local load tests',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 11').get()) {
      db.exec(`
        CREATE TABLE workspace_roles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          permissions TEXT NOT NULL,
          version INTEGER NOT NULL CHECK (version > 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE member_roles (
          member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
          role_id TEXT NOT NULL REFERENCES workspace_roles(id) ON DELETE RESTRICT
        );
        CREATE INDEX member_role_reference ON member_roles(role_id);
      `)
      query('INSERT INTO migrations VALUES (11, ?, ?)').run(
        'custom workspace roles and permissions',
        new Date().toISOString(),
      )
    }

    if (adminToken) {
      const previous = query<{ token_hash: string }, []>(
        `SELECT token_hash FROM members WHERE id = 'owner'`,
      ).get()
      const hash = hashToken(adminToken)

      query(
        `INSERT INTO members (id, name, role, token_hash) VALUES ('owner', 'Owner', 'owner', ?)
      ON CONFLICT(id) DO UPDATE SET token_hash = excluded.token_hash`,
      ).run(hash)

      if (previous?.token_hash !== hash) {
        query("DELETE FROM sessions WHERE member_id = 'owner'").run()
        query(
          'INSERT INTO audit (actor, action, resource, created_at) VALUES (?, ?, ?, ?)',
        ).run(
          'system',
          previous ? 'owner.key.rotated' : 'workspace.provisioned',
          'owner',
          new Date().toISOString(),
        )
      }
    }
  })()

  const audit = (actor: string, action: string, resource: string) => {
    query(
      'INSERT INTO audit (actor, action, resource, created_at) VALUES (?, ?, ?, ?)',
    ).run(actor, action, resource, new Date().toISOString())
  }

  function role(row: RoleRow): WorkspaceRole {
    return {
      id: row.id,
      name: row.name,
      permissions: JSON.parse(row.permissions),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  function resolveMember(id: string): Member | null {
    const row = query<MemberRow, [string]>(
      'SELECT id, name, role FROM members WHERE id = ?',
    ).get(id)
    if (!row) return null
    const assignment = query<{ role_id: string }, [string]>(
      'SELECT role_id FROM member_roles WHERE member_id = ?',
    ).get(id)
    if (!assignment || row.role === 'owner')
      return { ...row, permissions: [...builtinPermissions[row.role]] }
    const custom = query<RoleRow, [string]>(
      'SELECT * FROM workspace_roles WHERE id = ?',
    ).get(assignment.role_id)
    if (!custom) return null
    return {
      id: row.id,
      name: row.name,
      role: 'custom',
      roleId: custom.id,
      roleName: custom.name,
      permissions: role(custom).permissions,
    }
  }

  function roleInput(value: unknown) {
    const parsed = z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .refine(
            (name) =>
              !/[\u0000-\u001f\u007f]/.test(name) &&
              !['owner', 'editor', 'viewer'].includes(name.toLowerCase()),
          ),
        permissions: z
          .array(z.enum(permissionCatalog.map((entry) => entry.id)))
          .max(permissionCatalog.length)
          .refine(
            (permissions) => new Set(permissions).size === permissions.length,
          ),
      })
      .strict()
      .safeParse(value)
    if (!parsed.success)
      throw new ApiError(
        400,
        'Choose a role name and distinct supported permissions',
      )
    return parsed.data
  }

  function getRole(id: string) {
    const row = query<RoleRow, [string]>(
      'SELECT * FROM workspace_roles WHERE id = ?',
    ).get(id)
    if (!row) throw new ApiError(404, 'Role not found')
    return role(row)
  }

  function revokeSessions(actor: string, memberId: string) {
    const sessions = query<{ id: string }, [string]>(
      'SELECT id FROM sessions WHERE member_id = ?',
    ).all(memberId)
    query('DELETE FROM sessions WHERE member_id = ?').run(memberId)
    for (const session of sessions) audit(actor, 'session.revoked', session.id)
  }

  function validateRuntimeScope(
    flowId: string,
    permissions: RuntimePermission[],
    conflict = false,
  ) {
    const flow = query<{ published: string | null }, [string]>(
      'SELECT published FROM flows WHERE id = ?',
    ).get(flowId)
    if (!flow) throw new ApiError(404, 'Flow not found')
    if (!flow.published)
      throw new ApiError(
        conflict ? 409 : 400,
        'Publish this API before issuing a runtime key',
      )
    const graphql = Boolean(JSON.parse(flow.published).graphql)
    if (
      !permissions.length ||
      new Set(permissions).size !== permissions.length ||
      permissions.some((permission) =>
        graphql
          ? !['query', 'mutation'].includes(permission)
          : permission !== 'rest',
      )
    )
      throw new ApiError(
        conflict ? 409 : 400,
        'Permissions must match the published API type',
      )
  }

  function insertRuntimeKey(actor: string, key: RuntimeKey, token: string) {
    query('INSERT INTO runtime_keys VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').run(
      key.id,
      key.name,
      key.flowId,
      JSON.stringify(key.permissions),
      hashToken(token),
      key.expiresAt,
      key.createdAt,
    )
    audit(actor, 'runtime-key.created', key.id)
  }

  return {
    db,
    query,
    audit,
    member: resolveMember,
    listRoles() {
      return query<RoleRow, []>('SELECT * FROM workspace_roles ORDER BY name')
        .all()
        .map(role)
    },
    createRole(actor: string, value: unknown) {
      const input = roleInput(value)
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      db.transaction(() => {
        if (
          query(
            'SELECT id FROM workspace_roles WHERE name = ? COLLATE NOCASE',
          ).get(input.name)
        )
          throw new ApiError(409, 'Role name is already used')
        query('INSERT INTO workspace_roles VALUES (?, ?, ?, 1, ?, ?)').run(
          id,
          input.name,
          JSON.stringify(input.permissions),
          createdAt,
          createdAt,
        )
        audit(actor, 'role.created', id)
      }).immediate()
      return role(
        query<RoleRow, [string]>(
          'SELECT * FROM workspace_roles WHERE id = ?',
        ).get(id)!,
      )
    },
    updateRole(actor: string, id: string, value: unknown) {
      const parsed = z
        .object({
          name: z.unknown(),
          permissions: z.unknown(),
          version: z.number().int().positive().safe(),
        })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Provide role settings and expected version')
      const input = roleInput({
        name: parsed.data.name,
        permissions: parsed.data.permissions,
      })
      db.transaction(() => {
        const current = getRole(id)
        if (current.version !== parsed.data.version)
          throw new ApiError(409, 'Role changed. Reload before saving.')
        if (
          query(
            'SELECT id FROM workspace_roles WHERE id != ? AND name = ? COLLATE NOCASE',
          ).get(id, input.name)
        )
          throw new ApiError(409, 'Role name is already used')
        query(
          'UPDATE workspace_roles SET name = ?, permissions = ?, version = version + 1, updated_at = ? WHERE id = ?',
        ).run(
          input.name,
          JSON.stringify(input.permissions),
          new Date().toISOString(),
          id,
        )
        if (
          current.permissions.length !== input.permissions.length ||
          current.permissions.some(
            (permission) => !input.permissions.includes(permission),
          )
        ) {
          for (const row of query<{ member_id: string }, [string]>(
            'SELECT member_id FROM member_roles WHERE role_id = ?',
          ).all(id))
            revokeSessions(actor, row.member_id)
        }
        audit(actor, 'role.updated', id)
      }).immediate()
      return getRole(id)
    },
    deleteRole(actor: string, id: string, value: unknown) {
      const parsed = z
        .object({ version: z.number().int().positive().safe() })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(400, 'Provide the expected role version')
      db.transaction(() => {
        const current = getRole(id)
        if (current.version !== parsed.data.version)
          throw new ApiError(409, 'Role changed. Reload before deleting.')
        if (
          query('SELECT member_id FROM member_roles WHERE role_id = ?').get(id)
        )
          throw new ApiError(409, 'Reassign members before deleting this role')
        query('DELETE FROM workspace_roles WHERE id = ?').run(id)
        audit(actor, 'role.deleted', id)
      }).immediate()
      return { ok: true }
    },
    assignMemberRole(
      actor: string,
      id: string,
      assignment:
        { role: 'editor' | 'viewer' } | { role: 'custom'; roleId: string },
    ) {
      db.transaction(() => {
        const current = resolveMember(id)
        if (!current) throw new ApiError(404, 'Member not found')
        if (current.role === 'owner')
          throw new ApiError(409, 'The owner role cannot be changed')
        if (assignment.role === 'custom') getRole(assignment.roleId)
        query('UPDATE members SET role = ? WHERE id = ?').run(
          assignment.role === 'custom' ? 'viewer' : assignment.role,
          id,
        )
        query('DELETE FROM member_roles WHERE member_id = ?').run(id)
        if (assignment.role === 'custom')
          query('INSERT INTO member_roles VALUES (?, ?)').run(
            id,
            assignment.roleId,
          )
        revokeSessions(actor, id)
        audit(actor, 'member.role.updated', id)
      }).immediate()
      return resolveMember(id)!
    },
    setupStatus() {
      return {
        required: !query("SELECT id FROM members WHERE id = 'owner'").get(),
        name: query<{ value: string }, []>(
          "SELECT value FROM settings WHERE key = 'workspace'",
        ).get()!.value,
      }
    },
    setup(name: string, account?: { email: string; passwordHash: string }) {
      const token = crypto.randomUUID() + crypto.randomUUID()

      db.transaction(() => {
        if (query("SELECT id FROM members WHERE id = 'owner'").get())
          throw new ApiError(409, 'Workspace already configured')
        query("INSERT INTO members VALUES ('owner', 'Owner', 'owner', ?)").run(
          hashToken(token),
        )
        query("UPDATE settings SET value = ? WHERE key = 'workspace'").run(name)
        if (account)
          query('INSERT INTO accounts VALUES (?, ?, ?)').run(
            'owner',
            account.email,
            account.passwordHash,
          )
        audit('owner', 'workspace.created', 'workspace')
      })()

      return { token, name }
    },
    listMembers() {
      return query<{ id: string }, []>('SELECT id FROM members ORDER BY name')
        .all()
        .map((row) => resolveMember(row.id)!)
    },
    createMember(
      actor: string,
      name: string,
      role: 'editor' | 'viewer' | 'custom',
      account?: { email: string; passwordHash: string },
      roleId?: string,
    ) {
      const member = { id: crypto.randomUUID(), name, role }
      const token = crypto.randomUUID() + crypto.randomUUID()

      db.transaction(() => {
        if (role === 'custom') {
          if (
            !roleId ||
            !query('SELECT id FROM workspace_roles WHERE id = ?').get(roleId)
          )
            throw new ApiError(404, 'Role not found')
        } else if (roleId !== undefined)
          throw new ApiError(
            400,
            'Built-in roles cannot include a custom role ID',
          )
        if (
          account &&
          query('SELECT member_id FROM accounts WHERE email = ?').get(
            account.email,
          )
        )
          throw new ApiError(409, 'Email address unavailable')
        query('INSERT INTO members VALUES (?, ?, ?, ?)').run(
          member.id,
          name,
          role === 'custom' ? 'viewer' : role,
          hashToken(token),
        )
        if (role === 'custom')
          query('INSERT INTO member_roles VALUES (?, ?)').run(
            member.id,
            roleId!,
          )
        if (account)
          query('INSERT INTO accounts VALUES (?, ?, ?)').run(
            member.id,
            account.email,
            account.passwordHash,
          )
        audit(actor, 'member.created', member.id)
      }).immediate()

      return { ...resolveMember(member.id)!, token }
    },
    revokeMember(actor: string, id: string) {
      if (id === 'owner')
        throw new ApiError(409, 'The bootstrap owner cannot be revoked')

      db.transaction(() => {
        if (!query('DELETE FROM members WHERE id = ?').run(id).changes)
          throw new ApiError(404, 'Member not found')
        audit(actor, 'member.revoked', id)
      })()

      return { ok: true }
    },
    listAudit() {
      return query('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()
    },
    listRuntimeKeys() {
      return query<RuntimeKeyRow & { managed: number }, []>(
        'SELECT id, name, flow_id, permissions, expires_at, created_at, revoked_at, EXISTS (SELECT 1 FROM load_tests WHERE runtime_key_id = runtime_keys.id) AS managed FROM runtime_keys ORDER BY rowid DESC',
      )
        .all()
        .map((row): RuntimeKey => ({
          ...runtimeKey(row),
          ...(row.managed ? { managedBy: 'load-test' } : {}),
        }))
    },
    createRuntimeKey(
      actor: string,
      value: {
        name: string
        flowId: string
        permissions: RuntimePermission[]
        expiresAt: string
      },
    ) {
      const name = value.name.trim()
      const expiration = Date.parse(value.expiresAt)
      const now = Date.now()
      if (!name || name.length > 80)
        throw new ApiError(400, 'Key name must contain 1 to 80 characters')
      if (
        !z.string().datetime({ offset: true }).safeParse(value.expiresAt)
          .success ||
        !Number.isFinite(expiration) ||
        expiration <= now ||
        expiration > now + 366 * 86_400_000
      )
        throw new ApiError(
          400,
          'Expiration must be a valid future date within 366 days',
        )

      const key: RuntimeKey = {
        id: crypto.randomUUID(),
        name,
        flowId: value.flowId,
        permissions: value.permissions,
        expiresAt: new Date(expiration).toISOString(),
        createdAt: new Date(now).toISOString(),
        revokedAt: null,
      }
      const token = `besh_${randomBytes(32).toString('base64url')}`

      db.transaction(() => {
        validateRuntimeScope(key.flowId, key.permissions)
        insertRuntimeKey(actor, key, token)
      })()

      return { ...key, token }
    },
    rotateRuntimeKey(actor: string, id: string) {
      return db
        .transaction(() => {
          const row = query<RuntimeKeyRow, [string]>(
            'SELECT id, name, flow_id, permissions, expires_at, created_at, revoked_at FROM runtime_keys WHERE id = ?',
          ).get(id)
          if (!row) throw new ApiError(404, 'Runtime key not found')

          // Load-test credentials stay private and expire with their owning job.
          if (
            query('SELECT id FROM load_tests WHERE runtime_key_id = ?').get(id)
          )
            throw new ApiError(409, 'Load test keys are managed automatically')

          const now = Date.now()
          if (
            row.revoked_at ||
            !Number.isFinite(Date.parse(row.expires_at)) ||
            Date.parse(row.expires_at) <= now
          )
            throw new ApiError(
              409,
              'Only active, unexpired runtime keys can be replaced',
            )

          const key: RuntimeKey = {
            ...runtimeKey(row),
            id: crypto.randomUUID(),
            createdAt: new Date(now).toISOString(),
            revokedAt: null,
          }
          validateRuntimeScope(key.flowId, key.permissions, true)
          const token = `besh_${randomBytes(32).toString('base64url')}`

          query('UPDATE runtime_keys SET revoked_at = ? WHERE id = ?').run(
            key.createdAt,
            id,
          )
          audit(actor, 'runtime-key.revoked', id)
          insertRuntimeKey(actor, key, token)

          return { ...key, token }
        })
        .immediate()
    },
    revokeRuntimeKey(actor: string, id: string) {
      db.transaction(() => {
        if (
          !query(
            'UPDATE runtime_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?',
          ).run(new Date().toISOString(), id).changes
        )
          throw new ApiError(404, 'Runtime key not found')
        audit(actor, 'runtime-key.revoked', id)
      })()

      return { ok: true }
    },
    runtimeActor(token: string) {
      const row = query<{ id: string }, [string]>(
        'SELECT id FROM runtime_keys WHERE token_hash = ?',
      ).get(hashToken(token))
      return row ? `runtime:${row.id}` : 'anonymous'
    },
    authenticate(token: string): Member | null {
      const row = query<{ id: string }, [string]>(
        'SELECT id FROM members WHERE token_hash = ?',
      ).get(hashToken(token))
      return row ? resolveMember(row.id) : null
    },
    authenticateRuntime(token: string): RuntimeKey | null {
      const row = query<RuntimeKeyRow, [string]>(
        'SELECT id, name, flow_id, permissions, expires_at, created_at, revoked_at FROM runtime_keys WHERE token_hash = ?',
      ).get(hashToken(token))

      if (
        !row ||
        row.revoked_at ||
        !Number.isFinite(Date.parse(row.expires_at)) ||
        Date.parse(row.expires_at) <= Date.now()
      )
        return null

      return runtimeKey(row)
    },
    close() {
      // Own statements so database handles close deterministically on Bun 1.3.
      for (const statement of statements.values()) statement.finalize()
      statements.clear()
      db.close(true)
    },
  }
}

export type Store = ReturnType<typeof openStore>
