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
  { id: "abstak", pojem: "Absťák", popis: "Karta s tagom Kliatba za menej nerestí v kole, než je tvoja Chuť: ide do odhadzovacieho balíčka, nedá sa priznať; každý v tvojom balíčku ti v bitke uberie 1 tuhé. Rozhoduje remízu v tuhom. Spáli ho Vízia." },
  { id: "chut", pojem: "Chuť", popis: "Tvoja verejná latka nerestí, na začiatku 0. Na konci kola: menej nerestí než Chuť = karta Absťák; potom Chuť = väčšie z (Chuť, neresti kola) − 1." },
  { id: "akcia", pojem: "Akcia", popis: "Symbol na hrane karty; platí, len keď sa na spoji stretne s akciou suseda v rovnakej výške." },
  { id: "barter", pojem: "Stokársky barter", popis: "Počas Pitky za 5 cigariet nový plný poldeci." },
  { id: "bitka", pojem: "Bitka", popis: "Koniec kola: viac tuhého poškodenia vyhráva a dostane špaky, starší bodujú, víťaz rozdelí Nakladačku na svoj strach a víťaz hádky hádku na svoje reči." },
  { id: "cigareta", pojem: "Cigareta", popis: "Mena hry: platí šenok, Dedičstvo, doliatie, barter a Záverečnú; fajčením v Pitke hneď karta navyše (1, 2, 3… cigarety). Na konci hry každých 5 cigariet 1 špak." },
  { id: "cirhoza", pojem: "Cirhóza", popis: "Kliatba z pečene; ide do tvojho odhadzovacieho balíčka, priznaná dá súperovi v bitke +1 tuhé, nepriznaná ide po bitke do tvojho odhadzovacieho balíčka a na konci hry stojí 3 špaky." },
  { id: "dedicstvo", pojem: "Dedičstvo", popis: "Nástroj vyložený mimo línie; platí jeho efekt a cena rastie pre oboch: 1., 2., 3. Nástroj stojí 1, 2, 3 cigarety." },
  { id: "dlh", pojem: "Dlh", popis: "Kliatba zo zadĺženia — počítadlo, nie karta: každé 2 zadĺženia v Pitke = 1 Dlh, hneď priznaný; za priznané Dlhy príde v každej bitke Exekútor a pri remíze v bitke prehrá, kto ich má viac." },
  { id: "dlzka-hry", pojem: "Liga", popis: "Dĺžka hry — počet lokalít, o ktoré sa hrá: Tretia liga 3, Druhá liga 5, Prvá liga 7; po nich príde finále." },
  { id: "doliatie", pojem: "Doliatie", popis: "Počas Pitky za 2 cigarety otočíš vypitý poldeci späť na plný." },
  { id: "efekt", pojem: "Efekt", popis: "Text karty: čo karta robí a kedy; kedy hovorí tučné slovo na jeho začiatku." },
  { id: "hazard", pojem: "Hazard", popis: "Akcia, ktorá zvýši zadĺženie o 1; každé 2 zadĺženia v Pitke ti dajú Dlh." },
  { id: "exekutor", pojem: "Exekútor", popis: "Príde v každej bitke, kým máš priznaný Dlh: zhorí ti polovica Dlhov (zaokrúhlene nahor) a rovnako veľa špakov; tvoja priazeň Advokáta ich uberie o 1 / 2 / 3. Záhradkár v tvojej partii ťa v tom kole ochráni." },
  { id: "finale", pojem: "Finále", popis: "Posledná bitka o pinnacle lokalitu, ktorú vyberie a natočí hráč s viac špakmi; hrá sa ako o každú inú (lokalita v strede línie, Pitky podľa spojov), útočí zaostávajúci (menej špakov), víťaz dostane 1 špak za každú kartu v línii." },
  { id: "pakt", pojem: "Pakt", popis: "Akcia (v7): na spoji sa správa ako akcia, s ktorou je v páre — aj zlá. Pakt s Paktom nerobí nič, Odpor ho zruší." },
  { id: "konflikt", pojem: "Konflikt", popis: "Spúšťač (v11.3): efekt karty, keď sa priložením ocitne vedľa súperovej karty — či prikladáš ty k súperovej, alebo súper k tvojej. Nástroj, NA EX, zrážka ani presun ho nespustia." },
  { id: "podpora", pojem: "Podpora", popis: "Spúšťač (v11.3): zrkadlo Konfliktu — efekt karty, keď sa priložením stretne s inou tvojou kartou." },
  { id: "vyvolat-konflikt", pojem: "Vyvolať Konflikt", popis: "Priložiť kartu k súperovej ležiacej karte so spúšťačom Konflikt." },
  { id: "forsaz", pojem: "Forsáž", popis: "Posilnenie proti Posilneniu: obe karty majú všetky aktívne akcie posilnené (×2); Nástroj ju nedostane a NA EX na jedno z Posilnení ju zruší." },
  { id: "kseft", pojem: "Kšeft", popis: "Aktívny efekt (v7): za cenu ho spustíš sám v Pitke, kým ju neskončíš, každú kartu raz za Pitku; Kšeft lokality smie každý hráč." },
  { id: "fajcenie", pojem: "Fajčenie", popis: "Karta z balíčka hneď; smieš len v Pitke, kým ju neskončíš. Prvé fajčenie v Pitke stojí 1 cigaretu, druhé 2, tretie 3… a každá Pitka začína od 1." },
  { id: "kliatba", pojem: "Kliatba", popis: "Čo škodí majiteľovi: karty Cirhóza a Absťák a počítadlo Dlh (hneď priznaný). Priznať sa dá len Cirhóza." },
  { id: "kolo", pojem: "Kolo", popis: "Cieľ, šenok, potom Zhromaždenie s Pitkou 1- až 4-krát (na pinnacle vo finále až 5-krát) a nakoniec bitka o lokalitu." },
  { id: "kraj", pojem: "Kraj", popis: "Polovica línie podľa hrany lokality; každá lokalita má vlastné mená krajov (Krčma: pri výčape a pri dverách)." },
  { id: "limit", pojem: "Limit vykladania", popis: "Koľko kariet vyložíš v jednom Zhromaždení: plné poldeci + 1." },
  { id: "linia", pojem: "Línia", popis: "Celý rad kariet v kole; lokalita v strede ho delí na dve strany (aj vo finále, kde je v strede pinnacle)." },
  { id: "lokalita", pojem: "Lokalita", popis: "Karta v strede línie, o ktorú sa v kole bije; jej efekt platí v tom kole." },
  { id: "reci", pojem: "Reči", popis: "Druhý marker hráča pri staršom na tej istej stupnici ako strach, vždy nad tvojím strachom (na stole šrafovaná časť teplomera); dvíha ich hádka, bodujú aj pri prehre, po bodovaní klesnú o stupeň. Do priazne, výhry strachom ani zajatia sa nerátajú." },
  { id: "hadka", pojem: "Hádka", popis: "Krok bitky: kto má viac mäkkého poškodenia, vyhral hádku o rozdiel („Ana vyhrala hádku o 3“) a po bodovaní ho rozdelí na svoje reči — stupeň stojí 1 / 2 / 3, zvyšok prepadne. Pri rovnosti nikto; vo finále ide hádka na špaky." },
  { id: "makke", pojem: "Mäkké poškodenie", popis: "Pohoršenie × 2 + Povery, ktoré nezrušila súperova Viera (s Horoskopom × 2). Tuhé nerobí — rozhoduje len hádku." },
  { id: "naex", pojem: "NA EX!", popis: "Plný poldeci na kartu v línii, vybraný v Pitke skryto: zruší jej aktívne akcie a zdvojí neaktívne." },
  { id: "naradie", pojem: "Náradie", popis: "Balíček Nástrojov lícom dole; pri stavbe šenku z neho dostaneš 2 karty, nevzaté a odhodené Nástroje sa vracajú naspodok." },
  { id: "nastenka", pojem: "Krčmová nástenka", popis: "Odohrané bitky: lokalita, víťaz a koľko špakov za ňu v kole získal (bitka, Robota, starší…); lokalitu si víťaz neberie. Klik na lokalitu ukáže súhrn Pitiek a bitky." },
  { id: "nastroj", pojem: "Nástroj", popis: "Karta s tagom Nástroj; v línii funguje len pri Občanovi či Starešinovi, alebo ho za cigarety vyložíš do Dedičstva." },
  { id: "natocenie", pojem: "Natočenie", popis: "Ako obranca otočí lokalitu — určuje, ktorá jej hrana patrí ktorému kraju." },
  { id: "nerest", pojem: "Nerest", popis: "Len konzumácia: Vypiť 1, NA EX 2, vyfajčená cigareta 1. Na konci kola sa porovnáva s tvojou Chuťou." },
  { id: "obcania", pojem: "Občania", popis: "Balíček všetkých ostatných kariet šenku (Občania, Zvieratá…) lícom dole; pri stavbe šenku z neho dostaneš 6 kariet." },
  { id: "odhodenie", pojem: "Odhodiť", popis: "Karta ide do odhadzovacieho balíčka svojho majiteľa — keď sa doberací minie, zamieša sa a vráti do hry. Opak spálenia." },
  { id: "odpoved", pojem: "Odpoveď na NA EX", popis: "Po odkrytí jedna karta za každé súperovo NA EX, lícom dole, zadarmo a mimo limitu; najprv odpovedá útočník, potom obranca na druhý kraj línie; obe sa otočia naraz." },
  { id: "partia", pojem: "Partia", popis: "Všetky tvoje karty v línii, nech ležia na ktorejkoľvek strane; ich akcie sa rátajú tebe." },
  { id: "pas", pojem: "Pas", popis: "Skončíš vykladanie v Zhromaždení a za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu — najviac toľko, koľko máš kariet v ruke." },
  { id: "pokus", pojem: "Zajatie", popis: "Pri rozdelení Nakladačky (vyhral si bitku) zajmeš za 5 bodov staršieho, pri ktorom je tvoj strach 3 (dotiahnuť ho tam smieš v tom istom rozdelení; reči sa nerátajú). Je tvoj väzeň a súper ti odovzdá špaky za svoj marker pri ňom. Vo finále nie. Do v11.3 pokus o zajatie pred šenkom." },
  { id: "presvedcenie", pojem: "Presvedčenie", popis: "Pri rozdelení hádky presvedčíš za 5 bodov staršieho, ktorý sa súpera bojí viac než teba, keď sú tvoje reči pri ňom na červenej. Reči zaniknú, strach a priazeň ostanú; jeho karta ide tebe do ruky a natrvalo patrí do tvojho balíčka. Kto prvý presvedčí, toho je; zajať ho smú obaja. Vo finále nie." },
  { id: "vazen", pojem: "Väzeň", popis: "Zajatý starší medzi tvojimi priznanými kartami („v pivnici“): nedáva priazeň, ráta sa ako tvoj červený strach, máš jeho schopnosť (raz za hru). Pri zajatí ti súper odovzdá špaky za vrch svojho teplomera; väzni na výhru podľa ligy (2 / 3 / 4)." },
  { id: "schopnost-vazna", pojem: "Schopnosť väzňa", popis: "Každý zajatý starší má schopnosť (napr. Poštárka: dostaneš 4 cigarety). Jeho držiteľ ju použije raz za hru, kedy chce — vo svojom ťahu pri braní zo šenku, v Zhromaždení alebo v Pitke. Potom je minutá, väzeň ostáva v pivnici." },
  { id: "pecen", pojem: "Pečeň", popis: "Počítadlo v Pitke z akcií Poškodenie pečene, Poldeci a z NA EX; za každý celý prah Cirhóza." },
  { id: "pitka", pojem: "Pitka", popis: "Vyhodnotenie po Zhromaždení: NA EX, Dlhy, pečeň, cigarety; v jednom kole je 1 až 4 Pitiek (vo finále na pinnacle 1 až 5)." },
  { id: "podstrcenie", pojem: "Podstrčenie", popis: "Karta vyložená na súperovu stranu; ostáva tvoja a jej akcie sa rátajú tebe (okrem Kočovníka)." },
  { id: "pohorsenie", pojem: "Pohoršenie", popis: "Akcia: 2 mäkké poškodenie do hádky (v10); súperova Viera ho nezruší." },
  { id: "poldeci", pojem: "Poldeci", popis: "Pohárik pálenky; plný zvyšuje limit o 1 a platí ním NA EX aj ďalšiu kartu v ťahu. Plný na konci hry je 1 špak." },
  { id: "povera", pojem: "Povera", popis: "Akcia: 1 mäkké poškodenie do hádky (v10; s Horoskopom 2); súperova Viera ju zruší 1 : 1." },
  { id: "boss", pojem: "Boss", popis: "Karta staršieho: 6 akcií a jedna neresť; v línii má len akcie; jeho schopnosť má len ten, kto ho drží ako väzňa." },
  { id: "prebytok", pojem: "Nakladačka", popis: "O koľko vyhrávaš v tuhom poškodení (drží ju víťaz); po bodovaní ju rozdelíš na svoj strach pri starších — stupeň stojí 1 / 2 / 3, zvyšok prepadne. Vo finále ide na špaky." },
  { id: "prevaha", pojem: "Prevaha", popis: "V kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov; dostane akcie hrany lokality." },
  { id: "priazen", pojem: "Priazeň", popis: "Výhoda od staršieho, ktorý sa súpera bojí viac než teba: sila = strach súpera − tvoj strach (1, 2 alebo 3). Reči sa nerátajú; pri rovnakom strachu ju nemá nikto." },
  { id: "priznanie", pojem: "Priznanie", popis: "Kliatbu vyložíš mimo línie do svojej hracej oblasti — natrvalo z balíčka." },
  { id: "sekera", pojem: "Na sekeru", popis: "Bitka bez víťaza (remíza v tuhom, Absťákoch aj Dlhoch): jej špaky vezme víťaz najbližšej bitky, vo finále prepadnú." },
  { id: "senok", pojem: "Šenok", popis: "Ponuka kariet lícom nahor; beriete z nej 1 kartu za 1 cigaretu alebo 2 za 3." },
  { id: "spalenie", pojem: "Spáliť", popis: "Karta ide navždy z hry — nevracia sa do žiadneho balíčka (napr. Vízia). Spálený Dlh zmizne z počítadla." },
  { id: "spoj", pojem: "Spoj", popis: "Miesto, kde sa dotknú hrany dvoch kariet alebo karty a lokality." },
  { id: "starsi", pojem: "Starší", popis: "Vážená osoba dediny; každý hráč má pri ňom svoj teplomer 0–3 — strach a nad ním reči. Po bitke dáva špaky a priazeň tomu, koho sa bojí menej." },
  { id: "stupen", pojem: "Stupeň", popis: "Poloha na stupnici staršieho: 0 pokojný, 1 znepokojený, 2 vystrašený, 3 vydesený. Strach aj reči plnia tú istú stupnicu (reči nad strachom); stupeň staršieho pre hráča je jej vrchol — strach + reči. Vstup stojí 1 / 2 / 3, po bitke dá 1 / 3 / 5 špakov." },
  { id: "strach", pojem: "Strach", popis: "Marker hráča pri staršom 0–3 (plná časť teplomera) — ako veľmi sa ťa bojí; dvíha ho Nakladačka a neklesá. Len strach sa ráta do priazne, výhry strachom a zajatia." },
  { id: "spak", pojem: "Špak", popis: "Víťazný bod: za vyhratú bitku (1 za každú kartu v línii), od starších po každej bitke (víťaz za vrch teplomera, porazený len za reči); na konci aj za zvyšné plné poldeci a cigarety (výkupné); po finále vyhrá, kto má viac." },
  { id: "strana", pojem: "Strana", popis: "Polovica línie od lokality — tvoja a súperova; kartu kladieš na koniec ktorejkoľvek." },
  { id: "tag", pojem: "Tag", popis: "Druh karty (Občan, Zviera, Starešina, Nástroj…); odkazujú na neho efekty." },
  { id: "tuhe", pojem: "Tuhé poškodenie", popis: "Poškodenie z Rany (1), Pecky (2) a Petelice (3); kto má viac, vyhrá bitku." },
  { id: "utocnik", pojem: "Útočník a obranca", popis: "Útočník prehral poslednú bitku: vykladá prvý a na NA EX odpovedá prvý; obranca vyberá cieľ a berie zo šenku prvý (na prvom ťahu 1 kartu); Pitku hrajú obaja naraz; vo finále útočí, kto má menej špakov, a pinnacle vyberá vedúci." },
  { id: "viera", pojem: "Viera", popis: "Akcia, ktorá ruší súperove Povery 1 : 1 (aj vylepšené Horoskopom) a zvyšná znižuje jeho tuhé poškodenie; proti Pohoršeniu nepomáha." },
  { id: "vizia", pojem: "Vízia", popis: "Na konci Pitky pozrieš vrchnú kartu balíčka a vezmeš si ju alebo ju navždy spáliš." },
  { id: "vydesenie", pojem: "Vydesený", popis: "Stupeň 3 staršieho pre hráča (vrch teplomera, strach + reči). Len vydesený strach ťa pustí k zajatiu a ráta sa do výhry strachom." },
  { id: "vytrznik", pojem: "Výtržník", popis: "Karta, na ktorú ste obaja dali NA EX v tej istej Pitke: všetky jej akcie sú Rany pre majiteľa, do konca bitky." },
  { id: "vypit", pojem: "Vypiť", popis: "Otočíš plný poldeci na vypitý, aby si v tom istom ťahu vyložil ďalšiu kartu: limit −1, pečeň +1." },
  { id: "vykupne", pojem: "Výkupné", popis: "Po finále dostaneš 1 špak za každý plný poldeci a 1 špak za každých celých 5 cigariet, ktoré ti ostali." },
  { id: "vzbura", pojem: "Vzbura", popis: "Odpor proti Odporu: obe karty sa obrátia — nespojené akcie sú aktívne, spojené neaktívne. Odpor proti Posilneniu: len karta s Odporom, navyše posilnená. NA EX na ňu nejde; Nástroj ju nedostane." },
  { id: "zaverecna", pojem: "Záverečná", popis: "Karta lícom dole za 1 cigaretu; otočí sa na konci Pitky a potom už v Zhromaždení nevykladáš." },
  { id: "zhromazdenie", pojem: "Zhromaždenie", popis: "Fáza, v ktorej hráči striedavo vykladajú karty do línie; začína útočník." },
];

const PODLA_ID: ReadonlyMap<string, PojemSlovnika> = new Map(SLOVNIK.map((p) => [p.id, p]));

export function pojemSlovnika(id: string): PojemSlovnika | null {
  return PODLA_ID.get(id) ?? null;
}
