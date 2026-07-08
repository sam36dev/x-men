import { db } from './firebase'
import {
  ref, set, get, update, remove,
  runTransaction,
} from 'firebase/database'
import { characters } from './data/characters'
import { villains } from './data/villains'
import { MISSIONS } from './data/missions'

function _hasLuck(player, effect) {
  return !!(player?.luckCards?.[effect])
}

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
  const mission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)]
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0, consecutiveLosses: 0, cActive: false, preB: false, turn: 1, preBUsedOnTurn: 0, abilityDisabled: false,
    missionId: mission.id, missionProgress: 0, missionCompleted: false,
  })
}

export async function addLocalPlayer(code, playerId, playerName) {
  const mission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)]
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    name: playerName, characterId: null, hp: 100, alive: true, tokens: 0, wins: 0,
    consecutiveLosses: 0, cActive: false, preB: false, turn: 1, preBUsedOnTurn: 0, abilityDisabled: false,
    missionId: mission.id, missionProgress: 0, missionCompleted: false,
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
    playerResets[`players/${pid}/trapCards`]         = 0
    playerResets[`players/${pid}/luckCards`]         = null
    const mission = MISSIONS[Math.floor(Math.random() * MISSIONS.length)]
    playerResets[`players/${pid}/missionId`]         = mission.id
    playerResets[`players/${pid}/missionProgress`]   = 0
    playerResets[`players/${pid}/missionCompleted`]  = false
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
  const [hpSnap, playerSnap] = await Promise.all([
    get(ref(db, `rooms/${code}/villainHp/${villainId}`)),
    get(ref(db, `rooms/${code}/players/${playerId}`)),
  ])
  const hp = hpSnap.val()
  if (hp == null || hp <= 0) return
  const characterId = playerSnap.val()?.characterId ?? null
  await set(ref(db, `rooms/${code}/villainBattle`), {
    playerId,
    villainId,
    characterId,
    playerRoll: null,
    villainRoll: null,
    resolved: false,
  })
}

export async function submitVillainRoll(code, playerId, roll, forgeItem, preB) {
  const vBattleRef = ref(db, `rooms/${code}/villainBattle`)
  const snap = await get(vBattleRef)
  const vb = snap.val()
  if (!vb || vb.resolved || vb.playerId !== playerId) return

  const villain = villains.find(v => v.id === vb.villainId)
  const playerChar = characters.find(c => c.id === vb.characterId)
  console.log('[villain roll]', { villainId: vb.villainId, villain: villain?.name, villainDt: villain?.diceType, playerRoll: roll })

  // Mística (id=3): copies exactly the player's dice type
  const villainDiceType = villain?.id === 3
    ? (playerChar?.diceType ?? villain?.diceType ?? 6)
    : (villain?.diceType ?? 6)

  const die1 = Math.ceil(Math.random() * villainDiceType)
  // Sr. Sinistro (id=6): rolls two dice and takes the highest
  const die2 = villain?.id === 6 ? Math.ceil(Math.random() * villainDiceType) : null
  const villainRoll = die2 != null ? Math.max(die1, die2) : die1

  const forgeId = forgeItem?.id ?? null
  const forgeBonus = forgeItem?.diceBonus ?? 0

  const txResult = await runTransaction(vBattleRef, (cur) => {
    if (!cur || cur.resolved) return undefined
    const villainRoll2 = die2 != null ? Math.min(die1, die2) : null
    return { ...cur, playerRoll: roll, villainRoll, villainRoll2, playerForgeId: forgeId, playerForgeBonus: forgeBonus, playerPreB: preB ?? false, resolved: true }
  })
  if (!txResult.committed) return
  console.log('[villain result]', { playerRoll: roll, villainRoll, die1, die2, villainDiceType })

  await _resolveVillainBattle(code, { ...vb, playerRoll: roll, villainRoll, playerForgeId: forgeId, playerForgeBonus: forgeBonus })
}

