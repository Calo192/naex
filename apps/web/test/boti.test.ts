// Výber súpera v lobby (Michal 2026-11-06; UI inšpekcia W-19): klik na dlaždicu rovno začne
// partiu, náhodný súper je posledná dlaždica, tlačidlo „Hrať“ ani veta o náhodnom nie sú.

import { describe, expect, it } from "vitest";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { BotNaVyber } from "../src/hra/boti.ts";
import { DlazdiceBotov, VyberBota } from "../src/hra/VyberBota.tsx";

const BOTI: readonly BotNaVyber[] = [
  { id: "rudo", meno: "Rudo", popis: "Zberač.", avatar: "m1" },
  { id: "igor", meno: "Igor", popis: null, avatar: null },
];

/** Tlačidlá stromu prvkov v poradí, ako sú na obrazovke. */
function tlacidla(uzol: ReactNode): { readonly onClick: () => void }[] {
  if (Array.isArray(uzol)) return uzol.flatMap(tlacidla);
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(uzol)) return [];
  if (uzol.type === "button" && uzol.props.onClick !== undefined) return [{ onClick: uzol.props.onClick }];
  return tlacidla(uzol.props.children);
}

describe("okno výberu súpera", () => {
  const nic = (): void => undefined;
  const html = renderToStaticMarkup(createElement(VyberBota, { boti: BOTI, vypnute: false, hraj: nic, zavri: nic }));

  it("povahy zo servera a na konci Náhodný súper ako dlaždica", () => {
    for (const meno of ["Rudo", "Igor", "Náhodný súper"]) expect(html).toContain(`<strong>${meno}</strong>`);
    expect(html.match(/class="bot-volba[ "]/g)).toHaveLength(BOTI.length + 1);
    expect(html.indexOf("Igor")).toBeLessThan(html.indexOf("Náhodný súper"));
  });

  it("okrem dlaždíc len Späť — bez „Hrať“ a vety o náhodnom súperovi", () => {
    expect(html).toContain(">Späť</button>");
    expect(html).not.toContain(">Hrať</button>");
    expect(html).not.toContain("Ak nikoho neoznačíš");
  });

  it("klik na dlaždicu rovno hrá: povaha podľa id, Náhodný = null", () => {
    const hrane: (string | null)[] = [];
    const strom = DlazdiceBotov({ boti: BOTI, vypnute: false, hraj: (p) => hrane.push(p), prvy: null });
    for (const b of tlacidla(strom)) b.onClick();
    expect(hrane).toEqual(["rudo", "igor", null]);
  });

  it("pri uzávierke sú dlaždice vypnuté", () => {
    const vypnute = renderToStaticMarkup(createElement(VyberBota, { boti: BOTI, vypnute: true, hraj: nic, zavri: nic }));
    expect(vypnute.match(/<button[^>]*class="bot-volba[^"]*"[^>]*disabled=""/g)).toHaveLength(BOTI.length + 1);
  });
});
