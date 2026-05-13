const KEY = 'xmen_session'

export function saveSession(roomCode, screen) {
  localStorage.setItem(KEY, JSON.stringify({ roomCode, screen }))
}

export function getSession() {
  try {
    const s = localStorage.getItem(KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
