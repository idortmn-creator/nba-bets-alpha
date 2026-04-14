// FCM background message service worker
// Must be at root /firebase-messaging-sw.js for FCM to discover it
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCcemQInrgqkR28eNnDe0P-cJNnWBeNTJw',
  authDomain: 'nba-bets-2026.firebaseapp.com',
  projectId: 'nba-bets-2026',
  storageBucket: 'nba-bets-2026.firebasestorage.app',
  messagingSenderId: '543075338360',
  appId: '1:543075338360:web:f9c378431cbf4305ba858d',
})

const messaging = firebase.messaging()

// Show notification when app is in background/closed
messaging.onBackgroundMessage((payload) => {
  const { title = '🏀 NBA Bets', body = '' } = payload.notification ?? {}
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'nba-bets-push',
    renotify: true,
    data: payload.data ?? {},
  })
})

// Open/focus app when user clicks the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})
