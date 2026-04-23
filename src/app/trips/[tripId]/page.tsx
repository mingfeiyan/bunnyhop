import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TripContextSection from '@/components/TripContextSection'
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

  const [{ data: participants }, { data: { user } }, { data: cards }] = await Promise.all([
    supabase.rpc('get_trip_participants_with_email', { p_trip_id: tripId }),
    supabase.auth.getUser(),
    supabase.from('cards').select('id').eq('trip_id', tripId),
  ])

  const isOrganizer = participants?.some((p: { user_id: string; role: string }) => p.user_id === user?.id && p.role === 'organizer') ?? false

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
    <PageShell back={{ href: '/trips', label: 'all trips' }}>
      <PageHeader title={trip.title} />
      <MetaStrip left={metaLeft} right={countdown ?? undefined} />
      <OverviewGrid
        stats={[
          { label: 'participants', value: String(participantCount).padStart(2, '0') },
          { label: 'cards in deck', value: String(cardCount).padStart(2, '0') },
        ]}
      />

      <DaySection title="Explore">
        <EventCard
          kicker="manage"
          title="Manage trip"
          details="Edit details, invite people, see who's on the trip"
          actions={
            <PillButton href={`/trips/${tripId}/manage`}>manage</PillButton>
          }
        />
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

      {/* Family groups now managed globally on /admin */}
    </PageShell>
  )
}
