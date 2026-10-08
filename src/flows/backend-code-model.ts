export type BackendCodeArtifact = {
  flowId: string
  revision: number
  compilerVersion: number
  filename: string
  code: string
  sha256: string
  definitionSha256: string
  endpoint: { method: string; path: string; graphql: boolean }
  requirements: string[]
}
