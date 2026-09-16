'use client'

import { useRef, useState } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'
import { USERNAME_RE, USERNAME_RULES } from '@/lib/username'
import { refreshUser } from '@/lib/use-user'

/**
 * Inline username display + editor for the account's own surfaces (profile
 * header, portfolio header). Renders the current handle with a pencil
 * affordance; editing swaps to an input + save/cancel in place, so it can sit
 * inside SXSectionHeading's `title` slot without changing the layout.
 */
export function UsernameEditor({
  username,
  onChanged,
}: {
  username: string
  onChanged: (username: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = () => {
    setValue(username)
    setError(null)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    const next = value.toLowerCase().trim()
    if (next === username) { cancel(); return }
    if (!USERNAME_RE.test(next)) { setError(USERNAME_RULES); return }
    setSaving(true)
    setError(null)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/user/username', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ username: next }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not change username'); return }
      // Keep the cached `user` (header balances row, mobile header) in sync.
      try {
        const stored = JSON.parse(localStorage.getItem('user') || 'null')
        if (stored) localStorage.setItem('user', JSON.stringify({ ...stored, username: data.username }))
      } catch { /* cache only */ }
      refreshUser()
      onChanged(data.username)
      setEditing(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-2">
        <span className="truncate">{username}</span>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Change username"
          className="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-st-secondary transition-colors hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
      </span>
    )
  }

  return (
    <span className="inline-flex min-w-0 max-w-full flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={20}
          onChange={e => setValue(e.target.value.toLowerCase())}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); save() }
            if (e.key === 'Escape') cancel()
          }}
          autoComplete="username"
          spellCheck={false}
          className="h-9 w-48 max-w-full rounded-full border border-transparent bg-st-surface-raised px-4 text-sm font-normal tracking-[-0.025em] text-white focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="cursor-pointer border-0 bg-transparent p-0 disabled:opacity-50"
        >
          <CSXText variant="body2Medium" color="STWhite">{saving ? 'Saving…' : 'Save'}</CSXText>
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="cursor-pointer border-0 bg-transparent p-0 disabled:opacity-50"
        >
          <CSXText variant="body2" color="STSecondary">Cancel</CSXText>
        </button>
      </span>
      {error && (
        <CSXText variant="body3" color="STChartNegative">{error}</CSXText>
      )}
    </span>
  )
}
