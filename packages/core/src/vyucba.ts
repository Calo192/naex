// Výučba „Prvá hra“ (Michal 2026-10-23): naskriptovaná partia proti botovi
// Štamgast s pevným rozdaním. Scenár (JSON) určí rozdanie a kroky; v každom
// kroku je dovolený jediný príkaz (hráča) alebo ťah bota, prípadne len text
// majstra Melichara. Jadro rozdá, preloží odkazy na karty na uid a overí
// príkaz — server len posiela kroky klientovi. Žiadna náhoda mimo seedu.

import type { CardInstance, PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
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
  /**
   * Bez `rozpis`: lokality v poradí, v akom prídu do hry — ich počet je dĺžka hry.
   * S `rozpis`: zásoba lokalít, z ktorej obranca vyberá lokalitu úrovne kola (v7).
   */
  readonly lokality: readonly string[];
  /**
   * Úrovne lokalít po kolách vrátane finále (v7, napr. [1, 2, 3, 4]): výučba hrá
   * ako bežná hra s rozpisom, dĺžka hry je počet úrovní bez finále. Učí, že čím
   * vyššie kolo, tým viac akcií na hrane lokality (Michal 2026-10-27).
   */
  readonly rozpis?: readonly number[];
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

/** Možnosť kontrolnej otázky (Michal 2026-10-23, UX N2): 2–3 možnosti, aspoň jedna správna. */
export interface MoznostOtazky {
  readonly text: string;
  readonly spravna: boolean;
  readonly vysvetlenie: string;
  /** Hláška Melichara po kliku na túto (zlú) odpoveď. */
  readonly hlaska?: HlaskaScenara;
}

/**
 * Hláška zo soundboardu Melichara (Michal 2026-10-27): „skupina/súbor bez prípony“
 * z data/majster_melichar, napr. „udiv/09_Boha“. Text bubliny ostáva, hláška je
 * len zvuk navyše.
 */
export type HlaskaScenara = string;

/**
 * Rozhodnutie hráča v kroku „hrac“: UI zvýrazní kandidátov namiesto očakávanej
 * karty a zlý ťah dostane radu Melichara (zle podľa vzoru, inak) — nie chybu.
 * Vzor porovná len uvedené polia; odkazy „zóna:defId“ ako v prikaz.
 */
export interface VolbaKroku {
  readonly kandidati: readonly string[];
  readonly zle?: readonly { readonly prikaz: PrikazScenara; readonly text: string; readonly hlaska?: HlaskaScenara }[];
  readonly inak: string;
}

export interface KrokVyucby {
  readonly id: string;
  /**
   * hrac = čaká sa na jediný dovolený príkaz človeka; bot = ťah bota; info = len text a „ďalej“;
   * auto = príkaz hráča, ktorý hra vykoná sama ako ťah bota (Navrhár 2026-10-23: kolo 2 bez
   * opakovania toho, čo hráč už vie). prikaz je pri hrac, bot aj auto povinný.
   */
  readonly kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  /** Pri otázke (text otázky je melichar). */
  readonly moznosti?: readonly MoznostOtazky[];
  /** Pri kroku hráča, ktorý je rozhodnutím. */
  readonly volba?: VolbaKroku;
  readonly prikaz?: PrikazScenara;
  /** Text majstra Melichara v bubline (môže byť prázdny pri ťahu bota). */
  readonly melichar: string;
  /** Hláška s bublinou kroku; pri ťahu bota či hry za hráča zaznie až po ťahu (reakcia). */
  readonly hlaska?: HlaskaScenara;
  /** Čo v UI zvýrazniť: CSS selektory alebo id prvkov (dohoda s UX/UI). */
  readonly zvyraznit?: readonly string[];
  /** Nápis tlačidla „ďalej“ pri info kroku (napr. „Odovzdať cigaretu“). */
  readonly tlacidlo?: string;
  /**
   * Info krok: „ďalej“ odovzdá Melicharovi 1 hernú cigaretu z baru hráča (Michal
   * 2026-10-25) — mení partiu, preto ho jadro prehrá aj pri návrate do výučby.
   */
  readonly odovzdaCigaretu?: boolean;
  /** Pri kroku ponúknuť aj „Preskočiť výučbu“ (Michal 2026-10-25: úvod s cigaretou). */
  readonly preskocenie?: boolean;
  /**
   * Info krok: so zvýraznenými prvkami sa hráč smie hrať nanečisto (stavba šenku, Michal
   * 2026-10-25) — serveru sa nič neposiela, platí až príkaz ďalšieho kroku.
   */
  readonly naneisto?: boolean;
}

export interface ScenarVyucby {
  readonly id: string;
  readonly nazov: string;
  /**
   * Časť výučby (Michal 2026-10-25: výučba po častiach, hviezdička za každú) —
   * dokončenie scenára dá achievement Prvá hra s týmto rankom. Bez nej 1.
   */
  readonly cast?: number;
  /**
   * Verzia krokov: uložený postup inej verzie nesedí na kroky (iné poradie aj
   * počet), preto rozohraná výučba so starou verziou začne odznova.
   */
  readonly verzia?: string;
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

/** Pauza pred ťahom bez komentára — UI stihne dosvietiť, čo sa stalo (ms). */
export const PAUZA_TICHA_MS = 1_500;
/**
 * Pauza pred ťahom s komentárom Melichara (UX/UI 2026-10-24, playtest výučby U5):
 * ťah sa vykoná a krok čaká na „ďalej“ — hráč číta text aj výsledok naraz.
 */
export const PAUZA_PRED_TAHOM_MS = 700;

/** Ako dlho počkať pred krokom, ktorý hra spraví sama (bot, auto). */
export function pauzaKrokuVyucby(krok: KrokVyucby): number {
  return cakaNaDalej(krok) ? PAUZA_PRED_TAHOM_MS : PAUZA_TICHA_MS;
}

/**
 * Ťah bota či auto krok s textom Melichara sa po vykonaní neposunie sám, čaká na
 * „ďalej“ (playtest výučby U5: hra preskočila 3–5 krokov naraz). Bez textu ide sám.
 */
export const cakaNaDalej = (krok: KrokVyucby): boolean => (krok.kto === "bot" || krok.kto === "auto") && krok.melichar.trim() !== "";

/** Za koho sa krok vykoná — auto je príkaz hráča, len ho zahrá hra. */
export const ktoVykona = (krok: KrokVyucby): PlayerId => (krok.kto === "bot" ? VYUCBA_BOT : VYUCBA_HRAC);

/** Pole príkazu, ktoré nesie uid karty (alebo zoznam uid). */
const UID_POLIA = ["uid", "rukaUid", "senokUid", "cirhozaUid", "kartaUid"] as const;
const UID_ZOZNAMY = ["uids", "doSenku", "odhod"] as const;

function zona(state: GameState, kto: PlayerId, nazov: string): readonly CardInstance[] {
  const h = state.hraci[kto];
  const su = opponentOf(kto);
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

/**
 * Kľúče na zvýraznenie pre klienta: „zóna:defId#n“ → „uid:N“ (UX/UI 2026-10-23 —
 * poradie kariet v ruke si hráč mení lokálne, klient #n nevie preložiť). Ostatné
 * kľúče ostávajú; odkaz na kartu, ktorá v zóne nie je, tiež.
 */
export function prelozKluceZvyraznenia(state: GameState, kluce: readonly string[]): string[] {
  return kluce.map((k) => {
    if (!/^[a-zA-Z]+:[a-z_]+#\d+$/.test(k)) return k;
    try {
      return `uid:${uidZOdkazu(state, VYUCBA_HRAC, k)}`;
    } catch {
      return k;
    }
  });
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
 * Hráč dá Melicharovi 1 cigaretu zo svojho baru (za výučbu). Nie je to ťah
 * pravidiel, preto nejde cez apply — jadro ju len uberie.
 */
export function odovzdajCigaretu(state: GameState): GameState {
  const h = state.hraci[VYUCBA_HRAC];
  if (h.cigarety < 1) throw new Error("Hráč nemá cigaretu, ktorú by odovzdal Melicharovi.");
  const hraci: [GameState["hraci"][0], GameState["hraci"][1]] = [state.hraci[0], state.hraci[1]];
  hraci[VYUCBA_HRAC] = { ...h, cigarety: h.cigarety - 1 };
  return { ...state, hraci };
}

/**
 * Vykoná krok `i` scenára nad stavom: krok hráča alebo bota príkazom jadra,
 * info nič (okrem odovzdania cigarety). Vyhodí chybu, keď príkaz nie je
 * v jadre legálny (scenár nesedí).
 */
export function vykonajKrok(data: GameData, scenar: ScenarVyucby, state: GameState, i: number): GameState {
  const krok = scenar.kroky[i];
  if (krok === undefined) throw new Error(`Scenár nemá krok ${i}.`);
  if (krok.kto === "info") return krok.odovzdaCigaretu === true ? odovzdajCigaretu(state) : state;
  if (krok.kto === "otazka") return state;
  const kto = ktoVykona(krok);
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
    // Hláška v zlom tvare by v klientovi potichu nezaznela — chyba patrí do testu scenára.
    const zlaHlaska = [krok.hlaska, ...(krok.volba?.zle ?? []).map((z) => z.hlaska), ...(krok.moznosti ?? []).map((m) => m.hlaska)].find(
      (h) => h !== undefined && castiHlasky(h) === null,
    );
    if (zlaHlaska !== undefined) return `Krok ${i} (${krok.id}): hláška „${zlaHlaska}“ nemá tvar skupina/súbor.`;
    if (krok.kto === "otazka") {
      const chyba = chybaOtazky(krok);
      if (chyba !== null) return `Krok ${i} (${krok.id}): ${chyba}`;
      continue;
    }
    if (krok.kto === "info") {
      if (krok.naneisto === true && (krok.zvyraznit ?? []).length === 0) return `Krok ${i} (${krok.id}): naneisto bez zvýraznených prvkov — hráč by nemal s čím hýbať.`;
      try {
        state = vykonajKrok(data, scenar, state, i);
      } catch (e) {
        return `Krok ${i} (${krok.id}): ${(e as Error).message}`;
      }
      continue;
    }
    if (krok.odovzdaCigaretu === true || krok.naneisto === true) return `Krok ${i} (${krok.id}): odovzdaCigaretu a naneisto patria len k info kroku.`;
    const kto = ktoVykona(krok);
    if (krok.prikaz === undefined) return `Krok ${i} (${krok.id}): ${krok.kto} bez príkazu.`;
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
      if (krok.volba !== undefined) {
        const chyba = chybaVolby(state, krok.volba, cmd);
        if (chyba !== null) return `Krok ${i} (${krok.id}): ${chyba}`;
      }
      state = apply(data, state, cmd, kto).state;
    } catch (e) {
      return `Krok ${i} (${krok.id}): ${(e as Error).message}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zlý ťah vo výučbe: čo chýba a čo je navyše (playtest výučby 20261023-161148,
// návrh 1 — server odmietal čiastočný viackartový ťah bez vysvetlenia).

/** Krok príkazu tak, ako ho treba povedať hráčovi; uid = karta na zvýraznenie. */
export interface PopisKroku {
  readonly typ: Command["type"];
  readonly popis: string;
  readonly uid: number | null;
}

export interface PorovnanieSKrokom {
  /** Ťah zodpovedá kroku (aj s inou, no rovnakou kartou — rovnaké defId a variant). */
  readonly zhoda: boolean;
  readonly chybajuce: readonly PopisKroku[];
  readonly navyse: readonly PopisKroku[];
}

/** Všetky karty v hre, ktoré môže príkaz menovať. */
function kartaPodlaUid(state: GameState, uid: number): CardInstance | null {
  const zony: (readonly CardInstance[])[] = [state.senok, state.lokalityVHre, ...(state.draftStav?.balicky ?? [])];
  for (const h of state.hraci) zony.push(h.ruka, h.doberaci, h.odhadzovaci, h.priznane);
  for (const strana of state.strany) zony.push(strana.map((pl) => pl.card));
  for (const z of zony) {
    const k = z.find((x) => x.uid === uid);
    if (k !== undefined) return k;
  }
  return null;
}

/** Meno staršieho podľa karty na jeho scorecarde (U3: „Klikni na Farára“, nie „urob ťah“). */
const menoStarsieho = (data: GameData, state: GameState, elderId: string): string => {
  const e = state.starsi.find((x) => x.elderId === elderId);
  return e === undefined ? elderId : defOf(data, e.karta).name;
};

const menoKarty = (data: GameData, state: GameState, uid: number): string => {
  const k = kartaPodlaUid(state, uid);
  return k === null ? "?" : defOf(data, k).name;
};

/** Karta bez uid: dve karty s rovnakým podpisom sú vo výučbe zameniteľné. */
const podpis = (state: GameState, uid: number): string => {
  const k = kartaPodlaUid(state, uid);
  return k === null ? `uid:${uid}` : `${k.defId}/${k.leftLayout}/${k.rightLayout}`;
};

/** Kroky príkazu („tah“ = jeho kroky, inak príkaz sám). */
const krokyPrikazu = (c: Command): readonly Command[] => (c.type === "tah" ? c.kroky : [c]);

/** Kľúč kroku na porovnanie: uid nahradené podpisom karty, zoznamy zoradené. */
function klucKroku(state: GameState, c: Command): string {
  const o: Record<string, unknown> = { ...c };
  for (const pole of UID_POLIA) if (typeof o[pole] === "number") o[pole] = podpis(state, o[pole] as number);
  for (const pole of UID_ZOZNAMY) if (Array.isArray(o[pole])) o[pole] = (o[pole] as number[]).map((u) => podpis(state, u)).sort();
  return JSON.stringify(Object.keys(o).sort().reduce<Record<string, unknown>>((acc, k) => ((acc[k] = o[k]), acc), {}));
}

const KAM: Readonly<Record<string, string>> = {
  vlastna: "na svoju stranu línie",
  superova: "na súperovu stranu línie",
  priznanie: "medzi priznané",
  dedicstvo: "do Dedičstva",
};

/** Krok slovami pre hráča — „polož kartu „Hasič“ na svoju stranu línie“, „vypi poldeci“. */
export function popisKroku(data: GameData, state: GameState, c: Command): PopisKroku {
  const uid = "uid" in c && typeof c.uid === "number" ? c.uid : null;
  const karta = uid === null ? null : kartaPodlaUid(state, uid);
  const nazov = karta === null ? "kartu, ktorá svieti" : `kartu „${defOf(data, karta).name}“`;
  const ciel = "target" in c && typeof c.target === "string" ? (KAM[c.target] ?? "") : "";
  const popis = ((): string => {
    switch (c.type) {
      case "place":
        return `polož ${nazov} ${ciel}`.trim();
      case "zaverecna":
        return `zahraj ${nazov} lícom dole ako Záverečnú`;
      case "naex":
        return `daj NA EX! na ${nazov}`;
      case "vypit":
        return "vypi poldeci (Vypiť)";
      case "pass":
        return "pasuj";
      case "skipNaex":
        return "bez NA EX!";
      case "draftStop":
        return "klikni Už neťahám";
      case "draftBer":
        return `vezmi zo šenku ${c.uids.map((u) => `„${menoKarty(data, state, u)}“`).join(", ")}`;
      case "chooseLocation":
        return `vyber ${nazov}`;
      case "prebytok":
        return `posuň prebytkom staršieho „${menoStarsieho(data, state, c.elderId)}“`;
      case "pohorsenie":
        return `posuň Pohoršením staršieho „${menoStarsieho(data, state, c.elderId)}“`;
      case "patronat":
        return `vezmi si staršieho „${menoStarsieho(data, state, c.elderId)}“ (patronát)`;
      case "bezPatronatu":
        return "patronát vynechaj";
      default:
        return "urob ťah, ktorý svieti";
    }
  })();
  return { typ: c.type, popis, uid };
}

/**
 * Porovná ťah hráča s krokom scenára po krokoch (poradie nerozhoduje). Pri
 * stavbe šenku porovná karty na Smetisku. Karty s rovnakým defId a variantom
 * sú zameniteľné — server potom vykoná krok zo scenára.
 */
export function porovnajSKrokom(data: GameData, state: GameState, prijaty: Command, ocakava: Command): PorovnanieSKrokom {
  if (prijaty.type === "stavbaSenku" && ocakava.type === "stavbaSenku") {
    const chce = ocakava.doSenku.map((u) => ({ k: podpis(state, u), u }));
    const dal = prijaty.doSenku.map((u) => ({ k: podpis(state, u), u }));
    const zostava = [...dal];
    const chybajuce: PopisKroku[] = [];
    for (const c of chce) {
      const i = zostava.findIndex((d) => d.k === c.k);
      if (i >= 0) zostava.splice(i, 1);
      else chybajuce.push({ typ: "stavbaSenku", popis: `daj na Smetisko aj „${menoKarty(data, state, c.u)}“`, uid: c.u });
    }
    const navyse = zostava.map((d): PopisKroku => ({ typ: "stavbaSenku", popis: `„${menoKarty(data, state, d.u)}“ na Smetisko nepatrí`, uid: d.u }));
    return { zhoda: chybajuce.length === 0 && navyse.length === 0, chybajuce, navyse };
  }
  const zostava = krokyPrikazu(prijaty).map((c) => ({ c, k: klucKroku(state, c) }));
  const chybajuce: PopisKroku[] = [];
  for (const c of krokyPrikazu(ocakava)) {
    const k = klucKroku(state, c);
    const i = zostava.findIndex((x) => x.k === k);
    if (i >= 0) zostava.splice(i, 1);
    else chybajuce.push(popisKroku(data, state, c));
  }
  const navyse = zostava.map((x) => popisKroku(data, state, x.c));
  return { zhoda: chybajuce.length === 0 && navyse.length === 0, chybajuce, navyse };
}

/** Veta pre hráča zo zlého ťahu: čo ešte chýba a čo v tomto kroku nerobiť. */
export function textChybyKroku(p: PorovnanieSKrokom): string {
  const casti: string[] = [];
  if (p.chybajuce.length > 0) casti.push(`ešte chýba: ${p.chybajuce.map((x) => x.popis).join(", ")}`);
  if (p.navyse.length > 0) casti.push(`toto teraz nie: ${p.navyse.map((x) => x.popis).join(", ")}`);
  return casti.length === 0 ? "Takto nie — urob to, čo svieti na stole." : `Takto nie — ${casti.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Kontrolné otázky a rozhodnutia (Michal 2026-10-23, UX N2)

function chybaOtazky(krok: KrokVyucby): string | null {
  const m = krok.moznosti ?? [];
  if (krok.prikaz !== undefined) return "otázka nemá mať prikaz";
  if (m.length < 2 || m.length > 3) return "otázka má mať 2 – 3 možnosti";
  // Obe možnosti smú byť správne (Michal 2026-10-25, q-naex) — hráč klikne jednu a je dobre.
  if (!m.some((x) => x.spravna === true)) return "otázka má mať aspoň jednu správnu možnosť";
  if (m.some((x) => typeof x.text !== "string" || x.text.trim() === "" || typeof x.vysvetlenie !== "string" || x.vysvetlenie.trim() === "")) {
    return "každá možnosť potrebuje text aj vysvetlenie";
  }
  return null;
}

function chybaVolby(state: GameState, volba: VolbaKroku, spravny: Command): string | null {
  if (!Array.isArray(volba.kandidati) || volba.kandidati.length === 0) return "rozhodnutie potrebuje kandidátov";
  if (typeof volba.inak !== "string" || volba.inak.trim() === "") return "rozhodnutie potrebuje text inak";
  for (const z of volba.zle ?? []) {
    if (zodpovedaVzoru(state, spravny, z.prikaz)) return `vzor zlého ťahu „${z.text}“ sedí aj na správny ťah`;
  }
  return null;
}

/** Krok ťahu zodpovedá vzoru: každé pole vzoru sa zhoduje (karty podľa podpisu). */
function krokZodpoveda(state: GameState, krok: Command, vzor: Command): boolean {
  const k = krok as unknown as Record<string, unknown>;
  for (const [pole, v] of Object.entries(vzor as unknown as Record<string, unknown>)) {
    const x = k[pole];
    if ((UID_POLIA as readonly string[]).includes(pole) && typeof v === "number") {
      if (typeof x !== "number" || podpis(state, x) !== podpis(state, v)) return false;
    } else if ((UID_ZOZNAMY as readonly string[]).includes(pole) && Array.isArray(v)) {
      if (!Array.isArray(x) || JSON.stringify((x as number[]).map((u) => podpis(state, u)).sort()) !== JSON.stringify((v as number[]).map((u) => podpis(state, u)).sort())) return false;
    } else if (JSON.stringify(x) !== JSON.stringify(v)) return false;
  }
  return true;
}

/**
 * Zodpovedá príkaz vzoru zlého ťahu? Vzor „tah“: každý jeho krok musí byť
 * v ťahu; iný vzor stačí, keď sedí na niektorý krok ťahu.
 */
export function zodpovedaVzoru(state: GameState, prikaz: Command, vzorScenara: PrikazScenara): boolean {
  let vzor: Command;
  try {
    vzor = prikazZoScenara(state, VYUCBA_HRAC, vzorScenara);
  } catch {
    // Vzor menuje kartu, ktorá v stave nie je — na tento ťah nesedí.
    return false;
  }
  const kroky = krokyPrikazu(prikaz);
  if (vzor.type === "tah" && Array.isArray(vzor.kroky)) return vzor.kroky.every((v) => kroky.some((k) => krokZodpoveda(state, k, v)));
  return kroky.some((k) => krokZodpoveda(state, k, vzor));
}

/** Rada Melichara k zlému ťahu: text a hláška zo soundboardu (null = bez zvuku). */
export interface RadaVyucby {
  readonly text: string;
  readonly hlaska: HlaskaScenara | null;
}

/** Rada Melichara k zlému ťahu v rozhodnutí: prvý sediaci vzor, inak všeobecná (tá je bez hlášky). */
export function radaVyucby(state: GameState, volba: VolbaKroku, prikaz: Command): RadaVyucby {
  const zly = (volba.zle ?? []).find((z) => zodpovedaVzoru(state, prikaz, z.prikaz));
  return zly === undefined ? { text: volba.inak, hlaska: null } : { text: zly.text, hlaska: zly.hlaska ?? null };
}

export function radaKVolbe(state: GameState, volba: VolbaKroku, prikaz: Command): string {
  return radaVyucby(state, volba, prikaz).text;
}

/** Skupina a súbor bez prípony z hlášky scenára; null pri zlom tvare. */
export function castiHlasky(hlaska: HlaskaScenara): { readonly skupina: string; readonly meno: string } | null {
  // Skupina ako id skupiny pri importe (SKUPINA_RE v server/hudba.ts).
  const m = /^([a-z0-9][a-z0-9-]*)\/([^/]+)$/.exec(hlaska.trim());
  return m?.[1] === undefined || m[2] === undefined ? null : { skupina: m[1], meno: m[2] };
}

/**
 * Text hlášky z názvu súboru: „03_no_toto_je_marha“ → „No toto je marha“. Import ho
 * ukladá ako nazov — klient podľa neho nájde hlášku aj v zozname bez poľa meno.
 */
export function nazovHlasky(meno: string): string {
  // Poradové číslo má najviac dve cifry — „1500_korun“ je hláška o 1500 korunách.
  const text = meno.replace(/^\d{1,2}[_\s-]+/, "").replace(/_+/g, " ").trim();
  return text.charAt(0).toLocaleUpperCase("sk") + text.slice(1);
}
