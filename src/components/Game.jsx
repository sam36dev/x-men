import { useEffect, useRef, useState } from 'react'
import { ref, onValue, off, update } from 'firebase/database'
import { db } from '../firebase'
import { attackPlayer, submitRoll, leaveRoom, giveToken, removeToken, healPlayer, dominoHp, clearBattle, togglePreB, toggleCAbility, changeTurn, attackVillain, submitVillainRoll, unlockVillain, healVillain, giveForgeItem, clearForgeItem, assignBomb, removeBomb, tickBomb, detonateBomb, applyLuckCard, clearLuckCard, completeMission, incrementMissionProgress, selectCharacter, addLocalPlayer, removeParalysis, decrementForgeCharge, incrementPlayerWins, resetBattleState, addTrapCard, triggerTrapCard, vampiraStealAbility } from '../roomService'
import { characters } from '../data/characters'
import { villains } from '../data/villains'
import { MISSIONS } from '../data/missions'
import { awardTrophy } from '../userService'
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

const FORGE_ITEMS = [
  { id: 1, name: 'Nada acontece',      icon: '—',  diceBonus: 0 },
  { id: 2, name: 'Lança da Okoye',     icon: '🗡️', diceBonus: 1 },
  { id: 3, name: 'Espada do Noturno',  icon: '⚔️', diceBonus: 2 },
  { id: 4, name: 'Escudo do Capitão',  icon: '🛡️', diceBonus: 0 },
  { id: 5, name: 'Bomba',              icon: '💣', diceBonus: 0 },
  { id: 6, name: 'Raio da Tempestade', icon: '⚡', diceBonus: 3 },
]

const LUCK_CARDS = [
  { id: 1, name: 'Ciclope',      icon: '🔴', effect: 'dice_d12_until_12', persistent: true, description: 'D12 até tirar 12' },
  { id: 2, name: 'Colossus',     icon: '🪨', effect: 'dice_d8',           persistent: true, description: 'D8 até ser removido' },
  { id: 3, name: 'Deadpool',     icon: '💀', type: 'damage', value: 10 },
  { id: 4, name: 'Jubileu',      icon: '🎆', effect: 'sentinel_wins',     persistent: true, charges: 3, description: '3× vence Sentinela' },
  { id: 5, name: 'Phoenix',      icon: '🔥', effect: 'dice_d20',          persistent: true, charges: 5, description: 'D20 por 5 batalhas' },
  { id: 6, name: 'Sanguessuga',  icon: '🩸', effect: 'disable_abilities', persistent: true, description: 'A/B/C bloqueados' },
  { id: 7, name: 'Tempestade',   icon: '⛈️', type: 'aoe_damage', value: 10 },
]

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function face(n, d) { return d === 6 && n >= 1 && n <= 6 ? FACES[n - 1] : n }

