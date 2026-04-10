import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TripContextSection from '@/components/TripContextSection'
import InviteLink from '@/components/InviteLink'
import FamilyGroupManager from '@/components/FamilyGroupManager'

export default async function TripHubPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  const { data: participants } = await supabase
    .rpc('get_trip_participants_with_email', { p_trip_id: tripId })

  const { data: { user } } = await supabase.auth.getUser()
  const isOrganizer = participants?.some((p: { user_id: string; role: string }) => p.user_id === user?.id && p.role === 'organizer') ?? false

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('trip_id', tripId)

  const cardCount = cards?.length ?? 0

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <Link href="/trips" className="text-sm text-blue-600 mb-2 block">&larr; All Trips</Link>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-gray-500">{trip.destination}</p>
          <p className="text-sm text-gray-400">
            {new Date(trip.date_start).toLocaleDateString()} — {new Date(trip.date_end).toLocaleDateString()}
          </p>

          {/* Participant count */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-gray-500">{participants?.length ?? 0} participants</span>
          </div>

          {/* Invite link */}
          <div className="mt-2">
            <InviteLink inviteCode={trip.invite_code} />
          </div>
        </div>

        {/* Family Groups */}
        <FamilyGroupManager
          tripId={tripId}
          isOrganizer={isOrganizer}
          participants={participants ?? []}
        />

        {/* Trip context with realtime updates */}
        <TripContextSection tripId={tripId} />

        {/* Discover */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-2">Discover</h2>
          {cardCount > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">{cardCount} cards in the deck</p>
              <Link href={`/trips/${tripId}/swipe`}
                className="block w-full text-center bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 transition">
                Start Swiping
              </Link>
            </div>
          ) : (
            <Link href={`/trips/${tripId}/generate`}
              className="block w-full text-center bg-green-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-green-700 transition">
              Generate Recommendations
            </Link>
          )}
          <Link href={`/trips/${tripId}/timeline`}
            className="block w-full text-center border border-blue-600 text-blue-600 font-medium rounded-lg px-4 py-3 hover:bg-blue-50 transition mt-3">
            View Timeline
          </Link>
        </div>

        {/* Results */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-2">Group Results</h2>
          <Link href={`/trips/${tripId}/results`}
            className="text-blue-600 hover:underline text-sm">
            View results &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
