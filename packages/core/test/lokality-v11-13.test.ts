// Lokality v11.13 (Michal 2026-11-06): nové efekty Lesnej cesty, Cintorína, Obecného úradu, Skladu,
// Kultúrneho domu, Družstva a Benzínky. Očakávané hodnoty sú z pravidla (PRAVIDLA.md §15), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, Event, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  applySPrisunom,
  bitkaMody,
  cenaDedicstva,
  cenaFajcenia,
  cenaFajceniaHraca,
  cieleVykladania,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  nahladPitky,
  odhadSpakovKola,
  prisunZUdalosti,
  riadkyCakajuceho,
  setupGame,
  spakyZaVyhru,
  kartyBitky,
  stavkaBitky,
  tahBota,
  viewFor,
  vyhladDlhov,
  dopadyNahladu,
} from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][number]>): GameState {
  return { ...s, hraci: (p === 0 ? [{ ...s.hraci[0], ...h }, s.hraci[1]] : [s.hraci[0], { ...s.hraci[1], ...h }]) as unknown as GameState["hraci"] };
}

const pitkaStav = (naTahu: PlayerId): GameState["pitkaStav"] =>
  ({ naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarkaPouzita: [false, false], skryteNaex: [] }) as unknown as GameState["pitkaStav"];

function vPitke(lok: string, strany: GameState["strany"] = [[], []], seed = 7): GameState {
  const s0 = setupGame(data, seed);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok) ?? inst(lok);
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 5, doberaci: [inst("masiar"), inst("vandal"), inst("hasic"), inst("pijan")] })) as unknown as GameState["hraci"];
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

/** Súčet knihy cigariet hráča p v jednom ťahu. */
const kniha = (events: readonly Event[], p: PlayerId): number => events.reduce((a, e) => (e.type === "zmenaCigariet" && e.hrac === p ? a + e.suma : a), 0);

describe("Lesná cesta (v11.13)", () => {
  it("2 tuhé za každé svoje Zviera, na hociktorej strane; súperovo Zviera ani skrytá Záverečná nie", () => {
    const s = vPitke("lesna_cesta", [
      [lezi(inst("pes"), 0), lezi(inst("kapybara"), 1)],
      [lezi(inst("kon"), 0), lezi(inst("pes"), 0, { zaverecna: true })],
    ]);
    expect(bitkaMody(data, s, 0).tuheZdroje).toContainEqual({ zdroj: "lesna_cesta", tuhe: 4 });
    expect(bitkaMody(data, s, 1).tuheZdroje).toContainEqual({ zdroj: "lesna_cesta", tuhe: 2 });
  });

  it("inde Zviera nič navyše nedá", () => {
    const s = vPitke("zastavka", [[lezi(inst("pes"), 0)], []]);
    expect(bitkaMody(data, s, 0).tuheZdroje.some((z) => z.zdroj === "lesna_cesta")).toBe(false);
  });
});

