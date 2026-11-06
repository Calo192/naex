// Výber súpera v lobby (Michal 2026-11-06): predvolený je Náhodný a voľba,
// ktorú server už neponúka, sa nepošle.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { platnaVolbaBota, type BotNaVyber } from "../src/hra/boti.ts";
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
  const hraj = (): void => undefined;
  const html = renderToStaticMarkup(createElement(VyberBota, { boti: BOTI, vypnute: false, hraj, zavri: hraj }));
  const zvolene = [...html.matchAll(/<button[^>]*aria-checked="true"[^>]*>.*?<strong>(.*?)<\/strong>/g)].map((m) => m[1]);

  it("predvolený je Náhodný a je označený len on", () => {
    expect(zvolene).toEqual(["Náhodný"]);
  });

  it("ponúkne Náhodného a všetkých botov zo servera", () => {
    for (const meno of ["Náhodný", "Rudo", "Igor"]) expect(html).toContain(`<strong>${meno}</strong>`);
  });
});
