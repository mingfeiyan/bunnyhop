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
  destination: string
  date_start: string
  date_end: string
  role: string
}

type Bucket = 'upcoming' | 'in_progress' | 'past'
function bucketForTrip(trip: TripRow): Bucket {
  const today = new Date().toISOString().slice(0, 10)
  if (today < trip.date_start) return 'upcoming'
  if (today > trip.date_end) return 'past'
  return 'in_progress'
}

const BUCKET_LABEL: Record<Bucket, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
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

  const trips: TripRow[] = (participations ?? []).map(p => ({
    ...(p.trips as unknown as Record<string, unknown>),
    role: p.role as string,
  })) as unknown as TripRow[]

  // Group by status for the editorial tree
  const upcoming = trips.filter(t => bucketForTrip(t) === 'upcoming')
  const inProgress = trips.filter(t => bucketForTrip(t) === 'in_progress')
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
                    <p className="text-gray-500">{trip.destination}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {new Date(trip.date_start).toLocaleDateString()} — {new Date(trip.date_end).toLocaleDateString()}
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
              {(['in_progress', 'upcoming', 'past'] as Bucket[]).map(bucket => {
                const list = bucket === 'in_progress' ? inProgress : bucket === 'upcoming' ? upcoming : past
                if (list.length === 0) return null
                return (
                  <DaySection
                    key={bucket}
                    title={BUCKET_LABEL[bucket]}
                    tag={`${list.length} ${list.length === 1 ? 'trip' : 'trips'}`}
                  >
                    {list.map(trip => (
                      <Link
                        key={trip.id}
                        href={`/trips/${trip.id}`}
                        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                      >
                        <EventCard
                          time={new Date(trip.date_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          title={trip.title}
                          details={`${trip.destination} · ${new Date(trip.date_start).toLocaleDateString()} — ${new Date(trip.date_end).toLocaleDateString()}`}
                        />
                      </Link>
                    ))}
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
