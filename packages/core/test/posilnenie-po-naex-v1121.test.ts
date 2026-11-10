// v11.21 (Michal 2026-11-10): hrana posilnenia Nástroja a Forsáž Energeťáka sa uplatnia na akcie
// aktívne po NA EX — „No lenže keď sa dá NA EX, tak tie neaktívne zrazu aktívne budú.“ Neaktívne X,
// ktoré NA EX aktivovalo (×2), majú s hranou posilnenia ×4; aktívne NA EX zrušilo. „Áno, ×4 — aj Energeťák.“

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, LineState, PlacedCard, PodlozenyNastroj } from "../src/index.ts";
import { evaluateLine, loadGameData } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
let uid = 991000;
const karta = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
const pod = (defId: string, hrana: "horna" | "dolna"): readonly PodlozenyNastroj[] => [{ card: karta(defId), majitel: 0, hrana }];

const sypac = karta("kulturista");
const sofer = karta("sofer");
/** Michalov prípad: Sypač a Šofér, Sypač mu Podporou preškolil Rany na Pecky. */
function linia(x: Partial<PlacedCard>): LineState {
  const preskolenia = [{ z: "Rana" as const, na: "Pecka" as const, od: sypac.uid, spustac: "Podpora" as const }];
  return { lokalita: null, lokalitaOtocena: false, strany: [[{ card: sypac, playedBy: 0 }, { card: sofer, playedBy: 0, preskolenia, ...x }], []] };
}
const sloty = (line: LineState) => {
  const c = evaluateLine(data, line).cards.get(sofer.uid);
  return [...(c?.left ?? []), ...(c?.right ?? [])].filter((s) => s !== null);
};

describe("posilnenie Nástrojom po NA EX (v11.21)", () => {
  it("Sypač + Šofér, pod Šoférom Puška dole (Posilnená {Pecka}), NA EX na Šoféra: neaktívne Pecky ×4, aktívne zrušené", () => {
    const puska = pod("puska", "dolna");
    const bez = sloty(linia({ podlozene: puska }));
    const sNaex = sloty(linia({ podlozene: puska, naexBy: 1 }));
    const pecky = bez.flatMap((s, i) => (s.action === "Pecka" ? [i] : []));
    expect(pecky.length).toBeGreaterThan(0);
    expect(pecky.every((i) => bez[i]!.povodna === "Rana")).toBe(true);
    for (const i of pecky) {
      if (bez[i]!.stav === "aktivna") expect(sNaex[i]).toMatchObject({ stav: "zrusena", nasobok: 0 });
      else expect(sNaex[i]).toMatchObject({ action: "Pecka", stav: "aktivna", nasobok: 4 });
    }
    expect(pecky.some((i) => bez[i]!.stav !== "aktivna")).toBe(true);
    // Bez Pušky NA EX zdvojí len ×2.
    const bezPusky = sloty(linia({ naexBy: 1 }));
    for (const i of pecky.filter((j) => bez[j]!.stav !== "aktivna")) expect(bezPusky[i]?.nasobok).toBe(2);
  });

  it("Energeťák (Forsáž) + NA EX: akcie aktívne po NA EX ×4, aktívne pred ním zrušené", () => {
    const energetak = pod("energetak", "horna");
    const bez = sloty(linia({ podlozene: energetak }));
    const sNaex = sloty(linia({ podlozene: energetak, naexBy: 1 }));
    const bezNastroja = sloty(linia({ naexBy: 1 }));
    let neaktivnych = 0;
    bez.forEach((s, i) => {
      if (s.stav === "aktivna") {
        expect(s.nasobok).toBe(2);
        expect(sNaex[i]?.stav).toBe("zrusena");
      } else if (bezNastroja[i]?.stav === "aktivna") {
        neaktivnych++;
        expect(bezNastroja[i]?.nasobok).toBe(2);
        expect(sNaex[i]).toMatchObject({ stav: "aktivna", nasobok: 4 });
      }
    });
    expect(neaktivnych).toBeGreaterThan(0);
  });
});
