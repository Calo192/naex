// Opravy zobrazenia z playtestov 2026-11-13 a 2026-11-16 — pravidlá sa nemenia, len to,
// čo hráč vidí: náhľad vyloženia s Vandalom, hlásenie finále, sekera bez Absťákov (v12.5)
// a výhľad Chuti vo finále.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { ActionSums, CardInstance, GameState, PlacedCard, PlayerId, StranaLinie } from "../src/index.ts";
import {
  apply,
  DLZKY_HRY,
  evaluateLine,
  ktoNatacaLokalitu,
  lineState,
  loadGameData,
  mozeHrat,
  nahladVylozenia,
  naTahu,
  rngInt,
  rngSeed,
  setupGame,
  sPrilozenou,
  stavZavislosti,
  stranyLokality,
  tahBota,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 996000;
const inst = (defId: string, leftLayout = 0, rightLayout = 0): CardInstance => ({ uid: ++uidSeq, defId, leftLayout, rightLayout });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Zhromaždenie hráča 0 na lokalite `lok` s kartami `ruka`. */
function vZhromazdeni(lok: CardInstance, otocena: boolean, strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s0 = setupGame(data, 3);
  return {
    ...s0,
    faza: "zhromazdenie",
    kolo: 2,
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita: lok },
    lokalitaOtocena: otocena,
    strany,
    pitkyCelkom: 2,
    pitkaCislo: 0,
    pitkaStav: null,
    hraci: [{ ...s0.hraci[0], ruka, cigarety: 5, poldeciPlne: 3 }, s0.hraci[1]],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

/** Súčty bez Dlhu — Dlh náhľadu je z Hazardu Pitky (hazardPitkyZLinie), nie z evaluateLine. */
function bezDlhu(a: ActionSums): ActionSums {
  const { Dlh: _dlh, ...zvysok } = a;
  return zvysok;
}

function plus(a: ActionSums, b: ActionSums): ActionSums {
  const out: Partial<Record<keyof ActionSums, number>> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ActionSums>) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (v !== 0) out[k] = v;
  }
  return out;
}

describe("náhľad vyloženia počíta s otočením lokality po Nástupe Vandala (report 20261113-084431)", () => {
  const vandal = data.variants.get("vandal")!;
  const lokality = data.lokality.slice(0, 6);

  it("súčty aj hrana lokality v náhľade sedia s tým, čo zloží motor", () => {
    let inakBezOtocenia = 0;
    for (const lokDef of lokality)
      for (const otocena of [false, true])
        for (const kam of ["vlastna", "superova"] as StranaLinie[])
          for (let l = 0; l < vandal.left.length; l++)
            for (let r = 0; r < vandal.right.length; r++) {
              const v = inst("vandal", l, r);
              const lok = inst(lokDef.id);
              // Na druhom kraji leží súperova karta pri lokalite — otočenie mení aj jej spoj.
              const s = vZhromazdeni(lok, otocena, [[], [lezi(inst("pijan"), 1)]], [v]);
              const po = sPrilozenou(data, s, kam === "vlastna" ? 0 : 1, v, 0);
              expect(po.lokalitaOtocena).toBe(!otocena);
              const n = nahladVylozenia(data, lineState(s), 0, v, kam, s.naexVKole, po.strany, po.lokalitaOtocena);
              const motor = apply(data, s, { type: "place", uid: v.uid, target: kam }, 0).state;
              expect(motor.lokalitaOtocena).toBe(!otocena);
              const pred = evaluateLine(data, lineState(s)).sums;
              const pos = evaluateLine(data, lineState(motor)).sums;
              for (const p of [0, 1] as const) expect(bezDlhu(plus(pred[p], n.zmeny[p]))).toEqual(bezDlhu(pos[p]));
              if (kam === "vlastna") {
                // Vandal je prvý na svojom kraji — stretne sa s hranou lokality po otočení.
                expect(n.sused?.hrana).toEqual(stranyLokality(data, lok, !otocena, 0).kTebe);
              }
              const stary = nahladVylozenia(data, lineState(s), 0, v, kam, s.naexVKole, po.strany);
              if (JSON.stringify(stary.zmeny) !== JSON.stringify(n.zmeny)) inakBezOtocenia++;
            }
    // Bez otočenia by náhľad aspoň niekde klamal — inak test nič nestráži.
    expect(inakBezOtocenia).toBeGreaterThan(0);
  });

  it("karta bez Nástupu otočenie nemení — náhľad ostáva ako predtým", () => {
    const lok = inst(lokality[0]!.id);
    const k = inst("pijan");
    const s = vZhromazdeni(lok, false, [[], []], [k]);
    const po = sPrilozenou(data, s, 0, k, 0);
    expect(po.lokalitaOtocena).toBe(false);
    expect(nahladVylozenia(data, lineState(s), 0, k, "vlastna", s.naexVKole, po.strany, po.lokalitaOtocena)).toEqual(
      nahladVylozenia(data, lineState(s), 0, k, "vlastna", s.naexVKole, po.strany),
    );
  });
});

