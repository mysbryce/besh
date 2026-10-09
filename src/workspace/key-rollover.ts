import { ApiError } from '../errors'

export type RolloverWindow = {
  id: string
  expires_at: string
  revoked_at: string | null
  replaces_key_id: string | null
  replaced_by_key_id: string | null
  rollover_accept_until: string | null
  rollover_created_at: string | null
  rollover_grace_seconds: number | null
  rollover_scope: string
  predecessor_scope: string | null
  successor_scope: string | null
  successor_created_at: string | null
}

export function keyWindow(row: RolloverWindow, now = Date.now()) {
  const expiry = Date.parse(row.expires_at)
  const deadline =
    row.rollover_accept_until === null
      ? expiry
      : Date.parse(row.rollover_accept_until)
  if (
    !Number.isFinite(expiry) ||
    !Number.isFinite(deadline) ||
    deadline > expiry ||
    (row.replaced_by_key_id === null) !==
      (row.rollover_accept_until === null) ||
    (row.replaces_key_id !== null &&
      row.predecessor_scope !== row.rollover_scope) ||
    (row.replaced_by_key_id !== null &&
      row.successor_scope !== row.rollover_scope) ||
    row.replaced_by_key_id === row.id ||
    row.replaces_key_id === row.id ||
    (row.replaced_by_key_id !== null &&
      row.replaced_by_key_id === row.replaces_key_id) ||
    (row.replaced_by_key_id !== null &&
      (row.rollover_created_at === null ||
        row.rollover_created_at !== row.successor_created_at ||
        row.rollover_grace_seconds === null ||
        !Number.isInteger(row.rollover_grace_seconds) ||
        row.rollover_grace_seconds < 0 ||
        row.rollover_grace_seconds > 300 ||
        Date.parse(row.rollover_created_at) +
          row.rollover_grace_seconds * 1000 !==
          deadline))
  )
    throw new ApiError(503, 'Runtime key rollover is unavailable')
  return {
    acceptUntil: row.rollover_accept_until ?? row.expires_at,
    replacesKeyId: row.replaces_key_id,
    replacedByKeyId: row.replaced_by_key_id,
    accepted: row.revoked_at === null && now < deadline,
  }
}

export function assertRolloverGraph(
  edges: { previous_key_id: string; next_key_id: string }[],
  keys: RolloverWindow[],
) {
  const known = new Set(keys.map((key) => key.id))
  const next = new Map<string, string>()
  for (const edge of edges) {
    if (!known.has(edge.previous_key_id) || !known.has(edge.next_key_id))
      throw new ApiError(503, 'Runtime key rollover is unavailable')
    next.set(edge.previous_key_id, edge.next_key_id)
  }
  const complete = new Set<string>()
  for (const first of next.keys()) {
    const visiting = new Set<string>()
    let current: string | undefined = first
    while (current !== undefined && !complete.has(current)) {
      if (visiting.has(current))
        throw new ApiError(503, 'Runtime key rollover is unavailable')
      visiting.add(current)
      current = next.get(current)
    }
    for (const id of visiting) complete.add(id)
  }
  for (const key of keys) keyWindow(key)
}
