// Roadmapa #112: pri Kostole („Nikto nesmie dať NA EX“, §15) svietila v Pitke na
// kartách značka NA EX. Motor NA EX nepustil (cmdNaex aj moznostiNaex Kostol stráži),
// chyba bola v klientovi — značku kreslil bez Kostola. Klient teraz berie možnosti
// z moznostiNaexVPohlade a tá sa musí zhodovať s legálnymi ťahmi motora.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, moznostiNaex, moznostiNaexVPohlade, mozeHrat, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);

/** NA EX, ktoré motor hráčovi p teraz dovolí. */
const legalneNaex = (s: GameState, p: PlayerId): number[] =>
  mozeHrat(s, p)
    ? legalCommands(data, s, p)
        .flatMap((c) => (c.type === "naex" ? [c.uid] : []))
        .sort((a, b) => a - b)
    : [];

describe("NA EX z pohľadu klienta = legálne NA EX motora", () => {
  // Sada v7 má viac kariet a dlhšie partie — náhodné partie trvajú dlhšie.
  it("v náhodných partiách v každom stave oboch hráčov (aj pri Kostole)", { timeout: 30000 }, () => {
    let pitky = 0;
    let kostol = 0;
    for (let seed = 500; seed < 540; seed++) {
      let s = setupGame(data, seed);
      let rng = rngSeed(seed * 31 + 7);
      for (let krok = 0; s.koniec === null && krok < 3000; krok++) {
        for (const p of [0, 1] as const) {
          const pohlad = [...moznostiNaexVPohlade(data, viewFor(data, s, p))].sort((a, b) => a - b);
          expect(pohlad, `seed ${seed}, krok ${krok}, hráč ${p}`).toEqual(legalneNaex(s, p));
        }
        if (s.faza === "pitka") {
          pitky++;
          if (s.ciel?.lokalita?.defId === "kostol") kostol++;
        }
        const q = kto(s);
        if (q === null) break;
        const cmds = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
        const [i, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, cmds[i % cmds.length] as Command, q).state;
      }
    }
    expect(pitky).toBeGreaterThan(100);
    expect(kostol).toBeGreaterThan(0);
  });

  it("Kostol: v Pitke nikto nedostane NA EX — ani motor, ani značka v klientovi", () => {
    const s0 = setupGame(data, 77);
    const obcan = (uid: number, defId: string): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });
    const kostol: CardInstance = { uid: 990000, defId: "kostol", leftLayout: 0, rightLayout: 0 };
    const p: PlayerId = s0.utocnik === 0 ? 1 : 0;
    // Teta Gizka v hlásení: Veterán a Svokra v línii.
    const pitka = (ciel: CardInstance): GameState => ({
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      ciel: { typ: "lokalita", lokalita: ciel },
      strany: [
        [
          { card: obcan(990001, "veteran"), playedBy: 0 },
          { card: obcan(990002, "svokra"), playedBy: 0 },
        ],
        [
          { card: obcan(990003, "svokra"), playedBy: 1 },
          { card: obcan(990004, "veteran"), playedBy: 1 },
        ],
      ],
      hraci: [
        { ...s0.hraci[0], poldeciPlne: 2 },
        { ...s0.hraci[1], poldeciPlne: 2 },
      ],
      pitkaStav: { naTahu: p, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    });
    const vKostole = pitka(kostol);
    expect(moznostiNaex(data, vKostole, p)).toEqual([]);
    expect(legalneNaex(vKostole, p)).toEqual([]);
    expect(moznostiNaexVPohlade(data, viewFor(data, vKostole, p))).toEqual([]);
    expect(() => apply(data, vKostole, { type: "naex", uid: 990001 }, p)).toThrow(/Kostol/);
    // Na inej lokalite tie isté karty NA EX prijmú — test by inak nič neoveril.
    const inde = pitka({ ...kostol, defId: s0.lokalityVHre.find((k) => k.defId !== "kostol" && k.defId !== "krcma")!.defId });
    expect(moznostiNaexVPohlade(data, viewFor(data, inde, p)).length).toBeGreaterThan(0);
  });
});
