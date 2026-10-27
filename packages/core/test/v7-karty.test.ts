// Revízia sady v7 (Michal 2026-10-27, docs/napady/revizia-sady/plan.md): dáta sady,
// lokality podľa úrovní a finále na pinnacle, Kšeft, nové a prerobené efekty kariet.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import {
  apply,
  bitkaMody,
  cardVariants,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  naexCieleVLinii,
  pocetPitiek,
  prirastkyPitky,
  setupGame,
  urovenLokality,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 970000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0], vykup: [false, false] };
}

/** Pitka na lokalite `lok` (hráč 0 na ťahu). */
function vPitke(lok: string, strany: GameState["strany"], seed = 7): GameState {
  const s0 = setupGame(data, seed);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok)!;
  return {
    ...s0,
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 1,
    pitkaStav: pitkaStav(0),
  };
}

/** Zhromaždenie na lokalite `lok` (hráč 0 na ťahu, limit 2). */
function vZhromazdeni(lok: string, strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s = vPitke(lok, strany);
  return sHracom({ ...s, faza: "zhromazdenie", pitkaStav: null, pitkaCislo: 0, zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } }, 0, { ruka });
}

describe("sada v7 — dáta", () => {
  it("86 kariet, 19 lokalít po úrovniach 5 / 6 / 5 / 3, akcia Pakt", () => {
    expect(data.cards.size).toBe(86);
    const urovne = [1, 2, 3, 4].map((u) => data.lokality.filter((l) => urovenLokality(data, l.id) === u).length);
    expect(urovne).toEqual([5, 6, 5, 3]);
    expect((cardsJson as { actions: string[] }).actions).toContain("Pakt");
    // Lokalita má na oboch hranách rovnako akcií a jediný variant.
    for (const l of data.lokality) expect(cardVariants(l).total, l.id).toBe(1);
  });

  it("hráčske karty majú 4 až 8 variantov (sloty.json, podmienky Michala)", () => {
    for (const def of data.cards.values()) {
      if (["Lokalita", "Starešina", "Kliatba"].some((t) => def.tags.includes(t as never))) continue;
      const v = cardVariants(def).total;
      expect(v, def.id).toBeGreaterThanOrEqual(4);
      expect(v, def.id).toBeLessThanOrEqual(8);
    }
  });
});

describe("lokality podľa úrovní a finále na pinnacle (plan.md 7)", () => {
  it("stredná hra: rozpis 1·2·2·3·3·P, obranca vyberá len z lokalít úrovne kola", () => {
    const s = setupGame(data, 3);
    expect(s.rozpis).toEqual([1, 2, 2, 3, 3, 4]);
    expect(s.lokalityVHre).toHaveLength(19);
    const obranca: PlayerId = s.utocnik === 0 ? 1 : 0;
    const volby = legalCommands(data, s, obranca).filter((c) => c.type === "chooseLocation");
    expect(volby).toHaveLength(5 * 2);
    for (const c of volby) if (c.type === "chooseLocation") expect(urovenLokality(data, s.lokalityVHre.find((k) => k.uid === c.uid)!.defId)).toBe(1);
    // Klient dostane len lokality na výber a rozpis.
    expect(viewFor(data, s, obranca).lokalityVHre).toHaveLength(5);
    expect(viewFor(data, s, obranca).rozpis).toEqual([1, 2, 2, 3, 3, 4]);
    expect(setupGame(data, 3, { lokalit: 3 }).rozpis).toEqual([1, 2, 3, 4]);
    expect(setupGame(data, 3, { lokalit: 7 }).rozpis).toEqual([1, 1, 2, 2, 3, 3, 3, 4]);
  });

  it("finále: obranca vyberie pinnacle, je to cieľ typu finále s lokalitou a Pitky ako inde", () => {
    const s0 = setupGame(data, 4);
    const s: GameState = { ...s0, kolo: s0.lokalitCelkom + 1, faza: "volbaCiela", utocnik: 0, spaky: [5, 3] };
    const volby = legalCommands(data, s, 1).filter((c) => c.type === "chooseLocation");
    expect(volby).toHaveLength(3 * 2);
    const vila = s.lokalityVHre.find((k) => k.defId === "predsedova_vila")!;
    const po = apply(data, s, { type: "chooseLocation", uid: vila.uid, otocena: false }, 1).state;
    expect(po.ciel?.typ).toBe("finale");
    expect(po.ciel?.lokalita?.defId).toBe("predsedova_vila");
    // Prázdna línia: 1 Pitka (nie pevné 3 finále v6).
    expect(pocetPitiek(data, po)).toBe(1);
  });
});

