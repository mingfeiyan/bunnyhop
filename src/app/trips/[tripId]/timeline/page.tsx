import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { computeOverlap, formatDateHeader } from '@/lib/timeline'
import { tripCountdown } from '@/lib/trip-countdown'
import { getUserFamilyMap } from '@/lib/family'
import TimelineRealtimeWrapper from '@/components/TimelineRealtimeWrapper'
import TimelineFilterableContent from '@/components/TimelineFilterableContent'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MetaStrip from '@/components/ui/MetaStrip'
import OverviewGrid from '@/components/ui/OverviewGrid'
import type { TripParticipant, TimelineEventRow } from '@/types'

export default async function TimelinePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params

  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id ?? null

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()

    if (tripError) throw new Error(`trips query failed: ${tripError.message}`)
    if (!trip) notFound()

    const { data: events, error: eventsError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('trip_id', tripId)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: true })

    if (eventsError) throw new Error(`timeline_events query failed: ${eventsError.message}`)

    const { data: participants, error: participantsError } = await supabase
      .from('trip_participants')
      .select('*')
      .eq('trip_id', tripId)

    if (participantsError) throw new Error(`trip_participants query failed: ${participantsError.message}`)

    // Determine if current user is the trip organizer
    const isOrganizer = (participants ?? []).some(
      (p: TripParticipant) => p.user_id === currentUserId && p.role === 'organizer'
    )

    // Build a global family lookup: user_id → { name, color }.
    // Uses the shared helper that queries families/family_members (migration 014).
    const userFamilyMap = await getUserFamilyMap(supabase)

    const allEvents = (events ?? []) as TimelineEventRow[]

    // Expand each event into render positions:
    //   flight  -> 1 position at start_date (phase: 'flight')
    //   hotel    -> 2 positions: check_in at start_date, check_out at end_date
    //   activity -> 1 position at start_date
    type RenderPosition = {
      event: TimelineEventRow
      date: string
      phase: 'flight' | 'check_in' | 'check_out' | 'activity'
    }
    const positions: RenderPosition[] = []
    for (const ev of allEvents) {
      switch (ev.type) {
        case 'flight':
          positions.push({ event: ev, date: ev.start_date, phase: 'flight' })
          break
        case 'activity':
          positions.push({ event: ev, date: ev.start_date, phase: 'activity' })
          break
        case 'hotel':
        case 'airbnb':
        case 'cruise':
          // All multi-night stays expand the same way: a check_in position at
          // start_date and (if end_date is set) a check_out position at end_date.
          // The TimelineEventCard renderer picks the kicker text based on
          // event.type (e.g. "airbnb · check-in" vs "cruise · board").
          positions.push({ event: ev, date: ev.start_date, phase: 'check_in' })
          if (ev.end_date) {
            positions.push({ event: ev, date: ev.end_date, phase: 'check_out' })
          }
          break
        default: {
          const _exhaustive: never = ev.type
          void _exhaustive
        }
      }
    }

    // Sort by date, then phase (check_out morning → flight → check_in → activity),
    // then start_time as a tiebreaker for same-phase same-date events. The order
    // reflects a typical day: morning hotel checkout, midday flight, afternoon
    // hotel check-in, then evening activities.
    const PHASE_ORDER: Record<RenderPosition['phase'], number> = {
      check_out: 0,
      flight: 1,
      check_in: 2,
      activity: 3,
    }
    positions.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      if (dateCmp !== 0) return dateCmp
      const phaseCmp = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]
      if (phaseCmp !== 0) return phaseCmp
      // Same date, same phase → fall back to start_time (HH:MM strings sort lexicographically)
      const aTime = a.event.start_time ?? ''
      const bTime = b.event.start_time ?? ''
      return aTime.localeCompare(bTime)
    })

    // Compute overlap based on each family's earliest start_date and latest end_date (or start_date)
    const familyDateMap = new Map<string, { earliest: string; latest: string }>()
    for (const ev of allEvents) {
      const family = userFamilyMap.get(ev.added_by)
      if (!family?.name) continue
      const earliest = ev.start_date
      const latest = ev.end_date ?? ev.start_date
      const existing = familyDateMap.get(family.name)
      if (!existing) {
        familyDateMap.set(family.name, { earliest, latest })
      } else {
        if (earliest < existing.earliest) existing.earliest = earliest
        if (latest > existing.latest) existing.latest = latest
      }
    }
    const familyDateRanges = Array.from(familyDateMap.entries()).map(([familyName, range]) => ({
      familyName,
      ...range,
    }))
    const overlap = computeOverlap(familyDateRanges)

    // Annotate each position with family + permission info so the client
    // component can filter without needing the userFamilyMap.
    type AnnotatedPosition = {
      event: TimelineEventRow
      date: string
      phase: 'flight' | 'check_in' | 'check_out' | 'activity'
      familyName: string | null
      familyColor: string | null
      canDelete: boolean
    }
    const annotated: AnnotatedPosition[] = positions.map(pos => {
      const family = userFamilyMap.get(pos.event.added_by)
      return {
        ...pos,
        familyName: family?.name ?? null,
        familyColor: family?.color ?? null,
        canDelete: isOrganizer || (currentUserId !== null && pos.event.added_by === currentUserId),
      }
    })

    // Group render positions by date
    const dateGroups: { date: string; label: string; positions: AnnotatedPosition[] }[] = []
    for (const pos of annotated) {
      const existing = dateGroups.find(g => g.date === pos.date)
      if (existing) {
        existing.positions.push(pos)
      } else {
        dateGroups.push({
          date: pos.date,
          label: formatDateHeader(pos.date, trip.timezone),
          positions: [pos],
        })
      }
    }

    // Unique families that have events on this trip (for filter pills)
    const familySet = new Map<string, string>()
    for (const pos of annotated) {
      if (pos.familyName && !familySet.has(pos.familyName)) {
        familySet.set(pos.familyName, pos.familyColor ?? '')
      }
    }
    const tripFamilies = Array.from(familySet, ([name, color]) => ({ name, color }))

    const hasEvents = allEvents.length > 0

    const hasDates = Boolean(trip.date_start && trip.date_end)
    const dateRange = hasDates ? `${trip.date_start} — ${trip.date_end}` : null
    const countdown = tripCountdown(trip.date_start, trip.date_end)
    const headerTitle = trip.destination ?? trip.title ?? 'Trip'
    const metaLeft = dateRange ?? 'add bookings to fill in dates'
    const eventCount = allEvents.length
    const dayCount = hasDates
      ? Math.round((new Date(trip.date_end).getTime() - new Date(trip.date_start).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : dateGroups.length

    return (
      <TimelineRealtimeWrapper tripId={tripId}>
        <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }}>
          <PageHeader kicker="trip timeline" title={headerTitle} />
          <MetaStrip left={metaLeft} right={countdown ?? undefined} />
          {hasEvents && (
            <OverviewGrid
              stats={[
                { label: 'events', value: String(eventCount).padStart(2, '0') },
                { label: 'days', value: String(dayCount).padStart(2, '0') },
              ]}
            />
          )}

          {!hasEvents ? (
            <div className="px-5 py-10 text-center">
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontStyle: 'italic' }}>
                No bookings yet.
              </p>
              <p className="detail-mono mt-2">
                Submit booking details via your agent or the form on the trip page.
              </p>
            </div>
          ) : (
            <TimelineFilterableContent
              dateGroups={dateGroups}
              families={tripFamilies}
              overlap={overlap}
              timezone={trip.timezone}
            />
          )}
        </PageShell>
      </TimelineRealtimeWrapper>
    )
  } catch (err) {
    console.error('[TimelinePage] Error rendering timeline:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h1 className="text-lg font-bold text-red-800 mb-2">Timeline error</h1>
            <p className="text-sm text-red-700 mb-3">{message}</p>
            {stack && (
              <pre className="text-[10px] text-red-600 bg-red-100 p-2 rounded overflow-x-auto mb-4 whitespace-pre-wrap">
                {stack}
              </pre>
            )}
            <Link href={`/trips/${tripId}`} className="text-red-600 underline text-sm">
              ← Back to trip
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
