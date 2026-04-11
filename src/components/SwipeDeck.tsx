'use client'

import { useState, useRef } from 'react'
import type { Card } from '@/types'
import FlipCard from './FlipCard'

type SwipeDirection = 'want' | 'pass' | 'indifferent'

type Props = {
  cards: Card[]
  destination: string
  onSwipe: (cardId: string, preference: SwipeDirection) => void
}

// SwipeDeck is purely controlled by its `cards` prop. It always shows
// `cards[0]` as the front card. After a swipe, the parent removes the swiped
// card from the array (via its `votes` filter) and `cards[0]` automatically
// becomes the next card. Keeping a `currentIndex` here would double-advance
// the deck (parent shrinks the array AND child advances the index → skip).
export default function SwipeDeck({ cards, destination, onSwipe }: Props) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })

  const currentCard = cards[0]

  function handlePointerDown(e: React.PointerEvent) {
    setIsDragging(true)
    startPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging) return
    setDragOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    })
  }

  function handlePointerUp() {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 100

    if (dragOffset.x > threshold) {
      swipe('want')
    } else if (dragOffset.x < -threshold) {
      swipe('pass')
    } else if (dragOffset.y < -threshold) {
      swipe('indifferent')
    } else {
      setDragOffset({ x: 0, y: 0 })
    }
  }

  function swipe(direction: SwipeDirection) {
    if (!currentCard) return
    onSwipe(currentCard.id, direction)
    setDragOffset({ x: 0, y: 0 })
  }

  function getOverlayColor() {
    if (dragOffset.x > 50) return 'rgba(34, 197, 94, 0.3)'
    if (dragOffset.x < -50) return 'rgba(239, 68, 68, 0.3)'
    if (dragOffset.y < -50) return 'rgba(59, 130, 246, 0.3)'
    return 'transparent'
  }

  function getSwipeLabel() {
    if (dragOffset.x > 50) return 'WANT'
    if (dragOffset.x < -50) return 'PASS'
    if (dragOffset.y < -50) return 'MEH'
    return null
  }

  // Defensive: parent should never render us with an empty deck (it switches
  // to review mode at swipe/page.tsx:113), but guard against a flash of nothing.
  if (!currentCard) return null

  const rotation = dragOffset.x * 0.1

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="relative aspect-[3/4]">
        {cards.length > 1 && (
          <div className="absolute inset-0 scale-95 opacity-50">
            <FlipCard card={cards[1]} destination={destination} />
          </div>
        )}

        <div
          className="absolute inset-0 touch-none"
          style={{
            transform: `translateX(${dragOffset.x}px) translateY(${Math.min(dragOffset.y, 0)}px) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute inset-0 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
            style={{ backgroundColor: getOverlayColor() }}
          >
            {getSwipeLabel() && (
              <span className="text-4xl font-black text-white drop-shadow-lg">
                {getSwipeLabel()}
              </span>
            )}
          </div>

          <FlipCard card={currentCard} destination={destination} />
        </div>
      </div>

      <div className="flex justify-center gap-6 mt-6">
        <button onClick={() => swipe('pass')}
          className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-2xl hover:bg-red-200 transition">
          ✕
        </button>
        <button onClick={() => swipe('indifferent')}
          className="w-14 h-14 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xl hover:bg-blue-200 transition">
          —
        </button>
        <button onClick={() => swipe('want')}
          className="w-14 h-14 rounded-full bg-green-100 text-green-500 flex items-center justify-center text-2xl hover:bg-green-200 transition">
          ♥
        </button>
      </div>
    </div>
  )
}
