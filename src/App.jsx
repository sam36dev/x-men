import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { logout, backfillVillainTrophies } from './userService'
import { ref, get } from 'firebase/database'
import { db } from './firebase'
import Auth from './components/Auth'
import Admin from './components/Admin'
import BootstrapAdmin from './components/BootstrapAdmin'
import TrophyToast from './components/TrophyToast'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import CharacterGrid from './components/CharacterGrid'
import CardDetail from './components/CardDetail'
import Trophies from './components/Trophies'
import './App.css'

function parseUrl() {
  const path = window.location.pathname
  if (path === '/setup-admins') return { screen: 'setup', roomCode: null }
  const game  = path.match(/^\/game\/([A-Z0-9]{6})$/i)
  const lobby = path.match(/^\/lobby\/([A-Z0-9]{6})$/i)
  if (game)  return { screen: 'game',  roomCode: game[1].toUpperCase() }
  if (lobby) return { screen: 'lobby', roomCode: lobby[1].toUpperCase() }
  return { screen: 'home', roomCode: null }
}

function pushUrl(screen, roomCode) {
  const path =
    screen === 'game'  ? `/game/${roomCode}`  :
    screen === 'lobby' ? `/lobby/${roomCode}` : '/'
  if (window.location.pathname !== path) history.pushState({}, '', path)
}

export default function App() {
  const [user,         setUser]         = useState(undefined) // undefined = checking auth
  const [isAdmin,      setIsAdmin]      = useState(false)
  const initial = parseUrl()
  const [screen,       setScreen]       = useState(initial.screen)
  const [roomCode,     setRoomCode]     = useState(initial.roomCode)
  const [selectedCard, setSelectedCard] = useState(null)

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!auth) { setUser(null); return }
    return onAuthStateChanged(auth, async u => {
      setUser(u ?? null)
      if (u) {
        backfillVillainTrophies(u.uid).catch(() => {})
        const snap = await get(ref(db, `users/${u.uid}/isAdmin`))
        setIsAdmin(snap.val() === true)
      } else {
        setIsAdmin(false)
      }
    })
  }, [])

  // Browser back/forward
  useEffect(() => {
    function onPop() {
      const { screen, roomCode } = parseUrl()
      setScreen(screen); setRoomCode(roomCode)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function enterRoom(code) {
    setRoomCode(code); setScreen('lobby'); pushUrl('lobby', code)
  }
  function goToGame() {
    setScreen('game'); pushUrl('game', roomCode)
  }
  function goHome() {
    setRoomCode(null); setScreen('home'); pushUrl('home', null)
  }
  async function handleLogout() {
    await logout(); setScreen('home'); setRoomCode(null)
  }

  // Setup page — no auth required
  if (screen === 'setup') return <div className="app"><BootstrapAdmin /></div>

  // Checking auth state — show minimal loading screen
  if (user === undefined) return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#07111a',
    }}>
      <span style={{ color: '#FFCC00', fontFamily: 'Bangers, cursive', fontSize: '1.5rem', letterSpacing: '0.2em' }}>
        X-MEN…
      </span>
    </div>
  )

  // Not logged in
  if (!user) return <div className="app"><Auth onAuth={setUser} /></div>

  // Admin accounts go straight to admin panel
  if (isAdmin) return <div className="app"><Admin user={user} /><TrophyToast /></div>

  const playerId   = user.uid
  const playerName = user.displayName ?? 'Jogador'

  return (
    <div className="app">
      {screen === 'home' && (
        <Home
          playerId={playerId}
          playerName={playerName}
          user={user}
          onLogout={handleLogout}
          onEnterRoom={enterRoom}
          onViewCards={() => setScreen('cards')}
          onViewTrophies={() => setScreen('trophies')}
        />
      )}
      {screen === 'trophies' && (
        <Trophies user={user} onBack={() => setScreen('home')} />
      )}
      {screen === 'lobby' && (
        <Lobby
          roomCode={roomCode}
          playerId={playerId}
          onGameStart={goToGame}
          onLeave={goHome}
        />
      )}
      {screen === 'game' && (
        <Game
          roomCode={roomCode}
          playerId={playerId}
          user={user}
          onLeave={goHome}
        />
      )}
      {screen === 'cards' && !selectedCard && (
        <CharacterGrid
          onSelect={setSelectedCard}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'cards' && selectedCard && (
        <CardDetail
          character={selectedCard}
          onBack={() => setSelectedCard(null)}
        />
      )}
      <TrophyToast />
    </div>
  )
}
