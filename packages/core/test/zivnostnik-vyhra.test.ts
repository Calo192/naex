// Živnostník (Michal 2026-10-26: „veľmi silná — zmeniť na Výhra: zahoď jedno
// súperovo dedičstvo“). Predtým Nástup a hra zahodila najstaršie Dedičstvo;
// teraz po vyhratej bitke vyberá víťaz, za každého svojho Živnostníka jedno.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, legalCommands, loadGameData, setupGame, tahBota, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 97000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const na = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][0]>): GameState {
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function vKole(seed = 41): GameState {
  const s0 = setupGame(data, seed);
  return {
    ...s0,
    kolo: 2,
    utocnik: 0,
    strany: [[], []],
    ciel: { typ: "lokalita", lokalita: inst("krcma") },
    lokalitaOtocena: false,
    lokalityVHre: s0.lokalityVHre.filter((k) => k.defId !== "krcma"),
  };
}

/** Bitka tesne pred Pohrebom hráča 0 (hráč 1 je hotový); víťaz `vitaz`. */
function predPohrebom(vitaz: PlayerId | null, strany: GameState["strany"], dedicstvo1: readonly CardInstance[], dedicstvo0: readonly CardInstance[] = []): GameState {
  const bitka: BitkaStav = {
    krok: "pohreb",
    caka: 0,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    pohorsenieHranice: {},
    damage: null,
    vitaz,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    pohrebHotovy: [false, true],
    benzinkaZostava: [0, 0],
    karHotovy: [true, true],
    spalit: [],
    vesticaHotova: true,
  };
  const s = { ...vKole(), faza: "bitka" as const, strany, bitkaStav: bitka };
  return sHracom(sHracom(s, 1, { dedicstvo: dedicstvo1 }), 0, { dedicstvo: dedicstvo0 });
}

const poPohrebe = (s: GameState): GameState => apply(data, s, { type: "skipPohreb" }, 0).state;

describe("Živnostník: Výhra — víťaz zahodí jedno súperovo Dedičstvo podľa výberu", () => {
  it("Nástup už nič nezahodí", () => {
    const ziv = inst("zivnostnik");
    const pasca = inst("pasca");
    const s0 = vKole();
    const s = sHracom(
      sHracom(
        { ...s0, faza: "zhromazdenie", pitkyCelkom: 1, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } },
        0,
        { ruka: [ziv], poldeciPlne: 2 },
      ),
      1,
      { dedicstvo: [pasca] },
    );
    const po = apply(data, s, { type: "place", uid: ziv.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].map((pl) => pl.card.uid)).toEqual([ziv.uid]);
    expect(po.hraci[1].dedicstvo.map((k) => k.uid)).toEqual([pasca.uid]);
  });

  it("po vyhratej bitke čaká na víťaza; zahodí sa ním vybrané Dedičstvo, ostatné ostanú", () => {
    const pasca = inst("pasca");
    const vinko = inst("vinko");
    const s = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 0)], []], [pasca, vinko]));
    expect(s.bitkaStav?.krok).toBe("zivnostnik");
    expect(s.bitkaStav?.caka).toBe(0);
    expect(legalCommands(data, s, 0)).toEqual([
      { type: "zivnostnik", uid: pasca.uid },
      { type: "zivnostnik", uid: vinko.uid },
    ]);
    // Dedičstvo je verejné; klient vidí len, koľko ešte zahodí.
    expect(viewFor(data, s, 0).bitkaStav?.zivnostnikZostava).toBe(1);
    expect(() => apply(data, s, { type: "zivnostnik", uid: vinko.uid }, 1)).toThrow();
    expect(() => apply(data, s, { type: "zivnostnik", uid: 12345 }, 0)).toThrow(/Dedičstvo/);
    const po = apply(data, s, { type: "zivnostnik", uid: vinko.uid }, 0);
    expect(po.state.hraci[1].dedicstvo.map((k) => k.uid)).toEqual([pasca.uid]);
    expect(po.state.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
    expect(po.events.some((e) => e.type === "log" && /Živnostník: hráč 1 .* Dedičstvo Vínko hráča 2/.test(e.text))).toBe(true);
  });

  it("dvaja Živnostníci = dve zahodenia, každé podľa výberu", () => {
    const d = [inst("pasca"), inst("vinko"), inst("nealko")];
    const s = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 0)], [na(inst("zivnostnik"), 0)]], d));
    expect(s.bitkaStav?.zivnostnikZostava).toBe(2);
    const raz = apply(data, s, { type: "zivnostnik", uid: d[1]!.uid }, 0).state;
    expect(raz.bitkaStav?.krok).toBe("zivnostnik");
    expect(raz.bitkaStav?.caka).toBe(0);
    const dva = apply(data, raz, { type: "zivnostnik", uid: d[2]!.uid }, 0).state;
    expect(dva.hraci[1].dedicstvo.map((k) => k.uid)).toEqual([d[0]!.uid]);
    expect(dva.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
  });

  it("rovnaké Dedičstvá hra zahodí sama, bez otázky", () => {
    const d = [inst("pasca"), inst("pasca")];
    const s = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 0)], []], d));
    expect(s.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
    expect(s.hraci[1].dedicstvo).toHaveLength(1);
  });

  it("bez súperovho Dedičstva, pri prehre či remíze nič", () => {
    const bez = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 0)], []], []));
    expect(bez.bitkaStav?.krok ?? null).not.toBe("zivnostnik");

    const pasca = inst("pasca");
    const vinko = inst("vinko");
    const prehra = poPohrebe(predPohrebom(1, [[na(inst("zivnostnik"), 0)], []], [pasca], [vinko]));
    expect(prehra.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
    expect(prehra.hraci[1].dedicstvo.map((k) => k.uid)).toEqual([pasca.uid]);
    expect(prehra.hraci[0].dedicstvo.map((k) => k.uid)).toEqual([vinko.uid]);

    const remiza = poPohrebe(predPohrebom(null, [[na(inst("zivnostnik"), 0)], []], [inst("pasca"), inst("vinko")]));
    expect(remiza.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
    expect(remiza.hraci[1].dedicstvo).toHaveLength(2);
  });

  it("Živnostník podstrčený súperom patrí súperovi — víťazovi nič nedá", () => {
    const s = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 1)], []], [inst("pasca"), inst("vinko")]));
    expect(s.bitkaStav?.krok ?? null).not.toBe("zivnostnik");
    expect(s.hraci[1].dedicstvo).toHaveLength(2);
  });

  it("bot zahodí súperovi najcennejšie Dedičstvo", () => {
    const pasca = inst("pasca");
    const vinko = inst("vinko");
    const noviny = inst("noviny");
    const s = poPohrebe(predPohrebom(0, [[na(inst("zivnostnik"), 0)], []], [pasca, vinko, noviny]));
    expect(tahBota(data, s, 0, 7)).toEqual({ type: "zivnostnik", uid: vinko.uid });
  });
});
