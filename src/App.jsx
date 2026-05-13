import { useState } from 'react'
import { getPlayerId } from './firebase'
import { saveSession, getSession, clearSession } from './session'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import CharacterGrid from './components/CharacterGrid'
import CardDetail from './components/CardDetail'
import './App.css'

const playerId = getPlayerId()

export default function App() {
  const saved = getSession()
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

  // Called only on automatic redirects (room deleted, etc.) — keeps session intact
  function goHome() {
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
          onLeave={goHome}
        />
      )}
      {screen === 'game' && (
        <Game
          roomCode={roomCode}
          playerId={playerId}
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
    </div>
  )
}
