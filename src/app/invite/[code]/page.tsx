import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Find the trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', code)
    .single()

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid invite link</p>
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