describe("Kšeft (v7)", () => {
  it("Kapybara: za 2 cigarety súper −1 špak, raz za Pitku", () => {
    const k = inst("kapybara");
    const s = sHracom(vPitke("zastavka", [[lezi(k, 0)], []]), 0, { cigarety: 5 });
    const cmd = legalCommands(data, s, 0).find((c) => c.type === "kseft");
    expect(cmd).toEqual({ type: "kseft", uid: k.uid });
    // Hra potom sama dohrá Pitku aj bitku (hráčom už nič neostáva) — overuje sa log a špaky.
    const { state: po, events } = apply(data, s, cmd!, 0);
    expect(events.some((e) => e.type === "log" && e.text.startsWith("Kapybara: hráč 1 platí 2 cigarety"))).toBe(true);
    expect(po.spaky[1]).toBe(s.spaky[1] - 1);
    const pouzity: GameState = { ...s, pitkaStav: { ...s.pitkaStav!, kseft: [[k.uid], []] } };
    expect(legalCommands(data, pouzity, 0).some((c) => c.type === "kseft")).toBe(false);
  });

  it("Strýko z Ameriky: za 2 cigarety Rana navyše v bitke kola", () => {
    const k = inst("stryko_z_ameriky");
    const s = sHracom(vPitke("zastavka", [[lezi(k, 0)], []]), 0, { cigarety: 2 });
    const po = apply(data, s, { type: "kseft", uid: k.uid }, 0).state;
    expect(po.kseftRany).toEqual([1, 0]);
    expect(bitkaMody(data, po, 0).tuheZdroje).toContainEqual({ zdroj: "stryko_z_ameriky", tuhe: 1 });
  });

  it("Jednota: za 1 Dlh 2 cigarety — Kšeft lokality smie každý hráč", () => {
    const s = vPitke("jednota", [[], []]);
    const lok = s.ciel!.lokalita!;
    const po = apply(data, s, { type: "kseft", uid: lok.uid }, 0).state;
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 2);
    expect(po.hraci[0].priznane.filter((k) => k.defId === "dlh")).toHaveLength(1);
    const naTahu1: GameState = { ...po, pitkaStav: { ...po.pitkaStav!, naTahu: 1 } };
    expect(legalCommands(data, naTahu1, 1)).toContainEqual({ type: "kseft", uid: lok.uid });
  });

  it("Sklad: za cigaretu vrchná karta zo súperovho odhadzovacieho balíčka do ruky", () => {
    const x = inst("masiar");
    const s = sHracom(sHracom(vPitke("sklad", [[], []]), 1, { odhadzovaci: [inst("pijan"), x] }), 0, { cigarety: 1 });
    const po = apply(data, s, { type: "kseft", uid: s.ciel!.lokalita!.uid }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.uid)).toContain(x.uid);
    expect(po.hraci[1].odhadzovaci).toHaveLength(1);
    expect(po.hraci[0].cigarety).toBe(0);
  });

  it("Predsedova vila: za 2 cigarety posun markera, nie staršieho zo súperovho patronátu", () => {
    const s0 = sHracom(vPitke("predsedova_vila", [[], []]), 0, { cigarety: 2 });
    const e = s0.starsi[0]!;
    const s: GameState = { ...s0, patronat: [null, { elderId: s0.starsi[1]!.elderId, nahrada: inst("pijan"), pohorsenia: 1 }] };
    const volby = legalCommands(data, s, 0).filter((c) => c.type === "kseft");
    expect(volby.some((c) => c.type === "kseft" && c.elderId === s0.starsi[1]!.elderId)).toBe(false);
    const po = apply(data, s, { type: "kseft", uid: s.ciel!.lokalita!.uid, elderId: e.elderId, kSebe: false }, 0).state;
    expect(po.starsi[0]!.marker).toBe(e.marker + 1);
    expect(po.hraci[0].cigarety).toBe(0);
  });

  it("Oslávenec: za plný poldeci súper +2 pečene; Smetiarka: karta z ruky za cigaretu, nie Kliatba", () => {
    const o = inst("oslavenec");
    const sm = inst("smetiarka");
    const x = inst("masiar");
    const s = sHracom(vPitke("zastavka", [[lezi(o, 0), lezi(sm, 0)], []]), 0, { poldeciPlne: 2, poldeciVypite: 0, ruka: [x, inst("dlh")] });
    const po = apply(data, s, { type: "kseft", uid: o.uid }, 0).state;
    expect(po.hraci[0].poldeciPlne).toBe(1);
    expect(po.hraci[1].pecen).toBe(2);
    expect(legalCommands(data, po, 0).filter((c) => c.type === "kseft" && c.uid === sm.uid)).toEqual([{ type: "kseft", uid: sm.uid, kartaUid: x.uid }]);
    const po2 = apply(data, po, { type: "kseft", uid: sm.uid, kartaUid: x.uid }, 0).state;
    expect(po2.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(x.uid);
    expect(po2.hraci[0].cigarety).toBe(po.hraci[0].cigarety + 1);
  });
});

