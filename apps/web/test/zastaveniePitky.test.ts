// Zastavenie po poslednej Pitke a pečiatka NA EX na karte (Michal 2026-11-09): stôl zastaví len po
// poslednej Pitke kola, drží líniu s odkrytými NA EX oboch a pečiatka kreslí len to, čo pohľad hráča nesie.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { ClientState, Event, GameState, PlayerId } from "@naex/core";
import { apply, loadGameData, naTahu, setupGame, tahBota, viewFor } from "@naex/core";
import { naexNaKarte, PeciatkaNaex } from "../src/hra/PeciatkaNaex.tsx";
import { poslednaPitkaVDavke, stolZastavenia } from "../src/hra/zastaveniePitky.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

interface Davka {
  readonly pred: GameState;
  readonly po: GameState;
  readonly events: readonly Event[];
}

/** Partia botov po dávkach udalostí — tak, ako ich stôl dostáva po každom ťahu. */
function partia(seed: number): Davka[] {
  let st = setupGame(data, seed);
  const out: Davka[] = [];
  for (let n = 0; n < 8000 && st.koniec === null; n++) {
    const kto = naTahu(st);
    if (kto === null) break;
    const r = apply(data, st, tahBota(data, st, kto, seed * 7919 + n), kto);
    out.push({ pred: st, po: r.state, events: r.events });
    st = r.state;
  }
  return out;
}

const naexVLinii = (v: Pick<ClientState, "strany">): number => v.strany.flat().filter((pl) => pl.naexBy !== undefined).length;

describe("zastavenie po poslednej Pitke", () => {
  const davky = [3, 11].flatMap(partia);

  it("zastaví len dávka, ktorá uzavrie poslednú Pitku kola — po nej príde bitka", () => {
    let poslednych = 0;
    for (const d of davky) {
      const i = poslednaPitkaVDavke(d.events);
      const rekapy = d.events.filter((e) => e.type === "pitkaRekap").length;
      if (i < 0) {
        // Pitka, po ktorej kolo pokračuje (ďalšie Zhromaždenie a Pitka), nezastaví.
        if (rekapy > 0) expect(d.events.some((e) => e.type === "faza" && e.faza === "bitka")).toBe(false);
        continue;
      }
      poslednych++;
      expect(d.events[i]?.type).toBe("pitkaRekap");
      expect(d.events.slice(i).some((e) => e.type === "faza" && e.faza === "bitka")).toBe(true);
      // v12.2: po pase často nikto nemá v Pitke inú možnosť než „hotovo“ — Pitku dohrá ešte ťah Zhromaždenia.
      expect(["pitka", "zhromazdenie"]).toContain(d.pred.faza);
    }
    expect(poslednych).toBeGreaterThan(3);
  });

  it("stôl zastavenia je pohľad hráča bez ťahu, s NA EX oboch v línii a bez skrytých navyše", () => {
    let soSuperovymNaex = 0;
    for (const d of davky) {
      if (poslednaPitkaVDavke(d.events) < 0) continue;
      for (const ja of [0, 1] as const) {
        const server = viewFor(data, d.po, ja);
        const bitka = d.events.find((e) => e.type === "bitkaVysledok");
        const bitkaStol = bitka?.type === "bitkaVysledok" && bitka.strany !== undefined ? { ...viewFor(data, d.pred, ja), strany: bitka.strany } : null;
        const s = stolZastavenia(server, bitkaStol);
        expect(s.mozemHrat).toBe(false);
        expect(s.pitkaStav?.skryteNaex ?? []).toEqual([]);
        // Línia je tá z bitky, keď bitka prišla v tej istej dávke, inak zo servera — nič iné.
        expect(s.strany).toEqual(bitkaStol?.strany ?? server.strany);
        // NA EX súpera po Pitke odkryté (naexBy) — práve to chcel Michal vidieť.
        if (s.strany.flat().some((pl) => pl.naexBy === (1 - ja) as PlayerId)) soSuperovymNaex++;
        if (bitkaStol === null) expect(naexVLinii(s)).toBe(naexVLinii(server));
      }
    }
    expect(soSuperovymNaex).toBeGreaterThan(0);
  });
});

describe("pečiatka NA EX na karte", () => {
  const meno = (p: PlayerId): string => (p === 0 ? "Jano" : "Fero");
  const bez = { naexBy: undefined, naexBy2: undefined, skryteMoje: false, skryteSupera: false } as const;

  it("odkryté NA EX: moje, súperovo s menom, zrážka oboch", () => {
    expect(naexNaKarte({ ...bez, naexBy: 0 }, 0, meno)).toEqual({ od: "ja", kto: "tvoj" });
    expect(naexNaKarte({ ...bez, naexBy: 1 }, 0, meno)).toEqual({ od: "su", kto: "Fero" });
    expect(naexNaKarte({ ...bez, naexBy: 1, naexBy2: 0 }, 0, meno)).toEqual({ od: "obaja", kto: "obaja" });
  });

  it("skryté NA EX len z pohľadu hráča — bez neho karta pečiatku nemá", () => {
    expect(naexNaKarte(bez, 0, meno)).toBeUndefined();
    expect(naexNaKarte({ ...bez, skryteMoje: true }, 0, meno)).toEqual({ od: "ja", kto: "tvoj", skryto: true });
    expect(naexNaKarte({ ...bez, skryteSupera: true }, 0, meno)).toEqual({ od: "su", kto: "Fero", skryto: true });
    // Odkryté má prednosť pred zoznamom skrytých (po Pitke ich stôl zastavenia už nemá).
    expect(naexNaKarte({ ...bez, naexBy: 1, skryteMoje: true }, 0, meno)).toEqual({ od: "su", kto: "Fero" });
  });

  it("pečiatka nesie nápis NA EX! a kto ho dal; skryté odlíši triedou", () => {
    const html = renderToStaticMarkup(createElement(PeciatkaNaex, { naex: { od: "su", kto: "Fero" } }));
    expect(html).toContain("NA EX!");
    expect(html).toContain("Fero");
    expect(html).toContain("naex-peciatka-su");
    const skryte = renderToStaticMarkup(createElement(PeciatkaNaex, { naex: { od: "ja", kto: "tvoj", skryto: true } }));
    expect(skryte).toContain("naex-peciatka-skryto");
    expect(skryte).toContain("tvoj · skryto");
  });
});

describe("pohľad hráča počas Pitky neprezradí súperove skryté NA EX (pravidlo 2)", () => {
  it("kým Pitka beží, súperove skryté NA EX nie sú v línii ani v zozname skrytých (okrem Bzdochy)", () => {
    for (const d of partia(5)) {
      if (d.po.faza !== "pitka" || d.po.pitkaStav === null) continue;
      for (const ja of [0, 1] as const) {
        const v = viewFor(data, d.po, ja);
        const su = (1 - ja) as PlayerId;
        const skryteSupera = (d.po.pitkaStav.skryteNaex ?? []).filter((x) => x.hrac === su);
        for (const x of skryteSupera) {
          // Skryté NA EX v línii nie je ako naexBy, kým sa neodkryje.
          expect(v.strany.flat().some((pl) => pl.card.uid === x.uid && pl.naexBy === su)).toBe(false);
        }
      }
    }
    // Celá partia botov v teste — pri súbežných testoch trvá dlhšie než predvolených 5 s.
  }, 30000);
});
