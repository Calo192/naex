// Sada v7 (revízia sady, Michal 2026-10-27) → packages/core/data/cards.json.
//
// Prečo skript a nie ruka: sloty hráčskych kariet sú strojovo overené
// (docs/napady/revizia-sady/sloty.json, 0 nezrovnalostí cez sideLayouts jadra)
// a ručný prepis by ich rozbil. Skript je idempotentný: karty zo sloty.json
// a lokality z tabuľky nižšie prepíše celé, ostatné (starší, kliatby) nechá.
//
// Výnimka z CLAUDE.md bod 5 (cards.json = kópia živej sady): v7 je zatiaľ len
// na vetve v7/revizia-sady na playtest. Do tvorcu na živom webe ju prenesie
// naex-admin až po súhlase Michala.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/sada-v7/generuj.ts

import { readFileSync, writeFileSync } from "node:fs";
import { cardVariants } from "../../packages/core/src/variants.ts";
import type { Action, CardDef, SideDef, SlotIndex } from "../../packages/core/src/types.ts";
import { ALL_TRIGGERS } from "../../packages/core/src/types.ts";

const CARDS = "packages/core/data/cards.json";
const SLOTY = "docs/napady/revizia-sady/sloty.json";

interface StranaJson {
  blocked: number[];
  actions: Record<string, number>;
  allowed?: Record<string, string[]>;
  name?: string;
}
interface KartaJson {
  id: string;
  index: number;
  name: string;
  tags: string[];
  effect_text: string;
  triggers: string[];
  left: StranaJson;
  right: StranaJson;
  permutations: { total: number; left: number; right: number };
  [k: string]: unknown;
}
interface SlotyStrana {
  akcie: Record<string, number>;
  blocked: number[];
  allowed?: Record<string, string[]>;
}
interface SlotyKarta {
  id: string;
  nazov: string;
  druh: string;
  lava: SlotyStrana;
  prava: SlotyStrana;
}

/** Texty a tagy kariet, ktoré revízia mení alebo pridáva (plan.md časť 3, 4, 10.1, 11, 12). */
interface Text {
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly effect_text: string;
  readonly triggers: readonly string[];
}

