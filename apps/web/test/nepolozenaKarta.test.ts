// Hláška po pustení karty mimo povoleného miesta (playtest výučby 20261025, K11): pri
// vyčerpanom limite nesmie posielať hráča na „+“, ktoré na stole nie je.

import { describe, expect, it } from "vitest";
import { NAHRADIT, textNepolozenejKarty } from "../src/hra/nepolozenaKarta.ts";

describe("textNepolozenejKarty", () => {
  it("s voľným miestom na stole radí zvýraznené miesto aj „+“", () => {
    const t = textNepolozenejKarty({ ciele: new Set(["vlastna", "superova"]), plus: true, dovodStola: null, pas: true });
    expect(t).toContain("zvýraznené miesto");
    expect(t).toContain("„+“");
  });

  it("bez voľného „+“ (len nahradenie návrhu) „+“ nespomína", () => {
    const t = textNepolozenejKarty({ ciele: new Set([`${NAHRADIT}12`]), plus: false, dovodStola: "Limit vykladania je vyčerpaný.", pas: true });
    expect(t).toContain("zvýraznené miesto");
    expect(t).not.toContain("+");
  });

  it("pri vyčerpanom limite povie prečo a poradí pasovať", () => {
    const t = textNepolozenejKarty({ ciele: new Set(), plus: false, dovodStola: "Limit vykladania je vyčerpaný.", pas: true });
    expect(t).toBe("Na stôl už kartu nevyložíš. Limit vykladania je vyčerpaný. Ak už nič nevykladáš, pasuj (P).");
    expect(t).not.toContain("+");
  });

  it("keď ostáva priznanie či Dedičstvo, pošle tam, nie na stôl", () => {
    const t = textNepolozenejKarty({ ciele: new Set(["priznanie"]), plus: false, dovodStola: "Limit vykladania je vyčerpaný", pas: true });
    expect(t).toContain("Limit vykladania je vyčerpaný.");
    expect(t).toContain("mimo stola");
    expect(t).toContain("pasuj (P)");
    expect(t).not.toContain("+");
  });

  it("pri odpovedi na NA EX pasovať neradí", () => {
    const t = textNepolozenejKarty({ ciele: new Set(), plus: false, dovodStola: "Sem žiadnu kartu z ruky vyložiť nesmieš.", pas: false });
    expect(t).not.toContain("pasuj");
  });
});
