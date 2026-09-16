import { NextRequest, NextResponse } from 'next/server'
import { getClaimsFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

// PostgREST rows carry embedded joins; declaring the fields this route reads
// keeps the mapping honest without reaching for `any`.
interface Row {
  id: string
  user_id?: string | null
  post_id?: string
  content?: string
  parent_id?: string | null
  created_at?: string
  updated_at?: string
  user?: { id?: string; username?: string; avatar_url?: string | null } | null
  post?: { id?: string; content?: string } | null
}

// GET /api/feed-comments?post_id=...&user_id=...&limit=100&offset=0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('post_id')
    const filterUserId = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!postId && !filterUserId) {
      return NextResponse.json({ error: 'post_id or user_id is required' }, { status: 400 })
    }

    const user = getClaimsFromRequest(request)

    let query = supabaseAdmin
      .from('feed_post_comments')
      .select('*, user:users(id, username, avatar_url), post:feed_posts(id, content)', { count: 'exact' })
      .order('created_at', { ascending: !!postId && !filterUserId })
      .range(offset, offset + limit - 1)

    if (postId) query = query.eq('post_id', postId)
    if (filterUserId) query = query.eq('user_id', filterUserId)

    const { data: comments, error, count } = await query

    if (error) {
      console.error('Error fetching feed comments:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    const total = count || 0
    const hasMore = offset + limit < total

    const commentIds = (comments || []).map((c: Row) => c.id)
    const likesMap: Record<string, number> = {}
    const userLikesSet: Set<string> = new Set()

    if (commentIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('feed_post_comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds)

      if (likes) {
        for (const like of likes) {
          likesMap[like.comment_id] = (likesMap[like.comment_id] || 0) + 1
          if (user && like.user_id === user.userId) {
            userLikesSet.add(like.comment_id)
          }
        }
      }
    }

    const mapped = (comments || []).map((c: Row) => ({
      _id: c.id,
      userId: {
        _id: c.user?.id || c.user_id,
        username: c.user?.username || 'Anonymous',
        avatar_url: c.user?.avatar_url || null,
      },
      postId: c.post_id,
      postContent: c.post?.content || null,
      content: c.content,
      parentId: c.parent_id || undefined,
      likesCount: likesMap[c.id] || 0,
      isLikedByCurrentUser: userLikesSet.has(c.id),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))

    return NextResponse.json({ success: true, comments: mapped, total, hasMore })
  } catch (error) {
    console.error('Feed comments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/feed-comments
export async function POST(request: NextRequest) {
  try {
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postId, content, parentId } = body

    if (!postId || !content?.trim()) {
      return NextResponse.json({ error: 'postId and content are required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content too long (max 2000 chars)' }, { status: 400 })
    }

    const { data: comment, error } = await supabaseAdmin
      .from('feed_post_comments')
      .insert({
        post_id: postId,
        user_id: user.userId,
        content: content.trim(),
        parent_id: parentId || null,
      })
      .select('*, user:users(id, username, avatar_url)')
      .single()

    if (error) {
      console.error('Error creating feed comment:', error)
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    const mapped = {
      _id: comment.id,
      userId: {
        _id: comment.user?.id || comment.user_id,
        username: comment.user?.username || user.username || 'Anonymous',
        avatar_url: comment.user?.avatar_url || null,
      },
      postId: comment.post_id,
      content: comment.content,
      parentId: comment.parent_id || undefined,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }

    return NextResponse.json({ success: true, message: 'Comment created', comment: mapped }, { status: 201 })
  } catch (error) {
    console.error('Feed comments POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