describe("efekty v bitke (v7)", () => {
  it("Vymáhač: za každé 2 priznané Dlhy Rana navyše; Šofér bez NA EX Pecku; Vidly kým zaostávaš", () => {
    const s0 = vPitke("zastavka", [[lezi(inst("vymahac"), 0), lezi(inst("sofer"), 0)], []]);
    const s = { ...sHracom(s0, 0, { priznane: [inst("dlh"), inst("dlh"), inst("dlh"), inst("dlh"), inst("dlh")], dedicstvo: [inst("vidly")] }), spaky: [1, 4] as [number, number] };
    const zdroje = bitkaMody(data, s, 0).tuheZdroje;
    expect(zdroje).toContainEqual({ zdroj: "vymahac", tuhe: 2 });
    expect(zdroje).toContainEqual({ zdroj: "sofer", tuhe: 2 });
    expect(zdroje).toContainEqual({ zdroj: "vidly", tuhe: 1 });
    expect(bitkaMody(data, { ...s, naexVKole: [true, false] }, 0).tuheZdroje.some((z) => z.zdroj === "sofer")).toBe(false);
  });

  it("Traktoristka: s prevahou v jej kraji Pecka navyše, bez nej Dlh na začiatku bitky", () => {
    const t = inst("traktoristka");
    const s = vPitke("zastavka", [[lezi(t, 0)], []]);
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "traktoristka", tuhe: 2 });
    // Súperove dve karty v jej kraji — prevahu má súper.
    const bez = vPitke("zastavka", [[lezi(t, 0), lezi(inst("masiar"), 1), lezi(inst("masiar"), 1)], []]);
    expect(bitkaMody(data, bez, 0).tuheZdroje.some((z) => z.zdroj === "traktoristka")).toBe(false);
    let st = bez;
    for (let i = 0; i < 2 && st.faza === "pitka"; i++) st = apply(data, st, { type: "skipNaex" }, st.pitkaStav!.naTahu).state;
    expect(st.hraci[0].priznane.filter((k) => k.defId === "dlh").length).toBeGreaterThanOrEqual(1);
  });

  it("Milujúca manželka: pečeň majiteľa v Pitke o 1 menšia; Kohút: aspoň 2 Pitky", () => {
    const s = vPitke("zastavka", [[lezi(inst("milujuca_manzelka"), 0)], []]);
    const bez = prirastkyPitky(data, { ...s, strany: [[], []] });
    expect(bez.poskodeniePecene[0]).toBe(0);
    expect(prirastkyPitky(data, s).poskodeniePecene[0]).toBe(0);
    expect(pocetPitiek(data, vPitke("zastavka", [[lezi(inst("kohut"), 0)], []]))).toBe(2);
  });

  it("Lievik: NA EX aj na Zviera", () => {
    const s = vPitke("zastavka", [[lezi(inst("kon"), 0), lezi(inst("pes"), 0)], []]);
    const bez = naexCieleVLinii(data, lineState(s), 0);
    const s2 = naexCieleVLinii(data, lineState(s), 0, true);
    expect(s2.length).toBeGreaterThanOrEqual(bez.length);
    expect(bez.some((uid) => s.strany[0].some((pl) => pl.card.uid === uid))).toBe(false);
  });
});

