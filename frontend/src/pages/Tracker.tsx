import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../lib/api'
import { Desktop, Draggable, MenuBar, Sticker, Window } from '../components/desktop'
import { STATUS_LABELS, STATUS_ORDER } from '../components/StatusBadge'

type Filter = 'all' | 'active' | 'offers'

const ACTIVE_STATUSES: api.VacancyStatus[] = ['draft', 'sent', 'replied']

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  return `${days} дн.`
}

function FunnelBar({ label, value, max, accent, delay }: { label: string; value: number; max: number; accent?: boolean; delay: number }) {
  const width = max > 0 ? `${Math.max(3, Math.round((value / max) * 100))}%` : '3%'
  return (
    <div>
      <div className="mb-1.5 flex justify-between">
        <span className={accent ? 'font-bold text-accent' : ''}>{label}</span>
        <b className={accent ? 'text-accent' : ''}>{value}</b>
      </div>
      <div className="h-2.5 rounded-[5px] bg-paper/14">
        <div
          className={`h-2.5 rounded-[5px] ${accent ? 'bg-accent' : 'bg-paper'}`}
          style={{ ['--w' as string]: width, animation: `growbar 1.2s ${delay}s cubic-bezier(.2,.8,.2,1) both` }}
        />
      </div>
    </div>
  )
}

