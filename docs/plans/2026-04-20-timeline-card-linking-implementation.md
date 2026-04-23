# Timeline ↔ Card Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let agents and users mark swipe-deck cards as "planned" or "visited" so restaurants and activities appear on the trip timeline.

**Architecture:** Extend `timeline_events` with `card_id` (nullable FK to `cards`), `status` (`planned`/`visited`/`skipped`), and a new `restaurant` type. Agents use existing by-code POST plus a new PATCH for status transitions; the UI gets an "Add to itinerary" button on the results page and a "Planned" badge on the swipe deck.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres/Auth/Realtime), Vitest, TypeScript. Source of truth: `docs/plans/2026-04-20-timeline-card-linking-design.md`.

**Worktree:** `.worktrees/timeline-card-linking` on branch `feat/timeline-card-linking`.

---

## Conventions for every task

- Run tests from the worktree root: `npm test` (single run) or `npx vitest run <file>`.
- After a task passes its tests, run `npm run lint` before committing.
- Commits use Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Include the `Co-Authored-By` trailer per CLAUDE.md.
- One logical change per commit. If a step says "commit," commit.
- `timeline_events` realtime is **already enabled** (migration 007). Don't re-add it.
- Migration numbering: next free number is **025**.

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/025_timeline_card_links.sql`

**Step 1: Write the migration**

```sql
-- Migration 025: link timeline events to cards + planned/visited/skipped status.
--
-- Why: lets the agent and UI mark a card as "committed" (planned for a date)
-- or "visited" (actually went). Also adds 'restaurant' as a first-class
-- timeline type so eateries render distinctly from generic activities.

-- 1. Extend type constraint to include 'restaurant'.
alter table timeline_events drop constraint timeline_events_type_check;
alter table timeline_events add constraint timeline_events_type_check
  check (type in ('flight', 'hotel', 'activity', 'airbnb', 'cruise', 'restaurant'));

-- 2. Nullable FK to cards. ON DELETE SET NULL so deleting a card doesn't
-- wipe the history of what happened on the trip.
alter table timeline_events
  add column card_id uuid references cards(id) on delete set null;

create index idx_timeline_events_card on timeline_events(card_id)
  where card_id is not null;

-- 3. Status column. Existing rows are backfilled to 'planned' — they
-- represent bookings that were committed but not yet confirmed as visited.
alter table timeline_events
  add column status text not null default 'planned'
  check (status in ('planned', 'visited', 'skipped'));
```

**Step 2: Apply the migration locally**

Run: `npx supabase db reset` (if using local supabase) or apply via dashboard.

Expected: no errors, new columns visible on `timeline_events`.

**Step 3: Commit**

```bash
git add supabase/migrations/025_timeline_card_links.sql
git commit -m "feat(db): add card_id + status to timeline_events, restaurant type"
```

---

## Task 2: Type definitions

**Files:**
- Modify: `src/types/index.ts` (extend `TimelineEventRow`)

**Step 1: Update `TimelineEventRow`**

Change the `type` union to include `'restaurant'`, add `card_id` and `status`:

```typescript
export type TimelineEventRow = {
  id: string
  trip_id: string
  type: 'flight' | 'hotel' | 'activity' | 'airbnb' | 'cruise' | 'restaurant'
  title: string
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
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
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: may surface call sites that don't handle the new fields — most should be safe because reading extra fields is always fine. Any errors here should be addressed in the relevant task below, not this one.

**Step 3: Run tests**

Run: `npm test`
Expected: 63 tests still passing. Existing code treats `TimelineEventRow` as open enough that adding fields is non-breaking.

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): extend TimelineEventRow with card_id, status, restaurant"
```

---

## Task 3: Shared validation + matching helper

**Files:**
- Create: `src/lib/timeline-links.ts`
- Create: `src/test/timeline-links.test.ts`

This module centralizes (a) the valid type/status sets so both POST endpoints agree, and (b) the card-matching fallback (exact `google_place_id` → exactly-one-card match).

**Step 1: Write failing tests**

```typescript
// src/test/timeline-links.test.ts
import { describe, it, expect } from 'vitest'
import {
  VALID_EVENT_TYPES,
  VALID_STATUSES,
  matchCardByPlaceId,
} from '@/lib/timeline-links'

