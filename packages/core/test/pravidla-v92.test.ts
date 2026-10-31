// Pravidlá v9.2 (Michal 2026-10-30): NA EX sa odkrývajú naraz; odpovede na NA EX
// lícom dole — najprv útočník, potom obranca na druhý kraj línie, obe sa otočia naraz.
// Šenok začína obranca a na prvom ťahu vezme len 1 kartu (draft.test.ts).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState } from "../src/index.ts";
import { apply, buildGameData, eventsFor, legalCommands, loadGameData, naTahu, parseScorecards, viewFor } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, setupSBalickom } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const R2: Layout4 = ["Rana", "Rana", null, null];
const R1: Layout4 = ["Rana", null, null, null];
const sada = buildGameData(
  new Map([...data.cards, ["v92_lavy", makeDef("v92_lavy", EMPTY, R2)], ["v92_pol", makeDef("v92_pol", R1, R1)]]),
  data.elders,
  parseScorecards(scorecardsJson),
);

/** Po odkrytí NA EX oboch (útočník 0 na kartu hráča 1, obranca 1 na kartu hráča 0); každý má v ruke kartu na odpoveď. */
function poOdkryti(seed: number): { s: GameState; events: readonly Event[]; odpoved: [number, number] } {
  const s0 = setupSBalickom(sada, seed);
  const lavy0 = instanceFor(sada, "v92_lavy", EMPTY, R2);
  const lavy1 = instanceFor(sada, "v92_lavy", EMPTY, R2);
  const ruka0 = instanceFor(sada, "v92_pol", R1, R1);
  const ruka1 = instanceFor(sada, "v92_pol", R1, R1);
  let s: GameState = {
    ...s0,
    faza: "pitka",
    kolo: 2,
    utocnik: 0,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: null },
    lokalityVHre: s0.lokalityVHre.slice(1),
    strany: [
      [{ card: instanceFor(sada, "v92_pol", R1, R1), playedBy: 0 }, { card: lavy0, playedBy: 0 }],
      [{ card: instanceFor(sada, "v92_pol", R1, R1), playedBy: 1 }, { card: lavy1, playedBy: 1 }],
    ],
    hraci: [
      { ...s0.hraci[0], ruka: [ruka0], cigarety: 1, poldeciPlne: 1, poldeciVypite: 0 },
      { ...s0.hraci[1], ruka: [ruka1], cigarety: 1, poldeciPlne: 1, poldeciVypite: 0 },
    ],
    pitkaStav: { naTahu: 1, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] },
  };
  s = apply(sada, s, { type: "naex", uid: lavy0.uid }, 1).state;
  s = apply(sada, s, { type: "skipNaex" }, 1).state;
  s = apply(sada, s, { type: "naex", uid: lavy1.uid }, 0).state;
  const r = apply(sada, s, { type: "skipNaex" }, 0);
  return { s: r.state, events: r.events, odpoved: [ruka0.uid, ruka1.uid] };
}

const texty = (ev: readonly Event[]): string[] => ev.flatMap((e) => (e.type === "log" ? [e.text] : []));

describe("§7 v9.2: NA EX sa odkrývajú naraz", () => {
  it("jedna hláška pre obe NA EX, poldeci ležia na oboch kartách súčasne", () => {
    const { s, events } = poOdkryti(921);
    expect(texty(events).filter((t) => t.startsWith("NA EX sa odkrývajú naraz"))).toHaveLength(1);
    expect(texty(events).some((t) => t.startsWith("Odkryté NA EX"))).toBe(false);
    expect(s.strany[0][1]?.naexBy).toBe(1);
    expect(s.strany[1][1]?.naexBy).toBe(0);
  });
});

describe("§7 v9.2: odpovede lícom dole", () => {
  it("najprv útočník; jeho odpoveď súper nevidí (viewFor ani udalosti); obranca len na druhý kraj; otočia sa naraz", () => {
    const { s, odpoved } = poOdkryti(922);
    expect(s.pitkaStav?.reakcia).toBe(0);
    expect(naTahu(s)).toBe(0);
    // Útočník odpovedá na koniec svojej strany (kraj hráča 0).
    const a = apply(sada, s, { type: "place", uid: odpoved[0], target: "vlastna" }, 0);
    const t = a.state;
    expect(t.strany[0].at(-1)).toMatchObject({ card: { uid: odpoved[0] }, zaverecna: true, odpoved: true });
    // Obranca kartu nevidí: v línii chýba, uid ani meno nepríde.
    const v1 = viewFor(sada, t, 1);
    expect(v1.strany[0].some((pl) => pl.card.uid === odpoved[0])).toBe(false);
    expect(v1.zaverecne).toEqual([expect.objectContaining({ strana: 0, majitel: 0, odpoved: true })]);
    expect(JSON.stringify(v1)).not.toContain(`"uid":${odpoved[0]},`);
    expect(JSON.stringify(eventsFor(a.events, 1))).not.toContain(String(odpoved[0]));
    expect(eventsFor(a.events, 1).some((e) => e.type === "odpovedNaNaex")).toBe(false);
    // Obranca je na rade a smie len na druhý kraj (koniec strany hráča 1 = jeho vlastná).
    expect(t.pitkaStav?.reakcia).toBe(1);
    const miesta = legalCommands(sada, t, 1).flatMap((c: Command) => (c.type === "place" ? [c.target] : []));
    expect(miesta).toEqual(["vlastna"]);
    expect(() => apply(sada, t, { type: "place", uid: odpoved[1], target: "superova" }, 1)).toThrow();
    // Odpoveď obrancu → obe sa otočia naraz a Pitka sa vyhodnotí.
    const b = apply(sada, t, { type: "place", uid: odpoved[1], target: "vlastna" }, 1);
    expect(texty(b.events).filter((x) => x.startsWith("Odpovede sa otáčajú naraz"))).toHaveLength(1);
    const otocene = b.events.flatMap((e) => (e.type === "odpovedNaNaex" && e.uid !== null ? [e.uid] : []));
    expect(otocene.sort()).toEqual([...odpoved].sort());
    const iOtocenia = b.events.findIndex((e) => e.type === "odpovedNaNaex");
    const iVysledku = b.events.findIndex((e) => e.type === "pitkaVysledok");
    expect(iOtocenia).toBeGreaterThanOrEqual(0);
    expect(iVysledku).toBeGreaterThan(iOtocenia);
    // Vyhodnotená línia mala obe karty lícom hore.
    for (const strana of b.state.strany) expect(strana.some((pl) => pl.odpoved === true || pl.zaverecna === true)).toBe(false);
  });

  it("útočník neodpovie → obranca smie na ktorýkoľvek kraj (Michal 2026-10-30)", () => {
    const { s } = poOdkryti(923);
    const t = apply(sada, s, { type: "bezReakcie" }, 0).state;
    expect(t.pitkaStav?.reakcia).toBe(1);
    const miesta = new Set(legalCommands(sada, t, 1).flatMap((c: Command) => (c.type === "place" ? [c.target] : [])));
    expect(miesta).toEqual(new Set(["vlastna", "superova"]));
  });
});
