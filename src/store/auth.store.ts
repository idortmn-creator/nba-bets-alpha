import { create } from 'zustand'
import type { User } from 'firebase/auth'

export interface UserDoc {
  uid: string
  displayName: string
  username: string
  email: string
  leagues?: string[]
  createdAt?: unknown
}

interface AuthState {
  currentUser: User | null
  currentUserDoc: UserDoc | null
  setUser: (user: User | null) => void
  setUserDoc: (doc: UserDoc | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  currentUserDoc: null,
  setUser: (user) => set({ currentUser: user }),
  setUserDoc: (doc) => set({ currentUserDoc: doc }),
}))
