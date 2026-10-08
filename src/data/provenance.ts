import type { DataColumn } from './sources'
import { ApiError } from '../errors'

type OriginalCell =
  | { type: 'text' | 'date'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'null'; value: null }

export type SourceProvenance = {
  format: 1
  columns: { key: string; header: string }[]
  rows: OriginalCell[][]
}

export function originalCell(value: unknown): OriginalCell {
  if (value === null || value === undefined)
    return { type: 'null', value: null }
  if (typeof value === 'string') return { type: 'text', value }
  if (typeof value === 'number') return { type: 'number', value }
  if (typeof value === 'boolean') return { type: 'boolean', value }
  if (value instanceof Date) return { type: 'date', value: value.toISOString() }
  throw new ApiError(400, 'Spreadsheet contains an unsupported cell')
}

export function encodeProvenance(value: SourceProvenance) {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8')
  if (bytes.length > 16 * 1024 * 1024)
    throw new ApiError(400, 'Original cell snapshot exceeds 16 MiB')
  return bytes
}

export function identityText(value: string) {
  if (/\p{Cc}/u.test(value)) return false
  for (const character of value) {
    const point = character.codePointAt(0)!
    if (point >= 0xd800 && point <= 0xdfff) return false
  }
  return true
}

export function readProvenance(
  bytes: Uint8Array | null,
  columns: DataColumn[],
  rowCount: number,
): SourceProvenance | null {
  if (!bytes || bytes.length > 16 * 1024 * 1024) return null
  try {
    const value = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as SourceProvenance
    if (
      value.format !== 1 ||
      !Array.isArray(value.columns) ||
      value.columns.length !== columns.length ||
      value.columns.some(
        (column, index) =>
          !column ||
          column.key !== columns[index]?.key ||
          typeof column.header !== 'string' ||
          column.header.trim() !== columns[index]?.label,
      ) ||
      !Array.isArray(value.rows) ||
      value.rows.length !== rowCount ||
      value.rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== columns.length ||
          row.some((cell) => {
            if (!cell || typeof cell !== 'object') return true
            switch (cell.type) {
              case 'text':
              case 'date':
                return typeof cell.value !== 'string'
              case 'number':
                return (
                  typeof cell.value !== 'number' || !Number.isFinite(cell.value)
                )
              case 'boolean':
                return typeof cell.value !== 'boolean'
              case 'null':
                return cell.value !== null
              default:
                return true
            }
          }),
      )
    )
      return null
    return value
  } catch {
    return null
  }
}

export function textColumns(value: SourceProvenance) {
  return value.columns
    .filter((_column, index) =>
      value.rows.every((row) => {
        const cell = row[index]!
        return (
          cell.type === 'null' ||
          (cell.type === 'text' && identityText(cell.value))
        )
      }),
    )
    .map((column) => column.key)
}
