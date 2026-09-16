'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import Image from 'next/image'
import Link from 'next/link'
import { CSXButton } from '@/components/sx/core/CSXButton'
import { CSXText } from '@/components/sx/core/CSXText'

type Mode = 'login' | 'signup'
type Step = 'form' | 'otp' | 'profile'
type LoginMode = 'password' | 'otp'

function ArtistCardStack() {
  const [artists, setArtists] = useState<Array<{ id: string; name: string; image_url: string | null; change_1m: number | null }>>([])
  const offsetRef = useRef(1500)
  const targetRef = useRef(0)
  const isEnteringRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const hoveredRef = useRef<number | null>(null)
  const hoverLiftRef = useRef<number[]>([])
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const nameRefs = useRef<(HTMLSpanElement | null)[]>([])
  const lineWidthRef = useRef<number[]>([])

  useEffect(() => {
    fetch('/api/discover?limit=20&offset=0&sort_by=volume&sort_dir=desc')
      .then(r => r.json())
      .then(data => { if (data.artists) setArtists(data.artists.slice(0, 20).map((a: { id: string; name: string; image_url: string | null; change_1m: number | null }) => ({ id: a.id, name: a.name, image_url: a.image_url, change_1m: a.change_1m ?? null }))) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => { e.preventDefault(); targetRef.current += e.deltaY * 0.6 }
    const el = containerRef.current
    el?.addEventListener('wheel', onWheel, { passive: false })
    return () => el?.removeEventListener('wheel', onWheel)
  }, [artists])

  useEffect(() => {
    const STEP = 55
    const VISIBLE = 8
    const FADE = 1.5

    const tick = () => {
      const lerpFactor = isEnteringRef.current ? 0.025 : 0.08
      if (isEnteringRef.current && Math.abs(targetRef.current - offsetRef.current) < 5) isEnteringRef.current = false
      offsetRef.current += (targetRef.current - offsetRef.current) * lerpFactor
      const n = cardRefs.current.length
      if (!n) { rafRef.current = requestAnimationFrame(tick); return }

      const centerSlot = offsetRef.current / STEP

      cardRefs.current.forEach((el, i) => {
        if (!el) return

        const repeat = Math.round((centerSlot - i) / n)
        const slot = (i + repeat * n) - centerSlot

        if (slot < -10 || slot >= 25) {
          el.style.opacity = '0'
          return
        }

        el.style.opacity = '1'
        el.style.zIndex = String(200 - Math.round(slot * 10))

        const exitScale = Math.min(1.6, Math.max(0.5, 1 - slot * 0.02))
        const tx = ((VISIBLE - 1 - slot) * 32).toFixed(1)
        const ty = ((VISIBLE - 1 - slot) * 95).toFixed(1)
        const tz = (-slot * 28).toFixed(1)
        if (hoverLiftRef.current[i] === undefined) hoverLiftRef.current[i] = 0
        if (lineWidthRef.current[i] === undefined) lineWidthRef.current[i] = 0
        const targetLift = hoveredRef.current === i ? -30 : 0
        hoverLiftRef.current[i] += (targetLift - hoverLiftRef.current[i]) * 0.15
        lineWidthRef.current[i] += ((hoveredRef.current === i ? 200 : 0) - lineWidthRef.current[i]) * 0.15
        const lineEl = lineRefs.current[i]
        if (lineEl) lineEl.style.width = lineWidthRef.current[i].toFixed(1) + 'px'
        const nameEl = nameRefs.current[i]
        if (nameEl) {
          const fullName = (nameEl as HTMLElement).dataset.name || ''
          const charCount = Math.min(fullName.length, Math.round((lineWidthRef.current[i] / 175) * fullName.length))
          nameEl.textContent = fullName.substring(0, charCount)
          nameEl.style.opacity = charCount > 0 ? '1' : '0'
        }
        const shadowStrength = Math.max(0, 1 - slot * 0.1)
        el.style.boxShadow = `0.625rem 1rem ${Math.round(35 + shadowStrength * 30)}px 0.5rem rgba(0,0,0,${(0.4 + shadowStrength * 0.45).toFixed(2)}), inset 0 0.125rem 0 rgba(240,235,215,0.5), inset 0.125rem 0 0 rgba(240,235,215,0.45)`
        el.style.transform = `translateY(${hoverLiftRef.current[i].toFixed(2)}px) scaleX(6) rotateX(8deg) rotateY(-100deg) translate3d(${tx}px, ${ty}px, ${tz}px) scale(${exitScale.toFixed(3)}) skewY(-10deg)`
      })

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (artists.length === 0) return null

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '75rem', perspectiveOrigin: '0% 20%', paddingBottom: '55%', overflow: 'hidden' }}
      onMouseMove={e => {
        const mx = e.clientX, my = e.clientY
        let bestIdx: number | null = null
        let bestZ = -Infinity
        cardRefs.current.forEach((el, i) => {
          if (!el) return
          const r = el.getBoundingClientRect()
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            const z = parseInt(el.style.zIndex || '0')
            if (z > bestZ) { bestZ = z; bestIdx = i }
          }
        })
        hoveredRef.current = bestIdx
      }}
      onMouseLeave={() => { hoveredRef.current = null }}
    >
      {/* Single anchor div — all cards share this position so the composition never shifts */}
      <div style={{ transform: 'scale(0.80)', transformOrigin: 'center center' }}>
      <div style={{ position: 'relative', width: '17.5rem', height: '23.75rem' }}>
        {artists.map((artist, i) => (
          artist.image_url ? (
            <div
              key={artist.id}
              ref={el => { cardRefs.current[i] = el }}
              style={{ position: 'absolute', top: '0rem', left: '0rem', width: '17.5rem', height: '23.75rem', borderRadius: '0.75rem', transformOrigin: 'center center', cursor: 'pointer' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artist.image_url ?? ''}
                alt={artist.name}
                style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', borderRadius: '0.75rem', overflow: 'hidden', transform: 'scaleX(-1)' }}
                draggable={false}
              />
              {/* 1-month change badge — scaleX(-1) to un-mirror */}
              {artist.change_1m !== null && (
                <div style={{ position: 'absolute', top: '-2rem', right: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '0.375rem', padding: '0.1875rem 0.375rem', transform: 'scaleX(-1)', pointerEvents: 'none' }}>
                  <svg viewBox="0 0 10 8" width={9} height={8.1} style={{ flexShrink: 0, color: artist.change_1m >= 0 ? 'var(--st-chart-positive)' : 'var(--st-chart-negative)', transform: artist.change_1m >= 0 ? 'none' : 'rotate(180deg)' }}>
                    <path fill="currentColor" d="M5 0 L10 8 L0 8 Z" />
                  </svg>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: artist.change_1m >= 0 ? 'var(--st-chart-positive)' : 'var(--st-chart-negative)', fontFamily: 'var(--font-geist-mono, monospace)', letterSpacing: '0.02em' }}>
                    {Math.abs(artist.change_1m).toFixed(1)}%
                  </span>
                </div>
              )}
              {/* Isometric hover line from center of visual right border (DOM left) */}
              <div
                ref={el => { lineRefs.current[i] = el }}
                style={{ position: 'absolute', top: '50%', left: '-0.5rem', width: '0rem', height: '0.09375rem', background: 'rgba(240,235,215,0.8)', transform: 'translate(-100%, -50%) rotate(0deg)', transformOrigin: 'right center', pointerEvents: 'none' }}
              />
              {/* Artist name fixed at final line tip position */}
              <span
                ref={el => { nameRefs.current[i] = el }}
                data-name={artist.name}
                style={{ position: 'absolute', top: '50%', left: -(8 + 200 + 16), transform: 'translate(-100%, -50%) scaleX(-1)', whiteSpace: 'nowrap', color: 'rgba(240,235,215,0.9)', fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.06em', opacity: 0, pointerEvents: 'none' }}
              />
            </div>
          ) : null
        ))}
      </div>
      </div>
    </div>
  )
}


const HEADLINES = [
  'The market where artists become tradable',
  'Where music meets markets',
  'The future of music finance',
  'Own a piece of the charts',
  'Connecting artists, labels, and traders',
  'Retail trading, powered by music data',
  'The music industry, open to retail for the first time',
]

function CyclingHeadline() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const pageVisible = usePageVisible()

  useEffect(() => {
    if (!pageVisible) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % HEADLINES.length)
        setVisible(true)
      }, 600)
    }, 10000)
    return () => clearInterval(interval)
  }, [pageVisible])

  return (
    <div className="relative z-10 px-10 pb-10 pt-24">
      <h1
        className="mb-6 m-0 p-0 text-4xl lg:text-5xl xl:text-6xl font-light leading-tight text-balance"
        style={{
          color: 'var(--st-white)',
          fontFamily: 'var(--font-geist-sans)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 500ms ease-in-out',
        }}
      >
        {HEADLINES[index]}
      </h1>
    </div>
  )
}

function SignUpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => searchParams.get('mode') === 'login' ? 'login' : 'signup')
  const [step, setStep] = useState<Step>('form')
  const [loginMode, setLoginMode] = useState<LoginMode>('password')

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [resendCooldown, setResendCooldown] = useState(0)

  const pendingAuth = useRef<{ token: string; user: unknown } | null>(null)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const profileInputRef = useRef<HTMLInputElement | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }, [step])

  const handleSuccess = (token: string, user: unknown) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user', JSON.stringify(user))
    window.dispatchEvent(new Event('authChange'))
    router.push('/trade')
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password, firstName, lastName }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Something went wrong'); return }
        setResendCooldown(60)
        setStep('otp')
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Invalid email or password'); return }
        if (data.token) handleSuccess(data.token, data.user)
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginWithOtp = async () => {
    if (!email) { setError('Enter your email'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not send code'); return }
      setResendCooldown(60)
      setStep('otp')
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not resend code'); return }
      setResendCooldown(60)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = async (code: string) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return }
      if (mode === 'signup') {
        pendingAuth.current = { token: data.token, user: data.user }
        setStep('profile')
        setLoading(false)
      } else {
        handleSuccess(data.token, data.user)
      }
    } catch {
      setError('Failed to connect to server')
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
    if (next.every(d => d !== '')) submitOtp(next.join(''))
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    e.preventDefault()
    const next = [...otp]
    digits.forEach((d, i) => { next[i] = d })
    setOtp(next)
    otpRefs.current[Math.min(digits.length, 5)]?.focus()
    if (next.every(d => d !== '')) submitOtp(next.join(''))
  }

  const handleProfileContinue = async () => {
    const auth = pendingAuth.current
    if (!auth) return
    if (profileFile) {
      try {
        const form = new FormData()
        form.append('file', profileFile)
        await fetch('/api/user/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token}` },
          body: form,
        })
      } catch { /* non-fatal */ }
    }
    handleSuccess(auth.token, auth.user)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setStep('form')
    setLoginMode('password')
    setProfileFile(null)
    setProfilePreview(null)
    pendingAuth.current = null
    setError('')
    setOtp(['', '', '', '', '', ''])
  }

  return (
    <div className="fixed inset-0 z-[900] flex overflow-hidden bg-[rgb(10,10,10)]">

      {/* ── Left: branding panel ── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden border-r border-[#27272a]">

        {/* 3D planes viewport — fills the entire left panel, clipped by overflow-hidden */}
        <div className="absolute inset-0 z-[2]">
          <ArtistCardStack />
        </div>

        {/* Monogram faded at top */}
        <div className="pointer-events-none absolute left-0 right-0 z-[1] select-none" style={{ top: '-76%', height: '90%' }} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/monogram.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.75 }} draggable={false} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0) 70%, rgba(10,10,10,0.25) 85%, rgba(10,10,10,0.55) 95%, rgba(10,10,10,0.8) 100%)' }} />
        </div>

        {/* Gradient overlay so logo + text stay readable over the cards */}
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background: 'linear-gradient(to bottom, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0.65) 20%, rgba(10,10,10,0.2) 45%, transparent 55%, rgba(10,10,10,0.5) 75%, rgba(10,10,10,0.85) 100%)',
          }}
        />

        {/* Logo */}
        <Link href="/trade" className="relative z-10 flex items-center gap-0 p-10 no-underline">
          <Image src="/sonotrade_glyph_square_transparent.png" alt="Sonotrade" width={28.8} height={28.8} className="block h-8 w-auto" />
          <CSXText variant="wordmark" color="STWhite">Sonotrade</CSXText>
        </Link>

        {/* Copy — cycling headlines */}
        <CyclingHeadline />

        <div className="flex-1" />

        {/* Bottom link */}
        <div className="relative z-10 px-10 pb-8">
          <CSXText variant="body3" color="STMuted">
            Already on Sonotrade?{' '}
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-[#a1a1aa] underline underline-offset-2 hover:text-white transition-colors"
            >
              Log in
            </button>
          </CSXText>
        </div>
      </div>

      {/* ── Right: auth form ── */}
      <div className="relative flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-10 overflow-y-auto">

        {/* Mobile-only logo */}
        <Link href="/trade" className="mb-8 flex items-center gap-2 no-underline lg:hidden">
          <Image src="/sonotrade_glyph_square_transparent.png" alt="Sonotrade" width={21.6} height={21.6} className="h-6 w-auto" />
          <CSXText variant="wordmark" color="STWhite">Sonotrade</CSXText>
        </Link>

        <div className="relative w-full max-w-[27.5rem]">
          <div className="relative z-10">
          {step === 'form' ? (
            <>
              <div className="mb-10">
                <h2 className="m-0 p-0 text-3xl font-light leading-tight" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}>
                  {mode === 'login' ? (loginMode === 'otp' ? 'Login with OTP' : 'Welcome back') : 'Create account'}
                </h2>
              </div>

              <form
                onSubmit={loginMode === 'otp' ? async (e) => { e.preventDefault(); await handleLoginWithOtp() } : handleFormSubmit}
                className="flex flex-col gap-4"
              >
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  required
                  className="w-full h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none transition-colors"
                />

                {mode === 'signup' && (
                  <>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      placeholder="Username (optional)"
                      autoComplete="username"
                      className="w-full h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="First name"
                        autoComplete="given-name"
                        className="w-full h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none transition-colors"
                      />
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Last name"
                        autoComplete="family-name"
                        className="w-full h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none transition-colors"
                      />
                    </div>
                  </>
                )}

                {(mode === 'signup' || (mode === 'login' && loginMode === 'password')) && (
                  <div className="flex flex-col gap-1">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={8}
                      className="w-full h-11 rounded-full bg-st-surface-raised border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none transition-colors"
                    />
                    {mode === 'signup' && <p className="px-5 text-xs text-[#52525b]">Minimum 8 characters</p>}
                  </div>
                )}

                {error && (
                  <div className="rounded-full border border-st-border-strong bg-st-surface-raised px-5 py-3" role="alert">
                    <CSXText variant="body2" color="STChartNegative">{error}</CSXText>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <div className="w-full [&>button]:w-full [&>button]:h-11">
                    <CSXButton
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      label={loading ? 'Please wait…' : loginMode === 'otp' ? 'Send OTP' : mode === 'login' ? 'Log in' : 'Sign up'}
                    />
                  </div>

                  {mode === 'login' && loginMode === 'password' && (
                    <div className="w-full [&>button]:w-full [&>button]:h-11">
                      <CSXButton
                        type="button"
                        variant="outline"
                        disabled={loading}
                        label="Login with OTP"
                        onClick={() => { setLoginMode('otp'); setError('') }}
                      />
                    </div>
                  )}

                  {mode === 'login' && loginMode === 'otp' && (
                    <button
                      type="button"
                      onClick={() => { setLoginMode('password'); setError('') }}
                      className="text-sm text-st-muted hover:text-st-secondary transition-colors text-center"
                    >
                      ← Back to password login
                    </button>
                  )}

                  {loginMode === 'password' && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <CSXText variant="body3" color="STMuted">
                        {mode === 'login' ? 'No account yet?' : 'Already have an account?'}
                      </CSXText>
                      <div className="w-full [&>button]:w-full [&>button]:h-11">
                        <CSXButton
                          type="button"
                          variant="outline"
                          label={mode === 'login' ? 'Sign up' : 'Log in'}
                          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>

              <div className="mt-8 text-center">
                <Link href="/trade" className="text-sm text-st-muted hover:text-st-secondary transition-colors no-underline">
                  ← Back to Sonotrade
                </Link>
              </div>
            </>
          ) : step === 'otp' ? (
            /* OTP step */
            <>
              <div className="mb-2">
                <h2 className="m-0 p-0 text-xl font-semibold tracking-tight text-white">Enter code</h2>
              </div>
              <p className="mb-8 text-sm text-[#a1a1aa]">
                We sent a 6-digit code to{' '}
                <span className="text-white font-medium">{email}</span>
              </p>

              <div className="mb-6 flex gap-2 justify-between" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    disabled={loading}
                    className="w-full aspect-square text-center text-xl font-semibold text-white bg-[#131313] border border-[#27272a] rounded-xl focus:outline-none focus:border-white transition-colors disabled:opacity-50"
                    style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}
                  />
                ))}
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-[#3f3f46] bg-[#131313] px-4 py-3" role="alert">
                  <CSXText variant="body2" color="STChartNegative">{error}</CSXText>
                </div>
              )}

              {loading && (
                <p className="mb-4 text-center text-sm text-[#a1a1aa]">Verifying…</p>
              )}

              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('form'); setError(''); setOtp(['', '', '', '', '', '']) }}
                  className="text-sm text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                >
                  ← Back
                </button>
              </div>
            </>
          ) : step === 'profile' ? (
            /* Profile photo step */
            <>
              <div className="mb-3">
                <h2 className="m-0 p-0 text-3xl font-light leading-tight" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}>Add a profile photo</h2>
              </div>
              <p className="mb-10 text-sm text-[#71717a]">Optional — you can always change this later.</p>

              <div className="flex flex-col items-center gap-8">
                {/* Avatar picker */}
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="relative flex-shrink-0 w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-[#3f3f46] hover:border-[#71717a] transition-colors flex items-center justify-center bg-[#131313] group"
                >
                  {profilePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#52525b] group-hover:text-[#71717a] transition-colors">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span className="text-xs font-medium">Upload</span>
                    </div>
                  )}
                </button>

                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setProfileFile(file)
                    setProfilePreview(URL.createObjectURL(file))
                  }}
                />

                <div className="flex flex-col gap-3 w-full">
                  <div className="w-full [&>button]:w-full [&>button]:h-11">
                    <CSXButton
                      type="button"
                      variant="primary"
                      disabled={loading}
                      label={loading ? 'Please wait…' : profileFile ? 'Continue' : 'Skip for now'}
                      onClick={handleProfileContinue}
                    />
                  </div>
                  {profileFile && (
                    <button
                      type="button"
                      onClick={() => { setProfileFile(null); setProfilePreview(null) }}
                      className="text-sm text-[#71717a] hover:text-[#a1a1aa] transition-colors text-center"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
          </div>
        </div>

        {/* Social links — bottom right */}
        <div className="absolute bottom-8 right-8 flex items-center gap-4">
          <a href="https://instagram.com/sonotradehq" target="_blank" rel="noopener noreferrer" className="text-[#52525b] hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-.88a.88.88 0 1 1 0 1.76.88.88 0 0 1 0-1.76Z"/></svg>
          </a>
          <a href="https://discord.com/invite/sonotrade" target="_blank" rel="noopener noreferrer" className="text-[#52525b] hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 -28.5 256 256" fill="currentColor"><path d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"/></svg>
          </a>
          <a href="https://x.com/SonotradeHQ" target="_blank" rel="noopener noreferrer" className="text-[#52525b] hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 1200 1227" fill="currentColor"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 87.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1143.69H892.476L569.165 687.854V687.828Z"/></svg>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPageWrapper() {
  return (
    <Suspense>
      <SignUpPage />
    </Suspense>
  )
}
