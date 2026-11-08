// Šarlatán a zadĺženie (názor #142, Paragrafista Vilo, v8.4): „Hazard sa ráta ako Viera, ale
// zadĺženie sa pripíše aj tak.“ Jadro premenu uplatňuje aj v Pitke — Hazard premenený Konfliktom
// zadĺženie nedáva (§16). Výnimkou je len načasovanie: Záverečná vyvolá Konflikt až pri otočení
// na konci Pitky (§7 krok 8, §13), teda po kroku 2 (Dlh) — v tej Pitke sa Hazard ešte ráta ako
// Hazard a Viera z neho je až v bitke. To sedí s hlásením (výhľad Pitky ukázal zadĺženie „pred
// odkrytím“, log ohlásil Konflikt, v bitke Viera).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PitkaStav, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, buildGameData, evaluateLine, legalCommands, lineState, loadGameData, parseScorecards, setupGame } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

// Akcie Šarlatána a Mäsiara sú syntetické (sada sa mení): Šarlatán hráča 1 pri Zastávke má
// aktívnu Poveru (proti hrane Pecka) a neaktívny Hazard na vonkajšej strane; Mäsiar je bez akcií.
const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const SAR_L = ["Dlh", null, null, null] as const;
const SAR_R = [null, null, null, "Povera"] as const;
const data = buildGameData(
  new Map([
    ...zaklad.cards,
    ["sarlatan", makeDef("sarlatan", SAR_L, SAR_R, { tags: ["Občan", "Influencer", "Chlap"], triggers: ["Konflikt"] })],
    ["masiar", makeDef("masiar", EMPTY, EMPTY, { tags: ["Občan", "Pracujúci", "Chlap"], triggers: ["Furt"] })],
  ]),
  zaklad.elders,
  { scorecards: zaklad.scorecards, body: parseScorecards(scorecardsJson).body },
);

let uidSeq = 990000;
const inst = (defId: string): CardInstance =>
  defId === "sarlatan" ? instanceFor(data, defId, SAR_L, SAR_R) : defId === "masiar" ? instanceFor(data, defId, EMPTY, EMPTY) : { uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 };
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Pitka na Zastávke, Šarlatán hráča 1 sám na jeho strane; obaja majú v ruke Mäsiara. */
function sSarlatanom(naTahuPitky: PlayerId): { readonly s: GameState; readonly sar: CardInstance } {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const sar = inst("sarlatan");
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, zadlzenie: 0, dlhy: 0, ruka: [inst("masiar")], doberaci: [inst("vandal"), inst("hasic")] })) as unknown as GameState["hraci"];
  const s: GameState = {
    ...s0,
    hraci,
    senok: [inst("masiar"), inst("zamocnik"), inst("vandal")],
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany: [[], [lezi(sar, 1)]],
    pitkyCelkom: 1,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(naTahuPitky),
  };
  return { s, sar };
}

/** Dohrá Pitku: `vyber` smie zvoliť ťah, inak sa preskakuje (NA EX, odpoveď, pas, šenok). */
/** Dlhy hráča 1 z vyhodnotení Pitiek posledného dohrajPitku (bitka po nej ich môže exekúciou spáliť). */
let dlhyZPitky1 = 0;
function dohrajPitku(s: GameState, vyber: (cmds: readonly Command[], q: PlayerId) => Command | undefined = () => undefined): GameState {
  let t = s;
  dlhyZPitky1 = 0;
  for (let i = 0; i < 20 && t.faza === "pitka"; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).length > 0);
    if (q === undefined) break;
    const cmds = legalCommands(data, t, q);
    const c = vyber(cmds, q) ?? cmds.find((c) => c.type === "skipNaex" || c.type === "bezReakcie" || c.type === "pass") ?? cmds[0]!;
    const r = apply(data, t, c, q);
    for (const e of r.events) if (e.type === "pitkaVysledok") dlhyZPitky1 += e.dlhy[1];
    t = r.state;
  }
  return t;
}

