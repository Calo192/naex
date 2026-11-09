// Pravidlá v11.16 (Michal 2026-11-09, Zrejúca): Vypiť len so zostávajúcim limitom, cigarety
// za pas bez ohľadu na karty v ruke, Degustátorka zníži súperov limit hneď a podloženie
// naprázdno hra ponúka. Očakávané hodnoty sú z textu PRAVIDLA.md (§6, §12, §13, §16).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameData, GameState, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import { ODPOVED_BEZ_POLDECI, VYPIT_BEZ_LIMITU, apply, evaluateLine, legalCommands, lineState, loadGameData, naTahu, opponentOf, planVykladania, ponukaPodlozenia, setupGame, tahBota } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
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

describe("§7 odpoveď na NA EX stojí plný poldeci (v11.16)", () => {
  /** Stavy partií botov, v ktorých niekto odpovedá na NA EX, s jeho odpoveďou. */
  function odpovede(seed: number): { readonly pred: GameState; readonly cmd: Command; readonly events: readonly Event[] }[] {
    let s = setupGame(data, seed, { lokalit: 3 });
    const out: { pred: GameState; cmd: Command; events: readonly Event[] }[] = [];
    for (let n = 0; n < 8000 && s.koniec === null; n++) {
      const kto = naTahu(s);
      if (kto === null) break;
      const cmd = tahBota(data, s, kto, seed * 7919 + n);
      const r = apply(data, s, cmd, kto);
      if (s.faza === "pitka" && s.pitkaStav?.reakcia != null && s.vizia === null) out.push({ pred: s, cmd, events: r.events });
      s = r.state;
    }
    return out;
  }
  const tahy = [3, 7, 8, 21].flatMap(odpovede);

  it("odpovedá len hráč s plným poldeci; odpoveď ho vypije — poldeci, pečeň +1, nerest", () => {
    expect(tahy.length).toBeGreaterThan(0);
    let kariet = 0;
    for (const t of tahy) {
      const q = t.pred.pitkaStav!.reakcia as PlayerId;
      expect(t.pred.hraci[q].poldeciPlne).toBeGreaterThanOrEqual(1);
      if (t.cmd.type !== "place") continue;
      kariet++;
      expect(t.events).toContainEqual({ type: "log", text: `Hráč ${q + 1} za odpoveď vypíja plný poldeci.` });
      expect(t.events).toContainEqual({ type: "pecen", hrac: q, mnozstvo: 1 });
    }
    expect(kariet).toBeGreaterThan(0);
  });

  it("bez plného poldeci server odpoveď odmietne; vynechať smie", () => {
    const t = tahy.find((x) => x.cmd.type === "place")!;
    const q = t.pred.pitkaStav!.reakcia as PlayerId;
    const bez = { ...t.pred, hraci: t.pred.hraci.map((h, i) => (i === q ? { ...h, poldeciPlne: 0 } : h)) as unknown as GameState["hraci"] };
    expect(() => apply(data, bez, t.cmd, q)).toThrow(ODPOVED_BEZ_POLDECI);
    expect(() => apply(data, bez, { type: "bezReakcie" }, q)).not.toThrow();
  });

  it("odpoveď z pohľadu: vypitý poldeci a nerest sa pripíšu hneď", () => {
    const t = tahy.find((x) => x.cmd.type === "place" && x.pred.pitkaStav?.frontaReakcii?.length)!;
    const q = t.pred.pitkaStav!.reakcia as PlayerId;
    const po = apply(data, t.pred, t.cmd, q).state;
    // Druhý ešte odpovedá — Pitka sa nevyhodnotila, zmenu vidno čistú.
    expect(po.pitkaStav?.reakcia).toBe(opponentOf(q));
    expect(po.hraci[q].poldeciPlne).toBe(t.pred.hraci[q].poldeciPlne - 1);
    expect(po.hraci[q].poldeciVypite).toBe(t.pred.hraci[q].poldeciVypite + 1);
    expect(po.hraci[q].nerestiTotoKolo).toBe(t.pred.hraci[q].nerestiTotoKolo + 1);
  });
});

