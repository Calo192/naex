# Ťahák — platné pravidlá NA EX! (v11.22 akcie navyše mení celý Nástroj aj Forsáž (zo spoja aj z Energeťáka), Traktorista Pecka s prevahou, Pasca Rana za každú priloženú kartu, Výherný automat Dlh v každej Pitke, Kapybara Furt, Predavačka navrch balíčka, v11.21 po bitke 2 karty bez ohľadu na ruku, Puška a Energeťák posilnia akcie aktívne po NA EX (×4), v11.20 hodnota stupňa 1 / 2 / 3 a reťaz premien (Školitelia, potom Nástroje), pojem Ponuka (predtým šenok), v11.19 Dohadzovačka len z konca kraja, v11.18 Vedúcko Podporou, Snúbenica, Traktorista a Miňištrant, v11.17 NA EX × Odpor a Posilnenie, Kapybara, Telefón, Krokodíl a hrany Náradia, v11.16 Vypiť len s limitom, pas bez ohľadu na ruku, Degustátorka hneď, odpoveď na NA EX za poldeci, Nástroj len pod svoje karty, Školiteľ aj Zviera, v11.15 Benzínka o 1 lacnejšie, v11.14 frakcie, Preškolenie a podloženie Nástrojov, v11.13 Lokality, v11.12 Reči na súperovom teplomere, zajatie a presvedčenie, identita kariet, Kostol na konci línie, každý Hazard je Dlh, 2026-11-10, Zrejúca; sada = cards.json v master)

Spoločný ťahák AI hráčov — playtester (Zrejúca) ho číta z master, protihráč na
Vypálenej z vetvy `vypalena` (tam platí jej verzia pravidiel). Podrobne v `docs/PRAVIDLA.md` (zmeny v jeho úvode). Pri
rozpore s `docs/PRAVIDLA.md` platí `docs/PRAVIDLA.md` a rozpor zapíš do
`nezrovnalosti.md`. Po zmene pravidla ho aktualizuje Developer — jediné miesto;
čísla stráži test `packages/core/test/tahak.test.ts`.

- **Koniec hry (v11, 2026-11-02):** dve okamžité výhry, obe **len v bitke, ktorú vyhráš**: (1) **výhra
  strachom** — po bodovaní máš **červený strach aspoň u 4 starších** (tvoj väzeň sa ráta ako tvoja červená);
  (2) **výhra väzňami** — po zajatí (rozdelenie Nakladačky) máš **väzňov aspoň (lokality + finále) / 2: Tretia liga 2, Druhá 3,
  Prvá 4**. Inak vyhrá, kto má po finále viac špakov.
- **Špaky (v6, 2026-10-26) = víťazné body.** Vyhrá, kto má po finále viac špakov.
  **Víťaz bitky** dostane **1 špak za každú kartu v línii** (v celej línii) v čase bitky (v8,
  2026-10-28; aj odkrytá Záverečná, nie priznané karty ani Dedičstvo, nie karty, ktoré z línie počas
  kola zmizli), aspoň 1 — Absťáky ich neuberajú; lokalitu si
  **neberie** (ide na nástenku).
  **Starší po bitke (v11.12, v11.20):** stupne strachu majú hodnotu **žltá 1, oranžová 2, červená 3** (spolu 1 / 3 / 6) a špaky
  za stupeň dostane ten, kto ho drží. **Víťaz bitky** dostane za svoj strach bez stupňov, ktoré obsadil súper rečami,
  **každý hráč pri každej bitke** (vyhratej, prehratej aj pri sekere) za stupne, ktoré obsadil rečami (červený strach
  a tvoje reči na červenej a oranžovej: on 1, ty 5; plné reči na prázdnom teplomere: ty 6). Stav pred zdvihnutím
  Nakladačkou a hádkou. Výhra strachom a zajatie rátajú strach celý. **Reči potom klesnú zospodu o stupeň len tomu, kto
  prehral hádku**; pri remíze v hádke nikomu.
  **Víťaz hádky, ktorý prehral bitku (v11.11),** dostane 1 špak za každú svoju kartu v línii; pri sekere tiež, hneď,
  a karty línie ďalej čakajú na sekere; na Kultúrnom dome sa za prehratú bitku nepripočíta druhýkrát, vo finále navyše k 1 špaku za bod hádky.
  Víťaz bitky dostane za všetky karty, aj keď hádku tiež vyhral, navyše nič. Nepriznaná Cirhóza
  na konci **−3 špaky za kus** (v8; ruka aj oba balíčky).
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
  Nežrebuje sa: obranca vyberá cieľ (natočí ho **víťaz minulej hádky**, v11.11; v K1 a po remíze v hádke obranca) zo **všetkých ešte neodohraných lokalít úrovne kola**
  (výpis ukazuje len tie). Úroveň 1: Zastávka, Most, Lesná cesta, Cintorín, Jednota; 2: Ihrisko,
  Benzínka, Kar, Zberný dvor, Krčma, Sklad; 3: Obecný úrad, Kultúrny dom, Vínna pivnica, Družstvo,
  Kostol; pinnacle: Poľovnícka chata, Predsedova vila, Herňa.
- **Štart (v6):** 4 karty v ruke (1 Miňištrant, 1 Milujúca manželka, 1 Pijan, 1 Dievčina na vydaj), doberací balíček prázdny;
  2 plné poldeci, 3 cigarety, 0 špakov. Kým nemáš odhadzovací balíček, ťahať ani fajčiť sa nedá.
- **Finále (v7, 2026-10-27):** posledná bitka je o **pinnacle lokalitu** a hrá sa ako o každú inú:
  útočí **zaostávajúci — kto má menej špakov** (pri rovnosti porazený poslednej bitky, po sekere ostáva
  útočník); **obranca (vedúci) vyberie pinnacle lokalitu** (jednu z troch), natočí ju víťaz poslednej hádky (v11.11), potom ponuka ako
  v každom kole. Kraje a prevaha platia, počet Pitiek podľa spojov s lokalitou (1–5),
  víťaz 1 špak za kartu v línii, starší bodujú ako po každej bitke. **Vo finále sa markery nedvíhajú (v11):
  víťaz bitky dostane za každý bod Nakladačky 1 špak, víťaz hádky za každý bod hádky 1 špak** — zajatie ani
  presvedčenie vo finále nie je. Kto zaostáva,
  dobehne ho vysokou výhrou vo finále.
