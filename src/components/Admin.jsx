import { useState, useEffect } from 'react'
import { getAllUsers, awardTrophyTo, logout } from '../userService'
import './Admin.css'

const MANUAL_TROPHIES = [
  { id: 'gambit_game', icon: '🃏', name: 'Gambit Game' },
]

export default function Admin({ user }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [feedback, setFeedback] = useState({}) // uid → message

  useEffect(() => {
    reload()
  }, [])

  async function reload() {
    setLoading(true)
    const all = await getAllUsers()
    setUsers(all.sort((a, b) => (a.username || '').localeCompare(b.username || '')))
    setLoading(false)
  }

  async function award(targetUid, targetName, trophyId, trophyName) {
    const key = `${targetUid}_${trophyId}`
    setFeedback(prev => ({ ...prev, [key]: '…' }))
    const granted = await awardTrophyTo(targetUid, trophyId)
    setFeedback(prev => ({ ...prev, [key]: granted ? `✅ ${trophyName} dado para ${targetName}!` : `⚠ ${targetName} já tem esse troféu` }))
    if (granted) reload()
    setTimeout(() => setFeedback(prev => { const n = { ...prev }; delete n[key]; return n }), 3000)
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <span className="admin-topbar__title">⚙️ Painel Admin</span>
        <span className="admin-topbar__user">{user.displayName}</span>
        <button className="admin-logout" onClick={logout}>Sair</button>
      </div>

      <div className="admin-content">
        <div className="admin-section-header">
          <h2 className="admin-section-title">Jogadores</h2>
          <button className="admin-refresh" onClick={reload}>↻ Atualizar</button>
        </div>

        {loading ? (
          <p className="admin-loading">Carregando…</p>
        ) : (
          <div className="admin-player-list">
            {users.map(u => (
              <div key={u.uid} className="admin-player">
                <div className="admin-player__info">
                  <span className="admin-player__name">{u.username}</span>
                  <span className="admin-player__stats">
                    🏆 {u.trophies ? Object.keys(u.trophies).length : 0} troféus
                    {' · '}⚔️ {u.stats?.totalWins ?? 0} vitórias
                  </span>
                </div>
                <div className="admin-player__actions">
                  {MANUAL_TROPHIES.map(t => {
                    const has = !!u.trophies?.[t.id]
                    const key = `${u.uid}_${t.id}`
                    return (
                      <div key={t.id} className="admin-trophy-action">
                        <button
                          className={`admin-award-btn ${has ? 'admin-award-btn--done' : ''}`}
                          onClick={() => !has && award(u.uid, u.username, t.id, t.name)}
                          disabled={has}
                        >
                          {t.icon} {has ? `${t.name} ✓` : `Dar ${t.name}`}
                        </button>
                        {feedback[key] && <span className="admin-feedback">{feedback[key]}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="admin-empty">Nenhum jogador cadastrado.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
