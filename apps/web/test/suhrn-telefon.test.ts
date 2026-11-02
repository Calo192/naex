// Súhrn bitky na telefóne (Michal 2026-10-31, oprava 4): pod pruhom s výsledkom má byť na prvý
// pohľad vidno, kto čo z bitky dostal — špaky so zložením a komu ide Nakladačka (kto ju rozdeľuje).

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BitkaNaNastenke, RekapitulaciaBitky } from "@naex/core";
import { StitkyMomentov, VysledokBitky } from "../src/hra/Rekapitulacia.tsx";
import { textDosledku } from "../src/hra/SuhrnPosunov.tsx";

const spaky = (x: Partial<BitkaNaNastenke>): BitkaNaNastenke =>
  ({ zaBitku: [0, 0], zaStarsich: [0, 0], prebytok: [0, 0], exekutor: [0, 0], ...x }) as BitkaNaNastenke;
const rekap = (x: Partial<RekapitulaciaBitky>): RekapitulaciaBitky => ({ prebytok: 0, prebytokDrzi: null, ...x }) as RekapitulaciaBitky;
const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("výsledok bitky na telefóne", () => {
  it("spočíta špaky každého a ukáže, z čoho sú", () => {
    const r = rekap({ prebytok: 6, prebytokDrzi: 0, spaky: spaky({ zaBitku: [5, 0], zaStarsich: [1, 2], exekutor: [0, 1] }) });
    const t = text(renderToStaticMarkup(createElement(VysledokBitky, { r, ja: 0, mena: ["Jano", "Fero"] })));
    expect(t).toContain("ty +6 š bitka +5 · strach +1");
    expect(t).toContain("Fero +1 š strach +2 · Exekútor −1 · zhorené pri exekúcii za Dlhy");
  });

  it("Nakladačku rozdeľuje porazený — pri tvojej výhre súper", () => {
    const r = rekap({ prebytok: 6, prebytokDrzi: 0, spaky: spaky({ zaBitku: [5, 0] }) });
    const t = text(renderToStaticMarkup(createElement(VysledokBitky, { r, ja: 0, mena: ["Jano", "Fero"] })));
    expect(t).toContain("Nakladačka 6 → ty · rozdeľuje Fero: priazeň jemu, strach z teba");
  });

  it("vo finále je Nakladačka v špakoch víťaza, nie na rozdelenie", () => {
    const r = rekap({ prebytok: 14, prebytokDrzi: 1, spaky: spaky({ zaBitku: [0, 6], prebytok: [0, 14] }) });
    const t = text(renderToStaticMarkup(createElement(VysledokBitky, { r, ja: 0, mena: ["Jano", "Fero"] })));
    expect(t).toContain("Fero +20 š bitka +6 · Nakladačka +14");
    expect(t).toContain("· = špaky (finále)");
  });

  it("moment je štítok — svoj žltý, súperov odlíšený", () => {
    const html = renderToStaticMarkup(
      createElement(StitkyMomentov, { momenty: [{ typ: "vyprask", stupen: "zlato", hrac: 1, nazov: "VÝPRASK", popis: "Výprask" }], ja: 0 }),
    );
    expect(html).toContain("VÝPRASK");
    expect(html).toContain("superov");
  });
});

describe("súhrn kola pri starších na telefóne — dôsledky slovami (v11)", () => {
  const mena = ["Jano", "Fero"] as const;
  it("strach, reči a bodovanie", () => {
    expect(textDosledku({ druh: "strach", hrac: 0, z: 1, na: 3 }, 0, mena, [], 3)).toBe("tvoj strach žltá → červená");
    expect(textDosledku({ druh: "reci", hrac: 1, z: 2, na: 0 }, 0, mena, [], 3)).toBe("Fero — reči oranžová → zanikli");
    expect(textDosledku({ druh: "vyplata", hrac: 1, spaky: 3, reci: true }, 0, mena, [], 3)).toBe("+3 š Fero za reči po bitke");
  });

  it("priazeň a väzeň s textom", () => {
    expect(textDosledku({ druh: "priazen", hrac: 0, sila: 3, bolo: 2 }, 0, mena, [], 3)).toBe("priazeň ty 3 (predtým 2)");
    expect(textDosledku({ druh: "vazen", hrac: 0, poradie: 1 }, 0, mena, [], 3)).toBe("uväznený · väzeň tvoj 0/3");
  });
});
