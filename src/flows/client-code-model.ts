import type { ApiContract, Flow } from './model'

export const clientCodeTargets = [
  {
    id: 'javascript-axios',
    label: 'JavaScript — Axios',
    language: 'javascript',
    dependencies: ['Node.js or Bun', 'npm install axios'],
    filename: 'request.mjs',
  },
  {
    id: 'javascript-fetch',
    label: 'JavaScript — Fetch',
    language: 'javascript',
    dependencies: ['Node.js 18+ or Bun (built-in Fetch)'],
    filename: 'request.mjs',
  },
  {
    id: 'php-curl',
    label: 'PHP — cURL',
    language: 'php',
    dependencies: ['PHP with the cURL extension'],
    filename: 'request.php',
  },
  {
    id: 'curl',
    label: 'cURL — shell',
    language: 'shell',
    dependencies: ['POSIX shell', 'curl'],
    filename: 'request.sh',
  },
  {
    id: 'rust-reqwest',
    label: 'Rust — reqwest',
    language: 'rust',
    dependencies: [
      'Rust/Cargo',
      'reqwest = { version = "0.13", features = ["blocking"] }',
    ],
    filename: 'main.rs',
  },
  {
    id: 'go-net-http',
    label: 'Go — net/http',
    language: 'go',
    dependencies: ['Go (standard library)'],
    filename: 'main.go',
  },
  {
    id: 'java-http-client',
    label: 'Java — java.net.http',
    language: 'java',
    dependencies: ['Java 11+ (standard library)'],
    filename: 'Main.java',
  },
  {
    id: 'cpp-libcurl',
    label: 'C++ — libcurl',
    language: 'cpp',
    dependencies: [
      'C++17 compiler',
      'libcurl development headers/library; link with -lcurl',
    ],
    filename: 'main.cpp',
  },
] as const

export type ClientCodeTarget = (typeof clientCodeTargets)[number]['id']
export type ClientCodeSource = 'published' | 'draft'
export type ClientCodeMetadata = {
  source: ClientCodeSource
  revision: number
  name: string
  method: Flow['method']
  path: string
  graphql: Flow['graphql'] | null
  contract: ApiContract | null
  targets: typeof clientCodeTargets
}
export type ClientCodeRequest = {
  target: ClientCodeTarget
  source?: ClientCodeSource
  revision: number
  baseUrl: string
  request?: {
    params?: Record<string, string>
    query?: Record<string, string>
    body?: unknown
    graphql?: {
      query: string
      variables?: Record<string, unknown>
      operationName?: string
    }
  }
}
export type ClientCodeResult = {
  target: ClientCodeTarget
  source: ClientCodeSource
  revision: number
  method: string
  url: string
  code: string
  dependencies: readonly string[]
  warnings: string[]
  filename: string
  contentType: 'text/plain'
}
