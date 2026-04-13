// Firebase Admin SDK must be initialized before any function module is imported.
import { initializeApp } from 'firebase-admin/app'
initializeApp()

// Re-export the secret so it can be imported by function modules
export { RAPIDAPI_KEY } from './secrets'

// Export all Cloud Functions (these are what Firebase deploys)
export { syncTeams } from './syncTeams'
export { syncResults, scheduledNBASync } from './syncResults'