/** Zadĺženie hráča 1 z Pitky (prah 1: každé je Dlh). */
const zadlzenieHraca1 = (t: GameState): number => dlhyZPitky1 + t.hraci[1].zadlzenie;

describe("§16 Šarlatán: Hazard premenený Konfliktom nedáva zadĺženie", () => {
  it("odpoveď na NA EX vyvolá Konflikt pred vyhodnotením Pitky — Hazard ×2 je Viera, zadĺženie 0", () => {
    const { s, sar } = sSarlatanom(1);
    const poNaex = apply(data, s, { type: "naex", uid: sar.uid }, 1).state;
    const t = dohrajPitku(poNaex, (cmds, q) => (q === 0 ? cmds.find((c) => c.type === "place" && c.target === "superova") : undefined));
    expect(t.strany[1].find((pl) => pl.card.uid === sar.uid)?.premena).toBe("sarlatan");
    expect(zadlzenieHraca1(t)).toBe(0);
    expect((evaluateLine(data, lineState(t)).zdroje[1].Viera ?? []).some((z) => z.uid === sar.uid)).toBe(true);
  });

  it("kontrola: odpoveď do vlastnej strany Konflikt nevyvolá — Hazard ×2 dá zadĺženie 2", () => {
    const { s, sar } = sSarlatanom(1);
    const poNaex = apply(data, s, { type: "naex", uid: sar.uid }, 1).state;
    const t = dohrajPitku(poNaex, (cmds, q) => (q === 0 ? cmds.find((c) => c.type === "place" && c.target === "vlastna") : undefined));
    expect(t.strany[1].find((pl) => pl.card.uid === sar.uid)?.premena).toBeUndefined();
    expect(zadlzenieHraca1(t)).toBe(2);
    expect(t.hraci[1].zadlzenie).toBe(0);
  });

  it("Záverečná vyvolá Konflikt až po vyhodnotení Pitky — v nej sa Hazard ešte ráta, v bitke už Viera", () => {
    const { s: pitka, sar } = sSarlatanom(0);
    // Zhromaždenie pred Pitkou: hráč 0 dá Mäsiara ako Záverečnú za Šarlatána, NA EX na Šarlatána
    // dá potom v Pitke (aktivuje jeho neaktívne Hazardy ×2).
    const s: GameState = { ...pitka, faza: "zhromazdenie", pitkaStav: null, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } };
    let t = apply(data, s, { type: "zaverecna", uid: s.hraci[0].ruka[0]!.uid, target: "superova" }, 0).state;
    t = apply(data, t, { type: "pass" }, 1).state;
    expect(t.faza).toBe("pitka");
    expect(t.strany[1].find((pl) => pl.card.uid === sar.uid)?.premena).toBeUndefined();
    // Bitka v11 nečaká pred exekúciou (hádka sa rozdeľuje až po bodovaní) — Dlh z Pitky je v jej účte.
    const dlhyZPitky: number[] = [];
    for (let i = 0; i < 20 && t.faza === "pitka"; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, t, x).length > 0);
      if (q === undefined) break;
      const cmds = legalCommands(data, t, q);
      const c = (q === 0 ? cmds.find((c) => c.type === "naex" && c.uid === sar.uid) : undefined) ?? cmds.find((c) => c.type === "skipNaex" || c.type === "bezReakcie" || c.type === "pass") ?? cmds[0]!;
      const r = apply(data, t, c, q);
      for (const e of r.events) if (e.type === "pitkaVysledok") dlhyZPitky.push(e.dlhy[1]);
      t = r.state;
    }
    expect(dlhyZPitky.reduce((a, b) => a + b, 0)).toBe(2);
    // Po otočení Záverečnej platí premena do konca kola — bitka ráta Hazard ako Vieru.
    expect(t.strany[1].find((pl) => pl.card.uid === sar.uid)?.premena).toBe("sarlatan");
    const zdroje = evaluateLine(data, lineState(t)).zdroje[1];
    expect((zdroje.Dlh ?? []).some((z) => z.uid === sar.uid)).toBe(false);
    expect((zdroje.Viera ?? []).some((z) => z.uid === sar.uid)).toBe(true);
  });
});
