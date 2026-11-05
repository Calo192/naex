# Strategické denníky štýlov

## Dve verzie — dva denníky (Michal 2026-11-05)

Verziu hry pre playtest štýlov vyberá Michal pred každým turnusom:
**Vypálená** (živý web, vetva `vypalena`, zverejnená sada) alebo **Zrejúca**
(pokusná, kód `master`, rozpracovaná sada). Pravidlá sa medzi nimi líšia,
preto má každá verzia vlastné denníky — čo štýl zistil na jednej, na druhej
nemusí platiť. Hráč číta a píše len denník verzie, ktorú hrá.

- **Nová Zrejúca** (po vypálení) začína kópiou denníkov Vypálenej.
- **Vypálenie** (`/naex-vypalit`): Zrejúca sa stáva Vypálenou, takže
  `zrejuca/*.md` nahradí `vypalena/*.md` (staré denníky Vypálenej ostanú
  v gite) a nové `zrejuca/*.md` sú ich kópia.

Každý herný štýl z `../styly.json` má jeden denník za každú verziu hry
(`vypalena/<kluc>.md`, `zrejuca/<kluc>.md`). Hráč štýlu
(`naex-hrac-stylu`, skill `naex-styly`) ho číta pred partiou a **sám ho
prepisuje** po partii — je to jeho laboratórny zošit, z ktorého sa učí hrať
svoj charakter lepšie (Michal 2026-11-03). Štýl nedostal zoznam kariet;
nástroje si hľadá sám a zisťuje experimentmi, čo funguje.

| Kto | Čo smie |
|---|---|
| hráč štýlu | čítať **len svoj** denník (cudzí by mu prezradil súperov plán); po partii ho aktualizovať |
| sudca štýlov (`naex-sudca-stylov`) | čítať všetky; pod položku pridať `> Sudca <dátum>: …`, keď stojí na zle pochopenom pravidle alebo na čísle, ktoré partia neukázala. Stratégiu neprepisuje. |
| organizátor | commitnúť denníky spolu s reportom |

Každý štýl hrá v turnuse najviac raz, takže dvaja hráči do jedného denníka
naraz nepíšu.

## Štruktúra denníka

1. **Aktuálna stratégia** — ako štýl teraz chce vyhrať (najviac ~1 strana),
   po každej partii prepísaná podľa toho, čo sa naučil. Verzia pravidiel.
2. **Nástroje** — karty, akcie, lokality, priazne, väzni, mechanizmy aj
   nezvyčajné použitia, ktoré slúžia charakteru. Každý:
   `- **<nástroj>** — ako slúži charakteru · stav: kandidát | sľubný | overený | zavrhnutý | podmienený (<kedy>) · dôkaz: <partia, kolo, čísla> · pravidlá: vN`
3. **Experimenty** — `### E<n> · <hypotéza „Keď X, spravím Y, čakám Z“>`,
   pod tým `- partie:`, `- výsledok: funguje | nefunguje | nejasné | závisí od …`,
   `- čísla:`, `- čo ďalej:`, `- pravidlá: vN`. Číslo rastie, staré sa nemažú,
   len uzavrú.
4. **Nápady na vyskúšanie** — zásobník budúcich experimentov, najsľubnejší hore.
5. **Čo štýlu chýba v hre** — miesta, kde charakter nemal žiadny dobrý ťah
   (podklad pre návrhy zmien pravidiel a kariet).
6. **Partie** — jeden riadok za partiu: dátum, id, súper, výsledok, špaky,
   čo sa skúšalo.

Keď sa pravidlá verzie zmenia (nový commit v `master` pre Zrejúcu, vypálenie
pre Vypálenú), hráč pri príprave porovná verziu položiek s hlavičkou
`PRAVIDLA.md` verzie, ktorú hrá, a označí, čo treba overiť znova (zmeny sú
v úvode `PRAVIDLA.md`). Na Zrejúcej sa pravidlá menia často — tam je to
pravidelná súčasť prípravy.
