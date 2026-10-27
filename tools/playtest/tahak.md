# Ťahák — platné pravidlá NA EX! (v6, od 2026-10-26; dávka v6.1 z 2026-10-27)

Spoločný ťahák AI hráčov (`naex-playtester`, `naex-protihrac`) — čítajú ho pri
príprave pred partiou. Podrobne v `docs/PRAVIDLA.md` (zmeny v jeho úvode). Pri
rozpore s `docs/PRAVIDLA.md` platí `docs/PRAVIDLA.md` a rozpor zapíš do
`nezrovnalosti.md`. Po zmene pravidla ho aktualizuje Developer — jediné miesto;
čísla stráži test `packages/core/test/tahak.test.ts`.

- **Špaky (v6, 2026-10-26) = víťazné body.** Vyhrá, kto má po finále viac špakov.
  **Víťaz bitky** dostane špaky = odohrané Pitky kola (finále 3), o rozdiel Absťákov
  menej, ak ich má viac než porazený (aspoň 1); lokalitu si **neberie** (ide na nástenku).
  **Len víťazovi bitky** (aj finále; v6.1, 2026-10-27) dá potom každý starší, ktorý sa ho bojí,
  špaky: žltá 1, oranžová 2, červená 3 (sivý nikomu). **Porazený za starších nedostane nič**;
  pri **sekere** ich dostanú obaja. Nepriznaná Cirhóza na konci
  **−5 špakov za kus** (ruka aj oba balíčky). Exekútor berie špaky (nižšie). Špaky
  smú ísť do mínusu; výpis ich ukazuje pri oboch hráčoch aj nástenku bitiek.
- **Dĺžka hry** = počet bitiek o lokality (krátka 3, stredná 5, dlhá 7) a potom
  **finále** (bez lokality).
- **Štart (v6):** 4 karty v ruke (1 Miňištrant, 1 Milujúca manželka, 1 Pijan, 1 Dievčina na vydaj), doberací balíček prázdny;
  2 plné poldeci, 3 cigarety, 0 špakov. Kým nemáš odhadzovací balíček, ťahať ani fajčiť sa nedá.
- **Finále:** útočí, kto má **viac špakov** (pri rovnosti porazený poslednej bitky,
  po sekere ostáva útočník); cieľ sa nevyberá, šenok a patronát áno. **Prvá vyložená
  karta leží v strede** a ďalšie sa kladú na jej dve strany; kraje ani prevaha nie sú.
  Finále má vždy 3 Pitky. Po finále sa prebytok nerozdeľuje — držiteľ dostane toľko
  špakov.
- **Každú kartu** môžeš vyložiť na koniec **svojej aj súperovej strany**
  (`target` `vlastna` / `superova`). Karta **patrí tomu, kto ju zahral** — akcie
  aj efekty sa rátajú majiteľovi, nech leží kdekoľvek (výnimky: Nástroj, Kočovník — nižšie). Podstrčený „sabotér"
  s Odporom zruší súperovi akciu na spoji. Každá karta okrem Nástroja míňa limit
  vykladania (aj Kočovník). **Limit = plné poldeci + 1** — NA EX limit nemíňa, ale
  jeho poldeci na karte sa neráta (v4), takže v ďalšom Zhromaždení kola máš limit o 1 nižší.
- **Pas** (`pass`): do Pitky už nevykladáš; dostaneš 1 cigaretu za každú kartu, ktorú
  si ešte smel vyložiť, **najviac toľko, koľko máš kariet v ruke** (v6.1) — s prázdnou
  rukou nič.
- **Názvoslovie:** línia = celý rad; lokalita ju delí na dve **strany** (tvoja,
  súperova). **Tvoja partia** = všetky tvoje karty, na ktorejkoľvek strane.
  Akcie: Dlh, Poškodenie pečene, Poldeci, Cigareta (nie Hazard, Pečeň,
  Poldecko, Cigaretka).
- **Viac kariet v jednom ťahu Zhromaždenia:** prvá je zadarmo, **každá ďalšia
  stojí plný poldeci** (Vypiť: limit −1, pečeň +1, nerest) — dve karty za sebou
  potrebujú limit aspoň 3. V klientovi príkaz
  `{"type":"tah","kroky":[…]}` (priznania, potom karty a pred každou okrem
  poslednej `{"type":"vypit"}` — pri dvoch kartách **vypit, karta, karta**; „karta,
  vypit, karta“ server odmietne), alebo jednotlivé `place` / `vypit`.
