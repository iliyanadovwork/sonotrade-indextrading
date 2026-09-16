'use client'

import React, { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/ui/GifPicker'
import { TradePicker } from '@/components/ui/TradePicker'
import { CommentProps, ReplyFormProps, Comment as CommentType } from '@/lib/types/comments'
import { Trash2, MessageCircle, ArrowLeft, Heart } from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BetSlipCard, parseTrade, TradeEmbed } from './BetSlipCard'
import { extractGifUrls, removeGifUrls } from '@/lib/giphy-urls'
import { formatTimeAgo } from '@/lib/format-time'


function getIsAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('auth_token')
}


// Decode numeric HTML entities (hex and decimal) to real characters, e.g. &#x1f525; -> 🔥
function decodeHtmlEntities(input: string | null | undefined) {
  if (!input) return ''
  return input
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}


/** Enter/exit fade, and the delay before the parent unmounts us. */
const REPLY_FADE_MS = 200

export const Comment: React.FC<CommentProps> = ({
  comment,
  onReply,
  onDelete,
  currentUserId,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const isOwner = currentUserId && comment.userId?._id === currentUserId
  const displayName = comment.userId?.username || 'Anonymous'
  const isReply = !!comment.parentId

  const { trade, text: contentWithoutTrade } = parseTrade(comment.content)
  const gifUrls = extractGifUrls(contentWithoutTrade)
  const textContent = decodeHtmlEntities(removeGifUrls(contentWithoutTrade))

  const [likesCount, setLikesCount] = useState(comment.likesCount || 0)
  const [isLiked, setIsLiked] = useState(comment.isLikedByCurrentUser || false)
  const [isLiking, setIsLiking] = useState(false)

  useEffect(() => {
    setIsAuthenticated(getIsAuthenticated())
  }, [])

  useEffect(() => {
    setLikesCount(comment.likesCount || 0)
    setIsLiked(comment.isLikedByCurrentUser || false)
  }, [comment.likesCount, comment.isLikedByCurrentUser])

  const handleLike = async () => {
    if (!isAuthenticated || isLiking) return
    const prevLiked = isLiked
    const prevCount = likesCount
    setIsLiked(!prevLiked)
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1)
    setIsLiking(true)
    try {
      if (prevLiked) {
        const result = await apiClient.unlikeComment(comment._id)
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      } else {
        const result = await apiClient.likeComment(comment._id)
        if (result.success) setLikesCount(result.likes)
        else { setIsLiked(prevLiked); setLikesCount(prevCount) }
      }
    } catch {
      setIsLiked(prevLiked)
      setLikesCount(prevCount)
    } finally {
      setIsLiking(false)
    }
  }

  return (
      <div className="flex max-w-xl py-4 mitems-start gap-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 font-bold text-lg select-none overflow-hidden">
          {comment.userId?.avatar_url
            ? <img src={comment.userId.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            : displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className={isReply ? 'space-y-2 p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg' : 'space-y-2'}>
            <div className="flex items-center gap-2">
              {comment.userId?.username ? (
                <a
                  href={`/profile/${encodeURIComponent(comment.userId.username)}`}
                  className="text-sm font-semibold text-white truncate hover:underline underline-offset-2"
                >
                  {displayName}
                </a>
              ) : (
                <span className="text-sm font-semibold text-white truncate">{displayName}</span>
              )}
              <span className="text-[0.625rem] sm:text-xs text-[#7a7a7a] flex-shrink-0">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>
            {textContent && (
              <p className="text-sm text-white break-words whitespace-pre-wrap leading-relaxed">
                {textContent}
              </p>
            )}
            {gifUrls.length > 0 && (
              <div className="flex flex-col gap-2">
                {gifUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="GIF" className="rounded max-w-xs" />
                ))}
              </div>
            )}
             {/* Replies sit in a filled bubble the same tone as the card. */}
             {trade && <BetSlipCard trade={trade} bordered={isReply} />}
          </div>
          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={!isAuthenticated || isLiking}
              className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLiked ? 'text-st-chart-negative hover:text-st-chart-negative' : 'text-[#7a7a7a] hover:text-white'
              } ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Heart className="w-[1.125rem] h-[1.125rem]" fill={isLiked ? 'currentColor' : 'none'} />
              {likesCount > 0 && <span className="text-xs font-medium">{likesCount}</span>}
            </button>
            {onReply && (
              <button
                onClick={() => onReply(comment._id)}
                className="flex items-center text-[#7a7a7a] hover:text-white transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
            {isOwner && onDelete && (
              <button
                onClick={() => onDelete(comment._id)}
                className="flex items-center text-[#7a7a7a] hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
  )
}

export const ReplyForm: React.FC<ReplyFormProps> = ({
  parentId,
  eventId,
  onReplyAdded,
  onReplyFailed,
  onCancel,
  parentComment,
}) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const [showTradePicker, setShowTradePicker] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null)
  const [showPositionPicker, setShowPositionPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '1.6875rem'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const getCurrentUser = () => {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !selectedGif && !selectedTrade) return

    let combinedContent = content.trim()
    if (selectedGif) combinedContent = combinedContent ? `${combinedContent}\n${selectedGif}` : selectedGif
    if (selectedTrade) combinedContent = combinedContent ? `${combinedContent}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`
    const optimisticId = `temp-${Date.now()}`
    const user = getCurrentUser()

    const optimisticReply: CommentType = {
      _id: optimisticId,
      content: combinedContent,
      userId: { _id: user?.id || '', username: user?.username || 'You' },
      eventId,
      parentId,
      likesCount: 0,
      isLikedByCurrentUser: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onReplyAdded(optimisticReply)
    setContent('')
    setSelectedGif(null)
    setSelectedTrade(null)
    onCancel()

    try {
      const data = await apiClient.postComment(eventId, combinedContent, parentId)
      if (data.success && data.comment) {
        onReplyAdded(data.comment)
      } else {
        onReplyFailed?.(optimisticId)
      }
    } catch (error) {
      console.error('Reply error:', error)
      onReplyFailed?.(optimisticId)
    }
  }


  const handleGifSelect = (gifUrl: string) => {
    setSelectedGif(gifUrl)
    setShowGifPicker(false)
  }

  const handleCloseGifPicker = () => setShowGifPicker(false)

  const openTradePicker = () => setShowTradePicker(true)

  const openPositionPicker = () => setShowPositionPicker(true)

  const handleTradeSelect = (trade: TradeEmbed) => {
    setSelectedTrade(trade)
    setShowTradePicker(false)
    setShowPositionPicker(false)
  }

  const maxLength = 2000

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
  const remainingChars = maxLength - content.length
  const displayName = parentComment.userId?.username || 'Anonymous'
  const { trade: parentTrade, text: parentText } = parseTrade(parentComment.content)

  return (
    <Dialog modal={false} open={true} onOpenChange={(open) => !open && closeWithFade()}>
      <DialogContent
        className="p-0 bg-[#000000] border border-[rgba(255,255,255,0.1)] max-w-sm"
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
          <div className="mb-2 flex gap-4 border-b border-[#262626] pb-3">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white flex items-center justify-center text-gray-900 font-bold text-lg select-none overflow-hidden">
              {parentComment.userId?.avatar_url
                ? <img src={parentComment.userId.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                : displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate">{displayName}</span>
                <span className="text-sm text-[#7a7a7a] flex-shrink-0">
                  {formatTimeAgo(parentComment.createdAt)}
                </span>
              </div>
              {parentText && (
                <div className="break-words">
                  <span className="text-[0.9375rem] text-white">{decodeHtmlEntities(removeGifUrls(parentText))}</span>
                </div>
              )}
              {parentTrade && <BetSlipCard trade={parentTrade} />}
              <span className="text-sm text-[#7a7a7a]">
                Replying to <span className="text-white">@{displayName}</span>
              </span>
              
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className='space-y-4 bg-[#131313] rounded-lg p-4'>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Post your reply"
                className="text-sm font-normal w-full border-0 outline-0 py-1 bg-transparent placeholder:text-[#7a7a7a] text-white resize-none rounded"
                disabled={isSubmitting}
                maxLength={maxLength}
                style={{ height: '3rem', minHeight: '3rem' }}
                rows={6}
              />
              {selectedGif && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedGif} alt="Selected GIF" className="rounded max-w-xs" />
                </div>
              )}
              {selectedTrade && <BetSlipCard trade={selectedTrade} />}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                {selectedGif ? (
                  <button type="button" className="text-[#7a7a7a] text-xs font-semibold hover:underline bg-transparent cursor-pointer" onClick={() => setSelectedGif(null)}>
                    Delete GIF
                  </button>
                ) : (
                  <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:opacity-80 bg-transparent cursor-pointer" onClick={() => setShowGifPicker(true)}>
                    GIF
                  </button>
                )}
                {selectedTrade ? (
                  <button type="button" className="text-[#7a7a7a] text-xs font-semibold hover:underline bg-transparent cursor-pointer" onClick={() => setSelectedTrade(null)}>
                    Remove {selectedTrade.o ? 'Position' : 'Trade'}
                  </button>
                ) : (
                  <>
                    <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:opacity-80 bg-transparent cursor-pointer" onClick={openTradePicker}>
                      Trade
                    </button>
                    <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:opacity-80 bg-transparent cursor-pointer" onClick={openPositionPicker}>
                      Position
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#7a7a7a]">{remainingChars} left</span>
                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting || (!content.trim() && !selectedGif && !selectedTrade)}
                    className="w-full py-1 px-4 min-h-[2.25rem] bg-white text-black rounded-full text-sm font-medium hover:opacity-80 active:scale-90 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Replying...' : 'Reply'}
                  </button>
                </div>
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

        <TradePicker
        open={showPositionPicker}
        mode="positions"
        onClose={() => setShowPositionPicker(false)}
        onSelect={handleTradeSelect}
      />
      </DialogContent>
    </Dialog>
  )
}
