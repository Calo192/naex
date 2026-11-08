// Identita kariet (v11.5, Michal 2026-11-03, docs/napady/identita-kariet): nové efekty
// Novín, Opatrovateľky, Podvodníka, Anonymného alkoholika, Šoféra, Sypača a Koňa.
// Karty sú syntetické s textami a spúšťačmi novej sady — akcie v sade mení admin.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, LineState, PitkaStav, PlacedCard, PlayerId, PlayerState } from "../src/index.ts";
import {
  ALL_TRIGGERS,
  REGISTER,
  apply,
  bitkaMody,
  buildGameData,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  paleneDlhyVBitke,
  parseScorecards,
  prirastkyPitky,
  sPrilozenou,
  setupGame,
} from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef } from "./helpers.ts";

const zaklad = loadGameData(cardsJson, eldersJson, scorecardsJson);
const RANA0: Layout4 = ["Rana", null, null, null];
const PECKA0: Layout4 = ["Pecka", null, null, null];
/** Rozloženia syntetických kariet — inštancia ich dostane presne (instanceFor). */
const ROZLOZENIA = new Map<string, readonly [Layout4, Layout4]>();
const def = (id: string, l: Layout4, r: Layout4, extra?: Parameters<typeof makeDef>[3]) => {
  ROZLOZENIA.set(id, [l, r]);
  return makeDef(id, l, r, extra);
};
const defs = [
  def("opatrovatelka", EMPTY, PECKA0, { tags: ["Občan", "Zahraničný", "Pracujúci", "Žena"], triggers: ["Furt"] }),
  def("anonymny_alkoholik", EMPTY, PECKA0, { tags: ["Občan", "Závislý", "Chlap"], triggers: ["Furt"] }),
  def("podvodnik", EMPTY, EMPTY, { tags: ["Občan", "Kriminál", "Chlap"], triggers: ["Konflikt"] }),
  def("kulturista", EMPTY, EMPTY, { tags: ["Občan", "Influencer", "Chlap"], triggers: ["Podpora"] }),
  def("sofer", EMPTY, EMPTY, { tags: ["Občan", "Chlap", "Pracujúci"], triggers: ["Bitka"] }),
  def("kon", ["Robota", null, null, null], EMPTY, { tags: ["Zviera"], triggers: ["Furt"] }),
  // Pamätník s Ranou na ľavej strane; vytlačená pravá je jej zrkadlo (súperovi otočená karta ju má vľavo).
  def("i_pamatnik", RANA0, [null, null, null, "Rana"], { tags: ["Občan", "Pamätník", "Žena"] }),
  def("i_obcan", RANA0, [null, null, null, "Rana"]),
  def("i_pecen", ["PoškodeniePečene", null, null, null], [null, null, null, "PoškodeniePečene"]),
  def("i_chlap", RANA0, EMPTY, { tags: ["Občan", "Chlap"] }),
  def("i_zena", RANA0, EMPTY, { tags: ["Občan", "Žena"] }),
  def("i_partner", EMPTY, RANA0),
  def("i_robota", EMPTY, ["Robota", null, null, null]),
  def("i_pohorsenie_l", ["Pohoršenie", null, null, null], EMPTY),
  def("i_pohorsenie_r", EMPTY, ["Pohoršenie", null, null, null]),
  def("i_prazdna", EMPTY, EMPTY),
];
const data: GameData = buildGameData(new Map([...zaklad.cards, ...defs.map((d) => [d.id, d] as const)]), zaklad.elders, {
  scorecards: zaklad.scorecards,
  body: parseScorecards(scorecardsJson).body,
});
let uidSeq = 990000;
const karta = (id: string): CardInstance => {
  const r = ROZLOZENIA.get(id);
  return r === undefined ? { uid: ++uidSeq, defId: id, leftLayout: 0, rightLayout: 0 } : instanceFor(data, id, r[0], r[1]);
};
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
/** Partia hráča 0 bez lokality: [A, B] sa vyhodnotí ako línia B · A (B.pravá ↔ A.ľavá). */
const linia = (strana0: PlacedCard[], strana1: PlacedCard[] = []): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [strana0, strana1] });

