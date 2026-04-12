'use client'

import { useState } from 'react'
import { getReviewUrl } from '@/lib/review-url'
import PillButton from '@/components/ui/PillButton'
import MonoLabel from '@/components/ui/MonoLabel'
import type { Card } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-500',
  activity: 'bg-blue-500',
  sightseeing: 'bg-green-500',
}

type Props = {
  card: Card
  destination: string
}

export default function FlipCard({ card, destination }: Props) {
  const [flipped, setFlipped] = useState(false)
  const reviewUrl = getReviewUrl(card, destination)
  const rating = card.metadata.rating
  const ratingCount = card.metadata.rating_count

  return (
    <div
      className="w-full cursor-pointer"
      style={{ perspective: '1000px', aspectRatio: '3 / 4' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.5s',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            border: '1px solid var(--stroke)',
            background: 'var(--cream)',
          }}
        >
          <div className="absolute inset-0" style={{ background: 'var(--stroke-soft)' }}>
            {card.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image_url}
                alt={card.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(51,61,41,0.85) 0%, rgba(51,61,41,0.15) 50%, transparent 100%)' }}
          />

          {/* Top strip: category kicker (left), tap hint (right) */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3"
          >
            <span
              className="label-mono"
              style={{
                color: 'var(--cream)',
                background: 'rgba(51,61,41,0.5)',
                padding: '4px 10px',
                border: '1px solid rgba(240,240,236,0.4)',
              }}
            >
              {card.category}
            </span>
            <span
              className="label-mono"
              style={{ color: 'var(--cream)', opacity: 0.7 }}
            >
              tap for details
            </span>
          </div>

          {/* Bottom info: title, tagline, mono chips */}
          <div className="absolute bottom-0 left-0 right-0 px-5 py-5">
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '26px',
                fontWeight: 400,
                color: 'var(--cream)',
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
              }}
            >
              {card.title}
            </h2>
            {card.tagline && (
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'rgba(240,240,236,0.85)',
                  margin: '4px 0 0 0',
                }}
              >
                {card.tagline}
              </p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {card.metadata.price_range && (
                <span
                  className="label-mono"
                  style={{
                    color: 'var(--cream)',
                    padding: '3px 8px',
                    border: '1px solid rgba(240,240,236,0.5)',
                  }}
                >
                  {card.metadata.price_range as string}
                </span>
              )}
              {card.metadata.duration && (
                <span
                  className="label-mono"
                  style={{
                    color: 'var(--cream)',
                    padding: '3px 8px',
                    border: '1px solid rgba(240,240,236,0.5)',
                  }}
                >
                  {card.metadata.duration as string}
                </span>
              )}
              {card.metadata.kid_friendly && (
                <span
                  className="label-mono"
                  style={{
                    color: 'var(--cream)',
                    padding: '3px 8px',
                    border: '1px solid rgba(240,240,236,0.5)',
                  }}
                >
                  kid-friendly
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 overflow-hidden flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            border: '1px solid var(--stroke)',
            background: 'var(--cream)',
            padding: '20px',
          }}
        >
          <MonoLabel className="mb-2">{card.category}</MonoLabel>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '24px',
              fontWeight: 400,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
            }}
          >
            {card.title}
          </h2>

          {typeof rating === 'number' && (
            <p
              className="detail-mono"
              style={{ marginTop: '6px' }}
            >
              ★ {rating.toFixed(1)}
              {typeof ratingCount === 'number' && ` · ${ratingCount.toLocaleString()} reviews`}
            </p>
          )}

          {card.tagline && (
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                fontStyle: 'italic',
                margin: '8px 0 0 0',
                opacity: 0.8,
              }}
            >
              {card.tagline}
            </p>
          )}

          {card.metadata.why_this ? (
            <div className="mt-4">
              <MonoLabel className="block mb-1">why this</MonoLabel>
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '14px',
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {card.metadata.why_this as string}
              </p>
            </div>
          ) : null}

          {card.description && (
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '13px',
                lineHeight: 1.4,
                margin: '12px 0 0 0',
                opacity: 0.85,
              }}
            >
              {card.description}
            </p>
          )}

          <div className="mt-auto detail-mono space-y-1">
            {card.metadata.address ? <p style={{ margin: 0 }}>📍 {card.metadata.address as string}</p> : null}
            {card.metadata.hours ? <p style={{ margin: 0 }}>🕐 {card.metadata.hours as string}</p> : null}
            {card.metadata.booking_required ? <p style={{ margin: 0 }}>📋 booking required</p> : null}
            {card.metadata.duration ? <p style={{ margin: 0 }}>⏱️ {card.metadata.duration as string}</p> : null}
          </div>

          {card.metadata.google_place_id && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <PillButton href={reviewUrl} external>
                view on maps →
              </PillButton>
            </div>
          )}

          <p className="label-mono mt-3 text-center" style={{ opacity: 0.5 }}>
            tap to flip back
          </p>
        </div>
      </div>
    </div>
  )
}
