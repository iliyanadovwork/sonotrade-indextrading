'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface PortfolioPanelContextValue {
  isOpen: boolean
  openPortfolio: () => void
  closePortfolio: () => void
}

const PortfolioPanelContext = createContext<PortfolioPanelContextValue>({
  isOpen: false,
  openPortfolio: () => {},
  closePortfolio: () => {},
})

export function PortfolioPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const openPortfolio = useCallback(() => setIsOpen(true), [])
  const closePortfolio = useCallback(() => setIsOpen(false), [])
  return (
    <PortfolioPanelContext.Provider value={{ isOpen, openPortfolio, closePortfolio }}>
      {children}
    </PortfolioPanelContext.Provider>
  )
}

export function usePortfolioPanel() {
  return useContext(PortfolioPanelContext)
}
