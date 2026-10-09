import { ApiError } from '../errors'
import { assertSourceFields, sourceFields } from '../workspace/field-policy'
import type { Store } from '../workspace/store'
import { assertJsonLimit } from '../flows/engine'
import { readExcel } from './spreadsheet-xlsx'
import { flowSchema, type Flow, type DataReadConfig } from '../flows/model'
import { z } from 'zod'
import { fetchGoogleSheet, type SheetFetch } from './google-sheets'
import {
  originalCell,
  encodeProvenance,
  readProvenance,
  textColumns,
} from './provenance'
import type { RowReadPermit } from '../workspace/row-authority'
import type { Member } from '../workspace/store'
import { assertRawResource } from '../workspace/raw-access'
import { requirePermission } from '../errors'

export type DataColumn = {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean'
  nullable: boolean
}

export type DataRow = Record<string, string | number | boolean | null>

export type DataSource = {
  id: string
  name: string
  kind: 'upload' | 'google-sheets'
  columns: DataColumn[]
  rowCount: number
  version: number
  createdAt: string
  updatedAt: string
  sheetName?: string
  sourceUrl?: string
}

type SourceRow = {
  id: string
  name: string
  kind: DataSource['kind']
  columns: string
  rows: string
  row_count: number
  version: number
  source_url: string | null
  sheet_name: string | null
  created_at: string
  updated_at: string
  original_cells: Uint8Array | null
}

const uploadLimit = 2 * 1024 * 1024
const forbidden = new Set(['__proto__', 'prototype', 'constructor'])

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let closed = false

  function endCell() {
    row.push(cell)
    cell = ''
    closed = false
    if (row.length > 64) throw new ApiError(400, 'Use at most 64 columns')
  }

  function endRow() {
    endCell()
    if (row.some((value) => value.trim())) rows.push(row)
    row = []
    if (rows.length > 5001)
      throw new ApiError(400, 'Use at most 5000 data rows')
  }

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index++
        } else {
          quoted = false
          closed = true
        }
      } else cell += character
    } else if (character === ',') endCell()
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++
      endRow()
    } else if (character === '"' && !cell && !closed) quoted = true
    else {
      if (closed || character === '"')
        throw new ApiError(400, 'CSV contains invalid quotation marks')
      cell += character
    }
    if (cell.length > 4096)
      throw new ApiError(400, 'Each cell must contain at most 4096 characters')
  }
  if (quoted) throw new ApiError(400, 'CSV contains an unfinished quoted value')
  if (cell || row.length || closed) endRow()
  return rows
}

function typedCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new ApiError(400, 'Spreadsheet contains an invalid number')
    return value
  }
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string')
    throw new ApiError(400, 'Spreadsheet contains an unsupported cell')
  const text = value.trim()
  if (!text) return null
  if (text.length > 4096)
    throw new ApiError(400, 'Each cell must contain at most 4096 characters')
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true'
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) {
    const number = Number(text)
    if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER)
      return number
  }
  return text
}

