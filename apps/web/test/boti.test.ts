// Výber súpera v lobby (Michal 2026-11-06): predvolený je Náhodný a voľba,
// ktorú server už neponúka, sa nepošle.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { platnaVolbaBota, prepniVolbuBota, type BotNaVyber } from "../src/hra/boti.ts";
import { VyberBota } from "../src/hra/VyberBota.tsx";

const BOTI: readonly BotNaVyber[] = [
  { id: "rudo", meno: "Rudo", popis: "Zberač.", avatar: "m1" },
  { id: "igor", meno: "Igor", popis: null, avatar: null },
];

describe("výber bota v lobby", () => {
  it("Náhodný ostáva Náhodným, ponúkaná povaha sa pošle", () => {
    expect(platnaVolbaBota(BOTI, null)).toBeNull();
    expect(platnaVolbaBota(BOTI, "igor")).toBe("igor");
  });

  it("povaha, ktorú server neponúka, sa vráti na Náhodného", () => {
    expect(platnaVolbaBota(BOTI, "zmizla")).toBeNull();
    expect(platnaVolbaBota([], "igor")).toBeNull();
  });
});

describe("okno výberu súpera", () => {
  const nic = (): void => undefined;
  const html = renderToStaticMarkup(createElement(VyberBota, { boti: BOTI, vypnute: false, hraj: nic, zavri: nic }));

  it("ponúka len botov zo servera, Náhodný dlaždicu nemá", () => {
    for (const meno of ["Rudo", "Igor"]) expect(html).toContain(`<strong>${meno}</strong>`);
    expect(html).not.toContain("<strong>Náhodný</strong>");
    expect(html.match(/class="bot-volba /g)).toHaveLength(BOTI.length);
  });

  it("na začiatku nie je nikto označený, teda náhodný súper", () => {
    expect(html).not.toContain('aria-pressed="true"');
  });

  it("klik označí bota, klik na označeného vráti náhodného", () => {
    expect(prepniVolbuBota(null, "igor")).toBe("igor");
    expect(prepniVolbuBota("igor", "rudo")).toBe("rudo");
    expect(prepniVolbuBota("igor", "igor")).toBeNull();
  });
});
