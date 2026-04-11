import { describe, it, expect } from 'vitest'
import { cityFromAddress } from '@/lib/trip-autofill'

describe('cityFromAddress', () => {
  describe('3-part US addresses (street, city, state+zip)', () => {
    it('extracts the city from a standard 3-part US address', () => {
      expect(cityFromAddress('1 Ritz Carlton Drive, Kapalua, HI 96761')).toBe('Kapalua')
    })

    it('handles trailing commas gracefully', () => {
      expect(cityFromAddress('500 Lake Shore Dr, Chicago, IL 60611,')).toBe('Chicago')
    })

    it('trims whitespace around comma-separated chunks', () => {
      expect(cityFromAddress('  1234 Main St ,  Aspen ,  CO  81611 ')).toBe('Aspen')
    })

    it('handles 9-digit zip codes (zip+4)', () => {
      expect(cityFromAddress('1 Pine Way, Denver, CO 80202-1234')).toBe('Denver')
    })
  })

  describe('4-part addresses', () => {
    it('strips a trailing USA before extracting the city', () => {
      expect(cityFromAddress('383 Kalaimoku Street, Waikiki Beach, HI, USA')).toBe('Waikiki Beach')
    })

    it('strips a trailing Canada before extracting the city', () => {
      expect(cityFromAddress('123 Main St, Vancouver, BC, Canada')).toBe('Vancouver')
    })

    it('handles 4-part with neighborhood + city + state + zip (no country)', () => {
      expect(cityFromAddress('123 Ocean View Blvd, Wailea, Maui, HI 96753')).toBe('Maui')
    })
  })

  describe('3-part international addresses', () => {
    it('strips French Polynesia + postal code and returns the city', () => {
      expect(cityFromAddress('Pointe Tata A, Faaa, French Polynesia 98702')).toBe('Faaa')
    })

    it('handles a second French Polynesia variant', () => {
      expect(cityFromAddress('Auae Faaa, Faaa, French Polynesia 98713')).toBe('Faaa')
    })

    it('handles UK addresses', () => {
      expect(cityFromAddress('10 Downing St, London, UK')).toBe('London')
    })

    it('handles Japanese addresses', () => {
      expect(cityFromAddress('1-1-2 Oshiage, Tokyo, Japan')).toBe('Tokyo')
    })
  })

  describe('2-part addresses', () => {
    it('returns the first chunk for "city, state"', () => {
      expect(cityFromAddress('Honolulu, HI')).toBe('Honolulu')
    })

    it('returns the first chunk for "city, state zip"', () => {
      expect(cityFromAddress('Honolulu, HI 96815')).toBe('Honolulu')
    })

    it('strips a country and returns the remaining city', () => {
      expect(cityFromAddress('Bora Bora, French Polynesia')).toBe('Bora Bora')
    })

    it('strips Japan and returns the remaining city', () => {
      expect(cityFromAddress('Tokyo, Japan')).toBe('Tokyo')
    })

    it('extracts the city from "street, city STATE zip" merged form', () => {
      expect(cityFromAddress('3900 Wailea Alanui Drive, Kihei HI 96753')).toBe('Kihei')
    })

    it('extracts a multi-word city from a merged final chunk', () => {
      expect(cityFromAddress('100 Temple Square, Salt Lake City UT 84111')).toBe('Salt Lake City')
    })

    it('returns the second chunk when neither part is a state (post-strip case)', () => {
      // This is the shape that results after stripping a country from a 3-part
      // intl address: "Pointe Tata A, Faaa" (the country was already removed).
      expect(cityFromAddress('Pointe Tata A, Faaa')).toBe('Faaa')
    })
  })

  describe('edge cases', () => {
    it('returns the input unchanged when there are no commas', () => {
      expect(cityFromAddress('Disneyland')).toBe('Disneyland')
    })

    it('returns the input unchanged for an empty string', () => {
      expect(cityFromAddress('')).toBe('')
    })

    it('extracts the city from a single merged "City STATE zip" chunk', () => {
      expect(cityFromAddress('Aspen CO 81611')).toBe('Aspen')
    })
  })

  describe('regression: addresses currently in the database', () => {
    it('Disney Cruise port address', () => {
      expect(cityFromAddress('Port Everglades, Fort Lauderdale, FL')).toBe('Fort Lauderdale')
    })

    it('Hawaii Ritz-Carlton', () => {
      expect(cityFromAddress('383 Kalaimoku Street, Waikiki Beach, HI, USA')).toBe('Waikiki Beach')
    })

    it('Hawaii Four Seasons (merged city/state in 2-part form)', () => {
      expect(cityFromAddress('3900 Wailea Alanui Drive, Kihei HI 96753')).toBe('Kihei')
    })

    it('Bora Bora InterContinental', () => {
      expect(cityFromAddress('Pointe Tata A, Faaa, French Polynesia 98702')).toBe('Faaa')
    })

    it('Bora Bora Hilton', () => {
      expect(cityFromAddress('Auae Faaa, Faaa, French Polynesia 98713')).toBe('Faaa')
    })
  })
})
