// Rovnosť v kraji a počet kariet na prebitie (Michal 2026-10-22, návrh 5 A
// z playtestu 20261021-143600) — rozhranie ukazuje to isté, čo ráta prevahaStran.

import { describe, expect, it } from "vitest";
import type { PlacedCard, PlayerId } from "../src/index.ts";
import { prevahaStran, stavKraja } from "../src/index.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

const E = [null, null, null, null] as const;
const sd = syntheticData([
  makeDef("obcan", E, E, { tags: ["Občan"] }),
  makeDef("dvojcata", E, E, { tags: ["Občan", "Chlap"] }),
  makeDef("nastroj", E, E, { tags: ["Nástroj"] }),
]);
const pl = (id: string, playedBy: PlayerId): PlacedCard => ({ card: instanceFor(sd, id, E as never, E as never), playedBy });

describe("stavKraja", () => {
  it("prázdny kraj: nikto, nič na prebitie", () => {
    expect(stavKraja(sd, [])).toEqual({ pocet: [0, 0], priLokalite: null, prevaha: null, rovnost: false, naPrebitie: null });
  });

  it("rovnosť 1 : 1 — hranu má karta pri lokalite, druhému stačí 1 karta", () => {
    const s = stavKraja(sd, [pl("obcan", 1), pl("obcan", 0)]);
    expect(s).toMatchObject({ pocet: [1, 1], priLokalite: 1, prevaha: 1, rovnost: true, naPrebitie: 1 });
  });

  it("kto má kartu pri lokalite a prehráva, dorovná a tým prebije", () => {
    // Hráč 0 pri lokalite, hráč 1 má 3 : 1 → hráčovi 0 stačia 2 karty (3 : 3 a karta pri lokalite).
    const s = stavKraja(sd, [pl("obcan", 0), pl("obcan", 1), pl("obcan", 1), pl("obcan", 1)]);
    expect(s).toMatchObject({ prevaha: 1, rovnost: false, naPrebitie: 2 });
  });

  it("kto kartu pri lokalite nemá, potrebuje o jednu viac; Nástroj sa neráta, Dvojčatá za dvoch", () => {
    const s = stavKraja(sd, [pl("nastroj", 1), pl("dvojcata", 1), pl("obcan", 0)]);
    expect(s).toMatchObject({ pocet: [1, 2], priLokalite: 1, prevaha: 1, naPrebitie: 2 });
  });

  it("prevaha sedí s prevahaStran", () => {
    const strany = [[pl("obcan", 0), pl("obcan", 1)], [pl("nastroj", 0), pl("obcan", 1)]] as const;
    expect([stavKraja(sd, strany[0]).prevaha, stavKraja(sd, strany[1]).prevaha]).toEqual(prevahaStran(sd, strany));
  });
});
