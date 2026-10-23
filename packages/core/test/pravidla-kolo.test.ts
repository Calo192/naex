// Rozhodca pravidiel (prvý prechod 2026-10-22): priebeh kola podľa PRAVIDLA.md
// §1, §4–§7 a §11 — voľba cieľa, poradie v Pitke, odpoveď na NA EX, Vypiť,
// Dedičstvo, Pitka (Dlh, Fajčiar, Cigorky, Vízia), patronát, príprava hry.
// Očakávané hodnoty sú z textu pravidiel, nie z toho, čo kód vráti.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardDef, CardInstance, Command, Event, GameData, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import {
  DLZKY_HRY,
  IllegalCommandError,
  apply,
  buildGameData,
  dostupneDlzky,
  evaluateLine,
  favourStarsieho,
  legalCommands,
  loadGameData,
  moznyPatronat,
  naTahu,
  naexCieleVLinii,
  opponentOf,
  parseCards,
  parseScorecards,
  prevahaStran,
  setupGame,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };

function sadaS(...defs: CardDef[]): GameData {
  const cards = new Map(data.cards);
  for (const d of defs) cards.set(d.id, d);
  return buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
}

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahuHrac: PlayerId): PitkaStav {
  return {
    naTahu: naTahuHrac,
    hotovy: [false, false],
    naexPouzity: [false, false],
    fajcenie: [0, 0],
    reakcia: null,
    postarka: [false, false],
    starosta: [false, false],
    naexPocet: [0, 0],
    vykup: [false, false],
  };
}

/** Stav v Pitke (útočník 0, obranca 1 je na ťahu). */
function vPitke(sada: GameData, seed: number, strany: GameState["strany"], uprav: Partial<GameState> = {}): GameState {
  const s0 = setupGame(sada, seed);
  return { ...s0, faza: "pitka", utocnik: 0, strany, pitkyCelkom: 1, pitkaCislo: 1, pitkaStav: pitkaStav(1), ...uprav };
}

/** Obaja skončia Pitku bez NA EX (obranca, potom útočník) — vráti stav a všetky udalosti. */
function dopiPitku(sada: GameData, s: GameState): { state: GameState; events: Event[] } {
  const events: Event[] = [];
  let st = s;
  for (let i = 0; i < 2 && st.faza === "pitka" && st.vizia === null; i++) {
    const r = apply(sada, st, { type: "skipNaex" }, naTahu(st)!);
    st = r.state;
    events.push(...r.events);
  }
  return { state: st, events };
}

function vysledokPitky(events: readonly Event[]): Extract<Event, { type: "pitkaVysledok" }> {
  const e = events.find((x) => x.type === "pitkaVysledok");
  if (e?.type !== "pitkaVysledok") throw new Error("Pitka sa nevyhodnotila");
  return e;
}

// --- §7 Voľba cieľa a útočník -------------------------------------------------

describe("§7 Priebeh kola — kto volí cieľ a kto útočí", () => {
  it("§7: cieľ kola vyberá a natáča obranca, útočník nie", () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = setupGame(data, seed);
      const o = opponentOf(s.utocnik);
      expect(naTahu(s)).toBe(o);
      expect(legalCommands(data, s, s.utocnik)).toEqual([]);
      const lok = s.lokalityVHre[0]!;
      expect(() => apply(data, s, { type: "chooseLocation", uid: lok.uid, otocena: true }, s.utocnik)).toThrow(IllegalCommandError);
      const po = apply(data, s, { type: "chooseLocation", uid: lok.uid, otocena: true }, o).state;
      expect(po.ciel?.lokalita?.uid).toBe(lok.uid);
      expect(po.lokalitaOtocena).toBe(true);
    }
  });

  it("§7: útočník prvého kola je náhodný — zo semienka raz jeden, raz druhý hráč", () => {
    const utocnici = new Set<PlayerId>();
    for (let seed = 1; seed <= 30; seed++) utocnici.add(setupGame(data, seed).utocnik);
    expect([...utocnici].sort()).toEqual([0, 1]);
  });
});

// --- §7 Pitka nahlas a §5 odpoveď na NA EX ------------------------------------

