// Rozdelenie Nakladačky a hádky (v11 Strach a reči, Michal 2026-11-02): víťaz bitky rozdelí
// body Nakladačky na svoj strach, víťaz hádky body hádky na svoje reči — ľubovoľne medzi
// starších, stupeň za 1 / 2 / 3 (cenaDvihnutia). Rozdelí sa, čo sa dá, zvyšok prepadne:
// po rozdelení nesmie ostať zvyšok, ktorý by ešte stačil na ďalší stupeň niektorého staršieho.
// Na staršieho v ohrození (pokus o zajatie) nikto nedvíha (O7).
//
// Klient drží rozpracované zdvihy a pošle ich jedným zámerom ({ type: "prebytok" | "reci",
// zdvihy }); server ich overí tou istou funkciou (overRozdelenie), takže náhľad v klientovi
// (cena, zvyšok, chyba) ukáže presne to, čo server prijme.

import type { BitkaKrok, Command, PokusOZajatie } from "./engine.ts";
import type { DruhMarkera, ElderState, Stupen, Zdvih } from "./elders.ts";
import { CERVENA, cenaDvihnutia, moznyZdvih, sMarkerom, stupenOdkial } from "./elders.ts";
import type { PlayerId } from "./types.ts";

/** Čo rozdelenie potrebuje zo stavu — ClientState aj GameState. */
export interface StavRozdelenia {
  /** Pokusy o zajatie tohto kola (v9) — na staršieho v ohrození sa nedvíha. */
  readonly pokusy: readonly (PokusOZajatie | null)[];
  readonly starsi: readonly Pick<ElderState, "elderId" | "strach" | "reci">[];
  readonly bitkaStav: {
    readonly krok: BitkaKrok | null;
    readonly caka: PlayerId | null;
    readonly prebytokDrzi: PlayerId | null;
    readonly prebytokZostava: number;
    readonly hadka?: { readonly vitaz: PlayerId | null; readonly zostava: number };
  } | null;
}

/** Krok bitky, v ktorom sa rozdeľuje: prebytok = Nakladačka na strach, reci = hádka na reči. */
export type DruhRozdelenia = "prebytok" | "reci";

/** Marker, ktorý krok dvíha. */
export function markerRozdelenia(krok: DruhRozdelenia): DruhMarkera {
  return krok === "prebytok" ? "strach" : "reci";
}

/** Krok, v ktorom hráč p práve rozdeľuje, alebo null. */
export function krokRozdelenia(state: Pick<StavRozdelenia, "bitkaStav">, p: PlayerId): DruhRozdelenia | null {
  const b = state.bitkaStav;
  if (b === null || b.caka !== p) return null;
  if (b.krok === "prebytok" && b.prebytokDrzi === p && b.prebytokZostava > 0) return "prebytok";
  if (b.krok === "reci" && b.hadka?.vitaz === p && b.hadka.zostava > 0) return "reci";
  return null;
}

/** Body na rozdelenie v kroku (Nakladačka alebo hádka). */
export function bodyRozdelenia(state: Pick<StavRozdelenia, "bitkaStav">, p: PlayerId): number {
  const krok = krokRozdelenia(state, p);
  const b = state.bitkaStav;
  if (krok === null || b === null) return 0;
  return krok === "prebytok" ? b.prebytokZostava : (b.hadka?.zostava ?? 0);
}

/** Je starší v ohrození — pokúša sa ho niekto zajať (v tom kole naň nikto nedvíha)? */
function vOhrozeniPokusov(pokusy: readonly (PokusOZajatie | null)[], elderId: string): boolean {
  return pokusy.some((x) => x?.elderId === elderId);
}

/** Cena ďalšieho stupňa markera hráča p pri staršom, alebo null (červená, v ohrození). */
export function cenaDalsiehoStupna(
  elder: Pick<ElderState, "elderId" | "strach" | "reci">,
  pokusy: readonly (PokusOZajatie | null)[],
  p: PlayerId,
  marker: DruhMarkera,
): number | null {
  if (vOhrozeniPokusov(pokusy, elder.elderId)) return null;
  const z = moznyZdvih(elder, p, marker);
  return z === null ? null : cenaDvihnutia(z.od, z.od + 1);
}

