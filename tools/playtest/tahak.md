# Ťahák — platné pravidlá NA EX! (v8.2, 2026-10-30)

Spoločný ťahák AI hráčov (`naex-playtester`, `naex-protihrac`) — čítajú ho pri
príprave pred partiou. Podrobne v `docs/PRAVIDLA.md` (zmeny v jeho úvode). Pri
rozpore s `docs/PRAVIDLA.md` platí `docs/PRAVIDLA.md` a rozpor zapíš do
`nezrovnalosti.md`. Po zmene pravidla ho aktualizuje Developer — jediné miesto;
čísla stráži test `packages/core/test/tahak.test.ts`.

- **Špaky (v6, 2026-10-26) = víťazné body.** Vyhrá, kto má po finále viac špakov.
  **Víťaz bitky** dostane **1 špak za každú kartu v línii** na oboch stranách v čase bitky (v8,
  2026-10-28; aj odkrytá Záverečná, nie priznané karty ani Dedičstvo, nie karty, ktoré z línie počas
  kola zmizli), aspoň 1 — Absťáky ich od v8.1 neuberajú; lokalitu si
  **neberie** (ide na nástenku). Počet Pitiek už špaky neurčuje.
  **Strach za novú zónu (v8):** **len víťazovi bitky** (aj finále; pri **sekere** obom) zaplatí každý
  starší, ktorý sa ho bojí, **len zóny, ktoré mu ešte nezaplatil: žltá 1, oranžová 2, červená 3
  (zo stredu na červenú spolu 6)**. Zaparkovaný marker ďalšie výhry nič nedá. Keď marker ustúpi
  k stredu (Pohoršenie, prebytok, patronát, Kšeft, Kapybara), zóny, z ktorých ustúpil, sa pri ďalšom
  postupe platia znova; na druhej polovici platí nanovo druhému hráčovi. **Porazený za starších
  nedostane nič.** Nepriznaná Cirhóza na konci **−3 špaky za kus** (v8; ruka aj oba balíčky).
  Exekútor berie špaky (nižšie). Špaky smú ísť do mínusu; výpis ich ukazuje pri oboch hráčoch aj
  nástenku bitiek.
- **Výkupné (2026-10-27):** po finále, pred určením víťaza, dá každý **plný poldeci 1 špak,
  každých celých 5 cigariet 1 špak** (nadol, bez stropu). Vypitý poldeci a poldeci pod NA EX
  sa nerátajú. Vo finále sa preto oplatí doliať (2 cigarety → plný poldeci = špak) a nefajčiť
  cigaretu, ktorá zlomí päťku. Výpis ho ráta do „keby skončila teraz“.
- **Dĺžka hry** = počet bitiek o lokality (krátka 3, stredná 5, dlhá 7) a potom
  **finále** na pinnacle lokalite.
- **Lokality podľa úrovní (v7):** úroveň = počet akcií na hrane lokality (1 / 2 / 3, pinnacle 4),
  Pitiek je 1 + menší počet aktivovaných akcií hrán (úroveň 1: 1–2, úroveň 3: 1–4, pinnacle 1–5).
  Úrovne po kolách: krátka 1 · 2 · 3 · P, **stredná 1 · 2 · 2 · 3 · 3 · P**, dlhá 1 · 1 · 2 · 2 · 3 · 3 · 3 · P.
  Nežrebuje sa: obranca vyberá a natáča cieľ zo **všetkých ešte neodohraných lokalít úrovne kola**
  (výpis ukazuje len tie). Úroveň 1: Zastávka, Most, Lesná cesta, Cintorín, Jednota; 2: Ihrisko,
  Benzínka, Kar, Zberný dvor, Krčma, Sklad; 3: Obecný úrad, Kultúrny dom, Vínna pivnica, Družstvo,
  Kostol; pinnacle: Poľovnícka chata, Predsedova vila, Herňa.
