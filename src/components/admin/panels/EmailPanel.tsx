import { useState, useEffect } from 'react'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveEmailJSSettings } from '@/services/global.service'

// EmailJS REST API — no npm package required
async function emailjsSend(
  serviceId: string,
  templateId: string,
  publicKey: string,
  params: Record<string, string>,
): Promise<void> {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: params,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EmailJS ${res.status}: ${text}`)
  }
}

export default function EmailPanel() {
  const { getGlobal } = useGlobalHelpers()

  const [serviceId, setServiceId]   = useState('')
  const [templateId, setTemplateId] = useState('')
  const [publicKey, setPublicKey]   = useState('')
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')
  const [sending, setSending]       = useState(false)
  const [progress, setProgress]     = useState<string | null>(null)

  // Load saved credentials from globalData
  useEffect(() => {
    setServiceId(getGlobal('emailjsServiceId', '') as string)
    setTemplateId(getGlobal('emailjsTemplateId', '') as string)
    setPublicKey(getGlobal('emailjsPublicKey', '') as string)
  }, [getGlobal])

  async function handleSaveCredentials() {
    try {
      await saveEmailJSSettings(serviceId.trim(), templateId.trim(), publicKey.trim())
      toast('✅ פרטי EmailJS נשמרו')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleSend() {
    if (!serviceId || !templateId || !publicKey) {
      toast('❌ יש להזין ולשמור פרטי EmailJS תחילה')
      return
    }
    if (!subject.trim() || !body.trim()) {
      toast('❌ יש להזין נושא וגוף המייל')
      return
    }

    setSending(true)
    setProgress('טוען רשימת משתמשים...')

    try {
      const snap = await getDocs(collection(db, 'users'))
      const users = snap.docs
        .map(d => d.data() as { email?: string; displayName?: string; username?: string })
        .filter(u => u.email)

      let sent = 0, failed = 0

      for (const u of users) {
        setProgress(`שולח ${sent + failed + 1} / ${users.length}...`)
        try {
          await emailjsSend(serviceId, templateId, publicKey, {
            to_email: u.email!,
            to_name: u.displayName || u.username || u.email!,
            subject: subject.trim(),
            message: body.trim(),
          })
          sent++
        } catch {
          failed++
        }
      }

      setProgress(null)
      toast(`✅ נשלח ל-${sent} משתמשים${failed ? ` · נכשל: ${failed}` : ''}`)
    } catch (e: unknown) {
      setProgress(null)
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardTitle>📧 שליחת מייל לכל המשתמשים</CardTitle>

      {/* EmailJS credentials */}
      <div className="mb-4 rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3">
        <div className="mb-2 text-xs font-bold text-[var(--orange)]">הגדרות EmailJS</div>
        <div className="space-y-2">
          <div>
            <Label>Service ID</Label>
            <Input value={serviceId} onChange={e => setServiceId(e.target.value)} placeholder="service_xxxxxxx" />
          </div>
          <div>
            <Label>Template ID</Label>
            <Input value={templateId} onChange={e => setTemplateId(e.target.value)} placeholder="template_xxxxxxx" />
          </div>
          <div>
            <Label>Public Key</Label>
            <Input value={publicKey} onChange={e => setPublicKey(e.target.value)} placeholder="xxxxxxxxxxxx" />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveCredentials}>
            💾 שמור פרטים
          </Button>
        </div>
      </div>

      {/* Email compose */}
      <div className="space-y-3">
        <div>
          <Label>נושא</Label>
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="נושא המייל..."
          />
        </div>
        <div>
          <Label>גוף המייל</Label>
          <textarea
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--dark2)] p-2 text-sm text-[var(--text1)] placeholder:text-[var(--text2)] focus:outline-none focus:ring-1 focus:ring-[var(--orange)] min-h-[120px] resize-y"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="תוכן המייל..."
            dir="rtl"
          />
        </div>

        {progress && (
          <div className="text-sm text-[var(--text2)]">⏳ {progress}</div>
        )}

        <Button onClick={handleSend} disabled={sending}>
          {sending ? '⏳ שולח...' : '📧 שלח לכל המשתמשים'}
        </Button>
      </div>

      {/* Setup instructions */}
      <div className="mt-5 rounded-lg border border-[rgba(79,195,247,0.2)] bg-[rgba(79,195,247,0.05)] p-3 text-xs text-[var(--text2)]">
        <div className="font-bold text-[var(--blue)] mb-2">הגדרת EmailJS (חד-פעמי):</div>
        <ol className="space-y-1 list-decimal list-inside leading-relaxed">
          <li>צור חשבון חינמי ב-<span className="text-[var(--blue)]">emailjs.com</span></li>
          <li>Email Services ← Add New Service (Gmail / Outlook)</li>
          <li>Email Templates ← Create New Template</li>
          <li>
            הגדר בתבנית:
            <ul className="list-disc list-inside mr-4 mt-0.5">
              <li>To Email: <code className="text-[var(--orange)]">{"{{to_email}}"}</code></li>
              <li>Subject: <code className="text-[var(--orange)]">{"{{subject}}"}</code></li>
              <li>Body: <code className="text-[var(--orange)]">{"{{message}}"}</code></li>
            </ul>
          </li>
          <li>העתק את Service ID, Template ID מהדשבורד</li>
          <li>Account ← API Keys ← Public Key</li>
          <li>הזן את כל הפרטים למעלה ולחץ "שמור פרטים"</li>
        </ol>
      </div>
    </Card>
  )
}
