// Body za starších (pravidlá v5, návrh Michala 2026-10-24, docs/pravidla-v5/davka.md):
// pri každom staršom je každá aktívna podmienka súboj hráčov — kto ich vyhrá viac,
// tomu dá starší body (1 + zóny strachu, v ktorých sa ho bojí; s priazňou či v strede 1),
// pri rovnosti obom. Z bodyTeraz, spoločné pre línie starších, bodový bar, koniec hry
// a krčmový účet. Do v4 sa bodovalo za kusy — staré partie číta KrcmovyUcet po starom.

import type { BodPodmienky, BodyStarsieho, BodyTeraz, ElderState, Podmienka, PlayerId } from "@naex/core";
import { priazenHraca, strachZ, urovenPodmienky } from "@naex/core";

export const PORADIE_PODMIENOK: readonly Podmienka[] = ["lokality", "starsi", "cigarety", "rezerva", "znepokojenie", "strach", "vydesenie", "dlh", "cirhoza", "abstak"];

/** Čo sa v súboji podmienky porovnáva — prvý riadok nápovedy. */
export const ZA_CO: Readonly<Record<Podmienka, string>> = {
  lokality: "Vyhrá, kto ovláda viac lokalít (vyhraté bitky o lokalitu).",
  starsi: "Vyhrá, kto má viac starších získaných patronátom.",
  cigarety: "Vyhrá, kto má na konci viac cigariet.",
  znepokojenie: "Vyhrá, koho sa aspoň v žltej zóne bojí viac OSTATNÝCH starších (tento sa neráta).",
  strach: "Vyhrá, koho sa aspoň v oranžovej zóne bojí viac OSTATNÝCH starších (tento sa neráta).",
  vydesenie: "Vyhrá, kto vydesil viac OSTATNÝCH starších (červená krajná pozícia).",
  dlh: "Vyhrá, kto má menej Dlhov — aj priznaných. Zbavíš sa ich pálením v bitke a kartami (Dievčina, Robota, Stryná…).",
  cirhoza: "Vyhrá, kto má menej nepriznaných Cirhóz v ruke a v balíčkoch.",
  abstak: "Vyhrá, kto za celú hru získal menej Absťákov — zbavením sa Absťáku neubudnú.",
  rezerva: "Vyhrá, kto má na konci viac plných poldeci; Vínko v Dedičstve sa ráta ako plný.",
};

/** Jednotka hodnoty v súboji: zónové podmienky rátajú starších, ostatné kusy. */
export function jednotka(podmienka: Podmienka, n: number): string {
  if (urovenPodmienky(podmienka) !== null) return n === 1 ? "starší" : "starších";
  return "ks";
}

/** Súboj jednej aktívnej podmienky pri staršom. */
export interface SubojPodmienky {
  readonly kluc: string;
  readonly podmienka: Podmienka;
  readonly strana: BodPodmienky["strana"];
  readonly index: BodPodmienky["index"];
  /** Hodnota hráča 0 a 1 (lokality, cigarety, ostatní starší, ktorí sa boja…). */
  readonly hodnoty: readonly [number, number];
  /** Kto súboj vyhráva; null = rovnosť, nevyhrá nikto. */
  readonly vitaz: PlayerId | null;
}

/** Súboje staršieho v poradí scorecardu — polozky oboch hráčov idú v tom istom poradí. */
export function subojeStarsieho(s: BodyStarsieho): SubojPodmienky[] {
  return s.polozky[0].map((a, i) => {
    const b = s.polozky[1][i];
    const vitaz: PlayerId | null = a.body > 0 ? 0 : (b?.body ?? 0) > 0 ? 1 : null;
    return { kluc: `${s.elderId}/${a.strana}/${a.index}`, podmienka: a.podmienka, strana: a.strana, index: a.index, hodnoty: [a.kusy, b?.kusy ?? 0], vitaz };
  });
}

/** Kto body za staršieho teraz dostane: jeden hráč, „obaja“ (rovnosť súbojov), alebo nikto. */
export function kohoBoduje(s: BodyStarsieho): PlayerId | "obaja" | null {
  const [a, b] = s.body;
  if (a > 0 && b > 0) return "obaja";
  if (a > 0) return 0;
  if (b > 0) return 1;
  return null;
}

/** Prečo hráč p dostane za staršieho práve toľko: „1 + 2 za strach“, „1 (priazeň)“, „1 (stred)“. */
export function preco(elder: ElderState, p: PlayerId): string {
  const z = strachZ(elder, p);
  if (z > 0) return `1 + ${z} za strach`;
  return priazenHraca(elder) === p ? "1, má jeho priazeň" : "1, marker v strede";
}

