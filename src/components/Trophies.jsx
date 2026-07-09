import { useState, useEffect } from 'react'
import { getAllUsers } from '../userService'
import { TROPHIES } from '../data/trophies'
import './Trophies.css'

const CATEGORY_LABELS = {
  wins:    '⚔️ Vitórias',
  villains:'☠️ Vilões',
  feats:   '⚡ Feitos',
  mission: '🎯 Missões',
}

export default function Trophies({ user, onBack }) {
  const [tab,     setTab]     = useState('mine')
  const [rankTab, setRankTab] = useState('wins')
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllUsers().then(all => { setUsers(all); setLoading(false) })
  }, [])

  const me = users.find(u => u.uid === user.uid)
  const myTrophies = me?.trophies || {}
  const myCount = Object.keys(myTrophies).length

  const trophyCount = u => u.trophies ? Object.keys(u.trophies).length : 0
  const wins        = u => u.stats?.totalWins || 0

  const byWins = [...users].sort((a, b) => {
    const d = wins(b) - wins(a)
    return d !== 0 ? d : trophyCount(b) - trophyCount(a)
  })

  const byTrophies = [...users].sort((a, b) => {
    const d = trophyCount(b) - trophyCount(a)
    return d !== 0 ? d : wins(b) - wins(a)
  })

  const champScore = u => wins(u) * 2 + trophyCount(u)
  const byChampion = [...users].sort((a, b) => champScore(b) - champScore(a))

  const ranked = rankTab === 'wins' ? byWins : rankTab === 'trophies' ? byTrophies : byChampion

  const categories = ['wins', 'villains', 'feats', 'mission']

  return (
    <div className="trophies-page">
      <div className="trophies-topbar">
        <button className="trophies-back" onClick={onBack}>← Voltar</button>
        <span className="trophies-topbar__title">🏆 Troféus</span>
        <span className="trophies-topbar__count">{myCount}/{TROPHIES.length}</span>
      </div>

      <div className="trophies-tabs">
        <button className={`trophies-tab ${tab === 'mine'    ? 'trophies-tab--active' : ''}`} onClick={() => setTab('mine')}>
          Meus Troféus
        </button>
        <button className={`trophies-tab ${tab === 'ranking' ? 'trophies-tab--active' : ''}`} onClick={() => setTab('ranking')}>
          Ranking Global
        </button>
      </div>

      {/* ── MY TROPHIES ── */}
      {tab === 'mine' && (
        <div className="trophies-content">
          {loading ? <p className="trophies-loading">Carregando…</p> : (
            categories.map(cat => (
              <div key={cat} className="trophy-section">
                <h3 className="trophy-section__label">{CATEGORY_LABELS[cat]}</h3>
                <div className="trophy-grid">
                  {TROPHIES.filter(t => t.category === cat).map(t => {
                    const earned = !!myTrophies[t.id]
                    return (
                      <div key={t.id} className={`trophy-card ${earned ? 'trophy-card--earned' : 'trophy-card--locked'}`}>
                        <span className="trophy-card__icon">{earned ? t.icon : '🔒'}</span>
                        <span className="trophy-card__name">{earned ? t.name : '???'}</span>
                        {t.category !== 'mission' && <span className="trophy-card__desc">{t.desc}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="trophies-content">
          <div className="rank-subtabs">
            <button className={`rank-subtab ${rankTab === 'wins'     ? 'rank-subtab--active' : ''}`} onClick={() => setRankTab('wins')}>
              ⚔️ Vitórias
            </button>
            <button className={`rank-subtab ${rankTab === 'trophies' ? 'rank-subtab--active' : ''}`} onClick={() => setRankTab('trophies')}>
              🏆 Troféus
            </button>
            <button className={`rank-subtab ${rankTab === 'champion' ? 'rank-subtab--active' : ''}`} onClick={() => setRankTab('champion')}>
              👑 Campeões
            </button>
          </div>

          {loading ? <p className="trophies-loading">Carregando…</p> : (
            <div className="ranking-list">
              {ranked.map((u, i) => {
                const tc   = trophyCount(u)
                const w    = wins(u)
                const sc   = champScore(u)
                const isMe = u.uid === user.uid
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

                const primary = rankTab === 'wins'     ? `⚔️ ${w}`
                              : rankTab === 'trophies' ? `🏆 ${tc}`
                              :                          `👑 ${sc}`

                const secondary = rankTab === 'wins'
                  ? `🏆 ${tc} troféu${tc !== 1 ? 's' : ''}`
                  : rankTab === 'trophies'
                  ? `⚔️ ${w} vitória${w !== 1 ? 's' : ''}`
                  : `⚔️ ${w} vitória${w !== 1 ? 's' : ''} · 🏆 ${tc} troféu${tc !== 1 ? 's' : ''}`

                return (
                  <div key={u.uid} className={`rank-row ${isMe ? 'rank-row--me' : ''}`}>
                    <span className="rank-row__pos">
                      {medal ?? <span className="rank-row__num">{i + 1}</span>}
                    </span>
                    <div className="rank-row__info">
                      <span className="rank-row__name">
                        {u.username}
                        {isMe && <span className="rank-row__you"> você</span>}
                      </span>
                      <span className="rank-row__stats">{secondary}</span>
                    </div>
                    <span className="rank-row__trophies">{primary}</span>
                  </div>
                )
              })}
              {ranked.length === 0 && (
                <p className="trophies-empty">Nenhum jogador ainda.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
