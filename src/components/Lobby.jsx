import { useEffect, useState } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../firebase'
import { selectCharacter, startGame, leaveRoom } from '../roomService'
import { characters } from '../data/characters'
import './Lobby.css'

export default function Lobby({ roomCode, playerId, onGameStart, onLeave }) {
  const [room, setRoom] = useState(null)

  useEffect(() => {
    const r = ref(db, `rooms/${roomCode}`)
    onValue(r, snap => {
      const data = snap.val()
      if (!data) { onLeave(); return }
      setRoom(data)
      if (data.status === 'playing') onGameStart()
    })
    return () => off(r)
  }, [roomCode])

  if (!room) return <div className="lobby-loading">Conectando à sala…</div>

  const players = Object.entries(room.players || {}).map(([id, p]) => ({ id, ...p }))
  const me = players.find(p => p.id === playerId)
  const isHost = room.hostId === playerId
  const allReady = players.length >= 2 && players.every(p => p.characterId)
  const takenIds = players.map(p => p.characterId).filter(Boolean)

  async function handleLeave() {
    await leaveRoom(roomCode, playerId)
    onLeave()
  }

  return (
    <div className="lobby-page">
      <div className="lobby-topbar">
        <button className="lobby-back" onClick={handleLeave}>← Sair</button>
        <div className="lobby-code-wrap">
          <span className="lobby-code-label">Código</span>
          <span className="lobby-code">{roomCode}</span>
        </div>
      </div>

      <div className="lobby-players">
        <h3 className="lobby-section-title">Jogadores ({players.length}/8)</h3>
        {players.map(p => {
          const char = characters.find(c => c.id === p.characterId)
          return (
            <div key={p.id} className={`lobby-player ${p.id === playerId ? 'lobby-player--me' : ''}`}>
              <span className="lobby-player__name">
                {p.name}
                {p.id === room.hostId && <span className="crown">👑</span>}
              </span>
              {char
                ? <span className="lobby-player__char" style={{ color: char.color }}>
                    {char.typeIcon} {char.name}
                  </span>
                : <span className="lobby-player__char lobby-player__char--waiting">escolhendo…</span>
              }
            </div>
          )
        })}
      </div>

      {!me?.characterId && (
        <div className="lobby-pick">
          <h3 className="lobby-section-title">Escolha seu personagem</h3>
          <div className="lobby-char-grid">
            {characters.map(char => {
              const taken = takenIds.includes(char.id)
              return (
                <button
                  key={char.id}
                  className={`lobby-char-btn ${taken ? 'lobby-char-btn--taken' : ''}`}
                  style={{ '--accent': char.color }}
                  onClick={() => !taken && selectCharacter(roomCode, playerId, char.id)}
                  disabled={taken}
                >
                  <div className="lobby-char-btn__img-wrap">
                    <img
                      src={char.image}
                      alt={char.name}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                    <span className="lobby-char-btn__fallback">{char.name.charAt(0)}</span>
                  </div>
                  <span className="lobby-char-btn__name">{char.name}</span>
                  <span className="lobby-char-btn__dice">D{char.diceType}</span>
                  {taken && <span className="lobby-char-btn__taken-badge">●</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {me?.characterId && (
        <div className="lobby-ready">
          <span className="lobby-ready__icon">✓</span>
          <span>Você está pronto!</span>
        </div>
      )}

      {isHost && allReady && (
        <button className="lobby-start-btn" onClick={() => startGame(roomCode)}>
          ⚔️ Iniciar Jogo
        </button>
      )}

      {isHost && !allReady && (
        <p className="lobby-wait">
          {players.length < 2
            ? 'Aguardando mais jogadores entrarem…'
            : 'Aguardando todos escolherem personagem…'}
        </p>
      )}

      {!isHost && (
        <p className="lobby-wait">Aguardando o host iniciar o jogo…</p>
      )}
    </div>
  )
}
