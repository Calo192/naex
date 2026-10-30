// Achievementy (Michal 2026-10-23): hráč za výkony v partiách zbiera ocenenia
// s rankami ★1–★3. Achievementy sú DÁTA (data/achievementy.json, píše ich
// Navrhár): názov, popis, metrika, rozsah, prahy. Logika je len v pomenovaných
// metrikách tu — nový achievement nad existujúcou metrikou nepotrebuje kód.
//
// Metrika je čistá funkcia nad krokom partie (pred, príkaz, po, udalosti) —
// hodnota pre oboch hráčov. Väčšinu metrík dávajú štatistiky partie
// (statistiky.ts): „stat.<pole>“ je prírastok počítadla v kroku, „akcia.<Akcia>“
// a „body.<Podmienka>“ prírastky ich máp; vlastné metriky sú vo VLASTNE.
//
// Rozsah určuje okno, v ktorom sa metrika sčíta (sucet) alebo berie maximum
// (max): jedna bitka, jedna Pitka, jedno kolo, celá partia; „kariera“ je súčet
// partií na serveri (rátané od spustenia, nič spätne). Metriky so séria
// (najdlhšia séria) a rozne (počet rôznych — povahy, súperi) majú zmysel len
// v kariére. Rank = počet prahov, ktoré hodnota dosiahla. Čo sa ráta proti
// komu (ľudia / bot), AI účty a ukladanie stráži server — jadro len počíta.

