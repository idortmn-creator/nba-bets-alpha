import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import ProfileContent from './ProfileContent'

export default function ProfilePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[480px] py-6">
      <Button variant="secondary" size="sm" onClick={() => navigate('/')} className="mb-4">← חזור</Button>
      <ProfileContent />
    </div>
  )
}