- **Pitky:** Pitiek v bitke = **1 + menší počet aktivovaných akcií lokality**
  z jej dvoch strán (1–4); Odpor na hrane lokality sa ráta, akcia hrany zrušená
  Odporom karty nie. Pred každou
  Pitkou je Zhromaždenie. Počet sa mení s líniou — výpis ho ukazuje. „Ešte
  jednu!“ už neexistuje.
- **Prevaha (2026-10-20):** akcie hrany lokality dostane, kto má v tej
  polovici línie (kraji) **viac svojich Občanov, Zvierat a Starešinov** (Nástroje a Cirhóza nie); pri rovnosti
  hráč, ktorého karta v tom kraji leží hneď pri lokalite (vyložená ako prvá) — nie
  „majiteľ lokality“. Jedna podstrčená karta neukradne akcie hrany, ale tvorí
  s nimi spoj: ako prvá karta pri lokalite určuje, ktoré akcie hrany sa
  aktivujú (dostane ich hráč s prevahou). Kraje
  majú mená podľa lokality (Krčma: pri výčape / pri dverách). **Pasca**
  (Dedičstvo): každé súperovo Zviera v línii mu uberie 1 tuhé.
  Nové karty (po zverejnení): **Presbiter** — sám proti súperovej prevahe
  v kraji zoberie súperovi toľko Viery, koľko má aktívnych akcií;
  **Dvojčatá** — do prevahy sa rátajú za dvoch; **Kočovník** — Furt: jeho akcie
  (aj Rana, Dlh, Poškodenie pečene) sa počítajú hráčovi, ktorý má v jeho kraji
  prevahu; do prevahy sa ráta majiteľovi, pri rovnosti rozhoduje karta pri lokalite.
- **Poradie (2026-10-20):** cieľ kola vyberá a natáča **obranca** (víťaz
  poslednej bitky); **útočník** (porazený) berie zo šenku prvý a **vykladá
  prvý**; v Pitke začína obranca — jeho „hotovo“ je nevratné a zapíše sa
  do logu, útočník hrá po ňom (2026-10-21). **NA EX naraz (v5):** NA EX vyberáte
  skryto — súper nevidí, či a kam ste ho dali; odkryje sa, keď ste hotoví obaja
  (najprv obrancovo). Potom odpovede: najprv obranca, útočník má **posledné slovo**.
- **Lokality (2026-10-20)** — efekt platí v kole o ňu: Krčma (s plným
  poldeci povinné NA EX; prah Cirhózy obom +2), Kostol (nikto nevypije ani nedá NA EX — v ťahu
  1 karta), Benzínka (nikto nefajčí), Zastávka (spoločný limit = súčet
  limitov; pas dá cigarety len za tvoj vlastný zvyšok limitu), Lesná cesta (+1 tuhé za tvojho Občana/Zviera/Starešinu v súperovom kraji, max +2),
  Ihrisko (+2 tuhé za každý kraj, kde máš viac svojich Občanov, Zvierat a Starešinov), Zberný
  dvor (raz za Pitku `vykup`: cigareta → karta z odhadzovacieho do ruky),
  Most (len na vlastnú stranu), Kar (na začiatku bitky `{"type":"kar","uid":…|null}`: zahoď
  jednu nepriznanú Cirhózu z ruky), Cintorín (porazený `cintorin`: Nástroj
  z ruky do Dedičstva zadarmo), Obecný úrad (prah Exekútora −4, Robota
  spáli 2 Dlhy), Jednota (barter −1), Kultúrny dom (v6: prebytok sa
  nerozdeľuje — držiteľ dostane toľko špakov), Vínna pivnica (NA EX 2× za Pitku), Družstvo (Pracujúci
  nemíňajú limit). Nové lokality prídu do hry so zverejnením sady.
- **Draft:** stavba šenku naraz, bez podávania: z N kariet dáš **polovicu do šenku
  a polovicu naspodok** (`{"type":"stavbaSenku","doSenku":[…],"odhod":[…]}`, pri 8 kartách 4 + 4)
  — vyberáte naraz. Po braní sa šenok sám doplní na 8 z vrchu spoločného balíčka. Branie striedavo, začína útočník: **1 karta za 1 cigaretu,
  2 karty za 3 cigarety** (`{"type":"draftBer","uids":[…]}`); poldeci sa
  v šenku neplatí; `draftStop` ukončí branie.
