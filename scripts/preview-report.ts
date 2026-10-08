import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('./preview.css', import.meta.url), 'utf8')
const font = readFileSync(
  new URL('../web/assets/manrope.woff2', import.meta.url),
).toString('base64')
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
          @font-face {
            font-family: 'Manrope';
            src: url('data:font/woff2;base64,${font}') format('woff2');
            font-weight: 200 800;
            font-display: swap;
          }
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
                <span id="group-label">All pages</span
                ><span aria-hidden="true">⌄</span>
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
          Planned integrations appear only on the roadmap. External databases,
          additional login providers, WebSockets, custom plugins, and AI are not
          functional preview pages yet.
        </footer>
        <script>
          ${interactions}
        </script>
      </body>
    </html>`
}
