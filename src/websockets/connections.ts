import type { AnyWSLocalHook } from 'elysia/ws/types'
import type { RuntimeRelease } from '../flows/runtime'
import { ApiError } from '../errors'
import type { TicketProof } from './tickets'

export type DraftBinding = {
  proof: Exclude<TicketProof, { kind: 'runtime' }>
  tenantId: string | null
}

export type Socket = Parameters<NonNullable<AnyWSLocalHook['open']>>[0]
export type Connection = {
  id: string
  release: RuntimeRelease
  keyId: string
  policies: string
  createdAt: number
  lastActivity: number
  rateStartedAt: number
  messages: number
  busy: boolean
  abort: AbortController
  socket?: Socket
  reservation?: ReturnType<typeof setTimeout>
  draft?: DraftBinding
}

const admitted = new Set<Connection>()

export function connectionRegistry() {
  const connections = new Map<string, Connection>()
  let closed = false

  function remove(connection: Connection) {
    clearTimeout(connection.reservation)
    connection.abort.abort()
    connections.delete(connection.id)
    admitted.delete(connection)
  }

  function close(connection: Connection, code = 1008) {
    remove(connection)
    try {
      connection.socket?.close(code, 'Connection ended')
    } catch {
      try {
        connection.socket?.terminate()
      } catch {}
    }
  }

  return {
    connections,
    reserve(
      release: RuntimeRelease,
      keyId: string,
      policies: string,
      draft?: DraftBinding,
    ) {
      if (closed) throw new ApiError(503, 'WebSocket service is shutting down')
      const peers = [...admitted]
      if (
        admitted.size >= 100 ||
        peers.filter((item) => item.release.flowId === release.flowId).length >=
          10 ||
        peers.filter((item) => item.keyId === keyId).length >= 3
      )
        throw new ApiError(429, 'WebSocket connection limit reached')
      const now = Date.now()
      const connection: Connection = {
        id: crypto.randomUUID(),
        release,
        keyId,
        policies,
        createdAt: now,
        lastActivity: now,
        rateStartedAt: now,
        messages: 0,
        busy: false,
        abort: new AbortController(),
        draft,
      }
      connections.set(connection.id, connection)
      admitted.add(connection)
      connection.reservation = setTimeout(() => close(connection), 3000)
      connection.reservation.unref()
      return connection
    },
    open(id: string, socket: Socket) {
      const connection = connections.get(id)
      if (!connection) {
        socket.close(1008, 'Connection ended')
        return
      }
      clearTimeout(connection.reservation)
      connection.socket = socket
    },
    remove,
    close,
    shutdown() {
      closed = true
      for (const connection of [...connections.values()]) {
        close(connection, 1001)
        try {
          connection.socket?.terminate()
        } catch {}
      }
    },
  }
}
