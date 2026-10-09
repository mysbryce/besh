import { Database, type SQLQueryBindings, type Statement } from 'bun:sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ApiError } from '../errors'
import { z } from 'zod'
import {
  supportsSelectedFlows,
  type FlowAccess,
  type FlowAccessInput,
  type MemberAccess,
  type MemberAccessInput,
} from './flow-access'
import {
  flowAccessUpdateSchema,
  memberAccessUpdateSchema,
} from './access-input'
import {
  authorizeFlow,
  authorizeGraph,
  type CurrentMember,
} from './authorization'
import type { Flow } from '../flows/model'
import { flowTransport } from '../flows/transport'
import type { TenantAssignment } from './tenant-model'
import {
  memberRowPrincipal,
  protectedShape,
  runtimeRowPrincipal,
} from './row-authority'
import { activeTenant } from './tenants'
import { assertRolloverGraph, keyWindow } from './key-rollover'
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
  flowAccess: FlowAccess
  access: MemberAccess
  tenantAssignment: TenantAssignment
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

export type RuntimePermission = 'rest' | 'query' | 'mutation' | 'ws'

export type RuntimeKey = {
  id: string
  name: string
  flowId: string
  releaseRevision: number | null
  permissions: RuntimePermission[]
  expiresAt: string
  acceptUntil: string
  replacesKeyId: string | null
  replacedByKeyId: string | null
  createdAt: string
  revokedAt: string | null
  issuerBinding: {
    memberId: string
    action: 'runtime-keys.manage' | 'load-tests.run'
  } | null
  tenantId: string | null
  managedBy?: 'load-test'
  cleanupOnly?: boolean
}

type RuntimeKeyRow = {
  id: string
  name: string
  flow_id: string
  release_revision: number | null
  permissions: string
  expires_at: string
  created_at: string
  revoked_at: string | null
  issuer_member_id: string | null
  issuer_action: 'runtime-keys.manage' | 'load-tests.run' | null
  tenant_id: string | null
  rollover_accept_until: string | null
  replaces_key_id: string | null
  replaced_by_key_id: string | null
  rollover_created_at: string | null
  rollover_grace_seconds: number | null
  rollover_scope: string
  predecessor_scope: string | null
  successor_scope: string | null
  successor_created_at: string | null
}

const runtimeKeyScope = (
  table: string,
) => `json_array(${table}.name, ${table}.flow_id, ${table}.permissions, ${table}.expires_at,
  ${table}.release_revision, ${table}.issuer_member_id, ${table}.issuer_action, ${table}.tenant_id)`
const runtimeKeyColumns = `runtime_keys.id, name, flow_id, release_revision, permissions, expires_at, runtime_keys.created_at, revoked_at,
  issuer_member_id, issuer_action, tenant_id, incoming.previous_key_id AS replaces_key_id,
  outgoing.next_key_id AS replaced_by_key_id, outgoing.accept_until AS rollover_accept_until,
  outgoing.created_at AS rollover_created_at, outgoing.grace_seconds AS rollover_grace_seconds,
  ${runtimeKeyScope('runtime_keys')} AS rollover_scope,
  (SELECT ${runtimeKeyScope('previous')} FROM runtime_keys previous WHERE previous.id = incoming.previous_key_id) AS predecessor_scope,
  (SELECT ${runtimeKeyScope('following')} FROM runtime_keys following WHERE following.id = outgoing.next_key_id) AS successor_scope,
  (SELECT created_at FROM runtime_keys following WHERE following.id = outgoing.next_key_id) AS successor_created_at`
const runtimeKeyJoins = `LEFT JOIN runtime_key_rollovers incoming ON incoming.next_key_id = runtime_keys.id
  LEFT JOIN runtime_key_rollovers outgoing ON outgoing.previous_key_id = runtime_keys.id`

