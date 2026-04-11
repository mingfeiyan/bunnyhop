import type { ReactNode } from 'react'
import MonoLabel from './MonoLabel'

type Props = {
  title: string
  tag?: string
  children: ReactNode
}

// A grouped section with a soft-tinted header strip and a stack of children
// (typically EventCards). Bottom-bordered to separate from the next section.
export default function DaySection({ title, tag, children }: Props) {
  return (
    <section className="border-b border-stroke">
      <header
        className="flex items-baseline justify-between px-5 py-3"
        style={{ background: 'var(--stroke-soft)' }}
      >
        <span
          style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          {title}
        </span>
        {tag && <MonoLabel>{tag}</MonoLabel>}
      </header>
      <div>{children}</div>
    </section>
  )
}
