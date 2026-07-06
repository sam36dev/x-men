import { db } from './firebase'
import {
  ref, set, get, update, remove,
  runTransaction,
} from 'firebase/database'
import { characters } from './data/characters'
import { villains } from './data/villains'

function _toArr(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  return Object.values(val)
}

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
      [playerId]: { name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false, preB: false, turn: 1, preBUsedOnTurn: 0, abilityDisabled: false },
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
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false, preB: false, turn: 1, preBUsedOnTurn: 0, abilityDisabled: false,
  })
}

export async function selectCharacter(code, playerId, characterId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { characterId })
}

export async function startGame(code) {
  const snap = await get(ref(db, `rooms/${code}/players`))
  const playersVal = snap.val() || {}
  const playerResets = {}
  Object.keys(playersVal).forEach(pid => {
    playerResets[`players/${pid}/hp`]               = 100
    playerResets[`players/${pid}/alive`]             = true
    playerResets[`players/${pid}/tokens`]            = 0
    playerResets[`players/${pid}/wins`]              = 0
    playerResets[`players/${pid}/consecutiveLosses`] = 0
    playerResets[`players/${pid}/turn`]              = 1
    playerResets[`players/${pid}/cActive`]           = false
    playerResets[`players/${pid}/preB`]              = false
    playerResets[`players/${pid}/preBUsedOnTurn`]    = 0
    playerResets[`players/${pid}/abilityDisabled`]   = false
    playerResets[`players/${pid}/forgeItem`]         = null
  })
  const villainHp = {}
  villains.forEach(v => { villainHp[v.id] = v.hp })
  await update(ref(db, `rooms/${code}`), {
    status: 'playing',
    villainHp,
    battle: null,
    villainBattle: null,
    unlockedVillains: null,
    ...playerResets,
  })
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

  try {
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
  } catch (err) {
    await remove(ref(db, `rooms/${code}/villainBattle`)).catch(() => {})
  }
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

export async function clearBattle(code) {
  await remove(ref(db, `rooms/${code}/battle`))
  await remove(ref(db, `rooms/${code}/villainBattle`))
}

export async function unlockVillain(code, villainId) {
  await update(ref(db, `rooms/${code}/unlockedVillains`), { [villainId]: true })
}

export async function healVillain(code, villainId, amount = 2) {
  const villain = villains.find(v => v.id === villainId)
  const maxHp = villain?.hp ?? 999
  await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`), (cur) =>
    Math.min(maxHp, (cur ?? maxHp) + amount)
  )
}

export async function giveForgeItem(code, playerId, item) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { forgeItem: item })
}

export async function clearForgeItem(code, playerId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { forgeItem: null })
}

export async function healPlayer(code, targetPlayerId, amount = 2) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetPlayerId}`), (p) => {
    if (!p) return null
    const newHp = Math.min(100, (p.hp || 0) + amount)
    return { ...p, hp: newHp, alive: true }
  })
}

export async function attackPlayer(code, attackerId, defenderId) {
  const playersSnap = await get(ref(db, `rooms/${code}/players`))
  const playersData = playersSnap.val() || {}
  const attackerCharId = playersData[attackerId]?.characterId ?? null
  const defenderCharId = playersData[defenderId]?.characterId ?? null
  await set(ref(db, `rooms/${code}/battle`), {
    attackerId, defenderId,
    attackerCharId, defenderCharId,
    resolved: false,
  })
}

export async function changeTurn(code, playerId, delta) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
    if (!p) return null
    const newTurn = Math.max(1, (p.turn || 1) + delta)
    const newTokens = delta > 0 ? (p.tokens || 0) + 1 : (p.tokens || 0)
    return { ...p, turn: newTurn, tokens: newTokens }
  })
}

export async function togglePreB(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
    if (!p) return null
    // Block re-activation if [B] was already used this turn
    if (!p.preB && (p.preBUsedOnTurn ?? 0) === (p.turn ?? 1)) return p
    return { ...p, preB: !p.preB }
  })
}

