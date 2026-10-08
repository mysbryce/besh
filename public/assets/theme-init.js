function initializeBeshAppearance() {
  let preference = 'system'

  try {
    const saved = localStorage.getItem('besh-theme')
    if (saved === 'light' || saved === 'dark' || saved === 'system')
      preference = saved
  } catch {}

  const dark =
    preference === 'dark' ||
    (preference === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches)
  const theme = dark ? 'dark' : 'light'
  const background = dark ? '#11151c' : '#f5f5f3'

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.documentElement.style.backgroundColor = background
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', background)
}

initializeBeshAppearance()
