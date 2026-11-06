// Legacy achievement (Michal 2026-11-06): vo vitríne aj v Prehľade má značku,
// ostatné achievementy ju nemajú a postup k ďalšiemu ranku sa pri ňom neukazuje.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { polozkaVitriny, type PolozkaVitrinyApi } from "../src/achievementy/data.ts";
import { Vitrina } from "../src/achievementy/Vitrina.tsx";

const zaklad: PolozkaVitrinyApi = {
  id: "stamgast-pod-stolom",
  nazov: "Štamgast pod stolom",
  popis: "Vyhraj nad Štamgastom spolu 5×.",
  kategoria: "bot",
  piktogram: "akcia:Rana",
  tajny: false,
  rankov: 3,
  zriedkavost: ["bezne", "nezvycajne", "vzacne"],
  legacy: true,
  rank: 2,
  prahy: [1, 5, 20],
  postup: null,
  ziskane: [
    { rank: 1, ziskane: 1000, partia: null },
    { rank: 2, ziskane: 2000, partia: null },
  ],
};

describe("vitrína — legacy achievement", () => {
  const legacy = polozkaVitriny(zaklad, []);
  const bezny = polozkaVitriny({ ...zaklad, id: "igor-v-jarku", nazov: "Igor v jarku", legacy: false, postup: { hodnota: 3, aktualna: null } }, []);

  it("prevod zo servera zachová značku a dátum najvyššieho ranku, postup nemá", () => {
    expect(legacy).toMatchObject({ legacy: true, rank: "striebro", ziskane: 2000, postup: null });
    expect(bezny).toMatchObject({ legacy: false, postup: { hodnota: 3, prah: 20 } });
  });

  it("značku má len legacy, vo vlastnej aj cudzej vitríne", () => {
    for (const vlastna of [true, false]) {
      const html = renderToStaticMarkup(createElement(Vitrina, { polozky: [legacy, bezny], kategorie: [], vlastna }));
      expect(html.match(/LEGACY ACHIEVEMENT/g)).toHaveLength(1);
      expect(html).toContain('class="ziskany legacy"');
      expect(html).toContain("2 z 2");
      const bezLegacy = renderToStaticMarkup(createElement(Vitrina, { polozky: [bezny], kategorie: [], vlastna }));
      expect(bezLegacy).not.toContain("LEGACY");
    }
  });
});
