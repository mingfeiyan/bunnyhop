# Bunnyhop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a collaborative travel planning web app where groups swipe on AI-generated activity cards to discover shared preferences.

**Architecture:** Next.js App Router frontend with Supabase (Postgres + Auth + Realtime) backend. Claude API generates recommendation cards from trip context, Google Places API provides photos. Real-time subscriptions keep the results dashboard live.

**Tech Stack:** Next.js 15, Tailwind CSS 4, Supabase (auth, database, realtime), Claude API (Anthropic SDK), Google Places API, Vitest, TypeScript

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Create Next.js app with Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This scaffolds the entire project.

**Step 2: Verify it runs**

```bash
npm run dev
```

Expected: App running on localhost:3000

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind project"
```

### Task 2: Install core dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Supabase, Anthropic SDK, and test tooling**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

**Step 2: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Create test setup file**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 4: Add test script to package.json**

Add to `scripts`: `"test": "vitest run", "test:watch": "vitest"`

**Step 5: Verify tests can run**

```bash
npm test
```

Expected: "No test files found" (that's fine, confirms vitest works)

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Supabase, Anthropic SDK, Vitest dependencies"
```

### Task 3: Set up environment variables and Supabase client

**Files:**
- Create: `.env.local`, `.env.example`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Modify: `.gitignore`

**Step 1: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

**Step 2: Create `.env.local`** with actual values (user must fill in)

Copy `.env.example` to `.env.local`. User fills in their Supabase project URL and anon key from Supabase dashboard (Settings > API).

**Step 3: Verify `.env.local` is in `.gitignore`**

Next.js already gitignores `.env.local`, but verify.

**Step 4: Create browser Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 5: Create server Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 6: Commit**

```bash
git add .env.example src/lib/supabase/
git commit -m "chore: set up Supabase client (browser + server)"
```

### Task 4: Set up Supabase auth middleware

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/lib/supabase/server.ts`

**Step 1: Create auth middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except public routes)
  const publicRoutes = ['/login', '/auth/callback', '/invite']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  if (!user && !isPublicRoute && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Supabase auth middleware with protected routes"
```

---

## Phase 2: Database Schema

### Task 5: Create database migration — core tables

**Files:**
- Create: `supabase/migrations/001_core_schema.sql`

**Step 1: Write the migration**

Create `supabase/migrations/001_core_schema.sql`:

```sql
-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text not null,
  date_start date not null,
  date_end date not null,
  created_by uuid references auth.users(id) not null,
  invite_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz default now()
);

-- Trip Participants
create table trip_participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null default 'member' check (role in ('organizer', 'member')),
  created_at timestamptz default now(),
  unique (trip_id, user_id)
);

-- Trip Context
create table trip_context (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null check (type in ('flight', 'hotel', 'constraint', 'note')),
  raw_text text not null,
  details jsonb default '{}'::jsonb,
  added_by uuid references auth.users(id) not null,
  source text not null default 'manual' check (source in ('manual', 'email', 'agent')),
  created_at timestamptz default now()
);

-- Cards
create table cards (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  title text not null,
  tagline text,
  description text,
  category text not null check (category in ('restaurant', 'activity', 'sightseeing')),
  source text not null default 'ai_generated' check (source in ('ai_generated', 'user_added')),
  image_url text,
  metadata jsonb default '{}'::jsonb,
  added_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Swipes
create table swipes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  preference text not null check (preference in ('want', 'pass', 'indifferent')),
  created_at timestamptz default now(),
  unique (card_id, user_id)
);

-- Indexes
create index idx_trip_participants_trip on trip_participants(trip_id);
create index idx_trip_participants_user on trip_participants(user_id);
create index idx_trip_context_trip on trip_context(trip_id);
create index idx_cards_trip on cards(trip_id);
create index idx_swipes_card on swipes(card_id);
create index idx_swipes_user on swipes(user_id);
create index idx_trips_invite_code on trips(invite_code);
```

**Step 2: Apply migration**

Run this SQL in the Supabase dashboard SQL Editor (Project > SQL Editor > New query > paste > Run). Or if Supabase CLI is set up:

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add core database schema — trips, participants, context, cards, swipes"
```

### Task 6: Create Row Level Security policies

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

**Step 1: Write RLS policies**

Create `supabase/migrations/002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
alter table trips enable row level security;
alter table trip_participants enable row level security;
alter table trip_context enable row level security;
alter table cards enable row level security;
alter table swipes enable row level security;

