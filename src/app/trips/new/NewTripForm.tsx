'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import { EditorialInput } from '@/components/ui/EditorialInput'
import { getFamilyColor } from '@/lib/colors'

type Family = { id: string; name: string; color: string }

export default function NewTripForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState<boolean | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<Set<string>>(new Set())
  const [userFamilyId, setUserFamilyId] = useState<string | null>(null)

  // Check approval + load families in parallel. Families are admin-curated
  // (migration 014), so the creator picks from a global list to invite.
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setApproved(false); return }
      const [{ data: approvedRow }, { data: fams }, { data: fm }] = await Promise.all([
        supabase.from('approved_creators').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('families').select('id, name, color').order('name'),
        supabase.from('family_members').select('family_id').eq('user_id', user.id).maybeSingle(),
      ])
      setApproved(Boolean(approvedRow))
      setFamilies(fams ?? [])
      // Pre-select the creator's own family so their code is auto-generated too.
      // (The trigger already creates it when they're added as participant, so
      // this is just a UI hint — not an actual bug if skipped.)
      if (fm?.family_id) {
        setUserFamilyId(fm.family_id)
        setSelectedFamilyIds(new Set([fm.family_id]))
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleFamily(id: string) {
    setSelectedFamilyIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

    // Add creator as organizer. The ensure_trip_family_invite trigger fires
    // here and creates a trip_family_invites row for the creator's own family.
    await supabase
      .from('trip_participants')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'organizer' })

    // Create invite codes for the other families the creator picked.
    // The creator's own family is skipped (already created by the trigger).
    const otherFamilies = [...selectedFamilyIds].filter(id => id !== userFamilyId)
    if (otherFamilies.length > 0) {
      const rows = otherFamilies.map(family_id => ({ trip_id: trip.id, family_id }))
      const { error: inviteError } = await supabase
        .from('trip_family_invites')
        .insert(rows)
      if (inviteError) {
        // Don't block trip creation — organizer can add families later from
        // the trip page. But surface the error so the user knows.
        console.error('Failed to create family invites:', inviteError)
      }
    }

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

        {families.length > 0 && (
          <div className="mb-6">
            <MonoLabel className="block mb-2">invite families</MonoLabel>
            <p className="detail-mono mb-3" style={{ opacity: 0.7 }}>
              Each family gets its own invite code. You&apos;ll see every code on
              the trip page so you can share it with them.
            </p>
            <div className="space-y-2">
              {families.map(f => {
                const checked = selectedFamilyIds.has(f.id)
                const isSelf = f.id === userFamilyId
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 cursor-pointer"
                    style={{ opacity: isSelf ? 0.6 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !isSelf && toggleFamily(f.id)}
                      disabled={isSelf}
                    />
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: getFamilyColor(f.color),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '16px',
                      }}
                    >
                      {f.name}
                    </span>
                    {isSelf && <span className="label-mono" style={{ opacity: 0.6 }}>your family · auto-included</span>}
                  </label>
                )
              })}
            </div>
          </div>
        )}

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
