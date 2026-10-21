---
name: naex-navrhy
description: Spustí agenta naex-navrhar — prečíta spätnú väzbu playtesterov zo všetkých playtestov (feedback, denníky, nezrovnalosti, reporty, rozbory stratéga, názory na stránke Spätná väzba), vyberie najkritickejšie body a ku každému predostrie návrhy zlepšení s alternatívami a odporúčaním. Použi, keď používateľ povie /naex-navrhy, „čo z playtestov vyplýva", „navrhni zlepšenia", „čo treba opraviť najskôr", „zanalyzuj spätnú väzbu", „čo je najkritickejšie".
argument-hint: "[počet bodov] [| relácia playtest/<id> alebo téma]"
---

# Návrhy zlepšení NA EX!

Spustíš agenta `naex-navrhar` (`.claude/agents/naex-navrhar.md`) a odovzdáš
výsledok. Sám neanalyzuješ ani nemeníš pravidlá.

Argumenty: `$ARGUMENTS` — voliteľný počet bodov (predvolene 5), za `|`
voliteľne relácia playtestu (`playtest/<id>`), na ktorú sa má sústrediť,
alebo téma („tempo“, „NA EX“, „zrozumiteľnosť“). Bez nich navrhár vychádza zo
všetkých playtestov a najnovšie váži viac.

1. **Web** — navrhár číta aj názory na stránke Spätná väzba živého webu. Over
   `node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny --zivy`;
   ak nebeží, povedz navrhárovi „Web: nedostupný“.
2. **Spusti `naex-navrhar` na pozadí**: „Počet bodov: N. Relácia: R (alebo
   všetky playtesty). Téma: … . Zanalyzuj všetko, čo sme sa z playtestov
   dozvedeli, vyber najkritickejšie body a predostri návrhy zlepšení.“ Ak
   práve beží alebo len dobehol rozbor stratéga, povedz mu, kde ho nájde.
3. Používateľovi povedz, že analýza beží a z čoho vychádza.
4. Keď skončí, nahraj návrhy do sekcie **Playtest** na živom webe:
   ```bash
   A="node --experimental-strip-types --no-warnings tools/admin/admin.ts"
   $A report-nahraj docs/playtesty/navrhy-<id>.html --zivy
   $A navrhy-nahraj docs/playtesty/navrhy-<id>.json --zivy
   ```
5. Odovzdaj:
   - odkaz `<živý web>/playtest` (návrhy na rozhodnutie) a lokálny súbor
     `docs/playtesty/navrhy-<id>.html` (otvor ho v prehliadači),
   - body v poradí kritickosti: téma, prečo je kritická, odporúčaná možnosť,
     náročnosť,
   - čo treba nechať zmerať stratégovi (ponúkni skill `naex-strategia`),
   - očíslované otázky na Michala — odpovedá na ne v poznámke pri návrhu.
   Michal na webe pri každom návrhu vyberie možnosť a rozhodne; schválené
   implementuje skill `naex-implementacia` (agent Developer).
