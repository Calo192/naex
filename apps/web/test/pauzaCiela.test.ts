// Pauza po súperovej voľbe cieľa (roadmapa #102, Michal 2026-10-30): ukáže sa len hráčovi, ktorému cieľ vybral súper,
// a len pri prechode z voľby cieľa ďalej. Overuje sa na skutočnej partii z pohľadu hráča (viewFor).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { GameState, PlayerId } from "@naex/core";
import { apply, loadGameData, setupGame, viewFor } from "@naex/core";
import { Medziobrazovka } from "../src/hra/Medziobrazovka.tsx";
import { PAUZA_CIELA_MS, pauzaPoVolbeCiela } from "../src/hra/pauzaCiela.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function volbaCiela(seed: number) {
  const pred = setupGame(data, seed);
  const obranca = (1 - pred.utocnik) as PlayerId;
  const lok = pred.lokalityVHre[0]!;
  const po = apply(data, pred, { type: "chooseLocation", uid: lok.uid, otocena: true }, obranca).state;
  return { pred, po, obranca, utocnik: pred.utocnik, lok };
}

describe("pauzaPoVolbeCiela", () => {
  it("útočník vidí pauzu s lokalitou, ktorú vybral súper", () => {
    const { pred, po, utocnik, lok } = volbaCiela(7);
    expect(pred.faza).toBe("volbaCiela");
    expect(po.faza).toBe("draft");
    expect(pauzaPoVolbeCiela(viewFor(data, pred, utocnik), viewFor(data, po, utocnik))).toEqual({ kolo: po.kolo, uid: lok.uid });
  });

  it("obranca, ktorý cieľ vybral sám, pauzu nemá", () => {
    const { pred, po, obranca } = volbaCiela(7);
    expect(pauzaPoVolbeCiela(viewFor(data, pred, obranca), viewFor(data, po, obranca))).toBeNull();
  });

  it("bez predošlého pohľadu (pripojenie do rozohranej partie) ani pri ďalších pohľadoch draftu pauza nie je", () => {
    const { po, utocnik } = volbaCiela(11);
    const v = viewFor(data, po, utocnik);
    expect(pauzaPoVolbeCiela(null, v)).toBeNull();
    expect(pauzaPoVolbeCiela(v, v)).toBeNull();
  });

  it("vo finále vidí pauzu útočník, ktorému vrcholovú lokalitu vybral vedúci", () => {
    const s0 = setupGame(data, 4);
    const pred: GameState = { ...s0, kolo: s0.lokalitCelkom + 1, faza: "volbaCiela", ciel: null, utocnik: 0, spaky: [3, 5] };
    const vila = pred.lokalityVHre.find((k) => k.defId === "predsedova_vila")!;
    const po = apply(data, pred, { type: "chooseLocation", uid: vila.uid, otocena: false }, 1).state;
    expect(po.ciel?.typ).toBe("finale");
    expect(pauzaPoVolbeCiela(viewFor(data, pred, 0), viewFor(data, po, 0))).toEqual({ kolo: po.kolo, uid: vila.uid });
    expect(pauzaPoVolbeCiela(viewFor(data, pred, 1), viewFor(data, po, 1))).toBeNull();
  });

  it("počas voľby cieľa ešte nie je čo ukázať", () => {
    const { pred, utocnik } = volbaCiela(3);
    const v = viewFor(data, pred, utocnik);
    expect(pauzaPoVolbeCiela(v, v)).toBeNull();
  });
});

describe("medziobrazovka s lokalitou súpera", () => {
  const obsah = { kluc: "3|lokalita-supera", nadnadpis: "Kolo 3 · lokalita", nadpis: "Krčma", text: "Súper vybral lokalitu." };
  const html = (tlacidloPoMs?: number, vypinac?: boolean): string =>
    renderToStaticMarkup(
      createElement(Medziobrazovka, { obsah, onRozumiem: () => {}, tlacidloPoMs, vypinac, trieda: "lokalita-supera" }, createElement("div", { className: "ls-lokalita" }, "karta")),
    );

  it("prvé 3 s je namiesto „Rozumiem“ len pásik času — lokalitu nemožno preklikať", () => {
    const h = html(PAUZA_CIELA_MS, false);
    expect(PAUZA_CIELA_MS).toBe(3000);
    expect(h).not.toContain("Rozumiem");
    expect(h).toContain("medziobrazovka-caka");
    expect(h).toContain("ls-lokalita");
    // Profil vypína len medziobrazovky fáz, lokalitu súpera nie.
    expect(h).not.toContain("Vypnúť ich môžeš v profile");
  });

  it("medziobrazovka fázy bez oneskorenia má „Rozumiem“ hneď", () => {
    const h = html();
    expect(h).toContain("Rozumiem");
    expect(h).not.toContain("medziobrazovka-caka");
    expect(h).toContain("Vypnúť ich môžeš v profile");
  });
});