/** Overené rozdelenie: čo sa zmení a koľko prepadne. */
export interface PlanRozdelenia {
  readonly marker: DruhMarkera;
  readonly body: number;
  /** Zdvihy so stupňom odkiaľ a cenou, v poradí zámeru. */
  readonly zdvihy: readonly { readonly elderId: string; readonly z: Stupen; readonly na: Stupen; readonly cena: number }[];
  readonly cena: number;
  /** Body, ktoré po rozdelení ostanú a prepadnú. */
  readonly zvysok: number;
  /**
   * Starší, na ktorých by zvyšok ešte stačil (ďalší stupeň). Prázdne = rozdelenie je úplné
   * a server ho prijme; inak ho odmietne („rozdelí sa, čo sa dá“).
   */
  readonly esteSaDa: readonly string[];
  /** Chyba zámeru (neznámy starší, v ohrození, nie nad markerom, cena nad body) — server odmietne. */
  readonly chyba: string | null;
}

/**
 * Overí rozdelenie `zdvihy` bodov `body` na marker hráča p (server aj náhľad klienta). Každý
 * starší najviac raz, na stupeň vyšší, ako je teraz (reči nad strachom), nie v ohrození;
 * cena spolu najviac body; po rozdelení zvyšok nesmie stačiť na ďalší stupeň.
 */
export function overRozdelenie(
  state: Pick<StavRozdelenia, "pokusy" | "starsi">,
  p: PlayerId,
  marker: DruhMarkera,
  body: number,
  zdvihy: readonly Zdvih[],
): PlanRozdelenia {
  const vysledok: { elderId: string; z: Stupen; na: Stupen; cena: number }[] = [];
  let chyba: string | null = null;
  const videne = new Set<string>();
  let cena = 0;
  for (const zd of zdvihy) {
    const elder = state.starsi.find((e) => e.elderId === zd.elderId);
    if (elder === undefined) {
      chyba ??= "Taký starší na stupnici nie je.";
      continue;
    }
    if (videne.has(zd.elderId)) {
      chyba ??= "Každého staršieho uveď v rozdelení najviac raz.";
      continue;
    }
    videne.add(zd.elderId);
    if (vOhrozeniPokusov(state.pokusy, zd.elderId)) {
      chyba ??= "O tohto staršieho sa hrá (pokus o zajatie) — v tomto kole naň nikto nedvíha.";
      continue;
    }
    const z = stupenOdkial(elder, p, marker);
    if (!Number.isInteger(zd.na) || zd.na <= z || zd.na > CERVENA) {
      chyba ??= marker === "reci" ? "Reči idú len nad tvoj strach a najvyššie na červenú." : "Strach sa dá len zdvihnúť, najvyššie na červenú.";
      continue;
    }
    const c = cenaDvihnutia(z, zd.na);
    cena += c;
    vysledok.push({ elderId: zd.elderId, z, na: zd.na, cena: c });
  }
  if (chyba === null && cena > body) chyba = `Rozdelenie stojí ${cena}, máš len ${body}.`;
  const zvysok = Math.max(0, body - cena);
  const po = state.starsi.map((e) => {
    const zd = vysledok.find((x) => x.elderId === e.elderId);
    return zd === undefined ? e : sMarkerom(e, p, marker, zd.na);
  });
  const esteSaDa = po.filter((e) => {
    const c = cenaDalsiehoStupna(e, state.pokusy, p, marker);
    return c !== null && c <= zvysok;
  }).map((e) => e.elderId);
  return { marker, body, zdvihy: vysledok, cena, zvysok, esteSaDa, chyba };
}

