export type Trip = {
  id: string
  title: string
  destination: string
  date_start: string
  date_end: string
  created_by: string
  invite_code: string
  timezone: string | null
  created_at: string
}

export type TripParticipant = {
  id: string
  trip_id: string
  user_id: string
  role: 'organizer' | 'member'
  family_group_id: string | null
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

export type FamilyGroup = {
  id: string
  trip_id: string
  name: string
  color: string
  created_at: string
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
