// Hodnota lokality (Michal 2026-10-22): pri výbere cieľa a vo vrstve Lokality
// ukazuje, o koľko bodov si každý polepší ovládnutím lokality podľa dnešného
// rozdania scorecardov. Vo v5 je podmienka Lokality súboj (body za staršieho).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ClientState, Command, GameState } from "../src/index.ts";
import { apply, bodyZaStarsieho, hodnotaLokality, legalCommands, loadGameData, naTahu, podmienkyStarsieho, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/**
 * Horná hranica (v5): lokalita pomôže len pri starších s aktívnou podmienkou
 * Lokality — najviac o celé body za takého staršieho (1 + zóny strachu).
 */
const najviac = (v: ClientState, p: 0 | 1): number =>
  v.starsi
    .filter((e) => podmienkyStarsieho(data, e).some((x) => x.aktivna && x.podmienka === "lokality"))
    .reduce((a, e) => a + bodyZaStarsieho(e, p), 0);

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
  it("v5: lokalita nikomu neuberie, pomôže najviac o body starších s podmienkou Lokality, a pre všetky lokality rovnako", () => {
    let nenulovych = 0;
    for (const seed of [3, 7, 12]) {
      for (const s of volbyCiela(seed)) {
        for (const p of [0, 1] as const) {
          const v = viewFor(data, s, p);
          const prva = v.lokalityVHre[0];
          if (prva === undefined) continue;
          const h = hodnotaLokality(data, v, prva);
          for (const q of [0, 1] as const) {
            expect(h[q]).toBeGreaterThanOrEqual(0);
            expect(h[q]).toBeLessThanOrEqual(najviac(v, q));
          }
          for (const k of v.lokalityVHre) expect(hodnotaLokality(data, v, k)).toEqual(h);
          if (h[0] + h[1] > 0) nenulovych++;
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
    // v5: súboj o lokality — tri lokality pomôžu aspoň toľko ako jedna (nie trojnásobok).
    const tri = hodnotaLokality(data, v, ciel!, true);
    expect(tri[0]).toBeGreaterThanOrEqual(jedna[0]);
    expect(tri[1]).toBeGreaterThanOrEqual(jedna[1]);
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
