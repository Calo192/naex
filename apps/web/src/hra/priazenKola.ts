// Priazeň a nápoveda staršieho (v11 Strach a reči, Michal 2026-11-02). Priazeň dáva starší tomu,
// koho sa bojí menej — sila je rozdiel strachov (priazenHraca / priazenSila jadra); hádka ju od
// v11 nemení, víťaz hádky dvíha svoje reči. Každý prvok odpovedá na inú otázku:
//   krúžok priazne — komu priazeň patrí, akú akciu dáva a akú silnú;
//   teplomery — strach a reči oboch hráčov (LiniaStarsich.tsx);
//   nápoveda — všetko celou vetou (myš, fokus, podržanie prsta).
// Bez Reactu, aby sa dalo otestovať.

import type { ElderState, Favour, GameData, PlayerId, ZmenaMarkera } from "@naex/core";
import { NAZVY_ZON, STAV_STARSIEHO, favourStarsieho, opponentOf, priazenHraca, priazenSila, scorecardStarsieho, spakyOdStarsieho as spakyOdStarsiehoJadra, stupenStavu } from "@naex/core";
import { UCINOK_KRATKO } from "./Scorecard.tsx";

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

/** Riadok hráča v nápovede: markery a špaky po bitke (výhra / prehra). */
export interface RiadokHraca {
  readonly komu: "ja" | "su";
  readonly kto: string;
  readonly markery: string;
  readonly vyhra: number;
  readonly prehra: number;
}

/** Obsah nápovedy nad staršom — kreslí ho ObsahNapovedyStarsieho (KruzokPriazne.tsx). */
export interface ObsahNapovedy {
  readonly meno: string;
  /** Meno priazne zo scorecardu („Bitkár“). */
  readonly nazovPriazne: string;
  readonly favour: Favour;
  readonly priazen: PriazenKola;
  readonly ucinok: ReturnType<typeof ucinokKola>;
  /** Strach a reči oboch hráčov — ja prvý. */
  readonly hraci: readonly [RiadokHraca, RiadokHraca];
  /** Stav staršieho podľa vyššieho strachu („vystrašený“). */
  readonly stav: string;
  /** Čo urobí klik v kroku (zajatie, Kapybara) — inak null. */
  readonly akcia: string | null;
  /** Ďalší riadok (koniec partie: koľko špakov starší komu dal; pokus o zajatie). */
  readonly dalsi: { readonly nazov: string; readonly text: string } | null;
}

export interface VstupNapovedy {
  readonly data: GameData;
  readonly elder: ElderState;
  readonly meno: string;
  readonly ja: PlayerId;
  /** Mená hráčov podľa miesta (0, 1) — súper menom, ja sa píše „ty“. */
  readonly mena: readonly [string, string];
  readonly akcia?: string | null;
  readonly dalsi?: { readonly nazov: string; readonly text: string } | null;
}

export function obsahNapovedy(v: VstupNapovedy): ObsahNapovedy {
  const su = opponentOf(v.ja);
  const m = { ja: "ty", su: v.mena[su] };
  const fav = favourStarsieho(v.data, v.elder);
  const p = priazenKola(v.elder, v.ja);
  const riadok = (h: PlayerId): RiadokHraca => ({
    komu: h === v.ja ? "ja" : "su",
    kto: h === v.ja ? "ty" : v.mena[h],
    markery: textMarkerov(v.elder.strach[h], v.elder.reci[h]),
    vyhra: spakyOdStarsiehoJadra(v.elder, h, true),
    prehra: spakyOdStarsiehoJadra(v.elder, h, false),
  });
  return {
    meno: v.meno,
    nazovPriazne: scorecardStarsieho(v.data, v.elder).nazov,
    favour: fav,
    priazen: p,
    ucinok: ucinokKola(fav, p, m),
    hraci: [riadok(v.ja), riadok(su)],
    stav: STAV_STARSIEHO[stupenStavu(v.elder)],
    akcia: v.akcia ?? null,
    dalsi: v.dalsi ?? null,
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
