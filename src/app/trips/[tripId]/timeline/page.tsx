import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { expandContextToEvents, sortTimelineEvents, computeOverlap, formatDateHeader } from '@/lib/timeline'
import { getColorClasses } from '@/components/FamilyGroupManager'
import type { TripContext, TripParticipant, FamilyGroup, TimelineEvent } from '@/types'

export default async function TimelinePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  const { data: contexts } = await supabase
    .from('trip_context')
    .select('*')
    .eq('trip_id', tripId)
    .in('type', ['flight', 'hotel'])

  const { data: participants } = await supabase
    .from('trip_participants')
    .select('*, family_groups(*)')
    .eq('trip_id', tripId)

  // Build a lookup: user_id -> { familyName, familyColor }
  const userFamilyMap = new Map<string, { familyName: string | null; familyColor: string | null }>()
  for (const p of (participants ?? []) as (TripParticipant & { family_groups: FamilyGroup | null })[]) {
    userFamilyMap.set(p.user_id, {
      familyName: p.family_groups?.name ?? null,
      familyColor: p.family_groups?.color ?? null,
    })
  }

  // Expand all contexts into timeline events
  const allEvents: TimelineEvent[] = (contexts ?? []).flatMap((ctx: TripContext) => {
    const family = userFamilyMap.get(ctx.added_by)
    return expandContextToEvents(ctx, family?.familyName ?? null, family?.familyColor ?? null)
  })

  const sortedEvents = sortTimelineEvents(allEvents)

  // Compute overlap
  const familyDateMap = new Map<string, { earliest: string; latest: string }>()
  for (const ev of sortedEvents) {
    if (!ev.familyName || ev.dateUnclear) continue
    const existing = familyDateMap.get(ev.familyName)
    if (!existing) {
      familyDateMap.set(ev.familyName, { earliest: ev.date, latest: ev.date })
    } else {
      if (ev.date < existing.earliest) existing.earliest = ev.date
      if (ev.date > existing.latest) existing.latest = ev.date
    }
  }
  const familyDateRanges = Array.from(familyDateMap.entries()).map(([familyName, range]) => ({
    familyName,
    ...range,
  }))
  const overlap = computeOverlap(familyDateRanges)

  // Group events by date for rendering
  const dateGroups: { date: string; label: string; events: TimelineEvent[] }[] = []
  const unclearEvents: TimelineEvent[] = []

  for (const ev of sortedEvents) {
    if (ev.dateUnclear) {
      unclearEvents.push(ev)
      continue
    }
    const existing = dateGroups.find(g => g.date === ev.date)
    if (existing) {
      existing.events.push(ev)
    } else {
      dateGroups.push({
        date: ev.date,
        label: formatDateHeader(ev.date, trip.timezone),
        events: [ev],
      })
    }
  }

  // Determine where to insert overlap banner
  const overlapStartIndex = overlap
    ? dateGroups.findIndex(g => g.date >= overlap.start)
    : -1

  const hasEvents = sortedEvents.length > 0

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <Link href={`/trips/${tripId}`} className="text-sm text-blue-600 mb-2 block">&larr; Back to trip</Link>
          <h1 className="text-2xl font-bold">Timeline</h1>
          <p className="text-gray-500">{trip.destination}</p>
        </div>

        {!hasEvents ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-400">No bookings yet. Add flight or hotel details in Trip Details to see your timeline.</p>
            <Link href={`/trips/${tripId}`} className="text-blue-600 hover:underline text-sm mt-2 block">
              Go to Trip Details
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
                    {group.events.map(ev => {
                      const colors = ev.familyColor ? getColorClasses(ev.familyColor) : null
                      return (
                        <div
                          key={ev.id}
                          className={`bg-white rounded-xl p-3 shadow-sm ${colors ? `border-l-4 ${colors.border}` : ''}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{ev.icon}</span>
                            <span className="font-semibold text-sm">{ev.title}</span>
                          </div>
                          <p className="text-xs text-gray-500">{ev.description}</p>
                          {ev.familyName && colors && (
                            <span className={`inline-block mt-1.5 text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-medium`}>
                              {ev.familyName}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Date-unclear events at the bottom */}
            {unclearEvents.length > 0 && (
              <div className="relative mb-4">
                <div className="absolute -left-10 top-1 w-4 h-4 rounded-full bg-gray-300 border-2 border-white shadow" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date unclear</p>
                <div className="mt-2 space-y-2">
                  {unclearEvents.map(ev => (
                    <div key={ev.id} className="bg-white rounded-xl p-3 shadow-sm border-l-4 border-gray-300">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{ev.icon}</span>
                        <span className="font-semibold text-sm">{ev.title}</span>
                      </div>
                      <p className="text-xs text-gray-500">{ev.rawText}</p>
                      <p className="text-xs text-amber-600 mt-1">Date could not be determined</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