describe("Nástup (v7)", () => {
  it("Degustátorka súperovi otočí plný poldeci; Vandal otočí lokalitu; Opatrovateľka nerestí −2", () => {
    const d = inst("degustatorka");
    const s = sHracom(sHracom(vZhromazdeni("zastavka", [[], []], [d]), 1, { poldeciPlne: 3, poldeciVypite: 0 }), 0, { poldeciPlne: 1 });
    const po = apply(data, s, { type: "place", uid: d.uid, target: "vlastna" }, 0).state;
    expect([po.hraci[1].poldeciPlne, po.hraci[1].poldeciVypite]).toEqual([2, 1]);
    const v = inst("vandal");
    const sv = vZhromazdeni("zastavka", [[], []], [v]);
    expect(apply(data, sv, { type: "place", uid: v.uid, target: "vlastna" }, 0).state.lokalitaOtocena).toBe(!sv.lokalitaOtocena);
    const o = inst("opatrovatelka");
    const so = sHracom(vZhromazdeni("zastavka", [[], []], [o]), 0, { nerestiMinuleKolo: 3 });
    expect(apply(data, so, { type: "place", uid: o.uid, target: "vlastna" }, 0).state.hraci[0].nerestiMinuleKolo).toBe(1);
  });

  it("Klebetnica: súperovu ruku vidí len ten, kto vyberá; karta ide naspodok súperovho balíčka", () => {
    const k = inst("klebetnica");
    const tajna = inst("masiar");
    const s = sHracom(vZhromazdeni("zastavka", [[], []], [k]), 1, { ruka: [tajna], doberaci: [inst("pijan")] });
    const po = apply(data, s, { type: "place", uid: k.uid, target: "vlastna" }, 0).state;
    expect(viewFor(data, po, 0).volbaNastupu?.ruka?.map((x) => x.uid)).toEqual([tajna.uid]);
    expect(viewFor(data, po, 1).volbaNastupu?.ruka).toBeNull();
    expect(legalCommands(data, po, 0)).toEqual([{ type: "klebetnica", uid: tajna.uid }]);
    const po2 = apply(data, po, { type: "klebetnica", uid: tajna.uid }, 0).state;
    expect(po2.hraci[1].ruka).toHaveLength(0);
    expect(po2.hraci[1].doberaci.at(-1)?.uid).toBe(tajna.uid);
  });

  it("Dohadzovačka: dvom starším sa vymenia scorecardy, markery ostanú", () => {
    const d = inst("dohadzovacka");
    const s = vZhromazdeni("zastavka", [[], []], [d]);
    const po = apply(data, s, { type: "place", uid: d.uid, target: "vlastna" }, 0).state;
    const [a, b] = po.starsi;
    const po2 = apply(data, po, { type: "dohadzovacka", elderA: a!.elderId, elderB: b!.elderId }, 0).state;
    expect([po2.starsi[0]!.scorecard, po2.starsi[1]!.scorecard]).toEqual([b!.scorecard, a!.scorecard]);
    expect([po2.starsi[0]!.marker, po2.starsi[1]!.marker]).toEqual([a!.marker, b!.marker]);
  });
});

describe("D6: zadĺženie neprepadá", () => {
  it("zvyšok zadĺženia ostane na účte a s ďalšou Pitkou dá Dlh", () => {
    const s = sHracom(vPitke("zastavka", [[], []]), 0, { zadlzenie: 1 });
    let st = s;
    for (let i = 0; i < 2 && st.faza === "pitka"; i++) st = apply(data, st, { type: "skipNaex" }, st.pitkaStav!.naTahu).state;
    expect(st.hraci[0].zadlzenie).toBe(1);
    // Line stále bez Dlhov: Pakt ani karty nič nepridajú, účet čaká.
    expect(evaluateLine(data, lineState(st)).sums[0].Dlh ?? 0).toBe(0);
  });
});