- **Každú kartu** môžeš vyložiť na **ktorýkoľvek z dvoch koncov línie**
  (`target` `vlastna` = koniec vľavo od lokality, `superova` = vpravo; názvy sú len technické). Karta **patrí tomu, kto ju zahral** — akcie
  aj efekty sa rátajú majiteľovi, nech leží kdekoľvek. Nástroj sa do línie nevykladá — podkladá sa (nižšie). Tvoja karta priložená k súperovej
  („podstrčená“, sabotér) s Odporom zruší súperovi akciu na spoji. Každá vyložená karta míňa limit
  vykladania. **Limit = plné poldeci + 1** — NA EX limit nemíňa, ale
  jeho poldeci na karte sa neráta (v4), takže v ďalšom Zhromaždení kola máš limit o 1 nižší.
  Súperova **Degustátorka**, ktorá ti v Zhromaždení vyžerie plný poldeci, ti zostávajúci limit zníži o 1 **hneď** (v11.16).
- **Pas** (`pass`): do Pitky už nevykladáš; dostaneš 1 cigaretu za každú kartu, ktorú
  si ešte smel vyložiť (zostávajúci limit) — **v11.16 bez ohľadu na karty v ruke**, aj s prázdnou
  rukou (limit 3, vyložil si 1, ruka prázdna → pas dá 2 cigarety).
- **Názvoslovie:** línia = celý rad; lokalita ju delí na dva **kraje**; línia má dva
  **konce**, žiaden nie je tvoj. **Tvoja partia** = všetky tvoje karty, kdekoľvek v línii.
  Akcie: Hazard (v8.2, kľúč v príkazoch a súčtoch ostáva `Dlh`; každá akcia = 1 Dlh),
  Poškodenie pečene, Poldeci, Cigareta (nie Pečeň, Poldecko, Cigaretka).
- **Viac kariet v jednom ťahu Zhromaždenia:** prvá je zadarmo, **každá ďalšia
  stojí plný poldeci** (Vypiť: limit −1, pečeň +1, nerest) — dve karty za sebou
  potrebujú limit aspoň 3, tri karty limit 5 (každé Vypiť limit zníži, preto pri limite 3 najviac
  dve karty v jednom ťahu). **Pri zostávajúcom limite 0 sa nepije** (v11.16 — server vypit odmietne). V klientovi príkaz
  `{"type":"tah","kroky":[…]}` (priznania, potom karty a pred každou okrem
  poslednej `{"type":"vypit"}` — pri dvoch kartách **vypit, karta, karta**; „karta,
  vypit, karta“ server odmietne), alebo jednotlivé `place` / `vypit`.
- **Pitky:** Pitiek v bitke = **1 + menší počet aktivovaných akcií lokality**
  z jej dvoch krajov (1–4, na pinnacle vo finále 1–5); Odpor na hrane lokality sa ráta, akcia hrany zrušená
  Odporom karty nie. Ráta sa podľa krajov, nie podľa toho, kto kartu zahral (aj
  súperova karta); akcia hrany ×2 je stále jedna. Pred každou
  Pitkou je Zhromaždenie. Počet sa mení s líniou — výpis ho ukazuje.
- **Prevaha (2026-10-20):** akcie hrany lokality dostane, kto má v tej
  polovici línie (kraji) **viac svojich Občanov, Zvierat a Starešinov** (Nástroje a Cirhóza nie); pri rovnosti
  hráč, ktorého karta v tom kraji leží hneď pri lokalite (vyložená ako prvá) — nie
  „majiteľ lokality“. Jedna súperova karta v kraji neukradne akcie hrany, ale tvorí
  s nimi spoj: ako prvá karta pri lokalite určuje, ktoré akcie hrany sa
  aktivujú (dostane ich hráč s prevahou). Kraje
  majú mená podľa lokality (Krčma: pri výčape / pri dverách).
  **Dvojčatá** — do prevahy sa rátajú za dvoch. **Kočovník** (Spoločník: Pamätník, 1 Pecka
  navyše) — jeho akcie patria majiteľovi ako pri každej karte. **Miňištrant** (Nepriateľ: Starešina, v11.18) — 1 Pecka
  navyše, kým má súper v partii odkrytého Starešinu.
- **Poradie (2026-10-20, v11.11):** cieľ kola vyberá **obranca** a natáča ho víťaz minulej hádky (obranca = víťaz
  poslednej bitky) a **berie z ponuky prvý (v9.2)**; **útočník** (porazený) berie z ponuky druhý a **vykladá
  prvý**. **Pitka naraz (2026-10-27):** v Pitke hráte **obaja súčasne** —
  fajčíte, dolievate, barterujete a skryto NA EX; každý skončí
  sám („hotovo“, nevratné, zapíše sa do logu). NA EX vyberáte skryto — súper
  nevidí, či a kam ste ho dali; odkryjú sa **naraz**, keď ste hotoví obaja (v9.2). Jediná výnimka je **Bzdocha**: jej majiteľ čaká, kým súper
  skončí, a potom hrá a vidí jeho NA EX (majú ju obaja → nečaká nikto). Potom odpovede **lícom dole (v9.2)**: najprv **útočník**, potom **obranca na druhý kraj línie** (ak útočník
  neodpovedal, na ktorýkoľvek); obe sa **otočia naraz** a Pitka sa vyhodnotí — posledné slovo nemá nikto.
- **Lokality** — efekt platí v kole o ňu: Krčma (s plným
  poldeci povinné NA EX; prah Cirhózy obom +2), Kostol (nikto nevypije — v ťahu 1 karta; **v11.7: NA EX len
  na kartu na konci línie (na ktoromkoľvek z dvoch koncov), najďalej od Kostola** — koniec bez podmienok NA EX sa neposúva na kartu pred ním, skrytá Záverečná je posledná, NA EX už dané ostáva), Benzínka (v11.15: každé fajčenie o 1 cigaretu lacnejšie — prvé v Pitke zadarmo, ďalšie 1, 2…; zadarmo nie je nerest, zaplatená cigareta áno), Zastávka (v9.1: po **prvej Pitke kola** si každý
  vezme **zadarmo 1 kartu z ponuky**, najprv útočník, potom obranca — `{"type":"senok","uid":…}`;
  z prázdnej ponuky nič), Lesná cesta (v11.13: 2 tuhé za každé svoje Zviera v línii, v ktoromkoľvek kraji, bez stropu),
  Ihrisko (+2 tuhé za každý kraj, kde máš viac svojich Občanov, Zvierat a Starešinov — Dvojčatá za dve, v8), Zberný
  dvor (frakcie, Pitka: na konci Pitky smie každý spáliť 1 kartu z ruky, nie kliatbu — najprv obranca, potom útočník;
  `{"type":"spal","uid":…}`, nič = `"uid":null`),
  Most (každý len na koniec línie po svojej ľavici — vľavo od lokality), Kar (v7: pečeň za NA EX dostane **súper** toho, kto ho dal), Cintorín (v11.13 Prehra:
  porazený si smie vziať do ruky **1 kartu zo svojho odhadzovacieho balíčka**, `{"type":"cintorin","uid":…}`, alebo `uid: null` nič;
  pri sekere nikto), Obecný úrad (v11.13 Pitka, obom: **cigarety a Dlhy získané v Pitke sa rátajú dvakrát**, z akcií aj z efektov kariet;
  (akcie − Obmedzenie) × 2; platby, cigarety za pas a Dlhy mimo Pitky nie; Výherný automat: zadĺženie × 2, prah ostáva), Jednota (v7: kto má viac priznaných Dlhov, nesmie fajčiť ani dolievať),
  Sklad (frakcie, Zhromaždenie: Nástroj z ponuky rovno do Dedičstva **za cenu Dedičstva** —
  `{"type":"place","uid":<uid z ponuky>,"target":"dedicstvo"}`; je to ťah, do ponuky príde z vrchu Náradia nový Nástroj),
  Poľovnícka chata (tuhé z hrán ×2), Predsedova vila (frakcie, Pitka: **za každé 2 cigarety, ktoré v Pitke
  vyfajčíš, tvoje reči pri jednom staršom o ďalší stupeň** — vyberieš `{"type":"vila","elderId":…}`),
  Herňa (víťaz + toľko špakov, koľko má porazený priznaných Dlhov), Kultúrny dom (v11.13: **každý hráč dostane
  špaky len za svoje karty v línii, aj víťaz**;
  Nakladačka sa rozdeľuje ako inde), Vínna pivnica (NA EX 2× za Pitku), Družstvo (v11.13: karty s akciou Robota
  nemíňajú limit).
