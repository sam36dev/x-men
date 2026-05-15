import { db } from './firebase'
import {
  ref, set, get, update, remove,
  runTransaction,
} from 'firebase/database'
import { characters } from './data/characters'
import { villains } from './data/villains'

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
      [playerId]: { name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false, preB: false, turn: 1 },
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
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false, preB: false, turn: 1,
  })
}

export async function selectCharacter(code, playerId, characterId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { characterId })
}

export async function startGame(code) {
  const villainHp = {}
  villains.forEach(v => { villainHp[v.id] = v.hp })
  await update(ref(db, `rooms/${code}`), { status: 'playing', villainHp })
}

export async function attackVillain(code, playerId, villainId) {
  const snap = await get(ref(db, `rooms/${code}/villainHp/${villainId}`))
  const hp = snap.val()
  if (hp == null || hp <= 0) return
  await set(ref(db, `rooms/${code}/villainBattle`), {
    playerId,
    villainId,
    playerRoll: null,
    villainRoll: null,
    resolved: false,
  })
}

export async function submitVillainRoll(code, playerId, roll) {
  const vBattleRef = ref(db, `rooms/${code}/villainBattle`)
  const snap = await get(vBattleRef)
  const vb = snap.val()
  if (!vb || vb.resolved || vb.playerId !== playerId) return

  const villain = villains.find(v => v.id === vb.villainId)
  const die1 = Math.ceil(Math.random() * (villain?.diceType ?? 6))
  const die2 = villain?.id === 6 ? Math.ceil(Math.random() * (villain?.diceType ?? 6)) : null
  const villainRoll = die2 != null ? Math.max(die1, die2) : die1

  const txResult = await runTransaction(vBattleRef, (cur) => {
    if (!cur || cur.resolved) return undefined
    return { ...cur, playerRoll: roll, villainRoll, villainRoll2: die2, resolved: true }
  })
  if (!txResult.committed) return

  await _resolveVillainBattle(code, { ...vb, playerRoll: roll, villainRoll })
}

async function _resolveVillainBattle(code, vb) {
  const { playerId, villainId, playerRoll, villainRoll } = vb
  const damage = Math.abs(playerRoll - villainRoll)

  if (playerRoll > villainRoll && damage > 0) {
    // Player wins the roll — damage villain and count win
    await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`), (cur) => Math.max(0, (cur ?? 0) - damage))
    await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
      if (!p) return null
      return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0 }
    })
  } else if (villainRoll > playerRoll && damage > 0) {
    // Villain wins — damage player
    await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
      if (!p) return null
      const newHp = Math.max(0, p.hp - damage)
      return { ...p, hp: newHp, alive: newHp > 0, consecutiveLosses: (p.consecutiveLosses || 0) + 1 }
    })
  }

  setTimeout(() => remove(ref(db, `rooms/${code}/villainBattle`)), 4000)
}

export async function leaveRoom(code, playerId) {
  await remove(ref(db, `rooms/${code}/players/${playerId}`))
}

export async function giveToken(code, targetPlayerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetPlayerId}/tokens`), (cur) => (cur || 0) + 1)
}

export async function removeToken(code, targetPlayerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetPlayerId}/tokens`), (cur) => Math.max(0, (cur || 0) - 1))
}

export async function healPlayer(code, targetPlayerId, amount = 2) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetPlayerId}`), (p) => {
    if (!p) return null
    const newHp = Math.min(100, (p.hp || 0) + amount)
    return { ...p, hp: newHp, alive: true }
  })
}

export async function attackPlayer(code, attackerId, defenderId) {
  await set(ref(db, `rooms/${code}/battle`), {
    attackerId,
    defenderId,
    resolved: false,
  })
}

export async function changeTurn(code, playerId, delta) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/turn`), (cur) => Math.max(1, (cur || 1) + delta))
}

export async function togglePreB(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/preB`), (cur) => !cur)
}

