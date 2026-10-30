// Šarlatán: Konflikt po NA EX (ULTRA playtest 20261030-115654, Fero N10, Vilo N14).
// Prehratie partie na jadre playtestu ukázalo, že jadro Konflikt uplatňuje celý:
// Hazard zdvojený NA EX sa ráta ako Viera a zadĺženie nedáva (Dlh 1 vo výpise bol
// z Anonymného alkoholika); Povery, ktoré spoj s kartou odpovede aktivoval, NA EX zrušilo
// (ako každú aktívnu akciu, §7) — premenené na Rany sú medzi zrušenými, nie v súčte.

import { describe, expect, it } from "vitest";
import type { PlacedCard, PlayerId } from "../src/index.ts";
import { evaluateLine } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { instanceFor, makeDef, syntheticData } from "./helpers.ts";

// Súmerné strany — otočenie karty v línii poradie akcií nemení.
const SAR: Layout4 = ["Dlh", "Povera", "Povera", "Dlh"];
const ODP: Layout4 = [null, "Cigareta", "Cigareta", null];
const sada = syntheticData([
  makeDef("sarlatan", SAR, SAR, { triggers: ["Konflikt"], tags: ["Občan"] }),
  makeDef("odpoved", ODP, ODP),
]);
const lezi = (defId: string, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({
  card: instanceFor(sada, defId, defId === "sarlatan" ? SAR : ODP, defId === "sarlatan" ? SAR : ODP),
  playedBy,
  ...x,
});

describe("§16 Šarlatán: Konflikt mení druh aj akcií zdvojených NA EX", () => {
  it("bez odpovede: NA EX zdvojí neaktívne — Hazard ×2 je Viera, Povera ×2 je Rana; žiadny Dlh", () => {
    const ev = evaluateLine(sada, { lokalita: null, lokalitaOtocena: false, strany: [[], [lezi("sarlatan", 1, { naexBy: 0, premena: "sarlatan" })]] });
    expect(ev.sums[1].Viera).toBe(8);
    expect(ev.sums[1].Rana).toBe(8);
    expect(ev.sums[1].Dlh).toBeUndefined();
    expect(ev.sums[1].Povera).toBeUndefined();
  });

  it("s kartou odpovede: Povery na spoji sú aktívne, NA EX ich zruší (zrušené ako Rany); Hazard ďalej Viera bez zadĺženia", () => {
    const ev = evaluateLine(sada, {
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[], [lezi("sarlatan", 1, { naexBy: 0, premena: "sarlatan" }), lezi("odpoved", 0)]],
    });
    expect(ev.sums[1].Viera).toBe(8);
    expect(ev.sums[1].Rana).toBe(4);
    expect(ev.sums[1].Dlh).toBeUndefined();
    expect((ev.zrusene[1].Rana ?? []).map((z) => z.dovody)).toEqual([["NA EX"], ["NA EX"]]);
  });
});