-- Trips: participants can read, creator can insert
create policy "Participants can view trips"
  on trips for select
  using (id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Anyone can read trip by invite code"
  on trips for select
  using (true);

create policy "Authenticated users can create trips"
  on trips for insert
  with check (auth.uid() = created_by);

-- Trip Participants: participants can view co-participants, users can join
create policy "Participants can view co-participants"
  on trip_participants for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Users can join trips"
  on trip_participants for insert
  with check (auth.uid() = user_id);

-- Trip Context: participants can read and add
create policy "Participants can view trip context"
  on trip_context for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Participants can add context"
  on trip_context for insert
  with check (
    auth.uid() = added_by
    and trip_id in (select trip_id from trip_participants where user_id = auth.uid())
  );

-- Cards: participants can read, participants and system can insert
create policy "Participants can view cards"
  on cards for select
  using (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

create policy "Participants can add cards"
  on cards for insert
  with check (trip_id in (select trip_id from trip_participants where user_id = auth.uid()));

-- Swipes: participants can read and insert their own
create policy "Participants can view swipes"
  on swipes for select
  using (card_id in (
    select id from cards where trip_id in (
      select trip_id from trip_participants where user_id = auth.uid()
    )
  ));

create policy "Users can swipe"
  on swipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their swipe"
  on swipes for update
  using (auth.uid() = user_id);
```

**Step 2: Apply in Supabase SQL Editor**

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add Row Level Security policies for all tables"
```

### Task 7: Enable Supabase Realtime

**Files:**
- Create: `supabase/migrations/003_realtime.sql`

**Step 1: Enable realtime on relevant tables**

Create `supabase/migrations/003_realtime.sql`:

```sql
alter publication supabase_realtime add table swipes;
alter publication supabase_realtime add table trip_context;
alter publication supabase_realtime add table cards;
```

**Step 2: Apply in Supabase SQL Editor**

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: enable Supabase Realtime on swipes, context, and cards tables"
```

---

## Phase 3: Authentication

### Task 8: Create login page with Google OAuth

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`

**Step 1: Create OAuth callback handler**

Create `src/app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/trips'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

**Step 2: Create login page**

Create `src/app/login/page.tsx`:

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-2">Bunnyhop</h1>
        <p className="text-gray-500 mb-8">Plan trips together, the fun way</p>
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
```

**Step 3: Configure Google OAuth in Supabase**

In Supabase dashboard: Authentication > Providers > Google > Enable. Add Google OAuth client ID and secret (from Google Cloud Console).

**Step 4: Commit**

```bash
git add src/app/login/ src/app/auth/
git commit -m "feat: add Google OAuth login page and callback handler"
```

---

## Phase 4: Trip Management

### Task 9: Define TypeScript types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create types file**

Create `src/types/index.ts`:

```typescript
export type Trip = {
  id: string
  title: string
  destination: string
  date_start: string
  date_end: string
  created_by: string
  invite_code: string
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
```

**Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for all database entities"
```

### Task 10: Build trip creation page

**Files:**
- Create: `src/app/trips/new/page.tsx`

**Step 1: Write the failing test**

Create `src/test/trips-new.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NewTripPage from '@/app/trips/new/page'

describe('NewTripPage', () => {
  it('renders the trip creation form fields', () => {
    render(<NewTripPage />)
    expect(screen.getByLabelText(/destination/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/trip name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create trip/i })).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/test/trips-new.test.tsx
```

Expected: FAIL

**Step 3: Implement the trip creation page**

Create `src/app/trips/new/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewTripPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const destination = formData.get('destination') as string
    const dateStart = formData.get('date_start') as string
    const dateEnd = formData.get('date_end') as string

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({ title, destination, date_start: dateStart, date_end: dateEnd, created_by: user.id })
      .select()
      .single()

    if (error) {
      setLoading(false)
      return
    }

    // Add creator as organizer
    await supabase
      .from('trip_participants')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'organizer' })

    router.push(`/trips/${trip.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">New Trip</h1>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
          <input id="destination" name="destination" type="text" required placeholder="Bora Bora, French Polynesia"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Trip Name</label>
          <input id="title" name="title" type="text" required placeholder="Summer 2026 Family Trip"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date_start" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input id="date_start" name="date_start" type="date" required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label htmlFor="date_end" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input id="date_end" name="date_end" type="date" required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 disabled:opacity-50 transition">
          {loading ? 'Creating...' : 'Create Trip'}
        </button>
      </form>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/test/trips-new.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/trips/new/ src/test/trips-new.test.tsx
git commit -m "feat: add trip creation page with form"
```

### Task 11: Build trip list page (home after login)

**Files:**
- Create: `src/app/trips/page.tsx`

**Step 1: Implement trip list page**

Create `src/app/trips/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TripsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: participations } = await supabase
    .from('trip_participants')
    .select('trip_id, role, trips(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const trips = participations?.map(p => ({ ...p.trips as Record<string, unknown>, role: p.role })) ?? []

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Trips</h1>
          <Link href="/trips/new"
            className="bg-blue-600 text-white font-medium rounded-lg px-4 py-2 hover:bg-blue-700 transition">
            New Trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No trips yet</p>
            <p>Create your first trip to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip: any) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition">
                <h2 className="font-semibold text-lg">{trip.title}</h2>
                <p className="text-gray-500">{trip.destination}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(trip.date_start).toLocaleDateString()} — {new Date(trip.date_end).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Update root page to redirect to trips**

Modify `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/trips')
}
```

**Step 3: Commit**

```bash
git add src/app/trips/page.tsx src/app/page.tsx
git commit -m "feat: add trip list page and root redirect"
```

### Task 12: Build Trip Hub page

**Files:**
- Create: `src/app/trips/[tripId]/page.tsx`

**Step 1: Implement Trip Hub**

Create `src/app/trips/[tripId]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TripContextSection from '@/components/TripContextSection'

export default async function TripHubPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) notFound()

  const { data: participants } = await supabase
    .from('trip_participants')
    .select('*, user:user_id(id, raw_user_meta_data)')
    .eq('trip_id', tripId)

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('trip_id', tripId)

  const { data: { user } } = await supabase.auth.getUser()
  const cardCount = cards?.length ?? 0
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${trip.invite_code}`

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <Link href="/trips" className="text-sm text-blue-600 mb-2 block">&larr; All Trips</Link>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-gray-500">{trip.destination}</p>
          <p className="text-sm text-gray-400">
            {new Date(trip.date_start).toLocaleDateString()} — {new Date(trip.date_end).toLocaleDateString()}
          </p>

          {/* Participant avatars */}
          <div className="flex items-center gap-2 mt-4">
            {participants?.map((p: any) => (
              <div key={p.user_id} className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-sm font-medium text-blue-700"
                title={p.user?.raw_user_meta_data?.full_name ?? 'Member'}>
                {(p.user?.raw_user_meta_data?.full_name ?? '?')[0]}
              </div>
            ))}
          </div>

          {/* Invite link */}
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="mt-3 text-sm text-blue-600 hover:underline">
            Copy invite link
          </button>
        </div>

        {/* Context */}
        <TripContextSection tripId={tripId} />

        {/* Discover */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-2">Discover</h2>
          {cardCount > 0 ? (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">{cardCount} cards in the deck</p>
              <Link href={`/trips/${tripId}/swipe`}
                className="block w-full text-center bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 transition">
                Start Swiping
              </Link>
            </div>
          ) : (
            <Link href={`/trips/${tripId}/generate`}
              className="block w-full text-center bg-green-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-green-700 transition">
              Generate Recommendations
            </Link>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-2">Group Results</h2>
          <Link href={`/trips/${tripId}/results`}
            className="text-blue-600 hover:underline text-sm">
            View results &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
```

Note: the `<button onClick>` for invite link copy requires making a small client wrapper. For now this is fine as a server component — we'll extract the interactive parts in a later task.

**Step 2: Commit**

```bash
git add src/app/trips/\\[tripId\\]/
git commit -m "feat: add Trip Hub page with context, discover, and results sections"
```

### Task 13: Build invite join flow

**Files:**
- Create: `src/app/invite/[code]/page.tsx`

**Step 1: Implement invite page**

Create `src/app/invite/[code]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // Find the trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('invite_code', code)
    .single()

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid invite link</p>
      </div>
    )
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login with return URL
    redirect(`/login?next=/invite/${code}`)
  }

  // Check if already a participant
  const { data: existing } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    // Join the trip
    await supabase
      .from('trip_participants')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'member' })
  }

  redirect(`/trips/${trip.id}`)
}
```

**Step 2: Commit**

```bash
git add src/app/invite/
git commit -m "feat: add invite link join flow"
```

---

## Phase 5: Trip Context

### Task 14: Build trip context input component

**Files:**
- Create: `src/components/TripContextSection.tsx`

**Step 1: Implement the context section with free-form input**

Create `src/components/TripContextSection.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TripContext } from '@/types'

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  constraint: '⚠️',
  note: '📝',
}

export default function TripContextSection({ tripId }: { tripId: string }) {
  const supabase = createClient()
  const [contexts, setContexts] = useState<TripContext[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Fetch existing context
    supabase
      .from('trip_context')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setContexts(data) })

    // Subscribe to new context
    const channel = supabase
      .channel(`trip-context-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_context',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        setContexts(prev => [...prev, payload.new as TripContext])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)

    // Send to API for AI parsing
    const res = await fetch(`/api/trips/${tripId}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    })

    if (res.ok) {
      setInput('')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-lg mb-3">Trip Details</h2>

      {/* Context list */}
      <div className="space-y-2 mb-4">
        {contexts.map(ctx => (
          <div key={ctx.id} className="flex items-start gap-2 text-sm">
            <span>{TYPE_ICONS[ctx.type] ?? '📋'}</span>
            <div>
              <p className="text-gray-800">{ctx.raw_text}</p>
              <p className="text-xs text-gray-400 capitalize">{ctx.source}</p>
            </div>
          </div>
        ))}
        {contexts.length === 0 && (
          <p className="text-sm text-gray-400">No details added yet. Add flights, hotels, or any constraints.</p>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Flying Air Tahiti, arrive July 5 at 2pm"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button type="submit" disabled={loading}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          Add
        </button>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/TripContextSection.tsx
git commit -m "feat: add trip context section with realtime updates"
```

### Task 15: Build context parsing API route

**Files:**
- Create: `src/app/api/trips/[tripId]/context/route.ts`, `src/lib/claude.ts`

**Step 1: Create Claude client helper**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function parseContext(text: string): Promise<{
  type: 'flight' | 'hotel' | 'constraint' | 'note'
  details: Record<string, unknown>
}> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Parse this travel context into structured data. Return JSON only, no markdown.

Text: "${text}"

Return format:
{
  "type": "flight" | "hotel" | "constraint" | "note",
  "details": { ... extracted structured fields ... }
}

For flights: extract airline, flight_number, departure_time, arrival_time, date, origin, destination.
For hotels: extract name, address, check_in, check_out.
For constraints: extract constraint description and who it applies to.
For anything else: type is "note", details has a "summary" field.`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return { type: 'note', details: { summary: text } }
  }

  try {
    return JSON.parse(content.text)
  } catch {
    return { type: 'note', details: { summary: text } }
  }
}
```

**Step 2: Create the API route**

Create `src/app/api/trips/[tripId]/context/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a participant
  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const { text } = await request.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  // Parse with AI
  const parsed = await parseContext(text)

  // Store in database
  const { data, error } = await supabase
    .from('trip_context')
    .insert({
      trip_id: tripId,
      type: parsed.type,
      raw_text: text,
      details: parsed.details,
      added_by: user.id,
      source: 'manual',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 3: Commit**

```bash
git add src/lib/claude.ts src/app/api/trips/\\[tripId\\]/context/
git commit -m "feat: add context parsing API route with Claude integration"
```

### Task 16: Build agent API endpoint for external context ingestion

**Files:**
- Create: `src/app/api/trips/by-code/[inviteCode]/context/route.ts`

**Step 1: Implement agent-facing API**

Create `src/app/api/trips/by-code/[inviteCode]/context/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { parseContext } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params
  const supabase = await createClient()

  // Find trip by invite code
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('invite_code', inviteCode)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  // Auth: user must be logged in and a participant
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: participant } = await supabase
    .from('trip_participants')
    .select('id')
    .eq('trip_id', trip.id)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Not a trip participant' }, { status: 403 })
  }

  const { text } = await request.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  const parsed = await parseContext(text)

  const { data, error } = await supabase
    .from('trip_context')
    .insert({
      trip_id: trip.id,
      type: parsed.type,
      raw_text: text,
      details: parsed.details,
      added_by: user.id,
      source: 'agent',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 2: Commit**

```bash
git add src/app/api/trips/by-code/
git commit -m "feat: add agent API endpoint for external context ingestion"
```

---

## Phase 6: Card Generation

### Task 17: Build card generation with Claude

**Files:**
- Create: `src/lib/card-generator.ts`, `src/app/api/trips/[tripId]/generate/route.ts`

**Step 1: Create the card generation module**

Create `src/lib/card-generator.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { TripContext } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type GeneratedCard = {
  title: string
  tagline: string
  description: string
  category: 'restaurant' | 'activity' | 'sightseeing'
  metadata: {
    price_range?: string
    hours?: string
    address?: string
    duration?: string
    kid_friendly?: boolean
    booking_required?: boolean
    rating?: number
    why_this?: string
    photo_search_query?: string
  }
}

export async function generateCards(
  destination: string,
  dateStart: string,
  dateEnd: string,
  contexts: TripContext[],
  existingTitles: string[] = []
): Promise<GeneratedCard[]> {
  const contextSummary = contexts
    .map(c => `[${c.type}] ${c.raw_text}`)
    .join('\n')

  const existingList = existingTitles.length > 0
    ? `\n\nAlready suggested (do NOT duplicate): ${existingTitles.join(', ')}`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a travel recommendation expert. Generate 20-25 recommendations for a trip.

Destination: ${destination}
Dates: ${dateStart} to ${dateEnd}
${contextSummary ? `\nTrip context:\n${contextSummary}` : ''}
${existingList}

Return a JSON array (no markdown, no code fences) of recommendations. Mix of restaurants (8-10), activities (8-10), and sightseeing (4-6).

Each item:
{
  "title": "Place name",
  "tagline": "One punchy, fun sentence — magazine style, not Yelp",
  "description": "2-3 sentences about the experience. What makes it special.",
  "category": "restaurant" | "activity" | "sightseeing",
  "metadata": {
    "price_range": "$" | "$$" | "$$$" | "$$$$",
    "duration": "e.g. 2 hours",
    "kid_friendly": true/false,
    "booking_required": true/false,
    "why_this": "1-2 sentences about why this is a great fit for THIS specific group based on their context",
    "photo_search_query": "specific Google Places search query to find a good photo of this place"
  }
}

Make taglines engaging and personality-filled. Use the trip context to personalize recommendations.`
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return []

  try {
    return JSON.parse(content.text)
  } catch {
    // Try to extract JSON from the response if wrapped in markdown
    const match = content.text.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    return []
  }
}
```

**Step 2: Create the generate API route**

Create `src/app/api/trips/[tripId]/generate/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { generateCards } from '@/lib/card-generator'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Get existing context
  const { data: contexts } = await supabase
    .from('trip_context')
    .select('*')
    .eq('trip_id', tripId)

  // Get existing card titles to avoid duplicates
  const { data: existingCards } = await supabase
    .from('cards')
    .select('title')
    .eq('trip_id', tripId)

  const existingTitles = existingCards?.map(c => c.title) ?? []

  // Generate cards
  const generated = await generateCards(
    trip.destination,
    trip.date_start,
    trip.date_end,
    contexts ?? [],
    existingTitles
  )

  // Insert cards
  const cardsToInsert = generated.map(card => ({
    trip_id: tripId,
    title: card.title,
    tagline: card.tagline,
    description: card.description,
    category: card.category,
    source: 'ai_generated' as const,
    metadata: card.metadata,
    added_by: user.id,
  }))

  const { data: inserted, error } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cards: inserted, count: inserted?.length })
}
```

**Step 3: Commit**

```bash
git add src/lib/card-generator.ts src/app/api/trips/\\[tripId\\]/generate/
git commit -m "feat: add AI card generation with Claude — batch generation from trip context"
```

### Task 18: Add Google Places photo fetching

**Files:**
- Create: `src/lib/google-places.ts`, `src/app/api/photos/route.ts`

**Step 1: Create Google Places helper**

Create `src/lib/google-places.ts`:

```typescript
export async function searchPlacePhoto(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return null

  // Search for a place
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=photos,place_id&key=${apiKey}`
  )
  const searchData = await searchRes.json()

  const place = searchData.candidates?.[0]
  if (!place?.photos?.[0]?.photo_reference) return null

  // Return the photo URL (proxied through our API to avoid exposing the key)
  return `/api/photos?ref=${place.photos[0].photo_reference}`
}

export function getPhotoUrl(photoReference: string): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${apiKey}`
}
```

**Step 2: Create photo proxy route**

Create `src/app/api/photos/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!ref || !apiKey) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${apiKey}`
  const res = await fetch(photoUrl)
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
```