export async function toggleCAbility(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/cActive`), (cur) => !cur)
}

export async function submitRoll(code, playerId, roll, preB) {
  const battleRef = ref(db, `rooms/${code}/battle`)
  const snap = await get(battleRef)
  const battle = snap.val()
  if (!battle || battle.resolved) return

  const isAttacker = battle.attackerId === playerId
  const myKey = isAttacker ? 'attackerRoll' : 'defenderRoll'
  const myPrebKey = isAttacker ? 'attackerPreB' : 'defenderPreB'

  await update(ref(db), {
    [`rooms/${code}/battle/${myKey}`]: roll,
    [`rooms/${code}/battle/${myPrebKey}`]: preB ?? false,
  })

  const afterSnap = await get(battleRef)
  const after = afterSnap.val()
  if (!after || after.resolved) return
  if (after.attackerRoll != null && after.defenderRoll != null) {
    await _resolveBattle(code, after)
  }
}

function _abilityChance(player, allPlayers) {
  const base = 0
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

    // Compute effective rolls + winner atomically from preB captured at roll-time.
    // C effects and B_REROLL can't run here; the full resolution below may
    // overwrite resolvedDamage, but resolvedLoserId will always be correct.
    const txAttChar = characters.find(c => c.id === cur.attackerCharId)
    const txDefChar = characters.find(c => c.id === cur.defenderCharId)
    let txAttB = (cur.attackerPreB ?? false) ? (txAttChar?.abilityB?.effect ?? null) : null
    let txDefB = (cur.defenderPreB ?? false) ? (txDefChar?.abilityB?.effect ?? null) : null
    if (txAttB === 'B_NINJA' && txDefB !== 'B_NINJA') txDefB = null
    if (txDefB === 'B_NINJA' && txAttB !== 'B_NINJA') txAttB = null
    let ea = cur.attackerRoll
    let ed = cur.defenderRoll
    if (txAttB === 'B_PLUS_2'  || txAttB === 'B_UPGRADE')   ea += 2
    if (txAttB === 'B_DOUBLE_ROLL') ea *= 2
    if (txAttB === 'B_NINJA')   ea += 3
    if (txAttB === 'B_WEAKEN')  ed = Math.max(1, ed - 2)
    if (txAttB === 'B_FORCE_ONE') ed = 1
    if (txDefB === 'B_PLUS_2'  || txDefB === 'B_UPGRADE')   ed += 2
    if (txDefB === 'B_DOUBLE_ROLL') ed *= 2
    if (txDefB === 'B_NINJA')   ed += 3
    if (txDefB === 'B_WEAKEN')  ea = Math.max(1, ea - 2)
    if (txDefB === 'B_FORCE_ONE') ea = 1
    const txLoserId = ea > ed ? cur.defenderId : ea < ed ? cur.attackerId : ''
    return {
      ...cur, resolved: true,
      effectiveAttackerRoll: ea, effectiveDefenderRoll: ed,
      resolvedLoserId: txLoserId, resolvedDamage: Math.abs(ea - ed),
    }
  })
  if (!txResult.committed) return

  // Use the committed snapshot — it has the correct preB, effective rolls, and loserId.
  battle = txResult.snapshot.val()

  // Guarantee cleanup even if resolution throws midway
  const ensureCleared = setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 8000)

  try {

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
  const attPreB = battle.attackerPreB ?? false
  const defPreB = battle.defenderPreB ?? false
  if ((attPreB && attChar?.id === 7) || (defPreB && defChar?.id === 7)) {
    const fleeId = (attPreB && attChar?.id === 7) ? attackerId : defenderId
    await update(battleRef, { fled: fleeId })
    await update(ref(db, `rooms/${code}/players/${attackerId}`), { preB: false, cActive: false, ...(attPreB ? { preBUsedOnTurn: attPlayer.turn ?? 1 } : {}) })
    await update(ref(db, `rooms/${code}/players/${defenderId}`), { preB: false, cActive: false, ...(defPreB ? { preBUsedOnTurn: defPlayer.turn ?? 1 } : {}) })
    setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 3500)
    return
  }

  const attChance = attPlayer ? _abilityChance(attPlayer, allPlayers) : 0
  const defChance = defPlayer ? _abilityChance(defPlayer, allPlayers) : 0

  // abilityDisabled = true means Vampira currently holds this player's [A] ability
  let attEffect = attPlayer?.abilityDisabled ? null : (attChar?.ability?.effect ?? null)
  let defEffect = defPlayer?.abilityDisabled ? null : (defChar?.ability?.effect ?? null)

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

  // [B] — captured atomically with roll submission
  let attBEffect = attPreB ? (attChar?.abilityB?.effect ?? null) : null
  let defBEffect = defPreB ? (defChar?.abilityB?.effect ?? null) : null

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

  // Vampira [C] Toque Vampírico — stolen [A] active for N rounds, auto-applies each battle
  const attStolenEff = attChar?.id === 7 && (attPlayer?.stolenAbility?.rounds ?? 0) > 0 ? attPlayer.stolenAbility.effect : null
  const defStolenEff = defChar?.id === 7 && (defPlayer?.stolenAbility?.rounds ?? 0) > 0 ? defPlayer.stolenAbility.effect : null
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

  const attAbilityName = attActivated && attChar?.ability
    && !(attEffect === 'HEAL_HALF' && loserId !== attackerId) ? attChar.ability.name : null
  const defAbilityName = defActivated && defChar?.ability
    && !(defEffect === 'HEAL_HALF' && loserId !== defenderId) ? defChar.ability.name : null
  const attBName = attPreB && attChar?.abilityB?.effect !== 'B_MOVEMENT' ? attChar?.abilityB?.name : null
  const defBName = defPreB && defChar?.abilityB?.effect !== 'B_MOVEMENT' ? defChar?.abilityB?.name : null
  const attCName = attCEffect && attChar?.abilityC ? attChar.abilityC.name : null
  const defCName = defCEffect && defChar?.abilityC ? defChar.abilityC.name : null

  await update(battleRef, {
    attAbility: attAbilityName,
    defAbility: defAbilityName,
    attAbilityB: attBName,
    defAbilityB: defBName,
    attAbilityC: attCName,
    defAbilityC: defCName,
    resolvedDamage: damage,
    effectiveAttackerRoll: attackerRoll,
    effectiveDefenderRoll: defenderRoll,
  })

  // Vampira Toque Vampírico flags
  const doAttSteal = attChar?.id === 7 && winnerId === attackerId && damage >= 4 && defChar?.ability
  const doDefSteal = defChar?.id === 7 && winnerId === defenderId && damage >= 4 && attChar?.ability
  const isVampiraAtt = attChar?.id === 7
  const isVampiraDef = defChar?.id === 7

  // Helper: advance stolenAbility by 1 round (expire → activate queue or clear)
  const _advanceSA = (sa) => {
    if (!sa) return null
    const newRounds = Math.max(0, sa.rounds - 1)
    if (newRounds > 0) return { ...sa, rounds: newRounds }
    const q = _toArr(sa.queue)
    if (q.length > 0) {
      const [next, ...rest] = q
      return { effect: next.effect, name: next.name, rounds: 3, ownerId: next.ownerId, queue: rest.length > 0 ? rest : null }
    }
    return null
  }

  // Apply damage to loser HP + track loss streak + consume Vampira round if she lost
  if (loserId) {
    const vampiraLost = loserId === attackerId ? isVampiraAtt : isVampiraDef
    const loserStolenUsed = vampiraLost ? (loserId === attackerId ? attStolenEff : defStolenEff) : null
    const loserSnap = loserId === attackerId ? attPlayer : defPlayer
    const prevSALose = loserSnap?.stolenAbility ?? null
    const loserWillExpire = !!(vampiraLost && loserStolenUsed && prevSALose && prevSALose.rounds - 1 <= 0)
    const loserExpiredOwner = loserWillExpire ? prevSALose.ownerId : null
    const loserNextOwner = loserWillExpire ? (_toArr(prevSALose.queue)[0]?.ownerId ?? null) : null

    await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
      if (!p) return null
      let newHp = damage > 0 ? Math.max(0, p.hp - damage) : p.hp
      if (loserCEffect === 'C_SURVIVE_1' && newHp === 0) newHp = 1
      if (vampiraLost && loserStolenUsed) {
        return { ...p, hp: newHp, alive: newHp > 0, consecutiveLosses: (p.consecutiveLosses || 0) + 1, stolenAbility: _advanceSA(p.stolenAbility) }
      }
      return { ...p, hp: newHp, alive: newHp > 0, consecutiveLosses: (p.consecutiveLosses || 0) + 1 }
    })

    if (loserExpiredOwner && loserExpiredOwner !== loserNextOwner) {
      await update(ref(db, `rooms/${code}/players/${loserExpiredOwner}`), { abilityDisabled: false })
    }
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
  // Delay lets the damage render first so clients see HP go down, then back up
  if (loserId && damage > 0 && (loserEffect === 'HEAL_HALF' || (loserId === attackerId ? attStolenEff : defStolenEff) === 'HEAL_HALF')) {
    const heal = Math.floor(damage / 2)
    if (heal > 0) {
      await new Promise(r => setTimeout(r, 900))
      await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
        if (!p) return null
        const newHp = Math.min(100, p.hp + heal)
        return { ...p, hp: newHp, alive: newHp > 0 }
      })
    }
  }

  // Track wins for winner + reset loss streak + handle Vampira steal/rounds if she won
  if (winnerId) {
    const vampiraWon = winnerId === attackerId ? isVampiraAtt : isVampiraDef
    const winnerStolenUsed = vampiraWon ? (winnerId === attackerId ? attStolenEff : defStolenEff) : null
    const doWinnerSteal = winnerId === attackerId ? doAttSteal : doDefSteal
    const opponentId = winnerId === attackerId ? defenderId : attackerId
    const opponentAbility = winnerId === attackerId ? defChar?.ability : attChar?.ability
    const winnerSnap = winnerId === attackerId ? attPlayer : defPlayer
    const prevSAWin = winnerSnap?.stolenAbility ?? null
    const winnerWillExpire = !!(winnerStolenUsed && prevSAWin && prevSAWin.rounds - 1 <= 0)
    const winnerExpiredOwner = winnerWillExpire ? prevSAWin.ownerId : null
    const winnerNextOwner = winnerWillExpire ? (_toArr(prevSAWin.queue)[0]?.ownerId ?? null) : null

    await runTransaction(ref(db, `rooms/${code}/players/${winnerId}`), (p) => {
      if (!p) return null
      if (vampiraWon) {
        // Step 1: advance rounds (expire → queue or clear)
        let sa = winnerStolenUsed ? _advanceSA(p.stolenAbility) : (p.stolenAbility ?? null)
        // Step 2: add steal
        if (doWinnerSteal && opponentAbility) {
          const entry = { effect: opponentAbility.effect, name: opponentAbility.name, ownerId: opponentId }
          if (!sa) {
            sa = { ...entry, rounds: 3, queue: null }
          } else {
            sa = { ...sa, queue: [..._toArr(sa.queue), entry] }
          }
        }
        return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0, stolenAbility: sa }
      }
      return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0 }
    })

    if (vampiraWon) {
      if (winnerExpiredOwner && winnerExpiredOwner !== winnerNextOwner) {
        await update(ref(db, `rooms/${code}/players/${winnerExpiredOwner}`), { abilityDisabled: false })
      }
      if (doWinnerSteal) {
        await update(ref(db, `rooms/${code}/players/${opponentId}`), { abilityDisabled: true })
      }
    }
  }

  // TIE case — Vampira still burns a round if she had one active
  if (!winnerId) {
    for (const [pId, isVamp, stolenEff, pSnap] of [
      [attackerId, isVampiraAtt, attStolenEff, attPlayer],
      [defenderId, isVampiraDef, defStolenEff, defPlayer],
    ]) {
      if (isVamp && stolenEff) {
        const prevSATie = pSnap?.stolenAbility ?? null
        const tieWillExpire = !!(prevSATie && prevSATie.rounds - 1 <= 0)
        const tieExpiredOwner = tieWillExpire ? prevSATie.ownerId : null
        const tieNextOwner = tieWillExpire ? (_toArr(prevSATie.queue)[0]?.ownerId ?? null) : null

        await runTransaction(ref(db, `rooms/${code}/players/${pId}/stolenAbility`), (cur) => _advanceSA(cur))

        if (tieExpiredOwner && tieExpiredOwner !== tieNextOwner) {
          await update(ref(db, `rooms/${code}/players/${tieExpiredOwner}`), { abilityDisabled: false })
        }
      }
    }
  }

  // Reset preB and cActive; record which turn [B] was used so it can't be reused same turn
  await update(ref(db, `rooms/${code}/players/${attackerId}`), { preB: false, cActive: false, ...(attPreB ? { preBUsedOnTurn: attPlayer.turn ?? 1 } : {}) })
  await update(ref(db, `rooms/${code}/players/${defenderId}`), { preB: false, cActive: false, ...(defPreB ? { preBUsedOnTurn: defPlayer.turn ?? 1 } : {}) })

  clearTimeout(ensureCleared)
  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 4000)

  } catch (err) {
    clearTimeout(ensureCleared)
    await remove(ref(db, `rooms/${code}/battle`)).catch(() => {})
  }
}
