// Vyhodnotenie línie kariet — jadro hry (M2).
//
// Geometria: karty tvoria jednu súvislú líniu
//
//   [posledná karta hráča 0] … [prvá karta hráča 0] [LOKALITA] [prvá karta hráča 1] …
//
// v „globálnom ráme“ = pohľad hráča 0. Karta je v globálnom ráme otočená
// o 180° práve vtedy, keď ju zahral hráč 1 (karty čelia hráčovi, ktorý ich
// zahral — vyloženie do súperovej partie je „nohami hore“ voči tej partii).
// Akcie karty patria jej MAJITEĽOVI (tomu, kto ju zahral a k nemu je
// natočená), nie partii, v ktorej leží — pravidlá v3, rozhodnutie Michala
// 2026-10-11. Karta v súperovej partii tak aktivuje súperove akcie na
// spojoch (tie dostane súper) a sama boduje pre svojho majiteľa.
// Lokalita je otočená podľa natočenia útočníkom. Otočenie o 180°: ľavá
// a pravá strana sa vymenia a poradie indexov sa obráti (0↔3, 1↔2).
//
// Na spoji sa stretáva PRAVÁ strana ľavého prvku s ĽAVOU stranou pravého
// prvku na rovnakom indexe; akcia je aktívna, keď sú oba sloty neprázdne.
//
// Rozhodnutia pri nejasných pravidlách (viď README):
//  - Posilnenie + Posilnenie: nič sa nedeje (niet čo zdvojnásobiť).
//  - Vzbura na lokalite aktivuje len stranu patriacu danej partii.
//  - Vzbura ani NA EX neoživujú akcie zrušené Odporom.
//  - NA EX mení len akcie cieľovej karty; už vypočítané dôsledky jej akcií
//    na susedoch (Posilnenie ×2, Odpor zrušenie) ostávajú.
//
// Efekty kariet, ktoré závisia od polohy v línii (Liberál, Silná nezávislá
// žena, Veterán, Zámočník, Šarlatán, Pijan), sa vyhodnocujú tu, po spojoch
// a NA EX — „okolie“ karty sú jej susedia v línii (aj lokalita či starší
// v strede). Výklad textov schválil Michal 2026-10-12.

import type { Action, CardInstance, PlayerId, SideLayout, Slot, Tag } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";

/** Karta ležiaca v partii. */
export interface PlacedCard {
  readonly card: CardInstance;
  readonly playedBy: PlayerId;
  /** Hráč, ktorého poldeci na karte leží cez NA EX (vlastník poldeci), ak nejaký. */
  readonly naexBy?: PlayerId;
}

export interface LineState {
  /** Karta v strede línie: lokalita, v bitke o staršieho karta staršieho. */
  readonly lokalita: CardInstance | null;
  /**
   * false = vytlačená ľavá strana lokality patrí hráčovi 0;
   * true  = lokalita otočená o 180°, hráčovi 0 patrí vytlačená pravá strana.
   */
  readonly lokalitaOtocena: boolean;
  /** partie[p][0] je karta najbližšie k lokalite. */
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /**
   * pasca[p]: hráč p má Pascu v Dedičstve — akcie prvej karty, ktorú mu súper
   * podstrčil na stranu, neplatia (Michal 2026-10-18). Chýba = nikto.
   */
  readonly pasca?: readonly [boolean, boolean];
}

export type SlotStav = "neaktivna" | "aktivna" | "zrusena";

export interface SlotEval {
  readonly action: Action;
  readonly stav: SlotStav;
  /** Koľkokrát sa akcia počíta (2 = Posilnenie alebo NA EX; 0 = zrušená/neaktívna). */
  readonly nasobok: number;
  /** Akcia sa ráta ako iná (Šarlatán: Viera v jeho okolí platí ako Vízia). */
  readonly ako?: Action;
}

/** Vyhodnotenie jednej karty — sloty vo VYTLAČENOM ráme karty. */
export interface CardLineEval {
  readonly uid: number;
  readonly vzbura: boolean;
  readonly left: readonly (SlotEval | null)[];
  readonly right: readonly (SlotEval | null)[];
}

export type ActionSums = Readonly<Partial<Record<Action, number>>>;

export interface LineEval {
  /** Súčty aktívnych akcií podľa hráča (akcie pôsobia v partii, kde karta leží). */
  readonly sums: readonly [ActionSums, ActionSums];
  readonly cards: ReadonlyMap<number, CardLineEval>;
}

