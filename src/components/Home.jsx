import { useState } from 'react'
import { createRoom, joinRoom } from '../roomService'
import './Home.css'

export default function Home({ playerId, onEnterRoom, onViewCards }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return setError('Digite seu nome')
    setLoading(true); setError('')
    try {
      const code = await createRoom(playerId, name.trim())
      onEnterRoom(code)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Digite seu nome')
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return setError('Código deve ter 6 caracteres')
    setLoading(true); setError('')
    try {
      await joinRoom(code, playerId, name.trim())
      onEnterRoom(code)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function back() { setMode(null); setError('') }

  return (
    <div className="home-page">
      <div className="home-logo">
        <span className="home-logo__x">X</span>
        <span className="home-logo__men">MEN</span>
      </div>
      <h2 className="home-subtitle">CARD GAME</h2>
      <p className="home-tagline">Até 8 jogadores • Tempo real</p>

      <div className="home-card">
        <input
          className="home-input"
          type="text"
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          autoComplete="off"
        />

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

      <button className="home-cards-link" onClick={onViewCards}>
        🃏 Ver cartas dos personagens
      </button>
    </div>
  )
}
