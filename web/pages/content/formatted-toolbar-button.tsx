import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/button'

type Props = Omit<
  ComponentProps<typeof Button>,
  'children' | 'type' | 'variant' | 'size'
> & {
  label: string
  icon: LucideIcon
}

export function FormattedToolbarButton({
  label,
  icon: Icon,
  onFocus,
  onBlur,
  onPointerDown,
  className,
  ...props
}: Props) {
  const id = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const tooltip = useRef<HTMLSpanElement>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyboardFocus = useRef(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  function cancelClose() {
    if (closing.current !== null) clearTimeout(closing.current)

    closing.current = null
  }

  function closeLater() {
    cancelClose()
    if (keyboardFocus.current) return

    closing.current = setTimeout(() => setOpen(false), 120)
  }

  useLayoutEffect(() => {
    if (!open || !anchor.current || !tooltip.current) return

    const target = anchor.current.getBoundingClientRect()
    const hint = tooltip.current.getBoundingClientRect()
    const left = Math.max(
      8,
      Math.min(
        target.left + (target.width - hint.width) / 2,
        window.innerWidth - hint.width - 8,
      ),
    )
    const below = target.bottom + 8
    const top =
      below + hint.height <= window.innerHeight - 8
        ? below
        : Math.max(8, target.top - hint.height - 8)

    setPosition({ left, top })
  }, [open, label])

  useEffect(() => {
    if (!open) return

    const dismiss = () => setOpen(false)
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      dismiss()

      // A hovered hint must not let Escape clear the editor's selected text.
      // Inside the toolbar, Lexical still restores focus and native selection.
      const surface = anchor.current
        ?.closest('.formatted-text-field')
        ?.querySelector('.formatted-text-surface')
      if (surface?.contains(document.activeElement)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('keydown', escape, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)

    return () => {
      window.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  useEffect(() => () => cancelClose(), [])

  return (
    <span
      ref={anchor}
      className="formatted-tool-anchor"
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return

        cancelClose()
        setOpen(true)
      }}
      onPointerLeave={closeLater}
    >
      <Button
        {...props}
        type="button"
        variant="ghost"
        size="icon"
        className={['formatted-tool-button', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={(event) => {
          keyboardFocus.current = event.currentTarget.matches(':focus-visible')
          if (keyboardFocus.current) {
            cancelClose()
            setOpen(true)
          }

          onFocus?.(event)
        }}
        onBlur={(event) => {
          keyboardFocus.current = false
          cancelClose()
          setOpen(false)
          onBlur?.(event)
        }}
        onPointerDown={(event) => {
          cancelClose()
          setOpen(false)
          onPointerDown?.(event)
        }}
      >
        <Icon size={18} className="size-[18px]" aria-hidden="true" />
      </Button>
      {open
        ? createPortal(
            <span
              ref={tooltip}
              id={id}
              role="tooltip"
              className="formatted-tool-tooltip"
              style={position}
              onPointerEnter={cancelClose}
              onPointerLeave={closeLater}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
