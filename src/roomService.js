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
      [playerId]: { name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false },
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
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false,
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
    attackerAbilityB: false,
    defenderAbilityB: false,
  })
}

export async function toggleCAbility(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/cActive`), (cur) => !cur)
}

export async function declareAbilityB(code, playerId) {
  const snap = await get(ref(db, `rooms/${code}/battle`))
  const battle = snap.val()
  if (!battle || battle.resolved) return
  const key = battle.attackerId === playerId ? 'attackerAbilityB' : 'defenderAbilityB'
  await update(ref(db, `rooms/${code}/battle`), { [key]: true })
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

  // [C] effects — host-activated conditional abilities
  const attCEffect = attPlayer?.cActive ? (attChar?.abilityC?.effect ?? null) : null
  const defCEffect = defPlayer?.cActive ? (defChar?.abilityC?.effect ?? null) : null

  // [C] C_ABSORB_SURE / C_PIERCE_SURE guarantee [A] activation
  let attActivated = attEffect ? _rollsChance(attChance) : false
  let defActivated = defEffect ? _rollsChance(defChance) : false
  if (attCEffect === 'C_ABSORB_SURE' && attEffect === 'ABSORB') attActivated = true
  if (attCEffect === 'C_PIERCE_SURE' && attEffect === 'PIERCE') attActivated = true
  if (defCEffect === 'C_ABSORB_SURE' && defEffect === 'ABSORB') defActivated = true
  if (defCEffect === 'C_PIERCE_SURE' && defEffect === 'PIERCE') defActivated = true

  let activeAttEffect = attActivated ? attEffect : null
  let activeDefEffect = defActivated ? defEffect : null

  // [A] Step 1: ABSORB — Vampira copies opponent's effect
  if (activeAttEffect === 'ABSORB') activeAttEffect = activeDefEffect !== 'ABSORB' ? activeDefEffect : null
  if (activeDefEffect === 'ABSORB') activeDefEffect = activeAttEffect !== 'ABSORB' ? activeAttEffect : null

  // [C] C_MIND_SHIELD — nullify opponent's [A] effect
  if (attCEffect === 'C_MIND_SHIELD') activeDefEffect = null
  if (defCEffect === 'C_MIND_SHIELD') activeAttEffect = null

  // [B] — host-declared abilities
  let attBEffect = battle.attackerAbilityB ? (attChar?.abilityB?.effect ?? null) : null
  let defBEffect = battle.defenderAbilityB ? (defChar?.abilityB?.effect ?? null) : null

  // B_NINJA cancels opponent's [B] (unless both have it — then both apply)
  if (attBEffect === 'B_NINJA' && defBEffect !== 'B_NINJA') defBEffect = null
  if (defBEffect === 'B_NINJA' && attBEffect !== 'B_NINJA') attBEffect = null

  // [B] reroll: replaces roll before any modifier
  if (attBEffect === 'B_REROLL') attackerRoll = Math.ceil(Math.random() * (attChar?.diceType || 6))
  if (defBEffect === 'B_REROLL') defenderRoll = Math.ceil(Math.random() * (defChar?.diceType || 6))

  // [C] C_MAX_ROLL — treat roll as max dice value
  if (attCEffect === 'C_MAX_ROLL') attackerRoll = attChar?.diceType ?? 6
  if (defCEffect === 'C_MAX_ROLL') defenderRoll = defChar?.diceType ?? 6

  // [C] C_ROLL_BOOST_4 — +4 to roll
  if (attCEffect === 'C_ROLL_BOOST_4') attackerRoll += 4
  if (defCEffect === 'C_ROLL_BOOST_4') defenderRoll += 4

  // [B] roll modifiers
  if (attBEffect === 'B_PLUS_2')      attackerRoll += 2
  if (attBEffect === 'B_UPGRADE')     attackerRoll += 2
  if (attBEffect === 'B_DOUBLE_ROLL') attackerRoll *= 2
  if (attBEffect === 'B_NINJA')       attackerRoll += 3
  if (attBEffect === 'B_WEAKEN')      defenderRoll = Math.max(1, defenderRoll - 2)
  if (attBEffect === 'B_FORCE_ONE')   defenderRoll = 1

  if (defBEffect === 'B_PLUS_2')      defenderRoll += 2
  if (defBEffect === 'B_UPGRADE')     defenderRoll += 2
  if (defBEffect === 'B_DOUBLE_ROLL') defenderRoll *= 2
  if (defBEffect === 'B_NINJA')       defenderRoll += 3
  if (defBEffect === 'B_WEAKEN')      attackerRoll = Math.max(1, attackerRoll - 2)
  if (defBEffect === 'B_FORCE_ONE')   attackerRoll = 1

  // [A] Step 2: Pre-roll modifiers
  if (activeAttEffect === 'SNEAK') attackerRoll += 3
  if (activeAttEffect === 'WEAKEN') defenderRoll = Math.max(1, defenderRoll - 2)
  if (activeDefEffect === 'WEAKEN') attackerRoll = Math.max(1, attackerRoll - 2)

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
  const winnerCEffect = winnerId === attackerId ? attCEffect : defCEffect
  const loserCEffect  = loserId  === attackerId ? attCEffect : defCEffect

  // Only apply effects if there is a winner (no tie)
  if (loserId !== null) {
    const winnerChar = winnerId === attackerId ? attChar : defChar

    // Step 4: Winner damage modifiers
    if (winnerEffect === 'DOUBLE_MAX') {
      const maxRoll = winnerChar?.diceType ?? 6
      const originalWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (originalWinnerRoll === maxRoll) damage = damage * 2
    }

    if (winnerEffect === 'EXPLOSIVE') {
      const maxRoll = winnerChar?.diceType ?? 6
      const originalWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (originalWinnerRoll === maxRoll) damage = 15
    }

    if (winnerEffect === 'MIN_DAMAGE_3') damage = Math.max(3, damage)

    // [C] C_MIN_DAMAGE_5 — winner causes at least 5 damage
    if (winnerCEffect === 'C_MIN_DAMAGE_5') damage = Math.max(5, damage)

    // [B] winner damage boost
    const winnerBEffect = winnerId === attackerId ? attBEffect : defBEffect
    if (winnerBEffect === 'B_DAMAGE_BOOST') damage = Math.floor(damage * 1.5)

    // Step 5: Loser damage reducers (skip if winner has PIERCE)
    if (winnerEffect !== 'PIERCE') {
      if (loserEffect === 'ARMOR') damage = Math.min(8, damage)
      if (loserEffect === 'SHIELD') damage = 0
    }

    // [C] C_DODGE_50 — 50% chance loser takes no damage
    if (loserCEffect === 'C_DODGE_50' && Math.random() < 0.5) damage = 0
  }

  const attAbilityName = attActivated && attChar?.ability ? attChar.ability.name : null
  const defAbilityName = defActivated && defChar?.ability ? defChar.ability.name : null
  const attBName = battle.attackerAbilityB && attChar?.abilityB?.effect !== 'B_MOVEMENT' ? attChar?.abilityB?.name : null
  const defBName = battle.defenderAbilityB && defChar?.abilityB?.effect !== 'B_MOVEMENT' ? defChar?.abilityB?.name : null
  const attCName = attCEffect && attChar?.abilityC ? attChar.abilityC.name : null
  const defCName = defCEffect && defChar?.abilityC ? defChar.abilityC.name : null

  await update(battleRef, {
    attAbility: attAbilityName,
    defAbility: defAbilityName,
    attAbilityB: attBName,
    defAbilityB: defBName,
    attAbilityC: attCName,
    defAbilityC: defCName,
  })

  // Apply damage to loser HP
  if (loserId && damage > 0) {
    await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
      if (!p) return null
      let newHp = Math.max(0, p.hp - damage)
      // [C] C_SURVIVE_1 — prevent death, survive at 1 HP
      if (loserCEffect === 'C_SURVIVE_1' && newHp === 0) newHp = 1
      return { ...p, hp: newHp, alive: newHp > 0 }
    })
  }

  // [C] C_REDIRECT_HALF — loser reflects half damage back to winner
  if (loserId && winnerId && damage > 0 && loserCEffect === 'C_REDIRECT_HALF') {
    const reflected = Math.floor(damage / 2)
    if (reflected > 0) {
      await runTransaction(ref(db, `rooms/${code}/players/${winnerId}`), (p) => {
        if (!p) return null
        const newHp = Math.max(0, p.hp - reflected)
        return { ...p, hp: newHp, alive: newHp > 0 }
      })
    }
  }

  // HEAL_HALF — loser recovers damage/2 after taking damage
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

  // Track wins and consecutive losses
  if (winnerId) {
    await runTransaction(ref(db, `rooms/${code}/players/${winnerId}/wins`), (cur) => (cur || 0) + 1)
    await runTransaction(ref(db, `rooms/${code}/players/${winnerId}/consecutiveLosses`), () => 0)
  }
  if (loserId) {
    await runTransaction(ref(db, `rooms/${code}/players/${loserId}/consecutiveLosses`), (cur) => (cur || 0) + 1)
  }

  // Reset cActive for both combatants after battle resolves
  await update(ref(db, `rooms/${code}/players/${attackerId}`), { cActive: false })
  await update(ref(db, `rooms/${code}/players/${defenderId}`), { cActive: false })

  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 4000)
}