- **Štart (v6):** 4 karty v ruke (1 Miňištrant, 1 Milujúca manželka, 1 Pijan, 1 Dievčina na vydaj), doberací balíček prázdny;
  2 plné poldeci, 3 cigarety, 0 špakov. Kým nemáš odhadzovací balíček, ťahať ani fajčiť sa nedá.
- **Finále (v7, 2026-10-27):** posledná bitka je o **pinnacle lokalitu** a hrá sa ako o každú inú:
  útočí **zaostávajúci — kto má menej špakov** (pri rovnosti porazený poslednej bitky, po sekere ostáva
  útočník); **obranca (vedúci) vyberie a natočí pinnacle lokalitu** (jednu z troch), potom šenok
  a patronát ako v každom kole. Kraje a prevaha platia, počet Pitiek podľa spojov s lokalitou (1–5),
  víťaz 1 špak za kartu v línii. **Prebytok vo finále (v8)** rozdelí jeho držiteľ (vyššie celkové)
  medzi starších a strach za nové zóny, ktoré tým vzniknú, sa vyplatí ešte po finále (víťazovi, pri
  sekere obom) — na špaky 1 : 1 sa prebytok nemení nikde.
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
  Akcie: Hazard (v8.2, kľúč v príkazoch a súčtoch ostáva `Dlh`; zvyšuje zadĺženie, z neho sú Dlhy),
  Poškodenie pečene, Poldeci, Cigareta (nie Pečeň, Poldecko, Cigaretka).
- **Viac kariet v jednom ťahu Zhromaždenia:** prvá je zadarmo, **každá ďalšia
  stojí plný poldeci** (Vypiť: limit −1, pečeň +1, nerest) — dve karty za sebou
  potrebujú limit aspoň 3, tri karty limit 5 (každé Vypiť limit zníži, preto pri limite 3 najviac
  dve karty v jednom ťahu). V klientovi príkaz
  `{"type":"tah","kroky":[…]}` (priznania, potom karty a pred každou okrem
  poslednej `{"type":"vypit"}` — pri dvoch kartách **vypit, karta, karta**; „karta,
  vypit, karta“ server odmietne), alebo jednotlivé `place` / `vypit`.
- **Pitky:** Pitiek v bitke = **1 + menší počet aktivovaných akcií lokality**
  z jej dvoch strán (1–4); Odpor na hrane lokality sa ráta, akcia hrany zrušená
  Odporom karty nie. Ráta sa podľa strán, nie podľa toho, kto kartu zahral (aj
  podstrčená); akcia hrany ×2 je stále jedna. Pred každou
  Pitkou je Zhromaždenie. Počet sa mení s líniou — výpis ho ukazuje. „Ešte
  jednu!“ už neexistuje.
- **Prevaha (2026-10-20):** akcie hrany lokality dostane, kto má v tej
  polovici línie (kraji) **viac svojich Občanov, Zvierat a Starešinov** (Nástroje a Cirhóza nie); pri rovnosti
  hráč, ktorého karta v tom kraji leží hneď pri lokalite (vyložená ako prvá) — nie
  „majiteľ lokality“. Jedna podstrčená karta neukradne akcie hrany, ale tvorí
  s nimi spoj: ako prvá karta pri lokalite určuje, ktoré akcie hrany sa
  aktivujú (dostane ich hráč s prevahou). Kraje
  majú mená podľa lokality (Krčma: pri výčape / pri dverách).
  **Dvojčatá** — do prevahy sa rátajú za dvoch; **Kočovník** — Furt: jeho akcie
  (aj Rana, Hazard, Poškodenie pečene) sa počítajú hráčovi, ktorý má v jeho kraji
  prevahu; do prevahy sa ráta majiteľovi, pri rovnosti rozhoduje karta pri lokalite.
