import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import OverviewGrid from '@/components/ui/OverviewGrid'
import DaySection from '@/components/ui/DaySection'
import EventCard from '@/components/ui/EventCard'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

type TripRow = {
  id: string
  title: string
  destination: string | null
  date_start: string | null
  date_end: string | null
  cover_image_url: string | null
  role: string
}

type Bucket = 'upcoming' | 'in_progress' | 'past' | 'undated'
function bucketForTrip(trip: TripRow): Bucket {
  // Trips with no dates yet land in their own bucket so they don't disappear.
  // Auto-fill from bookings will move them into a real bucket later.
  if (!trip.date_start || !trip.date_end) return 'undated'
  const today = new Date().toISOString().slice(0, 10)
  if (today < trip.date_start) return 'upcoming'
  if (today > trip.date_end) return 'past'
  return 'in_progress'
}

const BUCKET_LABEL: Record<Bucket, string> = {
  in_progress: 'In progress',
  upcoming: 'Upcoming',
  undated: 'No dates yet',
  past: 'Past',
}

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: participations } = await supabase
    .from('trip_participants')
    .select('trip_id, role, trips(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rawTrips: TripRow[] = (participations ?? []).map(p => ({
    ...(p.trips as unknown as Record<string, unknown>),
    role: p.role as string,
  })) as unknown as TripRow[]

  // Sort by date proximity to today (closest first):
  //  1. in-progress trips first (today is during the trip)
  //  2. upcoming trips next, soonest start date first
  //  3. undated trips next (no date info to sort on, alphabetical by title)
  //  4. past trips last, most-recently-ended first
  const BUCKET_ORDER: Record<Bucket, number> = { in_progress: 0, upcoming: 1, undated: 2, past: 3 }
  const trips: TripRow[] = [...rawTrips].sort((a, b) => {
    const ba = bucketForTrip(a)
    const bb = bucketForTrip(b)
    if (ba !== bb) return BUCKET_ORDER[ba] - BUCKET_ORDER[bb]
    if (ba === 'past') {
      // most recent past first → date_end descending. Both are guaranteed
      // non-null because the bucket logic puts null-dated trips in 'undated'.
      return (b.date_end ?? '').localeCompare(a.date_end ?? '')
    }
    if (ba === 'undated') {
      // No dates to sort by → fall back to title alphabetical
      return a.title.localeCompare(b.title)
    }
    // upcoming and in_progress → soonest start first → date_start ascending
    return (a.date_start ?? '').localeCompare(b.date_start ?? '')
  })

  // Group by status for the editorial tree (already sorted within each)
  const upcoming = trips.filter(t => bucketForTrip(t) === 'upcoming')
  const inProgress = trips.filter(t => bucketForTrip(t) === 'in_progress')
  const undated = trips.filter(t => bucketForTrip(t) === 'undated')
  const past = trips.filter(t => bucketForTrip(t) === 'past')

  return (
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
        <div className="min-h-screen bg-gray-50 p-4">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">My Trips</h1>
              <Link href="/trips/new"
                className="bg-blue-600 text-white font-medium rounded-lg px-4 py-2 hover:bg-blue-700 transition">
                New Trip
              </Link>
            </div>

            {trips.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No trips yet</p>
                <p>Create your first trip to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {trips.map((trip) => (
                  <Link key={trip.id} href={`/trips/${trip.id}`}
                    className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition">
                    <h2 className="font-semibold text-lg">{trip.title}</h2>
                    <p className="text-gray-500">{trip.destination ?? 'Destination not set'}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {trip.date_start && trip.date_end
                        ? `${new Date(trip.date_start).toLocaleDateString()} — ${new Date(trip.date_end).toLocaleDateString()}`
                        : 'Dates not set'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <PageShell>
          <PageHeader title="Your trips" />
          <div className="px-5 pb-3 flex justify-end">
            <PillButton href="/trips/new">+ new trip</PillButton>
          </div>
          {trips.length > 0 && (
            <OverviewGrid
              stats={[
                { label: 'total trips', value: String(trips.length).padStart(2, '0') },
                { label: 'upcoming', value: String(upcoming.length + inProgress.length).padStart(2, '0') },
              ]}
            />
          )}

          {trips.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <MonoLabel className="block mb-2">no trips yet</MonoLabel>
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '20px',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                Create your first trip to get started.
              </p>
              <div className="mt-5">
                <PillButton href="/trips/new">+ new trip</PillButton>
              </div>
            </div>
          ) : (
            <main className="pb-12">
              {(['in_progress', 'upcoming', 'undated', 'past'] as Bucket[]).map(bucket => {
                const list =
                  bucket === 'in_progress' ? inProgress
                  : bucket === 'upcoming' ? upcoming
                  : bucket === 'undated' ? undated
                  : past
                if (list.length === 0) return null

                const tripCards = list.map(trip => {
                  const time = trip.date_start
                    ? new Date(trip.date_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : ''
                  const dateStr = trip.date_start && trip.date_end
                    ? `${new Date(trip.date_start).toLocaleDateString()} — ${new Date(trip.date_end).toLocaleDateString()}`
                    : 'dates pending'
                  const details = trip.destination
                    ? `${trip.destination} · ${dateStr}`
                    : dateStr
                  return (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                    >
                      {trip.cover_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={trip.cover_image_url}
                          alt={trip.destination ?? trip.title}
                          loading="lazy"
                          style={{
                            width: '100%',
                            height: '160px',
                            objectFit: 'cover',
                            display: 'block',
                            borderBottom: '1px solid var(--stroke)',
                          }}
                        />
                      )}
                      <EventCard
                        time={time}
                        title={trip.title}
                        details={details}
                      />
                    </Link>
                  )
                })

                const tag = `${list.length} ${list.length === 1 ? 'trip' : 'trips'}`

                // Past trips fold behind a native <details>/<summary> element
                // so they don't clutter the main view. The summary mimics the
                // DaySection header (soft-tinted bg, serif title, mono tag)
                // and adds a "show" / "hide" affordance that swaps via CSS
                // based on the [open] state. No client component needed.
                if (bucket === 'past') {
                  return (
                    <details key={bucket} className="collapsible-section border-b border-stroke">
                      <summary
                        className="flex items-baseline justify-between px-5 py-3"
                        style={{ background: 'var(--stroke-soft)' }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-serif), Georgia, serif',
                            fontSize: '18px',
                            fontWeight: 700,
                          }}
                        >
                          {BUCKET_LABEL[bucket]}
                        </span>
                        <span className="label-mono">
                          {tag}
                          <span className="when-closed"> · show</span>
                          <span className="when-open"> · hide</span>
                        </span>
                      </summary>
                      <div>{tripCards}</div>
                    </details>
                  )
                }

                return (
                  <DaySection
                    key={bucket}
                    title={BUCKET_LABEL[bucket]}
                    tag={tag}
                  >
                    {tripCards}
                  </DaySection>
                )
              })}
            </main>
          )}
        </PageShell>
      </div>
    </>
  )
}
