// DOČASNÉ — stará stupnica so 7 poľami (do v10) pre zobrazenie starších, kým stôl neprestaví
// UI podľa v11 Strach a reči (Teplomery a Pult, docs/napady/strach-reci-mocky.html). Jadro od
// v11 nesie strach a reči oboch hráčov (ElderState.strach / .reci); tu sa z nich odvodí poloha
// „markera“ = poloha priazne: na polovici hráča, ktorému starší dáva priazeň, stupeň = jej sila.
// Udržaný strach, klebety a posuny markera v11 nie sú — funkcie vracajú prázdne hodnoty.
// Po prestavbe stola súbor zmaž.

import type { ClientState, Command, ElderState, PlayerId, Stupen, Zdvih, ZmenaMarkera } from "@naex/core";
import type { BattleOutcome, DamageResult } from "@naex/core";
import type { PohladSpakov, SpakyStarsieho as SpakyStarsiehoJadra, SpakyTeraz as SpakyTerazJadra } from "@naex/core";
import { bodyRozdelenia, cenaDalsiehoStupna, cenaDvihnutia, krokRozdelenia, markerRozdelenia, overRozdelenie, spakyTeraz as spakyTerazJadra, stupenOdkial, vazniNaVyhru, DLZKY_HRY } from "@naex/core";

export type MarkerPos = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const MARKER_STRED: MarkerPos = 3;
export const MARKER_KRAJ = [0, 6] as const;
export const STUPNICA_HODNOTY = [3, 2, 1, 0, 1, 2, 3] as const;
export const STUPNICA_ZONY = [3, 2, 1, 0, 1, 2, 3] as const;
/** Klebety (v10) — v11 nie sú. */
export type Klebety = Readonly<Record<string, number>>;

/** Posun markera na starej stupnici — zo zmeny strachu (reči priazeň nemenia, nekreslia sa). */
export interface PosunMarkera {
  readonly elderId: string;
  readonly z: MarkerPos;
  readonly na: MarkerPos;
  readonly zdroj: ZmenaMarkera["zdroj"];
  readonly kto: PlayerId;
}

/** Starší s polohou na starej stupnici: buď už má marker, alebo ho odvodí zo strachov. */
export type SMarkerom = { readonly marker: MarkerPos } | Pick<ElderState, "strach">;

/** Poloha priazne zo strachov: priazeň hráča 0 sily s → 3 − s, hráča 1 → 3 + s. */
export function polohaZoStrachu(strach: readonly [number, number]): MarkerPos {
  return Math.max(0, Math.min(6, 3 - (strach[1] - strach[0]))) as MarkerPos;
}

export function markerStarsieho(e: SMarkerom): MarkerPos {
  return "marker" in e ? e.marker : polohaZoStrachu(e.strach);
}

/** Starší s pridaným odvodeným markerom (zobrazenie starej stupnice). */
export function sMarkeromStarym<E extends Pick<ElderState, "strach">>(e: E): E & { readonly marker: MarkerPos } {
  return { ...e, marker: polohaZoStrachu(e.strach) };
}

export function priazenHraca(e: SMarkerom): PlayerId | null {
  const m = markerStarsieho(e);
  return m < 3 ? 0 : m > 3 ? 1 : null;
}

export function priazenSila(e: SMarkerom): number {
  return STUPNICA_HODNOTY[markerStarsieho(e)];
}

export function obavanyHrac(e: SMarkerom): PlayerId | null {
  const p = priazenHraca(e);
  return p === null ? null : p === 0 ? 1 : 0;
}

/** Strach hráča p: pri staršom so strachmi skutočný (v11), pri samotnej polohe rozdiel. */
export function strachZ(e: SMarkerom, p: PlayerId): 0 | 1 | 2 | 3 {
  if (!("marker" in e)) return e.strach[p] as 0 | 1 | 2 | 3;
  return obavanyHrac(e) === p ? STUPNICA_ZONY[e.marker] : 0;
}

export function vydesil(e: SMarkerom, p: PlayerId): boolean {
  return strachZ(e, p) === 3;
}

/** Udržaný strach (v8.3) v11 nie je. */
export function strachNaVyplatu(_e: unknown, _p: PlayerId): number {
  return 0;
}
export function strachNaUdrzanie(_e: unknown, _p: PlayerId): number {
  return 0;
}

/** Posun polohy (bez udržaného strachu) — len pre náhľady starej stupnice. */
export function sPosunutymMarkerom<E extends object>(e: E, na: MarkerPos): E & { readonly marker: MarkerPos } {
  return { ...e, marker: na };
}

export function posunMarker(e: { readonly marker: MarkerPos }, smerK: PlayerId): MarkerPos | null {
  if (e.marker === MARKER_KRAJ[smerK]) return null;
  return (smerK === 0 ? e.marker - 1 : e.marker + 1) as MarkerPos;
}

