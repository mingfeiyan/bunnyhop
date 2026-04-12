import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MonoLabel from '@/components/ui/MonoLabel'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  // Use the service role to look up the trip by invite code. The user
  // isn't a participant yet (that's the whole point of the invite page),
  // so the RLS policy on trips (which requires is_trip_member) would
  // block the query via the user's session. Only fetch the trip ID —
  // don't expose invite_code or other fields back to the client.
  const serviceSupabase = createServiceClient()
  const { data: trip } = await serviceSupabase
    .from('trips')
    .select('id')
    .eq('invite_code', code)
    .single()

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