import type { PlayerId } from "./types.ts";
import { ALL_ACTIONS, ALL_PODMIENKY, opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { Command, Event, GameState } from "./engine.ts";
import { bitkyNaSekere, prahVydesenia } from "./engine.ts";
import type { DvojicaStatistik, StatistikyHraca } from "./statistiky.ts";
import { noveStatistiky, prazdneStatistiky, uzavriStatistiky, zapisTah } from "./statistiky.ts";
import type { StavKroniky } from "./kronika.ts";
import { novaKronika, zapisDoKroniky } from "./kronika.ts";
import type { TypMomentu } from "./momenty.ts";
import { MOMENTY, momenty } from "./momenty.ts";
import { priazenHraca, vydesil } from "./elders.ts";
import { prevahaStran } from "./partia.ts";
import { DLZKY_HRY } from "./constants.ts";
import { POVAHY } from "./bot.ts";

export const ROZSAHY = ["bitka", "pitka", "kolo", "partia", "kariera"] as const;
export type RozsahAchievementu = (typeof ROZSAHY)[number];
/** sucet a max volí achievement; seria a rozne dáva metrika (len kariéra). */
export type Agregacia = "sucet" | "max" | "seria" | "rozne";
/** V ktorých partiách sa achievement ráta: len proti ľuďom, len proti botovi, alebo v oboch. */
export type ProtiKomu = "ludia" | "bot" | "vsetky";

export interface Achievement {
  readonly id: string;
  readonly nazov: string;
  readonly kategoria: string | null;
  /** Text s „{prah}“ — dosadí sa prah ranku. */
  readonly popis: string;
  readonly metrika: string;
  readonly rozsah: RozsahAchievementu;
  readonly agregacia: Agregacia;
  /** Prahy rankov ★1–★3, rastúce. */
  readonly prahy: readonly number[];
  readonly proti: ProtiKomu;
  readonly tajny: boolean;
  /** Čo vidno pri tajnom, kým ho hráč nemá (predvolene „???“). */
  readonly tajnyText: string | null;
  readonly piktogram: string | null;
  /** Odhad vzácnosti ranku pre UI (bezne / nezvycajne / vzacne). */
  readonly zriedkavost: readonly string[];
}

export interface KatalogAchievementov {
  readonly verzia: number;
  /**
   * Vypínač (Michal 2026-10-23): kým nie je true, server achievementy nepočíta,
   * neukladá ani neposiela — zoznam a prahy čakajú na schválenie, UI chýba.
   */
  readonly zapnute: boolean;
  readonly kategorie: readonly { readonly id: string; readonly nazov: string }[];
  readonly achievementy: readonly Achievement[];
}

// ---------------------------------------------------------------------------
// Metriky

/** Čo o partii vie len server: povaha bota a účty súperov (pre „rôznych súperov“). */
export interface KontextPartie {
  readonly botPovaha: string | null;
  /** Id účtu súpera každého hráča (null = bot alebo bez účtu). */
  readonly superi: readonly [string | null, string | null];
}

export const BEZ_KONTEXTU: KontextPartie = { botPovaha: null, superi: [null, null] };

export interface KrokMetriky {
  readonly data: GameData;
  readonly pred: GameState;
  readonly cmd: Command;
  readonly autor: PlayerId;
  readonly po: GameState;
  readonly udalosti: readonly Event[];
  readonly statPred: DvojicaStatistik;
  readonly statPo: DvojicaStatistik;
  readonly kronikaPred: StavKroniky;
  readonly kronikaPo: StavKroniky;
  readonly kontext: KontextPartie;
  /** Partia sa týmto krokom vzdala (aj kontumácia) — koncové metriky nič nedajú. */
  readonly vzdane: boolean;
}

/** Hodnota metriky v kroku pre hráča 0 a 1; null = v kroku sa nič nestalo. */
export type Meranie = readonly [number | null, number | null];

export interface Metrika {
  readonly druh: Agregacia;
  readonly popis: string;
  readonly zmer: (k: KrokMetriky) => Meranie;
  /** Pri druhu „rozne“: čo sa ráta ako rôzne (povaha, súper). */
  readonly stitok?: (k: KrokMetriky, p: PlayerId) => string | null;
}

const OBA = [0, 1] as const;
const pre = (f: (p: PlayerId) => number | null): Meranie => [f(0), f(1)];
const ak = (b: boolean, v = 1): number | null => (b ? v : null);

/** Krok, ktorým sa partia skončila inak než vzdaním. */
const dohrata = (k: KrokMetriky): boolean => k.pred.koniec === null && k.po.koniec !== null && !k.vzdane;
const vyhral = (k: KrokMetriky, p: PlayerId): boolean => dohrata(k) && k.po.koniec?.vitaz === p;
const bitky = (k: KrokMetriky) => k.udalosti.flatMap((e) => (e.type === "bitkaVysledok" ? [e] : []));
const vydesenim = (k: KrokMetriky, p: PlayerId): boolean =>
  k.po.koniec?.body == null && k.po.starsi.filter((e) => vydesil(e, p)).length >= prahVydesenia(k.po);
/** NA EX hráča p v kronike s daným výsledkom (všetky kolá). */
const naexy = (kr: StavKroniky, p: PlayerId, uspech: boolean): number =>
  [...kr.kola, kr.kolo].reduce((n, kolo) => n + kolo.naex.filter((x) => x.kto === p && x.uspech === uspech).length, 0);
const zaverecne = (cmd: Command): number => (cmd.type === "zaverecna" ? 1 : cmd.type === "tah" ? cmd.kroky.reduce((n, c) => n + zaverecne(c), 0) : 0);
const prirastok = (po: number, pred: number): number | null => (po > pred ? po - pred : null);

/** Polia štatistík, ktoré nie sú výkon hráča v kroku (počet partií v súčte, NA EX z kroniky na konci). */
const NIE_METRIKY: ReadonlySet<string> = new Set(["partie", "partieV2", "bodovanePartie", "naexHodnotene", "naexUspesne"]);
const REKORDY: ReadonlySet<string> = new Set(["najvacsiZasah", "najviacBodov"]);

const VLASTNE: Readonly<Record<string, Metrika>> = {
  // ---- koniec partie
  vyhra: { druh: "sucet", popis: "1 za vyhratú partiu (nie vzdaním súpera)", zmer: (k) => pre((p) => ak(vyhral(k, p))) },
  prehra: {
    druh: "sucet",
    popis: "1 za prehratú partiu (nie vlastným vzdaním)",
    zmer: (k) => pre((p) => ak(dohrata(k) && k.po.koniec?.vitaz != null && k.po.koniec.vitaz !== p)),
  },
  remiza: { druh: "sucet", popis: "1 za remízu", zmer: (k) => pre(() => ak(dohrata(k) && k.po.koniec?.vitaz === null)) },
  dohrataPartia: { druh: "sucet", popis: "1 za dohratú partiu (bez vzdania)", zmer: (k) => pre(() => ak(dohrata(k))) },
  // Výučba „Prvá hra“ nie je partia s achievementmi — achievement s touto metrikou udelí server na jej konci.
  vyucba: { druh: "sucet", popis: "dokončené časti výučby Prvá hra (udeľuje server, v partii nič)", zmer: () => [null, null] },
  rozdielBodov: {
    druh: "max",
    popis: "o koľko špakov hráč vyhral partiu",
    zmer: (k) =>
      pre((p) => {
        const body = k.po.koniec?.body;
        return vyhral(k, p) && body != null ? body[p] - body[opponentOf(p)] : null;
      }),
  },
  "vyhra.kratka": { druh: "sucet", popis: "výhra v krátkej hre", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.po.lokalitCelkom === DLZKY_HRY.kratka)) },
  "vyhra.stredna": { druh: "sucet", popis: "výhra v strednej hre", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.po.lokalitCelkom === DLZKY_HRY.stredna)) },
  "vyhra.dlha": { druh: "sucet", popis: "výhra v dlhej hre", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.po.lokalitCelkom === DLZKY_HRY.dlha)) },
  vyhraVydesenim: { druh: "sucet", popis: "výhra udržaným vydesením starších", zmer: (k) => pre((p) => ak(vyhral(k, p) && vydesenim(k, p))) },
  vyhraKnockoutom: {
    druh: "sucet",
    popis: "výhra, lebo súper nečelil exekúcii alebo mu balíček klesol pod 5",
    zmer: (k) => pre((p) => ak(vyhral(k, p) && k.po.koniec?.body == null && !vydesenim(k, p))),
  },
  vyhraSMenejBitkami: {
    druh: "sucet",
    popis: "výhra, hoci súper vyhral viac bitiek",
    zmer: (k) => pre((p) => ak(vyhral(k, p) && k.statPo[p].bitkyVyhrane < k.statPo[opponentOf(p)].bitkyVyhrane)),
  },
  vyhraPoExekucii: { druh: "sucet", popis: "výhra v partii, v ktorej hráč čelil exekúcii", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.statPo[p].exekucie > 0)) },
  vyhraBezDlhu: { druh: "sucet", popis: "výhra bez jediného Dlhu na konci", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.statPo[p].dlhyNaKonci === 0)) },
  vyhraPrazdneVrecka: { druh: "sucet", popis: "výhra s 0 cigaretami na konci", zmer: (k) => pre((p) => ak(vyhral(k, p) && k.po.hraci[p].cigarety === 0)) },
  bezNeresti: {
    druh: "sucet",
    popis: "dohratá partia bez vypitia, fajčenia, NA EX, doliatia a barteru",
    zmer: (k) =>
      pre((p) => {
        const s = k.statPo[p];
        return ak(dohrata(k) && s.poldeciVypite + s.cigaretyVyfajcene + s.naex + s.dolievania + s.bartery === 0);
      }),
  },
  vsetkyBitkyVyhrane: {
    druh: "max",
    popis: "1 na konci partie, ak hráč vyhral každú bitku (aspoň jednu)",
    zmer: (k) => pre((p) => ak(dohrata(k) && k.statPo[p].bitky > 0 && k.statPo[p].bitky === k.statPo[p].bitkyVyhrane)),
  },
  obrat: {
    druh: "max",
    popis: "najväčší deficit špakov po niektorom kole, z ktorého hráč partiu vyhral",
    zmer: (k) =>
      pre((p) => {
        if (!vyhral(k, p)) return null;
        const kola = [...k.kronikaPo.kola, k.kronikaPo.kolo];
        const deficit = Math.max(0, ...kola.map((kolo) => (kolo.bodyPo === null ? 0 : kolo.bodyPo[opponentOf(p)] - kolo.bodyPo[p])));
        return deficit > 0 ? deficit : null;
      }),
  },
  // ---- bitka
  prebytokBitky: {
    druh: "max",
    popis: "prebytok bitky, ktorú hráč vyhral",
    zmer: (k) => pre((p) => bitky(k).reduce<number | null>((n, e) => (e.vitaz === p ? Math.max(n ?? 0, e.prebytok) : n), null)),
  },
  kartyVLinii: {
    druh: "max",
    popis: "počet hráčových kariet v línii pri vyhodnotení bitky",
    zmer: (k) => pre((p) => bitky(k).reduce<number | null>((n, e) => Math.max(n ?? 0, e.karty.filter((x) => x.majitel === p).length), null)),
  },
  pitkyVyhratejBitky: {
    druh: "max",
    popis: "počet Pitiek bitky, ktorú hráč vyhral",
    zmer: (k) => pre((p) => ak(bitky(k).some((e) => e.vitaz === p), k.pred.pitkaCislo)),
  },
  sekeraZobrata: {
    druh: "max",
    popis: "z koľkých bitiek na sekere hráč vzal špaky jednou vyhratou bitkou",
    zmer: (k) => pre((p) => ak(bitky(k).some((e) => e.vitaz === p) && bitkyNaSekere(k.pred.nastenka) > 0, bitkyNaSekere(k.pred.nastenka))),
  },
  obeHranyLokality: {
    druh: "sucet",
    popis: "bitka, v ktorej mal hráč prevahu v oboch krajoch (akcie oboch hrán lokality)",
    zmer: (k) => {
      if (bitky(k).length === 0) return [null, null];
      const prevaha = prevahaStran(k.data, k.pred.strany);
      return pre((p) => ak(prevaha[0] === p && prevaha[1] === p));
    },
  },
  remizaBitky: { druh: "sucet", popis: "bitka skončená sekerou (špaky kola čakajú na víťaza ďalšej), obom", zmer: (k) => pre(() => ak(bitky(k).some((e) => e.vitaz === null))) },
  vyhraNasucho: {
    druh: "sucet",
    popis: "vyhratá bitka, keď hráč pri vyhodnotení nemal plný poldeci",
    zmer: (k) => pre((p) => ak(bitky(k).some((e) => e.vitaz === p) && k.pred.hraci[p].poldeciPlne === 0)),
  },
  // ---- ťahy a stav
  zaverecne: { druh: "sucet", popis: "karty zahrané ako Záverečná", zmer: (k) => pre((p) => (p === k.autor && zaverecne(k.cmd) > 0 ? zaverecne(k.cmd) : null)) },
  naexUspech: {
    druh: "sucet",
    popis: "NA EX, ktoré po súperovej odpovedi zlepšilo bitku tomu, kto ho dal",
    zmer: (k) => pre((p) => prirastok(naexy(k.kronikaPo, p, true), naexy(k.kronikaPred, p, true))),
  },
  naexVlastnyGol: {
    druh: "sucet",
    popis: "NA EX, ktoré po súperovej odpovedi bitku zhoršilo tomu, kto ho dal",
    zmer: (k) => pre((p) => prirastok(naexy(k.kronikaPo, p, false), naexy(k.kronikaPred, p, false))),
  },
  najvacsiaRuka: { druh: "max", popis: "najviac kariet v ruke naraz", zmer: (k) => pre((p) => k.po.hraci[p].ruka.length) },
  najviacCigariet: { druh: "max", popis: "najviac cigariet naraz", zmer: (k) => pre((p) => k.po.hraci[p].cigarety) },
  najviacDlhov: { druh: "max", popis: "najviac priznaných Dlhov naraz", zmer: (k) => pre((p) => k.po.hraci[p].dlhy) },
  priazneNaraz: { druh: "max", popis: "koľko starších naraz prejavuje hráčovi priazeň", zmer: (k) => pre((p) => k.po.starsi.filter((e) => priazenHraca(e) === p).length) },
  // ---- len kariéra
  seriaVyhier: {
    druh: "seria",
    popis: "najdlhšia séria výhier za sebou (vlastné vzdanie sériu preruší, súperovo ju nemení)",
    zmer: (k) =>
      pre((p) => {
        if (k.pred.koniec !== null || k.po.koniec === null) return null;
        if (k.vzdane) return k.autor === p ? 0 : null;
        return k.po.koniec.vitaz === p ? 1 : 0;
      }),
  },
  porazenePovahy: {
    druh: "rozne",
    popis: "počet rôznych povah bota, nad ktorými hráč vyhral",
    zmer: (k) => pre((p) => ak(vyhral(k, p) && k.kontext.botPovaha !== null)),
    stitok: (k) => k.kontext.botPovaha,
  },
  rozniSuperi: {
    druh: "rozne",
    popis: "počet rôznych ľudských súperov v dohratých partiách",
    zmer: (k) => pre((p) => ak(dohrata(k) && k.kontext.superi[p] !== null)),
    stitok: (k, p) => k.kontext.superi[p],
  },
};