- **Kšeft zanikol (frakcie, 2026-11-08).** **Akcie navyše:** karta s efektom „**Spoločník: Tag**“ má akcie
  z pečate (piktogramy dole v obrázku) navyše, kým máš v partii **inú** odkrytú kartu s tým tagom; „**Nepriateľ: Tag**“,
  kým ju má v partii súper — raz, aj pri viacerých takých kartách. „**Podpora**“ / „**Konflikt**“ ich pridá pri
  každom stretnutí priložením s tvojou / súperovou kartou (s tagom, ak ho efekt uvádza — Snúbenica „Podpora: Chlap {Cigareta}“, v11.18), do konca
  kola (×2 pri dvoch susedoch). Konflikt na kartách tag nemá (2026-11-08): platí pri ktorejkoľvek súperovej karte.
  Akcia navyše je tvoja aktívna akcia mimo hrán: ráta sa ako tá istá akcia v jej kroku (Obmedzenie a Cigareta v každej
  Pitke, Rany v bitke, Robota pri exekúcii); **Posilnenie suseda, Odpor, NA EX ani Silná žena ju nemenia**; Náradie
  v Dedičstve (Vidly, Valaška, Svätý text), Preškolenie Školiteľa a **celý podložený Nástroj** áno (v11.22: akciová hrana ju
  preškolí, hrana posilnenia „Posilnená {X}“ a Forsáž karty (zo spoja aj z Energeťáka) ju zdvoja ×2 — Puška dole pod Šoférom: jeho Pecka navyše ×2).
  „Bitka: podmienka {Rana}“ (Pijan, Svokra, Vymáhač, Šofér, Traktorista, Pasca) je akcia navyše v bitke, toľkokrát, koľkokrát
  podmienka platí; „Pitka: {Hazard}“ (Výherný automat, v11.22) dá v každej Pitke rovno 1 Dlh. „**Furt: {A}**“ platí bez
  podmienky, kým karta leží. Skrytá Záverečná podmienku
  nesplní ani nedostane. V texte efektu sú akcie navyše zapísané ako {Povera}. **{Spálenie}** v pečati nie je akcia:
  **Krokodíl** (Konflikt: Občan {Spálenie}, v11.17) — súperov Občan, s ktorým sa priložením stretne (prikladáš ty aj súper),
  sa **na konci bitky spáli** (navždy z hry; jej akcie v bitke ešte platia; vedľa Mäsiara nič).
- **Školitelia — Preškolenie (2026-11-08; v11.16 aj Zviera, to vedľa Mäsiara neplatí):** „Furt/Podpora/Konflikt: **Preškolenie** {X}→{Y}.“ (Furt má Kapybara) — akcia X **inej** karty sa
  ráta ako Y (pre majiteľa tej akcie), **pred spojmi**, na oboch hranách aj v akciách navyše. **Furt** = obaja susedia
  Školiteľa (karty oboch hráčov), kým susedia; **Podpora** = tvoja karta, s ktorou sa priložením stretne, do konca kola;
  **Konflikt** = súperova karta, s ktorou sa stretne, do konca kola. **Reťazí sa všetko (v11.20)**: najprv Školitelia (Podpora
  a Konflikt v poradí spustenia, potom Furt — skôr sused bližšie k lokalite), potom Nástroje pod kartou v poradí podloženia;
  každá premena pracuje na výsledku predošlej: Sypač Rana → Pecka a Valaška hore Pecka → Petelica = Petelica; Podpora Rana → Pecka
  a po nej Konflikt Pecka → Petelica = Petelica; pod Zámočníkom Pečeň → Rana a po ňom Rana → Pecka = Pecka; premena, ktorej X
  predošlé už zmenili, nerobí nič. **Kapybara** (Zviera, Furt, v11.22): obaja priami susedia (tvoji aj súperovi),
  kým s ňou susedia, majú **Viery ako Cigarety**. **Vedúcko** (Podpora, v11.18): tvoja karta má **Roboty ako Pecky**. **Sypač**
  (Podpora): tvoja karta má **Rany ako Pecky**. **Anonymný alkoholik** (Podpora): tvoja karta má **Poškodenie pečene ako
  Vieru**. **Profesionálny tipér** (Konflikt): súperova karta má **Cigarety ako Hazard** (Dlh namiesto cigarety).
- **Schopnosť väzňa (v11.2, 2026-11-02; Kšeft väzňa zanikol):** každý tvoj väzeň má schopnosť, ktorú
  použiješ **raz za hru, kedy chceš** — vo **svojom ťahu** pri braní z ponuky, v Zhromaždení alebo v Pitke
  (kým ju neskončíš, nie pri odpovedi na NA EX), aj vo finále; nie je to ťah a nič nestojí. Potom je
  **minutá**, väzeň ostáva v pivnici (ráta sa ako tvoja červená). Naprázdno sa neponúkne.
  `{"type":"schopnostVazna","elderId":…}` (Farár a Hrobár s `uid`, Autobusár s `uids`).
  **Poštárka:** dostaneš **4 cigarety**. **Krčmárka:** **nový plný poldeci** (natrvalo, +1 poldeci).
  **Farár:** odstráň jedno súperovo NA EX z karty (`uid` karty); jeho poldeci ostáva vypitý.
  **Starosta:** **do konca kola** sú všetky aktívne akcie lokality **posilnené** (obom; v bitke aj v ďalších
  Pitkách — aj Hazard, pečeň, Poldeci, Cigareta, Vízia, Obmedzenie). **Veterinár:** odhoď všetky priznané Cirhózy a Cirhózy na ruke
  (do odhadzovacieho balíčka). **Vychovávateľka** (len v Zhromaždení): súper v tomto Zhromaždení hneď pasuje
  (**už nevyloží nič**, aj keď ju použiješ prvým ťahom) a **za pas nedostane cigarety**; ty vykladáš ďalej. **Autobusár** (len pri braní z ponuky): ber z ponuky, koľko chceš, **každú kartu za 1
  cigaretu** (`uids`); potom s braním končíš a pokračuje súper. **Hrobár:** 1 karta zo súperovho
  odhadzovacieho balíčka do ruky (`uid`).
