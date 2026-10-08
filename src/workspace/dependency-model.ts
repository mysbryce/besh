import type { DataColumn } from '../data/sources'

export type DependencySource = {
  id: string
  name: string
  version: number
  columns: DataColumn[]
}
export type DependencyDatabase = {
  id: string
  name: string
  version: number
  tables: { name: string; columns: DataColumn[] }[]
}
export type DependencyAuth = {
  id: string
  name: string
  version: number
  provider: 'github'
}
export type DependencyFamily =
  'sources' | 'database-connections' | 'auth-connections'
