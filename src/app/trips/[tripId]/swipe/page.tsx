'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SwipeDeck from '@/components/SwipeDeck'
import AddCardModal from '@/components/AddCardModal'
import type { Card } from '@/types'

export default function SwipePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)

  const loadCards = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: allCards } = await supabase
      .from('cards')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at')

    const { data: swipes } = await supabase
      .from('swipes')
      .select('card_id')
      .eq('user_id', user.id)

    const swipedCardIds = new Set(swipes?.map(s => s.card_id) ?? [])
    const unswiped = (allCards ?? []).filter(c => !swipedCardIds.has(c.id))
    setCards(unswiped)
    setLoading(false)
  }, [tripId, supabase])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  async function handleSwipe(cardId: string, preference: 'want' | 'pass' | 'indifferent') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('swipes')
      .upsert({ card_id: cardId, user_id: user.id, preference })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading cards...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-sm mx-auto">
        <button onClick={() => router.push(`/trips/${tripId}`)}
          className="text-sm text-blue-600 mb-4 block">&larr; Back to trip</button>

        <SwipeDeck cards={cards} onSwipe={handleSwipe} />
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
