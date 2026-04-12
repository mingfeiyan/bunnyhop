// Admin-only API for creating, updating, and deleting global families.
// POST body: { action: 'create' | 'update' | 'delete', ...params }

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkApiSecurity } from '@/lib/api-security'
import { adminLimiter } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin'

export async function POST(request: Request) {
  const securityError = await checkApiSecurity(request, { rateLimiter: adminLimiter })
  if (securityError) return securityError

  const supabase = await createClient()
  const admin = await verifyAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { action } = body
  const serviceSupabase = createServiceClient()

  if (action === 'create') {
    const { name, color } = body
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const { data, error } = await serviceSupabase
      .from('families')
      .insert({ name: name.trim(), color: color || 'indigo', created_by: admin.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ family: data })
  }

  if (action === 'update') {
    const { family_id, name, color } = body
    if (!family_id) return NextResponse.json({ error: 'family_id required' }, { status: 400 })
    const patch: Record<string, string> = {}
    if (name?.trim()) patch.name = name.trim()
    if (color) patch.color = color
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    const { error } = await serviceSupabase
      .from('families')
      .update(patch)
      .eq('id', family_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'updated' })
  }

  if (action === 'delete') {
    const { family_id } = body
    if (!family_id) return NextResponse.json({ error: 'family_id required' }, { status: 400 })
    const { error } = await serviceSupabase
      .from('families')
      .delete()
      .eq('id', family_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'deleted' })
  }

  if (action === 'add_member') {
    const { family_id, user_id, display_name, member_type, agent_identifier } = body
    if (!family_id || !display_name?.trim()) {
      return NextResponse.json({ error: 'family_id and display_name required' }, { status: 400 })
    }
    const row: Record<string, unknown> = {
      family_id,
      display_name: display_name.trim(),
      member_type: member_type || 'human',
    }
    if (user_id) row.user_id = user_id
    if (agent_identifier) row.agent_identifier = agent_identifier
    const { data, error } = await serviceSupabase
      .from('family_members')
      .insert(row)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ member: data })
  }

  if (action === 'remove_member') {
    const { member_id } = body
    if (!member_id) return NextResponse.json({ error: 'member_id required' }, { status: 400 })
    const { error } = await serviceSupabase
      .from('family_members')
      .delete()
      .eq('id', member_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'removed' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
