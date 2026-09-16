'use client'

import { useState, useEffect } from 'react'
import { CSXText } from './core/CSXText'
import { CSXButton } from './core/CSXButton'
import { CSXAccordion } from './core/CSXAccordion'

interface SXOrderbookDetailsAccordionProps {
  profileName: string
  onClaimOpen?: () => void
}

export function ClaimModal({ profileName, onClose }: { profileName: string; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const [view, setView] = useState<'claim' | 'info' | 'form'>('claim')
  const [contentVisible, setContentVisible] = useState(true)
  const [legalName, setLegalName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [idFile, setIdFile] = useState<File | null>(null)
  const [idDragOver, setIdDragOver] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  function switchTo(next: 'claim' | 'info' | 'form') {
    setContentVisible(false)
    setTimeout(() => { setView(next); setContentVisible(true) }, 160)
  }

  const contentStyle = { opacity: contentVisible ? 1 : 0, transition: 'opacity 150ms ease' }

  async function handleSubmit() {
    if (!legalName.trim() || !email.trim() || !confirmed || !idFile || submitting) return
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))
    setSubmitting(false)
    setSubmitted(true)
  }

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.90)', opacity: visible ? 1 : 0, transition: 'opacity 200ms ease', pointerEvents: 'none' }}
      />

      <div
        className="w-full max-w-[26.25rem] relative"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 80ms ease, transform 80ms ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative w-full overflow-hidden rounded-xl border border-st-border bg-st-black px-8 pb-10 pt-14 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-20 leading-none text-st-secondary transition-colors hover:text-st-white"
            type="button"
          >
            <CSXText variant="title">×</CSXText>
          </button>

          {view === 'claim' && (
            <div style={contentStyle}>
              <div className="flex justify-center mb-8">
                <svg viewBox="0 0 200 200" width="180" height="180" style={{ overflow: 'visible' }}>
                  <defs>
                    <style>{`
                      @keyframes claimRing {
                        0%   { r: 56; opacity: 0.55; stroke-width: '0.09375rem'; }
                        100% { r: 96; opacity: 0;    stroke-width: '0.03125rem'; }
                      }
                      @keyframes claimGlow {
                        0%, 100% { opacity: 0.45; }
                        50%       { opacity: 0.9; }
                      }
                      @keyframes claimFloat {
                        0%, 100% { transform: translateY(0px); }
                        50%       { transform: translateY(-4px); }
                      }
                    `}</style>
                  </defs>
                  <g style={{ animation: 'claimFloat 3.2s ease-in-out infinite', transformOrigin: '100px 100px', transformBox: 'fill-box' }}>
                    <circle cx="100" cy="100" r="56" fill="none" stroke="var(--st-chart-positive)"
                      style={{ animation: 'claimRing 2.4s ease-out infinite' }} />
                    <circle cx="100" cy="100" r="56" fill="none" stroke="var(--st-chart-positive)"
                      style={{ animation: 'claimRing 2.4s ease-out 0.8s infinite' }} />
                    <circle cx="100" cy="100" r="56" fill="none" stroke="var(--st-chart-positive)"
                      style={{ animation: 'claimRing 2.4s ease-out 1.6s infinite' }} />
                    <circle cx="100" cy="100" r="54" fill="rgba(4,223,157,0.07)" stroke="rgba(4,223,157,0.28)" strokeWidth="1.2"
                      style={{ animation: 'claimGlow 3s ease-in-out infinite' }} />
                    <text x="100" y="95" textAnchor="middle" fill="var(--st-chart-positive)" fontSize="24" fontWeight="700" fontFamily="monospace"
                      style={{ animation: 'claimGlow 3s ease-in-out infinite' }}>
                      0.5%
                    </text>
                    <text x="100" y="115" textAnchor="middle" fill="rgba(4,223,157,0.45)" fontSize="10" fontFamily="monospace" letterSpacing="2.5">
                      ROYALTY
                    </text>
                  </g>
                </svg>
              </div>

              <div className="mb-3">
                <CSXText variant="subtitle" color="STWhite">Claim Your Index Royalty</CSXText>
              </div>
              <div className="mb-2">
                <CSXText variant="body2" color="STSecondary">
                  0.5% of every forecast on your Index is set aside for you as a good-faith royalty. Claim your profile to direct where it goes receive it, donate it, or leave it unclaimed.
                </CSXText>
              </div>
              <div className="mb-8">
                <CSXText variant="body3" color="STMuted">
                  Claiming does not mean you own, control, or endorse your Index listing. It simply lets you direct your royalty.
                </CSXText>
              </div>

              <div className="flex items-center gap-4">
                <CSXButton variant="primary" label="Start Claim" onClick={() => switchTo('form')} />
                <CSXButton variant="outline" label="How does this work?" onClick={() => switchTo('info')} />
              </div>
            </div>
          )}

          {view === 'info' && (
            <div style={contentStyle}>
              <div className="mb-5">
                <CSXText variant="subtitle" color="STWhite">About the Good-Faith Royalty</CSXText>
              </div>
              <div className="flex flex-col gap-4 mb-8">
                <CSXText variant="body2" color="STSecondary">
                  Sonotrade sets aside 0.5% of every forecast transaction on your Index as a good-faith royalty, regardless of whether you claim your profile.
                </CSXText>
                <CSXText variant="body2" color="STSecondary">
                  Claiming your profile does not mean you own, control, or endorse your Index listing. Sonotrade lists Net Public Sentiment Indexes on public figures because public sentiment exists in the public domain it is not owned by the person indexed, unlike Name, Image, or Likeness.
                </CSXText>
                <CSXText variant="body2" color="STSecondary">
                  All imagery on Sonotrade is AI-generated. Claiming does not grant Sonotrade any rights to your Name, Image, or Likeness, and does not create any affiliation between you and Sonotrade.
                </CSXText>
              </div>
              <CSXButton variant="primary" label="Got it" onClick={onClose} />
            </div>
          )}

          {view === 'form' && (
            <div style={contentStyle}>
              {submitted ? (
                <>
                  <div className="mb-3">
                    <CSXText variant="subtitle" color="STWhite">Claim Submitted</CSXText>
                  </div>
                  <div className="mb-8">
                    <CSXText variant="body2" color="STSecondary">
                      We&apos;ll be in touch at the email you provided to verify your identity before any royalty is released.
                    </CSXText>
                  </div>
                  <CSXButton variant="primary" label="Done" onClick={onClose} />
                </>
              ) : (
                <>
                  <div className="mb-1">
                    <CSXText variant="subtitle" color="STWhite">Claim Your Profile</CSXText>
                  </div>
                  <div className="mb-6">
                    <CSXText variant="body3" color="STMuted">You are claiming: {profileName}&apos;s Index</CSXText>
                  </div>

                  <div className="flex flex-col gap-4 mb-5">
                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-muted)' }}>
                        Full Legal Name
                      </label>
                      <input
                        type="text"
                        value={legalName}
                        onChange={e => setLegalName(e.target.value)}
                        placeholder="As it appears on your ID"
                        style={{
                          background: 'transparent',
                          border: '1px solid #27272a',
                          borderRadius: '0.5rem',
                          padding: '0.5625rem 0.75rem',
                          fontFamily: 'var(--font-geist-sans)',
                          fontSize: '0.875rem',
                          color: '#fff',
                          outline: 'none',
                          width: '100%',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#3f3f46' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#27272a' }}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-muted)' }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={{
                          background: 'transparent',
                          border: '1px solid #27272a',
                          borderRadius: '0.5rem',
                          padding: '0.5625rem 0.75rem',
                          fontFamily: 'var(--font-geist-sans)',
                          fontSize: '0.875rem',
                          color: '#fff',
                          outline: 'none',
                          width: '100%',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#3f3f46' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#27272a' }}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-muted)' }}>
                        Government-Issued ID
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          border: `1px dashed ${idDragOver ? '#3f3f46' : '#27272a'}`,
                          borderRadius: '0.5rem',
                          padding: '1rem 0.75rem',
                          cursor: 'pointer',
                          background: idDragOver ? 'rgba(255,255,255,0.04)' : 'transparent',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onDragOver={e => { e.preventDefault(); setIdDragOver(true) }}
                        onDragLeave={() => setIdDragOver(false)}
                        onDrop={e => {
                          e.preventDefault()
                          setIdDragOver(false)
                          const file = e.dataTransfer.files?.[0]
                          if (file) setIdFile(file)
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="sr-only"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) setIdFile(file)
                          }}
                        />
                        {idFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.8125rem', color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {idFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={e => { e.preventDefault(); setIdFile(null) }}
                              style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, textDecoration: 'underline' }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.8125rem', color: 'var(--st-secondary)', textAlign: 'center' }}>
                              Drag & drop or <span style={{ color: '#fff' }}>browse</span>
                            </span>
                            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.6875rem', color: 'var(--st-muted)', textAlign: 'center' }}>
                              JPG, PNG, HEIC, or PDF — passport, driver&apos;s license, or national ID
                            </span>
                          </>
                        )}
                      </label>
                    </div>

                    <label
                      className="flex items-start gap-3 cursor-pointer"
                      style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-secondary)', lineHeight: 1.5 }}
                    >
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={e => setConfirmed(e.target.checked)}
                        style={{ marginTop: '0.125rem', accentColor: 'white', flexShrink: 0 }}
                      />
                      I confirm I am the person named above, or their authorized legal representative, and the information provided is accurate.
                    </label>
                  </div>

                  <div className="mb-6 leading-relaxed">
                    <CSXText variant="body3" color="STMuted">
                      Submitting this claim begins a verification process. Sonotrade will contact you at the email provided to verify your identity before any royalty is released. Submission does not constitute endorsement of, or affiliation with, Sonotrade.
                    </CSXText>
                  </div>

                  <div className="flex items-center gap-4">
                    <CSXButton variant="primary" label={submitting ? 'Submitting…' : 'Submit Claim'} disabled={!legalName.trim() || !email.trim() || !confirmed || !idFile || submitting} onClick={handleSubmit} />
                    <CSXButton variant="outline" label="Back" onClick={() => switchTo('claim')} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SXOrderbookDetailsAccordion({ profileName }: SXOrderbookDetailsAccordionProps) {
  return (
    <CSXAccordion
      title={<CSXText variant="subtitle" color="STWhite">Important Info</CSXText>}
      defaultOpen={true}
      className="py-6"
    >
      <div className="leading-relaxed">
        <CSXText variant="body2" color="STSecondary">
          The {profileName} Perpetual-Style Futures Contract is a cash-settled, 5-year perpetual-style contract
          that trades continuously and allows participants to gain or reduce exposure to changes in the
          underlying performance of the artist {profileName}. The underlying index aggregates anonymized
          signals from sources such as Spotify performance, search activity, and social media engagement,
          providing a financial value based on real-world performance metrics. Each contract represents a fixed
          unit of the {profileName} Index. The contract incorporates a periodic funding mechanism designed to
          keep prices closely aligned with the index level over time. Positions are settled in cash rather than
          any underlying media or intellectual property.
        </CSXText>
      </div>
    </CSXAccordion>
  )
}

export default SXOrderbookDetailsAccordion
