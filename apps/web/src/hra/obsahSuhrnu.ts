// Súhrn kola pri starších pred výberom lokality (Michal 2026-10-30, mock 5 „Bublina pri dlaždici“;
// interview 2026-10-31; v11 Strach a reči 2026-11-02). Čo sa v kole stalo so staršími, vidia obaja
// hráči rovnako: každý starší, ktorému sa zmenil strach či reči, má jednu bublinu s teplomermi
// pred → po; nezmenený len keď po bitke bodoval; úspešné zajatie je bublina „uväznený“.
// Bez Reactu, aby sa obsah dal otestovať.
//
// Kolo sa porovnáva po stavoch, nie po zázname zmien: zmeny markerov sa mažú na začiatku
// každej Pitky, takže v kole s viac Pitkami by Kšefty z prvej chýbali.

import type { BitkaNaNastenke, ClientState, ElderState, PlayerId, Stupen, Vazen } from "@naex/core";
import { pokusMozny, priazenHraca, priazenSila } from "@naex/core";

type Markery = Pick<ElderState, "strach" | "reci">;

/** Starší a väzni na začiatku kola — prvý pohľad kola je pri voľbe cieľa, keď sa ešte nič nepohlo. */
export interface ZaciatokKola {
  readonly kolo: number;
  readonly starsi: readonly ({ readonly elderId: string; readonly karta: ElderState["karta"] } & Markery)[];
  /** Starší, ktorí už boli väzňami. */
  readonly vazni: readonly string[];
}

export function zaciatokKola(view: Pick<ClientState, "kolo" | "starsi" | "vazni">): ZaciatokKola {
  return {
    kolo: view.kolo,
    starsi: view.starsi.map((e) => ({ elderId: e.elderId, karta: e.karta, strach: e.strach, reci: e.reci })),
    vazni: view.vazni.map((v) => v.elderId),
  };
}

export interface PolozkaSuhrnu {
  readonly elderId: string;
  /** Karta na ukazovateli (meno a portrét; aj náhrada bossa). */
  readonly defId: string;
  /** Strach a reči na začiatku kola. */
  readonly pred: Markery;
  /** Starší po kole — z neho sú dôsledky (priazeň, strach, reči); väzeň null. */
  readonly elder: ElderState | null;
  /** Markery sa v kole zmenili (inak len bodovanie). */
  readonly zmena: boolean;
  /** Špaky, ktoré starší po bitke dal (bodovanie, v11): za reči alebo za strach. */
  readonly vyplata: readonly { readonly hrac: PlayerId; readonly spaky: number; readonly reci: boolean }[];
  /** Úspešné zajatie v kroku 6d. */
  readonly vazen: Pick<Vazen, "hrac" | "poradie"> | null;
}

const rovnake = (a: Markery, b: Markery): boolean => a.strach[0] === b.strach[0] && a.strach[1] === b.strach[1] && a.reci[0] === b.reci[0] && a.reci[1] === b.reci[1];

/**
 * Obsah súhrnu kola v poradí stĺpčekov dlaždice Starší (poradie starších na začiatku kola).
 * Prázdny zoznam = v kole sa nič nestalo a súhrn sa preskočí.
 */
export function suhrnPosunov(pred: ZaciatokKola, po: Pick<ClientState, "starsi" | "vazni" | "nastenka">): readonly PolozkaSuhrnu[] {
  const bitka: BitkaNaNastenke | undefined = po.nastenka.find((b) => b.kolo === pred.kolo);
  const vyplata = (elderId: string): PolozkaSuhrnu["vyplata"] =>
    ([0, 1] as const).flatMap((hrac) => {
      const xs = (bitka?.zaStarsichRozpis?.[hrac] ?? []).filter((x) => x.elderId === elderId);
      const spaky = xs.reduce((a, x) => a + x.spaky, 0);
      return spaky > 0 ? [{ hrac, spaky, reci: xs.some((x) => x.reci === true) }] : [];
    });
  const out: PolozkaSuhrnu[] = [];
  const videni = new Set<string>();
  for (const a of pred.starsi) {
    videni.add(a.elderId);
    const e = po.starsi.find((x) => x.elderId === a.elderId);
    if (e === undefined) {
      const v = pred.vazni.includes(a.elderId) ? undefined : po.vazni.find((x) => x.elderId === a.elderId);
      if (v === undefined) continue;
      out.push({ elderId: a.elderId, defId: v.karta.defId, pred: a, elder: null, zmena: true, vyplata: vyplata(a.elderId), vazen: { hrac: v.hrac, poradie: v.poradie } });
      continue;
    }
    const polozka = polozkaStarsieho(a, e, vyplata(e.elderId));
    if (polozka !== null) out.push(polozka);
  }
  // Starší, ktorý na začiatku kola nebol na stupnici (zatiaľ ho nič nepridáva), ide na koniec.
  for (const e of po.starsi) {
    if (videni.has(e.elderId)) continue;
    const polozka = polozkaStarsieho(e, e, vyplata(e.elderId));
    if (polozka !== null) out.push(polozka);
  }
  return out;
}

