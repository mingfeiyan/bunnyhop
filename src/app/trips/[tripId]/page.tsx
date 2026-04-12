import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TripContextSection from '@/components/TripContextSection'
import InviteLink from '@/components/InviteLink'
// FamilyGroupManager removed — family management now lives on /admin
// via the global families system (migration 014).
import EditTripDetailsButton from '@/components/EditTripDetailsButton'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MetaStrip from '@/components/ui/MetaStrip'
import OverviewGrid from '@/components/ui/OverviewGrid'
import DaySection from '@/components/ui/DaySection'
import EventCard from '@/components/ui/EventCard'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import { tripCountdown } from '@/lib/trip-countdown'
import { getFamilyColor } from '@/lib/colors'

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

  // Build a family lookup for the participant list display
  const { data: familyMembersData } = await supabase
    .from('family_members')
    .select('user_id, families(name, color)')

  const userFamilyMap = new Map<string, { name: string; color: string }>()
  for (const fm of (familyMembersData ?? []) as Array<Record<string, unknown>>) {
    const uid = fm.user_id as string | null
    const fam = Array.isArray(fm.families) ? fm.families[0] : fm.families
    if (uid && fam && typeof fam === 'object') {
      const { name, color } = fam as { name: string; color: string }
      userFamilyMap.set(uid, { name, color })
    }
  }

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

      {/* Participants list — shows who's joined the trip with their family */}
      {participantCount > 0 && (
        <section className="px-5 py-4 border-b border-stroke">
          <MonoLabel className="block mb-2">who&apos;s on this trip</MonoLabel>
          <div className="space-y-1">
            {(participants as Array<{ user_id: string; email: string; role: string }>).map(p => {
              const family = userFamilyMap.get(p.user_id)
              const displayName = p.email?.split('@')[0] ?? p.user_id.slice(0, 8)
              return (
                <div key={p.user_id} className="flex items-center gap-2 detail-mono">
                  {family && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getFamilyColor(family.color),
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{displayName}</span>
                  {family && (
                    <span style={{ opacity: 0.5 }}>{family.name}</span>
                  )}
                  {p.role === 'organizer' && (
                    <span className="label-mono" style={{ opacity: 0.5 }}>organizer</span>
                  )}
                  {p.user_id === user?.id && (
                    <span className="label-mono" style={{ opacity: 0.5 }}>you</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

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

      {/* Family groups now managed globally on /admin */}
    </PageShell>
  )
}
