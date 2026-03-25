import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Public routes
  if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname === '/api/login') {
    return res
  }

  // Check for session cookie (Supabase standard)
  const supabaseToken = req.cookies.get('sb-access-token')
  
  if (!supabaseToken) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
