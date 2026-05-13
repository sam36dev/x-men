import { db } from './firebase'
import {
  ref, set, get, update, remove,
  runTransaction,
} from 'firebase/database'

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
      [playerId]: { name: playerName, characterId: null, hp: 100, alive: true },
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
    name: playerName, characterId: null, hp: 100, alive: true,
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

export async function attackPlayer(code, attackerId, defenderId) {
  await set(ref(db, `rooms/${code}/battle`), {
    attackerId,
    defenderId,
    attackerRoll: null,
    defenderRoll: null,
    resolved: false,
  })
}

export async function submitRoll(code, playerId, roll) {
  // 1. Read current battle
  const battleRef = ref(db, `rooms/${code}/battle`)
  const snap = await get(battleRef)
  const battle = snap.val()
  if (!battle || battle.resolved) return

  const isAttacker = battle.attackerId === playerId
  const myKey = isAttacker ? 'attackerRoll' : 'defenderRoll'

  // 2. Write my roll
  await update(ref(db), { [`rooms/${code}/battle/${myKey}`]: roll })

  // 3. Re-read — if both rolls present, try to resolve
  const afterSnap = await get(battleRef)
  const after = afterSnap.val()
  if (!after || after.resolved) return
  if (after.attackerRoll !== null && after.defenderRoll !== null) {
    await _resolveBattle(code, after)
  }
}

async function _resolveBattle(code, battle) {
  const battleRef = ref(db, `rooms/${code}/battle`)

  // Atomic flag — only one client resolves
  let mine = false
  await runTransaction(battleRef, (cur) => {
    if (!cur || cur.resolved) return undefined
    if (cur.attackerRoll === null || cur.defenderRoll === null) return undefined
    mine = true
    return { ...cur, resolved: true }
  })
  if (!mine) return

  const { attackerId, defenderId, attackerRoll, defenderRoll } = battle
  const damage = Math.abs(attackerRoll - defenderRoll)
  const loserId =
    attackerRoll > defenderRoll ? defenderId
    : attackerRoll < defenderRoll ? attackerId
    : null

  if (loserId && damage > 0) {
    await runTransaction(ref(db, `rooms/${code}/players/${loserId}`), (p) => {
      if (!p) return null
      const newHp = Math.max(0, p.hp - damage)
      return { ...p, hp: newHp, alive: newHp > 0 }
    })
  }

  // Clear battle after players have seen the result
  setTimeout(() => remove(ref(db, `rooms/${code}/battle`)), 3500)
}
