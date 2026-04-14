import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import StagePanel from './panels/StagePanel'
import TeamSetupPanel from './panels/TeamSetupPanel'
import ResultsPanel from './panels/ResultsPanel'
import BonusAdminPanel from './panels/BonusAdminPanel'
import AutoLockPanel from './panels/AutoLockPanel'
import ESPNPanel from './panels/ESPNPanel'
import NBAApiPanel from './panels/NBAApiPanel'
import LeagueManagementPanel from './panels/LeagueManagementPanel'
import TiebreakerAdminPanel from './panels/TiebreakerAdminPanel'
import EmailPanel from './panels/EmailPanel'
import SubmissionStatusPanel from './panels/SubmissionStatusPanel'

type AdminTab = 'stages' | 'teams' | 'results' | 'bonus' | 'autolock' | 'espn' | 'nba' | 'leagues' | 'tiebreaker' | 'email' | 'submissions'

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'stages',      label: '🔄 שלבים' },
  { key: 'teams',       label: '🏀 קבוצות' },
  { key: 'results',     label: '📊 תוצאות' },
  { key: 'bonus',       label: '⭐ בונוס' },
  { key: 'tiebreaker',  label: '🎯 שובר שוויון' },
  { key: 'autolock',    label: '⏰ נעילה אוטו׳' },
  { key: 'submissions', label: '📋 סטטוס הגשות' },
  { key: 'email',       label: '📧 מיילים' },
  { key: 'nba',         label: '🏀 NBA API' },
  { key: 'espn',        label: '📡 ESPN' },
  { key: 'leagues',     label: '🏟️ ליגות' },
]

export default function GlobalAdminPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useGlobalHelpers()
  const [activeTab, setActiveTab] = useState<AdminTab>('stages')

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

      {activeTab === 'stages'   && <StagePanel />}
      {activeTab === 'teams'    && <TeamSetupPanel />}
      {activeTab === 'results'  && <ResultsPanel />}
      {activeTab === 'bonus'    && <BonusAdminPanel />}
      {activeTab === 'tiebreaker' && <TiebreakerAdminPanel />}
      {activeTab === 'autolock' && <AutoLockPanel />}
      {activeTab === 'nba'      && <NBAApiPanel />}
      {activeTab === 'espn'     && <ESPNPanel />}
      {activeTab === 'email'       && <EmailPanel />}
      {activeTab === 'submissions' && <SubmissionStatusPanel />}
      {activeTab === 'leagues'  && (
        <>
          <LeagueManagementPanel />
          <ReminderCard />
        </>
      )}
    </div>
  )
}

function ReminderCard() {
  return null
}