describe("Benzínka (v11.13)", () => {
  it("cena: 0, 2, 3 — poradie ako inde, len prvá platba odpadá", () => {
    expect([0, 1, 2].map((uz) => cenaFajcenia(uz, 1, true))).toEqual([0, 2, 3]);
    expect(cenaFajcenia(0, 3, true)).toBe(5);
    expect([0, 1, 2].map((uz) => cenaFajcenia(uz))).toEqual([1, 2, 3]);
  });

  it("bez cigariet sa prvé dá, karta príde, nerest ani platba nie; druhé už stojí 2", () => {
    const s = sHracom(vPitke("benzinka"), 0, { cigarety: 0, nerestiTotoKolo: 0 });
    expect(cenaFajceniaHraca(s, 0)).toBe(0);
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "smoke", pocet: 1 });
    const { state: po, events } = applySPrisunom(data, s, { type: "smoke", pocet: 1 }, 0);
    expect(po.hraci[0].ruka.length).toBe(s.hraci[0].ruka.length + 1);
    expect(po.hraci[0].cigarety).toBe(0);
    expect(po.hraci[0].nerestiTotoKolo).toBe(0);
    expect(events.some((e) => e.type === "zmenaCigariet")).toBe(false);
    expect(cenaFajceniaHraca(po, 0)).toBe(2);
    expect(legalCommands(data, po, 0).some((c) => c.type === "smoke")).toBe(false);
    // Bez ďalšej voľby hra hráčovu Pitku dohrá sama — druhé fajčenie sa skúša v stave, kde ešte hrá.
    const pitka = po.pitkaStav;
    if (pitka === null) throw new Error("Pitka");
    const hra = { ...sHracom(po, 0, { cigarety: 1 }), pitkaStav: { ...pitka, hotovy: [false, false] as [boolean, boolean], naTahu: 0 as PlayerId } };
    expect(() => apply(data, hra, { type: "smoke", pocet: 1 }, 0)).toThrow(/2 cigarety/);
  });

  it("platí pre každého hráča zvlášť a v každej Pitke znova; pohľad klienta vidí tú istú cenu", () => {
    const s = vPitke("benzinka");
    const po = apply(data, s, { type: "smoke", pocet: 1 }, 0).state;
    expect(cenaFajceniaHraca(po, 1)).toBe(0);
    expect(cenaFajceniaHraca(viewFor(data, po, 0), 0)).toBe(2);
    expect(cenaFajceniaHraca(viewFor(data, po, 1), 1)).toBe(0);
    const pitka = po.pitkaStav;
    if (pitka === null) throw new Error("Pitka");
    expect(cenaFajceniaHraca({ ...po, pitkaStav: { ...pitka, fajcenie: [0, 0] } }, 0)).toBe(0);
  });

  it("zákaz najvzdialenejšej karty zanikol: fajčí aj ten, kto v línii nič nemá", () => {
    const s = vPitke("benzinka", [[], [lezi(inst("masiar"), 1)]]);
    expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(true);
  });

  it("Jednota ďalej zakazuje, Benzínka to neobíde; súperova Krabička zo zadarmo fajčenia kartu nedá", () => {
    const b = sHracom(vPitke("benzinka"), 1, { dedicstvo: [inst("cigorky")] });
    const po = apply(data, b, { type: "smoke", pocet: 1 }, 0).state;
    expect(po.hraci[1].ruka.length).toBe(b.hraci[1].ruka.length);
    const j = sHracom(vPitke("jednota"), 0, { dlhy: 3 });
    expect(legalCommands(data, j, 0).some((c) => c.type === "smoke")).toBe(false);
  });

  it("bot na Benzínke fajčí zadarmo", () => {
    const s = sHracom(vPitke("benzinka"), 0, { cigarety: 0 });
    expect(tahBota(data, s, 0, 1, { povaha: "igor" })).toMatchObject({ type: "smoke" });
  });
});

