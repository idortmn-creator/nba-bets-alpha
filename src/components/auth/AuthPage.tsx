import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, register, resetPassword, resendVerification } from '@/services/auth.service'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { toast('⚠️ מלא את כל השדות'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'EMAIL_NOT_VERIFIED') toast('📧 יש לאמת את האימייל תחילה')
      else toast('❌ ' + (msg.includes('invalid-credential') ? 'אימייל או סיסמה שגויים' : msg))
    } finally { setLoading(false) }
  }

  async function handleRegister() {
    if (!regName || !regUsername || !regEmail || !regPassword) { toast('⚠️ מלא את כל השדות'); return }
    if (regPassword.length < 6) { toast('⚠️ סיסמה חייבת להיות לפחות 6 תווים'); return }
    setLoading(true)
    try {
      await register(regName, regUsername.replace(/\s/g, ''), regEmail, regPassword)
      toast('📧 נשלח מייל אימות! אמת ואז התחבר')
      setTab('login')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'USERNAME_TAKEN') toast('⚠️ שם המשתמש תפוס')
      else toast('❌ ' + (msg.includes('email-already-in-use') ? 'אימייל כבר קיים' : msg))
    } finally { setLoading(false) }
  }

  async function handleReset() {
    if (!email) { toast('⚠️ הכנס אימייל תחילה'); return }
    try { await resetPassword(email); toast('📧 קישור לאיפוס נשלח! בדוק גם ספאם') }
    catch (e: unknown) { toast('❌ ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleResend() {
    if (!regEmail || !regPassword) { toast('⚠️ הכנס אימייל וסיסמה'); return }
    try { await resendVerification(regEmail, regPassword); toast('📧 מייל אימות נשלח שוב! בדוק ספאם') }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'ALREADY_VERIFIED') toast('✅ האימייל כבר מאומת!')
      else toast('❌ ' + msg)
    }
  }

  return (
    <div className="mx-auto max-w-[400px] pt-12">
      <div className="mb-6 text-center">
        <div className="font-oswald text-3xl text-[var(--orange)]">🏀 NBA BETS</div>
        <div className="mt-1 text-sm text-[var(--text2)]">הימורי פלייאוף 2026</div>
      </div>
      <Card>
        <div className="mb-5 flex overflow-hidden rounded-lg border-[1.5px] border-[var(--orange-border)]">
          <button
            className={`flex-1 py-2.5 text-sm font-bold transition-all ${tab === 'login' ? 'bg-[var(--orange)] text-white' : 'text-[var(--text2)]'}`}
            onClick={() => setTab('login')}
          >כניסה</button>
          <button
            className={`flex-1 py-2.5 text-sm font-bold transition-all ${tab === 'register' ? 'bg-[var(--orange)] text-white' : 'text-[var(--text2)]'}`}
            onClick={() => setTab('register')}
          >הרשמה</button>
        </div>

        {tab === 'login' ? (
          <div className="space-y-3">
            <div><Label>אימייל</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" /></div>
            <div><Label>סיסמה</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה..." onKeyDown={(e) => e.key === 'Enter' && handleLogin()} /></div>
            <Button size="full" onClick={handleLogin} disabled={loading}>🔑 כניסה</Button>
            <div className="text-center"><Button variant="ghost" size="sm" onClick={handleReset}>שכחתי סיסמה — שלח קישור לאיפוס</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>שם מלא (יוצג בטבלה)</Label><Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="שם ומשפחה..." /></div>
            <div><Label>שם משתמש</Label><Input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="username ללא רווחים..." /></div>
            <div><Label>אימייל</Label><Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="your@email.com" /></div>
            <div><Label>סיסמה (לפחות 6 תווים)</Label><Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="סיסמה..." /></div>
            <Button size="full" onClick={handleRegister} disabled={loading}>📧 הרשמה ושליחת אימות</Button>
            <div className="mt-3 rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3 text-xs text-[var(--text2)]">
              לאחר ההרשמה תישלח הודעת אימות לאימייל. יש ללחוץ עליה לפני הכניסה. בדוק גם ספאם!
            </div>
            <div className="text-center"><Button variant="ghost" size="sm" onClick={handleResend}>לא קיבלת מייל? שלח שוב</Button></div>
          </div>
        )}
      </Card>
    </div>
  )
}
