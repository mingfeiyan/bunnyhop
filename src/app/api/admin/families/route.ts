// Admin-only API for managing global families.
// GET: returns all families with their members.
// POST: creates or updates a family (add/remove members).

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('approved_creators')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .maybeSingle()
  return data ? user : null
}

export async function GET() {
  const supabase = await createClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const serviceSupabase = createServiceClient()
  const { data: families } = await serviceSupabase
    .from('families')
    .select('id, name, color, created_at')
    .order('name')

  const { data: members } = await serviceSupabase
    .from('family_members')
    .select('id, family_id, user_id, display_name, member_type, agent_identifier')
    .order('display_name')

  // Get emails for human members
  const memberWithEmails = await Promise.all(
    (members ?? []).map(async m => {
      if (m.user_id) {
        const { data: authUser } = await serviceSupabase.auth.admin.getUserById(m.user_id)
        return { ...m, email: authUser?.user?.email ?? null }
      }
      return { ...m, email: null }
    })
  )

  // Group members by family
  const familyList = (families ?? []).map(f => ({
    ...f,
    members: memberWithEmails.filter(m => m.family_id === f.id),
  }))

  return NextResponse.json({ families: familyList })
}
