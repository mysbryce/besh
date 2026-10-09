import { Database } from 'bun:sqlite'
import type { DataColumn, DataRow } from '../data/sources'
import type { DatabaseTable } from './model'

class InvalidCopy extends Error {}
const fail = (message: string): never => {
  throw new InvalidCopy(message)
}
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
const safeName = (name: string) =>
  name.length > 0 && name.length <= 128 && !/[\u0000-\u001f\u007f]/.test(name)
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

function scalar(
  value: unknown,
  type?: DataColumn['type'],
): string | number | boolean | null {
  if (value === null) return null
  if (typeof value === 'bigint') {
    if (
      value > BigInt(Number.MAX_SAFE_INTEGER) ||
      value < BigInt(Number.MIN_SAFE_INTEGER)
    )
      fail('SQLite integers must be safely representable in JSON')
    value = Number(value)
  }
  if (type === 'boolean') {
    if (value !== 0 && value !== 1)
      fail('Boolean columns must contain only zero, one, or null')
    return value === 1
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length <= 4096) return value
  return fail(
    'SQLite values must be bounded text, finite numbers, booleans, or null',
  )
}

function inspect(db: Database): DatabaseTable[] {
  const objects = db
    .query<{ name: string; type: string; sql: string }, []>(
      "SELECT name, type, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY name",
    )
    .all()
  if (
    !objects.length ||
    objects.filter((item) => item.type === 'table').length > 8
  )
    fail('Choose a SQLite database with one to eight ordinary tables')
  if (
    objects.some(
      (item) =>
        item.type === 'view' ||
        (item.type === 'table' &&
          /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(item.sql)),
    )
  )
    fail('SQLite views and virtual tables are unsupported')
  let total = 0
  return objects
    .filter((item) => item.type === 'table')
    .map(({ name }) => {
      if (!safeName(name))
        fail(
          'SQLite table names must be bounded and contain no control characters',
        )
      const fields = db
        .query<
          { name: string; type: string; notnull: bigint; hidden: bigint },
          [string]
        >('SELECT name, type, "notnull", hidden FROM pragma_table_xinfo(?)')
        .all(name)
      if (
        !fields.length ||
        fields.length > 32 ||
        fields.some((field) => field.hidden !== 0n)
      )
        fail(
          'SQLite tables must have one to 32 ordinary columns without generated columns',
        )
      const keys = new Set<string>()
      const columns: DataColumn[] = fields.map((field, index) => {
        if (!safeName(field.name))
          fail(
            'SQLite column names must be bounded and contain no control characters',
          )
        let key = field.name
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 56)
        if (!/^[a-z]/.test(key) || unsafeKeys.has(key))
          key = `column_${index + 1}`
        const base = key
        let suffix = 2
        while (keys.has(key)) key = `${base}_${suffix++}`
        keys.add(key)
        const declared = field.type.toUpperCase()
        const type =
          declared === 'BOOLEAN' || declared === 'BOOL'
            ? 'boolean'
            : /INT|REAL|FLOA|DOUB|NUM|DEC/.test(declared)
              ? 'number'
              : /CHAR|CLOB|TEXT/.test(declared)
                ? 'string'
                : undefined
        if (!type)
          fail(
            'SQLite columns must declare supported text, numeric, or boolean types',
          )
        return {
          key,
          label: field.name,
          type: type!,
          nullable: field.notnull === 0n,
        }
      })
      const rows = db
        .query(
          `SELECT ${fields.map((field) => quote(field.name)).join(', ')} FROM ${quote(name)} LIMIT 5001`,
        )
        .values()
      if (rows.length > 5000 || (total += rows.length) > 20000)
        fail('SQLite row limits exceeded')
      for (const row of rows)
        for (let index = 0; index < columns.length; index++) {
          const value = scalar(row[index], columns[index].type)
          if (value !== null && typeof value !== columns[index].type)
            fail('SQLite columns cannot mix scalar types')
        }
      return { name, columns, rowCount: rows.length }
    })
}

