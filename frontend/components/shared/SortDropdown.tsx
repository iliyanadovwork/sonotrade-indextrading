'use client'

import { useEffect, useRef, useState } from 'react'

export interface SortOption<T extends string> {
  label: string
  col: T
}

interface SortDropdownProps<T extends string> {
  options: SortOption<T>[]
  column: T
  direction: 'asc' | 'desc'
  defaultColumn?: T
  onColumnChange: (col: T) => void
  onDirectionChange: (dir: 'asc' | 'desc') => void
  /** Override the trigger button padding/size (e.g. to match an adjacent toggle). */
  triggerStyle?: React.CSSProperties
}

function CheckIcon() {
  return (
    <svg className="ml-auto" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function SortDropdown<T extends string>({
  options,
  column,
  direction,
  defaultColumn,
  onColumnChange,
  onDirectionChange,
  triggerStyle,
}: SortDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // estimate dropdown height: ~280px covers all options
      const estimatedHeight = 280
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < estimatedHeight)
    }
    setOpen(o => !o)
  }

  const activeLabel = options.find(o => o.col === column)?.label
  const showLabel = defaultColumn ? column !== defaultColumn : false

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={handleToggle}
        className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 rounded-full px-4 py-[0.4375rem] hover:text-white transition-colors active:scale-[0.93]"
        style={{ background: '#131313', color: 'var(--st-secondary)', ...triggerStyle }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M7 12h10M11 18h2" />
        </svg>
        Sort{showLabel && <span style={{ color: '#a1a1aa' }}>: {activeLabel}</span>}
      </button>
      {open && (
        <div className={`absolute right-0 z-50 min-w-[10rem] rounded-lg border border-zinc-800 bg-black py-1 shadow-xl ${openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}>
          <p className="px-4 pt-1 pb-1 text-[0.625rem] font-medium uppercase tracking-widest text-zinc-600" style={{ fontFamily: 'var(--font-geist-sans)' }}>Sort by</p>
          {options.map(opt => (
            <button
              key={opt.col}
              onClick={() => { onColumnChange(opt.col); onDirectionChange('desc') }}
              className={`font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] flex w-full items-center px-4 py-2 transition-colors ${
                column === opt.col ? 'text-white bg-white/[0.06]' : 'hover:text-white hover:bg-white/[0.04]'
              }`}
              style={{ color: column === opt.col ? undefined : 'var(--st-secondary)' }}
            >
              {opt.label}
              {column === opt.col && <CheckIcon />}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-800" />
          <p className="px-4 pt-1 pb-1 text-[0.625rem] font-medium uppercase tracking-widest text-zinc-600" style={{ fontFamily: 'var(--font-geist-sans)' }}>Order</p>
          {(['desc', 'asc'] as const).map(dir => (
            <button
              key={dir}
              onClick={() => { onDirectionChange(dir); setOpen(false) }}
              className={`font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] flex w-full items-center px-4 py-2 transition-colors ${
                direction === dir ? 'text-white bg-white/[0.06]' : 'hover:text-white hover:bg-white/[0.04]'
              }`}
              style={{ color: direction === dir ? undefined : 'var(--st-secondary)' }}
            >
              {dir === 'desc' ? 'Descending' : 'Ascending'}
              {direction === dir && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