/** Posilnenie a Odpor sú modifikátory spoja — do súčtov nikdy neprispievajú. */
const MODIFIERS: readonly Action[] = ["Posilnenie", "Odpor"];

interface Elem {
  readonly uid: number;
  readonly defId: string;
  readonly tags: readonly Tag[];
  /** Majiteľ karty — dostane jej aktívne akcie; lokalita má strany rozdelené. */
  readonly owner: PlayerId;
  readonly isLokalita: boolean;
  /** Strana línie, na ktorej karta leží (lokalita v strede: null). */
  readonly strana: PlayerId | null;
  readonly rotated: boolean;
  readonly printed: { readonly left: SideLayout; readonly right: SideLayout };
  readonly effLeft: readonly Slot[];
  readonly effRight: readonly Slot[];
  /** stav[side][k]: side 0 = efektívna ľavá, 1 = efektívna pravá. */
  readonly stav: SlotStav[][];
  readonly nasobok: number[][];
  /** vzbura[side] pre lokalitu; karta má vzburu vždy za obe strany naraz. */
  readonly vzbura: [boolean, boolean];
  readonly naexBy: PlayerId | undefined;
  /** Šarlatán v okolí: Viera tejto karty sa ráta ako Vízia. */
  vieraAkoVizia: boolean;
}

function reversed(side: SideLayout): Slot[] {
  return [side[3], side[2], side[1], side[0]];
}

function freshStav(): SlotStav[] {
  return ["neaktivna", "neaktivna", "neaktivna", "neaktivna"];
}

function freshNasobok(): number[] {
  return [0, 0, 0, 0];
}

function makeElem(
  data: GameData,
  card: CardInstance,
  owner: PlayerId,
  rotated: boolean,
  isLokalita: boolean,
  naexBy: PlayerId | undefined,
  strana: PlayerId | null,
): Elem {
  const printed = printedSides(data, card);
  return {
    uid: card.uid,
    defId: card.defId,
    tags: defOf(data, card).tags,
    owner,
    isLokalita,
    strana,
    rotated,
    printed,
    effLeft: rotated ? reversed(printed.right) : [...printed.left],
    effRight: rotated ? reversed(printed.left) : [...printed.right],
    stav: [freshStav(), freshStav()],
    nasobok: [freshNasobok(), freshNasobok()],
    vzbura: [false, false],
    naexBy,
    vieraAkoVizia: false,
  };
}

function markVzbura(elem: Elem, side: 0 | 1): void {
  if (elem.isLokalita) {
    elem.vzbura[side] = true;
  } else {
    elem.vzbura[0] = true;
    elem.vzbura[1] = true;
  }
}

/**
 * Nástroj funguje len na strane, kde ho podporuje Občan alebo Starešina
 * (Michal 2026-10-18). Pri lokalite, karte staršieho v strede či karte bez
 * týchto tagov spoj nevznikne — neaktivuje sa nič ani na susedovi.
 */
export function spojVznikne(a: { readonly tags: readonly Tag[]; readonly stred: boolean }, b: { readonly tags: readonly Tag[]; readonly stred: boolean }): boolean {
  const podporuje = (x: typeof a): boolean => !x.stred && (x.tags.includes("Občan") || x.tags.includes("Starešina"));
  if (a.tags.includes("Nástroj") && !a.stred && !podporuje(b)) return false;
  if (b.tags.includes("Nástroj") && !b.stred && !podporuje(a)) return false;
  return true;
}