function runtimeKey(row: RuntimeKeyRow): RuntimeKey {
  const window = keyWindow(row)
  if (
    (row.issuer_member_id !== null || row.issuer_action !== null) &&
    (typeof row.issuer_member_id !== 'string' ||
      !row.issuer_member_id ||
      !['runtime-keys.manage', 'load-tests.run'].includes(
        row.issuer_action ?? '',
      ) ||
      row.release_revision === null)
  )
    throw new ApiError(503, 'Runtime key issuer binding is invalid')
  return {
    id: row.id,
    name: row.name,
    flowId: row.flow_id,
    releaseRevision: row.release_revision,
    permissions: JSON.parse(row.permissions),
    expiresAt: row.expires_at,
    acceptUntil: window.acceptUntil,
    replacesKeyId: window.replacesKeyId,
    replacedByKeyId: window.replacedByKeyId,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    tenantId: row.tenant_id,
    issuerBinding:
      row.issuer_member_id && row.issuer_action
        ? { memberId: row.issuer_member_id, action: row.issuer_action }
        : null,
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
  db.run(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;',
  )
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  db.transaction(() => {
    if (!query('SELECT version FROM migrations WHERE version = 1').get()) {
      db.run(`
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
      db.run(`CREATE TABLE audit (
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
      db.run(`
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
      db.run(
        "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO settings VALUES ('workspace', 'My workspace');",
      )
      query('INSERT INTO migrations VALUES (4, ?, ?)').run(
        'workspace setup',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 5').get()) {
      db.run(`
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
      db.run(`
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
      db.run(`
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
      db.run(`
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
      db.run(`
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
      db.run(`
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
      db.run(`
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

    if (!query('SELECT version FROM migrations WHERE version = 12').get()) {
      db.run(`CREATE TABLE database_connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bytes BLOB NOT NULL,
        metadata TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`)
      query('INSERT INTO migrations VALUES (12, ?, ?)').run(
        'immutable uploaded SQLite database copies',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 13').get()) {
      db.run(`ALTER TABLE runtime_keys ADD COLUMN release_revision INTEGER
        CHECK (release_revision IS NULL OR
          (typeof(release_revision) = 'integer' AND release_revision BETWEEN 1 AND 9007199254740991))`)
      query('INSERT INTO migrations VALUES (13, ?, ?)').run(
        'optional published release pins for runtime keys',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 14').get()) {
      db.run(`CREATE TABLE runtime_publication (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        generation INTEGER NOT NULL CHECK (generation >= 0 AND generation <= 9007199254740991)
      );
      INSERT INTO runtime_publication VALUES (1, 0);
      CREATE TABLE backend_artifacts (
        flow_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        compiler_version INTEGER NOT NULL,
        source TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        definition_sha256 TEXT NOT NULL,
        PRIMARY KEY (flow_id, revision, compiler_version),
        FOREIGN KEY (flow_id, revision) REFERENCES releases(flow_id, revision)
      );`)
      query('INSERT INTO migrations VALUES (14, ?, ?)').run(
        'generated published backend artifacts and runtime generations',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 15').get()) {
      db.run(`CREATE TABLE member_flow_access (
        member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        mode TEXT NOT NULL CHECK (mode IN ('all', 'selected')),
        version INTEGER NOT NULL CHECK (version > 0 AND version <= 9007199254740991)
      );
      INSERT INTO member_flow_access SELECT id, 'all', 1 FROM members;
      CREATE TABLE member_flow_grants (
        member_id TEXT NOT NULL REFERENCES member_flow_access(member_id) ON DELETE CASCADE,
        flow_id TEXT NOT NULL REFERENCES flows(id),
        PRIMARY KEY (member_id, flow_id)
      );`)
      query('INSERT INTO migrations VALUES (15, ?, ?)').run(
        'versioned selected API read access for workspace members',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 16').get()) {
      db.run(`CREATE TABLE member_source_use (
        member_id TEXT NOT NULL REFERENCES member_flow_access(member_id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL REFERENCES data_sources(id), PRIMARY KEY (member_id, resource_id)
      );
      CREATE TABLE member_database_use (
        member_id TEXT NOT NULL REFERENCES member_flow_access(member_id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL REFERENCES database_connections(id), PRIMARY KEY (member_id, resource_id)
      );
      CREATE TABLE member_auth_use (
        member_id TEXT NOT NULL REFERENCES member_flow_access(member_id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL REFERENCES auth_connections(id), PRIMARY KEY (member_id, resource_id)
      );
      ALTER TABLE runtime_keys ADD COLUMN issuer_member_id TEXT;
      ALTER TABLE runtime_keys ADD COLUMN issuer_action TEXT CHECK (
        (issuer_member_id IS NULL AND issuer_action IS NULL) OR
        (issuer_member_id IS NOT NULL AND issuer_action IS NOT NULL AND issuer_action IN ('runtime-keys.manage', 'load-tests.run'))
      );`)
      query('INSERT INTO migrations VALUES (16, ?, ?)').run(
        'scoped API operation and dependency-use grants with issuer-bound runtime keys',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 17').get()) {
      db.run(`
        CREATE TABLE tenants (
          id TEXT PRIMARY KEY, label TEXT NOT NULL, value TEXT NOT NULL COLLATE BINARY UNIQUE,
          state TEXT NOT NULL CHECK(state IN ('active', 'retired')),
          version INTEGER NOT NULL CHECK(version > 0 AND version <= 9007199254740991),
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE member_tenants (
          member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
          tenant_id TEXT REFERENCES tenants(id),
          version INTEGER NOT NULL CHECK(version > 0 AND version <= 9007199254740991)
        );
        INSERT INTO member_tenants SELECT id, NULL, 1 FROM members;
        CREATE TABLE source_row_policies (
          resource_id TEXT PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
          mode TEXT NOT NULL CHECK(mode IN ('unprotected', 'tenant')),
          tenant_column TEXT,
          version INTEGER NOT NULL CHECK(version > 0 AND version <= 9007199254740991),
          CHECK ((mode = 'unprotected' AND tenant_column IS NULL) OR (mode = 'tenant' AND tenant_column IS NOT NULL))
        );
        INSERT INTO source_row_policies SELECT id, 'unprotected', NULL, 1 FROM data_sources;
        CREATE TABLE database_row_policies (
          resource_id TEXT PRIMARY KEY REFERENCES database_connections(id) ON DELETE CASCADE,
          mode TEXT NOT NULL CHECK(mode IN ('unprotected', 'tenant')),
          version INTEGER NOT NULL CHECK(version > 0 AND version <= 9007199254740991)
        );
        INSERT INTO database_row_policies SELECT id, 'unprotected', 1 FROM database_connections;
        CREATE TABLE database_tenant_columns (
          resource_id TEXT NOT NULL REFERENCES database_row_policies(resource_id) ON DELETE CASCADE,
          table_name TEXT NOT NULL, column_key TEXT NOT NULL,
          PRIMARY KEY(resource_id, table_name)
        );
        CREATE TABLE row_protection_state (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          backups_owner_only INTEGER NOT NULL CHECK(backups_owner_only IN (0, 1))
        );
        INSERT INTO row_protection_state VALUES (1, 0);
        ALTER TABLE data_sources ADD COLUMN original_cells BLOB;
        ALTER TABLE runtime_keys ADD COLUMN tenant_id TEXT REFERENCES tenants(id)
          CHECK(tenant_id IS NULL OR release_revision IS NOT NULL);
        ALTER TABLE load_tests ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
      `)
      query('INSERT INTO migrations VALUES (17, ?, ?)').run(
        'trusted tenant identities and resource-owned row protection',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 18').get()) {
      db.run(`
        DROP INDEX published_route;
        CREATE UNIQUE INDEX published_route ON flows (
          (CASE WHEN json_extract(published, '$.graphql') IS NOT NULL THEN 'graphql'
            WHEN json_extract(published, '$.websocket') IS NOT NULL THEN 'websocket' ELSE 'rest' END),
          json_extract(published, '$.method'), json_extract(published, '$.path')
        ) WHERE published IS NOT NULL;
        CREATE TABLE websocket_tickets (
          ticket_hash TEXT PRIMARY KEY,
          family TEXT NOT NULL CHECK(family IN ('published', 'draft')),
          flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
          revision INTEGER NOT NULL CHECK(revision > 0 AND revision <= 9007199254740991),
          origin TEXT NOT NULL,
          proof_kind TEXT NOT NULL CHECK(proof_kind IN ('runtime', 'member-key', 'session')),
          proof_key TEXT NOT NULL,
          runtime_key_id TEXT REFERENCES runtime_keys(id),
          member_id TEXT, member_key_hash TEXT, session_id TEXT,
          tenant_id TEXT REFERENCES tenants(id),
          expires_at INTEGER NOT NULL,
          CHECK (
            (family = 'published' AND proof_kind = 'runtime' AND runtime_key_id IS NOT NULL
              AND member_id IS NULL AND member_key_hash IS NULL AND session_id IS NULL) OR
            (family = 'draft' AND runtime_key_id IS NULL AND member_id IS NOT NULL AND (
              (proof_kind = 'member-key' AND member_key_hash IS NOT NULL AND session_id IS NULL) OR
              (proof_kind = 'session' AND member_key_hash IS NULL AND session_id IS NOT NULL)
            ))
          )
        );
        CREATE INDEX websocket_ticket_proof ON websocket_tickets(proof_key);
        CREATE INDEX websocket_ticket_expiry ON websocket_tickets(expires_at);
      `)
      query('INSERT INTO migrations VALUES (18, ?, ?)').run(
        'typed WebSocket routes and single-use handshake tickets',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 19').get()) {
      db.run(`
        CREATE TABLE source_field_policies (
          resource_id TEXT PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
          mode TEXT NOT NULL CHECK(mode IN ('all', 'selected')),
          columns TEXT NOT NULL CHECK(json_valid(columns) AND json_type(columns) = 'array')
        );
        INSERT INTO source_field_policies SELECT id, 'all', '[]' FROM data_sources;
        CREATE TABLE database_table_field_policies (
          resource_id TEXT NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
          table_name TEXT NOT NULL,
          mode TEXT NOT NULL CHECK(mode IN ('all', 'selected')),
          columns TEXT NOT NULL CHECK(json_valid(columns) AND json_type(columns) = 'array'),
          PRIMARY KEY(resource_id, table_name)
        );
        INSERT INTO database_table_field_policies
          SELECT database_connections.id, json_extract(value, '$.name'), 'all', '[]'
          FROM database_connections, json_each(database_connections.metadata);
      `)
      query('INSERT INTO migrations VALUES (19, ?, ?)').run(
        'resource-owned API field exposure policies',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 20').get()) {
      db.run(`CREATE TABLE runtime_key_rollovers (
        previous_key_id TEXT PRIMARY KEY REFERENCES runtime_keys(id),
        next_key_id TEXT NOT NULL UNIQUE REFERENCES runtime_keys(id),
        created_at TEXT NOT NULL,
        accept_until TEXT NOT NULL,
        grace_seconds INTEGER NOT NULL CHECK(typeof(grace_seconds) = 'integer' AND grace_seconds BETWEEN 0 AND 300),
        CHECK(previous_key_id != next_key_id)
      )`)
      query('INSERT INTO migrations VALUES (20, ?, ?)').run(
        'coordinated runtime key rollover with fixed grace deadlines',
        new Date().toISOString(),
      )
    }

    if (!query('SELECT version FROM migrations WHERE version = 21').get()) {
      db.run(`
        CREATE TABLE source_tenant_field_profiles (
          resource_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL REFERENCES tenants(id),
          mode TEXT NOT NULL CHECK(mode = 'selected'),
          columns TEXT NOT NULL CHECK(json_valid(columns) AND json_type(columns) = 'array'),
          PRIMARY KEY(resource_id, tenant_id)
        );
        CREATE TABLE database_tenant_field_profiles (
          resource_id TEXT NOT NULL,
          table_name TEXT NOT NULL,
          tenant_id TEXT NOT NULL REFERENCES tenants(id),
          mode TEXT NOT NULL CHECK(mode = 'selected'),
          columns TEXT NOT NULL CHECK(json_valid(columns) AND json_type(columns) = 'array'),
          PRIMARY KEY(resource_id, table_name, tenant_id),
          FOREIGN KEY(resource_id, table_name) REFERENCES database_table_field_policies(resource_id, table_name) ON DELETE CASCADE
        );
      `)
      query('INSERT INTO migrations VALUES (21, ?, ?)').run(
        'tenant-specific protected API field profiles',
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
      query(
        "INSERT OR IGNORE INTO member_flow_access VALUES ('owner', 'all', 1)",
      ).run()
      query(
        "INSERT OR IGNORE INTO member_tenants VALUES ('owner', NULL, 1)",
      ).run()

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

  try {
    // Validate historical topology once; admission only checks indexed adjacent endpoints.
    assertRolloverGraph(
      query<{ previous_key_id: string; next_key_id: string }, []>(
        'SELECT previous_key_id, next_key_id FROM runtime_key_rollovers',
      ).all(),
      query<
        RuntimeKeyRow,
        []
      >(`SELECT ${runtimeKeyColumns} FROM runtime_keys ${runtimeKeyJoins}
        WHERE incoming.previous_key_id IS NOT NULL OR outgoing.next_key_id IS NOT NULL`).all(),
    )
  } catch (error) {
    for (const statement of statements.values()) statement.finalize()
    db.close()
    throw error
  }

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
    return db.transaction(() => resolveMemberSnapshot(id))()
  }

  function resolveMemberSnapshot(id: string): Member | null {
    const row = query<MemberRow, [string]>(
      'SELECT id, name, role FROM members WHERE id = ?',
    ).get(id)
    if (!row) return null
    const accessRow = query<
      { mode: 'all' | 'selected'; version: number },
      [string]
    >('SELECT mode, version FROM member_flow_access WHERE member_id = ?').get(
      id,
    )
    if (!accessRow) return null
    const tenantAssignment = query<
      { tenant_id: string | null; version: number },
      [string]
    >('SELECT tenant_id, version FROM member_tenants WHERE member_id = ?').get(
      id,
    )
    if (!tenantAssignment) return null
    const tenant = {
      tenantId: tenantAssignment.tenant_id,
      version: tenantAssignment.version,
    }
    const flowAccess: FlowAccess = {
      ...accessRow,
      flowIds:
        accessRow.mode === 'selected'
          ? query<{ flow_id: string }, [string]>(
              'SELECT flow_id FROM member_flow_grants WHERE member_id = ? ORDER BY flow_id',
            )
              .all(id)
              .map((grant) => grant.flow_id)
          : [],
    }
    const access: MemberAccess = {
      ...flowAccess,
      dependencyUse: {
        sources: query<{ resource_id: string }, [string]>(
          'SELECT resource_id FROM member_source_use WHERE member_id = ? ORDER BY resource_id',
        )
          .all(id)
          .map((entry) => entry.resource_id),
        databaseConnections: query<{ resource_id: string }, [string]>(
          'SELECT resource_id FROM member_database_use WHERE member_id = ? ORDER BY resource_id',
        )
          .all(id)
          .map((entry) => entry.resource_id),
        authConnections: query<{ resource_id: string }, [string]>(
          'SELECT resource_id FROM member_auth_use WHERE member_id = ? ORDER BY resource_id',
        )
          .all(id)
          .map((entry) => entry.resource_id),
      },
    }
    const assignment = query<{ role_id: string }, [string]>(
      'SELECT role_id FROM member_roles WHERE member_id = ?',
    ).get(id)
    if (!assignment || row.role === 'owner')
      return {
        ...row,
        permissions: [...builtinPermissions[row.role]],
        flowAccess,
        access,
        tenantAssignment: tenant,
      }
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
      flowAccess,
      access,
      tenantAssignment: tenant,
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

  function validateFlowAccess(
    input: FlowAccessInput,
    permissions: readonly string[],
    status = 409,
  ) {
    if (input.mode !== 'selected') return
    if (!supportsSelectedFlows(permissions))
      throw new ApiError(
        status,
        'Selected API access requires scoped API actions only',
      )
    for (const id of input.flowIds)
      if (!query('SELECT id FROM flows WHERE id = ?').get(id))
        throw new ApiError(404, 'Flow not found')
  }

  function saveFlowGrants(id: string, input: FlowAccessInput) {
    query('DELETE FROM member_flow_grants WHERE member_id = ?').run(id)
    if (input.mode === 'selected')
      for (const flowId of input.flowIds)
        query('INSERT INTO member_flow_grants VALUES (?, ?)').run(id, flowId)
  }

  function saveDependencyUse(id: string, input: MemberAccessInput) {
    const families = [
      ['sources', 'member_source_use', 'data_sources'],
      ['databaseConnections', 'member_database_use', 'database_connections'],
      ['authConnections', 'member_auth_use', 'auth_connections'],
    ] as const
    for (const [family, table, resources] of families) {
      query(`DELETE FROM ${table} WHERE member_id = ?`).run(id)
      if (input.mode === 'selected')
        for (const resourceId of input.dependencyUse[family]) {
          if (
            !query(`SELECT id FROM ${resources} WHERE id = ?`).get(resourceId)
          )
            throw new ApiError(404, 'Dependency not found')
          query(`INSERT INTO ${table} VALUES (?, ?)`).run(id, resourceId)
        }
    }
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
    releaseRevision: number | null = null,
  ) {
    const flow = query<
      { published: string | null; published_revision: number | null },
      [string]
    >('SELECT published, published_revision FROM flows WHERE id = ?').get(
      flowId,
    )
    if (!flow) throw new ApiError(404, 'Flow not found')
    if (releaseRevision !== null && flow.published_revision !== releaseRevision)
      throw new ApiError(
        409,
        'Selected release is no longer published. Reload before issuing a pinned key.',
      )
    if (!flow.published)
      throw new ApiError(
        conflict ? 409 : 400,
        'Publish this API before issuing a runtime key',
      )
    if (
      flowTransport(JSON.parse(flow.published)) === 'websocket' &&
      releaseRevision === null
    )
      throw new ApiError(
        400,
        'WebSocket keys require the current published release pin',
      )
    validateRuntimePermissions(flow.published, permissions, conflict)
  }

  function validateRuntimePermissions(
    definition: string,
    permissions: RuntimePermission[],
    conflict = false,
  ) {
    const transport = flowTransport(JSON.parse(definition))
    if (
      !permissions.length ||
      new Set(permissions).size !== permissions.length ||
      permissions.some((permission) =>
        transport === 'graphql'
          ? !['query', 'mutation'].includes(permission)
          : permission !== (transport === 'websocket' ? 'ws' : 'rest'),
      )
    )
      throw new ApiError(
        conflict ? 409 : 400,
        'Permissions must match the published API type',
      )
  }

  function insertRuntimeKey(actor: string, key: RuntimeKey, token: string) {
    query(
      'INSERT INTO runtime_keys (id, name, flow_id, permissions, token_hash, expires_at, created_at, release_revision, issuer_member_id, issuer_action, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      key.id,
      key.name,
      key.flowId,
      JSON.stringify(key.permissions),
      hashToken(token),
      key.expiresAt,
      key.createdAt,
      key.releaseRevision,
      key.issuerBinding?.memberId ?? null,
      key.issuerBinding?.action ?? null,
      key.tenantId,
    )
    audit(actor, 'runtime-key.created', key.id)
  }

  function keyRow(id: string) {
    const row = query<RuntimeKeyRow, [string]>(
      `SELECT ${runtimeKeyColumns} FROM runtime_keys ${runtimeKeyJoins} WHERE runtime_keys.id = ?`,
    ).get(id)
    if (!row) throw new ApiError(404, 'Runtime key not found')
    return row
  }

  function assertKeyAccess(member: Member, key: RuntimeKey) {
    try {
      authorizeFlow(member, key.flowId, 'runtime-keys.manage')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404)
        throw new ApiError(404, 'Runtime key not found')
      throw error
    }
    if (member.access.mode === 'selected' && key.issuerBinding === null)
      throw new ApiError(404, 'Runtime key not found')
    if (
      member.role !== 'owner' &&
      key.tenantId !== null &&
      !(
        (key.issuerBinding !== null &&
          key.tenantId === member.tenantAssignment.tenantId) ||
        key.issuerBinding?.memberId === member.id
      )
    )
      throw new ApiError(404, 'Runtime key not found')
  }

  function issuerAuthority(key: RuntimeKey, definition: Flow, status = 403) {
    runtimeRowPrincipal(
      { db, query, member: resolveMember },
      key,
      definition,
      status,
    )
    if (!key.issuerBinding) return
    const issuer = resolveMember(key.issuerBinding.memberId)
    if (!issuer)
      throw new ApiError(
        status,
        'Runtime key issuer no longer authorizes this API',
      )
    try {
      authorizeGraph(issuer, key.flowId, key.issuerBinding.action, definition)
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      throw new ApiError(
        status,
        'Runtime key issuer no longer authorizes this API',
      )
    }
  }

  function keyCleanupOnly(member: Member | undefined, key: RuntimeKey) {
    if (!key.tenantId) return false
    if (key.revokedAt || Date.parse(key.acceptUntil) <= Date.now()) return true
    if (
      member &&
      member.role !== 'owner' &&
      member.tenantAssignment.tenantId !== key.tenantId
    )
      return true
    const release = query<{ definition: string }, [string, number]>(
      'SELECT definition FROM releases WHERE flow_id = ? AND revision = ?',
    ).get(key.flowId, key.releaseRevision!)
    if (!release) return true
    try {
      const definition = JSON.parse(release.definition) as Flow
      issuerAuthority(key, definition)
      if (member)
        authorizeGraph(member, key.flowId, 'runtime-keys.manage', definition)
      return false
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      return true
    }
  }

  return {
    db,
    query,
    audit,
    revokeMemberSessions: revokeSessions,
    member: resolveMember,
    assertKeyAccess(member: Member, id: string) {
      assertKeyAccess(member, runtimeKey(keyRow(id)))
    },
    checkRuntimeAuthority(key: RuntimeKey, definition: Flow) {
      db.transaction(() => {
        const row = keyRow(key.id)
        if (!keyWindow(row).accepted)
          throw new ApiError(401, 'Authentication required')
        const current = runtimeKey(row)
        if (
          current.issuerBinding === null &&
          current.tenantId === null &&
          flowTransport(definition) !== 'websocket' &&
          !protectedShape({ db, query }, definition).required
        )
          return
        issuerAuthority(current, definition)
      })()
    },
    checkRuntimeIssuerAuthority(id: string, definition: Flow) {
      issuerAuthority(runtimeKey(keyRow(id)), definition)
    },
    protectDependencyUse(
      family: 'sources' | 'database-connections' | 'auth-connections',
      id: string,
    ) {
      const table = {
        sources: 'member_source_use',
        'database-connections': 'member_database_use',
        'auth-connections': 'member_auth_use',
      }[family]
      if (
        query(
          `SELECT member_id FROM ${table} WHERE resource_id = ? LIMIT 1`,
        ).get(id)
      )
        throw new ApiError(
          409,
          'Remove dependency-use grants before deleting this resource',
        )
    },
    updateAccess(actor: string, id: string, value: unknown) {
      const parsed = memberAccessUpdateSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide a complete access profile and expected version',
        )
      db.transaction(() => {
        const current = resolveMember(id)
        if (!current) throw new ApiError(404, 'Member not found')
        if (current.role === 'owner')
          throw new ApiError(409, 'Owner API access cannot be changed')
        if (
          current.access.version !== parsed.data.version ||
          current.access.version === Number.MAX_SAFE_INTEGER
        )
          throw new ApiError(409, 'API access changed. Reload before saving.')
        validateFlowAccess(parsed.data, current.permissions)
        saveFlowGrants(id, parsed.data)
        saveDependencyUse(id, parsed.data)
        query(
          'UPDATE member_flow_access SET mode = ?, version = version + 1 WHERE member_id = ?',
        ).run(parsed.data.mode, id)
        revokeSessions(actor, id)
        audit(actor, 'member.access.updated', id)
      }).immediate()
      return resolveMember(id)!
    },
    updateFlowAccess(actor: string, id: string, value: unknown) {
      const parsed = flowAccessUpdateSchema.safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose all APIs or up to 256 distinct API IDs and the expected access version',
        )
      db.transaction(() => {
        const current = resolveMember(id)
        if (!current) throw new ApiError(404, 'Member not found')
        if (current.role === 'owner')
          throw new ApiError(409, 'Owner API access cannot be changed')
        if (current.flowAccess.version !== parsed.data.version)
          throw new ApiError(409, 'API access changed. Reload before saving.')
        if (current.flowAccess.version === Number.MAX_SAFE_INTEGER)
          throw new ApiError(409, 'API access version limit reached')
        validateFlowAccess(parsed.data, current.permissions)
        query(
          'UPDATE member_flow_access SET mode = ?, version = version + 1 WHERE member_id = ?',
        ).run(parsed.data.mode, id)
        saveFlowGrants(id, parsed.data)
        if (parsed.data.mode === 'all') saveDependencyUse(id, { mode: 'all' })
        revokeSessions(actor, id)
        audit(actor, 'member.flow-access.updated', id)
      }).immediate()
      return resolveMember(id)!
    },
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
          !supportsSelectedFlows(input.permissions) &&
          query(
            "SELECT member_roles.member_id FROM member_roles JOIN member_flow_access ON member_flow_access.member_id = member_roles.member_id WHERE role_id = ? AND mode = 'selected' LIMIT 1",
          ).get(id)
        )
          throw new ApiError(
            409,
            'Reassign selected API members before adding global permissions',
          )
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
        const permissions =
          assignment.role === 'custom'
            ? getRole(assignment.roleId).permissions
            : builtinPermissions[assignment.role]
        validateFlowAccess(current.flowAccess, permissions)
        if (current.flowAccess.version === Number.MAX_SAFE_INTEGER)
          throw new ApiError(409, 'API access version limit reached')
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
        query(
          'UPDATE member_flow_access SET version = version + 1 WHERE member_id = ?',
        ).run(id)
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
        query("INSERT INTO member_flow_access VALUES ('owner', 'all', 1)").run()
        query("INSERT INTO member_tenants VALUES ('owner', NULL, 1)").run()
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
      flowAccess: FlowAccessInput = { mode: 'all' },
      access?: MemberAccessInput,
      tenantId: string | null = null,
      currentMember?: CurrentMember,
    ) {
      const member = { id: crypto.randomUUID(), name, role }
      const token = crypto.randomUUID() + crypto.randomUUID()

      const created = db
        .transaction(() => {
          if (currentMember && currentMember().role !== 'owner')
            throw new ApiError(403, 'Owner access required')
          const custom = role === 'custom' && roleId ? getRole(roleId) : null
          if (role === 'custom' && !custom)
            throw new ApiError(404, 'Role not found')
          if (role !== 'custom' && roleId !== undefined)
            throw new ApiError(
              400,
              'Built-in roles cannot include a custom role ID',
            )
          const scope = access ?? flowAccess
          validateFlowAccess(
            scope,
            custom?.permissions ??
              builtinPermissions[role as 'editor' | 'viewer'],
            400,
          )
          if (
            account &&
            query('SELECT member_id FROM accounts WHERE email = ?').get(
              account.email,
            )
          )
            throw new ApiError(409, 'Email address unavailable')
          if (tenantId !== null) activeTenant(db, tenantId)
          query('INSERT INTO members VALUES (?, ?, ?, ?)').run(
            member.id,
            name,
            role === 'custom' ? 'viewer' : role,
            hashToken(token),
          )
          query('INSERT INTO member_flow_access VALUES (?, ?, 1)').run(
            member.id,
            scope.mode,
          )
          query('INSERT INTO member_tenants VALUES (?, ?, 1)').run(
            member.id,
            tenantId,
          )
          saveFlowGrants(member.id, scope)
          if (access) saveDependencyUse(member.id, access)
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
          return resolveMember(member.id)!
        })
        .immediate()

      return { ...created, token }
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
    listRuntimeKeys(member?: Member) {
      const selected = member?.access.mode === 'selected'
      return query<RuntimeKeyRow & { managed: number }>(
        `SELECT ${runtimeKeyColumns}, EXISTS (SELECT 1 FROM load_tests WHERE runtime_key_id = runtime_keys.id) AS managed FROM runtime_keys ${runtimeKeyJoins} WHERE 1 = 1 ${selected ? 'AND issuer_member_id IS NOT NULL AND flow_id IN (SELECT flow_id FROM member_flow_grants WHERE member_id = ?)' : ''} ${member && member.role !== 'owner' ? 'AND (tenant_id IS NULL OR issuer_member_id = ? OR (issuer_member_id IS NOT NULL AND tenant_id = ?))' : ''} ORDER BY runtime_keys.rowid DESC`,
      )
        .all(
          ...(selected ? [member!.id] : []),
          ...(member && member.role !== 'owner'
            ? [member.id, member.tenantAssignment.tenantId]
            : []),
        )
        .map((row): RuntimeKey => ({
          ...runtimeKey(row),
          ...(row.managed ? { managedBy: 'load-test' } : {}),
          ...(keyCleanupOnly(member, runtimeKey(row))
            ? { cleanupOnly: true }
            : {}),
        }))
    },
    createRuntimeKey(
      actor: string,
      input: unknown,
      currentMember?: CurrentMember,
      action: 'runtime-keys.manage' | 'load-tests.run' = 'runtime-keys.manage',
    ) {
      if (
        currentMember &&
        input &&
        typeof input === 'object' &&
        'flowId' in input &&
        typeof input.flowId === 'string'
      )
        authorizeFlow(currentMember(), input.flowId, action)
      const parsed = z
        .object({
          name: z.string().max(500),
          flowId: z.string().min(1).max(80),
          permissions: z
            .array(z.enum(['rest', 'query', 'mutation', 'ws']))
            .min(1)
            .max(3),
          expiresAt: z.string().max(100),
          releaseRevision: z.number().int().positive().safe().optional(),
          tenantId: z.string().min(1).max(80).optional(),
        })
        .strict()
        .safeParse(input)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide valid runtime key settings and an optional positive safe release revision',
        )
      const value = parsed.data
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
        releaseRevision: value.releaseRevision ?? null,
        permissions: value.permissions,
        expiresAt: new Date(expiration).toISOString(),
        acceptUntil: new Date(expiration).toISOString(),
        replacesKeyId: null,
        replacedByKeyId: null,
        createdAt: new Date(now).toISOString(),
        revokedAt: null,
        issuerBinding: null,
        tenantId: null,
      }
      const token = `besh_${randomBytes(32).toString('base64url')}`

      db.transaction(() => {
        if (currentMember) {
          const member = currentMember()
          authorizeFlow(member, key.flowId, action)
          const published = query<
            { published: string | null; published_revision: number | null },
            [string]
          >('SELECT published, published_revision FROM flows WHERE id = ?').get(
            key.flowId,
          )
          if (!published) throw new ApiError(404, 'Flow not found')
          if (
            key.releaseRevision !== null &&
            key.releaseRevision !== published.published_revision
          )
            throw new ApiError(
              409,
              'Selected release is no longer published. Reload before issuing a pinned key.',
            )
          if (!published.published)
            throw new ApiError(
              value.releaseRevision === undefined ? 400 : 409,
              'Publish this API before issuing a runtime key',
            )
          authorizeGraph(
            member,
            key.flowId,
            action,
            JSON.parse(published.published),
          )
          const graph = JSON.parse(published.published) as Flow
          const principal = memberRowPrincipal(
            { db, query },
            member,
            graph,
            value.tenantId,
          )
          key.tenantId = principal?.tenantId ?? null
          if (member.access.mode === 'selected' || principal) {
            if (value.releaseRevision === undefined)
              throw new ApiError(
                400,
                'Selected or protected API keys require the current published release pin',
              )
            if (member.role !== 'owner' || action === 'load-tests.run')
              key.issuerBinding = { memberId: member.id, action }
          }
        }
        // Another process may hold the write lock beyond the requested expiry.
        if (expiration <= Date.now())
          throw new ApiError(
            400,
            'Expiration must be a valid future date within 366 days',
          )
        validateRuntimeScope(
          key.flowId,
          key.permissions,
          false,
          key.releaseRevision,
        )
        insertRuntimeKey(actor, key, token)
      }).immediate()

      return { ...key, token }
    },
    rotateRuntimeKey(
      actor: string,
      id: string,
      currentMember?: CurrentMember,
      graceSeconds = 0,
    ) {
      return db
        .transaction(() => {
          const row = keyRow(id)
          if (currentMember) assertKeyAccess(currentMember(), runtimeKey(row))

          // Load-test credentials stay private and expire with their owning job.
          if (
            query('SELECT id FROM load_tests WHERE runtime_key_id = ?').get(id)
          )
            throw new ApiError(409, 'Load test keys are managed automatically')

          if (row.replaced_by_key_id !== null)
            throw new ApiError(409, 'This key already has a replacement')
          if (
            row.replaces_key_id !== null &&
            keyWindow(keyRow(row.replaces_key_id)).accepted
          )
            throw new ApiError(
              409,
              'The previous key still has an approved overlap window. Revoke it explicitly or wait for its deadline.',
            )

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
          if (
            !Number.isInteger(graceSeconds) ||
            graceSeconds < 0 ||
            graceSeconds > 300
          )
            throw new ApiError(
              400,
              'Choose a grace period from zero to 300 seconds',
            )
          const acceptUntil = now + graceSeconds * 1000
          if (acceptUntil > Date.parse(row.expires_at))
            throw new ApiError(
              400,
              'The requested grace period exceeds the original key expiration',
            )

          const key: RuntimeKey = {
            ...runtimeKey(row),
            id: crypto.randomUUID(),
            createdAt: new Date(now).toISOString(),
            revokedAt: null,
            replacesKeyId: id,
            replacedByKeyId: null,
            acceptUntil: row.expires_at,
          }
          const definition =
            key.releaseRevision === null
              ? query<{ published: string }, [string]>(
                  'SELECT published FROM flows WHERE id = ?',
                ).get(key.flowId)?.published
              : query<{ definition: string }, [string, number]>(
                  'SELECT definition FROM releases WHERE flow_id = ? AND revision = ?',
                ).get(key.flowId, key.releaseRevision)?.definition
          if (definition) {
            const graph = JSON.parse(definition) as Flow
            if (currentMember)
              authorizeGraph(
                currentMember(),
                key.flowId,
                'runtime-keys.manage',
                graph,
              )
            if (currentMember && key.tenantId !== null) {
              const member = currentMember()
              if (
                member.role !== 'owner' &&
                (key.issuerBinding === null ||
                  member.tenantAssignment.tenantId !== key.tenantId)
              )
                throw new ApiError(
                  409,
                  'Historical tenant credentials are available for cleanup only',
                )
            }
            issuerAuthority(key, graph, 409)
          }
          if (key.releaseRevision === null) {
            validateRuntimeScope(key.flowId, key.permissions, true)
          } else {
            const release = query<{ definition: string }, [string, number]>(
              'SELECT definition FROM releases WHERE flow_id = ? AND revision = ?',
            ).get(key.flowId, key.releaseRevision)
            if (!release)
              throw new ApiError(
                409,
                'Pinned release is unavailable. The key cannot be replaced.',
              )
            validateRuntimePermissions(
              release.definition,
              key.permissions,
              true,
            )
          }
          const token = `besh_${randomBytes(32).toString('base64url')}`

          if (graceSeconds === 0) {
            query('UPDATE runtime_keys SET revoked_at = ? WHERE id = ?').run(
              key.createdAt,
              id,
            )
            audit(actor, 'runtime-key.revoked', id)
          }
          insertRuntimeKey(actor, key, token)
          query('INSERT INTO runtime_key_rollovers VALUES (?, ?, ?, ?, ?)').run(
            id,
            key.id,
            key.createdAt,
            new Date(acceptUntil).toISOString(),
            graceSeconds,
          )
          if (graceSeconds > 0)
            audit(actor, 'runtime-key.rollover-scheduled', id)

          return { ...key, token }
        })
        .immediate()
    },
    revokeRuntimeKey(actor: string, id: string, currentMember?: CurrentMember) {
      db.transaction(() => {
        if (currentMember)
          assertKeyAccess(currentMember(), runtimeKey(keyRow(id)))
        if (
          !query(
            'UPDATE runtime_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?',
          ).run(new Date().toISOString(), id).changes
        )
          throw new ApiError(404, 'Runtime key not found')
        audit(actor, 'runtime-key.revoked', id)
      }).immediate()

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
    memberKeyAuthority(memberId: string, keyHash: string): Member | null {
      const row = query<{ id: string }, [string, string]>(
        'SELECT id FROM members WHERE id = ? AND token_hash = ?',
      ).get(memberId, keyHash)
      return row ? resolveMember(row.id) : null
    },
    authenticateRuntime(token: string): RuntimeKey | null {
      const row = query<RuntimeKeyRow, [string]>(
        `SELECT ${runtimeKeyColumns} FROM runtime_keys ${runtimeKeyJoins} WHERE token_hash = ?`,
      ).get(hashToken(token))

      if (
        !row ||
        row.revoked_at ||
        !Number.isFinite(Date.parse(row.expires_at)) ||
        Date.parse(row.expires_at) <= Date.now() ||
        !keyWindow(row).accepted
      )
        return null

      return runtimeKey(row)
    },
    runtimeCredential(id: string): RuntimeKey | null {
      let row: RuntimeKeyRow
      try {
        row = keyRow(id)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
      if (
        row.revoked_at ||
        !Number.isFinite(Date.parse(row.expires_at)) ||
        Date.parse(row.expires_at) <= Date.now() ||
        !keyWindow(row).accepted
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
