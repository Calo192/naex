# NA EX! — pravidlá (špecifikácia)

**Pravidlá v11.6 (platné od 2026-11-03)** — Zajatie od minulého kola (v11.6), Identita kariet (v11.5), Zajatie Nakladačkou a presvedčenie (v11.4), Konflikt oboma smermi a Podpora (v11.3), Schopnosť väzňa (v11.2), Vzbura obráti kartu (v11.1) a Strach a reči (Michal 2026-11-02, docs/napady/strach-reci.html,
verzia 2) na v10.4
(Hádka v10 — Michal 2026-11-01, docs/napady/hadka.html, verzia 4; v9 zmrazené 2026-10-30, krok 2
revízie starších, docs/napady/starsi-krok2-zadanie.html; dávky v9.1 Chuť, v9.2 šenok a NA EX naraz,
v9.3 Výtržník prebíja Úplatok; v10.1 zajatie pred šenkom; v10.2 Nástroj nie vedľa lokality; v10.3
Forsáž, Úplatok zrušený; v10.4 pojem Spáliť, Autority). Sada kariet v55 (`cards.json`). Pravidlá sa
menia len v dávkach; celá dávka dostane ďalšiu verziu (značka partií `v11`; presnú verziu ukazuje
stránka Pravidlá — `VERZIA_PRAVIDIEL_PRESNA`).

**Zmeny v11.6 oproti v11.5** (Michal 2026-11-03, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.6):

- **Zajatie len staršieho na červenej od minulého kola** (§9.4, §10): zajať smieš len staršieho, pri ktorom
  je tvoj strach na červenej **už pred touto Nakladačkou**. Dotiahnuť strach na červenú a v tom istom
  rozdelení zajať (zo strachu 2 za 3 + 5) už nejde. Presvedčenie sa nemení — reči sa smú dotiahnuť na
  červenú v tom istom rozdelení hádky.
- **Pečiatka namiesto tlačidiel** (hra): pri tvojom rozdelení sa na staršom, pri ktorom sa akcia na tvoje
  body dá, ukáže pečiatka **ZAJAŤ** (Nakladačka) či **PRESVEDČIŤ** (hádka) s cenou; klik ju potvrdí
  (ZAJATÝ / PRESVEDČENÝ), ďalší klik ju vráti.

**Zmeny v11.5 oproti v11.4** (Michal 2026-11-03, Zrejúca, „Identita kariet“, docs/napady/identita-kariet;
staré znenia v `docs/pravidla-historia.md`, sekcia v11.5):

- **Nové akcie všetkých kariet** (sada v `cards.json`): každá karta má identitu (2 z 6 rolí); Starší majú
  1 variant, Občania 4–8, Nástroje a Zvieratá 2–4.
- **Nové efekty siedmich kariet** (§16): Noviny (Dedičstvo: Hádka — porazený v hádke odhodí náhodnú kartu
  z ruky), Opatrovateľka (Furt — posilnení Pamätníci v okolí), Podvodník (Konflikt — cigareta, inak
  zadĺženie), Anonymný alkoholik (Furt — pečeň susedov ako Viera), Šofér (bez NA EX aj 1 cigareta),
  Sypač (Podpora — tvoj Chlap má Rany ako Pecky), Kôň (jeho Roboty pália o 1 Dlh viac).
- Zanikli: Noviny ako špaky za Dlhy víťaza, Opatrovateľka a Chuť, Podvodník pri prehre, Nástup Anonymného
  alkoholika (priznanie Cirhóz), Sypačove Pecky ako Výtržník.

**Zmeny v11.4 oproti v11.3** (Michal 2026-11-03, Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.4):

- **Pokus o zajatie zanikol** (§5, §9, §10): voľba v drafte, cigareta, karta staršieho v ruke, ohrozenie
  (nedvíhať na staršieho), karta zadarmo pri stavbe šenku, pád strachu na 0 aj krok 6d. Stavba šenku je
  hneď po voľbe cieľa, každý dá 4 do šenku a 4 naspodok.
- **Zajatie pri rozdelení Nakladačky** (§9.4, §10): kto rozdeľuje Nakladačku, smie zajať staršieho, pri
  ktorom má **strach 3**, za **5 bodov** (na červenú sa smie dotiahnuť v tom istom rozdelení). Dobrovoľné,
  viac naraz smie byť; väzeň, krádež špakov a výhra väzňami hneď. Vo finále nie.
- **Presvedčenie** (nové, §9.1, §10): kto rozdeľuje hádku, smie presvedčiť staršieho, pri ktorom má
  **súper vyšší strach**, keď má reči na červenej, za **5 bodov**. Jeho reči zaniknú, strach a priazeň
  ostávajú; **karta staršieho ide do ruky presvedčovateľa a natrvalo patrí do jeho balíčka**. Kto prvý
  presvedčí, toho je; zajať presvedčeného smú obaja. Vo finále nie.

**Zmeny v11.3 oproti v11.2** (Michal 2026-11-03, Vypálená aj Zrejúca; staré znenia v `docs/pravidla-historia.md`, sekcia v11.3):

- **Konflikt oboma smermi** (§6, §16): Konflikt karty sa spustí, keď sa **priložením** ocitne vedľa
  **súperovej** karty — či ju prikladáš ty k súperovej, alebo súper svoju k nej. Predtým len druhé.
- **Podpora** (nový spúšťač, §6, §16): zrkadlo Konfliktu — spustí sa, keď sa priložením stretnú **dve
  karty toho istého hráča**.
- **Veľmi smútiaca vdova:** súper odhodí **1 kartu** (predtým 2) z doberacieho balíčka za každého
  svojho Chlapa, ktorý s ňou susedí.
- **Snúbenica** má Podporu: keď sa stretne s tvojím Chlapom, na ktorom leží súperovo NA EX, NA EX
  zíde a súperov poldeci sa mu vráti vypitý. Predtým Konflikt (priložený Chlap prešiel k nej).

**Zmeny v11.2 oproti v11.1** (Michal 2026-11-02, Zrejúca; podklad docs/napady/bonus-zajatia.html, sada B
prestavená na „raz za hru, kedy chceš“; staré znenia v `docs/pravidla-historia.md`, sekcia v11.2):

- **Schopnosť väzňa namiesto Kšeftu väzňa** (§7, §10, §16): Kšeft väzňa za vypitý poldeci zanikol.
  Každý zajatý starší má **schopnosť**, ktorú hráč, ktorý ho má v pivnici, smie použiť **raz za hru,
  kedy chce** — vo svojom ťahu pri braní zo šenku, v Zhromaždení alebo v Pitke, aj vo finále.
  Nič nestojí, nie je to ťah. Po použití je **minutá**; starší **ostáva v pivnici** a ráta sa ďalej
  ako vydesený (červená). **Krádež špakov pri zajatí ostáva.**
- Poštárka: 4 cigarety. Krčmárka: nový plný poldeci (natrvalo). Farár: odstráni jedno súperovo NA EX
  z karty. Starosta: do konca kola všetky aktívne akcie lokality posilnené, aj akcie Pitky (spresnené
  2026-11-02). Veterinár: odhodí Cirhózy na ruke a priznané. Vychovávateľka: súper v tomto
  Zhromaždení hneď pasuje (vynútený pas, už nevyloží nič) a za pas nedostane cigarety. Autobusár: zo šenku koľko
  chceš, po cigarete. Hrobár: karta zo súperovho odhadzovacieho balíčka (znenia v §10).
- Kšeft väzňa už nie je nerest (§8).

**Zmeny v11.1 oproti v11** (Michal 2026-11-02, Zrejúca: „Majú sa aktivovať akcie naopak, nie
aktivovať všetky.“; staré znenia v `docs/pravidla-historia.md`, sekcia v11.1):

- **Vzbura obráti aktivitu karty** (§6): na karte so Vzburou sú aktívne **nespojené** akcie
  (bez partnera na spoji, na oboch jej stranách) a **spojené sú neaktívne** — aj tie, ktoré by
  zdvojilo Posilnenie suseda. Predtým boli aktívne všetky. Zrušené Odporom ostávajú zrušené.
- **Odpor proti Posilneniu = Vzbura len karty s Odporom** (§6): obráti sa a **všetky jej aktívne
  akcie sú posilnené (×2)**; karta s Posilnením nič nedostane (jej Posilnenie je zrušené).
  Predtým to Vzbura nebola a zdvojenie nebolo.
- **NA EX nemožno dať na kartu so Vzburou** (§7) — ani z Odporu proti Odporu, ani proti Posilneniu.
- Modifikátory karty so Vzburou na jej spojoch pôsobia ďalej (Odpor ruší, Posilnenie zdvojí,
  Forsáž); Forsáž sa uplatní až na obrátenú kartu.

**Zmeny v11 oproti v10.4** (Michal 2026-11-02, docs/napady/strach-reci.html; staré znenia
v `docs/pravidla-historia.md`, sekcia v11):

- **Strach a reči** (§10): pri každom staršom má **každý hráč vlastný strach** (0–3, neklesá)
  a **reči** (stupeň nad vlastným strachom). **Priazeň pre teba = strach súpera − tvoj strach.**
  Jeden marker so 7 poľami, udržaný strach a klebety zanikli.
- **Nakladačku rozdelí víťaz bitky na svoj strach, hádku víťaz hádky na svoje reči** (§9.1, §9.4) —
  voľne medzi starších, stupeň za 1 / 2 / 3; čo sa nedá, prepadne. Hádka priazne nemení.
- **Bodovanie starších po bitke** (§9, krok 4b; §14): víťaz za najvyšší marker, porazený a pri
  sekere obaja za reči — žltá 1, oranžová 3, červená 5; reči potom klesnú o stupeň.
- **Výhra strachom** (§1): kto vyhrá bitku a má červený strach u 4 starších (väzni sa rátajú),
  vyhráva hneď. **Väzni na výhru podľa ligy** (Tretia 2, Druhá 3, Prvá 4).
- **Zajatie** (§10): podmienka je tvoj strach 3; úspech = väzeň a **krádež špakov**, neúspech =
  tvoj strach pri ňom 0. Špaky za väzňov 8 / 6 / 4 / 2 zanikli.
- **Porazený dostane 1 cigaretu** (§9, krok 6c) — namiesto cigarety za posunutého staršieho;
  po finále nie.
- **Finále** (§14b): markery sa nedvíhajú — Nakladačka aj hádka idú 1 : 1 na špaky.
- **Kapybara** (Nástup): súperove reči pri jednom staršom klesnú o stupeň. **Predsedova vila**
  (Kšeft): za 2 cigarety zdvihni svoje reči pri jednom staršom o stupeň; staršieho v ohrození nie.

**Zmeny v10.4 oproti v10.3** (Michal 2026-11-02, docs/napady/autority.html kolo 2
a docs/napady/odpor-vzbura-poc.html; staré znenia v `docs/pravidla-historia.md`, sekcia v10.4):

- **Spáliť** (§17): karta ide **navždy z hry** (nevracia sa do žiadneho balíčka); **odhodiť** =
  do odhadzovacieho balíčka. Pojem „zahodiť“ zanikol — Vízia, Veterinár, Krištáľová guľa,
  Krokodíl, Dievčina na vydaj a Absťák odteraz „pália“ (správanie sa nemení).
- **Poľovník** (§16, nová Autorita): „Nástup: Spáľ súperovo Zviera na druhej strane lokality, ktoré
  je od nej najďalej.“
- **Predavačka** (§7, §16, nová Autorita): „Kšeft: Za 1 cigaretu si dober 1 kartu.“
- **Vedúcko** (§16, nová Autorita): „Furt: Roboty kariet, ktoré s ním susedia, sa rátajú ako Pecky.“
- **Policajtka** (§16): „Pitka: Za každú súperovu akciu, ktorú v tejto Pitke zruší tvoj Odpor, získa
  súper 1 zadĺženie.“ (predtým Konflikt: Dlh, za Kriminála 2 cigarety).
- **Profesionálny tipér** (§16): ráta za „posilnené“ aj akcie posilnené Forsážou.

**Zmeny v10.3 oproti v10.2** (Michal 2026-11-02; staré znenia v `docs/pravidla-historia.md`,
sekcia v10.3):

- **Forsáž** (§6, §7): Posilnenie + Posilnenie na spoji už nie je „nič“. Obe karty spoja majú
  **všetky svoje aktívne akcie posilnené (×2)**; akcia posilnená navyše Posilnením suseda má ×4.
  Lokalita len hranu pri tom kraji, **Nástroj Forsáž nedostane**. Odpor Praudovravca (ráta sa ako
  Posilnenie) Forsáž vytvára. NA EX, ktorý zruší jedno z dvoch Posilnení, zruší aj Forsáž.
- **Vzbura s Nástrojom** (§6): Odpor Nástroja proti Odporu Občana či Starešinu — Vzburu dostane
  len Občan / Starešina, Nástroj nie.
- **Úplatok zrušený** (§7, §16): Kulturista je **Sypač** — „Pitka: Ak sa stane Výtržníkom, jeho
  akcie sú Pecky, nie Rany.“
- **Veľmi smútiaca vdova** (§16): Konflikt — súper odhodí 2 karty z doberacieho balíčka za každého
  svojho Chlapa, ktorý s ňou susedí (predtým: priložený Chlap po bitke z hry).
- **Liberál** (§16): Furt — s rovnako ženami a chlapmi v tvojej partii sú jeho aktívne akcie
  posilnené (predtým: súper bez rovnováhy 1 zadĺženie v Pitke).

**Zmeny v10.2 oproti v10.1** (Michal 2026-11-01: „Vedľa lokality sa nedá umiestniť náradie.“;
staré znenia v `docs/pravidla-historia.md`, sekcia v10.2):

- **Nástroj nie vedľa lokality** (§6, §12): Nástroj sa do línie nevyloží na prázdnu stranu —
  ani na svoju, ani na súperovu, ani vo finále (pinnacle je lokalita). Platí pre každé vyloženie
  do línie (aj ťah s viacerými kartami, Záverečná, odpoveď na NA EX); za Živnostníka ho priložiť
  smieš. Do Dedičstva ako doteraz. Nástroj, ktorý sa k lokalite dostane neskôr (karta medzi
  nimi odíde), ostáva ležať.

**Zmeny v10.1 oproti v10** (Michal 2026-11-01; staré znenia v `docs/pravidla-historia.md`,
sekcia v10.1):

- **Pokus o zajatie pred stavbou šenku** (§4, §5, §10): po voľbe cieľa, ešte pred stavbou
  šenku (predtým po braní). Karta staršieho (boss) ide **pokúšajúcemu do ruky** (predtým
  súperovi) — smie ju v kole vyložiť, len s akciami. O výsledku ďalej rozhoduje bitka (krok 6d).
- **Karta zadarmo** (§5): súper pokúšajúceho si pri stavbe zo svojich 8 kariet **tajne nechá
  1 do ruky**, 4 dá do šenku a 3 naspodok — aj keď pokus potom zlyhá. Keď skúšajú obaja,
  karta zadarmo nie je nikomu.

**Zmeny v10 oproti v9.3** (Michal 2026-11-01, docs/napady/hadka.html; staré znenia v
`docs/pravidla-historia.md`, sekcia v10):

- **Hádka** (§2, §9.1): kroky Povery a Pohoršenie sa zlúčili do jedného. Povera a Pohoršenie sú
  **mäkké poškodenie** (Pohoršenie 2, Povera 1, po vyrušení Povier s Vierou 1 : 1). Kto má viac
  mäkkého, vyhral hádku o rozdiel a rozdelí ho na **sily priazní starších len k sebe** — cena
  podľa zóny ako pri Nakladačke, strop sila 3, platí do konca kola. **Marker sa nehýbe**; markery
  hýbe už len Nakladačka. Remíza = nikto nerozdeľuje.
- **Abstinent** (§9.3, §9.4, §10): v bitke sa ti neráta 1 / 2 / 3 Absťákov (tuhé za ne neklesne,
  nerátajú sa ani pri remíze v tuhom); Pohoršenia navyše už nedáva.
- **Veriaci** (§9.1, §9.3): proti Poverám so silou pred hádkou, rozdiel po hádke tlmí tuhé.
- **Náradie** (§12): Telefón — tvoje Pohoršenia nemožno zrušiť Odporom a NA EX; Horoskop — tvoje
  Povery majú silu 2 (prenášanie klebiet do ďalšieho kola zaniklo). Svätý text ostáva „hodnota
  tvojej Viery je o 1 vyššia“ len v tlmení tuhého — Povery ruší jedna Viera po jednej (Michal 2026-11-01).
- **Starší v ohrození** (§10): hádka smie meniť silu jeho priazne; zákaz O8 ostáva pre Nakladačku.

**Zmeny v9.3 oproti v9.2** (Michal 2026-10-31, interview po audite pravidiel `docs/napady/audit-pravidiel-v92.html`;
staré znenia v `docs/pravidla-historia.md`, sekcia v9.3):

- **Výtržník prebíja Úplatok** (§7, §16 Kulturista): kým je karta Výtržníkom, úplatky na nej
  sa na jej akcie neuplatnia — ani tie, ktoré dostala pred zrážkou. Na Výtržníka sa Úplatok
  dať nedá (hra ho neponúkne, cigareta by prepadla naprázdno). Úplatok zanikol vo v10.3.

**Zmeny v9.2 oproti v9.1** (Michal 2026-10-30; staré znenia v `docs/pravidla-historia.md`, sekcia v9.2):

- **Šenok začína obranca** (§4, §5): útočník berie druhý. Kto berie prvý, na **svojom
  prvom ťahu vezme len 1 kartu** (za 1 cigaretu) — nevykradne šenok; ďalej 1 alebo 2 ako doteraz.
- **NA EX sa odkrývajú naraz** (§7): jedna udalosť, oba poldeci ľahnú súčasne.
- **Odpovede na NA EX lícom dole** (§7): štýlom Záverečnej, ale zadarmo — najprv
  **útočník**, potom **obranca na druhý kraj línie**; obe sa **otočia naraz** a Pitka sa
  vyhodnotí. Posledné slovo nemá nikto. **Kohút** je dočasne vyradený (§16).

**Zmeny v9.1 oproti v9** (staré znenia v `docs/pravidla-historia.md`, sekcia v9.1):

- **Chuť a Absťák v3** (§4, §8, §9, §11, §14, §16, §17; docs/napady/abstak-3.html):
  verejné počítadlo **Chuť** (štart 0). Nerest je len konzumácia — Vypiť 1, **NA EX 2**,
  vyfajčená cigareta 1. Na konci kola: menej nerestí než Chuť → **karta Absťák** do
  odhadzovacieho balíčka; potom Chuť = väčšie z (Chuť, neresti) − 1. Absťák je Kliatba,
  nedá sa priznať, −1 tuhé za každú kartu kdekoľvek v balíčku; spáli ju Vízia. Súper
  latku neurčuje, **Nervák zaniká**. Výučba Prvá hra je bez Chuti.
- **Nakladačka vo finále → špaky 1 : 1** (§9.4, §14b): víťaz finále dostane za každý
  bod Nakladačky 1 špak (predtým prepadla).
- **Zastávka** (§15): po prvej Pitke kola si každý vezme zadarmo kartu zo šenku,
  najprv útočník (spoločný limit vykladania zaniká).
- **Pasca** (§16): Rana navyše (text karty od sady v36), nie Pecka.
- **Opatrovateľka** (§16): Furt — Chuť sa na konci kola porovnáva o 2 nižšia.
- Znenie: Nakladačka spresnená (§9.4), Valaška (predtým Boxer), Šarlatán a NA EX (§16).

**Zmeny v9 oproti v8** (staré znenia §1, §10 Patronát a Prebudenie a tabuľka
priazní v8 sú v `docs/pravidla-historia.md`, sekcia v9):

- **Väzeň namiesto patronátu a vydesenia** (§1, §5, §9, §10): po šenku smie hráč za
  **1 cigaretu** skúsiť zajať staršieho, ktorý sa ho **bojí na stupni 3**. Karta
  staršieho (boss) ide súperovi do ruky, starší je **v ohrození** (v kole sa jeho
  markerom nehýbe). Vyhrá bitku → **väzeň** v priznaných kartách; prehrá alebo
  sekera → starší späť, marker o stupeň k stredu. **Tretí väzeň jedného hráča =
  výhra hneď.** Po finále väzni dajú špaky podľa poradia zajatia v partii
  **8 / 6 / 4 / 2**. Ohlásené vydesenie, patronát, náhrada a prebudenie zanikajú.
- **Kšeft väzňa** (§7, §16): efekty ôsmich starších nahradil výhradný Kšeft, ktorý
  má len držiteľ väzňa, za **vypitý plný poldeci**, raz za Pitku na väzňa. Karta
  staršieho v línii má len akcie.
- **Bossovia** (§10, §16): karty starších majú 6 akcií, 2 blokované sloty a presne
  1 neresť (Hazard alebo Pečeň), dve siluety 4 + 4 — zadáva Admin v tvorcovi.
- **Priazne** (§10, §11): **Advokát** (exekúcia −1 / −2 / −3 špaky) a **Robota**
  (1 / 2 / 3 akcie Robota navyše) namiesto Exekútora a Výpalníka; **Fajčiar** po
  bitke; **Kmotor** presúva 2 / 3 / 4 Dlhy.
- **Šenok** (§5): N = 8 vždy (v8.5), väzni ho nezmenšujú.

**Zmeny v8 oproti v7** (staré znenia v `docs/pravidla-historia.md`, sekcia v8;
zmeny v7 oproti v6 tamže, sekcia v7):

