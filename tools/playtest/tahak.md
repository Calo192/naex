# Ťahák — platné pravidlá NA EX!

Spoločný ťahák AI hráčov (`naex-playtester`, `naex-protihrac`) — čítajú ho pri
príprave pred partiou. Podrobne v `docs/PRAVIDLA.md` (zmeny v jeho úvode). Pri
rozpore s `docs/PRAVIDLA.md` platí `docs/PRAVIDLA.md` a rozpor zapíš do
`nezrovnalosti.md`. Po zmene pravidla ho aktualizuje Developer — jediné miesto;
čísla stráži test `packages/core/test/tahak.test.ts`.

- **Dĺžka hry** = počet lokalít (krátka 5, stredná 7, dlhá 11). Výpis klienta
  ukazuje, o koľko lokalít sa hrá a koľko je ovládnutých.
- **Štart:** 5 kariet v ruke, 2 plné poldeci, 3 cigarety (Michal 2026-10-20).
- **Každú kartu** môžeš vyložiť na koniec **svojej aj súperovej strany**
  (`target` `vlastna` / `superova`). Karta **patrí tomu, kto ju zahral** — akcie
  aj efekty sa rátajú majiteľovi, nech leží kdekoľvek. Podstrčený „sabotér"
  s Odporom zruší súperovi akciu na spoji. Každá karta okrem Nástroja míňa limit
  vykladania (aj Kočovník).
- **Názvoslovie:** línia = celý rad; lokalita ju delí na dve **strany** (tvoja,
  súperova). **Tvoja partia** = všetky tvoje karty, na ktorejkoľvek strane.
  Akcie: Dlh, Poškodenie pečene, Poldeci, Cigareta (nie Hazard, Pečeň,
  Poldecko, Cigaretka).
- **Viac kariet v jednom ťahu Zhromaždenia:** prvá je zadarmo, **každá ďalšia
  stojí plný poldeci** (Vypiť: limit −1, pečeň +1, nerest) — dve karty za sebou
  potrebujú limit aspoň 3. V klientovi príkaz
  `{"type":"tah","kroky":[…]}` (priznania, potom karty a pred každou okrem
  poslednej `{"type":"vypit"}`), alebo jednotlivé `place` / `vypit`.
- **Pitky:** Pitiek v bitke = **1 + menší počet aktivovaných akcií lokality**
  z jej dvoch strán (1–4). Pred každou
  Pitkou je Zhromaždenie. Počet sa mení s líniou — výpis ho ukazuje. „Ešte
  jednu!“ už neexistuje.
- **Prevaha (2026-10-20):** akcie hrany lokality dostane, kto má v tej
  polovici línie (kraji) **viac svojich Občanov, Zvierat a Starešinov** (Nástroje a Cirhóza nie); pri rovnosti
  majiteľ karty pri lokalite. Jedna podstrčená karta hranu neukradne. Kraje
  majú mená podľa lokality (Krčma: pri výčape / pri dverách). **Pasca**
  (Dedičstvo): každé súperovo Zviera v línii mu uberie 1 tuhé.
  Nové karty (po zverejnení): **Presbiter** — sám proti súperovej prevahe
  v kraji zoberie súperovi toľko Viery, koľko má aktívnych akcií;
  **Dvojčatá** — do prevahy sa rátajú za dvoch.
- **Poradie (2026-10-20):** cieľ kola vyberá a natáča **obranca** (víťaz
  poslednej bitky); **útočník** (porazený) berie zo šenku prvý a **vykladá
  prvý**; v Pitke začína obranca — jeho „hotovo“ je nevratné a zapíše sa
  do logu, útočník potom má **posledné slovo** (2026-10-21).
