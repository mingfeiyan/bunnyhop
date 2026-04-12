// Admin-only API for managing global families.
// GET: returns all families with their members.
// POST: creates or updates a family (add/remove members).

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin'

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

  // Get emails for human members — single listUsers() call instead of N getUserById calls
  const { data: { users: authUsers } } = await serviceSupabase.auth.admin.listUsers()
  const emailMap = new Map<string, string>()
  for (const u of authUsers) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  const memberWithEmails = (members ?? []).map(m => ({
    ...m,
    email: m.user_id ? (emailMap.get(m.user_id) ?? null) : null,
  }))

  // Group members by family
  const familyList = (families ?? []).map(f => ({
    ...f,
    members: memberWithEmails.filter(m => m.family_id === f.id),
  }))

  return NextResponse.json({ families: familyList })
}
