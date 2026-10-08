import { Database, type SQLQueryBindings, type Statement } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { ApiError } from './errors'

export type Member = {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
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

  return {
    db,
    query,
    audit,
    setupStatus() {
      return {
        required: !query("SELECT id FROM members WHERE id = 'owner'").get(),
        name: query<{ value: string }, []>(
          "SELECT value FROM settings WHERE key = 'workspace'",
        ).get()!.value,
      }
    },
    setup(name: string) {
      const token = crypto.randomUUID() + crypto.randomUUID()

      db.transaction(() => {
        if (query("SELECT id FROM members WHERE id = 'owner'").get())
          throw new ApiError(409, 'Workspace already configured')
        query("INSERT INTO members VALUES ('owner', 'Owner', 'owner', ?)").run(
          hashToken(token),
        )
        query("UPDATE settings SET value = ? WHERE key = 'workspace'").run(name)
        audit('owner', 'workspace.created', 'workspace')
      })()

      return { token, name }
    },
    listMembers() {
      return query('SELECT id, name, role FROM members ORDER BY name').all()
    },
    createMember(actor: string, name: string, role: 'editor' | 'viewer') {
      const member = { id: crypto.randomUUID(), name, role }
      const token = crypto.randomUUID() + crypto.randomUUID()

      db.transaction(() => {
        query('INSERT INTO members VALUES (?, ?, ?, ?)').run(
          member.id,
          name,
          role,
          hashToken(token),
        )
        audit(actor, 'member.created', member.id)
      })()

      return { ...member, token }
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
    authenticate(token: string): Member | null {
      return query<Member, [string]>(
        'SELECT id, name, role FROM members WHERE token_hash = ?',
      ).get(hashToken(token))
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
