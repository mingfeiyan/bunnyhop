# Bunnyhop

Decide on trips together. AI suggests, your group swipes, and a timeline assembles itself from your booking emails.

Bunnyhop is a collaborative trip-planning app for families and small groups. You start with a destination and a date range (or just a name — the rest fills in automatically as you add bookings). Claude generates a deck of restaurants, activities, and sightseeing recommendations. Everyone in the trip swipes through the deck on their phone, and a results view shows what the group agrees on, what's mixed, and what's a hard pass. Meanwhile, any flights, hotels, Airbnbs, or cruises you forward to the trip get parsed into structured events and rendered on a single editorial-style timeline.

## What it does

- **AI-generated recommendation cards.** Claude Sonnet 4.6 produces 20–25 personalized recommendations per trip, balanced across restaurants, activities, and sightseeing. Photos and ratings come from Google Places.
- **Swipe voting.** Tinder-style deck — drag right to want, left to pass, up for indifferent. Quit anytime, resume from where you left off. Change your mind on the results page.
- **Group consensus view.** Each card shows who voted what. Three sections: Everyone Loves, Mixed Feelings, Hard Pass. Sorted by score.
- **Auto-built timeline.** Forward a flight confirmation, paste an Airbnb receipt, or post structured JSON via the agent API — Claude parses dates, addresses, and reservation numbers into typed events. The timeline page renders them grouped by date with overlap detection (when multiple families converge).
- **Five booking types.** Flights, hotels, Airbnbs, cruises, and activities — each rendered with a distinct kicker label and icon. Hotels and Airbnbs share the check-in/check-out lifecycle; cruises use board/disembark.
- **Multi-family trips.** Create color-coded family groups so you can see who's flying when and which family is staying where. The timeline shows family-color accents and detects overlap windows when everyone's in the same place.
- **Optional everything.** Create a trip with just a title. Destination, date range, and timezone fill themselves in from the first hotel or flight you add. Edit anytime via an organizer-only modal.
- **Trip cover images.** Gemini generates an editorial-style landscape photograph per trip from the destination name. Cached in Supabase Storage, regenerated only on demand.
- **Agent-friendly API.** POST flights, hotels, or activities directly to `/api/trips/by-code/<invite-code>/timeline-events` using the invite code as auth. No API key required. Useful for hooking up an email agent that watches your inbox for booking confirmations.

## Tech stack

