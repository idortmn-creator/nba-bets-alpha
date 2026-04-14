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
  const [recipients, setRecipients] = useState<{ email: string; name: string }[] | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)

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

  async function handleLoadRecipients() {
    setLoadingRecipients(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const list = snap.docs
        .map(d => d.data() as { email?: string; displayName?: string; username?: string })
        .filter(u => !!u.email)
        .map(u => ({ email: u.email!, name: u.displayName || u.username || u.email! }))
      setRecipients(list)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingRecipients(false)
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
    if (!recipients) {
      toast('❌ יש ללחוץ "טען נמענים" תחילה')
      return
    }

    setSending(true)
    setProgress(null)

    let sent = 0, failed = 0
    for (const u of recipients) {
      setProgress(`שולח ${sent + failed + 1} / ${recipients.length}... (${u.email})`)
      try {
        await emailjsSend(serviceId, templateId, publicKey, {
          to_email: u.email,
          to_name: u.name,
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
    setSending(false)
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

      {/* ⚠️ Critical template warning */}
      <div className="mb-4 rounded-lg border border-[rgba(255,80,80,0.4)] bg-[rgba(255,80,80,0.07)] p-3 text-xs">
        <div className="font-bold text-[var(--red)] mb-1">⚠️ חשוב: הגדרת שדה "To Email" בתבנית</div>
        <p className="text-[var(--text2)] leading-relaxed">
          בדשבורד EmailJS, תחת <strong className="text-[var(--text1)]">Email Templates → Edit Template → To Email</strong>,
          חייב להיות רשום בדיוק:{' '}
          <code className="rounded bg-[rgba(255,165,0,0.2)] px-1 text-[var(--orange)]">{'{{to_email}}'}</code>
          <br />
          אם השדה הזה מכיל כתובת קבועה (כמו כתובת המייל שלך) — כל המיילים יישלחו לאותה כתובת במקום לנמענים האמיתיים.
        </p>
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

        {/* Step 1: load & preview recipients */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--dark3)] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--text2)]">שלב 1 — טען ובדוק נמענים</span>
            <Button variant="secondary" size="sm" onClick={handleLoadRecipients} disabled={loadingRecipients}>
              {loadingRecipients ? '⏳' : '👥'} טען נמענים
            </Button>
          </div>
          {recipients !== null && (
            recipients.length === 0 ? (
              <div className="text-xs text-[var(--red)]">לא נמצאו משתמשים עם כתובת מייל</div>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {recipients.map(r => (
                  <div key={r.email} className="text-xs text-[var(--text2)] flex gap-2">
                    <span className="text-[var(--text1)]">{r.name}</span>
                    <span className="opacity-60">{r.email}</span>
                  </div>
                ))}
                <div className="mt-1 text-xs font-bold text-[var(--orange)]">סה״כ: {recipients.length} נמענים</div>
              </div>
            )
          )}
        </div>

        {progress && (
          <div className="text-xs text-[var(--text2)] break-all">⏳ {progress}</div>
        )}

        {/* Step 2: send */}
        <Button onClick={handleSend} disabled={sending || !recipients?.length}>
          {sending ? '⏳ שולח...' : `📧 שלב 2 — שלח ל-${recipients?.length ?? '?'} משתמשים`}
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
            הגדר בתבנית — <strong className="text-[var(--red)]">שימו לב לשדה "To Email"!</strong>
            <ul className="list-disc list-inside mr-4 mt-0.5 space-y-0.5">
              <li><strong>To Email:</strong> <code className="text-[var(--orange)]">{"{{to_email}}"}</code> ← חובה! בלי זה הכל הולך אליך</li>
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
