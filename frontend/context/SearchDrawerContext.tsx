'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SearchDrawerContextValue {
  isOpen: boolean
  initialCategory: string
  openSearch: (category?: string) => void
  closeSearch: () => void
}

const SearchDrawerContext = createContext<SearchDrawerContextValue | null>(null)

export function SearchDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialCategory, setInitialCategory] = useState('all')

  const openSearch = useCallback((category = 'all') => {
    setInitialCategory(category)
    setIsOpen(true)
  }, [])

  const closeSearch = useCallback(() => setIsOpen(false), [])

  return (
    <SearchDrawerContext.Provider value={{ isOpen, initialCategory, openSearch, closeSearch }}>
      {children}
    </SearchDrawerContext.Provider>
  )
}

export function useSearchDrawer() {
  const ctx = useContext(SearchDrawerContext)
  if (!ctx) throw new Error('useSearchDrawer must be used within SearchDrawerProvider')
  return ctx
}
