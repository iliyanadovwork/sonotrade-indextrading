'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import CommentForm from './CommentForm'
import CommentList from './CommentList'
import { Comment } from '@/lib/types/comments'
import { apiClient } from '@/lib/api/client'
import { CSXText } from '@/components/sx/core/CSXText'

interface CommentSectionProps {
  spotifyId: string
  className?: string
}

const CommentSectionInner: React.FC<CommentSectionProps> = ({ spotifyId: artistName, className }) => {
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [replyingTo, setReplyingTo] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const offsetRef = useRef(0)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user?.id) setCurrentUserId(user.id)
    } catch {}
  }, [])

  const fetchComments = useCallback(async (reset: boolean = false) => {
    if (!artistName || isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (reset) {
        setIsLoading(true)
        offsetRef.current = 0
      } else {
        setIsFetching(true)
      }

      const data = await apiClient.getComments(artistName, 20, offsetRef.current)
      if (data.success) {
        const newComments = data.comments || []
        if (reset) {
          setComments(newComments)
          offsetRef.current = newComments.length
        } else {
          setComments((prev) => [...prev, ...newComments])
          offsetRef.current += newComments.length
        }
        setHasMore(data.hasMore || false)
      }
    } catch (error) {
      console.error('Fetch comments error:', error)
    } finally {
      isFetchingRef.current = false
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [artistName])

  useEffect(() => {
    fetchComments(true)
  }, [artistName])

  const handleLoadMore = useCallback(() => {
    if (!isFetchingRef.current && hasMore) {
      fetchComments(false)
    }
  }, [hasMore, fetchComments])

  const handleCommentAdded = useCallback(() => {
    fetchComments(true)
  }, [fetchComments])

  const handleReplyAdded = useCallback((newReply: Comment) => {
    setComments((prev) => {
      const isOptimistic = newReply._id.startsWith('temp-')
      if (!isOptimistic) {
        const optimisticIndex = prev.findIndex(
          (c) => c._id.startsWith('temp-') && c.parentId === newReply.parentId
        )
        if (optimisticIndex !== -1) {
          const updated = [...prev]
          updated[optimisticIndex] = newReply
          return updated
        }
      }
      return [...prev, newReply]
    })
    setReplyingTo('')
  }, [])

  const handleReplyFailed = useCallback((optimisticId: string) => {
    setComments((prev) => prev.filter((c) => c._id !== optimisticId))
  }, [])

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await apiClient.deleteComment(commentId)
      fetchComments(true)
    } catch (error) {
      console.error('Delete comment error:', error)
    }
  }, [fetchComments])

  return (
    <div className={className || ''}>
      <div className="flex items-center justify-between py-6">
        <CSXText variant="subtitle" color="STWhite">
          Comments
        </CSXText>
      </div>
      <CommentForm eventId={artistName} onCommentAdded={handleCommentAdded} />
      <div className="pt-6">
        <CommentList
          comments={comments}
          isLoading={isLoading}
          onReply={setReplyingTo}
          onDelete={handleDelete}
          replyingTo={replyingTo}
          eventId={artistName}
          onReplyAdded={handleReplyAdded}
          onReplyFailed={handleReplyFailed}
          currentUserId={currentUserId}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          isFetching={isFetching}
        />
      </div>
    </div>
  )
}

// Memoized: parents re-render on every chart-hover frame; comments are
// hover-independent.
export const CommentSection = React.memo(CommentSectionInner)
export default CommentSection
