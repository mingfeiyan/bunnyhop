// Shared API security helpers for POST routes. Provides:
// 1. CSRF Origin validation (defense-in-depth beyond SameSite=Lax)
// 2. Request body size limiting
// 3. Rate limiting integration
//
// Usage:
//   const error = await checkApiSecurity(request, { rateLimiter: adminLimiter, maxBodyBytes: 100_000 })
//   if (error) return error

import { NextResponse } from 'next/server'
import { getClientIp } from './rate-limit'
import type { createRateLimiter } from './rate-limit'

type SecurityOptions = {
  // Rate limiter instance (from rate-limit.ts). Pass null to skip.
  rateLimiter?: ReturnType<typeof createRateLimiter> | null
  // Max request body size in bytes. Default 1MB. Pass 0 to skip.
  maxBodyBytes?: number
  // Whether to enforce CSRF Origin validation. Default true.
  // Disable for by-code endpoints which are intentionally cross-origin.
  checkOrigin?: boolean
}

// Allowed origins for CSRF checking. In production this should be
// the actual deployment URL. For dev, localhost is allowed.
function isAllowedOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false  // missing Origin header → block
  const requestOrigin = new URL(requestUrl).origin
  if (origin === requestOrigin) return true
  // Allow localhost in development
  if (origin.startsWith('http://localhost:')) return true
  return false
}

export async function checkApiSecurity(
  request: Request,
  options: SecurityOptions = {}
): Promise<NextResponse | null> {
  const {
    rateLimiter = null,
    maxBodyBytes = 1_000_000,  // 1MB default
    checkOrigin = true,
  } = options

  // 1. CSRF Origin check (POST requests only)
  if (checkOrigin && request.method === 'POST') {
    const origin = request.headers.get('origin')
    if (!isAllowedOrigin(origin, request.url)) {
      return NextResponse.json(
        { error: 'CSRF: invalid origin' },
        { status: 403 }
      )
    }
  }

  // 2. Rate limiting
  if (rateLimiter) {
    const ip = getClientIp(request)
    const { limited } = rateLimiter.check(ip)
    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  // 3. Body size check (only for requests that have a body)
  if (maxBodyBytes > 0 && request.body) {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > maxBodyBytes) {
      return NextResponse.json(
        { error: `Request body too large (max ${Math.round(maxBodyBytes / 1024)}KB)` },
        { status: 413 }
      )
    }
  }

  return null  // all checks passed
}
