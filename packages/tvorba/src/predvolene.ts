// Východiskový obsah tvorcu pri prvom spustení servera. Popisy akcií
// a pojmov sú z pravidiel v2 (docs/naex_pravidla_v2_celostranova_robota.pdf);
// farby kategórií sú odmerané z tlačového PDF.

import { KONSTANTY } from "@naex/core";
import type { AkciaDef, Kategoria, KlucoveSlovo } from "./typy.ts";

/**
 * Akcie, ktorých názov alebo popis zmenili rozhodnutia Michala 2026-10-19:
 * jednotné názvy (akcia sa volá ako karta či zdroj, ktorý dáva — Dlh,
 * Poškodenie pečene, Poldeci, Cigareta; nikde „fyzická cigareta“) a nová
 * Vízia. Server nimi pri štarte prepíše staré databázy (zjednotNazvyAkcii).
 * Popisy Dlhu a Poškodenia pečene sú už podľa M23 (verejný dlh, 2026-10-21),
 * Dlh podľa pravidiel v6 s číslami z jadra (Michal 2026-10-26) — staré
 * databázy ich dostanú z dorovnajSoSeedom (len s novou značkou). Akcia s kľúčom
 * Dlh sa od v8.2 volá Hazard (Michal 2026-10-30) — názov v starej databáze
 * dorovnajSoSeedom nemení (len popis), premenuje ho admin v tvorcovi.
 */
export const AKCIE_20261019: readonly { readonly kluc: string; readonly nazov: string; readonly popis: string }[] = [
  {
    kluc: "Dlh",
    nazov: "Hazard",
    popis:
      `Zvýši zadĺženie o 1. V Pitke za každé ${KONSTANTY.PRAH_DLHU_ZAKLAD} zadĺženia získaš Dlh — je hneď priznaný (počítadlo, nie karta), zvyšok zadĺženia ostáva na ďalšiu Pitku. ` +
      "Za priznané Dlhy príde v každej bitke Exekútor: spáli ti polovicu priznaných Dlhov (zaokrúhlene nahor) a rovnako veľa špakov " +
      "(tvoja priazeň Advokáta špaky uberie). Pri remíze v tuhom aj v Absťákoch prehráva, kto má viac priznaných Dlhov.",
  },
  {
    kluc: "PoškodeniePečene",
    nazov: "Poškodenie pečene",
    popis: "Pridá 1 poškodenie pečene. V Pitke za každý celý prah získaš Cirhózu — ide do tvojho odhadzovacieho balíčka.",
  },
  { kluc: "Poldeci", nazov: "Poldeci", popis: "Pri bitke otočí jeden tvoj vypitý poldeci späť na plný. Poškodenie pečene z neho sa počíta už v Pitke." },
  {
    kluc: "Cigareta",
    nazov: "Cigareta",
    popis:
      "V Pitke dostaneš 1 cigaretu (mínus súperove Obmedzenia). Cigarety sa prenášajú — platíš nimi šenok, Dedičstvo, doliatie poldeci, Kšefty aj fajčenie: " +
      `v Pitke dobereš kartu, prvé fajčenie v Pitke stojí ${KONSTANTY.CENA_FAJCENIA_ZAKLAD} cigaretu, druhé ${KONSTANTY.CENA_FAJCENIA_ZAKLAD + KONSTANTY.CENA_FAJCENIA_PRIRASTOK}, ` +
      `tretie ${KONSTANTY.CENA_FAJCENIA_ZAKLAD + 2 * KONSTANTY.CENA_FAJCENIA_PRIRASTOK}…`,
  },
  { kluc: "Obmedzenie", nazov: "Obmedzenie", popis: "Súper dostane v Pitke o 1 cigaretu menej." },
  {
    kluc: "Vízia",
    nazov: "Vízia",
    popis: "Na konci Pitky sa za každú Víziu pozrieš na vrchnú kartu svojho doberacieho balíčka: vezmeš si ju do ruky, alebo ju zahodíš (navždy z hry).",
  },
];

