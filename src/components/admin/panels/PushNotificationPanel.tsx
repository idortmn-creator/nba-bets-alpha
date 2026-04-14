import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const sendPushFn = httpsCallable(functions, 'sendPushNotification')

export default function PushNotificationPanel() {
  const [title, setTitle] = useState('🏀 NBA Bets 2026')
  const [body, setBody]   = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast('❌ יש להזין כותרת וגוף ההודעה')
      return
    }
    setSending(true)
    try {
      const res  = await sendPushFn({ title: title.trim(), body: body.trim() })
      const { sent, failed, total } = res.data as { sent: number; failed: number; total: number }
      if (total === 0) {
        toast('⚠️ אין משתמשים עם טוקן התראות — לא נשלח')
      } else {
        toast(`✅ נשלח ל-${sent} מכשירים${failed ? ` · נכשל: ${failed}` : ''} (מתוך ${total})`)
      }
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardTitle>🔔 שליחת התראה לכל המשתמשים</CardTitle>

      <div className="mb-4 rounded-lg border border-[rgba(255,165,0,0.2)] bg-[rgba(255,165,0,0.05)] p-3 text-xs text-[var(--text2)] leading-relaxed">
        ההתראה תישלח לכל המשתמשים שאישרו התראות — גם כשהאפליקציה סגורה.
        <br />
        <span className="text-[var(--text1)]">אנדרואיד:</span> עובד בדפדפן Chrome.{' '}
        <span className="text-[var(--text1)]">iOS:</span> עובד מ-iOS 16.4 כשהאפליקציה מותקנת כ-PWA.
      </div>

      <div className="space-y-3">
        <div>
          <Label>כותרת</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="כותרת ההתראה..."
          />
        </div>
        <div>
          <Label>תוכן ההודעה</Label>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--dark2)] p-2 text-sm text-[var(--text1)] placeholder:text-[var(--text2)] focus:outline-none focus:ring-1 focus:ring-[var(--orange)] min-h-[80px] resize-y"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="תוכן ההתראה..."
            dir="rtl"
          />
        </div>

        <Button onClick={handleSend} disabled={sending}>
          {sending ? '⏳ שולח...' : '🔔 שלח התראה לכל המשתמשים'}
        </Button>
      </div>

      <div className="mt-5 rounded-lg border border-[rgba(79,195,247,0.2)] bg-[rgba(79,195,247,0.05)] p-3 text-xs text-[var(--text2)]">
        <div className="font-bold text-[var(--blue)] mb-2">הגדרה ראשונית (חד-פעמי):</div>
        <ol className="list-decimal list-inside space-y-1 leading-relaxed">
          <li>Firebase Console → Project Settings → Cloud Messaging</li>
          <li>תחת "Web Push certificates" → לחץ "Generate key pair"</li>
          <li>העתק את המפתח הציבורי (Public Key)</li>
          <li>הדבק אותו בשורה <code className="text-[var(--orange)]">VAPID_KEY</code> בקובץ <code className="text-[var(--orange)]">src/lib/messaging.ts</code></li>
          <li>Push + deploy — ההתראות יופעלו אוטומטית</li>
        </ol>
      </div>
    </Card>
  )
}
