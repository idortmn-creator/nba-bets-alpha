import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useLeagueStore } from '@/store/league.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { signOut } from '@/services/auth.service'

type InstallStep = 'none' | 'android-warning' | 'android-manual' | 'ios-steps'

function getInstallPlatform(): 'android' | 'ios' | null {
  if (typeof window === 'undefined') return null
  const ua = navigator.userAgent
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  if (isStandalone) return null
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return null
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [installStep, setInstallStep] = useState<InstallStep>('none')
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const currentUser = useAuthStore((s) => s.currentUser)
  const leagueId = useLeagueStore((s) => s.currentLeagueId)
  const { isSuperAdmin } = useGlobalHelpers()

  const installPlatform = getInstallPlatform()

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

  function handleInstallClick() {
    setMenuOpen(false)
    if (installPlatform === 'ios') {
      setInstallStep('ios-steps')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (window as any).__pwaInstallEvent
    if (event) {
      setInstallStep('android-warning')
    } else {
      setInstallStep('android-manual')
    }
  }

  async function triggerAndroidInstall() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = (window as any).__pwaInstallEvent
    if (!event) { setInstallStep('android-manual'); return }
    event.prompt()
    await event.userChoice
    setInstallStep('none')
  }

  return (
    <>
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
                {installPlatform && (
                  <MenuItem icon="📲" label="התקן אפליקציה" onClick={handleInstallClick} />
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

      {/* ── Android: pre-install warning explanation ── */}
      {installStep === 'android-warning' && (
        <div className="install-modal-overlay" onClick={() => setInstallStep('none')}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">⚠️ הודעת אבטחה מ-Google</div>
            <p className="install-modal-body">
              לאחר לחיצה על "התקן", Android עשוי להציג אזהרה מ-<strong>Google Play Protect</strong> שאומרת שהאפליקציה "לא בטוחה" או "מיועדת לגרסה ישנה".
            </p>
            <p className="install-modal-body">
              זו <strong>אזהרה אוטומטית סטנדרטית</strong> שמופיעה לכל אפליקציית ווב (PWA) שמותקנת מחוץ ל-Play Store — ולא קשורה לתוכן האפליקציה שלנו.
            </p>
            <p className="install-modal-body">
              האפליקציה מאובטחת לחלוטין: היא מתארחת על שרתי Google (Firebase) ואין לה גישה למכשיר שלך.
            </p>
            <p className="install-modal-hint">
              כדי להמשיך: לחץ <strong>"אני רוצה להתקין"</strong> בתחתית האזהרה של Google.
            </p>
            <div className="install-modal-actions">
              <button className="install-btn install-btn-primary install-btn-full" onClick={triggerAndroidInstall}>
                הבנתי — התקן
              </button>
              <button className="install-btn install-btn-secondary install-btn-full" onClick={() => setInstallStep('none')}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Android: manual install instructions (no deferred prompt) ── */}
      {installStep === 'android-manual' && (
        <div className="install-modal-overlay" onClick={() => setInstallStep('none')}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">📲 התקנה ידנית</div>
            <p className="install-modal-body">
              כדי להוסיף את האפליקציה למסך הבית:
            </p>
            <ol className="install-steps">
              <li>לחץ על תפריט Chrome <strong>⋮</strong> (שלוש נקודות) בפינה הימנית עליונה</li>
              <li>בחר <strong>"התקן אפליקציה"</strong> או <strong>"הוסף למסך הבית"</strong></li>
              <li>אשר בחלון שנפתח</li>
            </ol>
            <p className="install-modal-hint">
              אם האפשרות אינה מופיעה, נסה לרענן את הדף ולנסות שוב.
            </p>
            <button className="install-btn install-btn-primary install-btn-full" onClick={() => setInstallStep('none')}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      {/* ── iOS: Safari steps ── */}
      {installStep === 'ios-steps' && (
        <div className="install-modal-overlay" onClick={() => setInstallStep('none')}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">📲 הוספה למסך הבית</div>
            <ol className="install-steps">
              <li>לחץ על כפתור השיתוף <strong>⎋</strong> בתחתית Safari</li>
              <li>גלול למטה ובחר <strong>"הוסף למסך הבית"</strong></li>
              <li>לחץ <strong>"הוסף"</strong> בפינה הימנית עליונה</li>
            </ol>
            <button className="install-btn install-btn-primary install-btn-full" onClick={() => setInstallStep('none')}>
              הבנתי
            </button>
          </div>
        </div>
      )}
    </>
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
