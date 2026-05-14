import { useEffect, useRef, useState } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../firebase'
import { attackPlayer, submitRoll, leaveRoom, giveToken, togglePreB, toggleCAbility, changeTurn } from '../roomService'
import { characters } from '../data/characters'
import { villains } from '../data/villains'
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

function getChance(player, allPlayers) {
  const base = 20
  const tokenBonus = (player.tokens || 0) * 10
  const maxWins = Math.max(...allPlayers.map(p => p.wins || 0))
  const leaderBonus = maxWins > 0 && (player.wins || 0) === maxWins ? 10 : 0
  return Math.min(90, base + tokenBonus + leaderBonus) + '%'
}

function isCConditionMet(player, char, allPlayers) {
  if (!char?.abilityC) return false
  const cond = char.abilityC.condition
  switch (cond) {
    case 'hp_lte_20': return player.hp <= 20
    case 'hp_lte_30': return player.hp <= 30
    case 'hp_lte_35': return player.hp <= 35
    case 'hp_lte_40': return player.hp <= 40
    case 'hp_lte_50': return player.hp <= 50
    case 'hp_gte_70': return player.hp >= 70
    case 'losses_2':  return (player.consecutiveLosses || 0) >= 2
    case 'leader': {
      const maxWins = Math.max(...allPlayers.map(p => p.wins || 0))
      return maxWins > 0 && (player.wins || 0) === maxWins
    }
    case 'always': return true
    default: return false
  }
}

function cConditionLabel(condition) {
  const labels = {
    hp_lte_20: 'HP ≤ 20', hp_lte_30: 'HP ≤ 30', hp_lte_35: 'HP ≤ 35',
    hp_lte_40: 'HP ≤ 40', hp_lte_50: 'HP ≤ 50', hp_gte_70: 'HP ≥ 70',
    losses_2: '2 derrotas seguidas', leader: 'Líder da partida', always: 'Sempre ativa',
  }
  return labels[condition] ?? condition
}