/** Momenty v prospech hráča (moment bez hráča — vzbura, bitka o všetko — ráta obom). */
function metrikaMomentu(typ: TypMomentu): Metrika {
  return {
    druh: "sucet",
    popis: `pečiatka momentu „${MOMENTY[typ].nazov}“ v prospech hráča`,
    zmer: (k) => {
      const m = momenty(k.data, k.pred, k.po, k.udalosti).filter((x) => x.typ === typ);
      return pre((p) => {
        const n = m.filter((x) => x.hrac === null || x.hrac === p).length;
        return n > 0 ? n : null;
      });
    },
  };
}

function metrikaPovahy(povaha: string): Metrika {
  return {
    druh: "sucet",
    popis: `výhra nad botom povahy ${povaha}`,
    zmer: (k) => pre((p) => ak(vyhral(k, p) && k.kontext.botPovaha === povaha)),
  };
}

const rozdiel = (po: number | undefined, pred: number | undefined): number | null => {
  const d = (po ?? 0) - (pred ?? 0);
  return d !== 0 ? d : null;
};

/** Metrika podľa mena; null = taká neexistuje. */
export function metrika(id: string): Metrika | null {
  const vlastna = VLASTNE[id];
  if (vlastna !== undefined) return vlastna;
  const bodka = id.indexOf(".");
  const druh = bodka < 0 ? id : id.slice(0, bodka);
  const nazov = bodka < 0 ? "" : id.slice(bodka + 1);
  if (druh === "stat") {
    const zaklad = prazdneStatistiky() as unknown as Record<string, unknown>;
    if (typeof zaklad[nazov] !== "number" || NIE_METRIKY.has(nazov)) return null;
    const pole = nazov as keyof StatistikyHraca;
    const cislo = (s: StatistikyHraca): number => s[pole] as number;
    if (REKORDY.has(nazov)) {
      return { druh: "max", popis: `rekord štatistiky ${nazov}`, zmer: (k) => pre((p) => (cislo(k.statPo[p]) > cislo(k.statPred[p]) ? cislo(k.statPo[p]) : null)) };
    }
    return { druh: "sucet", popis: `štatistika ${nazov}`, zmer: (k) => pre((p) => rozdiel(cislo(k.statPo[p]), cislo(k.statPred[p]))) };
  }
  if (druh === "akcia" && (ALL_ACTIONS as readonly string[]).includes(nazov)) {
    const a = nazov as (typeof ALL_ACTIONS)[number];
    return { druh: "sucet", popis: `aktívna akcia ${nazov} v bitkách`, zmer: (k) => pre((p) => rozdiel(k.statPo[p].akcie[a], k.statPred[p].akcie[a])) };
  }
  if (druh === "body" && (ALL_PODMIENKY as readonly string[]).includes(nazov)) {
    const b = nazov as (typeof ALL_PODMIENKY)[number];
    return { druh: "sucet", popis: `body za podmienku ${nazov}`, zmer: (k) => pre((p) => rozdiel(k.statPo[p].bodyPodla[b], k.statPred[p].bodyPodla[b])) };
  }
  if (druh === "moment" && nazov in MOMENTY) return metrikaMomentu(nazov as TypMomentu);
  if (druh === "vyhraNad" && POVAHY.some((x) => x.id === nazov)) return metrikaPovahy(nazov);
  return null;
}