const TEXTY: Readonly<Record<string, Text>> = {
  // Prerobené (10.1, dávka 3)
  puska: { effect_text: "Dedičstvo: Prebytočné poškodenie, ktoré proti tebe rozdeľuje súper, je o 2 menšie.", triggers: ["Dedičstvo"] },
  vyherny_automat: { effect_text: "Dedičstvo: Výhra: Dostaneš 3 cigarety. Prehra: Získaš 2 Dlhy.", triggers: ["Dedičstvo", "Prehra"] },
  financna_poradkyna: { effect_text: "Pitka: Dlh z jej akcií dostáva súper, nie ty.", triggers: ["Pitka"] },
  vestica: { effect_text: "Prehra: Preskúmaj súperov a svoj doberací balík. Vymeň jednu jeho kartu za tvoju a karty vráť.", triggers: ["Prehra"] },
  praudovravec: { effect_text: "Furt: Odpor na jeho spojoch neruší, ale posilní — ráta sa ako Posilnenie.", triggers: ["Furt"] },
  niekoho_stryna: { effect_text: "Nástup: Zahoď 1 Cirhózu alebo 1 Dlh z ruky či z odhadzovacieho balíčka, Dlh aj spomedzi priznaných.", triggers: ["Nástup"] },
  veteran: { effect_text: "Furt: NA EX na neho jeho aktívne akcie nezruší, ale zdvojí. Neaktívne nezdvojí.", triggers: ["Furt"] },
  recidivista: { effect_text: "Bitka: Za každého zahraničného občana v súperovej partii udelí dodatočnú ranu.", triggers: ["Bitka"] },
  liberal: { effect_text: "Furt: Ak je v tvojej partii rovnako žien a chlapov, jeho akcie sa rátajú dvakrát.", triggers: ["Furt"] },
  zivnostnik: { effect_text: "Výhra: Zahoď jedno súperovo dedičstvo.", triggers: ["Výhra"] },
  kocovnik: { effect_text: "Furt: Jeho akcie sa počítajú hráčovi, ktorý má v jeho kraji prevahu.", triggers: ["Furt"] },
  sarlatan: { effect_text: "Furt: Každá aktívna akcia Poškodenie pečene na ňom a na kartách v jeho okolí sa ráta aj ako Viera.", triggers: ["Furt"] },
  podvodnik: { effect_text: "Prehra: Jeden tvoj priznaný Dlh sa presunie medzi súperove priznané.", triggers: ["Prehra"] },
  zahradkar: { effect_text: "Bitka: Tvoj prah Exekútora je o 2 vyšší.", triggers: ["Bitka"] },
  dvojcata: { effect_text: "Furt: Do prevahy sa rátajú za dvoch.", triggers: ["Furt"] },
  sofer: { effect_text: "Bitka: Ak si v tomto kole nedal NA EX, udelíš súperovi 1 Pecku navyše.", triggers: ["Bitka"] },
  milujuca_manzelka: {
    tags: ["Občan", "Pamätník", "Žena"],
    effect_text: "Pitka: Tvoje poškodenie pečene v tejto Pitke je o 1 menšie.",
    triggers: ["Pitka"],
  },
  dievcina_na_vydaj: {
    effect_text: "Bitka: Ak máš aspoň 4 priznané Dlhy, zahoď túto kartu a spáľ toľko svojich priznaných Dlhov, koľko mala aktívnych akcií.",
    triggers: ["Bitka"],
  },
  // Schválené novinky (karty-obcania, karty-kolo2, karty-naradie-zvierata; Kapybara a Smetiarka podľa plan.md 10.1 a analýzy)
  vidly: { name: "Vidly", tags: ["Nástroj"], effect_text: "Dedičstvo: Kým máš menej špakov ako súper, máš v bitke 1 tuhé poškodenie navyše.", triggers: ["Dedičstvo"] },
  lievik: { name: "Lievik", tags: ["Nástroj"], effect_text: "Dedičstvo: NA EX smieš dať aj na Zviera.", triggers: ["Dedičstvo"] },
  krokodil: {
    name: "Krokodíl",
    tags: ["Zviera"],
    effect_text: "Furt: Občana alebo Zviera, ktorého súper vyloží vedľa Krokodíla, Krokodíl po bitke zožerie — karta sa zahodí (z hry).",
    triggers: ["Furt"],
  },
  kapybara: { name: "Kapybara", tags: ["Zviera"], effect_text: "Kšeft: Za 2 cigarety zožerie súperovi 1 špak.", triggers: ["Kšeft"] },
  kon: { name: "Kôň", tags: ["Zviera"], effect_text: "Furt: Nástroj vedľa Koňa s ním tvorí spoj.", triggers: ["Furt"] },
  kohut: { name: "Kohút", tags: ["Zviera"], effect_text: "Furt: Kým leží Kohút v línii, kolo má aspoň 2 Pitky.", triggers: ["Furt"] },
  degustatorka: {
    name: "Degustátorka",
    tags: ["Občan", "Závislý", "Kriminál", "Žena"],
    effect_text: "Nástup: Ak má súper viac plných poldeci ako ty, jeden mu ochutná — otoč ho na vypitý.",
    triggers: ["Nástup"],
  },
  klebetnica: {
    name: "Klebetnica",
    tags: ["Občan", "Influencer", "Žena"],
    effect_text: "Nástup: Pozri si súperovu ruku a jednu jeho kartu daj naspodok jeho doberacieho balíčka.",
    triggers: ["Nástup"],
  },
  dohadzovacka: {
    name: "Dohadzovačka",
    tags: ["Občan", "Pamätník", "Žena"],
    effect_text: "Nástup: Vymeň dvom starším scorecardy (priazne). Markery ostanú, kde sú.",
    triggers: ["Nástup"],
  },
  vandal: { name: "Vandal", tags: ["Občan", "Kriminál", "Chlap"], effect_text: "Nástup: Otoč lokalitu o 180° — jej hrany si vymenia strany.", triggers: ["Nástup"] },
  stryko_z_ameriky: {
    name: "Strýko z Ameriky",
    tags: ["Občan", "Influencer", "Zahraničný", "Chlap"],
    effect_text: "Kšeft: Za 2 cigarety udelíš v tejto bitke súperovi 1 Ranu navyše.",
    triggers: ["Kšeft"],
  },
  opatrovatelka: {
    name: "Opatrovateľka",
    tags: ["Občan", "Zahraničný", "Pracujúci", "Žena"],
    effect_text: "Nástup: Počet tvojich nerestí z minulého kola klesne o 2.",
    triggers: ["Nástup"],
  },
  smetiarka: {
    name: "Smetiarka",
    tags: ["Občan", "Pracujúci", "Žena"],
    effect_text: "Kšeft: Za kartu z ruky (nie Kliatbu), ktorú odhodíš do odhadzovacieho balíčka, dostaneš 1 cigaretu.",
    triggers: ["Kšeft"],
  },
  // Nové karty revízie (časť 4, 10.1, dávka 3)
  brigadnik: { name: "Brigádnik", tags: ["Občan", "Pracujúci", "Chlap"], effect_text: "Furt: Do prevahy sa neráta.", triggers: ["Furt"] },
  masiar: { name: "Mäsiar", tags: ["Občan", "Pracujúci", "Chlap"], effect_text: "", triggers: [] },
  kulturista: { name: "Kulturista", tags: ["Občan", "Influencer", "Chlap"], effect_text: "", triggers: [] },
  traktoristka: {
    name: "Traktoristka",
    tags: ["Občan", "Pracujúci", "Žena"],
    effect_text: "Bitka: Ak máš v jej kraji prevahu, udelíš súperovi 1 Pecku navyše. Inak získaš 1 Dlh.",
    triggers: ["Bitka"],
  },
  oslavenec: {
    name: "Oslávenec",
    tags: ["Občan", "Závislý", "Chlap"],
    effect_text: "Kšeft: Za 1 plný poldeci naleješ súperovi — v tejto Pitke dostane 2 poškodenia pečene.",
    triggers: ["Kšeft"],
  },
  vymahac: {
    name: "Vymáhač",
    tags: ["Občan", "Kriminál", "Chlap"],
    effect_text: "Bitka: Za každé 2 tvoje priznané Dlhy udelíš súperovi 1 Ranu navyše.",
    triggers: ["Bitka"],
  },
};

