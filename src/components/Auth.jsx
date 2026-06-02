import { useState } from 'react'
import { register, login } from '../userService'
import { db } from '../firebase'
import './Auth.css'

export default function Auth({ onAuth }) {
  const [mode,     setMode]     = useState('login')  // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!db) return setError('Firebase não configurado')
    setError(''); setLoading(true)
    try {
      if (mode === 'register') {
        if (password !== confirm) throw new Error('As senhas não coincidem')
        const user = await register(username, password)
        onAuth(user)
      } else {
        const user = await login(username, password)
        onAuth(user)
      }
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
        ? 'Username ou senha incorretos'
        : err.code === 'auth/too-many-requests'
        ? 'Muitas tentativas — tente mais tarde'
        : err.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m); setError(''); setUsername(''); setPassword(''); setConfirm('')
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <span className="auth-logo__x">X</span>
        <span className="auth-logo__men">MEN</span>
      </div>
      <h2 className="auth-subtitle">CARD GAME</h2>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Entrar
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Cadastrar
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={20}
            autoComplete="username"
            spellCheck={false}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            maxLength={64}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
          {mode === 'register' && (
            <input
              className="auth-input"
              type="password"
              placeholder="Confirmar senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              maxLength={64}
              autoComplete="new-password"
            />
          )}

          {error && <p className="auth-error">⚠ {error}</p>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading
              ? (mode === 'register' ? 'Criando conta...' : 'Entrando...')
              : (mode === 'register' ? '⊕ Criar conta' : '→ Entrar')
            }
          </button>
        </form>
      </div>
    </div>
  )
}
