import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import Header from '@/components/layout/Header'
import AuthPage from '@/components/auth/AuthPage'
import HomePage from '@/components/home/HomePage'
import CreateLeaguePage from '@/components/leagues/CreateLeaguePage'
import JoinLeaguePage from '@/components/leagues/JoinLeaguePage'
import MyLeaguesPage from '@/components/leagues/MyLeaguesPage'
import LeaguePage from '@/components/league/LeaguePage'
import ProfilePage from '@/components/profile/ProfilePage'
import GlobalAdminPage from '@/components/admin/GlobalAdminPage'

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
          <Route path="/" element={<HomePage />} />
          <Route path="/create-league" element={<CreateLeaguePage />} />
          <Route path="/join-league" element={<JoinLeaguePage />} />
          <Route path="/join/:code" element={<JoinLeaguePage />} />
          <Route path="/leagues" element={<MyLeaguesPage />} />
          <Route path="/league/:lid" element={<LeaguePage />} />
          <Route path="/league/:lid/:tab" element={<LeaguePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<GlobalAdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
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
