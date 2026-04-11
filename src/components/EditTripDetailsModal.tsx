'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
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
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold">Edit Trip Details</h2>

            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
              <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label htmlFor="edit-destination" className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input id="edit-destination" value={destination} onChange={(e) => setDestination(e.target.value)}
                placeholder="Bora Bora, French Polynesia"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-date-start" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input id="edit-date-start" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="edit-date-end" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input id="edit-date-end" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label htmlFor="edit-timezone" className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input id="edit-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}
                placeholder="Pacific/Tahiti"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
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

            <div className="mb-4">
              <MonoLabel className="block mb-1">trip name</MonoLabel>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '17px',
                  border: 'none',
                  borderBottom: '1px solid var(--stroke)',
                  padding: '6px 0',
                  background: 'transparent',
                  color: 'var(--stroke)',
                  outline: 'none',
                }}
              />
            </div>

            <div className="mb-4">
              <MonoLabel className="block mb-1">destination</MonoLabel>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Bora Bora, French Polynesia"
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '17px',
                  border: 'none',
                  borderBottom: '1px solid var(--stroke)',
                  padding: '6px 0',
                  background: 'transparent',
                  color: 'var(--stroke)',
                  outline: 'none',
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <MonoLabel className="block mb-1">start date</MonoLabel>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '14px',
                    border: 'none',
                    borderBottom: '1px solid var(--stroke)',
                    padding: '6px 0',
                    background: 'transparent',
                    color: 'var(--stroke)',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <MonoLabel className="block mb-1">end date</MonoLabel>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '14px',
                    border: 'none',
                    borderBottom: '1px solid var(--stroke)',
                    padding: '6px 0',
                    background: 'transparent',
                    color: 'var(--stroke)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div className="mb-5">
              <MonoLabel className="block mb-1">timezone</MonoLabel>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Pacific/Tahiti"
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '14px',
                  border: 'none',
                  borderBottom: '1px solid var(--stroke)',
                  padding: '6px 0',
                  background: 'transparent',
                  color: 'var(--stroke)',
                  outline: 'none',
                }}
              />
              <p className="detail-mono mt-1" style={{ opacity: 0.6 }}>
                IANA timezone for displaying local times
              </p>
            </div>

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
      </div>
    </>
  )
}
