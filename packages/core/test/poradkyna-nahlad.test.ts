// Playtest 2026-10-22: náhľad vyloženia pripísal Dlh Finančnej poradkyne jej
// majiteľovi, hoci Pitka ho pripíše súperovi. Vymyselník 2026-11-02: náhľad
// vynechal pokutu Policajtky (Pitka, v10.4). Náhľad a Pitka rátajú zadĺženie
// tou istou funkciou (zadlzeniePitkyZLinie).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, PlacedCard } from "../src/index.ts";
import { evaluateLine, lineState, loadGameData, nahladVylozenia, pokutaPolicajtky, prirastkyPitky, setupGame } from "../src/index.ts";

// Policajtka podľa pravidiel v10.4 — sada v masteri môže mať ešte starú s Konfliktom.
const POLICAJTKA_V104 = {
  id: "policajtka",
  index: 21,
  name: "Policajtka",
  tags: ["Občan", "Autorita", "Žena"],
  effect_text: "Pitka: Za každú súperovu akciu, ktorú v tejto Pitke zruší tvoj Odpor, získa súper 1 zadĺženie.",
  triggers: ["Pitka"],
  left: { blocked: [], actions: { Obmedzenie: 1, Odpor: 1, Rana: 2 }, allowed: { "0": ["Obmedzenie"], "1": ["Odpor"], "2": ["Rana"], "3": ["Rana"] } },
  right: { blocked: [3], actions: { Dlh: 1, Obmedzenie: 1, Robota: 1 }, allowed: { "0": ["Obmedzenie"], "1": ["Dlh"], "2": ["Robota"] } },
  permutations: { total: 1, left: 1, right: 1 },
};
const sada = cardsJson as { cards: { id: string }[] };
const data = loadGameData(
  { ...sada, cards: sada.cards.map((c) => (c.id === "policajtka" ? POLICAJTKA_V104 : c)) },
  eldersJson,
  scorecardsJson,
);

let uidSeq = 99000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/**
 * Vyloží kartu `nova` hráča 0 ku karte `susedId` na strane `kam` a porovná zmenu zadĺženia
 * v náhľade so zmenou, ktorú pripíše Pitka. Vráti zmenu z Pitky.
 */
function porovnaj(d: GameData, novaId: string, susedId: string, kam: "vlastna" | "superova"): readonly [number, number] {
  const s0 = setupGame(d, 5);
  const nova = inst(novaId);
  const sused: PlacedCard = { card: inst(susedId), playedBy: kam === "vlastna" ? 0 : 1 };
  const strana = kam === "vlastna" ? 0 : 1;
  const s: GameState = { ...s0, strany: strana === 0 ? [[sused], []] : [[], [sused]] };
  const po: GameState = {
    ...s,
    strany: strana === 0 ? [[sused, { card: nova, playedBy: 0 }], []] : [[], [sused, { card: nova, playedBy: 0 }]],
  };
  const n = nahladVylozenia(d, lineState(s), 0, nova, kam);
  const a = prirastkyPitky(d, s).zadlzenie;
  const b = prirastkyPitky(d, po).zadlzenie;
  const zmena = [b[0] - a[0], b[1] - a[1]] as const;
  expect([n.zmeny[0].Dlh ?? 0, n.zmeny[1].Dlh ?? 0], `${novaId} k ${susedId} ${kam}`).toEqual(zmena);
  return zmena;
}

const obcania = [...data.cards.values()].filter((def) => def.tags.includes("Občan"));

describe("Finančná poradkyňa v náhľade vyloženia", () => {
  it("Dlh z jej akcií náhľad pripíše súperovi rovnako ako Pitka", () => {
    let presmerovane = 0;
    for (const def of obcania) {
      for (const kam of ["vlastna", "superova"] as const) {
        if (porovnaj(data, "financna_poradkyna", def.id, kam)[1] > 0) presmerovane++;
      }
    }
    // Aspoň jeden sused aktivuje jej Dlh — inak by test nič neoveril.
    expect(presmerovane).toBeGreaterThan(0);
  });
});

describe("Policajtka (Pitka, v10.4) v náhľade vyloženia", () => {
  it("pokutu za akcie zrušené jej Odporom náhľad ráta rovnako ako Pitka — vyložená aj ako sused", () => {
    let pokuty = 0;
    for (const def of obcania) {
      for (const kam of ["vlastna", "superova"] as const) {
        for (const [novaId, susedId] of [["policajtka", def.id], [def.id, "policajtka"]] as const) {
          porovnaj(data, novaId, susedId, kam);
          // Či sa v tejto dvojici pokuta naozaj zmenila — inak by test Policajtku neoveril.
          const linia = (strany: GameState["strany"]) => ({ strany, lokalita: null, lokalitaOtocena: false });
          const sused: PlacedCard = { card: inst(susedId), playedBy: kam === "vlastna" ? 0 : 1 };
          const nova: PlacedCard = { card: inst(novaId), playedBy: 0 };
          const strany: GameState["strany"] = kam === "vlastna" ? [[sused, nova], []] : [[], [sused, nova]];
          const l = linia(strany);
          const pokuta = pokutaPolicajtky(data, l, evaluateLine(data, l));
          if (pokuta[0] + pokuta[1] > 0) pokuty++;
        }
      }
    }
    expect(pokuty).toBeGreaterThan(0);
  });

  it("Policajtka vyložená na súperovu stranu (Odpor k jeho karte) ukáže súperovi pokutu v náhľade", () => {
    const s0 = setupGame(data, 5);
    for (const def of obcania) {
      const sused: PlacedCard = { card: inst(def.id), playedBy: 1 };
      const s: GameState = { ...s0, strany: [[], [sused]] };
      const pol = inst("policajtka");
      const l = { ...lineState(s), strany: [[], [sused, { card: pol, playedBy: 0 }]] as GameState["strany"] };
      const pokuta = pokutaPolicajtky(data, l, evaluateLine(data, l));
      if (pokuta[1] === 0) continue;
      const n = nahladVylozenia(data, lineState(s), 0, pol, "superova");
      expect(n.zmeny[1].Dlh ?? 0, def.id).toBe(prirastkyPitky(data, { ...s, strany: l.strany }).zadlzenie[1] - prirastkyPitky(data, s).zadlzenie[1]);
      expect(n.zmeny[1].Dlh ?? 0, def.id).toBeGreaterThanOrEqual(pokuta[1]);
      return;
    }
    throw new Error("žiadny Občan, ktorého akciu by Odpor Policajtky zrušil");
  });
});
