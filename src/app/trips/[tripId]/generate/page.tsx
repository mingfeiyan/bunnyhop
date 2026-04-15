import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import GenerateClient from './GenerateClient'

// Default card count from trip duration. Shorter trips don't need 25
// recommendations; longer trips can absorb more. Unknown dates → 25.
function defaultCountFromDuration(dateStart: string | null, dateEnd: string | null): number {
  if (!dateStart || !dateEnd) return 25
  const start = new Date(dateStart)
  const end = new Date(dateEnd)
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  if (nights <= 3) return 10
  if (nights <= 6) return 15
  return 25
}

export default async function GeneratePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('id, date_start, date_end')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  const defaultCount = defaultCountFromDuration(trip.date_start, trip.date_end)

  return <GenerateClient tripId={tripId} defaultCount={defaultCount} />
}