- **Poradie (2026-10-20):** cieľ kola vyberá a natáča **obranca** (víťaz
  poslednej bitky); **útočník** (porazený) berie zo šenku prvý a **vykladá
  prvý**. **Pitka naraz (2026-10-27):** v Pitke hráte **obaja súčasne** —
  fajčíte, dolievate, barterujete, Kšefty, Úplatky a skryto NA EX; každý skončí
  sám („hotovo“, nevratné, zapíše sa do logu). NA EX vyberáte skryto — súper
  nevidí, či a kam ste ho dali; odkryje sa, keď ste hotoví obaja (najprv
  obrancovo). Jediná výnimka je **Bzdocha**: jej majiteľ čaká, kým súper
  skončí, a potom hrá a vidí jeho NA EX (majú ju obaja → nečaká nikto). Potom odpovede: najprv obranca, útočník má **posledné slovo** — Kohút (v7) ho dá
  svojmu majiteľovi aj ako obrancovi. Krčmárka (v7): na NA EX jej majiteľa súper kartou neodpovedá.
- **Lokality** — efekt platí v kole o ňu: Krčma (s plným
  poldeci povinné NA EX; prah Cirhózy obom +2), Kostol (v7: nikto nevypije — v ťahu 1 karta; NA EX len
  na kartu v kraji **pri oltári**), Benzínka (v7: fajčí len hráč, ktorého Občan alebo Starešina leží
  **najďalej od lokality**; pri rovnosti nikto), Zastávka (spoločný limit = súčet
  limitov; pas dá cigarety len za tvoj vlastný zvyšok limitu), Lesná cesta (v7: +1 tuhé za každé svoje Zviera v súperovom kraji, bez stropu),
  Ihrisko (+2 tuhé za každý kraj, kde máš viac svojich Občanov, Zvierat a Starešinov — Dvojčatá za dve, v8), Zberný
  dvor (Kšeft: cigareta → ľubovoľná karta z tvojho odhadzovacieho do ruky, `kseft` s `kartaUid`),
  Most (len na vlastnú stranu), Kar (v7: pečeň za NA EX dostane **súper** toho, kto ho dal), Cintorín (Prehra:
  porazený smie dať jeden Nástroj **z ruky alebo zo šenku** do Dedičstva zadarmo, `{"type":"cintorin","uid":…}`;
  pri sekere nikto), Obecný úrad (v7 Kšeft: 3 cigarety → tvoj priznaný Dlh prejde
  medzi súperove priznané), Jednota (v7: kto má viac priznaných Dlhov, nesmie fajčiť ani dolievať),
  Sklad (v7 Kšeft: 1 cigareta → vrchná karta súperovho
  odhadzovacieho balíčka do tvojej ruky), Poľovnícka chata (tuhé z hrán ×2), Predsedova vila
  (Kšeft: 2 cigarety → marker o 1 k súperovi alebo k sebe, nie staršieho zo súperovho patronátu),
  Herňa (víťaz + toľko špakov, koľko má porazený priznaných Dlhov), Kultúrny dom (v8 „Obaja získajú
  špaky“: víťaz 1 špak za každú kartu v línii, **porazený 1 špak za každú svoju kartu v línii**;
  prebytok sa rozdeľuje ako inde), Vínna pivnica (NA EX 2× za Pitku), Družstvo (Pracujúci
  nemíňajú limit).
- **Kšeft (v7):** aktívny efekt za cenu `{"type":"kseft","uid":…}` (uid karty v línii, staršieho alebo
  lokality; Zberný dvor s `kartaUid`, Vila s `elderId` a `kSebe`) — v Pitke na svojom ťahu, nie pri
  odpovedi na NA EX; každá karta raz za Pitku, Kšeft lokality smie každý hráč. Strýko z Ameriky
  (2 cigarety → v bitke kola +1 Rana), Poštárka (1 Dlh → 1 karta), Vychovávateľka (2 cigarety → v bitke
  +1 Povera), Zberný dvor, Sklad, Obecný úrad, Predsedova vila. Starší dávajú Kšeft v línii aj prebudení.
