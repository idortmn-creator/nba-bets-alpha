import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { app, db } from '@/lib/firebase'
import { toast } from 'sonner'

const VAPID_KEY = 'BDn9g14cbhTesCmJUTDT8GHRBfCn4cZ7Iu0XD9DyjAilP1azMb7tnDEU7yQ4uWN9L5Vj2d1FJ5RguwFQ8VUQhD8'
const PROMPTED_KEY = 'nba-bets-notif-prompted'

function isFCMSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  )
}

async function registerAndSaveToken(uid: string): Promise<void> {
  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
  if (token) {
    await updateDoc(doc(db, 'users', uid), { fcmToken: token })
  }
}

/**
 * Returns true when we should show the in-app notification banner:
 * - browser supports notifications
 * - permission hasn't been granted or denied yet (still 'default')
 * - we haven't prompted this device before
 */
export function shouldShowNotificationPrompt(): boolean {
  if (!isFCMSupported()) return false
  if (Notification.permission !== 'default') return false
  return localStorage.getItem(PROMPTED_KEY) !== '1'
}

/** Mark this device as having been prompted (so the banner doesn't reappear). */
export function dismissNotificationPrompt(): void {
  localStorage.setItem(PROMPTED_KEY, '1')
}

/**
 * Called when the user explicitly agrees to enable notifications.
 * Triggers the browser permission dialog, then registers the FCM token.
 */
export async function requestPermissionAndSave(uid: string): Promise<boolean> {
  dismissNotificationPrompt()
  if (!isFCMSupported()) return false
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false
    await registerAndSaveToken(uid)
    return true
  } catch (err) {
    console.warn('[FCM] requestPermissionAndSave failed:', err)
    return false
  }
}

/**
 * Silent refresh: if the user already granted permission (on a previous visit),
 * just ensure the token is current. Does NOT show any prompt.
 */
export async function refreshTokenIfGranted(uid: string): Promise<void> {
  if (!isFCMSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    await registerAndSaveToken(uid)
  } catch (err) {
    console.warn('[FCM] refreshTokenIfGranted failed:', err)
  }
}

/**
 * Listen for FCM messages while the app is in the foreground and show them
 * as toast notifications. Returns an unsubscribe function.
 */
export function setupForegroundListener(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {}

  try {
    const messaging = getMessaging(app)
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? '🏀 NBA Bets'
      const body  = payload.notification?.body  ?? ''
      toast(`${title}${body ? ` — ${body}` : ''}`)
    })
  } catch {
    return () => {}
  }
}
