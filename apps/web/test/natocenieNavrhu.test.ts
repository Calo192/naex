// Natočenie navrhnutej lokality (Michal 2026-11-09, „nedá sa mi natočiť lokalitu“, v11.11 natáča víťaz
// minulej hádky): pri natočení cieľa musí v strede ležať hráčov návrh s klikom, nie lokalita zo servera;
// keď lokalitu vyberám, ale natáča ju súper, klik ju neotočí — a tip pod kartou to nesmie sľubovať.
// Overuje sa na pohľade hráča (viewFor) zo skutočnej partie.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { GameState, PlayerId } from "@naex/core";
import { apply, loadGameData, lokalityNaVyber, setupGame, viewFor } from "@naex/core";
import { lokalitaVStrede, lokalitaZNavrhu, natacamNavrh, tipNavrhuLokality } from "../src/hra/natocenieNavrhu.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Voľba cieľa 2. kola: obranca vyberá, minulú hádku vyhral hráč vitaz (null = remíza). */
function volbaCiela(vitaz: "obranca" | "utocnik" | null): { s: GameState; obranca: PlayerId; utocnik: PlayerId } {
  const s0 = setupGame(data, 7);
  const utocnik = s0.utocnik;
  const obranca = (1 - utocnik) as PlayerId;
  const s: GameState = { ...s0, kolo: 2, faza: "volbaCiela", ciel: null, vitazPoslednejHadky: vitaz === null ? null : vitaz === "obranca" ? obranca : utocnik };
  return { s, obranca, utocnik };
}

/** Útočník vyhral minulú hádku a obranca mu vybral lokalitu — natočenie cieľa z pohľadu útočníka. */
function natocenieCiela() {
  const { s, obranca, utocnik } = volbaCiela("utocnik");
  const po = apply(data, s, { type: "chooseLocation", uid: lokalityNaVyber(data, s)[0]!.uid, otocena: false }, obranca).state;
  return { view: viewFor(data, po, utocnik), utocnik };
}

describe("natočenie cieľa: v strede leží hráčov návrh", () => {
  it("klik prepne natočenie v strede, nie lokalitu zo servera", () => {
    const { view, utocnik } = natocenieCiela();
    expect(view.faza).toBe("natocenieCiela");
    expect(view.mozemHrat).toBe(true);
    const lok = view.ciel!.lokalita!;
    for (const otocena of [false, true]) {
      const navrh = lokalitaZNavrhu(view, true, { uid: lok.uid, otocena });
      const stred = lokalitaVStrede(lok, view.lokalitaOtocena, navrh);
      expect(stred).toEqual({ karta: lok, otocena, navrh: true });
    }
    expect(natacamNavrh(view, utocnik)).toBe(true);
  });

  it("bez kliku je návrh natočený ako zo servera; kto nie je na ťahu, vidí cieľ zo servera", () => {
    const { view } = natocenieCiela();
    const lok = view.ciel!.lokalita!;
    expect(lokalitaVStrede(lok, view.lokalitaOtocena, lokalitaZNavrhu(view, true, null))).toEqual({ karta: lok, otocena: view.lokalitaOtocena, navrh: true });
    expect(lokalitaVStrede(lok, view.lokalitaOtocena, lokalitaZNavrhu(view, false, null))).toEqual({ karta: lok, otocena: view.lokalitaOtocena, navrh: false });
  });
});

describe("voľba cieľa: kto natáča", () => {
  it("obranca, ktorému minulú hádku vyhral súper, lokalitu vyberá, ale neotáča", () => {
    const { s, obranca } = volbaCiela("utocnik");
    expect(natacamNavrh(viewFor(data, s, obranca), obranca)).toBe(false);
  });

  it("obranca, ktorý vyhral minulú hádku alebo bola remíza, lokalitu otáča sám", () => {
    for (const vitaz of [null, "obranca"] as const) {
      const { s, obranca } = volbaCiela(vitaz);
      expect(natacamNavrh(viewFor(data, s, obranca), obranca)).toBe(true);
    }
  });

  it("navrhnutá lokalita pri voľbe cieľa ide do stredu s natočením z návrhu", () => {
    const { s, obranca } = volbaCiela(null);
    const view = viewFor(data, s, obranca);
    const lok = lokalityNaVyber(data, s)[0]!;
    expect(lokalitaVStrede(null, view.lokalitaOtocena, lokalitaZNavrhu(view, true, { uid: lok.uid, otocena: true }))).toEqual({ karta: lok, otocena: true, navrh: true });
    expect(lokalitaZNavrhu(view, true, null)).toBeNull();
  });
});

describe("tipNavrhuLokality", () => {
  it("otočenie sľubuje len tomu, kto natáča; inak povie, kto natočí", () => {
    expect(tipNavrhuLokality(true, false, "Igor")).toBe("klik na kartu = otočiť ↻");
    expect(tipNavrhuLokality(true, true, "Igor")).toBe("ťuk na kartu = otočiť ↻");
    expect(tipNavrhuLokality(false, false, "Bot Igor")).toBe("natočí ju Bot Igor");
  });

  it("HernaPlocha kreslí stred podľa lokalitaVStrede a tip aj klik riadi to isté natociSuper", () => {
    const zdroj = readFileSync(new URL("../src/hra/HernaPlocha.tsx", import.meta.url), "utf8");
    expect(zdroj).not.toMatch(/na kartu = otočiť/);
    expect(zdroj).toContain("const stred = lokalitaVStrede(lokalita, view.lokalitaOtocena, lokalitaNavrh);");
    expect(zdroj).toContain("if (stred !== null && !stred.navrh) {");
    expect(zdroj).toContain("tipNavrhuLokality(!natociSuper,");
    expect(zdroj).toContain("...(natociSuper ? {} : { onClick:");
  });
});