describe("Sklad (v11.13)", () => {
  const nastroj = (): { s: GameState; vidly: CardInstance; dalsi: CardInstance } => {
    const vidly = inst("vidly");
    const dalsi = inst("furik");
    const s0 = vPitke("sklad");
    return { s: { ...s0, senok: [...s0.senok, vidly], naradie: [dalsi, ...s0.naradie] }, vidly, dalsi };
  };

  it("2 cigarety: Nástroj zo šenku do Dedičstva, z vrchu Náradia príde nový verejne; cena Dedičstva rastie ako vždy", () => {
    const { s, vidly, dalsi } = nastroj();
    const uid = s.ciel?.lokalita?.uid ?? 0;
    const cmd: Command = { type: "kseft", uid, kartaUid: vidly.uid };
    expect(legalCommands(data, s, 0)).toContainEqual(cmd);
    const cena = cenaDedicstva(s);
    const { state: po, events } = applySPrisunom(data, s, cmd, 0);
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(vidly.uid);
    expect(po.hraci[0].cigarety).toBe(5 - KONSTANTY.EFEKT.SKLAD_CENA);
    expect(kniha(events, 0)).toBe(-KONSTANTY.EFEKT.SKLAD_CENA);
    expect(po.senok.map((k) => k.uid)).not.toContain(vidly.uid);
    expect(po.senok.map((k) => k.uid)).toContain(dalsi.uid);
    expect(po.naradie[0]?.uid).not.toBe(dalsi.uid);
    expect(po.naradie).toHaveLength(s.naradie.length - 1);
    expect(cenaDedicstva(po)).toBe(cena + 1);
    // Nový Nástroj je v šenku verejný, súper ho vidí; poradie Náradia nie.
    const uSupera = viewFor(data, po, 1);
    expect(uSupera.senok.map((k) => k.uid)).toContain(dalsi.uid);
    expect(uSupera.naradiePocet).toBe(po.naradie.length);
    expect(JSON.stringify(uSupera)).not.toContain(JSON.stringify(po.naradie[0]));
  });

  it("prázdne Náradie: nepríde nič", () => {
    const { s, vidly } = nastroj();
    const bez = { ...s, naradie: [] };
    const po = apply(data, bez, { type: "kseft", uid: s.ciel?.lokalita?.uid ?? 0, kartaUid: vidly.uid }, 0).state;
    expect(po.senok).toHaveLength(bez.senok.length - 1);
  });

  it("bez Nástroja v šenku ani bez 2 cigariet sa neponúka; Občana server odmietne; raz za Pitku", () => {
    const s = vPitke("sklad");
    const uid = s.ciel?.lokalita?.uid ?? 0;
    expect(legalCommands(data, s, 0).some((c) => c.type === "kseft")).toBe(false);
    expect(() => apply(data, s, { type: "kseft", uid, kartaUid: s.senok[0]?.uid ?? 0 }, 0)).toThrow(/Nástroj/);
    const { s: sn, vidly } = nastroj();
    expect(legalCommands(data, sHracom(sn, 0, { cigarety: 1 }), 0).some((c) => c.type === "kseft")).toBe(false);
    const po = apply(data, sn, { type: "kseft", uid, kartaUid: vidly.uid }, 0).state;
    expect(legalCommands(data, po, 0).some((c) => c.type === "kseft")).toBe(false);
    // Súper ho smie, Kšeft lokality má každý hráč raz za Pitku.
    expect(legalCommands(data, po, 1).some((c) => c.type === "kseft")).toBe(true);
  });

  it("starý Kšeft zanikol: súperov odhadzovací balíček sa nedá vziať", () => {
    const s = sHracom(vPitke("sklad"), 1, { odhadzovaci: [inst("masiar")] });
    expect(legalCommands(data, s, 0).some((c) => c.type === "kseft")).toBe(false);
    expect(() => apply(data, s, { type: "kseft", uid: s.ciel?.lokalita?.uid ?? 0 }, 0)).toThrow(/Nástroj/);
  });
});

describe("Družstvo (v11.13)", () => {
  it("karta s akciou Robota limit nemíňa, Pracujúci bez Roboty áno", () => {
    const koniec = cieleVykladania;
    expect(koniec(data, [[], []], 0, inst("zamocnik"), 0, true, "druzstvo")).toContain("vlastna");
    expect(koniec(data, [[], []], 0, inst("veducko"), 0, true, "druzstvo")).toContain("vlastna");
    // Šofér je Pracujúci, ale Robotu nemá.
    expect(koniec(data, [[], []], 0, inst("sofer"), 0, true, "druzstvo")).toEqual([]);
    expect(koniec(data, [[], []], 0, inst("zamocnik"), 0, true, "krcma")).toEqual([]);
  });
});

