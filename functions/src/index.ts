// Firebase Admin SDK must be initialized before any function module is imported.
import { initializeApp } from 'firebase-admin/app'
initializeApp()

// Export all Cloud Functions (these are what Firebase deploys)
export { syncTeams } from './syncTeams'
export { syncResults, scheduledNBASync } from './syncResults'
export { getLiveGames } from './liveGames'
export { sendPushNotification } from './sendPushNotification'
