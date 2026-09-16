'use client'

import React, { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/ui/GifPicker'
import { TradePicker } from '@/components/ui/TradePicker'
import { CommentFormProps } from '@/lib/types/comments'
import { apiClient } from '@/lib/api/client'
import { BetSlipCard, TradeEmbed } from './BetSlipCard'


const CommentForm: React.FC<CommentFormProps> = ({ eventId, onCommentAdded }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const [showTradePicker, setShowTradePicker] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<TradeEmbed | null>(null)
  const [showPositionPicker, setShowPositionPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('auth_token'))
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '1.6875rem'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const openPositionPicker = () => setShowPositionPicker(true)

  const closePositionPicker = () => setShowPositionPicker(false)

  const openTradePicker = () => setShowTradePicker(true)

  const closeTradePicker = () => setShowTradePicker(false)

  const handleTradeSelect = (trade: TradeEmbed) => {
    setSelectedTrade(trade)
    setShowTradePicker(false)
    setShowPositionPicker(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!content.trim() && !selectedGif && !selectedTrade) || !isAuthenticated) return

    try {
      setIsSubmitting(true)
      setError('')
      let combined = content.trim()
      if (selectedGif) combined = combined ? `${combined}\n${selectedGif}` : selectedGif
      if (selectedTrade) combined = combined ? `${combined}\n[[TRADE:${JSON.stringify(selectedTrade)}]]` : `[[TRADE:${JSON.stringify(selectedTrade)}]]`
      const data = await apiClient.postComment(eventId, combined)
      if (data.success && data.comment) {
        onCommentAdded(data.comment)
        setContent('')
        setSelectedGif(null)
        setSelectedTrade(null)
      }
    } catch (err) {
      console.error('Comment error:', err)
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleGifSelect = (gifUrl: string) => {
    setSelectedGif(gifUrl)
    setShowGifPicker(false)
  }

  const handleCloseGifPicker = () => setShowGifPicker(false)

  const maxLength = 2000
  const remainingChars = maxLength - content.length

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-[#131313] space-y-4 rounded-lg p-4">
        <div className="w-full space-y-4">
          <label className="block space-y-4 w-full cursor-text" htmlFor="comment-input">
            <div className="flex flex-col space-y-4 w-full">
              <span className="flex items-center">
                <textarea
                  ref={textareaRef}
                  id="comment-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isAuthenticated ? "What's your take?" : 'Sign in to comment'}
                  className="text-[0.8125rem] font-normal w-full border-0 outline-0 p-0 bg-transparent max-sm:placeholder:text-xs placeholder:text-[#7a7a7a] text-white resize-none"
                  disabled={isSubmitting || !isAuthenticated}
                  maxLength={maxLength}
                />
              </span>
              {selectedGif && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedGif} alt="Selected GIF" className="rounded max-w-xs" />
                </div>
              )}
              {selectedTrade && <BetSlipCard trade={selectedTrade} />}
            </div>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedGif ? (
              <button type="button" className="text-[#7a7a7a] text-xs font-semibold hover:underline p-0 bg-transparent shadow-none cursor-pointer" onClick={() => setSelectedGif(null)}>
                Delete GIF
              </button>
            ) : (
              <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:underline p-0 bg-transparent shadow-none cursor-pointer" onClick={() => setShowGifPicker(true)}>
                GIF
              </button>
            )}
            {selectedTrade ? (
              <button type="button" className="text-[#7a7a7a] text-xs font-semibold hover:underline p-0 bg-transparent shadow-none cursor-pointer" onClick={() => setSelectedTrade(null)}>
                Remove {selectedTrade.o ? 'Position' : 'Trade'}
              </button>
            ) : (
              <>
                <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:underline p-0 bg-transparent shadow-none cursor-pointer" onClick={openTradePicker} disabled={!isAuthenticated}>
                  Trade
                </button>
                <button type="button" className="text-[#7a7a7a] text-xs font-normal hover:underline p-0 bg-transparent shadow-none cursor-pointer" onClick={openPositionPicker} disabled={!isAuthenticated}>
                  Position
                </button>
              </>
            )}
            {error && <span className="text-st-chart-negative text-[0.8125rem]">{error}</span>}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-[#7a7a7a] text-[0.8125rem]">{remainingChars} left</span>
            <div>
              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !selectedGif && !selectedTrade) || !isAuthenticated}
                className="w-full py-1 px-5 min-h-[2.25rem] bg-white text-black rounded-full text-[0.8125rem] font-medium hover:opacity-80 active:scale-90 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
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
        prioritizeArtist={eventId}
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
    </form>
  )
}

export default CommentForm