- **Úplatok (v7, Kulturista):** na súperovho Kulturistu smieš v každej Pitke dať 1 cigaretu
  (`{"type":"uplatok","uid":…}`); každá zníži do konca kola jeho útoky o stupeň (Petelica → Pecka →
  Rana → nič). Cigareta prepadne.
- **Konflikt (v7):** efekt **ležiacej** karty, keď k nej **súper** priloží svoju (aj odpoveďou na NA EX;
  Záverečná až pri otočení). Keď prikladáš ty k svojej, nič; priložený Nástroj nič; NA EX ani zrážka nič.
  Najprv Nástup priloženej karty, potom Konflikt. Veľmi smútiaca vdova (priložený Chlap po bitke z hry),
  Policajtka (súper Dlh; za Kriminála ti dá 2 cigarety), Šarlatán (do konca kola jeho Hazardy = Viera,
  Povery = Rana), Snúbenica (priložený Chlap po bitke do tvojho odhadzovacieho balíčka — je tvoj),
  Hrobár (za priloženú kartu sa už nič nepriloží, po bitke z hry). Miňištrant (Nástup): ak vyvolá
  Konflikt, jeho Viera sa ráta ako Pecka.
- **Pakt (v7, akcia):** na spoji sa správa ako akcia, s ktorou je v páre (aj zlá: Hazard, Pečeň).
  Pakt s Paktom nerobí nič, s Posilnením nič nezdvojí, Odpor ho zruší; neaktívny Pakt NA EX nezdvojí.
- **Draft:** stavba šenku naraz, bez podávania: z N kariet dáš **polovicu do šenku
  a polovicu naspodok** (`{"type":"stavbaSenku","doSenku":[…],"odhod":[…]}`, pri 8 kartách 4 + 4)
  — vyberáte naraz. Po braní sa šenok sám doplní na 8 z vrchu spoločného balíčka. Branie striedavo, začína útočník: **1 karta za 1 cigaretu,
  2 karty za 3 cigarety** (`{"type":"draftBer","uids":[…]}`); poldeci sa
  v šenku neplatí; `draftStop` ukončí branie.
- **Ruka bez limitu:** po každej bitke si dobereš **1 kartu** (2026-10-27, predtým 2); nič neodhadzuješ.
  Karty navyše: šenok, fajčenie (`smoke`: karta hneď, **len v Pitke** (v5), v Zhromaždení
  nie; **prvé fajčenie v Pitke 1 cigareta, druhé 2, tretie 3…**, každá Pitka znova od 1
  (2026-10-27), každá vyfajčená cigareta je nerest; s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť
  nedá), priznanie kliatby, Vízia, efekty. Malý balíček prehru nespôsobí (v5).
  Keď sa doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový
  doberací balíček (pri každom ťahaní).
- **Kliatby (v8.2, 2026-10-30):** **Dlh a Absťák sú počítadlá, nie karty** — vznikajú rovno priznané,
  neťaháš ich, kartu za ne nedobereš a nedá sa s nimi inak manipulovať (stav ukazuje „priznané dlhy N“
  a „Absťáky N“, obe verejné). Priznané Dlhy idú k Exekútorovi a pri remíze v bitke prehráva viac Dlhov.
  Kartou ostáva len **Cirhóza** (a Milujúca manželka). Nová **Cirhóza ide do tvojho
  odhadzovacieho balíčka** (2026-10-25) — do ruky príde, až keď sa doberací balíček minie a odhadzovací
  sa zamieša; priznáš ju, keď chceš, ale kartu za ňu **nedobereš** a súper za každú
  priznanú dostane v bitke +1 tuhé (nepriznaná ide po bitke do tvojho odhadzovacieho balíčka; na konci hry −3 špaky za kus)
  — prizná ju hneď, alebo riskuješ, že sa ti do konca nevráti do ruky. Kým ju nepriznáš, súper za ňu tuhé
  nedostáva. Počet súperových
  nepriznaných Cirhóz je verejný (stav ho ukazuje). Dlh pália Robota (1 Dlh za aktívnu Robotu) a Exekútor
  (v každej bitke); Obecný úrad, Podvodník a Kmotor ho presunú súperovi. Anonymný
  alkoholik (Nástup, v7) prizná všetky Cirhózy z tvojho odhadzovacieho balíčka. Absťák kartu nedá (v8.2). Milujúca manželka už nie je Kliatba (v7). Kliatba do línie nepatrí. Priznanie nemíňa
  limit ani neodovzdá ťah. Za priznané Dlhy príde v každej bitke Exekútor.
