// Zošity skúseností AI hráčov (tools/playtest/skusenosti/, Michal 2026-10-25).
// Pri novej VERZIA_PRAVIDIEL musia overené skúsenosti zo starých pravidiel
// spadnúť na „neoverená“ — inak by playtesteri hrali podľa neplatných pravidiel
// ako podľa istoty. Preto tu stráž aj nad skutočnými zošitmi.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERZIA_PRAVIDIEL } from "../../core/src/constants.ts";
import {
  MAX_POLOZIEK,
  PRIECINOK,
  maNezapisaneNavrhy,
  nacitajZosit,
  najslabsia,
  oznacNeoverene,
  skontrolujZosit,
} from "../../../tools/playtest/skusenosti.ts";

const polozka = (id: string, stav: string, pravidla: string, potvrdenia = 1, vyvratenia = 0, datum = "2026-10-25"): string =>
  [
    `### ${id} · Keď mám pred Pitkou len vypitý poldeci, dolejem si ho za cigarety, lebo bez neho nedám NA EX.`,
    `- stav: ${stav}`,
    `- pravidlá: ${pravidla}`,
    `- potvrdenia: ${potvrdenia}`,
    `- vyvrátenia: ${vyvratenia}`,
    `- dátum: ${datum}`,
    `- partie: 20261025-101500-1`,
    `- prečo: K3 bez plného poldeci, súper NA EX bez odpovede.`,
    "",
  ].join("\n");

const zosit = (...polozky: string[]): string => `# Skúsenosti — Test\n\n## Skúsenosti\n\n${polozky.join("\n")}`;

describe("zošity skúseností", () => {
  it("načíta položky s poľami", () => {
    const [s] = nacitajZosit(zosit(polozka("fero-1", "overená", "v5", 3, 1)));
    expect(s?.id).toBe("fero-1");
    expect(s?.pravidlo).toMatch(/^Keď mám pred Pitkou/);
    expect(s?.polia["potvrdenia"]).toBe("3");
    expect(s?.polia["vyvrátenia"]).toBe("1");
  });

  it("over-verziu označí overené skúsenosti zo starej verzie, ostatné nechá", () => {
    const text = zosit(polozka("fero-1", "overená", "v4"), polozka("fero-2", "overená", "v5"), polozka("fero-3", "neoverená", "v3"));
    const { text: novy, zmenene } = oznacNeoverene(text, "v5");
    expect(zmenene).toEqual(["fero-1"]);
    const polozky = nacitajZosit(novy);
    expect(polozky.map((s) => s.polia["stav"])).toEqual(["neoverená", "overená", "neoverená"]);
    // Verzia ostane — je z nej vidieť, z ktorých pravidiel skúsenosť pochádza.
    expect(polozky[0]?.polia["pravidlá"]).toBe("v4");
    expect(oznacNeoverene(novy, "v5").zmenene).toEqual([]);
  });

  it("over-verziu zachová koniec riadkov súboru", () => {
    const crlf = zosit(polozka("eva-1", "overená", "v4")).replace(/\n/g, "\r\n");
    expect(oznacNeoverene(crlf, "v5").text).toBe(crlf.replace("- stav: overená", "- stav: neoverená"));
  });

  it("kontrola odhalí overenú skúsenosť z inej verzie, zlé id aj preplnenie", () => {
    expect(skontrolujZosit(zosit(polozka("eva-1", "overená", "v5")), "eva", "v5")).toEqual([]);
    expect(skontrolujZosit(zosit(polozka("eva-1", "overená", "v4")), "eva", "v5")).toEqual([expect.stringContaining("over-verziu")]);
    expect(skontrolujZosit(zosit(polozka("jano-1", "istá", "v5")), "eva", "v5")).toHaveLength(2);
    const plny = zosit(...Array.from({ length: MAX_POLOZIEK + 1 }, (_, i) => polozka(`eva-${i + 1}`, "overená", "v5")));
    expect(skontrolujZosit(plny, "eva", "v5")).toEqual([expect.stringContaining(`najviac ${MAX_POLOZIEK}`)]);
  });

  it("najslabšia: najmenej potvrdení oproti vyvráteniam, potom neoverená, potom najstaršia", () => {
    const polozky = nacitajZosit(
      zosit(
        polozka("eva-1", "overená", "v5", 3, 0, "2026-10-01"),
        polozka("eva-2", "overená", "v5", 1, 0, "2026-10-02"),
        polozka("eva-3", "neoverená", "v4", 1, 0, "2026-10-20"),
        polozka("eva-4", "overená", "v5", 1, 0, "2026-10-01"),
      ),
    );
    expect(najslabsia(polozky)?.id).toBe("eva-3");
    expect(najslabsia(polozky.filter((s) => s.id !== "eva-3"))?.id).toBe("eva-4");
  });

  it("nezapísané návrhy vo feedbacku", () => {
    expect(maNezapisaneNavrhy("# F\n\n## Návrhy skúseností\n- nová: …")).toBe(true);
    expect(maNezapisaneNavrhy("# F\n\n## Návrhy skúseností (zapísané 2026-10-26)\n- nová: …")).toBe(false);
    expect(maNezapisaneNavrhy("# F\n\n## Výsledok\n")).toBe(false);
  });

  it(`skutočné zošity sedia s pravidlami ${VERZIA_PRAVIDIEL} (inak spusti skusenosti.ts over-verziu)`, () => {
    const subory = readdirSync(PRIECINOK).filter((f) => f.endsWith(".md") && f !== "README.md");
    const hraci = (JSON.parse(readFileSync(join(PRIECINOK, "..", "hraci.json"), "utf8")) as { hraci: { kluc: string }[] }).hraci;
    expect(subory.map((f) => basename(f, ".md")).sort()).toEqual([...hraci.map((h) => h.kluc), "protihrac", "spolocne"].sort());
    for (const f of subory) {
      expect(skontrolujZosit(readFileSync(join(PRIECINOK, f), "utf8"), basename(f, ".md"), VERZIA_PRAVIDIEL)).toEqual([]);
    }
  });
});
