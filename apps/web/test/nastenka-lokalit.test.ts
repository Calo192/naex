// Nástenka lokalít na počítači (Michal 2026-10-31: „nevidno špaky za Robotu“): číslo pod
// odohranou lokalitou = všetko, čo za ňu hráč v kole získal (bitka, Robota, starší, Nakladačka,
// mínus Exekútor), rozpis na myš to rozpíše, súhrn lokality skladá Pitky zo zdrojov po každej.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BitkaNaNastenke, LokalitaVHistorii, RekapitulaciaPitky, ZdrojeVHistorii } from "@naex/core";
import { riadkySuhrnuLokality } from "../src/hra/obsahSuhrnuLokality.ts";
import { Nastenka, poznamkaBitky, rozpisLokality, spakyPredBitkou, SpakyBitky } from "../src/hra/Spaky.tsx";

const bitka = (b: Partial<BitkaNaNastenke>): BitkaNaNastenke => ({
  kolo: 2,
  lokalita: { uid: 900, defId: "zberny_dvor", leftLayout: 0, rightLayout: 0 },
  vitaz: 1,
  rozhodlo: "tuhe",
  pitky: 2,
  karty: 10,
  zaBitku: [0, 10],
  zoSekery: 0,
  abstakZrazka: 0,
  prepadlo: 0,
  zaStarsich: [6, 0],
  exekutor: [1, 0],
  prebytok: [0, 0],
  robota: [0, 2],
  spakyPo: [10, 12],
  ...b,
});