function sHracom(s: GameState, p: PlayerId, h: Partial<PlayerState>): GameState {
  const hraci = [...s.hraci] as [PlayerState, PlayerState];
  hraci[p] = { ...hraci[p], ...h };
  return { ...s, hraci };
}

/** Zhromaždenie na Zastávke, hráč `p` na ťahu s `ruka`. */
function zhromazdenie(strany: GameState["strany"], ruka: CardInstance[], p: PlayerId = 0): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  return sHracom(
    {
      ...s0,
      faza: "zhromazdenie",
      utocnik: 0,
      ciel: { typ: "lokalita", lokalita },
      lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
      strany,
      pitkyCelkom: 1,
      pitkaCislo: 0,
      pitkaStav: null,
      zhromazdenieStav: { naTahu: p, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
    },
    p,
    { ruka },
  );
}
const priloz = (s: GameState, uid: number, p: PlayerId = 0, target: "vlastna" | "superova" = "vlastna"): GameState =>
  apply(data, s, { type: "place", uid, target }, p).state;
const naKarte = (s: Pick<GameState, "strany">, uid: number): PlacedCard => s.strany.flat().find((pl) => pl.card.uid === uid)!;

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Posledná Pitka kola na Moste (bez efektu po Pitke) s danou líniou. */
function vPitke(strany: GameState["strany"]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "most")!;
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, doberaci: [karta("masiar"), karta("vandal"), karta("hasic")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    senok: [karta("masiar"), karta("zamocnik"), karta("vandal")],
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

/** Obaja skončia Pitku bez NA EX — vyhodnotí sa a začne bitka (po prvé rozhodnutie). */
function doBitky(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 6 && s.faza === "pitka"; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
    if (q === undefined) break;
    s = apply(data, s, legalCommands(data, s, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q).state;
  }
  return s;
}

describe("Identita kariet (v11.5): register a spúšťač Hádka", () => {
  it("všetkých 7 efektov je implementovaných; Hádka je spúšťač, ktorý tvorca pozná", () => {
    for (const id of ["noviny", "opatrovatelka", "podvodnik", "anonymny_alkoholik", "sofer", "kulturista", "kon"]) expect(REGISTER[id], id).toBe("impl");
    expect(ALL_TRIGGERS).toContain("Hádka");
  });
});

describe("Opatrovateľka (Furt, v11.5)", () => {
  const rana = (pam: string, majitel: PlayerId): number | undefined => {
    const p = karta(pam);
    return evaluateLine(data, linia([lezi(p, majitel), lezi(karta("opatrovatelka"), 0)])).zdroje[majitel].Rana?.[0]?.hodnota;
  };

  it("aktívne akcie tvojho Pamätníka v jej okolí sú posilnené ×2", () => {
    expect(rana("i_pamatnik", 0)).toBe(2);
  });

  it("Občan bez tagu Pamätník ani súperov Pamätník posilnení nie sú; jej vlastné akcie tiež nie", () => {
    expect(rana("i_obcan", 0)).toBe(1);
    expect(rana("i_pamatnik", 1)).toBe(1);
    const ev = evaluateLine(data, linia([lezi(karta("i_pamatnik"), 0), lezi(karta("opatrovatelka"), 0)]));
    expect(ev.sums[0].Pecka).toBe(1);
  });
});

describe("Anonymný alkoholik (Furt, v11.5)", () => {
  it("Poškodenie pečene tvojej karty v jeho okolí sa ráta ako Viera — aj v Pitke pečeň nedá", () => {
    const line = linia([lezi(karta("i_pecen"), 0), lezi(karta("anonymny_alkoholik"), 0)]);
    const ev = evaluateLine(data, line);
    expect(ev.sums[0]).toEqual({ Viera: 1, Pecka: 1 });
    expect(ev.zdroje[0].Viera?.[0]?.dovody).toContain("karta:anonymny_alkoholik");
    const stav = { ciel: null, strany: line.strany, starsi: [], hraci: [{ priznane: [], dlhy: 0, dedicstvo: [], abstaky: 0 }, { priznane: [], dlhy: 0, dedicstvo: [], abstaky: 0 }], lokalitaOtocena: false } as const;
    expect(prirastkyPitky(data, stav, ev).poskodeniePecene).toEqual([0, 0]);
  });

  it("súperova karta pri ňom ostáva s pečeňou; bez neho pečeň ostáva pečeňou", () => {
    const cudzia = evaluateLine(data, linia([lezi(karta("i_pecen"), 1), lezi(karta("anonymny_alkoholik"), 0)]));
    expect(cudzia.sums[1]).toEqual({ PoškodeniePečene: 1 });
    const bez = evaluateLine(data, linia([lezi(karta("i_pecen"), 0), lezi(karta("i_partner"), 0)]));
    expect(bez.sums[0].PoškodeniePečene).toBe(1);
  });
});

describe("Podvodník (Konflikt, v11.5)", () => {
  it("priložený k súperovej karte: súper mu dá 1 cigaretu", () => {
    const podv = karta("podvodnik");
    const s = zhromazdenie([[lezi(karta("i_prazdna"), 1)], []], [podv]);
    const po = priloz(s, podv.uid);
    expect(po.hraci[1].cigarety).toBe(s.hraci[1].cigarety - 1);
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 1);
  });

  it("súper priloží kartu k nemu a nemá cigaretu — získa 1 zadĺženie, pri prahu 1 rovno Dlh", () => {
    const cudzia = karta("i_prazdna");
    const s = sHracom(zhromazdenie([[lezi(karta("podvodnik"), 0)], []], [cudzia], 1), 1, { cigarety: 0, zadlzenie: 0 });
    const po = priloz(s, cudzia.uid, 1, "superova");
    expect(po.hraci[1].zadlzenie).toBe(0);
    expect(po.hraci[1].dlhy).toBe(s.hraci[1].dlhy + 1);
    expect(po.hraci[0].cigarety).toBe(s.hraci[0].cigarety);
  });

  it("vedľa vlastnej karty nič (to by bola Podpora)", () => {
    const podv = karta("podvodnik");
    const s = zhromazdenie([[lezi(karta("i_prazdna"), 0)], []], [podv]);
    const po = priloz(s, podv.uid);
    expect(po.hraci.map((h) => h.cigarety)).toEqual(s.hraci.map((h) => h.cigarety));
  });
});