function polozkaStarsieho(pred: Markery, e: ElderState, vyplata: PolozkaSuhrnu["vyplata"]): PolozkaSuhrnu | null {
  // Tam a späť (Michal 2026-10-31) je ako nezmenený.
  const zmena = !rovnake(pred, e);
  if (!zmena && vyplata.length === 0) return null;
  return { elderId: e.elderId, defId: e.karta.defId, pred: { strach: pred.strach, reci: pred.reci }, elder: e, zmena, vyplata, vazen: null };
}

/** Dôsledok v bubline — len ikony a čísla, žiadny verdikt (Michal 2026-10-31). */
export type Dosledok =
  /** Priazeň staršieho po kole: komu a akej sily; `bolo` = sila pred kolom u toho istého hráča. */
  | { readonly druh: "priazen"; readonly hrac: PlayerId; readonly sila: number; readonly bolo: number | null }
  /** Priazeň, o ktorú hráč v kole prišiel (preškrtnutá). */
  | { readonly druh: "strataPriazne"; readonly hrac: PlayerId; readonly sila: number }
  /** Strach hráča sa zmenil (z → na). */
  | { readonly druh: "strach"; readonly hrac: PlayerId; readonly z: Stupen; readonly na: Stupen }
  /** Reči hráča sa zmenili (z → na; 0 = zanikli). */
  | { readonly druh: "reci"; readonly hrac: PlayerId; readonly z: Stupen; readonly na: Stupen }
  /** Strach na červenej: hráč ho smie pred šenkom skúsiť zajať. */
  | { readonly druh: "zajatieMozne"; readonly hrac: PlayerId }
  /** Bodovanie po bitke: špaky za reči alebo za strach. */
  | { readonly druh: "vyplata"; readonly hrac: PlayerId; readonly spaky: number; readonly reci: boolean }
  | { readonly druh: "vazen"; readonly hrac: PlayerId; readonly poradie: number };

export function dosledky(p: PolozkaSuhrnu): readonly Dosledok[] {
  const out: Dosledok[] = [];
  if (p.vazen !== null) out.push({ druh: "vazen", hrac: p.vazen.hrac, poradie: p.vazen.poradie });
  const e = p.elder;
  if (e !== null && p.zmena) {
    const kto = priazenHraca(e);
    const ktoPred = priazenHraca(p.pred);
    if (ktoPred !== null && ktoPred !== kto) out.push({ druh: "strataPriazne", hrac: ktoPred, sila: priazenSila(p.pred) });
    if (kto !== null && (ktoPred !== kto || priazenSila(p.pred) !== priazenSila(e))) out.push({ druh: "priazen", hrac: kto, sila: priazenSila(e), bolo: ktoPred === kto ? priazenSila(p.pred) : null });
    for (const h of [0, 1] as const) {
      if (p.pred.strach[h] !== e.strach[h]) out.push({ druh: "strach", hrac: h, z: p.pred.strach[h], na: e.strach[h] });
      if (p.pred.reci[h] !== e.reci[h]) out.push({ druh: "reci", hrac: h, z: p.pred.reci[h], na: e.reci[h] });
      if (p.pred.strach[h] < 3 && pokusMozny(e, h)) out.push({ druh: "zajatieMozne", hrac: h });
    }
  }
  for (const v of p.vyplata) out.push({ druh: "vyplata", hrac: v.hrac, spaky: v.spaky, reci: v.reci });
  return out;
}
