// Záverečná sa otočí na konci Pitky po svojom Zhromaždení (PRAVIDLA §13, §7 krok 8)
// a jej strana sa tým odblokuje. Hlásenie Michala 2026-10-27: „súper dal Záverečnú
// a ja som už nikdy nemohol na tú stranu hrať“ — jadro ju otáča; bot však často hrá
// novú Záverečnú hneď prvým ťahom ďalšieho Zhromaždenia na tú istú stranu, takže
// strana bola zablokovaná znova, nie stále tou istou kartou. Testy strážia oboje.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import {
  DLZKY_HRY,
  apply,
  cieleVykladania,
  legalCommands,
  loadGameData,
  mozeHrat,
  naTahu,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  uidZaverecnej,
  viewFor,
  zablokovaneStrany,
} from "../src/index.ts";
import { naexOdkryte } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 61000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

const skryte = (s: GameState): number => s.strany.flat().filter((pl) => pl.zaverecna === true).length;
const maZaverecnu = (c: Command): boolean => c.type === "zaverecna" || (c.type === "tah" && c.kroky.some((k) => k.type === "zaverecna"));
const kto = (s: GameState): PlayerId | null => ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);

/** Po Pitke: v línii nič lícom dole, žiadny pohľad nemá Záverečnú ani zablokovanú stranu. */
function overPoPitke(s: GameState, kde: string): void {
  expect(skryte(s), kde).toBe(0);
  for (const ja of [0, 1] as const) {
    const v = viewFor(data, s, ja);
    expect(v.zaverecne, kde).toEqual([]);
    expect(zablokovaneStrany(v), kde).toEqual([false, false]);
    expect(v.strany[0].length + v.strany[1].length, kde).toBe(s.strany[0].length + s.strany[1].length);
  }
}