describe("špaky za lokalitu s Robotou", () => {
  it("Robota je v počte aj v rozpise, spolu = popolník po kole mínus pred bitkou", () => {
    const b = bitka({});
    const r = rozpisLokality(b);
    expect(r.riadky.map((x) => x.kluc)).toEqual(["bitka", "robota", "starsi", "exekutor"]);
    expect(r.riadky.find((x) => x.kluc === "robota")?.h).toEqual([0, 2]);
    expect(r.spolu).toEqual([5, 12]);
    const pred = spakyPredBitkou(b);
    expect(r.spolu).toEqual([b.spakyPo[0] - pred[0], b.spakyPo[1] - pred[1]]);
  });

  it("záznam spred Náradia (bez robota) a riadky s nulou u oboch vynechá", () => {
    const { robota: _r, ...stary } = bitka({ zaStarsich: [0, 0], exekutor: [0, 0], spakyPo: [0, 10] });
    const r = rozpisLokality(stary);
    expect(r.riadky.map((x) => x.kluc)).toEqual(["bitka"]);
    expect(r.spolu).toEqual([0, 10]);
  });

  it("poznámka pod lokalitou a tabuľka špakov bitky Robotu spomenú", () => {
    expect(poznamkaBitky(bitka({ exekutor: [0, 0] }), (p) => (p === 0 ? "ty" : "Fero"))).toContain("Robota: Fero +2");
    const html = renderToStaticMarkup(createElement(SpakyBitky, { b: bitka({}), ja: 0, mena: ["ty", "Fero"] }));
    expect(html).toContain("Robota");
    expect(html).toContain("+2");
  });

  it("nástenka: víťaz nad kartou, pod ňou jeho špaky za lokalitu s Robotou; porazený vedľa, keď niečo získal", () => {
    const html = renderToStaticMarkup(
      createElement(Nastenka, {
        nastenka: [bitka({})],
        zostava: [],
        ciel: null,
        ja: 0,
        mena: ["Jano", "Fero"],
        avatary: [null, null],
        karta: () => createElement("span", { className: "karta-test" }),
        menoKarty: () => "Zberný dvor",
        suhrn: () => () => undefined,
      }),
    );
    // Prvý lístok je odohraná lokalita (za ňou čaká finále).
    const listok = html.split("</li>")[0] ?? "";
    // Lístok sa dá fokusovať aj kliknúť (rozpis na fokus, súhrn na Enter).
    expect(listok).toContain('tabindex="0"');
    expect(listok).toContain('role="button"');
    expect(listok).toMatch(/nastenka-vitaz.*karta-test.*nastenka-ziskane/s);
    expect(listok).toContain('nz-hrac superove vitaz"><svg');
    expect(listok).toMatch(/nz-hrac superove vitaz">.*?<b>\+12<\/b>/s);
    expect(listok).toMatch(/nz-hrac moje">.*?<b>\+5<\/b>/s);
    // Karta nesie názov — pod ňou sa neopakuje; účtenka je v rozpise na myš.
    expect(listok).not.toContain("nastenka-nazov");
    expect(listok).not.toContain("nastenka-uctenka");
  });

  it("telefón na šírku (po starom): víťaz so špakmi vedľa seba, bez rozpisu a kliku", () => {
    const html = renderToStaticMarkup(
      createElement(Nastenka, {
        nastenka: [bitka({})],
        zostava: [],
        ciel: null,
        ja: 0,
        mena: ["Jano", "Fero"],
        avatary: [null, null],
        menoKarty: () => "Zberný dvor",
        kompaktna: true,
        poStarom: true,
        suhrn: () => () => undefined,
      }),
    );
    expect(html).not.toContain("tabindex");
    expect(html).toContain("nastenka-zisk");
    expect(html).toContain("+12");
  });
});

const zdroje = (z: Partial<ZdrojeVHistorii>): ZdrojeVHistorii => ({ cigarety: 2, poldeci: 2, dlhy: 0, chut: 1, abstaky: 0, spaky: 0, ...z });

const rekapPitky = (pitka: number, naex: readonly (0 | 1)[], cirhozy: readonly [number, number] = [0, 0]): RekapitulaciaPitky =>
  ({
    pitka,
    pitkyCelkom: 2,
    naex: { karty: naex.map((dal, i) => ({ uid: i, defId: "pijan", majitel: dal, dal, zdvojilo: 1, zrusilo: 0 })), zdvojilo: [0, 0], zrusilo: [0, 0] },
    pecen: { zPitia: [0, 0], zNaex: [0, 0], poskodenie: [0, 0], poldeci: [0, 0], prah: [3, 3], cirhozy },
  }) as unknown as RekapitulaciaPitky;

describe("súhrn lokality — Pitky", () => {
  it("každá Pitka: pasy, NA EX, Cirhózy a zmeny zdrojov od predošlej; na konci bitka a koniec kola", () => {
    const z: LokalitaVHistorii = {
      kolo: 2,
      utocnik: 0,
      lokalita: "zberny_dvor",
      zaciatok: [zdroje({}), zdroje({})],
      pitky: [
        { pitka: 2, rekap: rekapPitky(2, [0, 1, 1], [1, 0]), odpovede: [], pasy: [], po: [zdroje({ cigarety: 3, poldeci: 1, dlhy: 2 }), zdroje({ poldeci: 0, dlhy: 1 })] },
        { pitka: 1, rekap: rekapPitky(1, []), odpovede: [], pasy: [{ kto: 0, cigarety: 1 }], po: [zdroje({ cigarety: 3 }), zdroje({})] },
      ],
      bitka: null,
      posuny: [],
      koniec: [zdroje({ cigarety: 3, poldeci: 1, dlhy: 1, chut: 2, spaky: 5 }), zdroje({ poldeci: 0, dlhy: 1, chut: 3, spaky: 12 })],
    };
    const r = riadkySuhrnuLokality(z);
    expect(r.map((x) => x.nazov)).toEqual(["Pitka 1", "Pitka 2", "bitka a koniec kola"]);
    const texty = (i: number, p: 0 | 1): string[] => r[i]!.zmeny[p].map((x) => x.text);
    expect(texty(0, 0)).toEqual(["pas (+1 cig.)", "+1 cigareta"]);
    expect(texty(0, 1)).toEqual([]);
    expect(texty(1, 0)).toEqual(["NA EX", "+1 Cirhóza", "−1 poldeci", "+2 Dlhy"]);
    expect(texty(1, 1)).toEqual(["NA EX ×2", "−2 poldeci", "+1 Dlh"]);
    expect(texty(2, 0)).toEqual(["−1 Dlh", "Chuť 1 → 2", "+5 špakov"]);
    expect(texty(2, 1)).toEqual(["Chuť 1 → 3", "+12 špakov"]);
    expect(r[2]!.zmeny[0].find((x) => x.kluc === "dlhy")?.ton).toBe("dobre");
  });

  it("kolo, ktoré ešte beží, nemá riadok konca", () => {
    const z: LokalitaVHistorii = { kolo: 1, utocnik: 1, lokalita: null, zaciatok: [zdroje({}), zdroje({})], pitky: [], bitka: null, posuny: [], koniec: null };
    expect(riadkySuhrnuLokality(z)).toEqual([]);
  });
});
