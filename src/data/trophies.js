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
  { id: 'beat_all_villains',icon:'👑', name: 'X-Men Supremo',          desc: 'Derrotou todos os vilões',             category: 'feats'   },

  // Feitos em batalha
  { id: 'first_game',      icon: '🎮', name: 'Bem-vindo aos X-Men',    desc: 'Jogou sua primeira partida',           category: 'feats'   },
  { id: 'low_hp_win',      icon: '❤️', name: 'Na Última Gota',         desc: 'Venceu uma batalha com HP ≤ 10',       category: 'feats'   },
  { id: 'c_ability',       icon: '⚡', name: 'Poder Desperto',          desc: 'Ativou uma habilidade [C]',            category: 'feats'   },
  { id: 'max_damage',      icon: '💥', name: 'Dano Crítico',            desc: 'Causou 15 ou mais de dano em batalha', category: 'feats'   },
  { id: 'comeback',        icon: '🔥', name: 'De Volta',               desc: 'Venceu com HP ≤ 20 após estar perdendo',category: 'feats'  },
  { id: 'bomb_apocalipse', icon: '💣', name: 'Bomba no Apocalipse',    desc: 'Detonou a bomba no Apocalipse',         category: 'feats'  },
  { id: 'bomb_magneto',   icon: '💣', name: 'Bomba no Magneto',       desc: 'Detonou a bomba no Magneto',            category: 'feats'  },

  // Missões
  { id: 'mission_1',  icon: '🧲', name: 'Vença Magneto',                                desc: 'Cumpra a missão de derrotar Magneto no tabuleiro',                       category: 'mission' },
  { id: 'mission_2',  icon: '🎭', name: 'Vença Mystique',                               desc: 'Cumpra a missão de derrotar Mística no tabuleiro',                       category: 'mission' },
  { id: 'mission_3',  icon: '🦷', name: 'Vença Sabretooth',                             desc: 'Cumpra a missão de derrotar Dente de Sabre no tabuleiro',                category: 'mission' },
  { id: 'mission_4',  icon: '☠️', name: 'Vença Apocalypse',                             desc: 'Cumpra a missão de derrotar Apocalipse no tabuleiro',                    category: 'mission' },
  { id: 'mission_5',  icon: '🪨', name: 'Vença Juggernaut',                             desc: 'Cumpra a missão de derrotar Juggernaut no tabuleiro',                    category: 'mission' },
  { id: 'mission_6',  icon: '🔄', name: 'Complete 10 voltas',                           desc: 'Cumpra a missão de dar 10 voltas completas no tabuleiro',                category: 'mission' },
  { id: 'mission_7',  icon: '🏘️', name: 'Salve 20 Civis',                               desc: 'Cumpra a missão de salvar 20 civis derrotando a Sentinela Caçadora',      category: 'mission' },
  { id: 'mission_17', icon: '🏘️', name: 'Salve 30 Civis',                               desc: 'Cumpra a missão de salvar 30 civis derrotando a Sentinela Caçadora',      category: 'mission' },
  { id: 'mission_8',  icon: '💀', name: 'Mate um X-Men',                                desc: 'Cumpra a missão de eliminar outro jogador em batalha PvP',               category: 'mission' },
  { id: 'mission_9',  icon: '🛡️', name: 'Sobreviva ao Apocalipse',                      desc: 'Cumpra a missão de sobreviver a múltiplas lutas contra Apocalipse',      category: 'mission' },
  { id: 'mission_10', icon: '👥', name: 'Recrute 4 X-Men',                              desc: 'Cumpra a missão de recrutar 4 X-Men durante a partida',                  category: 'mission' },
  { id: 'mission_11', icon: '🚫', name: 'Sabotador',                                    desc: 'Cumpra a missão de impedir todos os X-Men de completarem suas missões',   category: 'mission' },
  { id: 'mission_12', icon: '🤖', name: 'Controle das Sentinelas',                      desc: 'Cumpra a missão de impedir 3 Sentinelas de aparecerem no tabuleiro',     category: 'mission' },
  { id: 'mission_13', icon: '🪱', name: 'Vença Omega Red',                              desc: 'Cumpra a missão de derrotar Omega Red no tabuleiro',                     category: 'mission' },
  { id: 'mission_14', icon: '⚙️', name: 'Vença 2 Sentinelas',                           desc: 'Cumpra a missão de derrotar 2 Sentinelas no tabuleiro',                  category: 'mission' },

  // Especial — concedido manualmente pelos admins
  { id: 'gambit_game', icon: '🃏', name: 'Gambit Game', desc: 'Venceu o Gambit Game', category: 'special' },
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