describe("Obecný úrad (v11.13)", () => {
  /** Karta s dvoma aktívnymi Cigaretami hráčovi 0 a Obmedzením od súpera by sa skladala ťažko — stačia súčty. */
  const sums = (s: GameState) => evaluateLine(data, lineState(s)).sums;

  it("(akcie − Obmedzenie) × 2: kniha, náhľad a pitkaVysledok sedia", () => {
    let porovnane = 0;
    for (let seed = 1; seed < 400 && porovnane < 8; seed++) {
      const s0 = setupGame(data, seed);
      const ruka = s0.obcania.slice(0, 6);
      for (const a of ruka) {
        for (const b of ruka) {
          const strany: GameState["strany"] = [[lezi(a, 0), lezi(b, 1)], [lezi(b, 1)]];
          const s = vPitke("obecny_urad", strany, seed);
          const su = sums(s);
          const cig = su[0].Cigareta ?? 0;
          const obm = Math.min(cig, su[1].Obmedzenie ?? 0);
          if (cig - obm <= 0) continue;
          const v = nahladPitky(data, s)[0].cigarety;
          expect(v).toMatchObject({ akcie: cig, obmedzenie: obm, urad: cig - obm, zisk: (cig - obm) * 2 });
          const riadky = riadkyCakajuceho(v);
          expect(riadky.reduce((n, r) => n + r.suma, 0)).toBe(v.zisk);
          expect(riadky.at(-1)).toEqual({ zdroj: "obecnyUrad", suma: cig - obm });
          let t = apply(data, s, { type: "skipNaex" }, 0).state;
          const { state: po, events } = applySPrisunom(data, t, { type: "skipNaex" }, 1);
          t = po;
          const vys = events.find((e) => e.type === "pitkaVysledok");
          expect(vys?.type === "pitkaVysledok" ? vys.cigarety[0] : -1).toBe((cig - obm) * 2);
          expect(kniha(events, 0)).toBe(t.hraci[0].cigarety - s.hraci[0].cigarety);
          expect(prisunZUdalosti(events)[0]?.riadky.find((r) => r.zdroj === "obecnyUrad")?.suma).toBe(cig - obm);
          porovnane++;
          break;
        }
        if (porovnane >= 8) break;
      }
    }
    expect(porovnane).toBeGreaterThan(0);
  });

  it("Dlhy z Hazardu sa zdvojnásobia v náhľade, zadĺžení aj výhľade do bitky; Výherný automat: prah ostáva", () => {
    const hazard = vPitkeSHazardom();
    const n = nahladPitky(data, hazard.s)[0];
    expect(n.zadlzenieZoStola).toBe(hazard.dlh * 2);
    expect(n.prahDlhu).toBe(1);
    expect(n.dlhy).toBe(hazard.dlh * 2);
    const sAutomatom = sHracom(hazard.s, 0, { dedicstvo: [inst("vyherny_automat")] });
    const a = nahladPitky(data, sAutomatom)[0];
    expect(a.prahDlhu).toBe(2);
    expect(a.zadlzenieZoStola).toBe(hazard.dlh * 2);
    expect(a.dlhy).toBe(hazard.dlh);
    // Výhľad do bitky: Automat v poslednej Pitke kola dá Dlh, na Úrade dvakrát.
    const vyhlad = vyhladDlhov(data, viewFor(data, sAutomatom, 0), 0)[0];
    expect(vyhlad.nove).toBe(hazard.dlh + 2);
  });

  it("Výherný automat: Dlh v poslednej Pitke kola sa ráta dvakrát", () => {
    const zaklad = vPitke("obecny_urad");
    const s = sHracom({ ...zaklad, pitkyCelkom: 1 }, 0, { dedicstvo: [inst("vyherny_automat")] });
    const pred = s.hraci[0].dlhyZiskane ?? 0;
    const po = apply(data, apply(data, s, { type: "skipNaex" }, 0).state, { type: "skipNaex" }, 1).state;
    expect((po.hraci[0].dlhyZiskane ?? 0) - pred).toBe(2);
    const inde = sHracom({ ...vPitke("most"), pitkyCelkom: 1 }, 0, { dedicstvo: [inst("vyherny_automat")] });
    const poInde = apply(data, apply(data, inde, { type: "skipNaex" }, 0).state, { type: "skipNaex" }, 1).state;
    expect((poInde.hraci[0].dlhyZiskane ?? 0) - (inde.hraci[0].dlhyZiskane ?? 0)).toBe(1);
  });

  it("efekty kariet v Pitke: Poštárka 8 namiesto 4, druhá polovica je v knihe zvlášť a súčet sedí", () => {
    const s0 = vPitke("obecny_urad");
    const e = s0.starsi.find((x) => x.karta.defId === "postarka");
    if (e === undefined) throw new Error("Poštárka v hre nie je.");
    const s: GameState = {
      ...s0,
      starsi: s0.starsi.filter((x) => x !== e),
      vazni: [{ elderId: e.elderId, hrac: 0, poradie: 1, karta: e.karta, scorecard: e.scorecard }] as unknown as GameState["vazni"],
    };
    const { state: po, events } = applySPrisunom(data, s, { type: "schopnostVazna", elderId: e.elderId }, 0);
    expect(po.hraci[0].cigarety - s.hraci[0].cigarety).toBe(2 * KONSTANTY.POSTARKA_CIGARETY);
    expect(kniha(events, 0)).toBe(2 * KONSTANTY.POSTARKA_CIGARETY);
    expect(prisunZUdalosti(events)[0]?.riadky.map((r) => r.zdroj)).toEqual(["postarka", "obecnyUrad"]);
  });

  it("mimo Pitky a mimo Úradu nič: Poštárka v Zhromaždení na Úrade aj v Pitke inde dá 4", () => {
    const s0 = vPitke("zastavka");
    const e = s0.starsi.find((x) => x.karta.defId === "postarka");
    if (e === undefined) throw new Error("Poštárka v hre nie je.");
    const vazni = [{ elderId: e.elderId, hrac: 0, poradie: 1, karta: e.karta, scorecard: e.scorecard }] as unknown as GameState["vazni"];
    const inde: GameState = { ...s0, starsi: s0.starsi.filter((x) => x !== e), vazni };
    expect(apply(data, inde, { type: "schopnostVazna", elderId: e.elderId }, 0).state.hraci[0].cigarety - inde.hraci[0].cigarety).toBe(KONSTANTY.POSTARKA_CIGARETY);
    const urad = vPitke("obecny_urad");
    const uZhrom: GameState = {
      ...urad,
      starsi: urad.starsi.filter((x) => x.elderId !== e.elderId),
      vazni,
      faza: "zhromazdenie",
      pitkaStav: null,
      zhromazdenieStav: { naTahu: 0, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] } as unknown as GameState["zhromazdenieStav"],
    };
    expect(apply(data, uZhrom, { type: "schopnostVazna", elderId: e.elderId }, 0).state.hraci[0].cigarety - uZhrom.hraci[0].cigarety).toBe(KONSTANTY.POSTARKA_CIGARETY);
  });

  it("starý Kšeft (presun Dlhu) zanikol úplne", () => {
    const s = sHracom(vPitke("obecny_urad"), 0, { dlhy: 2, cigarety: 9 });
    expect(legalCommands(data, s, 0).some((c) => c.type === "kseft")).toBe(false);
  });

  it("pohľad klienta aj výhľad cigariet ťahu rátajú dvakrát", () => {
    const s = vPitkeSCigaretou();
    const n = nahladPitky(data, viewFor(data, s.s, 1))[0].cigarety;
    expect(n.zisk).toBe(s.cig * 2);
    const bezKarty = { ...viewFor(data, s.s, 0), strany: [[], []] as unknown as ReturnType<typeof viewFor>["strany"] };
    const d = dopadyNahladu(data, bezKarty, viewFor(data, s.s, 0), 0);
    expect(d[0].cigarety).toBe(s.cig * 2);
  });

  /** Hľadá kartu, ktorá po priložení k lokalite dá hráčovi 0 aktívny Hazard. */
  function vPitkeSHazardom(): { s: GameState; dlh: number } {
    for (const def of data.cards.values()) {
      // Finančná poradkyňa posiela Dlh súperovi, tu sa skúša vlastný.
      if (def.tags.includes("Lokalita") || def.id === "financna_poradkyna") continue;
      const s = vPitke("obecny_urad", [[lezi(inst(def.id), 0)], []]);
      const su = sums(s);
      if ((su[0].Dlh ?? 0) > 0) return { s, dlh: su[0].Dlh ?? 0 };
    }
    throw new Error("V sade nie je karta s aktívnym Hazardom pri Obecnom úrade.");
  }

  function vPitkeSCigaretou(): { s: GameState; cig: number } {
    for (const def of data.cards.values()) {
      if (def.tags.includes("Lokalita")) continue;
      for (const otocena of [false, true]) {
        const s = { ...vPitke("obecny_urad", [[lezi(inst(def.id), 0)], []]), lokalitaOtocena: otocena };
        const su = sums(s);
        if ((su[0].Cigareta ?? 0) > 0) return { s, cig: su[0].Cigareta ?? 0 };
      }
    }
    throw new Error("V sade nie je karta s aktívnou Cigaretou pri Obecnom úrade.");
  }
});