/** Spoj medzi susedmi: pravá strana `a` proti ľavej strane `b`. */
function resolveJunction(a: Elem, b: Elem): void {
  if (!spojVznikne({ tags: a.tags, stred: a.isLokalita }, { tags: b.tags, stred: b.isLokalita })) return;
  for (let k = 0; k < 4; k++) {
    const actA = a.effRight[k];
    const actB = b.effLeft[k];
    if (actA == null || actB == null) continue;

    const odporA = actA === "Odpor";
    const odporB = actB === "Odpor";
    const posilA = actA === "Posilnenie";
    const posilB = actB === "Posilnenie";

    if (odporA && odporB) {
      // Vzbura — oba Odpory sa vyrušia a obe karty aktivujú neprepojené akcie.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
      markVzbura(a, 1);
      markVzbura(b, 0);
    } else if (odporA || odporB) {
      const [odporElem, odporSide, otherElem, otherSide, otherAct] = odporA
        ? ([a, 1, b, 0, actB] as const)
        : ([b, 0, a, 1, actA] as const);
      odporElem.stav[odporSide]![k] = "aktivna";
      otherElem.stav[otherSide]![k] = "zrusena";
      // Posilnenie + Odpor: neprepojené akcie aktivuje IBA karta s Odporom.
      if (otherAct === "Posilnenie") markVzbura(odporElem, odporSide);
    } else if (posilA && posilB) {
      // Posilnenie + Posilnenie: pravidlá mlčia — rozhodnutie: nič sa nedeje.
      a.stav[1]![k] = "aktivna";
      b.stav[0]![k] = "aktivna";
    } else if (posilA || posilB) {
      const [posilElem, posilSide, otherElem, otherSide] = posilA
        ? ([a, 1, b, 0] as const)
        : ([b, 0, a, 1] as const);
      posilElem.stav[posilSide]![k] = "aktivna";
      otherElem.stav[otherSide]![k] = "aktivna";
      otherElem.nasobok[otherSide]![k] = 2;
    } else {
      a.stav[1]![k] = "aktivna";
      a.nasobok[1]![k] = 1;
      b.stav[0]![k] = "aktivna";
      b.nasobok[0]![k] = 1;
    }
  }
}

function applyVzbura(elem: Elem): void {
  for (const side of [0, 1] as const) {
    if (!elem.vzbura[side]) continue;
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] != null && elem.stav[side]![k] === "neaktivna") {
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 1;
      }
    }
  }
}

function applyNaex(elem: Elem): void {
  if (elem.naexBy === undefined) return;
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] == null) continue;
      const stav = elem.stav[side]![k];
      if (stav === "aktivna") {
        elem.stav[side]![k] = "zrusena";
        elem.nasobok[side]![k] = 0;
      } else if (stav === "neaktivna") {
        elem.stav[side]![k] = "aktivna";
        elem.nasobok[side]![k] = 2;
      }
    }
  }
}

/** Aktívne akcie strany prestanú platiť (Veterán, Silná nezávislá žena). */
function vypniStranu(elem: Elem, side: 0 | 1): void {
  for (let k = 0; k < 4; k++) {
    if (elem.stav[side]![k] === "aktivna") {
      elem.stav[side]![k] = "zrusena";
      elem.nasobok[side]![k] = 0;
    }
  }
}

/** Aktívne akcie karty sa rátajú dvakrát (Liberál, Zámočník pri Nástroji). */
function zdvojAktivne(elem: Elem): void {
  for (const side of [0, 1] as const) {
    for (let k = 0; k < 4; k++) {
      if (elem.stav[side]![k] === "aktivna") elem.nasobok[side]![k] = (elem.nasobok[side]![k] as number) * 2;
    }
  }
}

function maAktivnu(elem: Elem, action: Action): boolean {
  for (const side of [0, 1] as const) {
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    for (let k = 0; k < 4; k++) {
      if (actions[k] === action && elem.stav[side]![k] === "aktivna") return true;
    }
  }
  return false;
}

/**
 * Efekty kariet závislé od polohy v línii. Vracia rany navyše, ktoré Pijan
 * udelil do partie svojho majiteľa — rátajú sa jeho súperovi.
 */