- **Identita kariet (v11.5):** **Sypač** (Podpora, Školiteľ): keď sa priložením stretne s tvojou kartou, tá má do konca
  kola **Rany ako Pecky** (aj Rany navyše). **Silná nezávislá žena** (Furt, 2026-11-08): zdvojí aktívne akcie len tvojich susedných **Občanov a Starešinov**, nie Zviera ani Nástroj (ani Recidivistu). **Anonymný alkoholik**
  (Podpora, Školiteľ): tvoja karta, s ktorou sa stretne, má Poškodenie pečene ako **Vieru**. **Kôň** (Furt): kým leží v línii,
  Nástroj smieš podložiť aj pod Zviera; **Roboty Koňa pália o 1 Dlh viac**. **Noviny** (Dedičstvo: Hádka): keď vyhráš hádku, súper
  odhodí **1 náhodnú kartu z ruky**. Výtržník má vždy Rany (aj Sypač).
- **Konflikt (v11.3):** efekt karty, keď sa **priložením** ocitne vedľa **súperovej** karty — či ju prikladáš
  ty k súperovej, alebo súper k nej (aj odpoveďou na NA EX; Záverečná až pri otočení). Podloženie
  Nástroja nič; NA EX, zrážka ani presun (Dohadzovačka, Poľovník) nič. Najprv Nástup priloženej karty, potom
  Konflikt a Podpora priloženej, potom ležiacej. **Podpora (v11.3)** je zrkadlo: spustí sa, keď sa priložením
  stretnú **dve tvoje** karty. **Veľmi smútiaca vdova (Konflikt, frakcie):** pri ktorejkoľvek súperovej karte
  súper odhodí **1 náhodnú kartu z ruky** (vyberie ju hra, nikto nevolí). **Predavačka (Podpora, v11.22):** vezmi si z ponuky
  1 hocijakú kartu **navrch svojho doberacieho balíčka** (dobereš ju pri najbližšom ťahaní). **Živnostník (Podpora, 2026-11-09):**
  vezmi si z ponuky zadarmo do ruky 1 Nástroj. Voľba `{"type":"senok","uid":<uid>}` (Živnostník len z Nástrojov); bez takej karty v ponuke nič. **Hasič (Podpora, frakcie):** voľba ako predtým, len spúšťač je Podpora namiesto Nástupu.
- **Pakt (v7, akcia):** na spoji sa správa ako akcia, s ktorou je v páre (aj zlá: Hazard, Pečeň).
  Pakt s Paktom nerobí nič, s Posilnením sa stane Posilnením (= Forsáž), Odpor ho zruší; neaktívny Pakt NA EX nezdvojí.
  Pakt, ktorý akciu kopíruje, je ňou pre všetky efekty (tvoje Pecky, Vidly, Horoskop, Zapaľovač…).
- **Forsáž (v10.3):** Posilnenie + Posilnenie na spoji = **Forsáž** — obe karty spoja majú **všetky
  aktívne akcie posilnené ×2** (aj Hazard a Pečeň); akcia posilnená ešte Posilnením suseda **×4**.
  Lokalita len hranu pri tom kraji. NA EX
  na jednu z kariet spoja jej Posilnenie
  zruší, a tým aj Forsáž (Energeťák v Dedičstve, Veterán a nespárované Posilnenie tej karty to zastavia).
- **Vzbura (v11.1):** Odpor + Odpor na spoji **obráti** obe karty — aktívne sú ich **nespojené** akcie
  (aj celá vonkajšia hrana), **spojené sú neaktívne** (aj posilnené susedom); zrušené Odporom ostávajú.
  **Odpor proti Posilneniu** = Vzbura len karty s Odporom a jej aktívne (nespojené) akcie sú **×2**
  (s Forsážou ×4); karta s Posilnením nič. Odpor a Posilnenie karty na jej druhom spoji pôsobia ďalej.
  **Na kartu so Vzburou NA EX nedáš.** Vzbura sa oplatí karte s veľa voľnými akciami; karte s dobrými
  spojmi uškodí.
- **Draft (v8.5):** karty ponuky sú v dvoch balíčkoch — **Náradie** (Nástroje) a **Občania** (ostatné).
  Stavba ponuky naraz, bez podávania: dostaneš **2 karty z Náradia a 6 z Občanov**, dáš **4 do ponuky**
  v ľubovoľnom mixe a 4 naspodok (Nástroj k Náradiu, ostatné k Občanom;
  `{"type":"stavbaSenku","doSenku":[…],"odhod":[…]}`) — vyberáte naraz. Po braní sa ponuka sama doplní
  na 8: najprv z Náradia, kým v ňom nie sú 2 Nástroje, zvyšok z Občanov. Branie striedavo, **začína obranca (v9.2)**: **1 karta za 1 cigaretu,
  2 karty za 3 cigarety** (`{"type":"draftBer","uids":[…]}`); **kto berie prvý, na svojom prvom ťahu vezme len 1 kartu**; poldeci sa
  v ponuke neplatí; `draftStop` ukončí branie.
- **Ruka bez limitu:** na začiatku každého ďalšieho kola si dobereš **2 karty** bez ohľadu na to, koľko ich máš v ruke (v11.21); nič sa neodhadzuje.
- **Výpalné (v11.9):** súper ti hneď po bitke dá **1 cigaretu za každého staršieho** s tvojím červeným strachom (väzeň sa ráta), koľko má; po finále nie. Máš ho teda na ponuku.
  Karty navyše: ponuka, fajčenie (`smoke`: karta hneď, **len v Pitke** (v5), v Zhromaždení
  nie; **prvé fajčenie v Pitke 1 cigareta, druhé 2, tretie 3…**, každá Pitka znova od 1
  (2026-10-27; na Benzínke každé o 1 lacnejšie, prvé zadarmo), každá vyfajčená cigareta je nerest (v9.1: druhé fajčenie za 2 = 2 neresti); s prázdnym doberacím aj odhadzovacím balíčkom sa fajčiť
  nedá), Vízia, efekty (z ponuky Zastávka, Predavačka, Živnostník). Priznanie Cirhózy kartu nedá. Malý balíček prehru nespôsobí (v5).
  Keď sa doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový
  doberací balíček (pri každom ťahaní).
