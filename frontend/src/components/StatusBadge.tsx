import type { VacancyStatus } from '../lib/api'

export const STATUS_LABELS: Record<VacancyStatus, string> = {
  draft: 'черновик',
  sent: 'отправлено',
  replied: 'ответ',
  rejected: 'отказ',
  offer: 'оффер ✓',
}

export const STATUS_ORDER: VacancyStatus[] = ['draft', 'sent', 'replied', 'rejected', 'offer']

const STATUS_STYLES: Record<VacancyStatus, string> = {
  draft: 'border-[1.5px] border-dashed border-ink/40 text-steel',
  sent: 'border-[1.5px] border-ink text-ink',
  replied: 'bg-ink text-paper',
  rejected: 'border-[1.5px] border-ink/30 text-steel',
  offer: 'bg-gold text-ink',
}

export function StatusBadge({ status }: { status: VacancyStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 font-sans text-[11.5px] font-bold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
