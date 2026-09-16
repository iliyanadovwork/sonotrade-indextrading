import { NextRequest, NextResponse } from 'next/server'
import { getClaimsFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

async function getLikesCount(commentId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('comment_likes')
    .select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId)
  return count || 0
}

// POST /api/comments/[id]/like
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabaseAdmin
      .from('comment_likes')
      .insert({ comment_id: id, user_id: user.userId })

    if (error && error.code !== '23505') {
      console.error('Error liking comment:', error)
      return NextResponse.json({ error: 'Failed to like comment' }, { status: 500 })
    }

    const likes = await getLikesCount(id)
    return NextResponse.json({ success: true, likes, message: 'Comment liked' })
  } catch (error) {
    console.error('Like POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/comments/[id]/like
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabaseAdmin
      .from('comment_likes')
      .delete()
      .eq('comment_id', id)
      .eq('user_id', user.userId)

    if (error) {
      console.error('Error unliking comment:', error)
      return NextResponse.json({ error: 'Failed to unlike comment' }, { status: 500 })
    }

    const likes = await getLikesCount(id)
    return NextResponse.json({ success: true, likes, message: 'Comment unliked' })
  } catch (error) {
    console.error('Like DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
