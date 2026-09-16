'use client'

import { useState, useEffect, useRef } from 'react'

interface Artist {
  name: string
  index_price: number | null
  change_1d: number | null
  image_url: string | null
}

export default function AdminPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/artists')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setArtists(d.artists)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleUpload = async (artistName: string, file: File) => {
    setUploading(artistName)
    setUploadError((prev) => ({ ...prev, [artistName]: '' }))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('artist_name', artistName)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setArtists((prev) =>
        prev.map((a) => (a.name === artistName ? { ...a, image_url: data.url } : a))
      )
    } catch (e: any) {
      setUploadError((prev) => ({ ...prev, [artistName]: e.message }))
    } finally {
      setUploading(null)
    }
  }

  const filtered = artists.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded-sm opacity-80" />
          <span className="text-sm text-zinc-400 font-mono">Sonotrade</span>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-white">Admin</span>
        </div>
        <div className="text-xs text-zinc-500">
          {artists.length} artist{artists.length !== 1 ? 's' : ''}
        </div>
      </header>

      <main className="px-6 py-8 max-w-7xl mx-auto">
        {/* Title + search */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Artist Images</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Upload an artist image — it will be stored in S3 and linked to the artist.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search artists…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-56"
          />
        </div>

        {/* SQL note */}
        <div className="mb-8 p-4 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-mono text-zinc-500">
          <span className="text-zinc-400">-- Run once in Supabase SQL Editor:</span>
          {' '}ALTER TABLE public.artist_metrics ADD COLUMN IF NOT EXISTS image_url text;
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">
            Loading artists…
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-red-800 bg-red-950/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((artist) => (
              <ArtistCard
                key={artist.name}
                artist={artist}
                isUploading={uploading === artist.name}
                uploadError={uploadError[artist.name]}
                onUpload={handleUpload}
              />
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-zinc-500 text-sm py-12">
                No artists found
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ArtistCard({
  artist,
  isUploading,
  uploadError,
  onUpload,
}: {
  artist: Artist
  isUploading: boolean
  uploadError?: string
  onUpload: (name: string, file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isPositive = (artist.change_1d ?? 0) >= 0

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col">
      {/* Image area */}
      <div className="relative aspect-square bg-zinc-900 flex items-center justify-center group">
        {artist.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artist.image_url}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Upload overlay */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-wait"
        >
          {isUploading ? (
            <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <div className="flex flex-col items-center gap-1 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-medium">{artist.image_url ? 'Replace' : 'Upload'}</span>
            </div>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(artist.name, file)
            e.target.value = ''
          }}
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate" title={artist.name}>
          {artist.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-zinc-500">
            {artist.index_price != null ? artist.index_price.toFixed(2) : '—'}
          </span>
          {artist.change_1d != null && (
            <span className={`text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{artist.change_1d.toFixed(2)}%
            </span>
          )}
        </div>
        {uploadError && (
          <p className="text-xs text-red-400 mt-1 truncate" title={uploadError}>
            {uploadError}
          </p>
        )}
      </div>
    </div>
  )
}
