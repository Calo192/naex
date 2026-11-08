// Offline protihráč: hrá len legálne, dohrá partiu, porazí náhodného hráča
// a rozhoduje sa len z toho, čo by vedel hráč pri stole.

import { spustBitku } from "./helpers.ts";
import { cervenychHraca, timMiesta } from "../src/index.ts";
import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Command, ElderState, GameState, PlayerId } from "../src/index.ts";
import {
  DLZKY_HRY,
  POVAHY,
  VYRADENE_POVAHY,
  menoPovahy,
  apply,
  favourStarsieho,
  hodnotaKarty,
  legalCommands,
  loadGameData,
  mozeHrat,
  naTahu,
  rngInt,
  rngSeed,
  rngShuffle,
  setupGame,
  tahBota,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Kto teraz smie hrať — pri stavbe šenku hrajú obaja, najprv ten, kto ešte nevybral. */
function kto(s: GameState): PlayerId | null {
  return ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
}

/** Partia bota proti hráčovi `super_` (null = bot proti botu); vráti koniec a stavy, kde ťahal bot. */
function odohraj(
  seed: number,
  botSeat: PlayerId,
  super_: "nahodny" | "bot",
  povahy: readonly [string, string] = ["igor", "igor"],
): { state: GameState; stavyBota: GameState[] } {
  // 5 lokalít (do 2026-10-24 krátka hra) — krátka s 3 dá málo ťahov bota na porovnania.
  let s = setupGame(data, seed, { lokalit: DLZKY_HRY.stredna });
  let rng = rngSeed(seed * 7 + 1);
  const stavyBota: GameState[] = [];
  for (let krok = 0; s.koniec === null && krok < 5000; krok++) {
    const p = kto(s);
    if (p === null) break;
    const [n, r] = rngInt(rng, 2 ** 31);
    rng = r;
    let cmd: Command;
    if (p === botSeat || super_ === "bot") {
      if (p === botSeat) stavyBota.push(s);
      cmd = tahBota(data, s, p, n, { povaha: povahy[p] });
    } else {
      const cmds = legalCommands(data, s, p);
      cmd = cmds[n % cmds.length] as Command;
    }
    // apply hodí výnimku pri nelegálnom ťahu — test by spadol.
    s = apply(data, s, cmd, p).state;
  }
  return { state: s, stavyBota };
}

describe("offline protihráč", () => {
  it("všetky povahy proti sebe dohrajú partiu len legálnymi ťahmi", () => {
    const [a, b, c] = POVAHY.map((p) => p.id) as [string, string, string];
    const zapasy: [string, string][] = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [i, dvojica] of zapasy.entries()) {
      expect(odohraj(3 + i, 0, "bot", dvojica).state.koniec).not.toBeNull();
    }
  }, 90_000);

  it("zo šenku berie len za cigarety a len legálne (Michal 2026-10-19)", () => {
    // Stav brania zo šenku, ktorý vznikne v partii; cieľ sa prepíše na Zastávku.
    let s = setupGame(data, 77, { lokalit: DLZKY_HRY.kratka });
    for (let krok = 0; krok < 400 && !(s.faza === "draft" && s.draftStav?.krok === "beranie"); krok++) {
      const p = kto(s);
      if (p === null) break;
      s = apply(data, s, tahBota(data, s, p, krok), p).state;
    }
    const p = s.draftStav === null ? undefined : timMiesta(s.draftStav.naTahu);
    expect(p).toBeDefined();
    if (p === undefined) return;
    const hrac = { ...s.hraci[p], cigarety: 4 };
    const sCigaretami: GameState = { ...s, hraci: p === 0 ? [hrac, s.hraci[1]] : [s.hraci[0], hrac] };
    const legalne = JSON.stringify(legalCommands(data, sCigaretami, p));
    for (const povaha of POVAHY) {
      const cmd = tahBota(data, sCigaretami, p, 5, { povaha: povaha.id });
      expect(legalne, povaha.id).toContain(JSON.stringify(cmd));
    }
  }, 30_000);

  it("porazí náhodného hráča", () => {
    let vyhry = 0;
    const partie = 6;
    for (let i = 0; i < partie; i++) {
      const botSeat: PlayerId = i % 2 === 0 ? 0 : 1;
      const { state } = odohraj(100 + i, botSeat, "nahodny");
      expect(state.koniec).not.toBeNull();
      if (state.koniec?.vitaz === botSeat) vyhry++;
    }
    expect(vyhry).toBeGreaterThanOrEqual(partie - 1);
  }, 120_000);

  it("nevidí súperovu ruku ani poradie balíčkov", () => {
    // Ten istý stav, len skryté informácie inak rozložené: súperove skryté
    // karty inak rozdelené medzi ruku a balíček, všetky balíčky v inom poradí,
    // iný generátor náhody. Bot sa musí rozhodnúť rovnako.
    // Viac partií — náhodný súper niekedy prehrá skoro (exekúcia).
    const stavyBota = [42, 43, 44].flatMap((seed) => odohraj(seed, 1, "nahodny").stavyBota);
    let porovnani = 0;
    let rng = rngSeed(5);
    for (const [i, s] of stavyBota.entries()) {
      // Veštica smie vidieť oba balíčky, Vízia vrchnú kartu vlastného.
      if (i % 3 !== 0 || s.bitkaStav?.krok === "vestica" || s.vizia !== null) continue;
      const su = s.hraci[0];
      const [skryte, r1] = rngShuffle(rng, [...su.ruka, ...su.doberaci]);
      const [moj, r2] = rngShuffle(r1, s.hraci[1].doberaci);
      const [naradie, r2b] = rngShuffle(r2, s.naradie);
      const [obcania, r3] = rngShuffle(r2b, s.obcania);
      rng = r3;
      const inak: GameState = {
        ...s,
        rng: (s.rng as number) + 12345,
        naradie,
        obcania,
        hraci: [{ ...su, ruka: skryte.slice(0, su.ruka.length), doberaci: skryte.slice(su.ruka.length) }, { ...s.hraci[1], doberaci: moj }],
      };
      expect(tahBota(data, inak, 1, 999), `ťah ${i} vo fáze ${s.faza}`).toEqual(tahBota(data, s, 1, 999));
      porovnani++;
    }
    expect(porovnani).toBeGreaterThan(20);
  }, 60_000);
});