/** Plán rozdelenia z pohľadu hráča p v práve čakajúcom kroku (null = p nerozdeľuje). */
export function planRozdelenia(state: StavRozdelenia, p: PlayerId, zdvihy: readonly Zdvih[]): (PlanRozdelenia & { readonly prikaz: Command | null }) | null {
  const krok = krokRozdelenia(state, p);
  if (krok === null) return null;
  const plan = overRozdelenie(state, p, markerRozdelenia(krok), bodyRozdelenia(state, p), zdvihy);
  const ok = plan.chyba === null && plan.esteSaDa.length === 0;
  return { ...plan, prikaz: ok ? { type: krok, zdvihy: plan.zdvihy.map((z) => ({ elderId: z.elderId, na: z.na })) } : null };
}

/** Dá sa body vôbec niekam minúť (aspoň jeden stupeň niektorého staršieho)? */
export function rozdelenieMozne(state: Pick<StavRozdelenia, "pokusy" | "starsi">, p: PlayerId, marker: DruhMarkera, body: number): boolean {
  return overRozdelenie(state, p, marker, body, []).esteSaDa.length > 0;
}

/**
 * Úplné rozdelenia (žiadny zvyšok, ktorý by ešte niekam stačil) — ponuka legálnych zámerov
 * pre bota a testy, najviac `limit`. Prehľadáva starších postupne od každého z nich (inak by
 * ponuka zvýhodnila prvých na stupnici); rovnaké rozdelenie sa neopakuje.
 */
export function kandidatiRozdelenia(
  state: Pick<StavRozdelenia, "pokusy" | "starsi">,
  p: PlayerId,
  marker: DruhMarkera,
  body: number,
  limit = 48,
): readonly (readonly Zdvih[])[] {
  const volni = state.starsi.filter((e) => cenaDalsiehoStupna(e, state.pokusy, p, marker) !== null);
  if (volni.length === 0) return [];
  const out: Zdvih[][] = [];
  const kluce = new Set<string>();
  const naZaciatok = Math.max(1, Math.ceil(limit / volni.length));
  for (let r = 0; r < volni.length && out.length < limit; r++) {
    const poradie = [...volni.slice(r), ...volni.slice(0, r)];
    // Koľko sa ešte dá minúť na starších od i-teho ďalej — vetva, ktorej zvyšok by aj tak
    // stačil na ďalší stupeň už prejdeného staršieho, sa nedoprehľadáva.
    const kapacita = poradie.map((e) => cenaDvihnutia(stupenOdkial(e, p, marker), CERVENA));
    for (let i = kapacita.length - 2; i >= 0; i--) kapacita[i]! += kapacita[i + 1]!;
    const zdvihy: Zdvih[] = [];
    let pridane = 0;
    const skus = (i: number, zostava: number, najlacnejsiDalsi: number): void => {
      if (pridane >= naZaciatok || out.length >= limit) return;
      if (zostava - (kapacita[i] ?? 0) >= najlacnejsiDalsi) return;
      if (i === poradie.length) {
        if (zdvihy.length === 0 || overRozdelenie(state, p, marker, body, zdvihy).esteSaDa.length > 0) return;
        const kluc = [...zdvihy].map((z) => `${z.elderId}:${z.na}`).sort().join(",");
        if (kluce.has(kluc)) return;
        kluce.add(kluc);
        out.push([...zdvihy]);
        pridane++;
        return;
      }
      const e = poradie[i]!;
      const od = stupenOdkial(e, p, marker);
      const dalsi = (na: number): number => (na >= CERVENA ? Number.POSITIVE_INFINITY : cenaDvihnutia(na, na + 1));
      // Vyššie stupne najprv — sústredené rozdelenia prídu na rad skôr než rozdrobené.
      for (let na = CERVENA as number; na > od; na--) {
        const c = cenaDvihnutia(od, na);
        if (c > zostava) continue;
        zdvihy.push({ elderId: e.elderId, na: na as Stupen });
        skus(i + 1, zostava - c, Math.min(najlacnejsiDalsi, dalsi(na)));
        zdvihy.pop();
      }
      skus(i + 1, zostava, Math.min(najlacnejsiDalsi, dalsi(od)));
    };
    skus(0, body, Number.POSITIVE_INFINITY);
  }
  return out;
}
