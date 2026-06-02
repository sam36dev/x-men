export const TROPHIES = [
  // Vitórias
  { id: 'first_win',       icon: '🏆', name: 'Primeiros Passos',      desc: 'Venceu sua primeira batalha',          category: 'wins'    },
  { id: 'win_5',           icon: '⚔️', name: 'Veterano X',            desc: '5 vitórias acumuladas',                category: 'wins'    },
  { id: 'win_25',          icon: '🌟', name: 'Força dos X-Men',        desc: '25 vitórias acumuladas',               category: 'wins'    },
  { id: 'win_50',          icon: '💎', name: 'Lenda',                  desc: '50 vitórias acumuladas',               category: 'wins'    },

  // Vilões
  { id: 'beat_sabretooth', icon: '🦷', name: 'Predador Caçado',        desc: 'Derrotou Dente de Sabre',              category: 'villains' },
  { id: 'beat_mystique',   icon: '🎭', name: 'Desmascarada',           desc: 'Derrotou Mística',                     category: 'villains' },
  { id: 'beat_juggernaut', icon: '🪨', name: 'Nada É Imparável',       desc: 'Derrotou Juggernaut',                  category: 'villains' },
  { id: 'beat_omega_red',  icon: '🪱', name: 'Fim do Parasita',        desc: 'Derrotou Omega Red',                   category: 'villains' },
  { id: 'beat_sinister',   icon: '🧬', name: 'Experimento Encerrado',  desc: 'Derrotou Sr. Sinistro',                category: 'villains' },
  { id: 'beat_magneto',    icon: '🧲', name: 'Campo Neutralizado',     desc: 'Derrotou Magneto',                     category: 'villains' },
  { id: 'beat_apocalypse', icon: '☠️', name: 'Sobrevivente',           desc: 'Derrotou Apocalipse',                  category: 'villains' },
  { id: 'beat_all_villains',icon:'👑', name: 'X-Men Supremo',          desc: 'Derrotou todos os vilões',             category: 'villains' },

  // Feitos em batalha
  { id: 'first_game',      icon: '🎮', name: 'Bem-vindo aos X-Men',    desc: 'Jogou sua primeira partida',           category: 'feats'   },
  { id: 'low_hp_win',      icon: '❤️', name: 'Na Última Gota',         desc: 'Venceu uma batalha com HP ≤ 10',       category: 'feats'   },
  { id: 'c_ability',       icon: '⚡', name: 'Poder Desperto',          desc: 'Ativou uma habilidade [C]',            category: 'feats'   },
  { id: 'max_damage',      icon: '💥', name: 'Dano Crítico',            desc: 'Causou 15 ou mais de dano em batalha', category: 'feats'   },
  { id: 'comeback',        icon: '🔥', name: 'De Volta',               desc: 'Venceu com HP ≤ 20 após estar perdendo',category: 'feats'  },
]

// Mapeamento villainId → trophyId
export const VILLAIN_TROPHIES = {
  1: 'beat_magneto',
  2: 'beat_apocalypse',
  3: 'beat_mystique',
  4: 'beat_juggernaut',
  5: 'beat_sabretooth',
  6: 'beat_sinister',
  7: 'beat_omega_red',
}

export function getTrophy(id) {
  return TROPHIES.find(t => t.id === id)
}
