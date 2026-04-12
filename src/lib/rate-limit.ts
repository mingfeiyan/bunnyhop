// Simple in-memory rate limiter for serverless functions. Each Vercel
// instance maintains its own counter map — this isn't globally shared
// across instances, but it's effective against single-source brute-force
// attacks (which is the primary threat to the by-code endpoints).
//
// Usage:
//   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 })
//   const { limited } = limiter.check(ip)
//   if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

type RateLimitEntry = {
  count: number
  resetAt: number
}

type RateLimiterOptions = {
  windowMs: number      // time window in milliseconds
  maxRequests: number   // max requests per window per key
}

export function createRateLimiter(options: RateLimiterOptions) {
  const map = new Map<string, RateLimitEntry>()

  // Periodic cleanup of expired entries to prevent memory leaks.
  // Runs every 60s — lightweight since the map is usually small.
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of map) {
      if (now > entry.resetAt) map.delete(key)
    }
  }, 60_000).unref()

  return {
    check(key: string): { limited: boolean; remaining: number } {
      const now = Date.now()
      const existing = map.get(key)

      if (!existing || now > existing.resetAt) {
        // New window
        map.set(key, { count: 1, resetAt: now + options.windowMs })
        return { limited: false, remaining: options.maxRequests - 1 }
      }

      existing.count++
      if (existing.count > options.maxRequests) {
        return { limited: true, remaining: 0 }
      }
      return { limited: false, remaining: options.maxRequests - existing.count }
    },
  }
}

// Shared rate limiter for the by-code endpoints.
// 30 requests per minute per IP — generous for normal use (agents batch
// their POSTs), restrictive enough to slow brute-force enumeration.
export const byCodeLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
})

// Stricter limiter for admin routes.
// 10 requests per minute per IP.
export const adminLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
})

// Extract the client IP from the request. Vercel sets x-forwarded-for;
// falls back to x-real-ip or 'unknown'.
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
