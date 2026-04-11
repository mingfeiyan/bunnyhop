import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { computeOverlap, formatDateHeader } from '@/lib/timeline'
import TimelineEventCard from '@/components/TimelineEventCard'
import TimelineRealtimeWrapper from '@/components/TimelineRealtimeWrapper'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import MetaStrip from '@/components/ui/MetaStrip'
import OverviewGrid from '@/components/ui/OverviewGrid'
import DaySection from '@/components/ui/DaySection'
import MonoLabel from '@/components/ui/MonoLabel'
import type { TripParticipant, FamilyGroup, TimelineEventRow } from '@/types'

// Trip countdown — pure date math against today.
// Returns one of: "X days to go" / "in progress · day X of Y" / "ended X days ago".
function tripCountdown(start: string, end: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const dayMs = 1000 * 60 * 60 * 24
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const todayMs = new Date(today).getTime()

  if (todayMs < startMs) {
    const days = Math.round((startMs - todayMs) / dayMs)
    return `${days} day${days === 1 ? '' : 's'} to go`
  }
  if (todayMs > endMs) {
    const days = Math.round((todayMs - endMs) / dayMs)
    return `ended ${days} day${days === 1 ? '' : 's'} ago`
  }
  const dayNum = Math.round((todayMs - startMs) / dayMs) + 1
  const totalDays = Math.round((endMs - startMs) / dayMs) + 1
  return `in progress · day ${dayNum} of ${totalDays}`
}