- **Špaky za bitku = karty v línii** (§9.4, §14, návrh #28): víťaz dostane
  1 špak za každú kartu, ktorá v čase bitky leží v línii na oboch stranách —
  nie za odohrané Pitky.
- **Strach za novú zónu** (§10, §14, návrh #28 B): starší zaplatí víťazovi len
  zóny, ktoré mu ešte nezaplatil (žltá 1, oranžová 2, červená 3); ústup markera
  k stredu vyplatené zóny zmaže.
- **Nakladačku rozdeľuje porazený** (§9.4): ten, proti komu sa Nakladačka ráta, si
  vyberá, ktorých starších posunie; vo finále rozdeľuje držiteľ a strach za nové
  zóny sa vyplatí hneď. Nakladačka sa nikde nemení na špaky 1 : 1.
- **Kultúrny dom „Obaja získajú špaky“** (§15, návrh #29): porazený dostane 1 špak za
  každú svoju kartu v línii.
- **Finále** (§14b, návrh #32): posledná bitka je o pinnacle lokalitu a hrá sa
  ako o každú inú; finále bez lokality (sada do v6) z pravidiel aj z hry vypadlo.
  **Ihrisko:** Dvojčatá sa rátajú za dve (§15, §16).
- **Nepriznaná Cirhóza −3** špaky na konci hry (§11, §14, návrh #33).
- **Exekútor bez prahu** (§11, Michal 2026-10-28; nahrádza prah 6 z návrhu #34):
  v každej bitke ku každému s priznaným Dlhom — zhorí polovica Dlhov nahor
  a rovnako špakov, súperova priazeň Exekútora navyše 1 / 2 / 3; **až po
  poškodení a špakoch za bitku** (§9, krok 4c), takže Povery, remíza, Herňa
  a Noviny vidia Dlhy pred exekúciou. **Záhradkár** v tvojej partii ťa exekúcia
  v tomto kole obíde. **Kmotor presúva Dlhy súperovi** (§10, návrh #34).

**v8.1 — Absťák „Nervák“** (Michal 2026-10-28, roadmapa #113; návrhy 1 + 4
z docs/napady/abstak-2.html):

- **Krok so stolom** (§8): na konci kola sa porovnajú neresti **oboch hráčov
  v tomto kole** — kto mal menej, dostane Absťák rovno priznaný (+1 karta), kto
  viac, zbaví sa jedného priznaného; rovnosť nič. Porovnanie s minulým kolom
  a „prvé kolo nastaví základ“ zanikli.
- **Nervák** (§9.2, §9.3, §9.4, §14): každý Absťák v bitke o ranu menej a navyše
  **+1 Pohoršenie**; remízu v tuhom ďalej rozhodujú Absťáky. **Zrážka špakov
  víťazovi za Absťáky zaniká.**

**v8.2 — Hazard, počítadlá a cena posunu** (Michal 2026-10-30, z jeho partie
a výučby; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Akcia Dlh sa volá Hazard** (§2, §8): Hazard zvyšuje zadĺženie, zadĺženie
  dáva Dlhy. Kľúč v dátach ostáva `Dlh`.
- **Dlh a Absťák nie sú karty, ale počítadlá** (§8, §11): sú hneď priznané,
  neťahajú sa, nedá sa s nimi manipulovať. Za nový Absťák si hráč kartu
  **nedoberá**. Všetko, čo rátalo Absťáky „priznané, v línii a v ruke“, ráta
  počítadlo — je verejné. Cirhóza ostáva kartou.
- **Cena posunu markera** (§9.2, §9.4, §10): Pohoršenie aj Nakladačka platia za
  pole podľa cieľovej zóny — von zo stredu žltá **1**, oranžová **2**, červená
  **3** (zo stredu na červenú 6), k stredu o 1 viac — z červenej **4**,
  z oranžovej **3**, zo žltej **2**. Hráč vyberá len staršieho (pri Pohoršení aj
  smer), marker ide, kým body stačia; zvyšok ide na ďalších starších. Čo už na
  žiadny posun nestačí, prepadne.
- **Povera poškodzuje** (§2, §9.3): mäkké poškodenie proti priznaným Dlhom
  súpera (len znenie).

**v8.3 — Strach až po udržaní a pojmy stupnice** (Michal 2026-10-30, revízia
starších krok 1, docs/napady/starsi-revizia.html R2 variant 6A a R14; značka
`VERZIA_PRAVIDIEL` ostáva „v8“):

- **Strach až po udržaní** (§10, §14): stupeň, kam sa marker dostal, zaplatí
  hráčovi, ktorého sa starší bojí (žltá 1, oranžová 2, červená 3), až **na konci
  nasledujúceho kola, ak sa na ňom marker udrží** — kontrola na konci kola po
  bitke, Pohoršeniach aj Nakladačke. Platí **aj porazenému**, nezáleží, kto bitku
  vyhral. Odtlačený stupeň nič. Krok 4b „špaky za starších víťazovi“ zaniká.
- **Finále** (§14b): stupne, kam sa marker dostal až vo finále, nič; stupne udržané
  z posledného kola sa vyplatia po finále. **Vo finále sa rozdeľuje len Pohoršenie,
  Nakladačka už nie.**
- **Pojmy** (§10, §17): zóny sa volajú farbou a **stupňom 0–3** (stred 0, žltá 1,
  oranžová 2, červená 3); starší je podľa stupňa **pokojný / znepokojený /
  vystrašený / vydesený**; smer posunu je **„od seba / k sebe“** (predtým „k súperovi /
  k sebe“), posun od seba staršieho **desí**, k sebe ho **upokojuje**. Názvy zón
  Neutralita / Znepokojenie / Strach / Vydesenie zanikli; „vydesenie“ ostáva
  pre výhru (§1). Patronát a výhra vydesením zatiaľ ostávajú (zaniknú s väzňom,
  revízia krok 2).
- **Povery „Výpožička priazne“** (§9.1, §9.3, §9.4, Michal 2026-10-30,
  docs/napady/povery.html): nový krok bitky **Povery** pred Pohoršením. Viera
  a Povery sa vyrušia 1 : 1 ako doteraz; každá **zvyšná Povera posunie silu
  priazne jedného staršieho o stupeň k svojmu majiteľovi** (marker sa nehýbe,
  strach ani udržanie sa nemenia), strop 3, **len na toto kolo**. **Mäkké
  a celkové poškodenie aj strop podľa Dlhov zanikajú**; Nakladačka = rozdiel
  tuhého a drží ju víťaz. **Otvorené** (P5, P6): Čierna mačka podľa návrhu „Furt:
  Tvoje Povery sa Vierou nerušia.“ (text karty zmení Admin); pojem ostáva Povera.
- **Nakladačka** (Michal 2026-10-30): **prebytok** — rozdiel tuhého poškodenia,
  ktorým sa po bitke posúvajú starší — sa volá **Nakladačka** všade, kde ho číta
  človek. Kľúče v dátach a príkaz `prebytok` ostávajú.

**v8.4 — Náradie** (Michal 2026-10-30, docs/napady/naradie-akcie.html, sekcia
Rozhodnuté; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Robota** (§2, §11): spáli 1 priznaný Dlh; **za každý Dlh, ktorý nemá čo spáliť,
  dá 1 špak** (s Fúrikom 2 Dlhy, bez Dlhov 2 špaky).
- **12 nových Nástrojov do Dedičstva** (§12, §16): Zapaľovač, Výherné žreby, Píšťalka,
  Hrable, Zrkadlo, Valaška, Telefón, Jogurt, Energeťák, Horoskop, Fúrik, Krištáľová guľa.
- **Puška** (§16): už nepridáva +1 k Petelici — prepojenú Petelicu, ktorú by zrušil
  Odpor či NA EX, namiesto zrušenia ráta o 1 poškodenie menej (3 → 2).
- **Profesionálny tipér** (§16): posilnené akcie na jeho spojoch — súperove ako
  posilnený Hazard, tvoje ako posilnená Robota.
- Karty pridá Admin do sady; kým nie sú zverejnené, jadro ich pozná podľa id.

**v8.5 — Náradie a Občania** (Michal 2026-10-30; značka `VERZIA_PRAVIDIEL` ostáva „v8“):

- **Spoločný balíček sa delí na dva** (§3, §5): **Náradie** (karty s tagom Nástroj)
  a **Občania** (všetky ostatné karty, ktoré boli v spoločnom balíčku).
- **Stavba šenku** (§5): každý hráč dostane **vždy 2 karty z Náradia a 6 z Občanov**;
  počet nezávisí od nenahradených starších. Do šenku dá **4 v ľubovoľnom mixe**, zvyšok
  naspodok svojho balíčka (Nástroj k Náradiu, ostatné k Občanom). Nevzaté karty zo
  starého šenku idú naspodok svojho balíčka.
- **Doplnenie šenku** (§5): na 8 v rovnakom pomere — najprv z Náradia, kým v šenku nie sú
  aspoň 2 Nástroje, zvyšok z Občanov.
- **Výklad Leadera (2026-10-30, Michal neurčil):** keď jeden balíček nestačí, chýbajúce
  karty dá druhý; keď sa minú oba, stavba sa zmenšuje ako doteraz, bez trestu.

Špecifikácia pravidiel kartovej hry NA EX! (Michal Calík) pre implementáciu
a testy. Text pre hráčov je na stránke Pravidlá; toto je presné znenie, podľa
ktorého sa hra programuje a overuje.

Poradie kapitol sleduje priebeh partie: **Rýchly štart** (§1–§4), **Kolo krok
za krokom** (§5–§10), **Podrobnosti** (§11–§16) a slovník (§17).

- Karty: `packages/core/data/cards.json` (východisková sada; hra beží na sade
  zverejnenej v tvorcovi). Starší: `data/elders.json`, scorecardy (od v6 len
  priazeň): `data/scorecards.json`. Číselné konštanty: `KONSTANTY` v jadre.
- Platí to, čo robí jadro (`packages/core`). Rozpor textu a hry je chyba na
  rozhodnutie (agent rozhodca, mapa `tools/rozhodca/mapa.json`), nie potichu
  oprava.
- Čo pravidlá nehovoria, nedopĺňaj potichu — spýtaj sa a zapíš to sem.
- Ako sa pravidlá menili a čo platilo predtým: `docs/pravidla-historia.md`
  (zmeny oproti v7: sekcia v8). Partie v archíve nesú `VERZIA_PRAVIDIEL`
  („v4“ … „v9“, staršie dátumové značky).

---

## 1. Cieľ a koniec hry

Kompetitívna kartová hra pre **presne dvoch hráčov**. Hráči si budujú balíčky,
bijú sa o lokality a desia starších. Každé kolo je jedna bitka; hra má toľko
bitiek o lokality, koľko určí dĺžka hry (§3), a po nich **finále** — poslednú
bitku na vrcholovej (pinnacle) lokalite (§14b). Víťazné body sú **špaky** (§14): za vyhratú bitku
(karty v línii) a za starších po každej bitke (strach a reči, §10). Hra končí okamžitou
výhrou strachom alebo väzňami, alebo po finále väčším počtom špakov. Pri rovnosti
špakov je remíza.

### Podmienky konca

| Udalosť | Výsledok |
|---|---|
| Hráč **vyhrá bitku** a po bodovaní má **červený strach u aspoň 4 starších** — jeho väzni sa rátajú ako jeho červené (v11, krok 4c) | **vyhráva hneď** (výhra strachom) |
| Hráč **vyhrá bitku** a po zajatí má **väzňov aspoň (lokality + finále) / 2**: Tretia liga **2**, Druhá **3**, Prvá **4** (v11; v11.4 hneď po rozdelení Nakladačky, krok 4e) | **vyhráva hneď** (výhra väzňami) |
| Odohrá sa finále (po 3 / 5 / 7 bitkách o lokality podľa dĺžky hry) | vykúpia sa zvyšné plné poldeci a cigarety, odpočíta sa nepriznaná Cirhóza a vyhrá viac špakov (§14); väzni od v11 špaky nedávajú |

Obe okamžité výhry platia len v bitke, ktorú hráč vyhral — štyri červené porazeného hru
neukončia. Exekúcia prehru nespôsobí — stojí Dlhy a špaky (§11). „Vydesený“ je stupeň staršieho
pre hráča, ktorého stupnica (strach + reči) siaha na červenú; do výhry strachom a zajatia sa ráta len
červený strach (§10).
Malý balíček prehru nespôsobí:
keď sa doberací aj odhadzovací balíček minú, hráč len nemá čo ťahať (a fajčiť
sa vtedy nedá, §7).

---

## 2. Karta, akcie, tagy, varianty

Každá karta má názov, ilustráciu, tagy, **akcie po stranách** a **efekt**.

Akcie sedia v slotoch: 4 vľavo, 4 vpravo, index **0 hore až 3 dole**.
Slot môže byť *blokovaný* (nikdy nedrží akciu) alebo *prázdny*.

### Varianty

`cards.json` popisuje pri každej strane len **multimnožinu akcií** plus
blokované pozície, nie konkrétne rozloženie. Z toho vzniká N rôznych rozložení
a každé je v tlači samostatná karta („Štartovacie karty existujú v rôznych
variáciách“). Pole `permutations` udáva očakávaný počet — je to kontrolný súčet
generátora.

```
rozloženia strany = počet rôznych permutácií multimnožiny
                    (akcie + prázdne miesta) po voľných slotoch
variantov karty   = rozloženia_vľavo × rozloženia_vpravo
```

Príklady na overenie: `autobusar` ľavá 6 × pravá 1 = 6 · `ihrisko` pravá strana
má Poldeci ×3 v 3 slotoch → **1** rozloženie (nie 6 — sú to zhodné prvky).

### Tagy

Lokalita, Kliatba, Občan, Nástroj, Zviera, Chlap, Žena, Pracujúci, Kriminál,
Závislý, Zahraničný, Autorita, Influencer, Pamätník, Starešina.

Tagy nemajú vlastné pravidlá, pokiaľ sa na ne neodvoláva pravidlo (napr. NA EX
len na Občana či Starešinu, priznanie len Kliatby) alebo efekt karty.

### Akcie

| Akcia | Kľúč v cards.json | Účinok |
|---|---|---|
| Rana | `Rana` | 1 tuhé poškodenie |
| Pecka | `Pecka` | 2 tuhé poškodenie |
| Petelica | `Petelica` | 3 tuhé poškodenie |
| Povera | `Povera` | **1 mäkké poškodenie** (v10; s Horoskopom 2) do hádky (§9.1); ruší sa so súperovou Vierou 1 : 1 na kusy |
| Pohoršenie | `Pohoršenie` | **2 mäkké poškodenie** (v10) do hádky (§9.1); Viera ho nezruší, Telefón ho chráni pred Odporom a NA EX |
| Viera | `Viera` | najprv zruší súperove Povery 1 : 1 na kusy (jedna Viera jednu Poveru, aj vylepšenú Horoskopom), zvyšná znižuje súperovo tuhé poškodenie o hodnotu Viery (1; Svätý text v Dedičstve +1) za kus; priazeň Veriaceho pridá Vieru navyše rovnú sile (+1 / +2 / +3; proti Poverám so silou pred hádkou, §9.1) |
| Hazard | `Dlh` | zvýši **zadĺženie** o 1; každé 2 zadĺženia = 1 Dlh, hneď priznaný (počítadlo, §8; v7 zvyšok neprepadá); za priznané Dlhy príde v každej bitke Exekútor (§11) |
| Poškodenie pečene | `PoškodeniePečene` | pridá poškodenie pečene (§8) |
| Obmedzenie | `Obmedzenie` | súper dostane v Pitke o 1 cigaretu menej |
| Cigareta | `Cigareta` | +1 **cigareta** v Pitke — cigarety sa prenášajú z kola na kolo; platí sa nimi šenok, Dedičstvo, doliatie, barter, Záverečná a Kšefty (Strýko, lokality), fajčením (len v Pitke, §7) dávajú karty |
| Vízia | `Vízia` | na konci Pitky: za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho doberacieho balíčka a vezme si ju do ruky, alebo ju **spáli** (navždy z hry) |
| Poldeci | `Poldeci` | otočí jeden vypitý poldeci späť na plný — **až pri bitke** (§9.5); v Pitke pridá poškodenie pečene |
| Posilnenie | `Posilnenie` | zdvojnásobí prepojenú akciu (priaznivú aj nepriaznivú); Posilnenie + Posilnenie = Forsáž (§6) |
| Odpor | `Odpor` | zruší prepojenú akciu; Odpor + Odpor = Vzbura (§6) |
| Robota | `Robota` | v kroku exekúcie (po poškodení), **pred** Exekútorom, spáli 1 priznaný Dlh (z hry, §11); **za každý Dlh, ktorý nemá čo spáliť, dá 1 špak** (v8.4) |
| Pakt | `Pakt` | **v7:** na spoji sa správa ako akcia, s ktorou je v páre (aj zlá — Hazard, Pečeň). Premení sa ešte pred násobkami: Pakt + Posilnenie = dve Posilnenia, teda Forsáž (v10.3). Pakt + Pakt nerobí nič. **Odpor** Pakt zruší ako každú akciu (Vzbura nevznikne). Neaktívny Pakt nemá čo kopírovať: do súčtov nejde, NA EX ho nezdvojí a do podmienky „aspoň 1 neaktívna akcia“ (§7) sa neráta. Na hranách lokalít Pakt nie je; pri lokalite kopíruje akciu hrany. Pri Výtržníkovi (§7) je Rana ako každá jeho akcia. |

Akcia sa volá ako karta či zdroj, ktorý dáva: `PoškodeniePečene` → Poškodenie
pečene, `Poldeci` → Poldeci, `Cigareta` → Cigareta (starý kľúč `Cigaretka` sa
pri načítaní sady preloží). Výnimka: akcia s kľúčom `Dlh` sa od v8.2 volá
**Hazard** (Michal 2026-10-30) — Hazard kumuluje zadĺženie a zadĺženie Dlhy.
Kľúč ostáva `Dlh` (sady, karty a partie v archíve ho nesú). Slovo „fyzická
cigareta“ sa nepoužíva — cigareta je cigareta.

---

## 3. Príprava hry

- **Dĺžka hry (liga)** sa volí pred začiatkom počtom lokalít: Tretia liga **3**,
  Druhá liga **5** (predvolená), Prvá liga **7**, potom finále. Ktoré ligy hráč
  smie hrať, určuje admin (odomykanie výhrami proti človeku; web, nie pravidlá).
- **Lokality (v7):** v hre sú **všetky lokality sady** (`cards.json` ich má 19)
  a nežrebujú sa. Každé kolo má **úroveň** podľa rozpisu, ktorý obaja vidia od
  začiatku: Tretia liga **1 · 2 · 3 · P**, Druhá **1 · 2 · 2 · 3 · 3 · P**, Prvá
  **1 · 1 · 2 · 2 · 3 · 3 · 3 · P** (P = pinnacle vo finále). Úroveň lokality je
  počet akcií na jej hrane (obe hrany majú rovnako): 1 spodok, 2 dedina,
  3 sídla dedinskej šľachty, 4 pinnacle s korupciou.
- **8 starších**, každý na **scorecarde** rozdanom náhodne (scorecard určuje
  len priazeň staršieho, §10; bodovacie podmienky od v6 nie sú). Marker
  každého staršieho začína **v strede stupnice** (index 3, jediné sivé pole).
- **Počiatočná ruka:** každý hráč má na začiatku v ruke **4 karty** —
  Miňištrant, Milujúca manželka, Pijan a Dievčina na vydaj (variácie podľa
  sady). **Doberací balíček je prázdny** — naplní ho až odhadzovací (§4).
  Tieto štyri druhy nie sú v Náradí, Občanoch ani v šenku.
- **Náradie a Občania (v8.5):** karty šenku ležia v dvoch balíčkoch lícom dole,
  každý zamiešaný — **Náradie** (2 kópie každej karty s tagom Nástroj)
  a **Občania** (2 kópie každej ďalšej karty okrem lokalít, starešinov, kliatob
  a štartoviek). Počet kariet v oboch je verejný, poradie nie.
- Každý hráč začína s **3 cigaretami**, **2 plnými poldeci**, **0 špakmi**,
  0 dlhmi, 0 poškodením pečene, Chuťou 0 (bez kariet Absťák) a počítadlom nerestí na 0.
- Šenok je na začiatku prázdny — hráči ho postavia v prvom drafte (§5).
- Útočník prvého kola sa určí náhodne (zo semienka hry).

---

## 4. Priebeh kola

```
začiatok kola → voľba cieľa → draft (stavba šenku, branie)
  → (Zhromaždenie → Pitka) × 1–4 (pinnacle 1–5) → bitka → koniec kola
finále: voľba pinnacle → draft → (Zhromaždenie → Pitka) × 1–5 → bitka → koniec hry   (§14b)
```

**Útočník** = hráč, ktorý **prehral poslednú bitku** (v prvom kole náhodne;
pri sekere ostáva útočníkom; vo finále útočí, kto má menej špakov, §14b). **Vykladá prvý
a na odkryté NA EX odpovedá prvý** (lícom dole, §7) — jeho výhody slúžia na dobiehanie.
**Obranca** je víťaz poslednej bitky: **vyberá a natáča cieľ** kola, **berie zo šenku
prvý** (v9.2, na prvom ťahu len 1 kartu, §5) a na odkryté NA EX odpovedá druhý — na
druhý kraj línie. Pitku hrajú obaja naraz (§7).

**Začiatok kola:**

- Každému hráčovi sa otočí **jeden vypitý poldeci na plný** (§6, limit).
- Od druhého kola si každý hráč dobere zo svojho doberacieho balíčka
  **1 kartu** (dobratie po bitke; do 2026-10-27 dve — ďalšie karty sa
  kupujú cigaretami v šenku a fajčením). **Keď sa doberací balíček minie,
  odhadzovací sa zamieša a stane sa z neho nový doberací balíček** — pri
  každom ťahaní, aj uprostred neho. Na začiatku hry je doberací balíček
  prázdny (§3): kým hráč nemá ani odhadzovací, ťahanie nedá nič, fajčiť sa
  nedá a Poštárka sa nepoužije. **Limit ruky nie je** — hráč smie mať kariet, koľko chce. Karty
  navyše dáva šenok, fajčenie v Pitke (§7), Vízia a efekty (Kšefty, Zastávka,
  Hasič…). Priznanie Cirhózy kartu nedá (§11).

**Koniec kola** (po bitke a návrate kariet, §9.7): neresti kola sa porovnajú
s **Chuťou** každého hráča (Absťák, §8; po finále nie). Starší bodujú ešte v bitke (krok 4b)
a zajíma sa v nej tiež (rozdelenie Nakladačky, krok 4e, §9); udržaný strach zanikol v11.

**Nevyhnutné ťahy:** keď hráč nemá inú možnosť než pasovať (v Zhromaždení)
alebo preskočiť NA EX (v Pitke), hra ten ťah urobí za neho.

---

## 5. Cieľ a draft

### Voľba cieľa

Obranca vyberie lokalitu, o ktorú sa v kole bije, a **natočí ju**. Natočenie
určuje, ktorá hrana lokality leží pri ktorom kraji línie (§6). **v7:** vyberá
zo **všetkých ešte neodohraných lokalít úrovne tohto kola** (§3) — vždy aspoň
z troch; vo finále z troch pinnacle (§14b).

Pokus o zajatie pred stavbou šenku (v10.1–v11.3) zanikol v11.4 — zajíma sa pri rozdelení
Nakladačky (§10). Šenok sa stavia hneď po voľbe cieľa.

### Stavba šenku

Karty, ktoré zo starého šenku nikto nevzal, idú lícom dole naspodok svojho
balíčka — Nástroj naspodok **Náradia**, ostatné naspodok **Občanov** (v8.5).
Každý hráč si potom vezme **2 karty z vrchu Náradia a 6 z vrchu Občanov**
(8 kariet; počet od v8.5 nezávisí od starších). Obaja naraz a tajne dajú zo
svojich 8 kariet **4 do šenku v ľubovoľnom mixe** (0–2 Nástroje) a **4 naspodok**
— každú naspodok jej balíčka, lícom dole (súper nevidí, čo hráč odhodil). Keď
vyberú obaja, karty do šenku sa odhalia. Balíčky si hráči nepodávajú. Šenok má
8 kariet, polovicu od každého.


**Keď balíček nestačí** (výklad Leadera 2026-10-30, Michal to neurčil): chýbajúce
karty sa vezmú z druhého balíčka (obranca berie prvý). Keď nestačia ani oba
spolu, každý dostane najviac polovicu toho, čo v nich ostalo, zaokrúhlené nadol
na párne číslo — stavba sa zmenšuje až na nulu a hra beží ďalej bez trestu.

### Branie zo šenku

Hráči berú zo šenku **striedavo, začína obranca** (v9.2, Michal 2026-10-30; útočník
berie druhý), kým obaja neprestanú. Na svojom ťahu hráč vezme:

- **1 kartu za 1 cigaretu**, alebo
- **2 karty za 3 cigarety**.

Kto berie prvý, na **svojom prvom ťahu vezme len 1 kartu** — aby nevykradol šenok;
všetky ďalšie ťahy oboch hráčov ako vyššie (pri dosť cigaretách teda 1 – 2 – 2 – 2…).

Poldeci sa v šenku neplatí a nič zo šenku nie je zadarmo. Kto nemá cigaretu, brať
nemôže (hra za neho branie ukončí). Keď jeden prestane, druhý má už len **jednu
poslednú šancu** (jeden ťah), potom branie končí. Prázdny šenok branie ukončí
obom.

Nevzaté karty ostávajú v šenku len do ďalšej stavby — vtedy idú naspodok
svojho balíčka (Stavba šenku, vyššie); medzitým z neho berú Starosta a Cintorín.
Po braní sa šenok **doplní na 8 kariet v pomere stavby** (2 : 6): najprv z vrchu
**Náradia**, kým v šenku nie sú aspoň **2 Nástroje**, zvyšok z vrchu **Občanov**
(v8.5). Čo jeden balíček nemá, doplní druhý; keď sa minú oba, šenok sa už
nedopĺňa — hra beží ďalej bez trestu.

Počet kariet stavby je **vždy 2 + 6** (N = 8, v8.5); väzni ho nezmenšujú (v9).
Priazeň Fajčiara dáva cigarety od v9 po bitke (§10), nie po braní.

Po braní začína Zhromaždenie (§6).

---

## 6. Zhromaždenie

Hráči striedavo vykladajú karty do línie, **začína útočník**. Na svojom ťahu
hráč vyloží kartu na svoju alebo súperovu stranu (v jednom ťahu aj viac kariet,
§13), prizná kliatby (§11) alebo vyloží Nástroj do Dedičstva (§12). Vyloženie
Nástroja sa v striedaní počíta ako ťah, priznanie nie.

### Línia, strany a kraje

- Karty tvoria **jednu súvislú líniu**, vetvenie nie je povolené. **Lokalita**
  leží v jej strede a delí ju na dve **strany** — tvoju (vľavo z tvojho
  pohľadu) a súperovu. Aj vo finále leží v strede lokalita — pinnacle
  (§14b).
- Kartu vykladáš vždy na **vonkajší koniec** jednej zo strán — **tvojej aj
  súperovej**. Strana určuje len to, kde karta leží a s čím susedí.
- **Vnútorná hrana** karty je tá, ktorá je obrátená k lokalite — ňou sa karta
  páruje so susedom bližšie k stredu (prvá karta strany s lokalitou).
  **Vonkajšia hrana** ostáva voľná pre ďalšiu kartu. Z pohľadu hráča, ktorý
  kartu zahral: na jeho strane je vnútorná jeho pravá hrana, na súperovej jeho
  ľavá. Web aj klient agentov ukazujú náhľad spoja pred vyložením a ktorá hrana
  lokality je obrátená ku ktorej strane.
- Karta je vždy **natočená k hráčovi, ktorý ju zahral** (na súperovu stranu
  teda ide „nohami hore“). Ten je jej **majiteľ** a karta je v **jeho partii**:
  **partia hráča = všetky karty natočené k nemu**, nech ležia na ktorejkoľvek
  strane. Text karty „v tvojej partii“ = medzi tvojimi kartami.
- **Akcie** karty sa rátajú jej majiteľovi (výnimky: akcie Nástroja, §12,
  a Kočovníka, §16). Na spoji sa karta páruje so susedmi bežne: susedova akcia
  sa aktivuje a pripíše sa majiteľovi susednej karty. **Efekty** karty (Nástup, Furt, Bitka, Výhra…) patria majiteľovi.
- **Kraje:** polovice línie sa volajú podľa hrán lokality — každá lokalita má
  vlastné (Krčma: *pri výčape* / *pri dverách*; zoznam v §15). „Tvoja/súperova
  strana“ ostáva len ako pomenovanie, ku komu kraj prilieha.
- Nástroj tvorí spoj len s Občanom alebo Starešinom a nesmie susediť
  s Nástrojom na konci strany, kam sa vykladá, ani s lokalitou — na prázdnu stranu
  sa nevyloží (v10.2, §12). Kliatba do línie nepatrí.
  Za skrytú Záverečnú ani odpoveď lícom dole sa nepriloží, kým sa neotočí (§7, §13).
- **Konflikt (v11.3):** keď sa karta so spúšťačom Konflikt **priložením** ocitne
  vedľa **súperovej** karty, spustí sa jej efekt — či ju prikladáš ty k súperovej
  karte, alebo súper svoju k nej. **Podpora** je zrkadlo: spustí sa, keď sa
  priložením stretnú **dve tvoje** karty. Oba po Nástupe priloženej karty; Nástroj
  (priložený aj ležiaci), NA EX, zrážka ani presun karty ich nespúšťajú (§16).
- Po bitke sa karta vracia do odhadzovacieho balíčka svojho majiteľa (§9.7).

### Spoj a aktivácia akcií

```
PRAVÁ strana karty N  ↔  ĽAVÁ strana karty N+1
```

Akcia je **aktívna**, ak sa na spoji stretnú **dve neprázdne akcie na rovnakom
indexe**. Každá aktívna akcia sa počíta samostatne. **Akcia bez partnera
nerobí nič.** Karta smie ležať aj bez spoja — žiadne pravidlo nevyžaduje, aby
vyloženie spoj vytvorilo.

Otočením o 180°:

- ľavá a pravá strana sa **vymenia**,
- poradie indexov sa **obráti** (0↔3, 1↔2).

```
efektívna_ľavá(otočená)  = pravá čítaná odzadu
efektívna_pravá(otočená) = ľavá čítaná odzadu
```

### Modifikátory na spoji

| Dvojica | Výsledok |
|---|---|
| X + Y (bežné akcie) | obe sa aktivujú, každá ×1 |
| Posilnenie + X | X sa aktivuje ×2 |
| Odpor + X | X je zrušená |
| Odpor + Odpor | **Vzbura** (v11.1): obe karty sa **obrátia** — nespojené akcie sú aktívne, spojené neaktívne; lokalita len hranu pri tom kraji, nie obe; Nástroj Vzburu nedostane (v10.3) |
| Posilnenie + Odpor | **Vzbura iba karty s Odporom** (v11.1): obráti sa a jej aktívne akcie sú posilnené (×2); Posilnenie je zrušené, karta s ním nič nedostane |
| Posilnenie + Posilnenie | **Forsáž** (v10.3): obe karty majú **všetky svoje aktívne akcie posilnené (×2)**; lokalita len hranu pri tom kraji, Nástroj Forsáž nedostane |

Keď NA EX zruší Posilnenie, zruší aj ×2, ktoré dávalo partnerovi na spoji (§7).

**Vzbura** (v11.1, Michal 2026-11-02: „Majú sa aktivovať akcie naopak, nie aktivovať všetky.“) —
podrobne:

- Karta so Vzburou má **aktívne práve nespojené akcie** (×1) — na oboch svojich stranách, aj na
  vonkajšej hrane bez suseda. **Spojené akcie sú neaktívne**, aj tie, ktoré by zdvojilo
  Posilnenie suseda či Zrkadlo. Pakt spojený s akciou je tou akciou, teda neaktívny; nespojený
  Pakt nič nedá.
- Spoj Odpor–Odpor sám nič nedá: oba Odpory sa vyrušia (do súčtov sa nerátajú; pri lokalite sa
  Odpor hrany do Pitiek ráta ako doteraz).
- **Modifikátory karty na jej ďalších spojoch pôsobia ďalej**: jej Odpor ruší partnerovu akciu,
  jej Posilnenie zdvojí partnera, jej Posilnenie proti Posilneniu dá Forsáž. Vzbura mení len to,
  čo karta dáva svojmu majiteľovi, nie susedov.
- Akcia **zrušená Odporom** ostáva zrušená. Spojená akcia pod Vzburou nie je zrušená, len
  neaktívna — Policajtka za ňu zadĺženie nedá a Telefón ju nezachráni (chráni pred zrušením,
  nie pred Vzburou). Puška sa pod Vzburou neuplatní (prepojená Petelica by bola neaktívna).
- **Odpor proti Posilneniu** (Michal 2026-11-02: „Ak je Odpor spojený s Posilnením, vznikne Vzbura, ale len pre kartu, na ktorej je Odpor, jej
  akcie sa aktivujú naopak, ale sú posilnené. Ďalšie pravidlo – na karty so Vzburou – či už
  Odpor/Odpor alebo Odpor/Posilnenie – sa nedá dať NA EX.“) je Vzbura
  **len karty s Odporom**: obráti sa ako pri Vzbure a **všetky jej aktívne akcie sú posilnené (×2)**.
  Karta s Posilnením sa neobráti a jej Posilnenie je zrušené. Zdvojenie je raz, aj keď má karta
  takéto spoje dva; s Forsážou na druhom spoji sa násobí (×4). Posilnenie suseda na spojenú akciu
  nič nepridá — spojená je neaktívna. NA EX, ktorý zruší Posilnenie partnera, zruší aj toto
  zdvojenie (ako ×2 partnerovi, §7); obrátenie ostáva.
- **NA EX nemožno dať na kartu so Vzburou** (oboch druhov, §7).
- **Poradie:** spoje → Vzbura (obrátenie) → Výherné žreby → **Forsáž** a posilnenie Vzbury
  (zdvojí akcie aktívne po obrátení, teda nespojené) → NA EX → efekty kariet (Silná žena,
  Liberál, Pes…). NA EX na karte so Vzburou leží len vtedy, keď Vzbura vznikla až po výbere
  (rozhoduje stav v okamihu výberu, §7) — potom pôsobí ako vždy: aktívne po obrátení zruší,
  neaktívne zdvojí.
- Pri lokalite sa obráti len hrana pri tom kraji. **Nástroj** sa neobráti (v10.3). Odpor
  **Praudovravca** sa na jeho spojoch ráta ako Posilnenie, takže tam Vzbura nevznikne (vznikne
  Forsáž). Posilnenie a Odpor **Výtržníka** sú Rany — Vzburu nevyvolajú (§7).

**Vzbura a Forsáž s Nástrojom** (v10.3, Michal 2026-11-02): na spoji Nástroja s Občanom či
Starešinom dostane Vzburu aj Forsáž **len Občan / Starešina**; Nástroj ostáva bez nich (jeho
neaktívne akcie sa neaktivujú, aktívne sa nezdvoja).

**Forsáž** (v10.3, Michal 2026-11-02) — podrobne:

- Karta s Forsážou má posilnené **všetky** svoje aktívne akcie, nielen tie na spoji — aj zlé
  (Hazard, Poškodenie pečene), ako Posilnenie. Akcia, ktorú navyše posilňuje Posilnenie suseda
  z druhého spoja, má **×4**. Násobky sa násobia ďalej (Silná žena, Liberál, Pes…).
- Akcie aktívne po **Vzbure** (nespojené, v11.1; aj aktivované Výhernými žrebmi) Forsáž zdvojí
  tiež; spojené akcie karty so Vzburou sú neaktívne, tie nezdvojí. Vzbura z Odporu proti
  Posilneniu a Forsáž na tej istej karte sa násobia (×4).
- **Odpor Praudovravca** sa na jeho spojoch ráta ako Posilnenie, takže Forsáž vytvára
  (s Posilnením aj s Odporom suseda). **Pakt** proti Posilneniu je Posilnenie, teda tiež Forsáž.
- **NA EX** na jednu z kariet spoja zruší jej Posilnenie, a tým aj Forsáž — obom kartám
  (rovnaký princíp ako „NA EX zruší aj ×2 partnerovi“, §7). Energeťák a Veterán to zastavia
  ako dnes. Ostatné akcie karty NA EX ruší a zdvojuje ako vždy.
- Posilnenie a Odpor **Výtržníka** sú Rany (§7), Forsáž teda nevytvoria.

### Prevaha a akcie lokality

Hranu lokality aktivuje karta, ktorá s ňou tvorí spoj, no jej akcie dostane
hráč s **prevahou** v tom kraji: kto tam má **viac svojich Občanov, Zvierat
a Starešinov** (Nástroje, Cirhóza ani iné karty sa nerátajú; Dvojčatá za
dvoch, §16). Pri rovnosti má prevahu hráč, ktorého karta v tom kraji leží
**hneď pri lokalite** (vyložená ako prvá). Jedna podstrčená karta teda
**neukradne akcie hrany**, ale tvorí s nimi spoj: ako prvá karta pri lokalite
určuje, ktoré akcie hrany sa aktivujú, a tie potom dostane hráč s prevahou —
o akcie treba v kraji prevládnuť. Natočenie lokality (volí obranca) určuje,
ktorá hrana leží pri ktorom kraji.

### Limit vykladania

```
limit vykladania = plné poldeci + 1
```

- Vypité (otočené nadol) poldeci sa **nerátajú**.
- **NA EX je mimo limitu vykladania**: dáva sa v Pitke, nie v Zhromaždení, a limit
  nemíňa (ani odpoveď naň, §7). Plný poldeci však z NA EX odíde zo zásoby na
  kartu a do limitu sa už **neráta** — ďalšie Zhromaždenie toho istého kola má
  limit o 1 nižší (súperov sa nemení). Pri bitke sa poldeci vypije (§9.5) a ďalej
  je vypitý, kým sa neotočí na plný (začiatok kola, doliatie, Na zdravie).
- Samotná akcia Poldeci sa do limitu nezapočítava — otáča poldeci až pri
  bitke, takže sa prejaví o kolo neskôr.
- Priznanie (§11) ani Nástroj (do línie aj do Dedičstva, §12) limit nemíňajú.
- Vyloženie na súperovu stranu sa počíta do limitu **hráča, ktorý kartu
  zahral** — bez výnimky (aj Kočovník).
- Každá ďalšia karta v tom istom ťahu stojí plný poldeci (Vypiť, §13), takže
  zostávajúci limit hneď klesne.
- Limit sa počíta **nanovo na začiatku každého Zhromaždenia**. Výnimka: Vínko
  vyložené do Dedičstva v Zhromaždení zvýši zostávajúci limit hneď (§16).
- **Na začiatku každého kola** (pred voľbou cieľa a stavbou šenku) sa každému
  hráčovi otočí **jeden vypitý poldeci na plný**. Viac vypitých si treba doliať
  (cigarety, barter, akcia Poldeci, Krčmárka — §7, §9.5, §16).
- Limit je vždy aspoň 1 — aj bez plných poldeci hráč v Zhromaždení vyloží
  jednu kartu.
- Už vyložené karty sa nikdy nevracajú.

### Pas a koniec Zhromaždenia

Zhromaždenie končí, keď obaja odohrajú svoj limit alebo obaja pasujú.

**Pas:** kto pasuje, do najbližšej Pitky už nevykladá (súper vykladá sám)
a dostane **1 cigaretu za každú kartu, ktorú ešte smel vyložiť** (zostávajúci
limit), **najviac toľko, koľko má kariet v ruke** — teda min(zostávajúci limit,
karty v ruke); s prázdnou rukou nedostane nič (v6.1). Platí to, aj keď pasuje
hra za neho. Pasovanie ruší aj nevyužité ťahy navyše
z Vypiť. Kto v Zhromaždení nemá čo vyložiť, za toho hra pasuje (fajčiť sa
v Zhromaždení nedá, §7). **Záverečná** (§13) ukončí vykladanie ako pas, ale bez
cigariet.

---

## 7. Pitka

Pred každou Pitkou je Zhromaždenie (§6); počet Pitiek v kole určuje lokalita
(nižšie).

### Poradie: Pitka naraz, odpovede lícom dole

Pitku hrajú **obaja hráči naraz** (Michal 2026-10-27): každý fajčí, dolieva,
barteruje, použije Kšefty a **skryto vyberie NA EX** (nižšie), kedy
chce, a skončí sám „hotovo“. Súperove kroky (fajčenie, nákupy, Kšefty) vidno
hneď, jeho NA EX nie. „Hotovo“ je **nevratné** a zapíše sa do logu („Hráč X
končí svoju časť Pitky“); kto skončil, v tejto Pitke už nič nerobí. Keď sú
hotoví obaja, **NA EX sa odkryjú naraz** (v9.2), nasledujú odpovede **lícom dole** —
najprv útočník, potom obranca na druhý kraj línie; obe sa otočia naraz a Pitka sa
vyhodnotí (nižšie). Posledné slovo od v9.2 nemá nikto; **Kohút** je dočasne vyradený
(§16).

**Bzdocha je jediná výnimka:** jej majiteľ **čaká**, kým súper skončí svoju
časť Pitky, a až potom hrá — a vidí súperovo skryté NA EX. Keď má Bzdochu
v partii každý hráč, nečaká nikto (kto skončí neskôr, vidí NA EX toho druhého).

### NA EX

NA EX smie hráč dať **iba v Pitke**, kým ju neskončil, v základe **najviac raz
za Pitku** (Vínna pivnica dvakrát; na Kostole len na kartu v kraji pri
oltári, §15). Vyberie jednu kartu
v línii s tagom **Občan alebo Starešina** — **svoju aj súperovu**, na
ktorejkoľvek strane — a položí na ňu jeden plný poldeci. NA EX vyberá
**skryto**: súper nevidí, či NA EX dal, ani kam (`viewFor` mu to nepošle),
kým sa NA EX neodkryjú.

> NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty, na
> ktorej sa uplatňuje.

- NA EX sa dá len na kartu, ktorá má **aspoň jednu aktívnu a aspoň jednu
  neaktívnu akciu** — nie na kartu bez aktívnej akcie ani na kartu, ktorej sú
  aktívne všetky. Aktívna = spárovaná a nezrušená Odporom; rozhoduje stav
  v okamihu výberu (odpoveď na NA EX už nič nemení). Platí aj pre Veterána.
- **Na kartu so Vzburou NA EX nemožno dať** (v11.1, Michal 2026-11-02) — ani pri Odpore proti
  Odporu, ani proti Posilneniu (§6). Rozhoduje stav v okamihu výberu ako pri podmienke vyššie:
  Vzbura, ktorá vznikne až potom (odpoveď na NA EX, ďalšia karta pred odkrytím), NA EX nezruší.
  Skrytá Záverečná sa neráta — Vzburu s ňou hra zistí až po otočení a súperova skrytá Záverečná
  ostáva cieľom vždy (nič sa nesmie prezradiť); NA EX na nej po otočení ostáva.
- **Akcia zrušená Odporom nie je ani aktívna, ani neaktívna** (v6.1): NA EX ju
  nezruší (už zrušená je) ani nezdvojí, a pri výbere karty sa nepočíta ani do
  aktívnych, ani do neaktívnych.
- Na kartu, na ktorej **už poldeci leží** (z predošlej Pitky kola alebo z tvojho
  skrytého NA EX), sa ďalšie NA EX dať nedá. Súperovo skryté NA EX nevidíš —
  obaja tak môžete vybrať tú istú kartu (zrážka, nižšie).
- Na súperovu skrytú **Záverečnú** sa NA EX dá vždy a skryté Záverečné sa do
  posúdenia susedov nerátajú — nič sa nesmie prezradiť (§13).
- Akcie karty po NA EX sa rátajú jej majiteľovi: na súperovej karte mu zrušíš
  aktívne akcie, ale zdvojíš mu neaktívne. Kliatby, ktoré karta po NA EX
  vyprodukuje (zdvojený Hazard či pečeň), patria majiteľovi karty — NA EX zruší
  aktívne akcie (aj vlastný Hazard či pečeň) a zdvojí neaktívne.
- **NA EX na kartu pri lokalite** ruší a zdvojuje len akcie tej karty — akcie
  **hrany lokality** v páre s ňou ostávajú aktívne (dostane ich hráč
  s prevahou v kraji); jediná zmena je ×2 od Posilnenia karty (nasledujúci bod).
- **NA EX na kartu s Posilnením** zruší Posilnenie aj **×2, ktoré dávalo
  partnerovi** na spoji: partnerova akcia (aj akcia hrany lokality) ostáva
  aktívna, ale už len ×1. Akcia, ktorú karta zrušila Odporom, ostáva zrušená.
  Veteránovi NA EX Posilnenie nezruší, takže partner má ×2 ďalej. Ak Posilnenie
  tvorilo **Forsáž** (§6), zanikne aj tá — obom kartám spoja.
- **Partner zrušenej akcie** na spoji (akcie, ktorú NA EX zrušil — akejkoľvek,
  nielen Posilnenia) ostáva **aktívny ×1**: spoj zaniká len pre zrušenú akciu.
- NA EX leží na karte až do bitky — jej akcie sa vyhodnotia v **každej** Pitke
  kola.
- Poldeci **ostáva hráča, ktorý NA EX dal**: do limitu sa neráta (§6) a pri
  bitke sa vypije (§9.5). Poškodenie pečene z NA EX sa počíta **pri odkrytí**,
  ešte v tej Pitke, a pripíše sa tomu, kto NA EX dal (poldeci pije on). NA EX
  je nerest (§8).
- Na **Krčme** hráč s plným poldeci (a kartou, kam ho dať) musí NA EX dať,
  inak Pitku neskončí; prah Cirhózy je tam zato obom o 2 vyšší (§15). Povinnosť
  splní **jedno** NA EX v Pitke; ďalšie je potom dobrovoľné.
- Efekty okolo NA EX: Kar (pečeň súperovi) a hrozba Kšeftu Vychovávateľky (§7)
  sa uplatnia pri odkrytí; Stryná pri vyhodnotení; Svokra, Pijan a Šofér
  v bitke (Šofér aj cigareta na jej začiatku); Veterán (§16).

### Odkrytie NA EX a Výtržník

Keď skončia obaja, NA EX sa **odkryjú naraz** (v9.2, Michal 2026-10-30) — oba
poldeci ľahnú na karty súčasne. Až teraz sa pripíše pečeň a uplatnia sa efekty okolo
NA EX. Výsledok od poradia nezávisí (zrážka je súmerná, pečeň aj hrozba
Vychovávateľky sa rátajú po hráčoch).

**Zrážka:** ak obaja vybrali **tú istú kartu**, ležia na nej poldeci oboch
a z karty je **Výtržník**. Karta sa najprv spáruje so susedmi s pôvodnými
akciami (susedom aktivuje akcie ako bez zrážky), potom sa **všetky akcie na
jej hranách** zmenia na aktívnu **Ranu** pre jej majiteľa — aj akcie bez
partnera na spoji. NA EX jej nič neruší ani nezdvojuje. **Posilnenie aj Odpor
Výtržníka sú už len Rany** (v6.1, Michal 2026-10-27): suseda nezdvojujú ani
nerušia (ani pri Veteránovi) — sused má spárovanú akciu aktívnu ×1 a Odpor
Výtržníka nevyvolá Vzburu. Každý platí za svoje
NA EX ako vždy: pečeň +1 tomu, kto NA EX dal,
a v bitke sa vypijú oba poldeci (§9.5); Svokra majiteľa
karty ju ráta ako kartu so súperovým NA EX. **Po bitke Výtržník
vytriezvie** — karta má znova pôvodné akcie; Výtržníkom je len počas jednej
bitky.

Príklad (v6.1): karta má na hrane pri susedovi Posilnenie proti jeho Pecke a vedľa
neho Ranu bez partnera. Bez zrážky dá sused Pecku ×2. Keď je z karty Výtržník, jej
Posilnenie aj Rana sú dve aktívne Rany pre jej majiteľa a susedova Pecka platí
len ×1 — Posilnenie, ktoré sa zmenilo na Ranu, už nič nezdvojuje. Rovnako Odpor:
bez zrážky by susedovi Pecku zrušil, Výtržníkov Odpor je Rana pre jeho majiteľa
a susedova Pecka platí ×1.

### Odpoveď na NA EX

Po odkrytí smie hráč za **každé súperovo NA EX** vyložiť **jednu kartu
z ruky** na koniec svojej alebo súperovej strany — **lícom dole, štýlom Záverečnej, ale
zadarmo** (v9.2, Michal 2026-10-30):

1. Najprv **útočník** (na NA EX obrancu) vyloží odpoveď lícom dole na jeden kraj línie.
2. Potom **obranca** (na NA EX útočníka) lícom dole — **len na druhý kraj línie**, než
   kam vyložil útočník. Keď útočník neodpovedal, obranca smie na ktorýkoľvek kraj.
3. Obe odpovede sa **otočia naraz** — až vtedy sa vyhodnotí ich Nástup, Konflikt a Podpora,
   ktoré vyvolali priložením — a Pitka sa vyhodnotí.

Odpoveďou hráč v tejto Pitke končí s vykladaním. Kým odpoveď leží lícom dole, súper
z nej nevidí nič a odhad bitky ju nezarátava (ako Záverečnú, §13). Keď NA EX dali obaja
(aj pri zrážke), odpovedajú obaja. Odpoveď limit vykladania nemíňa; kto nemá kartu,
ktorú smie vyložiť, neodpovedá.

**Výklad (Developer 2026-10-30, na potvrdenie Michalom):** viac súperových NA EX v Pitke
(Vínna pivnica) = viac **kôl odpovedí** — v každom kole najviac jedna odpoveď každého
v poradí útočník, obranca na druhý kraj; kolo sa otočí, potom ďalšie (za kartou lícom dole
sa priložiť nedá). Kto odpoveď vynechá, v tejto Pitke už neodpovedá. Bzdocha skrytú
odpoveď nevidí (týka sa len NA EX). Cieľ: spárovať neaktívne akcie karty s NA EX — tie sa tým stanú
aktívnymi a NA EX ich zruší. Počas odpovede sa nefajčí ani nedáva NA EX.
Odpoveď je bežné vyloženie: smie zmeniť **prevahu v kraji** aj **počet
Pitiek**. Po odpovediach sa Pitka vyhodnotí.

### Fajčenie, doliatie a barter

- **Fajčenie (len v Pitke):** kým hráč svoju časť Pitky neskončil, smie fajčiť — hneď
  si dobere kartu, ťah mu neskončí. **Cena rastie** (Michal 2026-10-27): prvé
  fajčenie hráča v Pitke stojí **1 cigaretu**, druhé **2**, tretie **3** atď.;
  každá Pitka začína znova od 1 a každý hráč má počítadlo zvlášť (je verejné).
  Nie je to strop — fajčiť sa dá stále, len drahšie. Každá vyfajčená cigareta
  je nerest (§8), teda druhé fajčenie 2 neresti. **V Zhromaždení sa nefajčí.** Keď sú doberací aj odhadzovací balíček
  prázdne, **fajčiť sa nedá** — cigareta by nedala kartu. Na Benzínke sa
  nefajčí (§15).
- **Doliatie, 2 cigarety** (počas Pitky) → otoč jeden vypitý poldeci späť na
  plný. S Vínkom v Dedičstve nie (§16).
- **Stokársky barter, 5 cigariet** → nový plný poldeci
  navyše.
- Zadarmo sa jeden vypitý poldeci otočí na začiatku kola (§4).
- Čo po finále ostane, sa vykúpi: plný poldeci 1 špak, každých celých
  5 cigariet 1 špak (výkupné, §14).

### Vyhodnotenie Pitky

Po „hotovo“ oboch hráčov:

1. **NA EX** — odkrytie a odpovede (vyššie).
2. **Dlh** — za **každý celý prah** zadĺženia hráč získa Dlh (počítadlo, §8).
3. **Poškodenie pečene a Cirhóza** — za **každý celý prah** pečene hráč získa
   Cirhózu do odhadzovacieho balíčka (§8).
4. **Obmedzenie**
5. **Cigarety** — hráč dostane cigarety za akcie Cigareta:
   ```
   nové cigarety = Cigarety − súperove Obmedzenia (najmenej 0)
   ```
   Priazeň Fajčiara dáva cigarety po bitke (§10, v9), nie v Pitke.
6. **Ťahanie kariet** — Pitka sama karty nedáva; doberajú sa fajčením,
   Kšeftmi, Víziou a efektmi (Zastávka po prvej Pitke).
7. **Vízia** — za každú aktívnu Víziu sa hráč pozrie na vrchnú kartu svojho
   doberacieho balíčka (keď sa doberací balíček minie, odhadzovací sa
   zamieša a stane sa z neho nový doberací balíček)
   a rozhodne: **do ruky**, alebo **spáliť** (navždy z hry). Rozhoduje obranca,
   potom útočník; vrchnú kartu vidí len
   on.
8. **Otočenie Záverečných** — karty lícom dole sa otočia; ich Nástup
   a Konflikt či Podpora, ktoré priložením vyvolali, sa vyhodnotia teraz (§13).

Násobky akcií sa **násobia**: NA EX zdvojí neaktívnu akciu, Silná žena ju
zdvojí tiež, spolu ×4 (aj pri Dlhu a Poškodení pečene). Klient aj konzolový
klient ukazujú výhľad „po Pitke“ (`nahladPitky` — ten istý výpočet ako
vyhodnotenie, `prirastkyPitky`).

Po vyhodnotení Pitky sa **pečeň oboch hráčov vynuluje** — zvyšok pod prahom
sa do ďalšej Pitky neprenáša. **Zadĺženie sa nenuluje (v7, D6, Michal
2026-10-27):** zvyšok pod prahom ostáva na účte do ďalšej Pitky aj kola.

### Kšeft (v7)

**Kšeft** je spúšťač aktívneho efektu: „Kšeft: Za <cena> <účinok>.“ Hráč ho
spustí sám **v Pitke, kým ju neskončil** (nie počas odpovede na NA EX, nie po
„končím“), **každú kartu raz za Pitku**. Platí karta odkrytá v hráčovej
partii (aj podstrčená k súperovi, nie skrytá Záverečná) a Kšeft lokality — ten smie
použiť **každý hráč**, každý raz za Pitku. Kšeft nie je ťah; platba je verejná.
Účinok „v tejto bitke“ sa pripočíta v bitke kola. Kšeft majú Strýko z Ameriky, Predavačka (v10.4)
a lokality Zberný dvor, Sklad, Obecný úrad a Predsedova vila (§15, §16). Cigarety
za Kšeft karty ani lokality nie sú nerest (od v9.1, §8). Kšeft väzňa (v9) zanikol
v11.2 — väzeň má schopnosť raz za hru (§10).


### Počet Pitiek

Pitiek v kole = **1 + menší z počtov aktivovaných akcií lokality** na jej
dvoch stranách. Akciu lokality aktivuje karta, ktorá s ňou tvorí spoj; ráta sa
každá aktívna akcia hrany (aj Odpor či Posilnenie v páre). **Odpor na hrane
lokality** sa ráta ako jej aktívna akcia; akcia hrany, ktorú zrušil **Odpor
karty** v páre, sa neráta.

Príklad: na jednej strane lokality sú aktivované 3 jej akcie, na druhej 1 →
**2 Pitky**; keď je na niektorej strane 0, kolo má 1 Pitku. Ráta sa **podľa
strán, nie podľa hráčov**: nezáleží na tom, kto kartu zahral (aj podstrčená
karta aktivuje hranu pri strane, kde leží), ani kto má v kraji prevahu. Akcia
hrany zdvojená Posilnením (×2) je stále **jedna** aktivovaná akcia. Pred každou Pitkou je Zhromaždenie
(limit sa ráta nanovo, začína útočník). Počet sa prepočítava s líniou počas
kola (vykladanie, odpoveď, NA EX); už začatá Pitka sa vždy dopije. Lokality
majú na každej strane 1–4 akcie (úroveň), teda 1–5 Pitiek; aj finále na
pinnacle.

---

## 8. Pečeň, zadĺženie, nerest, Chuť a Absťák

Pečeň **žije len v Pitke**: ráta sa počas Pitky, vyhodnotí sa v jej krokoch
2–3 (§7) a po Pitke sa vynuluje. **Zadĺženie (v7, D6)** sa po Pitke nevynuluje:
za každé 2 zadĺženia dostaneš Dlh ako doteraz, zvyšok ostáva na účte do ďalšej
Pitky aj kola. **Milujúca manželka** v línii: tvoje poškodenie pečene v Pitke
je o 1 menšie (za každú).

### Zadĺženie a Dlh

Akcia **Hazard** (kľúč `Dlh`) zvýši zadĺženie o 1. Za **každý celý prah**
zadĺženia hráč získa Dlh:

```
prah Dlhu = 2        (každé 2 zadĺženia = 1 Dlh; zadĺženie 8 = 4 Dlhy)
```

Dlh je od v8.2 (Michal 2026-10-30) **počítadlo priznaných Dlhov**, nie karta:
nový Dlh je hneď priznaný, neťahá sa a nedá sa s ním inak manipulovať — len
ho presúvajú a pália efekty (§11).

### Pečeň a Cirhóza

Poškodenie pečene pridávajú akcie Poškodenie pečene a Poldeci, NA EX (tomu,
kto ho dal, pri odkrytí) a poldeci vypité v predošlom Zhromaždení (Vypiť, §13 — pripíšu sa
do najbližšej Pitky). Za **každý celý prah** pečene hráč získa Cirhózu:

```
prah Cirhózy = 3   (+2 Nealko v Dedičstve, +2 obom v kole o Krčmu)
```

Nová Cirhóza ide do **odhadzovacieho balíčka** hráča (§11).

### Nerest, Chuť a Absťák (v9.1)

Michal 2026-10-30 (docs/napady/abstak-3.html, § Rozhodnutia): Absťák je závislosť
vlastného tela — kto si zvykne, musí pokračovať.

**Nerest je len konzumácia:**

| Čo | Neresti |
|---|---|
| Vypiť v Zhromaždení (poldeci navyše, §13) | 1 |
| **NA EX** (poldeci sa vypije v bitke; každé NA EX hráča, pri zrážke Výtržníka každý za svoje) | **2** |
| vyfajčená cigareta (za každú zaplatenú — druhé fajčenie v Pitke 2 atď.) | 1 |

**Nie sú nerest:** doliatie, barter, šenok, Záverečná, Dedičstvo,
cigarety za Kšefty kariet a lokalít (Strýko z Ameriky, Zberný dvor, Sklad,
Obecný úrad, Predsedova vila), akcie Cigareta a Poldeci.

**Chuť** je verejné počítadlo hráča, na začiatku hry **0**. **Na konci kola**
(po bitke a návrate kariet; po poslednej bitke hry nie),
pre každého hráča:

1. ak mal v kole **menej nerestí, než je jeho Chuť** → dostane **kartu Absťák**
   do svojho **odhadzovacieho balíčka** (rovnosť nič),
2. potom **Chuť = väčšie z (Chuť, neresti kola) − 1**, nie pod 0.

Príklad (Michal): 9 nerestí pri Chuti 0 → Chuť 8; ďalšie kolo 7 nerestí → Absťák
(7 < 8) a Chuť 7. Kto prestane, odvyká postupne — každé kolo Chuť klesne o 1, kým
nie je 0. Súper latku neurčuje (do v9 sa neresti porovnávali so súperom).

**Karta Absťák** (tag Kliatba, všetky sloty blokované, bez akcií):

- **nedá sa priznať** ani vyložiť do línie; po bitke ide **z ruky do odhadzovacieho
  balíčka** (ako nepriznaná Cirhóza, §9.7) — hráč si ju ťahá znova namiesto
  užitočnej karty;
- v bitke **−1 tuhé** hráčovi za každú kartu Absťák **kdekoľvek v jeho balíčku**
  (ruka, doberací, odhadzovací, §9.3); remízu v tuhom prehráva, kto ich má viac (§9.4);
- spáliť ju smie len **Vízia** alebo efekt, ktorý to výslovne povie; Hasič ju
  vytiahne ako každú kartu a hráč ju vráti alebo si ju nechá;
- na konci hry nestojí nič (§14) a Pohoršenie nedáva (Nervák zanikol).

Počet Absťákov oboch hráčov je verejný (karta pribúda pred očami oboch), poloha
karty v ruke a doberacom balíčku nie. Hra si pamätá, koľko Absťákov hráč **získal
za hru** (štatistika); spálením karty toto číslo neklesne. Klient ukazuje Chuť,
neresti kola a výhľad (`stavZavislosti`: „Chuť 3 · dnes 1 · chýba 2“).

**Výučba Prvá hra** je bez Chuti a Absťáku (prepínač partie `bezChuti`) — učí sa
až v 2. časti výučby.

---

## 9. Bitka

Bitka sa vyhodnotí po poslednej Pitke kola, v tomto poradí (v11 Strach a reči):

| Krok | Čo sa deje | Kde |
|---|---|---|
| 0 | Efekty na začiatku bitky (Traktorista, Šofér) | §9.0 |
| 1 | Hádka — Viera a Povery sa vyrušia, mäkké (Pohoršenie × 2 + Povery) rozhodne víťaza hádky a jej veľkosť; priazne sa **nemenia** (rozdelí sa až v kroku 4e); Noviny víťaza hádky (v11.5) | §9.1 |
| 3 | Poškodenie — tuhé; zvyšná Viera, Bitkár, Veriaci a Abstinent podľa priazní z rozdielu strachov | §9.3 |
| 4 | Výsledok (pri remíze Absťáky, potom Dlhy — pred exekúciou —, inak sekera) | §9.4 |
| 4a | Špaky za bitku (karty v línii) víťazovi, vo finále aj Nakladačka a hádka 1 : 1, na Kultúrnom dome aj porazenému; Herňa podľa Dlhov pred exekúciou; lokalita ide na krčmovú nástenku | §9.4, §14 |
| 4b | **Starší bodujú** (stav pred zdvihnutím): víťaz za každého staršieho za svoj najvyšší marker (reči, ak ich má, inak strach), porazený a pri sekere obaja len za reči — žltá 1, oranžová 3, červená 5; reči, ktoré bodovali, klesnú o stupeň | §10, §14 |
| 4c | **Výhra strachom:** víťaz s červeným strachom u aspoň 4 starších (väzni sa rátajú) vyhráva — hra končí | §1, §10 |
| 4d | Exekúcia (Michal 2026-10-28): Robota (aj z priazne Robota, v9), potom Exekútor každému s priznaným Dlhom — Dlhy a špaky (Advokát ich uberie); Záhradkár ju obíde | §11 |
| 4e | **Nakladačka** — víťaz bitky ju rozdelí na svoj strach a smie **zajímať** (5 bodov za staršieho na červenom strachu už pred touto Nakladačkou, v11.6; väzeň, krádež, výhra väzňami hneď); potom **hádka** — víťaz hádky ju rozdelí na svoje reči a smie **presviedčať** (5 bodov, v11.4) — voľne medzi starších, 1 / 2 / 3 za stupeň, zvyšok prepadne; vo finále sa nerozdeľujú — špaky 1 : 1 dostali v kroku 4a | §9.1, §9.4, §10 |
| 5 | Poldeci (aj Na zdravie „do dna“) | §9.5 |
| 5b | Veštica | §9.5b |
| 6 | Cintorín (Nástroj do Dedičstva porazenému) | §15 |
| 6c | **Porazený dostane 1 cigaretu** (pri sekere a po finále nikto), priazne Kmotra (Dlhy súperovi) a Fajčiara (cigarety, v9), efekty Výhra a Prehra (Recidivista, Dievčina), Krokodíl | §9.4, §10, §16 |

| 7 | Návrat kariet; nepriznaná Cirhóza a Absťák z ruky do odhadzovacieho balíčka | §9.7 |
| 8 | Koniec kola: Chuť a Absťák (v9.1) | §4, §8 |

### 9.0 Efekty na začiatku bitky

Traktorista bez prevahy (Dlh) (§16; v sade v53 sa karta volá Traktorista, predtým Traktoristka).
Šofér bez NA EX v kole: majiteľ dostane 1 cigaretu za každého Šoféra (v11.5; Pecka navyše sa ráta
v poškodení, §16).

### 9.1 Hádka (v10, v11)

Michal 2026-11-01 (docs/napady/hadka.html, verzia 4) a 2026-11-02 (v11 Strach a reči,
docs/napady/strach-reci.html). Poškodenie je **tuhé** (Rana, Pecka, Petelica) a **mäkké**
(Pohoršenie, Povera). Popri bitke sa hrá **hádka** len na mäkké. Od v11 **priazne nemení** —
víťaz hádky ju po výsledku bitky rozdelí na **svoje reči** (§10).

```
1. Viera a Povery sa vyrušia 1 : 1 na kusy
     zrušené_Povery[súper] = min(Povery[súper], Viera[ja])
       Viera[ja] = moje aktívne Viery + Viera navyše z Veriaceho
       jedna akcia Viera zruší jednu akciu Povera — aj vylepšenú Horoskopom (sila 2);
       Svätý text rušenie nemení, hodnota Viery platí len v tlmení tuhého (Michal 2026-11-01)
     Viera, ktorá rušila Povery, sa na tuhé nepoužije
     Čierna mačka: majiteľove Povery sa s Vierou nerušia

2. mäkké[ja] = Pohoršenie × 2 + zvyšné_Povery × sila_Povery
     sila_Povery = 1, s Horoskopom v Dedičstve 2
     Viera proti Pohoršeniu nepomáha; žiadna priazeň mäkké nepridáva

3. víťaz hádky = vyššie mäkké; rovnosť = nikto (remíza, reči nikto nedvíha)
   hádka = |rozdiel mäkkého|          „Ana vyhrala hádku o 3.“

4. (krok 4e, po bodovaní starších) víťaz hádky rozdelí hádku na svoje reči
```

**Noviny** (Dedičstvo: Hádka, v11.5): hneď ako sa hádka rozhodne (krok 1), porazený v hádke odhodí za
každé Noviny v Dedičstve víťaza hádky 1 náhodnú kartu z ruky (§16).

**Mäkké 2 a 1** (H3, pravidlo Michala): akcia, ktorej je v sade menej, dáva 2 mäkké, tá, ktorej
je viac, 1. V sade v53 je Povier viac (25 na bežných kartách, so staršími 28) ako Pohoršení (20,
so staršími 23), preto **Pohoršenie = 2, Povera = 1** (`KONSTANTY.HADKA`). Ak sa pomer akcií
v sade zmení, treba to prepočítať.

**Rozdelenie hádky na reči (krok 4e)** — rovnako ako Nakladačka na strach (§9.4), len na reči:
víťaz hádky rozdelí jej body **ľubovoľne medzi starších**; stupeň stojí **do žltej 1, do oranžovej 2,
do červenej 3**. Reči sú vždy **nad tvojím strachom** — prvé reči pri staršom s oranžovým strachom
idú rovno na červenú za 3, pri červenom strachu sa reči nedajú. Rozdelí sa, čo sa dá; **zvyšok
prepadne**, aj keď hráč nemá kam dvíhať vôbec (rozhodnuté 2026-11-02). Pri rozdelení smie víťaz hádky
za 5 bodov **presvedčiť** staršieho, pri ktorom má súper vyšší strach a jeho reči sú na červenej (v11.4,
§10 Presvedčenie). Porazený v hádke nerozdeľuje nič. **Vo finále** sa reči nedvíhajú ani nepresviedča:
víťaz hádky dostane za každý jej bod **1 špak** (krok 4a). Rozdelenie je verejné; potvrdí sa jedným
ťahom.

**Veriaci:** Viera navyše z jeho priazne ruší Povery aj tlmí tuhé — tou istou silou (do v10
sa delila na silu pred hádkou a po nej).

**Príklad (Ana a Boris):** Ana aktivovala 2 Pohoršenia a 2 Povery, Boris 1 Pohoršenie, 1 Poveru
a 1 Vieru. Borisova Viera zruší jednu Aninu Poveru. Ana: 2 × 2 + 1 = **5 mäkké**, Boris
(Ana Vieru nemá): 1 × 2 + 1 = **3 mäkké**. Ana vyhrala hádku o 2 — po bitke dá napríklad reči
na žltú dvom starším, pri ktorých má strach 0 (1 + 1), alebo jednému staršiemu so žltým strachom
reči rovno na oranžovú (2).

### 9.3 Poškodenie

```
1. zvyšná_viera[ja] = moja Viera (s Veriacim) − Viera minutá na Povery (§9.1),  minimum 0

2. tuhé[ja] = (Rana×1 + Pecka×2 + Petelica×3 + súperove priznané Cirhózy + sila Bitkára)
             − zvyšná_viera[súper] × hodnota_viery(súper)
             − max(0, počet_mojich_absťákov − sila_Abstinenta)   (Absťáky v ruke, doberacom aj odhadzovacom balíčku, v9.1; Abstinent v10)
     minimum 0

Bitkár, Veriaci a Abstinent pôsobia silou z rozdielu strachov (§10; hádka ju od v11 nemení). Mäkké do tuhého nevstupuje —
rozhoduje len hádku; celkové poškodenie = tuhé (archív).
```

**Priznaná Cirhóza škodí tomu, kto ju priznal:** za každú priznanú Cirhózu
hráča dostane súper v každej bitke +1 tuhé (Veterinár to znižuje). Ráta sa ako
tuhé, takže ju zvyšná Viera tiež znižuje. Priazeň Bitkára pridá tuhé rovné
sile (+1 / +2 / +3), priazeň Veriaceho Vieru navyše
(§10). **Viera proti Pohoršeniu nepomáha** (v10). Tuhé ďalej menia efekty
kariet a lokalít (Pes, Pijan, Svokra, Pasca, Lesná cesta, Ihrisko…, §15, §16).

### 9.4 Výsledok

```
víťaz          = vyššie TUHÉ poškodenie
  remíza v tuhom: vyhrá, kto má MENEJ ABSŤÁKOV (kariet v balíčku, práve teraz; znížené o silu Abstinenta, min 0 — v10)
  aj tu rovnosť:  vyhrá, kto má MENEJ PRIZNANÝCH DLHOV
  aj tu rovnosť:  nevyhrá nikto — SEKERA
Nakladačku drží  = víťaz (vyššie TUHÉ; v8.3)
Nakladačka       = |rozdiel tuhého|        (pri remíze v tuhom ju nikto nezíska, aj keď rozhodnú Absťáky či Dlhy)
```

**Špaky za bitku (krok 4a, v8, Michal 2026-10-28):** víťaz dostane **1 špak za
každú kartu, ktorá v čase bitky leží v línii** pri lokalite — na oboch stranách,
jeho aj súperove, aj odkrytá Záverečná, aj vo finále. Nerátajú sa priznané karty
(kliatby), Dedičstvo, lokalita ani karty, ktoré z línie počas kola zmizli
(spálené efektom — Poľovník, Krokodíl, Dievčina). Počet Pitiek špaky neurčuje.
Víťaz dostane **vždy aspoň 1 špak**. Absťáky špaky **neuberajú** (trestajú ranou
menej, §8). Vo finále víťaz dostane navyše **1 špak za každý bod Nakladačky** (v9.1,
nižšie). Na Kultúrnom dome dostane aj
porazený 1 špak za každú svoju kartu v línii (§15). Víťaz si **lokalitu neberie** —
karta lokality ide na **krčmovú nástenku** s jeho menom a počtom špakov.

**Sekera:** keď nerozhodne ani tuhé, ani Absťáky, ani Dlhy, bitku nevyhrá nikto
a špaky kola (karty v línii) **čakajú na sekere** — vezme ich víťaz najbližšej
bitky navyše k svojim; viac sekier po sebe sa kopí.
**Vo finále** špaky zo sekery **prepadnú**. Pri sekere starší bodujú obom len za reči (krok 4b),
Nakladačka nie je a **cigaretu nedostane nikto** (nikto neprehral; rozhodnuté 2026-11-02). Sekera
nemení roly (útočník ostáva útočníkom); bez Nakladačky sa nezajíma (§10).

**Nakladačka (krok 4e, v11 Strach a reči, Michal 2026-11-02):**

1. **Kto ju drží a rozdeľuje:** víťaz — hráč s vyšším tuhým poškodením. Nakladačka =
   rozdiel tuhého. Pri remíze v tuhom Nakladačka nie je, aj keď bitku rozhodnú
   Absťáky či Dlhy. Do v10 ju rozdeľoval porazený.
2. **Na čo:** na **svoj strach** — ľubovoľne medzi starších; stupeň stojí **do žltej 1,
   do oranžovej 2, do červenej 3** (zo sivej na červenú 6, zo žltej na červenú 2 + 3 = 5).
   Vyšší strach ti dáva body v ďalších vyhratých bitkách a cestu k výhre strachom, ale
   **súperovi priazeň** (§10). Keď strach dorastie na stupeň tvojich rečí, reči zaniknú.
3. **Rozdelí sa, čo sa dá:** rozdelenie musí byť úplné — nesmie ostať zvyšok, ktorý by ešte
   stačil na ďalší stupeň niektorého staršieho. **Zvyšok prepadne**, aj keď hráč nemá kam
   dvíhať vôbec (všetky jeho strachy na červenej; rozhodnuté 2026-11-02 — nejde na špaky).
   Nie je to strop zdroja — Nakladačka sa neprenáša.
4. **Kedy:** až **po bodovaní starších, výhre strachom a exekúcii** (kroky 4b–4d) — nový strach
   boduje až v ďalšej bitke.
5. Rozdelenie (Nakladačka aj hádka) je **jeden ťah**: pri ktorom staršom na ktorý stupeň a koho
   zajímaš (Nakladačka) či presviedčaš (hádka).
6. **Zajatie** (v11.4, v11.6, §10): za **5 bodov** Nakladačky smie víťaz zajať staršieho, pri ktorom má
   strach na červenej **už pred touto Nakladačkou** (od minulého kola) — strach dotiahnutý na červenú
   v tom istom rozdelení nestačí. Dobrovoľné, viac naraz smie byť; do „rozdelí sa, čo sa dá“ sa nerátajú. Keď Nakladačka inak nemá kam, ale zajať sa dá, bitka na rozhodnutie počká.

**Nakladačka vo finále → špaky 1 : 1** (v9.1): markery sa vo finále nedvíhajú — **víťaz finále
dostane za každý bod Nakladačky 1 špak** spolu so špakmi za bitku (krok 4a). Pri sekere vo finále
Nakladačka nie je.

**Cigareta porazenému** (v11, krok 6c): porazený dostane po bitke **1 cigaretu**; pri sekere
nikto a **po finále nikto** (Michal 2026-11-02). Do v10 dostal cigaretu za každého staršieho, ktorého mu posunula Nakladačka.

> Napätie hry: každý stupeň tvojho strachu ti v každej vyhratej bitke boduje, ale súperovi dáva
> priazeň (rozdiel strachov). Reči bodujú aj pri prehre, priazeň nedávajú, no slabnú.

### 9.5 Poldeci

Poldeci ležiace na kartách cez NA EX sa teraz **vypijú** — každý tomu, kto NA EX
dal (na Výtržníkovi oba, každému jeho). Za každú aktívnu akciu Poldeci sa
jeden vypitý poldeci otočí späť na plný. Ak hráč nemá žiadny vypitý poldeci,
akcia vyjde naprázdno. Týka sa **majiteľa karty**, nech leží na ktorejkoľvek
strane.

**Na zdravie „do dna“** (priazeň Alkoholika, §10): z poldeci, ktoré hráč
v kole položil cez NA EX, sa mu toľko, aká je sila priazne, vráti **plných**
namiesto vypitých. Nerest sa ráta ako vždy.

### 9.5b Veštica

Porazený s Vešticou vo svojej partii si prezrie oba doberacie balíčky,
vymení jednu svoju kartu za súperovu a oba balíčky sa zamiešajú (§16).
Ak je doberací balíček niektorého hráča prázdny, najprv sa doň zamieša jeho
odhadzovací, ako pri ťahaní (§4). Keď niektorý hráč nemá ani doberací, ani
odhadzovací balíček, Veštica sa nespustí.

### 9.7 Návrat kariet

Všetky karty z oboch partií sa vrátia do odhadzovacieho balíčka **hráča, ktorý
ich zahral** (pri otočených kartách to určuje orientácia). Karty spálené
v bitke (Dievčina na vydaj, Krokodíl) sa nevracajú. Lokalita ostáva na nástenke.

**Nepriznaná Cirhóza** a **Absťák** (v9.1), ktoré má hráč po bitke v ruke, idú
do jeho odhadzovacieho balíčka (§8, §11). Karta, ktorú si dobere až na začiatku
ďalšieho kola, mu ostáva v ruke do konca toho kola.

---

## 10. Starší

**Starší** sedia v rade pri stole — 8 ukazovateľov s kartou staršieho na scorecarde. Od v11
(Strach a reči, Michal 2026-11-02, docs/napady/strach-reci.html) má **každý hráč pri každom
staršom dva vlastné markery** na stupnici **0–3**: sivá (0), žltá (1), oranžová (2), červená (3).
Markery sú verejné.

### Strach a reči

- **Strach** (0–3) — ako veľmi sa starší bojí teba. **Neklesá** (v11.4 bez výnimky — neúspešný pokus
  o zajatie zanikol). Dvíha ho **Nakladačka** víťaza bitky (§9.4).
- **Reči** — nič, alebo stupeň **nad tvojím strachom** (strach 0 → reči 1–3, strach 1 → 2–3,
  strach 2 → 3, strach 3 → reči nie). Dvíha ich **hádka** víťaza hádky (§9.1) a Kšeft
  Predsedovej vily. Po bodovaní klesnú o stupeň; keď by klesli na stupeň strachu (alebo pod sivú),
  **zaniknú**. Keď tvoj strach dorastie na stupeň tvojich rečí, reči zaniknú (vieš to dopredu,
  dvíhaš sám). Reči nedávajú priazeň ani strach, nerátajú sa do výhry strachom ani do podmienky
  zajatia.
- **Cena stupňa** (Nakladačka aj hádka): vstup do žltej **1**, do oranžovej **2**, do červenej **3**
  (`KONSTANTY.CENA_STUPNA`). Rozdeľuje sa voľne medzi starších; zvyšok, ktorý na žiadny stupeň
  nestačí, prepadne.
- **Jedna stupnica** (Michal 2026-11-02): strach a reči hráča plnia **tú istú stupnicu** 0–3 pri
  staršom — strach zdola, reči nad vlastným strachom (na stole plná a šrafovaná časť jedného
  teplomera).
- **Stupeň staršieho pre hráča** — **pokojný (0), znepokojený (1), vystrašený (2), vydesený (3)** — je
  **vrchol** jeho stupnice, teda **strach + reči** (reči, ak ich má, inak strach; Michal 2026-11-02).
  Ten istý stupeň hovorí, za koľko špakov starší boduje víťazovi (krok 4b nižšie). Do **priazne**,
  **výhry strachom** a **podmienky zajatia** sa rátajú **len strach** — reči nie.


### Priazeň

**Priazeň pre teba = max(0, strach súpera − tvoj strach)** — starší, ktorý sa súpera bojí viac
než teba, ti pomáha. Reči sa nerátajú. Pri rovnakom strachu (aj obaja na červenej) priazeň nedáva
nikto (antipriazeň zatiaľ nie, Michal 2026-11-02). Priazeň pôsobí **silou** 1 / 2 / 3. Priazeň
staršieho určuje scorecard, na ktorom leží (rozdáva sa náhodne, §3; názov scorecardu = priazeň).
Väzeň priazeň nedáva — jeho scorecard je otočený.

| Priazeň | Uplatňuje sa pri | Účinok | sila 1 / 2 / 3 | Kľúč v dátach |
|---|---|---|---|---|
| Bitkár | Poškodenie v bitke (§9.3) | tuhé poškodenie navyše | +1 / +2 / +3 | `BITKAR` |
| Veriaci | Viera v bitke (§9.1, §9.3) | Viera navyše (hodnota 1); ruší Povery aj tlmí tuhé | +1 / +2 / +3 | `VERIACI` |
| Abstinent (v10) | Poškodenie a remíza v bitke (§9.3, §9.4) | v bitke sa ti neráta toľko Absťákov — tuhé za ne neklesne, nerátajú sa pri remíze v tuhom; karty ostávajú, Chuť a koniec kola bez zmeny | 1 / 2 / 3 Absťáky | `LAKOMEC` |
| Advokát (v9) | Exekúcia (§11, krok 4d) | exekúcia ti odpočíta o toľko špakov menej (najmenej 0); Dlhy zhoria ako doteraz (polovica nahor) | −1 / −2 / −3 špaky | `ADVOKAT` |
| Robota (v9) | Exekúcia, pred Exekútorom (§11) | akcie Robota navyše: každá spáli 1 tvoj priznaný Dlh; za Dlh, ktorý nemá čo spáliť, 1 špak (O5) | 1 / 2 / 3 Roboty | `ROBOTA` |
| Fajčiar (v9) | Po bitke (§9, krok 6c) | cigarety navyše; Obmedzenie ich neuberá | +1 / +2 / +3 | `FAJCIAR` |
| Kmotor (v9) | Po bitke (§9, krok 6c) | tvoje priznané Dlhy prejdú medzi súperove; ak ich máš menej, presunie, koľko máš; bez Dlhu nič | 2 / 3 / 4 Dlhy | `UZERNIK` |
| Alkoholik — Na zdravie „do dna“ | Poldeci v bitke (§9.5) | poldeci z tvojho NA EX sa vráti plný | 1 / 2 / 3 za kolo | `ALKOHOLIK` |

Exekútor a Výpalník ako priazne zanikli (v9; akcia exekúcie v §11 ostáva). Staré
sady a databázy ich ešte nesú — pri načítaní je Exekútor (`EXEKUTOR`) Advokát
a Výpalník (`VYPALNIK`, `NEPRAJNIK`) Robota; Kmotor je `UZERNIK` (aj Zberateľ,
Očumovateľ), Abstinent `LAKOMEC`.

Efekty kariet uvádzajú pevné čísla — číslo nezávisí od iného staršieho. Čísla sú
v kóde v `KONSTANTY` (`KONSTANTY.EFEKT`).

### Bodovanie po bitke (krok 4b)

Po každej bitke (aj vo finále) dá každý starší špaky — **podľa stavu pred zdvihnutím**
Nakladačkou a hádkou: **víťaz** za svoj **najvyšší marker** (reči, ak ich má, inak strach),
**porazený** a **pri sekere obaja** len za **reči**. Žltá **1**, oranžová **3**, červená **5**
(`KONSTANTY.SPAKY_ZA_STUPEN`). Reči, ktoré bodovali, potom klesnú o stupeň (na stupni strachu
zaniknú). Väzeň nebojuje — na stupnici nie je.

### Výhra strachom (krok 4c)

Kto **vyhrá bitku** a po bodovaní má **červený strach aspoň u 4 starších**
(`KONSTANTY.CERVENYCH_NA_VYHRU`), vyhráva hneď — ešte pred exekúciou. **Väzeň sa ráta ako
červená svojho držiteľa.** Porazený so štyrmi červenými nevyhráva.

### Zajatie a väzeň (v9, v11, v11.4)

Nahradilo patronát a vydesenie ako výhru (Michal 2026-10-30); v11 podmienka, krádež
a väzni podľa ligy (Michal 2026-11-02); v11.4 zajatie pri rozdelení Nakladačky (Michal 2026-11-03).
Pokus o zajatie v drafte (v9–v11.3) zanikol aj s cigaretou, kartou zadarmo a ohrozením.

Michal 2026-11-03: „Zajímanie bude prebiehať pri prerozdeľovaní nakladačky/rečí z hádky - Hráč okamžite
zajme staršieho, ak sa počas nakladačky nachádzal na najvyššej hodnote strachu u toho hráča a udelí mu
nakladačku aspoň za 5, zvyšok udeľuje ostatným starším ... Starší je u neho v pivnici, počíta sa ako
vydesený a funguje jeho jednorazový efekt raz za hru.“ „Cena zajímania v cigaretách zaniká.“

**Kedy a kto.** Pri rozdelení Nakladačky (krok 4e, §9.4) — teda len víťaz bitky, ktorý ju drží.
Vo finále nie (Nakladačka ide na špaky 1 : 1, §14b); pri sekere Nakladačka nie je.

**Podmienka a cena.** **Tvoj strach** pri staršom je **3** (červená) **už pred touto Nakladačkou** —
teda od minulého kola, lebo strach dvíha len Nakladačka a tá je raz za kolo (v11.6). Strach dotiahnutý
na červenú v tom istom rozdelení nestačí; zajať ho smieš až pri ďalšej Nakladačke, ak tam vydrží.
Súperov strach nerozhoduje. Zajatie stojí **5 bodov** Nakladačky (`KONSTANTY.CENA_ZAJATIA`).

**V hre** (v11.6): pri tvojom rozdelení Nakladačky sa na staršom, ktorého zajať smieš a na ktorého ti
body stačia, ukáže pečiatka **ZAJAŤ −5**; klik ju potvrdí (**ZAJATÝ**), ďalší klik ju vráti. Inak
pečiatka na stole nie je.

Michal 2026-11-03 (v11.6): „Tieto buttony zajatia sú na hovno. Chcem, aby zajatie bolo zobrazené až keď má
starší na sebe strach v červenej hodnote teplomera. Potom sa cez neho zobrazí pečiatka ZAJAŤ. Na ňu môže
hráč kliknúť a to bude fungovať ako tieto tlačidlá, ktoré sú v hre teraz ... Zajať sa však NEDÁ v kole,
kedy starší ešte nemal červený teplomer na stupnici u hráča, ktorý staršieho chce zajať. Na zajatie
treba, aby starší bol na červenej predchádzajúce kolo A NÁSLEDNE ďalšie kolo ho môže hráč zajať. Nie je
možný scenár, že napríklad starší je na žltej a hráč ho hneď vytlačí hore a hneď aj zajme v tom istom
kole.“

**Dobrovoľné, aj viac naraz.** Zajať nemusíš; „rozdelí sa, čo sa dá“ (§9.4) sa na zajatie nevzťahuje.
Za každých 5 bodov smieš zajať ďalšieho staršieho na červenej. Zvyšok Nakladačky sa rozdelí ďalej podľa
§9.4; čo nikam nestačí, prepadne. Zajatie je súčasť jedného ťahu rozdelenia. Keď Nakladačka inak nemá
kam (všetky tvoje strachy na červenej), ale zajať sa dá, bitka na tvoje rozhodnutie počká.

**Následky (hneď).** Starší ide do priznaných kariet zajímajúceho ako **väzeň**, scorecard sa otočí,
zo stupnice zmiznú **markery oboch**; **krádež:** súper ti odovzdá špaky za svoj **najvyšší marker**
pri tom staršom **v čase zajatia** — po bodovaní (krok 4b), keď reči už klesli (výklad Leadera, na
potvrdenie Michalom) — žltá 1, oranžová 3, červená 5, **najviac toľko, koľko má**. Výhra väzňami sa
overí hneď po rozdelení. Presvedčeného staršieho (nižšie) smú zajať obaja.

**Väzeň.** Leží v priznaných kartách držiteľa („v pivnici“). Nedáva priazeň, nie je cieľom
Nakladačky ani hádky, nikto ho nevyslobodí. **Ráta sa ako červená** držiteľa (výhra strachom).
Držiteľ má jeho **schopnosť** (nižšie). Nie je karta v línii (špaky za bitku nie), nie je kliatba
(Exekútor nie), do výkupného sa neráta a po finále špaky nedáva (8 / 6 / 4 / 2 zaniklo v11).

**Výhra väzňami.** Kto po zajatí (krok 4e) má **väzňov aspoň (lokality + finále) / 2** —
**Tretia liga 2, Druhá 3, Prvá 4** (`vazniNaVyhru`) —, vyhráva hneď. Vo finále sa nezajíma.

**Schopnosť väzňa (v11.2, Michal 2026-11-02).** Každý zajatý starší má schopnosť (znenie doslova,
`elders.json`). Hráč, ktorý ho má v pivnici, ju smie použiť **raz za hru, kedy chce**:

- **Kedy:** vo **svojom ťahu** — pri braní zo šenku (je na rade), v Zhromaždení (je na ťahu
  a nepasoval) alebo v Pitke (kým ju neskončil; nie pri odpovedi na NA EX ani pri Vízii) —, aj
  vo finále. Nie je to ťah a nič nestojí; ťah ostáva hráčovi.
- **Nie naprázdno:** schopnosť, ktorá by teraz nemala účinok, sa neponúkne (dôvod v tabuľke).
- **Po použití** je schopnosť **minutá** (verejná značka „použitá“). Starší **ostáva v pivnici**,
  ráta sa ďalej ako červená držiteľa a do väzňov na výhru.
- Každé použitie oznámi stôl obom pečiatkou (moment „schopnosť väzňa“, mimo stropu pečiatok).

| Starší | Schopnosť (doslova) | Kedy má účinok, spresnenie |
|---|---|---|
| Poštárka | Dostaneš 4 cigarety. | vždy |
| Krčmárka | Nový plný poldeci. | vždy; poldeci navyše **natrvalo** (ako Stokársky barter) |
| Farár | Odstráň jedno súperovo NA EX z karty. Jeho poldeci ostáva vypitý. | keď na niektorej karte leží súperovo (odkryté) NA EX — v Pitke aj v Zhromaždení ďalšej Pitky; súperovi sa poldeci odpíše ako vypitý (nerest NA EX ostáva, ako pri spálenej karte). Pri zrážke (Výtržník) ostane NA EX držiteľa a karta prestane byť Výtržníkom. |
| Starosta | Do konca kola sú všetky aktívne akcie lokality posilnené. | keď je cieľom lokalita a v tomto kole ešte neplatí; **od použitia do konca kola** ×2 podľa Posilnenia (§6) na obe hrany (aj súperovu), násobí sa s ostatnými násobkami (Forsáž, NA EX). Platí pre **všetky** aktívne akcie hrán — v bitke aj v každej ďalšej Pitke kola (Hazard, Poškodenie pečene, Poldeci, Cigareta, Vízia, Obmedzenie); Pitky vyhodnotené pred použitím sa nemenia. Počet Pitiek nemení (posilnená akcia je stále jedna). |
| Veterinár | Odhoď všetky priznané Cirhózy a Cirhózy na ruke. | keď má Cirhózu na ruke či priznanú; odhodiť = do odhadzovacieho balíčka (§17) |
| Vychovávateľka | Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety. | len v Zhromaždení, vo svojom ťahu, keď súper ešte nepasoval: pas súpera je **vynútený** — v tomto Zhromaždení už nevyloží žiadnu kartu, aj keď ju držiteľ použije hneď prvým ťahom, a cigarety za pas nedostane; držiteľ vykladá ďalej. Ďalšie Zhromaždenie (ďalšia Pitka) je bežné. |
| Autobusár | Zo šenku berieš kariet, koľko chceš, každú za jednu cigaretu; keď skončíš, môže pokračovať súper. | len pri braní zo šenku, keď je šenok neprázdny a hráč má cigaretu; jedným rozhodnutím vyberie karty (každá 1 cigareta, bez stropu 1–2 kariet a bez obmedzenia prvého ťahu obrancu), potom s braním končí a súper berie ďalej podľa §5 |
| Hrobár | Vezmi si do ruky 1 kartu zo súperovho odhadzovacieho balíčka. | keď súperov odhadzovací balíček nie je prázdny (je verejný); karta odteraz patrí novému majiteľovi (ako Sklad) |

Hra, ktorá za hráča urobí jediný možný ťah (pas, koniec Pitky, koniec brania), naňho pre
nepoužitú schopnosť nečaká.

**Šenok.** N = 8 vždy (§5), väzni ho nezmenšujú.

**2 na 2.** Zajíma a presviedča ten, kto Nakladačku či hádku rozdeľuje (paragraf 2 na 2 doplní, ktorý
hráč tímu a do čej ruky ide karta presvedčeného).

### Presvedčenie (v11.4)

Michal 2026-11-03: „Nová mechanika - presvedčenie - Funguje podobne ako zajatie akurát pri rozdelení
nadbytočných rečí. Hráč môže presvedčiť staršieho, aby sa pridal na jeho stranu ... nepôjde do pivnice ale
do hráčovej ruky. Nebude platiť jeho jednorazový efekt, keďže nie je zajatý. … na presvedčenie treba 5 rečí
… Presvedčeného staršieho je stále možné zajať, jeho priazeň stále funguje.“ „Staršieho možno presvedčiť
LEN ak má súper vyššiu hodnotu strachu ako ja. … markery strachu ostanú na staršom.“

- **Kedy a kto:** pri rozdelení hádky (krok 4e, §9.1) — len víťaz hádky. Vo finále nie.
- **Podmienka:** pri staršom má **súper vyšší strach ako ty** (starší ti dáva priazeň) a tvoje **reči sú
  na červenej** (vrchol stupnice). Smieš ich tam dotiahnuť v tom istom rozdelení za bežnú cenu — na rozdiel
  od zajatia (v11.6), lebo reči po bodovaní vždy klesnú o stupeň.
- **Cena:** **5 bodov** hádky (`KONSTANTY.CENA_PRESVEDCENIA`). Dobrovoľné, viac naraz smie byť; do „rozdelí
  sa, čo sa dá“ sa nerátajú.
- **V hre** (v11.6): pri tvojom rozdelení hádky sa na staršom, ktorého presvedčiť smieš a na ktorého ti body
  stačia, ukáže pečiatka **PRESVEDČIŤ** s celou cenou (s dotiahnutím rečí, napr. −8); klik ju potvrdí
  (**PRESVEDČENÝ**) a reči dotiahne, ďalší klik ju vráti.
- **Príklad (Michal):** súper strach 3, ty strach 2, hádka 10 → reči na červenú za 3 + presvedčenie 5,
  2 body inam.
- **Následky:** tvoje **reči pri staršom zaniknú, strach oboch ostáva**. Starší ostáva na ukazovateli:
  **priazeň funguje ďalej**, boduje ďalej (krok 4b), dvíha sa naň strach aj reči.
- **Karta staršieho** (boss) ide **presvedčovateľovi do ruky** a **natrvalo patrí do jeho balíčka**: hrá sa ako
  ktorákoľvek karta — len akcie, bez efektu, tag Starešina (ráta sa do prevahy, dá sa naň NA EX); po bitke
  ide do jeho odhadzovacieho balíčka a ťahá sa znova. **Schopnosť väzňa** pri presvedčenom neplatí.
- **Kto prvý presvedčí, toho je** — presvedčeného už nikto nepresvedčí (ani znova ten istý hráč).
- **Zajatie presvedčeného:** zajať ho smú **obaja**, každý za podmienok zajatia. Jeho karta zmizne odkiaľkoľvek
  (ruka, doberací či odhadzovací balíček; z línie sa po bitke nevráti) a ide do pivnice zajímajúceho;
  presvedčenie zanikne.
- **Nezničiteľný** (výklad Leadera, na potvrdenie Michalom): efekt, ktorý by kartu presvedčeného spálil (Vízia,
  Krištáľová guľa; Krokodíl, Dievčina ani Poľovník ju podľa tagov nezasiahnu), ju pošle do odhadzovacieho
  balíčka majiteľa; efekty, ktoré menia majiteľa karty — Sklad (vezme vrchnú inú kartu), Hrobár, Veštica,
  Snúbenica zo starých sád —, ju preskočia.
- **Skryté informácie:** kto koho presvedčil, je verejné (značka pri staršom). Kde karta práve je (ruka,
  doberací balíček), je skryté ako pri každej karte; odhadzovací balíček je verejný ako vždy.

**Výklady Developera (2026-10-30, 2026-11-02 a 2026-11-03, zadanie ich neurčilo — na potvrdenie Michalom):**

- Priazeň **Robota** sú akcie Robota, takže na ne platí aj Fúrik (o 1 Dlh viac za kus).
- **Zajatie a presvedčenie v jednom rozdelení:** najprv sa vyhodnotia zdvihy, potom akcie. Starší, ktorého
  hráč zajíma či presviedča, je na červenej (zajímaný už pred rozdelením, v11.6) — „rozdelí sa, čo sa dá“
  ho pri zvyšku nevyžaduje (po presvedčení na neho zvyšok tých istých bodov nejde, hoci reči zanikli).

---

## 11. Kliatby, priznanie, Exekútor

### Kliatby

| Karta | Vzniká | Účinok |
|---|---|---|
| **Dlh** | za každý celý prah zadĺženia (§8) a priamo z efektov kariet — **hneď priznaný**; od v8.2 **počítadlo**, nie karta | za priznané Dlhy príde v každej bitke Exekútor (zhorí polovica nahor a rovnako špakov, §11); pri remíze v bitke prehráva, kto má viac priznaných Dlhov (§9.4) |
| **Cirhóza** | za každý celý prah poškodenia pečene (§8) — ide do **odhadzovacieho balíčka** | nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí **3 špaky** za kus (v8, §14); priznaná dá súperovi v každej bitke +1 tuhé (§9.3) |
| **Absťák** | na konci kola, keď hráč v kole skonzumuje **menej nerestí, než je jeho Chuť** (§8, v9.1) — **karta** do odhadzovacieho balíčka | **nedá sa priznať**; po bitke ide z ruky do odhadzovacieho balíčka; v bitke **−1 tvoje tuhé** za každú kartu kdekoľvek v balíčku (§9.3); remízu v bitke prehráva, kto má viac Absťákov (§9.4); spáli ju Vízia; na konci hry nestojí nič |

**Verejný dlh:** nový **Dlh je hneď priznaný** — od v8.2 je to len počítadlo
priznaných Dlhov (Michal 2026-10-30), do balíčka ani do ruky sa nedostane
a kartu zaň hráč nedobere. Nový **Absťák** (v9.1) je karta, ktorá ide do
**odhadzovacieho balíčka** a ostáva v balíčku, kým ju nespáli Vízia. Nová **Cirhóza** ide
do **odhadzovacieho balíčka** — do ruky príde, až keď sa doberací balíček
minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Potom
ju hráč prizná, keď chce, alebo ju podrží (Vízia ju môže spáliť, rovnako Absťák).

**Nepriznaná Cirhóza po bitke do odhadzovacieho balíčka:** Cirhóza, ktorú má
hráč po bitke v ruke a nepriznal ju, ide do jeho odhadzovacieho balíčka
(§9.7). Hráč sa teda rozhoduje: prizná ju hneď (súper dostane +1 tuhé v každej
bitke), alebo riskuje, že sa mu do konca hry nevráti do ruky a na konci ho
bude stáť 3 špaky (§14). Kým ju nepriznal, súper za ňu tuhé nedostáva.

Na konci hry sa nepriznané Cirhózy rátajú v ruke aj v oboch balíčkoch.

**Verejný počet kliatob:** hráč vidí, koľko nepriznaných Cirhóz má súper
(každý vznik, priznanie aj spálenie je vo verejnom logu), počítadlá Dlhov
a počet kariet Absťák oboch (v9.1); súperove špaky na konci hry sú teda presné.
Ktoré karty a kde ležia, sa neposiela.

### Priznanie

Kartu s tagom Kliatba možno **priznať** — vyložiť mimo línie do vlastnej
hracej oblasti. **Kliatba do línie nepatrí**, dá sa len priznať. V sade v53 sa dá
priznať len **Cirhóza** (Dlh vzniká priznaný, Absťák sa priznať nedá); Milujúca
manželka od v7 Kliatba nie je — je to Občan a kladie sa do línie (§16).

- **Priznaná kliatba je natrvalo mimo balíčka** — nevracia sa po bitke ani pri
  zamiešaní odhadzovacieho balíčka. Priznanie je jediný bežný spôsob, ako si
  balíček od kliatob **vyčistiť**; nepriznaná kliatba sa vracia a dobiera
  znova.
- Priznanie **nemíňa limit vykladania** a **neodovzdá ťah**: hráč prizná
  ľubovoľne veľa kliatob za sebou a potom ešte vykladá alebo pasuje. Smie
  priznávať aj pri vyčerpanom limite — kým nepasuje.
- **Dlh sa nepriznáva** — od v8.2 je to počítadlo, ktoré vzniká rovno priznané (§8).
- **Absťák sa priznať nedá** (v9.1) — je to Kliatba, ktorá ostáva v balíčku; spáliť
  ho smie len Vízia alebo efekt, ktorý to výslovne povie (§8).

**Kedy priznanie dá kartu:**

| Kliatba | Karta navyše |
|---|---|
| Dlh (počítadlo) | **nie** — vzniká rovno priznaný |
| Absťák (karta, v9.1) | — nedá sa priznať |
| Cirhóza | **nie** |

Jadro dá pri priznaní kartu za každú inú kartu s tagom Kliatba (rozhodnutie 2026-10-19,
Cirhóza výnimka od 2026-10-20) — v sade v53 taká karta nie je.

| | Nepriznaná | Priznaná |
|---|---|---|
| Dlh | — (vzniká priznaný) | **v každej bitke ho páli Exekútor** (aj špaky), ráta sa do remízy v bitke |
| Cirhóza | ide po bitke do tvojho odhadzovacieho balíčka; na konci hry **−3 špaky** | na konci nestojí nič; **súper za ňu v bitke +1 tuhé**; kartu za priznanie **nedostaneš** |

Kliatby a špaky (v6): nepriznaná Cirhóza stojí na konci 3 špaky (v8), Dlh berie
špaky cez Exekútora; Absťák špaky neuberá — berie tuhé v každej bitke (§8, §9.3).

### Exekútor

Krok 4c bitky (§9), aj vo finále — **po poškodení, výsledku a špakoch za bitku,
pred Nakladačkou** (Michal 2026-10-28); **vždy po hráčoch: obranca
Robota a Exekútor, potom útočník Robota a Exekútor**.
Remíza na Dlhy a Herňa teda rátajú priznané Dlhy
**pred** exekúciou. Najprv **Robota**: za každú aktívnu Robotu hráč **spáli**
1 priznaný Dlh (s Fúrikom v Dedičstve o 1 viac za každý Fúrik); **za každý Dlh,
ktorý Robota nemá čo spáliť, dostane 1 špak** (v8.4, Náradie 2026-10-30 — Robota
bez Dlhov 1 špak, posilnená Robota bez Dlhov 2, s Fúrikom bez Dlhov 2, pri 1 Dlhu
a Fúriku 1 spálený + 1 špak). Robota zmenší, čo zhorí Exekútorovi. Špaky za Robotu
sú na nástenke pri bitke (`robota`). Potom príde **Exekútor — bez prahu, vždy**, ku
každému hráčovi s aspoň 1 **priznaným** Dlhom (nepriznané sa nerátajú):

```
zhorí = polovica priznaných Dlhov, zaokrúhlene NAHOR
špaky = zhorí − sila tvojej priazne Advokáta (v9), najmenej 0
```

Zhorí toľko priznaných Dlhov a **rovnaký počet špakov** (Advokát ich uberie) — zhoria,
súper ich nedostane, a hráč smie ísť do mínusu. Exekúcia prehru nespôsobí. Príklad:
5 Dlhov → zhoria 3 Dlhy a 3 špaky; s Advokátom sily 2 len 1 špak. Jediný Dlh zhorí
celý (aj s 1 špakom) — až po poškodení, takže remíza a Herňa ho v tej bitke ešte spočítajú.
Priazne Robota a Advokát sa rátajú v čase exekúcie (sila z rozdielu strachov, §10). Priazeň Exekútora zanikla v9.

**Záhradkár (Exekúcia, Michal 2026-10-28):** keď leží odkrytý v línii v partii
hráča (jeho karta, v tejto bitke), Exekútor ho v kroku 4c obíde — nezhorí mu ani
jeden Dlh a neodpočíta žiadne špaky.
Nespáli sa, po bitke sa vráti ako každá karta (§16).

Zvyšné priznané Dlhy na konci hry nestoja nič. Priznané Dlhy pália len Robota
a Exekútor; Obecný úrad a priazeň Kmotra ich presúvajú
k súperovi.

---

## 12. Nástroje a Dedičstvo

### Nástroj v línii

- **Nástroj potrebuje podporu:** v línii vytvorí spoj len s kartou s tagom
  **Občan alebo Starešina**. Pri lokalite, karte staršieho v strede či karte
  bez týchto tagov (napr. Zviera bez tagu Občan) **spoj nevznikne** —
  neaktivuje sa nič, ani akcia Nástroja, ani akcia suseda. Náradie musí mať kto
  používať.
- **Náradie je spoločné:** akcie Nástroja na spoji dostane **majiteľ karty,
  s ktorou Nástroj tvorí spoj**, nie majiteľ Nástroja. Nástroj medzi kartami
  dvoch hráčov dá každému akcie jeho spoja; podstrčený Nástroj tak pracuje pre
  súpera a súperov Nástroj vedľa tvojho Občana pre teba.
- **Efekt Nástroja v línii neplatí** — len v Dedičstve.
- Nástroj nesmie susediť s Nástrojom na konci strany, kam sa vykladá
  (susedstvo je fyzické).
- **Vedľa lokality sa Nástroj nevykladá** (v10.2, Michal 2026-11-01): na prázdnu stranu
  — svoju ani súperovu, ani vo finále na pinnacle — ho vyložiť nemožno. Platí pre každé
  vyloženie do línie: bežné, ďalšiu kartu ťahu po Vypiť (§13, Nástroj smie za kartu
  vyloženú v tom istom ťahu), Záverečnú aj odpoveď na NA EX. Za Živnostníka ho priložiť
  smieš (leží za ním, nie pri lokalite). Do Dedičstva sa vykladá ako doteraz. Pravidlo je
  len o vykladaní: Nástroj, ku ktorému sa lokalita dostane neskôr (karta medzi nimi odíde
  z línie), ostáva ležať.
- Nástroj sa do limitu vykladania **nezapočítava vôbec**, ale jeho vyloženie
  (do línie aj do Dedičstva) sa v striedaní počíta ako ťah (§6).

### Dedičstvo

Nástroj možno namiesto do línie vyložiť do hracej oblasti ako **Dedičstvo**;
tam sa uplatňuje jeho pasívny efekt `Dedičstvo`. Poldeci sa na Nástroje
neuplatňujú, NA EX sa na ne dať nedá.

**Dedičstvo stojí cigarety a cena rastie spoločne pre oboch:** prvý Nástroj
vyložený do Dedičstva v hre stojí **1** cigaretu, druhý (hocktorého hráča)
**2**, tretí **3** atď. Bez cigariet Nástroj do Dedičstva nevyložíš, do línie
áno. Z Dedičstva sa Nástroj do línie nevracia.

Efekt v Dedičstve funguje ako malá priazeň: Nealko prah Cirhózy +2, Svätý
text Viera +1, Vidly (Rany o 1 viac), Puška (prepojená Petelica sa nedá zrušiť, len oslabiť), Krabička cigariet,
Noviny, Pasca, Výherný automat, Vínko, Injekcia a **Náradie** (v8.4, nižšie) (§16).

**Náradie (v8.4, Michal 2026-10-30)** — Nástroj ku každej akcii, efekt len v Dedičstve
majiteľa; menia sa len **tvoje** akcie (karty, ktoré si zahral):

| Nástroj | Dedičstvo | Presne v hre |
|---|---|---|
| Zapaľovač | Tvoje aktívne Cigarety nemožno zrušiť NA EX. | NA EX na kartu zruší ostatné aktívne akcie; aktívne Cigarety ostanú ×1 (nezdvoja sa). |
| Výherné žreby | Tvoje Hazardy sú aktívne, keď nie sú spojené, a neaktívne, keď sú spojené. | Rozhoduje, či slot má na spoji partnera; zrušené Odporom ostávajú zrušené. NA EX potom ako vždy: spojené (neaktívne) zdvojí, nespojené (aktívne) zruší (O1). |
| Píšťalka | Tvoje Obmedzenia uberajú aj cigarety, ktoré súper dostane za pas. | Pri súperovom pase sa mu cigarety za pas znížia o tvoje aktívne Obmedzenia v línii v tej chvíli (najmenej 0); v Pitke uberajú ako vždy. |
| Hrable | Akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená. | Zrušená akcia (nie Posilnenie, Odpor, Pakt) sa pripíše majiteľovi Odporu ×2. |
| Zrkadlo | Tvoj Pakt kopíruje prepojenú akciu dvakrát. | Pakt sa premení na akciu partnera ×2; proti Posilneniu ostáva nič. |
| Valaška | Tvoje Pecky udeľujú o 1 poškodenie viac. | Ako Puška pri Petelici: každá aktívna Pecka z vyložených akcií +1 tuhé. |
| Telefón | Tvoje Pohoršenia nemožno zrušiť Odporom a NA EX. | (v10) Odpor na spoji s tvojím Pohoršením ho nezruší; NA EX tvoje aktívne Pohoršenia nezruší (ani nezdvojí, ako Zapaľovač). Tvoje Pohoršenia sa vždy dostanú do hádky. |
| Jogurt | Tvoje Poldeci otáčajú vypitý poldeci hneď v Pitke, nie až v bitke. | Vo vyhodnotení každej Pitky otočia akcie Poldeci v línii toľko vypitých, koľko v kole ešte neotočili; v bitke (krok 5) len zvyšok. |
| Energeťák | Tvoje Posilnenie nemožno zrušiť NA EX. | NA EX na kartu s tvojím Posilnením partnerovi ×2 nezruší. |
| Horoskop | Tvoje Povery majú silu 2. | (v10) Každá tvoja zvyšná Povera dá 2 mäkké namiesto 1. S Vierou sa ruší stále 1 : 1 na kusy: jedna súperova Viera zruší jednu tvoju Poveru, teda 2 mäkké. Prenášanie klebiet do ďalšieho kola zaniklo. |
| Fúrik | Tvoje Roboty pália o 1 Dlh viac (teda 2). | Každý Fúrik +1 Dlh za Robotu; čo nemá čo spáliť, dá špak (§11). |
| Krištáľová guľa | Tvoje Vízie ukážu 2 vrchné karty — jednu si vezmi alebo spáľ, druhú vráť navrch. | Ukážu sa dve vrchné karty doberacieho balíčka (len tebe); rozhodneš o jednej, druhá ostane navrchu. Pri jedinej karte ako bežná Vízia. |

Kto má viac kusov toho istého Nástroja: Valaška a Fúrik sa sčítajú, ostatné nie.

---

## 13. Pokročilé ťahy

### Vypiť — viac kariet v jednom ťahu

V **Zhromaždení**, keď je na ťahu, smie hráč **vypiť**: otočí jeden **plný
poldeci na vypitý**. Samostatné tlačidlo na to nie je — hráč v ťahu
jednoducho vyloží viac kariet a **každá ďalšia karta po prvej stojí plný
poldeci** (pred ňou sa vypije). Klient posiela celý ťah naraz (príkaz `tah`:
priznania, potom karty a pred každou okrem poslednej Vypiť); server ho vykoná
celý, alebo vôbec.

**Poradie:** Vypiť ide pred kartu, po ktorej chce hráč pokračovať — pri dvoch
kartách **Vypiť, karta, karta**; „karta, Vypiť, karta“ nejde, prvá karta ťah
ukončí. Za každé vypitie:

- jeho **ďalšie vyloženie neukončí ťah** — zahrá dve karty (priznania,
  Nástroje) za sebou, súper medzitým nereaguje,
- jeho **zostávajúci limit vykladania hneď klesne o 1** (poldeci už nie je
  plný; v ďalších Zhromaždeniach sa limit počíta z plných poldeci ako vždy),
- dostane **+1 poškodenie pečene** a pitie sa ráta ako **nerest** (§8). Pečeň
  sa vyhodnocuje len v Pitke: +1 sa pripíše dopredu a prah Cirhózy sa
  skontroluje v najbližšej Pitke.

Piť smie **opakovane**, kým má plné poldeci — každé vypitie pridá ďalšie
vyloženie bez odovzdania ťahu. Pasovanie nevyužité ťahy navyše ruší. Vypitý
poldeci sa dá doliať (§7) a jeden sa doleje sám na začiatku kola. Keďže každé
Vypiť zníži limit o 1, dve karty v jednom ťahu treba limit aspoň 3, tri karty
limit 5 — **pri limite 3 sú v jednom ťahu najviac dve karty**. V kole o Kostol sa
nepije (v ťahu teda len jedna karta).

### Záverečná

Na svojom ťahu v Zhromaždení smie hráč za **1 cigaretu** zahrať kartu z ruky
ako **Záverečnú** — lícom dole na koniec svojej alebo súperovej strany. Je to
voliteľné a hráč tým v tomto Zhromaždení **končí s vykladaním** (ako pas, ale
**bez cigariet za pas**); v jednom Zhromaždení teda najviac jedna.

- Je to bežné vyloženie: **míňa limit** (Nástroj nie), smie byť aj ďalšou
  kartou ťahu po Vypiť a platia pre ňu všetky pravidlá vykladania.
- Kým leží lícom dole, **ráta sa normálne** — akcie, spoje, prevaha, tuhé.
  Súper z nej nevidí nič (ani meno v logu); jej príspevok mu ostáva neznámy.
  Ani cez jeho vlastné karty: akciu jeho karty, ktorú Záverečná spáruje
  (aktivuje, zdvojí či zruší), mu hra neukáže a odhad bitky ju nezarátava —
  uvidí ju až po otočení.
- **Za ňu sa nedá priložiť** žiadna karta (ani odpoveď na NA EX), kým sa
  neotočí — tá strana je dovtedy zablokovaná.
- **NA EX** na ňu smie v Pitke dať len **súper** a prejde vždy (nekontroluje
  sa tag ani aktívne a neaktívne akcie — odmietnutie by kartu prezradilo);
  vyhodnotí sa ako na každej karte. Majiteľ na ňu NA EX dať nesmie.
- **Otočí sa na konci Pitky**, ktorá nasleduje po jej Zhromaždení (pred
  ďalším Zhromaždením alebo bitkou, krok 8 v §7). Až vtedy sa vyhodnotí jej
  **Nástup** a **Konflikt** či **Podpora**, ktoré priložením vyvolala (§16); Kšeft
  karty lícom dole použiť nemožno. Živnostník smie Nástroj priložiť
  aj pri otočení.

### Podstrčenie (sabotér)

Súperovi môžeš na jeho stranu podstrčiť kartu — jej Odpor mu zruší akciu na
spoji, jej akcie bodujú pre teba a zaberie mu koniec strany. Karta ostáva
v tvojej partii a míňa tvoj limit (§6). Jedna podstrčená karta neukradne akcie
hrany lokality, ale tvorí s nimi spoj: ak leží pri lokalite, určuje, ktoré
akcie hrany sa aktivujú, a dostane ich hráč s prevahou v kraji (§6).
Podstrčený Kočovník je výnimka z „akcie bodujú pre teba“ — jeho akcie dostane
hráč s prevahou v jeho kraji (§16). **Podstrčený Pes platí** — jeho aktívne akcie
na spoji so súperovou kartou sa zdvoja aj na súperovej strane (§16); na Moste
sa na súperovu stranu nevykladá (§15).

---

## 14. Špaky

**Špaky** (v6, Michal 2026-10-26) zbiera hráč počas celej
hry a klient ich ukazuje ako ohorky v popolníku pri mene hráča. Špaky sú
verejné. Vyhrá, kto má na konci hry (po finále) viac špakov; rovnosť je remíza.

| Odkiaľ | Koľko | Kedy |
|---|---|---|
| Vyhratá bitka | 1 za každú kartu v línii na oboch stranách (v8; aj finále), **aspoň 1** (od v8.1 bez zrážky za Absťáky); plus špaky zo sekery | krok 4a (§9.4) |
| Prehratá bitka o Kultúrny dom (v8) | 1 za každú svoju kartu v línii | krok 4a (§15) |
| Starší po bitke (v11) | víťaz za každého staršieho za svoj najvyšší marker (reči, inak strach), porazený a pri sekere obaja za reči: žltá **1**, oranžová **3**, červená **5** | krok 4b (§10) |
| Finále: Nakladačka a hádka (v9.1, v11) | víťaz bitky 1 za bod Nakladačky, víťaz hádky 1 za bod hádky | krok 4a (§14b) |
| Krádež pri zajatí (v11, v11.4) | zlodej dostane, okradnutý stratí špaky za okradnutého najvyšší marker pri zajatom staršom v čase zajatia (1 / 3 / 5), najviac koľko má | krok 4e (§10) |
| Exekútor | **−** polovica priznaných Dlhov nahor, mínus sila tvojej priazne Advokáta (najmenej 0) — v každej bitke, kým má hráč priznané Dlhy (Záhradkár v partii ju v tom kole obíde) | krok 4d (§11) |
| Výkupné zdrojov | **+1** za každý plný poldeci, **+1** za každých celých 5 cigariet (nadol); **bez stropu** | na konci hry, po finále |
| Nepriznaná Cirhóza | **−3** za kus (v8; ruka aj oba balíčky) | na konci hry, po finále |

Väzni od v11 po finále špaky nedávajú (do v10 8 / 6 / 4 / 2 podľa poradia zajatia).

**Výkupné** (Michal 2026-10-27): zdroje, ktoré hráčovi po finále ostanú, sa
vykúpia za špaky — nič neprepadá a hra ho neobmedzuje stropom. Ráta sa **plný
poldeci** v zásobe hráča (§6, limit vykladania): vypitý poldeci nie, poldeci ležiaci
cez NA EX sa v bitke vypije (§9.5) a tiež nie; Vínko je len limit, nie poldeci.
Cigarety sa delia piatimi a zvyšok prepadne (14 cigariet = 2 špaky). Zdroje oboch hráčov
sú verejné, preto aj výkupné — klient ho ukazuje v riadku „Koniec“ krčmovej nástenky
a v „keby skončila teraz“.

Špaky smú klesnúť do mínusu. **Krčmová nástenka** ukazuje odohrané bitky:
lokalitu (aj pinnacle finále, s príznakom finále), počet kariet v línii, víťaza a špaky za
bitku; klient z nej skladá aj rozpis popolníka. Pod lokalitou je, koľko špakov za ňu víťaz
v kole získal spolu — za bitku, Robotu, starších po bitke (rozpis po staršom a markeri),
Nakladačku a hádku vo finále, krádež, mínus Exekútor; porazený vedľa, ak niečo získal. Rozpis
po hráčoch ukáže myš (aj fokus klávesnicou), klik otvorí súhrn lokality: Pitky kola (kto čo
získal a stratil) a rekapituláciu bitky. Súhrn je len evidencia z verejných udalostí — server
ho skladá z toho, čo videli obaja.

Scorecard nesie len **priazeň** staršieho (§10). Bodovacie podmienky (Lokality,
Starší, Cigarety, Rezerva, Cirhóza, Dlhy, Absťák, zóny strachu) sa v6 rušia —
ovládnuté lokality už nie sú, preto padá aj všetko, čo sa na ne odvolávalo.

## 14b. Finále

Po poslednej bitke o lokalitu (3 / 5 / 7) sa hrá **finále** — posledná bitka
na **pinnacle lokalite** (Poľovnícka chata, Predsedova vila, Herňa). Hrá sa
**ako každé kolo**: lokalita leží v strede línie, karty sa kladú k nej a platia
jej hrany, efekt, kraje aj prevaha (Kočovník, Dvojčatá ako inde).
- **Útočí zaostávajúci** — hráč s **menej špakmi** (Michal 2026-10-27, mení
  rozhodnutie z 26. 10.). Pri rovnosti útočí ten, kto **prehral poslednú
  bitku**; keď posledná bitka skončila sekerou, útočník ostáva útočníkom.
  Útočník vykladá prvý a na NA EX odpovedá prvý (lícom dole); obranca berie zo šenku prvý.
- **Obranca — hráč, ktorý vedie** (viac špakov) — vyberie a natočí pinnacle
  lokalitu (z troch, §5). Potom šenok a branie ako v každom kole.
- Pitiek je ako na každej lokalite **1 + menší počet aktivovaných akcií hrán**
  (1–5) — teda podľa spojov s lokalitou. Víťaz dostane **1 špak za každú kartu
  v línii** (v8; aspoň 1); na Herni navyše toľko, koľko má
  porazený priznaných Dlhov (§15). Sekera vo finále špaky kola aj zo sekery
  **prepadnú**.
- **Vo finále sa markery nedvíhajú** (v11): víťaz finále dostane za každý bod Nakladačky
  **1 špak** (v9.1) a víťaz hádky za každý bod hádky **1 špak**; starší bodujú po finálovej
  bitke ako po každej (krok 4b).
- **Výhra strachom** (4 červené, krok 4c) platí aj vo finále — ešte pred konečnými špakmi (§1, §10).
  Vo finále sa nezajíma ani nepresviedča (v11.4), výhra väzňami tu teda nepríde. Po finále sa Chuť
  ani **Absťák** nerieši (§8).
- Potom sa vykúpia zvyšné zdroje (plný poldeci 1 špak, každých celých
  5 cigariet 1 špak, §14), odpočíta sa nepriznaná Cirhóza (−3 za kus) a vyhrá
  hráč s viac špakmi.

Bez lokality sa nehrá nikdy. Sada, ktorá nemá lokality každej úrovne vrátane pinnacle, finále nemá — hra
skončí po poslednej lokalite (len testovacie sady).

## 15. Lokality

**v7: 19 lokalít po úrovniach** (§3) — 1: Zastávka, Most, Lesná cesta,
Cintorín, Jednota; 2: Ihrisko, Benzínka, Kar, Zberný dvor, Krčma, Sklad;
3: Obecný úrad, Kultúrny dom, Vínna pivnica, Družstvo, Kostol; pinnacle (len
finále): Poľovnícka chata, Predsedova vila, Herňa. Hrany sú v `cards.json`
(plan.md 7.4). Zmenené a nové efekty v7 a v8 (majú prednosť pred tabuľkou v6 nižšie):

| Lokalita | Kedy | Efekt v7 a v8 |
|---|---|---|
| Lesná cesta | Bitka | +1 tuhé za každé **svoje Zviera** v súperovom kraji, bez stropu. |
| Cintorín | Prehra | Porazený smie vyložiť jeden Nástroj z ruky alebo zo šenku do Dedičstva bez platenia; spoločná cena Dedičstva sa zvýši ako vždy (§12). Pri sekere nikto. |
| Jednota | Pitka | Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani dolievať (doliatie = 2 cigarety za vypitý poldeci; barter smie). Pri rovnosti smú obaja. |
| Benzínka | Pitka | Fajčiť smie len hráč, ktorého Občan alebo Starešina leží **najďalej od lokality** (index na strane, na ktorejkoľvek strane, skrytá Záverečná sa neráta). Pri rovnakej vzdialenosti nefajčí nikto (Michal 2026-10-27). |
| Kar | Pitka | Poškodenie pečene za NA EX dostane **súper** hráča, ktorý ho dal (poldeci a nerest ostávajú dávajúcemu). |
| Kostol | Zhromaždenie, Pitka | Nikto nesmie vypiť (v ťahu teda len jedna karta). NA EX sa smie dať len na kartu v kraji **pri oltári** (pri vytlačenej ľavej hrane; s otočeným Kostolom pri strane hráča 1). |
| Zberný dvor | Kšeft | Za 1 cigaretu (od v9.1 nie nerest) ľubovoľná karta zo svojho odhadzovacieho balíčka do ruky, raz za Pitku. |
| Sklad | Kšeft | Za 1 cigaretu (od v9.1 nie nerest) vrchná karta **súperovho** odhadzovacieho balíčka do tvojej ruky — odteraz je tvoja; pri prázdnom sa nedá. Kraje pri vreciach / pri strážnici. |
| Obecný úrad | Kšeft | Za 3 cigarety (od v9.1 nie nerest) presuň 1 svoj priznaný Dlh medzi súperove priznané. Robota tu páli 1 Dlh ako inde. |
| Poľovnícka chata | Furt | Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát (Hazard, Pečeň, Posilnenie, Pohoršenie nie). Kraje pri trofejach / na posede. |
| Predsedova vila | Kšeft | Za 2 cigarety zdvihni svoje reči pri jednom staršom o stupeň (nad vyšší z tvojich markerov, najvyššie na červenú; v11). Kraje pri bazéne / v pracovni. |
| Herňa | Bitka | Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov (pri bitke, pred Robotou a Exekútorom; bez stropu); pri sekere nič. Kraje pri automatoch / v zadnej miestnosti. |
| Kultúrny dom | Bitka | **Obaja získajú špaky** (v8, Michal 2026-10-28, návrh #29): víťaz dostane špaky za všetky karty v línii ako inde, porazený 1 špak za každú svoju kartu v línii (svoju partiu, na ktorejkoľvek strane). Pri sekere nikto nie je porazený — špaky kola idú na sekeru ako inde. Nakladačka sa rozdeľuje ako inde (§9.4). |
| Ihrisko | Bitka | V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (pri rovnosti nikto) — rátajú sa ako do prevahy, **Dvojčatá za dve** (v8, návrh #32); z oboch krajov teda až +4. |

Ďalšie lokality — tie, ktoré v tabuľke vyššie nie sú (Krčma, Zastávka, Most, Vínna pivnica, Družstvo); staré znenia v6 lokalít z tabuľky vyššie sú v `docs/pravidla-historia.md` (audit 2026-10-31 ich odtiaľto vyradil). Akcie na hranách určujú počet Pitiek (§7); efekt platí v kole,
keď je lokalita cieľom. Po bitke ide lokalita na krčmovú nástenku (§14) —
nikto ju neovláda.

| Lokalita | Kedy | Efekt |
|---|---|---|
| Krčma | Pitka | Kto má plný poldeci a Občana či Starešinu v línii (vlastného či súperovho), musí dať NA EX (skryto ako vždy, §7) — bez neho Pitku neskončí. Prah Cirhózy je v kole o Krčmu obom o 2 vyšší (sčíta sa s Alkoholikom a Nealkom). |
| Zastávka | Pitka | (v9.1) Po **prvej Pitke kola** si každý hráč vezme **zadarmo 1 kartu zo šenku** — najprv útočník, potom obranca. Šenok sa medzi nimi nedopĺňa; jediná karta pripadne útočníkovi, z prázdneho šenku sa neberie nič. Do v9 spoločný limit vykladania. |
| Most | Zhromaždenie, Pitka | Karty sa smú vykladať len na vlastnú stranu — aj odpoveď na NA EX. |
| Vínna pivnica | Pitka | NA EX smie hráč dať v Pitke až dvakrát (obe skryto, na dve rôzne karty). |
| Družstvo | Zhromaždenie | Karty s tagom Pracujúci nemíňajú limit vykladania. |

**Kraje lokalít** (vytlačená ľavá / pravá hrana): Krčma pri výčape / pri
dverách · Kostol pri oltári / pri vchode · Benzínka pri pokladni / za budovou ·
Zastávka pod strieškou / pri ceste · Lesná cesta v húštine / pri kríži ·
Ihrisko na trávniku / na tribúne · Zberný dvor pri váhe / za plotom · Most pri
kaplnke / pod mostom · Cintorín pri hroboch / pri márnici · Kar pri vdove / pri
koláčoch · Obecný úrad v kancelárii / na chodbe · Jednota pri pulte / pred
obchodom · Kultúrny dom na parkete / pred vchodom · Vínna pivnica pri sudoch /
na schodoch · Družstvo na poli / na schôdzi. Akcie hrany dostane hráč
s prevahou v kraji (§6).

---

## 16. Výklad kariet

Všetky efekty sady engine vyhodnocuje automaticky. Nejednoznačné texty sa
vykladajú takto. „Okolie“ karty = jej susedia v línii na oboch stranách, bez
ohľadu na majiteľa (aj lokalita či starší v strede). Texty kariet sú od v7
(Michal 2026-10-27, plan.md 14.0) „len spúšťač a efekt“ — výklad patrí sem.

**Konflikt (v11.3, Michal 2026-11-03):** efekt karty, ktorá sa **priložením**
ocitne vedľa **súperovej** karty — je jedno, či ju prikladáš ty k súperovej
karte, alebo súper svoju k nej (na koniec strany, v Zhromaždení aj odpoveďou na
NA EX). Do v11.2 len druhé. **Podpora (v11.3)** je zrkadlo Konfliktu: efekt karty,
ktorá sa priložením stretne s **vlastnou** kartou (s kartou toho istého hráča,
na ktorejkoľvek strane). Ráta sa len priloženie: **NA EX**, zrážka ani presun či
uzavretie medzery (Dohadzovačka, Poľovník) ich nespúšťajú. **Nástroj** ich
nespúšťa — ani priložený, ani ležiaci. Poradie: Nástup priloženej karty, potom
jej Konflikt a Podpora, potom Konflikt a Podpora ležiacej. Záverečná ich vyvolá
až pri otočení na konci Pitky (§13). Lokalita ani starší ich neprepožičiavajú.
**Vyvolať Konflikt** = priložiť kartu k súperovej ležiacej karte s Konfliktom
(§17). Stav „na spoji so súperovou kartou“ (Pes) je Furt, nie Konflikt.

**Úplatok** (v7) zanikol vo v10.3 (Michal 2026-11-02) — mal ho len Kulturista, ten je teraz Sypač.

**Výklad na potvrdenie (v11.5, identita kariet):** kde znenie nových efektov nechalo otázku, platí
najjednoduchší výklad — každá karta (aj každé Noviny v Dedičstve) platí zvlášť; „tvoji“ = karty natočené
k tebe; „okolie“ = susedia v línii (§16 vyššie); posilnené = ×2. Šoférova cigareta prichádza na začiatku
bitky, Noviny hneď po rozhodnutí hádky, Kôň v kroku Exekútora. Michal ich potvrdí.

| Karta | Výklad |
|---|---|
| Veľmi smútiaca vdova | Konflikt (v11.3, Michal 2026-11-03; do v11.2 dve karty): súper odhodí **1 kartu z doberacieho balíčka za každého svojho Chlapa, ktorý s ňou susedí**. Spustí sa, keď súper priloží kartu k nej aj keď ju jej majiteľ priloží k súperovej karte. Rátajú sa súperove karty (natočené k nemu) s tagom Chlap, ktoré s Vdovou susedia v línii — aj práve priložená, teda najviac dvaja (2 karty); skrytá Záverečná sa neráta. Ak súper nemá v doberacom balíčku dosť kariet, zamieša odhadzovací do doberacieho a odhodí zvyšok; ak ani tak nemá, odhodí zvyšok **náhodne z ruky** (ako pri Hrobárovi). Odhodené karty idú do jeho odhadzovacieho balíčka. Vyhodnotí sa po Nástupe priloženej karty. Do v10.2: priložený Chlap išiel po bitke z hry. |
| Policajtka | Pitka (v10.4, Michal 2026-11-02, „Pokutový blok“): pri vyhodnotení Pitky získa súper **1 zadĺženie za každú svoju akciu, ktorú v tejto Pitke zruší tvoj Odpor** — Odpor ktorejkoľvek tvojej karty v línii (aj Nástroja, aj podstrčenej), nie hrany lokality. Ráta sa akcia, ktorá by inak patrila súperovi (aj jeho zlá — Hazard, Pečeň), nie modifikátory (Posilnenie, Odpor, Pakt); Vzbura nič neruší (spojené akcie pod ňou sú neaktívne, nie zrušené). Každá tvoja odkrytá Policajtka platí zvlášť (dve = 2 za akciu), skrytá Záverečná nie. Zadĺženie ide do súčtu Pitky ako Hazard (každé 2 = Dlh, §8). Autorita — súperov Praudovravec ju umlčí (len stará sada). Do v10.3 Konflikt: súper Dlh, za Kriminála 2 cigarety. |
| Stryná | Pitka: každý hráč, ktorý v tejto Pitke nedal NA EX (pri odkrytí), dostane pri vyhodnotení 1 poškodenie pečene — za každú Strynú v línii, bez ohľadu na majiteľa. |
| Recidivista | Prehra: keď jeho majiteľ prehrá bitku, Recidivista sa po bitke vráti do jeho ruky (nie do balíčka). Pri sekere nie. |
| Liberál | Furt (v10.3, Michal 2026-11-02): ak máš v partii (tvoje karty v línii, v ktoromkoľvek kraji) rovnako žien a chlapov, všetky jeho aktívne akcie sú posilnené (×2; násobí sa s ostatnými násobkami). Rátajú sa karty s tagom Žena / Chlap; Liberál má oba, ráta sa za oboch; skrytá Záverečná sa neráta. Do v10.2: súper bez rovnováhy získal v Pitke 1 zadĺženie. |
| Živnostník | Nástup: hneď za neho smie majiteľ priložiť 1 Nástroj z ruky na tú istú stranu — mimo limitu vykladania; Nástroj s ním tvorí spoj (§12). Hra počká na voľbu ako pri Hasičovi; v ťahu s viacerými kartami sa voľba robí hneď po Živnostníkovi (ďalšia karta na tú stranu ju zruší). Ako Záverečná: pri otočení. |
| Šarlatán | Konflikt: do konca kola sa jeho akcie Hazard rátajú ako Viera a Povera ako Rana (mení sa druh, nie aktivita); po bitke ide do balíčka s pôvodnými akciami. Platí aj pre akcie zdvojené NA EX (Hazard ×2 = Viera ×2, bez zadĺženia). Pozor pri odpovedi na NA EX: akcie, ktoré priložená karta spojom aktivuje, NA EX **zruší** ako každú aktívnu akciu (§7) — aj premenené Rany (ULTRA 20261030-115654, prehratie partie). |
| Pes | Furt: jeho aktívne akcie na spoji so súperovou kartou (strana Psa k tej karte) sa rátajú dvakrát; násobky sa násobia (§7). Platí aj podstrčený či podstrčením vzniknutý spoj. |
| Mäsiar | Furt (Michal 2026-10-28): **efekty Zvierat** v jeho okolí (oboch hráčov) neplatia, kým s ním susedia; ich **akcie sa rátajú normálne**. Týka sa Psa, Koňa a Čiernej mačky (Furt), Krokodíla (Bitka, aj jeho koniec bitky) a Recidivistu (Zviera aj Občan; Prehra — rozhoduje okolie v chvíli, keď sa efekt spúšťa). Kapybara priložená k Mäsiarovi sa nespustí; Nástup, ktorý už prebehol, sa nevracia. Mäsiar lícom dole (Záverečná) ešte nič neumlčí. Do 2026-10-28 Mäsiar rušil akcie Zvierat. |
| Krokodíl | Bitka: na konci bitky sa spália všetci Občania a Zvieratá v jeho okolí (oboch hráčov); Starešinovia a Nástroje nie. Ich akcie v bitke ešte platia. |
| Kapybara | Nástup (v11): súperove reči pri jednom staršom (podľa voľby majiteľa) klesnú o stupeň; na stupni súperovho strachu zaniknú. **Povinný** — keď má súper reči aspoň pri jednom staršom; inak nič. |
| Kohút | **Dočasne vyradený (v9.2, Michal 2026-10-30)** — posledné slovo pri odpovediach na NA EX zaniklo (odpovede lícom dole, §7); v sade v53 karta nie je (vyradená v sade v51), prerobí sa. V jadre nemá účinok (TODO). Predtým: posledné slovo mal jeho majiteľ aj ako obranca. |
| Pijan | Bitka: za každé NA EX, ktoré majiteľ v tomto kole dal (poldeci ešte leží na karte), udelí súperovi Ranu navyše — za každého Pijana. |
| Milujúca manželka | Pitka: tvoje poškodenie pečene v Pitke je o 1 menšie (najprv z akcií Poškodenie pečene, potom z Poldeci); latku Absťáku (Chuť) nemení, nie je Kliatba. |
| Opatrovateľka | Furt (v11.5, Michal 2026-11-03): aktívne akcie **tvojich Pamätníkov** (karty s tagom Pamätník natočené k tebe) v jej okolí sú **posilnené** (×2, ako Liberál; násobí sa s ostatnými násobkami — dve Opatrovateľky pri jednom Pamätníkovi ×4). Súperovi Pamätníci nie, ani jej vlastné akcie. Lícom dole (Záverečná) sa ráta ako ostatné Furt efekty akcií (Silná nezávislá žena). Do v11.4: Chuť sa na konci kola porovnávala o 2 nižšia. |
| Absťák | Kliatba bez akcií (v9.1, §8): Bitka — každý Absťák v tvojom balíčku (ruka, doberací, odhadzovací) ti uberie 1 tuhé; remízu v tuhom prehráva, kto ich má viac. Nedá sa priznať ani vyložiť; po bitke ide z ruky do odhadzovacieho balíčka. Spáliť ju smie len Vízia alebo efekt, ktorý to výslovne povie. |
| Miňištrant | Nástup: ak ho majiteľ priložil k súperovej karte s Konfliktom (vyvolal Konflikt), do konca kola sa jeho Viera ráta ako Pecka. |
| Dievčina na vydaj | Prehra: keď jej majiteľ prehrá, spáli sa (navždy z hry) a víťaz získa toľko Dlhov, koľko mala aktívnych akcií (s násobkami; zdvojenie z NA EX sa neráta — poldeci sa vypijú skôr, krok 5 pred 6c). |
| Snúbenica | Podpora (v11.3, Michal 2026-11-03): keď sa priložením stretne s **vlastným Chlapom, na ktorom leží súperovo NA EX**, NA EX z neho zíde — súperov poldeci sa mu vráti **vypitý** (nerest NA EX sa ráta, pečeň z odkrytia ostáva), akcie Chlapa sa odteraz rátajú bez NA EX. Pri zrážke (Výtržník) zíde len súperovo NA EX; tvoje ostáva a karta vytriezvie (ako schopnosť Farára). Typicky odpoveďou na NA EX (vyhodnotí sa pri otočení) alebo v ďalšom Zhromaždení kola. Do v11.2 Konflikt: priložený Chlap išiel po bitke k majiteľovi Snúbenice. |
| Bzdocha | Pitka: Súper hrá Pitku pred tebou; vidíš jeho NA EX. Majiteľ čaká, kým súper skončí svoju časť Pitky, potom hrá a vidí súperove skryté NA EX; majú ju obaja → nečaká nikto (§7, Michal 2026-10-27). |
| Záhradkár | Exekúcia (Michal 2026-10-28): „Exekúcia v tomto kole pre teba neplatí.“ Keď leží odkrytý v línii v partii majiteľa (jeho karta, aj na súperovej strane), Exekútor ho v kroku exekúcie (§9, 4c) obíde — nezhorí mu žiadny Dlh ani špak. Nespáli sa; v ruke či v balíčkoch nerobí nič. Súperov Záhradkár ťa nechráni. |
| Anonymný alkoholik | Furt (v11.5, Michal 2026-11-03): aktívne akcie **Poškodenie pečene tvojich kariet** (natočených k tebe) v jeho okolí sa rátajú ako **Viera** — v Pitke nedajú pečeň, v bitke ako každá Viera rušia Povery a tlmia tuhé; s násobkami (×2 = 2 Viery). Súperove karty a hrana lokality nie (hrana nie je karta); jeho vlastné akcie tiež nie. Lícom dole ako ostatné Furt efekty akcií. Do v11.4 Nástup: priznal nepriznané Cirhózy z odhadzovacieho balíčka. |
| Poľovník | Nástup (v10.4, Michal 2026-11-02): na **druhej strane lokality** (oproti strane, kde Poľovník leží — platí aj podstrčený) sa **spáli súperovo Zviera, ktoré je od lokality najďalej**. Súperovo = karta s tagom Zviera natočená k súperovi toho, kto Poľovníka zahral (aj Recidivista — Zviera aj Občan); vlastné Zvieratá nestrieľa. Povinné, bez voľby, hneď pri Nástupe (ako Dohadzovačka). Spálená karta ide navždy z hry, medzera sa uzavrie a spoje aj prevaha sa prepočítajú; na špaky sa už neráta (§14). Spálenie **nie je priloženie** — Konflikt ani Pasca sa nespustia. **Skrytú Záverečnú** nestrieľa (vyberie najvzdialenejšie z odkrytých); ako Záverečná či odpoveď na NA EX sa Poľovník vyhodnotí pri otočení a karty, ktoré sa otáčajú v tej istej chvíli, nestrieľa (keď prišiel, ležali lícom dole). Poldeci z NA EX na spálenej karte sa hneď vypije tomu, kto NA EX dal (ako v bitke, §9.5, s nerestou; Na zdravie nie). Dvojčatá nie sú Zviera; Kôň po spálení s Nástrojom spoj netvorí (Nástroj ostáva ležať, §12). Vo finále rovnako. Ak na druhej strane súperovo Zviera nie je, nič sa nestane. |
| Predavačka | Kšeft (v10.4, Michal 2026-11-02): za **1 cigaretu** si dober 1 kartu z doberacieho balíčka (keď je prázdny, zamieša sa odhadzovací; bez kariet v oboch sa Kšeft neponúka). Raz za Pitku ako každý Kšeft (§7); platba nie je fajčenie — nerest ani Krabička cigariet sa neráta, Jednota ju nezakazuje. |
| Vedúcko | Furt (v10.4, Michal 2026-11-02): **aktívne Roboty kariet, ktoré s ním susedia** (obe strany oboch susedov, aj súperových), sa rátajú ako **Pecky** majiteľa tej akcie (komu by patrila Robota) — Dlh nepália, dávajú 2 tuhé. Robota ostáva spárovaná a aktívna, len sa ráta ako Pecka: Posilnenie aj Forsáž ju zdvoja ako Pecku, Fúrik ani špak za Robotu bez Dlhu sa na ňu neuplatnia. **Hrana lokality nie je karta** — Robota lokality ostáva Robotou (ako pri Silnej nezávislej žene). Zrušená Robota ostáva zrušená. Robota premenená Profesionálnym tipérom je jeho premena, nie Robota karty. Lícom dole (Záverečná) sa ráta ako ostatné Furt efekty akcií (Silná nezávislá žena). |
| Dohadzovačka | Nástup (Michal 2026-10-28): keď ju hráč priloží k Občanovi alebo Starešinovi O2 (jej vnútorný sused, karta ktoréhokoľvek hráča), z **druhej strany lokality** sa **najvzdialenejší** (od lokality) Občan alebo Starešina opačného pohlavia ako O2 (Žena ↔ Chlap; karta ktoréhokoľvek hráča) presunie za Dohadzovačku — na vonkajší koniec jej strany. Príklad: „O1 … … O2“, Dohadzovačka za O2 → „… … O2 · Dohadzovačka · O1“. Presun je **povinný**, bez voľby. Karta ostáva svojho majiteľa a natočená k nemu, medzera na druhej strane sa uzavrie a spoje sa prepočítajú. Karta s oboma tagmi (Liberál) sa ráta ako oboje — ako O2 hľadá Ženu aj Chlapa, ako O1 sa hodí k obom. Presun **nie je priloženie**: Konflikt presunutej ani susednej karty sa nespustí a Pasca ho neráta. Skrytá Záverečná sa nepresúva (a ako O2 nerozhoduje); ako Záverečná sa Dohadzovačka vyhodnotí pri otočení. Ak O2 nemá Ženu ani Chlapa, nie je Občan ani Starešina, alebo na druhej strane nie je vhodný O1, nič sa nestane. Do 2026-10-28 Bitka: karta zo šenku za zmiešané spoje. |
| Sypač (id `kulturista`) | Podpora (v11.5, Michal 2026-11-03): keď sa priložením stretne s **tvojím Chlapom** (oboma smermi, §16 Podpora), ten má do konca kola **Rany ako Pecky** — každá jeho aktívna Rana (aj z premeny Šarlatána či Výtržníka) sa ráta ako Pecka (2 tuhé; Vidly ju nezosilnia, Boxer áno). Rany hrany lokality nie; Sypač sám seba nie. Pri ďalšom stretnutí sa nič nezmení. Do v11.4 Pitka: ako Výtržník mal Pecky namiesto Rán; do v10.2 Kulturista s Úplatkom. |
| Vymáhač | Bitka: za každé 2 tvoje priznané Dlhy Rana navyše (za každého Vymáhača). |
| Finančná poradkyňa | Pitka: Dlhy z jej akcií dostáva súper, nie majiteľ. |
| Svokra | Bitka: za každú kartu majiteľa (na ktorejkoľvek strane, aj Svokru samu), na ktorej leží súperov poldeci z NA EX, udelí súperovi Ranu; ráta sa aj zrážka (Výtržník), vlastné NA EX nie. Každá Svokra zvlášť. |
| Hasič | Nástup: z majiteľovho odhadzovacieho balíčka sa vytiahne náhodná karta (aj kliatba, aj Absťák); majiteľ si ju nechá v ruke, alebo ju vráti. Kým nerozhodne, hra čaká. Prázdny balíček = nič. |
| Šofér | Bitka (v11.5): ak si v tomto kole nedal NA EX, udelíš súperovi Pecku navyše (+2 tuhé) a **na začiatku bitky dostaneš 1 cigaretu** — za každého Šoféra. Do v11.4 bez cigarety. |
| Traktorista | Bitka (v sade v53 Traktorista, Chlap; id `traktoristka`, predtým Traktoristka): s prevahou v kraji, kde leží, Pecka navyše; bez nej dostaneš na začiatku bitky Dlh. |
| Podvodník | Konflikt (v11.5, Michal 2026-11-03): súper ti dá **1 cigaretu**; ak žiadnu nemá, získa **1 zadĺženie** (každé 2 = Dlh, §8 — Dlh hneď pri prahu). Oboma smermi (§16 Konflikt), každý Podvodník zvlášť. Do v11.4 Prehra: jeden tvoj priznaný Dlh prešiel k súperovi. |
| Praudovravec | Furt: Odpor na jeho spojoch neruší, ale ráta sa ako Posilnenie — zdvojí partnerovu akciu na spoji (§6), aj keď je to súperova akcia. |
| Kočovník | Furt: všetky jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (§6). |
| Dvojčatá | Furt: do prevahy sa rátajú za dvoch — aj pre bonus Ihriska (v8). Lesná cesta ráta len Zvieratá. |
| Silná nezávislá žena | Aktívne akcie tvojich kariet, ktoré s ňou susedia, sa rátajú dvakrát. |
| Zámočník | Aktívne akcie Nástrojov v jeho okolí sa rátajú dvakrát. |
| Veterán | Furt: NA EX na Veterána jeho aktívne akcie nezruší, ale zdvojí; neaktívne ostanú neaktívne. |
| Veštica | Prehra: porazený vymení jednu svoju kartu doberacieho balíčka za súperovu (§9.5b). |
| Degustátorka | Nástup: ak má súper viac plných poldeci ako ty, jeden sa mu otočí na vypitý (nie nerest ani pečeň). |
| Vandal | Nástup: lokalita sa otočí o 180° (hrany si vymenia kraje). |
| Kôň | Furt: Nástroj vedľa neho s ním tvorí spoj ako s Občanom. **Roboty Koňa pália o 1 Dlh viac** (v11.5): každá jeho aktívna Robota (s násobkami) spáli v kroku Exekútora o 1 priznaný Dlh viac; čo nemá čo spáliť, dá špak ako každá Robota (§11). Sčíta sa s Fúrikom. Vedľa Mäsiara ani jedno neplatí; Robota, ktorú Vedúcko ráta ako Pecku, nepáli. |
| Čierna mačka | (v8.3, P5 rozhodol Michal 2026-10-30) Furt: majiteľove Povery sa Vierou nerušia — v hádke dajú vždy mäkké (v10), súperova Viera ostáva na tuhé. |
| Strýko z Ameriky | Kšeft: za 2 cigarety Rana navyše v bitke kola. |
| **Starší** | Karta staršieho (boss) má v línii **len akcie**; schopnosť (raz za hru) má výhradne držiteľ väzňa (§10, v11.2). Do balíčka hráča sa dostane presvedčením (v11.4, §10). Znenia a spresnenia schopností sú v §10 (tabuľka Schopnosť väzňa); na karte stojí „Väzeň — raz za hru: …“. |
| **Nástroje** | Efekt Nástroja platí len v Dedičstve (§12). |
| Noviny | Dedičstvo: Hádka (v11.5, Michal 2026-11-03): keď vyhráš hádku (krok 1 bitky, §9.1; aj vo finále), súper **odhodí 1 náhodnú kartu z ruky** do svojho odhadzovacieho balíčka — za každé Noviny v Dedičstve. Remíza v hádke nič; súper s prázdnou rukou nič. Do v11.4 Dedičstvo: Prehra (Titulka): špaky za Dlhy víťaza navyše. |
| Krabička cigariet | Dedičstvo: Pitka: za každé 2 cigarety, ktoré súper v Pitke vyfajčí (rátajú sa zaplatené cigarety), si hneď doberieš 1 kartu. Nie je to nerest. |
| Pasca | Dedičstvo: Bitka: ak súper v tomto kole priložil kartu (akúkoľvek, aj lícom dole) k tvojej, udelíš mu **1 Ranu** navyše (v9.1 podľa textu karty od sady v36; predtým Pecku). |
| Puška | Dedičstvo (Michal 2026-10-30, mení v7 „+1 k Petelici“): keď by tvoju **prepojenú** Petelicu zrušil iný efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej (3 → 2; v súčtoch sa ráta ako Pecka). Prepojená = má na spoji partnera (aktívna len zo Vzbury nie); na karte so Vzburou (v11.1) sa Puška neuplatní — prepojená Petelica je tam neaktívna. súperove Hrable nemajú čo ukradnúť (zrušenie nenastalo); Výtržník akcie nezrušuje (mení na Rany) — Puška sa neuplatní; NA EX ďalej zdvojí neaktívne akcie karty, prepojená Petelica ostane na 2. Text karty v sade v53 už znie podľa tohto pravidla. |
| Náradie (v8.4) | Zapaľovač, Výherné žreby, Píšťalka, Hrable, Zrkadlo, Valaška, Telefón, Jogurt, Energeťák, Horoskop, Fúrik, Krištáľová guľa — §12, tabuľka Náradie. |
| Profesionálny tipér | Furt (v8.4): posilnené akcie na jeho spojoch (jeho strany a strany susedov k nemu) sa rátajú inak — súperove ako posilnený Hazard, tvoje ako posilnená Robota. Posilnená = ×2 z Posilnenia suseda na spoji, ktoré NA EX nezrušil, **alebo z Forsáže** (v10.4, Michal 2026-11-02; Forsáž, ktorú NA EX zrušil, nie); NA EX na Tipéra jeho Posilnenie aj premenu zruší. |
| Vidly | Dedičstvo: každá tvoja aktívna akcia Rana z vyložených kariet (aj hrany lokality) udelí o 1 poškodenie viac. Rany navyše z efektov kariet (Svokra, Pijan, Vymáhač, Strýko z Ameriky) Vidly nezosilnia (Michal 2026-10-27). |
| Výherný automat | Dedičstvo: tvoj prah Dlhu je o 1 vyšší (§8); v poslednej Pitke kola (pred bitkou) získaš 1 Dlh. |
| Svätý text | Dedičstvo: Hodnota tvojej Viery je o 1 vyššia. — Hodnota 2 platí len v tlmení tuhého (§9.3); Povery ruší Viera 1 : 1 ako každá — jedna Viera jednu Poveru, aj vylepšenú Horoskopom (Michal 2026-11-01, v10). |
| Vínko | Dedičstvo: ráta sa ako plný poldeci navyše (limit +1); vyložené v Zhromaždení platí **hneď** — zostávajúci limit sa zvýši o 1 (návrh #26 B, Michal 2026-10-28). Druhé Vínko limit nezvýši. Poldeci za cigarety dolievať nesmieš. |
| Nealko | Dedičstvo: tvoj prah Cirhózy je o 2 vyšší (sčíta sa s Krčmou). Poldeci, NA EX ani akciu Poldeci nemení. |
| Injekcia | Dedičstvo: NA EX smieš dať aj na Zviera. |

---

## 17. Slovník

| Pojem | Význam |
|---|---|
| Absťák | karta s tagom Kliatba (v9.1) za menej nerestí v kole, než je tvoja Chuť; ide do odhadzovacieho balíčka, nedá sa priznať, −1 tvoje tuhé za každú v balíčku; rozhoduje remízu; spáli ju Vízia (§8, §9.3, §9.4) |
| Chuť | verejné počítadlo hráča (v9.1), štart 0: latka nerestí na konci kola; potom väčšie z (Chuť, neresti) − 1 (§8) |
| Dlh | počítadlo priznaných Dlhov (v8.2, nie karta) — každé 2 zadĺženia z Hazardu = 1 Dlh; páli ho Exekútor, rozhoduje remízu v tuhom (§8, §11) |
| Hazard | akcia (kľúč `Dlh`, v8.2 premenovaná): zvýši zadĺženie o 1 (§2, §8) |
| Finále | posledná bitka o pinnacle lokalitu, hrá sa ako o každú inú; útočí zaostávajúci (menej špakov) (§14b) |
| Dedičstvo | Nástroj vyložený mimo línie za rastúcu cenu v cigaretách; platí jeho efekt Dedičstvo (§12) |
| Dobratie po bitke | 1 karta na začiatku každého ďalšieho kola; limit ruky nie je (§4) |
| Konflikt | spúšťač (v11.3): efekt karty, keď sa priložením ocitne vedľa súperovej karty — prikladáš ty alebo súper; Nástroj, NA EX, zrážka ani presun ho nespúšťajú (§6, §16) |
| Podpora | spúšťač (v11.3): zrkadlo Konfliktu — efekt karty, keď sa priložením stretne s inou kartou toho istého hráča (§6, §16) |
| Vyvolať Konflikt | priložiť kartu k súperovej ležiacej karte so spúšťačom Konflikt (§16) |
| Kšeft | spúšťač (v7): aktívny efekt za cenu, spustíš ho sám v Pitke, kým ju neskončíš, každú kartu raz za Pitku (§7) |
| Forsáž | Posilnenie + Posilnenie na spoji (v10.3): obe karty majú všetky aktívne akcie posilnené (×2); Nástroj nie, lokalita len hranu; NA EX na jedno z Posilnení ju zruší (§6) |
| Vzbura | Odpor + Odpor na spoji (v11.1): obe karty sa obrátia — nespojené akcie aktívne, spojené neaktívne; Odpor + Posilnenie: len karta s Odporom, navyše posilnená; NA EX na ňu nejde; Nástroj nie, lokalita len hranu (§6, §7) |
| Pakt | akcia (v7): na spoji sa správa ako akcia, s ktorou je v páre (§2) |
| Čiarky na účte | zadĺženie pod prahom Dlhu; od v7 neprepadá ani po Pitke, ani po kole (D6, §8) |
| Kraj | polovica línie od lokality, pomenovaná podľa hrany lokality (Krčma: pri výčape / pri dverách) (§6) |
| Línia | celý rad kariet v kole; lokalita v strede (§6) |
| NA EX | plný poldeci na Občana či Starešinu v línii, vybraný v Pitke skryto: zruší jeho aktívne akcie a zdvojí neaktívne (§7) |
| Nástup | vyhodnotenie pri zahraní karty |
| Nerest | len konzumácia (v9.1): Vypiť 1, NA EX 2, vyfajčená cigareta 1 — porovnávajú sa s Chuťou (§8) |
| Furt | platí, kým je karta odhalená kdekoľvek v hracom priestore |
| Odhodenie (odhodiť) | do odhadzovacieho balíčka hráča, ktorý kartu zahral — vráti sa do hry, keď sa doberací minie a odhadzovací zamieša; opak spálenia |
| Odpoveď na NA EX | po odkrytí za každé súperovo NA EX jedna karta z ruky do línie lícom dole, zadarmo a mimo limitu; najprv útočník, potom obranca na druhý kraj línie, obe sa otočia naraz (§7) |
| Pohoršenie | akcia: 2 mäkké poškodenie do hádky (v10); Viera ho nezruší (§2, §9.1) |
| Povera | akcia: 1 mäkké poškodenie do hádky (v10; s Horoskopom 2); ruší sa so súperovou Vierou 1 : 1 (§2, §9.1) |
| Mäkké poškodenie | Pohoršenie × 2 + zvyšné Povery × sila Povery; tuhé nerobí, rozhoduje len hádku (v10, §9.1) |
| Hádka | spúšťač (v11.5, Noviny): efekt, keď sa v bitke rozhodne hádka. Krok bitky (v10, v11): kto má viac mäkkého, vyhral hádku o rozdiel („Ana vyhrala hádku o 3“); po bodovaní ho rozdelí na svoje reči (1 / 2 / 3 za stupeň), vo finále 1 : 1 na špaky (§9.1) |
| Reči | druhý marker hráča pri staršom na tej istej stupnici, vždy nad jeho strachom; dvíha ich hádka a Predsedova vila, bodujú aj porazenému, po bodovaní klesnú o stupeň, priazeň nedávajú (§10, v11) |
| Strach | marker hráča pri staršom 0–3 — ako veľmi sa ho starší bojí; neklesá; dvíha ho Nakladačka; priazeň = strach súpera − tvoj strach (§10, v11) |
| Partia | všetky karty natočené k hráčovi (jeho karty), na ktorejkoľvek strane (§6) |
| Zajatie | pri rozdelení Nakladačky za 5 bodov staršieho, pri ktorom je tvoj strach 3 už pred touto Nakladačkou (od minulého kola; dotiahnutý v tom istom rozdelení nestačí, v11.6): väzeň, krádež špakov; vo finále nie (§9.4, §10, v11.4; v9–v11.3 pokus o zajatie v drafte) |
| Presvedčenie | pri rozdelení hádky za 5 bodov staršieho, pri ktorom má súper vyšší strach, keď sú tvoje reči na červenej: reči zaniknú, priazeň ostáva, jeho karta natrvalo do tvojho balíčka; kto prvý, toho je (§9.1, §10, v11.4) |
| Väzeň | zajatý starší v priznaných kartách držiteľa („v pivnici“) — nedáva priazeň ani strach, držiteľ má jeho schopnosť (raz za hru); ráta sa ako jeho červená; väzni na výhru podľa ligy (2 / 3 / 4); pri zajatí krádež špakov (v11) |
| Boss | karta staršieho: 6 akcií, 2 blokované sloty, 1 neresť; v línii len akcie; do balíčka hráča ju dá presvedčenie (§10, §16) |
| Schopnosť väzňa | schopnosť zajatého staršieho; jeho držiteľ ju použije raz za hru vo svojom ťahu, potom je minutá a väzeň ostáva v pivnici (§10, v11.2; Kšeft väzňa v9–v11.1 zanikol) |
| Nástenka | krčmová nástenka: odohrané bitky s víťazom a špakmi (§14) |
| Náradie | balíček kariet s tagom Nástroj lícom dole; pri stavbe šenku z neho každý dostane 2 karty (§3, §5) |
| Občania | balíček všetkých ostatných kariet šenku lícom dole; pri stavbe šenku z neho každý dostane 6 kariet (§3, §5) |
| Nakladačka | (predtým prebytok, v8.3) rozdiel tuhého poškodenia v bitke, drží a rozdeľuje ju víťaz na svoj strach (1 / 2 / 3 za stupeň, zvyšok prepadne); vo finále 1 : 1 na špaky (§9.4, v11) |
| Preskúmanie | zober a prezri si 5 kariet, potom ich vráť |
| Prevaha | v kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov (Nástroje, Cirhóza nie); pri rovnosti hráč, ktorého karta v tom kraji leží hneď pri lokalite; dostane akcie hrany lokality v tom kraji (§6) |
| Priznanie | vyloženie kliatby mimo línie natrvalo; nemíňa limit ani neodovzdá ťah (§11) |
| Sekera | bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch); jej špaky (karty v línii) berie víťaz najbližšej bitky, vo finále prepadnú (§9.4) |
| Špak | za bitku (karty v línii), za udržaný strach starších, výkupné zvyšných poldeci a cigariet; mínus Exekútor a nepriznaná Cirhóza; po finále vyhrá, kto má viac (§14) |
| Stupeň | poloha markera (strachu či rečí) na stupnici staršieho: 0 sivá, 1 žltá, 2 oranžová, 3 červená; cena vstupu 1 / 2 / 3, špaky po bitke 1 / 3 / 5 (§10, v11) |
| Stav staršieho | stupeň staršieho pre hráča: pokojný (0), znepokojený (1), vystrašený (2), vydesený (3) — vrchol jeho stupnice, strach + reči; do priazne, výhry strachom a zajatia sa ráta len strach (§10, Michal 2026-11-02) |
| Od seba / k sebe | smer posunu markera na stupnici; od seba staršieho desí, k sebe upokojuje (§10) |
| Zaplatený / držaný stupeň | stupeň, ktorý starší už zaplatil, a stupeň, na ktorom marker stál na konci minulého kola a neustúpil; ústup ich zmaže (§10) |
| Strana | polovica línie od lokality — tvoja a súperova (§6) |
| Šenok | ponuka kariet lícom nahor; obaja vidia, čo berú (§5) |
| Útočník / obranca | útočník je **porazený z minulej bitky** (v prvom kole náhodne, pri sekere ostáva; vo finále menej špakov, §14b) — vykladá prvý a na NA EX odpovedá prvý (lícom dole); obranca je víťaz minulej bitky — volí a natáča cieľ, berie zo šenku prvý (na prvom ťahu 1 kartu, v9.2), na NA EX odpovedá druhý na druhý kraj línie; Pitku hrajú obaja naraz (§4, §7) |
| Výtržník | karta, na ktorú obaja dali NA EX v tej istej Pitke (zrážka): všetky jej akcie sú aktívne Rany pre majiteľa, len počas jednej bitky (§7) |
| Vypiť | otočiť plný poldeci na vypitý: limit −1, pečeň +1, ďalšia karta v tom istom ťahu (§13) |
| Výkupné | po finále 1 špak za každý plný poldeci a 1 špak za každých celých 5 cigariet, bez stropu (§14) |
| Záverečná | karta lícom dole za cigaretu, ukončí vykladanie v Zhromaždení; otočí sa na konci Pitky (§13) |
| Spálenie (spáliť) | karta ide navždy z hry, nevracia sa do žiadneho balíčka (v10.4, Michal 2026-11-02; predtým „zahodenie“). Spálený Dlh zmizne z počítadla (Robota, Exekútor). Opak odhodenia |
