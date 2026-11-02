// Pravidlá v10.4 (Michal 2026-11-02, docs/napady/autority.html kolo 2 a odpor-vzbura-poc.html):
// Poľovník (Nástup: spáli súperovo Zviera), Predavačka (Kšeft: karta za cigaretu), Vedúcko
// (Furt: Roboty susedov ako Pecky), Policajtka (Pitka: pokutový blok za zrušené akcie),
// Profesionálny tipér ráta aj Forsáž. Karty v sade pridá či zmení admin — testy majú vlastné.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, LineState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import { KONSTANTY, apply, evaluateLine, legalCommands, loadGameData, pokutaPolicajtky, prirastkyPitky, sPrilozenou, setupGame, spalPolovnikom } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

/** Záznamy z autority.html (kolo 2) a Vedúcko podľa zadania Michala. */
const NOVE = [
  {
    id: "polovnik",
    index: 901,
    name: "Poľovník",
    tags: ["Občan", "Autorita", "Chlap", "Pamätník"],
    effect_text: "Nástup: Spáľ súperovo Zviera na druhej strane lokality, ktoré je od nej najďalej.",
    triggers: ["Nástup"],
    left: { blocked: [2], actions: { PoškodeniePečene: 1, Petelica: 1 }, allowed: { "0": ["PoškodeniePečene"], "1": ["PoškodeniePečene"], "3": ["Petelica"] } },
    right: { blocked: [1], actions: { Odpor: 1, Obmedzenie: 1 }, allowed: { "0": ["Odpor"], "2": ["Obmedzenie"], "3": ["Obmedzenie"] } },
    permutations: { total: 4, left: 2, right: 2 },
  },
  {
    id: "predavacka",
    index: 902,
    name: "Predavačka",
    tags: ["Občan", "Autorita", "Žena", "Pracujúci"],
    effect_text: "Kšeft: Za 1 cigaretu si dober 1 kartu.",
    triggers: ["Kšeft"],
    left: { blocked: [3], actions: { Dlh: 1, Robota: 1 }, allowed: { "0": ["Dlh"], "1": ["Dlh"], "2": ["Robota"] } },
    right: { blocked: [0, 1], actions: { Obmedzenie: 2 } },
    permutations: { total: 2, left: 2, right: 1 },
  },
];
const sada = cardsJson as { cards: { id: string }[] };
const data = loadGameData({ ...sada, cards: [...sada.cards.filter((c) => !NOVE.some((n) => n.id === c.id)), ...NOVE] }, eldersJson, scorecardsJson);

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const ids = (s: Pick<GameState, "strany">): string[][] => s.strany.map((x) => x.map((pl) => pl.card.defId));
const vsetkyKarty = (s: GameState): number[] =>
  [...s.hraci.flatMap((h) => [...h.ruka, ...h.doberaci, ...h.odhadzovaci, ...h.priznane, ...h.dedicstvo]), ...s.strany.flat().map((pl) => pl.card), ...s.senok].map((k) => k.uid);

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
}

/** Pitka na Zastávke, hráč 0 (obranca) na ťahu, obaja s balíčkom a cigaretami. */
function vPitke(strany: GameState["strany"]): GameState {
  const s0 = setupGame(data, 3);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, doberaci: [inst("masiar"), inst("vandal"), inst("hasic")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    senok: [inst("masiar"), inst("zamocnik"), inst("vandal")],
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 2,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(0),
  };
}

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s kartami `ruka`. */
function vZhromazdeni(strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s = vPitke(strany);
  return sHracom({ ...s, faza: "zhromazdenie", pitkaStav: null, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] } }, 0, { ruka });
}

