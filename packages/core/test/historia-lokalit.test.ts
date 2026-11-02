// História lokalít (Michal 2026-10-31: súhrn Pitiek a bitky po kliku na nástenke) — sedí
// s nástenkou a s udalosťami, je len evidencia (stav jadra sa nemení) a nesie len to, čo
// obaja hráči smeli vidieť (nemenné pravidlo 2): žiadna súkromná udalosť, žiadna karta,
// ktorá v tej chvíli nebola lícom hore v línii pred oboma.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Event, GameState, HistoriaLokalit, PlayerId } from "../src/index.ts";
import {
  apply,
  loadGameData,
  lokalityPreKlienta,
  lokalityZmenene,
  mozeHrat,
  naTahu,
  novaHistoriaLokalit,
  rngInt,
  rngSeed,
  setupGame,
  tahBota,
  viewFor,
  zapisDoHistorie,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Partia {
  readonly s: GameState;
  readonly h: HistoriaLokalit;
  /** Karty, ktoré niekedy ležali lícom hore v línii v pohľade OBOCH hráčov, a lokality. */
  readonly verejne: ReadonlySet<number>;
  readonly bitky: Event[];
  readonly odpovede: number;
  readonly posuny: number;
  /** Koľkokrát história zmenila to, čo dostane klient. */
  readonly poslani: number;
}

function partia(seed: number, lokalit = 5): Partia {
  let s = setupGame(data, seed, { lokalit });
  let rng = rngSeed(seed ^ 0x33);
  let h = novaHistoriaLokalit(s);
  const verejne = new Set<number>();
  const bitky: Event[] = [];
  let odpovede = 0;
  let posuny = 0;
  let poslani = 0;
  const pozri = (x: GameState): void => {
    const v0 = viewFor(data, x, 0);
    const v1 = viewFor(data, x, 1);
    const v1uid = new Set([...v1.strany[0], ...v1.strany[1]].map((pl) => pl.card.uid));
    for (const pl of [...v0.strany[0], ...v0.strany[1]]) if (v1uid.has(pl.card.uid)) verejne.add(pl.card.uid);
    for (const b of v0.nastenka) if (b.lokalita !== null) verejne.add(b.lokalita.uid);
    for (const e of v0.starsi) verejne.add(e.karta.uid);
  };
  for (let n = 0; n < 20000 && s.koniec === null; n++) {
    const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
    if (p === null) break;
    const [j, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd = tahBota(data, s, p, j, { povaha: n % 2 === 0 ? "stamgast" : "chamtivy" });
    const { state: po, events } = apply(data, s, cmd, p);
    const pred = h;
    h = zapisDoHistorie(h, s, cmd, p, po, events);
    if (lokalityZmenene(pred, h)) poslani++;
    pozri(po);
    for (const e of events) {
      if (e.type === "bitkaVysledok") bitky.push(e);
      if (e.type === "odpovedNaNaex") odpovede++;
      if (e.type === "zmenaMarkera") posuny++;
    }
    s = po;
  }
  return { s, h, verejne, bitky, odpovede, posuny, poslani };
}

/** Všetky čísla pod kľúčom „uid“ kdekoľvek v objekte. */
function uidy(x: unknown, out: number[] = []): number[] {
  if (Array.isArray(x)) for (const y of x) uidy(y, out);
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === "uid" && typeof v === "number") out.push(v);
      else uidy(v, out);
    }
  }
  return out;
}

