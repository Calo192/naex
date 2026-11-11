// Karty v11.18 (Michal 2026-11-09, Zrejúca): Snúbenica „Podpora: Chlap {Cigareta}.“, Traktorista bez
// Pecky s prevahou (ľavá strana Rana namiesto Pecky), Miňištrant „Nepriateľ: Starešina {Pecka}.“,
// Vandal a Degustátorka len kratší text. Očakávané hodnoty sú z pravidla (PRAVIDLA §16), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, bitkaMody, cardVariants, efektyNavyse, evaluateLine, loadGameData, sPrilozenou, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 960000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const linia = (strany: GameState["strany"]) => evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany });
/** Akcie navyše karty `uid` hráča p v súčtoch línie (akcia → hodnota). */
const navyseVSuctoch = (strany: GameState["strany"], p: PlayerId, uid: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [akcia, zdroje] of Object.entries(linia(strany).zdroje[p])) {
    for (const z of zdroje ?? []) if (z.uid === uid && z.dovody.some((d) => d.startsWith("akcia navyše"))) out[akcia] = (out[akcia] ?? 0) + z.hodnota;
  }
  return out;
};

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][number]>): GameState {
  return { ...s, hraci: (p === 0 ? [{ ...s.hraci[0], ...h }, s.hraci[1]] : [s.hraci[0], { ...s.hraci[1], ...h }]) as unknown as GameState["hraci"] };
}

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s `ruka`. */
function zhromazdenie(strany: GameState["strany"], ruka: CardInstance[], d: GameData = data): GameState {
  const s0 = setupGame(d, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka") ?? inst("zastavka");
  return {
    ...sHracom(s0, 0, { ruka, cigarety: 6 }),
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    pitkaStav: null,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

const priloz = (s: GameState, k: CardInstance): GameState => apply(data, s, { type: "place", uid: k.uid, target: "vlastna" }, 0).state;
const naKarte = (s: GameState, uid: number): PlacedCard => [...s.strany[0], ...s.strany[1]].find((pl) => pl.card.uid === uid)!;

describe("texty kariet v11.18 v sade (cards.json)", () => {
  it("Vandal, Degustátorka, Snúbenica, Traktorista a Miňištrant majú nové znenie; Anonymný alkoholik starý", () => {
    const text = (id: string) => data.cards.get(id)!.effectText;
    expect(text("vandal")).toBe("Nástup: Otoč lokalitu o 180°.");
    expect(text("degustatorka")).toBe("Nástup: Ak má súper viac plných poldeci ako ty, jeden mu vyžerie.");
    expect(text("snubenica")).toBe("Podpora: Chlap {Cigareta}.");
    // v12 (Michal 2026-11-11): Traktorista Pecku s prevahou namiesto Dlhu bez prevahy (skolitelia.test.ts).
    expect(text("traktoristka")).toBe("Bitka: S prevahou v jeho kraji {Pecka}.");
    expect(text("ministrant")).toBe("Nepriateľ: Starešina {Pecka}.");
    // {Pečeň}→{Cigareta} má Krabička cigariet hore — dvojica X → Y je v sade jediná (§12).
    expect(text("anonymny_alkoholik")).toBe("Podpora: Preškolenie {PoškodeniePečene}→{Viera}.");
    expect(efektyNavyse(data.cards.get("snubenica")!)).toEqual([{ spustac: "Podpora", tag: "Chlap", akcie: ["Cigareta"] }]);
    expect(efektyNavyse(data.cards.get("ministrant")!)).toEqual([{ spustac: "Nepriateľ", tag: "Starešina", akcie: ["Pecka"] }]);
    expect(efektyNavyse(data.cards.get("traktoristka")!)).toEqual([{ spustac: "Bitka", tag: null, akcie: ["Pecka"], podmienka: "S prevahou v jeho kraji" }]);
  });

  it("Vandal po vyložení otočí lokalitu; Degustátorka súperovi s viac plnými poldeci jeden vyžerie", () => {
    const v = inst("vandal");
    expect(priloz(zhromazdenie([[], []], [v]), v).lokalitaOtocena).toBe(!zhromazdenie([[], []], [v]).lokalitaOtocena);
    const d = inst("degustatorka");
    const s = sHracom(zhromazdenie([[], []], [d]), 1, { poldeciPlne: 3 });
    const po = priloz(sHracom(s, 0, { poldeciPlne: 1 }), d);
    expect(po.hraci[1].poldeciPlne).toBe(2);
  });
});

describe("Snúbenica: Podpora: Chlap {Cigareta}", () => {
  it("pri tvojom Chlapovi Cigareta navyše do konca kola; pri tvojej Žene ani pri súperovom Chlapovi nič", () => {
    const sn = inst("snubenica");
    const po = priloz(zhromazdenie([[lezi(inst("pijan"), 0)], []], [sn]), sn);
    expect(naKarte(po, sn.uid).navyse).toEqual([1]);
    expect(navyseVSuctoch(po.strany, 0, sn.uid)).toEqual({ Cigareta: 1 });

    const sn2 = inst("snubenica");
    const zena = priloz(zhromazdenie([[lezi(inst("degustatorka"), 0)], []], [sn2]), sn2);
    expect(naKarte(zena, sn2.uid).navyse).toBeUndefined();
    expect(navyseVSuctoch(zena.strany, 0, sn2.uid)).toEqual({});

    const sn3 = inst("snubenica");
    const jeho = priloz(zhromazdenie([[lezi(inst("pijan"), 1)], []], [sn3]), sn3);
    expect(naKarte(jeho, sn3.uid).navyse).toBeUndefined();
  });

  it("súperovo NA EX na tvojom Chlapovi ostáva — vrátenie NA EX zaniklo (aj v náhľade sPrilozenou)", () => {
    const chlap = lezi(inst("pijan"), 0, { naexBy: 1 });
    const sn = inst("snubenica");
    const s = zhromazdenie([[chlap], []], [sn]);
    const po = priloz(s, sn);
    expect(naKarte(po, chlap.card.uid).naexBy).toBe(1);
    expect(po.hraci[1].poldeciVypite).toBe(s.hraci[1].poldeciVypite);
    expect(naKarte(sPrilozenou(data, s, 0, sn, 0), chlap.card.uid).naexBy).toBe(1);
    expect(naKarte(po, sn.uid).navyse).toEqual([1]);
  });
});

describe("Traktorista bez Pecky na hranách", () => {
  it("ľavá strana Rana a Pečeň, Pecka na hranách nikde; bez lokality Pecka navyše nie je a bitkaMody tuhé nepridá", () => {
    const def = data.cards.get("traktoristka")!;
    const v = cardVariants(def);
    expect(v.left.every((l) => !l.includes("Pecka") && l.includes("Rana") && l.includes("PoškodeniePečene"))).toBe(true);
    expect(v.right.every((r) => !r.includes("Pecka"))).toBe(true);
    const t = inst("traktoristka");
    const strany: GameState["strany"] = [[lezi(t, 0)], []];
    expect(navyseVSuctoch(strany, 0, t.uid)).toEqual({});
    const s = zhromazdenie(strany, []);
    expect(bitkaMody(data, s, 0).tuheZdroje.filter((z) => z.zdroj === "traktoristka")).toEqual([]);
  });
});

describe("Miňištrant: Nepriateľ: Starešina {Pecka}", () => {
  it("Pecka navyše, keď v súperovej partii leží odkrytý Starešina; vlastný Starešina ani súperov Občan nie", () => {
    const m = inst("ministrant");
    const s = (sused: PlacedCard): GameState["strany"] => [[lezi(m, 0)], [sused]];
    expect(navyseVSuctoch(s(lezi(inst("farar"), 1)), 0, m.uid)).toEqual({ Pecka: 1 });
    expect(navyseVSuctoch([[lezi(m, 0), lezi(inst("farar"), 0)], []], 0, m.uid)).toEqual({});
    expect(navyseVSuctoch(s(lezi(inst("pijan"), 1)), 0, m.uid)).toEqual({});
    // Skrytý Starešina (Záverečná lícom dole) podmienku nesplní.
    expect(navyseVSuctoch(s(lezi(inst("farar"), 1, { zaverecna: true })), 0, m.uid)).toEqual({});
  });
});
