// Východiskový obsah tvorcu pri prvom spustení servera. Popisy akcií
// a pojmov sú z pravidiel v2 (docs/naex_pravidla_v2_celostranova_robota.pdf);
// farby kategórií sú odmerané z tlačového PDF.

import type { AkciaDef, Kategoria, KlucoveSlovo } from "./typy.ts";

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
  A("Povera", "Povera", "Mäkké poškodenie do výšky súperovho priznaného dlhu. So súperovou Vierou sa ruší 1 : 1."),
  A("Viera", "Viera", "Znižuje súperovo tuhé poškodenie (základ 1, upraviteľný priazňou). So súperovou Poverou sa ruší 1 : 1."),
  A("Pohoršenie", "Pohoršenie", "Posunie marker ľubovoľného staršieho o 1 smerom k súperovi — vyhodnocuje sa ako prvé, bez ohľadu na výsledok bitky."),
  A("Dlh", "Hazard", "Zvýši zadĺženie o 1. V Pitke pri prahu (2) získaš kartu Dlhu."),
  A("PoškodeniePečene", "Poškodenie pečene", "Pridá poškodenie pečene. V Pitke pri prahu získaš Cirhózu."),
  A("Poldeci", "Poldecko", "Pri bitke otočí jeden vypitý poldeci späť na plný. Poškodenie pečene sa počíta už v Pitke."),
  A("Cigaretka", "Cigaretka", "V Pitke dostaneš fyzickú cigaretu. Cigarety sa prenášajú; vyfajčená cigareta = karta hneď."),
  A("Obmedzenie", "Obmedzenie", "Súper dostane v Pitke o cigaretu z Cigaretiek menej."),
  A("Vízia", "Vízia", "Z práve dobraných kariet smieš zahodiť zopár kliatieb a dobrať si rovnaký počet nových."),
  A("Posilnenie", "Posilnenie", "Zdvojnásobí prepojenú akciu — priaznivú aj nepriaznivú."),
  A("Odpor", "Odpor", "Zruší prepojenú akciu. Odpor proti Odporu = Vzbura: obe karty aktivujú všetky inak neaktívne akcie."),
  A("Robota", "Robota", "Pred kontrolou prahu Exekútora odhodí 1 priznaný Dlh. Funguje aj bez exekúcie."),
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
  S("Pitka", "Uplatní sa počas Pitky — keď si hráči doberajú karty a vyhodnocujú efekty."),
  S("Zhromaždenie", "Uplatní sa počas Zhromaždenia — keď hráči vykladajú karty."),
  S("Dedičstvo", "Pasívny bonus Nástroja, kým leží v tvojej hracej oblasti."),
  S("Výhra", "Uplatní sa, keď vyhráš bitku o lokalitu alebo o staršieho."),
  S("Prehra", "Uplatní sa, keď prehráš bitku o lokalitu alebo o staršieho."),
  S("Prestávka", "Uplatní sa cez prestávku pred bitkou."),
  S("Podpora", "Uplatní sa, keď má karta v okolí presne 2 karty."),
  S("Exekúcia", "Uplatní sa, keď ťa navštívi Exekútor."),
  P("zahoď", ["zahodiť", "zahodí", "zahodia"], "Zahodenie — kartu odstrániš z hry (spáliš)."),
  P("odhoď", ["odhodiť", "odhodí", "odhodia"], "Odhodenie — karta ide do odhadzovacieho balíčka hráča, ktorý ju zahral."),
  P("preskúmaj", ["preskúmať", "preskúma"], "Preskúmanie — zober a prezri si 5 kariet, potom ich vráť."),
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