describe("hlásenie finále a sekery v partiách botov", () => {
  // Bot proti botovi (Tretia liga) — každé hlásenie finále sa porovná s tým, kto naozaj vyberá a natáča.
  const finale: { text: string; vybera: PlayerId; nataca: PlayerId }[] = [];
  const sekery: string[] = [];
  for (let i = 0; i < 6; i++) {
    let s = setupGame(data, 7100 + i, { lokalit: DLZKY_HRY.kratka });
    let rng = rngSeed(300 + i);
    for (let krok = 0; s.koniec === null && krok < 6000; krok++) {
      const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
      if (p === null) break;
      const [seed, r] = rngInt(rng, 2 ** 31);
      rng = r;
      const v = apply(data, s, tahBota(data, s, p, seed), p);
      s = v.state;
      for (const e of v.events) {
        if (e.type !== "log") continue;
        if (e.text.startsWith("Finále (")) finale.push({ text: e.text, vybera: (1 - s.utocnik) as PlayerId, nataca: ktoNatacaLokalitu(s) });
        if (e.text.startsWith("Sekera:")) sekery.push(e.text);
      }
    }
  }

  it("finále: vyberá obranca, natáča víťaz poslednej hádky (§14b) — text uvádza toho, kto to naozaj robí", () => {
    // Semienka sú vybraté tak, aby nastali oba prípady (natáča obranca aj víťaz hádky-útočník).
    expect(finale.some((f) => f.nataca !== f.vybera)).toBe(true);
    expect(finale.some((f) => f.nataca === f.vybera)).toBe(true);
    expect(finale.length).toBeGreaterThan(0);
    for (const f of finale) {
      if (f.nataca === f.vybera) expect(f.text).toContain(`hráč ${f.vybera + 1} vyberá a natáča pinnacle lokalitu.`);
      else expect(f.text).toContain(`hráč ${f.vybera + 1} vyberá pinnacle lokalitu, natáča ju hráč ${f.nataca + 1} ako víťaz poslednej hádky.`);
    }
  });

  it("sekera: o remíze rozhodujú len Dlhy (v12.5) — v hlásení ani v zdroji motora Absťáky nie sú", () => {
    expect(sekery.length).toBeGreaterThan(0);
    for (const t of sekery) expect(t).not.toMatch(/Absť/);
    const engine = readFileSync(new URL("../src/engine.ts", import.meta.url), "utf8");
    expect(engine).not.toContain("v Absťákoch aj v Dlhoch —");
    expect(engine).toContain("Sekera: remíza v tuhom aj v Dlhoch —");
  });
});

describe("výhľad Chuti vo finále (§8, §14b; playtest 20261116-173731-1, Eva)", () => {
  /** Hráč 0 s Chuťou 3 a bez nerestí v kole. */
  const stav = (s: GameState): GameState => ({ ...s, hraci: [{ ...s.hraci[0], chut: 3, nerestiTotoKolo: 0 }, s.hraci[1]] });

  it("v bežnom kole hrozí Absťák, vo finále nie — Chuť po finále sa nerieši", () => {
    const s0 = setupGame(data, 11, { lokalit: DLZKY_HRY.kratka });
    const lok = s0.lokalityVHre[0]!;
    const bezne = stav({ ...s0, kolo: 2, ciel: { typ: "lokalita", lokalita: lok }, strany: [[], []] });
    expect(stavZavislosti(data, bezne, 0)).toMatchObject({ vyhlad: "ziska", doBezpecia: 3 });
    const finale = stav({ ...s0, kolo: s0.lokalitCelkom + 1, ciel: { typ: "finale", lokalita: lok }, strany: [[], []] });
    expect(stavZavislosti(data, finale, 0)).toMatchObject({ vyhlad: "nic", doBezpecia: 0, chutPo: 3 });
    // Aj pred voľbou pinnacle (cieľ ešte nie je) — kolo za poslednou lokalitou.
    const predVolbou = stav({ ...s0, kolo: s0.lokalitCelkom + 1, ciel: null, strany: [[], []] });
    expect(stavZavislosti(data, predVolbou, 0)).toMatchObject({ vyhlad: "nic", doBezpecia: 0 });
  });
});

describe("Degustátorka: log bez limitu vykladania (zanikol vo v12.5)", () => {
  it("povie len, že súperovi vyžerie plný poldeci", () => {
    const deg = inst("degustatorka");
    const s0 = vZhromazdeni(inst(data.lokality[0]!.id), false, [[], []], [deg]);
    const s: GameState = { ...s0, hraci: [s0.hraci[0], { ...s0.hraci[1], poldeciPlne: 5 }] };
    const { state, events } = apply(data, s, { type: "place", uid: deg.uid, target: "vlastna" }, 0);
    expect(state.hraci[1].poldeciPlne).toBe(4);
    const logy = events.flatMap((e) => (e.type === "log" && e.text.startsWith("Degustátorka") ? [e.text] : []));
    expect(logy).toEqual(["Degustátorka: hráčovi 2 vyžerie plný poldeci — je vypitý."]);
  });
});
