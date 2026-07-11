import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { freeLeft, FREE_LIMIT } from '../lib/quota'
import { LogoMark } from './Logo'

// Shared primitives of the «рабочий стол» metaphor: the OS menu bar with a
// live clock, the desktop surface, windows with titlebars, and draggable
// desk props (files, stickers, trash).

export function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// MenuBar: static menu labels on the landing, real navigation in the app.
export function MenuBar({ nav = false }: { nav?: boolean }) {
  const clock = useClock()
  const { authed, demo, profile, logout } = useAuth()

  const initials =
    profile && (profile.first_name || profile.last_name)
      ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
      : '··'

  const menuItem = ({ isActive }: { isActive: boolean }) =>
    `px-1 whitespace-nowrap transition ${isActive ? 'font-bold text-accent' : 'text-ink-soft hover:text-ink'}`

  return (
    <div className="relative z-50 flex h-9.5 items-center justify-between border-b border-ink/14 bg-paper/85 px-3 font-sans text-[13px] font-medium backdrop-blur-lg sm:px-5">
      <div className="flex items-center gap-3 sm:gap-5.5">
        <Link to="/" className="flex items-center gap-1.5">
          <LogoMark size={19} />
          <b className="font-bold max-sm:hidden">GetYourOffer</b>
        </Link>
        {nav ? (
          <span className="flex gap-4.5">
            <NavLink to="/app/new" className={menuItem}>
              Новый отклик
            </NavLink>
            <NavLink to="/app/tracker" className={menuItem}>
              Трекер
            </NavLink>
          </span>
        ) : (
          <span className="hidden gap-5.5 sm:flex">
            <a href="#how" className="text-ink-soft transition hover:text-ink">
              Как это работает
            </a>
            <a href="#trust" className="text-ink-soft transition hover:text-ink">
              Приватность
            </a>
            <a href="#faq" className="text-ink-soft transition hover:text-ink">
              Вопросы
            </a>
            {authed ? (
              <Link to="/app/tracker" className="text-ink-soft transition hover:text-ink">
                Трекер
              </Link>
            ) : (
              <Link to="/login" className="text-ink-soft transition hover:text-ink">
                Войти
              </Link>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[12.5px] text-ink-soft sm:gap-4.5">
        {demo ? (
          <span className="rounded-full border border-accent/40 bg-accent/8 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-accent">
            <span className="max-sm:hidden">демо без бэкенда</span>
            <span className="sm:hidden">демо</span>
          </span>
        ) : (
          <span className="font-mono text-xs font-semibold text-accent">
            <span className="max-sm:hidden">
              осталось {freeLeft()} из {FREE_LIMIT} бесплатных
            </span>
            <span className="sm:hidden">
              {freeLeft()}/{FREE_LIMIT} беспл.
            </span>
          </span>
        )}
        <span className="max-sm:hidden">RU</span>
        <span className="tabular-nums max-sm:hidden">{clock}</span>
        {nav && authed ? (
          <>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-accent font-sans text-[10.5px] font-bold text-accent-ink"
              title={profile ? `${profile.first_name} ${profile.last_name}` : undefined}
            >
              {initials}
            </span>
            <button type="button" onClick={logout} className="transition hover:text-ink">
              выйти
            </button>
          </>
        ) : (
          !nav && (
            <Link
              to={authed ? '/app/new' : '/register'}
              className="font-semibold text-ink transition hover:text-accent"
            >
              {authed ? 'в приложение →' : 'Регистрация →'}
            </Link>
          )
        )}
      </div>
    </div>
  )
}

// Desktop: the wallpaper surface every screen sits on.
export function Desktop({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`relative bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-canvas-lift)_0%,var(--color-canvas)_55%,var(--color-canvas-deep)_100%)] ${className ?? ''}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(16,18,22,.014)_0_2px,transparent_2px_5px)]" />
      <div className="relative">{children}</div>
    </div>
  )
}

// Window: paper card with the OS titlebar (traffic lights, centered title).
export function Window({
  title,
  right,
  tilt = 0,
  dark = false,
  className,
  children,
}: {
  title: string
  right?: React.ReactNode
  tilt?: number
  dark?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border-[1.5px] border-ink shadow-[0_30px_70px_rgba(16,18,22,.18)] ${
        dark ? 'bg-ink text-paper' : 'bg-paper'
      } ${className ?? ''}`}
      style={tilt !== 0 ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <div className="flex items-center gap-2 border-b border-ink/12 bg-[#EEF0F4] px-4 py-3 text-ink">
        <span className="h-3 w-3 rounded-full bg-accent" />
        <span className="h-3 w-3 rounded-full bg-ink/18" />
        <span className="h-3 w-3 rounded-full bg-ink/18" />
        <span className="flex-1 truncate text-center font-sans text-[12.5px] font-semibold text-ink-soft">
          {title}
        </span>
        {right && <span className="font-mono text-[11px] text-steel">{right}</span>}
      </div>
      {children}
    </div>
  )
}

// Draggable wraps a desktop prop: pointer-drag moves it via translate().
export function Draggable({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0, x: 0, y: 0 })

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = state.current
    s.dragging = true
    s.startX = e.clientX
    s.startY = e.clientY
    s.baseX = s.x
    s.baseY = s.y
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = state.current
    if (!s.dragging || !ref.current) return
    s.x = s.baseX + e.clientX - s.startX
    s.y = s.baseY + e.clientY - s.startY
    ref.current.style.transform = `translate(${s.x}px, ${s.y}px)`
  }

  function onPointerUp() {
    state.current.dragging = false
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute cursor-grab touch-none select-none active:cursor-grabbing ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

const FILE_BADGES = {
  PDF: 'bg-file-pdf',
  DOCX: 'bg-ink-soft',
  XLSX: 'bg-file-xlsx',
  PNG: 'bg-steel',
  TXT: 'bg-ink-soft',
} as const

export function DeskFile({
  kind,
  name,
  tilt = 0,
  highlight,
}: {
  kind: keyof typeof FILE_BADGES
  name: React.ReactNode
  tilt?: number
  highlight?: boolean
}) {
  return (
    <div className="w-[130px] text-center" style={tilt !== 0 ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div className="relative mx-auto h-[72px] w-[60px] rounded-[7px] border-[1.5px] border-ink/35 bg-paper shadow-file">
        <span className="absolute -top-px -right-px h-0 w-0 rounded-tr-[6px] rounded-bl-lg border-t-[16px] border-l-[16px] border-t-canvas-deep border-l-canvas-deep" />
        <span
          className={`absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-white ${FILE_BADGES[kind]}`}
        >
          {kind}
        </span>
      </div>
      <div
        className={`mt-1.5 font-sans text-[11.5px]/[1.3] font-medium ${
          highlight ? 'rounded-[5px] bg-accent/16 px-1 py-0.5 text-ink' : 'text-ink-soft'
        }`}
      >
        {name}
      </div>
    </div>
  )
}

// Sticker: the yellow Caveat note.
export function Sticker({ tilt = 2.5, children, footnote }: { tilt?: number; children: React.ReactNode; footnote?: string }) {
  return (
    <div
      className="w-[160px] bg-sticker px-3.75 pt-4 pb-4.5 font-sticker text-xl/[1.25] font-semibold italic text-sticker-ink"
      style={{ transform: `rotate(${tilt}deg)`, boxShadow: '0 10px 22px rgba(16,18,22,.2)' }}
    >
      {children}
      {footnote && (
        <span className="mt-2 block font-sans text-[11px] font-normal not-italic text-[#7A6C2E]">{footnote}</span>
      )}
    </div>
  )
}
