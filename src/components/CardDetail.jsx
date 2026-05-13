import { useState, useEffect } from 'react'
import DiceRoller from './DiceRoller'
import './CardDetail.css'

export default function CardDetail({ character: char, onBack }) {
  const [imgError, setImgError] = useState(false)
  const [visible, setVisible] = useState(false)
  const [hp, setHp] = useState(100)
  const [dmgFlash, setDmgFlash] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  function handleDamageTaken(damage) {
    setHp(prev => Math.max(0, prev - damage))
    setDmgFlash(true)
    setTimeout(() => setDmgFlash(false), 600)
  }

  const teamColor =
    char.team === 'Brotherhood' ? '#CC44FF'
    : char.team === 'X-Force' ? '#FF2222'
    : '#FFD700'

  return (
    <div className={`detail-page ${visible ? 'detail-page--visible' : ''}`}>
      <div className="detail-topbar">
        <button className="back-btn" onClick={onBack} aria-label="Voltar">
          ← Voltar
        </button>
        <span className="detail-topbar__brand">
          <span className="detail-topbar__x">X</span>MEN
        </span>
        <span className="detail-topbar__num">#{char.number}</span>
      </div>

      <div className="card-wrap">
        <div className="trading-card" style={{ background: char.gradient }}>
          {/* Shimmer overlay */}
          <div className="card-shimmer" />

          {/* Top bar */}
          <div className="card-topbar">
            <span className="card-type-badge" style={{ color: char.color }}>
              {char.typeIcon} {char.type}
            </span>
            <span className="card-num">#{char.number}</span>
          </div>

          {/* Image area */}
          <div className="card-img-area">
            {!imgError ? (
              <img
                src={char.image}
                alt={char.name}
                className="card-img"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="card-img-fallback" style={{ color: char.color }}>
                <span className="card-img-fallback__letter">{char.name.charAt(0)}</span>
                <div
                  className="card-img-fallback__glow"
                  style={{ background: char.color }}
                />
              </div>
            )}
            <div className="card-img-vignette" />
          </div>

          {/* Name section */}
          <div className="card-name-section" style={{ borderColor: char.color + '55' }}>
            <h2 className="card-name" style={{ color: char.color }}>
              {char.name}
            </h2>
            <p className="card-alias">"{char.alias}"</p>
            <span className="card-team" style={{ color: teamColor }}>
              ● {char.team}
            </span>
          </div>

          {/* HP section */}
          <div className={`card-section ${dmgFlash ? 'card-section--flash' : ''}`}>
            <div className="card-section__header">
              <span>❤️</span>
              <span>PONTOS DE VIDA</span>
              <span className="card-hp-value" style={{ color: hp < 30 ? '#ff4444' : hp < 60 ? '#ffaa00' : '#ff6666' }}>
                {hp} / 100
              </span>
            </div>
            <div className="hp-bar-track">
              <div
                className="hp-bar-fill"
                style={{
                  width: `${hp}%`,
                  background: hp < 30
                    ? 'linear-gradient(90deg, #aa0000, #ff4444)'
                    : hp < 60
                    ? 'linear-gradient(90deg, #aa6600, #ffaa00)'
                    : 'linear-gradient(90deg, #ff4d4d, #ff8888)'
                }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="card-divider" style={{ background: char.color + '44' }} />

          {/* Powers section */}
          <div className="card-section">
            <div className="card-section__header">
              <span>⚡</span>
              <span>PODERES</span>
            </div>
            <ul className="powers-list">
              {char.powers.map((p, i) => (
                <li key={i} className="powers-list__item">
                  <span className="powers-list__dot" style={{ background: char.color }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Divider */}
          <div className="card-divider" style={{ background: char.color + '44' }} />

          {/* Dice section */}
          <div className="card-section card-section--dice">
            <DiceRoller
              diceType={char.diceType}
              accentColor={char.color}
              onDamageTaken={handleDamageTaken}
            />
          </div>

          {/* Card border glow */}
          <div
            className="card-border-glow"
            style={{ '--glow': char.color }}
          />
        </div>
      </div>
    </div>
  )
}
