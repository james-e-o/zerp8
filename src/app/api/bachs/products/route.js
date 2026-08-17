import { NextResponse } from 'next/server'

export async function GET(request) {
  const apiKey = process.env.BACHS_SANDBOX_KEY || process.env.NEXT_PUBLIC_BACHS_SANDBOX_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Bachs sandbox API key is not configured.' },
      { status: 500 }
    )
  }

  const url = new URL('https://sandbox-api.bachs.io/v1/products')
  const includeArchived = request.nextUrl.searchParams.get('include_archived')
  if (includeArchived === 'true') {
    url.searchParams.set('include_archived', 'true')
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.message || 'Failed to fetch Bachs products', ...data },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Bachs products API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unexpected error fetching Bachs products' },
      { status: 500 }
    )
  }
}
