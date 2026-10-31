// Súhrn posunov starších pred výberom lokality (Michal 2026-10-30, mock 5 „Bublina pri dlaždici“;
// interview 2026-10-31). Čo sa v kole stalo so staršími, vidia obaja hráči rovnako: každý
// pohnutý starší má jednu bublinu so stupnicou pred → po (bez krokov a zdrojov), nepohnutý
// len keď na konci kola vyplatil udržaný strach alebo naň padla Povera; úspešné zajatie je
// bublina „uväznený“ namiesto samostatného okna. Bez Reactu, aby sa obsah dal otestovať.
//
// Kolo sa porovnáva po stavoch, nie po zázname posunov: stopa posunov (posunyMarkerov) sa
// maže na začiatku každej Pitky, takže v kole s viac Pitkami by Kšefty z prvej chýbali.

import type { BitkaNaNastenke, ClientState, ElderState, MarkerPos, PlayerId, Vazen } from "@naex/core";
import { STUPNICA_ZONY, obavanyHrac, pokusMozny, priazenHraca, priazenSila, strachNaVyplatu, strachZ } from "@naex/core";

/** Starší a väzni na začiatku kola — prvý pohľad kola je pri voľbe cieľa, keď sa ešte nič nepohlo. */
export interface ZaciatokKola {
  readonly kolo: number;
  readonly starsi: readonly Pick<ElderState, "elderId" | "marker" | "karta">[];
  /** Starší, ktorí už boli väzňami. */
  readonly vazni: readonly string[];
}

export function zaciatokKola(view: Pick<ClientState, "kolo" | "starsi" | "vazni">): ZaciatokKola {
  return {
    kolo: view.kolo,
    starsi: view.starsi.map((e) => ({ elderId: e.elderId, marker: e.marker, karta: e.karta })),
    vazni: view.vazni.map((v) => v.elderId),
  };
}

export interface PolozkaSuhrnu {
  readonly elderId: string;
  /** Karta na ukazovateli (meno a portrét; aj náhrada bossa). */
  readonly defId: string;
  /** Stupnica pred → po; null, keď sa marker nepohol (len výplata či Povera) alebo starší je väzeň. */
  readonly posun: { readonly z: MarkerPos; readonly na: MarkerPos } | null;
  /** Starší po kole — z neho sú dôsledky (priazeň, strach, špaky na udržanie); väzeň null. */
  readonly elder: ElderState | null;
  /** Udržaný strach, ktorý starší na konci kola zaplatil (špaky). */
  readonly vyplata: readonly { readonly hrac: PlayerId; readonly spaky: number; readonly stupen: number }[];
  /** Povery bitky: koľko stupňov priazne si ktorý hráč na tomto staršom požičal. */
  readonly povery: readonly { readonly hrac: PlayerId; readonly stupne: number }[];
  /** Úspešné zajatie v kroku 6d. */
  readonly vazen: Pick<Vazen, "hrac" | "poradie"> | null;
}

/**
 * Obsah súhrnu kola v poradí stĺpčekov dlaždice Starší (poradie starších na začiatku kola).
 * Prázdny zoznam = v kole sa nič nestalo a súhrn sa preskočí.
 */
export function suhrnPosunov(
  pred: ZaciatokKola,
  po: Pick<ClientState, "starsi" | "vazni" | "nastenka">,
): readonly PolozkaSuhrnu[] {
  const bitka: BitkaNaNastenke | undefined = po.nastenka.find((b) => b.kolo === pred.kolo);
  // Stupeň výplaty: udržaný je ten, ktorý marker držal od začiatku kola a neustúpil z neho.
  const vyplata = (elderId: string, z: MarkerPos, na: MarkerPos): PolozkaSuhrnu["vyplata"] =>
    ([0, 1] as const).flatMap((hrac) => {
      const spaky = (bitka?.zaStarsichRozpis?.[hrac] ?? []).filter((x) => x.elderId === elderId).reduce((a, x) => a + x.spaky, 0);
      return spaky > 0 ? [{ hrac, spaky, stupen: Math.min(STUPNICA_ZONY[z], STUPNICA_ZONY[na]) }] : [];
    });
  const povery = (elderId: string): PolozkaSuhrnu["povery"] =>
    ([0, 1] as const).flatMap((hrac) => {
      const stupne = Math.abs(bitka?.povery?.[hrac][elderId] ?? 0);
      return stupne > 0 ? [{ hrac, stupne }] : [];
    });
  const out: PolozkaSuhrnu[] = [];
  const videni = new Set<string>();
  for (const a of pred.starsi) {
    videni.add(a.elderId);
    const e = po.starsi.find((x) => x.elderId === a.elderId);
    if (e === undefined) {
      const v = pred.vazni.includes(a.elderId) ? undefined : po.vazni.find((x) => x.elderId === a.elderId);
      if (v === undefined) continue;
      out.push({ elderId: a.elderId, defId: v.karta.defId, posun: null, elder: null, vyplata: vyplata(a.elderId, a.marker, a.marker), povery: povery(a.elderId), vazen: { hrac: v.hrac, poradie: v.poradie } });
      continue;
    }
    const polozka = polozkaStarsieho(a.marker, e, vyplata(e.elderId, a.marker, e.marker), povery(e.elderId));
    if (polozka !== null) out.push(polozka);
  }
  // Starší, ktorý na začiatku kola nebol na stupnici (zatiaľ ho nič nepridáva), ide na koniec.
  for (const e of po.starsi) {
    if (videni.has(e.elderId)) continue;
    const polozka = polozkaStarsieho(e.marker, e, vyplata(e.elderId, e.marker, e.marker), povery(e.elderId));
    if (polozka !== null) out.push(polozka);
  }
  return out;
}

