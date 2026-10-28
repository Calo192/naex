// Stopa posunu markera (roadmapa #95, Michal 2026-10-26): každý posun markera
// staršieho (Pohoršenie, prebytok, patronát) je verejná udalosť a ostáva v stave
// do konca Zhromaždenia po bitke — klient z nej kreslí ducha a účtenku. Pravidlá
// sa nemenia. Body „teraz“ pri staršom (#109) sú tým istým elderScore ako
// záverečné bodovanie — na konci hry sa zhodujú s koniec.body.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState, PlayerId, PosunMarkera } from "../src/index.ts";
import { apply, rozpisSpakov, spakyTeraz, eventsFor, legalCommands, loadGameData, naTahu, rngInt, rngSeed, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Krok {
  readonly pred: GameState;
  readonly po: GameState;
  readonly cmd: Command;
  readonly hrac: PlayerId;
  readonly events: readonly Event[];
}

/** Náhodné partie celé — každý krok so stavom pred a po. */
function* partie(seedy: readonly number[]): Generator<Krok> {
  for (const seed of seedy) {
    let state: GameState = setupGame(data, seed);
    let rng = rngSeed(seed ^ 0x95);
    for (let i = 0; state.koniec === null && i < 20000; i++) {
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      const [j, r] = rngInt(rng, cmds.length);
      rng = r;
      const cmd = cmds[j] as Command;
      const { state: po, events } = apply(data, state, cmd, hrac);
      yield { pred: state, po, cmd, hrac, events };
      state = po;
    }
  }
}

const SEEDY = [1, 2, 3, 5, 8, 13, 21, 34];

describe("posun markera", () => {
  it("každý posun markera má verejnú udalosť so zdrojom, smerom a hráčom", () => {
    const zdroje = new Set<string>();
    for (const k of partie(SEEDY)) {
      const posuny = k.events.filter((e): e is Event & { type: "posunMarkera" } => e.type === "posunMarkera");
      for (const e of posuny) zdroje.add(e.zdroj);
      // Udalosť vidia obaja hráči rovnako — poloha markera je verejná.
      for (const p of [0, 1] as const) expect(eventsFor(k.events, p).filter((e) => e.type === "posunMarkera")).toEqual(posuny);
      for (const e of k.pred.starsi) {
        const teraz = k.po.starsi.find((x) => x.elderId === e.elderId);
        if (teraz === undefined || teraz.marker === e.marker) {
          expect(posuny.some((x) => x.elderId === e.elderId)).toBe(false);
          continue;
        }
        const moje = posuny.filter((x) => x.elderId === e.elderId);
        expect(moje).toHaveLength(1);
        const posun = moje[0] as PosunMarkera;
        expect([posun.z, posun.na]).toEqual([e.marker, teraz.marker]);
        // Pri prebytku je „kto“ držiteľ — rozdeľuje ho od v8 jeho súper (spravidla porazený).
        expect(posun.kto).toBe(k.cmd.type === "prebytok" ? k.pred.bitkaStav?.prebytokDrzi : k.hrac);
        const zdroj = k.cmd.type === "pohorsenie" ? "pohorsenie" : k.cmd.type === "prebytok" ? "prebytok" : k.cmd.type === "patronat" ? "patronat" : k.cmd.type === "kseft" ? "kseft" : k.cmd.type === "kapybara" ? "nastup" : null;
        expect(posun.zdroj).toBe(zdroj);
        if (posun.zdroj === "prebytok") expect(Math.abs(posun.na - posun.z)).toBe(1);
      }
    }
    // kseft = Predsedova vila (v7, len finále na nej).
    for (const z of ["patronat", "pohorsenie", "prebytok"]) expect(zdroje.has(z)).toBe(true);
  });

  it("stopa drží do konca Zhromaždenia po bitke a viewFor ju posiela obom", () => {
    let videlStopuVZhromazdeni = false;
    for (const k of partie(SEEDY.slice(0, 4))) {
      // Začiatok Pitky (koniec Zhromaždenia) stopu zmaže — ostanú len posuny po ňom.
      const zaciatokPitky = k.events.map((e) => e.type === "faza" && e.faza === "pitka").lastIndexOf(true);
      const nove = k.events.slice(zaciatokPitky + 1).filter((e) => e.type === "posunMarkera").length;
      const ocakavane = zaciatokPitky === -1 ? k.pred.posunyMarkerov.length + nove : nove;
      expect(k.po.posunyMarkerov).toHaveLength(ocakavane);
      if (k.po.faza === "pitka") expect(k.po.posunyMarkerov).toEqual([]);
      if (k.po.faza === "zhromazdenie" && k.po.posunyMarkerov.length > 0) videlStopuVZhromazdeni = true;
      for (const p of [0, 1] as const) expect(viewFor(data, k.po, p).posunyMarkerov).toEqual(k.po.posunyMarkerov);
    }
    expect(videlStopuVZhromazdeni).toBe(true);
  });

  it("log posunu menuje staršieho a zónu, nie id", () => {
    let videl = 0;
    for (const k of partie(SEEDY.slice(0, 3))) {
      if (k.cmd.type !== "pohorsenie" && k.cmd.type !== "prebytok") continue;
      const id = k.cmd.elderId;
      const log = k.events.flatMap((e) => (e.type === "log" && /^(Pohoršenie|Prebytok) \(hráč [12]\): /.test(e.text) ? [e.text] : []));
      expect(log).toHaveLength(1);
      expect(log[0]).not.toContain(id);
      expect(log[0]).toMatch(/→ (Neutralita|Znepokojenie|Strach|Vydesenie)/);
      videl++;
    }
    expect(videl).toBeGreaterThan(5);
  });
});

describe("špaky teraz pri staršom (v6)", () => {
  it("na konci hry sedia špaky z pohľadu oboch hráčov a popolník s koncom hry", () => {
    let koncov = 0;
    for (const k of partie(SEEDY)) {
      const koniec = k.po.koniec;
      if (koniec === null || koniec.body === null) continue;
      for (const p of [0, 1] as const) {
        const v = viewFor(data, k.po, p);
        const teraz = spakyTeraz(v);
        expect(teraz.spolu).toEqual(koniec.body);
        expect(teraz.vyplat).toBe(0);
        // Starší dáva špaky len tomu, koho sa bojí.
        for (const s of teraz.starsi) expect(s.spaky[0] === 0 || s.spaky[1] === 0).toBe(true);
        const r = rozpisSpakov(v);
        for (const h of [0, 1] as const) {
          expect(r[h].spolu).toBe(koniec.body[h]);
          expect(r[h].zaBitky + r[h].zaStarsich + r[h].prebytok + r[h].exekutor + r[h].cirhoza + r[h].vykupne).toBe(koniec.body[h]);
          // Výkupné na konci sedí so zdrojmi, ktoré hráčovi ostali (verejné).
          expect(r[h].vykupne).toBe(v.hraci[h].poldeciPlne + Math.floor(v.hraci[h].cigarety / 5));
        }
      }
      koncov++;
    }
    expect(koncov).toBeGreaterThan(2);
  });
});
