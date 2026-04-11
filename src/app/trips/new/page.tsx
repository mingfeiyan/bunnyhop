'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import PillButton from '@/components/ui/PillButton'
import { EditorialInput } from '@/components/ui/EditorialInput'

export default function NewTripPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    // Everything except title is optional. Empty strings → null so the DB
    // stores nothing rather than an empty string. Auto-fill takes over when
    // the user adds bookings via the trip context form (or an agent).
    const destination = (formData.get('destination') as string) || null
    const dateStart = (formData.get('date_start') as string) || null
    const dateEnd = (formData.get('date_end') as string) || null
    const timezone = (formData.get('timezone') as string) || null

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({ title, destination, date_start: dateStart, date_end: dateEnd, timezone, created_by: user.id })
      .select()
      .single()

    if (error) {
      console.error('Trip creation error:', error)
      setError(`Failed to create trip: ${error.message}`)
      setLoading(false)
      return
    }

    // Add creator as organizer
    await supabase
      .from('trip_participants')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'organizer' })

    // If the user filled in destination at creation, kick off cover gen now.
    // Otherwise it'll fire from autofillTripFromEvents the moment the first
    // hotel/flight is added (or from the EditTripDetailsModal save handler).
    if (destination) {
      fetch(`/api/trips/${trip.id}/generate-cover`, { method: 'POST' }).catch(() => {
        // Cover generation is best-effort; never block trip creation on it.
      })
    }

    router.push(`/trips/${trip.id}`)
  }

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4">
            <h1 className="text-2xl font-bold">New Trip</h1>
            <p className="text-xs text-gray-500">Only the trip name is required. The rest auto-fills as you add bookings.</p>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
              <input id="title" name="title" type="text" required placeholder="Summer 2026 Family Trip"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">Destination (optional)</label>
              <input id="destination" name="destination" type="text" placeholder="Bora Bora, French Polynesia"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date_start" className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
                <input id="date_start" name="date_start" type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="date_end" className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                <input id="date_end" name="date_end" type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">Destination Timezone</label>
              <input id="timezone" name="timezone" type="text" placeholder="e.g. Pacific/Tahiti"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              <p className="text-xs text-gray-400 mt-1">IANA timezone for displaying local times</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 disabled:opacity-50 transition">
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
          </form>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <PageShell back={{ href: '/trips', label: 'all trips' }}>
          <PageHeader kicker="new trip" title="Plan a trip" />
          <p
            className="px-5 detail-mono mb-4"
            style={{ opacity: 0.7 }}
          >
            Only the trip name is required. Destination, dates, and timezone fill in
            automatically as you add bookings.
          </p>
          <form onSubmit={handleSubmit} className="px-5 pb-12">
            <EditorialInput
              label="trip name"
              id="title"
              name="title"
              type="text"
              required
              placeholder="Summer 2026 Family Trip"
              fontSize={18}
              containerClassName="mb-5"
            />

            <EditorialInput
              label="destination · optional"
              id="destination"
              name="destination"
              type="text"
              placeholder="Bora Bora — or leave blank, we'll fill it in"
              fontSize={18}
              containerClassName="mb-5"
            />

            <div className="grid grid-cols-2 gap-5 mb-5">
              <EditorialInput
                label="start date · optional"
                id="date_start"
                name="date_start"
                type="date"
                fontSize={15}
                containerClassName=""
              />
              <EditorialInput
                label="end date · optional"
                id="date_end"
                name="date_end"
                type="date"
                fontSize={15}
                containerClassName=""
              />
            </div>

            <EditorialInput
              label="destination timezone"
              id="timezone"
              name="timezone"
              type="text"
              placeholder="Pacific/Tahiti"
              fontSize={15}
              hint="IANA timezone for displaying local times"
              containerClassName="mb-6"
            />

            {error && (
              <p className="detail-mono mb-3" style={{ color: 'var(--consensus-pass)' }}>
                {error}
              </p>
            )}

            <PillButton type="submit" size="md" disabled={loading}>
              {loading ? 'creating…' : 'create trip'}
            </PillButton>
          </form>
        </PageShell>
      </div>
    </>
  )
}