- **Ruka bez limitu:** po každej bitke si dobereš **2 karty**; nič neodhadzuješ.
  Karty navyše: šenok, fajčenie (`smoke`: cigareta = karta hneď, **len v Pitke**
  (v5), v Zhromaždení nie; s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť
  nedá), priznanie kliatby, Vízia, efekty. Malý balíček prehru nespôsobí (v5).
  Keď sa doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový
  doberací balíček (pri každom ťahaní).
- **Kliatby (verejný dlh, 2026-10-21):** nový **Dlh sa hneď prizná** (kartu zaň
  nedobereš); priznané Dlhy idú k Exekútorovi a pri remíze v bitke prehráva viac Dlhov; Dlh podstrčený do balíčka
  (Vychovávateľka) sa pri dobratí prizná sám. Nová **Cirhóza ide do tvojho
  odhadzovacieho balíčka** (2026-10-25) — do ruky príde, až keď sa doberací balíček minie a odhadzovací
  sa zamieša; priznáš ju, keď chceš, ale kartu za ňu **nedobereš** a súper za každú
  priznanú dostane v bitke +1 tuhé (nepriznaná ide po bitke do tvojho odhadzovacieho balíčka; na konci hry −5 špakov za kus)
  — prizná ju hneď, alebo riskuješ, že sa ti do konca nevráti do ruky. Kým ju nepriznáš, súper za ňu tuhé
  nedostáva a na Pohreb ju nemáš. Počet súperových
  nepriznaných kliatob je verejný (stav ho ukazuje). Dlh sa sám nepáli (2026-10-22) — spáli ho len Robota,
  Dievčina na vydaj, Niekoho stryná a Veľmi smútiaca vdova; Milujúca manželka
  a Absťák kartu dajú. Kliatba do línie nepatrí (len Milujúca manželka). Priznanie nemíňa
  limit ani neodovzdá ťah. Priznaný Dlh sa ráta k Exekútorovi.
- **Záverečná (Zhromaždenie, za 1 cig.):** `{"type":"zaverecna","uid":…,"target":"vlastna"|"superova"}` —
  karta lícom dole, míňa limit, potom už v Zhromaždení nevykladáš (bez cigariet za pas). Súper ju
  nevidí, za ňu nepriloží (ani odpoveď na NA EX), NA EX na ňu smie len on (prejde vždy). Otočí
  sa na konci Pitky — až vtedy Nástup a efekty ako Svokra.
- **Pohreb (po bitke, s priznanou Cirhózou):** `pohreb` spáli Cirhózu a tvoju kartu
  z línie; za Závislého smieš pridať `senokUid` = karta zo šenku do ruky. Liečba už nie je (v4).
- **Živnostník (Výhra, 2026-10-26):** keď vyhráš bitku so Živnostníkom vo svojej partii, vyberieš
  jedno súperovo Dedičstvo, ktoré sa zahodí — `{"type":"zivnostnik","uid":…}`; každý Živnostník jedno.
  Pri Nástupe nerobí nič.
- **Vízia:** na konci Pitky za každú aktívnu Víziu uvidíš vrchnú kartu svojho
  balíčka — `{"type":"vizia","vziat":true}` do ruky, alebo `false` = zahodiť
  (navždy z hry).
- **Hrobár a Poštárka (2026-10-22):** keď zahodíš kartu — efektom, Víziou, aj
  Pohrebom po bitke —, súperov Hrobár dostane cigaretu za každú.
  Poštárka dá Dlh len za naozaj dobratú kartu; s prázdnym doberacím aj
  odhadzovacím balíčkom sa použiť nedá.
- **Dedičstvo** (Nástroj do hracej oblasti, `target` `dedicstvo`): cena rastie
  pre oboch spolu — 1., 2., 3. Nástroj v hre stojí 1, 2, 3 cigarety. Efekt
  Nástroja platí **len v Dedičstve**.
