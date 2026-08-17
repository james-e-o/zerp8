// config/supabaseServer.js   ← or move to lib/supabase/server.js (recommended)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getEnvironmentVariables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   // ← changed to standard name

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local')
  }

  return { supabaseUrl, supabaseKey }
}

export async function createSupabaseServerClient() {   // ← removed async + await
  const { supabaseUrl, supabaseKey } = getEnvironmentVariables()
  const cookieStore = await cookies()   // ← no await

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll?cookieStore.getAll(): []
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.warn('Supabase SSR cookie set ignored (normal in Server Components)', error)
          }
        },
      },
    }
  )
}