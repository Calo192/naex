# Návrh § Režim Päta, Lakeť, Otočka (roadmapa #166)

Návrh kapitoly do `docs/PRAVIDLA.md` (Zrejúca), postavený na v11.10. Rozhodnutia Michala
2026-10-31, 2026-11-01 a 2026-11-06, vrátane výkladov potvrdených 2026-11-06. Súčasný režim sa volá **Kalamita**; PLO sa hrá len 1 na 1, s formátom 2 na 2
sa nekombinuje. Jadro: `packages/core/src/pata.ts`, testy `packages/core/test/pata.test.ts`.

## Cieľ

Podraziť všetkých štyroch starších súpera. Hra nemá ligu, finále, špaky, výkup ani remízu.
Nie sú ani strach, reči, hádka, priazeň, väzni, zajatie, Kšefty a schopnosti starších.
Kolo ostáva z Kalamity: lokalita, šenok, Zhromaždenie, Pitky s NA EX, bitka.
Zdroje hráča ostávajú: poldeci, cigarety, Dlhy, Cirhózy, Absťáky, Chuť, Dedičstvo.

## Príprava

- **Draft:** kto vyberá prvý, určí semienko; 8 starších sa rozoberie hadovito A B B A A B B A.
- **Prvý obranca** je druhý v drafte.
- **Pečeň:** Farár 27, Krčmárka 36, Starosta 33, Poštárka 24, Hrobár 33, Autobusár 30,
  Veterinár 27, Vychovávateľka 27. Čísla sa doladia po prvej hre.
- **Sada bez:** Noviny, Horoskop, Čierna mačka, Kapybara, Kultúrny dom, Predsedova vila, Herňa.

## Lokality

Vždy 3 na výber, po jednej z úrovní 1, 2 a 3. Pinnacle sa nehrá. Vyberá a natáča obranca.
Odohraná lokalita ide naspodok svojej úrovne, takže lokality sa neminú.

## Rad starších

- Rad sú štyria starší mimo línie, spoje fungujú ako v línii.
- Hráči ho preskladajú **po braní zo šenku, naraz a skryto**. Starší sa neotáčajú.
- Aktívne akcie radu sa pripočítajú k línii **v každej Pitke aj v bitke**.
- NA EX, Odpor ani prevaha z línie do radu nezasahujú.
- **Podrazený starší** ostáva v rade ako spojka. Jeho akcie neplatia, sused na spoji s ním
  svoju akciu dostane. Jeho Odpor ani Posilnenie suseda nemenia.

## Bitka

Víťaz bitky: vyššie tuhé, pri zhode menej Absťákov, potom menej Dlhov, inak sekera.
Výhra dáva rolu obrancu v ďalšom kole, porazený dostane 1 cigaretu (pri sekere nikto).
Akcie línie a radu sa spočítajú na začiatku bitky, takže starší, ktorý padne pri
exekúcii, v tej bitke svoje akcie ešte dá.

### Krok 1: Robota, liečenie, exekúcia

Obaja naraz a skryto zvolia, čo spravia ich Roboty, potom sa odhalí:

- Každá aktívna **Robota** spáli 1 Dlh (s Fúrikom 2), alebo vylieči 2 pečene jednému vlastnému
  stojacemu staršiemu. Nad pôvodnú pečeň áno, oživenie nie.
- **Exekúcia** potom spáli polovicu Dlhov nahor a každý stojaci starší exekvovaného stratí
  1 pečeň za každý spálený Dlh. Štít ju netlmí. Záhradkár ju obíde.

Kto v tomto kroku príde o posledného staršieho, partia končí a druhý krok sa nerobí.

### Krok 2: Poškodenie, obaja naraz

Obaja naraz a skryto rozdelia celé svoje tuhé a jed na súperových stojacich starších.

- **Viera je štít na každom staršom zvlášť a prenáša sa medzi kolami.** Nová Viera pribudne
  každému stojacemu; 1 Viera teda zachytí viac poškodenia, ale len 1 na jedného staršieho.
  Hodnota Viery so Svätým textom platí.
