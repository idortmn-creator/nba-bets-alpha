import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCcemQInrgqkR28eNnDe0P-cJNnWBeNTJw',
  authDomain: 'nba-bets-2026.firebaseapp.com',
  projectId: 'nba-bets-2026',
  storageBucket: 'nba-bets-2026.firebasestorage.app',
  messagingSenderId: '543075338360',
  appId: '1:543075338360:web:f9c378431cbf4305ba858d',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'us-central1')
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
