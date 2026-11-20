// Nápovedy po výučbe (UI inšpekcia 20261120-1324, V-19): látku, ktorú časť výučby naučila, nápoveda
// v prvej partii znova nevysvetľuje — zoznam pri časti musí sedieť s katalógom nápovied.

import { describe, expect, it } from "vitest";
import katalog from "../../../packages/core/data/vyucba/napovedy.json";
import { NAPOVEDY_CASTI_VYUCBY } from "../src/hra/Napovedy.tsx";

describe("nápovedy s látkou výučby", () => {
  const ids = new Set(katalog.napovedy.map((n) => n.id));
  const zoVyucby = Object.values(NAPOVEDY_CASTI_VYUCBY).flat();

  it("každé id je v katalógu nápovied a pri jednej časti", () => {
    for (const id of zoVyucby) expect(ids.has(id), id).toBe(true);
    expect(new Set(zoVyucby).size).toBe(zoVyucby.length);
  });

  it("Absťák a pravidlo lokality výučba neučí — ostávajú pre prvú partiu", () => {
    expect(zoVyucby).not.toContain("abstak");
    expect(zoVyucby).not.toContain("lokalita-pravidlo");
  });
});
