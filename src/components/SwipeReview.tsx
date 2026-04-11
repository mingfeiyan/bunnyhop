'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import FlipCard from './FlipCard'
import type { Card, Swipe } from '@/types'

const PREF_COLORS: Record<Swipe['preference'], string> = {
  want: 'bg-green-400 text-white',
  pass: 'bg-red-400 text-white',
  indifferent: 'bg-gray-300 text-white',
}

const PREF_ICONS: Record<Swipe['preference'], string> = {
  want: '\u2665',
  pass: '\u2715',
  indifferent: '\u2014',
}

// Display order for the three buttons
const PREF_ORDER: Swipe['preference'][] = ['want', 'indifferent', 'pass']
const PREF_BUTTON_LABEL: Record<Swipe['preference'], string> = {
  want: 'Want',
  indifferent: 'Meh',
  pass: 'Pass',
}

type Props = {
  cards: Card[]
  votes: Record<string, Swipe['preference']>
  currentUserId: string
  onVoteChange: (cardId: string, preference: Swipe['preference']) => void
}

export default function SwipeReview({ cards, votes, currentUserId, onVoteChange }: Props) {
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function changeVote(cardId: string, preference: Swipe['preference']) {
    const previous = votes[cardId]
    setError(null)
    onVoteChange(cardId, preference) // optimistic parent update

    const { error: upsertError } = await supabase
      .from('swipes')
      .upsert({
        card_id: cardId,
        user_id: currentUserId,
        preference,
      }, { onConflict: 'card_id,user_id' })

    if (upsertError) {
      // Roll back optimistic update by restoring previous
      if (previous) {
        onVoteChange(cardId, previous)
      }
      setError(upsertError.message)
    }
  }

  const votedCards = cards.filter(c => votes[c.id])
  const unvotedCards = cards.filter(c => !votes[c.id])

  if (votedCards.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>No votes yet. Start swiping to see your choices here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 text-center">
        {votedCards.length} of {cards.length} cards voted
        {unvotedCards.length > 0 && ` (${unvotedCards.length} left)`}
      </p>

      {votedCards.map(card => {
        const myVote = votes[card.id]
        const colors = PREF_COLORS[myVote]
        const isExpanded = expanded === card.id
        return (
          <div key={card.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{card.title}</h3>
                  {card.tagline && (
                    <p className="text-xs text-gray-500 italic truncate">{card.tagline}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{card.category}</p>
                </div>
                <span
                  className={`w-7 h-7 rounded-full ${colors} flex items-center justify-center text-sm font-medium shrink-0`}
                  title={myVote}
                >
                  {PREF_ICONS[myVote]}
                </span>
              </div>

              {/* Re-vote controls */}
              <div className="flex gap-2 mt-3">
                {PREF_ORDER.map(pref => {
                  const active = myVote === pref
                  return (
                    <button
                      key={pref}
                      onClick={() => changeVote(card.id, pref)}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-full transition ${
                        active
                          ? `${PREF_COLORS[pref]} ring-2 ring-offset-1 ring-gray-400`
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {PREF_ICONS[pref]} {PREF_BUTTON_LABEL[pref]}
                    </button>
                  )
                })}
              </div>

              {/* Expand for details */}
              <button
                onClick={() => setExpanded(isExpanded ? null : card.id)}
                className="text-xs text-blue-600 hover:underline mt-2"
              >
                {isExpanded ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 p-3 bg-gray-50">
                <FlipCard card={card} />
              </div>
            )}
          </div>
        )
      })}

      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  )
}
