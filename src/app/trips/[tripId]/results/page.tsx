'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ResultsCard from '@/components/ResultsCard'
import type { Card, Swipe, SwipeResult } from '@/types'
import Link from 'next/link'

function computeResults(cards: Card[], swipes: Swipe[]): SwipeResult[] {
  const swipesByCard = new Map<string, Swipe[]>()
  swipes.forEach(s => {
    const existing = swipesByCard.get(s.card_id) ?? []
    existing.push(s)
    swipesByCard.set(s.card_id, existing)
  })

  return cards.map(card => {
    const cardSwipes = swipesByCard.get(card.id) ?? []
    const score = cardSwipes.reduce((sum, s) => {
      if (s.preference === 'want') return sum + 1
      if (s.preference === 'pass') return sum - 1
      return sum
    }, 0)

    const hasPasses = cardSwipes.some(s => s.preference === 'pass')
    const allWant = cardSwipes.length > 0 && cardSwipes.every(s => s.preference === 'want')

    let consensus: 'everyone_loves' | 'mixed' | 'hard_pass'
    if (allWant) consensus = 'everyone_loves'
    else if (hasPasses) consensus = 'hard_pass'
    else consensus = 'mixed'

    return { ...card, swipes: cardSwipes, score, consensus }
  }).sort((a, b) => b.score - a.score)
}

type FilterCategory = 'all' | 'restaurant' | 'activity' | 'sightseeing'

export default function ResultsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const supabase = createClient()
  const [results, setResults] = useState<SwipeResult[]>([])
  const [filter, setFilter] = useState<FilterCategory>('all')

  useEffect(() => {
    async function load() {
      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .eq('trip_id', tripId)

      const cardIds = cards?.map(c => c.id) ?? []

      let swipes: Swipe[] = []
      if (cardIds.length > 0) {
        const { data } = await supabase
          .from('swipes')
          .select('*')
          .in('card_id', cardIds)
        swipes = data ?? []
      }

      setResults(computeResults(cards ?? [], swipes))
    }

    load()

    const channel = supabase
      .channel(`results-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'swipes',
      }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, supabase])

  const filtered = filter === 'all' ? results : results.filter(r => r.category === filter)

  const everyoneLoves = filtered.filter(r => r.consensus === 'everyone_loves')
  const mixed = filtered.filter(r => r.consensus === 'mixed')
  const hardPass = filtered.filter(r => r.consensus === 'hard_pass')

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Link href={`/trips/${tripId}`} className="text-sm text-blue-600">&larr; Back to trip</Link>

        <h1 className="text-2xl font-bold">Group Results</h1>

        <div className="flex gap-2">
          {(['all', 'restaurant', 'activity', 'sightseeing'] as FilterCategory[]).map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition ${
                filter === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {everyoneLoves.length > 0 && (
          <section>
            <h2 className="font-semibold text-green-700 mb-2">Everyone Loves ({everyoneLoves.length})</h2>
            <div className="space-y-2">
              {everyoneLoves.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {mixed.length > 0 && (
          <section>
            <h2 className="font-semibold text-yellow-700 mb-2">Mixed Feelings ({mixed.length})</h2>
            <div className="space-y-2">
              {mixed.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {hardPass.length > 0 && (
          <section>
            <h2 className="font-semibold text-red-700 mb-2">Hard Pass ({hardPass.length})</h2>
            <div className="space-y-2">
              {hardPass.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <p className="text-gray-400 text-center py-8">No results yet. Start swiping!</p>
        )}
      </div>
    </div>
  )
}
