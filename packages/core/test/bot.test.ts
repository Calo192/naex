// Offline protihráč: hrá len legálne, dohrá partiu, porazí náhodného hráča
// a rozhoduje sa len z toho, čo by vedel hráč pri stole.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, Command, ElderState, GameState, PlayerId } from "../src/index.ts";
import {
  DLZKY_HRY,
  POVAHY,
  apply,
  favourStarsieho,
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
  povahy: readonly [string, string] = ["stamgast", "stamgast"],
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
    const p = s.draftStav?.naTahu;
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
      const [spolocny, r3] = rngShuffle(r2, s.spolocnyBalicek);
      rng = r3;
      const inak: GameState = {
        ...s,
        rng: s.rng + 12345,
        spolocnyBalicek: spolocny,
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
      pohorsenieZostava: [0, 0],
      exekutor: [0, 0],
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokPosunute: [],
      pohrebHotovy: [false, false],
      benzinkaZostava: [0, 0],
      karHotovy: [true, true],
      spalit: [],
      vesticaHotova: false,
      ...b,
    };
  }
  /** Bitka s prázdnou líniou v kroku Pohoršenia; hráč 0 (obranca) má posledné Pohoršenie. */
  function vPohorseni(seed: number, markery: (e: ElderState) => ElderState["marker"]): GameState {
    const s0 = setupGame(data, seed);
    return {
      ...s0,
      faza: "bitka",
      kolo: 2,
      utocnik: 1,
      strany: [[], []],
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
      lokalityVHre: s0.lokalityVHre.slice(1),
      starsi: s0.starsi.map((e) => ({ ...e, marker: markery(e) })),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 0, pohorsenieZostava: [1, 0] }),
    };
  }
  const priazenStarsieho = (s: GameState, elderId: string): string => favourStarsieho(data, s.starsi.find((e) => e.elderId === elderId) as ElderState);

  it("v6: posledné Pohoršenie dá radšej na strach (špaky po vyhratých bitkách) než na výhru Bitkárom", () => {
    for (const seed of [71, 72, 73]) {
      // Všetci v strede, prázdna línia 0 : 0. Bitkár k sebe by vyhral bitku o 1 Pitku (1 špak),
      // strach súpera dá pri sekere špak obom a potom po každej bitke, ktorú bot vyhrá.
      const s = vPohorseni(seed, () => 3);
      for (const povaha of POVAHY) {
        const cmd = tahBota(data, s, 0, seed, { povaha: povaha.id });
        expect(cmd.type, povaha.id).toBe("pohorsenie");
        if (cmd.type !== "pohorsenie") continue;
        // v6.1 strach platí len víťazovi — agresívny Fero smie radšej vyhrať bitku hneď.
        if (povaha.id !== "rapavy_fero") expect(cmd.kSebe === true, `${povaha.id} ${seed}`).toBe(false);
        expect(apply(data, s, cmd, 0).state.spaky[0]).toBe(1);
      }
    }
  }, 30_000);

  it("prebytkom dá súperovi priazeň, ktorá mu v tejto partii urobí najmenej", () => {
    for (const seed of [81, 82, 83]) {
      // Po výhre Bitkárom drží hráč 0 prebytok 1; všetci ostatní starší sú tesne pred zónou súpera.
      const bitkar = (e: ElderState): boolean => data.scorecards.find((x) => x.id === e.scorecard)?.favour === "BITKAR";
      const s = vPohorseni(seed, () => 3);
      const id = s.starsi.find(bitkar)?.elderId as string;
      const po = apply(data, s, { type: "pohorsenie", elderId: id, kSebe: true }, 0).state;
      expect(po.bitkaStav?.krok).toBe("prebytok");
      expect(po.bitkaStav?.prebytokDrzi).toBe(0);
      for (const povaha of POVAHY) {
        const cmd = tahBota(data, po, 0, seed, { povaha: povaha.id });
        expect(cmd.type, povaha.id).toBe("prebytok");
        if (cmd.type !== "prebytok") continue;
        // Súper nemá priznaný Dlh (Kmotor nič nerobí) a NA EX dáva zriedka (Výpalné, „do dna“).
        expect(["EXEKUTOR", "UZERNIK", "NEPRAJNIK", "ALKOHOLIK"], `${povaha.id} ${seed}`).toContain(priazenStarsieho(po, cmd.elderId));
      }
    }
  }, 30_000);

  it("na Kare zahodí nepriznanú Cirhózu aj s tenkým balíčkom (prehra balíčkom pod 5 neplatí)", () => {
    const s0 = vPohorseni(91, () => 3);
    let uid = 880000;
    const k = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
    const cirhoza = k("cirhoza");
    const s: GameState = {
      ...s0,
      bitkaStav: bitka({ krok: "kar", caka: 0, karHotovy: [false, true] }),
      hraci: [{ ...s0.hraci[0], ruka: [cirhoza, k("pijan")], doberaci: [k("pijan")], odhadzovaci: [] }, s0.hraci[1]],
    };
    expect(legalCommands(data, s, 0)).toContainEqual({ type: "kar", uid: cirhoza.uid });
    expect(tahBota(data, s, 0, 1)).toEqual({ type: "kar", uid: cirhoza.uid });
  });

  it("v6: Pohrebom spáli priznanú Cirhózu aj s tenkým balíčkom — súper by za ňu mal +1 tuhé v každej ďalšej bitke", () => {
    const s0 = vPohorseni(92, () => 3);
    let uid = 890000;
    const k = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
    const cirhoza = k("cirhoza");
    const s: GameState = {
      ...s0,
      strany: [[{ card: k("pijan"), playedBy: 0 }], []],
      bitkaStav: bitka({ krok: "pohreb", caka: 0, pohrebHotovy: [false, true] }),
      hraci: [{ ...s0.hraci[0], ruka: [k("pijan")], doberaci: [k("pijan"), k("hasic")], odhadzovaci: [], priznane: [cirhoza] }, s0.hraci[1]],
    };
    for (const povaha of POVAHY) {
      const cmd = tahBota(data, s, 0, 3, { povaha: povaha.id });
      expect(cmd.type, povaha.id).toBe("pohreb");
    }
  });
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
      ciel: lokalityVHre === undefined ? { typ: "finale", lokalita: null } : { typ: "lokalita", lokalita: s0.lokalityVHre[0] as CardInstance },
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
        vykup: [false, false],
      },
    };
  }

  it("vo finále dolieva vypité poldeci, kým to výkupné zvýši (2 cigarety → plný poldeci = špak)", () => {
    for (const povaha of POVAHY) {
      // Bez Absťáku v hre — dolieva kvôli výkupnému, nie kvôli nerestiam.
      const s = vPitkeFinale({ poldeciPlne: 0, poldeciVypite: 2, cigarety: 7, nerestiMinuleKolo: 0, nerestiTotoKolo: 3 });
      expect(legalCommands(data, s, 0).some((c) => c.type === "refillPoldeci")).toBe(true);
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).toBe("refillPoldeci");
    }
  });

  it("vo finále nefajčí cigaretu, ktorá by zobrala špak z výkupného, ani kvôli Absťáku po finále", () => {
    for (const povaha of POVAHY) {
      // Jedna karta v ruke (s prázdnou by fajčil — karta mu ešte môže vyhrať finále), v predošlom kole 6 nerestí.
      const s = vPitkeFinale({ poldeciPlne: 1, poldeciVypite: 0, cigarety: 5, ruka: [{ uid: 990001, defId: "pijan", leftLayout: 0, rightLayout: 0 }], nerestiMinuleKolo: 6, nerestiTotoKolo: 0 });
      expect(legalCommands(data, s, 0).some((c) => c.type === "smoke")).toBe(true);
      expect(tahBota(data, s, 0, 5, { povaha: povaha.id }).type, povaha.id).not.toBe("smoke");
    }
  });
});
