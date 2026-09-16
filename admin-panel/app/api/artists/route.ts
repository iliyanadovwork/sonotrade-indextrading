import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export async function GET() {
  try {
    // Fetch artists from backend
    const res = await fetch(`${BACKEND_URL}/api/artists`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to fetch artists from backend')
    const { artists } = await res.json()

    // Fetch image_url for each artist from artist_metrics
    const { data: metrics } = await supabase
      .from('artist_metrics')
      .select('artist_name, image_url')

    const imageMap: Record<string, string | null> = {}
    for (const m of metrics ?? []) {
      imageMap[m.artist_name] = m.image_url ?? null
    }

    const enriched = (artists as any[]).map((a) => ({
      name: a.name,
      index_price: a.current_index_value ?? a.index_price ?? null,
      change_1d: a.change_1d ?? null,
      image_url: imageMap[a.name] ?? null,
    }))

    return NextResponse.json({ artists: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