function normalize(data: unknown[][]) {
  if (data.length < 2)
    throw new ApiError(400, 'Add a header row and at least one data row')
  if (data.length > 5001) throw new ApiError(400, 'Use at most 5000 data rows')
  const headers = data[0]
  if (!headers.length || headers.length > 64)
    throw new ApiError(400, 'Use 1 to 64 named columns')
  const names = new Set<string>()
  const keys = new Set<string>()
  const columns: DataColumn[] = headers.map((header, index) => {
    if (typeof header !== 'string')
      throw new ApiError(400, 'Every column needs a text header')
    const label = header.trim()
    if (!label || label.length > 80 || names.has(label.toLowerCase()))
      throw new ApiError(
        400,
        'Use unique, nonempty column headers of at most 80 characters',
      )
    names.add(label.toLowerCase())
    let key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 56)
    if (forbidden.has(label.toLowerCase()) || forbidden.has(key))
      throw new ApiError(400, 'This column name is reserved')
    if (!key || !/^[a-z]/.test(key))
      key = `column_${index + 1}${key ? `_${key}` : ''}`.slice(0, 56)
    const base = key
    for (let suffix = 2; keys.has(key); suffix++) key = `${base}_${suffix}`
    keys.add(key)
    return { key, label, type: 'string', nullable: false }
  })
  const originals = data
    .slice(1)
    .map((row) => {
      if (row.length > headers.length)
        throw new ApiError(400, 'A row has more values than the header row')
      return {
        values: columns.map((_column, index) => typedCell(row[index])),
        cells: columns.map((_column, index) => originalCell(row[index])),
      }
    })
    .filter((row) => row.values.some((value) => value !== null))
  const values = originals.map((row) => row.values)
  if (!values.length)
    throw new ApiError(400, 'Add at least one nonempty data row')
  for (const [index, column] of columns.entries()) {
    const cells = values.map((row) => row[index])
    const present = cells.filter((value) => value !== null)
    column.nullable = cells.length !== present.length
    if (present.length && present.every((value) => typeof value === 'number'))
      column.type = 'number'
    else if (
      present.length &&
      present.every((value) => typeof value === 'boolean')
    )
      column.type = 'boolean'
  }
  const rows: DataRow[] = values.map((row) =>
    Object.fromEntries(
      columns.map((column, index) => [
        column.key,
        row[index] === null
          ? null
          : column.type === 'string'
            ? String(row[index])
            : row[index],
      ]),
    ),
  )
  if (Buffer.byteLength(JSON.stringify(rows)) > 8 * 1024 * 1024)
    throw new ApiError(400, 'Imported snapshot exceeds 8 MiB')
  const provenance = encodeProvenance({
    format: 1,
    columns: columns.map((column, index) => ({
      key: column.key,
      header: headers[index] as string,
    })),
    rows: originals.map((row) => row.cells),
  })
  return { columns, rows, provenance }
}

function metadata(row: SourceRow): DataSource {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    columns: JSON.parse(row.columns),
    rowCount: row.row_count,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.sheet_name ? { sheetName: row.sheet_name } : {}),
  }
}