- **Záverečná (Zhromaždenie, za 1 cig.):** `{"type":"zaverecna","uid":…,"target":"vlastna"|"superova"}` —
  karta lícom dole, míňa limit, potom už v Zhromaždení nevykladáš (bez cigariet za pas). Súper ju
  nevidí, za ňu nepriloží (ani odpoveď na NA EX), NA EX na ňu smie len on (prejde vždy); akciu jeho
  karty, ktorú spáruje, mu výpis ani odhad bitky neukáže. Otočí sa na konci Pitky — až vtedy Nástup a Konflikt, ktorý priložením vyvolala.
- **Nástup s voľbou (v7):** Živnostník — za neho hneď smieš priložiť Nástroj z ruky mimo limitu
  (`{"type":"nastroj","uid":…}`, nič = `"uid":null`; aj pri otočení Záverečnej); Starosta — karta zo
  šenku (`{"type":"senok","uid":…}`); Kapybara — marker jedného staršieho o 1 pole k stredu (povinne)
  (`{"type":"kapybara","elderId":…}`). Dohadzovačka (Nástup, 2026-10-28): keď ju priložíš k Občanovi či Starešinovi, z druhej strany
  lokality sa najvzdialenejší Občan alebo Starešina opačného pohlavia ako jej sused presunie za ňu
  (na koniec jej strany; povinné, karta ostáva majiteľovi, Konflikt sa nespustí).
- **Vízia:** na konci Pitky za každú aktívnu Víziu uvidíš vrchnú kartu svojho
  balíčka — `{"type":"vizia","vziat":true}` do ruky, alebo `false` = zahodiť
  (navždy z hry).
- **Hasič (Nástup, 2026-10-26):** vytiahne náhodnú kartu z tvojho odhadzovacieho
  balíčka (aj kliatbu; súper ju vidí, odhadzovací je verejný) —
  `{"type":"hasic","nechat":true}` do ruky,
  alebo `false` = vráti sa do odhadzovacieho. Kým nerozhodneš, hra čaká; v ťahu
  naraz rozhoduješ po zvyšku ťahu. Prázdny odhadzovací = nič.
- **Starší v7:** Autobusár: súper, ktorý pasuje po jeho majiteľovi, cigarety za pas nedostane.
  Veterinár (Pitka): karty v jeho okolí nepridávajú poškodenie pečene. Farár (Prehra): víťaz získa
  zadĺženie za každú svoju aktívnu Poveru. Poštárka dá Dlh len za naozaj dobratú kartu.
- **Dedičstvo** (Nástroj do hracej oblasti, `target` `dedicstvo`): cena rastie
  pre oboch spolu — 1., 2., 3. Nástroj v hre stojí 1, 2, 3 cigarety. Efekt
  Nástroja platí **len v Dedičstve**. Vínko vyložené v Zhromaždení zvýši zostávajúci
  limit **hneď** o 1 (2026-10-28; na Zastávke spoločný aj tvoj vlastný).
- **Nástroj v línii** tvorí spoj len s Občanom/Starešinom a jeho akcie dostane
  **majiteľ karty, s ktorou tvorí spoj** (podstrčený Nástroj pracuje pre
  súpera).
