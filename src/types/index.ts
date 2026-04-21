export type Trip = {
  id: string
  title: string
  destination: string | null
  date_start: string | null
  date_end: string | null
  created_by: string
  invite_code: string
  timezone: string | null
  cover_image_url: string | null
  created_at: string
}

export type TripParticipant = {
  id: string
  trip_id: string
  user_id: string
  role: 'organizer' | 'member'
  created_at: string
}

export type TripContext = {
  id: string
  trip_id: string
  type: 'flight' | 'hotel' | 'constraint' | 'note'
  raw_text: string
  details: Record<string, unknown>
  added_by: string
  source: 'manual' | 'email' | 'agent'
  created_at: string
}

export type Card = {
  id: string
  trip_id: string
  title: string
  tagline: string | null
  description: string | null
  category: 'restaurant' | 'activity' | 'sightseeing'
  source: 'ai_generated' | 'user_added'
  image_url: string | null
  metadata: {
    price_range?: string
    hours?: string
    address?: string
    duration?: string
    kid_friendly?: boolean
    booking_required?: boolean
    distance_from_hotel?: string
    latitude?: number
    longitude?: number
    rating?: number
    rating_count?: number
    google_place_id?: string
    review_snippets?: string[]
    why_this?: string
    photo_search_query?: string
  }
  added_by: string | null
  created_at: string
}

export type Swipe = {
  id: string
  card_id: string
  user_id: string
  preference: 'want' | 'pass' | 'indifferent'
  created_at: string
}

export type SwipeResult = Card & {
  swipes: Swipe[]
  score: number
  consensus: 'everyone_loves' | 'mixed' | 'hard_pass'
}

export type TimelineEvent = {
  id: string
  date: string
  type: 'arrival' | 'departure' | 'check_in' | 'check_out'
  icon: string
  title: string
  description: string
  familyName: string | null
  familyColor: string | null
  rawText: string
  dateUnclear: boolean
}

// Row type for the timeline_events table — structured booking data.
// All five types share the same row shape; the type field controls how the
// timeline page expands the event into render positions and how the card
// renders the kicker. hotel/airbnb/cruise all use the check_in/check_out
// phase pair; flight and activity use single phases.
export type TimelineEventRow = {
  id: string
  trip_id: string
  type: 'flight' | 'hotel' | 'activity' | 'airbnb' | 'cruise' | 'restaurant'
  title: string
  start_date: string          // YYYY-MM-DD
  end_date: string | null     // YYYY-MM-DD
  start_time: string | null   // HH:MM 24h
  end_time: string | null     // HH:MM 24h
  origin: string | null
  destination: string | null
  reference: string | null
  details: Record<string, unknown>
  added_by: string
  family_id: string | null
  source: 'manual' | 'agent' | 'email'
  card_id: string | null
  status: 'planned' | 'visited' | 'skipped'
  created_at: string
}
