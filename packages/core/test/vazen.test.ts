// Krok 2 revízie starších (pravidlá v9, Michal 2026-10-30): pokus o zajatie, väzeň,
// tretí väzeň = výhra, špaky 8 / 6 / 4 / 2, priazne, viewFor (Kšeft väzňa zrušený v11.2).
// Zadanie: docs/napady/starsi-krok2-zadanie.html (O1–O10).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, Command, ElderState, GameState, PlayerId, Vazen } from "../src/index.ts";
import {
  MOMENTY,
  naladaMomentu,
  apply,
  eventsFor,
  kartaZadarmo,
  krokStavby,
  legalCommands,
  metrika,
  loadGameData,
  naTahu,
  setupGame,
  viewFor,
} from "../src/index.ts";
import { zPolohy } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

function bitka(b: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
   
    exekutor: [0, 0],
    damage: null,
    vitaz: 0,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokZdvihy: [], prebytokPrepadlo: 0,
    spalit: [],
    vesticaHotova: true,
    ...b,
  };
}

/** Strach podľa polohy starej stupnice (zPolohy): 6 = strach hráča 0 na červenej, 0 = hráča 1. */
const sMarkerom = (e: ElderState, marker: number): ElderState => ({ ...e, ...zPolohy(marker) });

/** Stav v kroku pokusu o zajatie: prvý starší sa bojí hráča 0 na stupni 3 (marker 6), druhý hráča 1 (marker 0). */
function predPokusom(seed = 3, cigarety: readonly [number, number] = [2, 2]): GameState {
  const s0 = setupGame(data, seed);
  const starsi = s0.starsi.map((e, i) => (i === 0 ? sMarkerom(e, 6) : i === 1 ? sMarkerom(e, 0) : i === 2 ? sMarkerom(e, 5) : e));
  return {
    ...s0,
    faza: "draft",
    utocnik: 0,
    starsi,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    hraci: [{ ...s0.hraci[0], cigarety: cigarety[0] }, { ...s0.hraci[1], cigarety: cigarety[1] }],
    draftStav: { krok: "zajatie", balicky: [[], []], vyber: [null, null], naTahu: 0, hotovo: [false, false], noveKarty: [0, 0] },
  };
}

/**
 * Bitka na konci (krok prebytok, v11 rozdeľuje víťaz na svoj strach): hráč `p` sa pokúša zajať
 * staršieho `i` (boss v jeho ruke, v10.1), bitku vyhral `vitaz`. Nakladačka 1 zdvihne strach
 * posledného staršieho — po nej sa bitka dohrá.
 */
function poBitke(p: PlayerId, i: number, vitaz: PlayerId | null, upravy: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = setupGame(data, 4);
  const starsi = s0.starsi.map((e, j) => (j === i ? sMarkerom(e, p === 0 ? 6 : 0) : e));
  const elder = starsi[i]!;
  const hraci = s0.hraci.map((h, q) => (q === p ? { ...h, ruka: [...h.ruka, elder.karta] } : h)) as unknown as GameState["hraci"];
  const drzi: PlayerId = vitaz ?? 0;
  const s: GameState = {
    ...s0,
    faza: "bitka",
    starsi,
    hraci,
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    pokusy: p === 0 ? [{ elderId: elder.elderId }, null] : [null, { elderId: elder.elderId }],
    nastenka: [
      { kolo: 1, lokalita: null, vitaz, rozhodlo: "tuhe", pitky: 1, zaBitku: [0, 0], zoSekery: 0, abstakZrazka: 0, prepadlo: 0, zaStarsich: [0, 0], exekutor: [0, 0], prebytok: [0, 0], spakyPo: [0, 0] },
    ],
    bitkaStav: bitka({ krok: "prebytok", caka: drzi, vitaz, prebytokDrzi: drzi, prebytokZostava: 1 }),
  };
  return upravy(s);
}

