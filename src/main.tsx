import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { migrateLegacyBrandStorage } from './lib/brandMigration.ts'
import './styles/global.css'
import './styles/components.css'
import './styles/teacher-mobile-pro.css'

migrateLegacyBrandStorage()

// Pastikan PWA yang masih membuka bundle lama langsung memuat bundle baru
// setelah service worker baru aktif. Ini mencegah error lazy-import ketika
// file asset versi sebelumnya sudah tidak tersedia setelah deploy Vercel.
registerSW({ immediate: true })

const chunkRecoveryKey = 'kuizku_pwa_chunk_recovery_attempted'
const reloadAfterChunkError = () => {
  if (!navigator.onLine || sessionStorage.getItem(chunkRecoveryKey)) return
  sessionStorage.setItem(chunkRecoveryKey, '1')
  window.location.reload()
}

window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  reloadAfterChunkError()
})

window.addEventListener('unhandledrejection', event => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
  if (/failed to fetch dynamically imported module|importing a module script failed|cannot read properties of undefined \(reading ['"]default['"]\)/i.test(message)) {
    event.preventDefault()
    reloadAfterChunkError()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
