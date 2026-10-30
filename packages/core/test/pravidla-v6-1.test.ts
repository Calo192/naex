// Pravidlá v6.1 (Michal 2026-10-27, interview o playtestoch v6): pas platí najviac za
// karty v ruke, akcia zrušená Odporom nie je ani aktívna, ani neaktívna (NA EX ju
// nezdvojí), Posilnenie aj Odpor Výtržníka sú už len Rany. Strach a Noviny len víťazovi stráži
// spaky-v6.test.ts, cenu patronátu elders.test.ts. Očakávané hodnoty sú z textu
// PRAVIDLA.md (§6, §7), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameData, GameState, LineEval, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, loadGameData, naexMaZmysel, naTahu, setupGame } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const lezi = (card: CardInstance, playedBy: PlayerId, naexBy?: PlayerId): PlacedCard =>
  naexBy === undefined ? { card, playedBy } : { card, playedBy, naexBy };

/** Línia hráča 0 bez lokality: strany[0] = [partner, karta] → spoj karta.pravá ↔ partner.ľavá. */
function linia(s: GameData, partner: PlacedCard, karta: PlacedCard): LineEval {
  return evaluateLine(s, { lokalita: null, lokalitaOtocena: false, strany: [[partner, karta], []] });
}

/** Partia v Zhromaždení prvého kola (cieľ vybraný, šenok postavený a vybraný). */
function vZhromazdeni(seed: number): GameState {
  let s = setupGame(data, seed);
  s = apply(data, s, legalCommands(data, s, naTahu(s)!)[0] as Command, naTahu(s)!).state;
  for (let i = 0; i < 40 && s.faza === "draft"; i++) {
    const p = naTahu(s)!;
    const legal = legalCommands(data, s, p);
    const cmd = legal.find((c) => c.type === "draftStop" || c.type === "bezPokusu") ?? legal[0]!;
    s = apply(data, s, cmd, p).state;
  }
  return s;
}

describe("§6 pas (v6.1): cigarety najviac za karty v ruke", () => {
  it("s prázdnou rukou pas nedá nič, s jednou kartou najviac 1", () => {
    const s = vZhromazdeni(4);
    expect(s.faza).toBe("zhromazdenie");
    const p = naTahu(s)!;
    expect(s.zhromazdenieStav!.zostavaLimit[p]).toBeGreaterThanOrEqual(2);
    const sRukou = (ruka: readonly CardInstance[]): GameState => ({
      ...s,
      hraci: s.hraci.map((h, i) => (i === p ? { ...h, ruka } : h)) as unknown as GameState["hraci"],
    });
    const zisk = (t: GameState): number => apply(data, t, { type: "pass" }, p).state.hraci[p].cigarety - t.hraci[p].cigarety;
    expect(zisk(sRukou([]))).toBe(0);
    expect(zisk(sRukou(s.hraci[p].ruka.slice(0, 1)))).toBe(1);
  });
});

describe("§7 Odpor a NA EX (v6.1): zrušená akcia nie je ani aktívna, ani neaktívna", () => {
  // Odporca: Odpor proti partnerovej Pecke, Viera spárovaná s partnerovou Ranou.
  const ODPORCA: Layout4 = ["Odpor", "Viera", null, null];
  const PARTNER_L: Layout4 = ["Pecka", "Rana", null, null];
  const PARTNER_P: Layout4 = ["Cigareta", null, null, null];
  const s = syntheticData([makeDef("odporca", EMPTY, ODPORCA, { tags: ["Občan"] }), makeDef("partner", PARTNER_L, PARTNER_P, { tags: ["Občan"] })]);
  const odporca = instanceFor(s, "odporca", EMPTY, ODPORCA);
  const partner = instanceFor(s, "partner", PARTNER_L, PARTNER_P);

  it("NA EX zruší aktívnu Ranu, zdvojí neaktívnu Cigaretu, Pecku zrušenú Odporom nezdvojí", () => {
    const bez = linia(s, lezi(partner, 0), lezi(odporca, 0));
    expect(bez.cards.get(partner.uid)?.left[0]).toMatchObject({ action: "Pecka", stav: "zrusena", nasobok: 0 });
    expect(bez.sums[0].Rana).toBe(1);

    const sNaex = linia(s, lezi(partner, 0, 1), lezi(odporca, 0));
    expect(sNaex.cards.get(partner.uid)?.left[0]).toMatchObject({ action: "Pecka", stav: "zrusena", nasobok: 0 });
    expect(sNaex.sums[0].Pecka ?? 0).toBe(0);
    expect(sNaex.sums[0].Rana ?? 0).toBe(0);
    expect(sNaex.sums[0].Cigareta).toBe(2);
    // Odporcova Viera ostáva aktívna ×1 — NA EX leží na partnerovi.
    expect(sNaex.sums[0].Viera).toBe(1);
  });

  it("pri výbere karty pre NA EX sa zrušená akcia neráta ako aktívna — karta len so zrušenou a neaktívnou NA EX nedostane", () => {
    const sam: Layout4 = ["Pecka", null, null, null];
    const odpor: Layout4 = ["Odpor", null, null, null];
    const t = syntheticData([makeDef("odpor1", EMPTY, odpor, { tags: ["Občan"] }), makeDef("sam", sam, PARTNER_P, { tags: ["Občan"] })]);
    const o = instanceFor(t, "odpor1", EMPTY, odpor);
    const k = instanceFor(t, "sam", sam, PARTNER_P);
    expect(naexMaZmysel(t, { lokalita: null, lokalitaOtocena: false, strany: [[lezi(k, 0), lezi(o, 0)], []] }).has(k.uid)).toBe(false);
    // Partner s aktívnou Ranou navyše NA EX dostať smie.
    expect(naexMaZmysel(s, { lokalita: null, lokalitaOtocena: false, strany: [[lezi(partner, 0), lezi(odporca, 0)], []] }).has(partner.uid)).toBe(true);
  });
});

