import { useState } from 'react'
import { getPlayerId } from './firebase'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import CharacterGrid from './components/CharacterGrid'
import CardDetail from './components/CardDetail'
import './App.css'

const playerId = getPlayerId()
const SESSION_KEY = 'xmen_session'

function getSaved() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function saveSession(roomCode, screen) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, screen }))
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export default function App() {
  const saved = getSaved()
  const [screen, setScreen] = useState(saved?.screen || 'home')
  const [roomCode, setRoomCode] = useState(saved?.roomCode || null)
  const [selectedCard, setSelectedCard] = useState(null)

  function enterRoom(code) {
    saveSession(code, 'lobby')
    setRoomCode(code)
    setScreen('lobby')
  }

  function goToGame() {
    saveSession(roomCode, 'game')
    setScreen('game')
  }

  function leaveToHome() {
    clearSession()
    setRoomCode(null)
    setScreen('home')
  }

  return (
    <div className="app">
      {screen === 'home' && (
        <Home
          playerId={playerId}
          onEnterRoom={enterRoom}
          onViewCards={() => setScreen('cards')}
        />
      )}
      {screen === 'lobby' && (
        <Lobby
          roomCode={roomCode}
          playerId={playerId}
          onGameStart={goToGame}
          onLeave={leaveToHome}
        />
      )}
      {screen === 'game' && (
        <Game
          roomCode={roomCode}
          playerId={playerId}
          onLeave={leaveToHome}
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
    </div>
  )
}
