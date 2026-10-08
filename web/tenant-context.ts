import { useEffect, useRef, useState } from 'react'
import type { TenantContext } from '../src/workspace/tenant-model'
import { api } from './lib/api'
import { useStudio } from './store'

export function useTenantContext(enabled: boolean) {
  const { member, token, sessionId } = useStudio()
  const [context, setContext] = useState<TenantContext | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const active = useRef(false)
  const request = useRef(0)
  const [reviewedScope, setReviewedScope] = useState('')
  const scope = JSON.stringify([member?.id, token, sessionId, enabled])
  function current() {
    const state = useStudio.getState()
    return (
      active.current &&
      enabled &&
      state.member?.id === member?.id &&
      state.token === token &&
      state.sessionId === sessionId
    )
  }
  async function refresh() {
    if (!current()) return null
    const sequence = ++request.current
    setLoading(true)
    setContext(null)
    try {
      const latest = await api<TenantContext>('/api/tenant-context', token)
      if (!current() || sequence !== request.current) return null
      setContext(latest)
      setReviewedScope(scope)
      setError('')
      return latest
    } catch (reason) {
      if (current() && sequence === request.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not read current tenant protection.',
        )
      return null
    } finally {
      if (current() && sequence === request.current) setLoading(false)
    }
  }
  useEffect(() => {
    active.current = true
    setContext(null)
    setError('')
    if (enabled && member) void refresh()
    return () => {
      active.current = false
      request.current++
    }
  }, [enabled, member?.id, token, sessionId])
  return {
    context: reviewedScope === scope ? context : null,
    error,
    loading,
    refresh,
  }
}