function dohrajBitku(s: GameState): GameState {
  const b = s.bitkaStav as BitkaStav;
  const posledny = s.starsi.at(-1)!;
  let po = apply(data, s, { type: "prebytok", zdvihy: [{ elderId: posledny.elderId, na: 1 }] }, b.caka as PlayerId).state;
  for (let i = 0; i < 30 && po.koniec === null && po.faza === "bitka"; i++) {
    const q = naTahu(po) as PlayerId;
    const c = legalCommands(data, po, q)[0];
    if (c === undefined) break;
    po = apply(data, po, c, q).state;
  }
  return po;
}

describe("§10 Pokus o zajatie — podmienka, cena, poradie", () => {
  it("pokus len na staršieho, ktorý sa ťa bojí na stupni 3; cigareta prepadne a boss ide pokúšajúcemu do ruky (v10.1)", () => {
    const s = predPokusom();
    const legal = legalCommands(data, s, 0);
    expect(legal).toContainEqual({ type: "bezPokusu" });
    const pokusy = legal.filter((c) => c.type === "pokus");
    // Hráča 0 sa bojí len prvý starší (marker 6 = červená na polovici hráča 1).
    expect(pokusy).toEqual([{ type: "pokus", elderId: s.starsi[0]!.elderId }]);
    const po = apply(data, s, pokusy[0] as Command, 0).state;
    expect(po.hraci[0].cigarety).toBe(1);
    expect(po.hraci[0].ruka.some((k) => k.uid === s.starsi[0]!.karta.uid)).toBe(true);
    expect(po.hraci[1].ruka.some((k) => k.uid === s.starsi[0]!.karta.uid)).toBe(false);
    expect(po.pokusy[0]).toEqual({ elderId: s.starsi[0]!.elderId });
    // Rozhoduje obranca — vidí voľbu útočníka a má vlastného kandidáta.
    expect(naTahu(po)).toBe(1);
    expect(legalCommands(data, po, 1).filter((c) => c.type === "pokus")).toEqual([{ type: "pokus", elderId: s.starsi[1]!.elderId }]);
  });

  it("každý najviac jeden pokus za kolo; obaja smú, každý iného staršieho; potom stavba šenku (v10.1)", () => {
    let s = predPokusom();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    expect(() => apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 1)).toThrow();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[1]!.elderId }, 1).state;
    expect(s.faza).toBe("draft");
    expect(s.draftStav?.krok).toBe("stavba");
    expect(s.pokusy.map((x) => x?.elderId)).toEqual([s.starsi[0]!.elderId, s.starsi[1]!.elderId]);
  });

  it("bez cigarety pokus nie je — hra ho preskočí a dôvod povie len hráčovi", () => {
    const s = predPokusom(3, [0, 0]);
    expect(legalCommands(data, s, 0)).toEqual([{ type: "bezPokusu" }]);
    const r = apply(data, { ...s, draftStav: { ...s.draftStav!, naTahu: 0 } }, { type: "bezPokusu" }, 0);
    expect(r.state.draftStav?.krok).toBe("stavba");
  });

  it("O7 (v11): na staršieho v ohrození nikto nedvíha — ani strach Nakladačkou, ani reči hádkou", () => {
    const s0 = predPokusom();
    const id = s0.starsi[0]!.elderId;
    const s: GameState = {
      ...s0,
      faza: "bitka",
      draftStav: null,
      pokusy: [{ elderId: id }, null],
      bitkaStav: bitka({ krok: "prebytok", caka: 1, prebytokDrzi: 1, prebytokZostava: 9 }),
    };
    const zdvihy = (c: Command): readonly string[] => (c.type === "prebytok" || c.type === "reci" ? c.zdvihy.map((z) => z.elderId) : []);
    expect(legalCommands(data, s, 1).some((c) => zdvihy(c).includes(id))).toBe(false);
    expect(() => apply(data, s, { type: "prebytok", zdvihy: [{ elderId: id, na: 1 }] }, 1)).toThrow(/pokus o zajatie/);
    const sReci: GameState = { ...s, bitkaStav: bitka({ krok: "reci", caka: 1, hadka: { makke: [0, 4], vitaz: 1, velkost: 4, zostava: 4, prepadlo: 0, zdvihy: [] } }) };
    expect(legalCommands(data, sReci, 1).some((c) => zdvihy(c).includes(id))).toBe(false);
    expect(() => apply(data, sReci, { type: "reci", zdvihy: [{ elderId: id, na: 1 }] }, 1)).toThrow(/pokus o zajatie/);
  });
});