/** Všetky známe metriky s popisom — pre Navrhára a UI (zoznam, nie logika). */
export function zoznamMetrik(): { readonly id: string; readonly druh: Agregacia; readonly popis: string }[] {
  const zaklad = prazdneStatistiky() as unknown as Record<string, unknown>;
  const ids = [
    ...Object.keys(VLASTNE),
    ...Object.keys(zaklad).filter((k) => typeof zaklad[k] === "number" && !NIE_METRIKY.has(k)).map((k) => `stat.${k}`),
    ...ALL_ACTIONS.map((a) => `akcia.${a}`),
    ...ALL_PODMIENKY.map((b) => `body.${b}`),
    ...Object.keys(MOMENTY).map((t) => `moment.${t}`),
    ...POVAHY.map((x) => `vyhraNad.${x.id}`),
  ];
  return ids.map((id) => {
    const m = metrika(id) as Metrika;
    return { id, druh: m.druh, popis: m.popis };
  });
}

// ---------------------------------------------------------------------------
// Katalóg z JSON

const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const jeProti = (x: unknown): x is ProtiKomu => x === "ludia" || x === "bot" || x === "vsetky";

/**
 * Katalóg z achievementy.json — overí každý záznam a pri chybe vyhodí výnimku
 * so zoznamom všetkých problémov (nech Navrhár opraví všetko naraz).
 */
