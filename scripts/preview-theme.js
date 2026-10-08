const appearance = (() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  let preference = 'system'

  try {
    const saved = localStorage.getItem('besh-preview-theme')
    if (['light', 'dark', 'system'].includes(saved)) preference = saved
  } catch {}

  function apply() {
    document.documentElement.dataset.theme =
      preference === 'system' ? (media.matches ? 'dark' : 'light') : preference

    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.themeChoice === preference),
      )
    })
  }

  apply()
  media.addEventListener('change', apply)

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        preference = button.dataset.themeChoice
        try {
          localStorage.setItem('besh-preview-theme', preference)
        } catch {}
        apply()
      })
    })
    apply()
  })
})()