export function dataSourceService(store: Store, sheetFetch?: SheetFetch) {
  function get(id: string) {
    const row = store
      .query<SourceRow, [string]>('SELECT * FROM data_sources WHERE id = ?')
      .get(id)
    if (!row) throw new ApiError(404, 'Data source not found')
    return row
  }

  function preview(row: SourceRow) {
    const result = {
      ...metadata(row),
      rows: (JSON.parse(row.rows) as DataRow[]).slice(0, 10),
    }
    try {
      assertJsonLimit(result)
    } catch {
      throw new ApiError(
        400,
        'Preview exceeds response limits. Use smaller cells or fewer columns.',
      )
    }
    return result
  }

  function references(id: string, publishedOnly = false) {
    const flows = store
      .query<{ definition: string; published: string | null }, []>(
        'SELECT definition, published FROM flows',
      )
      .all()
    return flows.flatMap((flow) =>
      (publishedOnly ? [flow.published] : [flow.definition, flow.published])
        .filter((value): value is string => Boolean(value))
        .flatMap((value) =>
          (JSON.parse(value) as Flow).nodes.filter(
            (node) => node.type === 'data' && node.config.sourceId === id,
          ),
        ),
    )
  }

  function save(
    actor: string,
    name: string,
    kind: DataSource['kind'],
    parsed: ReturnType<typeof normalize>,
    sourceUrl: string | null,
    sheetName: string | null,
    previous?: SourceRow,
    authorize?: () => void,
  ) {
    const title = name.trim()
    if (!title || title.length > 80)
      throw new ApiError(400, 'Name must contain 1 to 80 characters')
    const now = new Date().toISOString()
    const row: SourceRow = {
      id: previous?.id ?? crypto.randomUUID(),
      name: title,
      kind,
      columns: JSON.stringify(parsed.columns),
      rows: JSON.stringify(parsed.rows),
      row_count: parsed.rows.length,
      version: previous ? previous.version + 1 : 1,
      source_url: sourceUrl,
      sheet_name: sheetName,
      created_at: previous?.created_at ?? now,
      updated_at: now,
      original_cells: parsed.provenance,
    }
    const result = preview(row)
    store.db
      .transaction(() => {
        authorize?.()
        const member = store.member(actor)
        if (!member) throw new ApiError(401, 'Authentication required')
        requirePermission(member, 'sources.write')
        if (previous) assertRawResource(store, member, 'sources', previous.id)
        if (previous) {
          if (get(previous.id).version !== previous.version)
            throw new ApiError(
              409,
              'Data source changed. Reload before replacing it.',
            )
          const oldColumns = metadata(previous).columns
          const fields = sourceFields(store, previous.id)
          if (
            fields.columns.some(
              (key) => !parsed.columns.some((column) => column.key === key),
            )
          )
            throw new ApiError(
              409,
              'Replacement must preserve selected API field columns. Review the field policy first.',
            )
          const policy = store
            .query<{ mode: string; tenant_column: string | null }, [string]>(
              'SELECT mode, tenant_column FROM source_row_policies WHERE resource_id = ?',
            )
            .get(previous.id)
          if (policy?.mode === 'tenant') {
            const provenance = readProvenance(
              parsed.provenance,
              parsed.columns,
              parsed.rows.length,
            )
            const previousProvenance = readProvenance(
              previous.original_cells,
              oldColumns,
              previous.row_count,
            )
            const old = oldColumns.find(
              (column) => column.key === policy.tenant_column,
            )
            const next = parsed.columns.find(
              (column) => column.key === policy.tenant_column,
            )
            const oldHeader = previousProvenance?.columns.find(
              (column) => column.key === policy.tenant_column,
            )?.header
            const nextHeader = provenance?.columns.find(
              (column) => column.key === policy.tenant_column,
            )?.header
            if (
              !provenance ||
              !previousProvenance ||
              !textColumns(provenance).includes(policy.tenant_column!) ||
              !old ||
              !next ||
              old.label !== next.label ||
              oldHeader !== nextHeader
            )
              throw new ApiError(
                409,
                'Replacement must preserve the protected original text column',
              )
          }
          for (const node of references(previous.id, true)) {
            if (node.type !== 'data') continue
            for (const key of [
              ...node.config.columns,
              ...(node.config.filter ? [node.config.filter.column] : []),
            ]) {
              const old = oldColumns.find((column) => column.key === key)
              const next = parsed.columns.find((column) => column.key === key)
              if (
                !old ||
                !next ||
                old.type !== next.type ||
                old.label !== next.label ||
                (!old.nullable && next.nullable)
              )
                throw new ApiError(
                  409,
                  'Replacement changes a published API column or filter type. Keep its columns and types compatible.',
                )
            }
          }
          store
            .query(
              'UPDATE data_sources SET name = ?, columns = ?, rows = ?, row_count = ?, version = ?, source_url = ?, sheet_name = ?, updated_at = ?, original_cells = ? WHERE id = ?',
            )
            .run(
              row.name,
              row.columns,
              row.rows,
              row.row_count,
              row.version,
              row.source_url,
              row.sheet_name,
              row.updated_at,
              row.original_cells,
              row.id,
            )
        } else
          store
            .query(
              'INSERT INTO data_sources VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .run(
              row.id,
              row.name,
              row.kind,
              row.columns,
              row.rows,
              row.row_count,
              row.version,
              row.source_url,
              row.sheet_name,
              row.created_at,
              row.updated_at,
              row.original_cells,
            )
        if (!previous)
          store
            .query(
              "INSERT INTO source_row_policies VALUES (?, 'unprotected', NULL, 1)",
            )
            .run(row.id)
        if (!previous)
          store
            .query("INSERT INTO source_field_policies VALUES (?, 'all', '[]')")
            .run(row.id)
        store.audit(
          actor,
          previous
            ? kind === 'google-sheets'
              ? 'data-source.refreshed'
              : 'data-source.replaced'
            : 'data-source.imported',
          row.id,
        )
      })
      .immediate()
    return result
  }

  function csv(bytes: Uint8Array) {
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true })
        .decode(bytes)
        .replace(/^\uFEFF/, '')
    } catch {
      throw new ApiError(400, 'Save CSV files using UTF-8 encoding')
    }
    return normalize(parseCsv(text))
  }

  return {
    list(member?: Member) {
      return store
        .query<SourceRow, []>(
          `SELECT * FROM data_sources ${member && member.role !== 'owner' ? "WHERE id NOT IN (SELECT resource_id FROM source_row_policies WHERE mode = 'tenant')" : ''} ORDER BY rowid DESC`,
        )
        .all()
        .map(metadata)
    },
    get(id: string) {
      return preview(get(id))
    },
    async importGoogle(
      actor: string,
      name: string,
      url: string,
      authorize?: () => void,
    ) {
      authorize?.()
      if (!name.trim() || name.trim().length > 80)
        throw new ApiError(400, 'Name must contain 1 to 80 characters')
      const sheet = await fetchGoogleSheet(url, sheetFetch)
      return save(
        actor,
        name,
        'google-sheets',
        csv(sheet.bytes),
        sheet.sourceUrl,
        null,
        undefined,
        authorize,
      )
    },
    async refresh(actor: string, id: string, authorize?: () => void) {
      authorize?.()
      const previous = get(id)
      if (previous.kind !== 'google-sheets' || !previous.source_url)
        throw new ApiError(
          400,
          'Replace uploaded files by uploading a new Excel/CSV file',
        )
      const sheet = await fetchGoogleSheet(previous.source_url, sheetFetch)
      return save(
        actor,
        previous.name,
        previous.kind,
        csv(sheet.bytes),
        sheet.sourceUrl,
        null,
        previous,
        authorize,
      )
    },
    delete(actor: string, id: string, authorize?: () => void) {
      store.db
        .transaction(() => {
          authorize?.()
          get(id)
          if (references(id).length)
            throw new ApiError(
              409,
              'This data source is used by a draft or published API. Remove those references before deleting it.',
            )
          store.protectDependencyUse('sources', id)
          store.query('DELETE FROM data_sources WHERE id = ?').run(id)
          store.audit(actor, 'data-source.deleted', id)
        })
        .immediate()
      return { ok: true }
    },
    validate(flow: Flow) {
      for (const node of flow.nodes) {
        if (node.type !== 'data') continue
        const source = metadata(get(node.config.sourceId))
        for (const column of [
          ...node.config.columns,
          ...(node.config.filter ? [node.config.filter.column] : []),
        ]) {
          if (!source.columns.some((item) => item.key === column))
            throw new ApiError(400, 'A selected data column does not exist')
        }
      }
    },
    read(config: DataReadConfig, permit?: RowReadPermit) {
      assertSourceFields(store, config)
      const row = get(config.sourceId)
      const columns = metadata(row).columns
      if (
        config.columns.some(
          (key) => !columns.some((column) => column.key === key),
        )
      )
        throw new ApiError(400, 'A selected data column does not exist')
      let rows = JSON.parse(row.rows) as DataRow[]
      const policy = store
        .query<
          { mode: string; tenant_column: string | null; version: number },
          [string]
        >(
          'SELECT mode, tenant_column, version FROM source_row_policies WHERE resource_id = ?',
        )
        .get(config.sourceId)
      if (policy?.mode === 'tenant') {
        if (
          !permit ||
          permit.column !== policy.tenant_column ||
          permit.policyVersion !== policy.version ||
          permit.resourceVersion !== row.version
        )
          throw new ApiError(
            403,
            'A current trusted tenant identity is required',
          )
        const provenance = readProvenance(
          row.original_cells,
          columns,
          row.row_count,
        )
        if (
          !provenance ||
          rows.length !== row.row_count ||
          !textColumns(provenance).includes(permit.column)
        )
          throw new ApiError(
            503,
            'Protected source provenance is unavailable. Reimport this source.',
          )
        const index = provenance.columns.findIndex(
          (column) => column.key === permit.column,
        )
        rows = rows.filter((_, rowIndex) => {
          const cell = provenance.rows[rowIndex]![index]!
          return cell.type === 'text' && cell.value === permit.value
        })
      }
      if (config.filter) {
        const column = columns.find(
          (item) => item.key === config.filter!.column,
        )
        if (!column) throw new ApiError(400, 'Filter column does not exist')
        let value = config.filter.value
        if (typeof value === 'string' && column.type === 'number')
          value = typedCell(value)
        if (typeof value === 'string' && column.type === 'boolean')
          value = typedCell(value)
        rows = rows.filter((item) => item[column.key] === value)
      }
      const result = rows
        .slice(0, config.limit)
        .map((item) =>
          Object.fromEntries(config.columns.map((key) => [key, item[key]])),
        )
      try {
        assertJsonLimit(result)
      } catch {
        throw new ApiError(
          400,
          'Rows exceed response limits. Choose fewer rows or columns.',
        )
      }
      return result
    },
    api(id: string, value: unknown) {
      const parsed = z
        .object({
          name: z.string().trim().min(1).max(80),
          path: z
            .string()
            .max(160)
            .regex(/^\/[a-zA-Z0-9/_-]+$/),
          protocol: z.enum(['rest', 'graphql']),
          columns: z.array(z.string().min(1).max(64)).min(1).max(64),
          filter: z
            .object({
              column: z.string(),
              inputName: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
            })
            .optional(),
          limit: z.number().int().min(1).max(100),
        })
        .safeParse(value)
      if (!parsed.success)
        throw new ApiError(
          400,
          'Choose an API name, path, columns, and row limit from 1 to 100',
        )
      const options = parsed.data
      const graphql = options.protocol === 'graphql'
      const source = metadata(get(id))
      if (
        new Set(options.columns).size !== options.columns.length ||
        options.columns.some(
          (key) => !source.columns.some((column) => column.key === key),
        ) ||
        (options.filter &&
          (!source.columns.some(
            (column) => column.key === options.filter!.column,
          ) ||
            forbidden.has(options.filter.inputName)))
      )
        throw new ApiError(
          400,
          'Choose valid data columns and a safe filter name',
        )
      const typeName = (column: DataColumn) =>
        ({ string: 'String', number: 'Float', boolean: 'Boolean' })[column.type]
      const fields = options.columns
        .map((key) => {
          const column = source.columns.find((item) => item.key === key)!
          return `${key}: ${typeName(column)}${column.nullable ? '' : '!'}`
        })
        .join(' ')
      const filterColumn = options.filter
        ? source.columns.find(
            (column) => column.key === options.filter!.column,
          )!
        : null
      const argumentsList =
        options.filter && filterColumn
          ? `(${options.filter.inputName}: ${typeName(filterColumn)})`
          : ''
      const schema = `type Query { rows${argumentsList}: [SpreadsheetRow!]! }\ntype SpreadsheetRow { ${fields} }`
      return flowSchema.parse({
        name: options.name,
        method: graphql ? 'POST' : 'GET',
        path: options.path,
        ...(graphql
          ? { graphql: { schema } }
          : {
              contract: {
                ...(options.filter && filterColumn
                  ? {
                      query: {
                        type: 'object',
                        properties: {
                          [options.filter.inputName]: {
                            type: filterColumn.type,
                          },
                        },
                      },
                    }
                  : {}),
                response: {
                  type: 'array',
                  maxItems: options.limit,
                  items: {
                    type: 'object',
                    properties: Object.fromEntries(
                      options.columns.map((key) => {
                        const column = source.columns.find(
                          (item) => item.key === key,
                        )!
                        return [
                          key,
                          { type: column.type, nullable: column.nullable },
                        ]
                      }),
                    ),
                    required: options.columns,
                    additionalProperties: false,
                  },
                },
              },
            }),
        nodes: [
          {
            id: 'request',
            type: 'request',
            position: { x: 80, y: 100 },
            config: {},
          },
          {
            id: 'data',
            type: 'data',
            position: { x: 360, y: 100 },
            config: {
              sourceId: id,
              columns: options.columns,
              limit: options.limit,
              ...(options.filter
                ? {
                    filter: {
                      column: options.filter.column,
                      value: `$input.${graphql ? 'body' : 'query'}.${options.filter.inputName}`,
                    },
                  }
                : {}),
            },
          },
          {
            id: 'response',
            type: 'response',
            position: { x: 640, y: 100 },
            config: { status: 200, body: '$data' },
          },
        ],
        edges: [
          { id: 'request-data', source: 'request', target: 'data' },
          { id: 'data-response', source: 'data', target: 'response' },
        ],
      })
    },
    async importFile(
      actor: string,
      name: string | undefined,
      file: File,
      id?: string,
      authorize?: () => void,
    ) {
      authorize?.()
      const previous = id ? get(id) : undefined
      if (previous && previous.kind !== 'upload')
        throw new ApiError(400, 'Use Refresh for a Google Sheets data source')
      const title = (name ?? previous?.name ?? '').trim()
      if (!title || title.length > 80)
        throw new ApiError(400, 'Name must contain 1 to 80 characters')
      if (!file.size || file.size > uploadLimit)
        throw new ApiError(400, 'Upload a file of at most 2 MiB')
      const extension = file.name.toLowerCase().split('.').pop()
      let parsed: ReturnType<typeof normalize>
      let sheetName: string | null = null
      if (extension === 'xlsx') {
        const sheet = await readExcel(file)
        parsed = normalize(sheet.data)
        sheetName = sheet.sheetName
      } else if (extension === 'csv') {
        parsed = csv(new Uint8Array(await file.arrayBuffer()))
      } else throw new ApiError(400, 'Choose an .xlsx or .csv file')
      return save(
        actor,
        title,
        'upload',
        parsed,
        null,
        sheetName,
        previous,
        authorize,
      )
    },
  }
}
