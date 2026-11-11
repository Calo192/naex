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
//   Furt:         — bez podmienky, kým karta leží v línii (Kapybara, Michal 2026-11-09); bez tagu
//
// Piktogram {Spálenie} (Krokodíl, Michal 2026-11-09) nie je akcia, ale účinok v pečati: pri
// Konflikte či Podpore sa karta, s ktorou sa nositeľ stretol, na konci bitky spáli
// (engine vratKartyPoBitke, partia.ts spaleniaZoSpojov).
//
// Skryté akcie (Michal 2026-11-08): efekty, ktoré akciu dávali slovami, majú podmienku
// slovami pred piktogramom. Podmienku a násobok „za každé“ vyhodnotí jadro podľa karty
// (partia.ts kratSlovami), text ju len opisuje:
//
//   Bitka: podmienka            — Pijan, Svokra, Vymáhač, Šofér, Traktorista, Pasca
//   Pitka:                      — Výherný automat (v11.22); Dlh dáva motor v každej Pitke,
//                                 do súčtov akcia nejde (prah Dlhu by ju delil), pečať len ukazuje, kedy platí
//   Posledná Pitka kola:        — to isté len v poslednej Pitke kola (staré sady: Výherný automat, Traktorista)
//
// Efekt v texte, ktorý začína „Dedičstvo:“ (Pasca, Výherný automat), platí, len keď karta
// leží v Dedičstve.
//
// Akcia navyše je aktívna akcia majiteľa karty mimo jej hrán: do súčtov ide ako tá
// istá akcia a vyhodnotí sa v jej kroku. Nie je na spoji, preto ju nemení Posilnenie suseda,
// Odpor, NA EX ani Silná žena; mení ju Náradie v Dedičstve, efekty, ktoré menia všetky akcie
// hráča (rátajú zo súčtov), preškolenie karty (Školitelia, preskolenie.ts), celý podložený
// Nástroj — preškolenie, hrana posilnenia — a Forsáž karty, zo spoja aj z Energeťáka (v11.22,
// Michal 2026-11-11; Forsáž zo spoja výklad Leadera; partia.ts premenNavyse).
//
// „Spúšťač: Preškolenie {X}→{Y}.“ (Školitelia) akcia navyše nie je — číta ho preskolenie.ts.

import type { Action, CardDef, PlayerId, Tag } from "./types.ts";
import { ALL_TAGS } from "./types.ts";
import { hranySlovami, textBezHran } from "./naradie.ts";
import { akciaZTokenu, textBezPreskoleni } from "./preskolenie.ts";

export type SpustacTagom = "Spoločník" | "Nepriateľ" | "Podpora" | "Konflikt";
/** Akcie navyše bez podmienky — platia, kým karta leží (Kapybara, Michal 2026-11-09). */
export type SpustacBezPodmienky = "Furt";
/** Spúšťače s podmienkou slovami (skryté akcie, Michal 2026-11-08). */
export type SpustacSlovami = "Bitka" | "Pitka" | "Posledná Pitka kola";
export type SpustacNavyse = SpustacTagom | SpustacSlovami | SpustacBezPodmienky;
export const SPUSTACE_NAVYSE: readonly SpustacTagom[] = ["Spoločník", "Nepriateľ", "Podpora", "Konflikt"];
/** Spúšťače, za ktorými smie byť tag a piktogramy — Furt tag nemá (hlási rozborNavyse). */
const SPUSTACE_S_PIKTOGRAMOM: readonly (SpustacTagom | SpustacBezPodmienky)[] = [...SPUSTACE_NAVYSE, "Furt"];

/** Účinok v pečati, ktorý nie je akcia (Krokodíl, Michal 2026-11-09). */
export type UcinokNavyse = "Spálenie";
export const UCINKY_NAVYSE: readonly UcinokNavyse[] = ["Spálenie"];
/** Spúšťače, pri ktorých má účinok koho zasiahnuť — kartu, s ktorou sa nositeľ stretol. */
const SPUSTACE_UCINKU: readonly SpustacNavyse[] = ["Podpora", "Konflikt"];
export const SPUSTACE_SLOVAMI: readonly SpustacSlovami[] = ["Bitka", "Pitka", "Posledná Pitka kola"];

/** Efekt, ktorého Dlh dáva motor rovno (Výherný automat), nie súčet akcií cez prah Dlhu. */
export function dlhOdMotora(e: Pick<EfektNavyse, "spustac">): boolean {
  return e.spustac === "Pitka" || e.spustac === "Posledná Pitka kola";
}

