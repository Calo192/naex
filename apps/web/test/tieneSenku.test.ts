// Tieň karty vzatej súperom zo šenku (#111) a rozloženie ponuky patronátu (#110).

import { describe, expect, it } from "vitest";
import type { CardInstance, ZobrataVerejne } from "@naex/core";
import { radSenku } from "../src/hra/tieneSenku.ts";
import { rozlozeniePonuky } from "../src/hra/rozlozeniePonuky.ts";

const k = (uid: number, defId = `k${uid}`): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });
const z = (defId: string, hrac: 0 | 1, miesto: number): ZobrataVerejne => ({ karta: { defId, leftLayout: 0, rightLayout: 0 }, hrac, miesto });

describe("rad šenku s tieňmi", () => {
  it("tieň súperovej karty leží na mieste, odkiaľ ju vzal; vlastná vzatá karta tieň nenechá", () => {
    // Pôvodne A B C D E: súper vzal B (miesto 1), ja D (miesto 3).
    const senok = [k(1, "A"), k(3, "C"), k(5, "E")];
    const zobrate = [z("B", 1, 1), z("D", 0, 3)];
    const rad = radSenku(senok, senok, zobrate, 1).map((x) => (x.typ === "karta" ? x.karta.defId : `tieň ${x.zobrata.karta.defId}`));
    expect(rad).toEqual(["A", "tieň B", "C", "E"]);
  });

  it("karta navrhnutá do ruky z radu zmizne, tiene ostanú na miestach", () => {
    const senok = [k(1, "A"), k(3, "C")];
    const rad = radSenku(senok, [senok[1]!], [z("B", 1, 1)], 1).map((x) => (x.typ === "karta" ? x.karta.defId : "tieň"));
    expect(rad).toEqual(["tieň", "C"]);
  });
});

describe("ponuka patronátu", () => {
  it("na stole 1366 × 650 sú karty štyroch starších čitateľné a text je vedľa nich", () => {
    const r = rozlozeniePonuky(1310, 230, 4);
    expect(r.sirka).toBeGreaterThanOrEqual(90);
    expect(r.textPod).toBe(false);
  });

  it("na úzkom stole ide text pod kartu a karta neklesne pod hranicu čitateľnosti", () => {
    const r = rozlozeniePonuky(700, 420, 4);
    expect(r.textPod).toBe(true);
    expect(r.sirka).toBeGreaterThanOrEqual(64);
  });
});
