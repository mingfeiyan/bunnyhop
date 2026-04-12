'use client'

import { useState, useEffect } from 'react'
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
  const [approved, setApproved] = useState<boolean | null>(null)

  // Check if the current user is in the approved_creators whitelist.
  // If not, they can't create trips — show a message instead of the form.
  useEffect(() => {
    async function checkApproval() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setApproved(false); return }
      const { data } = await supabase
        .from('approved_creators')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      setApproved(Boolean(data))
    }
    checkApproval()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Loading state while checking approval
  if (approved === null) {
    return (
      <PageShell back={{ href: '/trips', label: 'all trips' }}>
        <div className="px-5 py-20 text-center">
          <span className="label-mono">checking permissions…</span>
        </div>
      </PageShell>
    )
  }

  // Not approved — show a message instead of the form
  if (approved === false) {
    return (
      <PageShell back={{ href: '/trips', label: 'all trips' }}>
        <PageHeader title="Can't create trips" />
        <div className="px-5 py-8">
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '17px',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            You don&apos;t have permission to create new trips.
          </p>
          <p className="detail-mono mt-2" style={{ opacity: 0.7 }}>
            Ask the trip admin to approve your account. You can still view and participate in trips you&apos;ve been invited to.
          </p>
          <div className="mt-6">
            <PillButton href="/trips">← back to trips</PillButton>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
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
  )
}