export function cenaKroku(z: MarkerPos, na: MarkerPos): number {
  const zo = STUPNICA_ZONY[z];
  const doZony = STUPNICA_ZONY[na];
  return doZony > zo ? doZony : zo + 1;
}

export function posunZaBody(e: { readonly marker: MarkerPos }, smerK: PlayerId, body: number): { readonly marker: MarkerPos; readonly cena: number; readonly kroky: number } | null {
  let marker = e.marker;
  let cena = 0;
  let kroky = 0;
  for (let d = posunMarker({ marker }, smerK); d !== null; d = posunMarker({ marker }, smerK)) {
    const c = cenaKroku(marker, d);
    if (cena + c > body) break;
    cena += c;
    marker = d;
    kroky++;
  }
  return kroky === 0 ? null : { marker, cena, kroky };
}

export function cenaPosunuOPoli(z: MarkerPos, d: number): number {
  let cena = 0;
  for (let m = z, i = 0; i < Math.abs(d); i++) {
    const na = (d < 0 ? m - 1 : m + 1) as MarkerPos;
    cena += cenaKroku(m, na);
    m = na;
  }
  return cena;
}

/** Účinná priazeň (v10 s klebetami) — v11 len z polohy. */
export function ucinnaPriazen(e: SMarkerom, _klebety?: Klebety): { readonly hrac: PlayerId | null; readonly sila: number } {
  return { hrac: priazenHraca(e), sila: priazenSila(e) };
}

export function klebetyKola(_state: unknown): Klebety | undefined {
  return undefined;
}

