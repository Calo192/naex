// Akcie navyše podmienené tagom (frakcie, Michal 2026-11-08).
//
// Efekt karty v tvare „Spúšťač: Tag {Akcia} {Akcia}.“ — admin ho píše do textu
// efektu v tvorcovi, piktogramy sú kľúče akcií v zložených zátvorkách. Štruktúra
// (spúšťač, tag, akcie) sa z textu len prečíta; čo efekt robí, rozhoduje motor
// (evaluateLine), nie text.
//
//   Spoločník: T  — v partii majiteľa je iná odkrytá karta s tagom T; raz, kým to platí
//   Nepriateľ: T  — v súperovej partii je odkrytá karta s tagom T; raz, kým to platí
//   Podpora: T    — pri každom stretnutí priložením s vlastnou kartou s tagom T, do konca kola
//   Konflikt: T   — pri každom stretnutí priložením so súperovou kartou s tagom T, do konca kola
//
// Akcia navyše je aktívna akcia majiteľa karty mimo jej hrán: do súčtov ide ako tá
// istá akcia a vyhodnotí sa v jej kroku. Nie je na spoji, preto ju nemení Posilnenie,
// Odpor, Forsáž, NA EX ani Silná žena; mení ju Náradie v Dedičstve a efekty, ktoré
// menia všetky akcie hráča (rátajú zo súčtov).

import type { Action, CardDef, PlayerId, Tag } from "./types.ts";
import { ALL_ACTIONS, ALL_TAGS } from "./types.ts";

export type SpustacNavyse = "Spoločník" | "Nepriateľ" | "Podpora" | "Konflikt";
export const SPUSTACE_NAVYSE: readonly SpustacNavyse[] = ["Spoločník", "Nepriateľ", "Podpora", "Konflikt"];

export interface EfektNavyse {
  readonly spustac: SpustacNavyse;
  /** Tag z podmienky; null = ktorákoľvek karta (Podpora a Konflikt bez tagu). */
  readonly tag: Tag | null;
  readonly akcie: readonly Action[];
}

/** Modifikátory spoja bez spoja nič nerobia — akciou navyše byť nemôžu. */
const BEZ_SPOJA_NIC: readonly Action[] = ["Posilnenie", "Odpor", "Pakt"];

/** Názvy akcií z tvorcu, ktoré sa líšia od kľúča (Hazard je akcia Dlh). */
const ALIAS_AKCIE: Readonly<Record<string, Action>> = { Hazard: "Dlh", Cigaretka: "Cigareta" };

const bezMedzier = (s: string): string => s.replace(/\s+/g, "").toLocaleLowerCase("sk");

function akciaZTokenu(token: string): Action | null {
  const t = bezMedzier(token);
  for (const a of ALL_ACTIONS) if (bezMedzier(a) === t) return a;
  for (const [alias, a] of Object.entries(ALIAS_AKCIE)) if (bezMedzier(alias) === t) return a;
  return null;
}

const TOKEN = /\{([^{}]+)\}/gu;
const EFEKT = new RegExp(`(?:^|[\\s.!?])(${SPUSTACE_NAVYSE.join("|")}):\\s*(?:([\\p{L}]+)\\s*)?((?:\\{[^{}]+\\}\\s*)+)`, "gu");

export interface RozborNavyse {
  readonly efekty: readonly EfektNavyse[];
  /** Chyby zápisu — neznáma akcia či tag, piktogram mimo efektu. Prázdne = v poriadku. */
  readonly chyby: readonly string[];
}

/** Prečíta efekty s akciami navyše z textu efektu karty. */
export function rozborNavyse(text: string): RozborNavyse {
  const efekty: EfektNavyse[] = [];
  const chyby: string[] = [];
  let tokenovVEfektoch = 0;
  for (const m of text.matchAll(EFEKT)) {
    const spustac = m[1] as SpustacNavyse;
    const slovo = m[2] ?? null;
    let tag: Tag | null = null;
    if (slovo !== null) {
      if (!(ALL_TAGS as readonly string[]).includes(slovo)) chyby.push(`„${spustac}: ${slovo}“ — ${slovo} nie je tag, ktorý hra pozná (${ALL_TAGS.join(", ")}).`);
      else tag = slovo as Tag;
    }
    const akcie: Action[] = [];
    for (const t of (m[3] ?? "").matchAll(TOKEN)) {
      tokenovVEfektoch++;
      const a = akciaZTokenu(t[1] ?? "");
      if (a === null) chyby.push(`{${t[1] ?? ""}} nie je akcia, ktorú hra pozná.`);
      else if (BEZ_SPOJA_NIC.includes(a)) chyby.push(`{${t[1] ?? ""}} nemôže byť akcia navyše — bez spoja nič nerobí.`);
      else akcie.push(a);
    }
    if (akcie.length > 0) efekty.push({ spustac, tag, akcie });
  }
  const vsetkych = [...text.matchAll(TOKEN)].length;
  if (vsetkych > tokenovVEfektoch) chyby.push("Piktogram akcie {…} je mimo efektu „Spúšťač: Tag {Akcia}“ — hra ho nevyhodnotí.");
  return { efekty, chyby };
}

