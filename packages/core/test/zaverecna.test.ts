// Záverečná (roadmapa #83, Michal 2026-10-23): v Zhromaždení za cigaretu karta
// lícom dole na koniec strany; hráč tým končí s vykladaním (bez cigariet za pas).
// Ráta sa normálne, súper z nej nevidí nič, za ňu sa nedá priložiť, NA EX na ňu
// smie len súper (vždy prejde) a otočí sa na konci Pitky — vtedy Nástup
// a odložené efekty, ktoré by ju prezradili (Svokra).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, planVykladania, setupGame, tahBota, uidZaverecnej, viewFor } from "../src/index.ts";
import { naexOdkryte } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 60000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie v kole o Jednotu, hráč 0 na ťahu s danou rukou. */
function vZhromazdeni(ruka: CardInstance[], strany: GameState["strany"] = [[], []], cigarety = 3): GameState {
  const s = setupGame(data, 11);
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita: inst("jednota") },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    strany,
    hraci: [
      { ...s.hraci[0], ruka, cigarety, poldeciPlne: 2 },
      { ...s.hraci[1], ruka: [inst("pijan"), inst("hasic")], cigarety: 3, poldeciPlne: 2 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

/** Pitka, hráč `naTahu` na ťahu, so skrytou Záverečnou v strany. */
function vPitke(strany: GameState["strany"], naTahu: PlayerId = 0): GameState {
  const s = setupGame(data, 12);
  return {
    ...s,
    faza: "pitka",
    ciel: { typ: "lokalita", lokalita: inst("jednota") },
    pitkyCelkom: 1,
    pitkaCislo: 1,
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: 1, cigarety: 3 },
      { ...s.hraci[1], poldeciPlne: 1, cigarety: 3 },
    ],
    pitkaStav: { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    zaverecnaOdklad: [
      strany.flat().some((pl) => pl.zaverecna === true && pl.playedBy === 0) ? { naexSupera: 0, naexVlastne: 0, zahodeniaSupera: 0 } : null,
      strany.flat().some((pl) => pl.zaverecna === true && pl.playedBy === 1) ? { naexSupera: 0, naexVlastne: 0, zahodeniaSupera: 0 } : null,
    ],
  } as GameState;
}

const skryta = (karta: CardInstance, playedBy: PlayerId): PlacedCard => ({ card: karta, playedBy, zaverecna: true });

/** Dohrá Pitku bez NA EX (Vízia: kartu si nechá) — kým sa nezmení fáza. */
function dohrajPitku(s: GameState): { state: GameState; logy: string[] } {
  const logy: string[] = [];
  for (let i = 0; i < 20 && s.faza === "pitka"; i++) {
    const kto = s.pitkaStav?.naTahu ?? 0;
    const r = apply(data, s, s.vizia !== null ? { type: "vizia", vziat: true } : { type: "skipNaex" }, kto);
    for (const e of r.events) if (e.type === "log") logy.push(e.text);
    s = r.state;
  }
  return { state: s, logy };
}

describe("Záverečná — zahranie", () => {
  it("stojí cigaretu, míňa limit a hráč v Zhromaždení končí — bez cigariet za pas", () => {
    const pijan = inst("pijan");
    const s = vZhromazdeni([pijan, inst("hasic")]);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "zaverecna", uid: pijan.uid, target: "vlastna" });
    const { state, events } = apply(data, s, { type: "zaverecna", uid: pijan.uid, target: "vlastna" }, 0);
    expect(state.hraci[0].cigarety).toBe(2);
    expect(state.zhromazdenieStav?.zostavaLimit[0]).toBe(2);
    expect(state.zhromazdenieStav?.pasoval[0]).toBe(true);
    expect(state.strany[0]).toEqual([{ card: pijan, playedBy: 0, zaverecna: true }]);
    // Log meno karty neprezradí.
    const logy = events.flatMap((e) => (e.type === "log" ? [e.text] : []));
    expect(logy.some((t) => t.includes("Záverečnú lícom dole"))).toBe(true);
    expect(logy.some((t) => t.includes("Pijan"))).toBe(false);
    // Druhá v tom istom Zhromaždení nejde — hráč už nevykladá.
    expect(() => apply(data, { ...state, zhromazdenieStav: { ...state.zhromazdenieStav!, naTahu: 0 } }, { type: "zaverecna", uid: s.hraci[0].ruka[1]!.uid, target: "vlastna" }, 0)).toThrow(/pasoval/);
  });

  it("bez cigarety ani s vyčerpaným limitom sa zahrať nedá", () => {
    const pijan = inst("pijan");
    expect(() => apply(data, vZhromazdeni([pijan], [[], []], 0), { type: "zaverecna", uid: pijan.uid, target: "vlastna" }, 0)).toThrow(/stojí/);
    const bezLimitu = vZhromazdeni([pijan]);
    const s = { ...bezLimitu, zhromazdenieStav: { ...bezLimitu.zhromazdenieStav!, zostavaLimit: [0, 3] as [number, number] } };
    expect(() => apply(data, s, { type: "zaverecna", uid: pijan.uid, target: "vlastna" }, 0)).toThrow(/Limit/);
  });

  it("planVykladania: Záverečná ako posledná karta ťahu, inak chyba", () => {
    const a = inst("pijan");
    const b = inst("hasic");
    const s = vZhromazdeni([a, b]);
    const ok = planVykladania(data, s, 0, 3, [{ karta: a, ciel: "vlastna" }, { karta: b, ciel: "superova", zaverecna: true }]);
    expect(ok.chyba).toBeNull();
    expect(ok.kroky).toEqual([{ type: "vypit" }, { type: "place", uid: a.uid, target: "vlastna" }, { type: "zaverecna", uid: b.uid, target: "superova" }]);
    const zle = planVykladania(data, s, 0, 3, [{ karta: a, ciel: "vlastna", zaverecna: true }, { karta: b, ciel: "superova" }]);
    expect(zle.chyba).toMatch(/posledná/);
    // Celý ťah naraz prejde aj na serveri.
    const po = apply(data, s, { type: "tah", kroky: ok.kroky }, 0).state;
    expect(po.strany[1]).toEqual([{ card: b, playedBy: 0, zaverecna: true }]);
  });
});

