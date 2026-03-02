'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function GeneratePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/trips/${tripId}/generate`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to generate cards. Please try again.')
      setLoading(false)
      return
    }
    setCount(data.count ?? 0)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        {count === null ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Generate Recommendations</h1>
            <p className="text-gray-500 mb-6 text-sm">
              AI will create personalized cards based on your destination and trip details.
            </p>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button onClick={handleGenerate} disabled={loading}
              className="w-full bg-green-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-green-700 disabled:opacity-50 transition">
              {loading ? 'Generating...' : 'Generate Cards'}
            </button>
          </>
        ) : (
          <>
            <p className="text-4xl mb-4">{'\uD83C\uDF89'}</p>
            <h1 className="text-2xl font-bold mb-2">{count} Cards Ready!</h1>
            <p className="text-gray-500 mb-6 text-sm">Your personalized deck is ready to swipe.</p>
            <button onClick={() => router.push(`/trips/${tripId}/swipe`)}
              className="w-full bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 transition">
              Start Swiping
            </button>
          </>
        )}
      </div>
    </div>
  )
}
