# X-Men Card Game — Habilidades dos Personagens

> Descrições idênticas às que aparecem nas cartas do jogo.

## Legenda

| Tag | Regra |
|-----|-------|
| **[A]** | Habilidade passiva — ativa por token (chance +10%/token, máx. 90%) |
| **[A] Passiva** | Sempre ativa, sem custo de token |
| **[B]** | Declare antes de rolar — 1× por turno |
| **[B] Direto** | Ação direta, sem precisar de batalha — 1× por turno |
| **[C]** | Ativa automaticamente quando a condição de HP é atendida |
| **[C] Sempre** | Sem condição de HP — sempre ativa |

---

## 1. Wolverine · Logan · D6 → D10 (HP ≤ 30)

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Fator de Cura | Ao perder, recupera metade do dano recebido |
| [B] | Investida | Soma +2 ao dado nessa batalha (funciona contra jogadores e vilões) |
| [C] HP ≤ 20 | Fúria Berserker | HP ≤ 20: +4 ao resultado do dado nessa batalha |

**Effect codes:** `HEAL_HALF` / `B_PLUS_2` / `C_ROLL_BOOST_4`

---

## 2. Ciclope · Scott Summers · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Raio Certeiro | Vencedor causa no mínimo 3 de dano |
| [B] | Raio Concentrado | Dobra o resultado do dado nessa batalha |
| [C] HP ≤ 20 | Raio Supremo | HP ≤ 20: dano causado é no mínimo 5 |

**Effect codes:** `MIN_DAMAGE_3` / `B_DOUBLE_ROLL` / `C_MIN_DAMAGE_5`

---

## 3. Tempestade · Ororo Munroe · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Tempestade Perfeita | Se tirou o valor máximo do dado, dano é dobrado |
| [B] | Controle do Clima | Trata o dado como D8 (+2 ao resultado) |
| [C] HP ≤ 50 | Olho da Tempestade | HP ≤ 50: dado conta como valor máximo do tipo |

**Effect codes:** `DOUBLE_MAX` / `B_UPGRADE` / `C_MAX_ROLL`

---

## 4. Jean Grey · Jean Grey · D6 → D12 (transforma em Fênix com HP ≤ 20)

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] Passiva | Dano Psíquico | Ao perder, causa 3 de dano psíquico a um oponente ou boss aleatório |
| [B] | Paralisia | Ao vencer: paralisa o oponente por N rodadas (N = seus tokens) |
| [C] HP ≤ 20 | Chama Fênix | HP ≤ 20: metade do dano recebido é refletido ao oponente |

**Effect codes:** `PSYCHIC_DAMAGE` / `B_PARALYZE` / `C_REDIRECT_HALF`

---

## 5. Professor X · Charles Xavier · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Enfraquecimento Mental | Reduz o dado do oponente em -2 (mín 1) |
| [B] | Controle Mental | Força o dado do oponente a ser 1 |
| [C] HP ≤ 35 | Escudo Mental | HP ≤ 35: anula os efeitos de habilidade [A] do oponente |

**Effect codes:** `WEAKEN` / `B_FORCE_ONE` / `C_MIND_SHIELD`

---

## 6. Gambit · Remy LeBeau · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Esquiva | Ao perder, gasta 1 token para não sofrer dano |
| [B] Direto | Carta Explosiva | Coloca 1 carta explosiva no campo (1× por turno, sem precisar de batalha). Clique em 🃏 para detonar e causar 3 de dano a um alvo. |
| [C] HP ≤ 20 | High Card | HP ≤ 20: toda batalha inflige ou recebe exatamente 5 de dano, independente do resultado |

**Effect codes:** `DODGE_TOKEN` / `B_TRAP_CARD` / `C_HIGH_CARD`

---

## 7. Vampira · Anna Marie · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Absorção de Poder | Copia e aplica o efeito do oponente como se fosse seu |
| [B] | Voo | Foge da batalha sem sofrer dano (declare antes de rolar). |
| [C] Sempre | Toque Vampírico | Vencer com 4+ dano: rouba [A] do oponente por 3 rodadas. Dono perde a habilidade enquanto roubada. Pode encadear roubos. |

**Effect codes:** `ABSORB` / `B_MOVEMENT` / `C_STEAL_ABILITY`

---

## 8. Noturno · Kurt Wagner · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Ataque Furtivo | Se for o atacante, +3 no resultado do dado |
| [B] | Bamf! | Teleporta para qualquer casa (efeito físico) |
| [C] HP ≤ 30 | Esquiva Total | HP ≤ 30: 50% de chance de esquivar e não receber dano |

**Effect codes:** `SNEAK` / `B_MOVEMENT` / `C_DODGE_50`

---

## 9. Colosso · Piotr Rasputin · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Armadura de Aço | Ao perder, recebe no máximo 8 de dano |
| [B] | Força Titânica | Multiplica o dano causado por 1.5 (se vencer) |
| [C] HP ≤ 20 | Última Resistência | HP ≤ 20: sobrevive com 1 HP ao invés de ser eliminado |

**Effect codes:** `ARMOR` / `B_DAMAGE_BOOST` / `C_SURVIVE_1`

---

## 10. Psylocke · Betsy Braddock · D6

| Slot | Nome | Descrição |
|------|------|-----------|
| [A] | Lâmina Perfurante | Dano ignora ARMOR e SHIELD do oponente |
| [B] | Golpe Ninja | +3 ao dado e cancela o [B] do oponente nessa batalha |
| [C] HP ≤ 50 | Lâmina Ativada | HP ≤ 50: PIERCE ativa com 100% de chance |

**Effect codes:** `PIERCE` / `B_NINJA` / `C_PIERCE_SURE`

---

## Mecânica de batalha

```
Dano = |dado_atacante − dado_defensor|
Perdedor = quem tirou o menor valor
Empate = nenhum dano
```

- **[B]** bloqueado após uso até o host avançar o turno (`+`)
- **[A]** sorteado automaticamente na resolução da batalha
- Wolverine usa **D10** automaticamente quando HP ≤ 30
- Jean Grey usa **D12** automaticamente quando HP ≤ 20 (transforma em Fênix)
