// Výučba „Prvá hra“ (Michal 2026-10-23): naskriptovaná partia proti botovi
// Štamgast s pevným rozdaním. Scenár (JSON) určí rozdanie a kroky; v každom
// kroku je dovolený jediný príkaz (hráča) alebo ťah bota, prípadne len text
// majstra Melichara. Jadro rozdá, preloží odkazy na karty na uid a overí
// príkaz — server len posiela kroky klientovi. Žiadna náhoda mimo seedu.

import type { CardInstance, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { Command, GameState } from "./engine.ts";
import { apply, legalCommands, naTahu, setupZRozdania } from "./engine.ts";

/**
 * Karta v rozdaní: defId, voliteľne s variantom rozloženia akcií
 * „defId/ľavý/pravý“ (indexy do data.variants; predvolene 0/0).
 */
export type KartaRozdania = string;

export interface RozdanieHraca {
  /** Karty v ruke. */
  readonly ruka: readonly KartaRozdania[];
  /** Doberací balíček zhora nadol. */
  readonly doberaci: readonly KartaRozdania[];
  readonly cigarety?: number;
}

export interface Rozdanie {
  /** Semienko pre to, čo scenár neurčí (zamiešanie odhodených, varianty kariet spoločného balíčka). */
  readonly seed: number;
  /** Lokality v poradí, v akom prídu do hry — ich počet je dĺžka hry. */
  readonly lokality: readonly string[];
  /**
   * Scorecard pre každého staršieho (elderId → priazeň, napr. „UZERNIK“, alebo
   * id scorecardu); chýbajúci podľa seedu. Priazeň platí v každej sade.
   */
  readonly scorecardy?: Readonly<Record<string, string>>;
  /** Útočník prvého kola. */
  readonly utocnik: PlayerId;
  /** Hráč 0 je človek, hráč 1 bot. */
  readonly hraci: readonly [RozdanieHraca, RozdanieHraca];
  /** Spoločný balíček zhora nadol; balíčky stavby šenku sa berú z jeho vrchu. Bez neho ako v bežnej hre. */
  readonly spolocnyBalicek?: readonly KartaRozdania[];
}

/**
 * Príkaz v scenári: ako Command, len namiesto uid smie byť odkaz na kartu
 * „zóna:defId“ — ruka, linia (moja karta v línii), liniaSupera, senok,
 * lokality, stavba (môj balíček stavby šenku), priznane. Pri viacerých
 * rovnakých kartách „zóna:defId#2“ = druhá v poradí.
 */
export type PrikazScenara = Readonly<Record<string, unknown>> & { readonly type: Command["type"] };

export interface KrokVyucby {
  readonly id: string;
  /** hrac = čaká sa na jediný dovolený príkaz človeka; bot = ťah bota; info = len text a „ďalej“. */
  readonly kto: "hrac" | "bot" | "info";
  readonly prikaz?: PrikazScenara;
  /** Text majstra Melichara v bubline (môže byť prázdny pri ťahu bota). */
  readonly melichar: string;
  /** Čo v UI zvýrazniť: CSS selektory alebo id prvkov (dohoda s UX/UI). */
  readonly zvyraznit?: readonly string[];
}

export interface ScenarVyucby {
  readonly id: string;
  readonly nazov: string;
  /**
   * Vypínač (Michal 2026-10-23): kým nie je true, výučbu hráčom server
   * neponúkne ani nespustí — len správcom na skúšanie. Zapne sa až s hotovým
   * scenárom a UI.
   */
  readonly zverejnena?: boolean;
  readonly rozdanie: Rozdanie;
  readonly kroky: readonly KrokVyucby[];
}

/** Hráč človeka a bota vo výučbe. */
export const VYUCBA_HRAC: PlayerId = 0;
export const VYUCBA_BOT: PlayerId = 1;

/** Pole príkazu, ktoré nesie uid karty (alebo zoznam uid). */
const UID_POLIA = ["uid", "rukaUid", "senokUid", "cirhozaUid", "kartaUid"] as const;
const UID_ZOZNAMY = ["uids", "doSenku", "odhod"] as const;

function zona(state: GameState, kto: PlayerId, nazov: string): readonly CardInstance[] {
  const h = state.hraci[kto];
  const su: PlayerId = kto === 0 ? 1 : 0;
  switch (nazov) {
    case "ruka":
      return h.ruka;
    case "priznane":
      return h.priznane;
    case "odhodene":
      return h.odhadzovaci;
    case "senok":
      return state.senok;
    case "lokality":
      return state.lokalityVHre;
    case "stavba":
      return state.draftStav?.balicky[kto] ?? [];
    case "linia":
      return [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === kto).map((pl) => pl.card);
    case "liniaSupera":
      return [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === su).map((pl) => pl.card);
    default:
      throw new Error(`Neznáma zóna „${nazov}“ v odkaze na kartu.`);
  }
}

/** Odkaz „zóna:defId#n“ na uid karty v stave z pohľadu hráča `kto`. */
export function uidZOdkazu(state: GameState, kto: PlayerId, odkaz: string): number {
  const m = /^([a-zA-Z]+):([a-z_]+)(?:#(\d+))?$/.exec(odkaz);
  if (m === null) throw new Error(`Odkaz na kartu „${odkaz}“ nemá tvar zóna:defId alebo zóna:defId#n.`);
  const [, z, defId, n] = m as unknown as [string, string, string, string | undefined];
  const karty = zona(state, kto, z).filter((k) => k.defId === defId);
  const karta = karty[(n === undefined ? 1 : Number(n)) - 1];
  if (karta === undefined) throw new Error(`Karta „${odkaz}“ v zóne nie je (je ich tam ${karty.length}).`);
  return karta.uid;
}

/** Príkaz scenára → skutočný príkaz jadra (odkazy na karty preložené na uid). */
export function prikazZoScenara(state: GameState, kto: PlayerId, p: PrikazScenara): Command {
  const out: Record<string, unknown> = { ...p };
  for (const pole of UID_POLIA) {
    const v = out[pole];
    if (typeof v === "string") out[pole] = uidZOdkazu(state, kto, v);
  }
  for (const pole of UID_ZOZNAMY) {
    const v = out[pole];
    if (Array.isArray(v)) out[pole] = v.map((x: unknown) => (typeof x === "string" ? uidZOdkazu(state, kto, x) : x));
  }
  if (Array.isArray(out.kroky)) out.kroky = (out.kroky as PrikazScenara[]).map((k) => prikazZoScenara(state, kto, k));
  return out as unknown as Command;
}

/** Kanonický tvar príkazu na porovnanie: „tah“ s jediným krokom = ten krok, zoznamy uid zoradené. */
function kanonicky(c: Command): string {
  const x: Command = c.type === "tah" && c.kroky.length === 1 ? (c.kroky[0] as Command) : c;
  const o: Record<string, unknown> = { ...x };
  for (const pole of UID_ZOZNAMY) {
    const v = o[pole];
    if (Array.isArray(v)) o[pole] = [...(v as number[])].sort((a, b) => a - b);
  }
  if (Array.isArray(o.kroky)) o.kroky = (o.kroky as Command[]).map((k) => JSON.parse(kanonicky(k)) as unknown);
  return JSON.stringify(Object.keys(o).sort().reduce<Record<string, unknown>>((acc, k) => ((acc[k] = o[k]), acc), {}));
}

/** Je príkaz hráča ten, ktorý krok dovoľuje? */
export function zhodnyPrikaz(a: Command, b: Command): boolean {
  return kanonicky(a) === kanonicky(b);
}

/** Začiatok výučby: pevné rozdanie scenára. */
export function zacniVyucbu(data: GameData, scenar: ScenarVyucby): GameState {
  return setupZRozdania(data, scenar.rozdanie);
}

/** Výsledok prehratia scenára po krok `po` (bez neho). */
export interface StavVyucby {
  readonly state: GameState;
  /** Index nasledujúceho kroku (= počet vykonaných). */
  readonly krok: number;
}

/**
 * Vykoná krok `i` scenára nad stavom: krok hráča alebo bota príkazom jadra,
 * info nič. Vyhodí chybu, keď príkaz nie je v jadre legálny (scenár nesedí).
 */
export function vykonajKrok(data: GameData, scenar: ScenarVyucby, state: GameState, i: number): GameState {
  const krok = scenar.kroky[i];
  if (krok === undefined) throw new Error(`Scenár nemá krok ${i}.`);
  if (krok.kto === "info") return state;
  const kto = krok.kto === "hrac" ? VYUCBA_HRAC : VYUCBA_BOT;
  if (krok.prikaz === undefined) throw new Error(`Krok ${krok.id}: ${krok.kto} bez príkazu.`);
  const cmd = prikazZoScenara(state, kto, krok.prikaz);
  return apply(data, state, cmd, kto).state;
}

/** Stav po prvých `n` krokoch — pokračovanie výučby po návrate hráča. */
export function prehrajVyucbu(data: GameData, scenar: ScenarVyucby, n: number): GameState {
  let state = zacniVyucbu(data, scenar);
  for (let i = 0; i < Math.min(n, scenar.kroky.length); i++) state = vykonajKrok(data, scenar, state, i);
  return state;
}

/** Príkaz, ktorý krok `i` čaká od hráča (uid už preložené), alebo null pri info a bote. */
export function ocakavanyPrikaz(scenar: ScenarVyucby, state: GameState, i: number): Command | null {
  const krok = scenar.kroky[i];
  if (krok === undefined || krok.kto !== "hrac" || krok.prikaz === undefined) return null;
  return prikazZoScenara(state, VYUCBA_HRAC, krok.prikaz);
}

/**
 * Kontrola scenára pre testy a nástroj: každý krok hráča a bota je v jadre
 * legálny a je na ťahu ten, komu krok patrí. Vracia prvú chybu, alebo null.
 */
export function overScenar(data: GameData, scenar: ScenarVyucby): string | null {
  let state: GameState;
  try {
    state = zacniVyucbu(data, scenar);
  } catch (e) {
    return `Rozdanie: ${(e as Error).message}`;
  }
  for (const [i, krok] of scenar.kroky.entries()) {
    if (krok.kto === "info") continue;
    const kto = krok.kto === "hrac" ? VYUCBA_HRAC : VYUCBA_BOT;
    try {
      const cmd = prikazZoScenara(state, kto, krok.prikaz ?? { type: "pass" });
      if (naTahu(state) !== kto && !(state.faza === "draft" && state.draftStav?.krok === "stavba")) {
        return `Krok ${i} (${krok.id}): na ťahu je hráč ${naTahu(state)}, nie ${krok.kto}.`;
      }
      const legal = legalCommands(data, state, kto);
      // Stavba šenku a ťah naraz sa medzi legálnymi nevymenúvajú všetky — overí ich apply.
      if (cmd.type !== "stavbaSenku" && cmd.type !== "tah" && !legal.some((l) => zhodnyPrikaz(l, cmd))) {
        return `Krok ${i} (${krok.id}): ${JSON.stringify(cmd)} nie je legálny ťah.`;
      }
      state = apply(data, state, cmd, kto).state;
    } catch (e) {
      return `Krok ${i} (${krok.id}): ${(e as Error).message}`;
    }
  }
  return null;
}
