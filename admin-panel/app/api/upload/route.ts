import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'artist-images'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const artistName = formData.get('artist_name') as string | null

    if (!file || !artistName) {
      return NextResponse.json({ error: 'file and artist_name are required' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'png'
    const safeFolder = artistName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // strip diacritics
      .replace(/[^a-zA-Z0-9_\-]/g, '_') // replace any remaining non-safe chars
    const key = `${safeFolder}/${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }

    // Upload
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(key, Buffer.from(bytes), { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(key)

    // Save to artist_metrics
    const { error: dbError } = await supabase
      .from('artist_metrics')
      .upsert({ artist_name: artistName, image_url: publicUrl }, { onConflict: 'artist_name' })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}