describe("Poľovník (Nástup, v10.4)", () => {
  it("spáli súperovo Zviera na druhej strane, ktoré je od lokality najďalej — navždy z hry, medzera sa uzavrie", () => {
    const p = inst("polovnik");
    const kon = inst("kon");
    const pes = inst("pes");
    // Druhá strana: súperov Pes pri lokalite, súperov Vandal, súperov Kôň najďalej.
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(pes, 1), lezi(inst("vandal"), 1), lezi(kon, 1)]], [p]);
    const { state, events } = apply(data, s, { type: "place", uid: p.uid, target: "vlastna" }, 0);
    expect(ids(state)).toEqual([
      ["pijan", "polovnik"],
      ["pes", "vandal"],
    ]);
    expect(vsetkyKarty(state)).not.toContain(kon.uid);
    expect(events.some((e) => e.type === "log" && e.text === "Poľovník hráča 1 strieľa: Kôň hráča 2 sa spáli — navždy z hry.")).toBe(true);
  });

  it("vlastné Zvieratá nestrieľa; Recidivista je Zviera aj Občan; bez súperovho Zvieraťa sa nič nestane", () => {
    const strany = [[lezi(inst("pijan"), 0), lezi(inst("polovnik"), 0)], [lezi(inst("recidivista"), 1), lezi(inst("pes"), 0)]] as const;
    expect(spalPolovnikom(data, strany, 0, 0).spalena?.card.defId).toBe("recidivista");
    const bez = [[lezi(inst("polovnik"), 0)], [lezi(inst("vandal"), 1), lezi(inst("pes"), 0)]] as const;
    const r = spalPolovnikom(data, bez, 0, 0);
    expect(r.spalena).toBeNull();
    expect(r.strany).toBe(bez);
  });

  it("podstrčený na súperovu stranu strieľa súperove Zvieratá na mojej strane", () => {
    const p = inst("polovnik");
    const macka = inst("cierna_macka");
    const s = vZhromazdeni([[lezi(inst("pijan"), 0), lezi(macka, 1)], [lezi(inst("svokra"), 1)]], [p]);
    const st = apply(data, s, { type: "place", uid: p.uid, target: "superova" }, 0).state;
    expect(ids(st)).toEqual([["pijan"], ["svokra", "polovnik"]]);
    expect(vsetkyKarty(st)).not.toContain(macka.uid);
  });

  it("skrytú Záverečnú nestrieľa — spáli najvzdialenejšie z odkrytých", () => {
    const r = spalPolovnikom(data, [[lezi(inst("polovnik"), 0)], [lezi(inst("pes"), 1), lezi(inst("kon"), 1, { zaverecna: true })]], 0, 0);
    expect(r.spalena?.card.defId).toBe("pes");
    // Karta, ktorá sa otáča v tej istej chvíli ako Poľovník, je ešte skrytá.
    const kon = inst("kon");
    expect(spalPolovnikom(data, [[lezi(inst("polovnik"), 0)], [lezi(kon, 1)]], 0, 0, new Set([kon.uid])).spalena).toBeNull();
  });

  it("spálenie nie je priloženie: Konflikt súseda sa nespustí, Pasca ho neráta", () => {
    const p = inst("polovnik");
    // Policajtka hráča 2 leží vedľa Psa — po spálení Psa je koniec strany ona, nikto k nej nič nepriložil.
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(inst("policajtka"), 1), lezi(inst("pes"), 1)]], [p]);
    const st = apply(data, s, { type: "place", uid: p.uid, target: "vlastna" }, 0).state;
    expect(ids(st)[1]).toEqual(["policajtka"]);
    expect(st.hraci[0].dlhy).toBe(s.hraci[0].dlhy);
    expect(st.prilozeniaKu ?? [0, 0]).toEqual(s.prilozeniaKu ?? [0, 0]);
  });

  it("poldeci z NA EX na spálenej karte sa vypije tomu, kto NA EX dal", () => {
    const p = inst("polovnik");
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(inst("recidivista"), 1, { naexBy: 0 })]], [p]);
    const st = apply(data, s, { type: "place", uid: p.uid, target: "vlastna" }, 0).state;
    expect(ids(st)[1]).toEqual([]);
    expect(st.hraci[0].poldeciVypite).toBe(s.hraci[0].poldeciVypite + 1);
    expect(st.hraci[0].nerestiTotoKolo).toBe(s.hraci[0].nerestiTotoKolo + KONSTANTY.NEREST_NAEX);
  });

  it("ako Záverečná strieľa pri otočení na konci Pitky", () => {
    const p = inst("polovnik");
    const pes = inst("pes");
    let s = vPitke([[lezi(inst("pijan"), 0), lezi(p, 0, { zaverecna: true })], [lezi(inst("svokra"), 1), lezi(pes, 1)]]);
    for (let i = 0; i < 6 && s.faza === "pitka" && s.vizia === null; i++) {
      const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).some((c) => c.type === "skipNaex"));
      if (q === undefined) break;
      s = apply(data, s, { type: "skipNaex" }, q).state;
    }
    expect(s.strany[1].map((pl) => pl.card.uid)).not.toContain(pes.uid);
    expect(vsetkyKarty(s)).not.toContain(pes.uid);
  });

  it("náhľad a bot (sPrilozenou) ukážu to isté spálenie ako motor", () => {
    const p = inst("polovnik");
    const s = vZhromazdeni([[lezi(inst("pijan"), 0)], [lezi(inst("pes"), 1), lezi(inst("krokodil"), 1)]], [p]);
    expect(ids(sPrilozenou(data, s, 0, p, 0))).toEqual(ids(apply(data, s, { type: "place", uid: p.uid, target: "vlastna" }, 0).state));
  });
});

