// Offline protihráč: hrá len legálne, dohrá partiu, porazí náhodného hráča
// a rozhoduje sa len z toho, čo by vedel hráč pri stole.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, GameState, PlayerId } from "../src/index.ts";
import {
  DLZKY_HRY,
  POVAHY,
  apply,
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
    const { stavyBota } = odohraj(42, 1, "nahodny");
    let porovnani = 0;
    let rng = rngSeed(5);
    for (const [i, s] of stavyBota.entries()) {
      if (i % 3 !== 0 || s.bitkaStav?.krok === "vestica") continue; // Veštica smie vidieť oba balíčky
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