describe("história lokalít", () => {
  for (const seed of [8, 21]) {
    it(`seed ${seed}: kolo s bitkou = záznam nástenky, Pitky, odpovede a posuny sedia`, () => {
      const { s, h, bitky, odpovede, posuny, poslani } = partia(seed);
      expect(s.koniec).not.toBeNull();
      const lokality = lokalityPreKlienta(h);
      // Každá bitka na nástenke má svoj záznam v histórii (párujú sa kolom).
      expect(lokality.map((z) => z.kolo)).toEqual(s.nastenka.map((b) => b.kolo));
      for (const z of lokality) {
        const b = s.nastenka.find((x) => x.kolo === z.kolo);
        expect(z.bitka?.vitaz).toBe(b?.vitaz);
        expect(z.lokalita).toBe(b?.lokalita?.defId ?? null);
        // Pitky v poradí a bez dvojíc; zdroje po kole sú zapísané.
        const cisla = z.pitky.map((p) => p.pitka);
        expect(new Set(cisla).size).toBe(cisla.length);
        expect(z.pitky.length).toBeGreaterThan(0);
        expect(z.koniec).not.toBeNull();
      }
      // Bitky v histórii sú tie isté rekapitulácie, aké prišli v udalostiach.
      expect(lokality.map((z) => z.bitka?.tuheSpolu)).toEqual(bitky.map((e) => (e.type === "bitkaVysledok" ? e.rekap?.tuheSpolu : undefined)));
      // Odpovede na NA EX a posuny markerov sa nestratia (posledné kolo bez bitky ich môže mať navyše).
      const vsetky = [...h.kola, h.kolo];
      expect(vsetky.reduce((a, z) => a + z.pitky.reduce((c, p) => c + p.odpovede.length, 0), 0) + h.odpovede.length).toBe(odpovede);
      expect(vsetky.reduce((a, z) => a + z.posuny.length, 0)).toBe(posuny);
      // Klient dostane históriu len pri zmene — nie s každým ťahom.
      expect(poslani).toBeGreaterThanOrEqual(lokality.length);
      expect(poslani).toBeLessThan(lokality.length * 12);
      // Zdroje po poslednej Pitke a po kole sú verejné počty zo stavu.
      const posledne = h.kola.at(-1);
      if (posledne?.koniec != null && s.koniec?.body == null) expect(posledne.koniec[0].spaky).toBe(s.spaky[0]);
    }, 60_000);
  }

  it("nesie len verejné: žiadna súkromná udalosť ani karta, ktorú obaja nevideli lícom hore", () => {
    const { h, verejne } = partia(13);
    const text = JSON.stringify(h);
    expect(text).not.toContain('"pre"');
    expect(text).not.toContain('"ruka"');
    expect(text).not.toContain('"doberaci"');
    expect(uidy(h).length).toBeGreaterThan(20);
    const skryte = uidy(h).filter((u) => !verejne.has(u));
    expect(skryte).toEqual([]);
  }, 60_000);

  it("súkromné udalosti (pre) ignoruje a bez zmeny vráti ten istý objekt", () => {
    const s = setupGame(data, 3, { lokalit: 3 });
    const h = novaHistoriaLokalit(s);
    const sukromna = { type: "odpovedNaNaex", hrac: 0, uid: 5, defId: "pijan", ciel: "vlastna", pre: 0 } as unknown as Event;
    const po = zapisDoHistorie(h, s, { type: "pass" }, 0, s, [sukromna]);
    // Pas sa zapíše (verejný príkaz), súkromná odpoveď nie.
    expect(po.pasy).toHaveLength(1);
    expect(po.odpovede).toHaveLength(0);
    expect(zapisDoHistorie(po, s, { type: "naex", uid: 1 } as never, 0, s, [])).toBe(po);
    expect(lokalityZmenene(h, po)).toBe(false);
  });

  it("je len evidencia — partia s ňou aj bez nej skončí rovnako", () => {
    const a = partia(8, 3).s;
    let s = setupGame(data, 8, { lokalit: 3 });
    let rng = rngSeed(8 ^ 0x33);
    for (let n = 0; n < 20000 && s.koniec === null; n++) {
      const p: PlayerId | null = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s);
      if (p === null) break;
      const [j, r] = rngInt(rng, 2 ** 31);
      rng = r;
      s = apply(data, s, tahBota(data, s, p, j, { povaha: n % 2 === 0 ? "stamgast" : "chamtivy" }), p).state;
    }
    expect(JSON.stringify(s)).toBe(JSON.stringify(a));
  }, 60_000);
});