async function _resolveVillainBattle(code, vb) {
  const { playerId, villainId, playerRoll, villainRoll, characterId, playerForgeId } = vb
  const villain = villains.find(v => v.id === villainId)
  const playerChar = characters.find(c => c.id === characterId)
  let damage = Math.abs(playerRoll - villainRoll)

  const playerSnap = await get(ref(db, `rooms/${code}/players/${playerId}`))
  const playerData = playerSnap.val()

  try {
    const isSentinel = villainId >= 8 && villainId <= 10

    // Jubileu: player always wins vs Sentinelas — damage goes to villain, player never takes damage
    if (_hasLuck(playerData, 'sentinel_wins') && isSentinel) {
      if (damage > 0) {
        await runTransaction(ref(db, `rooms/${code}/villainDamage/${villainId}/${playerId}`),
          cur => (cur || 0) + damage)
        const killTx = await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
          cur => Math.max(0, (cur ?? 0) - damage))
        const jNewHp = killTx.snapshot.val() ?? 0
        if (jNewHp === 0) {
          await set(ref(db, `rooms/${code}/villainKillers/${villainId}`), playerData?.name ?? 'X-Men')
          if (villainId === 9) await runTransaction(ref(db, `rooms/${code}/players/${playerId}/tokens`), cur => (cur || 0) + 1)
          await _checkMissionProgress(code, playerId, 'villain_kill', { villainId })
          await _checkMissionProgress(code, playerId, 'sentinel_kill', { villainId })
          if (villainId === 9) await _checkMissionProgress(code, playerId, 'civilians', {})
        }
      }
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), p => {
        if (!p) return null
        return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0 }
      })
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}/luckCards/sentinel_wins`), card => {
        if (!card) return null
        const n = (card.charges || 0) - 1
        return n <= 0 ? null : { ...card, charges: n }
      })
      setTimeout(() => remove(ref(db, `rooms/${code}/villainBattle`)), 4000)
      return
    }

    // [A] passive abilities in villain battle
    const playerEffect = !_hasLuck(playerData, 'disable_abilities') && !playerData?.abilityDisabled
      ? playerChar?.ability?.effect : null

    // [C] ability check
    const playerCEffect = !_hasLuck(playerData, 'disable_abilities') && !playerData?.abilityDisabled
      ? (_isCActive(playerData, playerChar) ? (playerChar?.abilityC?.effect ?? null) : null) : null

    // Apply C roll modifiers before damage calc
    let effectivePlayerRoll = playerRoll
    if (playerCEffect === 'C_MAX_ROLL') effectivePlayerRoll = playerChar?.diceType ?? 6
    if (playerCEffect === 'C_ROLL_BOOST_4') effectivePlayerRoll = playerRoll + 4

    damage = Math.abs(effectivePlayerRoll - villainRoll)

    if (effectivePlayerRoll > villainRoll) {
      // MIN_DAMAGE_3 (Ciclope): minimum 3 damage when winning
      const minDmgActivated = playerEffect === 'MIN_DAMAGE_3' && damage > 0
      if (minDmgActivated) damage = Math.max(3, damage)
      if (minDmgActivated) await update(ref(db, `rooms/${code}/villainBattle`), { abilityActivated: playerChar?.ability?.name ?? null })

      // [C] C_MIN_DAMAGE_5 (Ciclope HP ≤ 20): deal at least 5 when winning
      if (playerCEffect === 'C_MIN_DAMAGE_5' && damage > 0) damage = Math.max(5, damage)

      // [C] C_HIGH_CARD (Gambit HP ≤ 20): fixed 5 damage
      if (playerCEffect === 'C_HIGH_CARD') damage = 5

      // Juggernaut (id=4): absorbs attacks of 2 or less damage
      if (villain?.id === 4 && damage <= 2) {
        await update(ref(db, `rooms/${code}/villainBattle`), { absorbed: true })
        damage = 0
      }

      if (damage > 0) {
        // Track cumulative damage per player for kill credit
        await runTransaction(ref(db, `rooms/${code}/villainDamage/${villainId}/${playerId}`),
          cur => (cur || 0) + damage)

        const killTx = await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
          (cur) => Math.max(0, (cur ?? 0) - damage))
        const newVillainHp = killTx.snapshot.val() ?? 0

        await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
          if (!p) return null
          return { ...p, wins: (p.wins || 0) + 1, consecutiveLosses: 0 }
        })

        if (newVillainHp === 0) {
          // Credit kill to highest-damage player; tie-break: prefer player with matching mission
          const dmgSnap = await get(ref(db, `rooms/${code}/villainDamage/${villainId}`))
          const dmgMap = dmgSnap.val() || {}
          const entries = Object.entries(dmgMap)
          const maxDmg = entries.length ? Math.max(...entries.map(([, d]) => d)) : 0
          const topIds = entries.filter(([, d]) => d === maxDmg).map(([id]) => id)

          const allPSnap = await get(ref(db, `rooms/${code}/players`))
          const allPData = allPSnap.val() || {}

          let killerId = topIds[0] ?? playerId
          if (topIds.length > 1) {
            const withMission = topIds.find(pid => {
              const pd = allPData[pid]
              if (!pd || pd.missionCompleted) return false
              const m = MISSIONS.find(m => m.id === pd.missionId)
              if (!m) return false
              return (m.auto === 'villain_kill' && m.villainId === villainId) ||
                     (m.auto === 'sentinel_kill' && isSentinel)
            })
            if (withMission) killerId = withMission
          }

          const killerName = allPData[killerId]?.name ?? 'X-Men'
          await set(ref(db, `rooms/${code}/villainKillers/${villainId}`), killerName)

          // Sentinela (Salve os Civis!, id=9): +1 token when defeated
          if (villainId === 9) {
            await runTransaction(ref(db, `rooms/${code}/players/${playerId}/tokens`),
              (cur) => (cur || 0) + 1)
          }

          // Laboratório (id=10) spawn: when any boss (id 1-7) dies and lab is alive → respawn plain Sentinela (id=8) with 50 HP
          if (villainId >= 1 && villainId <= 7) {
            const labHpSnap = await get(ref(db, `rooms/${code}/villainHp/10`))
            const labHp = labHpSnap.val() ?? 0
            if (labHp > 0) {
              const sentHpSnap = await get(ref(db, `rooms/${code}/villainHp/8`))
              const sentHp = sentHpSnap.val() ?? 0
              if (sentHp === 0) {
                await set(ref(db, `rooms/${code}/villainHp/8`), 50)
              }
            }
          }

          // Missions: go to credited killer (not necessarily last-hit player)
          await _checkMissionProgress(code, killerId, 'villain_kill', { villainId })
          if (isSentinel) await _checkMissionProgress(code, killerId, 'sentinel_kill', { villainId })
          if (villainId === 9) await _checkMissionProgress(code, killerId, 'civilians', {})
        }
      }
    } else if (villainRoll > effectivePlayerRoll) {
      // Dente de Sabre (id=5): double damage against Wolverine (characterId=1)
      if (villain?.id === 5 && playerChar?.id === 1) damage *= 2

      // [C] C_HIGH_CARD (Gambit HP ≤ 20): fixed 5 damage
      if (playerCEffect === 'C_HIGH_CARD') damage = 5

      // Escudo do Capitão (forge id=4): halves incoming damage
      if (playerForgeId === 4) damage = Math.floor(damage / 2)

      // [C] C_DODGE_50 (Noturno HP ≤ 30): 50% chance to take 0 damage
      if (playerCEffect === 'C_DODGE_50' && Math.random() < 0.5) damage = 0

      // [A] DODGE_TOKEN (Gambit): spend 1 token to take 0 damage (skipped when C_HIGH_CARD forces fixed damage)
      if (playerCEffect !== 'C_HIGH_CARD' && playerEffect === 'DODGE_TOKEN' && (playerData?.tokens ?? 0) >= 1) {
        damage = 0
        await update(ref(db, `rooms/${code}/players/${playerId}`), { tokens: (playerData.tokens || 1) - 1 })
        await update(ref(db, `rooms/${code}/villainBattle`), { abilityActivated: playerChar?.ability?.name ?? null })
      }

      if (damage > 0) {
        if (playerEffect === 'HEAL_HALF')
          await update(ref(db, `rooms/${code}/villainBattle`), { abilityActivated: playerChar?.ability?.name ?? null })
        await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
          if (!p) return null
          // HEAL_HALF (Wolverine): recover half damage taken
          const healed = playerEffect === 'HEAL_HALF' ? Math.floor(damage / 2) : 0
          let newHp = Math.max(0, p.hp - damage + healed)
          // [C] C_SURVIVE_1 (Colosso HP ≤ 20): survive with 1 HP instead of dying
          if (playerCEffect === 'C_SURVIVE_1' && newHp === 0) newHp = 1
          return { ...p, hp: newHp, alive: newHp > 0, consecutiveLosses: (p.consecutiveLosses || 0) + 1 }
        })

        // Omega Red (id=7): heals half of damage dealt
        if (villain?.id === 7) {
          const heal = Math.floor(damage / 2)
          if (heal > 0) {
            await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
              (cur) => Math.min(villain.hp, (cur ?? 0) + heal))
          }
        }
      }

      // [C] C_REDIRECT_HALF (Jean Grey HP ≤ 20): reflect half damage back to villain
      if (damage > 0 && playerCEffect === 'C_REDIRECT_HALF') {
        const reflected = Math.floor(damage / 2)
        if (reflected > 0) {
          await runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
            cur => Math.max(0, (cur ?? 0) - reflected))
        }
      }
    }

    // Store resolved damage so the client shows the correct value (not raw roll diff)
    await update(ref(db, `rooms/${code}/villainBattle`), { resolvedDamage: damage })

    // Mission: survive_apocalypse — every battle vs Apocalypse regardless of outcome
    if (villainId === 2) await _checkMissionProgress(code, playerId, 'survive_apocalypse', {})

    // Post-battle luck card updates
    {
      const luckOps = []
      // Phoenix: decrement charges
      if (_hasLuck(playerData, 'dice_d20')) {
        luckOps.push(runTransaction(ref(db, `rooms/${code}/players/${playerId}/luckCards/dice_d20`), card => {
          if (!card) return null
          const n = (card.charges || 0) - 1
          return n <= 0 ? null : { ...card, charges: n }
        }))
      }
      // Ciclope: clear when raw roll hits 12
      if (_hasLuck(playerData, 'dice_d12_until_12') && playerRoll >= 12)
        luckOps.push(update(ref(db, `rooms/${code}/players/${playerId}`), { 'luckCards/dice_d12_until_12': null }))
      // Sanguessuga: clear when player wins
      if (_hasLuck(playerData, 'disable_abilities') && playerRoll > villainRoll)
        luckOps.push(update(ref(db, `rooms/${code}/players/${playerId}`), { 'luckCards/disable_abilities': null }))
      if (luckOps.length) await Promise.all(luckOps)
    }

    // Decrement forge item charges after villain battle (not bomb id=5)
    if (playerForgeId && playerForgeId !== 5) {
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}/forgeItem`), (fi) => {
        if (!fi) return fi
        const remaining = (fi.charges ?? 5) - 1
        return remaining <= 0 ? null : { ...fi, charges: remaining }
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

export async function assignBomb(code, playerId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { bomb: { counter: 0 } })
}