- **NA EX na Občana alebo Starešinu v línii — svojho aj súperovho**, len na kartu
  s aspoň 1 aktívnou a aspoň 1 neaktívnou akciou (2026-10-23; súperova Záverečná vždy). Zruší
  karte aktívne akcie a zdvojí neaktívne; akcie sa rátajú majiteľovi karty.
  Pečeň +1 je tvoja. Súper smie hneď odpovedať jednou kartou mimo limitu
  (`place` / `bezReakcie`) — odpoveď smie zmeniť prevahu v kraji aj počet Pitiek. Nie na kartu, na ktorej
  už poldeci leží. NA EX na kartu
  pri lokalite mení len akcie karty, akcie hrany lokality ostávajú aktívne. NA EX na kartu
  s Posilnením zruší Posilnenie aj ×2 partnera na spoji (2026-10-24; partner ostáva ×1,
  aj hrana lokality). Akcia zrušená Odporom nie je ani aktívna, ani neaktívna — NA EX ju
  nezdvojí (v6.1).
  Súperova **Svokra** mu v bitke dá +1 tuhé
  (Ranu) za každú jeho kartu, na ktorej leží tvoj poldeci z NA EX — NA EX na svoje karty ju nespustí.
  Šofér (v7): ak si v kole nedal NA EX, v bitke Pecka navyše. **Pijan** (v7): za každé tvoje NA EX v kole
  Rana navyše. Lievik v Dedičstve: NA EX aj na Zviera. **Stryná** (Pitka): kto v Pitke nedal NA EX,
  +1 pečeň. **Bzdocha** (Pitka): súper hrá Pitku pred tebou — čakáš, kým skončí, a vidíš jeho NA EX. Veterán (v4): NA EX mu
  aktívne akcie zdvojí (nezruší), neaktívne nechá.
  **Skryto (v5):** `naex` súper nevidí do odkrytia; odpovedáš po odkrytí za každé súperovo NA EX,
  najprv obranca, potom útočník. **Zrážka** (obaja na tú istú kartu) = **Výtržník**: karta sa
  spáruje so susedmi s pôvodnými akciami, potom sú všetky jej akcie aktívne Rany pre majiteľa,
  do konca bitky — aj jej Posilnenie a Odpor sú už len Rany, suseda nezdvojujú ani nerušia (v6.1); pečeň, poldeci aj Výpalné platí každý za svoje NA EX.
  Krčma vynúti jedno NA EX. Násobky sa **násobia** (NA EX × Silná žena = ×4, aj Hazard
  a Poškodenie pečene) a NA EX leží na karte do bitky — vyhodnotí sa v každej
  Pitke kola. Každá možnosť `naex` v stave ukazuje cenu: bitku pred a po
  a kliatby (Cirhóza, Dlh) aj so špakmi pre oboch.
- **Doliatie** v Pitke: 2 cigarety → vypitý poldeci späť na plný (nie s Vínkom
  v Dedičstve). **Barter:** 5 cigariet → nový plný poldeci. Na začiatku kola sa
  jeden vypitý poldeci doleje sám.
- **Pečeň žije len v Pitke** — vyhodnotí sa v nej a potom sa vynuluje. **Zadĺženie neprepadá (v7, D6):**
  zvyšok pod prahom ostáva na účte do ďalšej Pitky aj kola. Za **každý celý prah** jedna kliatba
  (zadĺženie 8 pri prahu 2 = 4 Dlhy). Milujúca manželka (v7) v línii: tvoja pečeň v Pitke −1.
  Riadok „VÝHĽAD PITKY“ v stave ukazuje, čo pripíšu karty na stole a koľko kliatob z toho bude.
- **Absťák (v8.1 Nervák, 2026-10-28):** na konci kola sa porovnajú neresti **oboch v tomto kole** —
  menej ako súper → +1 Absťák (počítadlo, v8.2 bez karty navyše); viac → jeden tvoj Absťák odíde; rovnako nič.
  Každý Absťák: v bitke o ranu menej a **+1 Pohoršenie**; pri remíze v tuhom prehráva, kto ich má viac.
  Špaky za bitku neuberá. Výpis ukazuje „neresti v kole X, súper Y“.
