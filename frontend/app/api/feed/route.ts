import { NextRequest, NextResponse } from 'next/server'
import { getClaimsFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db/supabase'

// PostgREST rows carry embedded joins; declaring the fields this route reads
// keeps the mapping honest without reaching for `any`.
interface Row {
  id: string
  user_id?: string | null
  content?: string
  created_at?: string
  updated_at?: string
  user?: { id?: string; username?: string; avatar_url?: string | null } | null
}

interface CommentRow {
  id: string
  post_id: string
  user_id?: string | null
  content?: string
  parent_id?: string | null
  created_at?: string
  updated_at?: string
  user?: { id?: string; username?: string; avatar_url?: string | null } | null
}

// GET /api/feed?limit=50&offset=0&user_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const filterUserId = searchParams.get('user_id')

    const user = getClaimsFromRequest(request)

    let query = supabaseAdmin
      .from('feed_posts')
      .select('*, user:users(id, username, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filterUserId) query = query.eq('user_id', filterUserId)

    const { data: posts, error, count } = await query

    if (error) {
      console.error('Error fetching feed posts:', error)
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 })
    }

    const total = count || 0
    const hasMore = offset + limit < total

    const postIds = (posts || []).map((p: Row) => p.id)
    const likesMap: Record<string, number> = {}
    const userLikesSet: Set<string> = new Set()

    if (postIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('feed_post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds)

      if (likes) {
        for (const like of likes) {
          likesMap[like.post_id] = (likesMap[like.post_id] || 0) + 1
          if (user && like.user_id === user.userId) {
            userLikesSet.add(like.post_id)
          }
        }
      }
    }

    // Comments ship WITH the posts. The client used to fetch
    // /api/feed-comments once per post on expand, so showing comments by
    // default cost one request per post (11 HTTP calls and ~24 queries for a
    // 10-post page). Two queries here instead, for the whole page.
    const commentsByPost: Record<string, unknown[]> = {}

    if (postIds.length > 0) {
      const { data: comments } = await supabaseAdmin
        .from('feed_post_comments')
        .select('id, post_id, user_id, content, parent_id, created_at, updated_at, user:users(id, username, avatar_url)')
        .in('post_id', postIds)
        .order('created_at', { ascending: true })
        // supabase-js types an embedded join as an array; `user` is to-one here.
        .returns<CommentRow[]>()

      const commentIds = (comments ?? []).map((c: CommentRow) => c.id)
      const commentLikes: Record<string, number> = {}
      const myCommentLikes = new Set<string>()

      if (commentIds.length > 0) {
        const { data: cl } = await supabaseAdmin
          .from('feed_post_comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds)

        for (const like of cl ?? []) {
          commentLikes[like.comment_id] = (commentLikes[like.comment_id] || 0) + 1
          if (user && like.user_id === user.userId) myCommentLikes.add(like.comment_id)
        }
      }

      for (const c of (comments ?? []) as CommentRow[]) {
        const list = commentsByPost[c.post_id] ?? (commentsByPost[c.post_id] = [])
        list.push({
          _id: c.id,
          userId: {
            _id: c.user?.id || c.user_id,
            username: c.user?.username || 'Anonymous',
            avatar_url: c.user?.avatar_url || null,
          },
          postId: c.post_id,
          content: c.content,
          parentId: c.parent_id || undefined,
          likesCount: commentLikes[c.id] || 0,
          isLikedByCurrentUser: myCommentLikes.has(c.id),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })
      }
    }

    const mapped = (posts || []).map((p: Row) => ({
      _id: p.id,
      userId: {
        _id: p.user?.id || p.user_id,
        username: p.user?.username || 'Anonymous',
        avatar_url: p.user?.avatar_url || null,
      },
      content: p.content,
      likesCount: likesMap[p.id] || 0,
      isLikedByCurrentUser: userLikesSet.has(p.id),
      comments: commentsByPost[p.id] ?? [],
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))

    // Deliberately uncached. The response embeds per-user like state
    // (likedByMe, derived from the caller's JWT), so a shared Cache-Control
    // here would serve one user's likes to everybody. If this ever needs
    // caching, split the personalised fields into a separate authed call.
    return NextResponse.json({ success: true, posts: mapped, total, hasMore })
  } catch (error) {
    console.error('Feed GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/feed
export async function POST(request: NextRequest) {
  try {
    const user = getClaimsFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content too long (max 2000 chars)' }, { status: 400 })
    }

    const { data: post, error } = await supabaseAdmin
      .from('feed_posts')
      .insert({ user_id: user.userId, content: content.trim() })
      .select('*, user:users(id, username, avatar_url)')
      .single()

    if (error) {
      console.error('Error creating feed post:', error)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    const mapped = {
      _id: post.id,
      userId: {
        _id: post.user?.id || post.user_id,
        username: post.user?.username || user.username || 'Anonymous',
        avatar_url: post.user?.avatar_url || null,
      },
      content: post.content,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    }

    return NextResponse.json({ success: true, message: 'Post created', post: mapped }, { status: 201 })
  } catch (error) {
    console.error('Feed POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