const pamat = new Map<string, readonly EfektNavyse[]>();

/** Efekty s akciami navyše karty (z textu efektu; chybné zápisy odmietne už načítanie dát). */
export function efektyNavyse(def: Pick<CardDef, "effectText" | "tags">): readonly EfektNavyse[] {
  // Starší má v línii len akcie (v9) — jeho text je schopnosť väzňa.
  if (def.tags.includes("Starešina")) return [];
  const ulozene = pamat.get(def.effectText);
  if (ulozene !== undefined) return ulozene;
  const efekty = rozborNavyse(def.effectText).efekty;
  pamat.set(def.effectText, efekty);
  return efekty;
}

/** Text efektu bez piktogramov {Akcia} — tie kreslí karta zvlášť (pečať v ilustrácii). */
export function textBezAkcii(text: string): string {
  return text
    .replace(TOKEN, "")
    .replace(/[ \t]+([.,!?])/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

/**
 * Podmienky tagu spúšťača Podpora či Konflikt: tag z efektu s akciami navyše, alebo slovo
 * hneď za dvojbodkou, keď je to tag („Konflikt: Influencer Súper odhodí…“). null = ktokoľvek.
 */
export function podmienkySpoja(def: Pick<CardDef, "effectText" | "tags">, spustac: "Podpora" | "Konflikt"): readonly (Tag | null)[] {
  const out: (Tag | null)[] = efektyNavyse(def)
    .filter((e) => e.spustac === spustac)
    .map((e) => e.tag);
  // Efekty s piktogramami sú už v zozname — zvyšok textu je efekt slovami.
  const slovami = def.effectText.replace(EFEKT, " ");
  for (const m of slovami.matchAll(new RegExp(`(?:^|[\\s.!?])${spustac}:\\s*([\\p{L}]+)?`, "gu"))) {
    const slovo = m[1] ?? "";
    out.push((ALL_TAGS as readonly string[]).includes(slovo) ? (slovo as Tag) : null);
  }
  return out.length === 0 ? [null] : out;
}

/** Spĺňa karta s tagmi `tagy` podmienku tagu? */
export function splnaTag(tag: Tag | null, tagy: readonly Tag[]): boolean {
  return tag === null || tagy.includes(tag);
}

/** Karta v línii, ako ju vidí podmienka (PlacedCard aj pohľad klienta). */
export interface KartaPodmienky {
  readonly card: { readonly uid: number; readonly defId: string };
  readonly playedBy: PlayerId;
  readonly zaverecna?: true;
  /** Koľkokrát sa spustil efekt navyše [i] (Podpora, Konflikt) v tomto kole. */
  readonly navyse?: readonly number[];
}

/** Stav jedného efektu s akciami navyše — pre súčty aj pre kreslenie karty. */
export interface NavyseStav extends EfektNavyse {
  /** Koľkokrát platí: 0 = nesplnené, Spoločník a Nepriateľ najviac 1, Podpora a Konflikt za každé stretnutie. */
  readonly krat: number;
}

/**
 * Stav efektov navyše karty `pl` v línii `strany`. Skrytá Záverečná nič nesplní ani
 * nedostane, kým sa neotočí (inak by ju súper vyčítal); umlčané Zviera (Mäsiar) tiež nie.
 */
export function stavNavyse(
  tagyKarty: (defId: string) => readonly Tag[],
  efekty: readonly EfektNavyse[],
  strany: readonly (readonly KartaPodmienky[])[],
  pl: KartaPodmienky,
  umlcane: ReadonlySet<number> = new Set(),
): NavyseStav[] {
  const odkryte = strany.flat().filter((x) => x.zaverecna !== true && x.card.uid !== pl.card.uid);
  return efekty.map((e, i): NavyseStav => {
    if (pl.zaverecna === true || umlcane.has(pl.card.uid)) return { ...e, krat: 0 };
    switch (e.spustac) {
      case "Spoločník":
        return { ...e, krat: odkryte.some((x) => x.playedBy === pl.playedBy && splnaTag(e.tag, tagyKarty(x.card.defId))) ? 1 : 0 };
      case "Nepriateľ":
        return { ...e, krat: odkryte.some((x) => x.playedBy !== pl.playedBy && splnaTag(e.tag, tagyKarty(x.card.defId))) ? 1 : 0 };
      default:
        return { ...e, krat: pl.navyse?.[i] ?? 0 };
    }
  });
}

/**
 * Stav efektov navyše karty v ruke hráča p — Spoločník a Nepriateľ podľa toho, čo teraz
 * leží v línii; Podporu a Konflikt spustí až priloženie, preto 0.
 */
export function stavNavyseVRuke(
  tagyKarty: (defId: string) => readonly Tag[],
  efekty: readonly EfektNavyse[],
  strany: readonly (readonly KartaPodmienky[])[],
  uid: number,
  p: PlayerId,
): NavyseStav[] {
  return stavNavyse(tagyKarty, efekty, strany, { card: { uid, defId: "" }, playedBy: p });
}
