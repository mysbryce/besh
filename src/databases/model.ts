import type { DataColumn, DataRow } from '../data/sources'

export type DatabaseTable = {
  name: string
  columns: DataColumn[]
  rowCount: number
}
export type DatabaseConnection = {
  id: string
  name: string
  kind: 'sqlite'
  mode: 'uploaded-copy'
  bytes: number
  version: number
  tables: DatabaseTable[]
  createdAt: string
  updatedAt: string
}
export type DatabaseReadConfig = {
  connectionId: string
  table: string
  columns: string[]
  filter?: { column: string; value: string | number | boolean | null }
  limit: number
}
export type DatabasePreview = {
  version: number
  table: string
  columns: string[]
  rows: DataRow[]
}
export type DatabaseCheck = {
  version: number
  ok: true
  tables: DatabaseTable[]
}
