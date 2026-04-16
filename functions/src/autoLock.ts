/**
 * processAutoLocks — runs every minute via Cloud Scheduler.
 *
 * Reads global/settings.autoLocks, applies any locks whose timestamp has
 * passed, and removes the processed entries. Runs server-side so it fires
 * reliably regardless of whether any browser tab is open.
 *
 * autoLocks key formats (set by AutoLockPanel):
 *   series_{stageKey}_{matchKey}  →  lock a single series
 *   {stageKey}                    →  lock a whole stage + all its series
 *
 * All timestamps are Unix milliseconds (UTC). No timezone conversion needed
 * — Date.now() and stored timestamps are both UTC ms.
 */

import * as functions from 'firebase-functions'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { STAGE_KEYS, STAGE_MATCH_KEYS } from './constants'
import type { StageKey } from './constants'

export const processAutoLocks = functions.pubsub
  .schedule('* * * * *')   // every minute
  .timeZone('UTC')
  .onRun(async () => {
    const db = getFirestore()
    const settingsRef = db.doc('global/settings')

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(settingsRef)
      if (!snap.exists) return

      const data = snap.data() as {
        autoLocks?: Record<string, number>
        seriesLocked?: Record<string, boolean>
        stageLocked?: boolean[]
      }

      const autoLocks = data.autoLocks || {}
      const now = Date.now()

      // Collect entries whose trigger time has passed
      const due = Object.entries(autoLocks).filter(
        ([, ts]) => typeof ts === 'number' && ts <= now,
      )
      if (due.length === 0) return

      // Build a single atomic update object
      const updates: Record<string, unknown> = {}
      const seriesLocked = data.seriesLocked || {}
      const stageLocked  = [...(data.stageLocked || [false, false, false, false, false, false])]
      while (stageLocked.length < 6) stageLocked.push(false)
      let stageArrayChanged = false

      for (const [key] of due) {
        // Always delete the autoLock entry (idempotent even if lock was already set)
        updates[`autoLocks.${key}`] = FieldValue.delete()

        if (key.startsWith('series_')) {
          // ── Series lock ──────────────────────────────────────────────────
          const parts = key.split('_')
          // key = "series_0b_e_final"  →  parts = ["series","0b","e","final"]
          // key = "series_1_e1"        →  parts = ["series","1","e1"]
          const si = parts[1] === '0b' ? '0b' : parts[1]
          const mk = parts.slice(2).join('_')
          const lockKey = `${si}_${mk}`

          if (!seriesLocked[lockKey]) {
            updates[`seriesLocked.${lockKey}`] = true
            console.log(`processAutoLocks: locked series ${lockKey}`)
          } else {
            console.log(`processAutoLocks: series ${lockKey} already locked — removed stale entry`)
          }
        } else {
          // ── Stage lock ───────────────────────────────────────────────────
          const normKey: StageKey = key === '0b' ? '0b' : (parseInt(key) as StageKey)
          const sIdx = STAGE_KEYS.indexOf(normKey)
          if (sIdx < 0) {
            console.warn(`processAutoLocks: unknown stage key "${key}" — skipping`)
            continue
          }

          if (!stageLocked[sIdx]) {
            stageLocked[sIdx] = true
            stageArrayChanged = true
            // Lock all individual series within this stage too
            for (const mk of (STAGE_MATCH_KEYS[normKey] || [])) {
              const lockKey = `${normKey}_${mk}`
              updates[`seriesLocked.${lockKey}`] = true
            }
            console.log(`processAutoLocks: locked stage ${key} + its series`)
          } else {
            console.log(`processAutoLocks: stage ${key} already locked — removed stale entry`)
          }
        }
      }

      // stageLocked is an array — must be written as a whole field,
      // not as dot-notation (Firestore doesn't support array index updates via dot-notation)
      if (stageArrayChanged) {
        updates['stageLocked'] = stageLocked
      }

      tx.update(settingsRef, updates)
      console.log(`processAutoLocks: processed ${due.length} due lock(s)`)
    })
  })
