// Agent-friendly read endpoint: returns the full trip state in one call.
// Designed so an AI agent can consume the response, understand the group's
// preferences and confirmed bookings, and plan further (suggest activities,
// coordinate schedules, fill gaps in the itinerary, etc.).
//
// GET /api/trips/by-code/<invite_code>/summary
//
// Response shape:
// {
//   trip: { title, destination, dates, timezone, participants },
//   timeline: [...events sorted by date],
//   context: [...notes and constraints],
//   results: [...cards with consensus and per-voter preferences],
//   families: [...global family groups with members]
// }

import { createServiceClient } from '@/lib/supabase/server'
import { checkApiSecurity } from '@/lib/api-security'
import { byCodeLimiter } from '@/lib/rate-limit'
import { resolveInviteCode } from '@/lib/trip-invite'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ inviteCode: string }> }
) {
  // Rate limit but no CSRF origin check (GET + cross-origin agents)
  const securityError = await checkApiSecurity(request, {
    rateLimiter: byCodeLimiter,
    checkOrigin: false,
    maxBodyBytes: 0, // GET has no body
  })
  if (securityError) return securityError

  const { inviteCode } = await params
  const supabase = createServiceClient()

  const resolved = await resolveInviteCode<{
    title: string
    destination: string | null
    date_start: string | null
    date_end: string | null
    timezone: string | null
  }>(
    supabase,
    inviteCode,
    'id, title, destination, date_start, date_end, timezone'
  )
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }
  const trip = resolved.trip

  // Fetch everything in parallel
  const [
    { data: participants },
    { data: events },
    { data: context },
    { data: cards },
    { data: swipes },
    { data: families },
    { data: familyMembers },
  ] = await Promise.all([
    supabase
      .from('trip_participants')
      .select('user_id, role')
      .eq('trip_id', trip.id),
    supabase
      .from('timeline_events')
      .select('id, card_id, status, type, title, start_date, end_date, start_time, end_time, origin, destination, reference, details, source')
      .eq('trip_id', trip.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('trip_context')
      .select('type, raw_text, source')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('cards')
      .select('id, title, tagline, category, metadata')
      .eq('trip_id', trip.id),
    supabase
      .from('swipes')
      .select('card_id, user_id, preference'),
    supabase
      .from('families')
      .select('name, color'),
    supabase
      .from('family_members')
      .select('user_id, display_name, member_type, family_id, families(name)')
  ])

  // Get emails for participants
  const participantList = await Promise.all(
    (participants ?? []).map(async p => {
      const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id)
      return {
        email: authUser?.user?.email ?? p.user_id.slice(0, 8),
        role: p.role,
      }
    })
  )

  // Build card results with consensus
  const cardIds = (cards ?? []).map(c => c.id)
  const tripSwipes = (swipes ?? []).filter(s => cardIds.includes(s.card_id))

  const results = (cards ?? []).map(card => {
    const cardSwipes = tripSwipes.filter(s => s.card_id === card.id)
    const score = cardSwipes.reduce((sum, s) => {
      if (s.preference === 'want') return sum + 1
      if (s.preference === 'pass') return sum - 1
      return sum
    }, 0)
    const allWant = cardSwipes.length > 0 && cardSwipes.every(s => s.preference === 'want')
    const hasPasses = cardSwipes.some(s => s.preference === 'pass')
    const consensus = allWant ? 'everyone_loves' : hasPasses ? 'hard_pass' : 'mixed'

    return {
      id: card.id,
      title: card.title,
      tagline: card.tagline,
      category: card.category,
      score,
      consensus,
      total_votes: cardSwipes.length,
      votes: cardSwipes.map(s => ({
        preference: s.preference,
      })),
      metadata: {
        rating: card.metadata?.rating ?? null,
        price_range: card.metadata?.price_range ?? null,
        address: card.metadata?.address ?? null,
      },
    }
  }).sort((a, b) => b.score - a.score)

  // Build family info
  const familyList = (families ?? []).map(f => ({
    name: f.name,
    color: f.color,
    members: (familyMembers ?? [])
      .filter(fm => {
        const fam = Array.isArray(fm.families) ? fm.families[0] : fm.families
        return fam && typeof fam === 'object' && (fam as { name: string }).name === f.name
      })
      .map(fm => ({
        display_name: fm.display_name,
        type: fm.member_type,
      })),
  }))

  return NextResponse.json({
    trip: {
      title: trip.title,
      destination: trip.destination,
      date_start: trip.date_start,
      date_end: trip.date_end,
      timezone: trip.timezone,
      participants: participantList,
    },
    timeline: events ?? [],
    context: context ?? [],
    results,
    families: familyList,
  })
}