export interface EfektNavyse {
  readonly spustac: SpustacNavyse;
  /** Tag z podmienky; null = ktorákoľvek karta (Podpora a Konflikt bez tagu) či podmienka slovami. */
  readonly tag: Tag | null;
  readonly akcie: readonly Action[];
  /** Účinky v pečati, ktoré nie sú akcie ({Spálenie}); chýba = žiadne. */
  readonly ucinky?: readonly UcinokNavyse[];
  /** Podmienka slovami pred piktogramom (Bitka); chýba = bez podmienky. */
  readonly podmienka?: string;
  /** Efekt Nástroja v Dedičstve (text začína „Dedičstvo:“) — v línii neplatí. */
  readonly dedicstvo?: true;
}

/** Efekt s podmienkou slovami (Bitka, Pitka, Posledná Pitka kola) — tú vyhodnocuje jadro podľa karty. */
export function jeSlovami(e: Pick<EfektNavyse, "spustac">): boolean {
  return (SPUSTACE_SLOVAMI as readonly string[]).includes(e.spustac);
}

/** Text podmienky efektu pre popis pečate: „Spoločník: Pamätník“, „Bitka: Ak si v tomto kole nedal NA EX“. */
export function popisPodmienky(e: Pick<EfektNavyse, "spustac" | "tag" | "podmienka">): string {
  const za = e.tag ?? e.podmienka ?? null;
  return za === null ? e.spustac : `${e.spustac}: ${za}`;
}

/** Modifikátory spoja bez spoja nič nerobia — akciou navyše byť nemôžu. */
const BEZ_SPOJA_NIC: readonly Action[] = ["Posilnenie", "Odpor", "Pakt"];

const TOKEN = /\{([^{}]+)\}/gu;
// Skupiny: 1 spúšťač s tagom, 2 tag, 3 spúšťač slovami, 4 podmienka slovami, 5 piktogramy.
const EFEKT = new RegExp(
  `(?:^|[\\s.!?])(?:(${SPUSTACE_S_PIKTOGRAMOM.join("|")}):\\s*(?:([\\p{L}]+)\\s*)?|(${SPUSTACE_SLOVAMI.join("|")}):\\s*([^{}:.!?]*?)\\s*)((?:\\{[^{}]+\\}\\s*)+)`,
  "gu",
);

export interface RozborNavyse {
  readonly efekty: readonly EfektNavyse[];
  /** Chyby zápisu — neznáma akcia či tag, piktogram mimo efektu. Prázdne = v poriadku. */
  readonly chyby: readonly string[];
}

