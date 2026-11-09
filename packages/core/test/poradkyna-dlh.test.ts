// Finančná poradkyňa (Michal 2026-10-18): „Pitka: Dlhy, ktoré vygeneruje táto karta, dostáva súper.“
// Michal 2026-11-09: „dáva komu dlhy? mne alebo súperovi?“ — Pitka ich pripísala súperovi, ale bar,
// panel bitky, náhľad NA EX a rekapitulácia Pitky ich ukazovali pri majiteľke. Všetko teraz ráta
// z jednej línie (sDlhmiPoradkyne). Konfigurácie sú zo skutočnej sady: susedia, preškolenie
// Nástrojom (Horoskop {Povera}↔{Hazard}), NA EX (×2) a Odpor. Horoskop má od v11.17 dole „Posilnená {Povera}“ —
// premena na Hazard je v sade len pri Jogurte (z Pečene, tú Poradkyňa nemá), preto test dáva Horoskopu
// hrany spred v11.17 (fixtúra, nie cards.json).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, LineEval, PlacedCard, PlayerId, PodlozenyNastroj } from "../src/index.ts";
import {
  DOVOD_PORADKYNE,
  evaluateLine,
  lineState,
  loadGameData,
  prirastkyPitky,
  rekapitulaciaPitky,
  sDlhmiPoradkyne,
  setupGame,
  viewFor,
  zadlzenieZLinie,
} from "../src/index.ts";

const HOROSKOP_DO_V1116 = "Dedičstvo: Tvoje Povery majú silu 2. Hore: {Hazard}→{Povera}. Dole: {Povera}→{Hazard}.";
const data = loadGameData(
  { ...cardsJson, cards: cardsJson.cards.map((c) => (c.id === "horoskop" ? { ...c, effect_text: HOROSKOP_DO_V1116 } : c)) },
  eldersJson,
  scorecardsJson,
);
const s0 = setupGame(data, 5);

let uidSeq = 770000;
const inst = (defId: string, leftLayout = 0, rightLayout = 0): CardInstance => ({ uid: ++uidSeq, defId, leftLayout, rightLayout });

const PORADKYNA = "financna_poradkyna";
const dlhKarty = (linia: LineEval, p: PlayerId, uid: number): number =>
  (linia.zdroje[p].Dlh ?? []).filter((z) => z.uid === uid && !z.dovody.includes("karta:hrable")).reduce((n, z) => n + z.hodnota, 0);

interface Zostava {
  readonly s: GameState;
  readonly uid: number;
  readonly podlozenie: PodlozenyNastroj["hrana"] | null;
}

/** Poradkyňa hráča 0 na strane 0 vo všetkých rozloženiach, so susedom (svojím aj súperovým), s NA EX a Horoskopom pod ňou. */
function zostavy(): Zostava[] {
  const varianty = data.variants.get(PORADKYNA);
  if (varianty === undefined) throw new Error(PORADKYNA);
  const obcania = [...data.cards.values()].filter((d) => d.tags.includes("Občan") && d.id !== PORADKYNA);
  const out: Zostava[] = [];
  for (let l = 0; l < varianty.left.length; l++) {
    for (let r = 0; r < varianty.right.length; r++) {
      for (const sused of obcania) {
        for (const susedHrac of [0, 1] as const) {
          for (const naex of [false, true]) {
            for (const podlozenie of [null, "horna", "dolna"] as const) {
              const ona = inst(PORADKYNA, l, r);
              const pl: PlacedCard = {
                card: ona,
                playedBy: 0,
                ...(naex ? { naexBy: 1 as PlayerId } : {}),
                ...(podlozenie === null ? {} : { podlozene: [{ card: inst("horoskop"), majitel: 1 as PlayerId, hrana: podlozenie }] }),
              };
              const strany: GameState["strany"] = [[{ card: inst(sused.id), playedBy: susedHrac }, pl], []];
              out.push({ s: { ...s0, strany }, uid: ona.uid, podlozenie });
            }
          }
        }
      }
    }
  }
  return out;
}

