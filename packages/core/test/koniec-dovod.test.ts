// Dôvod konca hry po finále (UI inšpekcia 20261026-1800, UI-7): záporné špaky (Exekútor,
// Cirhóza) sa píšu so znamienkom mínus „−“, nie spojovníkom, a bez pomlčky pred číslami —
// „finále — -2 : -3“ pôsobilo ako preklep.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState } from "../src/index.ts";
import { apply, loadGameData, naTahu, rngInt, rngSeed, setupGame, tahBota } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Partia botov do konca; keď sa začne finále, `pred` smie upraviť stav (raz). */
function dohraj(seed: number, pred?: (s: GameState) => GameState): GameState {
  let s: GameState = setupGame(data, seed, { lokalit: 3 });
  let rng = rngSeed(seed);
  let upravene = pred === undefined;
  for (let i = 0; i < 8000 && s.koniec === null; i++) {
    if (!upravene && s.ciel?.typ === "finale") {
      s = pred!(s);
      upravene = true;
    }
    const kto = naTahu(s);
    if (kto === null) break;
    const [j, r] = rngInt(rng, 2 ** 31);
    rng = r;
    s = apply(data, s, tahBota(data, s, kto, j), kto).state;
  }
  return s;
}

const sk = (n: number): string => (n < 0 ? `−${-n}` : String(n));

describe("dôvod konca po finále", () => {
  it("špaky oboch hráčov, kladné bez znamienka", () => {
    const s = dohraj(8);
    expect(s.koniec?.body).not.toBeNull();
    const [a, b] = s.koniec!.body!;
    expect(s.koniec!.dovod).toBe(`Odohralo sa finále, špaky ${sk(a)} : ${sk(b)}.`);
  }, 60000);

  it("záporné špaky so znamienkom mínus, nikdy so spojovníkom", () => {
    const s = dohraj(8, (x) => ({ ...x, spaky: [-140, -150] }));
    const [a, b] = s.koniec!.body!;
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(0);
    expect(s.koniec!.dovod).toBe(`Odohralo sa finále, špaky ${sk(a)} : ${sk(b)}.`);
    expect(s.koniec!.dovod).not.toMatch(/-\d|—/);
  }, 60000);
});
