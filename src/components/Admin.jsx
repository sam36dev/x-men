import { useState, useEffect } from 'react'
import { getAllUsers, awardTrophyTo, revokeTrophy, logout } from '../userService'
import { TROPHIES } from '../data/trophies'
import './Admin.css'

const CATEGORY_LABELS = {
  feats:   '⚡ Feitos',
  mission: '🎯 Missões',
  villains:'☠️ Vilões',
  wins:    '⚔️ Vitórias',
  special: '🃏 Especiais',
}
const CATEGORIES = ['feats', 'mission', 'villains', 'wins', 'special']

export default function Admin({ user }) {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [openUid,    setOpenUid]    = useState(null)
  const [busy,       setBusy]       = useState({}) // trophyId → true while pending
  const [flash,      setFlash]      = useState({}) // trophyId → 'added'|'removed'

  useEffect(() => { reload() }, [])

  async function reload() {
    setLoading(true)
    const all = await getAllUsers()
    setUsers(all.sort((a, b) => (a.username || '').localeCompare(b.username || '')))
    setLoading(false)
  }

  function toggleUser(uid) {
    setOpenUid(prev => prev === uid ? null : uid)
    setFlash({})
  }

  async function toggle(targetUid, trophyId, has) {
    setBusy(prev => ({ ...prev, [trophyId]: true }))
    if (has) {
      await revokeTrophy(targetUid, trophyId)
    } else {
      await awardTrophyTo(targetUid, trophyId)
    }
    // Optimistically update local state
    setUsers(prev => prev.map(u => {
      if (u.uid !== targetUid) return u
      const trophies = { ...(u.trophies || {}) }
      if (has) delete trophies[trophyId]
      else trophies[trophyId] = Date.now()
      return { ...u, trophies }
    }))
    setFlash(prev => ({ ...prev, [trophyId]: has ? 'removed' : 'added' }))
    setTimeout(() => setFlash(prev => { const n = { ...prev }; delete n[trophyId]; return n }), 1500)
    setBusy(prev => { const n = { ...prev }; delete n[trophyId]; return n })
  }

  const openUser = users.find(u => u.uid === openUid)

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
          <button className="admin-refresh" onClick={reload}>↻</button>
        </div>

        {loading ? (
          <p className="admin-loading">Carregando…</p>
        ) : (
          <div className="admin-player-list">
            {users.map(u => {
              const tc    = u.trophies ? Object.keys(u.trophies).length : 0
              const isOpen = openUid === u.uid
              return (
                <div key={u.uid} className={`admin-player ${isOpen ? 'admin-player--open' : ''}`}>
                  {/* Row */}
                  <button className="admin-player__row" onClick={() => toggleUser(u.uid)}>
                    <div className="admin-player__info">
                      <span className="admin-player__name">{u.username}</span>
                      <span className="admin-player__stats">
                        🏆 {tc} · ⚔️ {u.stats?.totalWins ?? 0}
                      </span>
                    </div>
                    <span className="admin-player__chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {/* Trophy drawer */}
                  {isOpen && (
                    <div className="admin-trophy-drawer">
                      {CATEGORIES.map(cat => {
                        const list = TROPHIES.filter(t => t.category === cat)
                        if (!list.length) return null
                        return (
                          <div key={cat} className="admin-trophy-cat">
                            <span className="admin-trophy-cat__label">{CATEGORY_LABELS[cat]}</span>
                            <div className="admin-trophy-grid">
                              {list.map(t => {
                                const has  = !!u.trophies?.[t.id]
                                const pend = !!busy[t.id]
                                const fl   = flash[t.id]
                                return (
                                  <button
                                    key={t.id}
                                    className={`admin-trophy-btn ${has ? 'admin-trophy-btn--on' : 'admin-trophy-btn--off'} ${fl ? `admin-trophy-btn--flash-${fl}` : ''}`}
                                    onClick={() => !pend && toggle(u.uid, t.id, has)}
                                    disabled={pend}
                                    title={t.name}
                                  >
                                    <span className="admin-trophy-btn__icon">{t.icon}</span>
                                    <span className="admin-trophy-btn__name">{t.name}</span>
                                    <span className="admin-trophy-btn__status">
                                      {pend ? '…' : has ? '✓' : '+'}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {users.length === 0 && <p className="admin-empty">Nenhum jogador cadastrado.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