- **[Next.js 16](https://nextjs.org)** App Router — server components for data fetching, client components for interactive bits
- **[TypeScript](https://www.typescriptlang.org)** — strict mode, exhaustive switches everywhere event types appear
- **[Supabase](https://supabase.com)** — Postgres + Auth (Google OAuth) + Storage + Realtime subscriptions
- **[Claude Sonnet 4.6](https://www.anthropic.com/claude)** via the Anthropic SDK — booking parsing and card generation
- **[Gemini 2.5 Flash Image](https://ai.google.dev)** ("Nano Banana") — trip cover image generation
- **[Google Places API](https://developers.google.com/maps/documentation/places/web-service/overview)** — photos and ratings for AI-generated cards
- **[Tailwind v4](https://tailwindcss.com)** with custom design tokens — editorial palette (cream `#F0F0EC` + dark forest `#333D29`)
- **[Playfair Display](https://fonts.google.com/specimen/Playfair+Display) + [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)** via `next/font/google`
- **[Vitest](https://vitest.dev)** — 63 unit tests covering address parsing, timeline events, FlipCard, review URL generation, and the autofill helper

## Local development

```bash
git clone https://github.com/mingfeiyan/bunnyhop.git
cd bunnyhop
npm install
```

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>     # used by /api/trips/by-code/* agent endpoints
ANTHROPIC_API_KEY=<your-anthropic-key>                # for Claude (parsing + card generation)
GOOGLE_GEMINI_API_KEY=<your-gemini-key>               # for trip cover image generation
GOOGLE_PLACES_API_KEY=<your-google-places-key>        # for photos + ratings on AI-generated cards
```

Apply database migrations from `supabase/migrations/` to your Supabase project (via the Supabase CLI, dashboard, or MCP).

Then run:

```bash
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
```

## Architecture

The app is structured around three primary tables:

- **`trips`** — title, destination, date range, timezone, cover image. All metadata fields (except title) are nullable so users can create a trip with just a name and let the rest auto-fill.
- **`timeline_events`** — typed booking rows (`flight | hotel | airbnb | cruise | activity`) with start/end dates, times, addresses, and arbitrary `details` JSON. The timeline page expands each row into one or two render positions and groups them by date.
- **`cards`** + **`swipes`** — AI-generated recommendations and per-user preference votes (`want | pass | indifferent`). The results page computes consensus client-side and updates live via Supabase Realtime.

Two endpoint patterns:

- **Session-based** (`/api/trips/[tripId]/...`) — uses the user's Supabase session cookie for auth, gated by RLS policies
- **Invite-code-based** (`/api/trips/by-code/[code]/...`) — uses the trip's invite code as the bearer secret, runs against the Supabase service role to bypass RLS. Designed for AI agents and curl-friendly automation

The auto-fill helper (`src/lib/trip-autofill.ts`) runs server-side after every timeline event insert. It reads the trip's null fields, extracts the city from the first hotel address (handling 5 different address formats including international, country suffixes, and merged city-state forms — see `src/test/trip-autofill.test.ts` for the test matrix), populates missing trip metadata, and triggers cover image generation if destination just transitioned from null to set.

The visual design is editorial / magazine-style — single restrained color (dark forest on cream), Playfair Display headlines, IBM Plex Mono labels, hairline borders everywhere, no rounded corners except pill buttons. All form fields use a shared `<EditorialInput>` primitive that emits the same chrome (mono kicker label above, serif text inside, bottom-border-only) so adding a new form is a 4-line operation.

## Testing

```bash
npm run test          # 63 tests across 5 files
```

Coverage focuses on the brittle parts:

- **`cityFromAddress`** (26 tests) — every address shape currently in production plus edge cases (4-part with country suffix, 2-part merged city-state, multi-word cities, international, no commas)
- **`parsedEntryToTimelineEvent`** + **`formatTimelineEventDescription`** (17 tests) — all five event types, nights count, address rendering on stays
- **`computeOverlap`** (13 tests) — family date range intersection
- **`getReviewUrl`** (5 tests) — Google Maps and TripAdvisor link construction
- **`FlipCard`** (2 tests) — 3D flip interaction renders both sides

## Project structure

```
src/
  app/
    api/                          API route handlers
      trips/[tripId]/...          session-based endpoints
      trips/by-code/[code]/...    invite-code-based agent endpoints
    trips/                        trip pages (list, hub, swipe, timeline, results, generate)
    login/                        Google OAuth login
    invite/[code]/                redirect-based invite acceptance
  components/
    ui/                           editorial design primitives
      PageHeader, MetaStrip, OverviewGrid, DaySection, EventCard,
      PillButton, MonoLabel, PageShell, EditorialInput
    TimelineEventCard             event card with type-aware kickers
    SwipeDeck                     drag mechanics, controlled by parent's votes
    FlipCard                      3D flip recommendation card
    ResultsCard                   per-voter results with re-vote inline
    TripContextSection            free-text booking input + parsed list
    FamilyGroupManager            color-coded family group CRUD
    EditTripDetailsModal          organizer-only metadata editor
    AddCardModal                  manual recommendation entry
  lib/
    supabase/                     server + client + service-role factories
    claude.ts                     Claude parser (booking text → structured entries)
    card-generator.ts             Claude card generation (trip → 20-25 recommendations)
    timeline-events.ts            parser-entry → row conversion + description formatter
    trip-autofill.ts              null-field backfill from inserted events
    trip-cover.ts                 Gemini cover image lifecycle
    trip-countdown.ts             "X days to go" / "in progress · day X of Y" / "ended X days ago"
    google-places.ts              Places search + photo lookup
    gemini.ts                     Gemini Imagen + multimodal client
    timeline.ts                   date headers, family overlap detection
    colors.ts                     desaturated family-color palette
  test/                           Vitest test files
supabase/
  migrations/                    versioned DDL (12 migrations as of writing)
docs/
  superpowers/                   architectural plans + spec docs
```

## Notes

- The app is single-theme (editorial). The previous dual-theme scaffolding is being removed in a follow-up cleanup commit.
- Dark mode is intentionally not supported.
- The agent-friendly endpoints under `/api/trips/by-code/[code]/*` are excluded from the auth middleware so AI agents can POST without a session.
- Trip dates and destination are now optional at creation. The trip hub renders "Destination not set" / "Dates not set" placeholders until auto-fill or manual editing populates them.

## License

MIT