describe("§7 Pitka — obranca začína, útočník má posledné slovo (Michal 2026-10-21)", () => {
  it("§7/§5: obranca začína; po jeho NA EX odpovedá útočník; „hotovo“ je nevratné; na NA EX útočníka obranca už len odpovie", () => {
    const s0 = setupGame(data, 5);
    const pijan0 = inst("pijan");
    const pijan1 = inst("pijan");
    let s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      utocnik: 0,
      strany: [[lezi(pijan0, 0)], [lezi(pijan1, 1)]],
      pitkyCelkom: 1,
      pitkaCislo: 0,
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [0, 0], pasoval: [false, true], navyse: [0, 0] },
    };
    // Útočník pasuje → začína Pitka a na ťahu je obranca.
    s = apply(data, s, { type: "pass" }, 0).state;
    expect(s.faza).toBe("pitka");
    expect(naTahu(s)).toBe(1);
    // Obranca dá NA EX → útočník smie odpovedať jednou kartou; počas odpovede sa nefajčí ani nedáva NA EX.
    s = apply(data, s, { type: "naex", uid: pijan0.uid }, 1).state;
    expect(s.pitkaStav?.reakcia).toBe(0);
    const odpoved = legalCommands(data, s, 0);
    expect(odpoved.some((c) => c.type === "place")).toBe(true);
    expect(odpoved.every((c) => c.type === "place" || c.type === "bezReakcie")).toBe(true);
    s = apply(data, s, { type: "bezReakcie" }, 0).state;
    // Po odpovedi je znova na ťahu ten, kto NA EX dal.
    expect(naTahu(s)).toBe(1);
    s = apply(data, s, { type: "skipNaex" }, 1).state;
    // „Hotovo“ je nevratné: obranca už nič nehrá, je na ťahu útočník.
    expect(naTahu(s)).toBe(0);
    expect(legalCommands(data, s, 1)).toEqual([]);
    // Útočník dá NA EX → obranca (už hotový) smie len odpovedať jednou kartou.
    s = apply(data, s, { type: "naex", uid: pijan1.uid }, 0).state;
    expect(s.pitkaStav?.reakcia).toBe(1);
    expect(legalCommands(data, s, 1).every((c) => c.type === "place" || c.type === "bezReakcie")).toBe(true);
    s = apply(data, s, { type: "bezReakcie" }, 1).state;
    expect(naTahu(s)).toBe(0);
    // Po „hotovo“ oboch sa Pitka vyhodnotí — obranca sa už na ťah nedostane.
    const { events } = apply(data, s, { type: "skipNaex" }, 0);
    expect(events.some((e) => e.type === "pitkaVysledok")).toBe(true);
  });

  it("§14 Most: aj odpoveď na NA EX smie len na vlastnú stranu", () => {
    const pijan0 = inst("pijan");
    const s = vPitke(data, 6, [[lezi(pijan0, 0)], [lezi(inst("pijan"), 1)]], {
      ciel: { typ: "lokalita", lokalita: inst("most") },
    });
    const po = apply(data, s, { type: "naex", uid: pijan0.uid }, 1).state;
    expect(po.pitkaStav?.reakcia).toBe(0);
    const miesta = legalCommands(data, po, 0).filter((c): c is Extract<Command, { type: "place" }> => c.type === "place");
    expect(miesta.length).toBeGreaterThan(0);
    expect(miesta.every((c) => c.target === "vlastna")).toBe(true);
    const karta = miesta[0]!.uid;
    expect(() => apply(data, po, { type: "place", uid: karta, target: "superova" }, 0)).toThrow(IllegalCommandError);
  });
});

// --- §5 Vypiť a §6 Dedičstvo ----------------------------------------------------

