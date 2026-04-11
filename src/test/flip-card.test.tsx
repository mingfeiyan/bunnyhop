import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FlipCard from '@/components/FlipCard'

const mockCard = {
  id: '1',
  trip_id: 't1',
  title: 'Matiras Beach',
  tagline: 'The best beach you will ever see',
  description: 'A stunning stretch of white sand.',
  category: 'sightseeing' as const,
  source: 'ai_generated' as const,
  image_url: null,
  metadata: {
    price_range: 'Free',
    why_this: 'Perfect for families with kids.',
    duration: '2-3 hours',
    kid_friendly: true,
  },
  added_by: null,
  created_at: '2026-01-01',
}

describe('FlipCard', () => {
  // Note: FlipCard renders BOTH a default-tree and an editorial-tree
  // wrapper (gated by the .theme-editorial class on <html>). In JSDOM
  // both trees render to DOM, so text-content assertions need
  // getAllByText. Visibility is enforced by CSS at runtime.
  it('renders the card front with title and tagline', () => {
    render(<FlipCard card={mockCard} destination="Bora Bora" />)
    expect(screen.getAllByText('Matiras Beach').length).toBeGreaterThan(0)
    expect(screen.getAllByText('The best beach you will ever see').length).toBeGreaterThan(0)
  })

  it('shows the back with details after clicking', () => {
    render(<FlipCard card={mockCard} destination="Bora Bora" />)
    fireEvent.click(screen.getAllByText('Matiras Beach')[0])
    expect(screen.getAllByText(/Perfect for families/).length).toBeGreaterThan(0)
  })
})
