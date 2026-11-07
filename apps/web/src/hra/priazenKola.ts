// Priazeň a nápoveda staršieho (v11 Strach a reči, Michal 2026-11-02). Priazeň dáva starší tomu,
// koho sa bojí menej — sila je rozdiel strachov (priazenHraca / priazenSila jadra); hádka ju od
// v11 nemení, víťaz hádky dvíha svoje reči. Každý prvok odpovedá na inú otázku:
//   krúžok priazne — komu priazeň patrí, akú akciu dáva a akú silnú;
//   teplomery — strach a reči oboch hráčov (LiniaStarsich.tsx);
//   nápoveda — všetko celou vetou (myš, fokus, podržanie prsta).
// Bez Reactu, aby sa dalo otestovať.

import type { BitkaNaNastenke, ElderState, Favour, GameData, PlayerId, StavVyhier, Stupen, Vazen, ZmenaMarkera } from "@naex/core";
import { KONSTANTY, NAZVY_ZON, favourStarsieho, kradezZaZajatie, najvyssiMarker, opponentOf, pocet, priazenHraca, priazenSila, spakyOdStarsieho as spakyOdStarsiehoJadra, spakyZaStupen, vydesil } from "@naex/core";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import { rodStarsieho, slovoStupna, type Rod } from "./textyStarsich.ts";

/** Komu priazeň patrí z pohľadu hráča, ktorý sa pozerá. */
export type KomuPriazen = "ja" | "su" | null;

/** Priazeň staršieho: komu (z pohľadu `ja`) a akej sily; sila 0 = nikto. */
export interface PriazenKola {
  readonly komu: KomuPriazen;
  readonly hrac: PlayerId | null;
  readonly sila: number;
}

const komuZ = (hrac: PlayerId | null, ja: PlayerId): KomuPriazen => (hrac === null ? null : hrac === ja ? "ja" : "su");

/** Priazeň staršieho z pohľadu hráča `ja` (rozdiel strachov). */
export function priazenKola(elder: Pick<ElderState, "strach">, ja: PlayerId): PriazenKola {
  const hrac = priazenHraca(elder);
  return { komu: komuZ(hrac, ja), hrac, sila: priazenSila(elder) };
}

/** Krátky účinok priazne pre riadok nápovedy („ty: +1 tuhé v bitke“, „nikomu · pri +1: …“). */
export function ucinokKola(fav: Favour, p: PriazenKola, mena: { readonly ja: string; readonly su: string }): { readonly komu: KomuPriazen; readonly kto: string | null; readonly text: string } {
  if (p.komu === null || p.sila <= 0) return { komu: null, kto: null, text: `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` };
  return { komu: p.komu, kto: p.komu === "ja" ? mena.ja : mena.su, text: UCINOK_KRATKO[fav](p.sila) };
}

/** „ty +2“, „Fero +1“, „nikto“. */
export function ktoPriazen(p: Pick<PriazenKola, "komu" | "sila">, mena: { readonly ja: string; readonly su: string }): string {
  return p.komu === null ? "nikto" : `${p.komu === "ja" ? mena.ja : mena.su} +${p.sila}`;
}

/** Markery jedného hráča slovami: „strach žltá, reči oranžová“, „pokojný“. */
export function textMarkerov(strach: number, reci: number): string {
  if (strach === 0 && reci === 0) return "nič";
  return [strach > 0 ? `strach ${NAZVY_ZON[strach]}` : null, reci > 0 ? `reči ${NAZVY_ZON[reci]}` : null].filter((x) => x !== null).join(", ");
}

/** Riadok hráča v nápovede (R3, Michal 2026-11-02): strach, reči a špaky po bitke — menom hráča, nie „ty“. */
export interface RiadokHraca {
  readonly komu: "ja" | "su";
  readonly hrac: PlayerId;
  /** Krátke meno hráča (ako nad čiarou hladiny). */
  readonly kto: string;
  readonly strach: Stupen;
  readonly reci: Stupen;
  /** Vrchol teplomera (strach + reči) — stupeň staršieho pre tohto hráča. */
  readonly vrchol: Stupen;
  readonly vyhra: number;
  readonly prehra: number;
}