describe("Predavačka (Kšeft, v10.4)", () => {
  it("za 1 cigaretu si hráč doberie 1 kartu, raz za Pitku; platba nie je nerest", () => {
    const pr = inst("predavacka");
    const s = sHracom(vPitke([[lezi(pr, 0)], []]), 0, { cigarety: 2 });
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "kseft", uid: pr.uid });
    const po = apply(data, s, { type: "kseft", uid: pr.uid }, 0).state;
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.hraci[0].ruka).toHaveLength(s.hraci[0].ruka.length + 1);
    expect(po.hraci[0].doberaci).toHaveLength(s.hraci[0].doberaci.length - 1);
    expect(po.hraci[0].nerestiTotoKolo).toBe(s.hraci[0].nerestiTotoKolo);
    expect(legalCommands(data, po, 0).some((c) => c.type === "kseft" && c.uid === pr.uid)).toBe(false);
  });

  it("bez cigarety alebo bez kariet v balíčkoch sa neponúka; súperova Predavačka nie", () => {
    const pr = inst("predavacka");
    const bezCig = sHracom(vPitke([[lezi(pr, 0)], []]), 0, { cigarety: 0 });
    expect(legalCommands(data, bezCig, 0).some((c) => c.type === "kseft")).toBe(false);
    const bezKariet = sHracom(vPitke([[lezi(pr, 0)], []]), 0, { doberaci: [], odhadzovaci: [] });
    expect(legalCommands(data, bezKariet, 0).some((c) => c.type === "kseft")).toBe(false);
    const superova = vPitke([[lezi(pr, 1)], []]);
    expect(legalCommands(data, superova, 0).some((c) => c.type === "kseft")).toBe(false);
  });
});

/** Partia hráča 0 bez lokality: [A, B] sa vyhodnotí ako B · A (B.pravá ↔ A.ľavá). */
const linia = (...cards: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [cards, []] });

describe("Vedúcko (Furt, v10.4)", () => {
  // Súperova karta na strane hráča 0 je otočená — efektívna ľavá je jej pravá odzadu, preto rovnaké Roboty.
  const A_L: Layout4 = ["Robota", "Robota", null, null];
  const A_R: Layout4 = [null, null, "Robota", "Robota"];
  const V_R: Layout4 = ["Cigareta", "Posilnenie", null, null];
  const zostav = (vId: string) => {
    const d = syntheticData([makeDef("a", A_L, A_R), makeDef(vId, EMPTY, V_R)]);
    return { d, a: instanceFor(d, "a", A_L, A_R), v: instanceFor(d, vId, EMPTY, V_R) };
  };

  it("aktívne Roboty susednej karty sú Pecky jej majiteľa (aj súperovej) — posilnená ×2; bez Vedúcka Roboty", () => {
    const { d, a, v } = zostav("veducko");
    // V.pravá ↔ A.ľavá: Robota proti Cigarete ×1, Robota proti Posilneniu ×2.
    const moja = evaluateLine(d, linia(lezi(a, 0), lezi(v, 0)));
    expect(moja.sums[0]).toEqual({ Pecka: 3, Cigareta: 1 });
    expect(moja.zdroje[0].Pecka?.map((z) => z.dovody)).toContainEqual(["Posilnenie", "karta:veducko"]);
    const superova = evaluateLine(d, linia(lezi(a, 1), lezi(v, 0)));
    expect(superova.sums[1]).toEqual({ Pecka: 3 });
    const bez = zostav("niekto");
    expect(evaluateLine(bez.d, linia(lezi(bez.a, 0), lezi(bez.v, 0))).sums[0]).toEqual({ Robota: 3, Cigareta: 1 });
  });
});

