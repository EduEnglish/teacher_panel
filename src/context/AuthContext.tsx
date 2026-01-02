import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { login as firebaseLogin, logout as firebaseLogout, onAuthStateChangedListener, requestPasswordReset } from '@/services/firebase'

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const allowedAdminEmail = import.meta.env.VITE_ALLOWED_ADMIN_EMAIL?.toLowerCase().trim() ?? ''

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((firebaseUser) => {
      if (firebaseUser && allowedAdminEmail && firebaseUser.email?.toLowerCase() !== allowedAdminEmail) {
        void firebaseLogout()
        setUser(null)
        setIsLoading(false)
        return
      }
      setUser(firebaseUser)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [allowedAdminEmail])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        setIsLoading(true)
        try {
          // Trim email and password to remove any leading/trailing whitespace
          const trimmedEmail = email.trim()
          const trimmedPassword = password.trim()
          
          const authenticatedUser = await firebaseLogin(trimmedEmail, trimmedPassword)
          if (allowedAdminEmail && authenticatedUser.email?.toLowerCase() !== allowedAdminEmail) {
            await firebaseLogout()
            setUser(null)
            throw new Error('You are not authorised to access the Teacher Panel.')
          }
        } finally {
          setIsLoading(false)
        }
      },
      async logout() {
        await firebaseLogout()
        setUser(null)
      },
      async resetPassword(email) {
        // Trim email to remove any leading/trailing whitespace
        const trimmedEmail = email.trim()
        await requestPasswordReset(trimmedEmail)
      },
    }),
    [user, isLoading, allowedAdminEmail],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


