import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useLeague } from '@/hooks/useLeague'
import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import LeagueHomeTab from './tabs/LeagueHomeTab'
import LeaderboardTab from './tabs/LeaderboardTab'
import BetsViewTab from './tabs/BetsViewTab'
import EnterBetsTab from './tabs/EnterBetsTab'
import PreBetsTab from './tabs/PreBetsTab'
import RulesTab from './tabs/RulesTab'
import LiveResultsTab from './tabs/LiveResultsTab'
import LeagueAdminTab from './tabs/LeagueAdminTab'
import ProfileContent from '@/components/profile/ProfileContent'

type Tab = 'home' | 'leaderboard' | 'bets' | 'enter-bets' | 'prebets' | 'rules' | 'profile' | 'live-results' | 'league-admin'
type MobileTab = 'home' | 'standings' | 'bets' | 'my-bets' | 'live' | 'league-admin' | 'profile'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const DESKTOP_TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
  { key: 'home',         label: '🏠 דף הבית' },
  { key: 'leaderboard',  label: '🏆 טבלה' },
  { key: 'bets',         label: '📋 הימורים' },
  { key: 'enter-bets',   label: '✍️ הימורים שלי' },
  { key: 'prebets',      label: '🏆 הימורים מוקדמים' },
  { key: 'live-results', label: '📅 תוצאות ומשחקים' },
  { key: 'rules',        label: '📖 שיטת הניקוד' },
  { key: 'league-admin', label: '⚙️ ניהול ליגה', adminOnly: true },
]

const MOBILE_TABS: { key: MobileTab; icon: string; label: string; adminOnly?: boolean }[] = [
  { key: 'home',         icon: '🏠', label: 'בית' },
  { key: 'standings',    icon: '🏆', label: 'טבלה' },
  { key: 'bets',         icon: '📋', label: 'הימורים' },
  { key: 'my-bets',      icon: '✍️', label: 'שלי' },
  { key: 'live',         icon: '📅', label: 'משחקים' },
  { key: 'league-admin', icon: '⚙️', label: 'ניהול', adminOnly: true },
  { key: 'profile',      icon: '👤', label: 'פרופיל' },
]

export default function LeaguePage() {
  const { lid, tab: urlTab } = useParams<{ lid: string; tab?: string }>()
  const navigate = useNavigate()
  const { openLeague, closeLeague } = useLeague()
  const leagueData  = useLeagueStore((s) => s.currentLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const isMobile    = useIsMobile()
  const isLeagueAdmin = !!leagueData && !!currentUser && leagueData.adminUid === currentUser.uid

  const [activeTab, setActiveTab] = useState<Tab>((urlTab as Tab) || 'home')
  const [betsSubTab, setBetsSubTab] = useState<'series' | 'prebets'>('series')

  useEffect(() => {
    if (lid) openLeague(lid)
    return () => closeLeague()
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
      navigate(`/league/${lid}/${tab === 'home' ? '' : tab}`, { replace: true })
    }
  }

  function getMobileActiveTab(): MobileTab {
    if (activeTab === 'home') return 'home'
    if (activeTab === 'leaderboard') return 'standings'
    if (activeTab === 'bets' || activeTab === 'prebets' || activeTab === 'rules') return 'bets'
    if (activeTab === 'enter-bets') return 'my-bets'
    if (activeTab === 'live-results') return 'live'
    if (activeTab === 'league-admin') return 'league-admin'
    return 'profile'
  }

  function handleMobileTab(mt: MobileTab) {
    if (mt === 'home') { switchTab('home') }
    else if (mt === 'standings') { switchTab('leaderboard') }
    else if (mt === 'bets') { switchTab('bets'); setBetsSubTab('series') }
    else if (mt === 'my-bets') { switchTab('enter-bets') }
    else if (mt === 'live') { switchTab('live-results') }
    else if (mt === 'league-admin') { switchTab('league-admin') }
    else if (mt === 'profile') { setActiveTab('profile') }
  }

  const mobileActiveTab = getMobileActiveTab()

  return (
    <div className="py-6 league-content">
      {/* League header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">{leagueData.name}</div>
          <div className="mt-0.5 text-xs text-[var(--text2)]">
            קוד: <span className="font-oswald tracking-[3px] text-[var(--orange)]">{leagueData.code}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← ליגות</Button>
      </div>

      {/* Desktop top nav — hidden on mobile */}
      <div className="desktop-nav-wrapper">
        <nav className="mb-3 flex flex-wrap gap-2">
          {DESKTOP_TABS.filter(t => !t.adminOnly || isLeagueAdmin).map((t) => (
            <button
              key={t.key}
              className={`main-nav-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => switchTab(t.key)}
            >{t.label}</button>
          ))}
        </nav>
        <hr className="main-nav-separator" />
      </div>

      {/* Tab content */}
      {activeTab === 'home'        && <LeagueHomeTab onViewRules={() => switchTab('rules')} />}
      {activeTab === 'leaderboard' && <LeaderboardTab />}

      {activeTab === 'bets' && (
        <>
          {/* Mobile bets sub-tabs */}
          {isMobile && (
            <div className="mb-3 flex gap-2">
              <button
                className={`stage-tab ${betsSubTab === 'series' ? 'active' : ''}`}
                onClick={() => setBetsSubTab('series')}
              >🏀 הימורי סדרות</button>
              <button
                className={`stage-tab ${betsSubTab === 'prebets' ? 'active' : ''}`}
                onClick={() => setBetsSubTab('prebets')}
              >🏆 הימורים מוקדמים</button>
            </div>
          )}
          {(!isMobile || betsSubTab === 'series') && <BetsViewTab />}
          {isMobile && betsSubTab === 'prebets' && <PreBetsTab />}
        </>
      )}

      {activeTab === 'enter-bets'   && <EnterBetsTab />}
      {activeTab === 'prebets'      && <PreBetsTab />}
      {activeTab === 'live-results'  && <LiveResultsTab />}
      {activeTab === 'league-admin' && <LeagueAdminTab />}
      {activeTab === 'rules'        && <RulesTab />}
      {activeTab === 'profile'      && <ProfileContent />}

      {/* Mobile bottom navigation bar */}
      <nav className="league-bottom-nav">
        {MOBILE_TABS.filter(t => !t.adminOnly || isLeagueAdmin).map((t) => (
          <button
            key={t.key}
            className={`lbn-item ${mobileActiveTab === t.key ? 'active' : ''}`}
            onClick={() => handleMobileTab(t.key)}
          >
            <span className="lbn-icon">{t.icon}</span>
            <span className="lbn-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