/** Starší s Kšeftom (prepis Starostu a Poštárky v7, karty-kolo2 U3): správanie ostáva. */
const STARSI: Readonly<Record<string, Text>> = {
  starosta: { effect_text: "Kšeft: Za cigaretu vymeň kartu z ruky (nie Cirhózu) za kartu zo šenku.", triggers: ["Kšeft"] },
  postarka: { effect_text: "Kšeft: Za 1 Dlh si dober až 2 karty.", triggers: ["Kšeft"] },
};

/** Lokality podľa úrovní (plan.md 7.4): hrany po slotoch 0–3 zhora, null = blokovaný slot. */
interface Lokalita {
  readonly id: string;
  readonly name: string;
  readonly kraje: readonly [string, string];
  readonly lava: readonly (string | null)[];
  readonly prava: readonly (string | null)[];
  readonly effect_text: string;
  readonly triggers: readonly string[];
}

const C = "Cigareta", PEC = "Pecka", PET = "Petelica", RAN = "Rana", POV = "Povera", VIE = "Viera", VIZ = "Vízia";
const ROB = "Robota", DLH = "Dlh", OBM = "Obmedzenie", POH = "Pohoršenie", POL = "Poldeci", POS = "Posilnenie";
const PEN = "PoškodeniePečene", ODP = "Odpor";
const _ = null;

