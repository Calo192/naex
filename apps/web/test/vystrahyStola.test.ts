// Výstraha pečene a súperovo NA EX cez Bzdochu: texty stola a to, že bez Bzdochy sa nič neprezradí.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { CardInstance, GameState, PlacedCard, PlayerId, VystrahaPecene } from "@naex/core";
import { apply, lineState, loadGameData, naexCieleVLinii, setupGame, viewFor } from "@naex/core";
import { cieleSuperovhoNaex, vystrahaCela, vystrahaKratko, vystrahaVRuke } from "../src/hra/vystrahyStola.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const menoKarty = (defId: string): string => data.cards.get(defId)?.name ?? defId;

let uid = 99700;
const inst = (defId: string, leftLayout = 0, rightLayout = 0): CardInstance => ({ uid: ++uid, defId, leftLayout, rightLayout });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Pitka: hráč 0 hrá po súperovi; `bzdocha` mu dá Bzdochu do línie. Súper (1) dá NA EX na Pijana hráča 0 a skončí. */
function poSuperovomNaex(bzdocha: boolean): { readonly s: GameState; readonly ciel: number } {
  const s0 = setupGame(data, 9);
  const v = data.variants.get("pijan");
  if (v === undefined) throw new Error("pijan");
  for (let a = 0; a < v.left.length; a++) {
    for (let b = 0; b < v.right.length; b++) {
      const karty: PlacedCard[] = [lezi(inst("pijan", a, b), 0), lezi(inst("pijan", b % v.left.length, a % v.right.length), 0), ...(bzdocha ? [lezi(inst("klebetnica"), 0)] : [])];
      let s: GameState = {
        ...s0,
        faza: "zhromazdenie",
        kolo: 2,
        utocnik: 0,
        pitkyCelkom: 1,
        pitkaCislo: 0,
        ciel: { typ: "lokalita", lokalita: null },
        strany: [karty, []],
        hraci: [
          { ...s0.hraci[0], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
          { ...s0.hraci[1], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
        ],
        zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
      };
      const ciel = naexCieleVLinii(data, lineState(s), 1).find((u) => karty.some((k) => k.card.uid === u && k.card.defId === "pijan"));
      if (ciel === undefined) continue;
      s = apply(data, s, { type: "pass" }, 0).state;
      if (s.faza !== "pitka") s = apply(data, s, { type: "pass" }, 1).state;
      s = apply(data, s, { type: "naex", uid: ciel }, 1).state;
      s = apply(data, s, { type: "skipNaex" }, 1).state;
      return { s, ciel };
    }
  }
  throw new Error("žiadna línia, na ktorú ide NA EX");
}

describe("súperovo NA EX cez Bzdochu", () => {
  it("s Bzdochou povie kartu aj čia je", () => {
    const { s } = poSuperovomNaex(true);
    expect(cieleSuperovhoNaex(viewFor(data, s, 0), menoKarty)).toEqual(["tvoju kartu Pijan"]);
  });

  it("bez Bzdochy zoznam prázdny: stôl nemá čo prezradiť", () => {
    const { s } = poSuperovomNaex(false);
    expect(cieleSuperovhoNaex(viewFor(data, s, 0), menoKarty)).toEqual([]);
  });

  it("súper Bzdochy (ten, kto NA EX dal) tým nič nezíska: svoje NA EX do zoznamu nepatrí", () => {
    const { s } = poSuperovomNaex(true);
    expect(cieleSuperovhoNaex(viewFor(data, s, 1), menoKarty)).toEqual([]);
  });

  it("súperov vlastný kus a Záverečná lícom dole: svoju kartu, meno skrytej sa nepovie", () => {
    const pl = lezi(inst("pijan"), 1);
    const view = {
      ja: 0 as const,
      strany: [[], [pl]] as const,
      zaverecne: [{ strana: 1 as const, majitel: 1 as const, uid: -2, naexBy: null }],
      pitkaStav: { skryteNaex: [{ hrac: 1 as const, uid: pl.card.uid }, { hrac: 1 as const, uid: -2 }, { hrac: 0 as const, uid: pl.card.uid }] },
    } as unknown as Parameters<typeof cieleSuperovhoNaex>[0];
    expect(cieleSuperovhoNaex(view, menoKarty)).toEqual(["svoju kartu Pijan", "svoju Záverečnú"]);
  });
});

describe("texty výstrahy pečene", () => {
  const v = (x: Partial<VystrahaPecene>): VystrahaPecene => ({ cirhozy: [0, 0], spaky: [0, 0], naex: null, ...x });
  const naex = { hrac: 1 as const, obet: 0 as const, uid: 5, cirhozy: 3, dlhy: 0, spaky: -9 };

  it("krátko: moje, NA EX, súperove", () => {
    const kratko = (x: Partial<VystrahaPecene>): string => vystrahaKratko(v(x), 0).replace(/\u00a0/g, " ");
    expect(kratko({ cirhozy: [2, 0], spaky: [-6, 0] })).toBe("Cirhóza +2");
    expect(kratko({ naex })).toBe("NA EX: Cirhóza +3");
    expect(kratko({ cirhozy: [1, 0], spaky: [-3, 0], naex })).toBe("Cirhóza +1 · NA EX +3");
    expect(kratko({ cirhozy: [0, 1], spaky: [0, -3] })).toBe("súper Cirhóza +1");
  });

  it("štítok v ruke bez súperovho NA EX (Michal 2026-11-11); bez vlastnej Cirhózy žiadny", () => {
    const vRuke = (x: Partial<VystrahaPecene>): string | null => vystrahaVRuke(v(x), 0)?.replace(/ /g, " ") ?? null;
    expect(vRuke({ naex })).toBeNull();
    expect(vRuke({ cirhozy: [1, 0], spaky: [-3, 0], naex })).toBe("Cirhóza +1");
    expect(vRuke({ cirhozy: [0, 1], spaky: [0, -3], naex })).toBe("súper Cirhóza +1");
  });

  it("celá veta v jazyku HROZBY KLIATOB; moje podľa toho, kto sa pýta", () => {
    expect(vystrahaCela(v({ cirhozy: [2, 0], spaky: [-6, 0], naex }), 0, "Jano", "Pijan")).toBe("Hrozí ti Cirhóza +2, −6 špakov · ak Jano dá NA EX na Pijan, ešte Cirhóza +3, −9 špakov");
    expect(vystrahaCela(v({ cirhozy: [0, 1], spaky: [0, -3] }), 1, "Jano", "Pijan")).toBe("Hrozí ti Cirhóza +1, −3 špaky");
  });
});