describe("offline protihráč — pravidlá v5 a v6", () => {
  function bitka(b: Partial<BitkaStav>): BitkaStav {
    return {
      krok: null,
      caka: null,
      sums: [{}, {}],
      exekutorHotovy: [true, true],
      exekutor: [0, 0],
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: false,
      ...b,
    };
  }
  it("v11: Nakladačku dá na štvrtú červenú — ďalšia vyhratá bitka je výhra strachom", () => {
    for (const seed of [81, 82]) {
      const s0 = setupGame(data, seed);
      // Hráč 0 má 3 červené strachy a štvrtého staršieho na oranžovej; Nakladačka 3 ho dotiahne.
      const starsi: ElderState[] = s0.starsi.map((e, i) => ({ ...e, strach: [i < 3 ? 3 : i === 3 ? 2 : 0, 0], reci: [0, 0] }));
      const s: GameState = {
        ...s0,
        faza: "bitka",
        kolo: 2,
        utocnik: 1,
        strany: [[], []],
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
        lokalityVHre: s0.lokalityVHre.slice(1),
        starsi,
        // Súper má od troch červených priazeň 3 (Bitkár, Veriaci) — Rán dosť na istú výhru.
        bitkaStav: bitka({ krok: "hadka", sums: [{ Rana: 12 }, {}], hadka: { makke: [0, 0], vitaz: null, velkost: 0, zostava: 0, prepadlo: 0, zdvihy: [] } }),
      };
      const po = spustBitku(data, s).state;
      expect(po.bitkaStav).toMatchObject({ krok: "prebytok", caka: 0 });
      for (const povaha of POVAHY) {
        const cmd = tahBota(data, po, 0, seed, { povaha: povaha.id });
        expect(cmd.type, povaha.id).toBe("prebytok");
        if (cmd.type !== "prebytok") continue;
        expect(cervenychHraca(apply(data, po, cmd, 0).state, 0), `${povaha.id} ${seed}`).toBeGreaterThanOrEqual(4);
      }
    }
  }, 30_000);

  it("Veštica: bot nevymieňa presvedčeného staršieho, hoci je to jeho najhoršia či súperova najlepšia karta", () => {
    const s0 = setupGame(data, 83);
    const karta = (uid: number, defId: string): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });
    const presvedceny = karta(990500, "abstak");
    const dobra = karta(990501, "pijan");
    const hraci = s0.hraci.map((h) => ({ ...h, doberaci: [presvedceny, dobra] })) as unknown as GameState["hraci"];
    const s: GameState = {
      ...s0,
      faza: "bitka",
      hraci,
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, karta: presvedceny, presvedcil: 0 as const } : e)),
      bitkaStav: bitka({ krok: "vestica", caka: 0 }),
    };
    const cmd = tahBota(data, s, 0, 7, { povaha: "igor" });
    expect(cmd).toEqual({ type: "vestica", moja: 1, jeho: 1 });
    expect(() => apply(data, s, cmd, 0)).not.toThrow();
  });

  /** Bitka o lokalitu v 2. kole, hráč 0 rozdeľuje: Nakladačku (prebytok) či hádku (reci) — body `body`. */
  function rozdelenie(krok: "prebytok" | "reci", body: number, prvy: Pick<ElderState, "strach" | "reci">, seed = 83): GameState {
    const s0 = setupGame(data, seed);
    return {
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, ...prvy } : e)),
      bitkaStav:
        krok === "prebytok"
          ? bitka({ krok, caka: 0, vitaz: 0, prebytokDrzi: 0, prebytokZostava: body })
          : bitka({ krok, caka: 0, vitaz: 0, hadka: { makke: [body, 0], vitaz: 0, velkost: body, zostava: body, prepadlo: 0, zdvihy: [] } }),
    };
  }

  it("v11.4: zajme staršieho na svojom červenom strachu, keď Nakladačka stačí (väzeň a krádež); opatrná povaha smie odmietnuť", () => {
    const s = rozdelenie("prebytok", 5, { strach: [3, 1], reci: [0, 3] });
    // Rudo chce za zajatie viac (prahStarsi), Božena radšej boduje u staršieho (body 1,5) — smú ostať pri strachu.
    for (const povaha of POVAHY.filter((x) => x.prahStarsi <= 0.5 && x.body <= 1)) {
      const cmd = tahBota(data, s, 0, 7, { povaha: povaha.id });
      expect(cmd.type === "prebytok" ? cmd.zajatia : null, povaha.id).toEqual([s.starsi[0]!.elderId]);
    }
  }, 30_000);

  it("v11.12: presvedčí staršieho, keď hádka stačí na reči na celý teplomer + 3", () => {
    const s = rozdelenie("reci", 9, { strach: [2, 3], reci: [0, 0] });
    for (const povaha of POVAHY) {
      const cmd = tahBota(data, s, 0, 7, { povaha: povaha.id });
      expect(cmd.type === "reci" ? cmd.presvedcenia : null, povaha.id).toEqual([s.starsi[0]!.elderId]);
    }
  }, 30_000);
});

