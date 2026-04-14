import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc } from 'firebase/firestore'
import { app, db } from '@/lib/firebase'
import { toast } from 'sonner'

// ── Replace this with your VAPID public key from:
//    Firebase Console → Project Settings → Cloud Messaging
//    → Web Push certificates → Generate key pair
const VAPID_KEY = 'REPLACE_WITH_YOUR_VAPID_KEY'

let _initialized = false

/**
 * Request notification permission, obtain an FCM token, and persist it to
 * the user's Firestore document. Safe to call on every app load — it's a
 * no-op when already granted and the token hasn't changed.
 */
export async function initMessaging(uid: string): Promise<void> {
  if (_initialized) return
  _initialized = true

  // Feature-detect — not available in old browsers or SSR
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (!('serviceWorker' in navigator)) return
  if (VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') {
    console.warn('[FCM] VAPID key not set — skipping push notification setup')
    return
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    // Register the FCM service worker explicitly so we control the scope
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    })

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (token) {
      await updateDoc(doc(db, 'users', uid), { fcmToken: token })
    }
  } catch (err) {
    // Non-fatal — user simply won't receive push notifications
    console.warn('[FCM] setup failed:', err)
  }
}

/**
 * Listen for FCM messages while the app is in the foreground and show them
 * as toast notifications. Returns an unsubscribe function.
 */
export function setupForegroundListener(): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => {}
  if (VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') return () => {}

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