/** Zajatie, ktoré by hráč smel pri vyhratej bitke Nakladačkou urobiť (jeho strach je 3, v11.4): koľko by mu súper odovzdal. */
export interface ZajatieVNapovede {
  readonly hrac: PlayerId;
  readonly komu: "ja" | "su";
  readonly kto: string;
  /** Súper — ten, kto by špaky odovzdal. */
  readonly obet: string;
  readonly kradez: number;
}

/** Obsah nápovedy nad staršom (R3) — kreslí ho ObsahNapovedyStarsieho (KruzokPriazne.tsx). */
export interface ObsahNapovedy {
  readonly druh: "starsi";
  readonly meno: string;
  readonly rod: Rod;
  /** Meno priazne zo scorecardu („Bitkár“). */
  readonly nazovPriazne: string;
  /** Kedy sa priazeň uplatní („v bitke“, „po bitke“, „pri exekúcii“). */
  readonly kedyPriazne: string;
  readonly favour: Favour;
  readonly priazen: PriazenKola;
  /** Strach a reči oboch hráčov — ja prvý. */
  readonly hraci: readonly [RiadokHraca, RiadokHraca];
  /** Účinok priazne pri sile 1, 2, 3 celou vetou (UCINOK_PRIAZNE). */
  readonly sily: readonly [string, string, string];
  readonly zajatie: readonly ZajatieVNapovede[];
  /** Čo urobí klik v kroku (zajatie, Kapybara) — inak null. */
  readonly akcia: string | null;
  /** Ďalší riadok (koniec partie: koľko špakov starší komu dal; pokus o zajatie). */
  readonly dalsi: { readonly nazov: string; readonly text: string } | null;
}

/** Obsah nápovedy nad väzňom (R3): v pivnici u koho, krádež pri zajatí a schopnosť väzňa doslova (v11.2). */
export interface ObsahNapovedyVazna {
  readonly druh: "vazen";
  readonly meno: string;
  readonly rod: Rod;
  readonly hrac: PlayerId;
  readonly komu: "ja" | "su";
  /** Krátke meno držiteľa. */
  readonly kto: string;
  readonly nazovPriazne: string | null;
  readonly cervene: number;
  readonly cervenychNaVyhru: number;
  readonly vazni: number;
  readonly vazniNaVyhru: number;
  /** Krádež pri zajatí (nástenka): bitka a koľko špakov držiteľ dostal; null = nevedno. */
  readonly kradez: { readonly kolo: number; readonly spaky: number; readonly obet: string } | null;
  /** Schopnosť väzňa (v11.2) — znenie z elders.json. */
  readonly schopnost: string | null;
  /** Schopnosť je minutá (raz za hru). */
  readonly pouzita: boolean;
}

export interface VstupNapovedy {
  readonly data: GameData;
  readonly elder: ElderState;
  readonly meno: string;
  readonly ja: PlayerId;
  /** Mená hráčov podľa miesta (0, 1) — v nápovede krátko, aj pri sebe meno (nie „ty“). */
  readonly mena: readonly [string, string];
  readonly akcia?: string | null;
  readonly dalsi?: { readonly nazov: string; readonly text: string } | null;
}

/**
 * Meno priazne podľa jej druhu (PRAVIDLA §10) — nie zo scorecardu: staré sady nesú „Exekútor“,
 * ktorý sa pri načítaní stal Advokátom (účinok by nesedel s menom).
 */
export const NAZOV_PRIAZNE: Readonly<Record<Favour, string>> = {
  UZERNIK: "Kmotor",
  LAKOMEC: "Abstinent",
  ROBOTA: "Robota",
  BITKAR: "Bitkár",
  VERIACI: "Veriaci",
  FAJCIAR: "Fajčiar",
  OHOVARACKA: "Ohováračka",
  ADVOKAT: "Advokát",
};

/** Kedy sa priazeň uplatní (PRAVIDLA §10, stĺpec „Uplatňuje sa pri“) — krátko do nadpisu nápovedy. */
export const KEDY_PRIAZNE: Readonly<Record<Favour, string>> = {
  UZERNIK: "po bitke",
  LAKOMEC: "v bitke",
  ROBOTA: "pri exekúcii",
  BITKAR: "v bitke",
  VERIACI: "v bitke",
  FAJCIAR: "po bitke",
  OHOVARACKA: "v bitke",
  ADVOKAT: "pri exekúcii",
};