try {
  const input = Buffer.from(await Bun.stdin.arrayBuffer())
  if (input.length < 4 || input.length > 4 + 16384 + 2 * 1024 * 1024)
    fail('SQLite input size limit exceeded')
  const metadataLength = input.readUInt32LE(0)
  if (
    !metadataLength ||
    metadataLength > 16384 ||
    metadataLength + 4 >= input.length
  )
    fail('Invalid SQLite operation')
  const operation = JSON.parse(
    input.subarray(4, 4 + metadataLength).toString('utf8'),
  )
  const bytes = new Uint8Array(input.subarray(4 + metadataLength))
  if (
    bytes.length < 100 ||
    bytes.length > 2 * 1024 * 1024 ||
    new TextDecoder().decode(bytes.subarray(0, 16)) !== 'SQLite format 3\u0000'
  )
    fail('Upload a valid SQLite database export')
  if (bytes[18] !== 1 || bytes[19] !== 1)
    fail('Export a standalone SQLite backup without WAL sidecars')
  const db = Database.deserialize(bytes, {
    readonly: true,
    strict: true,
    safeIntegers: true,
  })
  try {
    db.run(
      'PRAGMA hard_heap_limit = 16777216; PRAGMA trusted_schema = OFF; PRAGMA query_only = ON',
    )
    if (db.query('PRAGMA quick_check(1)').values()[0]?.[0] !== 'ok')
      fail('Upload a valid SQLite database export')
    const tables = inspect(db)
    if (operation.action === 'inspect') {
      process.stdout.write(JSON.stringify({ tables }))
    } else if (operation.action === 'read') {
      const table =
        tables.find((item) => item.name === operation.table) ??
        fail('Choose an inspected SQLite table')
      const selected: DataColumn[] = operation.columns.map(
        (key: string) =>
          table.columns.find((column) => column.key === key) ??
          fail('Choose inspected SQLite columns'),
      )
      const filter = operation.filter
      const filtered = filter
        ? (table.columns.find((column) => column.key === filter.column) ??
          fail('Choose an inspected filter column'))
        : undefined
      if (
        filtered &&
        filter.value !== null &&
        typeof filter.value !== filtered.type
      )
        fail('Filter value must match the inspected column type')
      const filterValue = filtered
        ? filter.value === null
          ? null
          : scalar(
              filtered.type === 'boolean' && typeof filter.value === 'boolean'
                ? Number(filter.value)
                : filter.value,
              filtered.type,
            )
        : undefined
      if (
        filtered &&
        filterValue !== null &&
        typeof filterValue !== filtered.type
      )
        fail('Filter value must match the inspected column type')
      const tenant = operation.tenant
      const tenantColumn = tenant
        ? table.columns.find((column) => column.key === tenant.column)
        : undefined
      if (
        tenant &&
        (!tenantColumn ||
          tenantColumn.type !== 'string' ||
          typeof tenant.value !== 'string')
      )
        fail('Choose an inspected text tenant column')
      const predicates = [
        ...(tenantColumn
          ? [`${quote(tenantColumn.label)} COLLATE BINARY = ?`]
          : []),
        ...(filtered ? [`${quote(filtered.label)} IS ?`] : []),
      ]
      const sql = `SELECT ${selected.map((column) => quote(column.label)).join(', ')} FROM ${quote(table.name)}${predicates.length ? ` WHERE ${predicates.join(' AND ')}` : ''} LIMIT ?`
      const values = [
        ...(tenantColumn ? [tenant.value] : []),
        ...(filtered
          ? [
              typeof filterValue === 'boolean'
                ? Number(filterValue)
                : filterValue,
              operation.limit,
            ]
          : [operation.limit]),
      ]
      const rows: DataRow[] = db
        .query(sql)
        .values(...values)
        .map((row) =>
          Object.fromEntries(
            selected.map((column, index) => [
              column.key,
              scalar(row[index], column.type),
            ]),
          ),
        )
      process.stdout.write(JSON.stringify({ rows }))
    } else fail('Unsupported SQLite operation')
  } finally {
    db.close(true)
  }
} catch (error) {
  const safe =
    error instanceof InvalidCopy
      ? error.message
      : 'SQLite copy could not be read'
  process.stdout.write(JSON.stringify({ error: safe }))
  process.exitCode = 1
}
