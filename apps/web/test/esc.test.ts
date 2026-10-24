// Esc a návrh ťahu (Leader 2026-10-24): Esc vráti návrh do ruky až ako posledná
// vrstva — kým je otvorená lupa, dialóg, prehľad starších či iný výber, zavrie
// najprv ten — a len cez tlačidlo návratu, ktoré by hráč mohol stlačiť myšou.

import { describe, expect, it } from "vitest";
import { escVratiNavrh, type VrstvyPreEsc } from "../src/hra/skratky.tsx";

const NIC: VrstvyPreEsc = { lupa: false, dialog: false, starsi: false, vyber: false, potvrdenie: false, odhad: false, pult: false };

describe("Esc a návrh ťahu", () => {
  it("bez otvorenej vrstvy vráti návrh cez tlačidlo návratu", () => {
    expect(escVratiNavrh(NIC, true)).toBe(true);
  });

  it("bez tlačidla, ktoré by hráč mohol stlačiť (nie je, je zakázané alebo ho zakrýva stmavenie výučby), nič nezruší", () => {
    expect(escVratiNavrh(NIC, false)).toBe(false);
  });

  it.each(Object.keys(NIC) as (keyof VrstvyPreEsc)[])("kým je otvorené %s, Esc zavrie najprv to a návrh ostane", (vrstva) => {
    expect(escVratiNavrh({ ...NIC, [vrstva]: true }, true)).toBe(false);
  });
});