export function nacitajAchievementy(json: unknown): KatalogAchievementov {
  const chyby: string[] = [];
  const o = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
  const kategorie = (Array.isArray(o.kategorie) ? o.kategorie : []).flatMap((k): { id: string; nazov: string }[] => {
    const x = k as Record<string, unknown> | null;
    return typeof x?.id === "string" && typeof x.nazov === "string" ? [{ id: x.id, nazov: x.nazov }] : [];
  });
  const idKategorii = new Set(kategorie.map((k) => k.id));
  const videne = new Set<string>();
  const achievementy: Achievement[] = [];
  for (const [i, surovy] of (Array.isArray(o.achievementy) ? o.achievementy : []).entries()) {
    const a = (typeof surovy === "object" && surovy !== null ? surovy : {}) as Record<string, unknown>;
    const kde = `achievementy[${i}]${typeof a.id === "string" ? ` (${a.id})` : ""}`;
    const pred = chyby.length;
    const chyba = (t: string): void => {
      chyby.push(`${kde}: ${t}`);
    };
    const id = typeof a.id === "string" ? a.id : "";
    if (!ID_RE.test(id)) chyba("id musí byť malé písmená, číslice a pomlčka");
    else if (videne.has(id)) chyba("id už je použité");
    videne.add(id);
    const nazov = typeof a.nazov === "string" ? a.nazov.trim() : "";
    if (nazov === "") chyba("chýba nazov");
    const popis = typeof a.popis === "string" ? a.popis : "";
    if (popis.trim() === "") chyba("chýba popis");
    const idMetriky = typeof a.metrika === "string" ? a.metrika : "";
    const m = metrika(idMetriky);
    if (m === null) chyba(`neznáma metrika „${idMetriky}“`);
    const rozsah = ROZSAHY.find((r) => r === a.rozsah);
    if (rozsah === undefined) chyba(`rozsah musí byť ${ROZSAHY.join(" | ")}`);
    let agregacia: Agregacia | undefined = m?.druh;
    if (m !== null && (m.druh === "seria" || m.druh === "rozne")) {
      if (rozsah !== undefined && rozsah !== "kariera") chyba(`metrika „${idMetriky}“ je len pre rozsah kariera`);
      if (a.agregacia !== undefined && a.agregacia !== null && a.agregacia !== m.druh) chyba(`metrika „${idMetriky}“ má agregáciu ${m.druh}`);
    } else if (a.agregacia === "sucet" || a.agregacia === "max") agregacia = a.agregacia;
    else if (a.agregacia !== undefined && a.agregacia !== null) chyba("agregacia musí byť sucet | max (alebo chýbať)");
    const prahy = Array.isArray(a.prahy) ? a.prahy : [];
    const prahyOk =
      prahy.length >= 1 &&
      prahy.length <= 3 &&
      prahy.every((x, j) => typeof x === "number" && Number.isFinite(x) && x > 0 && (j === 0 || x > (prahy[j - 1] as number)));
    if (!prahyOk) chyba("prahy: 1 – 3 rastúce kladné čísla");
    const proti = a.proti === undefined || a.proti === null ? "ludia" : a.proti;
    if (!jeProti(proti)) chyba("proti musí byť ludia | bot | vsetky");
    const kategoria = typeof a.kategoria === "string" ? a.kategoria : null;
    if (kategoria !== null && idKategorii.size > 0 && !idKategorii.has(kategoria)) chyba(`neznáma kategória „${kategoria}“`);
    if (chyby.length > pred || rozsah === undefined || agregacia === undefined || !jeProti(proti)) continue;
    achievementy.push({
      id,
      nazov,
      kategoria,
      popis,
      metrika: idMetriky,
      rozsah,
      agregacia,
      prahy: prahy as number[],
      proti,
      tajny: a.tajny === true,
      tajnyText: typeof a.tajnyText === "string" ? a.tajnyText : null,
      piktogram: typeof a.piktogram === "string" ? a.piktogram : null,
      zriedkavost: Array.isArray(a.zriedkavost) ? a.zriedkavost.filter((x): x is string => typeof x === "string") : [],
    });
  }
  if (chyby.length > 0) throw new Error(`achievementy.json:\n  ${chyby.join("\n  ")}`);
  return { verzia: typeof o.verzia === "number" ? o.verzia : 1, zapnute: o.zapnute === true, kategorie, achievementy };
}