/** Prečíta efekty s akciami navyše z textu efektu karty. */
export function rozborNavyse(celyText: string): RozborNavyse {
  // Hrany Nástroja („Dole: {Rana}→{Pecka}.“) číta naradie.ts, Preškolenie Školiteľov preskolenie.ts —
  // akcie navyše to nie sú.
  const text = textBezPreskoleni(textBezHran(celyText));
  const efekty: EfektNavyse[] = [];
  const chyby: string[] = [];
  let tokenovVEfektoch = 0;
  const dedicstvo = /^\s*Dedičstvo:/u.test(text);
  for (const m of text.matchAll(EFEKT)) {
    const spustac = (m[1] ?? m[3]) as SpustacNavyse;
    const slovo = m[2] ?? null;
    // „Bitka: Za každú kartu, ktorú …, {Rana}.“ — čiarka pred piktogramom do podmienky nepatrí.
    const podmienka = (m[4] ?? "").trim().replace(/,$/u, "").trim();
    let tag: Tag | null = null;
    if (slovo !== null && spustac === "Furt") chyby.push(`„Furt: ${slovo}“ — akcie navyše Furt platia bez podmienky, tag nemajú (s tagom je to Spoločník).`);
    else if (slovo !== null) {
      if (!(ALL_TAGS as readonly string[]).includes(slovo)) chyby.push(`„${spustac}: ${slovo}“ — ${slovo} nie je tag, ktorý hra pozná (${ALL_TAGS.join(", ")}).`);
      else tag = slovo as Tag;
    }
    const akcie: Action[] = [];
    const ucinky: UcinokNavyse[] = [];
    for (const t of (m[5] ?? "").matchAll(TOKEN)) {
      tokenovVEfektoch++;
      const a = akciaZTokenu(t[1] ?? "");
      const ucinok = UCINKY_NAVYSE.find((u) => u.toLocaleLowerCase("sk") === (t[1] ?? "").trim().toLocaleLowerCase("sk"));
      if (ucinok !== undefined) {
        if (SPUSTACE_UCINKU.includes(spustac)) ucinky.push(ucinok);
        else chyby.push(`{${ucinok}} patrí za Konflikt alebo Podporu — zasiahne kartu, s ktorou sa karta stretne.`);
      } else if (a === null) chyby.push(`{${t[1] ?? ""}} nie je akcia, ktorú hra pozná.`);
      else if (BEZ_SPOJA_NIC.includes(a)) chyby.push(`{${t[1] ?? ""}} nemôže byť akcia navyše — bez spoja nič nerobí.`);
      else akcie.push(a);
    }
    if (akcie.length + ucinky.length > 0) {
      efekty.push({ spustac, tag, akcie, ...(ucinky.length > 0 ? { ucinky } : {}), ...(podmienka === "" ? {} : { podmienka }), ...(dedicstvo ? { dedicstvo: true as const } : {}) });
    }
  }
  const vsetkych = [...text.matchAll(TOKEN)].length;
  if (vsetkych > tokenovVEfektoch) chyby.push("Piktogram akcie {…} je mimo efektu „Spúšťač: Tag {Akcia}“ alebo „Bitka: podmienka {Akcia}“ — hra ho nevyhodnotí.");
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

/** Text efektu bez piktogramov {Akcia} — tie kreslí karta zvlášť (pečať v ilustrácii; Preškolenie pilulka). */
export function textBezAkcii(text: string): string {
  return textBezPreskoleni(hranySlovami(text))
    .replace(TOKEN, "")
    .replace(/[ \t]+([.,!?])/gu, "$1")
    // „Posledná Pitka kola: {Hazard}.“ či „Podpora: {Robota}.“ — bez piktogramu ostala dvojbodka pred bodkou.
    .replace(/:([.,!?])/gu, "$1")
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
  // Efekty s piktogramami sú už v zozname — zvyšok textu je efekt slovami (Preškolenie bez tagu).
  const slovami = textBezPreskoleni(def.effectText).replace(EFEKT, " ");
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
  /** Uid kariet, s ktorými sa efekt navyše [i] spustil — šípky pečate k susedom. */
  readonly navyseOd?: readonly (readonly number[])[];
}

/** Stav jedného efektu s akciami navyše — pre súčty aj pre kreslenie karty. */
export interface NavyseStav extends EfektNavyse {
  /** Koľkokrát platí: 0 = nesplnené, Spoločník a Nepriateľ najviac 1, Podpora a Konflikt za každé stretnutie. */
  readonly krat: number;
  /** Akcia, ktorou sa akcia [j] ráta po preškolení (Nástroj pod kartou, Školiteľ); chýba = bez zmeny. */
  readonly ako?: readonly Action[];
  /** uid karty, ktorá akciu [j] preškolila (Nástroj či Školiteľ); null = nepreškolená. */
  readonly akoOd?: readonly (number | null)[];
  /** Násobok akcie [j] — Forsáž (zo spoja, z Energeťáka) a hrana posilnenia Nástroja pod kartou (v11.22); chýba = ×1. */
  readonly nasobok?: readonly number[];
  /** Dôvody násobku akcie [j] pre rozpis („Forsáž“, „karta:puska“). */
  readonly posilnilo?: readonly (readonly string[])[];
  /** Podpora a Konflikt: uid kariet, s ktorými sa efekt spustil. */
  readonly od?: readonly number[];
}

/**
 * Stav efektov navyše karty `pl` v línii `strany`. Skrytá Záverečná nič nesplní ani
 * nedostane, kým sa neotočí (inak by ju súper vyčítal); umlčané Zviera (Mäsiar) tiež nie.
 * `kratSlovami[i]` — koľkokrát platí efekt [i] s podmienkou slovami (jadro, partia.ts);
 * chýba = nesplnený.
 */
export function stavNavyse(
  tagyKarty: (defId: string) => readonly Tag[],
  efekty: readonly EfektNavyse[],
  strany: readonly (readonly KartaPodmienky[])[],
  pl: KartaPodmienky,
  umlcane: ReadonlySet<number> = new Set(),
  kratSlovami: readonly number[] = [],
): NavyseStav[] {
  const odkryte = strany.flat().filter((x) => x.zaverecna !== true && x.card.uid !== pl.card.uid);
  return efekty.map((e, i): NavyseStav => {
    if (pl.zaverecna === true || umlcane.has(pl.card.uid)) return { ...e, krat: 0 };
    switch (e.spustac) {
      case "Spoločník":
        return { ...e, krat: odkryte.some((x) => x.playedBy === pl.playedBy && splnaTag(e.tag, tagyKarty(x.card.defId))) ? 1 : 0 };
      case "Nepriateľ":
        return { ...e, krat: odkryte.some((x) => x.playedBy !== pl.playedBy && splnaTag(e.tag, tagyKarty(x.card.defId))) ? 1 : 0 };
      case "Furt":
        return { ...e, krat: 1 };
      case "Podpora":
      case "Konflikt": {
        const od = pl.navyseOd?.[i];
        return { ...e, krat: pl.navyse?.[i] ?? 0, ...(od !== undefined && od.length > 0 ? { od } : {}) };
      }
      default:
        return { ...e, krat: kratSlovami[i] ?? 0 };
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
