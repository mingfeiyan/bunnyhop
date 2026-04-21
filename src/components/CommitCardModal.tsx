'use client'

import { useState } from 'react'
import PillButton from '@/components/ui/PillButton'
import { EditorialInput } from '@/components/ui/EditorialInput'

export type PlannedEntry = {
  event_id: string
  start_date: string
  start_time: string | null
  status: 'planned' | 'visited'
}

type Props = {
  tripId: string
  cardId: string
  cardTitle: string
  cardCategory: 'restaurant' | 'activity' | 'sightseeing'
  tripDateStart: string | null
  tripDateEnd: string | null
  existing?: PlannedEntry
  onClose: () => void
  onSuccess: () => void
}

// Commit-a-card modal: creates or edits a planned `timeline_event` linked to
// a card. On success, the results page's realtime subscription will pick up
// the change and refresh `plannedByCard` — the modal just closes.
export default function CommitCardModal({
  tripId,
  cardId,
  cardTitle,
  cardCategory,
  tripDateStart,
  tripDateEnd,
  existing,
  onClose,
  onSuccess,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState<string>(
    existing?.start_date ?? tripDateStart ?? today,
  )
  const [startTime, setStartTime] = useState<string>(existing?.start_time ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!existing

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      let res: Response
      if (isEditing && existing) {
        res = await fetch(
          `/api/trips/${tripId}/timeline-events/${existing.event_id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_date: startDate,
              start_time: startTime || null,
            }),
          },
        )
      } else {
        const eventType = cardCategory === 'restaurant' ? 'restaurant' : 'activity'
        res = await fetch(`/api/trips/${tripId}/timeline-events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: eventType,
            title: cardTitle,
            start_date: startDate,
            start_time: startTime || null,
            card_id: cardId,
            status: 'planned',
          }),
        })
      }

      if (!res.ok) {
        let msg = 'failed to save'
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch {
          // fall through with default message
        }
        setError(msg)
        setSubmitting(false)
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to save')
      setSubmitting(false)
    }
  }

  const dateMin = tripDateStart ?? undefined
  const dateMax = tripDateEnd ?? undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white border border-stroke p-6 max-w-md w-[90%]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            fontWeight: 400,
            margin: '0 0 16px 0',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}
        >
          {isEditing ? 'Edit' : 'Plan'} {cardTitle}
        </h2>

        <form onSubmit={handleSubmit}>
          <EditorialInput
            label="date"
            type="date"
            value={startDate}
            min={dateMin}
            max={dateMax}
            onChange={(e) => setStartDate(e.target.value)}
            required
            fontSize={14}
          />

          <EditorialInput
            label="time (optional)"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            fontSize={14}
          />

          {error && (
            <p
              className="detail-mono mb-3"
              style={{ color: 'var(--consensus-pass)' }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <PillButton onClick={onClose} disabled={submitting}>
              cancel
            </PillButton>
            <PillButton type="submit" variant="active" disabled={submitting}>
              {submitting ? '...' : isEditing ? 'update' : 'plan'}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  )
}
