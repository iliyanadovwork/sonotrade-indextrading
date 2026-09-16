import { NextRequest, NextResponse } from 'next/server'
import { getClaimsFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

// PostgREST rows carry embedded joins; declaring the fields this route reads
// keeps the mapping honest without reaching for `any`.
interface Row {
  id: string
  user_id?: string | null
  spotify_id?: string
  content?: string
  parent_id?: string | null
  created_at?: string
  updated_at?: string
  like_count?: number
  likes?: Array<{ user_id: string }> | null
  user?: { id?: string; username?: string; avatar_url?: string | null } | null
}

// GET /api/comments?spotify_id=...&limit=50&offset=0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistName = searchParams.get('spotify_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!artistName) {
      return NextResponse.json({ error: 'spotify_id is required' }, { status: 400 })
    }

    const user = getClaimsFromRequest(request)

    // Fetch comments with user info and likes in a single query
    const { data: comments, error, count } = await supabaseAdmin
      .from('comments')
      .select('*, user:users(id, username, avatar_url), likes:comment_likes(user_id)', { count: 'exact' })
      .eq('spotify_id', artistName)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    const total = count || 0
    const hasMore = offset + limit < total

    const mapped = (comments || []).map((c: Row) => {
      const likes: Array<{ user_id: string }> = c.likes || []
      return {
        _id: c.id,
        userId: {
          _id: c.user?.id || c.user_id,
          username: c.user?.username || 'Anonymous',
          avatar_url: c.user?.avatar_url || null,
        },
        eventId: c.spotify_id,
        content: c.content,
        parentId: c.parent_id || undefined,
        likesCount: likes.length,
        isLikedByCurrentUser: user ? likes.some(l => l.user_id === user.userId) : false,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }
    })

    return NextResponse.json({ success: true, comments: mapped, total, hasMore })
  } catch (error) {
    console.error('Comments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/comments
export async function POST(request: NextRequest) {
  try {
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, content, replyToCommentId } = body

    if (!eventId || !content?.trim()) {
      return NextResponse.json({ error: 'eventId and content are required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content too long (max 2000 chars)' }, { status: 400 })
    }

    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({
        user_id: user.userId,
        spotify_id: eventId,
        content: content.trim(),
        parent_id: replyToCommentId || null,
      })
      .select('*, user:users(id, username, avatar_url)')
      .single()

    if (error) {
      console.error('Error creating comment:', error)
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    const mapped = {
      _id: comment.id,
      userId: {
        _id: comment.user?.id || comment.user_id,
        username: comment.user?.username || user.username || 'Anonymous',
        avatar_url: comment.user?.avatar_url || null,
      },
      eventId: comment.spotify_id,
      content: comment.content,
      parentId: comment.parent_id || undefined,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }

    return NextResponse.json({ success: true, message: 'Comment created', comment: mapped }, { status: 201 })
  } catch (error) {
    console.error('Comments POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