const LOKALITY: readonly Lokalita[] = [
  // Úroveň 1 — spodok
  { id: "zastavka", name: "Zastávka", kraje: ["pod strieškou", "pri ceste"], lava: [_, C, _, _], prava: [PEC, _, _, _], effect_text: "Zhromaždenie: Obaja hráči majú spoločný limit vykladania — súčet ich limitov.", triggers: ["Zhromaždenie"] },
  { id: "most", name: "Most", kraje: ["pri kaplnke", "pod mostom"], lava: [_, PEC, _, _], prava: [_, _, C, _], effect_text: "Zhromaždenie: Karty sa smú vykladať len na vlastnú stranu (aj odpoveď na NA EX).", triggers: ["Zhromaždenie"] },
  { id: "lesna_cesta", name: "Lesná cesta", kraje: ["v húštine", "pri kríži"], lava: [PEC, _, _, _], prava: [_, POV, _, _], effect_text: "Bitka: Za každé svoje Zviera v súperovom kraji máš 1 tuhé poškodenie navyše.", triggers: ["Bitka"] },
  { id: "cintorin", name: "Cintorín", kraje: ["pri hroboch", "pri márnici"], lava: [_, VIE, _, _], prava: [_, ROB, _, _], effect_text: "Prehra: Po Pohrebe smieš vyložiť jeden Nástroj z ruky do Dedičstva bez platenia.", triggers: ["Prehra"] },
  { id: "jednota", name: "Jednota", kraje: ["pri pulte", "pred obchodom"], lava: [_, C, _, _], prava: [_, POH, _, _], effect_text: "Kšeft: Za 1 Dlh dostaneš 2 cigarety.", triggers: ["Kšeft"] },
  // Úroveň 2 — dedina
  { id: "ihrisko", name: "Ihrisko", kraje: ["na trávniku", "na tribúne"], lava: [PEC, _, _, RAN], prava: [_, POL, C, _], effect_text: "Bitka: V každom kraji, kde máš viac svojich Občanov, Zvierat a Starešinov než súper, máš 2 tuhé poškodenia navyše.", triggers: ["Bitka"] },
  { id: "benzinka", name: "Benzínka", kraje: ["pri pokladni", "za budovou"], lava: [_, C, C, _], prava: [OBM, _, _, PEC], effect_text: "Pitka: Nikto nesmie fajčiť.", triggers: ["Pitka"] },
  { id: "kar", name: "Kar", kraje: ["pri vdove", "pri koláčoch"], lava: [_, VIE, POV, _], prava: [_, POL, RAN, _], effect_text: "Pitka: Doliatie nestojí cigarety, ale každé ti pridá 1 poškodenie pečene.", triggers: ["Pitka"] },
  { id: "zberny_dvor", name: "Zberný dvor", kraje: ["pri váhe", "za plotom"], lava: [_, ROB, _, PET], prava: [_, DLH, _, OBM], effect_text: "Kšeft: Za 1 cigaretu si vezmi do ruky ľubovoľnú kartu zo svojho odhadzovacieho balíčka.", triggers: ["Kšeft"] },
  { id: "krcma", name: "Krčma", kraje: ["pri výčape", "pri dverách"], lava: [PET, _, DLH, _], prava: [RAN, RAN, _, _], effect_text: "Pitka: Ak máš plný poldeci a máš ho kam dať, musíš dať NA EX. Prah Cirhózy je tu o 2 vyšší.", triggers: ["Pitka"] },
  // TODO(v7, 7.5 bod 7): sloty a kraje Skladu sú návrh Vymyselníka, Michal ich ešte nepotvrdil.
  { id: "sklad", name: "Sklad", kraje: ["pri vreciach", "pri strážnici"], lava: [ROB, _, PEC, _], prava: [C, _, DLH, _], effect_text: "Kšeft: Za 1 cigaretu si vezmi do ruky vrchnú kartu zo súperovho odhadzovacieho balíčka.", triggers: ["Kšeft"] },
  // Úroveň 3 — sídla dedinskej šľachty
  { id: "obecny_urad", name: "Obecný úrad", kraje: ["v kancelárii", "na chodbe"], lava: [_, ROB, VIE, OBM], prava: [PEC, DLH, POV, _], effect_text: "Bitka: Každá aktívna Robota spáli 2 priznané Dlhy.", triggers: ["Bitka"] },
  { id: "kulturny_dom", name: "Kultúrny dom", kraje: ["na parkete", "pred vchodom"], lava: [POH, _, POH, PEN], prava: [PEC, C, VIE, _], effect_text: "Bitka: Prebytok sa nerozdeľuje medzi starších. Kto ho drží, dostane toľko špakov, aký je prebytok.", triggers: ["Bitka"] },
  { id: "vinna_pivnica", name: "Vínna pivnica", kraje: ["pri sudoch", "na schodoch"], lava: [PEN, POL, POS, _], prava: [RAN, PEC, C, _], effect_text: "Pitka: Každý hráč smie dať NA EX až dvakrát.", triggers: ["Pitka"] },
  { id: "druzstvo", name: "Družstvo", kraje: ["na poli", "na schôdzi"], lava: [ROB, POL, _, RAN], prava: [OBM, POH, ODP, _], effect_text: "Zhromaždenie: Karty s tagom Pracujúci nemíňajú limit vykladania.", triggers: ["Zhromaždenie"] },
  { id: "kostol", name: "Kostol", kraje: ["pri oltári", "pri vchode"], lava: [ROB, VIE, VIZ, _], prava: [_, POH, POV, VIE], effect_text: "Zhromaždenie: Nikto nesmie vypiť. Pitka: Nikto nesmie dať NA EX.", triggers: ["Zhromaždenie", "Pitka"] },
  // Pinnacle — korupcia na očiach (len vo finále)
  { id: "polovnicka_chata", name: "Poľovnícka chata", kraje: ["pri trofejach", "na posede"], lava: [POS, PET, DLH, PEC], prava: [RAN, PET, PEN, POH], effect_text: "Furt: Aktívne Rany, Pecky a Petelice z hrán lokality sa rátajú dvakrát.", triggers: ["Furt"] },
  {
    id: "predsedova_vila",
    name: "Predsedova vila",
    kraje: ["pri bazéne", "v pracovni"],
    lava: [C, PEC, PEC, DLH],
    prava: [POS, PET, DLH, VIE],
    effect_text: "Kšeft: Za 2 cigarety posuň marker ľubovoľného staršieho o 1 pole k súperovi alebo k sebe. Marker staršieho, ktorého si súper v tomto kole vzal do patronátu, takto posunúť nesmieš.",
    triggers: ["Kšeft"],
  },
  // TODO(v7, 7.5 bod 6): kraje Herne sú návrh Vymyselníka, na potvrdenie.
  { id: "herna", name: "Herňa", kraje: ["pri automatoch", "v zadnej miestnosti"], lava: [PEC, PET, PEN, DLH], prava: [RAN, PEC, ROB, DLH], effect_text: "Bitka: Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov.", triggers: ["Bitka"] },
];

