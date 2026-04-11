import { describe, it, expect } from 'vitest'
import { cityFromAddress } from '@/lib/trip-autofill'

describe('cityFromAddress', () => {
  it('extracts the city from a 3-part US address (street, city, state-zip)', () => {
    expect(cityFromAddress('1 Ritz Carlton Drive, Kapalua, HI 96761')).toBe('Kapalua')
  })

  it('extracts the city from a 4-part address (street, neighborhood, city, state-zip)', () => {
    expect(cityFromAddress('123 Ocean View Blvd, Wailea, Maui, HI 96753')).toBe('Maui')
  })

  it('handles a 2-part address (city, state)', () => {
    expect(cityFromAddress('Honolulu, HI')).toBe('Honolulu')
  })

  it('returns the input unchanged when there are no commas', () => {
    expect(cityFromAddress('Disneyland')).toBe('Disneyland')
  })

  it('returns the input unchanged for an empty string', () => {
    expect(cityFromAddress('')).toBe('')
  })

  it('trims whitespace around comma-separated chunks', () => {
    expect(cityFromAddress('  1234 Main St ,  Aspen ,  CO  81611 ')).toBe('Aspen')
  })

  it('handles trailing commas gracefully', () => {
    expect(cityFromAddress('500 Lake Shore Dr, Chicago, IL 60611,')).toBe('Chicago')
  })
})
