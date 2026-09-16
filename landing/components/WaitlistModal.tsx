'use client'

import React, { useState, useRef, useEffect } from 'react'

type Step = 'email' | 'otp' | 'success'

export function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }, [step])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      setResendCooldown(60)
      setStep('otp')
    } catch {
      setError('Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist/join', {
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
      setError('Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = async (code: string) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); setLoading(false); return }
      setStep('success')
    } catch {
      setError('Failed to connect. Please try again.')
    } finally {
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

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-[440px] rounded-xl p-8"
        style={{ backgroundColor: 'rgb(10,10,10)', border: '1px solid #27272a' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-[#52525b] hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {step === 'email' && (
          <>
            <div className="mb-8">
              <h2 className="m-0 p-0 text-2xl font-light leading-tight" style={{ color: '#ffffff', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                Join the waitlist
              </h2>
              <p className="mt-2 text-sm" style={{ color: '#a1a1aa', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                Be first to know when Sonotrade launches.
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email"
                autoComplete="email"
                required
                className="w-full h-11 rounded-full border border-transparent px-5 text-sm text-white placeholder:text-[#52525b] focus:outline-none focus:border-[#3f3f46] transition-colors"
                style={{ backgroundColor: '#18181b', fontFamily: 'var(--font-geist-sans, sans-serif)' }}
              />

              {error && (
                <p className="rounded-full border border-[#3f3f46] bg-[#18181b] px-5 py-3 text-sm" style={{ color: '#FF4B4B', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full text-sm font-medium tracking-wide transition-all duration-75 hover:opacity-80 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: '#ffffff', color: 'rgb(10,10,10)', fontFamily: 'var(--font-geist-sans, sans-serif)' }}
              >
                {loading ? 'Sending…' : 'Get early access'}
              </button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="mb-2">
              <h2 className="m-0 p-0 text-xl font-semibold tracking-tight" style={{ color: '#ffffff', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                Enter code
              </h2>
            </div>
            <p className="mb-8 text-sm" style={{ color: '#a1a1aa', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
              We sent a 6-digit code to{' '}
              <span style={{ color: '#ffffff', fontWeight: 500 }}>{email}</span>
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
                  className="w-full aspect-square text-center text-xl font-semibold text-white bg-[#18181b] border border-[#27272a] rounded-xl focus:outline-none focus:border-white transition-colors disabled:opacity-50"
                  style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}
                />
              ))}
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-[#3f3f46] bg-[#18181b] px-4 py-3">
                <p className="text-sm m-0" style={{ color: '#FF4B4B', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>{error}</p>
              </div>
            )}

            {loading && (
              <p className="mb-4 text-center text-sm" style={{ color: '#a1a1aa', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>Verifying…</p>
            )}

            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: '#a1a1aa', fontFamily: 'var(--font-geist-sans, sans-serif)' }}
                onMouseEnter={e => { if (!loading && resendCooldown === 0) (e.target as HTMLElement).style.color = '#ffffff' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = '#a1a1aa' }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtp(['', '', '', '', '', '']) }}
                className="text-sm transition-colors"
                style={{ color: '#71717a', fontFamily: 'var(--font-geist-sans, sans-serif)' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = '#a1a1aa' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = '#71717a' }}
              >
                ← Back
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center text-center gap-5 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(4,223,157,0.1)', border: '1px solid rgba(4,223,157,0.3)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#04df9d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h2 className="m-0 p-0 text-2xl font-light" style={{ color: '#ffffff', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>You&apos;re on the list</h2>
              <p className="mt-2 text-sm" style={{ color: '#a1a1aa', fontFamily: 'var(--font-geist-sans, sans-serif)' }}>
                We&apos;ll reach out to <span style={{ color: '#ffffff' }}>{email}</span> when it&apos;s your turn.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 h-11 rounded-full px-8 text-sm font-medium transition-all hover:opacity-80 active:scale-95"
              style={{ backgroundColor: '#ffffff', color: 'rgb(10,10,10)', fontFamily: 'var(--font-geist-sans, sans-serif)' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
