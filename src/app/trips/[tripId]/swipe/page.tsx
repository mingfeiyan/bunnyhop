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
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [mode, setMode] = useState<'swipe' | 'review'>('swipe')
  const [destination, setDestination] = useState('')
  const [plannedCardIds, setPlannedCardIds] = useState<Set<string>>(new Set())

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

    const { data: events } = await supabase
      .from('timeline_events')
      .select('card_id, status')
      .eq('trip_id', tripId)
      .not('card_id', 'is', null)
      .neq('status', 'skipped')

    const plannedIds = new Set<string>()
    for (const e of (events ?? []) as Array<{ card_id: string | null; status: string }>) {
      if (e.card_id) plannedIds.add(e.card_id)
    }

    setAllCards((fetchedCards ?? []) as Card[])
    setVotes(voteMap)
    setPlannedCardIds(plannedIds)
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

  // Live-update the "planned" badge when anyone commits/unschedules a card
  // from the timeline. Refetches via loadCards which keeps planned + cards +
  // votes in sync; loadCards is memoized so this effect is stable.
  useEffect(() => {
    if (!tripId) return
    const channel = supabase
      .channel(`swipe-planned-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timeline_events',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          loadCards()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tripId, loadCards, supabase])

  async function handleSwipe(cardId: string, preference: 'want' | 'pass' | 'indifferent') {
    if (!currentUserId) return
    setVotes(prev => ({ ...prev, [cardId]: preference }))
    await supabase
      .from('swipes')
      .upsert({ card_id: cardId, user_id: currentUserId, preference })
  }

  async function resetMyVotes() {
    if (!currentUserId) return
    setResetting(true)
    setResetError(null)
    const cardIds = allCards.map(c => c.id)
    if (cardIds.length === 0) {
      setShowResetConfirm(false)
      setResetting(false)
      return
    }
    const { error } = await supabase
      .from('swipes')
      .delete()
      .eq('user_id', currentUserId)
      .in('card_id', cardIds)
    if (error) {
      setResetError(error.message)
      setResetting(false)
      return
    }
    setVotes({})
    setMode('swipe')
    setShowResetConfirm(false)
    setResetting(false)
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
          <div className="flex gap-2 px-5 mb-4 flex-wrap">
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
            <PillButton onClick={() => setShowResetConfirm(true)}>
              reset my votes
            </PillButton>
          </div>
        )}
        {hasAnyVote && allSwiped && (
          <div className="flex gap-2 px-5 mb-4">
            <PillButton onClick={() => setShowResetConfirm(true)}>
              reset my votes
            </PillButton>
          </div>
        )}

        <div className="px-5 pb-24">
          {effectiveMode === 'swipe' && !allSwiped && (
            <SwipeDeck
              cards={unswipedCards}
              destination={destination}
              onSwipe={handleSwipe}
              plannedCardIds={plannedCardIds}
            />
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

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => !resetting && setShowResetConfirm(false)}
        >
          <div
            className="bg-white border border-stroke p-6 max-w-md w-[90%]"
            style={{ background: 'var(--cream)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <MonoLabel className="block mb-2">reset votes</MonoLabel>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Clear all {votedCount} of your votes on this trip and swipe from scratch?
            </p>
            <p className="detail-mono mt-2" style={{ opacity: 0.7 }}>
              Only your votes are cleared. Other members are unaffected.
            </p>
            {resetError && (
              <p className="detail-mono mt-3" style={{ color: 'var(--consensus-pass)' }}>
                {resetError}
              </p>
            )}
            <div className="flex gap-2 mt-5">
              <PillButton
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
              >
                cancel
              </PillButton>
              <PillButton
                variant="active"
                onClick={resetMyVotes}
                disabled={resetting}
              >
                {resetting ? 'resetting…' : 'reset'}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