describe("Finančná poradkyňa: Dlh jej karty patrí súperovi všade", () => {
  const vsetky = zostavy();

  it("súčty aj rozpis zdrojov: Dlh karty u súpera s dôvodom, majiteľke nič; Pitka ráta to isté", () => {
    const pokrytie = { dlh: 0, posilneny: 0, preskoleny: 0, preskolenyPreč: 0, odporom: 0 };
    for (const { s, uid, podlozenie } of vsetky) {
      const raw = evaluateLine(data, lineState(s));
      const linia = sDlhmiPoradkyne(data, s, raw);
      const jej = dlhKarty(raw, 0, uid);
      const ev = raw.cards.get(uid);
      // Kontrola rozpisu proti slotom karty (aktívne Dlhy × násobok), ako to Pitka rátala predtým.
      const zoSlotov = [...(ev?.left ?? []), ...(ev?.right ?? [])].reduce((n, x) => n + (x?.action === "Dlh" && x.stav === "aktivna" ? x.nasobok : 0), 0);
      expect(jej).toBe(zoSlotov);
      expect(linia.sums[0].Dlh ?? 0).toBe((raw.sums[0].Dlh ?? 0) - jej);
      expect(linia.sums[1].Dlh ?? 0).toBe((raw.sums[1].Dlh ?? 0) + jej);
      expect(dlhKarty(linia, 0, uid)).toBe(0);
      expect(dlhKarty(linia, 1, uid)).toBe(jej);
      for (const z of (linia.zdroje[1].Dlh ?? []).filter((x) => x.uid === uid)) expect(z.dovody).toContain(DOVOD_PORADKYNE);
      expect(zadlzenieZLinie(data, s, raw)).toEqual([linia.sums[0].Dlh ?? 0, linia.sums[1].Dlh ?? 0]);
      expect(zadlzenieZLinie(data, s, linia)).toEqual([linia.sums[0].Dlh ?? 0, linia.sums[1].Dlh ?? 0]);
      expect(sDlhmiPoradkyne(data, s, linia)).toEqual(linia);
      if (jej === 0) continue;
      pokrytie.dlh++;
      if ((linia.zdroje[1].Dlh ?? []).some((z) => z.uid === uid && z.hodnota >= 2)) pokrytie.posilneny++;
      const sloty = [...(ev?.left ?? []), ...(ev?.right ?? [])];
      if (podlozenie === "dolna" && sloty.some((x) => x?.action === "Dlh" && x.povodna === "Povera" && x.stav === "aktivna")) pokrytie.preskoleny++;
      if ((raw.zrusene[0].Dlh ?? []).some((z) => z.uid === uid && z.dovody[0] === "Odpor")) pokrytie.odporom++;
    }
    // Horná hrana Horoskopu {Hazard}→{Povera}: preškolený Dlh nie je Dlh — súper nedostane nič.
    for (const { s, uid, podlozenie } of vsetky) {
      if (podlozenie !== "horna") continue;
      const ev = evaluateLine(data, lineState(s)).cards.get(uid);
      if ([...(ev?.left ?? []), ...(ev?.right ?? [])].some((x) => x?.povodna === "Dlh" && x.action === "Povera" && x.stav === "aktivna")) pokrytie.preskolenyPreč++;
      expect(dlhKarty(sDlhmiPoradkyne(data, s, evaluateLine(data, lineState(s))), 1, uid)).toBe(0);
    }
    // Každý prípad zo zadania sa v sade naozaj vyskytol — inak by test nič neoveril.
    expect(pokrytie.dlh).toBeGreaterThan(0);
    expect(pokrytie.posilneny).toBeGreaterThan(0);
    expect(pokrytie.preskoleny).toBeGreaterThan(0);
    expect(pokrytie.preskolenyPreč).toBeGreaterThan(0);
    expect(pokrytie.odporom).toBeGreaterThan(0);
  });

  it("Dlh zrušený Odporom súper nedostane", () => {
    let overene = 0;
    for (const { s, uid } of vsetky) {
      const raw = evaluateLine(data, lineState(s));
      const zrusene = (raw.zrusene[0].Dlh ?? []).filter((z) => z.uid === uid && z.dovody[0] === "Odpor");
      if (zrusene.length === 0 || dlhKarty(raw, 0, uid) > 0) continue;
      const linia = sDlhmiPoradkyne(data, s, raw);
      expect(linia.sums[1].Dlh ?? 0).toBe(raw.sums[1].Dlh ?? 0);
      overene++;
    }
    expect(overene).toBeGreaterThan(0);
  });

  const sDlhom = vsetky.find(({ s, uid }) => dlhKarty(evaluateLine(data, lineState(s)), 0, uid) > 0);

  it("Pitka pripíše zadĺženie tak, ako ho ukazuje línia", () => {
    if (sDlhom === undefined) throw new Error("bez Dlhu");
    const { s } = sDlhom;
    const linia = sDlhmiPoradkyne(data, s, evaluateLine(data, lineState(s)));
    expect(prirastkyPitky(data, s).zadlzenie).toEqual([linia.sums[0].Dlh ?? 0, linia.sums[1].Dlh ?? 0]);
  });

  it("rekapitulácia Pitky dá jej Dlh súperovi a nič „mimo línie“ nedorovnáva", () => {
    if (sDlhom === undefined) throw new Error("bez Dlhu");
    const { s, uid } = sDlhom;
    const raw = evaluateLine(data, lineState(s));
    const zad = prirastkyPitky(data, s).zadlzenie;
    const nula: [number, number] = [0, 0];
    const r = rekapitulaciaPitky(data, {
      pitka: 1,
      pitkyCelkom: 2,
      line: lineState(s),
      linia: raw,
      zadlzenieZoStola: [zad[0], zad[1]],
      poskodeniePecene: nula,
      poldeci: nula,
      zadlzeniePred: nula,
      prahDlhu: [1, 1],
      dlhy: [zad[0], zad[1]],
      pecenNaZaciatku: nula,
      naexDal: nula,
      prahPecene: [4, 4],
      cirhozy: nula,
      cigarety: nula,
    });
    const dlh = r.akcie?.Dlh ?? [];
    expect(dlh.filter((x) => x.uid === uid).map((x) => x.kto)).toEqual(dlh.filter((x) => x.uid === uid).map(() => 1));
    expect(dlh.filter((x) => x.uid === uid).length).toBeGreaterThan(0);
    expect(dlh.some((x) => x.uid === null)).toBe(false);
  });

  it("klient ráta to isté z pohľadu majiteľky aj súpera (bar, panel bitky, náhľad NA EX)", () => {
    if (sDlhom === undefined) throw new Error("bez Dlhu");
    const { s, uid } = sDlhom;
    const raw = evaluateLine(data, lineState(s));
    const jej = dlhKarty(raw, 0, uid);
    for (const ja of [0, 1] as const) {
      const v = viewFor(data, s, ja);
      const linia = sDlhmiPoradkyne(data, v, evaluateLine(data, lineState(v)));
      expect(dlhKarty(linia, 0, uid)).toBe(0);
      expect(dlhKarty(linia, 1, uid)).toBe(jej);
    }
  });
});
