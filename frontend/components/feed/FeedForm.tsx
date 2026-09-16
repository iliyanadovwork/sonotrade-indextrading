'use client'

import React, { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/ui/GifPicker'
import { TradePicker } from '@/components/ui/TradePicker'
import { BetSlipCard, TradeEmbed } from '@/components/comments/BetSlipCard'
import type { FeedPostType } from './FeedPost'
import { CSXText } from '@/components/sx/core/CSXText'


interface FeedFormProps {
  /**
   * Receives the created post so the parent can prepend it instead of
   * refetching the feed (a refetch flashes the whole list).
   */
  onPostAdded: (post?: FeedPostType) => void
}

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * /api/feed, /api/trades/* and friends are Next route handlers in THIS app, so
 * they are same-origin and must be called with a relative path.
 *
 * This used to fall back to the Express service on Railway, which no longer
 * exists — and since NEXT_PUBLIC_BACKEND_URL is unset, every request went to a
 * dead host and surfaced in the UI as "Failed to fetch".
 */
function getBaseUrl() {
  return ''
}

const FeedForm: React.FC<FeedFormProps> = ({ onPostAdded }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<{ username?: string; avatar_url?: string | null } | null>(null)
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
    const loadUser = () => {
      setIsAuthenticated(!!localStorage.getItem('auth_token'))
      try {
        const stored = JSON.parse(localStorage.getItem('user') || 'null')
        if (stored) setUser(stored)
      } catch {}
    }
    loadUser()
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === 'auth_token') loadUser()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
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

      const res = await fetch(`${getBaseUrl()}/api/feed`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: combined }),
      })
      const data = await res.json()
      if (data.success) {
        onPostAdded(data.post)
        setContent('')
        setSelectedGif(null)
        setSelectedTrade(null)
      } else {
        setError(data.error || 'Failed to post')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
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

  const displayName = user?.username || ''

  return (
    <form onSubmit={handleSubmit} className="">
      <div className="border-x border-b border-[#262626] rounded-none p-4">
      <div className="flex items-start space-y-4 gap-3 w-full">          {/* Avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white text-gray-900">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              : (
                <CSXText variant="body1" color="STForeground">
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </CSXText>
              )}
          </div>
          <label className="block space-y-4 items-center flex-1 cursor-text" htmlFor="feed-post-input">
            <div className="flex space-y-4 flex-col w-full">
              <span className="flex space-y-4 items-center">
                <textarea
                  ref={textareaRef}
                  id="feed-post-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isAuthenticated ? "What's your prediction?" : 'Sign in to post'}
                  className="text-sm font-normal w-full border-0 outline-0 pt-2 pb-1 bg-transparent placeholder:text-[#7a7a7a] text-white resize-none"
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
        <div className="flex items-center pl-13 justify-between">
          <div className="flex items-center gap-3">
            {selectedGif ? (
              <button type="button" className="cursor-pointer bg-transparent p-0 shadow-none hover:underline" onClick={() => setSelectedGif(null)}>
                <CSXText variant="body3" color="STSecondary">
                  Delete GIF
                </CSXText>
              </button>
            ) : (
              <button type="button" className="cursor-pointer bg-transparent p-0 shadow-none hover:underline" onClick={() => setShowGifPicker(true)}>
                <CSXText variant="body3" color="STSecondary">
                  GIF
                </CSXText>
              </button>
            )}
            {selectedTrade ? (
              <button type="button" className="cursor-pointer bg-transparent p-0 shadow-none hover:underline" onClick={() => setSelectedTrade(null)}>
                <CSXText variant="body3" color="STSecondary">
                  Remove {selectedTrade.o ? 'Position' : 'Trade'}
                </CSXText>
              </button>
            ) : (
              <>
                <button type="button" className="cursor-pointer bg-transparent p-0 shadow-none hover:underline disabled:opacity-50" onClick={openTradePicker} disabled={!isAuthenticated}>
                  <CSXText variant="body3" color="STSecondary">
                    Trade
                  </CSXText>
                </button>
                <button type="button" className="cursor-pointer bg-transparent p-0 shadow-none hover:underline disabled:opacity-50" onClick={openPositionPicker} disabled={!isAuthenticated}>
                  <CSXText variant="body3" color="STSecondary">
                    Position
                  </CSXText>
                </button>
              </>
            )}
            {error && (
              <CSXText variant="body3" color="STChartNegative">
                {error}
              </CSXText>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span>
              <CSXText variant="body3" color="STSecondary">
                {remainingChars} left
              </CSXText>
            </span>
            <div>
              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !selectedGif && !selectedTrade) || !isAuthenticated}
                className="min-h-[2.25rem] w-full cursor-pointer rounded-full bg-white px-5 py-1 transition-all duration-75 hover:opacity-80 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CSXText variant="body2Medium" color="STForeground">
                  {isSubmitting ? 'Posting...' : 'Post'}
                </CSXText>
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

export default FeedForm