// One-word descriptor for a day, derived from the phases of its events.
type Phase = 'flight' | 'check_in' | 'check_out' | 'activity'
function dayTag(phases: Phase[]): string | null {
  const set = new Set(phases)
  if (set.has('flight') && set.has('check_in')) return 'arrival'
  if (set.has('flight') && set.has('check_out')) return 'departure'
  if (set.has('check_out') && set.has('check_in')) return 'transit'
  if (set.size === 1) {
    if (set.has('flight')) return 'travel day'
    if (set.has('check_in')) return 'arrival'
    if (set.has('check_out')) return 'checkout'
    if (set.has('activity')) return 'exploration'
  }
  if (set.has('activity') && !set.has('flight') && !set.has('check_in') && !set.has('check_out')) {
    return 'exploration'
  }
  return null
}

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

    const { data: familyGroups, error: familyGroupsError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('trip_id', tripId)

    if (familyGroupsError) throw new Error(`family_groups query failed: ${familyGroupsError.message}`)

    // Determine if current user is the trip organizer
    const isOrganizer = (participants ?? []).some(
      (p: TripParticipant) => p.user_id === currentUserId && p.role === 'organizer'
    )

    // Build family group lookup by id
    const groupById = new Map<string, FamilyGroup>()
    for (const g of (familyGroups ?? []) as FamilyGroup[]) {
      groupById.set(g.id, g)
    }

    // Build a lookup: user_id -> { familyName, familyColor }
    const userFamilyMap = new Map<string, { familyName: string | null; familyColor: string | null }>()
    for (const p of (participants ?? []) as TripParticipant[]) {
      const group = p.family_group_id ? groupById.get(p.family_group_id) : null
      userFamilyMap.set(p.user_id, {
        familyName: group?.name ?? null,
        familyColor: group?.color ?? null,
      })
    }

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
      if (!family?.familyName) continue
      const earliest = ev.start_date
      const latest = ev.end_date ?? ev.start_date
      const existing = familyDateMap.get(family.familyName)
      if (!existing) {
        familyDateMap.set(family.familyName, { earliest, latest })
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

    // Group render positions by date
    const dateGroups: { date: string; label: string; positions: RenderPosition[] }[] = []
    for (const pos of positions) {
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

    // Determine where to insert the overlap banner
    const overlapStartIndex = overlap
      ? dateGroups.findIndex(g => g.date >= overlap.start)
      : -1

    const hasEvents = allEvents.length > 0

    // Editorial-tree precomputed values
    const dateRange = `${trip.date_start} — ${trip.date_end}`
    const countdown = tripCountdown(trip.date_start, trip.date_end)
    const eventCount = allEvents.length
    const dayCount = dateGroups.length

    return (
      <TimelineRealtimeWrapper tripId={tripId}>
        {/* === Default tree === */}
        <div className="theme-default-tree">
          <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <Link href={`/trips/${tripId}`} className="text-sm text-blue-600 mb-2 block">&larr; Back to trip</Link>
                <h1 className="text-2xl font-bold">Timeline</h1>
                <p className="text-gray-500">{trip.destination}</p>
              </div>

              {!hasEvents ? (
                <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                  <p className="text-gray-400">No bookings yet. Submit booking details via your agent or the form on the trip page.</p>
                  <Link href={`/trips/${tripId}`} className="text-blue-600 hover:underline text-sm mt-2 block">
                    Back to trip
                  </Link>
                </div>
              ) : (
                <div className="relative pl-8 ml-3">
                  {/* Timeline line */}
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gray-200" />

                  {dateGroups.map((group, groupIndex) => (
                    <div key={group.date}>
                      {/* Overlap banner — insert before the overlap start date */}
                      {overlap && groupIndex === overlapStartIndex && (
                        <div className="mb-6 -ml-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-3 border border-dashed border-emerald-300">
                          <p className="text-sm font-semibold text-emerald-800">
                            🎉 Everyone&apos;s together! {formatDateHeader(overlap.start, trip.timezone)} – {formatDateHeader(overlap.end, trip.timezone)}
                          </p>
                        </div>
                      )}

                      {/* Date header */}
                      <div className="relative mb-4">
                        <div className="absolute -left-10 top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group.label}</p>

                        {/* Events for this date */}
                        <div className="mt-2 space-y-2">
                          {group.positions.map(pos => {
                            const family = userFamilyMap.get(pos.event.added_by)
                            const canDelete = isOrganizer || (currentUserId !== null && pos.event.added_by === currentUserId)
                            return (
                              <TimelineEventCard
                                key={`${pos.event.id}-${pos.phase}`}
                                event={pos.event}
                                phase={pos.phase}
                                familyName={family?.familyName ?? null}
                                familyColor={family?.familyColor ?? null}
                                canDelete={canDelete}
                              />
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === Editorial tree === */}
        <div className="theme-editorial-tree">
          <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }}>
            <PageHeader kicker="trip timeline" title={trip.destination} />
            <MetaStrip left={dateRange} right={countdown} />
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
              <main className="pb-24">
                {dateGroups.map((group, groupIndex) => {
                  const tag = dayTag(group.positions.map(p => p.phase))
                  return (
                    <div key={group.date}>
                      {/* Overlap banner — hairline strip with no gradient */}
                      {overlap && groupIndex === overlapStartIndex && (
                        <div
                          className="px-5 py-3 border-y border-stroke"
                          style={{ background: 'var(--stroke-soft)' }}
                        >
                          <MonoLabel>everyone together</MonoLabel>
                          <p
                            style={{
                              fontFamily: 'var(--font-serif)',
                              fontSize: '16px',
                              fontStyle: 'italic',
                              marginTop: '4px',
                            }}
                          >
                            {formatDateHeader(overlap.start, trip.timezone)} – {formatDateHeader(overlap.end, trip.timezone)}
                          </p>
                        </div>
                      )}

                      <DaySection title={group.label} tag={tag ?? undefined}>
                        {group.positions.map(pos => {
                          const family = userFamilyMap.get(pos.event.added_by)
                          const canDelete =
                            isOrganizer || (currentUserId !== null && pos.event.added_by === currentUserId)
                          return (
                            <TimelineEventCard
                              key={`${pos.event.id}-${pos.phase}`}
                              event={pos.event}
                              phase={pos.phase}
                              familyName={family?.familyName ?? null}
                              familyColor={family?.familyColor ?? null}
                              canDelete={canDelete}
                            />
                          )
                        })}
                      </DaySection>
                    </div>
                  )
                })}
              </main>
            )}
          </PageShell>
        </div>
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