/**
 * Rozhodnuté znenia efektov (plan.md 14.0, Michal 2026-10-27) — doslova, „len
 * spúšťač a efekt“. Prepíšu text kariet z TEXTY, STARSI aj LOKALITY; spúšťače
 * sa čítajú z textu ako v tvorcovi. Svokra a Hasič nesú znenie efektu, ktorý
 * hra hrá (§16; v sade ostal starší text — playtest v7 131033).
 */
const EFEKTY: Readonly<Record<string, string>> = {
  financna_poradkyna: "Pitka: Dlhy, ktoré vygeneruje táto karta, dostáva súper.",
  velmi_smutiaca_vdova: "Konflikt: Ak je priložená karta Chlap, po bitke ide z hry.",
  policajtka: "Konflikt: Súper získa 1 Dlh. Ak je priložená karta Kriminál, namiesto toho ti dá 2 cigarety.",
  niekoho_stryna: "Pitka: Každý hráč, ktorý v tejto Pitke nedal NA EX, dostane 1 poškodenie pečene.",
  recidivista: "Prehra: Po bitke sa vráti do tvojej ruky.",
  liberal: "Pitka: Ak súperova partia nemá rovnako žien a chlapov, súper získa 1 zadĺženie.",
  zivnostnik: "Nástup: V tom istom ťahu smieš za neho priložiť 1 Nástroj z ruky.",
  sarlatan: "Konflikt: Do konca kola sa jeho Dlhy rátajú ako Viera a Povery ako Rana.",
  noviny: "Dedičstvo: Prehra: Ak má víťaz viac priznaných Dlhov ako ty, špaky za túto bitku dostaneš ty.",
  cigorky: "Dedičstvo: Pitka: Za každé 2 cigarety, ktoré súper vyfajčí, si dober 1 kartu. Nie je to nerest.",
  pasca: "Dedičstvo: Bitka: Ak súper v tomto kole priložil kartu k tvojej, udelíš mu 1 Pecku navyše.",
  puska: "Dedičstvo: Tvoje Petelice udeľujú o 1 poškodenie viac.",
  vidly: "Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac.",
  // Michal 2026-10-27 (brainstorming 164059c): nahrádza výklad „Výhra 1 špak“.
  vyherny_automat: "Dedičstvo: Tvoj prah Dlhu je o 1 vyšší. V poslednej Pitke kola získaš 1 Dlh.",
  kohut: "Pitka: Posledné slovo máš ty, aj keď si obranca.",
  kapybara: "Nástup: Posuň marker jedného staršieho o 1 pole k stredu.",
  pes: "Furt: Jeho aktívne akcie na spoji so súperovou kartou sa rátajú dvakrát.",
  krokodil: "Bitka: Na konci bitky idú z hry všetci Občania a Zvieratá v jeho okolí.",
  pijan: "Bitka: Za každé NA EX, ktoré si v tomto kole dal, udelíš súperovi 1 Ranu navyše.",
  milujuca_manzelka: "Pitka: Tvoje poškodenie pečene v tejto Pitke je o 1 menšie.",
  ministrant: "Nástup: Ak vyvoláš Konflikt, do konca kola sa jeho Viera ráta ako Pecka.",
  dievcina_na_vydaj: "Prehra: Zahoď túto kartu. Súper získa toľko Dlhov, koľko mala aktívnych akcií.",
  snubenica: "Konflikt: Ak je priložená karta Chlap, po bitke ide do tvojho odhadzovacieho balíčka a je tvoja.",
  klebetnica: "Pitka: Ak vyberáš NA EX po súperovi, vidíš jeho voľbu.",
  zahradkar: "Exekúcia: Smieš ju zahodiť namiesto špakov a spáliť toľko priznaných Dlhov, koľko mala aktívnych akcií.",
  anonymny_alkoholik: "Nástup: Priznaj všetky nepriznané Cirhózy zo svojho odhadzovacieho balíčka.",
  dohadzovacka: "Bitka: Za každý spoj tvojej Ženy so súperovým Chlapom alebo tvojho Chlapa so súperovou Ženou si vezmi 1 kartu zo šenku.",
  masiar: "Furt: Akcie Zvierat v jeho okolí neplatia.",
  kulturista: "Úplatok: Súper smie v každej Pitke dať na túto kartu 1 cigaretu. Každá zníži do konca kola jej útoky o stupeň (Petelica → Pecka → Rana → nič). Cigarety prepadnú.",
  vymahac: "Bitka: Za každé 2 tvoje priznané Dlhy udelíš súperovi 1 Ranu navyše.",
  svokra: "Bitka: Za každú tvoju kartu so súperovým NA EX udelíš súperovi Ranu.",
  hasic: "Nástup: Vytiahni náhodnú kartu zo svojho odhadzovacieho balíčka (aj kliatbu) a rozhodni sa, či si ju necháš, alebo ju odhodíš.",
  // Starší
  veterinar: "Pitka: Karty v jeho okolí nepridávajú poškodenie pečene.",
  autobusar: "Zhromaždenie: Ak súper pasuje po tebe, nedostane cigarety za pas.",
  starosta: "Nástup: Vezmi si 1 kartu zo šenku.",
  farar: "Prehra: Víťaz získa 1 zadĺženie za každú svoju aktívnu Poveru.",
  postarka: "Kšeft: Za 1 Dlh si dober 1 kartu.",
  hrobar: "Konflikt: Priložená karta je posledná na svojej strane. Po bitke ide z hry.",
  vychovavatelka: "Kšeft: Za 2 cigarety máš v bitke 1 Poveru navyše.",
  krcmarka: "Pitka: Na tvoje NA EX súper nesmie odpovedať kartou.",
  // Lokality
  cintorin: "Pitka: Nová Cirhóza je hneď priznaná.",
  jednota: "Pitka: Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani dolievať.",
  // TODO(v7, plan.md 14.7): pri rovnakej vzdialenosti nefajčí nikto — návrh, Michal nepotvrdil.
  benzinka: "Pitka: Fajčiť smie len hráč, ktorého Občan alebo Starešina leží najďalej od lokality.",
  kar: "Pitka: Poškodenie pečene za NA EX dostane súper hráča, ktorý ho dal.",
  obecny_urad: "Kšeft: Za 3 cigarety presuň 1 svoj priznaný Dlh medzi súperove priznané.",
  kostol: "Zhromaždenie: Nikto nesmie vypiť. Pitka: NA EX sa smie dať len na kartu v kraji pri oltári.",
  sklad: "Kšeft: Za 1 cigaretu si vezmi do ruky vrchnú kartu zo súperovho odhadzovacieho balíčka.",
};

