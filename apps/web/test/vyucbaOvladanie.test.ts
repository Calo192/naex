// Ovládanie výučby po playteste nováčikov 20261030-184959: Kšeft vily tlačidlami namiesto
// rozbaľovača, Dedičstvo svieti od začiatku kroku, hlásenia v bubline oddelené od vety
// Melichara, Enter na konci časti.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CardInstance, Command, PolozkaVykladania } from "@naex/core";
import { KseftVily } from "../src/hra/KseftVily.tsx";
import { klucVily, moznostiVily } from "../src/hra/volbaVily.ts";
import { kartaVyucbyDoOblasti } from "../src/hra/odkazTahu.ts";
import { enterNaKonciCasti, kluceZOcakavania, kusOddeleny } from "../src/hra/Vyucba.tsx";

const karta = (uid: number, defId: string): CardInstance => ({ uid, defId }) as unknown as CardInstance;

describe("Kšeft vily", () => {
  const view = {
    starsi: [
      { elderId: "starosta", karta: karta(90, "starosta") },
      { elderId: "farar", karta: karta(91, "farar") },
    ],
    pokusy: [{ elderId: "farar" }, null],
  } as unknown as Parameters<typeof moznostiVily>[0];

  it("ponúkne starších bez pokusu — o staršieho v pokuse sa práve hrá", () => {
    expect(moznostiVily(view).map((m) => m.elderId)).toEqual(["starosta"]);
  });

  it("je tlačidlo, nie rozbaľovač; ponuka má pre staršieho „k sebe“ aj „od seba“", () => {
    const zavreta = renderToStaticMarkup(createElement(KseftVily, { uid: 7, moznosti: moznostiVily(view), meno: (d: string) => d, cmd: () => {}, napis: "−2 → posun" }));
    expect(zavreta).not.toContain("<select");
    expect(zavreta).toContain('data-vyucba="tlacidlo:kseft"');
    const otvorena = renderToStaticMarkup(createElement(KseftVily, { uid: 7, moznosti: moznostiVily(view), meno: (d: string) => d, cmd: () => {}, napis: "−2 → posun", otvorena: true }));
    expect(otvorena).not.toContain("<select");
    expect(otvorena).toContain(`data-vyucba="${klucVily("starosta", true)}"`);
    expect(otvorena).toContain(`data-vyucba="${klucVily("starosta", false)}"`);
    expect(otvorena).toContain("k sebe");
    expect(otvorena).toContain("od seba");
  });

  it("výučba rozsvieti presne tlačidlo, ktoré krok čaká", () => {
    const c: Command = { type: "kseft", uid: 7, elderId: "starosta", kSebe: true };
    expect(kluceZOcakavania(c)).toContain(klucVily("starosta", true));
    expect(kluceZOcakavania(c)).not.toContain(klucVily("starosta", false));
  });
});

describe("Dedičstvo vo výučbe", () => {
  const vidly = karta(12, "vidly");
  const ocakava = { type: "tah", kroky: [{ type: "place", uid: 12, target: "dedicstvo" }] } as unknown as Command;

  it("dlaždica je cieľom od začiatku kroku — karta zo scenára ešte v ruke", () => {
    expect(kartaVyucbyDoOblasti(ocakava, [karta(11, "pijan"), vidly], [])).toBe(vidly);
  });

  it("keď už karta leží v návrhu, alebo krok Dedičstvo nečaká, dlaždica ostane dlaždicou", () => {
    const vNavrhu: PolozkaVykladania[] = [{ karta: vidly, ciel: "dedicstvo" }];
    expect(kartaVyucbyDoOblasti(ocakava, [vidly], vNavrhu)).toBeNull();
    expect(kartaVyucbyDoOblasti({ type: "pass" }, [vidly], [])).toBeNull();
    expect(kartaVyucbyDoOblasti(null, [vidly], [])).toBeNull();
    expect(kartaVyucbyDoOblasti({ type: "tah", kroky: [{ type: "place", uid: 12, target: "vlastna" }] } as unknown as Command, [vidly], [])).toBeNull();
  });

  it("výučba rozsvieti dlaždicu Karty, keď krok čaká Dedičstvo či priznanie", () => {
    expect(kluceZOcakavania(ocakava)).toContain("bar:karty");
    expect(kluceZOcakavania({ type: "tah", kroky: [{ type: "place", uid: 3, target: "vlastna" }] } as unknown as Command)).not.toContain("bar:karty");
  });
});

describe("hlásenie v bubline", () => {
  it("štítok ťahu či chyba nie sú zlepené s vetou Melichara („…hráča 2.Obaja…“)", () => {
    const html = renderToStaticMarkup(createElement("p", null, kusOddeleny("stitok", createElement("span", null, "Čaká sa na hráča 2.")).obsah, "Obaja ste skončili."));
    expect(html.replace(/<[^>]+>/g, "")).toBe("Čaká sa na hráča 2. Obaja ste skončili.");
  });
});

describe("Enter na konci časti", () => {
  it("spustí ďalšiu časť, a keď už nie je, hru proti počítaču — tlačidlo, ktoré je hlavné", () => {
    expect(enterNaKonciCasti({ dalsiaCast: { cast: 2, nazov: "NA EX a podlosti", minuty: 15 } })).toBe("pokracovat");
    expect(enterNaKonciCasti({ dalsiaCast: null })).toBe("hratProtiPocitacu");
  });
});
