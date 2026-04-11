import type { ReactNode } from 'react'
import MonoLabel from './MonoLabel'

type Stat = {
  label: string
  value: ReactNode
}

type Props = {
  stats: [Stat] | [Stat, Stat]
}

// Bordered top + bottom 1- or 2-column stat strip. The 2-col variant has a
// 1px hairline divider between cells. The mockup uses italic serif for the
// stat values; that's enforced here.
export default function OverviewGrid({ stats }: Props) {
  return (
    <section
      className={`grid border-y border-stroke ${stats.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-5 py-4 ${i === 0 && stats.length === 2 ? 'border-r border-stroke' : ''}`}
        >
          <MonoLabel className="mb-1">{stat.label}</MonoLabel>
          <div
            style={{
              fontSize: '20px',
              fontStyle: 'italic',
              fontFamily: 'var(--font-serif), Georgia, serif',
              lineHeight: 1.2,
            }}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </section>
  )
}