**Step 3: Commit**

```bash
git add src/lib/google-places.ts src/app/api/photos/
git commit -m "feat: add Google Places photo search and proxy route"
```

---

## Phase 7: Card Experience

### Task 19: Build the flip card component

**Files:**
- Create: `src/components/FlipCard.tsx`

**Step 1: Write the failing test**

Create `src/test/flip-card.test.tsx`:

```typescript
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
  it('renders the card front with title and tagline', () => {
    render(<FlipCard card={mockCard} />)
    expect(screen.getByText('Matiras Beach')).toBeInTheDocument()
    expect(screen.getByText('The best beach you will ever see')).toBeInTheDocument()
  })

  it('shows the back with details after clicking', () => {
    render(<FlipCard card={mockCard} />)
    fireEvent.click(screen.getByText('Matiras Beach'))
    expect(screen.getByText(/Perfect for families/)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/test/flip-card.test.tsx
```

Expected: FAIL

**Step 3: Implement the flip card**

Create `src/components/FlipCard.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Card } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-500',
  activity: 'bg-blue-500',
  sightseeing: 'bg-green-500',
}

export default function FlipCard({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="w-full aspect-[3/4] cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Photo */}
          <div className="absolute inset-0 bg-gray-200">
            {card.image_url && (
              <img src={card.image_url} alt={card.title} className="w-full h-full object-cover" />
            )}
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Category badge */}
          <div className={`absolute top-4 right-4 ${CATEGORY_COLORS[card.category]} text-white text-xs font-medium px-2.5 py-1 rounded-full capitalize`}>
            {card.category}
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-white text-2xl font-bold mb-1">{card.title}</h2>
            {card.tagline && (
              <p className="text-white/80 text-sm italic">{card.tagline}</p>
            )}
            {/* Detail chips */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {card.metadata.price_range && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">{card.metadata.price_range}</span>
              )}
              {card.metadata.duration && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">{card.metadata.duration}</span>
              )}
              {card.metadata.kid_friendly && (
                <span className="bg-white/20 text-white text-xs px-2 py-1 rounded-full">Kid-friendly</span>
              )}
            </div>
          </div>

          {/* Tap hint */}
          <div className="absolute top-4 left-4 bg-white/20 text-white text-xs px-2 py-1 rounded-full">
            Tap for details
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg bg-white p-6 flex flex-col"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className={`${CATEGORY_COLORS[card.category]} text-white text-xs font-medium px-2.5 py-1 rounded-full capitalize self-start mb-3`}>
            {card.category}
          </div>

          <h2 className="text-xl font-bold mb-3">{card.title}</h2>

          {card.metadata.why_this && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-1">Why this?</h3>
              <p className="text-sm text-gray-700">{card.metadata.why_this}</p>
            </div>
          )}

          {card.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
          )}

          <div className="mt-auto space-y-2 text-sm text-gray-600">
            {card.metadata.address && <p>📍 {card.metadata.address}</p>}
            {card.metadata.hours && <p>🕐 {card.metadata.hours}</p>}
            {card.metadata.booking_required && <p>📋 Booking required</p>}
            {card.metadata.duration && <p>⏱️ {card.metadata.duration}</p>}
          </div>

          {card.metadata.review_snippets && card.metadata.review_snippets.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">What people say</h3>
              {card.metadata.review_snippets.map((review, i) => (
                <p key={i} className="text-xs text-gray-500 italic mb-1">"{review}"</p>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-3 text-center">Tap to flip back</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/test/flip-card.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/FlipCard.tsx src/test/flip-card.test.tsx
git commit -m "feat: add FlipCard component with 3D flip animation, front/back views"
```

