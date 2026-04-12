'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getColorClasses, getFamilyColor } from '@/lib/colors'
import { formatTime12h } from '@/lib/timeline-events'
import EventCard from '@/components/ui/EventCard'
import type { TimelineEventRow } from '@/types'

type Phase = 'flight' | 'check_in' | 'check_out' | 'activity'

type Props = {
  event: TimelineEventRow
  phase: Phase
  familyName: string | null
  familyColor: string | null
  canDelete: boolean
}

// Pick the kicker label, action verb, and emoji icon based on the parent
// event type plus the current phase. Hotel and Airbnb both use "check-in" /
// "check-out"; cruise uses "board" / "disembark". Each has its own emoji.
function describePhase(
  event: TimelineEventRow,
  phase: Phase,
  familyName: string | null
): { icon: string; kicker: string; action: string } {
  switch (phase) {
    case 'flight':
      return {
        icon: '✈️',
        kicker: 'flight',
        action: familyName ? `${familyName} flight` : 'Flight',
      }
    case 'activity':
      return {
        icon: '🎟️',
        kicker: 'activity',
        action: familyName ? `${familyName} activity` : 'Activity',
      }
    case 'check_in':
      if (event.type === 'cruise') {
        return {
          icon: '🛳️',
          kicker: 'cruise · board',
          action: familyName ? `${familyName} boards` : 'Board cruise',
        }
      }
      if (event.type === 'airbnb') {
        return {
          icon: '🏡',
          kicker: 'airbnb · check-in',
          action: familyName ? `${familyName} checks in` : 'Airbnb check-in',
        }
      }
      return {
        icon: '🏨',
        kicker: 'hotel · check-in',
        action: familyName ? `${familyName} checks in` : 'Hotel check-in',
      }
    case 'check_out':
      if (event.type === 'cruise') {
        return {
          icon: '🛳️',
          kicker: 'cruise · disembark',
          action: familyName ? `${familyName} disembarks` : 'Disembark cruise',
        }
      }
      if (event.type === 'airbnb') {
        return {
          icon: '🏡',
          kicker: 'airbnb · check-out',
          action: familyName ? `${familyName} checks out` : 'Airbnb check-out',
        }
      }
      return {
        icon: '🏨',
        kicker: 'hotel · check-out',
        action: familyName ? `${familyName} checks out` : 'Hotel check-out',
      }
    default: {
      const _exhaustive: never = phase
      return { icon: '📍', kicker: '', action: _exhaustive }
    }
  }
}

// Build the editorial details string. For check_in: nights + checkout date +
// address (the address is the new bit — user wants to see it on the card).
// For check_out: nothing extra (the title says it all).
// For flight/activity: the standard timeline-events description.
function buildDetails(event: TimelineEventRow, phase: Phase, familyName: string | null): string | null {
  const lead = familyName ? [familyName] : []

  if (phase === 'check_out') {
    return lead.length > 0 ? lead.join(' · ') : null
  }

  if (phase === 'check_in') {
    const nights = event.end_date
      ? Math.round(
          (new Date(event.end_date).getTime() - new Date(event.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null
    const nightsStr = nights ? `${nights} night${nights !== 1 ? 's' : ''}` : ''
    const address = (event.details?.address as string) || ''
    const parts = [...lead, nightsStr, address].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (phase === 'flight') {
    const route = event.origin && event.destination ? `${event.origin} → ${event.destination}` : ''
    const timeParts: string[] = []
    if (event.start_time) timeParts.push(`depart ${formatTime12h(event.start_time)}`)
    if (event.end_time) timeParts.push(`arrive ${formatTime12h(event.end_time)}`)
    const parts = [...lead, route, timeParts.join(', '), event.reference].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  // activity
  const timeParts: string[] = []
  if (event.start_time) timeParts.push(formatTime12h(event.start_time))
  if (event.end_time) timeParts.push(formatTime12h(event.end_time))
  const timeStr = timeParts.join(' – ')
  const location = (event.details?.location as string) || ''
  const parts = [...lead, timeStr, location, event.reference].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

export default function TimelineEventCard({ event, phase, familyName, familyColor, canDelete }: Props) {
  const supabase = createClient()
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    const { error: deleteError } = await supabase
      .from('timeline_events')
      .delete()
      .eq('id', event.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setDeleted(true)
  }

  if (deleted) return null

  const colors = familyColor ? getColorClasses(familyColor) : null
  const { icon, kicker, action } = describePhase(event, phase, familyName)

  // Editorial: time string for the 60px column. Stays don't show a time;
  // flights and activities show their start_time.
  const editorialTime =
    phase === 'flight' || phase === 'activity'
      ? event.start_time
        ? formatTime12h(event.start_time)
        : ''
      : ''

  const editorialAccent = familyColor ? getFamilyColor(familyColor) : null
  const editorialDetails = buildDetails(event, phase, familyName)

  // Default-tree description (legacy text — not currently visible since
  // editorial is the only theme, but kept for parity until the dual-tree
  // teardown commit removes the default tree from this component).
  const legacyDescription =
    phase === 'check_out'
      ? null
      : phase === 'check_in'
        ? buildDetails(event, phase, null) // no family lead in legacy text
        : buildDetails(event, phase, null)

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className={`bg-white rounded-xl p-3 shadow-sm ${colors ? `border-l-4 ${colors.border}` : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <span className="font-semibold text-sm">{action}</span>
              </div>
              <p className="text-sm text-gray-700">{event.title}</p>
              {legacyDescription && <p className="text-xs text-gray-500 mt-0.5">{legacyDescription}</p>}
            </div>
            {canDelete && (
              <button
                onClick={handleDelete}
                className="text-xs text-red-400 hover:text-red-600 shrink-0"
              >
                Delete
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <EventCard
          time={editorialTime}
          kicker={kicker}
          title={event.title}
          details={editorialDetails}
          accentColor={editorialAccent}
          trailing={
            canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className="label-mono"
                style={{ color: 'var(--stroke)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                del
              </button>
            ) : null
          }
        />
        {error && (
          <div className="px-5 detail-mono" style={{ color: 'var(--consensus-pass)' }}>
            {error}
          </div>
        )}
      </div>
    </>
  )
}