/** Rank pre hodnotu: koľko prahov dosiahla (0 = žiadny). */
export function rankZaHodnotu(a: Achievement, hodnota: number): number {
  return a.prahy.filter((p) => hodnota >= p).length;
}

/** Popis ranku s dosadeným prahom. */
export function popisRanku(a: Achievement, rank: number): string {
  const prah = a.prahy[Math.max(0, Math.min(a.prahy.length, rank) - 1)] ?? a.prahy[0] ?? 0;
  return a.popis.replace(/\{prah\}/g, String(prah));
}

// ---------------------------------------------------------------------------
// Sledovanie partie

/** Kľúč agregátu (metrika|agregacia) — rovnaký v partii aj v súčte kariéry na serveri. */
export const klucKariery = (a: Achievement): string => `${a.metrika}|${a.agregacia}`;

interface PostupHraca {
  /** Agregát metriky za partiu (kľúč metrika|agregacia); pri sérii posledná hodnota. */
  readonly partia: Readonly<Record<string, number>>;
  readonly kolo: Readonly<Record<string, number>>;
  readonly pitka: Readonly<Record<string, number>>;
  /** Pri „rozne“: čo sa v partii započítalo (povaha, súper). */
  readonly stitky: Readonly<Record<string, readonly string[]>>;
  /** Najlepšia hodnota achievementu v tejto partii (pre bitku/Pitku/kolo maximum cez okná). */
  readonly najlepsie: Readonly<Record<string, number>>;
}