- **Nástroj v línii** tvorí spoj len s Občanom/Starešinom a jeho akcie dostane
  **majiteľ karty, s ktorou tvorí spoj** (podstrčený Nástroj pracuje pre
  súpera).
- **NA EX na Občana alebo Starešinu v línii — svojho aj súperovho**, len na kartu
  s aspoň 1 aktívnou a aspoň 1 neaktívnou akciou (2026-10-23; súperova Záverečná vždy). Zruší
  karte aktívne akcie a zdvojí neaktívne; akcie sa rátajú majiteľovi karty.
  Pečeň +1 je tvoja. Súper smie hneď odpovedať jednou kartou mimo limitu
  (`place` / `bezReakcie`) — odpoveď smie zmeniť prevahu v kraji aj počet Pitiek. Nie na Liberála, nie na súperovho Anonymného
  alkoholika (jeho susedov nechráni), nie na kartu, na ktorej už poldeci leží. NA EX na kartu
  pri lokalite mení len akcie karty, akcie hrany lokality ostávajú aktívne. NA EX na kartu
  s Posilnením zruší Posilnenie aj ×2 partnera na spoji (2026-10-24; partner ostáva ×1,
  aj hrana lokality). Akcia zrušená Odporom nie je ani aktívna, ani neaktívna — NA EX ju
  nezdvojí (v6.1). Dievčina na vydaj
  ráta aj akcie zdvojené cez NA EX; jej akcie v bitke, v ktorej sa zahodí, ešte platia. Svokra súpera ti za NA EX zoberie 2 cigarety.
  Šofér: NA EX na kartu vedľa neho neaktívne akcie nezdvojí (aktívne zruší). Snúbenica
  vyložená vedľa karty s NA EX (aj ako odpoveď) ju vráti majiteľovi do ruky a ľahne na jej miesto. Veterán (v4): NA EX mu aktívne akcie zdvojí
  (nezruší), neaktívne nechá.
  **Skryto (v5):** `naex` súper nevidí do odkrytia; odpovedáš po odkrytí za každé súperovo NA EX,
  najprv obranca, potom útočník. **Zrážka** (obaja na tú istú kartu) = **Výtržník**: karta sa
  spáruje so susedmi s pôvodnými akciami, potom sú všetky jej akcie aktívne Rany pre majiteľa,
  do konca bitky — aj jej Posilnenie je už len Rana a suseda nezdvojuje (v6.1); pečeň, poldeci, Svokru aj Výpalné platí každý za svoje NA EX.
  Krčma vynúti NA EX. Násobky sa **násobia** (NA EX × Silná žena = ×4, aj Dlh
  a Poškodenie pečene) a NA EX leží na karte do bitky — vyhodnotí sa v každej
  Pitke kola. Každá možnosť `naex` v stave ukazuje cenu: bitku pred a po
  a kliatby (Cirhóza, Dlh) aj so špakmi pre oboch.
- **Doliatie** v Pitke: 2 cigarety → vypitý poldeci späť na plný (nie s Vínkom
  v Dedičstve). **Barter:** 5 cigariet → nový plný poldeci. Na začiatku kola sa
  jeden vypitý poldeci doleje sám.
- **Pečeň a zadĺženie žijú len v Pitke** — vyhodnotia sa v nej a potom sa
  vynulujú. Za **každý celý prah** jedna kliatba (zadĺženie 8 pri prahu 2 = 4 Dlhy).
  Riadok „VÝHĽAD PITKY“ v stave ukazuje, čo pripíšu karty na stole a koľko kliatob z toho bude.
- **Absťák:** na konci kola, ak máš menej nerestí než minule (s odhalenou
  Milujúcou manželkou aj pri rovnosti, dve = aj o 1 viac). Viac nerestí →
  jeden Absťák odíde. Absťáky, ktoré **práve máš**, uberajú víťazovi špaky za bitku
  (o rozdiel oproti porazenému) a pri remíze v tuhom prehráva, kto ich má viac.
- **Stupnica (v6):** 7 polí 3-2-1-0-1-2-3, jedno sivé. Marker určuje **priazeň**
  (komu je posunutý, sila 1 / 2 / 3) a koho sa starší bojí (špaky po bitke, ktorú ten vyhrá).
  Scorecard nesie už len priazeň, bodovacie podmienky nie sú.