type TestCard = {
  id: string
  trip_id: string
  metadata: { google_place_id?: string } | null
}

describe('VALID_EVENT_TYPES', () => {
  it('includes restaurant', () => {
    expect(VALID_EVENT_TYPES.has('restaurant')).toBe(true)
  })
  it('still includes legacy types', () => {
    ['flight', 'hotel', 'activity', 'airbnb', 'cruise'].forEach(t =>
      expect(VALID_EVENT_TYPES.has(t)).toBe(true),
    )
  })
})

describe('VALID_STATUSES', () => {
  it('lists planned, visited, skipped', () => {
    expect([...VALID_STATUSES].sort()).toEqual(['planned', 'skipped', 'visited'])
  })
})

describe('matchCardByPlaceId', () => {
  const cards: TestCard[] = [
    { id: 'c1', trip_id: 't1', metadata: { google_place_id: 'abc' } },
    { id: 'c2', trip_id: 't1', metadata: { google_place_id: 'def' } },
    { id: 'c3', trip_id: 't1', metadata: { google_place_id: 'abc' } }, // duplicate
    { id: 'c4', trip_id: 't1', metadata: null },
  ]

  it('returns the card id on a single match', () => {
    expect(matchCardByPlaceId(cards, 'def')).toBe('c2')
  })

  it('returns null on zero matches', () => {
    expect(matchCardByPlaceId(cards, 'ghi')).toBeNull()
  })

  it('returns null on multiple matches (never guess)', () => {
    expect(matchCardByPlaceId(cards, 'abc')).toBeNull()
  })

  it('ignores cards with null metadata', () => {
    expect(matchCardByPlaceId(cards, '')).toBeNull()
  })
})
```

**Step 2: Run test to confirm failure**

Run: `npx vitest run src/test/timeline-links.test.ts`
Expected: file not found / module missing.

**Step 3: Implement**

```typescript
// src/lib/timeline-links.ts
export const VALID_EVENT_TYPES = new Set([
  'flight',
  'hotel',
  'activity',
  'airbnb',
  'cruise',
  'restaurant',
])

export const VALID_STATUSES = new Set(['planned', 'visited', 'skipped'])

type CardLike = {
  id: string
  metadata: { google_place_id?: string } | null
}

/**
 * Resolve a google_place_id to a card id in the trip. Returns null if
 * zero or multiple cards match — we never guess.
 */