- **Stupnica (v6):** 7 polí 3-2-1-0-1-2-3, jedno sivé. Marker určuje **priazeň**
  (komu je posunutý, sila 1 / 2 / 3) a koho sa starší bojí (nové zóny mu zaplatí po bitke, ktorú ten vyhrá).
  Scorecard nesie už len priazeň, bodovacie podmienky nie sú.
- **Priazeň (v5)** sila 1 / 2 / 3 podľa zóny, bez dvojnásobku: Bitkár +1 / +2 / +3
  tuhého; Kmotor: po bitke presunie 1 / 2 / 3 tvoje priznané Dlhy medzi súperove (v8; koľko máš); Abstinent +1 / +2 / +3
  Pohoršenia v bitke; Exekútor: exekúcia súperovi zhorí navyše 1 / 2 / 3 Dlhy; Výpalník
  (Výpalné): za každé súperovo NA EX ti dá 1 / 2 / 3 cigarety; Fajčiar +1 / +2 / +3
  cigarety po braní zo šenku (Obmedzenie ich neuberá); Alkoholik (Na zdravie
  „do dna“): 1 / 2 / 3 poldeci z tvojho NA EX za kolo sa vráti plných; Veriaci
  +1 / +2 / +3 Viery. Prah Dlhu 2 (každé 2 zadĺženia = 1 Dlh), prah Cirhózy 3. Exekútor (priazeň): exekúcia súperovi zhorí navyše 1 / 2 / 3 Dlhy a toľko špakov.
  Výherný automat (Dedičstvo, v7): tvoj prah Dlhu +1, ale v poslednej Pitke kola získaš 1 Dlh.
- **Exekútor bez prahu (2026-10-28):** Exekútor príde v každej bitke ku každému s priznaným Dlhom: zhorí polovica priznaných Dlhov zaokrúhlene nahor
  (aj jediný Dlh) a rovnako veľa špakov, so súperovou priazňou Exekútora navyše 1 / 2 / 3 — **až po
  poškodení a špakoch za bitku** (2026-10-28; Robota tesne pred ním), takže Povery, remíza, Herňa a Noviny
  rátajú Dlhy pred exekúciou. Prehra nie je, na konci hry Dlhy nič. **Záhradkár** (Exekúcia, 2026-10-28):
  keď leží v línii v tvojej partii, exekúcia ťa v tomto kole obíde (žiadny Dlh ani špak); nezahadzuje sa.
  Vymáhač: za každé 2 tvoje priznané Dlhy +1 Rana; Traktoristka: s prevahou v jej kraji Pecka navyše,
  inak Dlh; Podvodník pri prehre presunie tvoj priznaný Dlh súperovi. **Noviny** (Dedičstvo: Prehra, 2026-10-28):
  keď prehráš, dostaneš 1 špak za každý priznaný Dlh, ktorý má víťaz navyše oproti tebe; víťaz nič nestratí.
- **Karty v7 v bitke a po nej:** Pes — jeho aktívne akcie na spoji so súperovou kartou ×2 (platí aj podstrčený); Mäsiar —
  efekty Zvierat v jeho okolí neplatia (ich akcie platia; 2026-10-28); Krokodíl — na konci bitky idú z hry všetci Občania a Zvieratá
  v jeho okolí; Puška / Vidly (Dedičstvo) — tvoje Petelice / Rany z vyložených akcií o 1 poškodenie viac (Rany navyše z efektov nie); Pasca
  (Dedičstvo) — keď súper v kole priložil kartu k tvojej, Pecka navyše; Krabička (Dedičstvo) — za každé
  2 cigarety, ktoré súper vyfajčí, karta; Liberál (Pitka) — súper bez rovnováhy žien a chlapov
  +1 zadĺženie; Recidivista (Prehra) — po bitke späť do ruky; Dievčina na vydaj (Prehra) — zahodí sa,
  víťaz získa Dlhy podľa jej aktívnych akcií.
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
- **Smer posunu** (2026-10-28): „k súperovi / k sebe“ je smer na stupnici, nie polovica — z tvojej
  polovice posun k súperovi marker len priblíži k stredu (tvoja priazeň −1, súpera sa bojí menej).
  Log posunu píše zónu pred → po, komu priazeň stúpla/klesla a kto staršieho desí.