### Task 20: Build the swipe deck component

**Files:**
- Create: `src/components/SwipeDeck.tsx`

**Step 1: Implement swipe deck with gesture handling**

Create `src/components/SwipeDeck.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import type { Card } from '@/types'
import FlipCard from './FlipCard'

type SwipeDirection = 'want' | 'pass' | 'indifferent'

type Props = {
  cards: Card[]
  onSwipe: (cardId: string, preference: SwipeDirection) => void
}

export default function SwipeDeck({ cards, onSwipe }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const startPos = useRef({ x: 0, y: 0 })

  const currentCard = cards[currentIndex]
  const isComplete = currentIndex >= cards.length

  function handlePointerDown(e: React.PointerEvent) {
    setIsDragging(true)
    startPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging) return
    setDragOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    })
  }

  function handlePointerUp() {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 100

    if (dragOffset.x > threshold) {
      swipe('want')
    } else if (dragOffset.x < -threshold) {
      swipe('pass')
    } else if (dragOffset.y < -threshold) {
      swipe('indifferent')
    } else {
      setDragOffset({ x: 0, y: 0 })
    }
  }

  function swipe(direction: SwipeDirection) {
    if (!currentCard) return
    onSwipe(currentCard.id, direction)
    setDragOffset({ x: 0, y: 0 })
    setCurrentIndex(i => i + 1)
  }

  // Visual feedback color
  function getOverlayColor() {
    if (dragOffset.x > 50) return 'rgba(34, 197, 94, 0.3)' // green - want
    if (dragOffset.x < -50) return 'rgba(239, 68, 68, 0.3)' // red - pass
    if (dragOffset.y < -50) return 'rgba(59, 130, 246, 0.3)' // blue - indifferent
    return 'transparent'
  }

  function getSwipeLabel() {
    if (dragOffset.x > 50) return 'WANT'
    if (dragOffset.x < -50) return 'PASS'
    if (dragOffset.y < -50) return 'MEH'
    return null
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-2xl font-bold mb-2">All done!</p>
        <p className="text-gray-500">You've swiped through all {cards.length} cards.</p>
      </div>
    )
  }

  const rotation = dragOffset.x * 0.1

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Progress */}
      <p className="text-center text-sm text-gray-400 mb-4">
        {currentIndex + 1} / {cards.length}
      </p>

      {/* Card stack */}
      <div className="relative aspect-[3/4]">
        {/* Next card (peeking behind) */}
        {currentIndex + 1 < cards.length && (
          <div className="absolute inset-0 scale-95 opacity-50">
            <FlipCard card={cards[currentIndex + 1]} />
          </div>
        )}

        {/* Current card */}
        <div
          className="absolute inset-0 touch-none"
          style={{
            transform: `translateX(${dragOffset.x}px) translateY(${Math.min(dragOffset.y, 0)}px) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Swipe feedback overlay */}
          <div
            className="absolute inset-0 rounded-2xl z-10 pointer-events-none flex items-center justify-center"
            style={{ backgroundColor: getOverlayColor() }}
          >
            {getSwipeLabel() && (
              <span className="text-4xl font-black text-white drop-shadow-lg">
                {getSwipeLabel()}
              </span>
            )}
          </div>

          <FlipCard card={currentCard} />
        </div>
      </div>

      {/* Manual swipe buttons (fallback) */}
      <div className="flex justify-center gap-6 mt-6">
        <button onClick={() => swipe('pass')}
          className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-2xl hover:bg-red-200 transition">
          ✕
        </button>
        <button onClick={() => swipe('indifferent')}
          className="w-14 h-14 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-xl hover:bg-blue-200 transition">
          —
        </button>
        <button onClick={() => swipe('want')}
          className="w-14 h-14 rounded-full bg-green-100 text-green-500 flex items-center justify-center text-2xl hover:bg-green-200 transition">
          ♥
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SwipeDeck.tsx
git commit -m "feat: add SwipeDeck component with drag gestures and swipe buttons"
```

### Task 21: Build the swipe page

**Files:**
- Create: `src/app/trips/[tripId]/swipe/page.tsx`

**Step 1: Implement the swipe page**

Create `src/app/trips/[tripId]/swipe/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SwipeDeck from '@/components/SwipeDeck'
import type { Card } from '@/types'

