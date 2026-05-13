import { useState } from 'react'
import { characters } from '../data/characters'
import './CharacterGrid.css'

function MiniCard({ char, onClick }) {
  const [imgError, setImgError] = useState(false)
  const [flipped, setFlipped] = useState(false)

  function handleClick() {
    if (flipped) return
    setFlipped(true)
    setTimeout(() => onClick(char), 500)
  }

  const teamColor = char.team === 'Brotherhood' ? '#CC44FF' : char.team === 'X-Force' ? '#FF2222' : '#FFD700'

  return (
    <div
      className={`mini-card-scene ${flipped ? 'mini-card-scene--flipped' : ''}`}
      onClick={handleClick}
      role="button"
      aria-label={`Selecionar ${char.name}`}
    >
      <div className="mini-card-inner">
        <div className="mini-card mini-card--back">
          <div className="mini-card__xlogo">X</div>
          <div className="mini-card__xtext">MEN</div>
        </div>

        <div className="mini-card mini-card--front" style={{ background: char.gradient }}>
          <div className="mini-card__img-wrap">
            {!imgError ? (
              <img
                src={char.image}
                alt={char.name}
                onError={() => setImgError(true)}
                className="mini-card__img"
              />
            ) : (
              <div className="mini-card__fallback" style={{ color: char.color }}>
                {char.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="mini-card__info">
            <span className="mini-card__name">{char.name}</span>
            <span className="mini-card__team" style={{ color: teamColor }}>
              {char.team}
            </span>
          </div>
          <div className="mini-card__glow" style={{ '--glow-color': char.color }} />
        </div>
      </div>
    </div>
  )
}

export default function CharacterGrid({ onSelect, onBack }) {
  return (
    <div className="grid-page">
      <header className="grid-header">
        {onBack && (
          <button onClick={onBack} style={{ position:'absolute', left:'1rem', top:'1.2rem', background:'none', border:'none', color:'rgba(255,215,0,0.7)', fontFamily:"'Oswald',sans-serif", fontSize:'0.85rem', fontWeight:600, cursor:'pointer', letterSpacing:'0.05em' }}>
            ← Voltar
          </button>
        )}
        <div className="grid-header__logo">
          <span className="grid-header__x">X</span>
          <span className="grid-header__men">MEN</span>
        </div>
        <h1 className="grid-header__title">CARD GAME</h1>
        <p className="grid-header__sub">Escolha seu personagem</p>
      </header>

      <div className="grid-hint">
        <span>🃏</span> Toque na carta para revelar
      </div>

      <div className="character-grid">
        {characters.map(char => (
          <MiniCard key={char.id} char={char} onClick={onSelect} />
        ))}
      </div>

      <footer className="grid-footer">
        <span>HP: 100 • Força: Dado × Bônus</span>
      </footer>
    </div>
  )
}
