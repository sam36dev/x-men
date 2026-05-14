export const characters = [
  {
    id: 1,
    name: "Wolverine",
    alias: "Logan",
    image: "https://i.annihil.us/u/prod/marvel/i/mg/2/60/537bcaef0f6cf/portrait_incredible.jpg",
    powers: [
      "Regeneração Acelerada",
      "Garras de Adamantium",
      "Sentidos Aguçados",
      "Esqueleto de Adamantium"
    ],
    type: "Combate",
    typeIcon: "⚔️",
    hp: 100,
    diceType: 6,
    multiplier: 14,
    color: "#F5A623",
    gradient: "linear-gradient(160deg, #3d2000 0%, #1a0a00 50%, #0d0500 100%)",
    team: "X-Men",
    number: "001",
    ability: {
      name: "Fator de Cura",
      description: "Ao perder, recupera metade do dano recebido",
      effect: "HEAL_HALF"
    }
  },
  {
    id: 2,
    name: "Ciclope",
    alias: "Scott Summers",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Cyclops_%28Scott_Summers_circa_2019%29.png/500px-Cyclops_%28Scott_Summers_circa_2019%29.png",
    powers: [
      "Raio Óptico Devastador",
      "Líder Nato",
      "Resistência Extrema",
      "Controle de Energia Óptica"
    ],
    type: "Energia",
    typeIcon: "⚡",
    hp: 100,
    diceType: 8,
    multiplier: 11,
    color: "#FF4444",
    gradient: "linear-gradient(160deg, #3d0000 0%, #1a0000 50%, #0d0000 100%)",
    team: "X-Men",
    number: "002",
    ability: {
      name: "Raio Certeiro",
      description: "Vencedor causa no mínimo 3 de dano",
      effect: "MIN_DAMAGE_3"
    }
  },
  {
    id: 3,
    name: "Tempestade",
    alias: "Ororo Munroe",
    image: "https://upload.wikimedia.org/wikipedia/en/3/34/Storm_%28Ororo_Munroe%29.png",
    powers: [
      "Controle Climático",
      "Voo",
      "Raios e Trovões",
      "Invocação de Tornados"
    ],
    type: "Elemental",
    typeIcon: "🌩️",
    hp: 100,
    diceType: 6,
    multiplier: 13,
    color: "#88BBFF",
    gradient: "linear-gradient(160deg, #001a3d 0%, #000d1a 50%, #000509 100%)",
    team: "X-Men",
    number: "003",
    ability: {
      name: "Tempestade Perfeita",
      description: "Se tirou o valor máximo do dado, dano é dobrado",
      effect: "DOUBLE_MAX"
    }
  },
  {
    id: 4,
    name: "Jean Grey",
    alias: "Jean Grey",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/2/22/Jean_Grey_%28New_X-Men%29.png/500px-Jean_Grey_%28New_X-Men%29.png",
    powers: [
      "Telepatia Avançada",
      "Telecinese",
      "Barreira Psíquica",
      "Ligação Mental"
    ],
    type: "Psíquico",
    typeIcon: "🔮",
    hp: 100,
    diceType: 8,
    multiplier: 10,
    color: "#FF9944",
    gradient: "linear-gradient(160deg, #2a0800 0%, #150400 50%, #0a0200 100%)",
    team: "X-Men",
    number: "004",
    transformation: {
      triggersAt: 30,
      name: "Phoenix",
      diceType: 10,
      color: "#FF4400",
      gradient: "linear-gradient(160deg, #3d1000 0%, #1a0800 50%, #0d0400 100%)",
      type: "Cósmico",
      typeIcon: "🔥",
      powers: [
        "Força Fênix Cósmica",
        "Telecinese Suprema",
        "Chama Estelar",
        "Ressurreição"
      ]
    },
    ability: {
      name: "Escudo Psíquico",
      description: "Ao perder, bloqueia todo o dano recebido",
      effect: "SHIELD"
    }
  },
  {
    id: 5,
    name: "Professor X",
    alias: "Charles Xavier",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a8/Professor_X.png/500px-Professor_X.png",
    powers: [
      "Telepatia Suprema",
      "Controle Mental Total",
      "Projeção Astral",
      "Bloqueio de Poderes"
    ],
    type: "Psíquico",
    typeIcon: "🧠",
    hp: 100,
    diceType: 6,
    multiplier: 12,
    color: "#4488FF",
    gradient: "linear-gradient(160deg, #00103d 0%, #00081a 50%, #00040d 100%)",
    team: "X-Men",
    number: "005",
    ability: {
      name: "Enfraquecimento Mental",
      description: "Reduz o dado do oponente em -2 (mín 1)",
      effect: "WEAKEN"
    }
  },
  {
    id: 6,
    name: "Gambit",
    alias: "Remy LeBeau",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/9/94/Gambit_%28Marvel_Comics%29.png/500px-Gambit_%28Marvel_Comics%29.png",
    powers: [
      "Carga Cinética",
      "Cartas Explosivas",
      "Hipnose Natural",
      "Acrobacia Avançada"
    ],
    type: "Energia",
    typeIcon: "🃏",
    hp: 100,
    diceType: 6,
    multiplier: 11,
    color: "#FF4499",
    gradient: "linear-gradient(160deg, #1a0020 0%, #0d0010 50%, #07000a 100%)",
    team: "X-Men",
    number: "006",
    ability: {
      name: "Carta Explosiva",
      description: "Se tirou o valor máximo do dado, dano fixo é 15",
      effect: "EXPLOSIVE"
    }
  },
  {
    id: 7,
    name: "Vampira",
    alias: "Anna Marie",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Excalibur_2019_-18.jpeg/500px-Excalibur_2019_-18.jpeg",
    powers: [
      "Absorção de Poderes",
      "Super Força",
      "Invulnerabilidade",
      "Voo"
    ],
    type: "Absorção",
    typeIcon: "💫",
    hp: 100,
    diceType: 8,
    multiplier: 11,
    color: "#44CC88",
    gradient: "linear-gradient(160deg, #001a0a 0%, #000d05 50%, #000703 100%)",
    team: "X-Men",
    number: "007",
    ability: {
      name: "Absorção de Poder",
      description: "Copia e aplica o efeito do oponente como se fosse seu",
      effect: "ABSORB"
    }
  },
  {
    id: 8,
    name: "Noturno",
    alias: "Kurt Wagner",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/Nightcrawler_%28character%29.png/500px-Nightcrawler_%28character%29.png",
    powers: [
      "Teletransporte",
      "Escalar Paredes",
      "Invisibilidade Noturna",
      "Cauda Preênsil"
    ],
    type: "Mutação",
    typeIcon: "🌑",
    hp: 100,
    diceType: 6,
    multiplier: 10,
    color: "#6688FF",
    gradient: "linear-gradient(160deg, #000d1a 0%, #000608 50%, #000304 100%)",
    team: "X-Men",
    number: "008",
    ability: {
      name: "Ataque Furtivo",
      description: "Se for o atacante, +3 no resultado do dado",
      effect: "SNEAK"
    }
  },
  {
    id: 9,
    name: "Colosso",
    alias: "Piotr Rasputin",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/2/26/Colossus-AvX_Consequences.jpg/500px-Colossus-AvX_Consequences.jpg",
    powers: [
      "Pele de Aço Orgânico",
      "Super Força",
      "Invulnerabilidade Total",
      "Resistência Extrema"
    ],
    type: "Físico",
    typeIcon: "🛡️",
    hp: 100,
    diceType: 6,
    multiplier: 15,
    color: "#AAAACC",
    gradient: "linear-gradient(160deg, #1a1a22 0%, #0d0d10 50%, #07070a 100%)",
    team: "X-Men",
    number: "009",
    ability: {
      name: "Armadura de Aço",
      description: "Ao perder, recebe no máximo 8 de dano",
      effect: "ARMOR"
    }
  },
  {
    id: 10,
    name: "Psylocke",
    alias: "Betsy Braddock",
    image: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a4/Psylocke_%28Betsy_Braddock%29.png/500px-Psylocke_%28Betsy_Braddock%29.png",
    powers: [
      "Lâmina Psíquica",
      "Telepatia",
      "Artes Marciais Ninja",
      "Projeção Psíquica"
    ],
    type: "Psíquico",
    typeIcon: "🗡️",
    hp: 100,
    diceType: 8,
    multiplier: 12,
    color: "#CC44FF",
    gradient: "linear-gradient(160deg, #1a0030 0%, #0d0018 50%, #07000c 100%)",
    team: "X-Men",
    number: "010",
    ability: {
      name: "Lâmina Perfurante",
      description: "Dano ignora ARMOR e SHIELD do oponente",
      effect: "PIERCE"
    }
  }
]
