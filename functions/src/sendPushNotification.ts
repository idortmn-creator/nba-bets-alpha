import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

const SUPER_ADMIN_UID = 'aPgbjXex6lbB7N4X5j62Y4qqECV2'
const CHUNK_SIZE = 500 // FCM multicast limit

export const sendPushNotification = functions.https.onCall(
  async (data: { title?: string; body?: string; targetTokens?: string[] }, context) => {
    if (context.auth?.uid !== SUPER_ADMIN_UID) {
      throw new functions.https.HttpsError('permission-denied', 'Super admin only')
    }

    const title = data?.title?.trim() ?? ''
    const body  = data?.body?.trim()  ?? ''

    if (!title || !body) {
      throw new functions.https.HttpsError('invalid-argument', 'title and body are required')
    }

    type TokenEntry = { token: string; uid: string }
    let entries: TokenEntry[]
    const isTargeted = Array.isArray(data.targetTokens) && data.targetTokens.length > 0

    if (isTargeted) {
      // Targeted send — use the provided tokens directly, no Firestore query needed.
      // Used for per-user nudges from the admin panel.
      entries = (data.targetTokens as string[])
        .filter(t => !!t)
        .map(token => ({ token, uid: '' }))
    } else {
      // Broadcast — collect all FCM tokens from the users collection
      const db = getFirestore()
      const snap = await db.collection('users').get()
      entries = snap.docs
        .map(d => ({ uid: d.id, token: (d.data().fcmToken as string | undefined) ?? '' }))
        .filter(e => !!e.token)
    }

    if (entries.length === 0) {
      return { sent: 0, failed: 0, total: 0 }
    }

    let sent = 0
    let failed = 0

    // Send in chunks of 500 (FCM multicast limit)
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE)
      const tokens = chunk.map(e => e.token)

      const result = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        webpush: {
          notification: { icon: '/icon.png', badge: '/icon.png' },
          fcmOptions: { link: '/' },
        },
      })

      sent   += result.successCount
      failed += result.failureCount

      // Clean up stale/invalid tokens — only for broadcast where we have UIDs
      if (!isTargeted) {
        const staleUids: string[] = []
        result.responses.forEach((resp, idx) => {
          const code = resp.error?.code ?? ''
          if (
            !resp.success &&
            (code === 'messaging/registration-token-not-registered' ||
             code === 'messaging/invalid-registration-token')
          ) {
            staleUids.push(chunk[idx].uid)
          }
        })

        if (staleUids.length > 0) {
          const db = getFirestore()
          await Promise.all(
            staleUids.map(uid =>
              db.collection('users').doc(uid).update({ fcmToken: null })
            )
          )
        }
      }
    }

    return { sent, failed, total: entries.length }
  }
)