- **Povery:** každá aktívna uberie 1 každému stojacemu súperovmu staršiemu, najprv zo štítu.
- **Tuhé** rozdelí každý hráč celé svoje (nie len rozdiel), po bodoch, aj nad zvyšok pečene.
  Najprv ide zo štítu daného staršieho.
- **Pohoršenie = jed** po kusoch na starších podľa výberu, verejne. Na konci bitky dostane starší
  poškodenie rovné svojmu jedu, potom jed klesne o 1; nový sa pripočíta. Nový jed
  pôsobí hneď v tej istej bitke. Štít jed netlmí. Na padnutom jed prepadne.

Príklad: štít 3, súper 2 Povery a 4 tuhé na Farára. Farár dá 3 do pečene a má štít 0, ostatní
štít 1. S novou Vierou 5 v ďalšej bitke: Farár 5, ostatní 6. Bez poškodenia: 3 + 5 = 8.

### Podrazenie a koniec partie

Starší s pečeňou 0 alebo menej padne. Tuhé ani jed sa naň už dávať nesmú.
Kto príde o všetkých, prehráva. Keď padnú poslední starší oboch v tej istej bitke, vyhrá menšie
**prečerpanie** = súčet záporných čísel pečene starších padnutých v tejto bitke (exekúcia, Povery,
tuhé, jed). Pri zhode: vyššie tuhé, menej Absťákov, menej Dlhov, nakoniec útočník.

## Koniec kola: Dať vyžrať

Hráč smie dať vlastnému stojacemu staršiemu **3 pečene za plný poldeci** (poldeci sa zmení na
vypitý), koľkokrát chce, aj nad pôvodnú pečeň. Za cigarety sa pečeň kúpiť nedá.

## Cirhóza

Cirhóza sa **prizná okamžite, keď sa dostane hráčovi na ruku**, bez náhradnej karty. Priznaná dáva
súperovi +1 tuhé v každej bitke. Na konci partie nestojí nič.

## Má dosť

Podrazený starší pomáha už len týmto efektom. Platí pri každom podrazení, aj vlastnou exekúciou.
Platí hneď od pádu, aj v zvyšku tej bitky.

| Starší | Názov | Efekt |
|---|---|---|
| Poštárka | Všetko vyklopím | Súperova ruka je pre teba odkrytá. |
| Veterinár | Liečim už len kravy | Hneď: zahoď všetky svoje Cirhózy. |
| Vychovávateľka | Do radu! | Po odhalení radov vymeníš v súperovom rade dvoch susedných starších. |
| Farár | Rozhrešenie | Jed na tvojich starších klesá o 2. |
| Autobusár | Ty nastupuješ prvý | Zo šenku berieš vždy prvý a hneď 2 karty. |
| Starosta | Kde sa pije, poviem ja | Lokalitu vyberáš a natáčaš ty. |
| Hrobár | Aspoň mám robotu | +1 tuhé za každého podrazeného staršieho na stole, aj súperovho. |
| Krčmárka | Už ti nenalejem | Súperovi sa na začiatku kola neotočí vypitý poldeci. |

Poštárka: ruka ide len cez `viewFor` na serveri, s testom (nemenné pravidlo 2).

## Po prvej hre zmerať

Dĺžka partie, podiel radu na tuhom, kto padá prvý, výhoda prvého v drafte. Čísla z posudku
z 2026-11-01 sú staršie ako Identita kariet v11.5, odvtedy sa akcie starších zmenili.

Prvé meranie botov 2026-11-06 (60 partií s náhodným draftom, bot režimu je jednoduchý): medián 5 kôl
(3 až 10), rad dáva 52 % tuhého, prvý v drafte vyhral 38 zo 60, posledných oboch naraz 3 partie,
prvá padá Poštárka (38 zo 60). So Farárom sa vyhrávalo 78 % partií, preto mu Michal 2026-11-06 znížil pečeň z 30 na 27.
