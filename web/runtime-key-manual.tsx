import { useState, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import type { RuntimePermission } from './lib/api'
import { TenantReview, useTenantReview } from './tenant-review'

type ManualKeyInput = {
  name: string
  flowId: string
  releaseRevision: number
  permissions: RuntimePermission[]
  expiresAt: string
  tenantLabel?: string
}

export function ManualPinnedKeyForm({
  flowIds,
  name,
  onNameChange,
  disabled,
  reviewNeeded,
  onReleaseReviewed,
  onReview,
  createButton,
}: {
  flowIds: string[]
  name: string
  onNameChange: (name: string) => void
  disabled: boolean
  reviewNeeded: boolean
  onReleaseReviewed: () => void
  onReview: (value: ManualKeyInput) => void
  createButton: RefObject<HTMLButtonElement | null>
}) {
  const [flowId, setFlowId] = useState(flowIds[0] ?? '')
  const [revision, setRevision] = useState('')
  const [operation, setOperation] = useState('rest')
  const [days, setDays] = useState('30')
  const tenantReview = useTenantReview(flowId, 'published', !!flowId)
  const revisionNumber = Number(revision)
  const validRevision =
    /^[1-9]\d*$/.test(revision) && Number.isSafeInteger(revisionNumber)
  const permissions: RuntimePermission[] =
    operation === 'both'
      ? ['query', 'mutation']
      : [operation as RuntimePermission]
  const valid =
    !!name.trim() &&
    flowIds.includes(flowId) &&
    validRevision &&
    !reviewNeeded &&
    tenantReview.ready

  return (
    <form
      className="runtime-key-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled || !valid) return
        onReview({
          name: name.trim(),
          flowId,
          releaseRevision: revisionNumber,
          permissions,
          expiresAt: new Date(
            Date.now() + Number(days) * 24 * 60 * 60 * 1000,
          ).toISOString(),
          ...(tenantReview.required
            ? { tenantLabel: tenantReview.context?.tenant?.label }
            : {}),
        })
      }}
    >
      <p className="credential-note">
        Read APIs is not granted. These IDs come from your selected access;
        endpoint details and drafts have not been read. Ask the owner for the
        current published revision and operation type. Besh verifies them before
        issuing a key. Only this release is supported. Protection checks read
        minimal row-access metadata and your own assigned identity.
      </p>
      <div className="runtime-key-fields">
        <label>
          Key name
          <Input
            aria-label="Key name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={80}
            disabled={disabled}
            required
          />
        </label>
        <label>
          Shared API ID
          <Select
            label="Shared API ID"
            value={flowId}
            disabled={disabled}
            options={flowIds.map((id) => ({ value: id, label: `API ${id}` }))}
            onValueChange={(id) => {
              setFlowId(id)
              setRevision('')
              onReleaseReviewed()
            }}
          />
        </label>
        <label>
          Known published release
          <Input
            aria-label="Known published release"
            inputMode="numeric"
            value={revision}
            onChange={(event) => {
              setRevision(event.target.value)
              onReleaseReviewed()
            }}
            disabled={disabled}
            placeholder="Ask the owner for the current revision"
            required
          />
        </label>
        <label>
          Operation type
          <Select
            label="Operation type"
            value={operation}
            onValueChange={setOperation}
            disabled={disabled}
            options={[
              { value: 'rest', label: 'REST requests' },
              { value: 'query', label: 'GraphQL queries' },
              { value: 'mutation', label: 'GraphQL mutations' },
              { value: 'both', label: 'GraphQL queries and mutations' },
              { value: 'ws', label: 'WebSocket messages' },
            ]}
          />
        </label>
        <label>
          Expires in
          <Select
            label="Expires in"
            value={days}
            onValueChange={setDays}
            disabled={disabled}
            options={[1, 7, 30, 90].map((value) => ({
              value: String(value),
              label: `${value} ${value === 1 ? 'day' : 'days'}`,
            }))}
          />
        </label>
      </div>
      <TenantReview review={tenantReview} disabled={disabled} />
      {reviewNeeded ? (
        <p className="credential-note">
          The supplied release could not be confirmed. Ask the owner for the
          current revision, then review your input.
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !validRevision}
            onClick={onReleaseReviewed}
          >
            Review supplied release
          </Button>
        </p>
      ) : null}
      <Button ref={createButton} disabled={disabled || !valid}>
        <Plus />
        Create API key
      </Button>
    </form>
  )
}
