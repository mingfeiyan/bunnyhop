# Timeline ↔ Card Linking — Design

**Date:** 2026-04-20
**Status:** Design validated, ready for implementation planning

## Problem

Today the timeline stores flights, hotels, and activities, and the swipe deck surfaces group-voted cards (restaurants, activities, sightseeing). The two are disconnected:

- When the trip is underway, visited restaurants and activities don't end up on the timeline unless a user types them in manually.
- Consensus cards from swipe have no way to be "committed" as actual plans. The group picks Joe's Pizza but nothing propagates to the itinerary.
- The agent can already post generic timeline events but has no vocabulary for "we went to this card" or "this card is planned for Tuesday 7pm."

## Goals

1. **Record-keeping** — after a visit, log it on the timeline (agent or UI), optionally linked to a card.
2. **Commit-to-plan** — turn a consensus card into a scheduled timeline entry.
3. **Preserve honest history** — distinguish planned, visited, and skipped entries rather than silently deleting changes of plan.

## Non-goals

- Drag-and-drop calendar itinerary builder (too large for this pass; revisit later).
- A trip `status` field (planning/active/completed) — dates already carry enough signal.
- Removing planned cards from the swipe deck — votes stay open until a visit is confirmed.

## Key decisions

| Decision | Choice |
|---|---|
| Card ↔ timeline link | Optional (`card_id` nullable) |
| How users commit a card | Agent + lightweight "Add to itinerary" button on results page |
| New timeline type | `restaurant` (first-class; activity/sightseeing stay as `activity`) |
| Agent card-matching | Hybrid — prefer explicit `card_id`, fall back to exact `google_place_id` match, never fuzzy-match titles |
| Planned vs visited | Explicit `status` column: `planned` / `visited` / `skipped` |
| Swipe deck behavior for planned cards | Stays swipeable, shows a "Planned" badge |

## Schema

**Migration `020_timeline_card_links.sql`**

1. Extend the `timeline_events.type` CHECK constraint to include `restaurant`.
2. Add `card_id uuid REFERENCES cards(id) ON DELETE SET NULL`, nullable, indexed.
3. Add `status text NOT NULL DEFAULT 'planned'` with CHECK in `('planned','visited','skipped')`. Existing rows backfill to `planned`.
4. Add `timeline_events` to the Supabase Realtime publication.

No changes to `cards`. "Is this card planned?" is derived from `timeline_events.card_id IS NOT NULL AND status <> 'skipped'`.

RLS is unchanged — existing trip-participant policies cover the new column.

## Types

In `src/types/index.ts`, extend `TimelineEvent` / `TimelineEventRow`:

- Add `'restaurant'` to the `type` union.
- Add `card_id: string | null`.
- Add `status: 'planned' | 'visited' | 'skipped'`.

## API

**`POST /api/trips/[tripId]/timeline-events`** (authenticated UI route)
Accept new optional fields: `card_id`, `status` (default `planned`), plus `type: 'restaurant'`. Validate `card_id` belongs to the same trip.

**`POST /api/trips/by-code/[inviteCode]/timeline-events`** (agent route)
Same new fields, plus an optional `google_place_id`:

- If `card_id` is provided → validate and use it.
- Else if `google_place_id` is provided → query `cards` in this trip for `metadata->>'google_place_id'`; attach `card_id` only on a single match. Zero or multiple matches → leave `card_id = NULL`.
- Else → `card_id = NULL`.

Title is never used for matching.

**`PATCH /api/trips/[tripId]/timeline-events/[eventId]`** (new; plus by-code equivalent)
Whitelist: `status`, `start_date`, `start_time`, `end_date`, `end_time`, `details`. Primary use: `planned → visited` and `planned → skipped`. Agents look up `eventId` via `/summary`.

**`GET /api/trips/by-code/[inviteCode]/summary`**
Serialize the new `card_id` and `status` fields.

**Docs** — update `docs/agent-guide.md` and `docs/timeline-api.md` with three worked examples:

1. Commit a card (agent has `card_id` from `/summary`).
2. Log a spontaneous restaurant visit (no card).
3. Mark a planned entry as visited after the fact.

## UI

**Results page (`src/app/trips/[tripId]/results/page.tsx` + `ResultsCard`)**
Add an "Add to itinerary" button on each card. Opens a modal with date picker (constrained to trip dates when present), optional time, optional notes. Submits to the authenticated POST with `card_id` and `type` inferred from `card.category` (`restaurant` → `restaurant`, else `activity`), `status: 'planned'`.

If the card already has a non-skipped planned entry, the button initial-renders as "Planned for {date}" with edit/remove affordances. The planned set comes from a `Map<card_id, timeline_event>` computed server-side from the same trip-level fetch that loads cards.

**Swipe page (`src/app/trips/[tripId]/swipe/page.tsx`)**
Render a small "Planned" pill on the front face of cards in the planned set. Subscribe to the `timeline_events` Realtime channel so the pill appears live for all viewers when one member commits a card. No interaction change — voting remains open.

**Timeline page (`src/app/trips/[tripId]/timeline/page.tsx`)**

- Render `restaurant` type with a food icon and, when linked, the card's price range.
- Render a status chip: planned (default), visited (✓, accent color), skipped (muted strikethrough).
- When `card_id` is present, inline the linked card's thumbnail and tagline.
- Add an inline status control for authenticated members: Mark visited / Mark skipped / Reset to planned.

## Out of scope for this change

- Notifying users when a card they voted on gets committed. (Future: push/email.)
- Auto-suggesting a date based on past visits or remaining trip days.
- Multi-entry cards — one card maps to one live timeline event at a time (skipped entries don't count against this).
- Merging duplicate visits if both the agent and a user log the same place.

## Implementation order

1. Migration 020 + types.
2. Extend POST endpoints + add PATCH endpoints.
3. Update `/summary` serialization + agent docs.
4. Results page button + modal.
5. Swipe page "Planned" badge + Realtime subscription.
6. Timeline page rendering + status controls.