export async function toggleCAbility(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/cActive`), (cur) => !cur)
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

  const txResult = await runTransaction(battleRef, (cur) => {
    if (!cur || cur.resolved) return undefined
    if (cur.attackerRoll == null || cur.defenderRoll == null) return undefined
    return { ...cur, resolved: true }
  })
  if (!txResult.committed) return

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

  // Vampira Voo — pre-declared [B] means she flees, no damage dealt to either side
  if ((attPlayer?.preB && attChar?.id === 7) || (defPlayer?.preB && defChar?.id === 7)) {
    const fleeId = (attPlayer?.preB && attChar?.id === 7) ? attackerId : defenderId
    await update(battleRef, { fled: fleeId })
    await update(ref(db, `rooms/${code}/players/${attackerId}`), { preB: false, cActive: false })
    await update(ref(db, `rooms/${code}/players/${defenderId}`), { preB: false, cActive: false })
    setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 3500)
    return
  }

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

  // [B] — pre-declared by each player before battle
  let attBEffect = attPlayer?.preB ? (attChar?.abilityB?.effect ?? null) : null
  let defBEffect = defPlayer?.preB ? (defChar?.abilityB?.effect ?? null) : null

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

  // Vampira [C] Toque Vampírico — stored stolen [A], auto-activates 1 charge per battle
  const attStolenEff = attChar?.id === 7 && (attPlayer?.stolenAbility?.charges ?? 0) > 0 ? attPlayer.stolenAbility.effect : null
  const defStolenEff = defChar?.id === 7 && (defPlayer?.stolenAbility?.charges ?? 0) > 0 ? defPlayer.stolenAbility.effect : null
  if (attStolenEff === 'SNEAK')  attackerRoll += 3
  if (attStolenEff === 'WEAKEN') defenderRoll = Math.max(1, defenderRoll - 2)
  if (defStolenEff === 'WEAKEN') attackerRoll = Math.max(1, attackerRoll - 2)

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

    // Stolen ability — winner damage effects
    const winnerStolenEff = winnerId === attackerId ? attStolenEff : defStolenEff
    const loserStolenEff  = loserId  === attackerId ? attStolenEff : defStolenEff
    if (winnerStolenEff === 'DOUBLE_MAX') {
      const maxRoll = winnerChar?.diceType ?? 6
      const origWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (origWinnerRoll === maxRoll) damage *= 2
    }
    if (winnerStolenEff === 'EXPLOSIVE') {
      const maxRoll = winnerChar?.diceType ?? 6
      const origWinnerRoll = winnerId === attackerId ? battle.attackerRoll : battle.defenderRoll
      if (origWinnerRoll === maxRoll) damage = 15
    }
    if (winnerStolenEff === 'MIN_DAMAGE_3') damage = Math.max(3, damage)

    // Step 5: Loser damage reducers (skip if winner has PIERCE)
    const winnerPierces = winnerEffect === 'PIERCE' || winnerStolenEff === 'PIERCE'
    if (!winnerPierces) {
      if (loserEffect === 'ARMOR') damage = Math.min(8, damage)
      if (loserEffect === 'SHIELD') damage = 0
      if (loserStolenEff === 'ARMOR') damage = Math.min(8, damage)
      if (loserStolenEff === 'SHIELD') damage = 0
    }

    // [C] C_DODGE_50 — 50% chance loser takes no damage
    if (loserCEffect === 'C_DODGE_50' && Math.random() < 0.5) damage = 0
  }

  const attAbilityName = attActivated && attChar?.ability ? attChar.ability.name : null
  const defAbilityName = defActivated && defChar?.ability ? defChar.ability.name : null
  const attBName = attPlayer?.preB && attChar?.abilityB?.effect !== 'B_MOVEMENT' ? attChar?.abilityB?.name : null
  const defBName = defPlayer?.preB && defChar?.abilityB?.effect !== 'B_MOVEMENT' ? defChar?.abilityB?.name : null
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

  // Apply damage to loser HP + track loss streak (single transaction)
  if (loserId) {
    await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
      if (!p) return null
      let newHp = damage > 0 ? Math.max(0, p.hp - damage) : p.hp
      if (loserCEffect === 'C_SURVIVE_1' && newHp === 0) newHp = 1
      return { ...p, hp: newHp, alive: newHp > 0, consecutiveLosses: (p.consecutiveLosses || 0) + 1 }
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

  // HEAL_HALF — loser recovers damage/2 after taking damage (own [A] or stolen)
  if (loserId && damage > 0 && (loserEffect === 'HEAL_HALF' || (loserId === attackerId ? attStolenEff : defStolenEff) === 'HEAL_HALF')) {
    const heal = Math.floor(damage / 2)
    if (heal > 0) {
      await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
        if (!p) return null
        const newHp = Math.min(100, p.hp + heal)
        return { ...p, hp: newHp, alive: newHp > 0 }
      })
    }
  }

  // Track wins for winner + reset their loss streak (single transaction)
  if (winnerId) {
    await runTransaction(ref(db, `rooms/${code}/players/${winnerId}`), (p) => {
      if (!p) return null
      return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0 }
    })
  }

  // Vampira Toque Vampírico — steal opponent [A] on 4+ damage win; consume 1 charge if used
  const doAttSteal = attChar?.id === 7 && winnerId === attackerId && damage >= 4 && defChar?.ability
  const doDefSteal = defChar?.id === 7 && winnerId === defenderId && damage >= 4 && attChar?.ability
  if (doAttSteal || attStolenEff) {
    await runTransaction(ref(db, `rooms/${code}/players/${attackerId}/stolenAbility`), (cur) => {
      let charges = cur?.charges ?? 0
      if (attStolenEff) charges = Math.max(0, charges - 1)
      if (doAttSteal) {
        return cur?.effect
          ? { ...cur, charges: charges + 3 }
          : { effect: defChar.ability.effect, name: defChar.ability.name, charges: charges + 3 }
      }
      return charges <= 0 ? null : { ...cur, charges }
    })
  }
  if (doDefSteal || defStolenEff) {
    await runTransaction(ref(db, `rooms/${code}/players/${defenderId}/stolenAbility`), (cur) => {
      let charges = cur?.charges ?? 0
      if (defStolenEff) charges = Math.max(0, charges - 1)
      if (doDefSteal) {
        return cur?.effect
          ? { ...cur, charges: charges + 3 }
          : { effect: attChar.ability.effect, name: attChar.ability.name, charges: charges + 3 }
      }
      return charges <= 0 ? null : { ...cur, charges }
    })
  }

  // Reset preB and cActive for both combatants after battle resolves
  await update(ref(db, `rooms/${code}/players/${attackerId}`), { preB: false, cActive: false })
  await update(ref(db, `rooms/${code}/players/${defenderId}`), { preB: false, cActive: false })

  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 4000)
}
