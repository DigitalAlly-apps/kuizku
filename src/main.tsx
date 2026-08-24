import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { migrateLegacyBrandStorage } from './lib/brandMigration.ts'
import './utils/studentSubmissionSafety.ts'
import './styles/global.css'
import './styles/components.css'
import './styles/teacher-mobile-pro.css'

migrateLegacyBrandStorage()

// PWA tetap diregistrasikan segera agar build terbaru cepat diketahui browser.
registerSW({ immediate: true })

// Setelah deploy baru, tab/PWA lama kadang masih menunjuk ke JS/CSS chunk
// yang sudah tidak tersedia di Vercel. Reload biasa tidak selalu cukup karena
// service worker atau Cache API masih dapat menyajikan asset versi lama.
// Pola recovery ini mengikuti implementasi yang sudah dipakai di EduTrack:
// unregister service worker, bersihkan Cache API, lalu reload satu kali.
const isStaleAssetError = (value: unknown) => {
  const message = value instanceof Error ? value.message : String(value ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|CSS chunk|stylesheet|vite:preloadError|Cannot read properties of undefined \(reading ['"]default['"]\)/i.test(message)
}

const recoverFromStaleAssets = async () => {
  if (!navigator.onLine) return

  const key = 'kuizku_asset_recovery'
  if (sessionStorage.getItem(key) === '1') return
  sessionStorage.setItem(key, '1')

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations ?? []).map(registration => registration.unregister()))
  } catch {
    // Tetap lanjut reload walau cleanup service worker gagal.
  }

  try {
    const names = await caches.keys()
    await Promise.all(names.map(name => caches.delete(name)))
  } catch {
    // Cache API dapat tidak tersedia pada browser/private mode tertentu.
  }

  window.location.reload()
}

window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  void recoverFromStaleAssets()
})

window.addEventListener('error', event => {
  const target = event.target as HTMLElement | null
  const isAssetElement = target?.tagName === 'SCRIPT' || target?.tagName === 'LINK'
  if (isAssetElement || isStaleAssetError(event.error || event.message)) {
    void recoverFromStaleAssets()
  }
}, true)

window.addEventListener('unhandledrejection', event => {
  if (isStaleAssetError(event.reason)) {
    event.preventDefault()
    void recoverFromStaleAssets()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)