describe("offline protihráč — výkupné zdrojov (2026-10-27)", () => {
  /** Finále v Pitke, bot (hráč 0) na ťahu; doberací balíček má z čoho fajčiť. */
  function vPitkeFinale(h: Partial<GameState["hraci"][0]>, lokalityVHre?: readonly CardInstance[]): GameState {
    const s0 = setupGame(data, 11);
    let uid = s0.nextUid;
    const pijani = Array.from({ length: 4 }, (): CardInstance => ({ uid: uid++, defId: "pijan", leftLayout: 0, rightLayout: 0 }));
    const hrac = { ...s0.hraci[0], doberaci: pijani, ...h };
    return {
      ...s0,
      nextUid: uid,
      faza: "pitka",
      kolo: 6,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: lokalityVHre === undefined ? "finale" : "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
      lokalityVHre: lokalityVHre ?? [],
      pitkyCelkom: 3,
      pitkaCislo: 3,
      hraci: [hrac, s0.hraci[1]],
      pitkaStav: {
        naTahu: 0,
        hotovy: [false, false],
        naexPouzity: [false, false],
        fajcenie: [0, 0],
        reakcia: null,
        postarka: [false, false],
        starosta: [false, false],
        naexPocet: [0, 0],
        
      },
    };
  }

  it("vo finále dolieva vypité poldeci, kým to výkupné zvýši (2 cigarety → plný poldeci = špak)", () => {
    for (const povaha of POVAHY) {
      // Bez Absťáku v hre — dolieva kvôli výkupnému, nie kvôli nerestiam.
      const s = vPitkeFinale({ poldeciPlne: 0, poldeciVypite: 2, cigarety: 7, nerestiTotoKolo: 3 });
      expect(legalCommands(data, s, 0).some((c) => c.type === "refillPoldeci")).toBe(true);
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).toBe("refillPoldeci");
    }
  });

  it("vo finále nefajčí cigaretu, ktorá by zobrala špak z výkupného, ani kvôli Absťáku po finále", () => {
    for (const povaha of POVAHY) {
      // Jedna karta v ruke (s prázdnou by fajčil — karta mu ešte môže vyhrať finále), súper má v kole 6 nerestí.
      const s0 = vPitkeFinale({ poldeciPlne: 1, poldeciVypite: 0, cigarety: 5, ruka: [{ uid: 990001, defId: "pijan", leftLayout: 0, rightLayout: 0 }], nerestiTotoKolo: 0 });
      const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], nerestiTotoKolo: 6 }] };
      expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(true);
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).not.toBe("smoke");
    }
  });
});

