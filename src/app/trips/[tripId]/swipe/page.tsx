'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SwipeDeck from '@/components/SwipeDeck'
import SwipeReview from '@/components/SwipeReview'
import AddCardModal from '@/components/AddCardModal'
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading cards...</p>
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
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-sm mx-auto">
        <button onClick={() => router.push(`/trips/${tripId}`)}
          className="text-sm text-blue-600 mb-4 block">&larr; Back to trip</button>

        {/* Mode toggle — show only when the user has at least one vote and there are still cards to swipe */}
        {hasAnyVote && !allSwiped && (
          <div className="flex gap-2 mb-4 bg-white rounded-full p-1 shadow-sm">
            <button
              onClick={() => setMode('swipe')}
              className={`flex-1 text-xs font-medium py-2 rounded-full transition ${
                effectiveMode === 'swipe' ? 'bg-blue-600 text-white' : 'text-gray-600'
              }`}
            >
              Swipe ({unswipedCards.length} left)
            </button>
            <button
              onClick={() => setMode('review')}
              className={`flex-1 text-xs font-medium py-2 rounded-full transition ${
                effectiveMode === 'review' ? 'bg-blue-600 text-white' : 'text-gray-600'
              }`}
            >
              Review ({votedCount})
            </button>
          </div>
        )}

        {effectiveMode === 'swipe' && !allSwiped && (
          <SwipeDeck cards={unswipedCards} destination={destination} onSwipe={handleSwipe} />
        )}

        {effectiveMode === 'review' && currentUserId && (
          <div>
            {allSwiped && (
              <div className="text-center mb-4">
                <p className="text-2xl font-bold">All done! 🎉</p>
                <p className="text-sm text-gray-500">Review your votes below. Tap any card to change your mind.</p>
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

      <button onClick={() => setShowAddCard(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition">
        +
      </button>
      {showAddCard && (
        <AddCardModal
          tripId={tripId}
          onClose={() => setShowAddCard(false)}
          onAdded={() => { loadCards() }}
        />
      )}
    </div>
  )
}
