'use client'

import React, { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/ui/GifPicker'
import { TradePicker } from '@/components/ui/TradePicker'
import { ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BetSlipCard, parseTrade, TradeEmbed } from '@/components/comments/BetSlipCard'
import { CSXText } from '@/components/sx/core/CSXText'
import { extractGifUrls, removeGifUrls } from '@/lib/giphy-urls'
import { formatTimeAgo } from '@/lib/format-time'
import { FeedPostType } from './FeedPost'
import { FeedComment } from './FeedCommentItem'


function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}



interface FeedCommentDialogProps {
  post: FeedPostType
  onCommentAdded: (comment: FeedComment) => void
  /** Roll back the optimistic temp- row when the POST fails — the dialog is
      already closed by then, so the parent owns the visible state. */
  onCommentFailed?: (optimisticId: string) => void
  onClose: () => void
}

/** Enter/exit fade, and the delay before the parent unmounts us. */
const REPLY_FADE_MS = 200

export const FeedCommentDialog: React.FC<FeedCommentDialogProps> = ({ post, onCommentAdded, onCommentFailed, onClose }) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showTradePicker, setShowTradePicker] = useState(false)
  const [showPositionPicker, setShowPositionPicker] = useState(false)
  const [visible, setVisible] = useState(false)

  const closeWithFade = () => {
    setVisible(false)
    setTimeout(onClose, REPLY_FADE_MS)
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '3rem'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const displayName = post.userId?.username || 'Anonymous'
  const { trade: postTrade, text: postText } = parseTrade(post.content)
  const postGifUrls = extractGifUrls(postText)
  const postTextContent = removeGifUrls(postText)

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
      postId: post._id,
      content: combined,
      parentId: undefined,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onCommentAdded(optimistic)
    onClose()

    try {
      const res = await fetch('/api/feed-comments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ postId: post._id, content: combined }),
      })
      const data = await res.json()
      if (data.success && data.comment) onCommentAdded(data.comment)
      else onCommentFailed?.(optimisticId)
    } catch { onCommentFailed?.(optimisticId) } finally { setIsSubmitting(false) }
  }


  const handleGifSelect = (gifUrl: string) => {
    setSelectedGif(gifUrl)
    setShowGifPicker(false)
  }

  const handleCloseGifPicker = () => setShowGifPicker(false)

  const openTradePicker = () => setShowTradePicker(true)

  const closeTradePicker = () => setShowTradePicker(false)

  const openPositionPicker = () => setShowPositionPicker(true)

  const closePositionPicker = () => setShowPositionPicker(false)

  const handleTradeSelect = (trade: TradeEmbed) => {
    setSelectedTrade(trade)
    setShowTradePicker(false)
    setShowPositionPicker(false)
  }

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
        {/* Header */}
        <div className="p-2 border-b border-[#262626]">
          <button onClick={onClose} className="p-1.5 hover:bg-[#262626] rounded transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {/* Post preview */}
          <div className="mb-3 flex gap-4 border-b border-[#262626] pb-3">
            <div className="flex h-11 w-11 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white text-gray-900">
              {post.userId?.avatar_url
                ? <img src={post.userId.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                : (
                  <CSXText variant="title" color="STForeground">
                    {displayName.charAt(0).toUpperCase()}
                  </CSXText>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CSXText variant="body2Semibold" color="STWhite">
                  {displayName}
                </CSXText>
                <CSXText variant="body2" color="STSecondary">
                  {formatTimeAgo(post.createdAt)}
                </CSXText>
              </div>
              {postTextContent && (
                <div className="break-words whitespace-pre-wrap">
                  <CSXText variant="body2" color="STWhite">
                    {postTextContent}
                  </CSXText>
                </div>
              )}
              {postGifUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="GIF" className="rounded max-w-xs" />
              ))}
              {postTrade && <BetSlipCard trade={postTrade} />}
              <div className="mt-2 block">
                <CSXText variant="body2" color="STSecondary">
                  Replying to{' '}
                </CSXText>
                <CSXText variant="body2" color="STWhite">
                  @{displayName}
                </CSXText>
              </div>
            </div>
          </div>

          {/* Comment form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post your comment"
              className="w-full resize-none rounded border-0 bg-transparent text-sm font-normal text-white outline-0 placeholder:text-[#7a7a7a]"
              disabled={isSubmitting}
              maxLength={2000}
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
                      Remove {selectedTrade.o ? 'Position' : 'Trade'}
                    </CSXText>
                  </button>
                ) : (
                  <>
                    <button type="button" className="cursor-pointer bg-transparent hover:opacity-80" onClick={openTradePicker}>
                      <CSXText variant="body3" color="STSecondary">
                        Trade
                      </CSXText>
                    </button>
                    <button type="button" className="cursor-pointer bg-transparent hover:opacity-80" onClick={openPositionPicker}>
                      <CSXText variant="body3" color="STSecondary">
                        Position
                      </CSXText>
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <CSXText variant="body3" color="STSecondary">
                  {2000 - content.length} left
                </CSXText>
                <button
                  type="submit"
                  disabled={isSubmitting || (!content.trim() && !selectedGif && !selectedTrade)}
                  className="min-h-[2.25rem] cursor-pointer rounded-full bg-white px-4 py-1 transition-all duration-75 hover:opacity-80 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CSXText variant="body2Medium" color="STForeground">
                    {isSubmitting ? 'Posting...' : 'Reply'}
                  </CSXText>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* GIF Picker */}
        <GifPicker
        open={showGifPicker}
        onClose={handleCloseGifPicker}
        onSelect={handleGifSelect}
      />

        {/* Trade Picker */}
        <TradePicker
        open={showTradePicker}
        mode="trades"
        onClose={closeTradePicker}
        onSelect={handleTradeSelect}
      />

        {/* Position Picker */}
        <TradePicker
        open={showPositionPicker}
        mode="positions"
        onClose={closePositionPicker}
        onSelect={handleTradeSelect}
      />
      </DialogContent>
    </Dialog>
  )
}
