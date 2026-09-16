'use client'

import React, { useState } from 'react'

const V_MASK =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)'
const H_MASK =
  'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)'

/**
 * The home-page hero "image slide" treatment, extracted so the discover
 * slideshows can reuse the exact same effect:
 *  1. blurred, color-matched, dimmed backdrop (fills negative space)
 *  2. subtle side-darken gradient (depth without a visible frame)
 *  3. object-contain foreground sized to the image's natural aspect, with a
 *     horizontal mask that dissolves the left/right edges into the backdrop.
 */
export function HeroImageLayers({
  src,
  alt,
  foregroundRef,
  fetchPriority,
  onForegroundLoad,
  fit = false,
}: {
  src: string
  alt: string
  foregroundRef?: React.Ref<HTMLImageElement>
  fetchPriority?: 'high' | 'low' | 'auto'
  onForegroundLoad?: () => void
  /**
   * `fit` mode: foreground is sized to full width (height auto) and uses the
   * same edge-dissolve as the banner but rotated vertical — so a wide image
   * keeps its full width and its top/bottom edges fade into the blurred
   * backdrop. Use for square/contained surfaces; the default banner mode
   * keeps the full-height foreground with the horizontal edge-dissolve.
   */
  fit?: boolean
}) {
  // `fit` mode sizes each image by its own orientation (measured on load) so
  // wide and tall images are never squished into a single forced dimension.
  const [wide, setWide] = useState<boolean | null>(null)

  const fitStyle: React.CSSProperties | undefined =
    wide === null
      ? undefined
      : {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '100%',
          maxHeight: '100%',
          ...(wide
            ? { width: '100%', height: 'auto', WebkitMaskImage: V_MASK, maskImage: V_MASK }
            : { height: '100%', width: 'auto', WebkitMaskImage: H_MASK, maskImage: H_MASK }),
        }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority={fetchPriority}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: 'blur(3rem) brightness(0.7) saturate(1.1)',
          transform: 'scale(1.15)',
          objectPosition: 'center',
        }}
      />
      {!fit && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            pointerEvents: 'none',
            background:
              'linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.15) 100%)',
          }}
        />
      )}
      {fit ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={foregroundRef}
          src={src}
          alt={alt}
          fetchPriority={fetchPriority}
          decoding="async"
          // Until measured, contain it (no distortion); then size by orientation.
          className={wide === null ? 'absolute inset-0 h-full w-full object-contain' : undefined}
          style={fitStyle}
          onLoad={(e) => {
            const im = e.currentTarget
            setWide(im.naturalWidth >= im.naturalHeight)
            onForegroundLoad?.()
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={foregroundRef}
          src={src}
          alt={alt}
          fetchPriority={fetchPriority}
          decoding="async"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            height: '100%',
            width: 'auto',
            // maxWidth must be EXPLICITLY none — Tailwind preflight sets
            // `img { max-width: 100% }`, which clamps a wide image's width
            // while the height stays 100% and squeezes it horizontally on
            // narrow containers (the mobile hero). Unclamped, the image keeps
            // its natural aspect and crops at the clipped edges; the mask
            // below fades the cut, and every container clips overflow.
            maxWidth: 'none',
            maxHeight: '100%',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)',
          }}
          onLoad={onForegroundLoad}
        />
      )}
    </>
  )
}
