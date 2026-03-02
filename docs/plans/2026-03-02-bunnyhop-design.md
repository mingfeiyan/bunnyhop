# Bunnyhop — Collaborative Travel Planning App

## Overview

A collaborative travel planning web app where groups of friends or family discover what they want to do together through a fun, swipe-based experience — then turn those shared preferences into a trip plan.

The core insight: trip planning in group chats is chaos. Bunnyhop makes preference discovery engaging (swipe on AI-curated cards) and transparent (see where the group stands in real time).

## Core Loop (MVP)

1. Someone creates a trip (destination, dates, trip name)
2. They add known details upfront — flights, hotel, constraints ("kids under 5", "someone is vegetarian") — these become AI constraints
3. They share an invite link; other participants sign in and add their own known details
4. AI generates a deck of ~20-30 flash cards informed by all trip context
5. Everyone swipes: right (want), left (pass), up (indifferent)
6. Anyone can add their own custom cards to the deck
7. Results dashboard shows group consensus, updating live

## Tech Stack

| Layer        | Choice                          | Rationale                                                    |
| ------------ | ------------------------------- | ------------------------------------------------------------ |
| Frontend     | Next.js (App Router) + Tailwind | API routes built in, nested layouts for trip views, easy Vercel deploy |
| Backend/Data | Supabase (Postgres + Auth + Realtime) | Relational structure for trips/participants/swipes, real-time subscriptions for collaboration, built-in auth |
| AI           | Claude API                      | Card generation, context parsing, future schedule building    |
| Places Data  | Google Places API               | Photos, ratings, location data for cards                      |
| Auth         | Google + Apple via Supabase Auth | One-tap sign in, low friction                                 |
| Hosting      | Vercel                          | Natural pairing with Next.js                                  |

## Data Model

### Core Entities

**User**
- id, name, avatar, email (from social auth)

**Trip**
- id, destination, date_start, date_end, title, created_by, invite_code

**Trip Participant**
- user_id, trip_id, role (organizer / member)

**Trip Context**
- id, trip_id, type (flight / hotel / constraint / note), details (JSON), raw_text, added_by, source (manual / email / agent), created_at

**Card**
- id, trip_id, title, tagline, description, category (restaurant / activity / sightseeing), source (ai_generated / user_added), image_url, metadata (location, price_range, hours, duration, kid_friendly, booking_required, etc.), added_by, created_at

**Swipe**
- id, card_id, user_id, preference (want / pass / indifferent), created_at

### Key Design Decisions

- **Trip Context uses a JSON `details` field** — flight info, hotel info, and "my kid is allergic to peanuts" are very different shapes. Let the AI interpret the context rather than forcing users into rigid forms.
- **Cards are generated in batches** — one Claude call produces the full deck. As new context is added, supplemental batches can be generated without duplicating previous cards.
- **Swipes are per-user, per-card** — simple join table. The results dashboard is an aggregation query.

## User Flows

### Flow 1 — Create a Trip

- Sign in with Google/Apple
- Tap "New Trip" -> enter destination, dates, trip name
- Land on the Trip Hub

### Flow 2 — Add Trip Context

Three ingestion paths, all hitting the same AI parsing layer:

1. **Manual input** — free-form text: "We're staying at the Four Seasons" or "Flying Air Tahiti, arrive July 5 at 2pm". AI parses and categorizes automatically.
2. **Email forwarding** — each trip gets a unique email address (e.g., `bora-bora-july@trips.bunnyhop.app`). Forward booking confirmations, AI extracts details.
3. **Agent API** — each trip exposes an API endpoint (`/api/trips/{invite_code}/context`). Users' personal AI agents can POST context directly. Auth via invite code + user token.

Claude extracts structured data where possible (flight number, times, hotel name) and stores both raw text and parsed result.

### Flow 3 — Card Generation

