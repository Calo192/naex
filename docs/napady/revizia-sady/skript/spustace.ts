// Analýza spúšťačov efektov (Stratég, 27. 10. 2026) — ktorý spúšťač sa v hre
// spúšťa málo a ktorý veľa.
//
//   node --experimental-strip-types --no-warnings docs/napady/revizia-sady/skript/spustace.ts [--partii 54] [--json cesta]
//
// Bez servera, nad jadrom; jadro sa NEMENÍ (číta sa len stav pred a po príkaze
// a udalosti). Dve čísla na kartu a spúšťač:
//  príležitosť — nastal okamih spúšťača a karta bola tam, kde jej efekt platí
//                (línia, Dedičstvo, prebudený starší, cieľová lokalita);
//  účinok      — efekt naozaj niečo zmenil. Meria sa trojako:
//                (a) protifakt bitky: tá istá bitka s „prázdnym dvojčaťom“ karty
//                    (rovnaké akcie a tagy, bez efektu) — zmenilo sa poškodenie?
//                (b) protifakt Pitky: súčty akcií, zadĺženie, pečeň, cigarety;
//                (c) hláška motora / príkaz (Hrobár, Svokra, Hasič, Poštárka…).
// Furt sa ráta raz za kolo (karta v línii pri bitke); účinok Furt = zmenila
// bitku alebo niektorú Pitku kola.

import { readFileSync, writeFileSync } from "node:fs";
import type { Command, Event, GameData, GameState, PlayerId } from "../../../../packages/core/src/index.ts";
import {
  ALL_TRIGGERS,
  DLZKY_HRY,
  KONSTANTY,
  apply,
  cigaretyZPitky,
  evaluateLine,
  krcmaVyzaduje,
  lineState,
  loadGameData,
  mozeHrat,
  naTahu,
  poskodenieBitky,
  prebudenyPre,
  prirastkyPitky,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
} from "../../../../packages/core/src/index.ts";

const koren = new URL("../../../../packages/core/data/", import.meta.url);
const citaj = (s: string): unknown => JSON.parse(readFileSync(new URL(s, koren), "utf8"));
const cardsJson = citaj("cards.json") as { cards: { id: string; name: string; tags: string[]; triggers: string[]; effect_text: string; index: number }[] };
const eldersJson = citaj("elders.json");
const scJson = citaj("scorecards.json");
const data = loadGameData(cardsJson, eldersJson, scJson);

// Dáta s „prázdnymi dvojčatami“: rovnaká karta (akcie, varianty, tagy), iné id,
// bez spúšťača — motor ju nepozná podľa id, takže jej efekt neplatí.
const BEZ = "__bez";
const data2: GameData = loadGameData(
  {
    ...cardsJson,
    cards: [
      ...cardsJson.cards,
      ...cardsJson.cards.map((c) => ({ ...c, id: c.id + BEZ, index: c.index + 1000, triggers: [], effect_text: "" })),
    ],
  },
  eldersJson,
  scJson,
);