describe("§5 Pokus pred stavbou šenku a karta zadarmo (v10.1, Michal 2026-11-01)", () => {
  /** Od voľby cieľa: obranca (hráč 1) vyberie lokalitu, útočník (hráč 0) smie skúsiť zajať prvého staršieho. */
  function poVolbeCiela(): GameState {
    const s0 = predPokusom();
    const s: GameState = { ...s0, faza: "volbaCiela", ciel: null, draftStav: null };
    const volba = legalCommands(data, s, 1).find((c) => c.type === "chooseLocation") as Command;
    return apply(data, s, volba, 1).state;
  }

  /** Stavba podľa pravidla: karta zadarmo (ak je) prvá, potom do šenku, zvyšok naspodok. */
  function stavba(s: GameState, p: PlayerId): Command {
    const b = s.draftStav!.balicky[p];
    const krok = krokStavby(b.length, kartaZadarmo(s, p));
    const zvysok = b.slice(krok.nechaj);
    return {
      type: "stavbaSenku",
      doSenku: zvysok.slice(0, krok.doSenku).map((k) => k.uid),
      odhod: zvysok.slice(krok.doSenku).map((k) => k.uid),
      ...(krok.nechaj === 1 ? { nechaj: b[0]!.uid } : {}),
    };
  }

  it("poradie: voľba cieľa → pokus o zajatie (útočník, potom obranca) → stavba šenku → branie → Zhromaždenie", () => {
    let s = poVolbeCiela();
    expect(s.draftStav?.krok).toBe("zajatie");
    expect(s.draftStav?.naTahu).toBe(0);
    expect(s.draftStav?.balicky).toEqual([[], []]);
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    expect(s.draftStav?.naTahu).toBe(1);
    s = apply(data, s, { type: "bezPokusu" }, 1).state;
    expect(s.draftStav?.krok).toBe("stavba");
    expect(s.draftStav?.balicky[0]).toHaveLength(8);
    for (const p of [1, 0] as const) s = apply(data, s, stavba(s, p), p).state;
    expect(s.draftStav?.krok).toBe("beranie");
    for (let i = 0; i < 10 && s.faza === "draft"; i++) {
      const q = naTahu(s) as PlayerId;
      s = apply(data, s, { type: "draftStop" }, q).state;
    }
    expect(s.faza).toBe("zhromazdenie");
    expect(s.draftStav).toBeNull();
  });

  it("krokStavby: kto má kartu zadarmo, z 8 si nechá 1, 4 do šenku, 3 naspodok; pri menšom balíčku najprv 1, zvyšok napoly", () => {
    expect(krokStavby(8)).toEqual({ nechaj: 0, doSenku: 4, odhod: 4 });
    expect(krokStavby(8, true)).toEqual({ nechaj: 1, doSenku: 4, odhod: 3 });
    expect(krokStavby(6, true)).toEqual({ nechaj: 1, doSenku: 3, odhod: 2 });
    expect(krokStavby(2, true)).toEqual({ nechaj: 1, doSenku: 1, odhod: 0 });
    expect(krokStavby(0, true)).toEqual({ nechaj: 0, doSenku: 0, odhod: 0 });
  });

  it("súper pokúšajúceho si nechá 1 kartu zadarmo do ruky; pokúšajúci nie; šenok má stále 8 kariet", () => {
    let s = poVolbeCiela();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    s = apply(data, s, { type: "bezPokusu" }, 1).state;
    expect(kartaZadarmo(s, 1)).toBe(true);
    expect(kartaZadarmo(s, 0)).toBe(false);
    expect(legalCommands(data, s, 1).every((c) => c.type === "stavbaSenku" && c.nechaj !== undefined && c.odhod.length === 3)).toBe(true);
    expect(legalCommands(data, s, 0).every((c) => c.type === "stavbaSenku" && c.nechaj === undefined && c.odhod.length === 4)).toBe(true);
    // Bez karty zadarmo (či s ňou, keď na ňu nemá nárok) stavba neprejde.
    const b1 = s.draftStav!.balicky[1];
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: b1.slice(0, 4).map((k) => k.uid), odhod: b1.slice(4).map((k) => k.uid) }, 1)).toThrow(/nechaj/);
    const b0 = s.draftStav!.balicky[0];
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: b0.slice(1, 5).map((k) => k.uid), odhod: b0.slice(5).map((k) => k.uid), nechaj: b0[0]!.uid }, 0)).toThrow();
    const ruka1 = s.hraci[1].ruka.length;
    const nechana = b1[0]!;
    s = apply(data, s, stavba(s, 1), 1).state;
    s = apply(data, s, stavba(s, 0), 0).state;
    expect(s.hraci[1].ruka).toHaveLength(ruka1 + 1);
    expect(s.hraci[1].ruka.some((k) => k.uid === nechana.uid)).toBe(true);
    expect(s.senok).toHaveLength(8);
    // Karta zadarmo nie je karta zo šenku — prvý ťah obrancu v braní ostáva 1 karta.
    expect(s.draftStav?.noveKarty).toEqual([0, 0]);
  });

  it("keď skúšajú obaja (každý iného staršieho), karta zadarmo nie je nikomu", () => {
    let s = poVolbeCiela();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    s = apply(data, s, { type: "pokus", elderId: s.starsi[1]!.elderId }, 1).state;
    expect(s.draftStav?.krok).toBe("stavba");
    expect([kartaZadarmo(s, 0), kartaZadarmo(s, 1)]).toEqual([false, false]);
    for (const p of [0, 1] as const) {
      expect(legalCommands(data, s, p).every((c) => c.type === "stavbaSenku" && c.nechaj === undefined && c.doSenku.length === 4 && c.odhod.length === 4)).toBe(true);
      expect(s.hraci[p].ruka.some((k) => k.uid === s.starsi[p]!.karta.uid)).toBe(true);
    }
  });

  it("viewFor a eventsFor (nemenné pravidlo 2): pokúšajúci nevidí, ktorú kartu si súper nechal, ani zvyšok jeho stavby", () => {
    let s = poVolbeCiela();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    s = apply(data, s, { type: "bezPokusu" }, 1).state;
    const b1 = s.draftStav!.balicky[1];
    const cmd = stavba(s, 1) as Extract<Command, { type: "stavbaSenku" }>;
    const nechana = b1.find((k) => k.uid === cmd.nechaj)!;
    const tajne = b1.filter((k) => !cmd.doSenku.includes(k.uid)).map((k) => k.uid);
    expect(tajne).toContain(nechana.uid);
    const obsahuje = (json: string, uid: number): boolean => new RegExp(`"uid":${uid}[,}]`).test(json);
    // Súper už vybral, pokúšajúci ešte nie: jeho výber ani balíček stavby nevidno.
    s = apply(data, s, cmd, 1).state;
    const pocas = JSON.stringify(viewFor(data, s, 0));
    for (const uid of b1.map((k) => k.uid)) expect(obsahuje(pocas, uid)).toBe(false);
    expect(JSON.stringify(viewFor(data, s, 1))).toContain(`"nechaj":${nechana.uid}`);
    // Po odhalení: do šenku verejne, karta zadarmo a naspodok nie.
    const r = apply(data, s, stavba(s, 0), 0);
    const po = JSON.stringify(viewFor(data, r.state, 0));
    for (const uid of tajne) expect(obsahuje(po, uid)).toBe(false);
    expect(viewFor(data, r.state, 0).hraci[1].rukaPocet).toBe(r.state.hraci[1].ruka.length);
    const meno = data.cards.get(nechana.defId)!.name;
    const verejne = eventsFor(r.events, 0).map((e) => (e.type === "log" ? e.text : "")).join("\n");
    expect(verejne).toMatch(/nechal|nechala|necháva/);
    expect(verejne.includes(`Zadarmo do ruky`)).toBe(false);
    // Meno môže byť aj na karte do šenku — tajná je len súkromná správa.
    expect(eventsFor(r.events, 1).some((e) => e.type === "log" && e.text === `Zadarmo do ruky: ${meno}.`)).toBe(true);
  });
});

