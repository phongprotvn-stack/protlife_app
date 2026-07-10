import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProvider } from './contexts/AppContext'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// ─── Force PWA update: kill old SW + clear caches ───
;(async function killOldSW() {
  // Unregister ALL service workers immediately
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    for (const reg of regs) await reg.unregister()
  }
  // Wipe all caches from previous builds
  if ('caches' in window) {
    const keys = await caches.keys()
    for (const key of keys) await caches.delete(key)
  }
  // Clear stale localStorage keys (corrupt/old data)
  const staleKeys = [
    'protlife_sync_sources',
  ]
  for (const k of staleKeys) localStorage.removeItem(k)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
