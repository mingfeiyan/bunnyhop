import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MonoLabel from '@/components/ui/MonoLabel'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  // Use the service role to look up the (trip, family) pair by invite code.
  // The user isn't a participant yet (that's the whole point of the invite
  // page), so the RLS policy on trips (which requires is_trip_member) would
  // block the query via the user's session.
  const serviceSupabase = createServiceClient()
  const resolved = await (async () => {
    const { data: tfi } = await serviceSupabase
      .from('trip_family_invites')
      .select('trip_id, family_id')
      .eq('invite_code', code)
      .maybeSingle()
    if (tfi) return { tripId: tfi.trip_id as string, familyId: tfi.family_id as string }
    const { data: legacy } = await serviceSupabase
      .from('trips')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()
    if (legacy) return { tripId: legacy.id as string, familyId: null }
    return null
  })()
  const trip = resolved ? { id: resolved.tripId } : null

  const supabase = await createClient()

  if (!trip) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--cream)' }}
      >
        <div className="text-center max-w-sm">
          <MonoLabel className="block mb-2">invalid invite</MonoLabel>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            This link doesn&apos;t work
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '16px',
              fontStyle: 'italic',
              opacity: 0.75,
              marginTop: '12px',
              marginBottom: '24px',
            }}
          >
            The invite code may have been mistyped or the trip was deleted.
          </p>
          <Link
            href="/trips"
            className="pill-btn pill-btn-sm"
          >
            ← back to trips
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/invite/${code}`)
  }

  // Auto-link the joining user to the family this invite is for, so the
  // admin doesn't have to do it manually after signup. Skipped on legacy
  // (non-per-family) invite codes since there's no family to link to.
  // Uses service role because family_members writes are admin-only via RLS.
  if (resolved?.familyId) {
    const { data: alreadyMember } = await serviceSupabase
      .from('family_members')
      .select('id')
      .eq('family_id', resolved.familyId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!alreadyMember) {
      // Display name from email prefix; admin can rename later in /admin.
      const displayName = user.email?.split('@')[0] ?? 'New member'
      await serviceSupabase
        .from('family_members')
        .insert({
          family_id: resolved.familyId,
          user_id: user.id,
          display_name: displayName,
          member_type: 'human',
        })
    }
  }

  // Check if already a participant
  const { data: existing } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    await supabase
      .from('trip_participants')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'member' })
  }

  redirect(`/trips/${trip.id}`)
}