export function matchCardByPlaceId(
  cards: CardLike[],
  placeId: string,
): string | null {
  if (!placeId) return null
  const matches = cards.filter(c => c.metadata?.google_place_id === placeId)
  if (matches.length !== 1) return null
  return matches[0].id
}
```

**Step 4: Run tests**

Run: `npx vitest run src/test/timeline-links.test.ts`
Expected: PASS (7 tests).

**Step 5: Commit**

```bash
git add src/lib/timeline-links.ts src/test/timeline-links.test.ts
git commit -m "feat(lib): shared timeline-link validation + place_id matcher"
```

---

## Task 4: Wire new fields into authenticated POST

**Files:**
- Modify: `src/app/api/trips/[tripId]/timeline-events/route.ts`

**Step 1: Replace the local `VALID_EVENT_TYPES` with the shared set and accept the new fields**

1. Import `VALID_EVENT_TYPES, VALID_STATUSES` from `@/lib/timeline-links`.
2. Delete the local `const VALID_EVENT_TYPES = new Set(...)`.
3. Extend `IncomingEvent` type: add `card_id?: string | null`, `status?: string`.
4. In `validateEvent`, after the existing time checks, add:
   ```typescript
   if (ev.status && !VALID_STATUSES.has(ev.status)) {
     return { ok: false, error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }
   }
   if (ev.card_id != null && typeof ev.card_id !== 'string') {
     return { ok: false, error: 'card_id must be a string if provided' }
   }
   ```
5. After validating the list but before insert, if any event has `card_id`, verify those cards belong to the trip:
   ```typescript
   const cardIds = validEvents.map(e => e.card_id).filter((x): x is string => !!x)
   if (cardIds.length > 0) {
     const { data: cards } = await supabase
       .from('cards')
       .select('id')
       .eq('trip_id', tripId)
       .in('id', cardIds)
     const owned = new Set((cards ?? []).map(c => c.id))
     for (const id of cardIds) {
       if (!owned.has(id)) {
         return NextResponse.json(
           { error: `card_id ${id} does not belong to this trip` },
           { status: 400 },
         )
       }
     }
   }
   ```
6. In the `rows` map add:
   ```typescript
   card_id: ev.card_id ?? null,
   status: ev.status ?? 'planned',
   ```

**Step 2: Run existing tests**

Run: `npm test`
Expected: all tests still pass (existing tests don't exercise this route directly; they exercise `src/lib/timeline-events.ts`).

**Step 3: Update the error message listing types**

The existing error message `'type must be one of: flight, hotel, airbnb, cruise, activity'` is now stale. Replace with:

```typescript
return { ok: false, error: `type must be one of: ${[...VALID_EVENT_TYPES].join(', ')}` }
```

**Step 4: Commit**

```bash
git add src/app/api/trips/[tripId]/timeline-events/route.ts
git commit -m "feat(api): accept card_id + status on authenticated timeline POST"
```

---

## Task 5: Wire new fields into by-code POST (agent route)

**Files:**
- Modify: `src/app/api/trips/by-code/[inviteCode]/timeline-events/route.ts`

Mirror the Task 4 changes *plus* the `google_place_id` fallback matching.

**Step 1: Apply the same changes as Task 4** (shared types, validation, card ownership check, row fields).

**Step 2: Add the `google_place_id` fallback**

1. Extend `IncomingEvent` with `google_place_id?: string`.
2. In `validateEvent`:
   ```typescript
   if (ev.google_place_id != null && typeof ev.google_place_id !== 'string') {
     return { ok: false, error: 'google_place_id must be a string if provided' }
   }
   ```
3. After validation, before the ownership check, build a `Map<string, string | null>` for place_id → card_id by:
   - Collecting all place_ids from events that have no explicit `card_id` but do have `google_place_id`.
   - One query: `select id, metadata` from cards where trip_id = trip.id.
   - For each event missing `card_id` with a `google_place_id`, call `matchCardByPlaceId(cards, placeId)` and set `ev.card_id = match` (only if non-null).
4. Then run the ownership check from Task 4 on the resulting `card_id`s (they came from a trip-scoped query, so this is redundant but harmless and keeps both routes symmetric).

Pseudocode after validation:

```typescript
import { matchCardByPlaceId } from '@/lib/timeline-links'

