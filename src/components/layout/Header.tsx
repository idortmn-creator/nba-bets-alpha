import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useLeagueStore } from '@/store/league.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { signOut } from '@/services/auth.service'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const currentUser = useAuthStore((s) => s.currentUser)
  const leagueId = useLeagueStore((s) => s.currentLeagueId)
  const { isSuperAdmin } = useGlobalHelpers()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setMenuOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  if (!currentUser) return null

  const go = (path: string) => { setMenuOpen(false); navigate(path) }

  return (
    <header className="sticky top-0 z-[300] border-b-2 border-[var(--orange)] bg-gradient-to-br from-[var(--dark2)] to-[var(--dark3)] px-4 py-3 shadow-[0_4px_30px_rgba(255,107,0,0.2)]">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between">
        <div className="cursor-pointer font-oswald text-xl tracking-wider text-[var(--orange)]" onClick={() => go('/')}>
          🏀 <span className="text-[var(--text)]">פלייאוף</span> NBA
        </div>
        <div className="relative">
          <div
            ref={btnRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[var(--orange-border)] bg-[var(--card-bg)] text-xl transition-all hover:border-[var(--orange)] hover:bg-[var(--orange-dim)]"
          >👤</div>
          {menuOpen && (
            <div ref={menuRef} className="absolute left-0 top-[52px] z-[400] min-w-[200px] overflow-hidden rounded-xl border border-[var(--orange-border)] bg-[var(--card-bg)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-[fadeIn_0.15s_ease]">
              <div className="border-b border-[var(--orange-border)] px-4 py-3 text-xs text-[var(--text2)]">
                👤 {userDoc?.username || ''}
              </div>
              <MenuItem icon="🏆" label="הליגות שלי" onClick={() => go('/leagues')} />
              {leagueId && (
                <>
                  <MenuItem icon="📊" label="טבלת נקודות" onClick={() => go(`/league/${leagueId}`)} />
                  <MenuItem icon="✍️" label="הזן הימורים" onClick={() => go(`/league/${leagueId}/enter-bets`)} />
                  <MenuItem icon="📋" label="הימורים" onClick={() => go(`/league/${leagueId}/bets`)} />
                </>
              )}
              <div className="mx-0 my-1 h-px bg-[var(--orange-border)]" />
              <MenuItem icon="👤" label="פרופיל" onClick={() => go('/profile')} />
              {isSuperAdmin() && (
                <MenuItem icon="⚙️" label="ניהול גלובלי" onClick={() => go('/admin')} />
              )}
              <div className="mx-0 my-1 h-px bg-[var(--orange-border)]" />
              <div
                className="flex cursor-pointer items-center gap-2 border-t border-[rgba(255,255,255,0.04)] px-4 py-3 text-sm font-semibold text-[var(--red)] transition-colors hover:bg-[rgba(255,68,68,0.1)]"
                onClick={async () => { setMenuOpen(false); await signOut(); navigate('/') }}
              >
                <span className="w-5 text-center text-base">🚪</span> התנתק
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div
      className="flex cursor-pointer items-center gap-2 border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-sm font-semibold transition-colors hover:bg-[rgba(255,107,0,0.1)]"
      onClick={onClick}
    >
      <span className="w-5 text-center text-base">{icon}</span> {label}
    </div>
  )
}
