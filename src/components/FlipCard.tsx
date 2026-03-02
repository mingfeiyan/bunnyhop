'use client'

import { useState } from 'react'
import type { Card } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-500',
  activity: 'bg-blue-500',
  sightseeing: 'bg-green-500',
}

export default function FlipCard({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="w-full aspect-[3/4] cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0 bg-gray-200">
            {card.image_url && (
              <img src={card.image_url} alt={card.title} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className={`absolute top-4 right-4 ${CATEGORY_COLORS[card.category]} text-white text-xs font-medium px-2.5 py-1 rounded-full capitalize`}>
            {card.category}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-white text-2xl font-bold mb-1">{card.title}</h2>
            {card.tagline && (
              <p className="text-white/80 text-sm italic">{card.tagline}</p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {card.metadata.price_range && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">{card.metadata.price_range}</span>
              )}
              {card.metadata.duration && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">{card.metadata.duration}</span>
              )}
              {card.metadata.kid_friendly && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">Kid-friendly</span>
              )}
            </div>
          </div>
          <div className="absolute top-4 left-4 bg-white/20 text-white text-xs px-2 py-1 rounded-full">
            Tap for details
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg bg-white p-6 flex flex-col"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className={`${CATEGORY_COLORS[card.category]} text-white text-xs font-medium px-2.5 py-1 rounded-full capitalize self-start mb-3`}>
            {card.category}
          </div>
          <h2 className="text-xl font-bold mb-3">{card.title}</h2>
          {card.metadata.why_this && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-1">Why this?</h3>
              <p className="text-sm text-gray-700">{card.metadata.why_this}</p>
            </div>
          )}
          {card.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
          )}
          <div className="mt-auto space-y-2 text-sm text-gray-600">
            {card.metadata.address && <p>📍 {card.metadata.address}</p>}
            {card.metadata.hours && <p>🕐 {card.metadata.hours}</p>}
            {card.metadata.booking_required && <p>📋 Booking required</p>}
            {card.metadata.duration && <p>⏱️ {card.metadata.duration}</p>}
          </div>
          {card.metadata.review_snippets && card.metadata.review_snippets.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">What people say</h3>
              {card.metadata.review_snippets.map((review, i) => (
                <p key={i} className="text-xs text-gray-500 italic mb-1">"{review}"</p>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">Tap to flip back</p>
        </div>
      </div>
    </div>
  )
}
