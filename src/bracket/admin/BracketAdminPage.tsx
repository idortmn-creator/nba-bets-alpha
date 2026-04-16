import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import BracketLockPanel         from './panels/BracketLockPanel'
import BracketResultsPanel      from './panels/BracketResultsPanel'
import BracketTiebreakerPanel   from './panels/BracketTiebreakerPanel'
import BracketLeagueManagementPanel from './panels/BracketLeagueManagementPanel'
import BracketCommunicationPanel from './panels/BracketCommunicationPanel'
import NBAApiPanel              from '@/components/admin/panels/NBAApiPanel'

type Tab = 'lock' | 'results' | 'tiebreaker' | 'leagues' | 'notify' | 'api'

const TABS: { key: Tab; label: string }[] = [
  { key: 'lock',        label: '🔒 נעילה' },
  { key: 'results',     label: '📊 תוצאות' },
  { key: 'tiebreaker',  label: '🎯 שובר שוויון' },
  { key: 'leagues',     label: '🏟️ ליגות' },
  { key: 'notify',      label: '📣 תקשורת' },
  { key: 'api',         label: '🏀 API' },
]

export default function BracketAdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('lock')

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--blue)] bg-[rgba(79,195,247,0.12)] border border-[rgba(79,195,247,0.3)] rounded px-2 py-0.5">📊 ברקט</span>
            <div className="text-lg font-bold">ניהול גלובלי — ברקט</div>
          </div>
          <div className="mt-0.5 text-xs text-[var(--text2)]">הגדרות גלובליות עבור פורמט הברקט</div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/bracket')}>← ברקט</Button>
      </div>

      {/* Tab bar */}
      <nav className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`main-nav-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <hr className="main-nav-separator mb-4" />

      {/* Tab content */}
      {activeTab === 'lock'       && <BracketLockPanel />}
      {activeTab === 'results'    && <BracketResultsPanel />}
      {activeTab === 'tiebreaker' && <BracketTiebreakerPanel />}
      {activeTab === 'leagues'    && <BracketLeagueManagementPanel />}
      {activeTab === 'notify'     && <BracketCommunicationPanel />}
      {activeTab === 'api'        && <NBAApiPanel />}
    </div>
  )
}