/** Účinok priazne celou vetou bez názvu na začiatku („Kmotor: …“ je už v nadpise). */
export function silaPriazne(fav: Favour, sila: number): string {
  const t = UCINOK_PRIAZNE[fav](sila).replace(/^(Kmotor|Abstinent|Robota|Advokát): /, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function obsahNapovedy(v: VstupNapovedy): ObsahNapovedy {
  const su = opponentOf(v.ja);
  const fav = favourStarsieho(v.data, v.elder);
  const p = priazenKola(v.elder, v.ja);
  const kto = (h: PlayerId): string => kratkeMeno(v.mena[h]);
  const riadok = (h: PlayerId): RiadokHraca => {
    const strach = v.elder.strach[h];
    const reci = v.elder.reci[h];
    return {
      komu: h === v.ja ? "ja" : "su",
      hrac: h,
      kto: kto(h),
      strach,
      reci,
      vrchol: najvyssiMarker(v.elder, h),
      vyhra: spakyOdStarsiehoJadra(v.elder, h, true),
      prehra: spakyOdStarsiehoJadra(v.elder, h, false),
    };
  };
  const zajatie = ([v.ja, su] as const).flatMap((h): ZajatieVNapovede[] =>
    vydesil(v.elder, h) ? [{ hrac: h, komu: h === v.ja ? "ja" : "su", kto: kto(h), obet: kto(opponentOf(h)), kradez: kradezPokusu(v.elder, h) }] : [],
  );
  return {
    druh: "starsi",
    meno: v.meno,
    rod: rodStarsieho(v.elder.karta.defId, v.meno),
    nazovPriazne: NAZOV_PRIAZNE[fav],
    kedyPriazne: KEDY_PRIAZNE[fav],
    favour: fav,
    priazen: p,
    hraci: [riadok(v.ja), riadok(su)],
    sily: [silaPriazne(fav, 1), silaPriazne(fav, 2), silaPriazne(fav, 3)],
    zajatie,
    akcia: v.akcia ?? null,
    dalsi: v.dalsi ?? null,
  };
}

/**
 * Špaky hráča po bitke celou vetou (v11.12): „pri výhre +5, pri prehre +2 (reči; keď prehráš hádku,
 * klesnú zospodu)“; bez rečí „pri prehre 0“.
 */
export function vetaSpakov(r: Pick<RiadokHraca, "reci" | "vyhra" | "prehra">): string {
  const plus = (n: number): string => (n > 0 ? `+${n}` : "0");
  return `pri výhre ${plus(r.vyhra)}, pri prehre ${plus(r.prehra)}${r.reci > 0 ? " (reči; keď prehráš hádku, klesnú zospodu)" : ""}`;
}

/** Komu priazeň patrí a prečo — celou vetou, menami hráčov. */
export function vetaPriazne(o: Pick<ObsahNapovedy, "priazen" | "hraci" | "rod">): string {
  const [a, b] = o.hraci;
  const strachSlovom = (r: RiadokHraca): string => (r.strach === 0 ? "žiadny" : slovoStupna(r.strach, o.rod));
  if (o.priazen.komu === null) {
    return `Zatiaľ ju nemá nikto. Strach majú ${a.kto} aj ${b.kto} rovnaký (${a.strach === 0 ? "žiadny" : slovoStupna(a.strach, o.rod)}). Dostane ju ten, koho sa bojí menej: keď strach zdvihne ${a.kto}, dostane ju ${b.kto}, a naopak.`;
  }
  const ma = o.priazen.komu === "ja" ? a : b;
  return `Má ju ${ma.kto}, sila +${o.priazen.sila}. Strach: ${a.kto} ${strachSlovom(a)}, ${b.kto} ${strachSlovom(b)}. Sila je rozdiel strachov, reči sa nerátajú.`;
}

/** Riziko zajatia s krádežou celou vetou. */
export function vetaZajatia(z: ZajatieVNapovede, rod: Rod): string {
  return `${z.kto} ho môže po vyhratej bitke zajať za ${KONSTANTY.CENA_ZAJATIA} z Nakladačky (strach ${slovoStupna(3, rod)}). ${z.obet} mu vtedy odovzdá ${pocet(z.kradez, "špak", "špaky", "špakov")} za vrch svojho teplomera (dnes).`;
}

export interface VstupNapovedyVazna {
  readonly data: GameData;
  readonly vazen: Pick<Vazen, "elderId" | "hrac" | "karta" | "scorecard" | "pouzita">;
  readonly meno: string;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vyhry: StavVyhier;
  readonly nastenka: readonly Pick<BitkaNaNastenke, "kolo" | "bodovanie" | "kradez">[];
}

export function obsahNapovedyVazna(v: VstupNapovedyVazna): ObsahNapovedyVazna {
  const h = v.vazen.hrac;
  const k = kradezPriZajati(v.nastenka, v.vazen.elderId, h);
  const kradez = k === null ? null : { ...k, obet: kratkeMeno(v.mena[opponentOf(h)]) };
  const schopnost = v.data.elders.get(v.vazen.karta.defId)?.schopnost ?? "";
  const fav = v.data.scorecards.find((x) => x.id === v.vazen.scorecard)?.favour;
  return {
    druh: "vazen",
    meno: v.meno,
    rod: rodStarsieho(v.vazen.karta.defId, v.meno),
    hrac: h,
    komu: h === v.ja ? "ja" : "su",
    kto: kratkeMeno(v.mena[h]),
    nazovPriazne: fav === undefined ? null : NAZOV_PRIAZNE[fav],
    cervene: v.vyhry.cervene[h],
    cervenychNaVyhru: v.vyhry.cervenychNaVyhru,
    vazni: v.vyhry.vazni[h],
    vazniNaVyhru: v.vyhry.vazniNaVyhru,
    kradez,
    schopnost: schopnost === "" ? null : schopnost,
    pouzita: v.vazen.pouzita === true,
  };
}

/** Nápoveda nad teplomermi (krátka, 1–2 riadky). */
export function riadkyKruzkov(): readonly string[] {
  return ["Stĺpec: strach (plní sa zdola, neklesá) · bublina: reči nad strachom, číslo = špaky.", "Tvoj vľavo, súperov vpravo."];
}

/** Koľko starších dáva hráčovi `p` priazeň (dlaždica Starší, stĺpec na telefóne). */
export function pocetPriazniKola(starsi: readonly Pick<ElderState, "strach">[], p: PlayerId): number {
  return starsi.filter((e) => priazenHraca(e) === p).length;
}

/** Krátky riadok dlaždice staršieho v bare hráča `p` podľa priazne. */
export function riadokPriazneDlazdice(hrac: PlayerId | null, p: PlayerId, ja: PlayerId): string {
  if (hrac === null) return "nikomu";
  if (hrac === p) return p === ja ? "pomáha ti" : "pomáha mu";
  return p === ja ? "pomáha súperovi" : "pomáha tebe";
}

/** Meno na lístok a do riadkov (portrét je úzky): „Bot Rapavý Fero“ → „Fero“, „Jano (AI)“ → „Jano“. */
export function kratkeMeno(meno: string): string {
  const slova = meno
    .replace(/\s*\(AI\)\s*$/, "")
    .trim()
    .split(/\s+/);
  return slova.at(-1) || meno;
}

/** Reči z hádky na jednom staršom (rekapitulácia bitky): kto a zo stupňa na stupeň. */
export interface ReciZHadky {
  readonly elderId: string;
  readonly hrac: PlayerId;
  readonly komu: "ja" | "su";
  readonly z: number;
  readonly na: number;
}

/**
 * Reči, ktoré víťaz hádky rozdelil (v11): kým bitka beží, zo stavu hádky, potom zo zmien
 * markerov (tie sa držia do konca Zhromaždenia).
 */
export function reciZHadky(
  zdroj: { readonly hadka?: { readonly vitaz: PlayerId | null; readonly zdvihy: readonly { readonly elderId: string; readonly z: number; readonly na: number }[] } | undefined; readonly zmeny: readonly ZmenaMarkera[] },
  ja: PlayerId,
): readonly ReciZHadky[] {
  const h = zdroj.hadka;
  if (h !== undefined && h.vitaz !== null && h.zdvihy.length > 0) {
    const vitaz = h.vitaz;
    return h.zdvihy.map((z) => ({ elderId: z.elderId, hrac: vitaz, komu: vitaz === ja ? "ja" : "su", z: z.z, na: z.na }));
  }
  return zdroj.zmeny.filter((z) => z.zdroj === "hadka" && z.marker === "reci").map((z) => ({ elderId: z.elderId, hrac: z.hrac, komu: z.hrac === ja ? "ja" : "su", z: z.z, na: z.na }));
}

/** Priazne v rekapitulácii bitky: reči z hádky po starších a meno staršieho podľa priazne. */
export interface PriazneBitky {
  readonly hadka: readonly (ReciZHadky & { readonly meno: string; readonly fav: Favour })[];
  /** Meno staršieho, ktorý dáva priazeň daného druhu (pečiatka „priazeň Bitkára“ → meno a krúžok). */
  readonly menoStarsieho: (fav: Favour) => string | null;
}

/** Titulok čipu hádky v rekapitulácii: „tvoja hádka na Krčmárke: reči žltá → oranžová“. */
export function popisReciZHadky(x: ReciZHadky & { readonly meno: string }, menoSupera: string): string {
  return `${x.komu === "ja" ? "tvoja hádka" : `hádka (${kratkeMeno(menoSupera)})`} na staršom ${x.meno}: reči ${NAZVY_ZON[x.z] ?? ""} → ${NAZVY_ZON[x.na] ?? ""}`;
}

/** Koľko špakov starší za strach a reči komu dal počas partie (pás starších na konci partie). */
export function spakyOdStarsieho(nastenka: readonly { readonly zaStarsichRozpis?: readonly [readonly { readonly elderId: string | null; readonly spaky: number }[], readonly { readonly elderId: string | null; readonly spaky: number }[]] }[], elderId: string): readonly [number, number] {
  const sucet = (p: PlayerId): number =>
    nastenka.reduce((a, b) => a + (b.zaStarsichRozpis?.[p] ?? []).filter((x) => x.elderId === elderId).reduce((c, x) => c + x.spaky, 0), 0);
  return [sucet(0), sucet(1)];
}

/** Priazeň staršieho podľa jeho id (aj väzňa) — pre záznamy, ktoré nesú len elderId (nástenka, súhrny). */
export function favourPodlaId(
  data: Pick<GameData, "scorecards">,
  stol: { readonly starsi: readonly Pick<ElderState, "elderId" | "scorecard">[]; readonly vazni: readonly { readonly elderId: string; readonly scorecard: string }[] },
  elderId: string,
): Favour | null {
  const sc = stol.starsi.find((e) => e.elderId === elderId)?.scorecard ?? stol.vazni.find((v) => v.elderId === elderId)?.scorecard;
  return data.scorecards.find((x) => x.id === sc)?.favour ?? null;
}

/**
 * Krádež pri zajatí (§10, krok 4e) z nástenky: zajatý bol v poslednej bitke, v ktorej ešte bodoval
 * (bodovanie je pred zajatím, 4b → 4e); koľko špakov držiteľ dostal. null = záznam chýba (archív).
 */
export function kradezPriZajati(nastenka: readonly Pick<BitkaNaNastenke, "kolo" | "bodovanie" | "kradez">[], elderId: string, hrac: PlayerId): { readonly kolo: number; readonly spaky: number } | null {
  const bitka = [...nastenka].reverse().find((b) => b.bodovanie?.some((x) => x.elderId === elderId) === true);
  return bitka === undefined ? null : { kolo: bitka.kolo, spaky: Math.max(0, bitka.kradez?.[hrac] ?? 0) };
}

/** Koľko špakov zajímajúcemu odovzdá súper: bodov hádky v jeho rečiach pri staršom (v11.12, v čase zajatia). */
export const kradezPokusu = (elder: Pick<ElderState, "strach" | "reci" | "reciOd">, pokusa: PlayerId): number => kradezZaZajatie(elder, pokusa);
