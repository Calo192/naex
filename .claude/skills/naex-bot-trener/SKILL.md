---
name: naex-bot-trener
description: Spustí agenta naex-bot-trener — nájde, kde offline protihráč NA EX! (bot, heuristiky bez LLM) hrá zle alebo nepoužíva niektoré pravidlá, upraví ho a commitne len zmenu, ktorá v turnaji s rovnakými semienkami porazí starého bota a zachová povahy a rýchlosť. Na žiadosť naučí bota variant pravidiel pre stratéga. Použi, keď používateľ povie /naex-bot-trener, „vylepši bota“, „bot je slabý“, „bot nepoužíva …“, „nauč bota variant“.
argument-hint: "[cieľ, napr. „nepoužíva barter“ | povaha teta_gizka | variant <nazov>] (predvolene celkovo silnejší)"
---

# Tréning offline protihráča

Spustíš agenta `naex-bot-trener` (`.claude/agents/naex-bot-trener.md`)
a odovzdáš výsledok. Sám bota nemeníš.

1. **Cieľ** z `$ARGUMENTS` — bez neho „celkovo silnejší“. Pri `variant
   <nazov>` over, že worktree `playtest/varianty/<nazov>` existuje (vytvára
   ho stratég); inak sa opýtaj, ktorý variant.
2. **Spusti agenta** na pozadí: „Cieľ: … . Koncovka commitu:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.“ Používateľovi
   povedz, že turnaje trvajú desiatky minút a že bot sa commitne, len ak
   porazí starého (≥ 55 % pri každej povahe).
3. **Odovzdaj:** čo agent zmenil v správaní bota (1–3 body ľudskou rečou),
   výhry nového proti starému po povahách, rýchlosť, commit. Ak sa bot zmenil,
   povedz, že (a) na živom webe bude až po nasadení (`/naex-nasad`) a (b) čísla
   strategickosti sa posunú — ďalší `/naex-strategia` zmeria nové východisko.
