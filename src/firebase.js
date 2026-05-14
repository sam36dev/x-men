import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

export let db = null

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL

if (apiKey && databaseURL) {
  try {
    const app = initializeApp({
      apiKey,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    })
    db = getDatabase(app)
  } catch (e) {
    console.warn('Firebase não configurado:', e.message)
  }
}

// Player ID persists per browser session (no login needed)
export function getPlayerId() {
  let id = sessionStorage.getItem('xmen_pid')
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('xmen_pid', id)
  }
  return id
}
