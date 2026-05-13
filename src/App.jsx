import { useState } from 'react'
import { getPlayerId } from './firebase'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import CharacterGrid from './components/CharacterGrid'
import CardDetail from './components/CardDetail'
import './App.css'

const playerId = getPlayerId()

export default function App() {
  const [screen, setScreen] = useState('home')
  const [roomCode, setRoomCode] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)

  function enterRoom(code) {
    setRoomCode(code)
    setScreen('lobby')
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
          onGameStart={() => setScreen('game')}
          onLeave={() => setScreen('home')}
        />
      )}
      {screen === 'game' && (
        <Game
          roomCode={roomCode}
          playerId={playerId}
          onLeave={() => setScreen('home')}
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
