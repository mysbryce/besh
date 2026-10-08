const search = document.querySelector('#search')
const group = document.querySelector('#group')
const options = [...document.querySelectorAll('#page-options [role="option"]')]
const listbox = document.querySelector('#page-options')
let chosen = 0
let active = 0
let prefix = ''
let lastTyped = 0

function filter() {
  let count = 0
  const value = options[chosen].dataset.value
  for (const card of document.querySelectorAll('article')) {
    card.hidden =
      !card.textContent.toLowerCase().includes(search.value.toLowerCase()) ||
      (value && card.dataset.page !== value)
    if (!card.hidden) count++
  }
  document.querySelector('#count').textContent = count + ' previews'
  document.querySelector('#empty').style.display = count ? 'none' : 'block'
}

function highlight(index) {
  active = Math.max(0, Math.min(index, options.length - 1))
  options.forEach((option, current) =>
    option.classList.toggle('active', current === active),
  )
  group.setAttribute('aria-activedescendant', options[active].id)
  options[active].scrollIntoView({ block: 'nearest' })
}

function open(value) {
  listbox.hidden = !value
  group.setAttribute('aria-expanded', String(value))
  if (value) highlight(chosen)
  else group.removeAttribute('aria-activedescendant')
}

function choose(index) {
  chosen = index
  options.forEach((option, current) =>
    option.setAttribute('aria-selected', String(current === chosen)),
  )
  document.querySelector('#group-label').textContent =
    options[chosen].textContent
  open(false)
  group.focus()
  filter()
}

group.addEventListener('click', () => open(listbox.hidden))
listbox.addEventListener('pointerdown', (event) => event.preventDefault())
options.forEach((option, index) =>
  option.addEventListener('click', () => choose(index)),
)
search.addEventListener('input', filter)
document.addEventListener('pointerdown', (event) => {
  if (!group.parentElement.contains(event.target)) open(false)
})
group.addEventListener('blur', () => open(false))
group.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' || event.key === 'Escape') {
    open(false)
    return
  }
  if (
    ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)
  ) {
    event.preventDefault()
    if (listbox.hidden) {
      open(true)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') choose(active)
    else if (event.key === 'Home') highlight(0)
    else if (event.key === 'End') highlight(options.length - 1)
    else highlight(active + (event.key === 'ArrowDown' ? 1 : -1))
  } else if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    if (Date.now() - lastTyped > 700) prefix = ''
    prefix += event.key.toLowerCase()
    lastTyped = Date.now()
    if (listbox.hidden) open(true)
    const index = options.findIndex((option) =>
      option.textContent.toLowerCase().startsWith(prefix),
    )
    if (index >= 0) highlight(index)
  }
})
