// v11.10 (Michal 2026-11-06): priazeň Ohováračka namiesto Alkoholika — „viera a povery sa
// navzájom rušia, ako by boli normálne na akcii karty.“

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BattleSide, Favour, GameState, PlayerId } from "../src/index.ts";
import { ALL_FAVOURS, computeDamage, favourStarsieho, loadGameData, priazenZKluca, rozpisPoskodenia, silaPriazne, vysledokHadky } from "../src/index.ts";
import { setupSBalickom, zPolohy } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function strana(uprava: Partial<BattleSide>): BattleSide {
  return { sums: {}, cirhozaBonus: 0, tuheBonus: 0, abstaky: 0, priazenBitkara: 0, hodnotaViery: 1, ...uprava };
}

function sPriaznou(s: GameState, favour: Favour, p: PlayerId, sila: 1 | 2 | 3): GameState {
  const marker = p === 0 ? 3 - sila : 3 + sila;
  return { ...s, starsi: s.starsi.map((e) => (favourStarsieho(data, e) === favour ? { ...e, ...zPolohy(marker) } : e)) };
}

describe("Ohováračka: výpočet hádky (§9.1)", () => {
  it("sila 1 / 2 / 3 pridá toľko Povier, teda toľko mäkkého", () => {
    for (const sila of [1, 2, 3]) {
      const d = computeDamage([strana({ poveryOhovaracky: sila }), strana({})]);
      expect(d.zvysnaPovera[0]).toBe(sila);
      expect(d.makke[0]).toBe(sila);
      expect(vysledokHadky(d.makke)).toEqual({ vitaz: 0, velkost: sila });
    }
  });

  it("sčíta sa s Poverami z akcií kariet", () => {
    const d = computeDamage([strana({ sums: { Povera: 2 }, poveryOhovaracky: 1 }), strana({})]);
    expect(d.zvysnaPovera[0]).toBe(3);
  });

  it("súperova Viera z karty ruší jej Povery 1 : 1 a na tuhé sa už nepoužije", () => {
    const d = computeDamage([strana({ sums: { Rana: 5 }, poveryOhovaracky: 2 }), strana({ sums: { Viera: 3 } })]);
    expect(d.zrusenePovery?.[0]).toBe(2);
    expect(d.vieraNaPovery?.[1]).toBe(2);
    expect(d.zvysnaPovera[0]).toBe(0);
    expect(d.makke[0]).toBe(0);
    expect(d.zvysnaViera[1]).toBe(1);
    expect(d.tuhe[0]).toBe(4);
  });

  it("súperova Viera z Veriaceho ich ruší rovnako", () => {
    const d = computeDamage([strana({ poveryOhovaracky: 2 }), strana({ vieraVeriacehoPred: 1 })]);
    expect(d.zrusenePovery?.[0]).toBe(1);
    expect(d.zvysnaPovera[0]).toBe(1);
  });

  it("Ohováračkina Povera zruší vlastnú Vieru rovnako ako súperovu Poveru z karty", () => {
    const zOhovaracky = computeDamage([strana({ sums: { Viera: 1 } }), strana({ poveryOhovaracky: 1 })]);
    const zKarty = computeDamage([strana({ sums: { Viera: 1 } }), strana({ sums: { Povera: 1 } })]);
    expect(zOhovaracky).toEqual({ ...zKarty });
  });

  it("Horoskop jej Povere dá silu 2, Čierna mačka ju chráni pred Vierou", () => {
    const horoskop = computeDamage([strana({ poveryOhovaracky: 2, silaPovery: 2 }), strana({ sums: { Viera: 1 } })]);
    expect(horoskop.zvysnaPovera[0]).toBe(1);
    expect(horoskop.makke[0]).toBe(2);
    const macka = computeDamage([strana({ poveryOhovaracky: 2, poveryBezViery: true }), strana({ sums: { Viera: 2 } })]);
    expect(macka.zvysnaPovera[0]).toBe(2);
    expect(macka.zvysnaViera[1]).toBe(2);
  });
});

describe("Ohováračka v hre (§10)", () => {
  it("priazeň prejde do rozpisu bitky a Veriaci súpera z nej uberie", () => {
    let s = setupSBalickom(data, 94);
    s = sPriaznou(s, "OHOVARACKA", 0, 2);
    expect(silaPriazne(data, s, "OHOVARACKA", 0)).toBe(2);
    const bezViery = rozpisPoskodenia(data, s, [{}, {}]);
    expect(bezViery[0].poveryOhovaracky).toBe(2);
    expect(bezViery[0].zvysnaPovera).toBe(2);
    expect(bezViery[1].poveryOhovaracky).toBe(0);
    s = sPriaznou(s, "VERIACI", 1, 1);
    const sVierou = rozpisPoskodenia(data, s, [{}, {}]);
    expect(sVierou[0].zrusenaPovera).toBe(1);
    expect(sVierou[0].zvysnaPovera).toBe(1);
  });

  it("stará sada s Alkoholikom sa načíta ako Ohováračka a Alkoholik v hre nie je", () => {
    expect(priazenZKluca("ALKOHOLIK")).toBe("OHOVARACKA");
    expect(priazenZKluca("OHOVARACKA")).toBe("OHOVARACKA");
    expect(ALL_FAVOURS as readonly string[]).not.toContain("ALKOHOLIK");
    expect(data.scorecards.filter((sc) => sc.favour === "OHOVARACKA")).toHaveLength(1);
  });
});
