import { z } from 'zod'
import { ApiError } from '../errors'
import type { Store } from '../workspace/store'
import type {
  DatabaseConnection,
  DatabasePreview,
  DatabaseReadConfig,
  DatabaseTable,
} from './model'
import { databaseProcesses } from './process'
import { databaseApi } from './api'
import type { Flow } from '../flows/model'

const versionSchema = z.number().int().positive().safe()
const readFields = {
  table: z.string().min(1).max(128),
  columns: z
    .array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/))
    .min(1)
    .max(32)
    .refine((values) => new Set(values).size === values.length),
  filter: z
    .object({
      column: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
      value: z.union([
        z.string().max(4096),
        z.number().finite(),
        z.boolean(),
        z.null(),
      ]),
    })
    .strict()
    .optional(),
  limit: z.number().int().min(1).max(100),
}
type Row = {
  id: string
  name: string
  bytes: Uint8Array
  metadata: string
  version: number
  created_at: string
  updated_at: string
}

export function databaseConnectionService(store: Store) {
  const workers = databaseProcesses()
  let closed = false
  function row(id: string) {
    const result = store
      .query<Row, [string]>('SELECT * FROM database_connections WHERE id = ?')
      .get(id)
    if (!result) throw new ApiError(404, 'Database connection not found')
    return result
  }
  function present(value: Row): DatabaseConnection {
    return {
      id: value.id,
      name: value.name,
      kind: 'sqlite',
      mode: 'uploaded-copy',
      bytes: value.bytes.byteLength,
      version: value.version,
      tables: JSON.parse(value.metadata),
      createdAt: value.created_at,
      updatedAt: value.updated_at,
    }
  }
  function expected(id: string, version: number) {
    const current = row(id)
    if (current.version !== version)
      throw new ApiError(
        409,
        'Database connection changed. Reload before continuing.',
      )
    return current
  }
  function readOptions(
    connection: DatabaseConnection,
    config: Omit<DatabaseReadConfig, 'connectionId'>,
  ) {
    const table = connection.tables.find((item) => item.name === config.table)
    if (
      !table ||
      config.columns.some(
        (key) => !table.columns.some((column) => column.key === key),
      ) ||
      (config.filter &&
        !table.columns.some((column) => column.key === config.filter!.column))
    )
      throw new ApiError(400, 'Choose an inspected table and columns')
    return table
  }
  return {
    list() {
      return store
        .query<Row, []>(
          'SELECT * FROM database_connections ORDER BY created_at DESC',
        )
        .all()
        .map(present)
    },
    get(id: string) {
      return present(row(id))
    },
    async create(
      actor: string,
      name: unknown,
      file: File,
      authorize: () => void,
      signal?: AbortSignal,
    ) {
      const parsed = z
        .string()
        .trim()
        .min(1)
        .max(80)
        .refine((value) => !/[\u0000-\u001f\u007f]/.test(value))
        .safeParse(name)
      if (!parsed.success)
        throw new ApiError(400, 'Choose a database connection name')
      if (file.size > 2 * 1024 * 1024)
        throw new ApiError(413, 'SQLite upload limit is two MiB')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const inspection = await workers.run(bytes, { action: 'inspect' }, signal)
      if (closed) throw new ApiError(503, 'SQLite reader is shutting down')
      authorize()
      const id = crypto.randomUUID()
      const time = new Date().toISOString()
      store.db
        .transaction(() => {
          const quota = store
            .query<{ count: number; bytes: number }, []>(
              'SELECT count(*) AS count, coalesce(sum(length(bytes)), 0) AS bytes FROM database_connections',
            )
            .get()!
          if (quota.count >= 8 || quota.bytes + bytes.length > 16 * 1024 * 1024)
            throw new ApiError(
              409,
              'Database connection storage limit exceeded',
            )
          store
            .query(
              'INSERT INTO database_connections VALUES (?, ?, ?, ?, 1, ?, ?)',
            )
            .run(
              id,
              parsed.data,
              bytes,
              JSON.stringify(inspection.tables),
              time,
              time,
            )
          store.audit(actor, 'database-connection.created', id)
        })
        .immediate()
      return present(row(id))
    },
    async preview(
      id: string,
      value: unknown,
      signal?: AbortSignal,
      authorize?: () => void,
    ): Promise<DatabasePreview> {
      const parsed = z
        .object({ version: versionSchema, ...readFields })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide a version and bounded SQLite read options',
        )
      const current = expected(id, parsed.data.version)
      readOptions(present(current), parsed.data)
      const result = await workers.run(
        current.bytes,
        { action: 'read', ...parsed.data },
        signal,
      )
      if (closed) throw new ApiError(503, 'SQLite reader is shutting down')
      authorize?.()
      return {
        version: current.version,
        table: parsed.data.table,
        columns: parsed.data.columns,
        rows: result.rows as DatabasePreview['rows'],
      }
    },
    api(id: string, value: unknown) {
      return databaseApi(present(row(id)), value)
    },
    async check(
      actor: string,
      id: string,
      value: unknown,
      authorize: () => void,
      signal?: AbortSignal,
    ) {
      const parsed = z
        .object({ version: versionSchema })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide the expected database connection version',
        )
      const current = expected(id, parsed.data.version)
      const result = await workers.run(
        current.bytes,
        { action: 'inspect' },
        signal,
      )
      if (closed) throw new ApiError(503, 'SQLite reader is shutting down')
      authorize()
      store.db
        .transaction(() => {
          expected(id, parsed.data.version)
          store.audit(actor, 'database-connection.checked', id)
        })
        .immediate()
      return {
        version: current.version,
        ok: true as const,
        tables: result.tables as DatabaseTable[],
      }
    },
    delete(actor: string, id: string, value: unknown) {
      const parsed = z
        .object({ version: versionSchema })
        .strict()
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Provide the expected database connection version',
        )
      store.db
        .transaction(() => {
          expected(id, parsed.data.version)
          const definitions = store
            .query<{ definition: string }, []>(
              'SELECT definition FROM flows UNION ALL SELECT definition FROM releases',
            )
            .all()
          if (
            definitions.some((item) =>
              (JSON.parse(item.definition) as Flow).nodes.some(
                (node) =>
                  node.type === 'database' && node.config.connectionId === id,
              ),
            )
          )
            throw new ApiError(
              409,
              'This database copy is referenced by a draft or historical release',
            )
          store.query('DELETE FROM database_connections WHERE id = ?').run(id)
          store.audit(actor, 'database-connection.deleted', id)
        })
        .immediate()
      return { ok: true }
    },
    validate(flow: Flow) {
      for (const node of flow.nodes)
        if (node.type === 'database')
          readOptions(present(row(node.config.connectionId)), node.config)
    },
    async read(config: DatabaseReadConfig, signal?: AbortSignal) {
      const current = row(config.connectionId)
      readOptions(present(current), config)
      const result = await workers.run(
        current.bytes,
        { action: 'read', ...config },
        signal,
      )
      return result.rows
    },
    close() {
      closed = true
      return workers.close()
    },
  }
}
