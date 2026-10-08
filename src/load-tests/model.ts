export type LoadTestConfig = {
  vus: number
  durationSeconds: number
  p95Ms: number
  maxErrorRate: number
  expectedStatus: number | null
}

export type LoadTestRequest = {
  body: unknown
  query: Record<string, string>
  params?: Record<string, string>
  graphql?: {
    query: string
    variables?: Record<string, unknown>
    operationName?: string
  }
}

export type LoadTestStart = {
  flowId: string
  tenantId?: string
  config?: Partial<LoadTestConfig>
  request?: Partial<LoadTestRequest>
}

export type LoadTestTarget = {
  id: string
  name: string
  revision: number
  method: string
  path: string
  graphql: { schema: string } | null
  unavailableReason: string | null
  tenantRequired?: boolean
}

export type LoadTestSummary = {
  requests: number
  requestsPerSecond: number
  failedRequests: number
  checkRate: number
  avgMs: number
  p95Ms: number
  maxMs: number
  thresholdsPassed: boolean
}

export type LoadTestRun = {
  id: string
  flowId: string
  flowName: string
  revision: number
  method: string
  path: string
  graphql: boolean
  config: LoadTestConfig
  status: 'running' | 'completed' | 'failed' | 'canceled' | 'interrupted'
  createdAt: string
  finishedAt: string | null
  summary: LoadTestSummary | null
  error: string | null
  tenantId: string | null
  cleanupOnly?: boolean
}

export type K6RunInput = {
  url: string
  method: string
  token: string
  body: unknown
  graphql: boolean
  config: LoadTestConfig
}

export type K6Runner = (
  input: K6RunInput,
  signal: AbortSignal,
) => Promise<LoadTestSummary>
