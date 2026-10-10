import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('./preview.css', import.meta.url), 'utf8')
const fontFaces = [
  {
    family: 'Google Sans Flex',
    file: 'google-sans-flex-latin-variable.woff2',
    range:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    family: 'Google Sans Flex',
    file: 'google-sans-flex-latin-ext-variable.woff2',
    range:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
  {
    family: 'Noto Sans Thai',
    file: 'noto-sans-thai-thai-variable.woff2',
    range: 'U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC',
  },
]
  .map((font) => {
    const bytes = readFileSync(
      new URL(`../web/assets/${font.file}`, import.meta.url),
    ).toString('base64')
    return `@font-face {
      font-family: '${font.family}';
      src: url('data:font/woff2;base64,${bytes}') format('woff2');
      font-style: normal;
      font-weight: 400 800;
      font-display: swap;
      unicode-range: ${font.range};
    }`
  })
  .join('\n')
const interactions = readFileSync(
  new URL('./preview-filter.js', import.meta.url),
  'utf8',
)
const appearance = readFileSync(
  new URL('./preview-theme.js', import.meta.url),
  'utf8',
)

export type PreviewRecord = {
  page: string
  title: string
  detail: string
  image: string
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )

export function renderPreview(records: PreviewRecord[]) {
  const groups = [...new Set(records.map((record) => record.page))]

  return /* HTML */ `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Besh · Every page & action</title>
        <script>
          ${appearance}
        </script>
        <style>
          ${fontFaces}
          ${styles}
        </style>
      </head>
      <body>
        <header>
          <div class="header-inner">
            <div class="header-navigation">
              <div class="brand">
                <span class="brand-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                    <path d="M14 17.5h7M17.5 14v7" />
                  </svg>
                </span>
                <small>besh</small>
              </div>
              <div class="theme-controls" role="group" aria-label="Appearance">
                <button
                  type="button"
                  data-theme-choice="light"
                  aria-label="Light theme"
                  aria-pressed="false"
                >
                  Light
                </button>
                <button
                  type="button"
                  data-theme-choice="dark"
                  aria-label="Dark theme"
                  aria-pressed="false"
                >
                  Dark
                </button>
                <button
                  type="button"
                  data-theme-choice="system"
                  aria-label="System theme"
                  aria-pressed="true"
                >
                  Auto
                </button>
              </div>
            </div>
            <div class="intro">
              <h1>Every page. Every action.</h1>
              <p>
                Real screenshots from an isolated workspace. Each card follows a
                checked action or state. Keys are masked. Click any screenshot
                for its full-size preview.
              </p>
              <div class="stats">
                <span>${records.length} checked previews</span
                ><span>${groups.length} page groups</span
                ><span>Desktop + mobile</span><span>Local demo data only</span>
              </div>
            </div>
          </div>
        </header>
        <div class="toolbar">
          <div class="toolbar-inner">
            <div class="search-field">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                id="search"
                type="search"
                placeholder="Search pages, actions, or errors…"
                aria-label="Search previews"
              />
            </div>
            <div class="filter-field">
              <button
                id="group"
                type="button"
                role="combobox"
                aria-label="Filter by page"
                aria-controls="page-options"
                aria-haspopup="listbox"
                aria-expanded="false"
              >
                <span id="group-label">All pages</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </button>
              <div id="page-options" role="listbox" aria-label="Pages" hidden>
                ${['', ...groups].map((group, index) => `<div id="page-option-${index}" role="option" aria-selected="${index === 0}" data-value="${escape(group)}">${escape(group || 'All pages')}</div>`).join('')}
              </div>
            </div>
            <span id="count" aria-live="polite">${records.length} previews</span
            ><a href="manifest.json">Action manifest</a>
          </div>
        </div>
        <main>
          ${records.map((record, index) => `<article data-page="${escape(record.page)}"><a class="picture" href="${escape(record.image)}" target="_blank" rel="noreferrer"><img src="${escape(record.image)}" loading="lazy" alt="${escape(record.title)}"></a><div class="caption"><span class="passed">✓ CHECKED</span><small>${String(index + 1).padStart(2, '0')} / ${escape(record.page)}</small><h2>${escape(record.title)}</h2><p>${escape(record.detail)}</p></div></article>`).join('')}
        </main>
        <p id="empty">No previews match this filter.</p>
        <footer>
          Typed WebSocket request/reply works. Subscriptions, external
          databases, additional login providers, custom plugins, and AI remain
          on the roadmap.
        </footer>
        <script>
          ${interactions}
        </script>
      </body>
    </html>`
}
