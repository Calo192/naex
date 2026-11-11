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
  hranyNastroja,
  legalCommands,
  lineState,
  loadGameData,
  lokalitNevybranych,
  moznostiNaex,
  naexCieleVLinii,
  pocetPitiek,
  prirastkyPitky,
  POVAHY,
  setupGame,
  spakyTeraz,
  tahBota,
  urovenLokality,
  viewFor,
  vyplatZaStarsich,
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
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Koľko akcie dá karta `defId` hráča 0 ako akciu navyše (skryté akcie, §6) — v súčtoch línie. */
function navyse(s: GameState, defId: string, akcia: "Rana" | "Pecka"): number {
  const zdroje = evaluateLine(data, lineState(s)).zdroje[0][akcia] ?? [];
  return zdroje.filter((z) => z.defId === defId && z.dovody.some((d) => d.startsWith("akcia navyše"))).reduce((n, z) => n + z.hodnota, 0);
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

describe("sada v7 — dáta", () => {
  it("96 kariet (sada v51 bez Presbitera a Kohúta, + Poľovník, Predavačka a Vedúcko 2026-11-02), 19 lokalít po úrovniach 5 / 6 / 5 / 3, akcia Pakt", () => {
    expect(data.cards.size).toBe(96);
    const urovne = [1, 2, 3, 4].map((u) => data.lokality.filter((l) => urovenLokality(data, l.id) === u).length);
    expect(urovne).toEqual([5, 6, 5, 3]);
    expect((cardsJson as { actions: string[] }).actions).toContain("Pakt");
    // Lokalita má na oboch hranách rovnako akcií a jediný variant.
    for (const l of data.lokality) expect(cardVariants(l).total, l.id).toBe(1);
  });

  it("počty variantov podľa typu karty (Michal 2026-11-03, identita kariet): Starší 1, Občan 4–8, Zviera 2–4, Nástroj 1 s dvoma hranami", () => {
    for (const def of data.cards.values()) {
      if (["Lokalita", "Kliatba"].some((t) => def.tags.includes(t as never))) continue;
      const v = cardVariants(def).total;
      // Nástroj nemá sloty, len hornú a dolnú hranu v texte (rework Náradia, Michal 2026-11-08).
      if (def.tags.includes("Nástroj")) {
        expect(v, def.id).toBe(1);
        expect(hranyNastroja(def), def.id).toMatchObject({ horna: expect.anything(), dolna: expect.anything() });
        continue;
      }
      const [od, po] = def.tags.includes("Starešina") ? [1, 1] : def.tags.includes("Občan") ? [4, 8] : [2, 4];
      expect(v, def.id).toBeGreaterThanOrEqual(od);
      expect(v, def.id).toBeLessThanOrEqual(po);
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

  it("lokality na výber nie sú lokality v hre: vo finále klient nedostane zvyšok sady, nevybraných je 0", () => {
    const s0 = setupGame(data, 4);
    const L = s0.lokalitCelkom;
    // Voľba cieľa 1. kola: 5 lokalít úrovne 1 na výber, nevybraných L (celá hra pred nami).
    expect(viewFor(data, s0, 1).lokalityVHre).toHaveLength(5);
    expect(lokalitNevybranych(viewFor(data, s0, 1))).toBe(L);
    expect(lokalitNevybranych({ ...s0, kolo: 2, faza: "draft", ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! } } as GameState)).toBe(L - 2);
    // Voľba cieľa finále: len pinnacle (úroveň 4), lokalít už nie.
    const volbaFinale: GameState = { ...s0, kolo: L + 1, faza: "volbaCiela", ciel: null, utocnik: 0 };
    const naVyber = viewFor(data, volbaFinale, 1).lokalityVHre;
    expect(naVyber.length).toBeGreaterThan(0);
    for (const k of naVyber) expect(urovenLokality(data, k.defId)).toBe(4);
    expect(lokalitNevybranych(volbaFinale)).toBe(0);
    // Finále beží: niet čo vyberať — predtým view poslal všetky zvyšné lokality sady.
    const vila = s0.lokalityVHre.find((k) => k.defId === "predsedova_vila")!;
    const finale = apply(data, volbaFinale, { type: "chooseLocation", uid: vila.uid, otocena: false }, 1).state;
    expect(finale.lokalityVHre.length).toBeGreaterThan(10);
    for (const p of [0, 1] as const) {
      expect(viewFor(data, finale, p).lokalityVHre).toEqual([]);
      expect(lokalitNevybranych(viewFor(data, finale, p))).toBe(0);
    }
  });
});

describe("efekty v bitke (v7)", () => {
  it("Vymáhač: za každé 2 priznané Dlhy Rana navyše; Šofér bez NA EX Pecku", () => {
    const s0 = vPitke("zastavka", [[lezi(inst("vymahac"), 0), lezi(inst("sofer"), 0)], []]);
    const s = { ...sHracom(s0, 0, { dlhy: 5}), spaky: [1, 4] as [number, number] };
    // Skryté akcie (Michal 2026-11-08): Rana a Pecka navyše idú do súčtov línie, nie medzi bonusy bitky.
    expect(navyse(s, "vymahac", "Rana")).toBe(2);
    expect(navyse(s, "sofer", "Pecka")).toBe(1);
    expect(bitkaMody(data, s, 0).tuheZdroje.some((z) => z.zdroj === "vymahac" || z.zdroj === "sofer")).toBe(false);
    expect(navyse({ ...s, naexVKole: [true, false] }, "sofer", "Pecka")).toBe(0);
  });

  // Dlh bez prevahy dáva od 2026-11-08 len zápis „Posledná Pitka kola: … {Dlh}“ (skolitelia.test.ts).
  it("Traktorista (v12, Michal 2026-11-11): s prevahou v jeho kraji Pecka navyše, bez nej nič; tuhé navyše starej sady nie", () => {
    const t = inst("traktoristka");
    const s = vPitke("zastavka", [[lezi(t, 0)], []]);
    expect(navyse(s, "traktoristka", "Pecka")).toBe(1);
    // Bez zápisu Bitky nesmie nastúpiť ani tuhé navyše starej sady.
    expect(bitkaMody(data, s, 0).tuheZdroje.some((z) => z.zdroj === "traktoristka")).toBe(false);
    // Súperove dve karty v jeho kraji — prevahu má súper.
    const bez = vPitke("zastavka", [[lezi(t, 0), lezi(inst("masiar"), 1), lezi(inst("masiar"), 1)], []]);
    expect(navyse(bez, "traktoristka", "Pecka")).toBe(0);
  });

  it("Milujúca manželka: pečeň majiteľa v Pitke o 1 menšia", () => {
    const s = vPitke("zastavka", [[lezi(inst("milujuca_manzelka"), 0)], []]);
    const bez = prirastkyPitky(data, { ...s, strany: [[], []] });
    expect(bez.poskodeniePecene[0]).toBe(0);
    expect(prirastkyPitky(data, s).poskodeniePecene[0]).toBe(0);
  });

  it("Injekcia (id lievik): NA EX aj na Zviera", () => {
    const s = vPitke("zastavka", [[lezi(inst("kon"), 0), lezi(inst("pes"), 0)], []]);
    const bez = naexCieleVLinii(data, lineState(s), 0);
    const s2 = naexCieleVLinii(data, lineState(s), 0, true);
    expect(s2.length).toBeGreaterThanOrEqual(bez.length);
    expect(bez.some((uid) => s.strany[0].some((pl) => pl.card.uid === uid))).toBe(false);
  });
});

describe("Nástup (v7)", () => {


});

describe("D6: zadĺženie neprepadá", () => {
  it("zvyšok zadĺženia ostane na účte a s ďalšou Pitkou dá Dlh", () => {
    // Zvyšok pod prahom má od v11.8 len majiteľ Výherného automatu (prah 2).
    const s = sHracom(vPitke("zastavka", [[], []]), 0, { zadlzenie: 1, dedicstvo: [inst("vyherny_automat")] });
    let st = s;
    for (let i = 0; i < 2 && st.faza === "pitka"; i++) st = apply(data, st, { type: "skipNaex" }, st.pitkaStav!.naTahu).state;
    expect(st.hraci[0].zadlzenie).toBe(1);
    // Line stále bez Dlhov: Pakt ani karty nič nepridajú, účet čaká.
    expect(evaluateLine(data, lineState(st)).sums[0].Dlh ?? 0).toBe(0);
  });
});

describe("limit NA EX v7", () => {
  it("po minutom limite nejde NA EX ani na vlastného Anonymného alkoholika (placatka vypadla)", () => {
    const aa = inst("anonymny_alkoholik");
    const s = sHracom(vPitke("zastavka", [[lezi(aa, 0), lezi(inst("pijan"), 0)], [lezi(inst("vandal"), 1)]]), 0, { poldeciPlne: 3 });
    expect(moznostiNaex(data, s, 0)).toContain(aa.uid);
    const minuty: GameState = { ...s, pitkaStav: { ...s.pitkaStav!, naexPouzity: [true, false] } };
    expect(moznostiNaex(data, minuty, 0)).toEqual([]);
  });
});

describe("bot v7: Policajtka", () => {
  // Kópia Policajtky s iným id: rovnaké akcie aj tagy, ale bez jej efektu.
  const sada = cardsJson as { cards: { id: string; name: string; triggers: string[]; effect_text: string }[] };
  const kopia = { ...sada.cards.find((c) => c.id === "policajtka")!, id: "policajtka_bez_efektu", name: "Policajtka bez efektu", triggers: [], effect_text: "" };
  const dataKopia = loadGameData({ ...sada, cards: [...sada.cards, kopia] }, eldersJson, scorecardsJson);

  it("za NA EX nečaká Dlh od súperovej Policajtky — vo v7 má len Konflikt", () => {
    // Prípady, v ktorých bot do opravy kvôli Policajtke NA EX vynechal (Sklad, Vínna pivnica).
    for (const seed of [4, 5, 9]) {
      for (const lok of ["sklad", "vinna_pivnica"]) {
        const stav = (defId: string): GameState => {
          uidSeq = 975000;
          const s = vPitke(lok, [[lezi(inst("pijan"), 0), lezi(inst("masiar"), 0)], [lezi(inst(defId), 1), lezi(inst("vandal"), 1)]], seed);
          return sHracom(sHracom({ ...s, pitkyCelkom: 2 }, 0, { poldeciPlne: 2, cigarety: 3 }), 1, { poldeciPlne: 2 });
        };
        for (const povaha of POVAHY) {
          const s = tahBota(dataKopia, stav("policajtka"), 0, seed, { povaha: povaha.id });
          const bez = tahBota(dataKopia, stav("policajtka_bez_efektu"), 0, seed, { povaha: povaha.id });
          expect(s, `${povaha.id} ${lok} seed ${seed}`).toEqual(bez);
        }
      }
    }
  });
});