export async function removeBomb(code, playerId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { bomb: null })
}

export async function removeParalysis(code, playerId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { paralyzedUntil: null })
}

export async function tickBomb(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/bomb/counter`), (cur) =>
    Math.min(5, (cur ?? 0) + 1)
  )
}

export async function detonateBomb(code, playerId, villainId, xmenPresent) {
  const villain = villains.find(v => v.id === villainId)
  const maxHp = villain?.hp ?? 999
  if (xmenPresent) {
    await Promise.all([
      runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
        (cur) => Math.max(0, (cur ?? 0) - 5)),
      runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
        if (!p) return null
        const newHp = Math.max(0, (p.hp ?? 100) - 5)
        return { ...p, hp: newHp, alive: newHp > 0, bomb: null }
      }),
    ])
  } else {
    await Promise.all([
      runTransaction(ref(db, `rooms/${code}/villainHp/${villainId}`),
        (cur) => Math.max(0, (cur ?? 0) - 10)),
      update(ref(db, `rooms/${code}/players/${playerId}`), { bomb: null }),
    ])
  }
}

export async function giveForgeItem(code, playerId, item) {
  const stored = item.id === 5 ? item : { ...item, charges: 5 }
  await update(ref(db, `rooms/${code}/players/${playerId}`), { forgeItem: stored })
}

export async function clearForgeItem(code, playerId) {
  await update(ref(db, `rooms/${code}/players/${playerId}`), { forgeItem: null })
}

export async function applyLuckCard(code, playerId, card) {
  if (card.persistent) {
    await update(ref(db, `rooms/${code}/players/${playerId}`), { [`luckCards/${card.effect}`]: card })
    return
  }
  switch (card.type) {
    case 'heal':
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), p => {
        if (!p) return null
        return { ...p, hp: Math.min(100, (p.hp || 0) + card.value), alive: true }
      })
      break
    case 'damage':
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), p => {
        if (!p) return null
        const newHp = Math.max(0, (p.hp || 0) - card.value)
        return { ...p, hp: newHp, alive: newHp > 0 }
      })
      break
    case 'aoe_damage': {
      const [playerSnap, villainHpSnap, unlockedSnap] = await Promise.all([
        get(ref(db, `rooms/${code}/players`)),
        get(ref(db, `rooms/${code}/villainHp`)),
        get(ref(db, `rooms/${code}/unlockedVillains`)),
      ])
      const all = Object.entries(playerSnap.val() || {})
      const villainHpMap = villainHpSnap.val() || {}
      const unlockedMap = unlockedSnap.val() || {}

      const ops = [
        // Damage all alive players except card owner
        ...all
          .filter(([id, p]) => id !== playerId && p.alive)
          .map(([id]) => runTransaction(ref(db, `rooms/${code}/players/${id}`), p => {
            if (!p || !p.alive) return p
            const newHp = Math.max(0, (p.hp || 0) - card.value)
            return { ...p, hp: newHp, alive: newHp > 0 }
          })),
        // Damage all alive villains except locked Magneto (id=1) and Apocalipse (id=2)
        ...Object.entries(villainHpMap)
          .filter(([vid, hp]) => {
            const vId = Number(vid)
            if (hp <= 0) return false
            if ((vId === 1 || vId === 2) && !unlockedMap[vId]) return false
            return true
          })
          .map(([vid]) =>
            runTransaction(ref(db, `rooms/${code}/villainHp/${Number(vid)}`),
              cur => Math.max(0, (cur ?? 0) - card.value))
          ),
      ]
      await Promise.all(ops)
      break
    }
    case 'token':
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}/tokens`), cur =>
        Math.max(0, (cur || 0) + card.value))
      break
    case 'revive':
      await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), p => {
        if (!p) return null
        return { ...p, hp: card.value, alive: true }
      })
      break
    default:
      break
  }
}

