/**
 * Thin wrapper around the Screen Wake Lock API.
 *
 * Browsers automatically release a wake lock when the page is hidden, so we
 * track intent (`want`) and re-acquire on the next visibility regain. No-ops
 * gracefully where the API is unsupported (e.g. older Safari).
 */

let sentinel = null
let want     = false

export async function acquireWakeLock() {
  want = true
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => { sentinel = null })
  } catch { /* request can reject (e.g. low battery, not visible) — ignore */ }
}

export function releaseWakeLock() {
  want = false
  const s = sentinel
  sentinel = null
  if (s) s.release().catch(() => {})
}

// Re-acquire when the tab becomes visible again, if we still want the lock.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (want && document.visibilityState === 'visible' && !sentinel) acquireWakeLock()
  })
}
