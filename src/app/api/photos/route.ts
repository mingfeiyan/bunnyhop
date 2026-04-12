import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Require authentication to prevent quota abuse — unauthenticated
  // callers could use this proxy to burn through Google Places quota.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!ref || !apiKey) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // URL-encode the ref parameter to prevent injection
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`
  const res = await fetch(photoUrl)
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
