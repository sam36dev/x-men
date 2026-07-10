import { useEffect, useState } from 'react'
import { getTrophy } from '../data/trophies'
import './TrophyToast.css'

export default function TrophyToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function onUnlock(e) {
      const trophy = getTrophy(e.detail.trophyId)
      if (!trophy) return
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, trophy }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
    }
    window.addEventListener('trophy-unlocked', onUnlock)
    return () => window.removeEventListener('trophy-unlocked', onUnlock)
  }, [])

  if (!toasts.length) return null

  return (
    <div className="trophy-toast-stack">
      {toasts.map(({ id, trophy }) => (
        <div key={id} className="trophy-toast">
          <span className="trophy-toast__icon">{trophy.icon}</span>
          <div className="trophy-toast__text">
            <span className="trophy-toast__label">Troféu desbloqueado!</span>
            <span className="trophy-toast__name">{trophy.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
