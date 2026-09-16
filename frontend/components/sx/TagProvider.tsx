'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type TagContextValue = {
  selectedSubcategory: string | null
  setSelectedSubcategory: (v: string | null) => void
}

const TagContext = createContext<TagContextValue>({
  selectedSubcategory: null,
  setSelectedSubcategory: () => {},
})

export function TagProvider({ children }: { children: ReactNode }) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  return (
    <TagContext.Provider value={{ selectedSubcategory, setSelectedSubcategory }}>
      {children}
    </TagContext.Provider>
  )
}

export function useTagContext() {
  return useContext(TagContext)
}
