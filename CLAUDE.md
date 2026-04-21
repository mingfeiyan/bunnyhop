# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bunnyhop is a collaborative trip planning app where groups use AI-generated recommendation cards and swipe voting to decide on restaurants, activities, and sightseeing. Built with Next.js 16 (App Router), Supabase (Postgres + Auth + Realtime), and Claude API for AI features.

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
```

Run a single test file: `npx vitest run src/test/flip-card.test.tsx`

## Environment

Requires `.env.local` with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`. See `.env.example`.

## Architecture

### Data Flow

User creates trip -> adds context (free text) -> Claude parses into structured data (`src/lib/claude.ts`) -> triggers card generation (`src/lib/card-generator.ts`) which produces 20-25 recommendations -> Google Places fetches photos -> users swipe cards -> results computed client-side with scoring.

### Key Layers

- **Server components** (`src/app/trips/page.tsx`, `src/app/trips/[tripId]/page.tsx`) fetch initial data via server-side Supabase client (`src/lib/supabase/server.ts`)
- **Client components** use a singleton browser Supabase client (`src/lib/supabase/client.ts`) with Realtime subscriptions for live updates on swipes, trip_context, and cards tables
- **API routes** (`src/app/api/`) handle card generation, photo proxying, and context parsing. API routes are excluded from auth middleware to support agent-based context submission
- **Middleware** (`src/middleware.ts`) guards all routes except `/login`, `/auth/callback`, `/invite`, `/api`, and `/`

### Database (Supabase)

Migrations in `supabase/migrations/`. Core tables: `trips`, `trip_participants`, `trip_context`, `cards`, `swipes`, `timeline_events`. RLS policies enforce participant-level access. Migration 004 fixes RLS recursion via a `security definer` function `is_trip_member()`. Migration 025 adds `card_id` and `status` (planned/visited/skipped) to `timeline_events` so swipe cards can be committed to the itinerary.

Realtime is enabled on `swipes`, `trip_context`, `cards`, and `timeline_events`.

### AI Integration

Both `src/lib/claude.ts` (context parsing) and `src/lib/card-generator.ts` (recommendation generation) use `claude-sonnet-4-6`. Card generator requests raw JSON (no markdown fences) with regex fallback extraction if Claude wraps the response.

### Types

All shared types in `src/types/index.ts`: `Trip`, `TripParticipant`, `TripContext`, `Card`, `Swipe`, `SwipeResult`.

### Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## User Flow

Login (Google OAuth) -> `/trips` (list) -> create trip -> `/trips/[id]` (hub: add context, invite members) -> `/trips/[id]/generate` (AI generates cards) -> `/trips/[id]/swipe` (drag-to-swipe voting) -> `/trips/[id]/results` (scored consensus view).

Invite flow: share `/invite/[code]` link -> auto-joins trip -> redirects to trip hub.

## Scoring Logic

Swipe preferences: `want` = +1, `pass` = -1, `indifferent` = 0. Consensus: `everyone_loves` (all want), `hard_pass` (any pass), `mixed` (otherwise). Results sorted by score descending.
