import { auth, db } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { ref, set, get, runTransaction } from 'firebase/database'
import { VILLAIN_TROPHIES } from './data/trophies'

// Converts username → fake email used by Firebase Auth internally
const toEmail = (username) =>
  `${username.toLowerCase().replace(/[^a-z0-9_]/g, '')}@xmen.game`

export async function register(username, password) {
  const clean = username.trim()
  if (clean.length < 3)  throw new Error('Username deve ter ao menos 3 caracteres')
  if (clean.length > 20) throw new Error('Username deve ter no máximo 20 caracteres')
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) throw new Error('Use apenas letras, números e _')
  if (password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres')

  // Check username availability
  const taken = await get(ref(db, `usernames/${clean.toLowerCase()}`))
  if (taken.exists()) throw new Error('Username já em uso — escolha outro')

  const { user } = await createUserWithEmailAndPassword(auth, toEmail(clean), password)
  await updateProfile(user, { displayName: clean })

  await set(ref(db, `users/${user.uid}`), {
    username: clean,
    createdAt: Date.now(),
    stats: { totalWins: 0, totalGames: 0, villainsDefeated: 0 },
  })
  await set(ref(db, `usernames/${clean.toLowerCase()}`), user.uid)

  return user
}

export async function login(username, password) {
  const clean = username.trim()
  if (!clean) throw new Error('Digite seu username')
  const { user } = await signInWithEmailAndPassword(auth, toEmail(clean), password)
  return user
}

export async function logout() {
  await signOut(auth)
}

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`))
  return snap.val()
}

// Awards a trophy if not already earned. Returns true if newly awarded.
export async function awardTrophy(uid, trophyId) {
  if (!uid || !trophyId) return false
  const tRef = ref(db, `users/${uid}/trophies/${trophyId}`)
  const snap = await get(tRef)
  if (snap.exists()) return false
  await set(tRef, Date.now())
  window.dispatchEvent(new CustomEvent('trophy-unlocked', { detail: { trophyId } }))
  return true
}

// Call after each player win — checks and awards win-streak trophies
export async function onPlayerWin(uid) {
  if (!uid) return []
  const awarded = []
  await runTransaction(ref(db, `users/${uid}/stats/totalWins`), (cur) => (cur || 0) + 1)
  const snap = await get(ref(db, `users/${uid}/stats/totalWins`))
  const wins = snap.val() || 0

  if (wins === 1  && await awardTrophy(uid, 'first_win'))  awarded.push('first_win')
  if (wins === 5  && await awardTrophy(uid, 'win_5'))      awarded.push('win_5')
  if (wins === 25 && await awardTrophy(uid, 'win_25'))     awarded.push('win_25')
  if (wins === 50 && await awardTrophy(uid, 'win_50'))     awarded.push('win_50')
  return awarded
}

// Call when a villain is defeated
export async function onVillainDefeated(uid, villainId) {
  if (!uid) return []
  const awarded = []
  await runTransaction(ref(db, `users/${uid}/stats/villainsDefeated`), (cur) => (cur || 0) + 1)

  const trophyId = VILLAIN_TROPHIES[villainId]
  if (trophyId && await awardTrophy(uid, trophyId)) awarded.push(trophyId)

  // Check all villains trophy
  const trophyIds = Object.values(VILLAIN_TROPHIES)
  const checks = await Promise.all(
    trophyIds.map(tid => get(ref(db, `users/${uid}/trophies/${tid}`)).then(s => s.exists()))
  )
  if (checks.every(Boolean) && await awardTrophy(uid, 'beat_all_villains')) {
    awarded.push('beat_all_villains')
  }
  return awarded
}

// Call on first game join
export async function onFirstGame(uid) {
  return await awardTrophy(uid, 'first_game') ? ['first_game'] : []
}

// Retroactively award villain trophies for users who completed villain-kill missions
// before this feature existed. Safe to call on every login (awardTrophy is idempotent).
const MISSION_TO_VILLAIN_TROPHY = {
  mission_1:  'beat_magneto',
  mission_2:  'beat_mystique',
  mission_3:  'beat_sabretooth',
  mission_4:  'beat_apocalypse',
  mission_5:  'beat_juggernaut',
  mission_13: 'beat_omega_red',
}
export async function backfillVillainTrophies(uid) {
  if (!uid) return
  const snap = await get(ref(db, `users/${uid}/trophies`))
  if (!snap.exists()) return
  const trophies = snap.val()
  await Promise.all(
    Object.keys(MISSION_TO_VILLAIN_TROPHY)
      .filter(mId => trophies[mId] && !trophies[MISSION_TO_VILLAIN_TROPHY[mId]])
      .map(mId => awardTrophy(uid, MISSION_TO_VILLAIN_TROPHY[mId]))
  )
}

// Fetch all users for ranking
export async function getAllUsers() {
  const snap = await get(ref(db, 'users'))
  if (!snap.exists()) return []
  return Object.entries(snap.val()).map(([uid, data]) => ({ uid, ...data }))
}
