import type { ReactNode } from 'react'
import MonoLabel from './MonoLabel'

type Props = {
  time?: string
  kicker?: string
  title: string
  details?: ReactNode
  actions?: ReactNode
  trailing?: ReactNode
  accentColor?: string | null
}

// 60px time column + content column. Optional left accent bar (3px) for
// family-color tagging. Optional kicker line above the title for category
// labels (e.g., "flight", "hotel", "activity"). Optional trailing slot for
// secondary controls (e.g., a small "del" link).
//
// Hairline-separated from siblings via the parent DaySection's bottom border.
export default function EventCard({
  time,
  kicker,
  title,
  details,
  actions,
  trailing,
  accentColor,
}: Props) {
  return (
    <article
      className="grid gap-4 px-5 py-5 border-b border-stroke last:border-b-0"
      style={{
        gridTemplateColumns: '60px 1fr',
        borderLeft: accentColor ? `3px solid ${accentColor}` : undefined,
      }}
    >
      <div className="detail-mono pt-1">{time ?? ''}</div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {kicker && <MonoLabel className="mb-1">{kicker}</MonoLabel>}
            <h3
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 400,
                fontFamily: 'var(--font-serif), Georgia, serif',
                lineHeight: 1.2,
              }}
            >
              {title}
            </h3>
            {details && <div className="detail-mono mt-1">{details}</div>}
            {actions && <div className="mt-3">{actions}</div>}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      </div>
    </article>
  )
}
