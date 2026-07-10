import { useState, useEffect } from 'react'
import { createRoom, joinRoom } from '../roomService'
import { getUserProfile, onFirstGame } from '../userService'
import { db } from '../firebase'
import { TROPHIES } from '../data/trophies'
import './Home.css'

export default function Home({ playerId, playerName, user, onLogout, onEnterRoom, onViewCards, onViewTrophies }) {
  const [mode,      setMode]      = useState(null) // 'create' | 'join'
  const [joinCode,  setJoinCode]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [profile,   setProfile]   = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    getUserProfile(user.uid).then(setProfile)
    onFirstGame(user.uid)
  }, [user?.uid])

  const trophyCount = profile?.trophies ? Object.keys(profile.trophies).length : 0
  const totalTrophies = TROPHIES.length

  async function handleCreate() {
    if (!db) return setError('Firebase não configurado — veja o README')
    setLoading(true); setError('')
    try {
      const code = await createRoom(playerId, playerName)
      onEnterRoom(code)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function handleJoin() {
    if (!db) return setError('Firebase não configurado — veja o README')
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return setError('Código deve ter 6 caracteres')
    setLoading(true); setError('')
    try {
      await joinRoom(code, playerId, playerName)
      onEnterRoom(code)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  function back() { setMode(null); setError('') }

  return (
    <div className="home-page">
      {/* User header */}
      <div className="home-user">
        <div className="home-user__info">
          <span className="home-user__name">{playerName}</span>
          <span className="home-user__trophies">🏆 {trophyCount}/{totalTrophies}</span>
        </div>
        <button className="home-user__logout" onClick={onLogout} title="Sair">
          ⎋ Sair
        </button>
      </div>

      <div className="home-logo">
        <span className="home-logo__x">X</span>
        <span className="home-logo__men">MEN</span>
      </div>
      <h2 className="home-subtitle">CARD GAME</h2>
      <p className="home-tagline">Até 8 jogadores • Tempo real</p>

      <div className="home-card">
        {!mode && (
          <div className="home-actions">
            <button className="home-btn home-btn--primary" onClick={() => setMode('create')}>
              ⊕ Criar Sala
            </button>
            <button className="home-btn home-btn--secondary" onClick={() => setMode('join')}>
              → Entrar na Sala
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="home-actions">
            <p className="home-hint">Uma sala será criada e você receberá o código para compartilhar.</p>
            <button className="home-btn home-btn--primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Criando...' : '⊕ Criar Sala'}
            </button>
            <button className="home-btn home-btn--ghost" onClick={back}>← Voltar</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="home-actions">
            <input
              className="home-input home-input--code"
              type="text"
              placeholder="CÓDIGO DA SALA"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
            />
            <button className="home-btn home-btn--secondary" onClick={handleJoin} disabled={loading}>
              {loading ? 'Entrando...' : '→ Entrar'}
            </button>
            <button className="home-btn home-btn--ghost" onClick={back}>← Voltar</button>
          </div>
        )}

        {error && <p className="home-error">⚠ {error}</p>}
      </div>

      <div className="home-links">
        <button className="home-btn home-btn--trophies" onClick={onViewTrophies}>
          🏆 Ver troféus e ranking
        </button>
      </div>
    </div>
  )
}
