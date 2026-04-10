'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TripContext } from '@/types'

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  constraint: '⚠️',
  note: '📝',
}

export default function TripContextSection({ tripId }: { tripId: string }) {
  const supabase = createClient()
  const [contexts, setContexts] = useState<TripContext[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Fetch existing context
    supabase
      .from('trip_context')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: any }) => { if (data) setContexts(data) })

    // Subscribe to new context
    const channel = supabase
      .channel(`trip-context-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_context',
        filter: `trip_id=eq.${tripId}`,
      }, (payload: any) => {
        setContexts(prev => [...prev, payload.new as TripContext])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/trips/${tripId}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    })

    if (res.ok) {
      setInput('')
    } else {
      setError('Failed to add context. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="font-semibold text-lg">Add Booking Details</h2>
        <span className="text-gray-400 text-sm">
          {expanded ? '▲' : '▼'} {contexts.length > 0 && `${contexts.length}`}
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          {/* Context list */}
          <div className="space-y-2 mb-4">
            {contexts.map(ctx => (
              <div key={ctx.id} className="flex items-start gap-2 text-sm">
                <span>{TYPE_ICONS[ctx.type] ?? '📋'}</span>
                <div>
                  <p className="text-gray-800">{ctx.raw_text}</p>
                  <p className="text-xs text-gray-400 capitalize">{ctx.source}</p>
                </div>
              </div>
            ))}
            {contexts.length === 0 && (
              <p className="text-sm text-gray-400">No details added yet. Add flights, hotels, or any constraints.</p>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Flying Air Tahiti, arrive July 5 at 2pm"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              Add
            </button>
          </form>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
