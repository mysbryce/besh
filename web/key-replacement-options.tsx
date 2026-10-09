import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Input } from './components/ui/input'
import { Select } from './components/ui/select'
import type { RuntimeKey } from './lib/api'

export function KeyReplacementOptions({
  record,
  disabled,
  children,
  onCancel,
  onReplace,
}: {
  record: RuntimeKey
  disabled: boolean
  children: ReactNode
  onCancel: () => void
  onReplace: (graceSeconds: number) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [timing, setTiming] = useState('immediate')
  const [seconds, setSeconds] = useState('60')
  const [acknowledged, setAcknowledged] = useState(false)
  const overlap = timing === 'overlap'
  const validSeconds =
    /^\d+$/.test(seconds) && Number(seconds) >= 1 && Number(seconds) <= 300

  useEffect(() => {
    const current = heading.current
    current?.focus({ preventScroll: true })
    current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [])

  return (
    <section
      className="runtime-key-form"
      aria-labelledby="replacement-options-title"
    >
      <h2 id="replacement-options-title" ref={heading} tabIndex={-1}>
        Replacement options
      </h2>
      <p>
        <strong>{record.name}</strong>
      </p>
      <p className="field-help" style={{ overflowWrap: 'anywhere' }}>
        Key ID: {record.id}
        <br />
        API ID: {record.flowId}
      </p>
      {children}
      <label className="replacement-option-field">
        Replacement timing
        <Select
          label="Replacement timing"
          aria-label="Replacement timing"
          value={timing}
          disabled={disabled}
          onValueChange={(value) => {
            setTiming(value)
            setAcknowledged(false)
          }}
          options={[
            { value: 'immediate', label: 'Immediate' },
            { value: 'overlap', label: 'Short overlap' },
          ]}
        />
      </label>
      {overlap ? (
        <>
          <label
            className="replacement-option-field"
            htmlFor="replacement-overlap-seconds"
          >
            Overlap seconds (1–300)
            <Input
              id="replacement-overlap-seconds"
              inputMode="numeric"
              value={seconds}
              disabled={disabled}
              onChange={(event) => {
                setSeconds(event.target.value)
                setAcknowledged(false)
              }}
              aria-invalid={!validSeconds}
            />
          </label>
          {!validSeconds ? (
            <p className="form-error">
              Enter a whole number from 1 to 300 seconds.
            </p>
          ) : null}
          <p className="field-help">
            The old key continues for the requested overlap, ending no later
            than its original expiry. Besh rejects overlap longer than the key’s
            remaining lifetime. Besh sets the fixed deadline when it accepts
            replacement. The receipt shows that exact time. Both keys still need
            their current API, member and tenant authority.
          </p>
          <label
            className="permission-choice"
            htmlFor="replacement-overlap-ack"
          >
            <Checkbox
              id="replacement-overlap-ack"
              checked={acknowledged}
              disabled={disabled}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            I understand the old key continues during overlap
          </label>
        </>
      ) : (
        <p className="field-help">
          The old key stops working immediately after replacement is accepted.
        </p>
      )}
      <p className="field-help">
        Replacement keeps the same API, permissions, release access, original
        member link, tenant identity and expiry. It does not renew expiry. Save
        the new key once and update your caller.
      </p>
      <div className="title-actions">
        <Button variant="outline" disabled={disabled} onClick={onCancel}>
          Cancel replacement options
        </Button>
        <Button
          disabled={disabled || (overlap && (!validSeconds || !acknowledged))}
          onClick={() => onReplace(overlap ? Number(seconds) : 0)}
        >
          Review replacement
        </Button>
      </div>
    </section>
  )
}
