import supabase from "@/config/supabaseClient"

export async function POST(request) {
  try {
    const { email, redirectUrl } = await request.json()

    if (!email) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Call Supabase Edge Function from server
    const { data, error } = await supabase.functions.invoke('reset-password', {
      body: { 
        email,
        redirectUrl,
      },
    })

    if (error) {
      console.error('Error invoking function:', error)
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return Response.json({ success: true, data })
  } catch (err) {
    console.error('Error in reset-password API:', err)
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