export default function Game({ roomCode, playerId, onLeave }) {
  const [room, setRoom] = useState(null)
  const [myRoll, setMyRoll] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [shaking, setShaking] = useState(false)
  const prevBattleRef = useRef(null)

  useEffect(() => {
    const r = ref(db, `rooms/${roomCode}`)
    onValue(r, snap => setRoom(snap.val()))
    return () => off(r)
  }, [roomCode])

  useEffect(() => {
    const prev = prevBattleRef.current
    const cur = room?.battle
    prevBattleRef.current = cur

    if (prev && prev.resolved && !cur) {
      const { attackerId, defenderId, attackerRoll, defenderRoll,
              attAbility, defAbility, attAbilityB, defAbilityB,
              attAbilityC, defAbilityC } = prev
      if (attackerRoll !== null && defenderRoll !== null) {
        const damage = Math.abs(attackerRoll - defenderRoll)
        const loserId = attackerRoll > defenderRoll ? defenderId
          : attackerRoll < defenderRoll ? attackerId : null
        setResult({
          attackerRoll, defenderRoll, damage, loserId, attackerId, defenderId,
          attAbility: attAbility ?? null, defAbility: defAbility ?? null,
          attAbilityB: attAbilityB ?? null, defAbilityB: defAbilityB ?? null,
          attAbilityC: attAbilityC ?? null, defAbilityC: defAbilityC ?? null,
        })
        setMyRoll(null)
        setShaking(true)
        setTimeout(() => setShaking(false), 550)
        setTimeout(() => setResult(null), 5000)
      }
    }
    if (!cur) setMyRoll(null)
  }, [room?.battle])

  if (!room) return <div className="game-loading">Carregando…</div>

  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }))
  const me = players.find(p => p.id === playerId)
  const myChar = characters.find(c => c.id === me?.characterId)
  const battle = room.battle
  const isHost = room.hostId === playerId
  const isInBattle = battle && (battle.attackerId === playerId || battle.defenderId === playerId)
  const isAttacker = battle?.attackerId === playerId

  const battleOpponentId = battle ? (isAttacker ? battle.defenderId : battle.attackerId) : null
  const battleOpponent = players.find(p => p.id === battleOpponentId)
  const battleOpponentChar = characters.find(c => c.id === battleOpponent?.characterId)

  const myBattleRoll = battle ? (isAttacker ? battle.attackerRoll : battle.defenderRoll) : null
  const oppBattleRoll = battle ? (isAttacker ? battle.defenderRoll : battle.attackerRoll) : null

  const battleAtt     = battle ? players.find(p => p.id === battle.attackerId) : null
  const battleDef     = battle ? players.find(p => p.id === battle.defenderId) : null
  const battleAttChar = battle ? characters.find(c => c.id === battleAtt?.characterId) : null
  const battleDefChar = battle ? characters.find(c => c.id === battleDef?.characterId) : null

  const resultWinnerId = result?.loserId
    ? (result.loserId === result.attackerId ? result.defenderId : result.attackerId)
    : null
  const resultWinnerChar = resultWinnerId
    ? characters.find(c => c.id === players.find(p => p.id === resultWinnerId)?.characterId)
    : null
  const flashColor = result ? (resultWinnerChar?.color ?? '#FFCC00') : null

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
  const deadPlayers  = players.filter(p => p.id !== playerId && !p.alive)

  async function handleLeave() {
    await leaveRoom(roomCode, playerId)
    onLeave()
  }

  function resolveActivatedAbility() {
    if (!result) return null
    const iAmAttacker = result.attackerId === playerId
    const names = [
      iAmAttacker ? result.attAbility  : result.defAbility,
      iAmAttacker ? result.defAbility  : result.attAbility,
      iAmAttacker ? result.attAbilityB : result.defAbilityB,
      iAmAttacker ? result.defAbilityB : result.attAbilityB,
      iAmAttacker ? result.attAbilityC : result.defAbilityC,
      iAmAttacker ? result.defAbilityC : result.attAbilityC,
    ].filter(Boolean)
    return names.length ? names.join(' · ') + ' ativado!' : null
  }

  const activatedAbilityLabel = resolveActivatedAbility()

  return (
    <div className={`game-page ${shaking ? 'game-page--shake' : ''}`}>
      {shaking && flashColor && (
        <div className="game-flash" style={{ '--fc': flashColor }} />
      )}

      {confirmLeave && (
        <ConfirmModal onConfirm={handleLeave} onCancel={() => setConfirmLeave(false)} />
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <span className="game-room">SALA: <strong>{roomCode}</strong></span>
        <button className="game-leave" onClick={() => setConfirmLeave(true)}>Sair</button>
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
                  style={{ width: `${me.hp}%`, background: me.hp < 30 ? '#ff2222' : me.hp < 60 ? '#ffaa00' : '#ff5555' }}
                />
              </div>
              <span className="game-hp-label" style={{ color: me.hp < 30 ? '#ff4444' : me.hp < 60 ? '#ffaa00' : '#ff8888' }}>
                ❤️ {me.hp}
              </span>
            </div>
            <div className="player-tokens">
              <span className="player-tokens__coins">🪙 ×{me.tokens || 0}</span>
              <span className="player-tokens__chance">{myChar.ability ? getChance(me, players) : '—'}</span>
              {myChar.ability && <span className="player-tokens__ability">{myChar.ability.name}</span>}
            </div>
            <div className="player-turn-row">
              <span className="player-turn-label">TURNO</span>
              <span className="player-turn-val">{me.turn ?? 1}</span>
              {isHost && (
                <>
                  <button className="turn-btn" onClick={() => changeTurn(roomCode, me.id, -1)}>−</button>
                  <button className="turn-btn" onClick={() => changeTurn(roomCode, me.id, +1)}>+</button>
                </>
              )}
            </div>
            {myChar?.abilityB && myChar.abilityB.effect !== 'B_MOVEMENT' && (
              <button
                className={`my-b-btn ${me.preB ? 'my-b-btn--on' : ''}`}
                onClick={() => togglePreB(roomCode, playerId)}
                disabled={!!isInBattle}
              >
                <span className="my-b-btn__tag">[B]</span>
                <span className="my-b-btn__name">{myChar.abilityB.name}</span>
                {me.preB && <span className="my-b-btn__check">✓</span>}
              </button>
            )}
            {myChar.abilityC && (
              <div className="player-c-row">
                <span className="player-c-label">[C] {myChar.abilityC.name}</span>
                <span className={`player-c-cond ${isCConditionMet(me, myChar, players) ? 'player-c-cond--met' : ''}`}>
                  {cConditionLabel(myChar.abilityC.condition)}
                </span>
                {me.cActive && <span className="player-c-active">ATIVO</span>}
                {isHost && (
                  <button
                    className={`player-c-toggle ${me.cActive ? 'player-c-toggle--on' : ''}`}
                    onClick={() => toggleCAbility(roomCode, me.id)}
                  >
                    {me.cActive ? '✓' : '○'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result banner */}
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
            {activatedAbilityLabel && (
              <p className="ability-activated">⚡ {activatedAbilityLabel}</p>
            )}
          </div>
        )
      })()}

      {/* Battle panel — full card view when in battle */}
      {isInBattle && battle && (
        <div className="battle-panel">
          <h3 className="battle-panel__title">
            {isAttacker ? '⚔️ Você está atacando!' : '🛡️ Você foi atacado!'}
          </h3>

          {/* Character cards */}
          <div className="battle-cards">
            <div className="battle-char battle-char--att" style={{ '--cc': myChar?.color }}>
              <div className="battle-char__img-wrap">
                <img src={myChar?.image} alt={myChar?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="battle-char__fallback">{myChar?.name?.charAt(0)}</span>
              </div>
              <span className="battle-char__name" style={{ color: myChar?.color }}>{myChar?.name}</span>
            </div>

            <div className="battle-cards__vs">VS</div>

            <div className="battle-char battle-char--def" style={{ '--cc': battleOpponentChar?.color }}>
              <div className="battle-char__img-wrap">
                <img src={battleOpponentChar?.image} alt={battleOpponentChar?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="battle-char__fallback">{battleOpponentChar?.name?.charAt(0)}</span>
              </div>
              <span className="battle-char__name" style={{ color: battleOpponentChar?.color }}>{battleOpponentChar?.name}</span>
            </div>
          </div>

          {/* Dice row */}
          <div className="battle-panel__row">
            <div className="battle-panel__side">
              <span className="battle-panel__label">Você · D{myChar?.diceType}</span>
              <DiceFace value={myBattleRoll ?? myRoll} diceType={myChar?.diceType ?? 6} color={myChar?.color ?? '#FFD700'} rolling={rolling} />
              {myBattleRoll == null && myRoll === null && (
                <button className="battle-roll-btn" style={{ '--c': myChar?.color }} onClick={rollDice} disabled={rolling}>
                  {rolling ? '…' : '🎲 Rolar'}
                </button>
              )}
            </div>
            <span className="battle-panel__vs">VS</span>
            <div className="battle-panel__side">
              <span className="battle-panel__label">{battleOpponent?.name} · D{battleOpponentChar?.diceType}</span>
              <DiceFace value={oppBattleRoll} diceType={battleOpponentChar?.diceType ?? 6} color={battleOpponentChar?.color ?? '#888'} rolling={false} />
              {oppBattleRoll == null && <span className="battle-panel__waiting">aguardando…</span>}
            </div>
          </div>
        </div>
      )}

      {/* [B] status panel during battle — each side manages their own */}
      {battle && !battle.resolved && (battleAtt || battleDef) && (
        <div className="host-b-panel">
          <h4 className="host-b-panel__title">⚙️ Habilidade [B]</h4>
          <div className="host-b-panel__row">
            {[
              { player: battleAtt, char: battleAttChar, pid: battle.attackerId },
              { player: battleDef, char: battleDefChar, pid: battle.defenderId },
            ].map((side, i) => (
              <div key={i} className="host-b-panel__side">
                <span className="host-b-panel__player">{side.player?.name}</span>
                <span className="host-b-panel__char" style={{ color: side.char?.color }}>
                  {side.char?.typeIcon} {side.char?.name}
                </span>
                {side.char?.abilityB && side.char.abilityB.effect !== 'B_MOVEMENT' ? (
                  side.pid === playerId ? (
                    // Own side — interactive toggle
                    <button
                      className={`host-b-btn ${side.player?.preB ? 'host-b-btn--on' : ''}`}
                      onClick={() => togglePreB(roomCode, side.pid)}
                    >
                      {side.player?.preB ? '✓ ' : ''}{side.char.abilityB.name}
                    </button>
                  ) : (
                    // Opponent side — view only
                    <span className={`host-b-status ${side.player?.preB ? 'host-b-status--on' : ''}`}>
                      {side.player?.preB ? '✓ ' : '○ '}{side.char.abilityB.name}
                    </span>
                  )
                ) : (
                  <span className="host-b-panel__physical">{side.char?.abilityB?.name ?? '—'} (físico)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jogadores */}
      <div className="game-opponents">
        <h3 className="game-section-title">Jogadores</h3>
        {alivePlayers.length === 0 && <p className="game-empty">Nenhum oponente vivo.</p>}
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
                    width: `${p.hp}%`, height: '100%', borderRadius: '3px',
                    background: p.hp < 30 ? '#ff2222' : p.hp < 60 ? '#ffaa00' : '#ff5555',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span className="opponent-row__hp">❤️ {p.hp}/100</span>
                <div className="player-turn-row">
                  <span className="player-turn-label">TURNO</span>
                  <span className="player-turn-val">{p.turn ?? 1}</span>
                  {isHost && (
                    <>
                      <button className="turn-btn" onClick={() => changeTurn(roomCode, p.id, -1)}>−</button>
                      <button className="turn-btn" onClick={() => changeTurn(roomCode, p.id, +1)}>+</button>
                    </>
                  )}
                </div>
                <div className="player-tokens">
                  <span className="player-tokens__coins">🪙 ×{p.tokens || 0}</span>
                  <span className="player-tokens__chance">{char?.ability ? getChance(p, players) : '—'}</span>
                  {isHost && p.alive && (
                    <button className="give-token-btn" onClick={() => giveToken(roomCode, p.id)} title="Dar token">+</button>
                  )}
                </div>
                {char?.abilityC && (
                  <div className="player-c-row">
                    <span className="player-c-label">[C] {char.abilityC.name}</span>
                    <span className={`player-c-cond ${isCConditionMet(p, char, players) ? 'player-c-cond--met' : ''}`}>
                      {cConditionLabel(char.abilityC.condition)}
                    </span>
                    {p.cActive && <span className="player-c-active">ATIVO</span>}
                    {isHost && (
                      <button
                        className={`player-c-toggle ${p.cActive ? 'player-c-toggle--on' : ''}`}
                        onClick={() => toggleCAbility(roomCode, p.id)}
                      >
                        {p.cActive ? '✓' : '○'}
                      </button>
                    )}
                  </div>
                )}
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

      {/* Vilões */}
      <div className="game-villains">
        <h3 className="game-section-title">Vilões do Mapa</h3>
        <div className="game-villain-scroll">
          {villains.map(v => (
            <div key={v.id} className={`villain-card villain-card--${v.difficulty}`} style={{ '--vcolor': v.color }}>
              <div className="villain-card__img-wrap">
                <img src={v.image} alt={v.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="villain-card__fallback">{v.typeIcon}</span>
              </div>
              <div className="villain-card__info">
                <div className="villain-card__header">
                  <span className="villain-card__name">{v.name}</span>
                  <span className="villain-card__diff">{v.difficultyLabel}</span>
                </div>
                <span className="villain-card__mechanic">{v.mechanic}</span>
                <div className="villain-card__hprow">
                  <div className="villain-hp-bar">
                    <div className="villain-hp-bar__fill" style={{ width: '100%' }} />
                  </div>
                  <span className="villain-card__hp">❤️ {v.hp}</span>
                </div>
              </div>
              <button
                className="villain-attack-btn"
                style={{ '--vc': v.color }}
                disabled={!!battle || !me?.alive}
              >
                ⚔️
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
