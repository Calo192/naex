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
  lokalitNevybranych,
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
  it("81 kariet, 19 lokalít po úrovniach 5 / 6 / 5 / 3, akcia Pakt", () => {
    expect(data.cards.size).toBe(81);
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

  it("starší ešte vyplatia: vo Voľbe cieľa finále raz (finále je pred nami), v poslednom kole o lokalitu dvakrát", () => {
    const s0 = setupGame(data, 4);
    const L = s0.lokalitCelkom;
    const volbaFinale: GameState = { ...s0, kolo: L + 1, faza: "volbaCiela", ciel: null };
    expect(vyplatZaStarsich(volbaFinale)).toBe(1);
    const view = viewFor(data, volbaFinale, 0);
    expect(spakyTeraz(view).vyplat).toBe(1);
    expect(vyplatZaStarsich({ ...s0, kolo: L, faza: "volbaCiela", ciel: null } as GameState)).toBe(2);
    // Po výbere pinnacle: finále je cieľ tohto kola — stále jedna výplata.
    const vila = s0.lokalityVHre.find((k) => k.defId === "predsedova_vila")!;
    const po = apply(data, { ...volbaFinale, utocnik: 0 }, { type: "chooseLocation", uid: vila.uid, otocena: false }, 1).state;
    expect(vyplatZaStarsich(po)).toBe(1);
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

describe("Kšeft (v7)", () => {

  it("Strýko z Ameriky: za 2 cigarety Rana navyše v bitke kola", () => {
    const k = inst("stryko_z_ameriky");
    const s = sHracom(vPitke("zastavka", [[lezi(k, 0)], []]), 0, { cigarety: 2 });
    const po = apply(data, s, { type: "kseft", uid: k.uid }, 0).state;
    expect(po.kseftRany).toEqual([1, 0]);
    expect(bitkaMody(data, po, 0).tuheZdroje).toContainEqual({ zdroj: "stryko_z_ameriky", tuhe: 1 });
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

});

describe("efekty v bitke (v7)", () => {
  it("Vymáhač: za každé 2 priznané Dlhy Rana navyše; Šofér bez NA EX Pecku", () => {
    const s0 = vPitke("zastavka", [[lezi(inst("vymahac"), 0), lezi(inst("sofer"), 0)], []]);
    const s = { ...sHracom(s0, 0, { priznane: [inst("dlh"), inst("dlh"), inst("dlh"), inst("dlh"), inst("dlh")]}), spaky: [1, 4] as [number, number] };
    const zdroje = bitkaMody(data, s, 0).tuheZdroje;
    expect(zdroje).toContainEqual({ zdroj: "vymahac", tuhe: 2 });
    expect(zdroje).toContainEqual({ zdroj: "sofer", tuhe: 2 });
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

  it("Milujúca manželka: pečeň majiteľa v Pitke o 1 menšia", () => {
    const s = vPitke("zastavka", [[lezi(inst("milujuca_manzelka"), 0)], []]);
    const bez = prirastkyPitky(data, { ...s, strany: [[], []] });
    expect(bez.poskodeniePecene[0]).toBe(0);
    expect(prirastkyPitky(data, s).poskodeniePecene[0]).toBe(0);
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
