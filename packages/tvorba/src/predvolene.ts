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
      "V Pitke získaš 1 Dlh — je hneď priznaný (počítadlo, nie karta). " +
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
      "V Pitke dostaneš 1 cigaretu (mínus súperove Obmedzenia). Cigarety sa prenášajú — platíš nimi karty z ponuky, Dedičstvo, podloženie Nástroja, doliatie poldeci, barter, Záverečnú aj fajčenie: " +
      `v Pitke dobereš kartu, prvé fajčenie v Pitke stojí ${KONSTANTY.CENA_FAJCENIA_ZAKLAD} cigaretu, druhé ${KONSTANTY.CENA_FAJCENIA_ZAKLAD + KONSTANTY.CENA_FAJCENIA_PRIRASTOK}, ` +
      `tretie ${KONSTANTY.CENA_FAJCENIA_ZAKLAD + 2 * KONSTANTY.CENA_FAJCENIA_PRIRASTOK}…`,
  },
  { kluc: "Obmedzenie", nazov: "Obmedzenie", popis: "Súper dostane v Pitke o 1 cigaretu menej." },
  {
    kluc: "Vízia",
    nazov: "Vízia",
    popis: "Na konci Pitky sa za každú Víziu pozrieš na vrchnú kartu svojho doberacieho balíčka: vezmeš si ju do ruky, alebo ju spáliš (navždy z hry).",
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
  A("Povera", "Povera", `${KONSTANTY.HADKA.POVERA_MAKKE} mäkké poškodenie do hádky (s Horoskopom ${KONSTANTY.HADKA.HOROSKOP_POVERA}). So súperovou Vierou sa ruší 1 : 1. Kto má v bitke viac mäkkého, vyhral hádku o rozdiel a po bitke ho rozdelí na svoje reči pri starších (vo finále 1 špak za bod).`),
  A("Viera", "Viera", "Najprv zruší súperove Povery 1 : 1 (aj vylepšenú Horoskopom), zvyšná znižuje súperovo tuhé poškodenie o 1 za kus; Veriaci pridá Vieru navyše +1 / +2 / +3. Proti Pohoršeniu nepomáha."),
  A("Pohoršenie", "Pohoršenie", `${KONSTANTY.HADKA.POHORSENIE_MAKKE} mäkké poškodenie do hádky; Viera ho nezruší. Kto má v bitke viac mäkkého, vyhral hádku o rozdiel a po bitke ho rozdelí na svoje reči pri starších (vo finále 1 špak za bod).`),
  ...AKCIE_20261019.map((a) => A(a.kluc, a.nazov, a.popis)),
  A("Posilnenie", "Posilnenie", "Zdvojnásobí prepojenú akciu — priaznivú aj nepriaznivú. Posilnenie proti Posilneniu = Forsáž: obe karty majú všetky aktívne akcie posilnené."),
  A("Odpor", "Odpor", "Odpor je aktívny len bez spoja a dáva karte štít proti NA EX. Na spoji zruší akciu, s ktorou sa spojí, aj seba. Odpor s Odporom = Vzbura."),
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
  // Kšeft zanikol (frakcie, Michal 2026-11-08); Kšeft väzňa nahradila v11.2 schopnosť väzňa (PRAVIDLA §10).
  // Spoločník a Nepriateľ (frakcie): akcie navyše, kým je v partii karta s tagom; zápis v texte
  // efektu „Spoločník: Tag {Akcia}.“ — piktogram v zložených zátvorkách (@naex/core navyse.ts).
  S("Spoločník", "Kým máš v partii (karty natočené k tebe, kdekoľvek v línii) inú odkrytú kartu s tagom za dvojbodkou, máš akcie navyše z pečate v obrázku — raz, aj pri viacerých takých kartách. Rátajú sa ako tvoje akcie toho druhu v ich kroku; Posilnenie, Odpor, NA EX ani Forsáž ich nemenia."),
  S("Nepriateľ", "Kým má súper v partii odkrytú kartu s tagom za dvojbodkou, máš akcie navyše z pečate v obrázku — raz, aj pri viacerých takých kartách. Rátajú sa ako tvoje akcie toho druhu v ich kroku; Posilnenie, Odpor, NA EX ani Forsáž ich nemenia."),
  // Konflikt a Exekúcia (v7, Michal 2026-10-27, plan.md 13 a 14); Úplatok zanikol vo v10.3.
  // Konflikt oboma smermi a Podpora (v11.3, Michal 2026-11-03).
  S("Konflikt", "Spustí sa, keď sa táto karta priložením ocitne vedľa súperovej karty — či ju prikladáš ty k súperovej, alebo súper svoju k nej; s tagom za dvojbodkou len pri karte s tým tagom. Pri každom stretnutí, do konca kola. Nástroj, NA EX, zrážka ani presun karty ho nespúšťajú."),
  S("Podpora", "Spustí sa, keď sa táto karta priložením stretne s inou tvojou kartou — či prikladáš ju, alebo inú svoju k nej; s tagom za dvojbodkou len pri karte s tým tagom. Pri každom stretnutí, do konca kola. Nástroj, NA EX, zrážka ani presun karty ju nespúšťajú."),
  // Hádka (v11.5, Noviny, Michal 2026-11-03).
  S("Hádka", "Uplatní sa v bitke, keď sa rozhodne hádka — kto má viac mäkkého poškodenia (Pohoršenie, Povera), hádku vyhral."),
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