describe("offline protihráč — celá partia vrátane finále (Michal 2026-11-06)", () => {
  const karta = (uid: number, defId: string): CardInstance => ({ uid, defId, leftLayout: 0, rightLayout: 0 });

  /** Branie zo šenku v kole `kolo` strednej hry (6 = finále), bot (hráč 0) na ťahu. */
  function vDrafte(kolo: number, senok: readonly string[], h: Partial<GameState["hraci"][0]>): GameState {
    const s0 = setupGame(data, 21, { lokalit: DLZKY_HRY.stredna });
    const hrac = { ...s0.hraci[0], ...h };
    return {
      ...s0,
      faza: "draft",
      kolo,
      utocnik: 0,
      strany: [[], []],
      ciel: { typ: kolo >= 6 ? "finale" : "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
      senok: senok.map((id, i) => karta(990100 + i, id)),
      hraci: [hrac, s0.hraci[1]],
      draftStav: { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: 0, hotovo: [false, false], noveKarty: [0, 0] },
    };
  }

  /** Pitka finále, ešte príde ďalšie Zhromaždenie (pitkaCislo < pitkyCelkom). */
  function vPitkeFinale(h: Partial<GameState["hraci"][0]>): GameState {
    const s0 = setupGame(data, 11, { lokalit: DLZKY_HRY.stredna });
    const hrac = { ...s0.hraci[0], doberaci: [karta(990200, "pijan"), karta(990201, "pijan"), karta(990202, "pijan")], ...h };
    return {
      ...s0,
      faza: "pitka",
      kolo: 6,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "finale", lokalita: s0.lokalityVHre[0] as CardInstance },
      pitkyCelkom: 4,
      pitkaCislo: 1,
      hraci: [hrac, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
    };
  }

  const vzate = (s: GameState, c: Command): string[] => (c.type === "draftBer" ? c.uids.map((u) => s.senok.find((x) => x.uid === u)?.defId ?? "?") : []);

  it("do šenku dá slabšiu polovicu, silné karty si nechá naspodok balíčka (partia 17, #44, #70, #153)", () => {
    let s = setupGame(data, 31, { lokalit: DLZKY_HRY.stredna });
    let rng = rngSeed(5);
    for (let i = 0; i < 200 && !(s.faza === "draft" && s.draftStav?.krok === "stavba"); i++) {
      const p = kto(s) as PlayerId;
      const [n, r] = rngInt(rng, 2 ** 31);
      rng = r;
      s = apply(data, s, tahBota(data, s, p, n), p).state;
    }
    const d = s.draftStav;
    if (d === null) throw new Error("Stavba šenku nenastala.");
    for (const p of [0, 1] as const) {
      const cmd = tahBota(data, s, p, 3);
      if (cmd.type !== "stavbaSenku") throw new Error(cmd.type);
      const hodnoty = (uids: readonly number[]): number[] => uids.map((u) => hodnotaKarty(data, d.balicky[p].find((x) => x.uid === u) as CardInstance, 5));
      expect(Math.min(...hodnoty(cmd.odhod))).toBeGreaterThanOrEqual(Math.max(...hodnoty(cmd.doSenku)));
    }
  });

  it("skoro v hre berie kartu, ktorá sype cigarety, vo finále kartu, ktorá bije (partia 17, #19)", () => {
    for (const povaha of POVAHY) {
      const senok = ["masiar", "stryko_z_ameriky"];
      const skoro = vDrafte(2, senok, { cigarety: 1, ruka: [karta(990300, "pijan")] });
      expect(vzate(skoro, tahBota(data, skoro, 0, 5, { povaha: povaha.id }))[0], povaha.id).toBe("stryko_z_ameriky");
      const finale = vDrafte(6, senok, { cigarety: 1, ruka: [karta(990300, "pijan")] });
      expect(vzate(finale, tahBota(data, finale, 0, 5, { povaha: povaha.id }))[0], povaha.id).toBe("masiar");
    }
  });

  it("vo finále cigarety mení na karty, nedrží ich na výkupné 5 : 1", () => {
    for (const povaha of POVAHY) {
      const s = vDrafte(6, ["masiar", "vandal", "pes", "polovnik"], { cigarety: 6, ruka: [karta(990300, "pijan")] });
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).toBe("draftBer");
    }
  });

  it("s kopou cigariet pred finále kupuje, nehromadí", () => {
    for (const povaha of POVAHY) {
      const s = vDrafte(5, ["masiar", "vandal", "pes", "polovnik"], { cigarety: 15, ruka: [karta(990300, "pijan"), karta(990301, "pijan")] });
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).toBe("draftBer");
    }
  });

  it("vo finále pred ďalším vykladaním fajčí aj poslednú cigaretu (partia 17, #162)", () => {
    for (const povaha of POVAHY) {
      const s = vPitkeFinale({ cigarety: 1, poldeciPlne: 0, poldeciVypite: 0, ruka: [karta(990300, "milujuca_manzelka")] });
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).toBe("smoke");
    }
  });
  it("v11.9: po poslednom vykladaní kola nefajčí kartu, ktorú mu dá dobratie; rezervu nad hranicou si z prebytku dokúpi", () => {
    for (const povaha of POVAHY) {
      const v = (cigarety: number, ruka: number): GameState => {
        const s0 = vPitkeFinale({ cigarety, poldeciPlne: 2, poldeciVypite: 0, nerestiTotoKolo: 5, ruka: Array.from({ length: ruka }, (_, i) => karta(990400 + i, "pijan")) });
        return { ...s0, kolo: 3, ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance }, pitkyCelkom: 2, pitkaCislo: 2 };
      };
      const tenka = v(2, 1);
      expect(legalCommands(data, tenka, 0).some((c) => c.type === "smoke")).toBe(true);
      expect(tahBota(data, tenka, 0, 5, { povaha: povaha.id }).type, povaha.id).not.toBe("smoke");
      // Rudo z prebytku najprv nalieva — to je jeho štýl; ostatní si dokúpia kartu.
      expect(tahBota(data, v(14, 3), 0, 5, { povaha: povaha.id }).type, povaha.id).toBe(povaha.poldeci === undefined ? "smoke" : "barter");
    }
  });
});

describe("povahy na výber (Michal 2026-11-06)", () => {
  it("každá má jedinečné id a jednovetný opis; meno je bez „Bot“, ktoré pridáva stôl", () => {
    expect(new Set(POVAHY.map((p) => p.id)).size).toBe(POVAHY.length);
    expect(POVAHY.map((p) => p.id)).toEqual(["igor", "rudo", "bozena", "darina"]);
    for (const p of POVAHY) {
      expect(p.meno).not.toMatch(/^Bot\b/);
      expect(p.popis.trim().endsWith(".")).toBe(true);
      expect(p.popis.split(". ").length).toBe(1);
    }
  });

  it("vyradené povahy nehrajú, ale meno v archíve ostáva; partia bez zápisu povahy je Štamgast", () => {
    for (const p of VYRADENE_POVAHY) {
      expect(POVAHY.some((x) => x.id === p.id)).toBe(false);
      expect(menoPovahy(p.id)).toBe(p.meno);
    }
    expect(VYRADENE_POVAHY.map((p) => p.id)).toEqual(["stamgast", "rapavy_fero", "teta_gizka"]);
    expect(menoPovahy("igor")).toBe("Igor");
    expect(menoPovahy(null)).toBe("Štamgast");
  });
});
