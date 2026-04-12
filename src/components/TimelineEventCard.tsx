'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFamilyColor } from '@/lib/colors'
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
// Append the family name to the kicker when known, so the family identity
// is visible as a label (e.g., "flight · Yan Family"). Without this the
// only visual cue was the 5px accent border, which was too subtle.
function withFamily(base: string, familyName: string | null): string {
  return familyName ? `${base} · ${familyName}` : base
}

function describePhase(
  event: TimelineEventRow,
  phase: Phase,
  familyName: string | null
): { icon: string; kicker: string; action: string } {
  switch (phase) {
    case 'flight':
      return {
        icon: '✈️',
        kicker: withFamily('flight', familyName),
        action: familyName ? `${familyName} flight` : 'Flight',
      }
    case 'activity':
      return {
        icon: '🎟️',
        kicker: withFamily('activity', familyName),
        action: familyName ? `${familyName} activity` : 'Activity',
      }
    case 'check_in':
      if (event.type === 'cruise') {
        return {
          icon: '🛳️',
          kicker: withFamily('cruise · board', familyName),
          action: familyName ? `${familyName} boards` : 'Board cruise',
        }
      }
      if (event.type === 'airbnb') {
        return {
          icon: '🏡',
          kicker: withFamily('airbnb · check-in', familyName),
          action: familyName ? `${familyName} checks in` : 'Airbnb check-in',
        }
      }
      return {
        icon: '🏨',
        kicker: withFamily('hotel · check-in', familyName),
        action: familyName ? `${familyName} checks in` : 'Hotel check-in',
      }
    case 'check_out':
      if (event.type === 'cruise') {
        return {
          icon: '🛳️',
          kicker: withFamily('cruise · disembark', familyName),
          action: familyName ? `${familyName} disembarks` : 'Disembark cruise',
        }
      }
      if (event.type === 'airbnb') {
        return {
          icon: '🏡',
          kicker: withFamily('airbnb · check-out', familyName),
          action: familyName ? `${familyName} checks out` : 'Airbnb check-out',
        }
      }
      return {
        icon: '🏨',
        kicker: withFamily('hotel · check-out', familyName),
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
// Build the editorial details string. Family name is now in the kicker
// label (via withFamily), so it's NOT repeated here — the details line
// focuses on the booking-specific info (nights, address, route, times).
function buildDetails(event: TimelineEventRow, phase: Phase): string | null {
  if (phase === 'check_out') {
    return null
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
    const parts = [nightsStr, address].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (phase === 'flight') {
    const route = event.origin && event.destination ? `${event.origin} → ${event.destination}` : ''
    const timeParts: string[] = []
    if (event.start_time) timeParts.push(`depart ${formatTime12h(event.start_time)}`)
    if (event.end_time) timeParts.push(`arrive ${formatTime12h(event.end_time)}`)
    const parts = [route, timeParts.join(', '), event.reference].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  // activity
  const timeParts: string[] = []
  if (event.start_time) timeParts.push(formatTime12h(event.start_time))
  if (event.end_time) timeParts.push(formatTime12h(event.end_time))
  const timeStr = timeParts.join(' – ')
  const location = (event.details?.location as string) || ''
  const parts = [timeStr, location, event.reference].filter(Boolean)
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
  const editorialDetails = buildDetails(event, phase)
  const legacyDescription = buildDetails(event, phase)

  return (
    <>
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
    </>
  )
}
