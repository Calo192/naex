// Hodnota lokality (Michal 2026-10-22): pri výbere cieľa a vo vrstve Lokality
// ukazuje, o koľko bodov si každý polepší ovládnutím lokality podľa dnešného
// rozdania scorecardov — každá aktívna podmienka „lokality“ zvlášť.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, Command, GameState } from "../src/index.ts";
import { apply, hodnotaLokality, legalCommands, loadGameData, naTahu, podmienkyStarsieho, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Nezávisle od bodyTeraz: počet aktívnych podmienok „lokality“ × body za kus. */
const ocakavana = (v: ClientState): number =>
  v.starsi.reduce((a, e) => a + podmienkyStarsieho(data, e).filter((x) => x.aktivna && x.podmienka === "lokality").length, 0) *
  data.bodyPodmienok.lokality;

/** Stavy pri voľbe cieľa v náhodných partiách (od 2. kola, keď už niečo leží na ukazovateľoch). */
function volbyCiela(seed: number): GameState[] {
  let s = setupGame(data, seed);
  let rng = rngSeed(seed ^ 0x10c);
  const out: GameState[] = [];
  for (let i = 0; i < 20000 && s.koniec === null; i++) {
    if (s.faza === "volbaCiela" && s.kolo >= 2) out.push(s);
    const p = naTahu(s);
    if (p === null) break;
    const cmds = legalCommands(data, s, p);
    const [j, r] = rngInt(rng, cmds.length);
    rng = r;
    s = apply(data, s, cmds[j] as Command, p).state;
  }
  return out;
}

describe("hodnota lokality", () => {
  it("každá lokalita má pre oboch hodnotu = aktívne podmienky „lokality“ × body za kus", () => {
    let nenulovych = 0;
    for (const seed of [3, 7, 12]) {
      for (const s of volbyCiela(seed)) {
        for (const p of [0, 1] as const) {
          const v = viewFor(data, s, p);
          const ocakavane = ocakavana(v);
          for (const k of v.lokalityVHre) {
            expect(hodnotaLokality(data, v, k)).toEqual([ocakavane, ocakavane]);
            if (ocakavane > 0) nenulovych++;
          }
        }
      }
    }
    expect(nenulovych).toBeGreaterThan(0);
  });

  it("so sekerou ráta aj lokality na sekere — víťaz ich berie spolu s cieľom", () => {
    const s = volbyCiela(7)[0]!;
    const v0 = viewFor(data, s, 0);
    const [ciel, ...ine] = v0.lokalityVHre;
    const v: ClientState = { ...v0, naSekeru: ine.slice(0, 2) };
    const jedna = hodnotaLokality(data, v, ciel!);
    expect(hodnotaLokality(data, v, ciel!, true)).toEqual([jedna[0] * 3, jedna[1] * 3]);
    // Bez sekery na stole sa nič nepridá.
    expect(hodnotaLokality(data, v0, ciel!, true)).toEqual(hodnotaLokality(data, v0, ciel!));
  });

  it("Benzínka má rovnakú hodnotu ako iné lokality (od 2026-10-20 už neprepadá)", () => {
    const s = volbyCiela(12)[0]!;
    const v = viewFor(data, s, 1);
    const benzinka = { uid: 990002, defId: "benzinka", leftLayout: 0, rightLayout: 0 };
    expect(hodnotaLokality(data, v, benzinka)).toEqual(hodnotaLokality(data, v, v.lokalityVHre[0]!));
  });
});