/** Zhromaždenie finále (3 Pitky — po Pitke ide ďalšie Zhromaždenie) s rukami oboch a kartou na každej strane. */
function finale(
  ruky: readonly [CardInstance[], CardInstance[]],
  naTahu_: PlayerId,
  strany: GameState["strany"] = [[{ card: inst("pijan"), playedBy: 0 }], [{ card: inst("pijan"), playedBy: 1 }]],
  ciel: GameState["ciel"] = { typ: "finale", lokalita: null },
): GameState {
  const s = setupGame(data, 21);
  return {
    ...s,
    faza: "zhromazdenie",
    utocnik: naTahu_,
    ciel,
    pitkyCelkom: 3,
    pitkaCislo: 0,
    strany,
    stredFinale: strany[0].length > 0 ? 0 : strany[1].length > 0 ? 1 : null,
    hraci: [
      { ...s.hraci[0], ruka: ruky[0], cigarety: 3, poldeciPlne: 2 },
      { ...s.hraci[1], ruka: ruky[1], cigarety: 3, poldeciPlne: 2 },
    ],
    zhromazdenieStav: { naTahu: naTahu_, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  } as GameState;
}

/** Dohrá Pitku bez NA EX (Vízia: kartu si nechá), kým sa nezmení fáza. */
function dohrajPitku(s: GameState): GameState {
  for (let i = 0; i < 20 && s.faza === "pitka"; i++) {
    const p = s.vizia !== null ? (([0, 1] as const).find((q) => mozeHrat(s, q)) ?? 0) : (s.pitkaStav?.naTahu ?? 0);
    s = apply(data, s, s.vizia !== null ? { type: "vizia", vziat: true } : { type: "skipNaex" }, p).state;
  }
  return s;
}

describe("Záverečná po Pitke — cielené prípady", () => {
  it("súperova Záverečná na mojej strane prvým ťahom: po Pitke je otočená a na stranu sa znova vykladá", () => {
    const zaverecna = inst("hasic");
    const s = finale([[inst("pijan"), inst("hasic"), inst("pijan")], [zaverecna, inst("pijan"), inst("hasic")]], 1);
    // Bot (hráč 2) ako prvý ťah: Záverečná na súperovu stranu — moja strana je zablokovaná.
    const po = apply(data, s, { type: "zaverecna", uid: zaverecna.uid, target: "superova" }, 1).state;
    expect(zablokovaneStrany(viewFor(data, po, 0))).toEqual([true, false]);
    expect(legalCommands(data, po, 0).some((c) => c.type === "place" && c.target === "vlastna")).toBe(false);
    const pitka = apply(data, po, { type: "pass" }, 0).state;
    expect(pitka.faza).toBe("pitka");
    const dalsie = dohrajPitku(pitka);
    expect(dalsie.faza).toBe("zhromazdenie");
    overPoPitke(dalsie, "po 1. Pitke");
    // Otočená karta leží na mojej strane lícom hore a vidím ju.
    expect(viewFor(data, dalsie, 0).strany[0].map((pl) => pl.card.uid)).toContain(zaverecna.uid);
    // Na svoju stranu sa dá znova vykladať — ja ako prvý (útočník) aj po súperovi.
    const moja = dalsie.hraci[0].ruka[0] as CardInstance;
    const ja = dalsie.zhromazdenieStav?.naTahu === 0 ? dalsie : apply(data, dalsie, { type: "pass" }, 1).state;
    expect(legalCommands(data, ja, 0)).toContainEqual({ type: "place", uid: moja.uid, target: "vlastna" });
    const vylozene = apply(data, ja, { type: "place", uid: moja.uid, target: "vlastna" }, 0).state;
    expect(vylozene.strany[0].at(-1)?.card.uid).toBe(moja.uid);
  });

  it("nová Záverečná po Pitke na tú istú stranu je iná karta — predošlá ostáva lícom hore", () => {
    const prva = inst("hasic");
    const druha = inst("pijan");
    const s = finale([[inst("pijan"), inst("hasic")], [prva, druha, inst("hasic")]], 1);
    const po = apply(data, apply(data, s, { type: "zaverecna", uid: prva.uid, target: "superova" }, 1).state, { type: "pass" }, 0).state;
    let dalsie = dohrajPitku(po);
    overPoPitke(dalsie, "po 1. Pitke");
    if (dalsie.zhromazdenieStav?.naTahu !== 1) dalsie = apply(data, dalsie, { type: "pass" }, 0).state;
    const znova = apply(data, dalsie, { type: "zaverecna", uid: druha.uid, target: "superova" }, 1).state;
    const v = viewFor(data, znova, 0);
    expect(v.strany[0].map((pl) => pl.card.uid)).toContain(prva.uid);
    expect(v.zaverecne).toEqual([{ strana: 0, majitel: 1, uid: uidZaverecnej(0), naexBy: null }]);
  });

  it("finále: Záverečná ako stredová karta po Pitke neblokuje žiadnu stranu", () => {
    const zaverecna = inst("hasic");
    const s = finale([[zaverecna, inst("pijan"), inst("hasic")], [inst("pijan"), inst("hasic")]], 0, [[], []]);
    const po = apply(data, s, { type: "zaverecna", uid: zaverecna.uid, target: "vlastna" }, 0).state;
    expect(po.stredFinale).toBe(0);
    // Prázdna súperova strana sa prikladá ku karte v strede — tá je lícom dole, súper
    // nemá kam vyložiť a hra zaňho pasuje sama.
    expect(po.faza).toBe("pitka");
    const dalsie = dohrajPitku(po);
    expect(dalsie.faza).toBe("zhromazdenie");
    overPoPitke(dalsie, "finále po 1. Pitke");
    for (const p of [0, 1] as const) {
      const karta = dalsie.hraci[p].ruka[0] as CardInstance;
      expect(cieleVykladania(data, dalsie.strany, p, karta, 3, true, null, [false, false], true)).toEqual(expect.arrayContaining(["vlastna", "superova"]));
    }
  });

  it("NA EX na súperovu Záverečnú: po Pitke je otočená aj s poldeci", () => {
    const zaverecna = inst("hasic");
    const s = finale([[inst("pijan"), inst("hasic")], [zaverecna, inst("pijan")]], 1);
    const po = apply(data, apply(data, s, { type: "zaverecna", uid: zaverecna.uid, target: "vlastna" }, 1).state, { type: "pass" }, 0).state;
    expect(po.faza).toBe("pitka");
    const naex = naexOdkryte(data, po, uidZaverecnej(1), 0);
    const dalsie = dohrajPitku(naex.state.pitkaStav?.reakcia === 1 ? apply(data, naex.state, { type: "bezReakcie" }, 1).state : naex.state);
    overPoPitke(dalsie, "po Pitke s NA EX");
    expect(dalsie.strany[1].find((pl) => pl.card.uid === zaverecna.uid)?.naexBy).toBe(0);
  });

  it("Kostol (bez NA EX) a posledná Pitka pred bitkou: otočí sa pred bitkou", () => {
    const zaverecna = inst("hasic");
    const kostol = { typ: "lokalita", lokalita: inst("kostol") } as GameState["ciel"];
    const s = { ...finale([[inst("pijan")], [zaverecna, inst("pijan")]], 1, [[], []], kostol), pitkyCelkom: 1 } as GameState;
    const po = apply(data, apply(data, s, { type: "zaverecna", uid: zaverecna.uid, target: "superova" }, 1).state, { type: "pass" }, 0).state;
    const dalsie = dohrajPitku(po);
    expect(dalsie.faza).not.toBe("pitka");
    overPoPitke(dalsie, "po Pitke v Kostole");
  });
});

describe("Záverečná po Pitke — náhodné partie", () => {
  /** Partia s daným hráčom ťahov; po každej Pitke overí, že v línii nič neleží lícom dole. */
  function odohraj(seed: number, tah: (s: GameState, p: PlayerId, n: number) => Command): number {
    let s = setupGame(data, seed, { lokalit: DLZKY_HRY.kratka });
    let rng = rngSeed(seed);
    let zahrane = 0;
    let odPitky = 0;
    for (let krok = 0; s.koniec === null && krok < 6000; krok++) {
      const p = kto(s);
      if (p === null) break;
      const [n, r] = rngInt(rng, 2 ** 31);
      rng = r;
      const cmd = tah(s, p, n);
      const pred = s;
      s = apply(data, s, cmd, p).state;
      if (pred.faza === "pitka" && s.faza !== "pitka") odPitky = 0;
      if (maZaverecnu(cmd)) {
        zahrane++;
        odPitky++;
      }
      const kde = `seed ${seed}, krok ${krok}, ${pred.faza} → ${s.faza}`;
      if (pred.faza === "pitka" && s.faza !== "pitka" && s.faza !== "koniec") overPoPitke(s, kde);
      if (s.faza !== "zhromazdenie" && s.faza !== "pitka" && s.faza !== "koniec") expect(skryte(s), kde).toBe(0);
      // V Zhromaždení leží lícom dole najviac toľko Záverečných, koľko ich padlo od poslednej Pitky.
      if (s.faza === "zhromazdenie" || s.faza === "pitka") expect(skryte(s), kde).toBeLessThanOrEqual(odPitky);
    }
    return zahrane;
  }

  it("náhodní hráči, ktorí Záverečnú hrajú radi", () => {
    let zahrane = 0;
    for (let seed = 1; seed <= 40; seed++) {
      zahrane += odohraj(seed, (s, p, n) => {
        const cmds = legalCommands(data, s, p);
        const zav = cmds.filter(maZaverecnu);
        return (zav.length > 0 && n % 3 === 0 ? zav[n % zav.length] : cmds[n % cmds.length]) as Command;
      });
    }
    expect(zahrane).toBeGreaterThan(40);
  }, 120_000);

  it("bot proti botu", () => {
    let zahrane = 0;
    for (const seed of [3, 7]) zahrane += odohraj(seed, (s, p, n) => tahBota(data, s, p, n));
    expect(zahrane).toBeGreaterThan(0);
  }, 180_000);
});
