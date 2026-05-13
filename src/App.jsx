import { useEffect, useState } from 'react'
import { getPlayerId } from './firebase'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import CharacterGrid from './components/CharacterGrid'
import CardDetail from './components/CardDetail'
import './App.css'

const playerId = getPlayerId()

function parseUrl() {
  const path = window.location.pathname
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
  const initial = parseUrl()
  const [screen,       setScreen]       = useState(initial.screen)
  const [roomCode,     setRoomCode]     = useState(initial.roomCode)
  const [selectedCard, setSelectedCard] = useState(null)

  // Sync URL → state when user hits Back/Forward
  useEffect(() => {
    function onPop() {
      const { screen, roomCode } = parseUrl()
      setScreen(screen)
      setRoomCode(roomCode)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function enterRoom(code) {
    setRoomCode(code)
    setScreen('lobby')
    pushUrl('lobby', code)
  }

  function goToGame() {
    setScreen('game')
    pushUrl('game', roomCode)
  }

  function goHome() {
    setRoomCode(null)
    setScreen('home')
    pushUrl('home', null)
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
