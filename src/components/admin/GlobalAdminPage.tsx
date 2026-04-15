import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import StagePanel from './panels/StagePanel'
import TeamSetupPanel from './panels/TeamSetupPanel'
import ResultsPanel from './panels/ResultsPanel'
import BonusAdminPanel from './panels/BonusAdminPanel'
import AutoLockPanel from './panels/AutoLockPanel'
import NBAApiPanel from './panels/NBAApiPanel'
import LeagueManagementPanel from './panels/LeagueManagementPanel'
import TiebreakerAdminPanel from './panels/TiebreakerAdminPanel'
import EmailPanel from './panels/EmailPanel'
import SubmissionStatusPanel from './panels/SubmissionStatusPanel'
import PushNotificationPanel from './panels/PushNotificationPanel'

type AdminTab = 'locks' | 'teams' | 'results' | 'bonus' | 'tiebreaker' | 'notify' | 'leagues' | 'nba'

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'locks',      label: '🔒 נעילות' },
  { key: 'teams',      label: '🏀 קבוצות' },
  { key: 'results',    label: '📊 תוצאות' },
  { key: 'bonus',      label: '⭐ בונוס' },
  { key: 'tiebreaker', label: '🎯 שובר שוויון' },
  { key: 'notify',     label: '📣 תקשורת' },
  { key: 'leagues',    label: '🏟️ ליגות' },
  { key: 'nba',        label: '🏀 NBA API' },
]

export default function GlobalAdminPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useGlobalHelpers()
  const [activeTab, setActiveTab] = useState<AdminTab>('locks')

  if (!isSuperAdmin()) {
    return <div className="py-12 text-center text-[var(--red)]">⛔ אין גישה</div>
  }

  return (
    <div className="mx-auto max-w-[700px] py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← חזור</Button>
        <div className="text-xl font-bold text-[var(--orange)]">⚙️ ניהול גלובלי</div>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`stage-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'locks' && (
        <div className="space-y-4">
          <StagePanel />
          <AutoLockPanel />
        </div>
      )}
      {activeTab === 'teams'      && <TeamSetupPanel />}
      {activeTab === 'results'    && <ResultsPanel />}
      {activeTab === 'bonus'      && <BonusAdminPanel />}
      {activeTab === 'tiebreaker' && <TiebreakerAdminPanel />}
      {activeTab === 'notify' && (
        <div className="space-y-4">
          <PushNotificationPanel />
          <EmailPanel />
        </div>
      )}
      {activeTab === 'leagues' && (
        <div className="space-y-4">
          <SubmissionStatusPanel />
          <LeagueManagementPanel />
        </div>
      )}
      {activeTab === 'nba' && <NBAApiPanel />}
    </div>
  )
}
