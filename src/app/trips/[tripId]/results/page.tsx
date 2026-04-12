'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ResultsCard from '@/components/ResultsCard'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import OverviewGrid from '@/components/ui/OverviewGrid'
import DaySection from '@/components/ui/DaySection'
import PillButton from '@/components/ui/PillButton'
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

// Derive a short display name from an email (portion before @)
function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) return 'Unknown'
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

export default function ResultsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const supabase = createClient()
  const [results, setResults] = useState<SwipeResult[]>([])
  const [filter, setFilter] = useState<FilterCategory>('all')
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const cardIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      // Fetch current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      // Fetch trip destination for the editorial header
      const { data: trip } = await supabase
        .from('trips')
        .select('destination')
        .eq('id', tripId)
        .single()
      setDestination((trip?.destination as string) ?? '')

      // Fetch participant display info via existing RPC (from migration 006)
      const { data: participants } = await supabase
        .rpc('get_trip_participants_with_email', { p_trip_id: tripId })
      const map: Record<string, string> = {}
      for (const p of (participants ?? []) as Array<{ user_id: string; email: string | null }>) {
        map[p.user_id] = displayNameFromEmail(p.email)
      }
      setUserMap(map)

      const { data: cards } = await supabase
        .from('cards')
        .select('*')
        .eq('trip_id', tripId)

      const cardIds = (cards ?? []).map((c: Card) => c.id)
      cardIdsRef.current = new Set(cardIds)

      let swipes: Swipe[] = []
      if (cardIds.length > 0) {
        const { data } = await supabase
          .from('swipes')
          .select('*')
          .in('card_id', cardIds)
        swipes = data ?? []
      }

      setResults(computeResults((cards ?? []) as Card[], swipes))
    }

    load()

    const channel = supabase
      .channel(`results-${tripId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'swipes',
      }, (payload: { new: { card_id?: string } | null; old: { card_id?: string } | null }) => {
        // Reload if this change touches any card in our trip (handles INSERT, UPDATE, DELETE)
        const cardId = payload.new?.card_id ?? payload.old?.card_id
        if (cardId && cardIdsRef.current.has(cardId)) {
          load()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  const filtered = filter === 'all' ? results : results.filter(r => r.category === filter)

  const everyoneLoves = filtered.filter(r => r.consensus === 'everyone_loves')
  const mixed = filtered.filter(r => r.consensus === 'mixed')
  const hardPass = filtered.filter(r => r.consensus === 'hard_pass')

  // Editorial-tree precomputed values
  const totalCards = results.length
  const consensusRate =
    totalCards > 0
      ? Math.round(((results.length - results.filter(r => r.consensus === 'mixed').length) / totalCards) * 100)
      : 0

  return (
    <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }}>
      <PageHeader kicker="group results" title={destination || 'Results'} />
      {totalCards > 0 && (
        <OverviewGrid
          stats={[
            { label: 'total cards', value: String(totalCards).padStart(2, '0') },
            { label: 'consensus', value: `${consensusRate}%` },
          ]}
        />
      )}

      {/* Filter row */}
      <div className="flex gap-2 px-5 py-4 flex-wrap">
        {(['all', 'restaurant', 'activity', 'sightseeing'] as FilterCategory[]).map(cat => (
          <PillButton
            key={cat}
            variant={filter === cat ? 'active' : 'default'}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </PillButton>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '18px',
              fontStyle: 'italic',
              opacity: 0.7,
            }}
          >
            No results yet.
          </p>
          <p className="detail-mono mt-2">Start swiping to see what the group thinks.</p>
        </div>
      ) : (
        <main className="pb-12">
          {everyoneLoves.length > 0 && (
            <DaySection title="Everyone loves" tag={`${everyoneLoves.length} cards`}>
              <div className="px-5 py-4">
                {everyoneLoves.map(r => (
                  <ResultsCard key={r.id} result={r} userMap={userMap} currentUserId={currentUserId} />
                ))}
              </div>
            </DaySection>
          )}

          {mixed.length > 0 && (
            <DaySection title="Mixed feelings" tag={`${mixed.length} cards`}>
              <div className="px-5 py-4">
                {mixed.map(r => (
                  <ResultsCard key={r.id} result={r} userMap={userMap} currentUserId={currentUserId} />
                ))}
              </div>
            </DaySection>
          )}

          {hardPass.length > 0 && (
            <DaySection title="Hard pass" tag={`${hardPass.length} cards`}>
              <div className="px-5 py-4">
                {hardPass.map(r => (
                  <ResultsCard key={r.id} result={r} userMap={userMap} currentUserId={currentUserId} />
                ))}
              </div>
            </DaySection>
          )}
        </main>
      )}
    </PageShell>
  )
}
