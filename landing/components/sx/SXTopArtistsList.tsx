'use client'

import React, { useEffect, useState } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'

interface TopArtist {
  id: string
  name: string
  index_price: number | null
  change_1m: number | null
  image_url?: string | null
}

const TrendArrow = React.memo(function TrendArrow({ positive }: { positive: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 18"
      width="10"
      height="10"
      className="shrink-0"
      style={{
        color: `var(--${positive ? 'st-positive' : 'st-chart-negative'})`,
        transform: `rotate(${positive ? '0deg' : '180deg'}) translateY(1px)`,
      }}
    >
      <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
    </svg>
  )
})

export const SXTopArtistsList = React.memo(function SXTopArtistsList() {
  const [artists, setArtists] = useState<TopArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const fetchTopArtists = async () => {
      try {
        const response = await fetch('/api/discover?limit=10&offset=0&sort_by=index_price&sort_dir=desc')
        if (!response.ok) throw new Error('Failed to fetch artists')
        const data = await response.json()
        setArtists(data.artists || [])
      } catch (err) {
        console.error('Error fetching top artists:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTopArtists()
  }, [])

  useEffect(() => {
    if (artists.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % artists.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [artists.length])

  if (loading || artists.length === 0) return null

  const artist = artists[currentIndex]
  const change = artist.change_1m

  return (
    <div className="w-full px-14" style={{ marginTop: '0px' }}>
      <div
        key={artist.id + currentIndex}
        className="artist-fade-in relative w-full"
      >
        <span className="relative z-10 flex w-full items-center gap-3 p-4" style={{ border: '2px solid var(--st-border)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
          {artist.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artist.image_url}
              alt={artist.name}
              className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-zinc-700" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <div className="min-w-0 truncate">
              <CSXText variant="subtitle2" color="STWhite">{artist.name}</CSXText>
            </div>
            <CSXText variant="body2" color="STSecondary">Index</CSXText>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-col items-end text-right">
            <CSXText variant="body2" color="STSecondary">
              {artist.index_price !== null
                ? artist.index_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—'}
              <span className="ml-1 text-[10px] font-normal">USD</span>
            </CSXText>
            {change !== null ? (
              <div className="flex items-center gap-1">
                <TrendArrow positive={change >= 0} />
                <span
                  className="text-xs font-medium leading-none tracking-[-0.025em] tabular-nums"
                  style={{ color: `var(--${change >= 0 ? 'st-positive' : 'st-chart-negative'})` }}
                >
                  {Math.abs(change).toFixed(2)}%
                </span>
              </div>
            ) : (
              <CSXText variant="body2" color="STSecondary">—</CSXText>
            )}
          </div>
        </span>
      </div>
    </div>
  )
})
