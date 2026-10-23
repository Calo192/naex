// NA EX len na kartu s aspoň 1 aktívnou a aspoň 1 neaktívnou akciou (Michal
// 2026-10-23): nie na kartu bez aktívnej akcie, ani na kartu so všetkými
// aktívnymi; platí aj pre Veterána. Súperova skrytá Záverečná vždy a skryté
// Záverečné sa do posúdenia susedov nerátajú — nič sa nesmie prezradiť.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, loadGameData, naexCieleVLinii, setupGame, uidZaverecnej, viewFor, lineState } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const sada = syntheticData([
  makeDef("lavy", EMPTY, R2),
  makeDef("plny", R2, EMPTY),
  makeDef("polovicny", R1, ["Rana", null, null, null]),
  makeDef("veteran", R2, EMPTY, { tags: ["Občan", "Chlap"] }),
]);
const k = (id: string, l: Layout4, r: Layout4): CardInstance => instanceFor(sada, id, l, r);
const lezi = (card: CardInstance, playedBy: PlayerId = 0): PlacedCard => ({ card, playedBy });
/** Strana hráča 1 zľava doprava (nie je otočená): pravá hrana karty stretne ľavú nasledujúcej. */
const linia = (...karty: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[], karty] });

describe("NA EX — len na kartu s aktívnou aj neaktívnou akciou", () => {
  it("nie na osamotenú kartu (žiadna aktívna) ani na kartu so všetkými akciami aktívnymi; na zmiešanú áno", () => {
    const lavy = k("lavy", EMPTY, R2);
    const plny = k("plny", R2, EMPTY);
    // Ľavý spáruje obe Rany plného — plný má všetky akcie aktívne, ľavý tiež.
    expect(naexCieleVLinii(sada, linia(lezi(lavy), lezi(plny)), 0)).toEqual([]);
    // Polovičný vedľa ľavého: jeho ľavá Rana spárovaná, pravá voľná → zmiešaný; ľavý
    // má teraz spárovanú len jednu z dvoch Rán → tiež zmiešaný.
    const lavy2 = k("lavy", EMPTY, R2);
    const pol = k("polovicny", R1, ["Rana", null, null, null]);
    expect(naexCieleVLinii(sada, linia(lezi(lavy2), lezi(pol)), 0)).toEqual([lavy2.uid, pol.uid]);
    // Sám osebe nemá žiadnu aktívnu akciu.
    expect(naexCieleVLinii(sada, linia(lezi(k("polovicny", R1, ["Rana", null, null, null]))), 0)).toEqual([]);
  });

  it("Veterán výnimku nemá — so všetkými akciami aktívnymi naňho NA EX nejde", () => {
    const vet = k("veteran", R2, EMPTY);
    expect(naexCieleVLinii(sada, linia(lezi(k("lavy", EMPTY, R2)), lezi(vet)), 0)).not.toContain(vet.uid);
  });

  it("server NA EX na osamotenú kartu odmietne", () => {
    const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
    const s0 = setupGame(data, 31);
    const pijan: CardInstance = { uid: 99001, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany: [[lezi(pijan, 0)], []],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    expect(() => apply(data, s, { type: "naex", uid: pijan.uid }, 0)).toThrow(/aspoň jednu aktívnu a aspoň jednu neaktívnu/);
  });
});

describe("NA EX — skrytá Záverečná nič neprezradí", () => {
  it("sused, ktorého akciu páruje len skrytá Záverečná, nie je cieľom pre nikoho — server aj klient súpera vidia to isté", () => {
    const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
    const s0 = setupGame(data, 32);
    // Dvaja Pijani hráča 0 vedľa seba a za nimi jeho skrytá Záverečná (tiež Pijan).
    const p1: CardInstance = { uid: 99011, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const p2: CardInstance = { uid: 99012, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const skryta: CardInstance = { uid: 99013, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany: [[], [lezi(p1, 0), lezi(p2, 0), { card: skryta, playedBy: 0, zaverecna: true }]],
      hraci: [s0.hraci[0], { ...s0.hraci[1], poldeciPlne: 1 }],
      pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    const server = naexCieleVLinii(data, lineState(s), 1);
    const klient = naexCieleVLinii(data, lineState(viewFor(data, s, 1)), 1);
    // Na skrytú vždy (náhradným uid); ostatné ciele rovnaké, či skrytú kartu poznám, alebo nie.
    expect(server).toContain(uidZaverecnej(1));
    expect(server.filter((u) => u !== uidZaverecnej(1))).toEqual(klient);
  });
});
