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

  function getOverlayColorDefault() {
    if (dragOffset.x > 50) return 'rgba(34, 197, 94, 0.3)'
    if (dragOffset.x < -50) return 'rgba(239, 68, 68, 0.3)'
    if (dragOffset.y < -50) return 'rgba(59, 130, 246, 0.3)'
    return 'transparent'
  }

  function getOverlayColorEditorial() {
    if (dragOffset.x > 50) return 'rgba(143, 161, 136, 0.4)' // --consensus-loved
    if (dragOffset.x < -50) return 'rgba(176, 120, 120, 0.4)' // --consensus-pass
    if (dragOffset.y < -50) return 'rgba(184, 158, 114, 0.4)' // --consensus-mixed
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
  const dragTransform = `translateX(${dragOffset.x}px) translateY(${Math.min(dragOffset.y, 0)}px) rotate(${rotation}deg)`
  const dragTransition = isDragging ? 'none' : 'transform 0.3s ease'

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="relative" style={{ aspectRatio: '3 / 4' }}>
        {cards.length > 1 && (
          <div className="absolute inset-0" style={{ transform: 'scale(0.95)', opacity: 0.5 }}>
            <FlipCard card={cards[1]} destination={destination} />
          </div>
        )}

        <div
          className="absolute inset-0 touch-none"
          style={{ transform: dragTransform, transition: dragTransition }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
            style={{ backgroundColor: getOverlayColorEditorial() }}
          >
            {getSwipeLabel() && (
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '48px',
                  fontStyle: 'italic',
                  color: 'var(--cream)',
                  textShadow: '0 1px 2px rgba(51,61,41,0.5)',
                  letterSpacing: '0.04em',
                }}
              >
                {getSwipeLabel()?.toLowerCase()}
              </span>
            )}
          </div>

          <FlipCard card={currentCard} destination={destination} />
        </div>
      </div>

      <div className="flex justify-center gap-8 mt-8">
        <button
          onClick={() => swipe('pass')}
          className="flex flex-col items-center gap-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)' }}
        >
          <span
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '1px solid var(--stroke)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
            }}
          >
            ✕
          </span>
          <span className="label-mono">pass</span>
        </button>
        <button
          onClick={() => swipe('indifferent')}
          className="flex flex-col items-center gap-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)' }}
        >
          <span
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '1px solid var(--stroke)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
            }}
          >
            —
          </span>
          <span className="label-mono">meh</span>
        </button>
        <button
          onClick={() => swipe('want')}
          className="flex flex-col items-center gap-2"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stroke)' }}
        >
          <span
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '1px solid var(--stroke)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: '22px',
            }}
          >
            ♥
          </span>
          <span className="label-mono">want</span>
        </button>
      </div>
    </div>
  )
}
