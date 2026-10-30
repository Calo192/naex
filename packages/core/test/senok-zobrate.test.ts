// Branie zo šenku je verejné (#111, Michal 2026-10-26): hráč vidí, ktorú kartu
// mu súper zobral — na jej mieste v šenku ostane tieň do konca draftu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, miestoVSenku, mozeHrat, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const obrancaOf = (s: GameState): PlayerId => (s.utocnik === 0 ? 1 : 0);

/** Partia na začiatku brania zo šenku; obaja majú dosť cigariet. */
function doBrania(seed: number): GameState {
  let s = setupGame(data, seed);
  s = apply(data, s, { type: "chooseLocation", uid: s.lokalityVHre[0]!.uid, otocena: false }, obrancaOf(s)).state;
  while (s.draftStav?.krok === "stavba") {
    for (const p of [obrancaOf(s), s.utocnik] as const) {
      const b: readonly CardInstance[] = s.draftStav!.balicky[p];
      const cmd: Command = { type: "stavbaSenku", doSenku: b.slice(0, b.length / 2).map((k) => k.uid), odhod: b.slice(b.length / 2).map((k) => k.uid) };
      s = apply(data, s, cmd, p).state;
    }
  }
  const hraci = s.hraci.map((h) => ({ ...h, cigarety: 6 })) as unknown as GameState["hraci"];
  return { ...s, hraci };
}

describe("tieň karty vzatej zo šenku (#111)", () => {
  it("viewFor oboch hráčov nesie, kto ktorú kartu vzal a kde ležala — bez uid karty v ruke", () => {
    let s = doBrania(7);
    // v9.2: obranca berie prvý (na prvom ťahu 1 kartu), útočník druhý.
    const o = obrancaOf(s);
    const u = s.utocnik;
    const senok = s.senok;
    // Obranca berie štvrtú kartu, útočník potom pôvodne tretiu a piatu (teraz tretia a štvrtá v šenku).
    s = apply(data, s, { type: "draftBer", uids: [senok[3]!.uid] }, o).state;
    expect(s.senok[3]!.uid).toBe(senok[4]!.uid);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[2]!.uid, s.senok[3]!.uid] }, u).state;
    for (const ja of [u, o] as const) {
      const v = viewFor(data, s, ja);
      expect(v.draftStav?.zobrate).toEqual([
        { karta: { defId: senok[3]!.defId, leftLayout: senok[3]!.leftLayout, rightLayout: senok[3]!.rightLayout }, hrac: o, miesto: 3 },
        { karta: { defId: senok[2]!.defId, leftLayout: senok[2]!.leftLayout, rightLayout: senok[2]!.rightLayout }, hrac: u, miesto: 2 },
        { karta: { defId: senok[4]!.defId, leftLayout: senok[4]!.leftLayout, rightLayout: senok[4]!.rightLayout }, hrac: u, miesto: 4 },
      ]);
    }
    // Uid karty v súperovej ruke sa nepošle — ani cez tieň.
    const proObrancu = JSON.stringify(viewFor(data, s, o));
    for (const k of [senok[2]!, senok[4]!]) expect(proObrancu).not.toContain(`"uid":${k.uid},`);
  });

  it("miesto rátá s tieňmi: index-té voľné miesto v rade šenku", () => {
    expect(miestoVSenku(0, [])).toBe(0);
    expect(miestoVSenku(3, [])).toBe(3);
    expect(miestoVSenku(0, [{ miesto: 0 }, { miesto: 1 }])).toBe(2);
    expect(miestoVSenku(2, [{ miesto: 1 }, { miesto: 3 }])).toBe(4);
  });

  it("tiene vydržia do konca draftu (aj v patronáte) a s jeho koncom zmiznú", () => {
    let s = doBrania(11);
    const u = obrancaOf(s);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]!.uid] }, u).state;
    // Ďalej hrajú obaja prvý legálny príkaz bez brania, kým draft neskončí.
    for (let i = 0; i < 20 && s.faza === "draft"; i++) {
      const p = ([0, 1] as const).find((x) => mozeHrat(s, x))!;
      const cmd = legalCommands(data, s, p).find((c) => c.type === "draftStop" || c.type === "bezPokusu") ?? legalCommands(data, s, p)[0]!;
      s = apply(data, s, cmd, p).state;
      if (s.faza === "draft") expect(viewFor(data, s, p).draftStav?.zobrate).toHaveLength(1);
    }
    expect(s.faza).not.toBe("draft");
    expect(viewFor(data, s, u).draftStav).toBeNull();
  });
});