// Tracker as a desktop: the registry window with a sidebar of filters, the
// dark funnel window and a follow-up sticker pinned to the desk.
export default function Tracker() {
  const [vacancies, setVacancies] = useState<api.VacancyWithResumes[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .listVacancies()
      .then((list) => {
        if (!cancelled) setVacancies(list ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Неизвестная ошибка.')
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const total = vacancies.length
    const active = vacancies.filter((v) => ACTIVE_STATUSES.includes(v.status)).length
    const sent = vacancies.filter((v) => v.status !== 'draft').length
    const replied = vacancies.filter((v) => v.status === 'replied' || v.status === 'offer').length
    const offers = vacancies.filter((v) => v.status === 'offer').length
    return { total, active, sent, replied, offers }
  }, [vacancies])

  const visible = useMemo(() => {
    if (filter === 'active') return vacancies.filter((v) => ACTIVE_STATUSES.includes(v.status))
    if (filter === 'offers') return vacancies.filter((v) => v.status === 'offer')
    return vacancies
  }, [vacancies, filter])

  async function changeStatus(id: string, status: api.VacancyStatus) {
    const prev = vacancies
    setVacancies((list) => list.map((v) => (v.id === id ? { ...v, status } : v)))
    try {
      await api.updateVacancyStatus(id, status)
    } catch (err) {
      setVacancies(prev)
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус.')
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Удалить отклик «${name}»? Действие необратимо.`)) return
    const prev = vacancies
    setVacancies((list) => list.filter((v) => v.id !== id))
    try {
      await api.deleteVacancy(id)
    } catch (err) {
      setVacancies(prev)
      setError(err instanceof Error ? err.message : 'Не удалось удалить отклик.')
    }
  }

  const sidebarItem = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={`rounded-[7px] px-2.5 py-1.5 text-left font-sans text-[12.5px] transition ${
        filter === f ? 'bg-accent/14 font-bold text-ink' : 'font-medium text-ink-mute hover:bg-ink/6'
      }`}
    >
      {label}
    </button>
  )

  const followUp = vacancies.find((v) => v.status === 'replied')
  const statusSelectStyle = (s: api.VacancyStatus) =>
    s === 'offer'
      ? 'bg-accent text-accent-ink'
      : s === 'replied'
        ? 'bg-ink text-paper'
        : s === 'rejected'
          ? 'border-[1.5px] border-ink/30 text-steel'
          : s === 'draft'
            ? 'border-[1.5px] border-dashed border-ink/40 text-steel'
            : 'border-[1.5px] border-ink text-ink'

  return (
    <div className="flex min-h-screen flex-col">
      <MenuBar nav />
      <Desktop className="flex-1">
        <div className="relative z-10 mx-auto max-w-[1280px] px-6 pt-9 pb-14 sm:px-9">
          {error !== '' && (
            <p className="mb-5 rounded-xl border border-file-pdf/30 bg-file-pdf/8 px-4 py-3 font-sans text-sm text-file-pdf">
              {error}
            </p>
          )}

          <div className="grid items-start gap-6.5 lg:grid-cols-[1fr_310px]">
            {/* Registry window */}
            <Window
              title="Трекер — все отклики"
              right={String(vacancies.length)}
              tilt={-0.3}
              className="animate-popin"
            >
              <div className="flex">
                <div className="flex w-[150px] flex-none flex-col gap-1.5 border-r border-ink/12 bg-[#EEF0F4] px-3 py-3.5 max-sm:hidden">
                  {sidebarItem('all', `Все · ${counts.total}`)}
                  {sidebarItem('active', `Активные · ${counts.active}`)}
                  {sidebarItem('offers', `Офферы · ${counts.offers}`)}
                  <div className="mt-auto px-2.5 pt-4 font-mono text-[10.5px] text-steel">
                    {vacancies.length > 0 &&
                      `последний — ${relativeTime(
                        [...vacancies].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].updated_at,
                      )}`}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="kicker grid grid-cols-[1fr_130px_82px_72px] gap-3 border-b border-ink/12 px-5 py-2.5 text-[10px] text-steel max-sm:grid-cols-[1fr_120px]">
                    <span>Роль · компания</span>
                    <span>Статус</span>
                    <span className="max-sm:hidden">Обновл.</span>
                    <span className="max-sm:hidden" />
                  </div>

                  {!loaded && <p className="px-5 py-10 text-center font-mono text-sm text-steel">загружаем…</p>}

                  {loaded && visible.length === 0 && (
                    <p className="px-5 py-10 text-center font-sans text-sm text-steel">
                      {vacancies.length === 0
                        ? 'Здесь появятся ваши отклики — начните с первого.'
                        : 'Под этот фильтр ничего не попадает.'}
                    </p>
                  )}

                  {visible.map((v) => (
                    <div
                      key={v.id}
                      className="grid grid-cols-[1fr_130px_82px_72px] items-center gap-3 border-b border-ink/8 px-5 py-3 font-sans text-[13.5px] transition hover:bg-accent/5 max-sm:grid-cols-[1fr_120px]"
                    >
                      <Link to={`/app/vacancies/${v.id}`} className="min-w-0">
                        <b className="block truncate font-bold hover:text-accent">{v.name}</b>
                      </Link>
                      <select
                        value={v.status}
                        onChange={(e) => changeStatus(v.id, e.target.value as api.VacancyStatus)}
                        className={`w-fit cursor-pointer appearance-none rounded-full px-2.5 py-0.75 font-sans text-[10.5px] font-bold focus:outline-none ${statusSelectStyle(v.status)}`}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s} className="bg-paper text-ink">
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <span className="text-[12.5px] text-steel max-sm:hidden">{relativeTime(v.updated_at)}</span>
                      <span className="flex items-center justify-end gap-2.5 max-sm:hidden">
                        <Link
                          to={`/app/vacancies/${v.id}`}
                          className="font-sans text-[12px] font-semibold text-accent hover:underline"
                        >
                          открыть
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(v.id, v.name)}
                          title="Удалить"
                          className="font-sans text-[12px] font-semibold text-steel transition hover:text-file-pdf"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  ))}

                  <Link
                    to="/app/new"
                    className="block px-5 py-3.5 font-sans text-[13px] font-bold text-accent transition hover:bg-accent/6"
                  >
                    + Новый отклик — минута
                  </Link>
                </div>
              </div>
            </Window>

            {/* Funnel window + reminder sticker */}
            <div className="flex flex-col gap-8">
              <Window title="воронка_поиска.stats" dark tilt={0.5} className="animate-popin">
                <div className="px-6 py-5.5">
                  <div className="flex flex-col gap-3 font-sans text-[13px] font-medium">
                    <FunnelBar label="Отклики" value={counts.total} max={counts.total} delay={0.2} />
                    <FunnelBar label="Отправлено" value={counts.sent} max={counts.total} delay={0.4} />
                    <FunnelBar label="Ответы" value={counts.replied} max={counts.total} delay={0.6} />
                    <FunnelBar label="Офферы" value={counts.offers} max={counts.total} accent delay={0.8} />
                  </div>
                  <div className="mt-4.5 border-t border-paper/16 pt-3.5 font-sans text-[12.5px]/[1.5] text-paper/60">
                    {counts.sent > 0
                      ? `Конверсия в ответ — ${Math.round((counts.replied / counts.sent) * 100)}%. Продолжайте в том же темпе.`
                      : 'Отправьте первые отклики — здесь появится конверсия.'}
                  </div>
                </div>
              </Window>

              {followUp && (
                <Draggable className="relative! ml-6">
                  <Link to={`/app/vacancies/${followUp.id}`}>
                    <Sticker tilt={-2} footnote="кликните, чтобы открыть">
                      по «{followUp.name.slice(0, 34)}» ответили — follow-up!
                    </Sticker>
                  </Link>
                </Draggable>
              )}
            </div>
          </div>
        </div>
      </Desktop>
    </div>
  )
}