const A = (kluc: string, nazov: string, popis: string): Omit<AkciaDef, "poradie"> => ({
  kluc,
  nazov,
  popis,
  ikona: { typ: "vstavana" },
});

export const PREDVOLENE_AKCIE: readonly AkciaDef[] = [
  A("Rana", "Rana", "1 tuhé poškodenie."),
  A("Pecka", "Pecka", "2 tuhé poškodenia."),
  A("Petelica", "Petelica", "3 tuhé poškodenia."),
  A("Povera", "Povera", "Ohovára staršieho. So súperovou Vierou sa ruší 1 : 1. Každá zvyšná Povera posunie v bitke silu priazne jedného staršieho o stupeň k tebe (najviac na 3) do konca kola — marker sa nehýbe."),
  A("Viera", "Viera", "Znižuje súperovo tuhé poškodenie o 1 za kus; Veriaci pridá Vieru navyše +1 / +2 / +3. So súperovou Poverou sa ruší 1 : 1."),
  A("Pohoršenie", "Pohoršenie", "Bod na posun markera ľubovoľného staršieho k súperovi alebo k sebe: pole von zo stredu stojí 1 / 2 / 3, k stredu 2 / 3 / 4. Vyberieš staršieho a smer, marker ide, kým Pohoršenia stačia — priazeň sa mení hneď, vyhodnocuje sa v bitke hneď po Poverách, bez ohľadu na výsledok bitky. Na staršieho v ohrození nesmie."),
  ...AKCIE_20261019.map((a) => A(a.kluc, a.nazov, a.popis)),
  A("Posilnenie", "Posilnenie", "Zdvojnásobí prepojenú akciu — priaznivú aj nepriaznivú."),
  A("Odpor", "Odpor", "Zruší prepojenú akciu. Odpor proti Odporu = Vzbura: obe karty aktivujú všetky inak neaktívne akcie."),
  A("Robota", "Robota", "V bitke v kroku exekúcie, pred Exekútorom, spáli 1 tvoj priznaný Dlh (z hry). Za Dlh, ktorý nemá čo spáliť, ti dá 1 špak."),
  A("Pakt", "Pakt", "Na spoji sa správa ako akcia, s ktorou je v páre. Pakt s Paktom nerobí nič; Odpor ho zruší."),
].map((a, poradie) => ({ ...a, poradie }));

const S = (slovo: string, popis: string): KlucoveSlovo => ({
  slovo,
  tucne: true,
  kurziva: false,
  novyRiadok: true,
  tvary: [`${slovo}:`],
  popis,
});
const P = (slovo: string, tvary: readonly string[], popis: string): KlucoveSlovo => ({
  slovo,
  tucne: false,
  kurziva: true,
  novyRiadok: false,
  tvary,
  popis,
});