function DiceFace({ value, diceType, color, rolling, selected }) {
  const sym = value != null ? face(value, diceType) : null
  const useUni = diceType === 6

  return (
    <div
      className={`gdie ${rolling ? 'gdie--rolling' : ''} ${value != null && !rolling ? 'gdie--landed' : ''} ${selected ? 'gdie--selected' : ''}`}
      style={{ borderColor: value != null ? color + 'aa' : undefined }}
    >
      {sym != null
        ? <span className={useUni ? 'gdie__sym--uni' : 'gdie__sym'}>{sym}</span>
        : <span className="gdie__q">?</span>
      }
    </div>
  )
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

function BombModal({ target, villainList, onConfirm, onClose }) {
  const [selectedVillain, setSelectedVillain] = useState(null)
  const [xmenPresent, setXmenPresent] = useState(false)
  return (
    <div className="ability-overlay" onClick={onClose}>
      <div className="ability-modal bomb-modal" onClick={e => e.stopPropagation()}>
        <div className="ability-modal__header" style={{ background: 'linear-gradient(135deg,#3d1000,#1a0800)' }}>
          <span>💥 Detonar Bomba — {target.playerName}</span>
          <button className="ability-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="ability-modal__body">
          <p className="bomb-modal__label">Qual boss está na casa?</p>
          <div className="bomb-modal__villains">
            {villainList.map(v => (
              <button
                key={v.id}
                className={`bomb-modal__villain-btn ${selectedVillain?.id === v.id ? 'bomb-modal__villain-btn--sel' : ''}`}
                style={{ '--vc': v.color }}
                onClick={() => setSelectedVillain(v)}
              >
                {v.typeIcon} {v.name} <span style={{ opacity: 0.6, fontSize: '0.75em' }}>D{v.diceType}</span>
              </button>
            ))}
          </div>
          <label className="bomb-modal__toggle">
            <input type="checkbox" checked={xmenPresent} onChange={e => setXmenPresent(e.target.checked)} />
            <span>X-Men presente na casa?</span>
          </label>
          {xmenPresent && (
            <p className="bomb-modal__note">Boss −5 HP · {target.playerName} −5 HP</p>
          )}
          {!xmenPresent && selectedVillain && (
            <p className="bomb-modal__note">Boss −10 HP</p>
          )}
          <button
            className="bomb-modal__confirm"
            disabled={!selectedVillain}
            onClick={() => { onConfirm(selectedVillain.id, xmenPresent); onClose() }}
          >
            💥 Confirmar Explosão
          </button>
        </div>
      </div>
    </div>
  )
}

function AbilityModal({ char, onClose }) {
  if (!char) return null
  return (
    <div className="ability-overlay" onClick={onClose}>
      <div className="ability-modal" onClick={e => e.stopPropagation()}>
        <div className="ability-modal__header" style={{ background: char.gradient }}>
          <div className="ability-modal__img-wrap">
            <img src={char.image} alt={char.name} onError={e => { e.target.style.display = 'none' }} />
            <span className="ability-modal__fallback">{char.name.charAt(0)}</span>
          </div>
          <div>
            <div className="ability-modal__name" style={{ color: char.color }}>{char.name}</div>
            <div className="ability-modal__alias">{char.alias} · D{char.diceType}</div>
          </div>
          <button className="ability-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="ability-modal__body">
          {char.ability && (
            <div className="ability-row ability-row--a">
              <span className="ability-row__tag">[A]</span>
              <div className="ability-row__content">
                <span className="ability-row__name">{char.ability.name}</span>
                <span className="ability-row__desc">{char.ability.description}</span>
              </div>
            </div>
          )}
          {char.abilityB && (
            <div className="ability-row ability-row--b">
              <span className="ability-row__tag">[B]</span>
              <div className="ability-row__content">
                <span className="ability-row__name">{char.abilityB.name}</span>
                <span className="ability-row__desc">{char.abilityB.description}</span>
              </div>
            </div>
          )}
          {char.abilityC && (
            <div className="ability-row ability-row--c">
              <span className="ability-row__tag">[C]</span>
              <div className="ability-row__content">
                <span className="ability-row__name">{char.abilityC.name}</span>
                <span className="ability-row__desc">{char.abilityC.description}</span>
                <span className="ability-row__note">Condição: {cConditionLabel(char.abilityC.condition)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LocalPlayerCard({ p, roomCode, battle, villainBattle, players, villains, villainHp, onRemove }) {
  const [myRoll,        setMyRoll]        = useState(null)
  const [rolling,       setRolling]       = useState(false)
  const [myVillainRoll, setMyVillainRoll] = useState(null)
  const [villainRolling,setVillainRolling]= useState(false)

  const char         = characters.find(c => c.id === p.characterId)
  const isInBattle   = battle && (battle.attackerId === p.id || battle.defenderId === p.id)
  const isAttacker   = battle?.attackerId === p.id
  const myBattleRoll = battle ? (isAttacker ? battle.attackerRoll : battle.defenderRoll) : null
  const isInVillain  = villainBattle?.playerId === p.id
  const activeVillain= villainBattle ? villains.find(v => v.id === villainBattle.villainId) : null
  const diceType     = char?.diceType ?? 6
  const takenIds     = players.map(pl => pl.characterId).filter(Boolean)

  useEffect(() => { if (!battle)       setMyRoll(null)        }, [battle])
  useEffect(() => { if (!villainBattle) setMyVillainRoll(null) }, [villainBattle])

  function rollDice() {
    if (rolling || myRoll !== null) return
    setRolling(true)
    let ticks = 0
    const iv = setInterval(() => {
      ticks++
      setMyRoll(Math.ceil(Math.random() * diceType))
      if (ticks >= 12) {
        clearInterval(iv)
        const v = Math.ceil(Math.random() * diceType)
        setMyRoll(v); setRolling(false)
        submitRoll(roomCode, p.id, v, false)
      }
    }, 80)
  }

  function rollVillain() {
    if (villainRolling || myVillainRoll !== null) return
    setVillainRolling(true)
    let ticks = 0
    const iv = setInterval(() => {
      ticks++
      if (ticks >= 12) {
        clearInterval(iv)
        const v = Math.ceil(Math.random() * diceType)
        setMyVillainRoll(v); setVillainRolling(false)
        submitVillainRoll(roomCode, p.id, v)
      }
    }, 80)
  }

  return (
    <div className="local-player-card" style={{ '--accent': char?.color ?? '#FFD700' }}>
      <div className="local-player-card__toprow">
        <span className="local-player-card__label">🎮 {p.name}</span>
        {char && <span className="local-player-card__hp">❤️ {p.hp}</span>}
        <button className="local-player-card__remove" onClick={onRemove} title="Remover jogador">✕</button>
      </div>

      {!char ? (
        <div className="local-char-grid">
          {characters.map(c => (
            <button
              key={c.id}
              className={`local-char-btn ${takenIds.includes(c.id) ? 'local-char-btn--taken' : ''}`}
              disabled={takenIds.includes(c.id)}
              onClick={() => selectCharacter(roomCode, p.id, c.id)}
            >
              {c.typeIcon} {c.name}
            </button>
          ))}
        </div>
      ) : (
        <>
          <span className="local-player-card__char" style={{ color: char.color }}>{char.typeIcon} {char.name} · D{diceType}</span>

          {isInVillain && (
            <div className="local-battle-row">
              <span>⚔️ vs {activeVillain?.name}</span>
              {villainBattle.playerRoll == null && myVillainRoll === null ? (
                <button className="local-roll-btn" onClick={rollVillain} disabled={villainRolling}>
                  🎲 {villainRolling ? '…' : 'Rolar'}
                </button>
              ) : (
                <span className="local-roll-val">{face(myVillainRoll ?? villainBattle.playerRoll, diceType)}</span>
              )}
            </div>
          )}

          {isInBattle && (
            <div className="local-battle-row">
              <span>⚔️ {isAttacker ? 'Atacando' : 'Defendendo'}</span>
              {myBattleRoll == null && myRoll === null ? (
                <button className="local-roll-btn" onClick={rollDice} disabled={rolling}>
                  🎲 {rolling ? '…' : 'Rolar'}
                </button>
              ) : (
                <span className="local-roll-val">{face(myRoll ?? myBattleRoll, diceType)}</span>
              )}
            </div>
          )}

          {!battle && !isInVillain && p.alive && (
            <div className="local-attack-row">
              {players.filter(pl => pl.id !== p.id && pl.alive).map(pl => {
                const plChar = characters.find(c => c.id === pl.characterId)
                return (
                  <button key={pl.id} className="local-attack-btn" style={{ '--c': plChar?.color ?? '#FFD700' }}
                    onClick={() => attackPlayer(roomCode, p.id, pl.id)}>
                    ⚔️ {pl.name}
                  </button>
                )
              })}
              {villains.filter(v => (villainHp[v.id] ?? v.hp) > 0).map(v => (
                <button key={v.id} className="local-attack-btn" style={{ '--c': v.color }}
                  onClick={() => attackVillain(roomCode, p.id, v.id)}>
                  ⚔️ {v.name} <span style={{ opacity: 0.6, fontSize: '0.8em' }}>D{v.diceType}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Game({ roomCode, playerId, user, onLeave }) {
  const [room, setRoom] = useState(null)
  const [myRoll, setMyRoll] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [deathDismissed, setDeathDismissed] = useState(false)
  const [oppRolling, setOppRolling] = useState(false)
  const [oppDisplayRoll, setOppDisplayRoll] = useState(null)
  const [myVillainRoll, setMyVillainRoll] = useState(null)
  const [villainRolling, setVillainRolling] = useState(false)
  const [villainDiceDisplay, setVillainDiceDisplay] = useState(null)
  const [villainDiceDisplay2, setVillainDiceDisplay2] = useState(null)
  const [villainResult, setVillainResult] = useState(null)
  const [forgeTarget, setForgeTarget] = useState(null)
  const [luckTarget, setLuckTarget] = useState(null)
  const [missionHidden, setMissionHidden] = useState(false)
  const [localPlayerIds, setLocalPlayerIds] = useState([])
  const [activeControllerId, setActiveControllerId] = useState(null) // null = own player
  const isTester = user?.displayName === 'tester'
  const activeId = isTester && activeControllerId ? activeControllerId : playerId
  const [showAbility, setShowAbility] = useState(false)
  const [pendingVampiraSteal, setPendingVampiraSteal] = useState(null) // { opponentId, opponentAbility, opponentName }
  const [trapTarget, setTrapTarget] = useState(false)
  const [bombDetonate, setBombDetonate] = useState(null) // { playerId, playerName }
  const prevBattleRef = useRef(null)
  const prevOppRollRef = useRef(null)
  const prevVillainBattleRef = useRef(null)

  useEffect(() => {
    const r = ref(db, `rooms/${roomCode}`)
    onValue(r, snap => setRoom(snap.val()))
    return () => off(r)
  }, [roomCode])

  useEffect(() => {
    const prev = prevBattleRef.current
    const cur = room?.battle
    prevBattleRef.current = cur

    // Clear steal prompt when a new battle starts
    if (cur && !prev) setPendingVampiraSteal(null)

    if (prev && prev.resolved && !cur) {
      const { attackerId, defenderId, attackerRoll, defenderRoll,
              attAbility, defAbility, attAbilityB, defAbilityB,
              attAbilityC, defAbilityC, fled,
              resolvedLoserId, resolvedDamage,
              effectiveAttackerRoll, effectiveDefenderRoll,
              attackerForgeBonus, defenderForgeBonus,
              attackerForgeId, defenderForgeId,
              psychicTarget, phoenixReflect, paralysisInfo } = prev
      if (fled) {
        setResult({ fled, attackerId, defenderId })
        setMyRoll(null)
        setTimeout(() => setResult(null), 3500)
      } else if (attackerRoll !== null && defenderRoll !== null) {
        const effAtt = effectiveAttackerRoll ?? attackerRoll
        const effDef = effectiveDefenderRoll ?? defenderRoll
        const damage = resolvedDamage ?? Math.abs(effAtt - effDef)
        const loserId = resolvedLoserId !== undefined
          ? (resolvedLoserId || null)
          : (effAtt > effDef ? defenderId : effAtt < effDef ? attackerId : null)
        const winnerId = loserId === null ? null : (loserId === attackerId ? defenderId : attackerId)

        // Client-side: each player updates their own wins/forge charges/preB state
        if (winnerId === playerId) incrementPlayerWins(roomCode, playerId)
        const myForgeId = attackerId === playerId ? attackerForgeId
                        : defenderId === playerId ? defenderForgeId : null
        if (myForgeId && myForgeId !== 5) decrementForgeCharge(roomCode, playerId)
        const myPreBUsed = attackerId === playerId ? !!(prev.attackerPreB)
                         : defenderId === playerId ? !!(prev.defenderPreB) : false
        if (attackerId === playerId || defenderId === playerId) {
          resetBattleState(roomCode, playerId, myPreBUsed, me?.turn ?? 1)
          // Gambit [B] trap cards are placed directly via button (no battle needed)
        }

        setResult({
          attackerRoll: effAtt, defenderRoll: effDef, damage, loserId, attackerId, defenderId,
          attAbility: attAbility ?? null, defAbility: defAbility ?? null,
          attAbilityB: attAbilityB ?? null, defAbilityB: defAbilityB ?? null,
          attAbilityC: attAbilityC ?? null, defAbilityC: defAbilityC ?? null,
          attackerForgeBonus: prev.attackerForgeBonus ?? 0,
          defenderForgeBonus: prev.defenderForgeBonus ?? 0,
          attackerForgeId: prev.attackerForgeId ?? null,
          defenderForgeId: prev.defenderForgeId ?? null,
          psychicTarget: psychicTarget ?? null,
          phoenixReflect: phoenixReflect ?? null,
          paralysisInfo: paralysisInfo ?? null,
        })
        setMyRoll(null)

        // Vampira [C] — show optional steal prompt if she won
        if (loserId !== null && winnerId === playerId) {
          const myCharId = attackerId === playerId ? prev.attackerCharId : prev.defenderCharId
          if (myCharId === 7) {
            const oppId = attackerId === playerId ? defenderId : attackerId
            const oppCharId = attackerId === playerId ? prev.defenderCharId : prev.attackerCharId
            const oppChar = characters.find(c => c.id === oppCharId)
            if (oppChar?.ability) {
              setPendingVampiraSteal({ opponentId: oppId, opponentAbility: oppChar.ability, opponentName: oppChar.name })
            }
          }
        }
        setShaking(true)
        setTimeout(() => setShaking(false), 550)
        setTimeout(() => setResult(null), 8000)
      }
    }
    if (!cur) setMyRoll(null)
  }, [room?.battle])

  // Reset roll state when active player changes so each player can roll independently
  useEffect(() => {
    setMyRoll(null)
    setRolling(false)
  }, [activeId])

  // Opponent dice animation when their roll arrives
  const currentOppRoll = room?.battle
    ? (room.battle.attackerId === activeId ? room.battle.defenderRoll : room.battle.attackerRoll)
    : null

  useEffect(() => {
    if (currentOppRoll != null && prevOppRollRef.current == null) {
      setOppRolling(true)
      setOppDisplayRoll(Math.ceil(Math.random() * 6))
      let ticks = 0
      const interval = setInterval(() => {
        ticks++
        setOppDisplayRoll(Math.ceil(Math.random() * 6))
        if (ticks >= 12) {
          clearInterval(interval)
          setOppDisplayRoll(currentOppRoll)
          setOppRolling(false)
        }
      }, 80)
      prevOppRollRef.current = currentOppRoll
      return () => clearInterval(interval)
    }
    if (currentOppRoll == null) {
      prevOppRollRef.current = null
      setOppDisplayRoll(null)
      setOppRolling(false)
    }
  }, [currentOppRoll])

  // Villain battle: detect resolution and animate villain dice
  useEffect(() => {
    const prev = prevVillainBattleRef.current
    const cur = room?.villainBattle
    prevVillainBattleRef.current = cur

    if (prev && prev.resolved && !cur) {
      const { playerRoll, villainRoll, playerId: vPlayerId, villainId } = prev
      if (playerRoll != null && villainRoll != null) {
        const effectiveRoll = prev.effectivePlayerRoll ?? playerRoll
        const damage = prev.resolvedDamage ?? Math.abs(effectiveRoll - villainRoll)
        const playerWon = effectiveRoll > villainRoll
        const tied = effectiveRoll === villainRoll
        setVillainResult({ playerRoll, villainRoll, villainRoll2: prev.villainRoll2 ?? null, damage, playerWon, tied, villainId, vPlayerId, absorbed: prev.absorbed ?? false, abilityActivated: prev.abilityActivated ?? null, playerBName: prev.playerBName ?? null, playerForgeBonus: prev.playerForgeBonus ?? 0, playerForgeId: prev.playerForgeId ?? null, playerBBonus: prev.playerBBonus ?? 0, playerCBonus: prev.playerCBonus ?? 0, effectivePlayerRoll: effectiveRoll, phoenixReflect: prev.phoenixReflect ?? 0, psychicTarget: prev.psychicTarget ?? null })
        setMyVillainRoll(null)
        setShaking(true)
        setTimeout(() => setShaking(false), 550)
        setTimeout(() => setVillainResult(null), 8000)

        // Client-side: reset preB state and add trap card if Gambit used [B]
        if (vPlayerId === playerId) {
          const myVillainPreBUsed = !!(prev.playerPreB)
          resetBattleState(roomCode, playerId, myVillainPreBUsed, me?.turn ?? 1)
          // Gambit [B] trap cards are placed directly via button (no battle needed)
        }
      }
    }

    // Show villain dice values immediately when roll arrives
    if (cur?.resolved && cur.villainRoll != null && !prev?.resolved) {
      setVillainDiceDisplay(cur.villainRoll)
      if (cur.villainRoll2 != null) setVillainDiceDisplay2(cur.villainRoll2)
    }

    if (!cur) { setMyVillainRoll(null); setVillainDiceDisplay(null); setVillainDiceDisplay2(null); setVillainRolling(false) }
  }, [room?.villainBattle])

  // Mission victory: show announcement + award trophy + end game
  const missionWinner = room?.missionWinner
  useEffect(() => {
    if (!missionWinner) return
    if (missionWinner.playerId === playerId) {
      awardTrophy(playerId, `mission_${missionWinner.missionId}`)
    }
  }, [missionWinner?.playerId])

  const pvpWinner      = room?.pvpWinner
  const bossKillWinner = room?.bossKillWinner

  // Auto-sync token_accumulate mission progress to current token count
  const myTokens = room?.players?.[playerId]?.tokens ?? 0
  const myMissionId = room?.players?.[playerId]?.missionId
  const myMissionProgress = room?.players?.[playerId]?.missionProgress ?? 0
  const myMissionCompleted = room?.players?.[playerId]?.missionCompleted
  useEffect(() => {
    if (myMissionCompleted) return
    const mission = MISSIONS.find(m => m.id === myMissionId)
    if (!mission || mission.auto !== 'token_accumulate') return
    if (myMissionProgress !== myTokens) {
      update(ref(db, `rooms/${roomCode}/players/${playerId}`), { missionProgress: myTokens })
    }
  }, [myTokens, myMissionId, myMissionProgress, myMissionCompleted])

  if (!room) return <div className="game-loading">Carregando…</div>

  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }))
  const me = players.find(p => p.id === playerId)
  const myChar = characters.find(c => c.id === me?.characterId)
  const battle = room.battle
  const isHost = room.hostId === playerId

  const getEffectiveChance = (player) => {
    const base = Math.min(90, (player.tokens || 0) * 10)
    if (players.length > 1) {
      const myWins = player.wins || 0
      const othersMax = Math.max(0, ...players.filter(p => p.id !== player.id).map(p => p.wins || 0))
      if (myWins > 0 && myWins > othersMax) return Math.min(90, base + 20)
    }
    return base
  }
  const isInBattle = battle && (battle.attackerId === activeId || battle.defenderId === activeId)
  const isAttacker = battle?.attackerId === activeId

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

  const isTransformed = myChar?.transformation != null && (me?.hp ?? 100) <= (myChar.transformation.triggersAt ?? 999)
  const transformedChar = isTransformed ? { ...myChar, ...myChar.transformation } : myChar
  const baseDiceType = isTransformed ? (myChar.transformation.diceType ?? myChar.diceType ?? 6)
    : (myChar?.diceType ?? 6)
  const effectiveDiceType =
    me?.luckCards?.dice_d20          ? 20
    : me?.luckCards?.dice_d12_until_12 ? 12
    : me?.luckCards?.dice_d8           ? 8
    : baseDiceType

  // Active controlled player (tester feature)
  const activeP    = players.find(p => p.id === activeId) ?? me
  const isParalyzed = !!(activeP?.paralyzedUntil != null && (activeP?.turn ?? 1) <= activeP.paralyzedUntil)
  const activeChar = characters.find(c => c.id === activeP?.characterId) ?? myChar
  const activeIsTransformed = activeChar?.transformation != null && (activeP?.hp ?? 100) <= (activeChar.transformation.triggersAt ?? 999)
  const activeBaseDiceType = activeIsTransformed ? (activeChar.transformation.diceType ?? activeChar.diceType ?? 6) : (activeChar?.diceType ?? 6)
  const activeEffectiveDiceType =
    activeP?.luckCards?.dice_d20          ? 20
    : activeP?.luckCards?.dice_d12_until_12 ? 12
    : activeP?.luckCards?.dice_d8           ? 8
    : activeBaseDiceType

  function rollDice() {
    if (rolling || myRoll !== null || !activeChar) return
    setRolling(true)
    const forgeBonus = activeP?.forgeItem?.diceBonus ?? 0
    let ticks = 0
    const interval = setInterval(() => {
      ticks++
      setMyRoll(Math.ceil(Math.random() * activeEffectiveDiceType))
      if (ticks >= 12) {
        clearInterval(interval)
        const base = Math.ceil(Math.random() * activeEffectiveDiceType)
        const final = base + forgeBonus
        setMyRoll(final)
        setRolling(false)
        submitRoll(roomCode, activeId, final, activeP?.preB ?? false, activeP?.forgeItem ?? null)
      }
    }, 80)
  }

  const villainBattle = room.villainBattle
  const isInVillainBattle = villainBattle?.playerId === activeId
  const activeVillain = villainBattle ? villains.find(v => v.id === villainBattle.villainId) : null
  const villainHp = room.villainHp ?? {}

  function rollDiceVillain() {
    if (villainRolling || myVillainRoll !== null || !activeChar) return
    setVillainRolling(true)
    const forgeBonus = activeP?.forgeItem?.diceBonus ?? 0
    let ticks = 0
    const interval = setInterval(() => {
      ticks++
      if (ticks >= 12) {
        clearInterval(interval)
        const base = Math.ceil(Math.random() * activeEffectiveDiceType)
        const v = base + forgeBonus
        setMyVillainRoll(v)
        setVillainRolling(false)
        submitVillainRoll(roomCode, activeId, v, activeP?.forgeItem ?? null, activeP?.preB ?? false)
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
    const iAmAttacker = result.attackerId === activeId
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

  // Mission victory overlay — shown to ALL players
  if (missionWinner) {
    const isMe = missionWinner.playerId === playerId
    const winnerChar = players.find(p => p.id === missionWinner.playerId)
    const winnerCharData = characters.find(c => c.id === winnerChar?.characterId)
    return (
      <div className="mission-victory-overlay">
        <div className="mission-victory-box">
          <div className="mission-victory-icon">{winnerCharData?.typeIcon ?? '🎯'}</div>
          <h1 className="mission-victory-title" style={{ color: winnerCharData?.color ?? '#FFD700' }}>
            {missionWinner.playerName}
          </h1>
          <p className="mission-victory-sub">cumpriu a missão</p>
          <p className="mission-victory-mission">"{missionWinner.missionName}"</p>
          {isMe && <p className="mission-victory-trophy">🏆 Troféu desbloqueado!</p>}
          <button className="mission-victory-btn" onClick={onLeave}>Voltar ao início</button>
        </div>
      </div>
    )
  }

  // PvP last-player-standing victory overlay
  if (pvpWinner) {
    const isMe = pvpWinner.playerId === playerId
    const winnerChar = players.find(p => p.id === pvpWinner.playerId)
    const winnerCharData = characters.find(c => c.id === winnerChar?.characterId)
    return (
      <div className="mission-victory-overlay">
        <div className="mission-victory-box">
          <div className="mission-victory-icon">{winnerCharData?.typeIcon ?? '⚔️'}</div>
          <h1 className="mission-victory-title" style={{ color: winnerCharData?.color ?? '#FFD700' }}>
            {pvpWinner.playerName}
          </h1>
          <p className="mission-victory-sub">{isMe ? 'você venceu!' : 'venceu a batalha!'}</p>
          {isMe && <p className="mission-victory-trophy">+1 vitória registrada!</p>}
          <button className="mission-victory-btn" onClick={onLeave}>Voltar ao início</button>
        </div>
      </div>
    )
  }

  if (bossKillWinner) {
    const isMe = bossKillWinner.playerId === playerId
    const winnerChar = players.find(p => p.id === bossKillWinner.playerId)
    const winnerCharData = characters.find(c => c.id === winnerChar?.characterId)
    return (
      <div className="mission-victory-overlay">
        <div className="mission-victory-box">
          <div className="mission-victory-icon">☠️</div>
          <h1 className="mission-victory-title" style={{ color: winnerCharData?.color ?? '#FFD700' }}>
            {bossKillWinner.playerName}
          </h1>
          <p className="mission-victory-sub">derrotou 3 Vilões!</p>
          <p className="mission-victory-mission">{isMe ? 'Você venceu o jogo!' : 'venceu o jogo!'}</p>
          {isMe && <p className="mission-victory-trophy">+1 vitória registrada!</p>}
          <button className="mission-victory-btn" onClick={onLeave}>Voltar ao início</button>
        </div>
      </div>
    )
  }

  // Death screen — shown only to the player who just died (dismissed = watching mode)
  if (me && !me.alive && me.killedBy && !deathDismissed) {
    const { type, name } = me.killedBy
    return (
      <div className="death-overlay">
        <div className="death-box">
          <div className="death-icon">💀</div>
          <h1 className="death-title">Você foi eliminado</h1>
          <p className="death-by">
            {type === 'villain' ? `pelo vilão ${name}` : `por ${name}`}
          </p>
          <div className="death-btns">
            <button className="death-btn death-btn--watch" onClick={() => setDeathDismissed(true)}>
              👁 Continuar assistindo
            </button>
            <button className="death-btn death-btn--leave" onClick={onLeave}>
              ← Sair
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`game-page ${shaking ? 'game-page--shake' : ''}`}>
      {shaking && flashColor && (
        <div className="game-flash" style={{ '--fc': flashColor }} />
      )}

      {confirmLeave && (
        <ConfirmModal onConfirm={handleLeave} onCancel={() => setConfirmLeave(false)} />
      )}

      {showAbility && <AbilityModal char={myChar} onClose={() => setShowAbility(false)} />}

      {trapTarget && (
        <div className="trap-overlay">
          <div className="trap-modal">
            <div className="trap-modal__header">🃏 Detonar Carta Explosiva</div>
            <p className="trap-modal__sub">Escolha o alvo (+3 de dano):</p>
            <div className="trap-modal__targets">
              {players.filter(p => p.id !== playerId && p.alive).map(p => {
                const pChar = characters.find(c => c.id === p.characterId)
                return (
                  <button
                    key={p.id}
                    className="trap-target-btn"
                    style={{ '--pc': pChar?.color ?? '#888' }}
                    onClick={() => { triggerTrapCard(roomCode, playerId, p.id); setTrapTarget(false) }}
                  >
                    {pChar?.typeIcon ?? '⚔️'} {p.name}
                    <span className="trap-target-hp">{p.hp} HP</span>
                  </button>
                )
              })}
            </div>
            <button className="trap-modal__cancel" onClick={() => setTrapTarget(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {bombDetonate && (
        <BombModal
          target={bombDetonate}
          villainList={villains.filter(v => (villainHp[v.id] ?? v.hp) > 0)}
          onConfirm={(villainId, xmenPresent) => detonateBomb(roomCode, bombDetonate.playerId, villainId, xmenPresent)}
          onClose={() => setBombDetonate(null)}
        />
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <span className="game-room">SALA: <strong>{roomCode}</strong></span>
        {isTester && activeControllerId && (
          <span className="topbar-controlling">
            🎮 {activeP?.name}
            <button className="topbar-controlling__clear" onClick={() => setActiveControllerId(null)}>✕</button>
          </span>
        )}
        {(battle || villainBattle) && (
          <button className="game-clearbattle" onClick={() => clearBattle(roomCode)} title="Limpar batalha travada">🗑️ Limpar</button>
        )}
        <button className="game-leave" onClick={() => setConfirmLeave(true)}>Sair</button>
      </div>

      {/* My card */}
      {me && myChar && (
        <div className="game-mycard" style={{ '--accent': transformedChar.color }}>
          <div className="game-mycard__img-wrap" onClick={() => setShowAbility(true)} style={{ cursor: 'pointer' }} title="Ver habilidades">
            <img src={myChar.image} alt={myChar.name} onError={e => { e.target.style.display = 'none' }} />
            <span className="game-mycard__fallback">{myChar.name.charAt(0)}</span>
            <span className="game-mycard__ability-hint">📖</span>
          </div>
          <div className="game-mycard__info">
            <span className="game-mycard__char" style={{ color: transformedChar.color }}>
              {isTransformed ? transformedChar.name : myChar.name}
              {isTransformed && <span className="transformation-badge"> {transformedChar.typeIcon}</span>}
              {' '}<span className="player-wins-count">({me.wins || 0})</span>
            </span>
            <span className="game-mycard__player">{me.name} · D{effectiveDiceType}{isTransformed ? ' ⬆️' : ''}</span>
            <div className="game-mycard__hprow">
              <div className="game-hp-bar">
                <div
                  className="game-hp-bar__fill"
                  style={{ width: `${me.hp}%`, background: me.hp < 30 ? '#ff2222' : me.hp < 60 ? '#ffaa00' : '#44cc66' }}
                />
              </div>
              <span className="game-hp-label" style={{ color: me.hp < 30 ? '#ff4444' : me.hp < 60 ? '#ffaa00' : '#ff8888' }}>
                ❤️ {me.hp}
              </span>
            </div>
            <div className="player-tokens">
              <span className="player-tokens__coins"><span className="xtoken" aria-label="token">X</span> ×{me.tokens || 0}</span>
              {myChar.ability && getEffectiveChance(me) > 0 && <span className="player-tokens__chance">{getEffectiveChance(me)}%</span>}
              {myChar.ability && (
                <span className="player-tokens__ability">
                  {myChar.id === 7 && me.absorbedAbility ? me.absorbedAbility.name : myChar.ability.name}
                </span>
              )}
              {isHost && (
                <>
                  <button className="give-token-btn" onClick={() => giveToken(roomCode, me.id)} title="Dar token">+</button>
                  <button className="give-token-btn give-token-btn--remove" onClick={() => removeToken(roomCode, me.id)} title="Gastar token" disabled={(me.tokens || 0) === 0}>−</button>
                  <button className="give-token-btn give-token-btn--heal" onClick={() => healPlayer(roomCode, me.id)} title="+2 HP" disabled={me.hp >= 100}>🔥</button>
                  <button className="give-token-btn give-token-btn--domino-plus" onClick={() => dominoHp(roomCode, me.id, 10)} title="Domino +10 HP" disabled={me.hp >= 100}>+10</button>
                  <button className="give-token-btn give-token-btn--domino-minus" onClick={() => dominoHp(roomCode, me.id, -10)} title="Domino −10 HP" disabled={(me.hp || 0) <= 0}>−10</button>
                </>
              )}
              {myChar?.id === 6 && (me.trapCards || 0) > 0 && (
                <button
                  className="give-token-btn give-token-btn--trap"
                  onClick={() => setTrapTarget(true)}
                  title={`Detonar Carta Explosiva (${me.trapCards})`}
                >
                  🃏{me.trapCards > 1 && <span className="trap-mini-count">{me.trapCards}</span>}
                </button>
              )}
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
            {myChar?.abilityB && (myChar.abilityB.effect !== 'B_MOVEMENT' || myChar.id === 7) && (
              <button
                className={`my-b-btn ${myChar.id !== 6 && me.preB ? 'my-b-btn--on' : ''}`}
                onClick={() => {
                  if (myChar.id === 6) {
                    addTrapCard(roomCode, playerId)
                    resetBattleState(roomCode, playerId, true, me?.turn ?? 1)
                  } else {
                    togglePreB(roomCode, playerId)
                  }
                }}
                disabled={
                  myChar.id === 6
                    ? (me.preBUsedOnTurn ?? 0) === (me.turn ?? 1) || !!me.luckCards?.disable_abilities
                    : myChar.id === 7
                    ? (battle?.attackerId === playerId) || // Vampira can't flee when she's the one attacking
                      (!me.preB && (me.preBUsedOnTurn ?? 0) === (me.turn ?? 1)) ||
                      !!me.luckCards?.disable_abilities
                    : !!isInBattle || (!me.preB && (me.preBUsedOnTurn ?? 0) === (me.turn ?? 1)) || !!me.luckCards?.disable_abilities
                }
              >
                <span className="my-b-btn__tag">[B]</span>
                <span className="my-b-btn__name">{myChar.abilityB.name}</span>
                {myChar.id !== 6 && me.preB && <span className="my-b-btn__check">✓</span>}
              </button>
            )}
            {myChar.abilityC && (
              <div className="player-c-row">
                <span className="player-c-label">[C] {myChar.abilityC.name}</span>
                <span className={`player-c-cond ${isCConditionMet(me, myChar, players) ? 'player-c-cond--met' : ''}`}>
                  {cConditionLabel(myChar.abilityC.condition)}
                </span>
                {me.luckCards?.disable_abilities
                  ? <span className="player-c-active" style={{ background: '#660000' }}>BLOQUEADO</span>
                  : isCConditionMet(me, myChar, players) && <span className="player-c-active">ATIVO</span>}
              </div>
            )}
            {myChar.id === 7 && me.absorbedAbility && (
              <div className="player-stolen-row">
                <span className="player-stolen-label">💫 Copiado:</span>
                <span className="player-stolen-name">{me.absorbedAbility.name}</span>
              </div>
            )}
            {myChar.id === 7 && me.stolenAbility && (
              <div className="player-stolen-row">
                <span className="player-stolen-label">🩸 Roubado:</span>
                <span className="player-stolen-name">{me.stolenAbility.name}</span>
                <span className="player-stolen-charges">{me.stolenAbility.rounds}🔄</span>
                {me.stolenAbility.queue != null && Object.keys(me.stolenAbility.queue).length > 0 && (
                  <span className="player-stolen-charges">+{Object.keys(me.stolenAbility.queue).length} fila</span>
                )}
              </div>
            )}
            {me.abilityDisabled && (
              <div className="player-ability-stolen">🩸 [A] roubada pela Vampira</div>
            )}
            {me.forgeItem && me.forgeItem.id !== 1 && (
              <div className="player-forge-item">
                {me.forgeItem.icon} {me.forgeItem.name}{me.forgeItem.diceBonus > 0 ? ` (+${me.forgeItem.diceBonus} dado)` : ''}
                {me.forgeItem.id !== 5 && (
                  <span className="forge-charge-counter">{5 - (me.forgeItem.charges ?? 5)}/5</span>
                )}
                {isHost && <button className="forge-clear-btn" onClick={() => clearForgeItem(roomCode, me.id)}>✕</button>}
              </div>
            )}
            {me.luckCards && Object.values(me.luckCards).map(card => (
              <div key={card.effect} className="player-luck-card">
                {card.icon} {card.name}
                {card.charges != null ? ` — ${card.charges}×` : card.description ? ` — ${card.description}` : ''}
                {isHost && <button className="forge-clear-btn" onClick={() => clearLuckCard(roomCode, me.id, card.effect)}>✕</button>}
              </div>
            ))}
            {me.missionId && (
              <div className="player-mission">
                <span className="player-mission__label">🎯</span>
                {missionHidden ? (
                  <>
                    <span className="player-mission__name" style={{ color: '#666' }}>oculta</span>
                    <button className="mission-toggle-btn" onClick={() => setMissionHidden(h => !h)}>👁</button>
                  </>
                ) : (
                  <>
                    <span className={`player-mission__name ${me.missionCompleted ? 'player-mission__name--done' : ''}`}>
                      {MISSIONS.find(m => m.id === me.missionId)?.name}
                    </span>
                    {(() => {
                      const myMission = MISSIONS.find(m => m.id === me.missionId)
                      const goal = myMission?.goal ?? 1
                      const progress = me.missionProgress ?? 0
                      const isManualMulti = myMission?.auto === null && goal > 1
                      return (
                        <>
                          {goal > 1 && (
                            <span className="player-mission__progress">{progress}/{goal}</span>
                          )}
                          {me.missionCompleted && <span className="player-mission__done">✓</span>}
                          {isManualMulti && !me.missionCompleted && (
                            <button className="mission-increment-btn" onClick={() => incrementMissionProgress(roomCode, me.id)}>
                              +1
                            </button>
                          )}
                          {isHost && !me.missionCompleted && myMission?.auto === null && goal === 1 && (
                            <button className="mission-complete-btn" onClick={() => completeMission(roomCode, me.id)}>✓ Concluir</button>
                          )}
                        </>
                      )
                    })()}
                    <button className="mission-toggle-btn" onClick={() => setMissionHidden(h => !h)}>🙈</button>
                  </>
                )}
              </div>
            )}
            <div className={`boss-kills-row ${(me.bossKills || 0) >= 3 ? 'boss-kills-row--full' : ''}`}>
              ☠️ {me.bossKills || 0}/3 Vilões
            </div>
            {isParalyzed && (
              <div className="paralyzed-banner">
                🔵 Paralizado por {(activeP?.paralyzedUntil ?? 0) - (activeP?.turn ?? 1) + 1} rodada(s)
                {isHost && <button className="paralyze-clear-btn" onClick={() => removeParalysis(roomCode, activeP?.id ?? playerId)}>✕ desbloquear</button>}
              </div>
            )}
            {me?.bomb && (
              <div className="bomb-row">
                <span className="bomb-row__icon">💣</span>
                <div className="bomb-counter">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`bomb-pip ${n <= me.bomb.counter ? 'bomb-pip--lit' : ''}`} />
                  ))}
                </div>
                <span className="bomb-counter__val">{me.bomb.counter}/5</span>
                {isHost && me.bomb.counter < 5 && (
                  <button className="bomb-tick-btn" onClick={() => tickBomb(roomCode, me.id)}>+1</button>
                )}
                {isHost && me.bomb.counter >= 5 && (
                  <button className="bomb-explode-btn" onClick={() => setBombDetonate({ playerId: me.id, playerName: me.name })}>
                    💥 Explodir
                  </button>
                )}
                {isHost && (
                  <button className="bomb-remove-btn" onClick={() => removeBomb(roomCode, me.id)} title="Remover bomba">✕</button>
                )}
              </div>
            )}
            {isHost && (
              <div className="forge-luck-row">
                <button className="forge-btn" onClick={() => { setForgeTarget(t => t === me.id ? null : me.id); setLuckTarget(null) }}>
                  🔨 Forge{forgeTarget === me.id ? ' ▲' : ' ▼'}
                </button>
                <button className="luck-btn" onClick={() => { setLuckTarget(t => t === me.id ? null : me.id); setForgeTarget(null) }}>
                  🃏 Sorte{luckTarget === me.id ? ' ▲' : ' ▼'}
                </button>
              </div>
            )}
            {forgeTarget === me.id && (
              <div className="forge-picker">
                {FORGE_ITEMS.map(item => (
                  <button key={item.id} className="forge-item-btn" onClick={() => {
                    if (item.id === 5) assignBomb(roomCode, me.id)
                    else giveForgeItem(roomCode, me.id, item)
                    setForgeTarget(null)
                  }}>
                    <span className="forge-item-btn__num">{item.id}</span>
                    <span className="forge-item-btn__icon">{item.icon}</span>
                    <span className="forge-item-btn__name">{item.name}</span>
                    {item.diceBonus > 0 && <span className="forge-item-btn__bonus">+{item.diceBonus}</span>}
                  </button>
                ))}
              </div>
            )}
            {luckTarget === me.id && (
              <div className="luck-picker">
                {LUCK_CARDS.map(card => (
                  <button key={card.id} className="luck-card-btn" onClick={() => {
                    applyLuckCard(roomCode, me.id, card)
                    setLuckTarget(null)
                  }}>
                    <span className="luck-card-btn__num">{card.id}</span>
                    <span className="luck-card-btn__icon">{card.icon}</span>
                    <span className="luck-card-btn__name">{card.name}</span>
                  </button>
                ))}
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
        const attBonus = result.attackerForgeBonus ?? 0
        const defBonus = result.defenderForgeBonus ?? 0
        const attCBonus = result.attackerCBonus ?? 0
        const defCBonus = result.defenderCBonus ?? 0
        const attBase  = (attBonus > 0 || attCBonus > 0) ? result.attackerRoll - attBonus - attCBonus : null
        const defBase  = (defBonus > 0 || defCBonus > 0) ? result.defenderRoll - defBonus - defCBonus : null
        return (
          <div className={`game-result ${iLost ? 'game-result--lose' : iWon ? 'game-result--win' : 'game-result--tie'}`}>
            <div className="game-result__rolls">
              <span style={{ color: attChar?.color }}>
                {attBase != null
                  ? <>{face(attBase, attChar?.diceType ?? 6)}
                      {attBonus > 0 && <span className="forge-bonus-label">+{attBonus}⚔️</span>}
                      {attCBonus > 0 && <span className="forge-bonus-label">+{attCBonus}[C]</span>}
                    </>
                  : face(result.attackerRoll, attChar?.diceType ?? 6)}
              </span>
              <span className="game-result__vs">VS</span>
              <span style={{ color: defChar?.color }}>
                {defBase != null
                  ? <>{face(defBase, defChar?.diceType ?? 6)}
                      {defBonus > 0 && <span className="forge-bonus-label">+{defBonus}⚔️</span>}
                      {defCBonus > 0 && <span className="forge-bonus-label">+{defCBonus}[C]</span>}
                    </>
                  : face(result.defenderRoll, defChar?.diceType ?? 6)}
              </span>
            </div>
            {(result.attackerForgeId === 4 || result.defenderForgeId === 4) && (
              <p className="ability-activated">🛡️ Escudo do Capitão — dano reduzido pela metade!</p>
            )}
            <p>
              {tied  && '⚖️ Empate — ninguém toma dano'}
              {iLost && `💥 Você perdeu! −${result.damage} HP`}
              {iWon  && `🏆 Você venceu! Oponente −${result.damage} HP`}
            </p>
            {activatedAbilityLabel && (
              <p className="ability-activated">⚡ {activatedAbilityLabel}</p>
            )}
            {result?.psychicTarget && (
              <p className="ability-activated">🧠 Dano Psíquico → {result.psychicTarget.name} −3 HP</p>
            )}
            {result?.paralysisInfo && (
              <p className="ability-activated">🔵 {result.paralysisInfo.name} paralizado por {result.paralysisInfo.turns} rodada(s)!</p>
            )}
            {(result?.phoenixReflect ?? 0) > 0 && iWon && (
              <p className="ability-activated">🔥 Chama Fênix — você sofreu −{result.phoenixReflect} HP de reflexo!</p>
            )}
            {(result?.phoenixReflect ?? 0) > 0 && iLost && (
              <p className="ability-activated">🔥 Chama Fênix — oponente sofreu −{result.phoenixReflect} HP de reflexo!</p>
            )}
          </div>
        )
      })()}

      {/* Flee result banner */}
      {result?.fled && (
        <div className={`game-result ${result.fled === playerId ? 'game-result--tie' : 'game-result--win'}`}>
          <p>
            {result.fled === playerId
              ? '🕊️ Você fugiu — nenhum dano'
              : '🕊️ Vampira fugiu — batalha cancelada'}
          </p>
        </div>
      )}

      {/* Vampira [C] Toque Vampírico — optional steal prompt */}
      {pendingVampiraSteal && myChar?.id === 7 && me?.alive && (
        <div className="vampira-steal-prompt">
          <div className="vampira-steal-prompt__header">
            <span>🩸 Toque Vampírico disponível</span>
            <button className="vampira-steal-prompt__close" onClick={() => setPendingVampiraSteal(null)}>✕</button>
          </div>
          <div className="vampira-steal-prompt__body">
            <span className="vampira-steal-prompt__ability">{pendingVampiraSteal.opponentAbility.name}</span>
            <span className="vampira-steal-prompt__cost">Custo: 2 tokens + 3 HP → 3 batalhas</span>
            {me.stolenAbility && (
              <span className="vampira-steal-prompt__queue">
                {me.stolenAbility.ownerId === pendingVampiraSteal.opponentId
                  ? `Mesmo alvo: acumula (+3 rodadas ao atual ${me.stolenAbility.rounds}🔄)`
                  : `Vai para fila · atual: ${me.stolenAbility.name} (${me.stolenAbility.rounds}🔄)`}
              </span>
            )}
          </div>
          <button
            className="vampira-steal-prompt__btn"
            disabled={(me.tokens || 0) < 2 || !!me.luckCards?.disable_abilities}
            onClick={() => vampiraStealAbility(roomCode, playerId, pendingVampiraSteal.opponentId, pendingVampiraSteal.opponentAbility)}
          >
            🩸 Roubar ({me.tokens || 0} tokens disponíveis)
          </button>
        </div>
      )}

      {/* Villain result banner */}
      {villainResult && villainResult.vPlayerId === playerId && (
        <div className={`game-result ${villainResult.playerWon ? 'game-result--win' : villainResult.tied ? 'game-result--tie' : 'game-result--lose'}`}>
          {(() => {
            const vColor = villains.find(v => v.id === villainResult.villainId)?.color
            const vDt = villains.find(v => v.id === villainResult.villainId)?.diceType ?? 6
            return (
              <>
                <div className="game-result__rolls">
                  <span style={{ color: myChar?.color }}>
                    {(() => {
                      const fBonus = villainResult.playerForgeBonus ?? 0
                      const bBonus = villainResult.playerBBonus ?? 0
                      const cBonus = villainResult.playerCBonus ?? 0
                      const base = villainResult.playerRoll - fBonus
                      return (fBonus > 0 || bBonus > 0 || cBonus > 0)
                        ? <>{face(base, myChar?.diceType ?? 6)}
                            {fBonus > 0 && <span className="forge-bonus-label">+{fBonus}⚔️</span>}
                            {bBonus > 0 && <span className="forge-bonus-label">+{bBonus}[B]</span>}
                            {cBonus > 0 && <span className="forge-bonus-label">+{cBonus}[C]</span>}
                          </>
                        : face(villainResult.playerRoll, myChar?.diceType ?? 6)
                    })()}
                  </span>
                  <span className="game-result__vs">VS</span>
                  <span style={{ color: vColor }}>
                    {villainResult.villainRoll2 != null
                      ? <>{villainResult.villainRoll2} <strong style={{ fontSize: '1.3em' }}>{villainResult.villainRoll}</strong></>
                      : villainResult.villainRoll}
                  </span>
                </div>
                {villainResult.villainRoll2 != null && (
                  <p className="game-result__dice-note" style={{ color: vColor }}>
                    🎲 dados: {villainResult.villainRoll2} e {villainResult.villainRoll} → usa o maior ({villainResult.villainRoll})
                  </p>
                )}
                <p>
                  {villainResult.tied  && '⚖️ Empate — ninguém toma dano'}
                  {villainResult.playerWon && !villainResult.absorbed && `🏆 Você venceu! ${villainResult.effectivePlayerRoll} > ${villainResult.villainRoll} → Vilão −${villainResult.damage} HP`}
                  {villainResult.playerWon && villainResult.absorbed  && `🛡️ Dano absorvido! ${villainResult.effectivePlayerRoll} > ${villainResult.villainRoll} — Juggernaut bloqueou o ataque`}
                  {!villainResult.playerWon && !villainResult.tied && `💥 Você perdeu! ${villainResult.villainRoll} > ${villainResult.effectivePlayerRoll} → −${villainResult.damage} HP`}
                  {villainResult.playerForgeId === 4 && !villainResult.playerWon && !villainResult.tied && (
                    <span className="ability-activated"> 🛡️ Escudo do Capitão — dano reduzido à metade!</span>
                  )}
                  {villainResult.abilityActivated && (
                    <span className="ability-activated"> ⚡ {villainResult.abilityActivated} ativado!</span>
                  )}
                  {villainResult.playerBName && (
                    <span className="ability-activated"> ⚡ {villainResult.playerBName} ativado!</span>
                  )}
                </p>
                {(villainResult.phoenixReflect ?? 0) > 0 && (
                  <p className="ability-activated">🔥 Chama Fênix — vilão sofreu −{villainResult.phoenixReflect} HP de reflexo!</p>
                )}
                {villainResult.psychicTarget && (
                  <p className="ability-activated">🧠 Dano Psíquico → {villainResult.psychicTarget.name} −3 HP</p>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Villain battle panel */}
      {isInVillainBattle && villainBattle && (
        <div className="battle-panel">
          <h3 className="battle-panel__title">⚔️ Enfrentando {activeVillain?.name}!</h3>
          <div className="battle-cards">
            <div className="battle-char battle-char--att" style={{ '--cc': activeChar?.color }}>
              <div className="battle-char__img-wrap">
                <img src={activeChar?.image} alt={activeChar?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="battle-char__fallback">{activeChar?.name?.charAt(0)}</span>
              </div>
              <span className="battle-char__name" style={{ color: activeChar?.color }}>{activeChar?.name}</span>
            </div>
            <div className="battle-cards__vs">VS</div>
            <div className="battle-char battle-char--def" style={{ '--cc': activeVillain?.color }}>
              <div className="battle-char__img-wrap">
                <img src={activeVillain?.image} alt={activeVillain?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="battle-char__fallback">{activeVillain?.typeIcon}</span>
              </div>
              <span className="battle-char__name" style={{ color: activeVillain?.color }}>{activeVillain?.name}</span>
            </div>
          </div>
          <div className="battle-panel__row">
            <div className="battle-panel__side">
              <span className="battle-panel__label">{activeP?.name ?? 'Você'} · D{activeEffectiveDiceType}</span>
              <DiceFace
                value={villainBattle.playerRoll ?? myVillainRoll}
                diceType={activeEffectiveDiceType}
                color={activeChar?.color ?? '#FFD700'}
                rolling={villainRolling}
              />
              {villainBattle.playerRoll == null && myVillainRoll === null && !villainRolling && (
                <button className="battle-roll-btn" style={{ '--c': activeChar?.color }} onClick={rollDiceVillain}>
                  🎲 Rolar
                </button>
              )}
            </div>
            <span className="battle-panel__vs">VS</span>
            <div className="battle-panel__side">
              <span className="battle-panel__label">
                {activeVillain?.name} · D{activeVillain?.diceType}
                {villainBattle.villainRoll2 != null && ' (2 dados)'}
              </span>
              <div className="villain-dice-pair">
                <DiceFace
                  value={villainRolling ? null : (villainDiceDisplay ?? villainBattle.villainRoll ?? null)}
                  diceType={activeVillain?.diceType ?? 6}
                  color={activeVillain?.color ?? '#888'}
                  rolling={villainRolling}
                  selected={!villainRolling && villainBattle.villainRoll != null && villainBattle.villainRoll2 != null}
                />
                {villainBattle.villainRoll2 != null && (
                  <DiceFace
                    value={villainRolling ? null : (villainDiceDisplay2 ?? villainBattle.villainRoll2 ?? null)}
                    diceType={activeVillain?.diceType ?? 6}
                    color={activeVillain?.color ?? '#888'}
                    rolling={villainRolling}
                    selected={false}
                  />
                )}
              </div>
              {villainBattle.villainRoll == null && !villainRolling && (
                <span className="battle-panel__waiting">aguardando…</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Battle panel — full card view when in battle */}
      {isInBattle && battle && (
        <div className="battle-panel">
          <h3 className="battle-panel__title">
            {isAttacker ? `⚔️ ${activeP?.name ?? 'Você'} está atacando!` : `🛡️ ${activeP?.name ?? 'Você'} foi atacado!`}
          </h3>

          {/* Character cards */}
          <div className="battle-cards">
            <div className="battle-char battle-char--att" style={{ '--cc': activeChar?.color }}>
              <div className="battle-char__img-wrap">
                <img src={activeChar?.image} alt={activeChar?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="battle-char__fallback">{activeChar?.name?.charAt(0)}</span>
              </div>
              <span className="battle-char__name" style={{ color: activeChar?.color }}>{activeChar?.name}</span>
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
              <span className="battle-panel__label">{activeP?.name ?? 'Você'} · D{activeEffectiveDiceType}</span>
              <DiceFace value={myBattleRoll ?? myRoll} diceType={activeEffectiveDiceType} color={activeChar?.color ?? '#FFD700'} rolling={rolling} />
              {myBattleRoll == null && myRoll === null && (
                <button className="battle-roll-btn" style={{ '--c': activeChar?.color }} onClick={rollDice} disabled={rolling}>
                  {rolling ? '…' : '🎲 Rolar'}
                </button>
              )}
            </div>
            <span className="battle-panel__vs">VS</span>
            <div className="battle-panel__side">
              <span className="battle-panel__label">{battleOpponent?.name} · D{battleOpponentChar?.diceType}</span>
              <DiceFace
                value={oppRolling ? oppDisplayRoll : oppBattleRoll}
                diceType={battleOpponentChar?.diceType ?? 6}
                color={battleOpponentChar?.color ?? '#888'}
                rolling={oppRolling}
              />
              {oppBattleRoll == null && !oppRolling && <span className="battle-panel__waiting">aguardando…</span>}
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
                {side.char?.abilityB && side.char.abilityB.effect !== 'B_TRAP_CARD' && (side.char.abilityB.effect !== 'B_MOVEMENT' || side.char?.id === 7) ? (
                  side.pid === activeId ? (
                    // Own side — interactive toggle
                    <button
                      className={`host-b-btn ${side.player?.preB ? 'host-b-btn--on' : ''}`}
                      onClick={() => togglePreB(roomCode, side.pid)}
                      disabled={
                        (side.char?.id === 7 && battle?.attackerId === side.pid) || // Vampira can't flee as attacker
                        (!side.player?.preB && (side.player?.preBUsedOnTurn ?? 0) === (side.player?.turn ?? 1))
                      }
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

      {/* Tester: seletor de vez de atacar */}
      {isTester && players.filter(p => p.alive).length > 0 && (
        <div className="turn-selector">
          <span className="turn-selector__label">Vez de:</span>
          <div className="turn-selector__btns">
            {players.filter(p => p.alive).map(p => {
              const c = characters.find(ch => ch.id === p.characterId)
              const isActive = activeId === p.id
              return (
                <button
                  key={p.id}
                  className={`turn-sel-btn ${isActive ? 'turn-sel-btn--on' : ''}`}
                  style={{ '--tc': c?.color ?? '#FFD700' }}
                  onClick={() => setActiveControllerId(isActive ? null : p.id === playerId ? null : p.id)}
                >
                  {c?.typeIcon ?? '?'} {p.name}
                </button>
              )
            })}
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
            <div key={p.id} className={`opponent-row ${isTester && activeId === p.id ? 'opponent-row--active' : ''}`}>
              <div className="opponent-row__img-wrap">
                <img src={char?.image} alt={char?.name} onError={e => { e.target.style.display = 'none' }} />
                <span className="opponent-row__fallback" style={{ color: char?.color }}>{char?.name?.charAt(0)}</span>
              </div>
              <div className="opponent-row__info">
                <span className="opponent-row__name">{p.name}</span>
                <span className="opponent-row__char" style={{ color: char?.color }}>
                  {char?.typeIcon} {char?.name} · D{
                    p.luckCards?.dice_d20          ? 20
                    : p.luckCards?.dice_d12_until_12 ? 12
                    : p.luckCards?.dice_d8           ? 8
                    : (char?.transformation != null && (p.hp ?? 100) <= (char.transformation.triggersAt ?? 999) ? (char.transformation.diceType ?? char.diceType ?? 6) : (char?.diceType ?? 6))
                  } <span className="player-wins-count">({p.wins || 0})</span>
                </span>
                <div className="opp-hp-bar">
                  <div style={{
                    width: `${p.hp}%`, height: '100%', borderRadius: '3px',
                    background: p.hp < 30 ? '#ff2222' : p.hp < 60 ? '#ffaa00' : '#44cc66',
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
                  <span className="player-tokens__coins"><span className="xtoken" aria-label="token">X</span> ×{p.tokens || 0}</span>
                  {char?.ability && getEffectiveChance(p) > 0 && <span className="player-tokens__chance">{getEffectiveChance(p)}%</span>}
                  {isHost && p.alive && (
                    <>
                      <button className="give-token-btn" onClick={() => giveToken(roomCode, p.id)} title="Dar token">+</button>
                      <button className="give-token-btn give-token-btn--remove" onClick={() => removeToken(roomCode, p.id)} title="Gastar token" disabled={(p.tokens || 0) === 0}>−</button>
                      <button className="give-token-btn give-token-btn--heal" onClick={() => healPlayer(roomCode, p.id)} title="+2 HP" disabled={p.hp >= 100}>🔥</button>
                      <button className="give-token-btn give-token-btn--domino-plus" onClick={() => dominoHp(roomCode, p.id, 10)} title="Domino +10 HP" disabled={p.hp >= 100}>+10</button>
                      <button className="give-token-btn give-token-btn--domino-minus" onClick={() => dominoHp(roomCode, p.id, -10)} title="Domino −10 HP">−10</button>
                    </>
                  )}
                </div>
                {char?.abilityC && (
                  <div className="player-c-row">
                    <span className="player-c-label">[C] {char.abilityC.name}</span>
                    <span className={`player-c-cond ${isCConditionMet(p, char, players) ? 'player-c-cond--met' : ''}`}>
                      {cConditionLabel(char.abilityC.condition)}
                    </span>
                    {isCConditionMet(p, char, players) && <span className="player-c-active">ATIVO</span>}
                  </div>
                )}
                {char?.id === 7 && p.absorbedAbility && (
                  <div className="player-stolen-row">
                    <span className="player-stolen-label">💫 Copiado:</span>
                    <span className="player-stolen-name">{p.absorbedAbility.name}</span>
                  </div>
                )}
                {char?.id === 7 && p.stolenAbility && (
                  <div className="player-stolen-row">
                    <span className="player-stolen-label">🩸 Roubado:</span>
                    <span className="player-stolen-name">{p.stolenAbility.name}</span>
                    <span className="player-stolen-charges">{p.stolenAbility.rounds}🔄</span>
                  </div>
                )}
                {p.abilityDisabled && (
                  <div className="player-ability-stolen">🩸 [A] roubada</div>
                )}
                {p.paralyzedUntil != null && (p.turn ?? 1) <= p.paralyzedUntil && (
                  <div className="player-paralyzed-tag">
                    🔵 Paralizado ({p.paralyzedUntil - (p.turn ?? 1) + 1} rodada(s))
                    {isHost && (
                      <button className="paralyze-clear-btn" onClick={() => removeParalysis(roomCode, p.id)}>✕ desbloquear</button>
                    )}
                  </div>
                )}
                {p.forgeItem && p.forgeItem.id !== 1 && (
                  <div className="player-forge-item">
                    {p.forgeItem.icon} {p.forgeItem.name}{p.forgeItem.diceBonus > 0 ? ` (+${p.forgeItem.diceBonus} dado)` : ''}
                    {p.forgeItem.id !== 5 && (
                      <span className="forge-charge-counter">{5 - (p.forgeItem.charges ?? 5)}/5</span>
                    )}
                    {isHost && <button className="forge-clear-btn" onClick={() => clearForgeItem(roomCode, p.id)}>✕</button>}
                  </div>
                )}
                {p.luckCards && Object.values(p.luckCards).map(card => (
                  <div key={card.effect} className="player-luck-card">
                    {card.icon} {card.name}
                    {card.charges != null ? ` — ${card.charges}×` : card.description ? ` — ${card.description}` : ''}
                    {isHost && <button className="forge-clear-btn" onClick={() => clearLuckCard(roomCode, p.id, card.effect)}>✕</button>}
                  </div>
                ))}
                {p.missionId && (
                  <div className="player-mission">
                    <span className="player-mission__label">🎯</span>
                    <span className={`player-mission__name ${p.missionCompleted ? 'player-mission__name--done' : ''}`}>
                      {p.missionCompleted ? MISSIONS.find(m => m.id === p.missionId)?.name : '???'}
                    </span>
                    {p.missionCompleted && <span className="player-mission__done">✓</span>}
                  </div>
                )}
                <div className={`boss-kills-row ${(p.bossKills || 0) >= 3 ? 'boss-kills-row--full' : ''}`}>
                  ☠️ {p.bossKills || 0}/3 Vilões
                </div>
                {isHost && (
                  <div className="forge-luck-row">
                    <button className="forge-btn" onClick={() => { setForgeTarget(t => t === p.id ? null : p.id); setLuckTarget(null) }}>
                      🔨 Forge{forgeTarget === p.id ? ' ▲' : ' ▼'}
                    </button>
                    <button className="luck-btn" onClick={() => { setLuckTarget(t => t === p.id ? null : p.id); setForgeTarget(null) }}>
                      🃏 Sorte{luckTarget === p.id ? ' ▲' : ' ▼'}
                    </button>
                  </div>
                )}
                {forgeTarget === p.id && (
                  <div className="forge-picker">
                    {FORGE_ITEMS.map(item => (
                      <button key={item.id} className="forge-item-btn" onClick={() => {
                        if (item.id === 5) assignBomb(roomCode, p.id)
                        else giveForgeItem(roomCode, p.id, item)
                        setForgeTarget(null)
                      }}>
                        <span className="forge-item-btn__num">{item.id}</span>
                        <span className="forge-item-btn__icon">{item.icon}</span>
                        <span className="forge-item-btn__name">{item.name}</span>
                        {item.diceBonus > 0 && <span className="forge-item-btn__bonus">+{item.diceBonus}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {luckTarget === p.id && (
                  <div className="luck-picker">
                    {LUCK_CARDS.map(card => (
                      <button key={card.id} className="luck-card-btn" onClick={() => {
                        applyLuckCard(roomCode, p.id, card)
                        setLuckTarget(null)
                      }}>
                        <span className="luck-card-btn__num">{card.id}</span>
                        <span className="luck-card-btn__icon">{card.icon}</span>
                        <span className="luck-card-btn__name">{card.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {p.bomb && (
                  <div className="bomb-row">
                    <span className="bomb-row__icon">💣</span>
                    <div className="bomb-counter">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className={`bomb-pip ${n <= p.bomb.counter ? 'bomb-pip--lit' : ''}`} />
                      ))}
                    </div>
                    <span className="bomb-counter__val">{p.bomb.counter}/5</span>
                    {isHost && p.bomb.counter < 5 && (
                      <button className="bomb-tick-btn" onClick={() => tickBomb(roomCode, p.id)}>+1</button>
                    )}
                    {isHost && p.bomb.counter >= 5 && (
                      <button className="bomb-explode-btn" onClick={() => setBombDetonate({ playerId: p.id, playerName: p.name })}>
                        💥 Explodir
                      </button>
                    )}
                    {isHost && (
                      <button className="bomb-remove-btn" onClick={() => removeBomb(roomCode, p.id)} title="Remover bomba">✕</button>
                    )}
                  </div>
                )}
              </div>
              <button
                className="attack-btn"
                style={{ '--c': char?.color ?? '#FFD700' }}
                onClick={() => { attackPlayer(roomCode, activeId, p.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={!!battle || inBattle || !activeP?.alive || p.id === activeId || isParalyzed}
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
          {villains.map(v => {
            const currentHp = villainHp[v.id] ?? v.hp
            const defeated = currentHp <= 0
            const hpPct = Math.max(0, (currentHp / v.hp) * 100)
            const needsUnlock = v.id === 1 || v.id === 2
            const isLocked = needsUnlock && !room.unlockedVillains?.[v.id]
            return (
              <div
                key={v.id}
                className={`villain-card villain-card--${v.difficulty} ${defeated ? 'villain-card--defeated' : ''} ${isLocked ? 'villain-card--locked' : ''}`}
                style={{ '--vcolor': v.color }}
              >
                <div className="villain-card__img-wrap">
                  <img src={v.image} alt={v.name} onError={e => { e.target.style.display = 'none' }} />
                  <span className="villain-card__fallback">{isLocked ? '🔒' : v.typeIcon}</span>
                </div>
                <div className="villain-card__info">
                  <div className="villain-card__header">
                    <span className="villain-card__name">{v.name} <span className="villain-card__dice">D{v.diceType}</span></span>
                    {(isLocked || defeated) && (
                      <span className="villain-card__diff">
                        {isLocked ? '🔒 Bloqueado' : (
                          <>💀 {room.villainKillers?.[v.id] ? `${room.villainKillers[v.id]}` : 'Derrotado'}</>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="villain-card__mechanic">{v.mechanic}</span>
                  {!isLocked && (
                    <div className="villain-card__hprow">
                      <div className="villain-hp-bar">
                        <div className="villain-hp-bar__fill" style={{ width: `${hpPct}%` }} />
                      </div>
                      <span className="villain-card__hp">❤️ {currentHp}/{v.hp}</span>
                    </div>
                  )}
                </div>
                <div className="villain-card__actions">
                  {isLocked ? (
                    isHost ? (
                      <button
                        className="villain-unlock-btn"
                        style={{ '--vc': v.color }}
                        onClick={() => unlockVillain(roomCode, v.id)}
                      >
                        🔓
                      </button>
                    ) : (
                      <button className="villain-attack-btn villain-attack-btn--locked" disabled>🔒</button>
                    )
                  ) : (
                    <button
                      className="villain-attack-btn"
                      style={{ '--vc': v.color }}
                      disabled={!!battle || (!!villainBattle && !villainBattle?.resolved) || !activeP?.alive || defeated || isParalyzed}
                      onClick={() => { attackVillain(roomCode, activeId, v.id); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                    >
                      ⚔️
                    </button>
                  )}
                  {isHost && !isLocked && !defeated && (
                    <button
                      className="villain-heal-btn"
                      title="+2 HP"
                      onClick={() => healVillain(roomCode, v.id, 2)}
                    >
                      🔥
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