function kartoveEfekty(segments: readonly (readonly Elem[])[]): [number, number] {
  const susedia = new Map<Elem, [Elem | null, Elem | null]>();
  for (const seg of segments) {
    seg.forEach((e, i) => susedia.set(e, [seg[i - 1] ?? null, seg[i + 1] ?? null]));
  }
  const karty = [...susedia.keys()].filter((e) => !e.isLokalita);
  const okolie = (e: Elem): Elem[] => (susedia.get(e) ?? [null, null]).filter((x): x is Elem => x !== null);
  const ma = (e: Elem | null, tag: Tag): boolean => e !== null && e.tags.includes(tag);
  // Vytlačená strana karty → strana v globálnom ráme (otočená karta ich má vymenené).
  const efektivna = (e: Elem, vytlacena: 0 | 1): 0 | 1 => (e.rotated ? (vytlacena === 0 ? 1 : 0) : vytlacena);

  for (const e of karty) {
    const [vlavo, vpravo] = susedia.get(e) ?? [null, null];
    switch (e.defId) {
      case "veteran": {
        // Influencer v partii majiteľa → neplatia pravé akcie.
        const influencer = karty.some((x) => x !== e && x.owner === e.owner && x.tags.includes("Influencer"));
        if (influencer) vypniStranu(e, efektivna(e, 1));
        // Podporený (oba susedia) a vpravo z pohľadu majiteľa je Žena → neplatia ľavé akcie.
        const pravySused = efektivna(e, 1) === 1 ? vpravo : vlavo;
        if (vlavo !== null && vpravo !== null && ma(pravySused, "Žena")) vypniStranu(e, efektivna(e, 0));
        break;
      }
      default:
        break;
    }
  }

  for (const e of karty) {
    if (e.defId === "liberal") {
      // Dvojnásobný efekt jeho akcií, ak je v partii rovnako žien a chlapov (on sám sa neráta).
      const partia = karty.filter((x) => x !== e && x.owner === e.owner);
      const zeny = partia.filter((x) => x.tags.includes("Žena")).length;
      const chlapi = partia.filter((x) => x.tags.includes("Chlap")).length;
      if (zeny === chlapi) zdvojAktivne(e);
    } else if (e.defId === "zamocnik") {
      for (const s of okolie(e)) if (s.tags.includes("Nástroj")) zdvojAktivne(s);
    } else if (e.defId === "sarlatan") {
      for (const s of okolie(e)) s.vieraAkoVizia = true;
    } else if (e.defId === "silna_nezavisla_zena") {
      // Michal 2026-10-18: podporuje okolie — aktívne akcie susedných kariet
      // toho istého majiteľa sa rátajú dvakrát (lokalitu a cudzie karty nie).
      for (const s of okolie(e)) if (!s.isLokalita && s.owner === e.owner) zdvojAktivne(s);
    }
  }

  const rany: [number, number] = [0, 0];
  for (const e of karty) {
    if (e.defId !== "pijan") continue;
    // Žena v okolí s aktívnou akciou Poldeci → rana do partie majiteľa Pijana.
    if (okolie(e).some((s) => s.tags.includes("Žena") && maAktivnu(s, "Poldeci"))) {
      rany[e.owner === 0 ? 1 : 0] += 1;
    }
  }
  return rany;
}

function elemEval(elem: Elem): CardLineEval {
  // Výstup mapujeme späť do vytlačeného rámu karty: pri otočenej karte je
  // efektívna ľavá strana vytlačenou pravou v obrátenom poradí indexov.
  const printedSlot = (printedSide: 0 | 1, k: number): SlotEval | null => {
    const [side, idx] = elem.rotated
      ? ([printedSide === 0 ? 1 : 0, 3 - k] as const)
      : ([printedSide, k] as const);
    const actions = side === 0 ? elem.effLeft : elem.effRight;
    const action = actions[idx];
    if (action == null) return null;
    return {
      action,
      stav: elem.stav[side]![idx] as SlotStav,
      nasobok: elem.nasobok[side]![idx] as number,
      ...(elem.vieraAkoVizia && action === "Viera" ? { ako: "Vízia" as const } : {}),
    };
  };
  return {
    uid: elem.uid,
    vzbura: elem.vzbura[0] || elem.vzbura[1],
    left: [0, 1, 2, 3].map((k) => printedSlot(0, k)),
    right: [0, 1, 2, 3].map((k) => printedSlot(1, k)),
  };
}

