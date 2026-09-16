'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileView, type ProfileData } from '@/components/profile/ProfileView'
import { SXPageLoading } from '@/components/sx/SXPageLoading'
import { mainColumnWidthStyle } from '@/lib/mainColumnLayout'
import { logout } from '@/lib/logout'
import { usePortfolio } from '@/lib/hooks/usePortfolio'
import { useTradeHistory } from '@/lib/hooks/useTradeHistory'

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export default function ProfilePage() {
  const router = useRouter()
  // Portfolio and history come from the shared cache (same entries the
  // portfolio page and mobile panel read); only /api/auth/me is still fetched
  // here, because nothing else needs it.
  const { data: portfolio } = usePortfolio()
  const { history: trades } = useTradeHistory()
  const [me, setMe] = useState<{
    id?: string; _id?: string; username: string; avatar_url?: string | null
    created_at?: string; total_volume?: number
  } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleLogout = useCallback(async () => {
    await logout()
    router.push('/')
  }, [router])

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) { router.push('/'); return }
    try {
      const meRes = await fetch('/api/auth/me', { headers: getAuthHeaders() })
      if (!meRes.ok) { router.push('/'); return }
      const user = (await meRes.json()).user
      if (!user) { router.push('/'); return }
      if (user.avatar_url) setAvatarUrl(user.avatar_url)
      setMe(user)
    } catch (e) {
      console.error(e)
    }
  }, [router])

  // Derived, not stored: the three sources are independently cached and any of
  // them can refresh on a trade, so recomputing is simpler than keeping a
  // fourth copy in state in sync with them.
  const data: ProfileData | null = useMemo(() => {
    if (!me) return null
    return {
      username: me.username,
      avatar_url: me.avatar_url ?? null,
      created_at: me.created_at || new Date().toISOString(),
      total_volume: me.total_volume || 0,
      total_unrealized_pnl: portfolio?.total_unrealized_pnl || 0,
      realized_pnl: trades.reduce((sum, t) => sum + (t.unrealized_pnl || 0), 0),
      positions: portfolio?.positions ?? [],
      trades,
      userId: me.id || me._id,
    } as ProfileData
  }, [me, portfolio, trades])

  // load() only setState()s after awaits (network), not synchronously — same
  // pattern as the portfolio page.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const token = localStorage.getItem('auth_token')
    if (!token) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      if (json.avatar_url) {
        setAvatarUrl(json.avatar_url)
        setMe(prev => (prev ? { ...prev, avatar_url: json.avatar_url } : prev))
        try {
          const stored = JSON.parse(localStorage.getItem('user') || 'null')
          if (stored) localStorage.setItem('user', JSON.stringify({ ...stored, avatar_url: json.avatar_url }))
        } catch { /* ignore */ }
      }
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[rgb(10,10,10)] text-white flex justify-center">
        <div className="shrink-0 border-x border-[#262626]" style={mainColumnWidthStyle}>
          <SXPageLoading aria-label="Loading profile" />
        </div>
      </main>
    )
  }

  return (
    <>
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <ProfileView
        data={data}
        isOwn
        avatarUrl={avatarUrl}
        avatarUploading={avatarUploading}
        onAvatarClick={() => avatarInputRef.current?.click()}
        onLogout={handleLogout}
      />
    </>
  )
}
