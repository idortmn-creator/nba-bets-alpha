import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth.store'
import { joinLeague } from '@/services/league.service'

export default function JoinLeaguePage() {
  const navigate = useNavigate()
  const { currentUser, currentUserDoc } = useAuthStore()
  const [code, setCode] = useState('')

  async function handleJoin() {
    if (code.length !== 6) { toast('⚠️ קוד בן 6 ספרות'); return }
    if (!currentUser || !currentUserDoc) return
    try {
      const lid = await joinLeague(code, currentUser, currentUserDoc)
      toast('✅ הצטרפת לליגה!')
      navigate(`/league/${lid}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'LEAGUE_NOT_FOUND') toast('❌ קוד לא נמצא')
      else toast('❌ ' + msg)
    }
  }

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-bold">🔗 הצטרף לליגה</div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← חזור</Button>
      </div>
      <Card className="max-w-[380px]">
        <Label>קוד ליגה (6 ספרות)</Label>
        <Input
          value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="123456" maxLength={6}
          className="!text-center !font-oswald !text-2xl !tracking-[6px]"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        <Button onClick={handleJoin} size="full" className="mt-3">✅ הצטרף</Button>
      </Card>
    </div>
  )
}
