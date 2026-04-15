'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/ui/PageShell'
import PageHeader from '@/components/ui/PageHeader'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'

const COUNT_OPTIONS = [10, 15, 25] as const

export default function GenerateClient({
  tripId,
  defaultCount,
}: {
  tripId: string
  defaultCount: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number>(
    COUNT_OPTIONS.find(n => n === defaultCount) ?? 25
  )

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/trips/${tripId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: selected }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to generate cards. Please try again.')
      setLoading(false)
      return
    }
    // Fire-and-forget Gemini fallback for cards Places couldn't resolve. The
    // swipe page renders placeholders for cards without images and picks
    // them up via Realtime once Gemini finishes uploading to Storage.
    fetch(`/api/trips/${tripId}/backfill-images`, { method: 'POST' }).catch(() => {})
    setCount(data.count ?? 0)
    setLoading(false)
    router.refresh()
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
              Takes about a minute. Photos fill in after.
            </p>

            <div className="mt-6">
              <MonoLabel className="block mb-2">deck size</MonoLabel>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map(n => (
                  <PillButton
                    key={n}
                    onClick={() => setSelected(n)}
                    disabled={loading}
                    variant={selected === n ? 'active' : 'default'}
                    size="sm"
                  >
                    {n} cards
                  </PillButton>
                ))}
              </div>
            </div>

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