export default function SwipePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCards() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all cards for this trip
      const { data: allCards } = await supabase
        .from('cards')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at')

      // Get user's existing swipes
      const { data: swipes } = await supabase
        .from('swipes')
        .select('card_id')
        .eq('user_id', user.id)

      const swipedCardIds = new Set(swipes?.map(s => s.card_id) ?? [])

      // Filter to unswiped cards only
      const unswiped = (allCards ?? []).filter(c => !swipedCardIds.has(c.id))
      setCards(unswiped)
      setLoading(false)
    }

    loadCards()
  }, [tripId, supabase])

  async function handleSwipe(cardId: string, preference: 'want' | 'pass' | 'indifferent') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('swipes')
      .upsert({ card_id: cardId, user_id: user.id, preference })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading cards...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-sm mx-auto">
        <button onClick={() => router.push(`/trips/${tripId}`)}
          className="text-sm text-blue-600 mb-4 block">&larr; Back to trip</button>

        <SwipeDeck cards={cards} onSwipe={handleSwipe} />
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/trips/\\[tripId\\]/swipe/
git commit -m "feat: add swipe page — loads unswiped cards and records preferences"
```

---

## Phase 8: Results Dashboard

### Task 22: Build the results page

**Files:**
- Create: `src/app/trips/[tripId]/results/page.tsx`, `src/components/ResultsCard.tsx`

**Step 1: Create results card component**

Create `src/components/ResultsCard.tsx`:

```typescript
'use client'

