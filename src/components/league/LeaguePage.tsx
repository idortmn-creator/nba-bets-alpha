import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useLeague } from '@/hooks/useLeague'
import { useLeagueStore } from '@/store/league.store'
import LeaderboardTab from './tabs/LeaderboardTab'
import BetsViewTab from './tabs/BetsViewTab'
import EnterBetsTab from './tabs/EnterBetsTab'
import PreBetsTab from './tabs/PreBetsTab'
import RulesTab from './tabs/RulesTab'

type Tab = 'leaderboard' | 'bets' | 'enter-bets' | 'prebets' | 'rules'

export default function LeaguePage() {
  const { lid, tab: urlTab } = useParams<{ lid: string; tab?: string }>()
  const navigate = useNavigate()
  const { openLeague, closeLeague } = useLeague()
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const [activeTab, setActiveTab] = useState<Tab>((urlTab as Tab) || 'leaderboard')

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leaderboard', label: '🏆 טבלה' },
    { key: 'bets', label: '📋 הימורים' },
    { key: 'enter-bets', label: '✍️ הימורים שלי' },
    { key: 'prebets', label: '🏆 הימורים מוקדמים' },
    { key: 'rules', label: '📖 שיטת הניקוד' },
  ]

  function switchTab(tab: Tab) {
    setActiveTab(tab)
    navigate(`/league/${lid}/${tab === 'leaderboard' ? '' : tab}`, { replace: true })
  }

  return (
    <div className="py-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">{leagueData.name}</div>
          <div className="mt-0.5 text-xs text-[var(--text2)]">
            קוד: <span className="font-oswald tracking-[3px] text-[var(--orange)]">{leagueData.code}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← ליגות</Button>
      </div>

      <nav className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`main-nav-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => switchTab(t.key)}
          >{t.label}</button>
        ))}
      </nav>
      <hr className="main-nav-separator" />

      {activeTab === 'leaderboard' && <LeaderboardTab />}
      {activeTab === 'bets' && <BetsViewTab />}
      {activeTab === 'enter-bets' && <EnterBetsTab />}
      {activeTab === 'prebets' && <PreBetsTab />}
      {activeTab === 'rules' && <RulesTab />}
    </div>
  )
}
