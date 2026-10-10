// Canonical gallery order is independent of worker completion order.
export const previewStories = [
  { id: 'core', count: 329, locks: ['clipboard', 'native-k6'] },
  { id: 'database', count: 43, locks: [] },
  { id: 'client-code', count: 41, locks: ['clipboard'] },
  { id: 'release-pins', count: 38, locks: ['clipboard', 'native-k6'] },
  { id: 'generated-backend', count: 23, locks: ['clipboard'] },
  { id: 'flow-access', count: 36, locks: [] },
  { id: 'scoped-actions', count: 41, locks: ['native-k6'] },
  { id: 'tenant-protection', count: 68, locks: ['native-k6'] },
  { id: 'websocket', count: 35, locks: [] },
  { id: 'field-access', count: 40, locks: [] },
  { id: 'key-rollover', count: 35, locks: ['clipboard'] },
  { id: 'tenant-field-profiles', count: 46, locks: [] },
  { id: 'protected-read-graphs', count: 33, locks: [] },
  { id: 'member-field-profiles', count: 47, locks: [] },
  { id: 'studio-tools', count: 3, locks: [] },
  { id: 'first-task', count: 4, locks: [] },
  { id: 'invitations', count: 28, locks: ['clipboard'] },
  { id: 'node-picker', count: 12, locks: [] },
  { id: 'locales', count: 18, locks: [] },
  { id: 'locale-fallback', count: 2, locks: [] },
  { id: 'locale-startup', count: 3, locks: [] },
  { id: 'locale-bootstrap', count: 2, locks: [] },
  { id: 'navigation', count: 10, locks: [] },
  { id: 'management-account', count: 12, locks: [] },
  { id: 'management-updates', count: 12, locks: [] },
  { id: 'management-roles', count: 12, locks: [] },
  { id: 'management-members', count: 15, locks: [] },
  { id: 'management-studio-first-task', count: 7, locks: [] },
  { id: 'management-studio-draft', count: 13, locks: [] },
  { id: 'management-studio-graphql', count: 8, locks: [] },
  { id: 'management-studio-websocket', count: 8, locks: [] },
  { id: 'management-data-source-import', count: 17, locks: [] },
  { id: 'management-data-source-replacement', count: 18, locks: [] },
] as const

export type PreviewStory = (typeof previewStories)[number]['id']

// Product SQLite stories launch deadline-bound native child readers.
export const sqlitePreviewStories = [
  'database',
  'scoped-actions',
  'tenant-protection',
  'field-access',
  'tenant-field-profiles',
  'protected-read-graphs',
  'member-field-profiles',
] as const satisfies readonly PreviewStory[]