describe("§5 Vypiť a §6 Priznanie a Dedičstvo v ťahu", () => {
  function vZhromazdeni(ruka: CardInstance[], h: Partial<PlayerState> = {}): GameState {
    const s0 = setupGame(data, 8);
    return sHracom(
      {
        ...s0,
        faza: "zhromazdenie",
        utocnik: 0,
        pitkyCelkom: 1,
        pitkaCislo: 0,
        zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
      },
      0,
      { ruka, ...h },
    );
  }

  it("§5: Vypiť ide pred kartu — „karta, Vypiť, karta“ ťah neprejde, „Vypiť, karta, karta“ áno", () => {
    const a = inst("pijan");
    const b = inst("pijan");
    const s = vZhromazdeni([a, b], { poldeciPlne: 2 });
    const zle: Command = { type: "tah", kroky: [{ type: "place", uid: a.uid, target: "vlastna" }, { type: "vypit" }, { type: "place", uid: b.uid, target: "vlastna" }] };
    expect(() => apply(data, s, zle, 0)).toThrow(IllegalCommandError);
    const dobre: Command = { type: "tah", kroky: [{ type: "vypit" }, { type: "place", uid: a.uid, target: "vlastna" }, { type: "place", uid: b.uid, target: "vlastna" }] };
    const po = apply(data, s, dobre, 0).state;
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([a.uid, b.uid]);
    expect(po.hraci[0].poldeciPlne).toBe(1);
  });

  it("§6: priznanie neodovzdá ťah, vyloženie Nástroja do Dedičstva áno — a limit vykladania nemíňa", () => {
    const cirhoza = inst("cirhoza");
    const noviny = inst("noviny");
    let s = vZhromazdeni([cirhoza, noviny], { cigarety: 3 });
    s = apply(data, s, { type: "place", uid: cirhoza.uid, target: "priznanie" }, 0).state;
    expect(naTahu(s)).toBe(0);
    // Za Cirhózu sa karta nedoberá (Michal 2026-10-20).
    expect(s.hraci[0].ruka.map((k) => k.uid)).toEqual([noviny.uid]);
    s = apply(data, s, { type: "place", uid: noviny.uid, target: "dedicstvo" }, 0).state;
    expect(s.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([noviny.uid]);
    expect(s.hraci[0].cigarety).toBe(2);
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(3);
    expect(naTahu(s)).toBe(1);
  });
});

// --- §5 NA EX pri lokalite a §14 NA EX na Veterána ----------------------------------

describe("§5 NA EX na kartu pri lokalite a §14 NA EX na Veterána", () => {
  it("§5: NA EX na kartu pri lokalite ruší a zdvojuje len jej akcie — hrana lokality ostáva, ako bola", () => {
    const lok = makeDef("r_lok", ["Rana", null, null, null], EMPTY, { tags: ["Lokalita"] });
    const pri: Layout4 = ["Pecka", "Rana", null, null];
    const karta = makeDef("r_pri", EMPTY, pri);
    const sada = syntheticData([lok, karta]);
    const lokalita = instanceFor(sada, "r_lok", ["Rana", null, null, null], EMPTY);
    const c = instanceFor(sada, "r_pri", EMPTY, pri);
    const bez = evaluateLine(sada, { lokalita, lokalitaOtocena: false, strany: [[lezi(c, 0)], []] });
    const sNaex = evaluateLine(sada, { lokalita, lokalitaOtocena: false, strany: [[lezi(c, 0, 1)], []] });
    const zLokality = (ev: typeof bez): number => (ev.zdroje[0].Rana ?? []).filter((z) => z.vStrede).reduce((a, z) => a + z.hodnota, 0);
    expect(zLokality(bez)).toBe(1);
    expect(zLokality(sNaex)).toBe(1);
    expect(sNaex.aktivneStredu[0]).toBe(bez.aktivneStredu[0]);
    // Karta: aktívna Pecka zrušená, neaktívna Rana ×2.
    expect(sNaex.sums[0].Pecka ?? 0).toBe(0);
    expect(sNaex.sums[0].Rana).toBe(1 + 2);
  });

  it("§5: na kartu, na ktorej už poldeci leží, ďalšie NA EX dať nedá — ani súper", () => {
    const pijan = inst("pijan");
    const strany: GameState["strany"] = [[lezi(pijan, 0, 0)], [lezi(inst("pijan"), 1)]];
    expect(naexCieleVLinii(data, strany, 0)).not.toContain(pijan.uid);
    expect(naexCieleVLinii(data, strany, 1)).not.toContain(pijan.uid);
    expect(naexCieleVLinii(data, strany, 1)).toHaveLength(1);
  });

  it("§7 Počet Pitiek: Odpor na hrane lokality sa ráta ako jej aktívna akcia, hrana zrušená Odporom karty nie", () => {
    const lok = makeDef("r_lok_o", ["Odpor", "Rana", null, null], EMPTY, { tags: ["Lokalita"] });
    const pri: Layout4 = ["Rana", "Odpor", null, null];
    const karta = makeDef("r_pri_o", EMPTY, pri);
    const sada = syntheticData([lok, karta]);
    const ev = evaluateLine(sada, {
      lokalita: instanceFor(sada, "r_lok_o", ["Odpor", "Rana", null, null], EMPTY),
      lokalitaOtocena: false,
      strany: [[lezi(instanceFor(sada, "r_pri_o", EMPTY, pri), 0)], []],
    });
    expect(ev.aktivneStredu).toEqual([1, 0]);
  });

  it("§14 Veterán: NA EX naňho zdvojí jeho aktívne akcie a nezruší ich; neaktívne ostanú neaktívne (v4)", () => {
    const R4: Layout4 = ["Rana", "Rana", "Rana", "Rana"];
    const R2: Layout4 = ["Rana", "Rana", null, null];
    const veteran = makeDef("veteran", R4, R4, { tags: ["Občan", "Chlap"] });
    const chlap = makeDef("r_chlap", EMPTY, R2, { tags: ["Občan", "Chlap"] });
    const obcan = makeDef("r_obcan", R4, R4, { tags: ["Občan"] });
    const sada = syntheticData([veteran, chlap, obcan]);
    // Chlap vľavo spáruje dve ľavé Rany karty v strede; ostatné jej akcie sú neaktívne.
    const ev = (defId: string, naex: boolean) => {
      const stred = instanceFor(sada, defId, R4, R4);
      const linia = evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany: [[], [lezi(instanceFor(sada, "r_chlap", EMPTY, R2), 0), naex ? lezi(stred, 0, 1) : lezi(stred, 0)]] });
      return { rana: linia.sums[0].Rana, stav: [...linia.cards.get(stred.uid)!.left, ...linia.cards.get(stred.uid)!.right].map((x) => x?.stav) };
    };
    expect(ev("veteran", false).rana).toBe(2 + 2);
    // Veterán: 2 aktívne × 2, šesť neaktívnych ostane neaktívnych.
    expect(ev("veteran", true).rana).toBe(2 + 4);
    expect(ev("veteran", true).stav.filter((x) => x === "neaktivna")).toHaveLength(6);
    // Bežný Občan pre porovnanie: aktívne zruší, neaktívne zdvojí.
    expect(ev("r_obcan", true).rana).toBe(2 + 12);
  });
});