export interface StavAchievementov {
  readonly stat: DvojicaStatistik;
  /** Kronika partie (NA EX s výsledkom, body po kolách) — založí sa pri prvom kroku. */
  readonly kronika: StavKroniky | null;
  readonly kolo: string;
  readonly pitka: string;
  readonly hraci: readonly [PostupHraca, PostupHraca];
}

const prazdnyPostup = (): PostupHraca => ({ partia: {}, kolo: {}, pitka: {}, stitky: {}, najlepsie: {} });

export function noveAchievementy(): StavAchievementov {
  return { stat: noveStatistiky(), kronika: null, kolo: "", pitka: "", hraci: [prazdnyPostup(), prazdnyPostup()] };
}

/** Zisk v partii: achievement dosiahol v tejto partii rank (server porovná s tým, čo hráč už má). */
export interface ZiskVPartii {
  readonly id: string;
  readonly rank: number;
  readonly hodnota: number;
}

const zluc = (agregacia: Agregacia, stare: number | undefined, nove: number): number =>
  stare === undefined || agregacia === "seria" ? nove : agregacia === "max" ? Math.max(stare, nove) : stare + nove;

/**
 * Jeden krok partie (príkaz hráča `autor`): nové agregáty a ranky, ktoré
 * v partii práve pribudli. Achievementy s rozsahom „kariera“ nevracia — ich
 * rank je súčet partií (server: súčet kariéry + agregatPartie).
 */
export function krokAchievementov(
  katalog: KatalogAchievementov,
  data: GameData,
  stav: StavAchievementov,
  pred: GameState,
  cmd: Command,
  autor: PlayerId,
  po: GameState,
  udalosti: readonly Event[],
  kontext: KontextPartie = BEZ_KONTEXTU,
): { readonly stav: StavAchievementov; readonly zisky: readonly [ZiskVPartii[], ZiskVPartii[]] } {
  const vzdane = cmd.type === "vzdat";
  let statPo = zapisTah(stav.stat, pred, cmd, autor, po, udalosti);
  if (pred.koniec === null && po.koniec !== null && !vzdane) statPo = uzavriStatistiky(data, statPo, po);
  const kronikaPred = stav.kronika ?? novaKronika(pred);
  const kronikaPo = zapisDoKroniky(data, kronikaPred, pred, cmd, autor, po, udalosti);
  const krok: KrokMetriky = { data, pred, cmd, autor, po, udalosti, statPred: stav.stat, statPo, kronikaPred, kronikaPo, kontext, vzdane };

  // Okná podľa stavu PRED krokom — krok sa odohral v ňom.
  const kolo = String(pred.kolo);
  const pitka = `${pred.kolo}:${pred.pitkaCislo}`;
  const bitka = udalosti.some((e) => e.type === "bitkaVysledok");

  const merania = new Map<string, Meranie>();
  for (const a of katalog.achievementy) {
    if (!merania.has(a.metrika)) merania.set(a.metrika, (metrika(a.metrika) as Metrika).zmer(krok));
  }

  const zisky: [ZiskVPartii[], ZiskVPartii[]] = [[], []];
  const hraci = OBA.map((p): PostupHraca => {
    const h = stav.hraci[p];
    const partia: Record<string, number> = { ...h.partia };
    const vKole: Record<string, number> = stav.kolo === kolo ? { ...h.kolo } : {};
    const vPitke: Record<string, number> = stav.pitka === pitka ? { ...h.pitka } : {};
    const stitky: Record<string, readonly string[]> = { ...h.stitky };
    const vBitke: Record<string, number> = {};
    for (const a of katalog.achievementy) {
      const k = klucKariery(a);
      if (k in vBitke) continue;
      const v = (merania.get(a.metrika) as Meranie)[p];
      if (v === null) continue;
      vBitke[k] = v;
      if (a.agregacia === "rozne") {
        const s = (metrika(a.metrika) as Metrika).stitok?.(krok, p) ?? null;
        if (s !== null && !(stitky[k] ?? []).includes(s)) stitky[k] = [...(stitky[k] ?? []), s];
        partia[k] = (stitky[k] ?? []).length;
        continue;
      }
      partia[k] = zluc(a.agregacia, partia[k], v);
      vKole[k] = zluc(a.agregacia, vKole[k], v);
      vPitke[k] = zluc(a.agregacia, vPitke[k], v);
    }
    const najlepsie: Record<string, number> = { ...h.najlepsie };
    for (const a of katalog.achievementy) {
      const k = klucKariery(a);
      const hodnota =
        a.rozsah === "bitka" ? (bitka ? vBitke[k] : undefined) : a.rozsah === "pitka" ? vPitke[k] : a.rozsah === "kolo" ? vKole[k] : partia[k];
      if (hodnota === undefined) continue;
      const predtym = najlepsie[a.id] ?? 0;
      if (hodnota <= predtym) continue;
      najlepsie[a.id] = hodnota;
      // Kariéra: rank počíta server so súčtom starších partií.
      if (a.rozsah === "kariera") continue;
      const rank = rankZaHodnotu(a, hodnota);
      if (rank > rankZaHodnotu(a, predtym)) zisky[p].push({ id: a.id, rank, hodnota });
    }
    return { partia, kolo: vKole, pitka: vPitke, stitky, najlepsie };
  });
  return {
    stav: { stat: statPo, kronika: kronikaPo, kolo, pitka, hraci: [hraci[0] as PostupHraca, hraci[1] as PostupHraca] },
    zisky,
  };
}

