import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth.store'
import { createLeague } from '@/services/league.service'

export default function CreateLeaguePage() {
  const navigate = useNavigate()
  const { currentUser, currentUserDoc } = useAuthStore()
  const [name, setName] = useState('')
  const [result, setResult] = useState<{ lid: string; code: string } | null>(null)

  async function handleCreate() {
    if (!name.trim()) { toast('⚠️ הכנס שם ליגה'); return }
    if (!currentUser || !currentUserDoc) return
    try {
      const res = await createLeague(name.trim(), currentUser, currentUserDoc)
      setResult(res)
      toast('✅ ליגה נוצרה!')
    } catch (e: unknown) { toast('❌ ' + (e instanceof Error ? e.message : String(e))) }
  }

  const link = result ? `${location.origin}${location.pathname}#/join/${result.code}` : ''

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-bold">➕ ליגה חדשה</div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← חזור</Button>
      </div>
      <Card className="max-w-[460px]">
        <div><Label>שם הליגה</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="הימורי המשרד 2026..." onKeyDown={(e) => e.key === 'Enter' && handleCreate()} /></div>
        <Button onClick={handleCreate} className="mt-3" size="full">🚀 צור ליגה</Button>
      </Card>
      {result && (
        <Card className="max-w-[460px]">
          <CardTitle>✅ הליגה נוצרה!</CardTitle>
          <div className="mb-3">
            <Label>קוד הליגה</Label>
            <div className="rounded-lg bg-[var(--dark3)] p-3 text-center font-oswald text-2xl tracking-[6px] text-[var(--orange)]">{result.code}</div>
          </div>
          <div className="mb-3">
            <Label>קישור ישיר</Label>
            <div className="flex gap-2">
              <Input value={link} readOnly className="flex-1" />
              <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast('📋 הועתק!') }}>📋 העתק</Button>
            </div>
          </div>
          <Button size="full" onClick={() => navigate(`/league/${result.lid}`)}>🏀 כנס לליגה</Button>
        </Card>
      )}
    </div>
  )
}