describe("§10 Výsledok pokusu (krok 6d)", () => {
  it("víťaz zajme: starší zmizne zo stupnice, je väzeň (1. v partii), karta odíde z jeho ruky; súper bez markera nič neodovzdá", () => {
    const s = poBitke(0, 0, 0);
    const elder = s.starsi[0]!;
    const po = dohrajBitku(s);
    expect(po.starsi.some((e) => e.elderId === elder.elderId)).toBe(false);
    expect(po.vazni).toHaveLength(1);
    expect(po.vazni[0]).toMatchObject({ elderId: elder.elderId, hrac: 0, poradie: 1 });
    expect(po.hraci[0].ruka.some((k) => k.uid === elder.karta.uid)).toBe(false);
    expect(po.hraci[0].odhadzovaci.some((k) => k.uid === elder.karta.uid)).toBe(false);
    expect(po.nastenka.at(-1)?.kradez).toBeUndefined();
    expect(po.pokusy).toEqual([null, null]);
  });

  it("porazený: starší späť na ukazovateľ a strach pokúšajúceho pri ňom klesne na 0 (v11)", () => {
    const s = poBitke(0, 0, 1);
    const elder = s.starsi[0]!;
    const po = dohrajBitku(s);
    const e = po.starsi.find((x) => x.elderId === elder.elderId)!;
    expect(e.strach).toEqual([0, 0]);
    expect(e.karta.uid).toBe(elder.karta.uid);
    expect(po.vazni).toHaveLength(0);
    expect(po.hraci[0].ruka.some((k) => k.uid === elder.karta.uid)).toBe(false);
  });

  it("sekera: pokus zlyhá", () => {
    const po = dohrajBitku(poBitke(0, 0, null));
    expect(po.vazni).toHaveLength(0);
    expect(po.starsi[0]!.strach[0]).toBe(0);
  });

  it("boss vyložený pokúšajúcim do línie sa po bitke vráti aj tak — nezostane v odhadzovacom balíčku", () => {
    const s = poBitke(0, 0, 1, (st) => ({
      ...st,
      hraci: [{ ...st.hraci[0], ruka: st.hraci[0].ruka.filter((k) => k.uid !== st.starsi[0]!.karta.uid) }, st.hraci[1]],
      strany: [[{ card: st.starsi[0]!.karta, playedBy: 0 }], []],
    }));
    const po = dohrajBitku(s);
    const uid = s.starsi[0]!.karta.uid;
    expect(po.hraci[0].odhadzovaci.some((k) => k.uid === uid)).toBe(false);
    expect(po.starsi.find((e) => e.elderId === s.starsi[0]!.elderId)?.karta.uid).toBe(uid);
  });

  it("väzni na výhru (Druhá liga 3) = výhra hneď, bez konečných špakov", () => {
    const s = poBitke(0, 0, 0, (st) => {
      const vazni: Vazen[] = [5, 6].map((j, i) => ({ elderId: st.starsi[j]!.elderId, hrac: 0, poradie: i + 1, karta: st.starsi[j]!.karta, scorecard: st.starsi[j]!.scorecard, miesto: j }));
      return { ...st, vazni, starsi: st.starsi.filter((_, j) => j !== 5 && j !== 6) };
    });
    const po = dohrajBitku(s);
    expect(po.koniec?.vitaz).toBe(0);
    expect(po.koniec?.body).toBeNull();
    expect(po.koniec?.dovod).toMatch(/výhra väzňami/);
  });
});