- **Kliatby (v8.2, 2026-10-30):** **Dlh je počítadlo, nie karta** — vzniká rovno priznaný,
  neťaháš ho, kartu zaň nedobereš a nedá sa s ním inak manipulovať (stav ukazuje „priznané dlhy N“,
  verejné). Priznané Dlhy idú k Exekútorovi a pri remíze v bitke prehráva viac Dlhov.
  **Absťák je od v9.1 karta** (Kliatba, nedá sa priznať, nižšie). Kartou je aj **Cirhóza** — jediná kliatba, ktorú smieš priznať. Nová **Cirhóza ide do tvojho
  odhadzovacieho balíčka** (2026-10-25) — do ruky príde, až keď sa doberací balíček minie a odhadzovací
  sa zamieša; priznáš ju, keď chceš, ale kartu za ňu **nedobereš** a súper za každú
  priznanú dostane v bitke +1 tuhé (nepriznaná ide po bitke do tvojho odhadzovacieho balíčka; na konci hry −3 špaky za kus)
  — prizná ju hneď, alebo riskuješ, že sa ti do konca nevráti do ruky. Kým ju nepriznáš, súper za ňu tuhé
  nedostáva. Počet súperových
  nepriznaných Cirhóz je verejný (stav ho ukazuje). Dlh pália Robota (1 Dlh za aktívnu Robotu; **za každý Dlh, ktorý nemá čo spáliť, 1 špak** — v8.4) a Exekútor
  (v každej bitke); Kmotor ho presunie súperovi. Kliatba do línie nepatrí. Priznanie nemíňa
  limit ani neodovzdá ťah. Za priznané Dlhy príde v každej bitke Exekútor.
- **Záverečná (Zhromaždenie, za 1 cig.):** `{"type":"zaverecna","uid":…,"target":"vlastna"|"superova"}` —
  karta lícom dole, míňa limit, potom už v Zhromaždení nevykladáš (bez cigariet za pas). Súper ju
  nevidí, za ňu nepriloží (ani odpoveď na NA EX), NA EX na ňu smie len on (prejde vždy); akciu jeho
  karty, ktorú spáruje, mu výpis ani odhad bitky neukáže. Otočí sa na konci Pitky — až vtedy Nástup a Konflikt, ktorý priložením vyvolala.
- **Nástup bez voľby:** Dohadzovačka (Nástup, 2026-10-28, v11.19): keď ju priložíš k Občanovi či Starešinovi,
  presunie sa za ňu **len karta z konca druhého kraja** (najďalej od lokality), ak je to Občan alebo Starešina
  opačného pohlavia ako jej sused; inak (iná karta na konci, skrytá Záverečná, prázdny kraj) sa nič nestane
  (na koniec línie za ňou; povinné, karta ostáva majiteľovi, Konflikt sa nespustí). **Poľovník (Nástup, v10.4):**
  v druhom kraji sa **spáli súperovo Zviera, ktoré je od lokality najďalej** (povinné, bez voľby;
  vlastné Zvieratá nie, skrytá Záverečná nie; medzera sa uzavrie, Konflikt sa nespustí). Ak tam žiadne nie je, nič.
- **Vízia:** na konci Pitky za každú aktívnu Víziu uvidíš vrchnú kartu svojho
  balíčka — `{"type":"vizia","vziat":true}` do ruky, alebo `false` = spáliť
  (navždy z hry).
- **Spáliť vs. odhodiť (v10.4):** **spáliť** = karta ide navždy z hry (Vízia, Poľovník, Krokodíl, Zberný dvor;
  Robota a Exekútor pália Dlhy); **odhodiť** = do odhadzovacieho balíčka (vráti sa).
- **Hasič (Podpora od frakcií, 2026-10-26):** vytiahne náhodnú kartu z tvojho odhadzovacieho
  balíčka (aj kliatbu; súper ju vidí, odhadzovací je verejný) —
  `{"type":"hasic","nechat":true}` do ruky,
  alebo `false` = vráti sa do odhadzovacieho. Kým nerozhodneš, hra čaká; v ťahu
  naraz rozhoduješ po zvyšku ťahu. Prázdny odhadzovací = nič.
- **Starší (v9):** karta staršieho (boss) má v línii **len akcie** — jeho schopnosť má len držiteľ väzňa (v11.2). Bossovia
  majú 6 akcií a presne 1 neresť (Hazard alebo Pečeň). Do ruky a balíčka sa dostane len **presvedčením** (v11.4, nižšie).
- **Dedičstvo** (Nástroj do hracej oblasti, `target` `dedicstvo`): cena rastie
  pre oboch spolu — 1., 2., 3. Nástroj v hre stojí 1, 2, 3 cigarety. Efekt
  Nástroja platí **len v Dedičstve**. Vínko vyložené v Zhromaždení zvýši zostávajúci
  limit **hneď** o 1 (2026-10-28).
- **Náradie (v8.4, 2026-10-30) — Nástroje do Dedičstva, menia len tvoje akcie:** Zapaľovač (tvoje aktívne
  Cigarety nemožno zrušiť NA EX), Výherné žreby (tvoje Hazardy aktívne, keď nie sú spojené, spojené neaktívne;
  NA EX potom zdvojí spojené), Izolačka (tvoje Obmedzenia uberajú aj súperove cigarety za pas), Hrable (akcia
  zrušená tvojím Odporom je tvoja ×2), Zrkadlo (tvoj Pakt kopíruje ×2), Valaška (Pecka +1 poškodenie), **Telefón (v11.17): remízu v hádke (nie 0 : 0) vyhrávaš ty, o 0 — súperovi klesnú reči;
  v bitke 1 Povera navyše za každú tvoju akciu, ktorú zrušil Odpor súperovej karty** (Pohoršenia už nechráni), Jogurt (Poldeci otočia
  vypitý poldeci hneď v Pitke), Energeťák (tvoje Posilnenie nemožno zrušiť NA EX), Horoskop: tvoje Povery majú silu 2
  (v10; každá dá 2 mäkké), Svätý text: hodnota tvojej Viery je o 1 vyššia (len v tlmení tuhého; Povery ruší 1 : 1), Fúrik (Robota páli o 1 Dlh viac), Krištáľová guľa (Vízia ukáže 2 vrchné
  karty: o jednej rozhodneš — `{"type":"vizia","vziat":true,"druha":true}` je o druhej —, druhá ostane navrchu).
  **Profesionálny tipér** (Konflikt, Školiteľ, 2026-11-08): súperova karta, s ktorou sa priložením stretne, má do konca
  kola Cigarety ako Hazard.