- "Generate recommendations" becomes available once destination + dates exist
- System sends Claude: destination, dates, group size, all trip context
- Claude returns structured JSON per card: title, tagline, category, practical details, photo search query
- App fetches photos from Google Places API, applies visual styling
- Initial batch: ~20-30 cards, balanced across categories
- Supplemental batches generated when significant new context is added (e.g., another family's flights)
- Notification to group: "5 new cards just dropped based on Mike's flight info"

### Flow 4 — Swipe Experience

- Full-screen, immersive swipe interface
- Swipe right = want (green), left = pass (red), up = indifferent (blue)
- "Add your own" floating button to create custom cards mid-session
- Progress count at top

### Flow 5 — Results

- Results dashboard is always visible, updates live as swipes come in
- Three sections: "Everyone loves" / "Mixed feelings" / "Hard pass"
- Each card shows participant avatar dots (green/red/grey for their vote)
- Tap to expand details
- Filter by category (food / activities / sights)

## Card Design

### Front (Cover)

- Real photo from Google Places API with consistent visual treatment: subtle gradient overlay, rounded corners
- Category badge in top corner ("Restaurant", "Activity", "Sightseeing")
- Bold title at bottom over gradient
- One punchy AI-written tagline ("Overwater dining with a sunset you won't shut up about")
- Small detail chips: price range, distance from hotel, group-friendliness

### Back (Flip — tap to reveal)

- Smooth 3D CSS flip animation
- **Why this?** — AI-written paragraph explaining why it fits this group ("You're staying 10 minutes away and arrive on a Tuesday — they do a local seafood night every Tuesday")
- **Practical details** — hours, address, booking needed, kid-friendly, typical duration
- **What people say** — 2-3 short review snippets from Google Places
- **Map thumbnail** — location relative to hotel
- Tap again to flip back, then swipe to vote

### Design Principles

- Cards should feel like a well-designed travel magazine, not a Yelp listing
- The AI tagline on the front is the hook that makes you want to flip
- The back gives you confidence to swipe right or left

## Preference Matching Algorithm

**Weighted consensus with three-way input:**

- Right (want) = +1
- Up (indifferent) = 0
- Left (pass) = -1

**Ranking rules:**
- Activities only make the cut if nobody passed (no negative votes)
- Ranked by total enthusiasm score (sum of +1 votes)
- "Everyone loves" = all participants voted want
- "Mixed feelings" = mix of want and indifferent, no passes
- "Hard pass" = one or more passes

## Realtime Features

**What's live:**
- Context updates — when someone adds trip details, visible to all immediately
- New cards notification — when supplemental cards are generated or user adds a custom card
- Results dashboard — updates live as swipes come in
- Presence — avatars showing who's viewed the trip

**What's intentionally NOT live:**
- Individual swipe choices stay hidden in the aggregate. No "Mike just swiped left on the restaurant you added." Keeps swiping honest and pressure-free.

**Implementation:**
- Supabase Realtime subscriptions on Swipe and Trip Context tables
- Supabase Presence for online status
- Lightweight — listening for row inserts, no complex event system

## MVP Scope

### In scope (MVP)
- Trip creation with destination, dates, trip name
- Social login (Google/Apple)
- Invite links to join trips
- Trip context: manual input + email forwarding + agent API
- AI card generation from trip context (Claude API + Google Places)
- Card experience with flip animation
- Swipe UX (want / pass / indifferent)
- User-added custom cards
- Group results dashboard with live updates
- Mobile-responsive PWA

### Deferred (post-MVP)
- AI-generated itinerary / schedule builder
- Flight & logistics timeline view
- Veto mechanic (hard no vs soft preference)
- AI agents pulling in booking details automatically
- Push notifications
- Trip templates / re-use

## Cost Considerations

- Card generation is batched (one Claude call per deck), not per-card
- Generated cards are cached in database — no regeneration unless explicitly requested
- Google Places API has a free tier; photo fetches are the main cost driver
- Supabase free tier covers early usage (auth, database, realtime)
