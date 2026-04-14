import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import {
  shouldShowNotificationPrompt,
  requestPermissionAndSave,
  dismissNotificationPrompt,
} from '@/lib/messaging'
import { toast } from 'sonner'

export default function NotificationBanner() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const [visible, setVisible] = useState(() => shouldShowNotificationPrompt())

  if (!visible || !currentUser) return null

  async function handleEnable() {
    setVisible(false)
    const granted = await requestPermissionAndSave(currentUser!.uid)
    if (granted) {
      toast('🔔 התראות הופעלו בהצלחה')
    }
  }

  function handleDismiss() {
    dismissNotificationPrompt()
    setVisible(false)
  }

  return (
    <div className="install-banner">
      <span className="install-banner-text">🔔 רוצה לקבל התראות על תזכורות ועדכונים?</span>
      <div className="install-banner-actions">
        <button className="install-btn install-btn-primary" onClick={handleEnable}>הפעל</button>
        <button className="install-btn install-btn-secondary" onClick={handleDismiss}>לא עכשיו</button>
      </div>
    </div>
  )
}