- **Cena posunu markera (v8.2, 2026-10-30)** — Pohoršenie aj prebytok: pole von zo stredu stojí 1 / 2 / 3,
  k stredu 4 / 3 / 2 (z červenej, z oranžovej, zo žltej); zo stredu na červenú 6. Vyberáš **len staršieho**
  (pri Pohoršení aj smer), marker ide, kým body stačia; zvyšok dáš ďalším starším. Čo už na žiadny posun
  nestačí, prepadne. Kšeft Predsedovej vily a Kapybara posúvajú o jedno pole bez ceny.
- **Pohoršenie (v5 oboma smermi):** z akcií, patronátu, priazne Abstinenta a 1 za každý tvoj Absťák;
  každé je bod na posun **k súperovi alebo
  k sebe** (`{"type":"pohorsenie","elderId":…}`, k sebe s `"kSebe":true`);
  k sebe si vezmeš priazeň, a tá platí hneď, už v poškodení tej istej bitky. Pohoršenie
  ide pred špakmi za starších, takže nová zóna z neho platí už v tejto bitke (ak ju vyhráš). Ten istý
  marker smieš posúvať **bez limitu, aj na červenú** (zo stredu 6 Pohoršení).
- **Poradie bitky:** Pohoršenie → poškodenie → výsledok → špaky za bitku
  → špaky za starších (víťazovi, pri sekere obom) → exekúcia (Robota, Exekútor) → prebytok (posunie markery k súperovi
  držiteľa podľa ceny poľa, aj na červenú a z nej von — zamknutie sa ruší; prejaví sa až v ďalšej bitke, vo finále hneď).
  **Prebytok rozdeľuje porazený (v8):** markery idú ako doteraz (starší sa začnú báť víťaza), ale
  **ktorých starších posunie, vyberá ten, proti komu sa prebytok ráta** — spravidla porazený si sám
  vyberie, ktoré priazne dostane (pri sekere ten s nižším celkovým). Rozdeliť treba celý prebytok (zvyšok,
  ktorý na žiadne pole nestačí, prepadne);
  `{"type":"prebytok","elderId":…}` posiela on. Vo finále rozdeľuje držiteľ.
- **Povera poškodzuje (v8.2 znenie):** mäkké poškodenie proti súperovým priznaným Dlhom (najviac toľko,
  koľko ich má); so súperovou Vierou sa ruší 1 : 1. Víťaza určuje tuhé, prebytok celkové (tuhé + mäkké).
- **Remíza (v6):** pri rovnakom tuhom vyhrá, kto má **menej Absťákov**, potom **menej
  priznaných Dlhov**; inak **sekera** — špaky kola (karty v línii) vezme víťaz najbližšej bitky,
  vo finále prepadnú; za starších dostanú špaky obaja; útočník ostáva, patronát = prehra. Celkové určuje len prebytok.
  **Ohlásené vydesenie:** polovicu starších treba udržať do konca ďalšieho kola; keď
  klesne pod polovicu (aj patronátom), padá hneď a nové doplnenie ohlasuje odznova. Ohlásené
  v poslednej bitke o lokalitu rozhodne na konci finále (pred konečnými špakmi); ohlásené vo finále nie.
  **Cigarety za prebytok** dostane ten, proti komu sa prebytok delil.
