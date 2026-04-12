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
  )
}
