import { useState, useEffect } from 'react'

type Platform = 'android' | 'ios' | null

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  const isAndroid = /android/i.test(ua)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  if (isStandalone) return null
  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return null
}

const DISMISSED_KEY = 'pwa-prompt-dismissed'

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return

    const p = detectPlatform()
    setPlatform(p)

    if (p === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (e: any) => {
        e.preventDefault()
        setDeferredPrompt(e)
        setVisible(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    } else if (p === 'ios') {
      const timer = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
    setShowIOSSteps(false)
  }

  async function handleAndroidInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    dismiss()
  }

  if (!visible) return null

  /* ── Android banner ── */
  if (platform === 'android') {
    return (
      <div className="install-banner">
        <span className="install-banner-text">📲 הוסף לדף הבית כאפליקציה</span>
        <div className="install-banner-actions">
          <button className="install-btn install-btn-primary" onClick={handleAndroidInstall}>התקן</button>
          <button className="install-btn install-btn-dismiss" onClick={dismiss}>✕</button>
        </div>
      </div>
    )
  }

  /* ── iOS prompt ── */
  if (platform === 'ios') {
    if (showIOSSteps) {
      return (
        <div className="install-modal-overlay" onClick={dismiss}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-title">📲 הוספה למסך הבית</div>
            <ol className="install-steps">
              <li>לחץ על כפתור השיתוף <strong>⎋</strong> בתחתית Safari</li>
              <li>גלול למטה ובחר <strong>"הוסף למסך הבית"</strong></li>
              <li>לחץ <strong>"הוסף"</strong> בפינה הימנית עליונה</li>
            </ol>
            <button className="install-btn install-btn-primary install-btn-full" onClick={dismiss}>הבנתי</button>
          </div>
        </div>
      )
    }

    return (
      <div className="install-banner">
        <span className="install-banner-text">📲 להוסיף קיצור דרך למסך הבית?</span>
        <div className="install-banner-actions">
          <button className="install-btn install-btn-primary" onClick={() => setShowIOSSteps(true)}>כן</button>
          <button className="install-btn install-btn-secondary" onClick={dismiss}>לא</button>
        </div>
      </div>
    )
  }

  return null
}
