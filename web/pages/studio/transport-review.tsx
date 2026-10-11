import { useEffect, useRef } from 'react'
import type { FlowTransport } from '../../../src/flows/transport'
import { Button } from '../../components/ui/button'

export function TransportReview({
  target,
  disabled,
  onCancel,
  onConfirm,
}: {
  target: FlowTransport
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const element = dialog.current
    const opener = document.getElementById('api-type')
    element?.showModal()
    cancel.current?.focus()
    return () => {
      element?.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="rollback-confirm"
      aria-label="Change API transport"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2>
        Change this draft to{' '}
        {target === 'websocket'
          ? 'WebSocket'
          : target === 'graphql'
            ? 'GraphQL'
            : 'REST'}
        ?
      </h2>
      <p>
        REST API rules, GraphQL schema and WebSocket message rules belong to
        their own transport. Switching removes the previous transport’s rules
        from this draft.
      </p>
      {target === 'websocket' ? (
        <p>
          The current reply will be replaced with the received message for an
          echo, or selected data rows for a read. Review the new reply fields
          and exact browser origins before saving. For a typed REST data read,
          existing row rules become reply fields and its query filter becomes a
          received message field. Selected columns and row limit stay unchanged.
        </p>
      ) : (
        <p>
          Review the response and the new transport’s input rules before saving
          or testing. Switching does not rewrite data settings.
        </p>
      )}
      <p>
        Published release stays unchanged until you save and publish this draft.
      </p>
      <div className="title-actions">
        <Button ref={cancel} variant="outline" onClick={onCancel}>
          Cancel transport change
        </Button>
        <Button disabled={disabled} onClick={onConfirm}>
          Confirm transport change
        </Button>
      </div>
    </dialog>
  )
}