/** Bodovanie v5 má pri každom staršom aj počty vyhratých súbojov — staré partie (v4) nie. */
export function jeBodovanieV5(body: BodyTeraz): boolean {
  return body.starsi.every((s) => (s as Partial<BodyStarsieho>).vyhry !== undefined);
}

/** Súboje jednej podmienky naprieč staršími — pre bodový bar. */
export interface SubojeTypu {
  readonly podmienka: Podmienka;
  /** Koľko súbojov tejto podmienky vyhráva hráč 0 a 1 (zvyšok je rovnosť). */
  readonly vyhry: readonly [number, number];
  readonly pocet: number;
  /** Hodnota hráčov — rovnaká pri každom staršom (okrem zónových, tam sa nepočíta ten starší). */
  readonly hodnoty: readonly [number, number];
  readonly starsi: readonly { readonly elderId: string; readonly suboj: SubojPodmienky }[];
}

/** Súboje podľa podmienky v poradí PORADIE_PODMIENOK; podmienka, ktorá nie je aktívna nikde, chýba. */
export function subojePoPodmienkach(body: BodyTeraz): Map<Podmienka, SubojeTypu> {
  const out = new Map<Podmienka, { podmienka: Podmienka; vyhry: [number, number]; pocet: number; hodnoty: [number, number]; starsi: { elderId: string; suboj: SubojPodmienky }[] }>();
  for (const s of body.starsi) {
    for (const suboj of subojeStarsieho(s)) {
      const m = out.get(suboj.podmienka) ?? { podmienka: suboj.podmienka, vyhry: [0, 0], pocet: 0, hodnoty: [0, 0], starsi: [] };
      m.pocet++;
      if (suboj.vitaz !== null) m.vyhry[suboj.vitaz]++;
      m.hodnoty = [Math.max(m.hodnoty[0], suboj.hodnoty[0]), Math.max(m.hodnoty[1], suboj.hodnoty[1])];
      m.starsi.push({ elderId: s.elderId, suboj });
      out.set(suboj.podmienka, m);
    }
  }
  return new Map(PORADIE_PODMIENOK.flatMap((p) => {
    const m = out.get(p);
    return m === undefined ? [] : [[p, m] as const];
  }));
}

// ---- do v4: body za kusy (krčmový účet starých partií) ------------------------------

/** Starší a pozícia podmienky na jeho scorecarde — tá istá podmienka môže byť aktívna dvakrát. */
export interface ZdrojPodmienky {
  readonly kluc: string;
  readonly elderId: string;
  readonly polozky: readonly [BodPodmienky | null, BodPodmienky | null];
}

export interface BodyPodmienky {
  readonly podmienka: Podmienka;
  readonly body: readonly [number, number];
  readonly kusy: readonly [number, number];
  /** Scorecardy, na ktorých je podmienka aktívna, a čo z nich má každý hráč. */
  readonly zdroje: readonly ZdrojPodmienky[];
}

/** Súčty po podmienkach (bodovanie v4) v poradí PORADIE_PODMIENOK; podmienka, ktorá nie je aktívna nikde, chýba. */
export function bodyPoPodmienkach(body: BodyTeraz): Map<Podmienka, BodyPodmienky> {
  const out = new Map<Podmienka, { podmienka: Podmienka; body: [number, number]; kusy: [number, number]; zdroje: ZdrojPodmienky[] }>();
  for (const s of body.starsi) {
    for (const p of [0, 1] as const) {
      for (const pol of s.polozky[p]) {
        const m = out.get(pol.podmienka) ?? { podmienka: pol.podmienka, body: [0, 0], kusy: [0, 0], zdroje: [] };
        m.body[p] += pol.body;
        // Kusy sú pre hráča rovnaké na každom scorecarde (lokality, strach…) — stačí najväčší.
        m.kusy[p] = Math.max(m.kusy[p], pol.kusy);
        const kluc = `${s.elderId}/${pol.strana}/${pol.index}`;
        const i = m.zdroje.findIndex((z) => z.kluc === kluc);
        const zdroj = m.zdroje[i];
        if (zdroj === undefined) m.zdroje.push({ kluc, elderId: s.elderId, polozky: p === 0 ? [pol, null] : [null, pol] });
        else m.zdroje[i] = { ...zdroj, polozky: p === 0 ? [pol, zdroj.polozky[1]] : [zdroj.polozky[0], pol] };
        out.set(pol.podmienka, m);
      }
    }
  }
  return new Map(PORADIE_PODMIENOK.flatMap((p) => {
    const m = out.get(p);
    return m === undefined ? [] : [[p, m] as const];
  }));
}
