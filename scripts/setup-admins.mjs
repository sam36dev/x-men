import { readFileSync } from 'fs'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, get } from 'firebase/database'

// Read .env file
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const API_KEY = env.VITE_FIREBASE_API_KEY

const app = initializeApp({
  apiKey:            API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       env.VITE_FIREBASE_DATABASE_URL,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
})

const db = getDatabase(app)

const toEmail = (u) => `${u.toLowerCase().replace(/[^a-z0-9_]/g, '')}@xmen.game`

async function signUp(email, password, displayName) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (data.error) throw Object.assign(new Error(data.error.message), { code: data.error.message })
  return data
}

async function createAdmin(username, password) {
  const email = toEmail(username)
  try {
    const data = await signUp(email, password, username)
    const uid = data.localId

    await set(ref(db, `users/${uid}`), {
      username,
      isAdmin: true,
      createdAt: Date.now(),
      stats: { totalWins: 0, totalGames: 0, villainsDefeated: 0 },
    })
    console.log(`✅ Admin criado: ${username} (uid: ${uid})`)
  } catch (e) {
    if (e.code === 'EMAIL_EXISTS') {
      console.log(`⚠  Já existe: ${username}`)
    } else {
      console.error(`❌ Erro ao criar ${username}:`, e.message)
    }
  }
}

await createAdmin('admin.fernanda', 'admin123')
await createAdmin('admin.caio',     'admin123')

console.log('\nConcluído.')
process.exit(0)