describe("Záverečná — súper nevidí nič (viewFor)", () => {
  it("súperov pohľad je rovnaký, nech je lícom dole akákoľvek karta", () => {
    const pred = inst("hasic");
    const zaklad = vPitke([[{ card: pred, playedBy: 0 }], []]);
    const ako = (defId: string): GameState => ({ ...zaklad, strany: [[{ card: pred, playedBy: 0 }, skryta({ uid: 61999, defId, leftLayout: 1, rightLayout: 1 }, 0)], []] });
    const v1 = viewFor(data, ako("pijan"), 1);
    const v2 = viewFor(data, ako("svokra"), 1);
    expect(JSON.stringify(v1)).toBe(JSON.stringify(v2));
    expect(JSON.stringify(v1)).not.toMatch(/"uid":61999[,}]/);
    expect(v1.strany[0].map((pl) => pl.card.uid)).toEqual([pred.uid]);
    expect(v1.zaverecne).toEqual([{ strana: 0, majitel: 0, uid: uidZaverecnej(0), naexBy: null }]);
    // Majiteľ ju vidí a má jej skutočné uid.
    const vlastny = viewFor(data, ako("pijan"), 0);
    expect(vlastny.strany[0].map((pl) => pl.card.defId)).toEqual(["hasic", "pijan"]);
    expect(vlastny.zaverecne[0]?.uid).toBe(61999);
  });

  it("za ňu sa nedá priložiť — ani odpoveď na NA EX", () => {
    const s = vZhromazdeni([inst("pijan")], [[skryta(inst("hasic"), 1)], []]);
    expect(legalCommands(data, s, 0).some((c) => c.type === "place" && c.target === "vlastna")).toBe(false);
    expect(() => apply(data, s, { type: "place", uid: s.hraci[0].ruka[0]!.uid, target: "vlastna" }, 0)).toThrow(/Záverečnú/);
    // Odpoveď na NA EX: hráč 1 na rade, jeho strana je zablokovaná jeho vlastnou Záverečnou.
    const p = vPitke([[], [skryta(inst("hasic"), 1)]], 0);
    const naex = apply(data, { ...p, strany: [[{ card: inst("pijan"), playedBy: 0 }], p.strany[1]] }, { type: "naex", uid: uidZaverecnej(1) }, 0).state;
    const reakcie = legalCommands(data, naex, 1).filter((c) => c.type === "place");
    expect(reakcie.every((c) => c.type === "place" && c.target === "superova")).toBe(true);
  });
});

