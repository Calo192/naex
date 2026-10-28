// NA EX mimo limitu vykladania (roadmapa #54 c, PRAVIDLA §6): NA EX sa dáva v Pitke,
// limit Zhromaždenia nemíňa. Plný poldeci z neho však odíde zo zásoby na kartu,
// takže ďalšie Zhromaždenie toho istého kola má limit o 1 nižší — súperov nie.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, moznostiNaex, mozeHrat, naTahu, rngInt, rngSeed, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);

/** Dohrá Pitku bez ďalšieho NA EX a odpovede — vráti prvý stav po nej. */
function poPitke(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 60 && s.faza === "pitka" && s.koniec === null; i++) {
    const q = naTahu(s);
    if (q === null) break;
    const legal = legalCommands(data, s, q);
    const cmd = legal.find((c) => c.type === "skipNaex") ?? legal.find((c) => c.type === "bezReakcie") ?? legal.find((c) => c.type === "vizia" && c.vziat) ?? legal[0];
    if (cmd === undefined) break;
    s = apply(data, s, cmd, q).state;
  }
  return s;
}

describe("NA EX mimo limitu vykladania", () => {
  it("ďalšie Zhromaždenie kola má limit o 1 nižší tomu, kto NA EX dal", () => {
    let porovnane = 0;
    for (let seed = 3000; seed < 3060 && porovnane < 40; seed++) {
      let s = setupGame(data, seed);
      let rng = rngSeed(seed * 3 + 1);
      for (let krok = 0; s.koniec === null && krok < 2000; krok++) {
        const p = naTahu(s);
        const pitka = s.pitkaStav;
        if (
          s.faza === "pitka" &&
          p !== null &&
          pitka !== null &&
          s.vizia === null &&
          pitka.reakcia === null &&
          s.pitkaCislo < s.pitkyCelkom &&
          s.ciel?.lokalita?.defId !== "krcma" &&
          (pitka.skryteNaex ?? []).length === 0 &&
          // Záverečná otočená po Pitke (Degustátorka) by poldeci menila podľa toho, koľko ich kto má plných.
          !s.strany.some((x) => x.some((pl) => pl.zaverecna === true))
        ) {
          const uid = moznostiNaex(data, s, p)[0];
          if (uid !== undefined) {
            const bez = poPitke(s);
            const sNaex = poPitke(apply(data, s, { type: "naex", uid }, p).state);
            if (bez.faza === "zhromazdenie" && sNaex.faza === "zhromazdenie") {
              const su: PlayerId = p === 0 ? 1 : 0;
              const z0 = bez.zhromazdenieStav!;
              const z1 = sNaex.zhromazdenieStav!;
              expect(sNaex.hraci[p].poldeciPlne, `seed ${seed}`).toBe(bez.hraci[p].poldeciPlne - 1);
              // Zastávka: spoločný limit — aj tak o 1 menej.
              expect(z1.zostavaLimit[p], `seed ${seed}`).toBe(z0.zostavaLimit[p] - 1);
              if (s.ciel?.lokalita?.defId !== "zastavka") expect(z1.zostavaLimit[su], `seed ${seed}`).toBe(z0.zostavaLimit[su]);
              porovnane++;
            }
          }
        }
        const q = kto(s);
        if (q === null) break;
        const cmds = legalCommands(data, s, q).filter((c) => c.type !== "vzdat");
        const [i, r] = rngInt(rng, 2 ** 31);
        rng = r;
        s = apply(data, s, cmds[i % cmds.length] as Command, q).state;
      }
    }
    expect(porovnane).toBeGreaterThanOrEqual(20);
  });
});