// Špaky za väzňov 8 / 6 / 4 / 2 (v9) zanikli s v11 — nahradila ich krádež (strach-reci.test.ts).

// Kšeft väzňa (v9) zrušila v11.2 schopnosť väzňa — testy v schopnost-vazna.test.ts.

describe("viewFor (nemenné pravidlo 2) — pokus, boss a väzni", () => {
  it("pokus, väzni a Kšefty kola sú verejné; zvyšok súperovej ruky nie", () => {
    let s = predPokusom();
    s = apply(data, s, { type: "pokus", elderId: s.starsi[0]!.elderId }, 0).state;
    const v0 = viewFor(data, s, 0);
    expect(v0.pokusy[0]).toEqual({ elderId: s.starsi[0]!.elderId });
    expect(v0.hraci[1].rukaPocet).toBe(s.hraci[1].ruka.length);
    const json = JSON.stringify(v0);
    for (const k of s.hraci[1].ruka) {
      const boss = k.uid === s.starsi[0]!.karta.uid;
      // Boss je verejný (karta staršieho v starsi), ostatné karty súperovej ruky nesmú prejsť.
      if (!boss) expect(json.includes(`"uid":${k.uid},`)).toBe(false);
    }
  });
});

describe("achievementy a Melichar pri zajatí (Michal 2026-10-30)", () => {
  it("Prvý väzeň, Zachránené (zmarený pokus) a Hrôza a des (tretí väzeň) merajú zajatie; ids ostali — kto ich má, nestratí ich", async () => {
    const katalog = (await import("../data/achievementy.json")).default as { achievementy: { id: string; metrika: string }[] };
    const metrika = (id: string): string | undefined => katalog.achievementy.find((a) => a.id === id)?.metrika;
    expect(metrika("budicek")).toBe("prvyVazen");
    expect(metrika("zachranene")).toBe("zmarenyPokus");
    expect(metrika("hroza-a-des")).toBe("vyhraVydesenim");
    expect(katalog.achievementy.some((a) => a.metrika === "moment.prebudenie" || a.metrika === "moment.zachranene")).toBe(false);
  });

  it("Melichar: zajatie hráčom je pohoda, zajatie súperom (botom) hráčovi smola", () => {
    const m = { typ: "zajatie", ...MOMENTY.zajatie, hrac: 1, popis: "" } as const;
    expect(naladaMomentu(m, 1)).toBe("pohoda");
    expect(naladaMomentu(m, 0)).toBe("smola");
  });
});

describe("metriky zajatia (achievementy v9)", () => {
  const krok = (pred: GameState, po: GameState) => ({ pred, po }) as unknown as Parameters<NonNullable<ReturnType<typeof metrika>>["zmer"]>[0];
  it("prvyVazen: prvý väzeň partie; zmarenyPokus: súperov pokus zlyhal mojou výhrou", () => {
    const s = poBitke(0, 0, 0);
    const vyhral = dohrajBitku(s);
    expect(metrika("prvyVazen")?.zmer(krok(s, vyhral))).toEqual([1, null]);
    expect(metrika("zmarenyPokus")?.zmer(krok(s, vyhral))).toEqual([null, null]);
    const s1 = poBitke(0, 0, 1);
    const zmaril = dohrajBitku(s1);
    expect(metrika("prvyVazen")?.zmer(krok(s1, zmaril))).toEqual([null, null]);
    expect(metrika("zmarenyPokus")?.zmer(krok(s1, zmaril))).toEqual([null, 1]);
  });
});
