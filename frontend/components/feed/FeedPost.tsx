'use client'

import React, { useState, useEffect } from 'react'
import { Heart, MessageCircle, MoreVertical, Trash2 } from 'lucide-react'
import { BetSlipCard, parseTrade } from '@/components/comments/BetSlipCard'
import { CSXText } from '@/components/sx/core/CSXText'
import Link from 'next/link'
import FeedCommentSection from './FeedCommentSection'
import { extractGifUrls, removeGifUrls } from '@/lib/giphy-urls'
import { formatTimeAgo } from '@/lib/format-time'
import { FeedCommentDialog } from './FeedCommentDialog'
import { FeedComment } from './FeedCommentItem'

interface FeedPostUser {
  _id: string
  username?: string
  avatar_url?: string | null
}

export interface FeedPostType {
  _id: string
  userId: FeedPostUser
  content: string
  likesCount: number
  isLikedByCurrentUser: boolean
  /** Delivered inline by /api/feed so expanding costs no extra request. */
  comments?: FeedComment[]
  createdAt: string
  updatedAt: string
}

interface FeedPostProps {
  post: FeedPostType
  currentUserId?: string
  onDelete?: (postId: string) => void
  isFirst?: boolean
  noLeftBorder?: boolean
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

const FeedPost: React.FC<FeedPostProps> = ({ post, currentUserId, onDelete, isFirst, noLeftBorder }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likesCount || 0)
  const [isLiked, setIsLiked] = useState(post.isLikedByCurrentUser || false)
  const [isLiking, setIsLiking] = useState(false)
  // Comments are always rendered — no show/hide toggle, matching the artist
  // page's comment section. FeedCommentSection returns null when a post has
  // none, so an empty post shows no comment affordance at all. This is only
  // affordable because /api/feed returns each post's comments inline; when it
  // fetched per post on mount, a 10-post page opened 11 requests.
  const [commentCount, setCommentCount] = useState(post.comments?.length ?? 0)
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [incomingComment, setIncomingComment] = useState<FeedComment | null>(null)
  const [failedCommentId, setFailedCommentId] = useState<string | null>(null)

  const isOwner = currentUserId && post.userId?._id === currentUserId
  const displayName = post.userId?.username || 'Anonymous'

  const { trade, text: contentWithoutTrade } = parseTrade(post.content)
  const gifUrls = extractGifUrls(contentWithoutTrade)
  const textContent = removeGifUrls(contentWithoutTrade)

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('auth_token'))
  }, [])

  useEffect(() => {
    setLikesCount(post.likesCount || 0)
    setIsLiked(post.isLikedByCurrentUser || false)
  }, [post.likesCount, post.isLikedByCurrentUser])

  const handleLike = async () => {
    if (!isAuthenticated || isLiking) return
    const prevLiked = isLiked
    const prevCount = likesCount
    setIsLiked(!prevLiked)
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1)
    setIsLiking(true)
    try {
      if (prevLiked) {
        const res = await fetch(`/api/feed/${post._id}/like`, { method: 'DELETE', headers: getAuthHeaders() })
        const result = await res.json()
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      } else {
        const res = await fetch(`/api/feed/${post._id}/like`, { method: 'POST', headers: getAuthHeaders() })
        const result = await res.json()
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      }
    } catch { setIsLiked(prevLiked); setLikesCount(prevCount) } finally { setIsLiking(false) }
  }

  const handleCommentAdded = (comment: FeedComment) => {
    setIncomingComment(comment)
    // Optimistic rows arrive first with a temp- id, then again confirmed; only
    // count the first so the total does not double.
    if (comment._id.startsWith('temp-')) setCommentCount(c => c + 1)
  }

  const handleCommentFailed = (optimisticId: string) => {
    setFailedCommentId(optimisticId)
    setCommentCount(c => Math.max(0, c - 1))
  }

  const likeCountColor = isLiked ? 'STChartNegative' : 'STMuted'

  return (
    <div className={`px-4 py-4${isFirst ? '' : ' border-t border-[#262626]'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white text-sm font-bold text-black">
          {post.userId?.avatar_url
            ? <img src={post.userId.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            : displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {post.userId?.username ? (
              <Link
                href={`/profile/${encodeURIComponent(post.userId.username)}`}
                className="min-w-0 truncate text-xs font-semibold text-white underline-offset-2 hover:underline"
              >
                {displayName}
              </Link>
            ) : (
              <span className="min-w-0 truncate text-xs font-semibold text-white">{displayName}</span>
            )}
            <span className="flex-shrink-0 text-xs text-st-secondary">
              {formatTimeAgo(post.createdAt)}
            </span>
            {/* Owner actions live in a kebab at the post's edge — not inline
                with Like/Comment, where Delete was one mis-tap away. */}
            {isOwner && (
              <div className="relative ml-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Post options"
                  aria-expanded={menuOpen}
                  className="flex cursor-pointer items-center justify-center rounded-full p-1 text-st-muted transition-colors hover:text-st-white"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[8.5rem] overflow-hidden rounded-lg border border-white/10 bg-black py-1 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onDelete?.(post._id) }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-st-chart-negative transition-colors hover:bg-white/5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete post
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {textContent && (
            <div className="break-words whitespace-pre-wrap leading-normal tracking-[-0.025em]">
              <CSXText variant="body2" color="STWhite">
                {textContent}
              </CSXText>
            </div>
          )}
          {gifUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              {gifUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="GIF" className="rounded max-w-xs" />
              ))}
            </div>
          )}
          {trade && <BetSlipCard trade={trade} linkToArtist />}

          {/* Actions */}
          <div className="relative flex items-center gap-6">
            <button
              type="button"
              onClick={handleLike}
              disabled={!isAuthenticated || isLiking}
              className={`flex cursor-pointer items-center gap-1.5 transition-colors ${isLiked ? 'text-st-chart-negative hover:text-st-chart-negative' : 'text-st-muted hover:text-st-white'} ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Heart className="h-[0.9375rem] w-[0.9375rem]" fill={isLiked ? 'currentColor' : 'none'} />
              {likesCount > 0 && (
                <CSXText variant="body3" color={likeCountColor}>
                  {likesCount}
                </CSXText>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) setShowCommentDialog(true)
              }}
              className="flex cursor-pointer items-center gap-1.5 text-st-muted transition-colors hover:text-st-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {commentCount > 0 && (
                <CSXText variant="body3" color="STMuted">
                  {commentCount}
                </CSXText>
              )}
            </button>
          </div>

          {/* Comments list — self-hides when the post has none */}
          <FeedCommentSection
            postId={post._id}
            currentUserId={currentUserId}
            incomingComment={incomingComment}
            failedCommentId={failedCommentId}
            initialComments={post.comments ?? []}
          />
        </div>
      </div>

      {/* Comment dialog */}
      {showCommentDialog && (
        <FeedCommentDialog
          post={post}
          onCommentAdded={handleCommentAdded}
          onCommentFailed={handleCommentFailed}
          onClose={() => setShowCommentDialog(false)}
        />
      )}
    </div>
  )
}

export default FeedPost
