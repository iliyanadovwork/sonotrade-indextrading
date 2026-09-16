'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ProfilePanelContextType {
  openProfile: (spotifyId: string) => void
  closeProfile: () => void
  activeId: string | null
}

const ProfilePanelContext = createContext<ProfilePanelContextType>({
  openProfile: () => {},
  closeProfile: () => {},
  activeId: null,
})

export function ProfilePanelProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const openProfile = useCallback((id: string) => setActiveId(id), [])
  const closeProfile = useCallback(() => setActiveId(null), [])
  return (
    <ProfilePanelContext.Provider value={{ openProfile, closeProfile, activeId }}>
      {children}
    </ProfilePanelContext.Provider>
  )
}

export function useProfilePanel() {
  return useContext(ProfilePanelContext)
}
