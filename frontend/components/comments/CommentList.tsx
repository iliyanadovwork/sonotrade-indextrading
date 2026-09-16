'use client'

import React, { useRef, useCallback, useState } from 'react'
import { CommentListProps } from '@/lib/types/comments'
import { Comment, ReplyForm } from './Comment'

const CommentList: React.FC<CommentListProps> = ({
  comments,
  isLoading,
  onReply,
  onDelete,
  replyingTo,
  eventId,
  onReplyAdded,
  onReplyFailed,
  currentUserId,
  hasMore,
  onLoadMore,
  isFetching,
}) => {
  const [visibleRepliesMap, setVisibleRepliesMap] = useState<Record<string, number>>({})
  const getVisibleCount = (id: string) => visibleRepliesMap[id] ?? 3
  const showMore = (id: string) => setVisibleRepliesMap(prev => ({ ...prev, [id]: (prev[id] ?? 3) + 2 }))

  const observer = useRef<IntersectionObserver | null>(null)

  const lastCommentRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          onLoadMore()
        }
      }, { rootMargin: '200px' })
      if (node) observer.current.observe(node)
    },
    [hasMore, isFetching, onLoadMore]
  )

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const topLevelComments = comments.filter((c) => !c.parentId)

  if (topLevelComments.length === 0) return null

  return (
    <div className="space-y-0">
      {topLevelComments.map((comment, index) => {
        const isLast = index === topLevelComments.length - 1
        const replies = comments.filter((r) => r.parentId === comment._id)

        return (
          <div key={comment._id} ref={isLast ? lastCommentRef : null}>
            <Comment
              comment={comment}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />

            {replyingTo === comment._id && (
              <ReplyForm
                parentId={comment._id}
                eventId={eventId}
                onReplyAdded={onReplyAdded}
                onReplyFailed={onReplyFailed}
                onCancel={() => onReply('')}
                parentComment={comment}
              />
            )}

            {replies.length > 0 && (
              <div className="pl-15">
                {replies.slice(0, getVisibleCount(comment._id)).map((reply) => (
                  <div key={reply._id}>
                    <Comment
                      comment={reply}
                      onReply={onReply}
                      onDelete={onDelete}
                      currentUserId={currentUserId}
                    />
                    {replyingTo === reply._id && (
                      <ReplyForm
                        parentId={comment._id}
                        eventId={eventId}
                        onReplyAdded={onReplyAdded}
                        onReplyFailed={onReplyFailed}
                        onCancel={() => onReply('')}
                        parentComment={reply}
                      />
                    )}
                  </div>
                ))}
                {replies.length > getVisibleCount(comment._id) && (
                  <button
                    onClick={() => showMore(comment._id)}
                    className="mt-1 mb-3 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Show {Math.min(2, replies.length - getVisibleCount(comment._id))} more {replies.length - getVisibleCount(comment._id) === 1 ? 'reply' : 'replies'}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {isFetching && (
        <div className="flex justify-center items-center py-4">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

export default CommentList