describe("Policajtka — pokutový blok (Pitka, v10.4)", () => {
  // Policajtka hráča 0 s Odporom proti súperovej Pecke a Rane; súperova karta otočená k nemu.
  const P_R: Layout4 = ["Odpor", "Odpor", null, null];
  // Súperova karta na strane hráča 0 je otočená: efektívna ľavá = vytlačená pravá odzadu (Pecka, Rana).
  const S_R: Layout4 = [null, null, "Rana", "Pecka"];
  const zostav = (trigger: "Pitka" | "Konflikt") => {
    const d = syntheticData([makeDef("policajtka", EMPTY, P_R, { tags: ["Občan", "Autorita", "Žena"], triggers: [trigger] }), makeDef("s", EMPTY, S_R)]);
    return { d, pol: instanceFor(d, "policajtka", EMPTY, P_R), s: instanceFor(d, "s", EMPTY, S_R) };
  };

  it("za každú súperovu akciu zrušenú tvojím Odporom získa súper 1 zadĺženie", () => {
    const { d, pol, s } = zostav("Pitka");
    const line = linia(lezi(s, 1), lezi(pol, 0));
    const ev = evaluateLine(d, line);
    expect(ev.zruseneOdporom).toEqual([2, 0]);
    expect(pokutaPolicajtky(d, line, ev)).toEqual([0, 2]);
    const stav = { ciel: null, strany: line.strany, starsi: [], hraci: [{ priznane: [], dlhy: 0, dedicstvo: [], abstaky: 0 }, { priznane: [], dlhy: 0, dedicstvo: [], abstaky: 0 }], lokalitaOtocena: false } as const;
    expect(prirastkyPitky(d, stav, ev).zadlzenie).toEqual([0, 2]);
  });

  it("Policajtka so starým Konfliktom (sada do v10.3) pokutu nedáva", () => {
    const { d, pol, s } = zostav("Konflikt");
    const line = linia(lezi(s, 1), lezi(pol, 0));
    expect(pokutaPolicajtky(d, line, evaluateLine(d, line))).toEqual([0, 0]);
  });
});

describe("Profesionálny tipér ráta aj Forsáž (v10.4)", () => {
  it("akcie spoja s Forsážou sú pre jeho majiteľa posilnená Robota", () => {
    const T_R: Layout4 = ["Posilnenie", "Pecka", null, null];
    const A_L: Layout4 = ["Posilnenie", "Rana", null, null];
    const d: GameData = syntheticData([makeDef("profesionalny_tiper", EMPTY, T_R), makeDef("a", A_L, EMPTY)]);
    const t = instanceFor(d, "profesionalny_tiper", EMPTY, T_R);
    const a = instanceFor(d, "a", A_L, EMPTY);
    expect(evaluateLine(d, linia(lezi(a, 0), lezi(t, 0))).sums[0]).toEqual({ Robota: 4 });
    // Bez Tipéra je to Forsáž: Pecka aj Rana ×2.
    const d2 = syntheticData([makeDef("x", EMPTY, T_R), makeDef("a", A_L, EMPTY)]);
    expect(evaluateLine(d2, linia(lezi(instanceFor(d2, "a", A_L, EMPTY), 0), lezi(instanceFor(d2, "x", EMPTY, T_R), 0))).sums[0]).toEqual({ Pecka: 2, Rana: 2 });
  });
});
