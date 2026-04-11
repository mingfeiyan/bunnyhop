'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import type { TripContext } from '@/types'

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  constraint: '⚠️',
  note: '📝',
}

type Props = {
  tripId: string
  currentUserId: string | null
  isOrganizer: boolean
}

export default function TripContextSection({ tripId, currentUserId, isOrganizer }: Props) {
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
      .then(({ data }: { data: TripContext[] | null }) => { if (data) setContexts(data) })

    // Subscribe to inserts and deletes
    const channel = supabase
      .channel(`trip-context-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trip_context',
        filter: `trip_id=eq.${tripId}`,
      }, (payload: { eventType: string; new: TripContext; old: { id: string } }) => {
        if (payload.eventType === 'INSERT') {
          setContexts(prev => [...prev, payload.new])
        } else if (payload.eventType === 'DELETE') {
          setContexts(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function deleteEntry(entryId: string) {
    setError(null)
    const { error: deleteError } = await supabase
      .from('trip_context')
      .delete()
      .eq('id', entryId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setContexts(prev => prev.filter(c => c.id !== entryId))
  }

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
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
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
                {contexts.map(ctx => {
                  const canDelete = isOrganizer || (currentUserId !== null && ctx.added_by === currentUserId)
                  return (
                    <div key={ctx.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span>{TYPE_ICONS[ctx.type] ?? '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 break-words">{ctx.raw_text}</p>
                          <p className="text-xs text-gray-400 capitalize">{ctx.source}</p>
                        </div>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => deleteEntry(ctx.id)}
                          className="text-xs text-red-400 hover:text-red-600 shrink-0"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )
                })}
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
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <section className="border-y border-stroke">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-left px-5 py-4"
            style={{ background: 'var(--stroke-soft)' }}
          >
            <div>
              <MonoLabel className="block mb-1">trip context</MonoLabel>
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                Notes & constraints
              </span>
            </div>
            <span className="label-mono">
              {contexts.length > 0 && `${String(contexts.length).padStart(2, '0')} · `}
              {expanded ? 'collapse' : 'expand'}
            </span>
          </button>

          {expanded && (
            <div className="px-5 py-4">
              {/* Context list */}
              {contexts.length === 0 ? (
                <p
                  className="detail-mono mb-4"
                  style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontStyle: 'italic', opacity: 0.7 }}
                >
                  No details added yet. Add flights, hotels, or any constraints.
                </p>
              ) : (
                <div className="mb-4">
                  {contexts.map(ctx => {
                    const canDelete = isOrganizer || (currentUserId !== null && ctx.added_by === currentUserId)
                    return (
                      <div
                        key={ctx.id}
                        className="flex items-start justify-between gap-3 py-3 border-b border-stroke last:border-b-0"
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span style={{ fontSize: '14px' }}>{TYPE_ICONS[ctx.type] ?? '📋'}</span>
                          <div className="flex-1 min-w-0">
                            <p
                              style={{
                                fontFamily: 'var(--font-serif)',
                                fontSize: '15px',
                                lineHeight: 1.4,
                                margin: 0,
                                wordBreak: 'break-word',
                              }}
                            >
                              {ctx.raw_text}
                            </p>
                            <MonoLabel className="mt-1">{ctx.source}</MonoLabel>
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => deleteEntry(ctx.id)}
                            className="label-mono shrink-0"
                            style={{ color: 'var(--stroke)', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            del
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSubmit}>
                <MonoLabel className="block mb-2">add a booking or constraint</MonoLabel>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. Flying Air Tahiti, arrive July 5 at 2pm"
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '15px',
                    border: 'none',
                    borderBottom: '1px solid var(--stroke)',
                    padding: '6px 0',
                    background: 'transparent',
                    color: 'var(--stroke)',
                    outline: 'none',
                  }}
                />
                <div className="mt-3">
                  <PillButton type="submit" disabled={loading}>
                    {loading ? 'adding…' : '+ add'}
                  </PillButton>
                </div>
              </form>
              {error && (
                <p className="detail-mono mt-3" style={{ color: 'var(--consensus-pass)' }}>
                  {error}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
