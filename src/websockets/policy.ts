import { ApiError } from '../errors'
import type { Flow } from '../flows/model'
import type { Store } from '../workspace/store'

export function websocketPolicies(store: Store, definition: Flow) {
  return JSON.stringify(
    definition.nodes.flatMap((node) => {
      if (node.type !== 'data' && node.type !== 'database') return []
      const source = node.type === 'data'
      const id = source ? node.config.sourceId : node.config.connectionId
      const policy = source
        ? store
            .query<{ mode: string; version: number }, [string]>(
              'SELECT mode, version FROM source_row_policies WHERE resource_id = ?',
            )
            .get(id)
        : store
            .query<{ mode: string; version: number }, [string]>(
              'SELECT mode, version FROM database_row_policies WHERE resource_id = ?',
            )
            .get(id)
      if (!policy) throw new ApiError(503, 'Resource row policy is unavailable')
      return [
        { family: node.type, id, mode: policy.mode, version: policy.version },
      ]
    }),
  )
}