/** Premenovania (plan.md 14.0); kľúče v dátach ostávajú. */
const MENA: Readonly<Record<string, string>> = { niekoho_stryna: "Stryná", klebetnica: "Bzdocha" };

/** Karty, ktoré zo sady vypadli alebo sú len návrhom (plan.md 14.5). */
const MIMO_SADY: readonly string[] = ["presbiter", "opatrovatelka", "smetiarka", "brigadnik", "oslavenec"];

/** Spúšťače z textu efektu v poradí, ako v ňom stoja (ako tvorca, tvorba/text.ts). */
function spustace(text: string): string[] {
  const out = ALL_TRIGGERS.filter((t) => new RegExp(`(^|[\\s.!?])${t}:`, "u").test(text));
  return out.sort((a, b) => text.indexOf(`${a}:`) - text.indexOf(`${b}:`));
}

function stranaZoSlotov(sloty: readonly (string | null)[], kraj: string): StranaJson {
  const blocked: number[] = [];
  const actions: Record<string, number> = {};
  const allowed: Record<string, string[]> = {};
  sloty.forEach((a, i) => {
    if (a === null) {
      blocked.push(i);
      return;
    }
    actions[a] = (actions[a] ?? 0) + 1;
    allowed[String(i)] = [a];
  });
  return { blocked, actions, allowed, name: kraj };
}

