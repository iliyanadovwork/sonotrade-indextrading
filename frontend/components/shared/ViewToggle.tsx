'use client'

interface ViewToggleProps {
  value: 'table' | 'grid'
  onChange: (v: 'table' | 'grid') => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-full overflow-hidden" style={{ background: '#131313', color: 'var(--st-secondary)' }}>
      <button
        onClick={() => onChange('table')}
        className={`flex items-center justify-center px-3 py-[0.609375rem] transition-colors ${value === 'table' ? 'bg-white text-black' : 'hover:text-white'}`}
        title="Table view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center justify-center px-3 py-[0.609375rem] transition-colors ${value === 'grid' ? 'bg-white text-black' : 'hover:text-white'}`}
        title="Grid view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>
    </div>
  )
}
