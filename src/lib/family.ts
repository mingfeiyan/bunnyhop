// Shared global family lookup. Used by the timeline page and the trip hub
// to map user_ids to their family name + color. Queries the global
// families/family_members tables (migration 014).

import type { SupabaseClient } from '@supabase/supabase-js'

export type FamilyInfo = {
  name: string
  color: string
}

// Returns a Map<user_id, { name, color }> for all users who belong to a
// global family. Callers use this to render family accents on timeline cards
// and participant lists.
export async function getUserFamilyMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<Map<string, FamilyInfo>> {
  const { data } = await supabase
    .from('family_members')
    .select('user_id, families(name, color)')

  const map = new Map<string, FamilyInfo>()
  for (const fm of (data ?? []) as Array<Record<string, unknown>>) {
    const uid = fm.user_id as string | null
    // Supabase returns the joined table as an object (many-to-one) but
    // TypeScript infers it as array. Handle both shapes defensively.
    const fam = Array.isArray(fm.families) ? fm.families[0] : fm.families
    if (uid && fam && typeof fam === 'object') {
      const { name, color } = fam as { name: string; color: string }
      map.set(uid, { name, color })
    }
  }
  return map
}