/** Posuny strachu zo zmien markerov v11 ako posuny polohy na starej stupnici (bez rečí). */
export function posunyZoZmien(zmeny: readonly ZmenaMarkera[], starsi: readonly Pick<ElderState, "elderId" | "strach">[]): PosunMarkera[] {
  const out: PosunMarkera[] = [];
  for (const z of zmeny) {
    if (z.marker !== "strach") continue;
    const e = starsi.find((x) => x.elderId === z.elderId);
    if (e === undefined) continue;
    const pred: [number, number] = [e.strach[0], e.strach[1]];
    pred[z.hrac] = z.z;
    const po: [number, number] = [e.strach[0], e.strach[1]];
    po[z.hrac] = z.na;
    out.push({ elderId: z.elderId, z: polohaZoStrachu(pred), na: polohaZoStrachu(po), zdroj: z.zdroj, kto: z.kto });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rozdelenie Nakladačky a hádky v starom rozhraní (klik = starší): každá voľba zdvihne marker
// staršieho tak vysoko, ako zvyšok stačí; potvrdiť sa dá len úplné rozdelenie (jadro, v11).

export interface VolbaRozdelenia {
  readonly elderId: string;
}

export interface KrokRozdelenia {
  readonly elderId: string;
  readonly smer: PlayerId;
  readonly z: MarkerPos;
  readonly na: MarkerPos;
  readonly cena: number;
  readonly body: number;
}

export interface PlanStary {
  readonly kroky: readonly KrokRozdelenia[];
  readonly nevyslo: readonly VolbaRozdelenia[];
  readonly zvysok: number;
  readonly esteSaDa: readonly string[];
  readonly prikaz: Command | null;
}

export function smerRozdelenia(view: ClientState, ja: PlayerId): PlayerId | null {
  return krokRozdelenia(view, ja) === null ? null : ja === 0 ? 1 : 0;
}

export function planRozdelenia(view: ClientState, ja: PlayerId, volby: readonly VolbaRozdelenia[]): PlanStary | null {
  const krok = krokRozdelenia(view, ja);
  if (krok === null) return null;
  const marker = markerRozdelenia(krok);
  const body = bodyRozdelenia(view, ja);
  const zdvihy: Zdvih[] = [];
  const kroky: KrokRozdelenia[] = [];
  const nevyslo: VolbaRozdelenia[] = [];
  let zvysok = body;
  for (const v of volby) {
    const e = view.starsi.find((x) => x.elderId === v.elderId);
    const od = e === undefined ? null : stupenOdkial(e, ja, marker);
    let na = od;
    while (e !== undefined && na !== null && na < 3 && cenaDvihnutia(od!, na + 1) <= zvysok && overRozdelenie(view, ja, marker, body, [...zdvihy, { elderId: v.elderId, na: (na + 1) as Stupen }]).chyba === null) na++;
    if (e === undefined || od === null || na === null || na === od) {
      nevyslo.push(v);
      continue;
    }
    const cena = cenaDvihnutia(od, na);
    zdvihy.push({ elderId: v.elderId, na: na as Stupen });
    const pred = polohaZoStrachu(e.strach);
    const po = marker === "strach" ? polohaZoStrachu(ja === 0 ? [na, e.strach[1]] : [e.strach[0], na]) : pred;
    kroky.push({ elderId: v.elderId, smer: ja === 0 ? 1 : 0, z: pred, na: po, cena, body: zvysok });
    zvysok -= cena;
  }
  const plan = overRozdelenie(view, ja, marker, body, zdvihy);
  const ok = plan.chyba === null && plan.esteSaDa.length === 0;
  return { kroky, nevyslo, zvysok: plan.zvysok, esteSaDa: plan.esteSaDa, prikaz: ok ? { type: krok, zdvihy } : null };
}

export function prepniVolbu(view: ClientState, ja: PlayerId, volby: readonly VolbaRozdelenia[], volba: VolbaRozdelenia): readonly VolbaRozdelenia[] {
  const i = volby.findIndex((v) => v.elderId === volba.elderId);
  const dalsie = i < 0 ? [...volby, { elderId: volba.elderId }] : volby.filter((_, j) => j !== i);
  const plan = planRozdelenia(view, ja, dalsie);
  return plan === null ? [] : dalsie.filter((v) => !plan.nevyslo.includes(v));
}

export function starsiPreZvysok(_view: ClientState, _ja: PlayerId, plan: PlanStary): readonly string[] {
  const vPlane = new Set(plan.kroky.map((k) => k.elderId));
  return plan.esteSaDa.filter((id) => !vPlane.has(id));
}

export function zvysokPrepadne(_view: ClientState, _ja: PlayerId, plan: PlanStary): boolean {
  return plan.zvysok > 0 && plan.esteSaDa.length === 0;
}

export function rozpocetPoPlane(view: ClientState, ja: PlayerId, plan: PlanStary, elderId: string): number {
  return polohyRozdelenia(view, ja).has(elderId) ? plan.zvysok : 0;
}

/** Starší, na ktorých sa v kroku dá dvíhať (nie v ohrození, nie na červenej), s polohou starej stupnice. */
export function polohyRozdelenia(view: ClientState, ja: PlayerId): ReadonlyMap<string, MarkerPos> {
  const krok = krokRozdelenia(view, ja);
  const out = new Map<string, MarkerPos>();
  if (krok === null) return out;
  for (const e of view.starsi) if (cenaDalsiehoStupna(e, view.pokusy, ja, markerRozdelenia(krok)) !== null) out.set(e.elderId, polohaZoStrachu(e.strach));
  return out;
}

/** Hádka (v10) posúvala priazne — v11 dvíha reči: smie, kým reči nie sú na červenej. */
export function hadkaMozna(e: Pick<ElderState, "strach" | "reci">, ja: PlayerId, _klebety?: Klebety): boolean {
  return stupenOdkial(e, ja, "reci") < 3;
}

/** Rozsah hádky a bitka po pláne (v10) — hádka v11 poškodenie nemení. */
export function rozsahHadky(..._args: readonly unknown[]): { readonly hrac: PlayerId; readonly pocet: number; readonly damage: DamageResult; readonly vysledok: BattleOutcome } | null {
  return null;
}
export function bitkaPoPlane(..._args: readonly unknown[]): { readonly pred: DamageResult; readonly po: DamageResult } | null {
  return null;
}

/** Špaky za väzňov po finále (v9) — v11 nie sú. */
export const SPAKY_ZA_VAZNOV: readonly number[] = [];

/**
 * Špaky teraz v tvare do v10 pre staré panely: „za starších“ = čo starší dajú aj pri prehre
 * (reči), „na udržanie“ = čo navyše dajú pri výhre (strach). Väzni po finále v11 nebodujú.
 */
export function spakyTeraz(view: PohladSpakov): Omit<SpakyTerazJadra, "starsi"> & {
  readonly zaStarsich: readonly [number, number];
  readonly naUdrzanie: readonly [number, number];
  readonly vazni: readonly [number, number];
  readonly vyplat: number;
  readonly odhad: readonly [number, number];
  readonly starsi: readonly (SpakyStarsiehoJadra & { readonly spaky: readonly [number, number]; readonly naUdrzanie: readonly [number, number] })[];
} {
  const t = spakyTerazJadra(view);
  return {
    ...t,
    zaStarsich: t.zaStarsichPrehra,
    naUdrzanie: [t.zaStarsichVyhra[0] - t.zaStarsichPrehra[0], t.zaStarsichVyhra[1] - t.zaStarsichPrehra[1]],
    vazni: [0, 0],
    vyplat: 1,
    odhad: t.spolu,
    starsi: t.starsi.map((x) => ({ ...x, spaky: x.prehra, naUdrzanie: [x.vyhra[0] - x.prehra[0], x.vyhra[1] - x.prehra[1]] as const })),
  };
}

/** Väzni na výhru pre panely bez pohľadu (Druhá liga) — v11 závisia od ligy (vazniNaVyhru). */
export const VAZNI_NA_VYHRU_ZOBRAZENIE = vazniNaVyhru(DLZKY_HRY.stredna);
export type SpakyTeraz = ReturnType<typeof spakyTeraz>;
export type SpakyStarsieho = SpakyTeraz["starsi"][number];
