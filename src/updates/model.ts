export type UpdateSettings = {
  repositoryUrl: string
  includePrereleases: boolean
  revision: number
  updatedAt: string | null
}

export type ReleaseNotice = {
  version: string
  tag: string
  name: string
  url: string
  publishedAt: string | null
  prerelease: boolean
}

export type UpdateCheck = {
  checkedAt: string
  status: 'available' | 'current' | 'no-releases' | 'error'
  release: ReleaseNotice | null
  error: string | null
}

export type UpdateState = {
  currentVersion: string
  settings: UpdateSettings
  lastCheck: UpdateCheck | null
}
