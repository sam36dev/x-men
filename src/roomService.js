import { db } from './firebase'
import {
  ref, set, get, update, remove,
  runTransaction,
} from 'firebase/database'
import { characters } from './data/characters'

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createRoom(playerId, playerName) {
  let code
  for (let i = 0; i < 10; i++) {
    code = genCode()
    const snap = await get(ref(db, `rooms/${code}`))
    if (!snap.exists()) break
  }
  await set(ref(db, `rooms/${code}`), {
    code,
    hostId: playerId,
    status: 'lobby',
    createdAt: Date.now(),
    players: {
      [playerId]: { name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0 },
    },
  })
  return code
}

export async function joinRoom(code, playerId, playerName) {
  const snap = await get(ref(db, `rooms/${code}`))
  if (!snap.exists()) throw new Error('Sala não encontrada')
  const room = snap.val()
  const count = Object.keys(room.players || {}).length
  if (count >= 8) throw new Error('Sala cheia (máximo 8 jogadores)')
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0,
  })
}

export async function selectCharacter(code, playerId, characterId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { characterId })
}

export async function startGame(code) {
  await update(ref(db, `rooms/${code}`), { status: 'playing' })
}

export async function leaveRoom(code, playerId) {
  await remove(ref(db, `rooms/${code}/players/${playerId}`))
}

