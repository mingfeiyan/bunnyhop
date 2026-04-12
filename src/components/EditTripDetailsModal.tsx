'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import { EditorialInput } from '@/components/ui/EditorialInput'
import type { Trip } from '@/types'

type Props = {
  trip: Trip
  onClose: () => void
  onSaved: () => void
}

export default function EditTripDetailsModal({ trip, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(trip.title)
  const [destination, setDestination] = useState(trip.destination ?? '')
  const [dateStart, setDateStart] = useState(trip.date_start ?? '')
  const [dateEnd, setDateEnd] = useState(trip.date_end ?? '')
  const [timezone, setTimezone] = useState(trip.timezone ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!title.trim()) {
      setError('Trip name is required')
      setLoading(false)
      return
    }

    const wasDestinationNull = trip.destination === null
    const willHaveDestination = destination.trim().length > 0

    const { error: updateError } = await supabase
      .from('trips')
      .update({
        title: title.trim(),
        destination: destination.trim() || null,
        date_start: dateStart || null,
        date_end: dateEnd || null,
        timezone: timezone.trim() || null,
      })
      .eq('id', trip.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // If destination just transitioned from null to set, kick off the cover
    // image generation now. Fire-and-forget — the cover lands later.
    if (wasDestinationNull && willHaveDestination) {
      fetch(`/api/trips/${trip.id}/generate-cover`, { method: 'POST' }).catch(() => {
        // Cover generation is best-effort; never block the modal save on it.
      })
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(51,61,41,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm"
        style={{
          background: 'var(--cream)',
          border: '1px solid var(--stroke)',
          padding: '24px',
        }}
      >
        <div className="mb-5">
          <MonoLabel className="block mb-1">edit trip</MonoLabel>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '24px',
              fontWeight: 400,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Trip details
          </h2>
        </div>

        <EditorialInput
          label="trip name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <EditorialInput
          label="destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Bora Bora, French Polynesia"
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <EditorialInput
            label="start date"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            fontSize={14}
            containerClassName=""
          />
          <EditorialInput
            label="end date"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            fontSize={14}
            containerClassName=""
          />
        </div>

        <EditorialInput
          label="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="Pacific/Tahiti"
          fontSize={14}
          hint="IANA timezone for displaying local times"
          containerClassName="mb-5"
        />

        {error && (
          <p className="detail-mono mb-3" style={{ color: 'var(--consensus-pass)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <PillButton type="button" onClick={onClose}>cancel</PillButton>
          <PillButton type="submit" disabled={loading}>
            {loading ? 'saving…' : 'save'}
          </PillButton>
        </div>
      </form>
    </div>
  )
}