describe("§6 Školiteľom aj Zviera, Mäsiar ho umlčí (v11.16)", () => {
  const R: Layout4 = ["Rana", "Rana", null, null];
  const sd = syntheticData([
    makeDef("ziak", R, R, { tags: ["Občan"] }),
    makeDef("skolitel_zviera", EMPTY, EMPTY, { tags: ["Zviera"], effectText: "Furt: Preškolenie {Rana}→{Pecka}." }),
    makeDef("skolitel_podpora", EMPTY, EMPTY, { tags: ["Zviera"], effectText: "Podpora: Preškolenie {Rana}→{Pecka}." }),
    makeDef("masiar", EMPTY, EMPTY, { tags: ["Občan"] }),
  ]);
  const akcieKarty = (line: LineState, uid: number): string[] => {
    const k = evaluateLine(sd, line).cards.get(uid);
    return [...(k?.left ?? []), ...(k?.right ?? [])].flatMap((x) => (x === null ? [] : [x.action]));
  };
  const linia = (strana: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [strana, []] });

  it("Zviera s Furt Preškolením preškolí suseda; vedľa Mäsiara nie", () => {
    const ziak = instanceFor(sd, "ziak", R, R);
    const zviera = instanceFor(sd, "skolitel_zviera", EMPTY, EMPTY);
    const masiar = instanceFor(sd, "masiar", EMPTY, EMPTY);
    expect(akcieKarty(linia([lezi(ziak, 0), lezi(zviera, 0)]), ziak.uid)).toEqual(["Pecka", "Pecka", "Pecka", "Pecka"]);
    expect(akcieKarty(linia([lezi(ziak, 0), lezi(zviera, 0), lezi(masiar, 1)]), ziak.uid)).toEqual(["Rana", "Rana", "Rana", "Rana"]);
  });

  it("preškolenie zapísané z Podpory Zvieraťa neplatí, kým Zviera leží pri Mäsiarovi", () => {
    const ziak = instanceFor(sd, "ziak", R, R);
    const zviera = instanceFor(sd, "skolitel_podpora", EMPTY, EMPTY);
    const masiar = instanceFor(sd, "masiar", EMPTY, EMPTY);
    const zapisane: PlacedCard = { card: ziak, playedBy: 0, preskolenia: [{ z: "Rana", na: "Pecka", od: zviera.uid, spustac: "Podpora" }] };
    expect(akcieKarty(linia([zapisane, lezi(zviera, 0)]), ziak.uid)).toContain("Pecka");
    expect(akcieKarty(linia([zapisane, lezi(zviera, 0), lezi(masiar, 1)]), ziak.uid)).not.toContain("Pecka");
  });
});

describe("§2 Pakt je akciou, ktorú kopíruje, pre všetky efekty (v11.16)", () => {
  /** Hráč 0: A (ľavá hrana) proti B (pravá hrana); Nástroje hráča 0 v Dedičstve. */
  function par(aLeft: Layout4, bRight: Layout4, nastroje: readonly string[], naexA = false) {
    const d = syntheticData([makeDef("a", aLeft, EMPTY), makeDef("b", EMPTY, bRight)]);
    const a = instanceFor(d, "a", aLeft, EMPTY);
    const b = instanceFor(d, "b", EMPTY, bRight);
    const l: LineState = { lokalita: null, lokalitaOtocena: false, strany: [[{ card: a, playedBy: 0, ...(naexA ? { naexBy: 1 as PlayerId } : {}) }, lezi(b, 0)], []], nastroje: [nastroje, []] };
    return evaluateLine(d, l);
  }

  it("Pakt spojený s Peckou je v súčtoch Pecka — „tvoje Pecky“ (Boxer, Vidly…) ho rátajú", () => {
    expect(par(["Pakt", null, null, null], ["Pecka", null, null, null], []).sums[0]).toEqual({ Pecka: 2 });
  });

  it("Telefón chráni pred NA EX aj Pakt, ktorý kopíruje Pohoršenie", () => {
    expect(par(["Pakt", null, null, null], ["Pohoršenie", null, null, null], [], true).sums[0].Pohoršenie).toBe(1);
    expect(par(["Pakt", null, null, null], ["Pohoršenie", null, null, null], ["telefon"], true).sums[0].Pohoršenie).toBe(2);
  });
});

describe("§12 Nástroj len pod vlastné karty (v11.16)", () => {
  it("pod súperovu kartu server odmietne a hra neponúkne; pod vlastnú áno", () => {
    const vidly = inst("vidly");
    const jeho = inst("pijan");
    const moj = inst("pijan");
    const s = vZhromazdeni(dataH, { ruka: [vidly], strany: [[lezi(moj, 0)], [lezi(jeho, 1)]] });
    const podSupera: Command = { type: "podloz", nastrojId: vidly.uid, hostitelId: jeho.uid, hrana: "horna" };
    expect(() => apply(dataH, s, podSupera, 0)).toThrow("Nástroj sa podkladá len pod vlastné karty.");
    const legal = legalCommands(dataH, s, 0).filter((c) => c.type === "podloz");
    expect(legal.length).toBeGreaterThan(0);
    for (const c of legal) expect(c.type === "podloz" && c.hostitelId).toBe(moj.uid);
    expect(ponukaPodlozenia(dataH, lineState(s), vidly, 0).every((m) => m.hostitel === moj.uid)).toBe(true);
    expect(ponukaPodlozenia(dataH, lineState(s), vidly, 1).every((m) => m.hostitel === jeho.uid)).toBe(true);
  });
});