export async function clearLuckCard(code, playerId, effect) {
  if (effect) {
    await update(ref(db, `rooms/${code}/players/${playerId}`), { [`luckCards/${effect}`]: null })
  } else {
    await update(ref(db, `rooms/${code}/players/${playerId}`), { luckCards: null })
  }
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
  if (delta > 0) await _checkMissionProgress(code, playerId, 'turns', {})
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

export async function submitRoll(code, playerId, roll, preB, forgeItem) {
  const battleRef = ref(db, `rooms/${code}/battle`)
  const snap = await get(battleRef)
  const battle = snap.val()
  if (!battle || battle.resolved) return

  const isAttacker = battle.attackerId === playerId
  const isDefender = battle.defenderId === playerId
  if (!isAttacker && !isDefender) return // not in this battle

  const myKey    = isAttacker ? 'attackerRoll'    : 'defenderRoll'
  const myPrebKey = isAttacker ? 'attackerPreB'   : 'defenderPreB'
  const myForgeKey = isAttacker ? 'attackerForgeId' : 'defenderForgeId'
  const myForgeBonusKey = isAttacker ? 'attackerForgeBonus' : 'defenderForgeBonus'
  if (battle[myKey] != null) return // already rolled

  await update(ref(db), {
    [`rooms/${code}/battle/${myKey}`]: roll,
    [`rooms/${code}/battle/${myPrebKey}`]: preB ?? false,
    [`rooms/${code}/battle/${myForgeKey}`]: forgeItem?.id ?? null,
    [`rooms/${code}/battle/${myForgeBonusKey}`]: forgeItem?.diceBonus ?? 0,
  })

  const afterSnap = await get(battleRef)
  const after = afterSnap.val()
  if (!after || after.resolved) return
  if (after.attackerRoll != null && after.defenderRoll != null) {
    await _resolveBattle(code, after)
  }
}

async function _checkMissionProgress(code, playerId, eventType, eventData = {}) {
  const txResult = await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), player => {
    if (!player || player.missionCompleted) return player
    const mission = MISSIONS.find(m => m.id === player.missionId)
    if (!mission || mission.auto !== eventType) return player
    if (eventType === 'villain_kill' && mission.villainId !== eventData.villainId) return player
    if (eventType === 'sentinel_kill' && (eventData.villainId < 8 || eventData.villainId > 10)) return player
    const newProgress = (player.missionProgress || 0) + 1
    const completed = newProgress >= mission.goal
    return { ...player, missionProgress: newProgress, missionCompleted: completed }
  })
  const updated = txResult.snapshot.val()
  if (updated?.missionCompleted) {
    const mission = MISSIONS.find(m => m.id === updated.missionId)
    await _triggerMissionVictory(code, playerId, updated.name, mission)
  }
}

