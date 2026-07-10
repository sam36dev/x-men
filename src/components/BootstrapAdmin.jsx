import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { ref, set, get } from 'firebase/database'
import { auth, db } from '../firebase'

const ADMINS = [
  { username: 'admin.fernanda', password: 'admin123' },
  { username: 'admin.caio',     password: 'admin123' },
]

const toEmail = (u) => `${u.toLowerCase().replace(/[^a-z0-9_]/g, '')}@xmen.game`

export default function BootstrapAdmin() {
  const [log,  setLog]  = useState([])
  const [done, setDone] = useState(false)

  async function run() {
    const lines = []
    for (const { username, password } of ADMINS) {
      const email = toEmail(username)
      try {
        // Check if already in DB (by checking auth)
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName: username })
        await set(ref(db, `users/${user.uid}`), {
          username,
          isAdmin: true,
          createdAt: Date.now(),
          stats: { totalWins: 0, totalGames: 0, villainsDefeated: 0 },
        })
        lines.push(`✅ Criado: ${username}`)
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          lines.push(`⚠ Já existe: ${username}`)
        } else {
          lines.push(`❌ Erro ${username}: ${e.message}`)
        }
      }
    }
    setLog(lines)
    setDone(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#07111a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
      <p style={{ fontFamily: 'Oswald, sans-serif', color: '#FFCC00', fontSize: '1rem', letterSpacing: '0.1em' }}>
        SETUP — Criar contas admin
      </p>
      {!done && (
        <button
          onClick={run}
          style={{ background: '#FFCC00', color: '#000', border: 'none', borderRadius: '8px', padding: '0.8rem 2rem', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.08em' }}
        >
          Criar admins
        </button>
      )}
      {log.map((l, i) => (
        <p key={i} style={{ fontFamily: 'monospace', color: '#ccc', fontSize: '0.9rem', margin: 0 }}>{l}</p>
      ))}
      {done && <p style={{ fontFamily: 'Oswald, sans-serif', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Concluído. Pode fechar esta página.</p>}
    </div>
  )
}
