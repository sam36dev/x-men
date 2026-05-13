import { useState } from 'react'
import './DiceRoller.css'

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function face(n) {
  return FACES[n - 1] ?? n
}

function SingleDie({ label, diceType, accentColor, onRoll }) {
  const [value, setValue] = useState(null)
  const [rolling, setRolling] = useState(false)

  function roll() {
    if (rolling) return
    setRolling(true)
    let ticks = 0
    const interval = setInterval(() => {
      ticks++
      setValue(Math.ceil(Math.random() * diceType))
      if (ticks >= 12) {
        clearInterval(interval)
        const final = Math.ceil(Math.random() * diceType)
        setValue(final)
        setRolling(false)
        onRoll(final)
      }
    }, 80)
  }

  const isD6 = diceType === 6

  return (
    <div className="single-die">
      <span className="single-die__label">{label}</span>
      <div
        className={`die-face ${rolling ? 'die-face--rolling' : ''} ${value && !rolling ? 'die-face--landed' : ''}`}
        style={{ borderColor: value ? accentColor + '88' : undefined }}
      >
        {value !== null
          ? <span className={isD6 ? 'die-face__sym--unicode' : 'die-face__sym'}>
              {isD6 ? face(value) : value}
            </span>
          : <span className="die-face__placeholder">?</span>
        }
      </div>
      <button
        className="die-btn"
        style={{ '--c': accentColor }}
        onClick={roll}
        disabled={rolling}
      >
        {rolling ? '…' : value !== null ? '↺' : '🎲 Rolar'}
      </button>
    </div>
  )
}

export default function DiceRoller({ diceType, accentColor, onDamageTaken }) {
  const [myRoll, setMyRoll] = useState(null)
  const [oppRoll, setOppRoll] = useState(null)

  const bothRolled = myRoll !== null && oppRoll !== null
  const iWon  = bothRolled && myRoll > oppRoll
  const iLost = bothRolled && myRoll < oppRoll
  const tied  = bothRolled && myRoll === oppRoll
  const damage = bothRolled ? Math.abs(myRoll - oppRoll) : null

  function handleMyRoll(val) {
    setMyRoll(val)
  }

  function handleOppRoll(val) {
    setOppRoll(val)
    if (myRoll !== null) {
      const dmg = Math.abs(myRoll - val)
      if (myRoll < val && dmg > 0) onDamageTaken(dmg)
    }
  }

  // if opponent was set first and now I roll
  function handleMyRollLate(val) {
    setMyRoll(val)
    if (oppRoll !== null) {
      const dmg = Math.abs(val - oppRoll)
      if (val < oppRoll && dmg > 0) onDamageTaken(dmg)
    }
  }

  return (
    <div className="combat-roller">
      <div className="combat-roller__header">
        <span>⚔️</span>
        <span>COMBATE</span>
        <span className="combat-roller__dtype" style={{ color: accentColor }}>D{diceType}</span>
      </div>

      <div className="combat-roller__dice">
        <SingleDie
          label="Você"
          diceType={diceType}
          accentColor={accentColor}
          onRoll={oppRoll !== null ? handleMyRollLate : handleMyRoll}
        />

        <div className="combat-roller__vs">VS</div>

        <SingleDie
          label="Oponente"
          diceType={diceType}
          accentColor="#888"
          onRoll={handleOppRoll}
        />
      </div>

      {bothRolled && (
        <div className={`combat-result ${iWon ? 'combat-result--win' : iLost ? 'combat-result--lose' : 'combat-result--tie'}`}>
          {tied && <span>⚖️ Empate! Ninguém toma dano.</span>}
          {iWon && damage > 0 && <span>🏆 Você venceu! Oponente toma <strong>{damage}</strong> de dano.</span>}
          {iLost && damage > 0 && <span>💥 Você perdeu! Você toma <strong>{damage}</strong> de dano.</span>}
        </div>
      )}
    </div>
  )
}
