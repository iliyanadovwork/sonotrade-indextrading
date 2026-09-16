'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CSXText } from '@/components/sx/core/CSXText'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import { SXAboutChart } from '@/components/sx/SXAboutChart'
import { AnimatedPrice } from '@/components/sx/SXPriceChartWidget'
import { NumberFlowGroup } from '@number-flow/react'
import { SXStreamingMetricsScroller } from '@/components/sx/SXStreamingMetricsScroller'
import { SXCultureNetworkGraphic } from '@/components/sx/SXCultureNetworkGraphic'
import { SXRadarGraphic } from '@/components/sx/SXRadarGraphic'
import { SXTopArtistsList } from '@/components/sx/SXTopArtistsList'
import { HowItWorksMobile } from '@/components/mobile/HowItWorksMobile'


interface DataPoint {
  index: number
  timestamp: string
}

interface ArtistData {
  name: string
  data_points: DataPoint[]
  image_url?: string | null
  index_price?: number | null
}

const HERO_ARTISTS = [
  '3TVXtAsR1Inumwj472S9r4', // Drake
  '53XhwfbYqKCa1cC15pYq2q', // Imagine Dragons
  '06HL4z0CvFAxyc27GXpf02', // Taylor Swift
  '2YZyLoL8N0Wb9xBt1NhZWg', // Kendrick Lamar
  '6qqNVTkY8uBg9cP3Jd7DAH', // Billie Eilish
]
// How long each artist is shown (ms) — chart draws for 8s, then we hold a bit
const HERO_INTERVAL_MS = 12000

