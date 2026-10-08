import { create } from 'zustand'
import { lazy, Suspense } from 'react'

const Select = lazy(() =>
  import('./components/ui/select').then((module) => ({
    default: module.Select,
  })),
)

type Appearance = 'light' | 'dark' | 'system'

function savedAppearance(): Appearance {
  try {
    const value = localStorage.getItem('besh-theme')
    if (value === 'light' || value === 'dark') return value
  } catch {}

  return 'system'
}

const system = matchMedia('(prefers-color-scheme: dark)')

function applyAppearance(appearance: Appearance) {
  const dark =
    appearance === 'dark' || (appearance === 'system' && system.matches)
  const resolved = dark ? 'dark' : 'light'
  const background = dark ? '#11151c' : '#f5f5f3'

  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  document.documentElement.style.backgroundColor = background
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', background)
}

const useAppearance = create<{
  appearance: Appearance
  choose: (appearance: Appearance) => void
}>((set) => ({
  appearance: savedAppearance(),
  choose(appearance) {
    try {
      localStorage.setItem('besh-theme', appearance)
    } catch {}

    applyAppearance(appearance)
    set({ appearance })
  },
}))

applyAppearance(useAppearance.getState().appearance)
system.addEventListener('change', () => {
  if (useAppearance.getState().appearance === 'system')
    applyAppearance('system')
})

export function ThemeControl() {
  const appearance = useAppearance((state) => state.appearance)
  const choose = useAppearance((state) => state.choose)

  return (
    <div className="theme-control">
      <label htmlFor="appearance">Appearance</label>
      <Suspense fallback={<span className="theme-loading">{appearance}</span>}>
        <Select
          id="appearance"
          label="Appearance"
          value={appearance}
          onValueChange={(value) => choose(value as Appearance)}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
      </Suspense>
    </div>
  )
}
