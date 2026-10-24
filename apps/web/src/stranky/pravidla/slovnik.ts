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
  { id: "abstak", pojem: "Absťák", popis: "Kliatba za menej nerestí než v minulom kole; príde rovno priznaná a v bitke ti uberie 1 tuhé." },
  { id: "akcia", pojem: "Akcia", popis: "Symbol na hrane karty; platí, len keď sa na spoji stretne s akciou suseda v rovnakej výške." },
  { id: "barter", pojem: "Stokársky barter", popis: "Počas Pitky za 5 cigariet nový plný poldeci (s priazňou Lakomca menej)." },
  { id: "bitka", pojem: "Bitka", popis: "Koniec kola: viac tuhého poškodenia berie lokalitu, prebytok posúva markery starších." },
  { id: "cigareta", pojem: "Cigareta", popis: "Mena hry: platí šenok, Dedičstvo, doliatie a barter; vyfajčená je hneď karta navyše." },
  { id: "cirhoza", pojem: "Cirhóza", popis: "Kliatba z pečene; ide navrch tvojho balíčka, priznaná dá súperovi v bitke +1 tuhé, nepriznaná na konci uberá body." },
  { id: "dedicstvo", pojem: "Dedičstvo", popis: "Nástroj vyložený mimo línie; platí jeho efekt a cena rastie pre oboch: 1., 2., 3. Nástroj stojí 1, 2, 3 cigarety." },
  { id: "dlh", pojem: "Dlh", popis: "Kliatba zo zadĺženia; prizná sa sama, ráta sa k prahu Exekútora a na konci uberá body aj priznaný." },
  { id: "dlzka-hry", pojem: "Dĺžka hry", popis: "Počet lokalít, o ktoré sa hrá: krátka 5, stredná 7, dlhá 11." },
  { id: "doliatie", pojem: "Doliatie", popis: "Počas Pitky za 2 cigarety otočíš vypitý poldeci späť na plný." },
  { id: "efekt", pojem: "Efekt", popis: "Text karty: čo karta robí a kedy; kedy hovorí tučné slovo na jeho začiatku." },
  { id: "exekutor", pojem: "Exekútor", popis: "Keď priznané Dlhy dosiahnu prah (základ 10), odovzdáš Nástroj, inak hneď prehrávaš." },
  { id: "fajcenie", pojem: "Fajčenie", popis: "Vyfajčená cigareta = karta z balíčka hneď; smieš na svojom ťahu v Zhromaždení aj v Pitke." },
  { id: "kliatba", pojem: "Kliatba", popis: "Karta, ktorá škodí majiteľovi: Dlh, Cirhóza, Absťák a Milujúca manželka." },
  { id: "kolo", pojem: "Kolo", popis: "Cieľ, šenok, potom Zhromaždenie s Pitkou 1- až 4-krát a nakoniec bitka o lokalitu." },
  { id: "kraj", pojem: "Kraj", popis: "Polovica línie podľa hrany lokality; každá lokalita má vlastné mená krajov (Krčma: pri výčape a pri dverách)." },
  { id: "limit", pojem: "Limit vykladania", popis: "Koľko kariet vyložíš v jednom Zhromaždení: plné poldeci + 1." },
  { id: "linia", pojem: "Línia", popis: "Celý rad kariet v kole; lokalita v strede ho delí na dve strany." },
  { id: "lokalita", pojem: "Lokalita", popis: "Karta v strede línie, o ktorú sa v kole bije; jej efekt platí v tom kole." },
  { id: "makke", pojem: "Mäkké poškodenie", popis: "Poškodenie z Povier; udelí sa najviac do výšky súperových priznaných Dlhov." },
  { id: "naex", pojem: "NA EX!", popis: "Plný poldeci na kartu v línii: zruší jej aktívne akcie a zdvojí neaktívne." },
  { id: "nastroj", pojem: "Nástroj", popis: "Karta s tagom Nástroj; v línii funguje len pri Občanovi či Starešinovi, inak ide do Dedičstva." },
  { id: "natocenie", pojem: "Natočenie", popis: "Ako obranca otočí lokalitu — určuje, ktorá jej hrana patrí ktorému kraju." },
  { id: "nerest", pojem: "Nerest", popis: "Vypitie, NA EX, vyfajčená cigareta, doliatie a barter; počet sa porovnáva kolo s kolom." },
  { id: "odpoved", pojem: "Odpoveď na NA EX", popis: "Jedna karta, ktorú smieš hneď vyložiť po súperovom NA EX, mimo limitu." },
  { id: "partia", pojem: "Partia", popis: "Všetky tvoje karty v línii, nech ležia na ktorejkoľvek strane; ich akcie sa rátajú tebe." },
  { id: "pas", pojem: "Pas", popis: "Skončíš vykladanie v Zhromaždení a za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu." },
  { id: "patronat", pojem: "Patronát", popis: "Po šenku si vezmeš do ruky staršieho, ktorý ti prejavuje priazeň; vyhráš bitku a je tvoj." },
  { id: "pecen", pojem: "Pečeň", popis: "Počítadlo v Pitke z akcií Poškodenie pečene, Poldeci a z NA EX; za každý celý prah Cirhóza." },
  { id: "pitka", pojem: "Pitka", popis: "Vyhodnotenie po Zhromaždení: NA EX, Dlhy, pečeň, cigarety; v jednej bitke je 1 až 4 Pitiek." },
  { id: "podmienka", pojem: "Podmienka", popis: "Políčko na scorecarde staršieho; aktívna podmienka na konci boduje obom hráčom." },
  { id: "podstrcenie", pojem: "Podstrčenie", popis: "Karta vyložená na súperovu stranu; ostáva tvoja a jej akcie sa rátajú tebe." },
  { id: "pohorsenie", pojem: "Pohoršenie", popis: "Akcia, ktorá v bitke posunie marker staršieho o 1 k súperovi." },
  { id: "pohreb", pojem: "Pohreb", popis: "Po bitke spáliš priznanú Cirhózu a jednu svoju kartu z línie." },
  { id: "poldeci", pojem: "Poldeci", popis: "Pohárik pálenky; plný zvyšuje limit o 1 a platí ním NA EX aj ďalšiu kartu v ťahu." },
  { id: "prebudenie", pojem: "Prebudenie", popis: "Marker na krajnej červenej pozícii: efekt staršieho začne pôsobiť pre teba." },
  { id: "prebytok", pojem: "Prebytok", popis: "O koľko vyhrávaš v celkovom poškodení; posúvaš ním markery starších." },
  { id: "prevaha", pojem: "Prevaha", popis: "V kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov; dostane akcie hrany lokality." },
  { id: "priazen", pojem: "Priazeň", popis: "Výhoda od staršieho, ku ktorému je posunutý marker: sila 1, 2 alebo 3 podľa zóny." },
  { id: "priznanie", pojem: "Priznanie", popis: "Kliatbu vyložíš mimo línie do svojej hracej oblasti — natrvalo z balíčka." },
  { id: "scorecard", pojem: "Scorecard", popis: "Podložka staršieho: jeho priazeň, stupnica strachu a 8 bodovacích podmienok." },
  { id: "sekera", pojem: "Na sekeru", popis: "Lokalita pri remíze v tuhom; vezme si ju víťaz najbližšej bitky." },
  { id: "senok", pojem: "Šenok", popis: "Ponuka kariet lícom nahor; beriete z nej 1 kartu za 1 cigaretu alebo 2 za 3." },
  { id: "smetisko", pojem: "Smetisko", popis: "Polovica kariet zo stavby šenku, ktorú dáš naspodok balíčka; súper ju nevidí." },
  { id: "spoj", pojem: "Spoj", popis: "Miesto, kde sa dotknú hrany dvoch kariet alebo karty a lokality." },
  { id: "starsi", pojem: "Starší", popis: "Vážená osoba dediny na scorecarde; desíš ho posúvaním markera k súperovi." },
  { id: "strach", pojem: "Strach", popis: "Úroveň 1 až 3, na ktorej sa ťa starší bojí; boduje cez podmienky Znepokojenie, Strach a Vydesenie." },
  { id: "strana", pojem: "Strana", popis: "Polovica línie od lokality — tvoja a súperova; kartu kladieš na koniec ktorejkoľvek." },
  { id: "tag", pojem: "Tag", popis: "Druh karty (Občan, Zviera, Starešina, Nástroj…); odkazujú na neho efekty." },
  { id: "tuhe", pojem: "Tuhé poškodenie", popis: "Poškodenie z Rany (1), Pecky (2) a Petelice (3); kto má viac, berie lokalitu." },
  { id: "utocnik", pojem: "Útočník a obranca", popis: "Útočník prehral poslednú bitku: berie zo šenku a vykladá prvý; obranca vyberá cieľ a začína Pitku." },
  { id: "viera", pojem: "Viera", popis: "Akcia, ktorá ruší súperove Povery a znižuje jeho tuhé poškodenie." },
  { id: "vizia", pojem: "Vízia", popis: "Na konci Pitky pozrieš vrchnú kartu balíčka a vezmeš si ju alebo ju navždy zahodíš." },
  { id: "vydesenie", pojem: "Vydesenie", popis: "Polovica starších v krajnej zóne strachu z teba; udrž ich do konca ďalšieho kola a vyhráš." },
  { id: "vypit", pojem: "Vypiť", popis: "Otočíš plný poldeci na vypitý, aby si v tom istom ťahu vyložil ďalšiu kartu: limit −1, pečeň +1." },
  { id: "vzbura", pojem: "Vzbura", popis: "Odpor proti Odporu: obe karty vyhodnotia svoje inak neaktívne akcie ako aktívne." },
  { id: "zaverecna", pojem: "Záverečná", popis: "Karta lícom dole za 1 cigaretu; otočí sa na konci Pitky a potom už v Zhromaždení nevykladáš." },
  { id: "zhromazdenie", pojem: "Zhromaždenie", popis: "Fáza, v ktorej hráči striedavo vykladajú karty do línie; začína útočník." },
];

const PODLA_ID: ReadonlyMap<string, PojemSlovnika> = new Map(SLOVNIK.map((p) => [p.id, p]));

export function pojemSlovnika(id: string): PojemSlovnika | null {
  return PODLA_ID.get(id) ?? null;
}
