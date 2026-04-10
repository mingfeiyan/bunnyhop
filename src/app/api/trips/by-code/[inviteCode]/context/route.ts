import { createServerClient } from '@supabase/ssr'
import { parseContext } from '@/lib/claude'
import { NextResponse } from 'next/server'

// Create a Supabase client with service role key (bypasses RLS)
// Used for agent API where there's no browser session
function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  const { inviteCode } = await params

  const supabase = createServiceClient()

  // Find trip by invite code — the invite code IS the auth
  const { data: trip } = await supabase
    .from('trips')
    .select('id, created_by')
    .eq('invite_code', inviteCode)
    .single()

  if (!trip) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  const body = await request.json()
  const { text } = body
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text field is required' }, { status: 400 })
  }

  // Parse with AI — may return multiple entries
  const parsedEntries = await parseContext(text)

  // Insert each parsed entry as a separate row
  const rows = parsedEntries.map(entry => ({
    trip_id: trip.id,
    type: entry.type,
    raw_text: entry.raw_text || text,
    details: entry.details,
    added_by: trip.created_by,
    source: 'agent',
  }))

  const { data, error } = await supabase
    .from('trip_context')
    .insert(rows)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
