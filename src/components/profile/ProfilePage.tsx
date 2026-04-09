import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth.store'
import { saveProfile, changePassword } from '@/services/auth.service'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { currentUser, currentUserDoc, setUserDoc } = useAuthStore()
  const [name, setName] = useState(currentUserDoc?.displayName || '')
  const [username, setUsername] = useState(currentUserDoc?.username || '')
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  async function handleSave() {
    if (!name || !username) { toast('⚠️ מלא את כל השדות'); return }
    if (!currentUser) return
    try {
      await saveProfile(currentUser.uid, name, username, currentUserDoc?.username || '')
      setUserDoc({ ...currentUserDoc!, displayName: name, username })
      toast('✅ פרופיל עודכן!')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'USERNAME_TAKEN') toast('⚠️ שם המשתמש תפוס')
      else toast('❌ ' + msg)
    }
  }

  async function handleChangePassword() {
    if (!oldPass || !newPass || !confirmPass) { toast('⚠️ מלא את כל השדות'); return }
    if (newPass.length < 6) { toast('⚠️ סיסמה חייבת להיות לפחות 6 תווים'); return }
    if (newPass !== confirmPass) { toast('⚠️ הסיסמאות אינן תואמות'); return }
    if (oldPass === newPass) { toast('⚠️ הסיסמה החדשה חייבת להיות שונה מהישנה'); return }
    try {
      await changePassword(currentUser!.email!, oldPass, newPass)
      setOldPass(''); setNewPass(''); setConfirmPass('')
      toast('✅ סיסמה שונתה בהצלחה!')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) toast('❌ סיסמה ישנה שגויה')
      else toast('❌ ' + msg)
    }
  }

  return (
    <div className="mx-auto max-w-[480px] py-6">
      <Button variant="secondary" size="sm" onClick={() => navigate('/')} className="mb-4">← חזור</Button>
      <Card>
        <CardTitle>👤 פרופיל</CardTitle>
        <div className="space-y-3">
          <div><Label>שם מלא</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>שם משתמש</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <Button onClick={handleSave} className="mt-1">💾 שמור שינויים</Button>
        </div>
      </Card>
      <Card>
        <CardTitle>🔑 שינוי סיסמה</CardTitle>
        <div className="space-y-3">
          <div><Label>סיסמה נוכחית</Label><Input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} /></div>
          <div><Label>סיסמה חדשה</Label><Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="לפחות 6 תווים..." /></div>
          <div><Label>אימות סיסמה</Label><Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} /></div>
          <Button variant="secondary" onClick={handleChangePassword} className="mt-1">🔑 שנה סיסמה</Button>
        </div>
      </Card>
    </div>
  )
}
