import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: participations } = await supabase
    .from('trip_participants')
    .select('trip_id, role, trips(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const trips = participations?.map(p => ({ ...p.trips as Record<string, unknown>, role: p.role })) ?? []

  return (
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
            {trips.map((trip: any) => (
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
  )
}
