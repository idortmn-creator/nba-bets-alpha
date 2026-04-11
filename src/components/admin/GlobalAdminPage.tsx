import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { STAGE_NAMES, STAGE_KEYS } from '@/lib/constants'
import StagePanel from './panels/StagePanel'
import TeamSetupPanel from './panels/TeamSetupPanel'
import ResultsPanel from './panels/ResultsPanel'
import BonusAdminPanel from './panels/BonusAdminPanel'
import AutoLockPanel from './panels/AutoLockPanel'
import ESPNPanel from './panels/ESPNPanel'
import LeagueManagementPanel from './panels/LeagueManagementPanel'

export default function GlobalAdminPage() {
  const navigate = useNavigate()
  const { isSuperAdmin } = useGlobalHelpers()

  if (!isSuperAdmin()) {
    return <div className="py-12 text-center text-[var(--red)]">⛔ אין גישה</div>
  }

  return (
    <div className="mx-auto max-w-[700px] py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← חזור</Button>
        <div className="text-xl font-bold text-[var(--orange)]">⚙️ ניהול גלובלי</div>
      </div>
      <StagePanel />
      <TeamSetupPanel />
      <ResultsPanel />
      <BonusAdminPanel />
      <AutoLockPanel />
      <ESPNPanel />
      <LeagueManagementPanel />
      <ReminderCard />
    </div>
  )
}

function ReminderCard() {
  const { getGlobal } = useGlobalHelpers()

  function sendReminder() {
    const link = `${location.origin}${location.pathname}`
    const cs = getGlobal('currentStage', 0)
    const stageName = STAGE_NAMES[STAGE_KEYS.indexOf(cs)] || ''
    const subject = encodeURIComponent(`תזכורת: הזן הימורים — ${stageName}`)
    const body = encodeURIComponent(`שלום,\n\nתזכורת להזין את הימוריך עבור ${stageName}.\n\nכניסה לאתר:\n${link}\n\nבהצלחה!`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <div className="rounded-2xl border border-[var(--orange-border)] bg-[var(--card-bg)] p-5 mb-4">
      <div className="font-oswald text-lg text-[var(--orange)] mb-3">📧 שליחת תזכורת</div>
      <div className="text-xs text-[var(--text2)] mb-2">שלח מייל תזכורת לכל המשתתפים</div>
      <Button variant="secondary" size="sm" onClick={sendReminder} className="!bg-[rgba(79,195,247,0.1)] !border-[rgba(79,195,247,0.3)] !text-[var(--blue)]">📧 פתח מייל תזכורת</Button>
    </div>
  )
}
