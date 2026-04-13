import { defineSecret } from 'firebase-functions/params'

// Provision once with: firebase functions:secrets:set RAPIDAPI_KEY
export const RAPIDAPI_KEY = defineSecret('RAPIDAPI_KEY')
