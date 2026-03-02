'use client'

import type { SwipeResult } from '@/types'

const CONSENSUS_STYLES = {
  everyone_loves: { bg: 'bg-green-50', border: 'border-green-200', label: 'Everyone loves' },
  mixed: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Mixed feelings' },
  hard_pass: { bg: 'bg-red-50', border: 'border-red-200', label: 'Hard pass' },
}

const PREF_COLORS = {
  want: 'bg-green-400',
  pass: 'bg-red-400',
  indifferent: 'bg-gray-300',
}

export default function ResultsCard({ result }: { result: SwipeResult }) {
  const style = CONSENSUS_STYLES[result.consensus]

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{result.title}</h3>
          {result.tagline && (
            <p className="text-sm text-gray-500 italic">{result.tagline}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 capitalize">{result.category}</span>
      </div>

      <div className="flex gap-1.5 mt-3">
        {result.swipes.map(swipe => (
          <div
            key={swipe.user_id}
            className={`w-6 h-6 rounded-full ${PREF_COLORS[swipe.preference]} flex items-center justify-center text-xs text-white font-medium`}
            title={`${swipe.preference}`}
          >
            {swipe.preference === 'want' ? '\u2665' : swipe.preference === 'pass' ? '\u2715' : '\u2014'}
          </div>
        ))}
      </div>
    </div>
  )
}
