import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('./preview.css', import.meta.url), 'utf8')

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
        <style>
          ${styles}
        </style>
      </head>
      <body>
        <header>
          <small>BESH / INTERACTIVE WALKTHROUGH</small>
          <h1>Every page. Every action.</h1>
          <p>
            Real screenshots from an isolated workspace. Each card follows a
            checked action or state. Keys are masked. Click any screenshot for
            its full-size preview.
          </p>
          <div class="stats">
            <span>${records.length} checked previews</span
            ><span>${groups.length} page groups</span
            ><span>Desktop + mobile</span><span>Local demo data only</span>
          </div>
        </header>
        <div class="toolbar">
          <input
            id="search"
            type="search"
            placeholder="Search pages, actions, or errors…"
            aria-label="Search previews"
          /><select id="group" aria-label="Filter by page">
            <option value="">All pages</option>
            ${groups.map((group) => `<option>${escape(group)}</option>`).join('')}</select
          ><span id="count">${records.length} previews</span
          ><a href="manifest.json">Action manifest</a>
        </div>
        <main>
          ${records.map((record, index) => `<article data-page="${escape(record.page)}"><a class="picture" href="${escape(record.image)}" target="_blank" rel="noreferrer"><img src="${escape(record.image)}" loading="lazy" alt="${escape(record.title)}"></a><div class="caption"><span class="passed">✓ CHECKED</span><small>${String(index + 1).padStart(2, '0')} / ${escape(record.page)}</small><h2>${escape(record.title)}</h2><p>${escape(record.detail)}</p></div></article>`).join('')}
        </main>
        <p id="empty">No previews match this filter.</p>
        <footer>
          Planned integrations appear only on the roadmap. External databases,
          social auth, WebSockets, custom plugins, and AI are not functional
          preview pages yet.
        </footer>
        <script>
          const search = document.querySelector('#search')
          const group = document.querySelector('#group')
          function filter() {
            let count = 0
            for (const card of document.querySelectorAll('article')) {
              card.hidden =
                !card.textContent
                  .toLowerCase()
                  .includes(search.value.toLowerCase()) ||
                (group.value && card.dataset.page !== group.value)
              if (!card.hidden) count++
            }
            document.querySelector('#count').textContent = count + ' previews'
            document.querySelector('#empty').style.display = count
              ? 'none'
              : 'block'
          }
          search.addEventListener('input', filter)
          group.addEventListener('change', filter)
        </script>
      </body>
    </html>`
}