function useHeroArtists() {
  const [artists, setArtists] = useState<(ArtistData | null)[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      const results = await Promise.all(
        HERO_ARTISTS.map(async (name) => {
          try {
            const res = await fetch(`/api/artist/${encodeURIComponent(name)}?history=true`)
            if (!res.ok) return null
            const data = await res.json()
            return data.artist as ArtistData
          } catch {
            return null
          }
        })
      )
      if (!cancelled) {
        setArtists(results.filter(Boolean) as ArtistData[])
        setLoaded(true)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  return { artists, loaded }
}

export default function About() {
  const { artists: heroArtists, loaded: heroLoaded } = useHeroArtists()
  const pageVisible = usePageVisible()
  const [displayIndex, setDisplayIndex] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const [drawingPrice, setDrawingPrice] = useState<number | null>(null)
  const [changeData, setChangeData] = useState<{ percentChange: number; rawChange: number } | null>(null)
  const [chartColor, setChartColor] = useState('#04df9d')

  // Only start cycling once artists are loaded, and only while the tab is
  // visible — the rotation is pure decoration.
  useEffect(() => {
    if (!heroLoaded || heroArtists.length === 0 || !pageVisible) return
    const timer = setInterval(() => {
      // Step 1: fade out
      setOpacity(0)
      setTimeout(() => {
        // Step 2: swap data while still invisible
        setDisplayIndex(i => (i + 1) % heroArtists.length)
        setDrawingPrice(null)
        setChangeData(null)
        setChartColor('#04df9d')
        // Step 3: wait for React to render the new data, then fade in
        requestAnimationFrame(() => {
          setOpacity(1)
        })
      }, 650)
    }, HERO_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [heroLoaded, heroArtists.length, pageVisible])

  const artist = heroArtists[displayIndex] ?? null
  const chartData = artist?.data_points ?? []

  return (
    <>
      {/* Mobile layout */}
      <div className="block md:hidden">
        <HowItWorksMobile />
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block min-h-screen">
      {/* Minimal sticky logo bar */}
      <header className="sticky top-0 z-[1000] border-b border-st-border bg-[rgb(10,10,10)] flex items-center" style={{ height: '4.284688rem', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
        <div className="w-full mx-auto flex min-w-0 max-w-[92.5rem] items-center justify-between xl:-translate-x-[0.4375rem]">
          <Link
            href="/"
            className="flex items-center gap-0 select-none no-underline origin-left scale-100"
            style={{ textDecoration: 'none', width: 'fit-content' }}
          >
            <Image
              src="/sonotrade_glyph_square_transparent.png"
              alt="Sonotrade"
              width={28.8}
              height={28.8}
              priority
              className="block h-8 w-auto"
              style={{ height: '2rem' }}
            />
            <span style={{ fontSize: '1.5rem', fontWeight: 400, letterSpacing: '-0.05em', color: 'var(--st-white)', fontFamily: 'var(--font-inter)', lineHeight: 1.5 }}>
              Sonotrade
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <a
              href="#foundations"
              className="text-sm transition-colors hover:opacity-100"
              style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', textDecoration: 'none', opacity: 0.8, letterSpacing: '-0.025em' }}
            >
              Foundations
            </a>
            <a
              href="#how-it-works"
              className="text-sm transition-colors hover:opacity-100"
              style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', textDecoration: 'none', opacity: 0.8, letterSpacing: '-0.025em' }}
            >
              How it works
            </a>
            <a
              href="#data-research"
              className="text-sm transition-colors hover:opacity-100"
              style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', textDecoration: 'none', opacity: 0.8, letterSpacing: '-0.025em' }}
            >
              Data &amp; Research
            </a>
            <a
              href="#ar-team"
              className="text-sm transition-colors hover:opacity-100"
              style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', textDecoration: 'none', opacity: 0.8, letterSpacing: '-0.025em' }}
            >
              A&amp;R
            </a>
            <Link
              href="/trade"
              className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium tracking-wide transition-all duration-75 hover:opacity-80 active:scale-90"
              style={{ backgroundColor: 'var(--st-white)', color: 'var(--st-black)', fontFamily: 'var(--font-inter)' }}
            >
              Start Trading
            </Link>
          </nav>
        </div>
      </header>
      <section className="border-b relative overflow-hidden" style={{
        borderColor: 'var(--st-border)',
        backgroundColor: 'rgb(10,10,10)',
      }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-20 sm:py-44 relative" style={{ zIndex: 1 }}>
          <div className="flex items-center gap-16">
            <div className="flex-1 min-w-0 max-w-xl">
              <h1 className="mb-6 m-0 p-0 text-3xl sm:text-4xl lg:text-5xl font-light leading-tight text-balance" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                The market where artists become tradable
              </h1>
              <CSXText variant="subtitle" color="STSecondary">
                Connecting retail traders, record labels, and institutional participants through a single, data-driven exchange.
              </CSXText>
              <div className="mt-6">
                <Link
                  href="/trade"
                  className="inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-75 hover:opacity-80 active:scale-90"
                  style={{
                    backgroundColor: 'var(--st-white)',
                    color: 'var(--st-black)',
                    fontFamily: 'var(--font-inter)',
                  }}
                >
                  Start Trading
                </Link>
              </div>
            </div>
            <div
              className="flex-1 min-w-0"
              style={{
                opacity: heroLoaded && artist ? opacity : 0,
                transition: 'opacity 0.6s ease',
                minHeight: '23.75rem',
                // Reserve space even before load so layout doesn't shift
                visibility: heroLoaded && artist ? 'visible' : 'hidden',
              }}
            >
              <div className="mb-6 flex flex-col gap-4">
                {/* Artist name and image */}
                <div className="flex items-center gap-4">
                  {artist?.image_url ? (
                    <img
                      src={artist.image_url}
                      alt={artist.name}
                      className="h-16 w-16 flex-shrink-0 select-none rounded-full object-cover"
                      style={{ minWidth: '4rem', minHeight: '4rem' }}
                      draggable={false}
                    />
                  ) : (
                    <div className="h-16 w-16 flex-shrink-0 rounded-full bg-zinc-800" style={{ minWidth: '4rem', minHeight: '4rem' }} />
                  )}
                  <h2 className="m-0 min-w-0 p-0 text-3xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                    {artist?.name ?? ''}
                  </h2>
                </div>
                {/* Index price */}
                <NumberFlowGroup>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3">
                    <AnimatedPrice
                      value={drawingPrice ?? artist?.index_price ?? 0}
                      fontSize={40}
                      color="STWhite"
                    />
                    <span className="text-2xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                      points
                    </span>
                  </div>
                  {changeData && (
                    <div className="flex items-center gap-3 ml-2">
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 18"
                          width="16"
                          height="16"
                          className="shrink-0"
                          style={{
                            color: chartColor,
                            transform: `rotate(${changeData.percentChange >= 0 ? '0deg' : '180deg'}) translateY(1px)`,
                          }}
                        >
                          <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
                        </svg>
                        <AnimatedPrice
                          value={Math.abs(changeData.percentChange)}
                          fontSize={16}
                          color={chartColor}
                          suffix="%"
                        />
                      </div>
                      <AnimatedPrice
                        value={Math.abs(changeData.rawChange)}
                        fontSize={16}
                        color={chartColor}
                        prefix={changeData.rawChange >= 0 ? '+$' : '-$'}
                      />
                    </div>
                  )}
                </div>
                </NumberFlowGroup>
              </div>
              <SXAboutChart
                data={chartData} 
                height={260}
                onDrawingPriceChange={setDrawingPrice}
                onDrawingChangeData={setChangeData}
                onColorChange={setChartColor}
              />
            </div>
          </div>
        </div>
      </section>

      {/* What is Sonotrade */}
      <section id="foundations" className="border-b relative" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-32">
          <div className="flex gap-20">
            {/* Left column with logos and lines */}
            <div className="hidden lg:flex flex-col items-start justify-center" style={{ width: '35rem' }}>
              {/* Streaming service logos */}
              <div className="flex items-center justify-between w-full px-4 mb-0 relative" style={{ height: '4rem' }}>
                {/* Spotify - positioned at left */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--st-border)' }}>
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="white">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                {/* Apple Music */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--st-border)' }}>
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                    <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408a10.61 10.61 0 0 0-.1 1.18c0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 0 1 1.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 0 0 .02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 0 0-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066l-5.597 1.09c-.306.06-.43.197-.437.516v7.37c0 .38-.05.753-.203 1.103-.28.64-.77 1.04-1.434 1.233-.365.106-.742.16-1.123.18-.96.05-1.79-.593-1.96-1.53a1.88 1.88 0 0 1 1.048-2.025c.355-.177.735-.267 1.117-.344.27-.055.54-.102.808-.16.39-.084.594-.292.615-.696.004-.08 0-.16 0-.24V5.992c0-.564.15-.915.57-1.04 1.914-.568 3.83-1.132 5.744-1.697.582-.172 1.164-.345 1.746-.516.47-.14.69-.01.69.478v5.896z"/>
                  </svg>
                </div>
                {/* Deezer */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--st-border)' }}>
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                    <path d="M18.81 4.16v3.03h5.16V4.16h-5.16zm0 4.54v3.03h5.16V8.7h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zM12.63 4.16v3.03h5.16V4.16h-5.16zm0 4.54v3.03h5.16V8.7h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zM6.45 8.7v3.03h5.16V8.7H6.45zm0 4.54v3.03h5.16v-3.03H6.45zm0 4.54v3.03h5.16v-3.03H6.45zM.27 13.24v3.03h5.16v-3.03H.27zm0 4.54v3.03h5.16v-3.03H.27z"/>
                  </svg>
                </div>
                {/* YouTube Music */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--st-border)' }}>
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/>
                  </svg>
                </div>
              </div>
              
              {/* Lines merging */}
              {/* Sized in rem, NOT px: the icon circles above lay out in rem
                  (w-16 + px-4) inside the 35rem column, and the root font-size
                  is 90% — a fixed 560px SVG renders wider than the 504px the
                  circles actually occupy, so the lines miss their centers.
                  With width:35rem the viewBox scales in lockstep with the rem
                  layout and each line lands exactly on a circle center at any
                  font scale. */}
              <svg viewBox="0 0 560 258" className="overflow-visible" style={{ width: '35rem', height: 'auto' }}>
                <defs>
                  <path id="path1" d="M 48 0 L 48 140 L 280 200 L 280 258" />
                  <path id="path2" d="M 203 0 L 203 140 L 280 200 L 280 258" />
                  <path id="path3" d="M 357 0 L 357 140 L 280 200 L 280 258" />
                  <path id="path4" d="M 512 0 L 512 140 L 280 200 L 280 258" />
                </defs>

                {/* Four lines coming down from center of logos - base layer */}
                <line x1="48" y1="0" x2="48" y2="140" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="203" y1="0" x2="203" y2="140" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="357" y1="0" x2="357" y2="140" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="512" y1="0" x2="512" y2="140" stroke="var(--st-border)" strokeWidth="2" />

                {/* Pulsating white overlay lines */}
                <line x1="48" y1="0" x2="48" y2="140" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" />
                </line>
                <line x1="203" y1="0" x2="203" y2="140" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="0.75s" />
                </line>
                <line x1="357" y1="0" x2="357" y2="140" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="1.5s" />
                </line>
                <line x1="512" y1="0" x2="512" y2="140" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="2.25s" />
                </line>

                {/* Converging lines - base layer */}
                <line x1="48" y1="140" x2="280" y2="200" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="203" y1="140" x2="280" y2="200" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="357" y1="140" x2="280" y2="200" stroke="var(--st-border)" strokeWidth="2" />
                <line x1="512" y1="140" x2="280" y2="200" stroke="var(--st-border)" strokeWidth="2" />

                {/* Pulsating white overlay for converging lines */}
                <line x1="48" y1="140" x2="280" y2="200" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" />
                </line>
                <line x1="203" y1="140" x2="280" y2="200" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="0.75s" />
                </line>
                <line x1="357" y1="140" x2="280" y2="200" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="1.5s" />
                </line>
                <line x1="512" y1="140" x2="280" y2="200" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" begin="2.25s" />
                </line>

                {/* Single merged line going down to artist list border - base layer */}
                <line x1="280" y1="200" x2="280" y2="258" stroke="var(--st-border)" strokeWidth="2" />

                {/* Pulsating white overlay for merged line */}
                <line x1="280" y1="200" x2="280" y2="258" stroke="white" strokeWidth="2" opacity="0">
                  <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" />
                </line>
                
                
                {/* Animated dots following the paths - multiple dots per path */}
                {/* Path 1 dots */}
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite">
                    <mpath href="#path1" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="2s">
                    <mpath href="#path1" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="2s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="2s" />
                </circle>

                {/* Path 2 dots */}
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="0.5s">
                    <mpath href="#path2" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="0.5s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="0.5s" />
                </circle>
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="2.5s">
                    <mpath href="#path2" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="2.5s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="2.5s" />
                </circle>

                {/* Path 3 dots */}
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="1s">
                    <mpath href="#path3" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="1s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="1s" />
                </circle>
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="3s">
                    <mpath href="#path3" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="3s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="3s" />
                </circle>

                {/* Path 4 dots */}
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s">
                    <mpath href="#path4" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="1.5s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="1.5s" />
                </circle>
                <circle r="2.5" fill="white" opacity="0">
                  <animateMotion dur="4s" repeatCount="indefinite" begin="3.5s">
                    <mpath href="#path4" />
                  </animateMotion>
                  <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin="3.5s" />
                  <animate attributeName="r" values="2;2.5;2.5;2" dur="4s" repeatCount="indefinite" begin="3.5s" />
                </circle>
              </svg>

              {/* Top 10 Artists by Index */}
              <SXTopArtistsList />
            </div>
            
            {/* Right column with content */}
            <div className="flex-1">
              <div className="mb-12">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                  WHAT IS SONOTRADE
                </span>
              </div>
              <div className="space-y-8">
            <div>
              <h3 className="mb-4 m-0 p-0">
                <CSXText variant="subtitle" color="STWhite">
                  Our Mission
                </CSXText>
              </h3>
              <CSXText variant="body1" color="STSecondary">
                Sonotrade is building the first regulated exchange for the music industry. The platform aggregates streaming and performance data to construct live indexes for individual artists, enabling participants to take long or short positions on how an artist performs over time. It serves both retail traders seeking direct market exposure and industry participants who need instruments to hedge financial risk across signings and catalogue acquisitions.
              </CSXText>
            </div>
            <div>
              <h3 className="mb-4 m-0 p-0">
                <CSXText variant="subtitle" color="STWhite">
                  The Indexes
                </CSXText>
              </h3>
              <CSXText variant="body1" color="STSecondary">
                Each artist listed on Sonotrade is assigned a live index that recalculates continuously from streaming volume, chart positioning, and broader performance data. Every contract traded on the platform is priced against this index, ensuring that market prices remain anchored to verifiable, real-world output rather than sentiment alone.
              </CSXText>
            </div>
            <div>
              <h3 className="mb-4 m-0 p-0">
                <CSXText variant="subtitle" color="STWhite">
                  The Vision
                </CSXText>
              </h3>
              <CSXText variant="body1" color="STSecondary">
                The music industry generates substantial economic activity, yet structured financial instruments for it have never existed at scale. Labels absorb significant balance sheet risk through advances and royalty commitments, while retail participants have had no route into the asset class. Sonotrade closes both gaps, providing the exchange infrastructure needed to price, trade, and hedge music-related risk for the first time.
              </CSXText>
            </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why metrics matter */}
      <section id="how-it-works" className="border-b relative" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-32">
          <div className="mb-12">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
              WHY STREAMING METRICS MATTER
            </span>
          </div>
          <div className="flex gap-28">
            {/* Left: headline + body */}
            <div className="flex-1">
              <div className="space-y-8">
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      Streams drive commercial value
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    In the modern music economy, commercial value tracks listenership with near-perfect correlation. Streams determine chart positions, chart positions unlock sync licensing deals, festival slots, and brand partnerships. All of that flows back into catalogue valuations and advance negotiations.
                  </CSXText>
                </div>
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      The missing market
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    Until now there has been no structured way to act on that signal. A label can observe that an artist is growing, but has no instrument to hedge the risk of that growth reversing after a multi-million-dollar advance. A retail participant can sense cultural momentum, but has no market to express that view.
                  </CSXText>
                </div>
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      The Sonotrade solution
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    Sonotrade converts observable streaming data into tradeable indexes, making the relationship between audience and economic value legible, liquid, and actionable for the first time.
                  </CSXText>
                </div>
              </div>
            </div>

            {/* Right: cylinder scroller */}
            <div className="hidden lg:flex items-center justify-end">
              <SXStreamingMetricsScroller />
            </div>
          </div>
        </div>
      </section>

      {/* Who is Sonotrade for */}
      <section className="relative" style={{ backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-32">
          <div className="flex gap-28">
            {/* Left column with animated network graphic */}
            <div className="hidden lg:flex flex-col items-center justify-center" style={{ width: '35rem' }}>
              <SXCultureNetworkGraphic />
            </div>

            {/* Right column with content */}
            <div className="flex-1">
              <div className="mb-12">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                  WHO IS SONOTRADE FOR
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>01</div>
                  <svg width="28" height="28" viewBox="-14 -14 28 28" fill="none" style={{ color: 'var(--st-secondary)' }}>
                    <circle cx="-5" cy="-5" r="4" fill="currentColor" opacity="0.8" />
                    <circle cx="5" cy="-5" r="4" fill="currentColor" opacity="0.8" />
                    <path d="M -11 10 Q -11 2 -5 2 Q 0 2 0 10 M 0 10 Q 0 2 5 2 Q 11 2 11 10" fill="currentColor" opacity="0.8" />
                  </svg>
                </div>
                <CSXText variant="body1" color="STSecondary">
                  Retail participants seeking direct financial exposure to the music industry. Establish long or short positions on individual artists, with pricing grounded in live performance data rather than sentiment.
                </CSXText>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>02</div>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--st-secondary)', opacity: 0.8 }}>
                    <path d="M2 19h20v3H2zM12 2L2 6v2h20V6M17 10h3v7h-3zM10.5 10h3v7h-3zM4 10h3v7H4z" />
                  </svg>
                </div>
                <CSXText variant="body1" color="STSecondary">
                  Record labels and industry institutions that carry financial exposure across artist signings, advance structures, and royalty portfolios, and require instruments to actively manage and hedge that risk.
                </CSXText>
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>03</div>
                  <svg width="28" height="28" viewBox="-13 -13 26 26" fill="none" style={{ color: 'var(--st-secondary)' }}>
                    <circle cx="0" cy="0" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
                    <ellipse cx="0" cy="0" rx="4.5" ry="11" stroke="currentColor" strokeWidth="1" opacity="0.8" />
                    <line x1="-11" y1="0" x2="11" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                    <line x1="-9" y1="-6" x2="9" y2="-6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                    <line x1="-9" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                  </svg>
                </div>
                <CSXText variant="body1" color="STSecondary">
                  Any participant who recognises that cultural output carries measurable economic value and wants a structured way to act on it. Sonotrade provides the exchange infrastructure to do so with precision and transparency, in a market that has not existed until now.
                </CSXText>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data & Research */}
      <section id="data-research" className="border-t border-b relative" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-32">
          <div className="flex gap-20">
            {/* Left: content */}
            <div className="flex-1">
              <div className="mb-12">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                  DATA &amp; RESEARCH
                </span>
              </div>
              <div className="space-y-8">
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      A market that generates data at scale
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    Every trade placed on Sonotrade produces a data point. Across thousands of participants and thousands of artists, that adds up to a dense, continuously updated picture of where capital and conviction are moving in real time. No other source generates this kind of structured, financially-grounded dataset in the music industry.
                  </CSXText>
                </div>
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      Beyond engagement metrics
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    The positioning data generated on Sonotrade carries an informational depth that goes well beyond surface-level popularity metrics. When participants put capital behind an artist, they are expressing a conviction backed by real risk. That signal, who is actually taking positions early and how large, is a fundamentally different kind of data to engagement or follower counts.
                  </CSXText>
                </div>
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      Market behaviour as intelligence
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    Trading activity on a live market generates a continuous stream of behavioural signals. When participants with strong historical accuracy begin moving around the same artist, that pattern carries information the kind that does not surface through traditional scouting channels. This is one example of how market data can function as an early intelligence layer for the industry.
                  </CSXText>
                </div>
                <div>
                  <h3 className="mb-4 m-0 p-0">
                    <CSXText variant="subtitle" color="STWhite">
                      Top traders as a signal source
                    </CSXText>
                  </h3>
                  <CSXText variant="body1" color="STSecondary">
                    In any market, a subset of participants consistently positions ahead of broader moves. Their track record is observable in the data. When that subset begins concentrating around the same artist, it is not a single opinion or a trend report. It is financially-backed conviction from people who have repeatedly demonstrated patterns that predict hits. That kind of signal is hard to ignore.
                  </CSXText>
                </div>
              </div>
            </div>

            {/* Right: radar graphic */}
            <div className="hidden lg:flex items-center justify-center" style={{ width: '28.75rem' }}>
              <SXRadarGraphic />
            </div>
          </div>
        </div>
      </section>

      {/* A&R Team */}
      <section id="ar-team" className="border-b relative" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-32">
          <div className="mb-12">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
              A&amp;R TEAM
            </span>
          </div>
          {/* Row 1: headline + description stacked */}
          <div className="flex flex-col gap-5 mb-12">
            <h2 className="m-0 p-0 text-3xl sm:text-4xl font-light leading-tight" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
              An A&amp;R engine built on market behaviour, not traditional scouting
            </h2>
            <CSXText variant="body1" color="STSecondary">
              Sonotrade operates a dedicated A&amp;R team that works directly from the signals generated by the platform. Rather than relying on traditional scouting alone, the team uses positioning data as a primary input, identifying where conviction is clustering, cross-referencing that against streaming trajectory and index momentum, and converting the strongest signals into active deal flow. This is A&amp;R built on the same analytical foundation as the exchange itself.
            </CSXText>
          </div>

          {/* Row 2: 3 steps in equal boxes */}
          <div className="grid grid-cols-3 gap-5">
            <div className="flex flex-col gap-6 p-6 rounded-xl" style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-4">
                <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>01</div>
                <svg width="28" height="28" viewBox="-14 -14 28 28" fill="none" style={{ color: 'var(--st-secondary)' }}>
                  <circle cx="0" cy="0" r="2.5" fill="currentColor" opacity="0.9" />
                  <circle cx="0" cy="0" r="7" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
                  <circle cx="0" cy="0" r="12" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.25" />
                  <line x1="0" y1="-14" x2="0" y2="-12.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  <line x1="0" y1="12.5" x2="0" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  <line x1="-14" y1="0" x2="-12.5" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                  <line x1="12.5" y1="0" x2="14" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                </svg>
              </div>
              <CSXText variant="body1" color="STSecondary">
                Trading activity is monitored for clustering patterns, moments where positioning across multiple participants begins to converge around the same artist within a short window.
              </CSXText>
            </div>

            <div className="flex flex-col gap-6 p-6 rounded-xl" style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-4">
                <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>02</div>
                <svg width="28" height="28" viewBox="-14 -14 28 28" fill="none" style={{ color: 'var(--st-secondary)' }}>
                  <path d="M -11 -9 L 11 -9 L 3.5 0 L 3.5 8 L -3.5 8 L -3.5 0 Z"
                    stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" opacity="0.8" />
                  <line x1="-7.5" y1="-5.5" x2="7.5" y2="-5.5" stroke="currentColor" strokeWidth="1" opacity="0.45" />
                  <line x1="-4.5" y1="-2.5" x2="4.5" y2="-2.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
                </svg>
              </div>
              <CSXText variant="body1" color="STSecondary">
                Candidate signals are evaluated against broader market context, index trajectory, volume behaviour, and historical patterns, to distinguish genuine early conviction from noise.
              </CSXText>
            </div>

            <div className="flex flex-col gap-6 p-6 rounded-xl" style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-4">
                <div className="text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>03</div>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--st-secondary)' }}>
                  <path d="M22 7.99995H20M20 7.99995H19C17 6.00173 14 3.99974 12 5.99995M20 7.99995V15.9999M12 5.99995L8.99956 9.00158C8.9202 9.08097 8.88052 9.12066 8.84859 9.1558C8.15499 9.91889 8.15528 11.0842 8.84927 11.847C8.88121 11.8821 8.92098 11.9218 9.00031 12.0011C9.07967 12.0804 9.11936 12.1201 9.15449 12.152C9.91743 12.8453 11.0824 12.8452 11.8451 12.1516C11.8802 12.1197 11.9199 12.08 11.9992 12.0007L12.9996 11.0003M12 5.99995C10 3.99974 7 6.0018 5 8.00001H4M2 8.00001H4M4 8.00001V15.9999M20 15.9999V18.9999H22M20 15.9999H17.1716M15 12.9999L16.5 14.4999C16.5796 14.5796 16.6195 14.6194 16.6515 14.6547C17.3449 15.4175 17.3449 16.5824 16.6515 17.3452C16.6195 17.3805 16.5796 17.4203 16.5 17.4999C16.4204 17.5795 16.3805 17.6194 16.3453 17.6515C15.5824 18.3449 14.4176 18.3449 13.6547 17.6515C13.6195 17.6194 13.5796 17.5795 13.5 17.4999L13 16.9999C12.4548 17.5452 12.1821 17.8178 11.888 17.9636C11.3285 18.2408 10.6715 18.2408 10.112 17.9636C9.81788 17.8178 9.54525 17.5452 9 16.9999C8.31085 17.9188 6.89563 17.7912 6.38197 16.7639L6 15.9999H4M4 15.9999V18.9999H2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
                </svg>
              </div>
              <CSXText variant="body1" color="STSecondary">
                Signals that clear the threshold feed into an active pipeline. From there, the work shifts from data to relationships, converting market intelligence into active dealflow.
              </CSXText>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise API Teaser */}
      <section className="border-b relative" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-16 sm:py-24">
          <div className="flex items-center justify-between gap-16 p-8 sm:p-12 rounded-2xl" style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
            {/* subtle grid background */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--st-border) 1px, transparent 1px), linear-gradient(90deg, var(--st-border) 1px, transparent 1px)', backgroundSize: '3rem 3rem', opacity: 0.3, zIndex: 0 }} />
            {/* Endpoints — left */}
            <div className="relative hidden lg:flex flex-col gap-3 shrink-0" style={{ zIndex: 1, width: '22.5rem' }}>
              {[
                { endpoint: 'GET /v1/indexes/:artist',     desc: 'Live artist index price' },
                { endpoint: 'GET /v1/leaderboard/flows',   desc: 'Top trader positioning data' },
                { endpoint: 'GET /v1/signals/conviction',  desc: 'Aggregated conviction signal' },
                { endpoint: 'GET /v1/artists/:id/history', desc: 'Historical index & volume' },
              ].map((row) => (
                <div key={row.endpoint} className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg" style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(10,10,10,0.8)' }}>
                  <code className="text-xs" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-mono, monospace)', opacity: 0.85 }}>
                    {row.endpoint}
                  </code>
                  <span className="text-[0.625rem] shrink-0" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                    {row.desc}
                  </span>
                </div>
              ))}
            </div>
            {/* Text — right */}
            <div className="relative flex flex-col gap-4 max-w-lg" style={{ zIndex: 1 }}>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                  ENTERPRISE API
                </span>
                <span className="text-[0.625rem] uppercase tracking-widest px-2 py-0.5 rounded" style={{ color: 'var(--st-secondary)', border: '1px solid var(--st-border)', fontFamily: 'var(--font-inter)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  Coming soon
                </span>
              </div>
              <h2 className="m-0 p-0 text-2xl sm:text-3xl font-light leading-snug" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                Programmatic access to Sonotrade&apos;s market data and signal layer
              </h2>
              <CSXText variant="body1" color="STSecondary">
                Direct API access to live artist indexes, historical positioning data, leaderboard flows, and aggregated conviction signals. Built for industry participants, research teams, and data-driven operators who need structured music market data integrated into their own systems.
              </CSXText>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t relative overflow-hidden" style={{ borderColor: 'var(--st-border)', backgroundColor: 'rgb(10,10,10)', zIndex: 2 }}>
        <div className="w-full max-w-[92.5rem] mx-auto py-32 sm:py-48 flex flex-col items-center text-center gap-6 relative" style={{ zIndex: 1 }}>
          <h2
            className="m-0 p-0 text-4xl sm:text-5xl lg:text-6xl font-light leading-tight text-balance"
            style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)', maxWidth: '45rem' }}
          >
            The Market Infrastructure for Music. Now in beta.
          </h2>
          <CSXText variant="subtitle" color="STSecondary">
            Real data. Real positions. The first exchange for music derivatives.
          </CSXText>
          <Link
            href="/trade"
            className="mt-4 inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-medium tracking-wide transition-all duration-75 hover:opacity-80 active:scale-90"
            style={{
              backgroundColor: 'var(--st-white)',
              color: 'var(--st-black)',
              fontFamily: 'var(--font-inter)',
            }}
          >
            Start Trading
          </Link>
        </div>
      </section>
      </div>
    </>
  )
}
