// Mäsiar — nový efekt (Michal 2026-10-28): „Furt: Efekty Zvierat v jeho okolí neplatia.“
// Akcie susedných Zvierat sa odteraz rátajú normálne; neplatia efekty Zvierat (oboch hráčov),
// kým susedia s Mäsiarom: Pes, Kôň, Čierna mačka (Furt), Krokodíl (Bitka), Kohút (Pitka),
// Recidivista (Prehra). Kapybara a Krokodíl od 2026-11-09: kapybara-telefon-krokodil.test.ts.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import type { LineState } from "../src/index.ts";
import { apply, dovodNepodlozenia, evaluateLine, lineState, loadGameData, poskodenieBitky, setupGame, zvieraPlati, zvieratAUmlcane } from "../src/index.ts";
import { dataSHranami } from "./naradieData.ts";
import { zPolohy } from "./helpers.ts";

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
    // Kohút je vyradený zo sady v51 — druhé Zviera je Čierna mačka.
    const macka = inst("cierna_macka");
    const s = stol([[lezi(pes, 0), lezi(inst("masiar"), 1), lezi(macka, 1)], [lezi(inst("kon"), 0)]]);
    expect([...zvieratAUmlcane(data, lineState(s))].sort()).toEqual([pes.uid, macka.uid].sort());
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

  it("Kôň vedľa Mäsiara nedovolí podložiť Nástroj pod Zviera (Náradie 2026-11-08)", () => {
    const dataH = dataSHranami();
    const vidly = inst("vidly");
    const pes = inst("pes");
    const sKonom: LineState = { lokalita: null, lokalitaOtocena: false, strany: [[lezi(pes, 0), lezi(inst("kon"), 0)], []] };
    expect(dovodNepodlozenia(dataH, sKonom, vidly, pes.uid, "horna", 0)).toBeNull();
    const priMasiarovi: LineState = { ...sKonom, strany: [[...sKonom.strany[0], lezi(inst("masiar"), 1)], []] };
    expect(dovodNepodlozenia(dataH, priMasiarovi, vidly, pes.uid, "horna", 0)).toMatch(/Kôň/);
  });

  it("Čierna mačka vedľa Mäsiara neplatí — Viera jej Povery ruší (v8.3); Čierna mačka a Krokodíl neplatia (Kohút je zo sady v51 vyradený)", () => {
    const mackaSama = stol([[lezi(inst("cierna_macka"), 0)], []]);
    const mackaPriMasiarovi = stol([[lezi(inst("cierna_macka"), 0), lezi(inst("masiar"), 1)], []]);
    const sums = [{ Povera: 2 }, { Viera: 2 }] as const;
    expect(poskodenieBitky(data, mackaSama, sums).zvysnaPovera[0]).toBe(2);
    expect(poskodenieBitky(data, mackaPriMasiarovi, sums).zvysnaPovera[0]).toBe(0);
    const s = stol([[lezi(inst("cierna_macka"), 0), lezi(inst("masiar"), 1), lezi(inst("krokodil"), 1)], []]);
    expect(zvieraPlati(data, s, 0, "cierna_macka")).toBe(false);
    expect(zvieraPlati(data, s, 1, "krokodil")).toBe(false);
    expect(zvieraPlati(data, stol([[lezi(inst("cierna_macka"), 0)], []]), 0, "cierna_macka")).toBe(true);
  });

});