// --- §7 Pitka — vyhodnotenie --------------------------------------------------------

describe("§7 Pitka — poradie vyhodnotenia", () => {
  it("§7 krok 2: za každý celý prah zadĺženia jeden Dlh — 5 pri prahu 2 = 2 Dlhy, zvyšok sa po Pitke vynuluje", () => {
    const vonk: Layout4 = ["Dlh", "Dlh", "Dlh", null];
    const vnut: Layout4 = ["Dlh", "Dlh", "Rana", null];
    const o = makeDef("r_dlh_o", EMPTY, vonk);
    const i = makeDef("r_dlh_i", vnut, EMPTY);
    const sada = sadaS(o, i);
    const strany: GameState["strany"] = [[lezi(instanceFor(sada, "r_dlh_i", vnut, EMPTY), 0), lezi(instanceFor(sada, "r_dlh_o", EMPTY, vonk), 0)], []];
    const s = vPitke(sada, 12, strany);
    expect(evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany }).sums[0].Dlh).toBe(5);
    const { state, events } = dopiPitku(sada, s);
    expect(vysledokPitky(events).dlhy).toEqual([2, 0]);
    expect(state.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(2);
    expect(state.hraci[0].zadlzenie).toBe(0);
  });

  it("§9 Fajčiar: +sila cigariet (bez ×2) len v 1. Pitke bitky o lokalitu", () => {
    const s0 = setupGame(data, 11);
    const idx = s0.starsi.findIndex((e) => favourStarsieho(data, e) === "FAJCIAR");
    expect(idx).toBeGreaterThanOrEqual(0);
    // Marker na indexe 1 = oranžová zóna na polovici hráča 0 → sila 2.
    const starsi = s0.starsi.map((e, i) => (i === idx ? { ...e, marker: 1 as const, markerZaciatokKola: 1 as const } : e));
    const zaklad: Partial<GameState> = { starsi, ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! }, lokalityVHre: s0.lokalityVHre.slice(1) };
    const prva = vysledokPitky(dopiPitku(data, vPitke(data, 11, [[], []], zaklad)).events);
    expect(prva.cigarety).toEqual([2, 0]);
    const druha = vysledokPitky(dopiPitku(data, vPitke(data, 11, [[], []], { ...zaklad, pitkyCelkom: 2, pitkaCislo: 2 })).events);
    expect(druha.cigarety).toEqual([0, 0]);
  });

  it("§7 krok 5 / §6 Cigorky: cigareta navyše v každej Pitke — súperove Obmedzenia ju neuberú", () => {
    const O4: Layout4 = ["Obmedzenie", "Obmedzenie", "Obmedzenie", "Obmedzenie"];
    const obm = makeDef("r_obm", O4, O4);
    const sada = sadaS(obm);
    const strany: GameState["strany"] = [[], [lezi(instanceFor(sada, "r_obm", O4, O4), 1), lezi(instanceFor(sada, "r_obm", O4, O4), 1)]];
    expect(evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany }).sums[1].Obmedzenie).toBe(8);
    const s = vPitke(sada, 13, strany);
    const sCigorkami = sHracom(s, 0, { dedicstvo: [inst("cigorky")] });
    expect(vysledokPitky(dopiPitku(sada, sCigorkami).events).cigarety[0]).toBe(1);
    expect(vysledokPitky(dopiPitku(sada, s).events).cigarety[0]).toBe(0);
  });

  it("§7 krok 7: o Vízii rozhoduje najprv obranca, potom útočník", () => {
    const V: Layout4 = ["Vízia", null, null, null];
    const vid = makeDef("r_vid", V, V);
    const sada = sadaS(vid);
    const k = (p: PlayerId): PlacedCard => lezi(instanceFor(sada, "r_vid", V, V), p);
    const s = vPitke(sada, 14, [[k(0), k(0)], [k(1), k(1)]]);
    let st = dopiPitku(sada, s).state;
    expect(st.vizia?.zostava).toEqual([2, 2]);
    // Útočník je 0, obranca 1.
    expect(naTahu(st)).toBe(1);
    st = apply(sada, st, { type: "vizia", vziat: true }, 1).state;
    expect(naTahu(st)).toBe(1);
    st = apply(sada, st, { type: "vizia", vziat: true }, 1).state;
    expect(naTahu(st)).toBe(0);
  });
});