describe("Sypač (Podpora, v11.5)", () => {
  it("priložený k tvojmu Chlapovi — ten má do konca kola Rany ako Pecky; aj keď Chlapa priložíš k nemu", () => {
    const chlap = lezi(karta("i_chlap"), 0);
    const syp = karta("kulturista");
    expect(naKarte(priloz(zhromazdenie([[chlap], []], [syp]), syp.uid), chlap.card.uid).ranyAkoPecky).toBe(true);
    const chlap2 = karta("i_chlap");
    expect(naKarte(priloz(zhromazdenie([[lezi(karta("kulturista"), 0)], []], [chlap2]), chlap2.uid), chlap2.uid).ranyAkoPecky).toBe(true);
  });

  it("Žena ani súperov Chlap nie; náhľad (sPrilozenou) vidí to isté ako motor", () => {
    for (const pl of [lezi(karta("i_zena"), 0), lezi(karta("i_chlap"), 1)]) {
      const syp = karta("kulturista");
      expect(naKarte(priloz(zhromazdenie([[pl], []], [syp]), syp.uid), pl.card.uid).ranyAkoPecky).toBeUndefined();
    }
    const chlap = lezi(karta("i_chlap"), 0);
    const syp = karta("kulturista");
    expect(naKarte(sPrilozenou(data, zhromazdenie([[chlap], []], [syp]), 0, syp, 0), chlap.card.uid).ranyAkoPecky).toBe(true);
  });

  it("Rany Chlapa sa v súčtoch rátajú ako Pecky, partnerove Rany nie", () => {
    const chlap = lezi(karta("i_chlap"), 0, { ranyAkoPecky: true });
    expect(evaluateLine(data, linia([chlap, lezi(karta("i_partner"), 0)])).sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    expect(evaluateLine(data, linia([lezi(chlap.card, 0), lezi(karta("i_partner"), 0)])).sums[0]).toEqual({ Rana: 2 });
  });
});

describe("Šofér (Bitka, v11.5)", () => {
  it("bez NA EX v kole: Pecka navyše a na začiatku bitky 1 cigareta; s NA EX nič", () => {
    const s = vPitke([[lezi(karta("sofer"), 0)], []]);
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "sofer", tuhe: 2 });
    const b = doBitky(s);
    expect(b.faza).toBe("bitka");
    expect(b.hraci[0].cigarety).toBe(s.hraci[0].cigarety + 1);
    expect(b.hraci[1].cigarety).toBe(s.hraci[1].cigarety);
    const sNaex = { ...s, naexVKole: [true, false] as const };
    expect(bitkaMody(data, sNaex, 0).tuheZdroje.some((z) => z.zdroj === "sofer")).toBe(false);
    expect(doBitky(sNaex).hraci[0].cigarety).toBe(s.hraci[0].cigarety);
  });
});

