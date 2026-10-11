import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { Button } from '../../components/ui/button'

export type LoginInput = {
  action: 'BEGIN' | 'COMPLETE'
  code: string
  state: string
  proof: string
}

export const loginMutation =
  'mutation Login($action: LoginAction!, $code: String, $state: String, $proof: String) { login(action: $action, code: $code, state: $state, proof: $proof) { authorizationUrl state proof expiresAt identity { provider subject username name avatarUrl } } }'

export function ProductLoginTest({
  input,
  disabled,
  onChange,
}: {
  input: LoginInput
  disabled: boolean
  onChange: (input: LoginInput) => void
}) {
  return (
    <div className="simple-form">
      <label>
        Login action
        <Select
          label="Login action"
          value={input.action}
          disabled={disabled}
          onValueChange={(action) =>
            onChange({
              action: action as LoginInput['action'],
              code: '',
              state: '',
              proof: '',
            })
          }
          options={[
            { value: 'BEGIN', label: 'BEGIN · Start login' },
            { value: 'COMPLETE', label: 'COMPLETE · Finish login' },
          ]}
        />
      </label>
      <p className="field-help">
        {input.action === 'BEGIN'
          ? 'Start a draft login attempt. Copy the authorization URL for your browser. Keep the proof private on your product server.'
          : 'Use the code and state received by your product callback, plus the proof saved when that login began. Each attempt works once.'}
      </p>
      {input.action === 'COMPLETE' ? (
        <>
          {(['code', 'state', 'proof'] as const).map((field) => (
            <label key={field}>
              {field === 'code'
                ? 'Authorization code'
                : field === 'state'
                  ? 'OAuth state'
                  : 'Login proof'}
              <Input
                type="password"
                autoComplete="off"
                value={input[field]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...input, [field]: event.target.value })
                }
              />
            </label>
          ))}
        </>
      ) : null}
    </div>
  )
}

function loginResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (
    typeof item.authorizationUrl === 'string' &&
    typeof item.proof === 'string'
  )
    return item
  for (const child of Object.values(item)) {
    const result = loginResult(child)
    if (result) return result
  }
  return null
}

export function maskedLoginResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskedLoginResult)
  if (!value || typeof value !== 'object') return value
  const login = ['authorizationUrl', 'proof', 'state', 'identity'].every(
    (key) => Object.hasOwn(value, key),
  )
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (
        login &&
        ['proof', 'state', 'code'].includes(key) &&
        typeof item === 'string'
      )
        return [key, '[hidden]']
      if (login && key === 'authorizationUrl' && typeof item === 'string') {
        try {
          const url = new URL(item)
          for (const field of ['state', 'code_challenge'])
            if (url.searchParams.has(field))
              url.searchParams.set(field, '[hidden]')
          return [key, url.href]
        } catch {
          return [key, '[hidden]']
        }
      }
      return [key, maskedLoginResult(item)]
    }),
  )
}

export function LoginResultActions({
  value,
  onMessage,
}: {
  value: unknown
  onMessage: (message: string, failed?: boolean) => void
}) {
  const result = loginResult(value)
  if (!result) return null
  return (
    <div className="product-login-result">
      <p className="field-help">
        Login proof and state are hidden. Copy only for your own draft test.
        Keep runtime keys and proof on your product server.
      </p>
      <div className="form-actions">
        {[
          ['authorizationUrl', 'Copy authorization URL'],
          ['state', 'Copy OAuth state'],
          ['proof', 'Copy sensitive proof'],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(result[key]))
                onMessage(
                  `${label.replace('Copy ', '')} copied. Keep sensitive values private.`,
                )
              } catch {
                onMessage('Could not copy. Check clipboard permission.', true)
              }
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