describe("§7 zrážka a Posilnenie (v6.1): Posilnenie Výtržníka je už len Rana", () => {
  const POSIL: Layout4 = ["Posilnenie", "Rana", null, null];
  const PARTNER_L: Layout4 = ["Pecka", null, null, null];

  function sada(posilId: string) {
    const s = syntheticData([makeDef(posilId, EMPTY, POSIL, { tags: ["Občan"] }), makeDef("partner", PARTNER_L, EMPTY, { tags: ["Občan"] })]);
    return { s, posil: instanceFor(s, posilId, EMPTY, POSIL), partner: instanceFor(s, "partner", PARTNER_L, EMPTY) };
  }
  const vytrznik = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy, naexBy: 0, naexBy2: 1, vytrznik: true });

  it("suseda nezdvojuje: Pecka partnera ×1, obe akcie Výtržníka sú Rany", () => {
    const { s, posil, partner } = sada("posil");
    expect(linia(s, lezi(partner, 0), lezi(posil, 0)).sums[0].Pecka).toBe(2);
    const ev = linia(s, lezi(partner, 0), vytrznik(posil, 0));
    expect(ev.sums[0].Pecka).toBe(1);
    expect(ev.zdroje[0].Pecka?.[0]?.dovody).not.toContain("Posilnenie");
    expect(ev.sums[0].Rana).toBe(2);
  });

  it("platí aj pre Veterána — NA EX mu Posilnenie nerušia, zrážka áno", () => {
    const { s, posil, partner } = sada("veteran");
    expect(linia(s, lezi(partner, 0), vytrznik(posil, 0)).sums[0].Pecka).toBe(1);
  });

  it("Odpor Výtržníka (v6.1b, Michal 2026-10-27): je len Rana a susedovu akciu neruší", () => {
    const ODPOR: Layout4 = ["Odpor", null, null, null];
    const t = syntheticData([makeDef("odporca", EMPTY, ODPOR, { tags: ["Občan"] }), makeDef("partner", PARTNER_L, EMPTY, { tags: ["Občan"] })]);
    const o = instanceFor(t, "odporca", EMPTY, ODPOR);
    const p = instanceFor(t, "partner", PARTNER_L, EMPTY);
    // Bez zrážky Odpor susedovu Pecku zruší.
    const bez = linia(t, lezi(p, 0), lezi(o, 0));
    expect(bez.sums[0].Pecka ?? 0).toBe(0);
    expect(bez.cards.get(p.uid)?.left[0]).toMatchObject({ stav: "zrusena" });
    // Po zrážke: Pecka suseda platí ×1, Odpor je Rana pre majiteľa Výtržníka.
    const ev = linia(t, lezi(p, 0), vytrznik(o, 0));
    expect(ev.cards.get(p.uid)?.left[0]).toMatchObject({ stav: "aktivna", nasobok: 1 });
    expect(ev.sums[0].Pecka).toBe(1);
    expect(ev.sums[0].Rana).toBe(1);
  });
});