export const PREDVOLENE_KLUCOVE_SLOVA: readonly KlucoveSlovo[] = [
  S("Nástup", "Vyhodnotí sa pri zahraní karty."),
  S("Furt", "Platí, kým je karta odhalená kdekoľvek v hracom priestore."),
  S("Bitka", "Uplatní sa pri vyhodnotení bitky."),
  // Michal 2026-10-24: Pitka sama karty nedáva (PRAVIDLA §7, krok 6).
  S("Pitka", "Uplatní sa počas Pitky — keď hráči dávajú NA EX, fajčia a vyhodnocujú karty na stole. Pitka sama karty nedáva."),
  S("Zhromaždenie", "Uplatní sa počas Zhromaždenia — keď hráči vykladajú karty."),
  S(
    "Dedičstvo",
    "Pasívny bonus Nástroja, kým leží v tvojej hracej oblasti. Vyloženie do Dedičstva stojí cigarety — cena rastie spoločne pre oboch: prvý Nástroj v hre 1 cigaretu, druhý 2, tretí 3…",
  ),
  // Remízu v tuhom rozhodujú Absťáky, potom priznané Dlhy (battleOutcome, §9.4); sekera až keď nerozhodne nič.
  S("Výhra", "Uplatní sa, keď vyhráš bitku o lokalitu: máš vyššie tuhé poškodenie, pri rovnakom tuhom menej Absťákov a pri ich rovnosti menej priznaných Dlhov. Keď nerozhodne ani to, nevyhrá nikto — špaky kola idú na sekeru."),
  S("Prehra", "Uplatní sa, keď prehráš bitku o lokalitu: máš nižšie tuhé poškodenie, pri rovnakom tuhom viac Absťákov a pri ich rovnosti viac priznaných Dlhov. Keď nerozhodne ani to, neprehrá nikto — špaky kola idú na sekeru."),
  // Kšeft (v7, Michal 2026-10-27): aktívny efekt za cenu; Prestávka a Exekúcia zanikli (nemali kartu).
  S("Kšeft", "Aktívny efekt: za cenu (cigarety, poldeci, Dlh, karta) ho spustíš sám v Pitke, kým ju neskončíš — každú kartu raz za Pitku; Kšeft nie je ťah. Kšeft lokality smie použiť každý hráč, Kšeft väzňa (Väzeň — Kšeft) len hráč, ktorý toho staršieho drží ako väzňa."),
  // Konflikt, Úplatok a Exekúcia (v7, Michal 2026-10-27, plan.md 13 a 14).
  S("Konflikt", "Spustí sa, keď táto karta leží v línii a súper k nej priloží svoju kartu. Keď prikladáš ty, Konflikt nevyvoláš; priložený Nástroj, NA EX ani zrážka ho nespúšťajú."),
  S("Úplatok", "Súper smie v Pitke, kým ju neskončil, dať na túto kartu cigaretu, raz za Pitku; cigareta prepadne."),
  S("Exekúcia", "Uplatní sa v bitke v kroku exekúcie (po poškodení a špakoch za bitku), keď Exekútor prichádza ku každému hráčovi s priznaným Dlhom."),
  P("zahoď", ["zahodiť", "zahodí", "zahodia"], "Zahodenie — kartu odstrániš z hry (spáliš)."),
  P("odhoď", ["odhodiť", "odhodí", "odhodia"], "Odhodenie — karta ide do odhadzovacieho balíčka hráča, ktorý ju zahral."),
  P("preskúmaj", ["preskúmať", "preskúma"], "Preskúmanie — prezrieš si karty, ktoré efekt určí (napr. celý doberací balíček), a vrátiš ich."),
  // Michal 2026-10-20: prevaha v kraji rozhoduje o akciách hrany lokality.
  {
    slovo: "Prevaha",
    tucne: false,
    kurziva: true,
    novyRiadok: false,
    tvary: ["prevaha", "prevahu", "prevahy", "prevahe", "prevahou"],
    popis:
      "Prevahu v kraji (polovici línie pri jednej hrane lokality) má hráč, ktorý tam má viac svojich Občanov, Zvierat a Starešinov — Nástroje a iné karty sa nerátajú. Pri rovnosti rozhoduje majiteľ karty pri lokalite. Hráč s prevahou dostane akcie hrany lokality v tom kraji.",
  },
];

/** Odtiene odmerané z tlačového PDF; Občan a pohlavia farbu nedávajú. */
export const PREDVOLENE_KATEGORIE: readonly Kategoria[] = [
  ["Starešina", 240],
  ["Lokalita", 120],
  ["Nástroj", 150],
  ["Kliatba", 60],
  ["Zviera", 300],
  ["Pracujúci", 210],
  ["Pamätník", 180],
  ["Zahraničný", 270],
  ["Kriminál", 90],
  ["Autorita", 0],
  ["Závislý", 330],
  ["Influencer", 30],
  ["Občan", 0, false],
  ["Chlap", 0, false],
  ["Žena", 0, false],
].map(([nazov, odtien, zapnuta]) => ({
  nazov: nazov as string,
  odtien: odtien as number,
  zapnuta: zapnuta !== false,
}));
