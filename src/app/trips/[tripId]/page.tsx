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
import { getUserFamilyMap } from '@/lib/family'

export default async function TripHubPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  // Run remaining queries in parallel after the trip guard
  const [{ data: participants }, { data: { user } }, { data: cards }, userFamilyMap] = await Promise.all([
    supabase.rpc('get_trip_participants_with_email', { p_trip_id: tripId }),
    supabase.auth.getUser(),
    supabase.from('cards').select('id').eq('trip_id', tripId),
    getUserFamilyMap(supabase),
  ])

  const isOrganizer = participants?.some((p: { user_id: string; role: string }) => p.user_id === user?.id && p.role === 'organizer') ?? false

  // Read the per-family invite codes for this trip. RLS returns:
  //   - Organizer → every family's code on the trip (so they can share).
  //   - Member    → only their own family's code.
  // Migration 019 added the table; 021/023 scoped the SELECT policy.
  const { data: invitesRaw } = await supabase
    .from('trip_family_invites')
    .select('invite_code, families(id, name, color)')
    .eq('trip_id', tripId)
  const invites = (invitesRaw ?? []).map(row => {
    const fam = Array.isArray(row.families) ? row.families[0] : row.families
    const f = fam as { id: string; name: string; color: string } | null
    return {
      inviteCode: row.invite_code as string,
      familyId: f?.id ?? null,
      familyName: f?.name ?? 'Unknown family',
      familyColor: f?.color ?? 'indigo',
    }
  })

  // Pick the code to hand to this user's own agent. Falls back to the legacy
  // trips.invite_code only if they have no family assignment.
  const userFamilyId = user ? [...userFamilyMap.entries()].find(([uid]) => uid === user.id)?.[0] : null
  const myFamilyId = user
    ? (await supabase.from('family_members').select('family_id').eq('user_id', user.id).maybeSingle()).data?.family_id
    : null
  void userFamilyId // (retained for future UX; currently myFamilyId drives display)
  const myInvite = invites.find(i => i.familyId === myFamilyId)
  const userInviteCode: string = myInvite?.inviteCode ?? trip.invite_code

  // Organizer-only: show every invited family's code so they can share.
  const otherInvites = isOrganizer
    ? invites.filter(i => i.familyId !== myFamilyId)
    : []

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
          inviteCode={userInviteCode}
          leadingButtons={<EditTripDetailsButton trip={trip} isOrganizer={isOrganizer} />}
        />
      </section>

      {/* Organizer-only: per-family codes to share with other invited families.
          Each family's agent posts using its own code so timeline attribution
          lands in the right family. */}
      {isOrganizer && otherInvites.length > 0 && (
        <section className="px-5 py-5 border-b border-stroke">
          <MonoLabel className="block mb-2">invited families · share these codes</MonoLabel>
          <div className="space-y-2">
            {otherInvites.map(inv => (
              <div key={inv.inviteCode} className="flex items-center gap-3 detail-mono">
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: getFamilyColor(inv.familyColor),
                    flexShrink: 0,
                  }}
                />
                <span>{inv.familyName}</span>
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    background: 'var(--cream-dark, #f0ebe0)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {inv.inviteCode}
                </code>
              </div>
            ))}
          </div>
        </section>
      )}

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