- **Lokality (2026-10-20)** — efekt platí v kole o ňu: Krčma (s plným
  poldeci povinné NA EX), Kostol (nikto nevypije ani nedá NA EX — v ťahu
  1 karta), Benzínka (nikto nefajčí), Zastávka (spoločný limit = súčet
  limitov), Lesná cesta (+1 tuhé za tvojho Občana/Zviera/Starešinu v súperovom kraji, max +2),
  Ihrisko (+2 tuhé za každý kraj, kde máš viac svojich Občanov, Zvierat a Starešinov), Zberný
  dvor (raz za Pitku `vykup`: cigareta → karta z odhadzovacieho do ruky),
  Most (len na vlastnú stranu), Cintorín (porazený `cintorin`: Nástroj
  z ruky do Dedičstva zadarmo), Obecný úrad (prah Exekútora −4, Robota
  spáli 2 Dlhy), Jednota (barter −1), Kultúrny dom (Pohoršenie bez limitu
  dvoch hraníc zón), Vínna pivnica (NA EX 2× za Pitku), Družstvo (Pracujúci
  nemíňajú limit). Nové lokality prídu do hry so zverejnením sady.
- **Draft:** stavba šenku naraz, bez podávania: z N kariet dáš **polovicu do šenku
  a polovicu naspodok** (`{"type":"stavbaSenku","doSenku":[…],"odhod":[…]}`, pri 8 kartách 4 + 4)
  — vyberáte naraz. Po braní sa šenok sám doplní na 8 z vrchu spoločného balíčka. Branie striedavo, začína útočník: **1 karta za 1 cigaretu,
  2 karty za 3 cigarety** (`{"type":"draftBer","uids":[…]}`); poldeci sa
  v šenku neplatí; `draftStop` ukončí branie.
- **Ruka bez limitu:** po každej bitke si dobereš **2 karty**; nič neodhadzuješ.
  Karty navyše: šenok, fajčenie (`smoke`: cigareta = karta hneď, v Zhromaždení
  aj v Pitke), priznanie kliatby, Vízia, efekty.
- **Kliatby (verejný dlh, 2026-10-21):** nový **Dlh sa hneď prizná** (kartu zaň
  nedobereš) a na konci hry uberá body **aj priznaný**; Dlh podstrčený do balíčka
  (Vychovávateľka) sa pri dobratí prizná sám. Nová **Cirhóza ide navrch tvojho
  doberacieho balíčka**; priznáš ju, keď chceš, ale kartu za ňu **nedobereš** a súper za každú
  priznanú dostane v bitke +1 tuhé (nepriznaná −2 body na konci). Počet súperových
  nepriznaných kliatob je verejný (stav ho ukazuje), body súpera sú presné. Dlh sa sám nepáli (2026-10-22) — spáli ho len Robota,
  Dievčina na vydaj, Niekoho stryná a Veľmi smútiaca vdova; Milujúca manželka
  a Absťák kartu dajú. Kliatba do línie nepatrí (len Milujúca manželka). Priznanie nemíňa
  limit ani neodovzdá ťah. Priznaný Dlh sa ráta k Exekútorovi.
- **Vízia:** na konci Pitky za každú aktívnu Víziu uvidíš vrchnú kartu svojho
  balíčka — `{"type":"vizia","vziat":true}` do ruky, alebo `false` = zahodiť
  (navždy z hry; balíček pod 5 kariet = prehra).
- **Dedičstvo** (Nástroj do hracej oblasti, `target` `dedicstvo`): cena rastie
  pre oboch spolu — 1., 2., 3. Nástroj v hre stojí 1, 2, 3 cigarety. Efekt
  Nástroja platí **len v Dedičstve**.
- **Nástroj v línii** tvorí spoj len s Občanom/Starešinom a jeho akcie dostane
  **majiteľ karty, s ktorou tvorí spoj** (podstrčený Nástroj pracuje pre
  súpera).
