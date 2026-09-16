import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { internalError } from '@/lib/api/error-response'
import { supabaseAdmin } from '@/lib/db/supabase'

const BUCKET = 'user-avatars'
const MAX_BYTES = 2 * 1024 * 1024

/**
 * Only these three are accepted. SVG is deliberately excluded: the bucket is
 * public, so an uploaded SVG would be a live scriptable document served from a
 * domain associated with the brand.
 */
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * The declared Content-Type and the filename are both attacker-controlled, so
 * neither decides what we store. Sniff the real container from the leading
 * bytes and reject anything that does not match its claim.
 */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  const ascii = (i: number, s: string) =>
    s.split('').every((c, k) => bytes[i + k] === c.charCodeAt(0))
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if ('response' in auth) return auth.response
  const userId = auth.claims.userId

  const rl = await rateLimit(`avatar:${userId}`, 5, 3600)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many avatar uploads. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } },
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // Check the declared size before reading the body into memory.
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 2MB or smaller' }, { status: 413 })
    }
    if (!ALLOWED[file.type]) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG and WebP images are accepted' },
        { status: 415 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 2MB or smaller' }, { status: 413 })
    }

    const sniffed = sniffMime(buffer)
    if (!sniffed || sniffed !== file.type) {
      return NextResponse.json({ error: 'File contents are not a valid image' }, { status: 415 })
    }

    // Extension derived from the verified type, never from file.name — that
    // string can contain path separators and traversal segments.
    const key = `${userId}/${Date.now()}.${ALLOWED[sniffed]}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, buffer, { contentType: sniffed, upsert: true })

    if (uploadError) {
      // The bucket is provisioned as infrastructure; this route no longer
      // creates it on demand (that cost a listBuckets admin call per upload
      // and could silently create it as public).
      return internalError({ routeName: 'user.avatar', err: uploadError, code: 'upload_failed' })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key)

    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (dbError) {
      return internalError({ routeName: 'user.avatar', err: dbError, code: 'save_failed' })
    }

    return NextResponse.json({ avatar_url: publicUrl })
  } catch (err) {
    return internalError({ routeName: 'user.avatar', err })
  }
}