describe("Kôň (Furt, v11.5)", () => {
  // Kôň.ľavá (Robota) ↔ pravá Roboty karty i_robota: obe Roboty aktívne.
  const stol = (kon: PlacedCard, dalsie: PlacedCard[] = []): GameState => sHracom(vPitke([[kon, lezi(karta("i_robota"), 0), ...dalsie], []]), 0, { dlhy: 4 });

  it("Roboty Koňa pália o 1 Dlh viac (náhľad aj exekúcia); Robota susednej karty nie", () => {
    const s = stol(lezi(karta("kon"), 0));
    expect(paleneDlhyVBitke(data, s)).toEqual([3, 0]);
    // 4 Dlhy − 3 Robotou = 1, Exekútor spáli polovicu nahor = 0.
    expect(doBitky(s).hraci[0].dlhy).toBe(0);
  });

  it("Kôň vedľa Mäsiara efekt nemá — Robota páli 1 ako každá", () => {
    const masiar = lezi(karta("masiar"), 0);
    const s = sHracom(vPitke([[masiar, lezi(karta("kon"), 0), lezi(karta("i_robota"), 0)], []]), 0, { dlhy: 4 });
    expect(paleneDlhyVBitke(data, s)[0]).toBe(evaluateLine(data, lineState(s)).sums[0].Robota);
  });
});

describe("Noviny (Dedičstvo: Hádka, v11.5)", () => {
  // Pohoršenie proti Pohoršeniu: hráč 0 vyhrá hádku 4 : 0.
  const stol = (dedicstvo0: CardInstance[]): GameState => {
    const s = vPitke([[lezi(karta("i_pohorsenie_l"), 0), lezi(karta("i_pohorsenie_r"), 0)], []]);
    return sHracom(sHracom(s, 0, { dedicstvo: dedicstvo0 }), 1, { ruka: [karta("masiar"), karta("vandal"), karta("hasic")], odhadzovaci: [] });
  };

  it("víťaz hádky s Novinami: súper odhodí 1 náhodnú kartu z ruky do odhadzovacieho balíčka", () => {
    const s = stol([karta("noviny")]);
    const b = doBitky(s);
    expect(b.bitkaStav?.hadka?.vitaz).toBe(0);
    expect(b.hraci[1].ruka).toHaveLength(2);
    expect(b.hraci[1].odhadzovaci).toHaveLength(1);
    expect(s.hraci[1].ruka.map((k) => k.uid)).toContain(b.hraci[1].odhadzovaci[0]?.uid);
    // Noviny už porazenému špaky za Dlhy víťaza nedávajú.
    expect(b.nastenka.at(-1)?.noviny).toBeUndefined();
  });

  it("bez Novín, alebo Noviny u porazeného hádky — nič sa neodhadzuje", () => {
    expect(doBitky(stol([])).hraci[1].ruka).toHaveLength(3);
    const s = sHracom(stol([]), 1, { dedicstvo: [karta("noviny")] });
    expect(doBitky(s).hraci[1].ruka).toHaveLength(3);
  });
});