export function evaluateLine(data: GameData, line: LineState): LineEval {
  const elems: Elem[] = [];
  const segments: Elem[][] = [];

  const partia0 = line.strany[0].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, p.naexBy, 0),
  );
  const partia1 = line.strany[1].map((p) =>
    makeElem(data, p.card, p.playedBy, p.playedBy === 1, false, p.naexBy, 1),
  );

  // Akcie lokality na spoji dostane majiteľ susednej karty (pravidlá v3) —
  // podstrčená karta tak aktivuje strany lokality pre seba.
  const susedLokality: [PlayerId | null, PlayerId | null] = [partia0[0]?.owner ?? null, partia1[0]?.owner ?? null];
  if (line.lokalita !== null) {
    // owner lokality je len formálny — súčty jej strán idú majiteľovi suseda.
    const lok = makeElem(data, line.lokalita, 0, line.lokalitaOtocena, true, undefined, null);
    segments.push([...[...partia0].reverse(), lok, ...partia1]);
    elems.push(...partia0, lok, ...partia1);
  } else {
    // Bez karty v strede (len testy a ukážky — v bitke o staršieho leží
    // v strede karta staršieho): strany sú dva samostatné úseky.
    segments.push([...partia0].reverse(), [...partia1]);
    elems.push(...partia0, ...partia1);
  }

  for (const segment of segments) {
    for (let i = 0; i + 1 < segment.length; i++) {
      resolveJunction(segment[i] as Elem, segment[i + 1] as Elem);
    }
  }
  for (const elem of elems) applyVzbura(elem);
  for (const elem of elems) applyNaex(elem);
  // Pasca: prvá podstrčená karta na strane hráča s Pascou (strana je zoradená
  // od lokality, teda v poradí vykladania) — jej akcie neplatia, susedov spoj áno.
  for (const q of [0, 1] as const) {
    if (line.pasca?.[q] !== true) continue;
    const partia = q === 0 ? partia0 : partia1;
    const chytena = partia.find((e) => e.owner !== q);
    if (chytena !== undefined) {
      vypniStranu(chytena, 0);
      vypniStranu(chytena, 1);
    }
  }
  const ranyPijana = kartoveEfekty(segments);

  const sums: [Partial<Record<Action, number>>, Partial<Record<Action, number>>] = [{}, {}];
  for (const p of [0, 1] as const) if (ranyPijana[p] > 0) sums[p].Rana = ranyPijana[p];
  for (const elem of elems) {
    for (const side of [0, 1] as const) {
      const actions = side === 0 ? elem.effLeft : elem.effRight;
      for (let k = 0; k < 4; k++) {
        const action = actions[k];
        if (action == null || MODIFIERS.includes(action)) continue;
        if (elem.stav[side]![k] !== "aktivna") continue;
        const nasobok = elem.nasobok[side]![k] as number;
        if (nasobok === 0) continue;
        // Akcia lokality patrí majiteľovi karty, s ktorou tvorí spoj (bez suseda
        // nie je aktívna); akcia karty jej majiteľovi, nech leží kdekoľvek.
        // Kočovník (Michal 2026-10-18): jeho Hazard a Pečeň dostáva hráč, na ktorého strane leží.
        const kocovnik = elem.defId === "kocovnik" && elem.strana !== null && (action === "Dlh" || action === "PoškodeniePečene");
        const target: PlayerId = elem.isLokalita ? (susedLokality[side] ?? side) : kocovnik ? (elem.strana as PlayerId) : elem.owner;
        const ako: Action = elem.vieraAkoVizia && action === "Viera" ? "Vízia" : action;
        sums[target][ako] = (sums[target][ako] ?? 0) + nasobok;
      }
    }
  }

  const cards = new Map<number, CardLineEval>();
  for (const elem of elems) cards.set(elem.uid, elemEval(elem));

  return { sums, cards };
}

/** Príspevok karty v línii k bitke — štatistiky partií a simulácia sily kariet v tvorcovi. */
export interface KartaVBitke {
  readonly uid: number;
  readonly defId: string;
  readonly majitel: PlayerId;
  /** Akcie vytlačené na karte (bez modifikátorov Posilnenie/Odpor). */
  readonly akcii: number;
  /** Aktívne akcie karty vrátane násobkov (NA EX, Posilnenie). */
  readonly aktivne: number;
  /** Tuhé poškodenie z jej aktívnych akcií: Rana 1, Pecka 2, Petelica 3. */
  readonly tuhe: number;
  /** Aktívne kliatbové akcie (Hazard, Pečeň) — škodia majiteľovi. */
  readonly zle: number;
}

const TUHE: Partial<Record<Action, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };
const ZLE: readonly Action[] = ["Dlh", "PoškodeniePečene"];

/** Rozpis vyhodnotenej línie po kartách (lokalita sa nepočíta — nie je ničia). */
export function prispevkyKariet(line: LineState, ev: LineEval): KartaVBitke[] {
  const out: KartaVBitke[] = [];
  for (const placed of [...line.strany[0], ...line.strany[1]]) {
    const e = ev.cards.get(placed.card.uid);
    let akcii = 0;
    let aktivne = 0;
    let tuhe = 0;
    let zle = 0;
    for (const slot of [...(e?.left ?? []), ...(e?.right ?? [])]) {
      if (slot === null || MODIFIERS.includes(slot.action)) continue;
      akcii++;
      if (slot.stav !== "aktivna" || slot.nasobok === 0) continue;
      const ako = slot.ako ?? slot.action;
      aktivne += slot.nasobok;
      tuhe += (TUHE[ako] ?? 0) * slot.nasobok;
      if (ZLE.includes(ako)) zle += slot.nasobok;
    }
    out.push({ uid: placed.card.uid, defId: placed.card.defId, majitel: placed.playedBy, akcii, aktivne, tuhe, zle });
  }
  return out;
}
