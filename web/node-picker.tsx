import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Braces,
  Database,
  GitBranch,
  Search,
  Star,
  X,
} from 'lucide-react'
import type { FlowTransport } from '../src/flows/transport'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { GitHubIcon } from './components/github-icon'
import { useTranslation } from './i18n'
import {
  catalogForTransport,
  nodeCategories,
  nodeCatalog,
  nodeUnavailableReason,
  type BuiltinNodeKind,
  type BuiltinNodeId,
  type NodeCategory,
} from './node-catalog'

const icons = {
  request: ArrowDownToLine,
  response: Braces,
  condition: GitBranch,
  data: Database,
  database: Database,
  social: GitHubIcon,
}

export function NodePicker({
  editable,
  pending,
  transport,
  nodeKinds,
  onChoose,
  onClose,
}: {
  editable: boolean
  pending: boolean
  transport: FlowTransport
  nodeKinds: readonly BuiltinNodeKind[]
  onChoose: (kind: BuiltinNodeKind) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<NodeCategory | 'all' | 'favorites'>(
    'all',
  )
  const [favorites, setFavorites] = useState<BuiltinNodeId[]>(() => {
    try {
      const stored = localStorage.getItem('besh-node-favorites')
      if (!stored || stored.length > 8192) return []
      const values: unknown = JSON.parse(stored)
      if (!Array.isArray(values)) return []
      return [
        ...new Set(
          values.filter(
            (id): id is BuiltinNodeId =>
              typeof id === 'string' &&
              nodeCatalog.some((entry) => entry.id === id),
          ),
        ),
      ]
    } catch {
      return []
    }
  })
  const dialog = useRef<HTMLDialogElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const element = dialog.current
    const opener = document.activeElement as HTMLElement | null
    element?.showModal()
    searchInput.current?.focus()
    return () => {
      element?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const entries = catalogForTransport(transport)
    .map((entry) => {
      const key =
        transport === 'websocket' && entry.nodeType === 'request'
          ? 'wsRequest'
          : transport === 'websocket' && entry.nodeType === 'response'
            ? 'wsResponse'
            : entry.nodeType
      return {
        ...entry,
        label: t(`nodes.${key}.label`),
        description: t(`nodes.${key}.description`),
      }
    })
    .filter(
      (entry) =>
        (category === 'all' ||
          entry.category === category ||
          (category === 'favorites' && favorites.includes(entry.id))) &&
        [
          entry.label,
          entry.description,
          t(
            `nodePicker.category.${entry.category === 'product-login' ? 'identity' : entry.category}`,
          ),
          ...entry.keywords,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
    )

  function toggleFavorite(id: BuiltinNodeId) {
    const next = favorites.includes(id)
      ? favorites.filter((item) => item !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      localStorage.setItem('besh-node-favorites', JSON.stringify(next))
    } catch {
      /* Preferences remain usable in memory when storage is unavailable. */
    }
  }

  return (
    <dialog
      ref={dialog}
      className="node-picker"
      aria-labelledby="node-picker-title"
      aria-describedby="node-picker-help"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
    >
      <div className="node-picker-frame">
        <header className="node-picker-header">
          <div>
            <h2 id="node-picker-title">{t('nodePicker.title')}</h2>
            <p id="node-picker-help">{t('nodePicker.help')}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nodePicker.close')}
            disabled={pending}
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        <div className="node-picker-search">
          <Search size={18} aria-hidden="true" />
          <Input
            ref={searchInput}
            aria-label={t('nodePicker.search')}
            placeholder={t('nodePicker.search')}
            value={search}
            disabled={pending}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="node-picker-content">
          <nav
            className="node-picker-categories"
            aria-label={t('nodePicker.categories')}
          >
            <Button
              variant="ghost"
              aria-pressed={category === 'all'}
              disabled={pending}
              onClick={() => setCategory('all')}
            >
              {t('nodePicker.all')}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={category === 'favorites'}
              disabled={pending}
              onClick={() => setCategory('favorites')}
            >
              <Star size={16} />
              {t('nodePicker.favorites')}
            </Button>
            {nodeCategories.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                aria-pressed={category === item.id}
                disabled={pending}
                onClick={() => setCategory(item.id)}
              >
                {t(
                  `nodePicker.category.${item.id === 'product-login' ? 'identity' : item.id}`,
                )}
              </Button>
            ))}
          </nav>
          <section
            className="node-picker-results"
            aria-live="polite"
            aria-label={t('nodePicker.results')}
          >
            {entries.length ? (
              entries.map((entry) => {
                const Icon = icons[entry.nodeType]
                const reason = nodeUnavailableReason(entry.nodeType, {
                  editable,
                  transport,
                  nodeKinds,
                })
                return (
                  <article className="node-picker-entry" key={entry.id}>
                    <span className="node-picker-icon">
                      <Icon size={22} />
                    </span>
                    <div className="node-picker-entry-content">
                      <span className="node-picker-category">
                        {t(
                          `nodePicker.category.${entry.category === 'product-login' ? 'identity' : entry.category}`,
                        )}
                      </span>
                      <div className="node-picker-entry-heading">
                        <h3>{entry.label}</h3>
                        <Button
                          className="node-picker-favorite"
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-pressed={favorites.includes(entry.id)}
                          aria-label={t(
                            favorites.includes(entry.id)
                              ? 'nodePicker.unfavorite'
                              : 'nodePicker.favorite',
                            { name: entry.label },
                          )}
                          onClick={() => toggleFavorite(entry.id)}
                        >
                          <Star
                            size={16}
                            fill={
                              favorites.includes(entry.id)
                                ? 'currentColor'
                                : 'none'
                            }
                          />
                        </Button>
                      </div>
                      <p>{entry.description}</p>
                      {reason ? (
                        <p className="node-picker-unavailable">{t(reason)}</p>
                      ) : null}
                      <Button
                        variant="outline"
                        disabled={pending || !!reason}
                        aria-label={t('nodePicker.add', { name: entry.label })}
                        onClick={() => onChoose(entry.nodeType)}
                      >
                        {t('nodePicker.add', { name: entry.label })}
                      </Button>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="node-picker-empty">
                {t(
                  category === 'favorites' && !search
                    ? 'nodePicker.noFavorites'
                    : 'nodePicker.empty',
                )}
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  )
}
