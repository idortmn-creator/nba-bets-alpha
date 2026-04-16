import PushNotificationPanel from '@/components/admin/panels/PushNotificationPanel'
import EmailPanel from '@/components/admin/panels/EmailPanel'

export default function BracketCommunicationPanel() {
  return (
    <div className="space-y-4">
      <PushNotificationPanel />
      <EmailPanel />
    </div>
  )
}
