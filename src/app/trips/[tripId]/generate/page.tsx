'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

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
    <>
      {/* === Default tree === */}
      <div className="theme-default-tree">
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
      </div>

      {/* === Editorial tree === */}
      <div className="theme-editorial-tree">
        <PageShell back={{ href: `/trips/${tripId}`, label: 'back to trip' }} maxWidth="sm">
          <PageHeader kicker="generate" title="Recommendations" />

          <div className="px-5 py-8">
            {count === null ? (
              <>
                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '17px',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  AI will craft a deck of personalized cards from your destination, dates, and any context you&apos;ve added.
                </p>
                <p className="detail-mono mt-2" style={{ opacity: 0.7 }}>
                  Takes about a minute. Photos and ratings populate after.
                </p>
                {error && (
                  <p
                    className="detail-mono mt-4"
                    style={{ color: 'var(--consensus-pass)' }}
                  >
                    {error}
                  </p>
                )}
                <div className="mt-6">
                  <PillButton onClick={handleGenerate} disabled={loading} size="md">
                    {loading ? 'generating…' : 'generate cards'}
                  </PillButton>
                </div>
              </>
            ) : (
              <>
                <MonoLabel className="block mb-2">ready</MonoLabel>
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '32px',
                    fontWeight: 400,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {count} cards waiting
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '15px',
                    fontStyle: 'italic',
                    opacity: 0.8,
                    marginTop: '8px',
                    marginBottom: '24px',
                  }}
                >
                  Your personalized deck is ready to swipe.
                </p>
                <PillButton href={`/trips/${tripId}/swipe`} size="md">
                  start swiping →
                </PillButton>
              </>
            )}
          </div>
        </PageShell>
      </div>
    </>
  )
}