export async function incrementMissionProgress(code, playerId) {
  const snap = await get(ref(db, `rooms/${code}/players/${playerId}`))
  const player = snap.val()
  const mission = MISSIONS.find(m => m.id === player?.missionId)
  if (!mission || player.missionCompleted) return
  const newProgress = (player.missionProgress ?? 0) + 1
  const completed = newProgress >= mission.goal
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    missionProgress: newProgress,
    missionCompleted: completed,
  })
  if (completed) await _triggerMissionVictory(code, playerId, player.name, mission)
}

export async function completeMission(code, playerId) {
  const snap = await get(ref(db, `rooms/${code}/players/${playerId}`))
  const player = snap.val()
  const mission = MISSIONS.find(m => m.id === player?.missionId)
  if (!mission) return
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    missionProgress: mission.goal,
    missionCompleted: true,
  })
  await _triggerMissionVictory(code, playerId, player.name, mission)
}

async function _triggerMissionVictory(code, playerId, playerName, mission) {
  const alreadySnap = await get(ref(db, `rooms/${code}/missionWinner`))
  if (alreadySnap.exists()) return // another player already won
  await update(ref(db, `rooms/${code}`), {
    missionWinner: { playerId, playerName, missionId: mission.id, missionName: mission.name },
    status: 'ended',
  })
}