// --- §7 Patronát --------------------------------------------------------------------

describe("§7 Patronát — obmedzenia", () => {
  function vPatronate(): { s: GameState; u: PlayerId; obcan: CardInstance } {
    const s0 = setupGame(data, 31);
    const u = s0.utocnik;
    const obcan = inst("pijan");
    const marker = (u === 0 ? 1 : 7) as 1 | 7;
    const doplnok = [inst("pijan"), inst("pijan"), inst("pijan")];
    const s = sHracom(
      {
        ...s0,
        faza: "draft",
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
        lokalityVHre: s0.lokalityVHre.slice(1),
        starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker, markerZaciatokKola: marker } : e)),
        draftStav: { krok: "patronat", balicky: [[], []], vyber: [null, null], naTahu: u, hotovo: [false, false], noveKarty: [0, 0] },
      },
      u,
      { ruka: [obcan], cigarety: 3, doberaci: [...s0.hraci[u].doberaci, ...doplnok] },
    );
    return { s, u, obcan };
  }

  it("§7: po patronáte marker ide do stredu a ráta sa ako začiatok kola — na krajnú sa v tomto kole nedostane", () => {
    const { s, u, obcan } = vPatronate();
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    expect(po.starsi[0]!.marker).toBe(4);
    expect(po.starsi[0]!.markerZaciatokKola).toBe(4);
  });

  it("§7: každý smie vziať najviac jedného staršieho za kolo", () => {
    const { s, u, obcan } = vPatronate();
    expect(moznyPatronat(data, s, u).length).toBeGreaterThan(0);
    const uzMa: GameState = { ...s, patronat: (u === 0 ? [{ elderId: "x", nahrada: obcan, pohorsenia: 2 }, null] : [null, { elderId: "x", nahrada: obcan, pohorsenia: 2 }]) as GameState["patronat"] };
    expect(moznyPatronat(data, uzMa, u)).toEqual([]);
  });

  it("§7: kartu staršieho z patronátu smie hráč vyložiť ako Starešinu — ráta sa do prevahy a smie naň dať NA EX", () => {
    const { s, u, obcan } = vPatronate();
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    const starsi = po.starsi[0]!.karta;
    const strany: GameState["strany"] = u === 0 ? [[lezi(starsi, 0)], []] : [[], [lezi(starsi, 1)]];
    expect(prevahaStran(data, strany)[u]).toBe(u);
    expect(naexCieleVLinii(data, strany, u)).toContain(starsi.uid);
    expect(naexCieleVLinii(data, strany, opponentOf(u))).toContain(starsi.uid);
  });

  it("§8.4: pri remíze sa patronát vyrieši ako prehra — starší späť na scorecard, náhrada do ruky, bolestné poldeci", () => {
    const { s, u, obcan } = vPatronate();
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    const starsiUid = po.starsi[0]!.karta.uid;
    const remiza: GameState = sHracom(
      {
        ...po,
        faza: "bitka",
        draftStav: null,
        zhromazdenieStav: null,
        kolo: 2,
        bitkaStav: {
          krok: "pohreb",
          caka: 0,
          sums: [{}, {}],
          exekutorHotovy: [true, true],
          pohorsenieZostava: [0, 0],
          pohorsenieHranice: {},
          damage: null,
          vitaz: null,
          prebytokDrzi: null,
          prebytokZostava: 0,
          prebytokPosunute: [],
          pohrebHotovy: [false, true],
          benzinkaZostava: [0, 0],
          spalit: [],
          vesticaHotova: true,
        },
      },
      u,
      { poldeciPlne: 2, poldeciVypite: 0 },
    );
    const konec = apply(data, remiza, { type: "skipPohreb" }, 0).state;
    expect(konec.starsi[0]!.karta.uid).toBe(starsiUid);
    expect(konec.starsi[0]!.nahradeny).toBe(false);
    expect(konec.hraci[u].ruka.map((k) => k.uid)).toContain(obcan.uid);
    // Bolestné: bez vypitého odhodí plný (2 → 1); na začiatku kola sa nemá čo doliať.
    expect(konec.hraci[u].poldeciPlne + konec.hraci[u].poldeciVypite).toBe(1);
  });

  it("§7: kartu staršieho z patronátu nemožno vymeniť Starostom", () => {
    const { s, u, obcan } = vPatronate();
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    const starsiUid = po.starsi[0]!.karta.uid;
    const zoSenku = inst("pijan");
    const vlastna: PlacedCard = lezi(inst("starosta"), u);
    const pitka: GameState = sHracom(
      {
        ...po,
        faza: "pitka",
        draftStav: null,
        zhromazdenieStav: null,
        senok: [zoSenku],
        strany: u === 0 ? [[vlastna], []] : [[], [vlastna]],
        pitkyCelkom: 1,
        pitkaCislo: 1,
        pitkaStav: pitkaStav(u),
      },
      u,
      { cigarety: 3, ruka: [...po.hraci[u].ruka, inst("pijan")] },
    );
    const starosta = legalCommands(data, pitka, u).filter((c) => c.type === "starosta");
    expect(starosta.length).toBeGreaterThan(0);
    expect(starosta.some((c) => c.type === "starosta" && c.rukaUid === starsiUid)).toBe(false);
    expect(() => apply(data, pitka, { type: "starosta", rukaUid: starsiUid, senokUid: zoSenku.uid }, u)).toThrow(IllegalCommandError);
  });
});

