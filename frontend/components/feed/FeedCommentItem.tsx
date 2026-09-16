'use client'

import React, { useState, useEffect, useRef } from 'react'
import { GifPicker } from '@/components/ui/GifPicker'
import { TradePicker } from '@/components/ui/TradePicker'
import { ArrowLeft, ArrowRight, Heart, MessageCircle, Trash2 } from 'lucide-react'
import { BetSlipCard, parseTrade, TradeEmbed } from '@/components/comments/BetSlipCard'
import { CSXText } from '@/components/sx/core/CSXText'
import { CSXTextualLink } from '@/components/sx/core/CSXTextualLink'
import Link from 'next/link'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { extractGifUrls, removeGifUrls } from '@/lib/giphy-urls'
import { formatTimeAgo } from '@/lib/format-time'

export interface FeedComment {
  _id: string
  userId: { _id: string; username?: string; avatar_url?: string | null }
  postId: string
  content: string
  parentId?: string
  likesCount: number
  isLikedByCurrentUser: boolean
  createdAt: string
  updatedAt: string
}

interface FeedCommentItemProps {
  comment: FeedComment
  currentUserId?: string
  onDelete: (id: string) => void
  onReply: (id: string) => void
  parentUsername?: string
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}


/** Enter/exit fade, and the delay before the parent unmounts us. */
const REPLY_FADE_MS = 200