- **Podloženie Nástroja (Náradie, Michal 2026-11-08):** Nástroj sa **do línie nevykladá**. Z ruky ho
  **podložíš pod svojho Občana alebo Starešinu v línii — len pod svoje karty (v11.16), pod súperove nie** — za **1 cigaretu**:
  `{"type":"podloz","nastrojId":<uid z ruky>,"hostitelId":<uid karty v línii>,"hrana":"horna"|"dolna"}`.
  Je to **ťah** (v ťahu po Vypiť aj ďalší krok), **limit nemíňa**. Nástroj má **hornú a dolnú hranu**,
  platí len tá, ktorú zvolíš (pretŕča spod karty); natočenie sa nemení. Pod kartou leží **najviac jeden**
  Nástroj (pod **Zámočníka** ľubovoľne veľa), pod **Zviera** len kým v línii leží **Kôň**; pod kartu lícom
  dole nie. **Akciová hrana X → Y** zmení **všetky** X na oboch hranách karty aj v jej akciách navyše (v11.22) na Y ešte **pred spojmi**
  (susedia sa párujú už s Y; X je akcia až po Školiteľoch a Nástrojoch podložených skôr — reťazí sa, v11.20); bez X nerobí nič (podložiť smieš aj tak — ponuka ho označí NAPRÁZDNO, len minieš cigaretu a ťah). **Hrana posilnenia X** (Puška: Posilnená Petelica / Posilnená
  Pecka, 2026-11-09) posilní všetky X karty **aktívne po NA EX** ×2 ako Posilnenie (X po preškolení; s Forsážou ×4; NA EX
  aktívne X zruší a neaktívne aktivuje ×2, Puška ich potom posilní na ×4 — v11.21). **Kartová hrana** dá karte stav ako inou cestou:
  **Energeťák — Forsáž** (akcie aktívne po NA EX ×2; NA EX ju nezruší, neaktívne zdvojené NA EX majú ×4, v11.21), **Vínko — NA EX** (aktívne zrušené, neaktívne ×2;
  bez poldeca, nie je to nerest, nepije sa; skutočné NA EX na ňu už nejde; nie pod kartu s poldecom či so Vzburou),
  **Injekcia — Výtržník** (všetky akcie aktívne Rany pre majiteľa karty), **Vidly — Vzbura** (nespojené
  aktívne, spojené neaktívne). Podložený Nástroj **leží do bitky**, vyhodiť sa nedá; po bitke, alebo keď
  karta odíde z línie skôr (Poľovník), ide do **odhadzovacieho balíčka toho, kto ho podložil**. Podloženie nie
  je priloženie — Konflikt, Podporu ani Pascu nespustí. Hrany od v11.17 vlastnej karte pomáhajú (sabotáže zanikli):
  napr. Nealko hore Pečeň → Povera, dole Poldeci → Pohoršenie; Vidly dole Robota → Petelica; Pasca, Fúrik, Horoskop
  a Izolačka dole Posilnená Rana / Robota / Povera / Posilnené Obmedzenie. Presné hrany vidíš v popise karty.
- **NA EX na Občana alebo Starešinu v línii — svojho aj súperovho**, len na kartu
  s aspoň 1 aktívnou a aspoň 1 neaktívnou akciou (2026-10-23; súperova Záverečná vždy; neaktívny Pakt
  a neaktívne Posilnenie sa nerátajú) a **nie na kartu s nespárovaným Odporom** (v11.17). Zruší
  karte aktívne akcie a zdvojí neaktívne; akcie sa rátajú majiteľovi karty.
  Pečeň +1 je tvoja. Súper smie po odkrytí odpovedať jednou kartou mimo limitu, **lícom dole, za plný poldeci** (v11.16: vypije ho ako pri Vypiť — pečeň +1 hneď, 1 nerest; bez plného poldeci neodpovedá)
  (`place` / `bezReakcie`) — po otočení smie zmeniť prevahu v kraji aj počet Pitiek; Nástup až pri otočení. Nie na kartu, na ktorej
  už poldeci leží, ani na kartu so Vzburou (v11.1). NA EX na kartu
  pri lokalite mení len akcie karty, akcie hrany lokality ostávajú aktívne. NA EX na kartu
  s Posilnením zruší Posilnenie aj ×2 partnera na spoji (2026-10-24; partner ostáva ×1,
  aj hrana lokality). **NA EX na kartu s Odporom zruší Odpor a akcia, ktorú rušil, ožije ×1**
  (v11.17; aj hrana lokality — môže pridať Pitku; súperove Hrable o ňu prídu; Veteránovi Odpor nezruší).
  Akcia zrušená Odporom nie je ani aktívna, ani neaktívna — NA EX na jej karte ju nezdvojí (v6.1).
  **Poldeci ako partner (v11.17):** nespárovaný Odpor na karte s NA EX ho **zahasí** (karta ako bez
  NA EX, poldeci sa aj tak vypije — nastane len na súperovej Záverečnej či z Vínka, kým sa Odpor
  nespáruje); nespárované Posilnenie NA EX **podrží**: aktívne akcie karty nezruší (ani Posilnenie
  na spoji), neaktívne zdvojí ×2. Oboje na karte = vyhrá Odpor.
  Súperova **Svokra** mu v bitke dá Ranu navyše
  (akcia navyše; Vidly jej majiteľa ju zosilnia) za každú jeho kartu, na ktorej leží tvoj poldeci z NA EX — NA EX na svoje karty ju nespustí.
  Šofér (2026-11-08): ak si v kole nedal NA EX, v bitke Pecka a Rana navyše (Valaška a Vidly +1; cigareta zanikla). **Pijan** (v7): za každé tvoje NA EX v kole
  Rana navyše (Vidly +1). Injekcia v Dedičstve: NA EX aj na Zviera. **Stryná** (frakcie: Konflikt → Pohoršenie navyše pri ktorejkoľvek súperovej karte). **Bzdocha** (Pitka): súper hrá Pitku pred tebou — čakáš, kým skončí, a vidíš jeho NA EX. Veterán (v4): NA EX mu
  aktívne akcie zdvojí (nezruší), neaktívne nechá.
  **Skryto (v5):** `naex` súper nevidí do odkrytia; odpovedáš po odkrytí za každé súperovo NA EX —
  najprv útočník lícom dole, potom obranca na druhý kraj; viac NA EX = viac kôl (v každom po jednej odpovedi, potom otočenie). **Zrážka** (obaja na tú istú kartu) = **Výtržník**: karta sa
  spáruje so susedmi s pôvodnými akciami, potom sú všetky jej akcie aktívne Rany pre majiteľa,
  do konca bitky — aj jej Posilnenie a Odpor sú už len Rany, suseda nezdvojujú ani nerušia (v6.1); Rany Výtržníka sú vždy ×1, nezdvojí ich ani Silná nezávislá žena; pečeň aj poldeci platí každý za svoje NA EX.
  Krčma vynúti jedno NA EX. Násobky sa **násobia** (NA EX × Silná žena = ×4, aj Hazard
  a Poškodenie pečene) a NA EX leží na karte do bitky — vyhodnotí sa v každej
  Pitke kola. Každá možnosť `naex` v stave ukazuje cenu: bitku pred a po
  a kliatby (Cirhóza, Dlh) aj so špakmi pre oboch.