// --- §11 Príprava hry -----------------------------------------------------------------

describe("§11 Príprava hry", () => {
  it("§11: 8 starších s markerom v strede, nikto nič neohlásil", () => {
    const s = setupGame(data, 21);
    expect(s.starsi).toHaveLength(8);
    expect(s.starsi.every((e) => e.marker === 4 && e.markerZaciatokKola === 4 && !e.nahradeny)).toBe(true);
    expect(s.ohlaseneVydesenie).toEqual([null, null]);
    expect(s.kolo).toBe(1);
  });

  it("§11: dĺžka hry 5 / 7 / 11 lokalít; dlhá len so sadou, ktorá má aspoň 11 lokalít", () => {
    expect(DLZKY_HRY).toEqual({ kratka: 5, stredna: 7, dlha: 11 });
    for (const n of [5, 7, 11]) {
      const s = setupGame(data, 22, { lokalit: n });
      expect(s.lokalitCelkom).toBe(n);
      expect(s.lokalityVHre).toHaveLength(n);
    }
    expect(dostupneDlzky(data)).toContain("dlha");
    // Sada s 10 lokalitami dlhú hru neponúkne a nespustí.
    const nechaj = new Set(data.lokality.slice(0, 10).map((d) => d.id));
    const cards = new Map([...data.cards].filter(([, d]) => !d.tags.includes("Lokalita") || nechaj.has(d.id)));
    const mala = buildGameData(cards, data.elders, parseScorecards(scorecardsJson));
    expect(dostupneDlzky(mala)).toEqual(["kratka", "stredna"]);
    expect(() => setupGame(mala, 22, { lokalit: 11 })).toThrow();
  });
});

