import { useEffect, useRef, useState } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../firebase'
import { attackPlayer, submitRoll, leaveRoom } from '../roomService'
import { clearSession } from '../session'
import { characters } from '../data/characters'
import './Game.css'

function ConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <p className="confirm-modal__text">Tem certeza que quer sair? Você perderá todos os dados da partida.</p>
        <div className="confirm-modal__btns">
          <button className="confirm-modal__btn confirm-modal__btn--leave" onClick={onConfirm}>Sair</button>
          <button className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function face(n, d) { return d === 6 ? FACES[n - 1] : n }

function DiceFace({ value, diceType, color, rolling }) {
  return (
    <div
      className={`gdie ${rolling ? 'gdie--rolling' : ''} ${value != null && !rolling ? 'gdie--landed' : ''}`}
      style={{ borderColor: value != null ? color + 'aa' : undefined }}
    >
      {value != null
        ? <span className={diceType === 6 ? 'gdie__sym--uni' : 'gdie__sym'}>{face(value, diceType)}</span>
        : <span className="gdie__q">?</span>
      }
    </div>
  )
}

export default function Game({ roomCode, playerId, onLeave }) {
  const [room, setRoom] = useState(null)
  const [myRoll, setMyRoll] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const prevBattleRef = useRef(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    const r = ref(db, `rooms/${roomCode}`)
    onValue(r, snap => {
      const data = snap.val()
      if (!data) { onLeave(); return }
      loadedRef.current = true
      setRoom(data)
    })
    return () => off(r)
  }, [roomCode])

  // Detect battle cleared → show result briefly
  useEffect(() => {
    const prev = prevBattleRef.current
    const cur = room?.battle
    prevBattleRef.current = cur

    if (prev && prev.resolved && !cur) {
      // Battle just cleared — show result for 3s
      const { attackerId, defenderId, attackerRoll, defenderRoll } = prev
      if (attackerRoll !== null && defenderRoll !== null) {
        const damage = Math.abs(attackerRoll - defenderRoll)
        const loserId = attackerRoll > defenderRoll ? defenderId
          : attackerRoll < defenderRoll ? attackerId : null
        setResult({ attackerRoll, defenderRoll, damage, loserId, attackerId, defenderId })
        setMyRoll(null)
        setTimeout(() => setResult(null), 3000)
      }
    }
    if (!cur) setMyRoll(null)
  }, [room?.battle])

  if (!room) return <div className="game-loading">Carregando…</div>

  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }))
  const me = players.find(p => p.id === playerId)
  const myChar = characters.find(c => c.id === me?.characterId)
  const battle = room.battle
  const isInBattle = battle && (battle.attackerId === playerId || battle.defenderId === playerId)
  const isAttacker = battle?.attackerId === playerId

  // Find opponent char in battle for their dice type
  const battleOpponentId = battle ? (isAttacker ? battle.defenderId : battle.attackerId) : null
  const battleOpponent = players.find(p => p.id === battleOpponentId)
  const battleOpponentChar = characters.find(c => c.id === battleOpponent?.characterId)

  const myBattleRoll = battle ? (isAttacker ? battle.attackerRoll : battle.defenderRoll) : null
  const oppBattleRoll = battle ? (isAttacker ? battle.defenderRoll : battle.attackerRoll) : null

  function rollDice() {
    if (rolling || myRoll !== null || !myChar) return
    setRolling(true)
    let ticks = 0
    const interval = setInterval(() => {
      ticks++
      setMyRoll(Math.ceil(Math.random() * myChar.diceType))
      if (ticks >= 12) {
        clearInterval(interval)
        const final = Math.ceil(Math.random() * myChar.diceType)
        setMyRoll(final)
        setRolling(false)
        submitRoll(roomCode, playerId, final)
      }
    }, 80)
  }

  const alivePlayers = players.filter(p => p.id !== playerId && p.alive)
  const deadPlayers = players.filter(p => p.id !== playerId && !p.alive)

  async function handleLeave() {
    clearSession()
    await leaveRoom(roomCode, playerId)
    onLeave()
  }

  return (
    <div className="game-page">
      {confirmLeave && (
        <ConfirmModal
          onConfirm={handleLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <span className="game-room">SALA: <strong>{roomCode}</strong></span>
        <button className="game-leave" onClick={() => setConfirmLeave(true)}>
          Sair
        </button>
      </div>

      {/* My card */}
      {me && myChar && (
        <div className="game-mycard" style={{ '--accent': myChar.color }}>
          <div className="game-mycard__img-wrap">
            <img src={myChar.image} alt={myChar.name} onError={e => { e.target.style.display = 'none' }} />
            <span className="game-mycard__fallback">{myChar.name.charAt(0)}</span>
          </div>
          <div className="game-mycard__info">
            <span className="game-mycard__char" style={{ color: myChar.color }}>{myChar.name}</span>
            <span className="game-mycard__player">{me.name} · D{myChar.diceType}</span>
            <div className="game-mycard__hprow">
              <div className="game-hp-bar">
                <div
                  className="game-hp-bar__fill"
                  style={{
                    width: `${me.hp}%`,
                    background: me.hp < 30 ? '#ff2222' : me.hp < 60 ? '#ffaa00' : '#ff5555',
                  }}
                />
              </div>
              <span className="game-hp-label" style={{ color: me.hp < 30 ? '#ff4444' : me.hp < 60 ? '#ffaa00' : '#ff8888' }}>
                ❤️ {me.hp}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Transient result banner */}
      {result && (() => {
        const iLost = result.loserId === playerId
        const iWon  = result.loserId && result.loserId !== playerId
        const tied  = !result.loserId
        const attChar = characters.find(c => c.id === players.find(p => p.id === result.attackerId)?.characterId)
        const defChar = characters.find(c => c.id === players.find(p => p.id === result.defenderId)?.characterId)
        return (
          <div className={`game-result ${iLost ? 'game-result--lose' : iWon ? 'game-result--win' : 'game-result--tie'}`}>
            <div className="game-result__rolls">
              <span style={{ color: attChar?.color }}>{face(result.attackerRoll, attChar?.diceType ?? 6)}</span>
              <span className="game-result__vs">VS</span>
              <span style={{ color: defChar?.color }}>{face(result.defenderRoll, defChar?.diceType ?? 6)}</span>
            </div>
            <p>
              {tied  && '⚖️ Empate — ninguém toma dano'}
              {iLost && `💥 Você perdeu! −${result.damage} HP`}
              {iWon  && `🏆 Você venceu! Oponente −${result.damage} HP`}
            </p>
          </div>
        )
      })()}

      {/* Battle panel */}
      {isInBattle && battle && !battle.resolved && (
        <div className="battle-panel">
          <h3 className="battle-panel__title">
            {isAttacker ? '⚔️ Você está atacando!' : '🛡️ Você foi atacado!'}
          </h3>
          <div className="battle-panel__row">
            <div className="battle-panel__side">
              <span className="battle-panel__label">Você · D{myChar?.diceType}</span>
              <DiceFace value={myBattleRoll ?? myRoll} diceType={myChar?.diceType ?? 6} color={myChar?.color ?? '#FFD700'} rolling={rolling} />
              {myBattleRoll == null && myRoll === null && (
                <button
                  className="battle-roll-btn"
                  style={{ '--c': myChar?.color }}
                  onClick={rollDice}
                  disabled={rolling}
                >
                  {rolling ? '…' : '🎲 Rolar'}
                </button>
              )}
            </div>

            <span className="battle-panel__vs">VS</span>

            <div className="battle-panel__side">
              <span className="battle-panel__label">{battleOpponent?.name} · D{battleOpponentChar?.diceType}</span>
              <DiceFace
                value={oppBattleRoll}
                diceType={battleOpponentChar?.diceType ?? 6}
                color={battleOpponentChar?.color ?? '#888'}
                rolling={false}
              />
              {oppBattleRoll == null && (
                <span className="battle-panel__waiting">aguardando…</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Opponents */}
      <div className="game-opponents">
        <h3 className="game-section-title">Jogadores</h3>

        {alivePlayers.length === 0 && (
          <p className="game-empty">Nenhum oponente vivo.</p>
        )}

        {alivePlayers.map(p => {
          const char = characters.find(c => c.id === p.characterId)
          const inBattle = battle && (battle.attackerId === p.id || battle.defenderId === p.id)
          return (
            <div key={p.id} className="opponent-row">
              <div className="opponent-row__img-wrap">
                <img src={char?.image} alt={char?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="opponent-row__fallback" style={{ color: char?.color }}>{char?.name?.charAt(0)}</span>
              </div>
              <div className="opponent-row__info">
                <span className="opponent-row__name">{p.name}</span>
                <span className="opponent-row__char" style={{ color: char?.color }}>
                  {char?.typeIcon} {char?.name} · D{char?.diceType}
                </span>
                <div className="opp-hp-bar">
                  <div style={{
                    width: `${p.hp}%`,
                    height: '100%',
                    borderRadius: '3px',
                    background: p.hp < 30 ? '#ff2222' : p.hp < 60 ? '#ffaa00' : '#ff5555',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span className="opponent-row__hp">❤️ {p.hp}/100</span>
              </div>
              <button
                className="attack-btn"
                style={{ '--c': char?.color ?? '#FFD700' }}
                onClick={() => attackPlayer(roomCode, playerId, p.id)}
                disabled={!!battle || inBattle || !me?.alive}
              >
                ⚔️
              </button>
            </div>
          )
        })}

        {deadPlayers.map(p => {
          const char = characters.find(c => c.id === p.characterId)
          return (
            <div key={p.id} className="opponent-row opponent-row--dead">
              <div className="opponent-row__img-wrap">
                <img src={char?.image} alt={char?.name} onError={e => { e.target.style.display = 'none' }} />
              </div>
              <div className="opponent-row__info">
                <span className="opponent-row__name">{p.name}</span>
                <span className="opponent-row__char" style={{ color: char?.color }}>{char?.name}</span>
              </div>
              <span className="dead-tag">💀</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
