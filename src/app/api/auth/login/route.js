import { createSupabaseServerClient } from '@/config/supabaseServer'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return Response.json(
        { error: error.message || 'Invalid credentials' },
        { status: 401 }
      )
    }

    const handle = data.user?.user_metadata?.handle
    if (!handle) {
      return Response.json(
        { error: 'User handle not found' },
        { status: 500 }
      )
    }

    return Response.json({ handle })
  } catch (err) {
    console.error('Login API error:', err)
    return Response.json(
      { error: err?.message || 'Unexpected server error' },
      { status: 500 }
    )
  }
}
