import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useBracketLeague } from './useBracketLeague'
import { useBracketLeagueStore } from './bracketLeague.store'
import BracketHomeTab from './tabs/BracketHomeTab'
import BracketLeaderboardTab from './tabs/BracketLeaderboardTab'
import BracketBetsViewTab from './tabs/BracketBetsViewTab'
import BracketMyBetsTab from './tabs/BracketMyBetsTab'
import BracketRulesTab from './tabs/BracketRulesTab'
import ProfileContent from '@/components/profile/ProfileContent'

type Tab = 'home' | 'leaderboard' | 'bets' | 'my-bets' | 'rules' | 'profile'
type MobileTab = 'home' | 'standings' | 'bets' | 'my-bets' | 'rules' | 'profile'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const DESKTOP_TABS: { key: Tab; label: string }[] = [
  { key: 'home',        label: '🏠 דף הבית' },
  { key: 'leaderboard', label: '🏆 טבלה' },
  { key: 'bets',        label: '📋 הימורים' },
  { key: 'my-bets',     label: '✍️ הימורים שלי' },
  { key: 'rules',       label: '📖 שיטת הניקוד' },
]

const MOBILE_TABS: { key: MobileTab; icon: string; label: string }[] = [
  { key: 'home',      icon: '🏠', label: 'בית' },
  { key: 'standings', icon: '🏆', label: 'טבלה' },
  { key: 'bets',      icon: '📋', label: 'הימורים' },
  { key: 'my-bets',   icon: '✍️', label: 'שלי' },
  { key: 'profile',   icon: '👤', label: 'פרופיל' },
]

export default function BracketLeaguePage() {
  const { lid, tab: urlTab } = useParams<{ lid: string; tab?: string }>()
  const navigate = useNavigate()
  const { openBracketLeague, closeBracketLeague } = useBracketLeague()
  const leagueData = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState<Tab>((urlTab as Tab) || 'home')

  useEffect(() => {
    if (lid) openBracketLeague(lid)
    return () => closeBracketLeague()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid])

  useEffect(() => {
    if (urlTab) setActiveTab(urlTab as Tab)
  }, [urlTab])

  if (!leagueData) {
    return <div className="flex items-center justify-center py-16"><div className="spinner" /></div>
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    if (tab !== 'profile') {
      navigate(`/bracket/league/${lid}/${tab === 'home' ? '' : tab}`, { replace: true })
    }
  }

  function getMobileActiveTab(): MobileTab {
    if (activeTab === 'home') return 'home'
    if (activeTab === 'leaderboard') return 'standings'
    if (activeTab === 'bets') return 'bets'
    if (activeTab === 'my-bets') return 'my-bets'
    if (activeTab === 'rules') return 'bets'
    return 'profile'
  }

  function handleMobileTab(mt: MobileTab) {
    if (mt === 'home') switchTab('home')
    else if (mt === 'standings') switchTab('leaderboard')
    else if (mt === 'bets') switchTab('bets')
    else if (mt === 'my-bets') switchTab('my-bets')
    else if (mt === 'profile') setActiveTab('profile')
  }

  return (
    <div className="py-6 league-content">
      {/* League header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--blue)] bg-[rgba(79,195,247,0.12)] border border-[rgba(79,195,247,0.3)] rounded px-2 py-0.5">📊 ברקט</span>
            <div className="text-lg font-bold">{leagueData.name}</div>
          </div>
          <div className="mt-0.5 text-xs text-[var(--text2)]">
            קוד: <span className="font-oswald tracking-[3px] text-[var(--orange)]">{leagueData.code}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/bracket')}>← ליגות</Button>
      </div>

      {/* Desktop nav */}
      <div className="desktop-nav-wrapper">
        <nav className="mb-3 flex flex-wrap gap-2">
          {DESKTOP_TABS.map((t) => (
            <button key={t.key} className={`main-nav-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => switchTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <hr className="main-nav-separator" />
      </div>

      {/* Tab content */}
      {activeTab === 'home'        && <BracketHomeTab onViewRules={() => switchTab('rules')} />}
      {activeTab === 'leaderboard' && <BracketLeaderboardTab />}
      {activeTab === 'bets'        && <BracketBetsViewTab />}
      {activeTab === 'my-bets'     && <BracketMyBetsTab />}
      {activeTab === 'rules'       && <BracketRulesTab />}
      {activeTab === 'profile'     && <ProfileContent />}

      {/* Mobile bottom nav */}
      <nav className="league-bottom-nav">
        {MOBILE_TABS.map((t) => (
          <button key={t.key} className={`lbn-item ${getMobileActiveTab() === t.key ? 'active' : ''}`} onClick={() => handleMobileTab(t.key)}>
            <span className="lbn-icon">{t.icon}</span>
            <span className="lbn-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
