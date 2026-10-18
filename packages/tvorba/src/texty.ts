// Kontrola textov efektov pred zverejnením: spúšťač, interpunkcia, chýbajúca
// diakritika v herných pojmoch a zmenený text efektu, ktorý hra vyhodnocuje
// kódom (zmena textu nezmení správanie — treba upraviť aj jadro).

import { ALL_TRIGGERS, REGISTER } from "@naex/core";
import type { AkciaDef, KartaNavrh, KlucoveSlovo } from "./typy.ts";

export interface ProblemTextu {
  readonly id: string;
  readonly nazov: string;
  readonly uroven: "chyba" | "upozornenie";
  readonly text: string;
}

export interface PodkladyTextov {
  readonly klucoveSlova: readonly KlucoveSlovo[];
  readonly akcie: readonly AkciaDef[];
  /** Karty zverejnenej sady — na odhalenie zmeneného textu implementovaného efektu. */
  readonly zverejnene?: readonly Pick<KartaNavrh, "id" | "efekt">[];
}

/** Herné pojmy, ktoré sa často píšu bez diakritiky (doplnok ku kľúčovým slovám). */
const POJMY = [
  "poldecák", "poldecáky", "poldecáku", "stokársky", "doberací", "doberacieho", "doberacom", "odhadzovací",
  "odhadzovacieho", "balíček", "balíčka", "balíčku", "nedopĺňa", "dopĺňa", "šenku", "šenok", "priazeň",
  "starší", "staršieho", "zhromaždenie", "zhromaždení", "dedičstvo", "dedičstve", "cirhóza", "cirhózy",
  "absťák", "absťáky", "absťákov", "exekútor", "náradie", "náradia", "nástroj", "nástroje", "výhra", "prehra",
];

const bezDiakritiky = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("sk");
const slovo = (s: string): string => s.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

/** Slovník správnych tvarov: kľúčové slová a ich tvary, názvy akcií, pojmy. */
function slovnik(p: PodkladyTextov, karty: readonly KartaNavrh[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const pridaj = (t: string): void => {
    for (const w of t.split(/\s+/).map(slovo)) {
      if (w.length < 4) continue;
      const k = bezDiakritiky(w);
      // Len slová s diakritikou — tie bez nej nie je čo opravovať.
      if (k !== w.toLocaleLowerCase("sk") && !mapa.has(k)) mapa.set(k, w.toLocaleLowerCase("sk"));
    }
  };
  for (const k of p.klucoveSlova) [k.slovo, ...k.tvary].forEach(pridaj);
  for (const a of p.akcie) pridaj(a.nazov);
  for (const k of karty) pridaj(k.nazov);
  POJMY.forEach(pridaj);
  return mapa;
}

export function kontrolaTextov(karty: readonly KartaNavrh[], podklady: PodkladyTextov): ProblemTextu[] {
  const out: ProblemTextu[] = [];
  const mapa = slovnik(podklady, karty);
  for (const k of karty) {
    const t = k.efekt;
    const problem = (uroven: ProblemTextu["uroven"], text: string): void => {
      out.push({ id: k.id, nazov: k.nazov, uroven, text });
    };
    if (t.trim() === "") continue;

    const prvy = /^\s*([\p{L}]+):/u.exec(t);
    if (prvy === null) problem("chyba", "Text nezačína spúšťačom v tvare „Spúšťač:“ (Bitka:, Furt:, Nástup:…).");
    for (const m of t.matchAll(/(?:^|[.!?]\s*)([\p{Lu}][\p{L}]+):/gu)) {
      const sp = m[1] ?? "";
      if (!(ALL_TRIGGERS as readonly string[]).includes(sp)) problem("chyba", `Spúšťač „${sp}:“ hra nepozná (${ALL_TRIGGERS.join(", ")}).`);
    }
    for (const m of t.matchAll(/:\s*([\p{Ll}])/gu)) problem("upozornenie", `Za dvojbodkou malé písmeno „${m[1] ?? ""}…“ — veta začína veľkým.`);
    if (!/[.!?]\s*$/u.test(t)) problem("upozornenie", "Text nekončí bodkou.");
    if (/ {2,}/.test(t) || t !== t.trim()) problem("upozornenie", "Dvojitá medzera alebo medzera na začiatku či konci.");

    const nahlasene = new Set<string>();
    for (const w of t.split(/\s+/).map(slovo)) {
      const spravne = mapa.get(bezDiakritiky(w));
      if (spravne !== undefined && spravne !== w.toLocaleLowerCase("sk") && !nahlasene.has(w)) {
        nahlasene.add(w);
        problem("upozornenie", `„${w}“ — nemá byť „${spravne}“?`);
      }
    }

    const stav = REGISTER[k.id];
    const zverejneny = podklady.zverejnene?.find((z) => z.id === k.id);
    if (zverejneny !== undefined && zverejneny.efekt.trim() !== t.trim() && (stav === "impl" || stav === "native")) {
      problem("chyba", "Zmenený text efektu, ktorý hra vyhodnocuje kódom — správanie sa nezmení, kým sa neupraví jadro (effects.ts).");
    }
    if (zverejneny === undefined && stav === undefined) {
      problem("upozornenie", "Nová karta s efektom — hra ho nevyhodnotí (manual), len pripomenie v logu, kým ho vývoj nenaprogramuje.");
    }
  }
  return out;
}