describe("Kultúrny dom (v11.13)", () => {
  const polozena = (n: number, p: PlayerId): PlacedCard => lezi({ uid: 770000 + n, defId: "masiar", leftLayout: 0, rightLayout: 0 }, p);
  const naKulturnom = (tuhe: readonly [number, number], hadka: PlayerId | null, spakyNaSekere = 0): GameState => {
    const s0 = setupGame(data, 5);
    const lokalita = s0.lokalityVHre.find((k) => k.defId === "kulturny_dom") ?? inst("kulturny_dom");
    const b = {
      krok: "hadka",
      caka: null,
      sums: [{ Rana: tuhe[0] }, { Rana: tuhe[1] }],
      exekutorHotovy: [false, false],
      exekutor: [0, 0],
      hadka: { makke: [3, 0], vitaz: hadka, velkost: hadka === null ? 0 : 2, zostava: hadka === null ? 0 : 2, prepadlo: 0, zdvihy: [] },
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: true,
    } as unknown as GameState["bitkaStav"];
    return {
      ...s0,
      faza: "bitka",
      draftStav: null,
      kolo: 2,
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita },
      strany: [[polozena(0, 0), polozena(1, 0), polozena(2, 1)], [polozena(3, 1), polozena(4, 0)]],
      bitkaStav: b,
      spaky: [0, 0],
      spakyNaSekere,
    };
  };
  const zaznam = (s: GameState) => spustBitku(data, s).state.nastenka.at(-1)!;

  it("víťaz aj porazený len za svoje karty; výhra hádky porazeného nepripočíta druhýkrát", () => {
    expect(zaznam(naKulturnom([3, 0], 1)).zaBitku).toEqual([3, 2]);
    expect(zaznam(naKulturnom([0, 3], 0)).zaBitku).toEqual([3, 2]);
  });

  it("zo sekery berie víťaz navyše k svojim kartám", () => {
    expect(zaznam(naKulturnom([3, 0], null, 4)).zaBitku).toEqual([3 + 4, 2]);
  });

  it("sekera: špaky kola ako inde čakajú celé, víťaz hádky hneď za svoje karty raz", () => {
    const s = naKulturnom([2, 2], 1);
    const po = spustBitku(data, s).state;
    expect(po.nastenka.at(-1)).toMatchObject({ vitaz: null, zaBitku: [0, 2] });
    expect(po.spakyNaSekere).toBe(5);
  });

  it("víťaz bez vlastnej karty v línii dostane aspoň 1 špak (§9.4)", () => {
    const s = naKulturnom([3, 0], null);
    const vyplata = spakyZaVyhru({ ...s, strany: [[polozena(5, 1)], []] }, 0, { spolu: 1, vlastne: [0, 1] });
    expect(vyplata).toMatchObject({ zisk: 1, porazenemu: 1, zaHadku: 0 });
  });

  it("stávka a odhad sedia s výplatou", () => {
    const s = naKulturnom([3, 0], 1);
    const karty = kartyBitky(s);
    expect(karty.vlastne).toEqual([3, 2]);
    const v = viewFor(data, s, 0);
    const st = stavkaBitky(v);
    expect(st).toMatchObject({ vyhra: 3, prehra: -2, porazenemu: [3, 2] });
    const linia = evaluateLine(data, lineState(s));
    const odhad = odhadSpakovKola(data, s, linia, { tuhe: [3, 0], makke: [3, 0] } as never);
    expect(odhad.hraci[0].zaBitku).toBe(3);
    expect(odhad.hraci[1].zaBitku).toBe(2);
  });
});

describe("Cintorín (v11.13) pre bota", () => {
  it("bot si vezme lepšiu kartu, Cirhózu nie; so samými kliatbami povie nič", () => {
    const s0 = vPitke("cintorin");
    const dobra = inst("zamocnik");
    const bitka = (odhadzovaci: readonly CardInstance[]): GameState =>
      sHracom(
        {
          ...s0,
          faza: "bitka",
          pitkaStav: null,
          bitkaStav: { krok: "cintorin", caka: 0, sums: [{}, {}], exekutorHotovy: [true, true], exekutor: [0, 0], damage: null, vitaz: 1, prebytokDrzi: null, prebytokZostava: 0, prebytokZdvihy: [], prebytokPrepadlo: 0, spalit: [], vesticaHotova: true } as unknown as GameState["bitkaStav"],
        },
        0,
        { odhadzovaci },
      );
    expect(tahBota(data, bitka([inst("cirhoza"), dobra]), 0, 1, { povaha: "igor" })).toEqual({ type: "cintorin", uid: dobra.uid });
    expect(tahBota(data, bitka([inst("cirhoza")]), 0, 1, { povaha: "igor" })).toEqual({ type: "cintorin", uid: null });
  });
});
