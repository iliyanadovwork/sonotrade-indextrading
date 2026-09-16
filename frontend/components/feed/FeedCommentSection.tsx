'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FeedCommentItem, FeedReplyForm, FeedComment } from './FeedCommentItem'

interface FeedCommentSectionProps {
  postId: string
  currentUserId?: string
  incomingComment?: FeedComment | null
  /** Optimistic temp- id whose POST failed — remove it from the list. */
  failedCommentId?: string | null
  /**
   * Comments already delivered with the post by /api/feed. When present this
   * component does NOT fetch: comments are shown expanded by default, so a
   * per-post request would mean one HTTP call per post on every feed render,
   * plus a spinner-then-content flash in each card.
   */
  initialComments?: FeedComment[]
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export const FeedCommentSection: React.FC<FeedCommentSectionProps> = ({ postId, currentUserId, incomingComment, failedCommentId, initialComments }) => {
  const preloaded = initialComments !== undefined
  const [comments, setComments] = useState<FeedComment[]>(initialComments ?? [])
  const [isLoading, setIsLoading] = useState(!preloaded)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(3)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed-comments?post_id=${postId}&limit=100`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await res.json()
      if (data.success) setComments(data.comments || [])
    } catch (error) {
      console.error('Fetch feed comments error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [postId])

  useEffect(() => {
    // Only fetch when the parent did not supply comments (e.g. a surface that
    // renders this outside the feed payload).
    if (preloaded) return
    fetchComments()
  }, [preloaded, fetchComments])

  // Merge incoming comment from dialog (optimistic or confirmed)
  useEffect(() => {
    if (!incomingComment) return
    setComments((prev) => {
      const isOptimistic = incomingComment._id.startsWith('temp-')
      if (!isOptimistic) {
        const idx = prev.findIndex((c) => c._id.startsWith('temp-') && c.parentId === incomingComment.parentId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = incomingComment
          return updated
        }
      }
      // Avoid duplicates
      if (prev.find((c) => c._id === incomingComment._id)) return prev
      return [...prev, incomingComment]
    })
  }, [incomingComment])

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/feed-comments/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      // Only remove the row if the server actually deleted it — removing on a
      // 403/500 makes the comment "reappear" on the next reload.
      if (res.ok) setComments((prev) => prev.filter((c) => c._id !== id))
      else console.error('Delete feed comment failed:', res.status)
    } catch (error) {
      console.error('Delete feed comment error:', error)
    }
  }, [])

  const handleReplyFailed = useCallback((optimisticId: string) => {
    setComments((prev) => prev.filter((c) => c._id !== optimisticId))
  }, [])

  const handleReplyAdded = useCallback((newComment: FeedComment) => {
    setComments((prev) => {
      const isOptimistic = newComment._id.startsWith('temp-')
      if (!isOptimistic) {
        const idx = prev.findIndex((c) => c._id.startsWith('temp-') && c.parentId === newComment.parentId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = newComment
          return updated
        }
      }
      return [...prev, newComment]
    })
    setReplyingTo(null)
  }, [])

  // Drop the optimistic row from the dialog whose POST failed. Derived at
  // render (not synced into state) so the rollback can never race the merge
  // effect above.
  const activeComments = failedCommentId ? comments.filter((c) => c._id !== failedCommentId) : comments

  const topLevel = activeComments.filter((c) => !c.parentId)
  const replyingToComment = replyingTo ? activeComments.find((c) => c._id === replyingTo) || null : null

  if (isLoading) {
    return (
      <div className="mt-3 flex justify-center py-4">
        <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (activeComments.length === 0) return null

  // Build a flat list sorted by createdAt, with parentUsername resolved
  const usernameMap: Record<string, string> = {}
  activeComments.forEach((c) => { usernameMap[c._id] = c.userId?.username || 'Anonymous' })

  const sorted = [...activeComments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const visible = sorted.slice(0, visibleCount)
  const remaining = sorted.length - visibleCount

  return (
    <div className="mt-3">
      <div className="space-y-0">
        {visible.map((comment) => (
          <FeedCommentItem
            key={comment._id}
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onReply={(id) => setReplyingTo(id)}
            parentUsername={comment.parentId ? usernameMap[comment.parentId] : undefined}
          />
        ))}
      </div>
      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount(c => c + 2)}
          className="mt-1 mb-1 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          Show {Math.min(2, remaining)} more {remaining === 1 ? 'comment' : 'comments'}
        </button>
      )}

      {replyingTo && replyingToComment && (
        <FeedReplyForm
          postId={postId}
          parentComment={replyingToComment}
          onReplyAdded={handleReplyAdded}
          onReplyFailed={handleReplyFailed}
          onCancel={() => setReplyingTo(null)}
        />
      )}
    </div>
  )
}

export default FeedCommentSection