import type { SwipeResult } from '@/types'

const CONSENSUS_STYLES = {
  everyone_loves: { bg: 'bg-green-50', border: 'border-green-200', label: 'Everyone loves' },
  mixed: { bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Mixed feelings' },
  hard_pass: { bg: 'bg-red-50', border: 'border-red-200', label: 'Hard pass' },
}

const PREF_COLORS = {
  want: 'bg-green-400',
  pass: 'bg-red-400',
  indifferent: 'bg-gray-300',
}

export default function ResultsCard({ result }: { result: SwipeResult }) {
  const style = CONSENSUS_STYLES[result.consensus]

  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{result.title}</h3>
          {result.tagline && (
            <p className="text-sm text-gray-500 italic">{result.tagline}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 capitalize">{result.category}</span>
      </div>

      {/* Swipe dots */}
      <div className="flex gap-1.5 mt-3">
        {result.swipes.map(swipe => (
          <div
            key={swipe.user_id}
            className={`w-6 h-6 rounded-full ${PREF_COLORS[swipe.preference]} flex items-center justify-center text-xs text-white font-medium`}
            title={`${swipe.preference}`}
          >
            {swipe.preference === 'want' ? '♥' : swipe.preference === 'pass' ? '✕' : '—'}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create results page**

Create `src/app/trips/[tripId]/results/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ResultsCard from '@/components/ResultsCard'
import type { Card, Swipe, SwipeResult } from '@/types'
import Link from 'next/link'

function computeResults(cards: Card[], swipes: Swipe[]): SwipeResult[] {
  const swipesByCard = new Map<string, Swipe[]>()
  swipes.forEach(s => {
    const existing = swipesByCard.get(s.card_id) ?? []
    existing.push(s)
    swipesByCard.set(s.card_id, existing)
  })

  return cards.map(card => {
    const cardSwipes = swipesByCard.get(card.id) ?? []
    const score = cardSwipes.reduce((sum, s) => {
      if (s.preference === 'want') return sum + 1
      if (s.preference === 'pass') return sum - 1
      return sum
    }, 0)

    const hasPasses = cardSwipes.some(s => s.preference === 'pass')
    const allWant = cardSwipes.length > 0 && cardSwipes.every(s => s.preference === 'want')

    let consensus: 'everyone_loves' | 'mixed' | 'hard_pass'
    if (allWant) consensus = 'everyone_loves'
    else if (hasPasses) consensus = 'hard_pass'
    else consensus = 'mixed'

    return { ...card, swipes: cardSwipes, score, consensus }
  }).sort((a, b) => b.score - a.score)
}

type FilterCategory = 'all' | 'restaurant' | 'activity' | 'sightseeing'

export default function ResultsPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const supabase = createClient()
  const [results, setResults] = useState<SwipeResult[]>([])
  const [filter, setFilter] = useState<FilterCategory>('all')

  useEffect(() => {
    async function load() {
      const [{ data: cards }, { data: swipes }] = await Promise.all([
        supabase.from('cards').select('*').eq('trip_id', tripId),
        supabase.from('swipes').select('*').in(
          'card_id',
          (await supabase.from('cards').select('id').eq('trip_id', tripId)).data?.map(c => c.id) ?? []
        ),
      ])

      setResults(computeResults(cards ?? [], swipes ?? []))
    }

    load()

    // Realtime subscription for new swipes
    const channel = supabase
      .channel(`results-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'swipes',
      }, () => {
        load() // Reload on any new swipe
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tripId, supabase])

  const filtered = filter === 'all' ? results : results.filter(r => r.category === filter)

  const everyoneLoves = filtered.filter(r => r.consensus === 'everyone_loves')
  const mixed = filtered.filter(r => r.consensus === 'mixed')
  const hardPass = filtered.filter(r => r.consensus === 'hard_pass')

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <Link href={`/trips/${tripId}`} className="text-sm text-blue-600">&larr; Back to trip</Link>

        <h1 className="text-2xl font-bold">Group Results</h1>

        {/* Category filter */}
        <div className="flex gap-2">
          {(['all', 'restaurant', 'activity', 'sightseeing'] as FilterCategory[]).map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition ${
                filter === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Everyone Loves */}
        {everyoneLoves.length > 0 && (
          <section>
            <h2 className="font-semibold text-green-700 mb-2">Everyone Loves ({everyoneLoves.length})</h2>
            <div className="space-y-2">
              {everyoneLoves.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {/* Mixed */}
        {mixed.length > 0 && (
          <section>
            <h2 className="font-semibold text-yellow-700 mb-2">Mixed Feelings ({mixed.length})</h2>
            <div className="space-y-2">
              {mixed.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {/* Hard Pass */}
        {hardPass.length > 0 && (
          <section>
            <h2 className="font-semibold text-red-700 mb-2">Hard Pass ({hardPass.length})</h2>
            <div className="space-y-2">
              {hardPass.map(r => <ResultsCard key={r.id} result={r} />)}
            </div>
          </section>
        )}

        {filtered.length === 0 && (
          <p className="text-gray-400 text-center py-8">No results yet. Start swiping!</p>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/ResultsCard.tsx src/app/trips/\\[tripId\\]/results/
git commit -m "feat: add results dashboard with live updates, category filtering, consensus groups"
```

---

## Phase 9: Custom Cards & Polish

### Task 23: Add custom card creation

**Files:**
- Create: `src/components/AddCardModal.tsx`

**Step 1: Implement the add card modal**

Create `src/components/AddCardModal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  tripId: string
  onClose: () => void
  onAdded: () => void
}

export default function AddCardModal({ tripId, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('cards').insert({
      trip_id: tripId,
      title: form.get('title') as string,
      tagline: form.get('tagline') as string || null,
      description: form.get('description') as string || null,
      category: form.get('category') as string,
      source: 'user_added',
      metadata: {},
      added_by: user.id,
    })

    setLoading(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold">Add a Recommendation</h2>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input id="title" name="title" required placeholder="Amazing Sushi Place"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label htmlFor="tagline" className="block text-sm font-medium text-gray-700 mb-1">One-liner (optional)</label>
          <input id="tagline" name="tagline" placeholder="Best sushi outside of Japan"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select id="category" name="category" required className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="restaurant">Restaurant</option>
            <option value="activity">Activity</option>
            <option value="sightseeing">Sightseeing</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Why should we go? (optional)</label>
          <textarea id="description" name="description" rows={3} placeholder="My coworker said this place is incredible..."
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Card'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Wire the modal into the swipe page**

Modify `src/app/trips/[tripId]/swipe/page.tsx` to add an "Add your own" button that opens `AddCardModal`. Add state `showAddCard` and render the modal conditionally.

Add a floating button after the `SwipeDeck`:

```typescript
{/* Add at the bottom, before closing </div> */}
<button onClick={() => setShowAddCard(true)}
  className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition">
  +
</button>
{showAddCard && (
  <AddCardModal
    tripId={tripId}
    onClose={() => setShowAddCard(false)}
    onAdded={() => { /* reload cards */ }}
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/AddCardModal.tsx src/app/trips/\\[tripId\\]/swipe/
git commit -m "feat: add custom card creation modal in swipe view"
```

### Task 24: Add card generation trigger page

**Files:**
- Create: `src/app/trips/[tripId]/generate/page.tsx`

**Step 1: Implement the generate page**

Create `src/app/trips/[tripId]/generate/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function GeneratePage() {
  const { tripId } = useParams<{ tripId: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState<number | null>(null)

  async function handleGenerate() {
    setLoading(true)
    const res = await fetch(`/api/trips/${tripId}/generate`, { method: 'POST' })
    const data = await res.json()
    setCount(data.count ?? 0)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        {count === null ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Generate Recommendations</h1>
            <p className="text-gray-500 mb-6 text-sm">
              AI will create personalized cards based on your destination and trip details.
            </p>
            <button onClick={handleGenerate} disabled={loading}
              className="w-full bg-green-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-green-700 disabled:opacity-50 transition">
              {loading ? 'Generating...' : 'Generate Cards'}
            </button>
          </>
        ) : (
          <>
            <p className="text-4xl mb-4">🎉</p>
            <h1 className="text-2xl font-bold mb-2">{count} Cards Ready!</h1>
            <p className="text-gray-500 mb-6 text-sm">Your personalized deck is ready to swipe.</p>
            <button onClick={() => router.push(`/trips/${tripId}/swipe`)}
              className="w-full bg-blue-600 text-white font-medium rounded-lg px-4 py-3 hover:bg-blue-700 transition">
              Start Swiping
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/trips/\\[tripId\\]/generate/
git commit -m "feat: add card generation trigger page"
```

### Task 25: Final integration test and cleanup

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run the dev server and verify the full flow manually**

```bash
npm run dev
```

Walk through: Login -> Create Trip -> Add Context -> Generate Cards -> Swipe -> Results

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and integration verification"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1. Scaffolding | 1-4 | Next.js + Supabase + auth middleware |
| 2. Database | 5-7 | Schema, RLS, realtime |
| 3. Auth | 8 | Google OAuth login |
| 4. Trip CRUD | 9-13 | Types, create/list/hub/invite |
| 5. Context | 14-16 | Manual + AI parsing + agent API |
| 6. Card Gen | 17-18 | Claude batch generation + Google Places photos |
| 7. Card UX | 19-21 | FlipCard + SwipeDeck + swipe page |
| 8. Results | 22 | Dashboard with realtime + consensus |
| 9. Polish | 23-25 | Custom cards, generate trigger, integration test |

Total: 25 tasks across 9 phases. Each task is independently committable and testable.
