'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SwipeDeck from '@/components/SwipeDeck'
import SwipeReview from '@/components/SwipeReview'
import AddCardModal from '@/components/AddCardModal'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import type { Card, Swipe } from '@/types'

export default function SwipePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [allCards, setAllCards] = useState<Card[]>([])
  const [votes, setVotes] = useState<Record<string, Swipe['preference']>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [mode, setMode] = useState<'swipe' | 'review'>('swipe')
  const [destination, setDestination] = useState('')

  const loadCards = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: trip } = await supabase
      .from('trips')
      .select('destination')
      .eq('id', tripId)
      .single()
    setDestination((trip?.destination as string) ?? '')

    const { data: fetchedCards } = await supabase
      .from('cards')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')

    const { data: swipes } = await supabase
      .from('swipes')
      .select('card_id, preference')
      .eq('user_id', user.id)

    const voteMap: Record<string, Swipe['preference']> = {}
    for (const s of (swipes ?? []) as Array<{ card_id: string; preference: Swipe['preference'] }>) {
      voteMap[s.card_id] = s.preference
    }

    setAllCards((fetchedCards ?? []) as Card[])
    setVotes(voteMap)
    setLoading(false)
  }, [tripId, supabase])

  useEffect(() => {
    // loadCards bulk-updates several pieces of state on initial mount and on
    // refetch (after AddCardModal saves a new card). The cascading-renders
    // lint warning is overly conservative here — there's no way to avoid
    // multiple setX calls in a single load and we want them batched, which
    // React 19 already does for us.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCards()
  }, [loadCards])

  async function handleSwipe(cardId: string, preference: 'want' | 'pass' | 'indifferent') {
    if (!currentUserId) return
    setVotes(prev => ({ ...prev, [cardId]: preference }))
    await supabase
      .from('swipes')
      .upsert({ card_id: cardId, user_id: currentUserId, preference })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
        <p className="label-mono">loading cards…</p>
      </div>
    )
  }

  const unswipedCards = allCards.filter(c => !votes[c.id])
  const votedCount = Object.keys(votes).length
  const hasAnyVote = votedCount > 0
  const allSwiped = allCards.length > 0 && unswipedCards.length === 0

  // Auto-switch to review mode once everything is swiped (first entry into this state)
  // The user can still manually toggle back if we add more cards later.
  const effectiveMode: 'swipe' | 'review' = allSwiped ? 'review' : mode

  return (
    <>
      <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }} maxWidth="sm">
        <PageHeader kicker="swipe deck" title={destination} />

        {/* Mode toggle — only when there's at least one vote AND cards remain */}
        {hasAnyVote && !allSwiped && (
          <div className="flex gap-2 px-5 mb-4">
            <PillButton
              variant={effectiveMode === 'swipe' ? 'active' : 'default'}
              onClick={() => setMode('swipe')}
            >
              swipe · {unswipedCards.length} left
            </PillButton>
            <PillButton
              variant={effectiveMode === 'review' ? 'active' : 'default'}
              onClick={() => setMode('review')}
            >
              review · {votedCount}
            </PillButton>
          </div>
        )}

        <div className="px-5 pb-24">
          {effectiveMode === 'swipe' && !allSwiped && (
            <SwipeDeck cards={unswipedCards} destination={destination} onSwipe={handleSwipe} />
          )}

          {effectiveMode === 'review' && currentUserId && (
            <div>
              {allSwiped && (
                <div className="text-center my-6">
                  <MonoLabel className="block mb-2">all done</MonoLabel>
                  <p
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '28px',
                      fontWeight: 400,
                      margin: 0,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Every card swiped
                  </p>
                  <p
                    className="detail-mono mt-2"
                    style={{ opacity: 0.8 }}
                  >
                    Tap any card to change your mind.
                  </p>
                </div>
              )}
              <SwipeReview
                cards={allCards}
                votes={votes}
                currentUserId={currentUserId}
                destination={destination}
                onVoteChange={(cardId, preference) => {
                  setVotes(prev => ({ ...prev, [cardId]: preference }))
                }}
              />
            </div>
          )}
        </div>

        {/* Floating add button — hairline circle with serif "+" */}
        <button
          type="button"
          onClick={() => setShowAddCard(true)}
          aria-label="add card"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1px solid var(--stroke)',
            background: 'var(--cream)',
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            color: 'var(--stroke)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(51,61,41,0.12)',
            zIndex: 50,
          }}
        >
          +
        </button>
      </PageShell>

      {/* Modal renders its own dual-tree internally */}
      {showAddCard && (
        <AddCardModal
          tripId={tripId}
          onClose={() => setShowAddCard(false)}
          onAdded={() => { loadCards() }}
        />
      )}
    </>
  )
}
