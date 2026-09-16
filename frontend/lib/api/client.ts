import { Comment } from '@/lib/types/comments'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function getBaseUrl() {
  // Unified app: comment routes are served locally. Relative URLs hit this app.
  return '';
}

export const apiClient = {
  async getComments(spotifyId: string, limit = 50, offset = 0): Promise<{
    success: boolean
    comments: Comment[]
    total: number
    hasMore: boolean
  }> {
    const res = await fetch(
      `${getBaseUrl()}/api/comments?spotify_id=${encodeURIComponent(spotifyId)}&limit=${limit}&offset=${offset}`,
      { headers: authHeaders(), cache: 'no-store' }
    )
    return res.json()
  },

  async postComment(eventId: string, content: string, replyToCommentId?: string): Promise<{
    success: boolean
    message: string
    comment: Comment
  }> {
    const res = await fetch(`${getBaseUrl()}/api/comments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ eventId, content, replyToCommentId: replyToCommentId || null }),
    })
    return res.json()
  },

  async deleteComment(commentId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    return res.json()
  },

  async likeComment(commentId: string): Promise<{ success: boolean; likes: number; message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: authHeaders(),
    })
    return res.json()
  },

  async unlikeComment(commentId: string): Promise<{ success: boolean; likes: number; message: string }> {
    const res = await fetch(`${getBaseUrl()}/api/comments/${commentId}/like`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    return res.json()
  },
}
