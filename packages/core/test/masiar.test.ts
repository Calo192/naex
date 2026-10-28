// Mäsiar — nový efekt (Michal 2026-10-28): „Furt: Efekty Zvierat v jeho okolí neplatia.“
// Akcie susedných Zvierat sa odteraz rátajú normálne; neplatia efekty Zvierat (oboch hráčov),
// kým susedia s Mäsiarom: Pes, Kôň, Čierna mačka (Furt), Krokodíl (Bitka), Kohút (Pitka),
// Recidivista (Prehra), Kapybara (Nástup).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, lineState, loadGameData, poskodenieBitky, setupGame, spojVznikne, zvieraPlati, zvieratAUmlcane } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
let uidSeq = 660000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, ine: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...ine });

function stol(strany: GameState["strany"], h: Partial<GameState> = {}): GameState {
  const s = setupGame(data, 4);
  return { ...s, ciel: { typ: "lokalita", lokalita: s.lokalityVHre.find((k) => k.defId === "krcma")! }, strany, ...h } as GameState;
}

describe("Mäsiar (Furt, Michal 2026-10-28): efekty Zvierat v jeho okolí neplatia", () => {
  it("umlčané sú Zvieratá oboch hráčov, ktoré susedia s odkrytým Mäsiarom", () => {
    const pes = inst("pes");
    const kohut = inst("kohut");
    const s = stol([[lezi(pes, 0), lezi(inst("masiar"), 1), lezi(kohut, 1)], [lezi(inst("kon"), 0)]]);
    expect([...zvieratAUmlcane(data, lineState(s))].sort()).toEqual([pes.uid, kohut.uid].sort());
    // Mäsiar lícom dole (Záverečná) ešte nič neumlčí.
    const z = stol([[lezi(pes, 0), lezi(inst("masiar"), 1, { zaverecna: true })], []]);
    expect(zvieratAUmlcane(data, lineState(z)).size).toBe(0);
  });

  it("akcie Zvierat sa rátajú normálne (Mäsiar ich už neruší); Pes vedľa Mäsiara nezdvojuje", () => {
    const pes = inst("pes");
    const s = stol([[lezi(pes, 0), lezi(inst("masiar"), 1)], []]);
    const ev = evaluateLine(data, lineState(s)).cards.get(pes.uid)!;
    const sloty = [...ev.left, ...ev.right].filter((x) => x !== null);
    expect(sloty.some((x) => x.stav === "zrusena")).toBe(false);
    expect(sloty.every((x) => x.stav !== "aktivna" || x.nasobok === 1)).toBe(true);
  });

  it("Kôň vedľa Mäsiara netvorí spoj s Nástrojom", () => {
    const kon = { tags: data.cards.get("kon")!.tags, stred: false, defId: "kon" };
    const nastroj = { tags: data.cards.get("puska")!.tags, stred: false, defId: "puska" };
    expect(spojVznikne(nastroj, kon)).toBe(true);
    expect(spojVznikne(nastroj, { ...kon, umlcany: true })).toBe(false);
  });

  it("Čierna mačka vedľa Mäsiara nezruší strop mäkkého; Kohút a Krokodíl neplatia", () => {
    const mackaSama = stol([[lezi(inst("cierna_macka"), 0)], []]);
    const mackaPriMasiarovi = stol([[lezi(inst("cierna_macka"), 0), lezi(inst("masiar"), 1)], []]);
    const sums = [{ Povera: 2 }, {}] as const;
    expect(poskodenieBitky(data, mackaSama, sums, [0, 0]).makke[0]).toBe(2);
    expect(poskodenieBitky(data, mackaPriMasiarovi, sums, [0, 0]).makke[0]).toBe(0);
    const s = stol([[lezi(inst("kohut"), 0), lezi(inst("masiar"), 1), lezi(inst("krokodil"), 1)], []]);
    expect(zvieraPlati(data, s, 0, "kohut")).toBe(false);
    expect(zvieraPlati(data, s, 1, "krokodil")).toBe(false);
    expect(zvieraPlati(data, stol([[lezi(inst("kohut"), 0)], []]), 0, "kohut")).toBe(true);
  });

  it("Kapybara priložená k Mäsiarovi sa nespustí", () => {
    const kap = inst("kapybara");
    const s0 = stol([[lezi(inst("masiar"), 1)], []], {
      faza: "zhromazdenie",
      utocnik: 0,
      pitkyCelkom: 1,
      pitkaCislo: 0,
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    });
    const s: GameState = {
      ...s0,
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker: 5 } : e)),
      hraci: [{ ...s0.hraci[0], ruka: [kap] }, s0.hraci[1]],
    };
    const { state, events } = apply(data, s, { type: "place", uid: kap.uid, target: "vlastna" }, 0);
    expect(state.hasicVolby ?? []).toEqual([]);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Mäsiar: Kapybara"))).toBe(true);
    // Bez Mäsiara sa Kapybara spustí (voľba staršieho).
    const bez = apply(data, { ...s, strany: [[lezi(inst("pijan"), 1)], []] }, { type: "place", uid: kap.uid, target: "vlastna" }, 0).state;
    expect(bez.hasicVolby?.[0]?.typ).toBe("kapybara");
  });
});
