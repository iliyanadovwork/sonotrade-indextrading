import { NextRequest, NextResponse } from 'next/server'
import { getClaimsFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

// POST /api/feed/[id]/like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('feed_post_likes')
      .insert({ post_id: id, user_id: user.userId })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already liked' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to like post' }, { status: 500 })
    }

    const { count } = await supabaseAdmin
      .from('feed_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', id)

    return NextResponse.json({ success: true, likes: count ?? 0, message: 'Post liked' })
  } catch (error) {
    console.error('Feed like POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/feed/[id]/like
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('feed_post_likes')
      .delete()
      .eq('post_id', id)
      .eq('user_id', user.userId)

    if (error) {
      return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 })
    }

    const { count } = await supabaseAdmin
      .from('feed_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', id)

    return NextResponse.json({ success: true, likes: count ?? 0, message: 'Post unliked' })
  } catch (error) {
    console.error('Feed like DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