- **Priazeň (v5)** sila 1 / 2 / 3 podľa zóny, bez dvojnásobku: Bitkár +1 / +2 / +3
  tuhého; Kmotor po bitke −1 / 2 / 3 priznaného Dlhu; Abstinent +1 / +2 / +3
  Pohoršenia v bitke; Exekútor: súperov prah Exekúcie −1 / 2 / 3; Výpalník
  (Výpalné): za každé súperovo NA EX ti dá 1 / 2 / 3 cigarety; Fajčiar +1 / +2 / +3
  cigarety po braní zo šenku (Obmedzenie ich neuberá); Alkoholik (Na zdravie
  „do dna“): 1 / 2 / 3 poldeci z tvojho NA EX za kolo sa vráti plných; Veriaci
  +1 / +2 / +3 Viery. Prah Dlhu 2 (každé 2 zadĺženia = 1 Dlh), prah Cirhózy 3, prah Exekúcie 10 (so súperovým Exekútorom 9 / 8 / 7, Obecný úrad −4).
- **Exekútor (v6):** kto má priznaných Dlhov aspoň na prahu, tomu zhorí **polovica
  Dlhov (nadol) a rovnako veľa špakov** — Nástroj sa neodovzdáva, prehra nie je.
  Záhradkár: smieš ho zahodiť namiesto špakov (`{"type":"zahradkar","zahodit":true|false}`),
  Dlhy zhoria aj tak. **Noviny** (Dedičstvo, v6): +1 špak po bitke (aj prehratej), keď sa ťa bojí
  viac starších ako súpera.
- **Patronát (2026-10-20, nahradil bitku o staršieho):** po braní zo šenku
  (útočník, potom obranca; `patronat` / `bezPatronatu`) si smieš vziať do ruky
  staršieho, ktorý ti **prejavuje priazeň** (marker aspoň v žltej na tvojej
  polovici, pôvodný starší). Na jeho scorecard dáš lícom dole Občana/Zviera
  z ruky, marker ide do stredu. Platíš cigarety podľa zóny (v6.1): červená 1, oranžová 2,
  žltá 3; súper dostane v bitke Pohoršenia navyše (o koľko polí marker išiel do
  stredu: 1 / 2 / 3) — tie však **nesmú na tohto staršieho** (v6; ostatné jeho Pohoršenia
  naňho smú, hra minie najprv tie z patronátu). Treba mať aspoň 1 poldeci. Kartu staršieho smieš v kole
  vyložiť. **Výhra** = starší ostáva tebe (náhrada sa otočí); **prehra** aj sekera = starší
  sa vráti, náhrada do ruky a **odhodíš poldeci** natrvalo. Patronát platí aj vo finále
  a vráti marker z červenej naraz do stredu.
- **Pohoršenie (v5 oboma smermi):** každé posunie marker o 1 **k súperovi alebo
  k sebe** (`{"type":"pohorsenie","elderId":…}`, k sebe s `"kSebe":true`);
  k sebe si vezmeš priazeň, a tá platí hneď, už v poškodení tej istej bitky. Pohoršenie
  ide pred špakmi za starších, takže strach z neho platí už v tejto bitke (ak ju vyhráš). V6: ten istý
  marker smieš posúvať **bez limitu, o pole za Pohoršenie, aj na červenú** (zo stredu 3).
  Súperova Policajtka ruší oba smery.
- **Poradie bitky (v6):** Exekútor → Pohoršenie → poškodenie → výsledok → špaky za bitku
  → špaky za starších (víťazovi, pri sekere obom) → prebytok (posunie markery o pole za bod, aj na červenú a z nej
  von — zamknutie sa ruší; prejaví sa až v ďalšej bitke).
- **Remíza (v6):** pri rovnakom tuhom vyhrá, kto má **menej Absťákov**, potom **menej
  priznaných Dlhov**; inak **sekera** — špaky kola (Pitky) vezme víťaz najbližšej bitky,
  vo finále prepadnú; za starších dostanú špaky obaja; útočník ostáva, patronát = prehra. Celkové určuje len prebytok.
  **Ohlásené vydesenie:** polovicu starších treba udržať do konca ďalšieho kola; keď
  klesne pod polovicu (aj patronátom), padá hneď a nové doplnenie ohlasuje odznova.
  **Cigarety za prebytok** dostane ten, proti komu sa prebytok delil.