// --- §3, §5, §7 doplnky ---------------------------------------------------------------

describe("§3, §5 a §7 — doplnky prvého prechodu", () => {
  it("§3: starý kľúč akcie Cigaretka sa pri načítaní sady preloží na Cigareta", () => {
    const karta = {
      id: "r_stara",
      index: 900,
      name: "Stará",
      tags: ["Občan"],
      effect_text: "",
      triggers: [],
      left: { blocked: [1, 2, 3], actions: { Cigaretka: 1 } },
      right: { blocked: [1, 2, 3], actions: {} },
      permutations: { total: 1, left: 1, right: 1 },
    };
    const sada = parseCards({ cards: [karta] });
    expect(sada.get("r_stara")?.left.actions).toEqual({ Cigareta: 1 });
  });

  it("§5: NA EX v základe najviac raz za Pitku", () => {
    const a = inst("pijan");
    const b = inst("pijan");
    const s = vPitke(data, 15, [[lezi(a, 1), lezi(b, 1)], []]);
    const po = apply(data, s, { type: "naex", uid: a.uid }, 1).state;
    const dalej = po.pitkaStav?.reakcia === null ? po : apply(data, po, { type: "bezReakcie" }, 0).state;
    expect(naTahu(dalej)).toBe(1);
    expect(legalCommands(data, dalej, 1).some((c) => c.type === "naex")).toBe(false);
    expect(() => apply(data, dalej, { type: "naex", uid: b.uid }, 1)).toThrow(IllegalCommandError);
  });

  it("§5: pečeň z NA EX sa pripíše hneď tomu, kto NA EX dal — aj keď karta je súperova", () => {
    const pijan0 = inst("pijan");
    const s = vPitke(data, 16, [[lezi(pijan0, 0)], []]);
    const po = apply(data, s, { type: "naex", uid: pijan0.uid }, 1).state;
    expect(po.hraci[1].pecen).toBe(s.hraci[1].pecen + 1);
    expect(po.hraci[0].pecen).toBe(s.hraci[0].pecen);
    // Poldeci sa vypije až v bitke — teraz leží na karte a ráta sa dávajúcemu do limitu.
    expect(po.hraci[1].poldeciPlne + po.hraci[1].poldeciVypite).toBe(s.hraci[1].poldeciPlne + s.hraci[1].poldeciVypite - 1);
    expect(po.strany[0][0]?.naexBy).toBe(1);
  });

  it("§5: limit vykladania sa počíta nanovo na začiatku každého Zhromaždenia (aj medzi Pitkami)", () => {
    const R: Layout4 = ["Rana", null, null, null];
    const R3: Layout4 = [null, null, null, "Rana"];
    const lok = makeDef("r_lok_2p", R, R, { tags: ["Lokalita"] });
    const c0 = makeDef("r_c0", EMPTY, R);
    const c1 = makeDef("r_c1", EMPTY, R3);
    const sada = sadaS(lok, c0, c1);
    let s = vPitke(sada, 17, [[lezi(instanceFor(sada, "r_c0", EMPTY, R), 0)], [lezi(instanceFor(sada, "r_c1", EMPTY, R3), 1)]], {
      ciel: { typ: "lokalita", lokalita: instanceFor(sada, "r_lok_2p", R, R) },
      pitkyCelkom: 2,
    });
    s = sHracom(s, 0, { poldeciPlne: 1, poldeciVypite: 0, cigarety: 5 });
    // Útočník 0 dokúpi barterom poldeci v Pitke — v ďalšom Zhromaždení má limit 2 + 0 + 1.
    s = apply(sada, s, { type: "skipNaex" }, 1).state;
    s = apply(sada, s, { type: "barter" }, 0).state;
    s = apply(sada, s, { type: "skipNaex" }, 0).state;
    expect(s.faza).toBe("zhromazdenie");
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(2 + 0 + 1);
    expect(s.zhromazdenieStav?.naTahu).toBe(0);
  });

  it("§5/§14 Zastávka: Vypiť znižuje spoločný limit obom", () => {
    const s0 = setupGame(data, 18);
    const s = sHracom(
      {
        ...s0,
        faza: "zhromazdenie",
        utocnik: 0,
        ciel: { typ: "lokalita", lokalita: inst("zastavka") },
        pitkyCelkom: 1,
        pitkaCislo: 0,
        zhromazdenieStav: { naTahu: 0, zostavaLimit: [5, 5], pasoval: [false, false], navyse: [0, 0], spolocny: true, vlastny: [3, 2] },
      },
      0,
      { poldeciPlne: 2, ruka: [inst("pijan"), inst("pijan")] },
    );
    const po = apply(data, s, { type: "vypit" }, 0).state;
    expect(po.zhromazdenieStav?.zostavaLimit).toEqual([4, 4]);
  });

  it("§7: násobky sa násobia — NA EX × Silná nezávislá žena = ×4", () => {
    const R: Layout4 = ["Rana", null, null, null];
    const karta = makeDef("r_nasob", EMPTY, R);
    const zena = makeDef("silna_nezavisla_zena", EMPTY, EMPTY, { tags: ["Občan", "Žena"] });
    const sada = syntheticData([karta, zena]);
    const c = instanceFor(sada, "r_nasob", EMPTY, R);
    // Karta hráča 0 bez spoja (Rana neaktívna) s NA EX, vedľa nej jeho Silná žena.
    const ev = evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany: [[lezi(c, 0, 1), lezi(instanceFor(sada, "silna_nezavisla_zena", EMPTY, EMPTY), 0)], []] });
    expect(ev.sums[0].Rana).toBe(4);
  });

  it("§7: NA EX leží na karte až do bitky — jej akcie sa vyhodnotia aj v ďalšej Pitke kola", () => {
    const D: Layout4 = ["Dlh", null, null, null];
    const sada = sadaS(makeDef("r_dlh_naex", EMPTY, D));
    // Druhá Pitka kola: Dlh karty bez spoja je neaktívny, NA EX ho zdvojí → zadĺženie 2 = 1 Dlh.
    const s = vPitke(sada, 19, [[lezi(instanceFor(sada, "r_dlh_naex", EMPTY, D), 0, 0)], []], { pitkyCelkom: 2, pitkaCislo: 2 });
    expect(vysledokPitky(dopiPitku(sada, s).events).dlhy).toEqual([1, 0]);
  });
});