function stranaZoSloty(s: SlotyStrana): StranaJson {
  return { blocked: [...s.blocked], actions: { ...s.akcie }, ...(s.allowed !== undefined && Object.keys(s.allowed).length > 0 ? { allowed: s.allowed } : {}) };
}

function permutacie(k: KartaJson): KartaJson["permutations"] {
  const strana = (s: StranaJson): SideDef => ({
    blocked: s.blocked as SlotIndex[],
    actions: s.actions as Partial<Record<Action, number>>,
    ...(s.allowed !== undefined
      ? { allowed: Object.fromEntries(Object.entries(s.allowed).map(([i, a]) => [Number(i), a as Action[]])) as Partial<Record<SlotIndex, readonly Action[]>> }
      : {}),
  });
  const def = { left: strana(k.left), right: strana(k.right) } as CardDef;
  const v = cardVariants(def);
  return { total: v.total, left: v.left.length, right: v.right.length };
}

const cards = JSON.parse(readFileSync(CARDS, "utf8")) as { source: string; actions: string[]; tags: string[]; cards: KartaJson[] };
const sloty = JSON.parse(readFileSync(SLOTY, "utf8")) as { karty: SlotyKarta[] };

let dalsiIndex = Math.max(...cards.cards.map((c) => c.index)) + 1;
const podlaId = new Map(cards.cards.map((c) => [c.id, c]));
const uloz = (k: KartaJson): void => {
  const stara = podlaId.get(k.id);
  if (stara === undefined) {
    cards.cards.push(k);
    podlaId.set(k.id, k);
  } else Object.assign(stara, k);
};