// Fetch trip cards once if any event might need a place_id fallback.
const needsFallback = validEvents.some(e => !e.card_id && e.google_place_id)
if (needsFallback) {
  const { data: cards } = await supabase
    .from('cards')
    .select('id, metadata')
    .eq('trip_id', trip.id)
  for (const e of validEvents) {
    if (!e.card_id && e.google_place_id) {
      e.card_id = matchCardByPlaceId(cards ?? [], e.google_place_id)
    }
  }
}
```

**Step 3: Do NOT pass `google_place_id` through to the insert.** It's a lookup hint, not a stored field.

**Step 4: Run tests**

Run: `npm test`
Expected: all pass.

**Step 5: Commit**

```bash
git add src/app/api/trips/by-code/[inviteCode]/timeline-events/route.ts
git commit -m "feat(api): agent route accepts card_id, status, and place_id fallback"
```

---

## Task 6: PATCH endpoint — authenticated

**Files:**
- Create: `src/app/api/trips/[tripId]/timeline-events/[eventId]/route.ts`

**Step 1: Implement the handler**

```typescript
import { createClient } from '@/lib/supabase/server'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { VALID_STATUSES } from '@/lib/timeline-links'
import { NextResponse } from 'next/server'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const MUTABLE_FIELDS = new Set([
  'status',
  'start_date',
  'start_time',
  'end_date',
  'end_time',
  'details',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; eventId: string }> },
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter })
  if (securityError) return securityError

  const { tripId, eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify membership.
  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!participant) return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })

  const body = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!MUTABLE_FIELDS.has(key)) continue
    if (key === 'status') {
      if (typeof value !== 'string' || !VALID_STATUSES.has(value)) {
        return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, { status: 400 })
      }
    }
    if ((key === 'start_date' || key === 'end_date') && value != null) {
      if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be YYYY-MM-DD` }, { status: 400 })
      }
    }
    if ((key === 'start_time' || key === 'end_time') && value != null) {
      if (typeof value !== 'string' || !TIME_24H_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be HH:MM 24h` }, { status: 400 })
      }
    }
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no mutable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .update(update)
    .eq('id', eventId)
    .eq('trip_id', tripId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'event not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

**Step 2: Run tests**

Run: `npm test`
Expected: still 70+ passing (the 4 new timeline-links tests + existing).

**Step 3: Commit**

```bash
git add 'src/app/api/trips/[tripId]/timeline-events/[eventId]/route.ts'
git commit -m "feat(api): PATCH timeline event (status, date/time, details)"
```

---

## Task 7: PATCH endpoint — by-code (agent)

**Files:**
- Create: `src/app/api/trips/by-code/[inviteCode]/timeline-events/[eventId]/route.ts`

**Step 1: Implement**

Same validation as Task 6 but auth via invite code. Scope the update to the trip resolved from the code.

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { resolveInviteCode } from '@/lib/trip-invite'
import { VALID_STATUSES } from '@/lib/timeline-links'
import { NextResponse } from 'next/server'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MUTABLE_FIELDS = new Set([
  'status', 'start_date', 'start_time', 'end_date', 'end_time', 'details',
])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string; eventId: string }> },
) {
  const securityError = await checkApiSecurity(request, { rateLimiter: byCodeLimiter, checkOrigin: false })
  if (securityError) return securityError

  const { inviteCode, eventId } = await params
  const supabase = createServiceClient()

  const resolved = await resolveInviteCode(supabase, inviteCode, 'id')
  if (!resolved) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  const trip = resolved.trip as { id: string }

  const body = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!MUTABLE_FIELDS.has(key)) continue
    if (key === 'status') {
      if (typeof value !== 'string' || !VALID_STATUSES.has(value)) {
        return NextResponse.json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, { status: 400 })
      }
    }
    if ((key === 'start_date' || key === 'end_date') && value != null) {
      if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be YYYY-MM-DD` }, { status: 400 })
      }
    }
    if ((key === 'start_time' || key === 'end_time') && value != null) {
      if (typeof value !== 'string' || !TIME_24H_RE.test(value)) {
        return NextResponse.json({ error: `${key} must be HH:MM 24h` }, { status: 400 })
      }
    }
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no mutable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('timeline_events')
    .update(update)
    .eq('id', eventId)
    .eq('trip_id', trip.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'event not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

**Step 2: Test and commit**

Run: `npm test && npm run lint`

```bash
git add 'src/app/api/trips/by-code/[inviteCode]/timeline-events/[eventId]/route.ts'
git commit -m "feat(api): agent PATCH for timeline event status/dates"
```

---

## Task 8: Expose new fields on the /summary endpoint

**Files:**
- Modify: `src/app/api/trips/by-code/[inviteCode]/summary/route.ts`

**Step 1:** In the `timeline_events` select, add `id, card_id, status` to the field list:

```typescript
.select('id, type, title, start_date, end_date, start_time, end_time, origin, destination, reference, details, source, card_id, status')
```

The `id` is required so agents can reference an event for PATCH.

**Step 2:** In the results mapping, also expose the card `id` so agents can use explicit `card_id` when POSTing:

```typescript
.select('id, title, tagline, category, metadata')
```

In the returned `results` object, include `id: card.id` alongside the other fields.

**Step 3: Run tests and lint**

Run: `npm test && npm run lint`

**Step 4: Commit**

```bash
git add 'src/app/api/trips/by-code/[inviteCode]/summary/route.ts'
git commit -m "feat(api): summary exposes event id, card id, card_id, status"
```

---

## Task 9: Agent docs

**Files:**
- Modify: `docs/agent-guide.md`
- Modify: `docs/timeline-api.md`

**Step 1: Add a "Committing and visiting cards" section to `docs/agent-guide.md`** with three worked examples:

1. **Commit a card** — agent has `card_id` from `/summary`:
   ```http
   POST /api/trips/by-code/{code}/timeline-events
   {"type":"restaurant","title":"Joe's Pizza","start_date":"2026-04-23","start_time":"19:00","card_id":"<uuid>","status":"planned"}
   ```
2. **Log a spontaneous restaurant visit** (no card):
   ```http
   POST /api/trips/by-code/{code}/timeline-events
   {"type":"restaurant","title":"Noodle House on 5th","start_date":"2026-04-22","status":"visited"}
   ```
3. **Mark a planned entry as visited** — use the event id from `/summary`:
   ```http
   PATCH /api/trips/by-code/{code}/timeline-events/{eventId}
   {"status":"visited"}
   ```

**Step 2: Update `docs/timeline-api.md`** with:
- New `restaurant` type.
- New `status` field on entries (values + transitions).
- New `card_id` and `google_place_id` inputs on POST (explain matching: `card_id` wins; `google_place_id` matches only if exactly one card has it).
- New PATCH endpoint with mutable field list.

**Step 3: Commit**

```bash
git add docs/agent-guide.md docs/timeline-api.md
git commit -m "docs(agent): commit/visit cards via timeline API"
```

---

## Task 10: Server-side trip page — gather planned set

**Files:**
- Modify: `src/app/trips/[tripId]/page.tsx` (the trip hub)

The trip hub already fetches the trip and participants. Extend it to fetch `timeline_events` (id, card_id, status, start_date, start_time) scoped by trip, then compute a `Map<card_id, {event_id, start_date, start_time, status}>` for non-skipped entries. Pass it down to whatever child components need to render the "planned" state on cards.

Concretely, the page likely already renders a sub-component tree that leads to `ResultsCard` via the results page and `SwipeDeck` via the swipe page. Those are separate server components — so:

- **Don't load the map here.** Instead, follow the existing pattern: each page (`results/page.tsx`, `swipe/page.tsx`) is its own server component that fetches what it needs.

Revert any changes to this file and skip this task. (Kept here as a "don't do this" to prevent over-fetching.)

**No-op task.** Delete this task from the plan before execution, or leave the commit out.

---

## Task 11: Results page — planned map

**Files:**
- Modify: `src/app/trips/[tripId]/results/page.tsx`
- Modify: `src/components/ResultsCard.tsx` (or wherever the card row lives in results — find it by reading results/page.tsx)

**Step 1: Fetch planned events on the server**

In the results page, alongside the existing cards+swipes query, add:

```typescript
const { data: events } = await supabase
  .from('timeline_events')
  .select('id, card_id, start_date, start_time, status')
  .eq('trip_id', tripId)
  .not('card_id', 'is', null)
  .neq('status', 'skipped')

const plannedByCard = new Map<string, {
  event_id: string
  start_date: string
  start_time: string | null
  status: 'planned' | 'visited'
}>()
for (const e of events ?? []) {
  if (e.card_id) {
    plannedByCard.set(e.card_id, {
      event_id: e.id,
      start_date: e.start_date,
      start_time: e.start_time,
      status: e.status as 'planned' | 'visited',
    })
  }
}
```

**Step 2: Pass `plannedByCard` down** to the card renderer component as a prop (serialize to a plain object if crossing a client boundary).

**Step 3: Commit (intermediate — no UI change yet, just plumbing)**

```bash
git add 'src/app/trips/[tripId]/results/page.tsx'
git commit -m "chore(results): plumb planned-by-card map to card renderer"
```

---

## Task 12: Results page — "Add to itinerary" button

**Files:**
- Modify: the ResultsCard component identified in Task 11
- Create: `src/components/CommitCardModal.tsx`

**Step 1: Modal component**

`CommitCardModal.tsx` is a client component. Props:

```typescript
type Props = {
  tripId: string
  cardId: string
  cardTitle: string
  cardCategory: 'restaurant' | 'activity' | 'sightseeing'
  tripDateStart: string | null   // ISO, may be null
  tripDateEnd: string | null
  initialEvent?: {               // present when editing an existing entry
    event_id: string
    start_date: string
    start_time: string | null
  }
  onClose: () => void
  onCommitted: (event: { id: string; start_date: string; start_time: string | null; status: string }) => void
}
```

Behavior:
- Renders `<input type="date">` constrained by `min={tripDateStart}` / `max={tripDateEnd}` when both are present.
- `<input type="time">` optional.
- Submit button → `POST /api/trips/{tripId}/timeline-events` (if creating) or `PATCH .../${initialEvent.event_id}` (if editing) with:
  - `type`: `'restaurant'` if `cardCategory === 'restaurant'`, else `'activity'`.
  - `title`: `cardTitle`.
  - `card_id`: `cardId`.
  - `start_date`, `start_time` from the inputs.
  - `status`: `'planned'`.
- Show an error banner on failure; call `onCommitted(row)` and `onClose()` on success.

**Step 2: Card button**

In the ResultsCard component, read `plannedByCard.get(card.id)` from its new prop. Render:

- If no entry: a "📌 Add to itinerary" button that opens `CommitCardModal`.
- If entry with `status === 'planned'`: a "📍 Planned for {formatDate}" chip with a small "Edit" affordance that reopens the modal for update, and a "Remove" link that calls `PATCH` with `{status: 'skipped'}` (or DELETE if you want to delete — prefer PATCH skipped to preserve history; the deck badge filters it out).
- If entry with `status === 'visited'`: a "✅ Visited {formatDate}" chip, no edit (past-facing, rarely re-edited from results).

Keep the chip small — this is a card grid, not a form.

**Step 3: Run lint + visual check**

Run: `npm run lint`
Then: `npm run dev`, open the results page for an existing trip, verify:
- Button appears on every card.
- Clicking opens the modal with the correct date constraints.
- Submitting creates a `planned` event (check via a second browser tab on the timeline page, or query the DB).
- The card flips to the "📍 Planned" chip after success.
- Reopening and editing updates the existing event (don't create duplicates).

**Step 4: Commit**

```bash
git add src/components/CommitCardModal.tsx 'src/app/trips/[tripId]/results' # plus the card component
git commit -m "feat(results): add-to-itinerary modal with edit/remove"
```

---

## Task 13: Swipe deck — planned badge

**Files:**
- Modify: `src/app/trips/[tripId]/swipe/page.tsx`
- Modify: the card face component used by the swipe deck (find by reading swipe/page.tsx)
- Possibly add realtime subscription in a client wrapper

**Step 1: Server-side fetch**

In `swipe/page.tsx`, alongside existing queries, fetch the same non-skipped-event-with-card_id set from Task 11:

```typescript
const { data: events } = await supabase
  .from('timeline_events')
  .select('card_id, status')
  .eq('trip_id', tripId)
  .not('card_id', 'is', null)
  .neq('status', 'skipped')

const plannedCardIds = new Set(
  (events ?? []).filter(e => e.card_id).map(e => e.card_id!)
)
```

Pass `plannedCardIds` (serialized as an array) to the swipe client component.

**Step 2: Render badge**

On the card face, if `plannedCardIds.has(card.id)`, render a small pill in the top-right: "📍 Planned". No interaction; vote still works.

**Step 3: Realtime subscription (live update for other viewers)**

In the swipe client component, subscribe to the `timeline_events` Supabase Realtime channel filtered by `trip_id`. On INSERT/UPDATE/DELETE, refresh the local `plannedCardIds` state:
- INSERT with non-null `card_id` and status not `'skipped'` → add card_id.
- UPDATE where status flipped to/from `'skipped'` → toggle.
- DELETE → remove.

Use the existing client singleton in `src/lib/supabase/client.ts`. Follow the pattern already used in `src/components/SwipeDeck.tsx` (or similar) for swipes.

**Step 4: Verify in browser**

Open two browsers as two different users on the same trip. In one, go to results and commit a card. In the other, swipe page — the badge should appear within a second or so.

**Step 5: Commit**

```bash
git add 'src/app/trips/[tripId]/swipe' src/components # whichever card face got changed
git commit -m "feat(swipe): live Planned badge on committed cards"
```

---

## Task 14: Timeline page — restaurant type + status chips + card thumbnail

**Files:**
- Modify: `src/app/trips/[tripId]/timeline/page.tsx`
- Modify: the event card renderer used by the timeline (find by reading the page)
- Modify: `src/lib/timeline-events.ts` if it enumerates types for icons/labels

**Step 1: Restaurant type support**

Wherever `type` is switched over to pick icon/label/color, add a `restaurant` branch (🍽️ emoji, category color of your choice — reuse the same color palette tone used for `activity`, shifted a notch).

**Step 2: Status chip**

On the event card, if `status !== 'planned'`, render a small chip:
- `visited` → ✓ with accent color.
- `skipped` → strikethrough or muted text.
(Planned is the default, no chip needed.)

**Step 3: Inline card thumbnail when linked**

If `card_id != null`, fetch the linked cards alongside the existing events query:

```typescript
const cardIds = (events ?? [])
  .map(e => e.card_id)
  .filter((x): x is string => !!x)
const { data: linkedCards } = cardIds.length
  ? await supabase.from('cards').select('id, title, tagline, image_url, metadata').in('id', cardIds)
  : { data: [] as any[] }
const cardById = new Map(linkedCards?.map(c => [c.id, c]) ?? [])
```

Pass `cardById` to the event renderer. When rendering an event with `card_id`, show a small thumbnail + tagline row under the existing event content. Don't duplicate the title if `event.title === card.title` — show just the thumbnail + tagline.

**Step 4: Status controls for members**

On the event card, if the current user is a participant, render a small menu or three inline buttons: Mark visited / Mark skipped / Reset to planned. Each POSTs `PATCH /api/trips/{tripId}/timeline-events/{eventId}` with the relevant status. Update local state on success.

**Step 5: Run lint and verify**

Run: `npm run lint`

Manual: visit the timeline for a trip with a planned restaurant; toggle it to visited → chip appears; toggle to skipped → gets muted; reset → chip disappears.

**Step 6: Commit**

```bash
git add 'src/app/trips/[tripId]/timeline' src/components src/lib/timeline-events.ts
git commit -m "feat(timeline): restaurant type, status chips, linked-card thumbnail, status menu"
```

---

## Task 15: Documentation sweep + final check

**Files:**
- Modify: `CLAUDE.md` (if the architecture summary is now stale)

**Step 1:** In `CLAUDE.md`, under "Database (Supabase)" ensure the migration note mentions 025 covers card links / status. Short line is fine; the design doc has the long form.

**Step 2:** Run the full test + lint + build:

```bash
npm test
npm run lint
npm run build
```

All three should succeed.

**Step 3:** Final commit:

```bash
git add CLAUDE.md
git commit -m "docs(claude): note migration 025"
```

---

## Out of scope (don't do)

These are explicitly deferred. Resist scope creep.

- Drag-and-drop itinerary builder.
- Email/push notifications when a card is committed.
- Auto-suggested date based on past visits.
- A `trip.status` column.
- Hiding planned cards from the swipe deck (they stay swipeable per the design).
- Auto-merging agent-created and user-created visits for the same place.

---

## Done criteria

- Migration 025 applied; `timeline_events` has `card_id`, `status`, and accepts `restaurant` type.
- Both POST endpoints accept `card_id`, `status`, and (agent) `google_place_id`.
- Both PATCH endpoints work for status/date/details.
- `/summary` returns `id`, `card_id`, `status` on events and `id` on results.
- Agent docs show worked examples for commit / log-visit / mark-visited.
- Results page has an Add-to-itinerary button that creates a linked timeline event.
- Swipe deck shows a "Planned" badge that updates live.
- Timeline page renders restaurants distinctly, shows status chips, embeds the linked card's thumbnail, and has a Mark-visited/Mark-skipped control.
- `npm test`, `npm run lint`, and `npm run build` all pass.
