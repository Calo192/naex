// Pravidlá v8.3 — Povery „Výpožička priazne“ (Michal 2026-10-30, docs/napady/povery.html,
// sekcia Rozhodnuté): krok Povery pred Pohoršením; každá zvyšná Povera posunie silu priazne
// jedného staršieho o stupeň k svojmu majiteľovi (marker sa nehýbe), strop 3, len na toto kolo.
// Mäkké a celkové poškodenie zanikajú, Nakladačka = rozdiel tuhého a drží ju víťaz.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Favour, GameState, MarkerPos, PlayerId } from "../src/index.ts";
import {
  apply,
  favourStarsieho,
  legalCommands,
  loadGameData,
  naTahu,
  poskodenieBitky,
  setupGame,
  silaPriazne,
  tahBota,
  ucinnaPriazen,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 840000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    exekutor: [0, 0],
    pohorsenieZostava: [0, 0],
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Bitka o Krčmu v kroku Povery (útočník 1, obranca 0); markery podľa priazne, ostatní v strede. */
function vPoverach(o: { povery: readonly [number, number]; sums?: BitkaStav["sums"]; markery?: Partial<Record<Favour, MarkerPos>> }): GameState {
  const s0 = setupGame(data, 5);
  const ciel = s0.lokalityVHre.find((k) => k.defId === "krcma")!;
  return {
    ...s0,
    faza: "bitka",
    kolo: 2,
    utocnik: 1,
    strany: [[{ card: inst("pijan"), playedBy: 0 }], [{ card: inst("pijan"), playedBy: 1 }]],
    ciel: { typ: "lokalita", lokalita: ciel },
    lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
    starsi: s0.starsi.map((e) => ({ ...e, marker: o.markery?.[favourStarsieho(data, e)] ?? (3 as MarkerPos) })),
    bitkaStav: bitka({ krok: "povery", caka: o.povery[0] > 0 ? 0 : 1, poveryZostava: [o.povery[0], o.povery[1]], sums: o.sums ?? [{ Rana: 3 }, {}] }),
  };
}

const idPriazne = (s: GameState, f: Favour): string => s.starsi.find((e) => favourStarsieho(data, e) === f)!.elderId;

describe("v8.3: Povery — výpožička priazne (§9.1)", () => {
  it("Povera posunie silu priazne o stupeň k majiteľovi — marker sa nehýbe; obranca prvý, potom útočník", () => {
    // Bitkár: súper (hráč 1) ho má v sile 2 (index 5). Hráč 0 dá 2 Povery, hráč 1 jednu.
    const s = vPoverach({ povery: [2, 1], markery: { BITKAR: 5 } });
    const bitkar = idPriazne(s, "BITKAR");
    expect(naTahu(s)).toBe(0);
    expect(legalCommands(data, s, 1)).toEqual([]);
    let t = apply(data, s, { type: "povera", elderId: bitkar }, 0).state;
    expect(silaPriazne(data, t, "BITKAR", 1)).toBe(1);
    t = apply(data, t, { type: "povera", elderId: bitkar }, 0).state;
    // 2 → 1 → 0: priazeň nemá nikto, marker ostáva na indexe 5 (strach z hráča 0 sa nemení).
    expect(silaPriazne(data, t, "BITKAR", 1)).toBe(0);
    expect(silaPriazne(data, t, "BITKAR", 0)).toBe(0);
    expect(t.starsi.find((e) => e.elderId === bitkar)?.marker).toBe(5);
    // Útočník vidí a odpovedá — jeho Povera ťahá priazeň späť k nemu.
    expect(t.bitkaStav?.caka).toBe(1);
    t = apply(data, t, { type: "povera", elderId: bitkar }, 1).state;
    expect(silaPriazne(data, t, "BITKAR", 1)).toBe(1);
    // Po Poverách nasleduje Pohoršenie (alebo rovno poškodenie).
    expect(t.bitkaStav?.krok === "povery").toBe(false);
  });

  it("požičať priazeň staršieho v strede (0 → moja 1), preklopiť a zosilniť vlastnú — najviac 3", () => {
    const s = vPoverach({ povery: [3, 0], markery: { BITKAR: 1 } });
    const bitkar = idPriazne(s, "BITKAR");
    const stred = s.starsi.find((e) => e.marker === 3)!;
    // Stred: 0 → hráč 0 +1.
    const a = apply(data, s, { type: "povera", elderId: stred.elderId }, 0).state;
    expect(ucinnaPriazen(stred, a.bitkaStav?.klebety)).toEqual({ hrac: 0, sila: 1 });
    // Vlastný Bitkár v sile 2 → 3, ďalej už nie (strop).
    const b = apply(data, a, { type: "povera", elderId: bitkar }, 0).state;
    expect(silaPriazne(data, b, "BITKAR", 0)).toBe(3);
    expect(legalCommands(data, b, 0).some((c) => c.type === "povera" && c.elderId === bitkar)).toBe(false);
    expect(() => apply(data, b, { type: "povera", elderId: bitkar }, 0)).toThrow();
  });

  it("klebety pôsobia v poškodení (Bitkár) aj na Pohoršenia z Abstinenta — a po kole zaniknú", () => {
    // Abstinent hráča 1 v sile 1; hráč 0 ho jednou Poverou preklopí k sebe → Pohoršenie navyše má on.
    // Abstinent hráča 1 v sile 2 (do v9.1 sila 1 + Absťák, Nervák); Povera mu ju zníži na 1 — bitka na ňom počká.
    const s = vPoverach({ povery: [1, 0], markery: { LAKOMEC: 5, BITKAR: 3 } });
    const abstinent = idPriazne(s, "LAKOMEC");
    const t = apply(data, s, { type: "povera", elderId: abstinent }, 0).state;
    expect(t.bitkaStav).toMatchObject({ krok: "pohorsenie", caka: 1 });
    expect(silaPriazne(data, t, "LAKOMEC", 1)).toBe(1);
    // Bez Povery by mal 2 z Abstinenta; Povera mu jedno zobrala.
    expect(t.bitkaStav?.pohorsenieZostava[1]).toBe(1);
    // Bitkár zo stredu požičaný hráčovi 0: +1 tuhé rozhodne remízu 2 : 2.
    const s2 = vPoverach({ povery: [1, 0], markery: { BITKAR: 3 }, sums: [{ Rana: 2 }, { Rana: 2 }] });
    const t2 = apply(data, s2, { type: "povera", elderId: idPriazne(s2, "BITKAR") }, 0).state;
    expect(poskodenieBitky(data, t2, [{ Rana: 2 }, { Rana: 2 }]).tuhe).toEqual([3, 2]);
    // Dohrať kolo: klebety s bitkou zaniknú, nové kolo ich nemá.
    let u = t2;
    for (let i = 0; i < 60 && u.bitkaStav !== null && u.koniec === null; i++) {
      const p = naTahu(u) as PlayerId;
      u = apply(data, u, legalCommands(data, u, p)[0]!, p).state;
    }
    expect(u.bitkaStav).toBeNull();
    // Priazeň už len z markera (ten sa v kole smel pohnúť Nakladačkou či Pohoršením).
    const e = u.starsi.find((x) => x.elderId === idPriazne(u, "BITKAR"))!;
    expect(silaPriazne(data, u, "BITKAR", 0)).toBe(ucinnaPriazen(e).hrac === 0 ? ucinnaPriazen(e).sila : 0);
  });

  it("mäkké a celkové poškodenie zaniklo: Nakladačka = rozdiel tuhého, drží ju víťaz", () => {
    const s = vPoverach({ povery: [0, 0], sums: [{ Rana: 5 }, { Rana: 1, Povera: 6 }] });
    const d = poskodenieBitky(data, s, [{ Rana: 5 }, { Rana: 1, Povera: 6 }]);
    expect(d.makke).toEqual([0, 0]);
    expect(d.celkove).toEqual(d.tuhe);
  });

  it("klebety a zvyšné Povery sú verejné — obaja hráči ich vidia rovnako", () => {
    const s = vPoverach({ povery: [1, 0], markery: { BITKAR: 5 } });
    const t = apply(data, s, { type: "povera", elderId: idPriazne(s, "BITKAR") }, 0).state;
    expect(viewFor(data, t, 0).bitkaStav?.klebety).toEqual(viewFor(data, t, 1).bitkaStav?.klebety);
    expect(viewFor(data, s, 1).bitkaStav?.poveryZostava).toEqual([1, 0]);
  });

  it("bot Povery rozdeľuje (a celá partia botov dobehne)", () => {
    let povier = 0;
    for (const seed of [11, 12]) {
      let s = setupGame(data, seed, { lokalit: 3 });
      for (let i = 0; i < 6000 && s.koniec === null; i++) {
        const p = naTahu(s);
        if (p === null) break;
        const cmd = tahBota(data, s, p, i * 7919 + seed);
        if (cmd.type === "povera") povier++;
        s = apply(data, s, cmd, p).state;
      }
      expect(s.koniec).not.toBeNull();
    }
    expect(povier).toBeGreaterThan(0);
  }, 60000);
});