function _isCActive(player, char) {
  if (!char?.abilityC || !player) return false
  const cond = char.abilityC.condition
  const hp = player.hp ?? 100
  if (cond === 'always')    return true
  if (cond === 'hp_lte_20') return hp <= 20
  if (cond === 'hp_lte_30') return hp <= 30
  if (cond === 'hp_lte_35') return hp <= 35
  if (cond === 'hp_lte_40') return hp <= 40
  if (cond === 'hp_lte_50') return hp <= 50
  return false
}

function _abilityChance(player, char, allPlayers) {
  return Math.min(90, (player.tokens || 0) * 10)
}

function _rollsChance(chance) {
  return Math.random() * 100 < chance
}

export async function addTrapCard(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/trapCards`), (cur) => (cur || 0) + 1)
}

export async function triggerTrapCard(code, playerId, targetId) {
  await runTransaction(ref(db, `rooms/${code}/players/${targetId}`), (p) => {
    if (!p || !p.alive) return p
    const newHp = Math.max(0, (p.hp ?? 0) - 3)
    return { ...p, hp: newHp, alive: newHp > 0 }
  })
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/trapCards`), (cur) => Math.max(0, (cur || 0) - 1))
}

export async function resetBattleState(code, playerId, usedPreB, turn) {
  const patch = { preB: false, cActive: false }
  if (usedPreB) patch.preBUsedOnTurn = turn
  await update(ref(db, `rooms/${code}/players/${playerId}`), patch)
}

