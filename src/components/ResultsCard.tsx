'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { SwipeResult, Swipe } from '@/types'

const CONSENSUS_STYLES = {
  everyone_loves: { bg: 'bg-green-50', border: 'border-green-200', label: 'Everyone loves' },
  mixed: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Mixed feelings' },
  hard_pass: { bg: 'bg-red-50', border: 'border-red-200', label: 'Hard pass' },
}

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

const PREF_LABELS: Record<Swipe['preference'], string> = {
  want: 'Want',
  pass: 'Pass',
  indifferent: 'Meh',
}

type Props = {
  result: SwipeResult
  userMap: Record<string, string>
  currentUserId: string | null
}

export default function ResultsCard({ result, userMap, currentUserId }: Props) {
  const supabase = createClient()
  const style = CONSENSUS_STYLES[result.consensus]

  // Track the current user's vote in local state so we can optimistically update
  const initialMyVote = result.swipes.find(s => s.user_id === currentUserId)?.preference ?? null
  const [myVote, setMyVote] = useState<Swipe['preference'] | null>(initialMyVote)
  const [error, setError] = useState<string | null>(null)

  async function changeVote(preference: Swipe['preference']) {
    if (!currentUserId) return
    const previous = myVote
    setError(null)
    setMyVote(preference) // optimistic

    const { error: upsertError } = await supabase
      .from('swipes')
      .upsert({
        card_id: result.id,
        user_id: currentUserId,
        preference,
      }, { onConflict: 'card_id,user_id' })

    if (upsertError) {
      setMyVote(previous)
      setError(upsertError.message)
    }
  }

  // Build the voter list: prefer local myVote for the current user so the UI
  // reflects optimistic updates before realtime catches up.
  const voters = result.swipes.map(s => {
    if (s.user_id === currentUserId && myVote !== null) {
      return { ...s, preference: myVote }
    }
    return s
  })
  // If the current user doesn't have a swipe in the array yet but has voted
  // optimistically, synthesize one for display.
  const hasMyVoteInList = voters.some(v => v.user_id === currentUserId)
  if (!hasMyVoteInList && currentUserId && myVote !== null) {
    voters.push({
      id: 'optimistic',
      card_id: result.id,
      user_id: currentUserId,
      preference: myVote,
      created_at: new Date().toISOString(),
    })
  }

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{result.title}</h3>
          {result.tagline && (
            <p className="text-sm text-gray-500 italic">{result.tagline}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 capitalize shrink-0 ml-2">{result.category}</span>
      </div>

      {/* Voter list */}
      <div className="space-y-1 mb-3">
        {voters.map(swipe => {
          const isMe = swipe.user_id === currentUserId
          const displayName = userMap[swipe.user_id] ?? swipe.user_id.slice(0, 8)
          return (
            <div
              key={swipe.user_id}
              className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                isMe ? 'bg-white/70 ring-1 ring-blue-200' : ''
              }`}
            >
              <span className="text-gray-700">
                {displayName}{isMe && ' (you)'}
              </span>
              <span
                className={`w-6 h-6 rounded-full ${PREF_COLORS[swipe.preference]} flex items-center justify-center text-xs font-medium`}
                title={swipe.preference}
              >
                {PREF_ICONS[swipe.preference]}
              </span>
            </div>
          )
        })}
        {voters.length === 0 && (
          <p className="text-xs text-gray-400 italic">No votes yet</p>
        )}
      </div>

      {/* Current user's re-vote controls */}
      {currentUserId && myVote !== null && (
        <div className="flex gap-2 border-t border-white/50 pt-3">
          {(['want', 'indifferent', 'pass'] as Swipe['preference'][]).map(pref => {
            const active = myVote === pref
            return (
              <button
                key={pref}
                onClick={() => changeVote(pref)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-full transition ${
                  active
                    ? `${PREF_COLORS[pref]} ring-2 ring-offset-1 ring-gray-400`
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {PREF_ICONS[pref]} {PREF_LABELS[pref]}
              </button>
            )
          })}
        </div>
      )}

      {/* Prompt to vote if user hasn't */}
      {currentUserId && myVote === null && (
        <div className="border-t border-white/50 pt-3">
          <Link
            href={`/trips/${result.trip_id}/swipe`}
            className="text-xs text-blue-600 hover:underline"
          >
            Vote from swipe page →
          </Link>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
