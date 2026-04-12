'use client'

import { useState } from 'react'
import { formatDateHeader } from '@/lib/timeline'
import TimelineEventCard from '@/components/TimelineEventCard'
import PillButton from '@/components/ui/PillButton'
import DaySection from '@/components/ui/DaySection'
import MonoLabel from '@/components/ui/MonoLabel'
import type { TimelineEventRow } from '@/types'

type Phase = 'flight' | 'check_in' | 'check_out' | 'activity'

type Position = {
  event: TimelineEventRow
  date: string
  phase: Phase
  familyName: string | null
  familyColor: string | null
  canDelete: boolean
}

type DateGroup = {
  date: string
  label: string
  positions: Position[]
}

type FamilyInfo = { name: string; color: string }

type Props = {
  dateGroups: DateGroup[]
  families: FamilyInfo[]
  overlap: { start: string; end: string } | null
  timezone: string | null
}

function dayTag(phases: Phase[]): string | null {
  const set = new Set(phases)
  if (set.has('flight') && set.has('check_in')) return 'arrival'
  if (set.has('flight') && set.has('check_out')) return 'departure'
  if (set.has('check_out') && set.has('check_in')) return 'transit'
  if (set.size === 1) {
    if (set.has('flight')) return 'travel day'
    if (set.has('check_in')) return 'arrival'
    if (set.has('check_out')) return 'checkout'
    if (set.has('activity')) return 'exploration'
  }
  if (set.has('activity') && !set.has('flight') && !set.has('check_in') && !set.has('check_out')) {
    return 'exploration'
  }
  return null
}

export default function TimelineFilterableContent({
  dateGroups,
  families,
  overlap,
  timezone,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null) // null = all

  const filtered = selected
    ? dateGroups
        .map(g => ({
          ...g,
          positions: g.positions.filter(p => p.familyName === selected),
        }))
        .filter(g => g.positions.length > 0)
    : dateGroups

  const overlapStartIndex = overlap
    ? filtered.findIndex(g => g.date >= overlap.start)
    : -1

  return (
    <>
      {families.length > 1 && (
        <div className="flex items-center gap-2 px-5 py-3 flex-wrap">
          <PillButton
            onClick={() => setSelected(null)}
            variant={selected === null ? 'active' : 'default'}
          >
            all
          </PillButton>
          {families.map(f => (
            <PillButton
              key={f.name}
              onClick={() => setSelected(f.name)}
              variant={selected === f.name ? 'active' : 'default'}
            >
              {f.name}
            </PillButton>
          ))}
        </div>
      )}

      <main className="pb-24">
        {filtered.map((group, groupIndex) => {
          const tag = dayTag(group.positions.map(p => p.phase))
          return (
            <div key={group.date}>
              {overlap && groupIndex === overlapStartIndex && (
                <div
                  className="px-5 py-3 border-y border-stroke"
                  style={{ background: 'var(--stroke-soft)' }}
                >
                  <MonoLabel>everyone together</MonoLabel>
                  <p
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '16px',
                      fontStyle: 'italic',
                      marginTop: '4px',
                    }}
                  >
                    {formatDateHeader(overlap.start, timezone)} –{' '}
                    {formatDateHeader(overlap.end, timezone)}
                  </p>
                </div>
              )}

              <DaySection title={group.label} tag={tag ?? undefined}>
                {group.positions.map(pos => (
                  <TimelineEventCard
                    key={`${pos.event.id}-${pos.phase}`}
                    event={pos.event}
                    phase={pos.phase}
                    familyName={pos.familyName}
                    familyColor={pos.familyColor}
                    canDelete={pos.canDelete}
                  />
                ))}
              </DaySection>
            </div>
          )
        })}
      </main>
    </>
  )
}
