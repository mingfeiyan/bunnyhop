'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Wraps timeline page content and triggers a router refresh whenever
// timeline_events changes (insert, update, delete) for the given trip.
// This gives us cross-tab live updates without duplicating the rendering
// logic into a client component.
export default function TimelineRealtimeWrapper({
  tripId,
  children,
}: {
  tripId: string
  children: React.ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`timeline-events-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timeline_events',
        filter: `trip_id=eq.${tripId}`,
      }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, router])

  return <>{children}</>
}
