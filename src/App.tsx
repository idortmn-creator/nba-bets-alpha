import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth.store'
import { SUPER_ADMIN_UID } from '@/lib/constants'
import Header from '@/components/layout/Header'
import AuthPage from '@/components/auth/AuthPage'
import LandingPage from '@/components/home/LandingPage'
import HomePage from '@/components/home/HomePage'
import CreateLeaguePage from '@/components/leagues/CreateLeaguePage'
import JoinLeaguePage from '@/components/leagues/JoinLeaguePage'
import MyLeaguesPage from '@/components/leagues/MyLeaguesPage'
import LeaguePage from '@/components/league/LeaguePage'
import ProfilePage from '@/components/profile/ProfilePage'
import GlobalAdminPage from '@/components/admin/GlobalAdminPage'
import InstallPrompt from '@/components/InstallPrompt'
import BracketHomePage from '@/bracket/BracketHomePage'
import BracketCreatePage from '@/bracket/BracketCreatePage'
import BracketJoinPage from '@/bracket/BracketJoinPage'
import BracketMyLeaguesPage from '@/bracket/BracketMyLeaguesPage'
import BracketLeaguePage from '@/bracket/BracketLeaguePage'

function BracketGuard({ children }: { children: React.ReactNode }) {
  const uid = useAuthStore((s) => s.currentUser?.uid)
  if (uid !== SUPER_ADMIN_UID) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppContent() {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[1100px] px-4">
        <AuthPage />
      </div>
    )
  }

  return (
    <>
      <Header />
      <div className="mx-auto max-w-[1100px] px-4">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/create-league" element={<CreateLeaguePage />} />
          <Route path="/join-league" element={<JoinLeaguePage />} />
          <Route path="/join/:code" element={<JoinLeaguePage />} />
          <Route path="/leagues" element={<MyLeaguesPage />} />
          <Route path="/league/:lid" element={<LeaguePage />} />
          <Route path="/league/:lid/:tab" element={<LeaguePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<GlobalAdminPage />} />
          {/* ── Bracket format routes (super-admin only) ── */}
          <Route path="/bracket" element={<BracketGuard><BracketHomePage /></BracketGuard>} />
          <Route path="/bracket/create" element={<BracketGuard><BracketCreatePage /></BracketGuard>} />
          <Route path="/bracket/join" element={<BracketGuard><BracketJoinPage /></BracketGuard>} />
          <Route path="/bracket/join/:code" element={<BracketGuard><BracketJoinPage /></BracketGuard>} />
          <Route path="/bracket/leagues" element={<BracketGuard><BracketMyLeaguesPage /></BracketGuard>} />
          <Route path="/bracket/league/:lid" element={<BracketGuard><BracketLeaguePage /></BracketGuard>} />
          <Route path="/bracket/league/:lid/:tab" element={<BracketGuard><BracketLeaguePage /></BracketGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <InstallPrompt />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1e1e30',
            color: '#e8e8f0',
            border: '1px solid #FF6B00',
            fontFamily: 'Heebo, sans-serif',
            fontWeight: 700,
            fontSize: '0.88rem',
          },
        }}
      />
      <AppContent />
    </HashRouter>
  )
}
