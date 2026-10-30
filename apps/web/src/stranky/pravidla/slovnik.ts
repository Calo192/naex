// Slovník pravidiel (osnova Navrhára 2026-10-24, schválil Michal): jediný zdroj
// pre vysvetlenie pojmu pod myšou v texte aj pre slovník na konci stránky.
// Každý pojem jednou vetou, podľa toho, čo hra naozaj robí (tools/playtest/tahak.md).

export interface PojemSlovnika {
  /** Kotva v slovníku (#pojem-<id>) a kľúč v texte (<Pojem k="…">). */
  readonly id: string;
  readonly pojem: string;
  readonly popis: string;
}

export const SLOVNIK: readonly PojemSlovnika[] = [
  { id: "abstak", pojem: "Absťák", popis: "Kliatba za menej nerestí než súper v tom istom kole — počítadlo, nie karta: príde rovno priznaný, kartu zaň nedobereš; v bitke ti uberie 1 tuhé a dá 1 Pohoršenie navyše. Rozhoduje remízu v tuhom." },
  { id: "akcia", pojem: "Akcia", popis: "Symbol na hrane karty; platí, len keď sa na spoji stretne s akciou suseda v rovnakej výške." },
  { id: "barter", pojem: "Stokársky barter", popis: "Počas Pitky za 5 cigariet nový plný poldeci (na Jednote o 1 menej)." },
  { id: "bitka", pojem: "Bitka", popis: "Koniec kola: viac tuhého poškodenia vyhráva a dostane špaky, Nakladačka posúva markery starších." },
  { id: "cigareta", pojem: "Cigareta", popis: "Mena hry: platí šenok, Dedičstvo, doliatie a barter; fajčením v Pitke hneď karta navyše (1, 2, 3… cigarety). Na konci hry každých 5 cigariet 1 špak." },
  { id: "cirhoza", pojem: "Cirhóza", popis: "Kliatba z pečene; ide do tvojho odhadzovacieho balíčka, priznaná dá súperovi v bitke +1 tuhé, nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí 3 špaky." },
  { id: "dedicstvo", pojem: "Dedičstvo", popis: "Nástroj vyložený mimo línie; platí jeho efekt a cena rastie pre oboch: 1., 2., 3. Nástroj stojí 1, 2, 3 cigarety." },
  { id: "dlh", pojem: "Dlh", popis: "Kliatba zo zadĺženia — počítadlo, nie karta: každé 2 zadĺženia v Pitke = 1 Dlh, hneď priznaný; za priznané Dlhy príde v každej bitke Exekútor, súperove Povery proti nim poškodzujú a pri remíze v bitke prehrá, kto ich má viac." },
  { id: "dlzka-hry", pojem: "Liga", popis: "Dĺžka hry — počet lokalít, o ktoré sa hrá: Tretia liga 3, Druhá liga 5, Prvá liga 7; po nich príde finále." },
  { id: "doliatie", pojem: "Doliatie", popis: "Počas Pitky za 2 cigarety otočíš vypitý poldeci späť na plný." },
  { id: "efekt", pojem: "Efekt", popis: "Text karty: čo karta robí a kedy; kedy hovorí tučné slovo na jeho začiatku." },
  { id: "hazard", pojem: "Hazard", popis: "Akcia, ktorá zvýši zadĺženie o 1; každé 2 zadĺženia v Pitke ti dajú Dlh." },
  { id: "exekutor", pojem: "Exekútor", popis: "Príde v každej bitke, kým máš priznaný Dlh: zhorí ti polovica Dlhov (zaokrúhlene nahor) a rovnako veľa špakov, so súperovou priazňou Exekútora o 1 / 2 / 3 viac. Záhradkár v tvojej partii ťa v tom kole ochráni." },
  { id: "finale", pojem: "Finále", popis: "Posledná bitka o pinnacle lokalitu, ktorú vyberie a natočí hráč s viac špakmi; hrá sa ako o každú inú (lokalita v strede línie, Pitky podľa spojov), útočí zaostávajúci (menej špakov), víťaz dostane 1 špak za každú kartu v línii." },
  { id: "pakt", pojem: "Pakt", popis: "Akcia (v7): na spoji sa správa ako akcia, s ktorou je v páre — aj zlá. Pakt s Paktom nerobí nič, Odpor ho zruší." },
  { id: "konflikt", pojem: "Konflikt", popis: "Spúšťač (v7): efekt ležiacej karty, keď k nej súper priloží svoju. Keď prikladáš ty, nič; Nástroj, NA EX ani zrážka ho nespustia." },
  { id: "vyvolat-konflikt", pojem: "Vyvolať Konflikt", popis: "Priložiť kartu k súperovej ležiacej karte so spúšťačom Konflikt." },
  { id: "uplatok", pojem: "Úplatok", popis: "Spúšťač (v7): súper smie raz za Pitku dať na kartu cigaretu a oslabiť ju; cigareta prepadne." },
  { id: "kseft", pojem: "Kšeft", popis: "Aktívny efekt (v7): za cenu ho spustíš sám v Pitke, kým ju neskončíš, každú kartu raz za Pitku; Kšeft lokality smie každý hráč." },
  { id: "fajcenie", pojem: "Fajčenie", popis: "Karta z balíčka hneď; smieš len v Pitke, kým ju neskončíš. Prvé fajčenie v Pitke stojí 1 cigaretu, druhé 2, tretie 3… a každá Pitka začína od 1." },
  { id: "kliatba", pojem: "Kliatba", popis: "Čo škodí majiteľovi: karty Cirhóza a Milujúca manželka a počítadlá Dlh a Absťák (tie sú hneď priznané)." },
  { id: "kolo", pojem: "Kolo", popis: "Cieľ, šenok, potom Zhromaždenie s Pitkou 1- až 4-krát (na pinnacle vo finále až 5-krát) a nakoniec bitka o lokalitu." },
  { id: "kraj", pojem: "Kraj", popis: "Polovica línie podľa hrany lokality; každá lokalita má vlastné mená krajov (Krčma: pri výčape a pri dverách)." },
  { id: "limit", pojem: "Limit vykladania", popis: "Koľko kariet vyložíš v jednom Zhromaždení: plné poldeci + 1." },
  { id: "linia", pojem: "Línia", popis: "Celý rad kariet v kole; lokalita v strede ho delí na dve strany (aj vo finále, kde je v strede pinnacle)." },
  { id: "lokalita", pojem: "Lokalita", popis: "Karta v strede línie, o ktorú sa v kole bije; jej efekt platí v tom kole." },
  { id: "klebety", pojem: "Klebety", popis: "Posun sily priazne staršieho z Povier v tomto kole (v8.3): o stupeň k majiteľovi Povery za každú, najviac na 3; marker sa nehýbe, po kole zaniknú." },
  { id: "naex", pojem: "NA EX!", popis: "Plný poldeci na kartu v línii, vybraný v Pitke skryto: zruší jej aktívne akcie a zdvojí neaktívne." },
  { id: "nastenka", pojem: "Krčmová nástenka", popis: "Odohrané bitky: lokalita, víťaz a jeho špaky za bitku; lokalitu si víťaz neberie." },
  { id: "nastroj", pojem: "Nástroj", popis: "Karta s tagom Nástroj; v línii funguje len pri Občanovi či Starešinovi, inak ide do Dedičstva." },
  { id: "natocenie", pojem: "Natočenie", popis: "Ako obranca otočí lokalitu — určuje, ktorá jej hrana patrí ktorému kraju." },
  { id: "nerest", pojem: "Nerest", popis: "Vypitie, NA EX, vyfajčená cigareta, doliatie a barter; počet sa porovnáva kolo s kolom." },
  { id: "odpoved", pojem: "Odpoveď na NA EX", popis: "Po odkrytí jedna karta za každé súperovo NA EX, mimo limitu; najprv odpovedá obranca, potom útočník." },
  { id: "partia", pojem: "Partia", popis: "Všetky tvoje karty v línii, nech ležia na ktorejkoľvek strane; ich akcie sa rátajú tebe." },
  { id: "pas", pojem: "Pas", popis: "Skončíš vykladanie v Zhromaždení a za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu — najviac toľko, koľko máš kariet v ruke." },
  { id: "patronat", pojem: "Patronát", popis: "Po šenku si vezmeš do ruky staršieho, ktorý ti prejavuje priazeň; vyhráš bitku a je tvoj." },
  { id: "pecen", pojem: "Pečeň", popis: "Počítadlo v Pitke z akcií Poškodenie pečene, Poldeci a z NA EX; za každý celý prah Cirhóza." },
  { id: "pitka", pojem: "Pitka", popis: "Vyhodnotenie po Zhromaždení: NA EX, Dlhy, pečeň, cigarety; v jednej bitke je 1 až 4 Pitiek (vo finále na pinnacle 1 až 5) a víťaz bitky dostane 1 špak za každú." },
  { id: "podstrcenie", pojem: "Podstrčenie", popis: "Karta vyložená na súperovu stranu; ostáva tvoja a jej akcie sa rátajú tebe (okrem Kočovníka)." },
  { id: "pohorsenie", pojem: "Pohoršenie", popis: "Akcia: v bitke bod na posun markera staršieho od seba (desíš) alebo k sebe (upokojuješ) — pole stojí podľa zóny (von zo stredu 1 / 2 / 3, k stredu 2 / 3 / 4), vyberáš staršieho a smer; priazeň sa mení hneď." },
  { id: "poldeci", pojem: "Poldeci", popis: "Pohárik pálenky; plný zvyšuje limit o 1 a platí ním NA EX aj ďalšiu kartu v ťahu. Plný na konci hry je 1 špak." },
  { id: "povera", pojem: "Povera", popis: "Akcia, ktorá ohovára staršieho: každá, ktorú nezruší súperova Viera (1 : 1), posunie v bitke silu priazne jedného staršieho o stupeň k tebe — len na toto kolo, marker sa nehýbe." },
  { id: "prebudenie", pojem: "Prebudenie", popis: "Marker na krajnej červenej pozícii: efekt staršieho začne pôsobiť pre teba." },
  { id: "prebytok", pojem: "Nakladačka", popis: "O koľko vyhrávaš v tuhom poškodení (drží ju víťaz); posúva markery starších k súperovi, pole stojí podľa zóny (von zo stredu 1 / 2 / 3, k stredu 2 / 3 / 4) — ktorých starších, vyberá súper (spravidla porazený); marker ide, kým zvyšok stačí. Vo finále sa nerozdeľuje." },
  { id: "prevaha", pojem: "Prevaha", popis: "V kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov; dostane akcie hrany lokality." },
  { id: "priazen", pojem: "Priazeň", popis: "Výhoda od staršieho, ku ktorému je posunutý marker: sila = stupeň (1, 2 alebo 3)." },
  { id: "priznanie", pojem: "Priznanie", popis: "Kliatbu vyložíš mimo línie do svojej hracej oblasti — natrvalo z balíčka." },
  { id: "sekera", pojem: "Na sekeru", popis: "Bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch): jej špaky vezme víťaz najbližšej bitky, vo finále prepadnú." },
  { id: "senok", pojem: "Šenok", popis: "Ponuka kariet lícom nahor; beriete z nej 1 kartu za 1 cigaretu alebo 2 za 3." },
  { id: "spoj", pojem: "Spoj", popis: "Miesto, kde sa dotknú hrany dvoch kariet alebo karty a lokality." },
  { id: "starsi", pojem: "Starší", popis: "Vážená osoba dediny so stupnicou strachu (7 polí); desíš ho posúvaním markera od seba, upokojuješ k sebe." },
  { id: "stupen", pojem: "Stupeň", popis: "Poloha markera od stredu: 0 sivý stred (pokojný), 1 žltá (znepokojený), 2 oranžová (vystrašený), 3 červená (vydesený). Pre jedného sila priazne, pre druhého strach." },
  { id: "strach", pojem: "Strach", popis: "Stupeň 1 až 3, na ktorom sa ťa starší bojí; každý stupeň ti raz zaplatí (žltá 1, oranžová 2, červená 3), keď sa na ňom marker udrží do konca nasledujúceho kola — nech bitku vyhrá ktokoľvek." },
  { id: "udrzanie", pojem: "Udržanie", popis: "Stupeň, kam sa marker dostal, zaplatí strach až na konci nasledujúceho kola, ak ho dovtedy nikto neodtlačí; vo finále nové stupne nič." },
  { id: "spak", pojem: "Špak", popis: "Víťazný bod: za vyhratú bitku (1 za každú kartu v línii), za udržaný strach starších, ktorí sa ťa boja (1 / 2 / 3 na konci kola); na konci aj za zvyšné plné poldeci a cigarety (výkupné); po finále vyhrá, kto má viac." },
  { id: "strana", pojem: "Strana", popis: "Polovica línie od lokality — tvoja a súperova; kartu kladieš na koniec ktorejkoľvek." },
  { id: "tag", pojem: "Tag", popis: "Druh karty (Občan, Zviera, Starešina, Nástroj…); odkazujú na neho efekty." },
  { id: "tuhe", pojem: "Tuhé poškodenie", popis: "Poškodenie z Rany (1), Pecky (2) a Petelice (3); kto má viac, vyhrá bitku." },
  { id: "utocnik", pojem: "Útočník a obranca", popis: "Útočník prehral poslednú bitku: berie zo šenku a vykladá prvý; obranca vyberá cieľ a na NA EX odpovedá prvý; Pitku hrajú obaja naraz; vo finále útočí, kto má menej špakov, a pinnacle vyberá vedúci." },
  { id: "viera", pojem: "Viera", popis: "Akcia, ktorá ruší súperove Povery a znižuje jeho tuhé poškodenie." },
  { id: "vizia", pojem: "Vízia", popis: "Na konci Pitky pozrieš vrchnú kartu balíčka a vezmeš si ju alebo ju navždy zahodíš." },
  { id: "vydesenie", pojem: "Vydesenie", popis: "Polovica starších vydesených z teba (stupeň 3, krajná červená); udrž ich do konca ďalšieho kola a vyhráš." },
  { id: "vytrznik", pojem: "Výtržník", popis: "Karta, na ktorú ste obaja dali NA EX v tej istej Pitke: všetky jej akcie sú Rany pre majiteľa, do konca bitky." },
  { id: "vypit", pojem: "Vypiť", popis: "Otočíš plný poldeci na vypitý, aby si v tom istom ťahu vyložil ďalšiu kartu: limit −1, pečeň +1." },
  { id: "vykupne", pojem: "Výkupné", popis: "Po finále dostaneš 1 špak za každý plný poldeci a 1 špak za každých celých 5 cigariet, ktoré ti ostali." },
  { id: "vzbura", pojem: "Vzbura", popis: "Odpor proti Odporu: obe karty vyhodnotia svoje inak neaktívne akcie ako aktívne." },
  { id: "zaverecna", pojem: "Záverečná", popis: "Karta lícom dole za 1 cigaretu; otočí sa na konci Pitky a potom už v Zhromaždení nevykladáš." },
  { id: "zhromazdenie", pojem: "Zhromaždenie", popis: "Fáza, v ktorej hráči striedavo vykladajú karty do línie; začína útočník." },
];

const PODLA_ID: ReadonlyMap<string, PojemSlovnika> = new Map(SLOVNIK.map((p) => [p.id, p]));

export function pojemSlovnika(id: string): PojemSlovnika | null {
  return PODLA_ID.get(id) ?? null;
}
