// M2 — aktivácia akcií na spojoch. Syntetické karty, deterministický vstup.
//
// Geometria partie hráča 0 (bez lokality): partia [A, B] sa vyhodnocuje ako
// línia [B, A] — pravá strana NESKORŠIE položenej karty sa stretáva s ľavou
// stranou karty položenej skôr. Karta playedBy=1 v partii hráča 0 je otočená.

import { describe, expect, it } from "vitest";
import type { GameData, LineState, PlacedCard, CardInstance } from "../src/index.ts";
import { evaluateLine } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData, type Layout4 } from "./helpers.ts";

/** Zostaví líniu len z partie hráča 0, bez lokality. */
function lineP0(...cards: PlacedCard[]): LineState {
  return { lokalita: null, lokalitaOtocena: false, partie: [cards, []] };
}

function own(card: CardInstance): PlacedCard {
  return { card, playedBy: 0 };
}

function slotEval(data: GameData, line: LineState, uid: number, side: "left" | "right", k: number) {
  const evaluated = evaluateLine(data, line);
  const card = evaluated.cards.get(uid);
  if (card === undefined) throw new Error(`uid ${uid} nie je vo vyhodnotení`);
  return card[side][k];
}

describe("M2 — základné párovanie na spoji", () => {
  const mkPair = (aLeft: Layout4, bRight: Layout4) => {
    const a = makeDef("a", aLeft, EMPTY);
    const b = makeDef("b", EMPTY, bRight);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", aLeft, EMPTY);
    const cardB = instanceFor(data, "b", EMPTY, bRight);
    return { data, cardA, cardB, line: lineP0(own(cardA), own(cardB)) };
  };

  it("Rana@right[1] proti Pecka@left[1] — obe aktívne, tuhé 3", () => {
    const { data, cardA, cardB, line } = mkPair(
      [null, "Pecka", null, null],
      [null, "Rana", null, null],
    );
    const evaluated = evaluateLine(data, line);
    expect(evaluated.sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    expect(slotEval(data, line, cardA.uid, "left", 1)?.stav).toBe("aktivna");
    expect(slotEval(data, line, cardB.uid, "right", 1)?.stav).toBe("aktivna");
    const tuhe = (evaluated.sums[0].Rana ?? 0) * 1 + (evaluated.sums[0].Pecka ?? 0) * 2;
    expect(tuhe).toBe(3);
  });

  it("akcie na rôznych indexoch sa neaktivujú", () => {
    const { data, line } = mkPair([null, null, "Pecka", null], [null, "Rana", null, null]);
    expect(evaluateLine(data, line).sums[0]).toEqual({});
  });

  it("akcia proti prázdnemu slotu je neaktívna", () => {
    const { data, cardB, line } = mkPair(EMPTY, [null, "Rana", null, null]);
    expect(evaluateLine(data, line).sums[0]).toEqual({});
    expect(slotEval(data, line, cardB.uid, "right", 1)?.stav).toBe("neaktivna");
  });

  it("jedna karta v línii nemá žiadny spoj", () => {
    const def = makeDef("sam", [null, "Pecka", null, null], ["Rana", null, null, null]);
    const data = syntheticData([def]);
    const card = instanceFor(data, "sam", [null, "Pecka", null, null], ["Rana", null, null, null]);
    const evaluated = evaluateLine(data, lineP0(own(card)));
    expect(evaluated.sums[0]).toEqual({});
    expect(evaluated.cards.get(card.uid)?.left[1]?.stav).toBe("neaktivna");
  });
});

describe("M2 — otočenie o 180°", () => {
  it("otočená karta: akcia z left[0] je efektívne na right[3] a páruje sa tam", () => {
    // C zahral hráč 1 do partie hráča 0 → C je otočená. Jej vytlačené
    // left[0]=Pecka sa efektívne ocitne na right[3] a páruje sa s A left[3].
    const cDef = makeDef("c", ["Pecka", null, null, null], EMPTY);
    const aDef = makeDef("a", [null, null, null, "Rana"], EMPTY);
    const data = syntheticData([cDef, aDef]);
    const c = instanceFor(data, "c", ["Pecka", null, null, null], EMPTY);
    const a = instanceFor(data, "a", [null, null, null, "Rana"], EMPTY);
    const line = lineP0({ card: a, playedBy: 0 }, { card: c, playedBy: 1 });
    const evaluated = evaluateLine(data, line);
    // Obe akcie aktívne — spoj vznikol na obrátenom indexe.
    expect(evaluated.sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    expect(evaluated.cards.get(c.uid)?.left[0]?.stav).toBe("aktivna");
    expect(evaluated.cards.get(a.uid)?.left[3]?.stav).toBe("aktivna");
  });

  it("neotočená karta na rovnakých vytlačených indexoch sa nepáruje", () => {
    const cDef = makeDef("c", ["Pecka", null, null, null], EMPTY);
    const aDef = makeDef("a", [null, null, null, "Rana"], EMPTY);
    const data = syntheticData([cDef, aDef]);
    const c = instanceFor(data, "c", ["Pecka", null, null, null], EMPTY);
    const a = instanceFor(data, "a", [null, null, null, "Rana"], EMPTY);
    // Rovnaké karty, ale C zahral vlastník partie — bez otočenia spoj nevznikne.
    const line = lineP0({ card: a, playedBy: 0 }, { card: c, playedBy: 0 });
    expect(evaluateLine(data, line).sums[0]).toEqual({});
  });
});

describe("M2 — modifikátory na spoji", () => {
  it("Odpor + Petelica → tuhé 0", () => {
    const a = makeDef("a", [null, "Petelica", null, null], EMPTY);
    const b = makeDef("b", EMPTY, [null, "Odpor", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Petelica", null, null], EMPTY);
    const cardB = instanceFor(data, "b", EMPTY, [null, "Odpor", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    const evaluated = evaluateLine(data, line);
    expect(evaluated.sums[0]).toEqual({});
    expect(evaluated.cards.get(cardA.uid)?.left[1]?.stav).toBe("zrusena");
  });

  it("Odpor + Odpor → Vzbura: obe karty aktivujú neprepojené akcie", () => {
    const a = makeDef("a", [null, "Odpor", null, null], [null, null, null, "Pecka"]);
    const b = makeDef("b", [null, null, "Rana", null], [null, "Odpor", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Odpor", null, null], [null, null, null, "Pecka"]);
    const cardB = instanceFor(data, "b", [null, null, "Rana", null], [null, "Odpor", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    const evaluated = evaluateLine(data, line);
    expect(evaluated.sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    expect(evaluated.cards.get(cardA.uid)?.vzbura).toBe(true);
    expect(evaluated.cards.get(cardB.uid)?.vzbura).toBe(true);
    expect(evaluated.cards.get(cardA.uid)?.right[3]?.stav).toBe("aktivna");
    expect(evaluated.cards.get(cardB.uid)?.left[2]?.stav).toBe("aktivna");
  });

  it("Posilnenie + Pecka → Pecka ×2", () => {
    const a = makeDef("a", [null, "Pecka", null, null], EMPTY);
    const b = makeDef("b", EMPTY, [null, "Posilnenie", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Pecka", null, null], EMPTY);
    const cardB = instanceFor(data, "b", EMPTY, [null, "Posilnenie", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    const evaluated = evaluateLine(data, line);
    expect(evaluated.sums[0]).toEqual({ Pecka: 2 });
    expect(evaluated.cards.get(cardA.uid)?.left[1]?.nasobok).toBe(2);
  });

  it("Posilnenie + Hazard → Hazard ×2 (aj nepriaznivé sa zdvojnásobí)", () => {
    const a = makeDef("a", [null, "Dlh", null, null], EMPTY);
    const b = makeDef("b", EMPTY, [null, "Posilnenie", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Dlh", null, null], EMPTY);
    const cardB = instanceFor(data, "b", EMPTY, [null, "Posilnenie", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    expect(evaluateLine(data, line).sums[0]).toEqual({ Dlh: 2 });
  });

  it("Posilnenie + Odpor → neprepojené akcie aktivuje iba karta s Odporom", () => {
    const a = makeDef("a", [null, "Odpor", null, null], [null, null, null, "Pecka"]);
    const b = makeDef("b", [null, null, "Rana", null], [null, "Posilnenie", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Odpor", null, null], [null, null, null, "Pecka"]);
    const cardB = instanceFor(data, "b", [null, null, "Rana", null], [null, "Posilnenie", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    const evaluated = evaluateLine(data, line);
    // Pecka (karta s Odporom) áno, Rana (karta s Posilnením) nie.
    expect(evaluated.sums[0]).toEqual({ Pecka: 1 });
    expect(evaluated.cards.get(cardB.uid)?.right[1]?.stav).toBe("zrusena");
    expect(evaluated.cards.get(cardB.uid)?.left[2]?.stav).toBe("neaktivna");
  });

  it("Posilnenie + Posilnenie → nič (rozhodnutie k otvorenej otázke č. 1)", () => {
    const a = makeDef("a", [null, "Posilnenie", null, null], [null, null, null, "Pecka"]);
    const b = makeDef("b", EMPTY, [null, "Posilnenie", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Posilnenie", null, null], [null, null, null, "Pecka"]);
    const cardB = instanceFor(data, "b", EMPTY, [null, "Posilnenie", null, null]);
    const line = lineP0(own(cardA), own(cardB));
    const evaluated = evaluateLine(data, line);
    expect(evaluated.sums[0]).toEqual({});
    expect(evaluated.cards.get(cardA.uid)?.vzbura).toBe(false);
  });
});

describe("M2 — NA EX", () => {
  it("zruší aktívne a zdvojnásobí neaktívne akcie karty; suseda neovplyvní", () => {
    const a = makeDef("a", [null, "Pecka", null, null], [null, null, "Rana", null]);
    const b = makeDef("b", EMPTY, [null, "Petelica", null, null]);
    const data = syntheticData([a, b]);
    const cardA = instanceFor(data, "a", [null, "Pecka", null, null], [null, null, "Rana", null]);
    const cardB = instanceFor(data, "b", EMPTY, [null, "Petelica", null, null]);
    const line: LineState = {
      lokalita: null,
      lokalitaOtocena: false,
      partie: [[{ card: cardA, playedBy: 0, naexBy: 0 }, own(cardB)], []],
    };
    const evaluated = evaluateLine(data, line);
    // Aktívna Pecka zrušená, neaktívna Rana ×2, susedova Petelica ostáva aktívna.
    expect(evaluated.sums[0]).toEqual({ Rana: 2, Petelica: 1 });
    expect(evaluated.cards.get(cardA.uid)?.left[1]?.stav).toBe("zrusena");
    expect(evaluated.cards.get(cardA.uid)?.right[2]?.nasobok).toBe(2);
    expect(evaluated.cards.get(cardB.uid)?.right[1]?.stav).toBe("aktivna");
  });
});

describe("M2 — lokalita v línii", () => {
  it("akcie lokality sa aktivujú s prvou kartou a rátajú sa jej hráčovi", () => {
    const lok = makeDef("lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null], {
      tags: ["Lokalita"],
    });
    const a = makeDef("a", EMPTY, [null, "Rana", null, null]);
    const c = makeDef("c", EMPTY, ["Viera", null, null, null]);
    const data = syntheticData([lok, a, c]);
    const lokCard = instanceFor(data, "lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null]);
    const cardA = instanceFor(data, "a", EMPTY, [null, "Rana", null, null]);
    const cardC = instanceFor(data, "c", EMPTY, ["Viera", null, null, null]);
    const line: LineState = {
      lokalita: lokCard,
      lokalitaOtocena: false,
      // Hráč 0: karta pravou stranou k lokalite. Hráč 1: otočená karta,
      // jej vytlačené right[0] sa efektívne ocitne na left[3]… tu right[3-0].
      partie: [[own(cardA)], [{ card: cardC, playedBy: 1 }]],
    };
    const evaluated = evaluateLine(data, line);
    // Spoj hráča 0: A.right[1] (Rana) ↔ lokalita.left[1] (Cigaretka).
    expect(evaluated.sums[0]).toEqual({ Rana: 1, Cigaretka: 1 });
    // Spoj hráča 1: lokalita.right[0] (Pecka) ↔ C otočená: eff left[0] = printed right[3]?
    // C má Vieru na printed right[0] → eff left[3]; na indexe 0 je prázdno → bez spoja.
    expect(evaluated.sums[1]).toEqual({});
  });

  it("natočenie lokality vymení strany aj indexy", () => {
    const lok = makeDef("lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null], {
      tags: ["Lokalita"],
    });
    const a = makeDef("a", EMPTY, [null, null, "Rana", null]);
    const data = syntheticData([lok, a]);
    const lokCard = instanceFor(data, "lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null]);
    const cardA = instanceFor(data, "a", EMPTY, [null, null, "Rana", null]);
    const line: LineState = {
      lokalita: lokCard,
      lokalitaOtocena: true,
      partie: [[own(cardA)], []],
    };
    const evaluated = evaluateLine(data, line);
    // Otočená lokalita: hráčovi 0 patrí printed right čítaná odzadu:
    // Pecka z right[0] je efektívne na indexe 3 — A má Ranu na right[2] → nič.
    expect(evaluateLine(data, line).sums[0]).toEqual({});
    // Rana na right[3] by sa už spárovala s Peckou (eff index 3).
    const a2 = makeDef("a2", EMPTY, [null, null, null, "Rana"]);
    const data2 = syntheticData([lok, a2]);
    const lokCard2 = instanceFor(data2, "lok", [null, "Cigaretka", null, null], ["Pecka", null, null, null]);
    const cardA2 = instanceFor(data2, "a2", EMPTY, [null, null, null, "Rana"]);
    const line2: LineState = {
      lokalita: lokCard2,
      lokalitaOtocena: true,
      partie: [[own(cardA2)], []],
    };
    expect(evaluateLine(data2, line2).sums[0]).toEqual({ Rana: 1, Pecka: 1 });
    expect(evaluated.cards.get(lokCard.uid)).toBeDefined();
  });

  it("vzbura na spoji s lokalitou aktivuje len stranu patriacu partii (rozhodnutie č. 4)", () => {
    const lok = makeDef("lok", [null, "Odpor", null, "Povera"], ["Pecka", null, null, null], {
      tags: ["Lokalita"],
    });
    const a = makeDef("a", [null, null, "Viera", null], [null, "Odpor", null, null]);
    const data = syntheticData([lok, a]);
    const lokCard = instanceFor(data, "lok", [null, "Odpor", null, "Povera"], ["Pecka", null, null, null]);
    const cardA = instanceFor(data, "a", [null, null, "Viera", null], [null, "Odpor", null, null]);
    const line: LineState = {
      lokalita: lokCard,
      lokalitaOtocena: false,
      partie: [[own(cardA)], []],
    };
    const evaluated = evaluateLine(data, line);
    // Vzbura: lokalita aktivuje neprepojenú Poveru na SVOJEJ ľavej strane
    // (patrí hráčovi 0), ale Pecku na pravej strane (hráč 1) nie.
    // Karta A aktivuje neprepojenú Vieru.
    expect(evaluated.sums[0]).toEqual({ Povera: 1, Viera: 1 });
    expect(evaluated.sums[1]).toEqual({});
  });
});