- **Doliatie** v Pitke: 2 cigarety → vypitý poldeci späť na plný (nie s Vínkom
  v Dedičstve). **Barter:** 5 cigariet → nový plný poldeci. Na začiatku kola sa
  jeden vypitý poldeci doleje sám.
- **Pečeň žije len v Pitke** — vyhodnotí sa v nej a potom sa vynuluje; za **každý celý prah** Cirhóza.
  **Každá aktívna akcia Hazard v Pitke = 1 Dlh (v11.8)**, 8 Hazardov = 8 Dlhov. Milujúca manželka (v7) v línii: tvoja pečeň v Pitke −1.
  Riadok „VÝHĽAD PITKY“ v stave ukazuje, čo pripíšu karty na stole a koľko kliatob z toho bude.
- **Chuť a Absťák (v9.1, 2026-10-30):** **Chuť** je tvoja verejná latka nerestí, na začiatku **0**. Nerest je
  len konzumácia: **Vypiť 1, odpoveď na NA EX 1 (v11.16), NA EX 2, vyfajčená cigareta 1** — doliatie,
  barter, ponuka ani Dedičstvo nie. **Na konci kola:** keď si v kole mal
  **menej nerestí, než je tvoja Chuť**, dostaneš **kartu Absťák do odhadzovacieho balíčka**; potom
  **Chuť = väčšie z (Chuť, neresti kola) − 1** (nie pod 0). Súper latku neurčuje. Po finále nič.
  **Karta Absťák:** nedá sa priznať ani vyložiť,
  po bitke ide z ruky späť do odhadzovacieho balíčka; v bitke **−1 tuhé za každý Absťák v tvojom balíčku**
  (ruka, doberací, odhadzovací); pri remíze v tuhom prehráva, kto ich má viac (obe po odpustení Abstinentom, v10). Spáliť
  ho smie len **Vízia**. Výpis ukazuje „CHUŤ 3 | dnes 1 | chýba 2“ a počet Absťákov oboch. Flám (veľa NA EX)
  zdvihne Chuť a ďalšie kolo ťa núti piť znova.
- **Strach a reči (v11, v11.12):** pri každom staršom má **každý hráč svoj teplomer** 0–3 (sivá, žltá, oranžová,
  červená) so svojím **strachom** (neklesá). **Reči idú na teplomer SÚPERA** ako súvislý blok stupňov.
  **Poradie (záväzné):** od vrchu jeho strachu nadol, potom nad neho; zo sivej zdola nahor. Ceny **1 / 2 / 3** za stupeň
  (jeho červená: 3, s oranžovou 5, plný teplomer 6; jeho oranžová: 2, so žltou 3, s červenou 6). Keď súper dvíha strach
  na stupeň s tvojimi rečami, platí **o 1 viac** (2 / 3 / 4). Keď strach reči prekoná, **blok sa posunie** a počet stupňov
  ostáva (reči žltá a oranžová, jeho strach oranžová → červená: reči oranžová a červená; reči žltá, strach → oranžová:
  reči oranžová). **Priazeň pre teba = strach súpera − tvoj strach** (najmenej 0; celý strach, aj obsadený,
  reči sa nerátajú). Obaja na červenej = priazeň nikto. Starší je podľa vyššieho strachu
  **pokojný (0), znepokojený (1), vystrašený (2), vydesený (3)**. Scorecard nesie priazeň.
  Výpis ukazuje pri staršom oba markery oboch a špaky pri tvojej výhre a prehre.
- **Priazeň (v9)** sila 1 / 2 / 3 = stupeň, bez dvojnásobku: Bitkár +1 / +2 / +3
  tuhého; Veriaci +1 / +2 / +3 Viery (proti Poverám aj v tlmení tuhého); Abstinent: v bitke sa ti neráta 1 / 2 / 3 Absťákov (v10 — tuhé neklesne a nerátajú sa ani pri remíze); **Advokát**: exekúcia
  ti odpočíta o 1 / 2 / 3 špaky menej (najmenej 0; Dlhy zhoria ako vždy); **Robota**: 1 / 2 / 3 akcie
  Robota navyše (pália Dlhy, za Dlh, ktorý nemá čo spáliť, 1 špak); Fajčiar +1 / +2 / +3 cigarety
  **po bitke** (Obmedzenie ich neuberá); **Kmotor: po bitke presunie 2 / 3 / 4 tvoje priznané Dlhy medzi súperove** (koľko máš);
  **Ohováračka (v11.10): +1 / +2 / +3 Povery v hádke** — správajú sa ako Povery z kariet (ruší ich súperova Viera, aj z Veriaceho; Horoskop aj Čierna mačka na ne platia).
  Prah Dlhu 1 (v11.8: Hazard aj „1 zadĺženie“ z efektu karty sú rovno Dlh), prah Cirhózy 3.
  Výherný automat (Dedičstvo, v7): tvoj prah Dlhu 2 (Dlh za každé 2 zadĺženia, zvyšok ostáva na účte do ďalšej Pitky aj kola), ale v každej Pitke získaš 1 Dlh (v11.22; Obecný úrad 2).
- **Exekútor bez prahu (2026-10-28):** Exekútor príde v každej bitke ku každému s priznaným Dlhom: zhorí polovica priznaných Dlhov zaokrúhlene nahor
  (aj jediný Dlh) a rovnako veľa špakov (Advokát ich uberie) — **až po
  poškodení a špakoch za bitku** (2026-10-28; Robota tesne pred ním), takže remíza a Herňa
  rátajú Dlhy pred exekúciou. Prehra nie je, na konci hry Dlhy nič. **Záhradkár** (Exekúcia, 2026-10-28):
  keď leží v línii v tvojej partii, exekúcia ťa v tomto kole obíde (žiadny Dlh ani špak); nespáli sa.
  Vymáhač: za každé 2 tvoje priznané Dlhy +1 Rana (akcia navyše; Vidly +1); Traktorista (v11.22): s prevahou v jeho kraji
  Pecka navyše v bitke; Dlhy nedáva.
