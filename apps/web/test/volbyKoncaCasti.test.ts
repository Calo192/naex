// Koniec časti výučby (hlásenie Michala 2026-10-30, Firefox): pruh Melichara „vibroval“ a cez
// tlačidlá sa nedalo pokračovať. Na poslednej strane textu sú tri tlačidlá ponuky, na ostatných
// jedno „ďalej“ — užší text sa rozdelil na dve strany, „ďalej“ ho rozšírilo na jednu, ponuka znova
// zúžila… Obe sady preto ležia na jednom mieste a neviditeľná drží šírku.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NaJednomMieste } from "../src/hra/MelicharBar.tsx";

const dalej = (ziva: boolean) => createElement("button", ziva ? { "data-vyucba-dalej": "" } : {}, "ďalej");
const ponuka = (ziva: boolean) => createElement("button", ziva ? { "data-vyucba-koniec": "" } : {}, "Hrať proti počítaču");

describe("tlačidlá konca časti na jednom mieste", () => {
  it("vykreslí obe sady — na každej strane textu je pravá časť pruhu rovnako široká", () => {
    for (const ukaz of ["a", "b"] as const) {
      const html = renderToStaticMarkup(createElement(NaJednomMieste, { ukaz, a: dalej, b: ponuka }));
      expect(html).toContain("ďalej");
      expect(html).toContain("Hrať proti počítaču");
    }
  });

  it("skrytá sada je inert a bez značiek nástrojov — klik ani querySelector ju nenájdu", () => {
    const html = renderToStaticMarkup(createElement(NaJednomMieste, { ukaz: "a", a: dalej, b: ponuka }));
    expect(html).toContain("data-vyucba-dalej");
    expect(html).not.toContain("data-vyucba-koniec");
    expect(html).toMatch(/<span[^>]*inert=""[^>]*aria-hidden="true"[^>]*><button>Hrať proti počítaču/);
    const druha = renderToStaticMarkup(createElement(NaJednomMieste, { ukaz: "b", a: dalej, b: ponuka }));
    expect(druha).toContain("data-vyucba-koniec");
    expect(druha).not.toContain("data-vyucba-dalej");
  });
});
