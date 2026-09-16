"use client";

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, type AppUser } from "@/lib/use-user";
import { logout } from "@/lib/logout";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  const signOut = useCallback(async () => {
    await logout();
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
