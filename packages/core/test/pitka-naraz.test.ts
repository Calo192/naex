// Pitka naraz (Michal 2026-10-27, PRAVIDLA §7 „Poradie“): obaja hráči hrajú Pitku
// súčasne a každý skončí sám. NA EX sa odkryjú, až keď skončia obaja. Jediná
// výnimka je Bzdocha — jej majiteľ čaká, kým súper skončí, a vidí jeho NA EX.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, buildGameData, eventsFor, hraVPitke, legalCommands, loadGameData, mozeHrat, naTahu, parseScorecards, tahBota, viewFor } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const sada = buildGameData(
  new Map([...data.cards, ["pn_lavy", makeDef("pn_lavy", EMPTY, R2)], ["pn_pol", makeDef("pn_pol", R1, R1)]]),
  data.elders,
  parseScorecards(scorecardsJson),
);

/**
 * Zhromaždenie pred Pitkou (útočník 0, obranca 1): na strane hráča 1 dve jeho karty,
 * na ktoré sa dá NA EX; obaja majú plný poldeci a cigarety. `bzdocha` dá Bzdochu
 * (klebetnica) do partie hráčov. Obaja pasujú → Pitka začne.
 */
function doPitky(seed: number, bzdocha: readonly PlayerId[] = []): { s: GameState; lavy: number; pol: number } {
  const s0 = setupSBalickom(sada, seed);
  const lavy = instanceFor(sada, "pn_lavy", EMPTY, R2);
  const pol = instanceFor(sada, "pn_pol", R1, R1);
  const bz = (p: PlayerId): PlacedCard[] => (bzdocha.includes(p) ? [{ card: { uid: 880000 + p, defId: "klebetnica", leftLayout: 0, rightLayout: 0 }, playedBy: p }] : []);
  let s: GameState = {
    ...s0,
    faza: "zhromazdenie",
    kolo: 2,
    utocnik: 0,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    ciel: { typ: "lokalita", lokalita: null },
    lokalityVHre: s0.lokalityVHre.slice(1),
    strany: [[...bz(0)], [{ card: pol, playedBy: 1 }, { card: lavy, playedBy: 1 }, ...bz(1)]],
    hraci: [
      { ...s0.hraci[0], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
      { ...s0.hraci[1], ruka: [], cigarety: 5, poldeciPlne: 1, poldeciVypite: 0 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
  s = apply(sada, s, { type: "pass" }, 0).state;
  if (s.faza !== "pitka") s = apply(sada, s, { type: "pass" }, 1).state;
  expect(s.faza).toBe("pitka");
  return { s, lavy: lavy.uid, pol: pol.uid };
}

const naexNaLinii = (s: GameState): number => s.strany.flat().filter((pl) => pl.naexBy !== undefined).length;

describe("Pitka naraz (Michal 2026-10-27)", () => {
  it("obaja hrajú súčasne: útočník smie fajčiť aj dať NA EX skôr, než obranca skončí", () => {
    const { s, lavy } = doPitky(201);
    expect(mozeHrat(s, 0)).toBe(true);
    expect(mozeHrat(s, 1)).toBe(true);
    expect(s.pitkaStav?.bzdocha).toBeNull();
    // Útočník (0) koná prvý, obranca (1) ešte neskončil.
    let t = apply(sada, s, { type: "smoke", pocet: 1 }, 0).state;
    t = apply(sada, t, { type: "naex", uid: lavy }, 0).state;
    // Obranca hrá ďalej popri ňom.
    expect(legalCommands(sada, t, 1).some((c) => c.type === "smoke")).toBe(true);
    t = apply(sada, t, { type: "smoke", pocet: 1 }, 1).state;
    expect(t.pitkaStav?.fajcenie).toEqual([1, 1]);
  });

  it("NA EX sa odkryjú, až keď skončia obaja; kto skončil, už nehrá", () => {
    const { s, lavy, pol } = doPitky(202);
    let t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    t = apply(sada, t, { type: "skipNaex" }, 0).state;
    expect(mozeHrat(t, 0)).toBe(false);
    expect(legalCommands(sada, t, 0)).toEqual([]);
    expect(() => apply(sada, t, { type: "smoke", pocet: 1 }, 0)).toThrow();
    expect(naexNaLinii(t)).toBe(0);
    expect(naTahu(t)).toBe(1);
    t = apply(sada, t, { type: "naex", uid: pol }, 1).state;
    expect(naexNaLinii(t)).toBe(0);
    const r = apply(sada, t, { type: "skipNaex" }, 1);
    const odkryte = r.events.flatMap((e) => (e.type === "log" && e.text.startsWith("Odkryté NA EX") ? [e.text] : []));
    // Najprv obrancove (hráč 2), potom útočníkove (hráč 1) — ako doteraz.
    expect(odkryte).toEqual(["Odkryté NA EX: hráč 2 dal NA EX na svoju kartu pn_pol.", "Odkryté NA EX: hráč 1 dal NA EX na súperovu kartu pn_lavy."]);
  });

  it("viewFor nepošle súperovo skryté NA EX — ani počas hry, ani keď súper skončil", () => {
    const { s, lavy } = doPitky(203);
    const t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    expect(viewFor(sada, t, 1).pitkaStav?.skryteNaex).toEqual([]);
    expect(viewFor(sada, t, 1)).toEqual(viewFor(sada, s, 1));
    expect(eventsFor(apply(sada, s, { type: "naex", uid: lavy }, 0).events, 1)).toEqual([]);
    const hotovo = apply(sada, t, { type: "skipNaex" }, 0).state;
    expect(viewFor(sada, hotovo, 1).pitkaStav?.skryteNaex).toEqual([]);
    expect(viewFor(sada, hotovo, 0).pitkaStav?.skryteNaex).toEqual([{ hrac: 0, uid: lavy }]);
  });

  it("Bzdocha: jej majiteľ čaká, kým súper skončí, potom hrá a vidí jeho NA EX", () => {
    const { s, lavy } = doPitky(204, [1]);
    expect(s.pitkaStav?.bzdocha).toBe(1);
    expect(mozeHrat(s, 1)).toBe(false);
    expect(mozeHrat(s, 0)).toBe(true);
    expect(legalCommands(sada, s, 1)).toEqual([]);
    expect(() => apply(sada, s, { type: "smoke", pocet: 1 }, 1)).toThrow();
    let t = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    expect(viewFor(sada, t, 1).pitkaStav?.skryteNaex).toEqual([]);
    t = apply(sada, t, { type: "skipNaex" }, 0).state;
    expect(mozeHrat(t, 1)).toBe(true);
    expect(hraVPitke(viewFor(sada, t, 1).pitkaStav!, 1)).toBe(true);
    expect(viewFor(sada, t, 1).pitkaStav?.skryteNaex).toEqual([{ hrac: 0, uid: lavy }]);
    // Súper Bzdochy (0) jej NA EX nevidí.
    t = apply(sada, t, { type: "naex", uid: lavy }, 1).state;
    expect(viewFor(sada, t, 0).pitkaStav?.skryteNaex).toEqual([{ hrac: 0, uid: lavy }]);
  });

  it("Bzdochu majú obaja: nečaká nikto", () => {
    const { s } = doPitky(205, [0, 1]);
    expect(s.pitkaStav?.bzdocha).toBeNull();
    expect(mozeHrat(s, 0)).toBe(true);
    expect(mozeHrat(s, 1)).toBe(true);
  });

  it("bot sa rozhodne rovnako, či súper NA EX skryto dal, alebo nie", () => {
    const { s, lavy } = doPitky(206);
    const sNaex = apply(sada, s, { type: "naex", uid: lavy }, 0).state;
    expect(tahBota(sada, sNaex, 1, 7)).toEqual(tahBota(sada, s, 1, 7));
  });
});
