import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, register, resetPassword, resendVerification, signInWithGoogle, getGoogleRedirectResult } from '@/services/auth.service'

function GoogleButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button className="auth-google-btn" onClick={onClick} disabled={disabled}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {label}
    </button>
  )
}

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  // Pick up any Google redirect result (errors only — success fires onAuthStateChanged)
  useEffect(() => {
    getGoogleRedirectResult().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
        toast('❌ ' + msg)
      }
    })
  }, [])

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
      setRegisteredEmail(regEmail)
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

  async function handleGoogle() {
    setLoading(true)
    try {
      await signInWithGoogle()
      // signInWithRedirect navigates away — code below won't run
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast('❌ ' + msg)
      setLoading(false)
    }
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

  if (registeredEmail) {
    return (
      <div className="mx-auto max-w-[400px] pt-12">
        <div className="mb-6 text-center">
          <div className="font-oswald text-3xl text-[var(--orange)]">🏀 NBA BETS</div>
          <div className="mt-1 text-sm text-[var(--text2)]">הימורי פלייאוף 2026</div>
        </div>
        <Card>
          <div className="mb-4 text-center text-4xl">📧</div>
          <div className="mb-2 text-center text-lg font-bold">נשלח מייל אימות!</div>
          <div className="mb-4 text-center text-sm text-[var(--text2)]">{registeredEmail}</div>
          <div className="mb-4 rounded-lg border border-[var(--orange-border)] bg-[var(--orange-dim)] p-3 text-sm leading-relaxed">
            לחץ על הקישור במייל כדי לאמת את החשבון לפני הכניסה.
          </div>
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.06)] p-3 text-sm leading-relaxed text-[var(--text)]">
            <span className="mt-0.5 text-base">⚠️</span>
            <span>לא רואה את המייל? <strong>בדוק את תיקיית הספאם / דואר זבל.</strong> לפעמים מיילי אימות נחסמים אוטומטית.</span>
          </div>
          <Button size="full" onClick={() => { setRegisteredEmail(''); setTab('login') }}>להתחברות →</Button>
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={async () => {
              try { await resendVerification(registeredEmail, regPassword); toast('📧 מייל אימות נשלח שוב!') }
              catch { toast('❌ שגיאה בשליחה מחדש') }
            }}>לא קיבלת? שלח שוב</Button>
          </div>
        </Card>
      </div>
    )
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

        <GoogleButton onClick={handleGoogle} disabled={loading} label={tab === 'login' ? 'כניסה עם Google' : 'הרשמה עם Google'} />
        <div className="auth-divider"><span>או</span></div>

        {tab === 'login' ? (
          <div className="space-y-3">
            <div><Label>אימייל</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" /></div>
            <div><Label>סיסמה</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה..." onKeyDown={(e) => e.key === 'Enter' && handleLogin()} /></div>
            <Button size="full" onClick={handleLogin} disabled={loading}>🔑 כניסה עם אימייל</Button>
            <div className="text-center"><Button variant="ghost" size="sm" onClick={handleReset}>שכחתי סיסמה — שלח קישור לאיפוס</Button></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>שם מלא (יוצג בטבלה)</Label><Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="שם ומשפחה..." /></div>
            <div><Label>שם משתמש</Label><Input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="username ללא רווחים..." /></div>
            <div><Label>אימייל</Label><Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="your@email.com" /></div>
            <div><Label>סיסמה (לפחות 6 תווים)</Label><Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="סיסמה..." /></div>
            <Button size="full" onClick={handleRegister} disabled={loading}>📧 הרשמה עם אימייל</Button>
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
