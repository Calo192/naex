// Riadok „Zrejúca: …“ v admin.ts server-stav --zrejuca (Michal 2026-11-02).

import { describe, expect, it } from "vitest";
import { textZmienZrejucej } from "../../../tools/admin/admin.ts";

const stav = { dostupna: true, vypalena: "aaaaaaa", zrejuca: "bbbbbbb", kariet: 0, ineZmeny: false, bezZmien: false };

describe("textZmienZrejucej", () => {
  it("bez zmien, rozdiel v commitoch a kartách, nedostupná", () => {
    expect(textZmienZrejucej({ ...stav, zrejuca: "aaaaaaa", bezZmien: true })).toBe("bez zmien (hráčom sa neponúka)");
    // Vypálená na tom istom commite: Zrejúca má ešte režimy navyše a text to nesmie zamlčať.
    expect(textZmienZrejucej({ ...stav, zrejuca: "aaaaaaa", rezimy: ["2 na 2", "Päta, Lakeť, Otočka"] })).toBe("0 commitov, 0 kariet navyše, len v Zrejúcej: 2 na 2 a Päta, Lakeť, Otočka");
    expect(textZmienZrejucej({ ...stav, kariet: 3 }, () => 5)).toBe("5 commitov, 3 kariet navyše");
    expect(textZmienZrejucej({ ...stav, zrejuca: "aaaaaaa", kariet: 1, ineZmeny: true }, () => 9)).toBe("0 commitov, 1 kariet navyše, aj iné zmeny v tvorcovi");
    expect(textZmienZrejucej({ ...stav }, () => null)).toBe("iný commit (bbbbbbb), 0 kariet navyše");
    expect(textZmienZrejucej({ ...stav, vypalena: null })).toBe("commit nepoznám, 0 kariet navyše");
    expect(textZmienZrejucej({ ...stav, dostupna: false })).toMatch(/^neodpovedá/);
  });
});
