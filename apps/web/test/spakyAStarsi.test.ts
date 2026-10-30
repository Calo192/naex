// Bar špakov a dlaždica Starší (Michal 2026-10-27): dlaždice špakov musia dať dokopy
// popolník (inak hráč skóre zo stola neposkladá) a stupienky musia ukázať, kto dáva
// hráčovi priazeň a kto sa ho bojí — na partiách botov z pohľadu hráča (viewFor).

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { ClientState, GameState, PlayerId } from "@naex/core";
import { apply, jeFinaleNaNastenke, loadGameData, naTahu, priazenHraca, setupGame, spakyTeraz, strachNaVyplatu, strachZ, tahBota, viewFor } from "@naex/core";
import { rezimRadov, spakyPodlaZdroja, stupienkyStarsich } from "../src/hra/spakyAStarsi.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Pohľady hráča 0 po každej bitke partie botov (kým hra neskončila). */
function odohraj(seed: number): ClientState[] {
  let s: GameState = setupGame(data, seed, { lokalit: 3 });
  const out: ClientState[] = [];
  for (let n = 0; n < 8000 && s.koniec === null; n++) {
    const kto = naTahu(s);
    if (kto === null) break;
    const pred = s.nastenka.length;
    s = apply(data, s, tahBota(data, s, kto, seed + n), kto).state;
    if (s.nastenka.length > pred && s.koniec === null) out.push(viewFor(data, s, 0));
  }
  return out;
}
// Partie botov sú pomalé (výpočet dopredu) — každá sa odohrá raz pre všetky testy.
const odohrane = new Map<number, ClientState[]>();
const poBitkach = (seed: number): ClientState[] => {
  const x = odohrane.get(seed) ?? odohraj(seed);
  odohrane.set(seed, x);
  return x;
};
const DLHO = 60_000;

describe("bar špakov", () => {
  for (const seed of [8, 21]) {
    it(`lokality + starší + finále a Nakladačka − Exekútor = popolník (seed ${seed})`, () => {
      const pohlady = poBitkach(seed);
      expect(pohlady.length).toBeGreaterThan(1);
      for (const v of pohlady) {
        for (const p of [0, 1] as const satisfies readonly PlayerId[]) {
          const r = spakyPodlaZdroja(v, p);
          expect(r.zaLokality + r.zaStarsich + r.zaFinale + r.exekutor).toBe(v.spaky[p]);
          expect(r.vyhrate.length).toBe(v.nastenka.filter((b) => !jeFinaleNaNastenke(b) && b.lokalita !== null && b.vitaz === p).length);
        }
      }
    }, DLHO);
  }
});

describe("dlaždica Starší", () => {
  it("priazeň hore, strach dole, stred nič; výška je zóna", () => {
    const starsi = ([0, 1, 2, 3, 4, 5, 6] as const).map((marker) => ({ elderId: `e${marker}`, marker }));
    const ja = stupienkyStarsich(starsi, 0);
    expect(ja.stlpce.map((s) => s.smer)).toEqual(["hore", "hore", "hore", "nic", "dole", "dole", "dole"]);
    expect(ja.stlpce.map((s) => s.zona)).toEqual([3, 2, 1, 0, 1, 2, 3]);
    expect([ja.priazen, ja.strach]).toEqual([3, 3]);
    const su = stupienkyStarsich(starsi, 1);
    expect(su.stlpce.map((s) => s.smer)).toEqual(["dole", "dole", "dole", "nic", "hore", "hore", "hore"]);
  });

  it("v partii sedí s jadrom: priazeň = priazenHraca, strach = starší, ktorí dávajú špaky", () => {
    for (const v of poBitkach(8)) {
      const body = spakyTeraz(v);
      for (const p of [0, 1] as const satisfies readonly PlayerId[]) {
        const s = stupienkyStarsich(v.starsi, p);
        expect(s.priazen).toBe(v.starsi.filter((e) => priazenHraca(e) === p).length);
        expect(s.strach).toBe(v.starsi.filter((e) => strachZ(e, p) > 0).length);
        // Stĺpčeky dole ukazujú zónu; po bitke od nich príde len to, čo ešte nezaplatili (v8).
        expect(body.zaStarsich[p]).toBe(v.starsi.reduce((a, e) => a + strachNaVyplatu(e, p), 0));
        expect(body.zaStarsich[p]).toBeLessThanOrEqual(s.stlpce.filter((x) => x.smer === "dole").reduce((a, x) => a + (x.zona * (x.zona + 1)) / 2, 0));
      }
    }
  }, DLHO);
});

describe("rady dlaždíc hráčov", () => {
  it("pri voľbe cieľa (nástenka sa ukázala sama) ostanú zdroje", () => {
    expect(rezimRadov({ nastenkaKlikom: false, nastenkaNaStole: true, liniaStarsich: false })).toBeUndefined();
  });

  it("dlaždice špakov len po kliku na Špaky, kým nástenka leží na stole", () => {
    expect(rezimRadov({ nastenkaKlikom: true, nastenkaNaStole: true, liniaStarsich: false })).toBe("spaky");
    // Nástenka ustúpila (ťahanie, krok na staršom) — rady sa vrátia.
    expect(rezimRadov({ nastenkaKlikom: true, nastenkaNaStole: false, liniaStarsich: false })).toBeUndefined();
  });

  it("bar starších pri línii starších", () => {
    expect(rezimRadov({ nastenkaKlikom: false, nastenkaNaStole: false, liniaStarsich: true })).toBe("starsi");
  });
});
