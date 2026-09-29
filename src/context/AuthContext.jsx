import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Auth state is in-memory only; closing the app requires logging in again.
  const [user, setUser] = useState(null)

  const value = {
    user,
    isAuthed: !!user,
    login: (u) => setUser(u),
    logout: () => setUser(null)
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
