// Pravidlá v11.16 (Michal 2026-11-09, Zrejúca): Vypiť len so zostávajúcim limitom, cigarety
// za pas bez ohľadu na karty v ruke, Degustátorka zníži súperov limit hneď a podloženie
// naprázdno hra ponúka. Očakávané hodnoty sú z textu PRAVIDLA.md (§6, §12, §13, §16).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { VYPIT_BEZ_LIMITU, apply, legalCommands, loadGameData, planVykladania, setupGame, tahBota } from "../src/index.ts";
import { dataSHranami } from "./naradieData.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const dataH = dataSHranami();

let uidSeq = 916000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s rukou `ruka`, zostávajúci limit `limit`. */
function vZhromazdeni(
  d: GameData,
  o: { ruka: CardInstance[]; limit?: readonly [number, number]; plne?: readonly [number, number]; strany?: GameState["strany"]; cigarety?: number },
): GameState {
  const s0 = setupGame(d, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const plne = o.plne ?? [2, 2];
  const hraci = s0.hraci.map((h, i) => ({
    ...h,
    cigarety: o.cigarety ?? 5,
    poldeciPlne: plne[i],
    poldeciVypite: 0,
    doberaci: [inst("masiar"), inst("pijan")],
    ...(i === 0 ? { ruka: o.ruka } : {}),
  })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany: o.strany ?? [[], []],
    pitkaStav: null,
    pitkaCislo: 0,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [...(o.limit ?? [3, 3])] as [number, number], pasoval: [false, false], navyse: [0, 0] },
  };
}

describe("§13 Vypiť len so zostávajúcim limitom (v11.16)", () => {
  it("pri limite 0 server Vypiť odmietne a hra ho neponúkne; pri limite 1 smie a limit klesne na 0", () => {
    const nula = vZhromazdeni(data, { ruka: [inst("pijan"), inst("masiar")], limit: [0, 3] });
    expect(() => apply(data, nula, { type: "vypit" }, 0)).toThrow(VYPIT_BEZ_LIMITU);
    expect(legalCommands(data, nula, 0).some((c) => c.type === "vypit")).toBe(false);

    const jeden = vZhromazdeni(data, { ruka: [inst("pijan"), inst("masiar")], limit: [1, 3] });
    expect(legalCommands(data, jeden, 0).some((c) => c.type === "vypit")).toBe(true);
    const po = apply(data, jeden, { type: "vypit" }, 0).state;
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(0);
    expect(po.hraci[0].poldeciPlne).toBe(1);
    // Druhé vypitie pri limite 0 už nie — predtým by bolo len kúpou neresti.
    expect(legalCommands(data, po, 0).some((c) => c.type === "vypit")).toBe(false);
  });

  it("plán ťahu (klient aj príkaz tah) odmietne Vypiť pri limite 0", () => {
    const s = vZhromazdeni(data, { ruka: [inst("pijan"), inst("masiar")], limit: [0, 3] });
    const [a, b] = s.hraci[0].ruka as [CardInstance, CardInstance];
    const plan = planVykladania(data, s, 0, 0, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "vlastna" },
    ]);
    expect(plan.chyba).toBe(VYPIT_BEZ_LIMITU);
    // Pri limite 3 tie isté dve karty prejdú: Vypiť, karta, karta.
    const ok = planVykladania(data, s, 0, 3, [
      { karta: a, ciel: "vlastna" },
      { karta: b, ciel: "vlastna" },
    ]);
    expect(ok.chyba).toBeNull();
    expect(ok.kroky.map((k) => k.type)).toEqual(["vypit", "place", "place"]);
  });
});

describe("§6 pas bez ohľadu na karty v ruke (v11.16)", () => {
  it("limit 3, jedna karta vyložená, ruka prázdna — pas dá 2 cigarety", () => {
    const pijan = inst("pijan");
    let s = vZhromazdeni(data, { ruka: [pijan], limit: [3, 3] });
    const cig = s.hraci[0].cigarety;
    s = apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, 0).state;
    expect(s.hraci[0].ruka).toEqual([]);
    expect(s.zhromazdenieStav?.zostavaLimit[0]).toBe(2);
    // Súper pasuje; hráč 0 s prázdnou rukou nemá čo vyložiť — pasuje za neho hra.
    s = apply(data, s, { type: "pass" }, 1).state;
    expect(s.hraci[0].cigarety).toBe(cig + 2);
  });
});

describe("§16 Degustátorka zníži súperov limit hneď (v11.16)", () => {
  it("súper s viac plnými poldeci: plný poldeci je vypitý a jeho zostávajúci limit hneď klesne o 1", () => {
    const deg = inst("degustatorka");
    const s = vZhromazdeni(data, { ruka: [deg, inst("pijan")], limit: [3, 3], plne: [0, 2] });
    const po = apply(data, s, { type: "place", uid: deg.uid, target: "vlastna" }, 0).state;
    expect(po.hraci[1].poldeciPlne).toBe(1);
    expect(po.hraci[1].poldeciVypite).toBe(1);
    expect(po.zhromazdenieStav?.zostavaLimit[1]).toBe(2);
    // Majiteľovi Degustátorka limit minie ako každé vyloženie.
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(2);
  });

  it("súperov limit neklesne pod 0; bez viac plných poldeci sa nič nemení", () => {
    const deg = inst("degustatorka");
    const vycerpany = apply(data, vZhromazdeni(data, { ruka: [deg, inst("pijan")], limit: [3, 0], plne: [0, 2] }), { type: "place", uid: deg.uid, target: "vlastna" }, 0).state;
    expect(vycerpany.zhromazdenieStav?.zostavaLimit[1]).toBe(0);
    expect(vycerpany.hraci[1].poldeciPlne).toBe(1);

    const deg2 = inst("degustatorka");
    const rovnako = apply(data, vZhromazdeni(data, { ruka: [deg2, inst("pijan")], limit: [3, 3], plne: [2, 2] }), { type: "place", uid: deg2.uid, target: "vlastna" }, 0).state;
    expect(rovnako.zhromazdenieStav?.zostavaLimit[1]).toBe(3);
    expect(rovnako.hraci[1].poldeciPlne).toBe(2);
  });
});

describe("§12 podloženie naprázdno hra ponúka (v11.16)", () => {
  it("Puška pod Mäsiara: hrana Petelica nič nezmení, no legalCommands ju ponúkne a server ju prijme", () => {
    const puska = inst("puska");
    const masiar = inst("masiar");
    const s = vZhromazdeni(dataH, { ruka: [puska], strany: [[lezi(masiar, 0)], []] });
    const naprazdno: Command = { type: "podloz", nastrojId: puska.uid, hostitelId: masiar.uid, hrana: "horna" };
    const legal = legalCommands(dataH, s, 0);
    expect(legal).toContainEqual(naprazdno);
    expect(legal).toContainEqual({ ...naprazdno, hrana: "dolna" });
    const po = apply(dataH, s, naprazdno, 0).state;
    expect(po.strany[0][0]?.podlozene).toEqual([{ card: puska, majitel: 0, hrana: "horna" }]);
    expect(po.hraci[0].cigarety).toBe(4);
  });

  it("bot podloženie naprázdno nevyberie", () => {
    const puska = inst("puska");
    const masiar = inst("masiar");
    const s = vZhromazdeni(dataH, { ruka: [puska], strany: [[lezi(masiar, 0)], []] });
    for (const seed of [1, 2, 3]) {
      const cmd = tahBota(dataH, s, 0, seed);
      expect(cmd.type === "podloz" && cmd.hrana === "horna").toBe(false);
    }
  });
});