- **Karty v7 v bitke a po nej:** Pes — jeho aktívne akcie na spoji so súperovou kartou ×2 (platí aj podstrčený); Mäsiar —
  efekty Zvierat v jeho okolí neplatia (ich akcie platia; 2026-10-28); Krokodíl — na konci bitky sa spáli súperov Občan,
  s ktorým sa stretol (v11.17); Vidly (Dedičstvo) — každá tvoja Rana o 1 poškodenie viac, aj Rana navyše (Pijan, Svokra, Vymáhač, Pasca, frakcie); Puška (Dedičstvo, 2026-10-30) — tvoju prepojenú Petelicu, ktorú by zrušil Odpor či NA EX, ráta namiesto zrušenia za 2; Pasca
  (Dedičstvo, v11.22) — Rana navyše za každú kartu, ktorú súper v kole priložil k tvojej (aj lícom dole); Krabička (Dedičstvo) — za každé
  2 cigarety, ktoré súper vyfajčí, karta; **Liberál (Furt, v10.3)** — keď máš v partii rovnako žien
  a chlapov (on sa ráta za oboch, skrytá Záverečná nie), všetky jeho aktívne akcie sú posilnené ×2. **Vedúcko (Podpora, Školiteľ, v11.18)** — tvoja karta, s ktorou sa priložením stretne, má do konca kola
  Roboty pred spojmi ako **Pecky** (aj Roboty navyše; súperova karta ani druhý sused nie): Dlh nepália, dávajú 2 tuhé (posilnená ×2).
- **Zajatie (v11.4, 2026-11-03):** pokus o zajatie v drafte a jeho cigareta **zanikli**. Kto **rozdeľuje
  Nakladačku**, smie pri staršom, pri ktorom je **tvoj strach 3** (červená) **už pred touto Nakladačkou** (od minulého kola, v11.6 — dotiahnutý v tom istom
  rozdelení nestačí), ho **zajať za 5 bodov** Nakladačky — `{"type":"prebytok","zdvihy":[…],"zajatia":[elderId,…]}`.
  Dobrovoľné, viac naraz smie byť; zvyšok sa rozdelí ako vždy. Starší je tvoj **väzeň** (priznané karty; zo
  stupnice zmiznú markery oboch) a **súper ti odovzdá toľko špakov, koľko bodov hádky má v rečiach pri ňom, najviac koľko má**
  (bez rečí 0). Obsadeného staršieho sa dá zajať a ráta sa ako červená. Väzni na výhru podľa ligy — overí sa hneď po rozdelení. Zajať
  smieš aj presvedčeného (aj svojho) — jeho karta zmizne, nech je kdekoľvek. Po finále väzni špaky nedávajú.
- **Presvedčenie (v11.4, v11.12):** kto **rozdeľuje hádku**, smie **ktoréhokoľvek staršieho**, pri ktorom má **reči na
  celom teplomere** (smieš ich dotiahnuť v tom istom rozdelení), ho **presvedčiť za 3 body** hádky — `{"type":"reci","zdvihy":[…],"presvedcenia":[elderId,…]}`.
  Napr. hádka 10 na prázdnom staršom: reči 1 + 2 + 3, presvedčenie 3, 1 bod inam. **Reči, strach oboch aj priazeň ostávajú**,
  starší ostáva na stupnici (priazeň aj bodovanie ďalej). **Jeho karta ide tebe do ruky a natrvalo patrí do tvojho
  balíčka**: hráš ju ako Starešinu (len akcie, ráta sa do prevahy, dá sa naň NA EX), po bitke do tvojho
  odhadzovacieho balíčka; nespáli sa (ide do odhadzovacieho) a Hrobár ju nevezme. Schopnosť
  väzňa pri presvedčenom neplatí. **Kto prvý presvedčí, toho je** — presvedčeného už nikto nepresvedčí, zajať ho
  smú obaja. Vo finále nie. Kto koho presvedčil, je verejné; kde karta práve je, nie.
- **Poradie bitky (v11):** **hádka** (kto ju vyhral a o koľko) → poškodenie → výsledok → **4a** špaky za karty
  v línii → **4b starší bodujú** (reči obom, víťaz navyše strach bez obsadených stupňov; reči porazeného v hádke potom −1 zospodu) → **4c výhra strachom**
  (víťaz so 4 červenými končí hru) → **4d** exekúcia (Robota, Exekútor) → **4e Nakladačka a reči** → poldeci,
  Cintorín, **porazený 1 cigareta** (po finále nie), Kmotor, Fajčiar → návrat
  kariet, Chuť a Absťák. Zajatie (krádež, výhra väzňami) je súčasť rozdelenia Nakladačky, presvedčenie rozdelenia hádky (4e).
- **Nakladačka a hádka (v11, 2026-11-02):** Nakladačku (rozdiel tuhého) **rozdelí víťaz bitky na svoj strach**,
  hádku (rozdiel mäkkého) **víťaz hádky na svoje reči na súperovom teplomere** — **ľubovoľne medzi starších**, stupeň stojí **do žltej 1,
  do oranžovej 2, do červenej 3** (strach zo žltej na červenú 2 + 3 = 5; reči pri jeho oranžovom strachu najprv oranžová za 2). Rozdelíš **jedným ťahom**: `{"type":"prebytok","zdvihy":[{"elderId":…,"na":2},…]}`,
  pre reči `{"type":"reci","zdvihy":[…]}` (`na` = stupeň, po ktorý v poradí obsadzuješ). **Rozdeľ, čo sa dá** — server neprijme
  rozdelenie, po ktorom by zvyšok ešte stačil na ďalší stupeň; **čo sa nedá, prepadne** (aj keď nemáš kam
  dvíhať vôbec). Zajatie a presvedčenie (vyššie) sa do „rozdeľ, čo sa dá“ nerátajú. Vyšší strach tebe body, ale súperovi priazeň a miesto na reči. Výpis pri rozdeľovaní
  ukáže cenník každého staršieho a hotové úplné rozdelenia (prvé je NÁVRH jadra); vlastné rozdelenie klient pred
  odoslaním overí a povie, kde by zvyšok ešte stačil.
- **Hádka (v10, v11) — mäkké poškodenie:** Povera a Pohoršenie **tuhé nerobia**, sú mäkké poškodenie.
  Na začiatku bitky sa Viera (aj z Veriaceho) a Povery vyrušia 1 : 1 na kusy — jedna Viera zruší jednu Poveru,
  aj vylepšenú Horoskopom; **mäkké = Pohoršenie × 2 + zvyšné Povery × 1** (Horoskop: Povera 2). Viera proti
  Pohoršeniu nepomáha; zvyšná Viera tlmí tuhé. Kto má viac mäkkého, vyhral hádku o rozdiel; rovnosť = nikto.
  **Priazne hádka nemení** — víťaz ju po bitke rozdelí na svoje reči (vyššie). Víťaza bitky aj Nakladačku určuje
  tuhé. Čierna mačka: jej majiteľove Povery sa Vierou nerušia.
- **Remíza (v6):** pri rovnakom tuhom vyhrá, kto má **menej Absťákov**, potom **menej
  priznaných Dlhov**; inak **sekera** — špaky kola (karty v línii) vezme víťaz najbližšej bitky,
  vo finále prepadnú; starší bodujú obom len reči, Nakladačku nemá nikto, **cigaretu nedostane nikto**;
  útočník ostáva.