function polozkaStarsieho(z: MarkerPos, e: ElderState, vyplata: PolozkaSuhrnu["vyplata"], povery: PolozkaSuhrnu["povery"]): PolozkaSuhrnu | null {
  // Tam a späť (Michal 2026-10-31) je ako nepohnutý.
  const posun = z === e.marker ? null : { z, na: e.marker };
  if (posun === null && vyplata.length === 0 && povery.length === 0) return null;
  return { elderId: e.elderId, defId: e.karta.defId, posun, elder: e, vyplata, povery, vazen: null };
}

/** Dôsledok v bubline — len ikony a čísla, žiadny verdikt (Michal 2026-10-31). */
export type Dosledok =
  /** Priazeň staršieho po kole: komu a akej sily; `bolo` = sila pred posunom u toho istého hráča. */
  | { readonly druh: "priazen"; readonly hrac: PlayerId; readonly sila: number; readonly bolo: number | null }
  /** Priazeň, o ktorú hráč posunom prišiel (preškrtnutá). */
  | { readonly druh: "strataPriazne"; readonly hrac: PlayerId; readonly sila: number }
  /** Koho sa starší bojí a na akom stupni. */
  | { readonly druh: "strach"; readonly hrac: PlayerId; readonly stupen: number }
  /** Špaky, ktoré zaplatí koniec ďalšieho kola, ak sa marker udrží. */
  | { readonly druh: "naUdrzanie"; readonly hrac: PlayerId; readonly spaky: number }
  /** Stupeň 3: obávaný ho smie po šenku skúsiť zajať. */
  | { readonly druh: "zajatieMozne"; readonly hrac: PlayerId }
  | { readonly druh: "vyplata"; readonly hrac: PlayerId; readonly spaky: number; readonly stupen: number }
  | { readonly druh: "povera"; readonly hrac: PlayerId; readonly stupne: number }
  | { readonly druh: "vazen"; readonly hrac: PlayerId; readonly poradie: number };

export function dosledky(p: PolozkaSuhrnu): readonly Dosledok[] {
  const out: Dosledok[] = [];
  if (p.vazen !== null) out.push({ druh: "vazen", hrac: p.vazen.hrac, poradie: p.vazen.poradie });
  const e = p.elder;
  if (e !== null && p.posun !== null) {
    const pred = { marker: p.posun.z };
    const kto = priazenHraca(e);
    const ktoPred = priazenHraca(pred);
    if (ktoPred !== null && ktoPred !== kto) out.push({ druh: "strataPriazne", hrac: ktoPred, sila: priazenSila(pred) });
    if (kto !== null) out.push({ druh: "priazen", hrac: kto, sila: priazenSila(e), bolo: ktoPred === kto ? priazenSila(pred) : null });
    const obava = obavanyHrac(e);
    if (obava !== null) {
      out.push({ druh: "strach", hrac: obava, stupen: strachZ(e, obava) });
      // Na začiatku kola sú stupne už „držané“ — zaplatí ich koniec tohto (pre hráča ďalšieho) kola.
      const spaky = strachNaVyplatu(e, obava);
      if (spaky > 0) out.push({ druh: "naUdrzanie", hrac: obava, spaky });
      if (pokusMozny(e, obava)) out.push({ druh: "zajatieMozne", hrac: obava });
    }
  }
  for (const v of p.vyplata) out.push({ druh: "vyplata", hrac: v.hrac, spaky: v.spaky, stupen: v.stupen });
  for (const v of p.povery) out.push({ druh: "povera", hrac: v.hrac, stupne: v.stupne });
  return out;
}
