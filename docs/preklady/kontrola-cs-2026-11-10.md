# Kontrola CS — 2026-11-10

Spätný preklad 15 kariet s najviac satirou (`docs/preklady/karty/cs.json`).

| Karta | CS | Spätný preklad | Posun / verdikt |
|---|---|---|---|
| Veľmi smútiaca vdova | Velmi truchlící vdova | Veľmi smútiaca vdova | OK |
| Silná, nezávislá žena | Silná, nezávislá žena | — | OK |
| Praudovravec | Pravdomluvec | Pravdovravec | **Slabšie**: chýba pravopisný výsmech „praud“. Otázka 3. *Pravdoláskař* zamietnutý (narážka na skutočnú politiku) |
| Liberál | Liberál — stejně žen jako chlapů | rovnako žien ako chlapov | OK |
| Dievčina na vydaj | Dívka na vdávání | Dievča na vydaj | OK |
| Degustátorka | Degustátorka — jednoho mu vyžere | jeden mu vyžerie | OK |
| Bzdocha | Štěnice | Ploštica (aj odposluch) | Pridaný vtip s odpočúvaním. Otázka 10 |
| Strýko z Ameriky | Strýček z Ameriky | Strýko z Ameriky | Český ustálený motív. OK |
| Finančná poradkyňa | Finanční poradkyně | — | OK |
| Anonymný alkoholik | Anonymní alkoholik | — | OK |
| Záhradkár | Zahrádkář — Exekuce v tomto kole pro tebe neplatí. | — | OK |
| Svokra | Tchyně | Svokra | OK |
| Milujúca manželka | Milující manželka | — | OK |
| Vedúcko | Šéfík | Šéfko | Posmech zdrobneniny ostáva. OK |
| Opatrovateľka | Pečovatelka | Opatrovateľka | OK |

## Opravy a dĺžky

- Opravené: Jogurt „otáčejí vypitý panák“ → **„otáčejí vypitého panáka“** (panák v jednotnom čísle živý: dát si panáka; množné panáky).
- Pozor na falošných priateľov: SK *bitka* = CS **rvačka** (CS bitka = vojenská bitva), SK *pivnica* = CS **sklep**, SK *krčma* = CS **hospoda**. V súboroch dodržané.
- Dĺžky: žiadne meno nie je dlhšie o > 40 %.
- Nezhody s glosárom: žiadne.

## Rozhranie a titulky Melichara (vlna 3b, `apps/web/src/i18n/cs.json`, `melichar/cs.json`)

Spätný preklad kľúčov herného stola:

| Kľúč | CS | Spätný preklad | Verdikt |
|---|---|---|---|
| stol.tipKraja | Převaha: akce této hrany dostane, kdo má v tomto kraji víc svých Občanů, Zvířat a Stařešinů… | (totožné so SK) | OK |
| stol.naPrebitieTy | na přebití potřebuješ {karty} (kartu / karty / karet) | na prebitie potrebuješ N kariet | OK |
| zhrom.nastroj | Nástroj podlož pod kartu v linii za {cigarety}, nebo vylož do Dědictví. | Nástroj podlož pod kartu… alebo vylož do Dedičstva. | OK, sloveso z glosára (podložit) |
| zhrom.dalsiaKarta | Další karta v tahu stojí plného panáka. | Ďalšia karta v ťahu stojí plný poldeci. | OK |
| faza.naSekere | · na sekyru {n} v. | na sekeru n š. | OK (v. = vajglů) |
| koniec.vykupneRiadok | Výkupné: plný panák {zaPoldeci} vajgl, každých {zaCigarety} cigaret 1 vajgl… | (totožné) | OK |
| bar.menoNaTahu | {meno} — na tahu | meno — na ťahu | OK |

Opravené pri kontrole: `partia.sSuperom` „s {meno}“ (meno v šablóne nejde dať do inštrumentálu) → „soupeř: {meno}“.

Voľby: Päta, Lakeť, Otočka = **Facka, loket, podraz** (podraz = podrazenie aj zrada, cieľ režimu). Praudovravec = **Šiřitel pravdi** (chyba i/y). Rank Poldeci = Panák (glosár), „od ranku Panák“. Dlhšie > 40 %: žiadne.

Titulky: „marha“ = dobytek, „špina“ = špína, „robiť si piču“ = dělat si prdel, „jebem ti boha“ = seru ti na boha (česká rúhavá nadávka rovnakej váhy), „jebnúť“ = mrdnout (hodiť). Nezhody s glosárom: žiadne (Bzdocha = Štěnice).