- **NA EX na Občana alebo Starešinu v línii — svojho aj súperovho.** Zruší
  karte aktívne akcie a zdvojí neaktívne; akcie sa rátajú majiteľovi karty.
  Pečeň +1 je tvoja. Súper smie hneď odpovedať jednou kartou mimo limitu
  (`place` / `bezReakcie`). Nie na Liberála, nie na súperovho Anonymného
  alkoholika a jeho susedov. Svokra súpera ti za NA EX zoberie 2 cigarety.
  Krčma vynúti NA EX. Násobky sa **násobia** (NA EX × Silná žena = ×4, aj Dlh
  a Poškodenie pečene) a NA EX leží na karte do bitky — vyhodnotí sa v každej
  Pitke kola. Každá možnosť `naex` v stave ukazuje cenu: bitku pred a po
  a kliatby (Cirhóza, Dlh) aj s bodmi pre oboch.
- **Doliatie** v Pitke: 2 cigarety → vypitý poldeci späť na plný (nie s Vínkom
  v Dedičstve). **Barter:** 5 cigariet → nový plný poldeci. Na začiatku kola sa
  jeden vypitý poldeci doleje sám.
- **Pečeň a zadĺženie žijú len v Pitke** — vyhodnotia sa v nej a potom sa
  vynulujú. Za **každý celý prah** jedna kliatba (zadĺženie 8 pri prahu 2 = 4 Dlhy).
  Riadok „VÝHĽAD PITKY“ v stave ukazuje, čo pripíšu karty na stole a koľko kliatob z toho bude.
- **Absťák:** na konci kola, ak máš menej nerestí než minule (s odhalenou
  Milujúcou manželkou aj pri rovnosti, dve = aj o 1 viac). Viac nerestí →
  jeden Absťák odíde.
- **Bodovanie:** každá aktívna podmienka scorecardu boduje obom hráčom; za kus
  lokality a získaní starší 2, cigarety 1 za každé 3, mínus každý Dlh (aj
  priznaný) a nepriznané Cirhózy; Znepokojenie / Strach / Vydesenie za každého staršieho, ktorý sa
  ťa bojí. Marker určuje **priazeň** (komu je posunutý) a koho sa starší bojí.
- **Priazeň** sila 1 / 2 / 3 podľa zóny; väčšina dáva 2 × sila. Úžerník: prah
  Dlhu 2 + sila (3 / 4 / 5); Fajčiar +1 / +2 / +3 cigarety v 1. Pitke.
- **Patronát (2026-10-20, nahradil bitku o staršieho):** po braní zo šenku
  (útočník, potom obranca; `patronat` / `bezPatronatu`) si smieš vziať do ruky
  staršieho, ktorý ti **prejavuje priazeň** (marker aspoň v žltej na tvojej
  polovici, pôvodný starší). Na jeho scorecard dáš lícom dole Občana/Zviera
  z ruky, marker ide do stredu. Platíš cigarety do červenej (žltá 2, oranžová 1,
  červená 0), súper dostane v bitke Pohoršenia navyše (o koľko marker išiel do
  stredu: 2 / 3 / 4). Treba mať aspoň 1 poldeci. Kartu staršieho smieš v kole
  vyložiť. **Výhra** = lokalita aj starší (náhrada sa otočí); **prehra** = starší
  sa vráti, náhrada do ruky a **odhodíš poldeci** natrvalo. Patronát je jediná
  obrana proti vydeseniu (uvoľní krajnú pozíciu).
- **Pohoršenie (2026-10-20):** ten istý marker smieš posunúť aj viackrát, tvoje
  Pohoršenia ho však prenesú najviac cez **dve hranice zón** (pravá sivá → ľavá
  oranžová áno) a nikdy nie na krajnú pozíciu (okrem Novín).
- **Remíza (na sekeru, 2026-10-21):** pri rovnakom tuhom nevyhrá nikto —
  lokalita ide **na sekeru** a vezme si ju víťaz najbližšej bitky (v poslednej
  bitke prepadne); útočník ostáva, patronát = prehra. Celkové určuje už len prebytok. **Ohlásené vydesenie:** polovicu starších treba
  udržať do konca ďalšieho kola. **Cigarety za prebytok** dostane ten, proti
  komu sa prebytok delil.
