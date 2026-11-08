// Kontrola textov efektov pred zverejnením: spúšťač, interpunkcia, chýbajúca
// diakritika v herných pojmoch a zmenený text efektu, ktorý hra vyhodnocuje
// kódom (zmena textu nezmení správanie — treba upraviť aj jadro).

import type { Tag } from "@naex/core";
import { ALL_TRIGGERS, PODMIENKY_SLOVAMI, REGISTER, chybyHran, rozborNavyse, rozborPreskoleniKarty, textBezHran } from "@naex/core";
import type { AkciaDef, KartaNavrh, KlucoveSlovo } from "./typy.ts";
import { sPredponouVazna } from "./text.ts";

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
  /**
   * Schopnosti väzňa (elders.json) — hra berie znenie odtiaľ, nie z karty; text karty
   * staršieho sa preto porovná s nimi, nie so zverejnenou sadou.
   */
  readonly starsi?: readonly { readonly id: string; readonly schopnost: string }[];
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
    // „Väzeň — raz za hru:“ (v11.2) je jeden spúšťač Väzeň — kontroluje sa ako „Väzeň:“.
    const t = sPredponouVazna(k.efekt);
    const problem = (uroven: ProblemTextu["uroven"], text: string): void => {
      out.push({ id: k.id, nazov: k.nazov, uroven, text });
    };
    if (t.trim() === "") continue;

    // Hrany Nástroja („Hore: {Rana}→{Pecka}. Dole: Vzbura.“, Náradie 2026-11-08) nie sú spúšťače — číta ich jadro.
    for (const ch of chybyHran({ effectText: t, tags: k.tagy as readonly Tag[] })) problem("chyba", ch);
    const bezHran = textBezHran(t);
    const prvy = /^\s*([\p{L}]+):/u.exec(bezHran);
    if (prvy === null && bezHran !== "") problem("chyba", "Text nezačína spúšťačom v tvare „Spúšťač:“ (Bitka:, Furt:, Nástup:…).");
    for (const m of bezHran.matchAll(/(?:^|[.!?]\s*)([\p{Lu}][\p{L}]+):/gu)) {
      const sp = m[1] ?? "";
      if (!(ALL_TRIGGERS as readonly string[]).includes(sp)) problem("chyba", `Spúšťač „${sp}:“ hra nepozná (${ALL_TRIGGERS.join(", ")}).`);
    }
    for (const m of t.matchAll(/:\s*([\p{Ll}])/gu)) problem("upozornenie", `Za dvojbodkou malé písmeno „${m[1] ?? ""}…“ — veta začína veľkým.`);
    // Akcie navyše (frakcie 2026-11-08): „Spoločník: Tag {Akcia}.“ — preklep by hra pri načítaní odmietla.
    for (const ch of rozborNavyse(t).chyby) problem("chyba", ch);
    // Školitelia (2026-11-08): „Furt: Preškolenie {Robota}→{Pecka}.“ — preklep by hra pri načítaní odmietla.
    for (const ch of rozborPreskoleniKarty(t).chyby) problem("chyba", ch);
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

    // Efekt „Spúšťač: Tag {Akcia}.“ vyhodnocuje jadro zo samotného textu — zmena textu je zmena správania.
    // Preškolenie Školiteľa vyhodnocuje jadro tiež zo samotného textu.
    const navyse = rozborNavyse(t).efekty.length > 0 || rozborPreskoleniKarty(t).efekty.length > 0;
    // Skryté akcie (2026-11-08): podmienku slovami („Bitka: Ak … {Pecka}“) vyhodnocuje jadro podľa karty.
    if (rozborNavyse(t).efekty.some((e) => e.podmienka !== undefined) && !PODMIENKY_SLOVAMI.includes(k.id)) {
      problem("chyba", "Podmienku slovami pred piktogramom akcie hra pri tejto karte nepozná — akcia navyše by nikdy neplatila, kým ju nenaprogramuje vývoj.");
    }
    const stav = REGISTER[k.id];
    const zverejneny = podklady.zverejnene?.find((z) => z.id === k.id);
    // Schopnosť väzňa (v11.2) hra berie z elders.json, nie z textu karty: zmena oproti
    // zverejnenej sade nie je chybou, chybou je len nesúlad s elders.json.
    const schopnost = /^\s*Väzeň:\s*(.*)$/su.exec(t)?.[1]?.trim();
    const starsi = podklady.starsi?.find((s) => s.id === k.id);
    if (starsi !== undefined) {
      if (schopnost !== starsi.schopnost.trim()) {
        problem("chyba", `Text nesedí so schopnosťou väzňa v elders.json — hra vyhodnotí a ukáže „Väzeň — raz za hru: ${starsi.schopnost}“, kým sa neupraví jadro.`);
      }
    } else if (
      schopnost === undefined &&
      zverejneny !== undefined &&
      // Hrany Nástroja číta jadro z textu — ich zmena kód nepotrebuje; porovnáva sa zvyšok (Dedičstvo).
      textBezHran(zverejneny.efekt).trim() !== bezHran.trim() &&
      !navyse &&
      (stav === "impl" || stav === "native")
    ) {
      problem("chyba", "Zmenený text efektu, ktorý hra vyhodnocuje kódom — správanie sa nezmení, kým sa neupraví jadro (effects.ts).");
    }
    if (zverejneny === undefined && stav === undefined && !navyse && bezHran.trim() !== "") {
      problem("upozornenie", "Nová karta s efektom — hra ho nevyhodnotí (manual), len pripomenie v logu, kým ho vývoj nenaprogramuje.");
    }
  }
  return out;
}
