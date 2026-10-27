// Finále v7 na pinnacle lokalite (PRAVIDLA §14b): hrá sa ako každé kolo — lokalita
// leží v strede línie, karty sa kladú k nej, platia jej hrany a efekt. Hlásenie
// Michala 2026-10-27: vo finále chýbala lokalita v strede (klient kreslil stred
// finále v6), náhľady rátali s líniou bez lokality a nástenka finále nespoznala.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import {
  apply,
  evaluateLine,
  jeFinaleNaNastenke,

  legalCommands,
  lineState,
  loadGameData,
  nahladVylozenia,
  najhorsiaOdpoved,
  setupGame,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 990000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
}

/** Pitka finále na pinnacle `lok` (obranca = hráč 0 na ťahu), alebo to isté ako bežné kolo. */
function vPitkeFinale(lok: string, strany: GameState["strany"], typ: "finale" | "lokalita" = "finale"): GameState {
  const s0 = setupGame(data, 4);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok)!;
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, ruka: [inst("masiar"), inst("vandal")], doberaci: [inst("masiar"), inst("vandal"), inst("hasic")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    kolo: typ === "finale" ? s0.lokalitCelkom + 1 : s0.lokalitCelkom,
    senok: [inst("masiar"), inst("zamocnik")],
    faza: "pitka",
    utocnik: 1,
    ciel: { typ, lokalita },
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(0),
  };
}

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

/** Dohrá kolo prvými „pokojnými“ ťahmi až po koniec hry. */
function dohraj(s0: GameState): { s: GameState; logy: string[] } {
  let s = s0;
  const logy: string[] = [];
  for (let i = 0; i < 400 && s.koniec === null; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).length > 0);
    if (q === undefined) break;
    const legal = legalCommands(data, s, q);
    const cmd =
      legal.find((c) => c.type === "skipNaex") ??
      legal.find((c) => c.type === "pass") ??
      legal.find((c) => c.type === "bezReakcie") ??
      legal.find((c) => c.type === "vizia" && c.vziat) ??
      legal.find((c) => c.type === "zahradkar" && !c.zahodit) ??
      (legal[0] as Command);
    const r = apply(data, s, cmd, q);
    for (const e of r.events) if (e.type === "log") logy.push(e.text);
    s = r.state;
  }
  return { s, logy };
}

describe("finále na pinnacle lokalite sa hrá ako bežné kolo (Michal 2026-10-27)", () => {
  it("línia finále má lokalitu v strede — bez príznaku finále bez lokality", () => {
    const s = vPitkeFinale("herna", [[], []]);
    expect(lineState(s).lokalita?.defId).toBe("herna");
    expect(lineState(s).finale).toBeUndefined();
    expect(lineState({ ...s, ciel: { typ: "finale", lokalita: null } }).finale).toBe(true);
    const v = viewFor(data, s, 0);
    expect(v.stredFinale).toBeNull();
    expect(evaluateLine(data, lineState(v))).toEqual(evaluateLine(data, lineState({ ...v, ciel: { typ: "lokalita", lokalita: v.ciel!.lokalita! } })));
  });

  it("náhľad vyloženia ráta tuhé navyše z lokality aj vo finále (Traktoristka s prevahou pri pinnacle)", () => {
    const s = vPitkeFinale("polovnicka_chata", [[], []]);
    const trakt = inst("traktoristka");
    const finale = nahladVylozenia(data, lineState(s), 0, trakt, "vlastna");
    const bezne = nahladVylozenia(data, lineState({ ...s, ciel: { typ: "lokalita", lokalita: s.ciel!.lokalita! } }), 0, trakt, "vlastna");
    expect(finale.tuhe[0]).toBe(2);
    expect(finale).toEqual(bezne);
  });

  it("najhoršia odpoveď na NA EX: prázdna strana sa prikladá k lokalite, nie k súperovej prvej karte", () => {
    // Súperova jediná karta je posledná (Hrobár) — za ňu sa nepriloží, k pinnacle na mojej strane áno.
    const strany: GameState["strany"] = [[], [lezi(inst("masiar"), 1, { posledna: true })]];
    const finale = viewFor(data, vPitkeFinale("herna", strany), 0);
    const bezne = viewFor(data, vPitkeFinale("herna", strany, "lokalita"), 0);
    const o = najhorsiaOdpoved(data, finale, 0, [0, 0]);
    expect(o).not.toBeNull();
    expect(o?.strana).toBe(0);
    expect(o).toEqual(najhorsiaOdpoved(data, bezne, 0, [0, 0]));
  });

  it("nástenka označí finále aj s lokalitou; log píše zvlášť 1 špak za Pitku a Herňu za Dlhy porazeného", () => {
    const silna = (n: number): PlacedCard[] => Array.from({ length: n }, () => lezi(inst("kulturista"), 1));
    const s = sHracom(vPitkeFinale("herna", [[lezi(inst("zamocnik"), 0)], silna(3)]), 0, { priznane: [inst("dlh"), inst("dlh")] });
    const { s: po, logy } = dohraj(s);
    expect(po.koniec).not.toBeNull();
    const b = po.nastenka.at(-1)!;
    expect(b.lokalita?.defId).toBe("herna");
    expect(b.finale).toBe(true);
    expect(jeFinaleNaNastenke(b)).toBe(true);
    expect(po.nastenka.slice(0, -1).some((x) => jeFinaleNaNastenke(x))).toBe(false);
    expect(b.vitaz).toBe(1);
    const dlhy = po.hraci[0].priznane.filter((k) => k.defId === "dlh").length;
    expect(b.zaBitku[1]).toBe(b.pitky + dlhy);
    const vyhra = logy.find((t) => t.startsWith("Bitku"))!;
    expect(vyhra).toContain("1 špak za Pitku");
    if (dlhy > 0) expect(vyhra).toContain(`+${dlhy} za Dlhy porazeného (Herňa`);
    // Staré záznamy: finále bez lokality, bez príznaku.
    expect(jeFinaleNaNastenke({ lokalita: null })).toBe(true);
  });
});
