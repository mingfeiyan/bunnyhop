'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getColorClasses } from '@/lib/colors'
import { formatTimelineEventDescription } from '@/lib/timeline-events'
import type { TimelineEventRow } from '@/types'

type Phase = 'flight' | 'check_in' | 'check_out'

type Props = {
  event: TimelineEventRow
  phase: Phase
  familyName: string | null
  familyColor: string | null
  canDelete: boolean
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
  const icon = phase === 'flight' ? '✈️' : '🏨'

  let action: string
  if (phase === 'flight') {
    action = familyName ? `${familyName} flight` : 'Flight'
  } else if (phase === 'check_in') {
    action = familyName ? `${familyName} checks in` : 'Hotel check-in'
  } else {
    action = familyName ? `${familyName} checks out` : 'Hotel check-out'
  }

  // For check_out, use a simpler description since it's the same hotel
  const description = phase === 'check_out'
    ? null
    : formatTimelineEventDescription(event)

  return (
    <div className={`bg-white rounded-xl p-3 shadow-sm ${colors ? `border-l-4 ${colors.border}` : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{icon}</span>
            <span className="font-semibold text-sm">{action}</span>
          </div>
          <p className="text-sm text-gray-700">{event.title}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
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
  )
}