function arg(meno: string, predvolene: string): string {
  const i = process.argv.indexOf(`--${meno}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : predvolene;
}
const PARTII = Number(arg("partii", "54"));
const JSON_CESTA = arg("json", "");
const POVAHY = ["stamgast", "rapavy_fero", "teta_gizka"];
const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);

const defy = new Map(cardsJson.cards.map((c) => [c.id, c]));
const trig = (id: string): string[] => defy.get(id)?.triggers ?? [];

// ---------------------------------------------------------------------------
// Počítadlá

interface Stat {
  prilezitosti: number;
  ucinky: number;
}
const stat = new Map<string, Stat>(); // `${defId}|${trigger}`
const videne = new Set<string>(); // dedupe príležitostí
const videneU = new Set<string>(); // dedupe účinkov
let hra = 0;

function st(defId: string, t: string): Stat {
  const k = `${defId}|${t}`;
  let v = stat.get(k);
  if (v === undefined) {
    v = { prilezitosti: 0, ucinky: 0 };
    stat.set(k, v);
  }
  return v;
}
function prilezitost(defId: string, t: string, kluc: string): void {
  const k = `${hra}|${kluc}|${defId}|${t}`;
  if (videne.has(k)) return;
  videne.add(k);
  st(defId, t).prilezitosti++;
}
function ucinok(defId: string, t: string, kluc: string): void {
  const k = `${hra}|${kluc}|${defId}|${t}`;
  if (videneU.has(k)) return;
  videneU.add(k);
  st(defId, t).ucinky++;
}

/** Okamihy spúšťačov bez ohľadu na karty (koľkokrát za partiu nastanú). */
const okamihy: Record<string, number> = { bitka: 0, pitka: 0, zhromazdenie: 0, vylozenie: 0, vyhra: 0, prehra: 0, exekucia: 0, sekera: 0 };
/** Vyloženia kariet do línie a do Dedičstva (koľko sa karta vôbec dostane na stôl). */
const vylozene = new Map<string, { linia: number; dedicstvo: number }>();
const vyl = (id: string): { linia: number; dedicstvo: number } => {
  let v = vylozene.get(id);
  if (v === undefined) {
    v = { linia: 0, dedicstvo: 0 };
    vylozene.set(id, v);
  }
  return v;
};
let zhodaBitky = 0;
let bitiekSpolu = 0;
let kol = 0;

// ---------------------------------------------------------------------------
// Kde karta platí

type Miesto = { readonly defId: string; readonly uid: number; readonly majitel: PlayerId | null; readonly kde: "linia" | "dedicstvo" | "starsi" | "lokalita" };

function miesta(s: GameState): Miesto[] {
  const out: Miesto[] = [];
  for (const strana of s.strany) {
    for (const pl of strana) if (pl.zaverecna !== true) out.push({ defId: pl.card.defId, uid: pl.card.uid, majitel: pl.playedBy, kde: "linia" });
  }
  for (const p of [0, 1] as const) for (const k of s.hraci[p].dedicstvo) out.push({ defId: k.defId, uid: k.uid, majitel: p, kde: "dedicstvo" });
  for (const e of s.starsi) {
    const p = prebudenyPre(e);
    if (p !== null) out.push({ defId: e.karta.defId, uid: e.karta.uid, majitel: p, kde: "starsi" });
  }
  const lok = s.ciel?.typ === "lokalita" ? s.ciel.lokalita : null;
  if (lok !== null && lok !== undefined) out.push({ defId: lok.defId, uid: lok.uid, majitel: null, kde: "lokalita" });
  return out;
}

/** Stav, v ktorom má jedna inštancia (uid) efekt vypnutý — prázdne dvojča. */
function bezEfektu(s: GameState, uid: number): GameState {
  const c = structuredClone(s) as unknown as {
    strany: { card: { uid: number; defId: string } }[][];
    hraci: { dedicstvo: { uid: number; defId: string }[] }[];
    starsi: { karta: { uid: number; defId: string } }[];
    ciel: { typ: string; lokalita?: { uid: number; defId: string } | null } | null;
  };
  const prepis = (k: { uid: number; defId: string } | null | undefined): void => {
    // Tá istá inštancia môže byť v stave dvakrát (starší na scorecarde aj v línii) — zdieľaný objekt.
    if (k !== null && k !== undefined && k.uid === uid && !k.defId.endsWith(BEZ)) k.defId += BEZ;
  };
  for (const strana of c.strany) for (const pl of strana) prepis(pl.card);
  for (const h of c.hraci) for (const k of h.dedicstvo) prepis(k);
  for (const e of c.starsi) prepis(e.karta);
  if (c.ciel?.lokalita !== undefined) prepis(c.ciel.lokalita);
  return c as unknown as GameState;
}

function abstakyVRuke(s: GameState): [number, number] {
  return [0, 1].map((p) => s.hraci[p as PlayerId].ruka.filter((k) => k.defId === "abstak").length) as [number, number];
}
function bitkaOdtlacok(s: GameState): string {
  const sums = evaluateLine(data2, lineState(s)).sums;
  return JSON.stringify(poskodenieBitky(data2, s, sums, abstakyVRuke(s)));
}
function pitkaOdtlacok(s: GameState): string {
  const ev = evaluateLine(data2, lineState(s));
  return JSON.stringify([ev.sums, prirastkyPitky(data2, s, ev), cigaretyZPitky(data2, s, ev.sums, s.pitkaCislo)]);
}

// ---------------------------------------------------------------------------
// Hlášky motora a príkazy → účinok

const HLASKY: readonly [RegExp, string, string][] = [
  [/^Hrobár:/, "hrobar", "Furt"],
  [/^Svokra:/, "svokra", "Furt"],
  [/^Policajtka:/, "policajtka", "Furt"],
  [/^Praudovravec/, "praudovravec", "Furt"],
  [/Milujúca manželka:/, "milujuca_manzelka", "Furt"],
  [/^Niekoho stryná: .*(zahodil|zahodila|zahadzuje)/, "niekoho_stryna", "Nástup"],
  [/^Veľmi smútiaca vdova: .*muž ide z hry/, "velmi_smutiaca_vdova", "Nástup"],
  [/^Hasič:/, "hasic", "Nástup"],
  [/^Snúbenica:/, "snubenica", "Nástup"],
  [/^Vychovávateľka:/, "vychovavatelka", "Pitka"],
  [/^Poštárka:/, "postarka", "Pitka"],
  [/^Starosta:/, "starosta", "Pitka"],
  [/^Zberný dvor:/, "zberny_dvor", "Pitka"],
  [/^Krčmárka:/, "krcmarka", "Bitka"],
  [/Kultúrny dom/, "kulturny_dom", "Bitka"],
  [/^Kar:/, "kar", "Bitka"],
  [/^Dievčina na vydaj:/, "dievcina_na_vydaj", "Bitka"],
  [/^Cintorín:/, "cintorin", "Prehra"],
  [/^Výherný automat:/, "vyherny_automat", "Výhra"],
  [/^Podvodník:/, "podvodnik", "Prehra"],
  [/^Živnostník:/, "zivnostnik", "Výhra"],
  [/^Veštica: hráč/, "vestica", "Prehra"],
  [/^Noviny:/, "noviny", "Dedičstvo"],
  [/^Puška hráča/, "puska", "Dedičstvo"],
];

/** Lokality, ktorých efekt je obmedzenie platné celé kolo — účinok = príležitosť. */
const STALE_PRAVIDLO: Readonly<Record<string, string[]>> = {
  zastavka: ["Zhromaždenie"],
  most: ["Zhromaždenie"],
  kostol: ["Zhromaždenie", "Pitka"],
  benzinka: ["Pitka"],
};

// ---------------------------------------------------------------------------
// Partia

const videnaStavba = new Map<number, string>();
const videnaSenok = new Map<number, string>();
const videnaRuka = new Map<number, string>();
const zapis = (m: Map<number, string>, k: { readonly uid: number; readonly defId: string }): void => {
  m.set(k.uid, k.defId);
};
/** Na kartu: v koľkých partiách sa aspoň jedna jej kópia dostala do stavby šenku / šenku / ruky. */
const dosah = new Map<string, { stavba: number; senok: number; ruka: number }>();
function uzavriPartiu(): void {
  const raz = (m: Map<number, string>, pole: "stavba" | "senok" | "ruka"): void => {
    for (const id of new Set(m.values())) {
      const v = dosah.get(id) ?? { stavba: 0, senok: 0, ruka: 0 };
      v[pole]++;
      dosah.set(id, v);
    }
    m.clear();
  };
  raz(videnaStavba, "stavba");
  raz(videnaSenok, "senok");
  raz(videnaRuka, "ruka");
}

function odohraj(seedHry: number, seedBotov: number, povahy: readonly [string, string]): void {
  let s: GameState = setupGame(data, seedHry, { lokalit: DLZKY_HRY.stredna });
  let rng = rngSeed(seedBotov);
  const naexVPitke: [number, number] = [0, 0];
  let pitkaKluc = "";
  for (let krok = 0; s.koniec === null && krok < 20000; krok++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [seed, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, seed, { povaha: povahy[p] });
    const pred = s;
    const kolo = pred.kolo;
    const ciel = pred.ciel?.typ === "lokalita" ? (pred.ciel.lokalita?.defId ?? null) : null;

    // Krčma: povinné NA EX niekomu naozaj vzniklo.
    if (pred.faza === "pitka" && ciel === "krcma" && krcmaVyzaduje(data, pred, p)) ucinok("krcma", "Pitka", `k${kolo}p${pred.pitkaCislo}`);

    for (const b of pred.draftStav?.balicky ?? []) for (const k of b) zapis(videnaStavba, k);
    for (const k of pred.senok) zapis(videnaSenok, k);
    for (const h of pred.hraci) for (const k of h.ruka) zapis(videnaRuka, k);

    const vysledok = apply(data, pred, cmd, p);
    const po = vysledok.state;
    const events: readonly Event[] = vysledok.events;

    // Príkazy s účinkom.
    const kroky = cmd.type === "tah" ? cmd.kroky : [cmd];
    for (const c of kroky) {
      if (c.type === "zahradkar" && c.zahodit) ucinok("zahradkar", "Exekúcia", `k${kolo}h${p}`);
      if (c.type === "barter" && ciel === "jednota") ucinok("jednota", "Pitka", `k${kolo}p${pred.pitkaCislo}h${p}`);
      if (c.type === "naex" && pred.faza === "pitka") {
        if (pitkaKluc !== `k${kolo}p${pred.pitkaCislo}`) {
          pitkaKluc = `k${kolo}p${pred.pitkaCislo}`;
          naexVPitke[0] = 0;
          naexVPitke[1] = 0;
        }
        naexVPitke[p]++;
        if (ciel === "vinna_pivnica" && naexVPitke[p] >= 2) ucinok("vinna_pivnica", "Pitka", `${pitkaKluc}h${p}`);
      }
      if (c.type === "place" && c.target === "dedicstvo") {
        const k = pred.hraci[p].ruka.find((x) => x.uid === c.uid);
        if (k !== undefined) vyl(k.defId).dedicstvo++;
      }
    }
    if (cmd.type === "cintorin" && cmd.uid !== null) ucinok("cintorin", "Prehra", `k${kolo}`);

    // Nástup: nové alebo práve otočené karty v línii.
    const predUid = new Map<number, boolean>();
    for (const strana of pred.strany) for (const pl of strana) predUid.set(pl.card.uid, pl.zaverecna === true);
    for (const strana of po.strany) {
      for (const pl of strana) {
        const bolo = predUid.get(pl.card.uid);
        const odkryta = pl.zaverecna !== true && (bolo === undefined || bolo === true);
        if (bolo === undefined) vyl(pl.card.defId).linia++;
        if (!odkryta) continue;
        okamihy.vylozenie!++;
        if (trig(pl.card.defId).includes("Nástup")) prilezitost(pl.card.defId, "Nástup", `u${pl.card.uid}k${kolo}`);
        if (pl.card.defId === "druzstvo") continue;
        if (ciel === "druzstvo" && (defy.get(pl.card.defId)?.tags ?? []).includes("Pracujúci")) ucinok("druzstvo", "Zhromaždenie", `k${kolo}`);
      }
    }

    for (const e of events) {
      if (e.type === "faza" && e.faza === "zhromazdenie") {
        okamihy.zhromazdenie!++;
        kol++;
        const lok = po.ciel?.typ === "lokalita" ? (po.ciel.lokalita?.defId ?? null) : null;
        if (lok !== null && trig(lok).includes("Zhromaždenie")) {
          prilezitost(lok, "Zhromaždenie", `k${po.kolo}`);
          if (STALE_PRAVIDLO[lok]?.includes("Zhromaždenie")) ucinok(lok, "Zhromaždenie", `k${po.kolo}`);
        }
      }
      if (e.type === "log") {
        // Účinok hláškou: Nástup raz za vyloženie, Pitka raz za Pitku, ostatné raz za kolo
        // (rovnako ako príležitosť — karta sa ráta raz za kolo, aj keď ju majú obaja).
        for (const [re, id, t] of HLASKY) {
          if (!re.test(e.text)) continue;
          ucinok(id, t, t === "Nástup" ? `u${krok}` : t === "Pitka" ? `k${kolo}p${pred.pitkaCislo}` : `k${kolo}`);
        }
        if (/^Exekútor/.test(e.text)) okamihy.exekucia!++;
        if (/^Exekútor u hráča/.test(e.text)) prilezitost("zahradkar", "Exekúcia", `k${kolo}h${e.text.includes("hráča 1") ? 0 : 1}`);
        if (ciel === "obecny_urad" && (/^Robota:/.test(e.text) || /^Exekútor/.test(e.text))) ucinok("obecny_urad", "Bitka", `k${kolo}`);
      }
      if (e.type === "pitkaVysledok") {
        okamihy.pitka!++;
        const kl = `k${kolo}p${e.pitka}`;
        const zaklad = pitkaOdtlacok(pred);
        for (const m of miesta(pred)) {
          if (KLIATBY.has(m.defId)) continue;
          const t = trig(m.defId);
          if (m.kde === "lokalita" || m.kde === "linia" || m.kde === "starsi") {
            if (t.includes("Pitka")) {
              prilezitost(m.defId, "Pitka", kl);
              if (STALE_PRAVIDLO[m.defId]?.includes("Pitka")) ucinok(m.defId, "Pitka", kl);
            }
          }
          const relevantne = t.filter((x) => x === "Pitka" || x === "Furt" || (x === "Dedičstvo" && m.kde === "dedicstvo"));
          if (relevantne.length === 0) continue;
          if (pitkaOdtlacok(bezEfektu(pred, m.uid)) !== zaklad) {
            for (const x of relevantne) ucinok(m.defId, x, x === "Pitka" ? kl : `k${kolo}`);
          }
        }
      }
      if (e.type === "bitkaVysledok") {
        okamihy.bitka!++;
        bitiekSpolu++;
        if (e.vitaz === null) okamihy.sekera!++;
        else {
          okamihy.vyhra!++;
          okamihy.prehra!++;
        }
        const kl = `k${kolo}`;
        const zPred = bitkaOdtlacok(pred);
        const bs = zPred === JSON.stringify(e.damage) ? pred : bitkaOdtlacok(po) === JSON.stringify(e.damage) ? po : pred;
        const zaklad = bs === pred ? zPred : bitkaOdtlacok(po);
        if (zaklad === JSON.stringify(e.damage)) zhodaBitky++;
        else if (process.env.LADENIE) process.stderr.write(`NEZHODA ${pred.faza} ${cmd.type}
  ${zaklad}
  ${JSON.stringify(e.damage)}
`);
        const vitaz = e.vitaz;
        const porazeny = vitaz === null ? null : vitaz === 0 ? 1 : 0;
        for (const m of miesta(pred)) {
          const t = trig(m.defId);
          const vLinii = m.kde !== "dedicstvo";
          for (const x of t) {
            if (x === "Bitka" && vLinii) prilezitost(m.defId, "Bitka", kl);
            if (x === "Furt" && vLinii) prilezitost(m.defId, "Furt", `k${kolo}`);
            if (x === "Dedičstvo" && m.kde === "dedicstvo") prilezitost(m.defId, "Dedičstvo", `k${kolo}`);
            if (x === "Výhra" && vitaz !== null && (m.majitel === vitaz || m.kde === "lokalita")) prilezitost(m.defId, "Výhra", kl);
            if (x === "Prehra" && porazeny !== null && (m.majitel === porazeny || m.kde === "lokalita")) prilezitost(m.defId, "Prehra", kl);
          }
          if (m.defId === "ministrant" && m.majitel === vitaz && e.prebytokNaRozdelenie > 0) ucinok("ministrant", "Výhra", kl);
          if (m.defId === "vyherny_automat" && m.kde === "dedicstvo" && m.majitel === porazeny) ucinok("vyherny_automat", "Prehra", kl);
          if (m.kde === "dedicstvo" && (m.defId === "vinko" || m.defId === "nealko" || m.defId === "cigorky")) {
            // Stále pravidlo Dedičstva (poldeci navyše, prah +2, cigareta v Pitke) — platí celé kolo.
            ucinok(m.defId, "Dedičstvo", `k${kolo}`);
          }
          if (KLIATBY.has(m.defId)) continue;
          const relevantne = t.filter((x) => (x === "Bitka" && vLinii) || (x === "Furt" && vLinii) || (x === "Dedičstvo" && m.kde === "dedicstvo"));
          if (relevantne.length === 0) continue;
          if (bitkaOdtlacok(bezEfektu(bs, m.uid)) !== zaklad) {
            for (const x of relevantne) ucinok(m.defId, x, x === "Bitka" ? kl : `k${kolo}`);
          }
        }
        // Kliatby: Bitka nastane, keď ich hráč má priznané (Dlh, Cirhóza) alebo v ruke/línii (Absťák).
        for (const q of [0, 1] as const) {
          const h = pred.hraci[q];
          if (h.priznane.some((k) => k.defId === "dlh")) prilezitost("dlh", "Bitka", `k${kolo}h${q}`);
          if (h.priznane.some((k) => k.defId === "cirhoza")) prilezitost("cirhoza", "Bitka", `k${kolo}h${q}`);
          if (h.ruka.some((k) => k.defId === "abstak") || h.priznane.some((k) => k.defId === "abstak")) prilezitost("abstak", "Bitka", `k${kolo}h${q}`);
        }
      }
    }
    s = po;
  }
}

// ---------------------------------------------------------------------------

const t0 = Date.now();
for (let i = 0; i < PARTII; i++) {
  hra = i;
  const a = POVAHY[i % 3] as string;
  const b = POVAHY[Math.floor(i / 3) % 3] as string;
  odohraj(70_000 + i * 7919, 90_000 + i * 104_729, [a, b]);
  uzavriPartiu();
  if ((i + 1) % 6 === 0) process.stderr.write(`${i + 1}/${PARTII} partií, ${Math.round((Date.now() - t0) / 1000)} s\n`);
}

// Statika: kópie v hre.
const START = new Set(Object.keys(KONSTANTY.START_RUKA));
function kopie(c: { id: string; tags: string[] }): number {
  if (c.tags.includes("Lokalita") || c.tags.includes("Starešina")) return 1;
  if (KLIATBY.has(c.id)) return 0;
  if (START.has(c.id)) return 2;
  return KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU;
}

const vystup = {
  partii: PARTII,
  kol,
  okamihy,
  bitiek: bitiekSpolu,
  zhodaBitky,
  allTriggers: ALL_TRIGGERS,
  karty: cardsJson.cards.map((c) => ({
    id: c.id,
    name: c.name,
    tags: c.tags,
    triggers: c.triggers,
    text: c.effect_text,
    kopie: kopie(c),
    vylozene: vylozene.get(c.id) ?? { linia: 0, dedicstvo: 0 },
    dosah: dosah.get(c.id) ?? { stavba: 0, senok: 0, ruka: 0 },
    spustace: Object.fromEntries(c.triggers.map((t) => [t, stat.get(`${c.id}|${t}`) ?? { prilezitosti: 0, ucinky: 0 }])),
  })),
};
if (JSON_CESTA !== "") writeFileSync(JSON_CESTA, JSON.stringify(vystup, null, 1));
process.stderr.write(`hotovo za ${Math.round((Date.now() - t0) / 1000)} s; zhoda protifaktu bitky ${zhodaBitky}/${bitiekSpolu}\n`);