export async function giveToken(code, targetPlayerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetPlayerId}/tokens`), (cur) => {
    return (cur || 0) + 1
  })
}

export async function attackPlayer(code, attackerId, defenderId) {
  await set(ref(db, `rooms/${code}/battle`), {
    attackerId,
    defenderId,
    resolved: false,
  })
}

export async function submitRoll(code, playerId, roll) {
  const battleRef = ref(db, `rooms/${code}/battle`)
  const snap = await get(battleRef)
  const battle = snap.val()
  if (!battle || battle.resolved) return

  const isAttacker = battle.attackerId === playerId
  const myKey = isAttacker ? 'attackerRoll' : 'defenderRoll'

  await update(ref(db), { [`rooms/${code}/battle/${myKey}`]: roll })

  const afterSnap = await get(battleRef)
  const after = afterSnap.val()
  if (!after || after.resolved) return
  if (after.attackerRoll != null && after.defenderRoll != null) {
    await _resolveBattle(code, after)
  }
}

function _abilityChance(player, allPlayers) {
  const base = 20
  const tokenBonus = (player.tokens || 0) * 10
  const maxWins = Math.max(...allPlayers.map(p => p.wins || 0))
  const leaderBonus = maxWins > 0 && (player.wins || 0) === maxWins ? 10 : 0
  return Math.min(90, base + tokenBonus + leaderBonus)
}

function _rollsChance(chance) {
  return Math.random() * 100 < chance
}

async function _resolveBattle(code, battle) {
  const battleRef = ref(db, `rooms/${code}/battle`)

  let mine = false
  await runTransaction(battleRef, (cur) => {
    if (!cur || cur.resolved) return undefined
    if (cur.attackerRoll == null || cur.defenderRoll == null) return undefined
    mine = true
    return { ...cur, resolved: true }
  })
  if (!mine) return

  const { attackerId, defenderId } = battle
  let { attackerRoll, defenderRoll } = battle

  // Fetch players snapshot
  const playersSnap = await get(ref(db, `rooms/${code}/players`))
  const playersData = playersSnap.val() || {}
  const allPlayers = Object.entries(playersData).map(([id, p]) => ({ id, ...p }))

  const attPlayer = allPlayers.find(p => p.id === attackerId)
  const defPlayer = allPlayers.find(p => p.id === defenderId)

  const attChar = characters.find(c => c.id === attPlayer?.characterId)
  const defChar = characters.find(c => c.id === defPlayer?.characterId)

  const attChance = attPlayer ? _abilityChance(attPlayer, allPlayers) : 0
  const defChance = defPlayer ? _abilityChance(defPlayer, allPlayers) : 0

  let attEffect = attChar?.ability?.effect ?? null
  let defEffect = defChar?.ability?.effect ?? null

  const attActivated = attEffect ? _rollsChance(attChance) : false
  const defActivated = defEffect ? _rollsChance(defChance) : false

  // Final active effects (null if not activated)
  let activeAttEffect = attActivated ? attEffect : null
  let activeDefEffect = defActivated ? defEffect : null

  // Step 1: ABSORB resolves first — Vampira copies opponent's effect
  if (activeAttEffect === 'ABSORB') {
    activeAttEffect = activeDefEffect !== 'ABSORB' ? activeDefEffect : null
  }
  if (activeDefEffect === 'ABSORB') {
    activeDefEffect = activeAttEffect !== 'ABSORB' ? activeAttEffect : null
  }

  // Step 2: Pre-roll modifiers
  // SNEAK: attacker gets +3 if they are the attackerId
  if (activeAttEffect === 'SNEAK') {
    attackerRoll = attackerRoll + 3
  }
  if (activeDefEffect === 'SNEAK') {
    // defender is not the attacker, SNEAK gives no bonus
  }
  // WEAKEN: reduces opponent's roll by -2 (min 1)
  if (activeAttEffect === 'WEAKEN') {
    defenderRoll = Math.max(1, defenderRoll - 2)
  }
  if (activeDefEffect === 'WEAKEN') {
    attackerRoll = Math.max(1, attackerRoll - 2)
  }

  // Step 3: Determine winner and base damage
  let damage = Math.abs(attackerRoll - defenderRoll)
  const loserId =
    attackerRoll > defenderRoll ? defenderId
    : attackerRoll < defenderRoll ? attackerId
    : null

  const winnerId = loserId === null ? null
    : loserId === attackerId ? defenderId
    : attackerId

  const winnerEffect = winnerId === attackerId ? activeAttEffect : activeDefEffect
  const loserEffect  = loserId  === attackerId ? activeAttEffect : activeDefEffect

  // Only apply effects if there is a winner (no tie)
  if (loserId !== null) {
    const winnerRoll = winnerId === attackerId ? attackerRoll : defenderRoll
    const winnerChar = winnerId === attackerId ? attChar : defChar

    // Step 4: Winner damage modifiers
    if (winnerEffect === 'DOUBLE_MAX') {
      const maxRoll = winnerChar?.diceType ?? 6
      // Compare against original roll before pre-roll mods for DOUBLE_MAX
      const originalWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (originalWinnerRoll === maxRoll) {
        damage = damage * 2
      }
    }

    if (winnerEffect === 'EXPLOSIVE') {
      const maxRoll = winnerChar?.diceType ?? 6
      const originalWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (originalWinnerRoll === maxRoll) {
        damage = 15
      }
    }

    if (winnerEffect === 'MIN_DAMAGE_3') {
      damage = Math.max(3, damage)
    }

    // Step 5: Loser damage reducers (skip if winner has PIERCE)
    if (winnerEffect !== 'PIERCE') {
      if (loserEffect === 'ARMOR') {
        damage = Math.min(8, damage)
      }
      if (loserEffect === 'SHIELD') {
        damage = 0
      }
    }
  }

  // Determine which ability names to surface to the UI
  const attAbilityName = attActivated && attChar?.ability ? attChar.ability.name : null
  const defAbilityName = defActivated && defChar?.ability ? defChar.ability.name : null

  // Write ability info to battle doc so UI can read it before clearing
  await update(battleRef, {
    attAbility: attAbilityName,
    defAbility: defAbilityName,
  })

  // Apply damage to loser HP
  if (loserId && damage > 0) {
    await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
      if (!p) return null
      const newHp = Math.max(0, p.hp - damage)
      return { ...p, hp: newHp, alive: newHp > 0 }
    })
  }

  // Step 6: HEAL_HALF — loser recovers damage/2 after taking damage
  if (loserId && damage > 0 && loserEffect === 'HEAL_HALF') {
    const heal = Math.floor(damage / 2)
    if (heal > 0) {
      await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
        if (!p) return null
        const newHp = Math.min(100, p.hp + heal)
        return { ...p, hp: newHp, alive: newHp > 0 }
      })
    }
  }

  // Track wins for winner
  if (winnerId) {
    await runTransaction(ref(db, `rooms/${code}/players/${winnerId}/wins`), (cur) => {
      return (cur || 0) + 1
    })
  }

  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 4000)
}
