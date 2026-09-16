'use client'

import React, { useState } from 'react'
import { CSXText } from './CSXText'

interface CSXAccordionProps {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CSXAccordion({ title, children, defaultOpen = false, className = '' }: CSXAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border-b border-zinc-800 py-4 ${className}`}>
      <button
        type="button"
        className="group flex w-full select-none items-center gap-2 text-left transition-colors duration-150"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <span className="min-w-0 flex-1">
          {typeof title === 'string' ? (
            <CSXText variant="body1" color="STWhite">{title}</CSXText>
          ) : title}
        </span>
        <svg
          className={`h-3 w-3 shrink-0 text-st-muted transition-transform duration-200 group-hover:text-st-secondary ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-[min(40rem,80vh)] pt-3 opacity-100' : 'max-h-0 opacity-0'}`}
        aria-hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
