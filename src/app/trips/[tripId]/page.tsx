import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TripContextSection from '@/components/TripContextSection'
import InviteLink from '@/components/InviteLink'
import FamilyGroupManager from '@/components/FamilyGroupManager'
import EditTripDetailsButton from '@/components/EditTripDetailsButton'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MetaStrip from '@/components/ui/MetaStrip'
import OverviewGrid from '@/components/ui/OverviewGrid'
import DaySection from '@/components/ui/DaySection'
import EventCard from '@/components/ui/EventCard'
import PillButton from '@/components/ui/PillButton'
import { tripCountdown } from '@/lib/trip-countdown'

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
  const participantCount = participants?.length ?? 0

  // Trip metadata may be null if the user created the trip with only a title.
  // Auto-fill kicks in once they add a hotel/flight via context. Until then,
  // we render placeholder strings instead of crashing on new Date(null).
  const hasDates = Boolean(trip.date_start && trip.date_end)
  const dateRange = hasDates
    ? `${new Date(trip.date_start).toLocaleDateString()} — ${new Date(trip.date_end).toLocaleDateString()}`
    : null
  const countdown = tripCountdown(trip.date_start, trip.date_end)
  const destinationDisplay = trip.destination ?? null
  const metaLeft = [destinationDisplay, dateRange].filter(Boolean).join(' · ') || 'add bookings to fill in details'

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-md mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <Link href="/trips" className="text-sm text-blue-600 mb-2 block">&larr; All Trips</Link>
              <h1 className="text-2xl font-bold">{trip.title}</h1>
              <p className="text-gray-500">{trip.destination ?? 'Destination not set'}</p>
              <p className="text-sm text-gray-400">
                {hasDates
                  ? `${new Date(trip.date_start).toLocaleDateString()} — ${new Date(trip.date_end).toLocaleDateString()}`
                  : 'Dates not set'}
              </p>

              {/* Participant count */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-gray-500">{participantCount} participants</span>
              </div>

              {/* Invite link */}
              <div className="mt-2">
                <InviteLink inviteCode={trip.invite_code} />
              </div>

              {/* Edit trip details — organizer only */}
              <EditTripDetailsButton trip={trip} isOrganizer={isOrganizer} />
            </div>

            {/* Timeline (prominent action) */}
            <Link href={`/trips/${tripId}/timeline`}
              className="block w-full text-center bg-blue-600 text-white font-semibold rounded-2xl px-4 py-4 hover:bg-blue-700 transition shadow-sm">
              📅 View Trip Timeline
            </Link>

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
            </div>

            {/* Results */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-lg mb-2">Group Results</h2>
              <Link href={`/trips/${tripId}/results`}
                className="text-blue-600 hover:underline text-sm">
                View results &rarr;
              </Link>
            </div>

            {/* Trip context (collapsible) with realtime updates */}
            <TripContextSection
              tripId={tripId}
              currentUserId={user?.id ?? null}
              isOrganizer={isOrganizer}
            />

            {/* Family Groups (collapsible, secondary) */}
            <FamilyGroupManager
              tripId={tripId}
              isOrganizer={isOrganizer}
              participants={participants ?? []}
            />
          </div>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <PageShell back={{ href: '/trips', label: 'all trips' }}>
          <PageHeader title={trip.title} />
          <MetaStrip left={metaLeft} right={countdown ?? undefined} />
          <OverviewGrid
            stats={[
              { label: 'participants', value: String(participantCount).padStart(2, '0') },
              { label: 'cards in deck', value: String(cardCount).padStart(2, '0') },
            ]}
          />

          {/* Action row: edit details (organizer-only) + invite buttons all
              on a single line. The leadingButtons slot on InviteLink puts the
              EditTripDetailsButton inside the same flex container so all three
              pills wrap together on narrow screens. */}
          <section className="px-5 py-5 border-b border-stroke">
            <InviteLink
              inviteCode={trip.invite_code}
              leadingButtons={<EditTripDetailsButton trip={trip} isOrganizer={isOrganizer} />}
            />
          </section>

          {/* Main actions: timeline, swipe/generate, results */}
          <DaySection title="Explore">
            <EventCard
              kicker="timeline"
              title="View trip timeline"
              details="Flights, hotels, activities — all in one place"
              actions={
                <PillButton href={`/trips/${tripId}/timeline`}>view timeline</PillButton>
              }
            />
            {cardCount > 0 ? (
              <EventCard
                kicker="discover"
                title={`${cardCount} cards in the deck`}
                details="Swipe through recommendations as a group"
                actions={
                  <PillButton href={`/trips/${tripId}/swipe`}>start swiping</PillButton>
                }
              />
            ) : (
              <EventCard
                kicker="discover"
                title="No cards yet"
                details="Generate AI recommendations to get started"
                actions={
                  <PillButton href={`/trips/${tripId}/generate`}>generate recommendations</PillButton>
                }
              />
            )}
            <EventCard
              kicker="results"
              title="Group consensus"
              details="See what everyone wants, what's mixed, and what's a hard pass"
              actions={
                <PillButton href={`/trips/${tripId}/results`}>view results →</PillButton>
              }
            />
          </DaySection>

          {/* Trip context — child renders its own dual-tree */}
          <TripContextSection
            tripId={tripId}
            currentUserId={user?.id ?? null}
            isOrganizer={isOrganizer}
          />

          {/* Family groups — child renders its own dual-tree */}
          <FamilyGroupManager
            tripId={tripId}
            isOrganizer={isOrganizer}
            participants={participants ?? []}
          />
        </PageShell>
      </div>
    </>
  )
}
