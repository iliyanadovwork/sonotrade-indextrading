'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

const MobileContext = createContext<boolean>(false)

interface MobileProviderProps {
  children: React.ReactNode
  initialMobile?: boolean
}

export function MobileProvider({ children, initialMobile = false }: MobileProviderProps) {
  // Seed from server-detected UA so first render is correct — no hydration flash
  const [isMobile, setIsMobile] = useState<boolean>(initialMobile)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return <MobileContext.Provider value={isMobile}>{children}</MobileContext.Provider>
}

export function useIsMobile(): boolean {
  return useContext(MobileContext)
}