describe("Záverečná — NA EX", () => {
  it("súper smie aj na Nástroj či Liberála (vždy prejde), majiteľ nie", () => {
    for (const defId of ["noviny", "liberal"]) {
      const s = vPitke([[skryta(inst(defId), 1)], []], 0);
      expect(legalCommands(data, s, 0)).toContainEqual({ type: "naex", uid: uidZaverecnej(0) });
      const po = naexOdkryte(data, s, uidZaverecnej(0), 0).state;
      expect(po.strany[0][0]?.naexBy).toBe(0);
      expect(viewFor(data, po, 0).zaverecne[0]?.naexBy).toBe(0);
    }
    const vlastna = vPitke([[skryta(inst("pijan"), 0)], []], 0);
    expect(legalCommands(data, vlastna, 0).some((c) => c.type === "naex")).toBe(false);
    expect(() => naexOdkryte(data, vlastna, vlastna.strany[0][0]!.card.uid, 0)).toThrow(/svoju Záverečnú/);
  });
});

describe("Záverečná — otočenie na konci Pitky", () => {
  it("otočí sa a Nástup sa vyhodnotí až vtedy", () => {
    const stryna = inst("niekoho_stryna");
    const cirhoza = inst("cirhoza");
    const s = vZhromazdeni([stryna, cirhoza]);
    const po = apply(data, s, { type: "zaverecna", uid: stryna.uid, target: "vlastna" }, 0).state;
    // Nástup (zahoď Cirhózu z ruky) ešte nebol.
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(cirhoza.uid);
    // Súper pasuje → Pitka → koniec Pitky.
    const pitka = apply(data, po, { type: "pass" }, 1).state;
    expect(pitka.faza).toBe("pitka");
    const { state, logy } = dohrajPitku(pitka);
    expect(state.strany[0].find((pl) => pl.card.uid === stryna.uid)?.zaverecna).toBeUndefined();
    expect(logy.some((t) => t.includes("Záverečná hráča 1 sa otáča: Niekoho stryná"))).toBe(true);
    expect([...state.hraci[0].ruka, ...state.hraci[0].odhadzovaci].map((k) => k.uid)).not.toContain(cirhoza.uid);
    expect(viewFor(data, state, 1).zaverecne).toEqual([]);
  });

  it("Svokra lícom dole za NA EX súpera nekradne hneď — až pri otočení", () => {
    const pijan: PlacedCard = { card: inst("pijan"), playedBy: 0 };
    const s = vPitke([[pijan], [skryta(inst("svokra"), 1)]], 0);
    const naex = naexOdkryte(data, s, pijan.card.uid, 0);
    expect(naex.state.hraci[0].cigarety).toBe(3);
    expect(naex.events.some((e) => e.type === "log" && e.text.startsWith("Svokra"))).toBe(false);
    const odpoved = naex.state.pitkaStav?.reakcia === 1 ? apply(data, naex.state, { type: "bezReakcie" }, 1) : null;
    const { state, logy: zvysok } = dohrajPitku(odpoved?.state ?? naex.state);
    const logy = [...(odpoved?.events ?? []).flatMap((e) => (e.type === "log" ? [e.text] : [])), ...zvysok];
    expect(logy.some((t) => t.startsWith("Svokra:"))).toBe(true);
    expect(state.hraci[1].cigarety - state.hraci[0].cigarety).toBeGreaterThanOrEqual(4 - 3);
  });
});

describe("Záverečná — bot", () => {
  it("bot nevidí súperovu Záverečnú: ťah sa nezmení, keď si vymení miesto s kartou v súperovej ruke", () => {
    // Bot pozná súperove karty len ako celok (ruka, balíček, lícom dole) — nie, ktorá kde leží.
    const zaklad = vPitke([[], [{ card: inst("pijan"), playedBy: 1 }]], 1);
    const a = inst("svokra");
    const b = inst("hasic");
    const ako = (skryta_: CardInstance, vRuke: CardInstance): GameState => ({
      ...zaklad,
      strany: [[skryta(skryta_, 0)], zaklad.strany[1]],
      hraci: [{ ...zaklad.hraci[0], ruka: [vRuke, ...zaklad.hraci[0].ruka] }, zaklad.hraci[1]],
    });
    expect(tahBota(data, ako(a, b), 1, 5)).toEqual(tahBota(data, ako(b, a), 1, 5));
  });
});
