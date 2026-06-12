# X-MEN CARD GAME — Sistema de Habilidades

## Estrutura de cada personagem

| Slot | Tipo | Regra |
|------|------|-------|
| **[A]** | Passiva aleatória | ~33% de chance, ativa automaticamente em batalha |
| **[B]** | Ativa por turno | Jogador declara **antes** de rolar — 1× por turno |
| **[C]** | Condicional | Ativa automaticamente ao atingir um estado |

---

## Personagens Jogáveis

### 1. Wolverine — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Fator de Cura | Ao perder, recupera metade do dano sofrido |
| [B] | Investida | +2 ao dado (declarar antes de rolar) |
| [C] | Fúria Berserker | HP ≤ 40 → troca D6 por D10 até recuperar |

---

### 2. Ciclope — D8

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Precisão Óptica | Dano mínimo garantido de 3 |
| [B] | Raio Óptico Concentrado | Dobra o resultado do dado |
| [C] | Liderança | Jogador com mais HP (≥ 60) → +2 em todos os dados |

---

### 3. Tempestade — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Relâmpago | Dado = 6 → dano dobrado |
| [B] | Controle do Clima | Troca D6 por D8 nessa batalha |
| [C] | Olho da Tempestade | HP ≤ 50 → +2 ao dado em todas as batalhas |

---

### 4. Jean Grey → Phoenix — D8 (→ D10)

**Fase 1: Jean Grey (HP > 30)**

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Barreira Psíquica | Bloqueia completamente o dano de uma batalha |
| [B] | Ligação Mental | Vê o dado do oponente antes de revelar |
| [C] | Telecinese | 2 derrotas seguidas → redireciona 50% do próximo dano de volta |

> **Transformação:** HP ≤ 30 → vira **Phoenix** (D10 permanente)

**Fase 2: Phoenix (permanente)**

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Chama Cósmica | Dano triplicado nessa batalha |
| [B] | Ressurreição | 1× por partida: chega a 0 HP → volta com 40 HP |
| [C] | Fênix Negro | Permanente — todo dano causado é dobrado |

---

### 5. Professor X — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Empatia | Vê o dado do oponente antes de revelar |
| [B] | Controle Mental | Força o dado do oponente a ser 1 |
| [C] | Paz Mental | HP ≤ 40 → pode recusar batalha sem dano (1× por estado) |

---

### 6. Gambit — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Carta Explosiva | Dado = 6 → causa 15 de dano fixo |
| [B] | Baralho Explosivo | Rerola o dado uma vez após ver o resultado |
| [C] | Sorte Cajun | 2 derrotas consecutivas → próxima batalha usa D10 |

---

### 7. Vampira — D8

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Absorção | Copia a habilidade [A] do oponente e usa também |
| [B] | Vôo | Move +2 casas extras / foge da batalha |
| [C] | Toque Letal | HP ≥ 70 + vencer por ≥ 5 → oponente perde próximo turno |

---

### 8. Noturno — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Ataque Furtivo | Se for o atacante → +3 ao dado |
| [B] | Bamf! | Teleporta para qualquer casa sem rolar movimento |
| [C] | Sombras | HP ≤ 35 → 50% de chance de esquivar de qualquer ataque |

---

### 9. Colosso — D6

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Forma de Aço | Recebe no máximo 8 de dano por batalha |
| [B] | Força Titânica | Dano causado × 1.5 |
| [C] | Muralha | HP ≤ 20 → sobrevive com mínimo 1 HP nesse turno |

---

### 10. Psylocke — D8

| Slot | Nome | Efeito |
|------|------|--------|
| [A] | Lâmina Psíquica | Ignora toda redução de dano do oponente |
| [B] | Golpe Ninja | +3 ao dado + anula [B] do oponente nessa batalha |
| [C] | Vínculo Telepático | 2× mesmo oponente seguidas → vê e anula uma habilidade dele |

---

## Vilões do Mapa (NPCs)

> Vilões não escolhem habilidades — agem por regra automática.
> **Magneto e Apocalipse começam bloqueados** — o host desbloqueia quando quiser.

| Vilão | HP | Dado | Dificuldade | Mecânica | Recompensa |
|-------|----|------|-------------|----------|------------|
| **Magneto** 🔒 | 120 | D10 | Médio | Campo Magnético: reduz dano recebido em 2 (mín. 1). Vs Wolverine/Colosso: +3 no dado | Libera rota para o Leste do mapa |
| **Mística** | 100 | D6 | Médio | Metamorfo: copia exatamente o dado do atacante. Se o jogador perder, foge para casa aleatória | Revela posição de um vilão oculto |
| **Dente de Sabre** | 110 | D6 | Médio | Predador: dano dobrado contra Wolverine. Regenera 10 HP se não derrotado na 1ª rodada | +1 permanente ao dado de Wolverine |
| **Juggernaut** | 150 | D10 | Difícil | Imparável: absorve os primeiros 10 de dano. Não contra-ataca na 1ª rodada | +20 HP ao vencedor |
| **Sr. Sinistro** | 130 | D8 | Difícil | Experimento: rola 2 dados e usa o maior. Copia [A] do jogador | Revela habilidades ocultas de todos |
| **Omega Red** | 140 | D8 | Difícil | Tentáculos: drena 5 HP/turno. Recupera metade do dano causado | Imunidade a dreno de HP |
| **Apocalipse** 🔒 | 200 | D12 | Chefão Final | Fase 2: HP ≤ 100 → dano dobra automaticamente | **VENCE O JOGO** |

---

## Resumo — Condições de ativação [C]

| Condição | Personagem |
|----------|------------|
| HP ≤ 20 | Colosso (Muralha) |
| HP ≤ 30 | Jean Grey → **transforma em Phoenix** |
| HP ≤ 35 | Noturno (Sombras) |
| HP ≤ 40 | Wolverine (Fúria Berserker), Professor X (Paz Mental) |
| HP ≤ 50 | Tempestade (Olho da Tempestade) |
| HP ≥ 60 + mais HP | Ciclope (Liderança) |
| HP ≥ 70 + vencer por ≥ 5 | Vampira (Toque Letal) |
| 2 derrotas seguidas | Gambit (Sorte Cajun), Jean Grey (Telecinese) |
| 2× mesmo oponente | Psylocke (Vínculo Telepático) |
| Fase Phoenix | Permanente após transformação |

---

## Mecânica das Batalhas

```
Dano = |dado_atacante - dado_defensor|
Perdedor = quem tirou o menor valor
Empate = ninguém toma dano
```

- **[B]** é declarado antes de rolar — fica ativo até a resolução
- **[A]** é sorteado automaticamente no servidor durante a resolução
- **[C]** é ativado/desativado pelo host quando a condição é atingida
- Modificadores se empilham na ordem: B_REROLL → C_MAX_ROLL → B/[B] → [A] → dano final