/** Najlepšia hodnota achievementu hráča v tejto partii (0 = nič). */
export function hodnotaVPartii(stav: StavAchievementov, hrac: PlayerId, a: Achievement): number {
  return stav.hraci[hrac].najlepsie[a.id] ?? 0;
}

/** Agregát metriky achievementu za partiu — do súčtu kariéry na serveri (undefined = nič sa nestalo). */
export function agregatPartie(stav: StavAchievementov, hrac: PlayerId, a: Achievement): number | undefined {
  return stav.hraci[hrac].partia[klucKariery(a)];
}

/** Štítky „rozne“ za partiu (povahy, súperi) — server ich pridá k množine kariéry. */
export function stitkyPartie(stav: StavAchievementov, hrac: PlayerId, a: Achievement): readonly string[] {
  return stav.hraci[hrac].stitky[klucKariery(a)] ?? [];
}

/** Súčet kariéry po partii podľa agregácie; pri sérii aj aktuálna séria. „rozne“ počíta server z množiny. */
export function pripocitajKarieru(
  a: Achievement,
  stara: { readonly hodnota: number; readonly aktualna: number },
  zaPartiu: number | undefined,
): { hodnota: number; aktualna: number } {
  if (zaPartiu === undefined) return { ...stara };
  if (a.agregacia === "max") return { hodnota: Math.max(stara.hodnota, zaPartiu), aktualna: 0 };
  if (a.agregacia === "seria") {
    const aktualna = zaPartiu > 0 ? stara.aktualna + 1 : 0;
    return { hodnota: Math.max(stara.hodnota, aktualna), aktualna };
  }
  return { hodnota: stara.hodnota + zaPartiu, aktualna: 0 };
}

/** „Chýbalo málo“: ďalší rank, ku ktorému má hráč aspoň PODIEL_BLIZKO cesty. */
export interface Priblizenie {
  readonly id: string;
  readonly rank: number;
  readonly hodnota: number;
  readonly prah: number;
}

export const PODIEL_BLIZKO = 0.6;
export const PRIBLIZENI_NAJVIAC = 3;

/**
 * Achievementy, ku ktorých ďalšiemu ranku mal hráč v partii blízko — tajné
 * nie (nesmú sa prezradiť). hodnoty = hodnota achievementu (pri kariére
 * súčet všetkých partií), drzane = rank, ktorý už hráč má.
 */
export function chybaloMalo(
  katalog: KatalogAchievementov,
  hodnoty: ReadonlyMap<string, number>,
  drzane: ReadonlyMap<string, number>,
): Priblizenie[] {
  const out: (Priblizenie & { readonly podiel: number })[] = [];
  for (const a of katalog.achievementy) {
    if (a.tajny) continue;
    const hodnota = hodnoty.get(a.id);
    if (hodnota === undefined || hodnota <= 0) continue;
    const rank = Math.max(drzane.get(a.id) ?? 0, rankZaHodnotu(a, hodnota));
    const prah = a.prahy[rank];
    if (prah === undefined || hodnota >= prah) continue;
    const podiel = hodnota / prah;
    if (podiel >= PODIEL_BLIZKO) out.push({ id: a.id, rank: rank + 1, hodnota, prah, podiel });
  }
  return out
    .sort((x, y) => y.podiel - x.podiel)
    .slice(0, PRIBLIZENI_NAJVIAC)
    .map(({ id, rank, hodnota, prah }) => ({ id, rank, hodnota, prah }));
}
