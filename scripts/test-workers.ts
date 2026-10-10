import { availableParallelism } from 'node:os'

export function getTestWorkers(
  value = process.env.BESH_TEST_WORKERS ?? 'half',
) {
  const available = availableParallelism()

  if (value === 'half') return Math.max(1, Math.floor(available / 2))
  if (value === 'all') return available

  const workers = Number(value)
  if (!/^[1-9]\d*$/.test(value) || workers > available)
    throw new Error(
      `BESH_TEST_WORKERS must be half, all, or an integer from 1 to ${available}`,
    )

  return workers
}

export function getBrowserWorkers(value = process.env.BESH_TEST_WORKERS) {
  const workers = getTestWorkers(value)

  // Browser workers also start servers and render; higher defaults failed locally.
  return value === undefined ? Math.min(workers, 4) : workers
}

export function getPreviewWorkers(value?: string) {
  const limit = Math.min(availableParallelism(), 4)
  const selected = value ?? process.env.BESH_PREVIEW_WORKERS ?? String(limit)
  const workers = Number(selected)

  if (!/^[1-9]\d*$/.test(selected) || workers > limit)
    throw new Error(
      `BESH_PREVIEW_WORKERS must be an integer from 1 to ${limit}`,
    )

  return workers
}