for (const s of sloty.karty) {
  const stara = podlaId.get(s.id);
  const text = TEXTY[s.id];
  if (stara === undefined && text === undefined) throw new Error(`Nová karta ${s.id} nemá text v TEXTY.`);
  const k: KartaJson = {
    ...(stara ?? {}),
    id: s.id,
    index: stara?.index ?? dalsiIndex++,
    name: text?.name ?? stara?.name ?? s.nazov,
    tags: [...(text?.tags ?? stara?.tags ?? [])],
    effect_text: text?.effect_text ?? stara?.effect_text ?? "",
    triggers: [...(text?.triggers ?? stara?.triggers ?? [])],
    left: stranaZoSloty(s.lava),
    right: stranaZoSloty(s.prava),
    permutations: { total: 0, left: 0, right: 0 },
  };
  k.permutations = permutacie(k);
  uloz(k);
}

for (const [id, text] of Object.entries(STARSI)) {
  const k = podlaId.get(id);
  if (k === undefined) throw new Error(`Starší ${id} nie je v sade.`);
  k.effect_text = text.effect_text;
  k.triggers = [...text.triggers];
}

for (const l of LOKALITY) {
  const stara = podlaId.get(l.id);
  if (l.lava.filter((x) => x !== null).length !== l.prava.filter((x) => x !== null).length) throw new Error(`${l.id}: hrany majú rôzny počet akcií (úroveň).`);
  const k: KartaJson = {
    ...(stara ?? {}),
    id: l.id,
    index: stara?.index ?? dalsiIndex++,
    name: l.name,
    tags: ["Lokalita"],
    effect_text: l.effect_text,
    triggers: [...l.triggers],
    left: stranaZoSlotov(l.lava, l.kraje[0]),
    right: stranaZoSlotov(l.prava, l.kraje[1]),
    permutations: { total: 0, left: 0, right: 0 },
  };
  k.permutations = permutacie(k);
  if (k.permutations.total !== 1) throw new Error(`${l.id}: lokalita má mať 1 variant, má ${k.permutations.total}.`);
  uloz(k);
}

const zrusene = cards.cards.filter((c) => c.tags.includes("Lokalita") && !LOKALITY.some((l) => l.id === c.id));
if (zrusene.length > 0) throw new Error(`Lokality mimo plánu: ${zrusene.map((c) => c.id).join(", ")}`);

for (const id of MIMO_SADY) {
  const i = cards.cards.findIndex((c) => c.id === id);
  if (i !== -1) cards.cards.splice(i, 1);
}
for (const [id, text] of Object.entries(EFEKTY)) {
  const k = podlaId.get(id);
  if (k === undefined) throw new Error(`Efekt pre ${id}: karta nie je v sade.`);
  k.effect_text = text;
  k.triggers = spustace(text);
  if (k.triggers.length === 0) throw new Error(`${id}: text bez spúšťača.`);
}
for (const [id, meno] of Object.entries(MENA)) {
  const k = podlaId.get(id);
  if (k !== undefined) k.name = meno;
}
const mimo = cards.cards.filter((c) => !["Starešina", "Kliatba", "Lokalita"].some((t) => c.tags.includes(t)) && !sloty.karty.some((s) => s.id === c.id));
if (mimo.length > 0) throw new Error(`Karty mimo sloty.json: ${mimo.map((c) => c.id).join(", ")}`);

if (!cards.actions.includes("Pakt")) cards.actions.push("Pakt");
cards.source = "sada v7 — revízia sady a efekty (Michal 2026-10-27), tools/sada-v7/generuj.ts zo sloty.json a plan.md 14.0; len vetvy v7";
cards.cards.sort((a, b) => a.index - b.index);
writeFileSync(CARDS, `${JSON.stringify(cards, null, 1)}\n`);
console.log(`cards.json: ${cards.cards.length} kariet, ${cards.cards.filter((c) => c.tags.includes("Lokalita")).length} lokalít.`);