export async function decrementForgeCharge(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}/forgeItem`), (fi) => {
    if (!fi || fi.id === 5) return fi
    const remaining = (fi.charges ?? 5) - 1
    return remaining <= 0 ? null : { ...fi, charges: remaining }
  })
}

export async function incrementPlayerWins(code, playerId) {
  await runTransaction(ref(db, `rooms/${code}/players/${playerId}`), (p) => {
    if (!p) return p
    return { ...p, wins: (p.wins || 0) + 1 }
  })
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
    await update(ref(db, `rooms/${code}/players/${attackerId}`), { preB: false, ...(attPreB ? { preBUsedOnTurn: attPlayer.turn ?? 1 } : {}) })
    await update(ref(db, `rooms/${code}/players/${defenderId}`), { preB: false, ...(defPreB ? { preBUsedOnTurn: defPlayer.turn ?? 1 } : {}) })
    setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 3500)
    return
  }

  const attChance = attPlayer ? _abilityChance(attPlayer, attChar, allPlayers) : 0
  const defChance = defPlayer ? _abilityChance(defPlayer, defChar, allPlayers) : 0

  // abilityDisabled = true means Vampira currently holds this player's [A] ability
  let attEffect = attPlayer?.abilityDisabled ? null : (attChar?.ability?.effect ?? null)
  let defEffect = defPlayer?.abilityDisabled ? null : (defChar?.ability?.effect ?? null)

  // Sanguessuga: disable all abilities for affected player
  if (_hasLuck(attPlayer, 'disable_abilities')) attEffect = null
  if (_hasLuck(defPlayer, 'disable_abilities')) defEffect = null

  // [C] effects — automatic when condition is met
  const attCEffect = _hasLuck(attPlayer, 'disable_abilities') ? null
    : _isCActive(attPlayer, attChar) ? (attChar?.abilityC?.effect ?? null) : null
  const defCEffect = _hasLuck(defPlayer, 'disable_abilities') ? null
    : _isCActive(defPlayer, defChar) ? (defChar?.abilityC?.effect ?? null) : null

  // [C] C_ABSORB_SURE / C_PIERCE_SURE guarantee [A] activation
  // Passive abilities always activate regardless of tokens
  const PASSIVE_EFFECTS = new Set(['HEAL_HALF', 'MIN_DAMAGE_3', 'DODGE_TOKEN', 'PSYCHIC_DAMAGE'])
  let attActivated = attEffect ? (PASSIVE_EFFECTS.has(attEffect) || _rollsChance(attChance)) : false
  let defActivated = defEffect ? (PASSIVE_EFFECTS.has(defEffect) || _rollsChance(defChance)) : false
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

  // Sanguessuga: disable B abilities
  if (_hasLuck(attPlayer, 'disable_abilities')) attBEffect = null
  if (_hasLuck(defPlayer, 'disable_abilities')) defBEffect = null

  // B_NINJA cancels opponent's [B] (unless both have it — then both apply)
  if (attBEffect === 'B_NINJA' && defBEffect !== 'B_NINJA') defBEffect = null
  if (defBEffect === 'B_NINJA' && attBEffect !== 'B_NINJA') attBEffect = null

  // [B] reroll: replaces roll before any modifier
  if (attBEffect === 'B_REROLL') attackerRoll = Math.ceil(Math.random() * (attChar?.diceType || 6))
  if (defBEffect === 'B_REROLL') defenderRoll = Math.ceil(Math.random() * (defChar?.diceType || 6))

  // B_TRAP_CARD (Gambit): trap card placement is handled client-side via addTrapCard after battle

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
      // Escudo do Capitão (forge id=4): halves incoming damage
      const loserForgeId = loserId === attackerId ? battle.attackerForgeId : battle.defenderForgeId
      if (loserForgeId === 4) damage = Math.floor(damage / 2)
    }

    // [C] C_DODGE_50 — 50% chance loser takes no damage
    if (loserCEffect === 'C_DODGE_50' && Math.random() < 0.5) damage = 0

    // [C] C_HIGH_CARD (Gambit HP ≤ 20) — damage fixed at 5, overrides everything
    if (attCEffect === 'C_HIGH_CARD' || defCEffect === 'C_HIGH_CARD') damage = 5

    // [A] DODGE_TOKEN (Gambit) — loser spends 1 token to take 0 damage (only when C_HIGH_CARD is not overriding)
    const loserPlayerData = loserId === attackerId ? attPlayer : defPlayer
    const highCardActive = attCEffect === 'C_HIGH_CARD' || defCEffect === 'C_HIGH_CARD'
    if (!highCardActive && loserEffect === 'DODGE_TOKEN' && (loserPlayerData?.tokens ?? 0) >= 1) {
      damage = 0
      await update(ref(db, `rooms/${code}/players/${loserId}`), { tokens: (loserPlayerData.tokens || 1) - 1 })
    }
  }

  // [B] B_PARALYZE (Jean Grey) — winner paralyzes loser for N turns (N = winner's tokens)
  if (loserId && winnerId && winnerBEffect === 'B_PARALYZE') {
    const winnerPlayer = winnerId === attackerId ? attPlayer : defPlayer
    const loserPlayerDataB = loserId === attackerId ? attPlayer : defPlayer
    const N = Math.max(1, winnerPlayer?.tokens ?? 1)
    const untilTurn = (loserPlayerDataB?.turn ?? 1) + N - 1
    await update(ref(db, `rooms/${code}/players/${loserId}`), { paralyzedUntil: untilTurn })
    await update(battleRef, { paralysisInfo: { name: loserPlayerDataB?.name ?? 'Oponente', turns: N } })
  }

  // [A] PSYCHIC_DAMAGE (Jean Grey) — when Jean loses, deal 3 to a random alive player or villain
  if (loserId && loserEffect === 'PSYCHIC_DAMAGE') {
    const vHpSnap = await get(ref(db, `rooms/${code}/villainHp`))
    const vHpData = vHpSnap.val() || {}
    const targetPlayers = allPlayers.filter(p => p.id !== loserId && p.alive && (p.hp ?? 0) > 0)
    const targetVillains = Object.entries(vHpData)
      .filter(([, hp]) => hp > 0)
      .map(([vid]) => ({ type: 'villain', id: Number(vid), name: villains.find(v => v.id === Number(vid))?.name ?? 'Boss' }))
    const pool = [
      ...targetPlayers.map(p => ({ type: 'player', id: p.id, name: p.name })),
      ...targetVillains,
    ]
    if (pool.length > 0) {
      const target = pool[Math.floor(Math.random() * pool.length)]
      if (target.type === 'player') {
        await runTransaction(ref(db, `rooms/${code}/players/${target.id}`), (p) => {
          if (!p) return null
          const newHp = Math.max(0, p.hp - 3)
          return { ...p, hp: newHp, alive: newHp > 0 }
        })
      } else {
        await runTransaction(ref(db, `rooms/${code}/villainHp/${target.id}`), (hp) => {
          if (hp == null) return null
          return Math.max(0, hp - 3)
        })
      }
      await update(battleRef, { psychicTarget: { name: target.name, type: target.type, damage: 3 } })
    }
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

  // Mission: kill_player — check before applying damage
  if (loserId && winnerId && damage > 0) {
    const loserHpBefore = (loserId === attackerId ? attPlayer : defPlayer)?.hp ?? 100
    const wouldDie = loserHpBefore <= damage && loserCEffect !== 'C_SURVIVE_1'
    if (wouldDie) await _checkMissionProgress(code, winnerId, 'kill_player', {})
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
        return { ...p, consecutiveLosses: 0, stolenAbility: sa }
      }
      return { ...p, consecutiveLosses: 0 }
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

  // Post-battle luck card updates
  {
    const luckOps = []
    // Phoenix: decrement charges for both players
    for (const [pid, player] of [[attackerId, attPlayer], [defenderId, defPlayer]]) {
      if (_hasLuck(player, 'dice_d20')) {
        luckOps.push(runTransaction(ref(db, `rooms/${code}/players/${pid}/luckCards/dice_d20`), card => {
          if (!card) return null
          const n = (card.charges || 0) - 1
          return n <= 0 ? null : { ...card, charges: n }
        }))
      }
    }
    // Ciclope: clear when player's raw roll hits 12
    if (_hasLuck(attPlayer, 'dice_d12_until_12') && battle.attackerRoll >= 12)
      luckOps.push(update(ref(db, `rooms/${code}/players/${attackerId}`), { 'luckCards/dice_d12_until_12': null }))
    if (_hasLuck(defPlayer, 'dice_d12_until_12') && battle.defenderRoll >= 12)
      luckOps.push(update(ref(db, `rooms/${code}/players/${defenderId}`), { 'luckCards/dice_d12_until_12': null }))
    // Sanguessuga: clear for the winner
    if (winnerId && _hasLuck(allPlayers.find(p => p.id === winnerId), 'disable_abilities'))
      luckOps.push(update(ref(db, `rooms/${code}/players/${winnerId}`), { 'luckCards/disable_abilities': null }))
    if (luckOps.length) await Promise.all(luckOps)
  }

  // preB/preBUsedOnTurn/cActive reset is handled client-side in Game.jsx
  // Forge charge decrement for player battles is handled client-side in Game.jsx

  clearTimeout(ensureCleared)
  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 4000)

  } catch (err) {
    clearTimeout(ensureCleared)
    await remove(ref(db, `rooms/${code}/battle`)).catch(() => {})
  }
}