export const FeedCommentItem: React.FC<FeedCommentItemProps> = ({ comment, currentUserId, onDelete, onReply, parentUsername }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0)
  const [isLiked, setIsLiked] = useState(comment.isLikedByCurrentUser || false)
  const [isLiking, setIsLiking] = useState(false)

  const isOwner = currentUserId && comment.userId?._id === currentUserId
  const displayName = comment.userId?.username || 'Anonymous'

  const { trade, text: withoutTrade } = parseTrade(comment.content)
  const gifUrls = extractGifUrls(withoutTrade)
  const textContent = removeGifUrls(withoutTrade)

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('auth_token'))
  }, [])

  useEffect(() => {
    setLikesCount(comment.likesCount || 0)
    setIsLiked(comment.isLikedByCurrentUser || false)
  }, [comment.likesCount, comment.isLikedByCurrentUser])

  const likeCountColor = isLiked ? 'STChartNegative' : 'STMuted'

  const handleLike = async () => {
    if (!isAuthenticated || isLiking) return
    const prevLiked = isLiked
    const prevCount = likesCount
    setIsLiked(!prevLiked)
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1)
    setIsLiking(true)
    try {
      if (prevLiked) {
        const res = await fetch(`/api/feed-comments/${comment._id}/like`, { method: 'DELETE', headers: getAuthHeaders() })
        const result = await res.json()
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      } else {
        const res = await fetch(`/api/feed-comments/${comment._id}/like`, { method: 'POST', headers: getAuthHeaders() })
        const result = await res.json()
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      }
    } catch { setIsLiked(prevLiked); setLikesCount(prevCount) } finally { setIsLiking(false) }
  }

  return (
    <div className="py-1">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white text-gray-900">
          {comment.userId?.avatar_url
            ? <img src={comment.userId.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            : (
              <CSXText variant="body2Semibold" color="STForeground">
                {displayName.charAt(0).toUpperCase()}
              </CSXText>
            )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-[#131313] flex flex-col gap-2 rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2">
              {comment.userId?.username ? (
                <Link
                  href={`/profile/${encodeURIComponent(comment.userId.username)}`}
                  className="min-w-0 max-w-full truncate text-xs font-semibold text-white underline-offset-2 hover:underline"
                >
                  {displayName}
                </Link>
              ) : (
                <span className="min-w-0 max-w-full truncate text-xs font-semibold text-white">{displayName}</span>
              )}
              {parentUsername && (
                <span className="inline-flex min-w-0 select-none items-center gap-1">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-st-secondary" strokeWidth={2} aria-hidden />
                  <CSXText variant="body2" color="STSecondary">
                    @
                  </CSXText>
                  <CSXTextualLink
                    href={`/profile/${encodeURIComponent(parentUsername)}`}
                    variant="body2"
                    color="STWhite"
                    className="min-w-0 max-w-full truncate underline-offset-2 hover:underline"
                  >
                    {parentUsername}
                  </CSXTextualLink>
                </span>
              )}
              <span className="flex-shrink-0">
                <CSXText variant="body3" color="STMuted">
                  {formatTimeAgo(comment.createdAt)}
                </CSXText>
              </span>
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
            {/* Bordered: the comment bubble is the same #131313 as the card. */}
            {trade && <BetSlipCard trade={trade} bordered />}
          </div>
          <div className="flex items-center pt-2 gap-4">
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
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => onReply(comment._id)}
                className="flex cursor-pointer items-center text-st-muted transition-colors hover:text-st-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => onDelete(comment._id)}
                className="flex cursor-pointer items-center text-st-muted transition-colors hover:text-st-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reply dialog ──────────────────────────────────────────────────────────────

interface FeedReplyFormProps {
  postId: string
  parentComment: FeedComment
  onReplyAdded: (comment: FeedComment) => void
  /** Roll back the optimistic temp- row when the POST fails. */
  onReplyFailed?: (optimisticId: string) => void
  onCancel: () => void
}

export const FeedReplyForm: React.FC<FeedReplyFormProps> = ({ postId, parentComment, onReplyAdded, onReplyFailed, onCancel }) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showTradePicker, setShowTradePicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '3rem'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const displayName = parentComment.userId?.username || 'Anonymous'
  const { trade: parentTrade, text: parentText } = parseTrade(parentComment.content)

  const [visible, setVisible] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot enter animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  const closeWithFade = () => {
    setVisible(false)
    setTimeout(onCancel, REPLY_FADE_MS)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !selectedGif && !selectedTrade) return
    setIsSubmitting(true)

    let combined = content.trim()
    if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif
    if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`

    const currentUser = (() => {
      try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
    })()

    const optimisticId = `temp-${Date.now()}`
    const optimistic: FeedComment = {
      _id: optimisticId,
      userId: { _id: currentUser?.id || '', username: currentUser?.username || 'You' },
      postId,
      content: combined,
      parentId: parentComment._id,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onReplyAdded(optimistic)
    onCancel()

    try {
      const res = await fetch('/api/feed-comments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ postId, content: combined, parentId: parentComment._id }),
      })
      const data = await res.json()
      if (data.success && data.comment) {
        onReplyAdded(data.comment)
      } else {
        onReplyFailed?.(optimisticId)
      }
    } catch { onReplyFailed?.(optimisticId) } finally { setIsSubmitting(false) }
  }


  const handleGifSelect = (gifUrl: string) => {
    setSelectedGif(gifUrl)
    setShowGifPicker(false)
  }

  const handleCloseGifPicker = () => setShowGifPicker(false)

  const openTradePicker = () => setShowTradePicker(true)

  const handleTradeSelect = (trade: TradeEmbed) => {
    setSelectedTrade(trade)
    setShowTradePicker(false)
  }

  const maxLength = 2000

  return (
    <Dialog modal={false} open={true} onOpenChange={(open) => !open && closeWithFade()}>
      <DialogContent
        className="p-0 bg-[#000000] border border-[rgba(255,255,255,0.1)]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: `opacity ${REPLY_FADE_MS}ms ease, transform ${REPLY_FADE_MS}ms ease`,
          willChange: 'opacity, transform',
        }}
      >
        <div className="p-2 border-b border-[#262626]">
          <button onClick={closeWithFade} className="p-1.5 hover:bg-[#262626] rounded transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="p-3 sm:p-4">
          {/* Parent preview */}
          <div className="mb-3 flex gap-3 border-b border-[#262626] pb-3">
            <div className="flex h-9 w-9 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white text-gray-900">
              {parentComment.userId?.avatar_url
                ? <img src={parentComment.userId.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                : (
                  <CSXText variant="body2Semibold" color="STForeground">
                    {displayName.charAt(0).toUpperCase()}
                  </CSXText>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <CSXText variant="body2Semibold" color="STWhite">
                {displayName}
              </CSXText>
              {parentText && (
                <div className="break-words">
                  <CSXText variant="body2" color="STWhite">
                    {removeGifUrls(parentText)}
                  </CSXText>
                </div>
              )}
              {parentTrade && <BetSlipCard trade={parentTrade} />}
              <div className="block">
                <CSXText variant="body2" color="STSecondary">
                  Replying to{' '}
                </CSXText>
                <CSXText variant="body2" color="STWhite">
                  @{displayName}
                </CSXText>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post your reply"
              className="w-full resize-none rounded border-0 bg-transparent text-sm font-normal text-white outline-0 placeholder:text-[#7a7a7a]"
              disabled={isSubmitting}
              maxLength={maxLength}
            />
            {selectedGif && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedGif} alt="Selected GIF" className="rounded max-w-xs" />
            )}
            {selectedTrade && <BetSlipCard trade={selectedTrade} />}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedGif ? (
                  <button type="button" className="cursor-pointer bg-transparent hover:underline" onClick={() => setSelectedGif(null)}>
                    <CSXText variant="body3" color="STSecondary">
                      Delete GIF
                    </CSXText>
                  </button>
                ) : (
                  <button type="button" className="cursor-pointer bg-transparent hover:opacity-80" onClick={() => setShowGifPicker(true)}>
                    <CSXText variant="body3" color="STSecondary">
                      GIF
                    </CSXText>
                  </button>
                )}
                {selectedTrade ? (
                  <button type="button" className="cursor-pointer bg-transparent hover:underline" onClick={() => setSelectedTrade(null)}>
                    <CSXText variant="body3" color="STSecondary">
                      Remove Trade
                    </CSXText>
                  </button>
                ) : (
                  <button type="button" className="cursor-pointer bg-transparent hover:opacity-80" onClick={openTradePicker}>
                    <CSXText variant="body3" color="STSecondary">
                      Trade
                    </CSXText>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <CSXText variant="body3" color="STSecondary">
                  {maxLength - content.length} left
                </CSXText>
                <button
                  type="submit"
                  disabled={isSubmitting || (!content.trim() && !selectedGif && !selectedTrade)}
                  className="min-h-[2.25rem] cursor-pointer rounded-full bg-white px-4 py-1 transition-all duration-75 hover:opacity-80 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CSXText variant="body2Medium" color="STForeground">
                    {isSubmitting ? 'Replying...' : 'Reply'}
                  </CSXText>
                </button>
              </div>
            </div>
          </form>
        </div>

        <GifPicker
        open={showGifPicker}
        onClose={handleCloseGifPicker}
        onSelect={handleGifSelect}
      />

        <TradePicker
        open={showTradePicker}
        mode="trades"
        onClose={() => setShowTradePicker(false)}
        onSelect={handleTradeSelect}
      />
      </DialogContent>
    </Dialog>
  )
}

