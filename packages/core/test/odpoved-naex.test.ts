// Odpoveď na NA EX a línia bitky v udalostiach (Michal 2026-10-28: „neviem, ako súper
// zareagoval na moje NA EX… vidím len preskočiť pár obrazoviek“): klient musí vedieť, kto
// odpovedal ktorou kartou (aj keď celé vyhodnotenie a bitka prídu v jednom ťahu) a z akej
// línie sa bitka rátala.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { Command, Event, GameState } from "../src/index.ts";
import { apply, eventsFor, loadGameData, naTahu, setupGame, tahBota } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Ťahy botov s udalosťami, kým partia neskončí. */
function partia(seed: number): { readonly pred: GameState; readonly cmd: Command; readonly events: readonly Event[] }[] {
  let s = setupGame(data, seed, { lokalit: 3 });
  const out: { pred: GameState; cmd: Command; events: readonly Event[] }[] = [];
  for (let n = 0; n < 8000 && s.koniec === null; n++) {
    const kto = naTahu(s);
    if (kto === null) break;
    const cmd = tahBota(data, s, kto, seed * 7919 + n);
    const r = apply(data, s, cmd, kto);
    out.push({ pred: s, cmd, events: r.events });
    s = r.state;
  }
  return out;
}

describe("odpoveď na NA EX", () => {
  const tahy = [3, 9, 21].flatMap(partia);

  it("každý ťah hráča na rade s odpoveďou ohlási odpoveď udalosťou (karta alebo žiadna)", () => {
    // Len samotná odpoveď (karta alebo „bez odpovede“) — počas odpovede smú prísť aj voľby efektov (Hasič).
    const reakcie = tahy.filter((t) => t.pred.faza === "pitka" && t.pred.pitkaStav?.reakcia != null && (t.cmd.type === "place" || t.cmd.type === "bezReakcie"));
    expect(reakcie.length).toBeGreaterThan(0);
    for (const t of reakcie) {
      const q = t.pred.pitkaStav?.reakcia;
      const o = t.events.find((e): e is Extract<Event, { type: "odpovedNaNaex" }> => e.type === "odpovedNaNaex");
      expect(o?.hrac).toBe(q);
      if (o !== undefined && o.uid !== null) {
        // Karta z ruky toho, kto odpovedal — verejná, ide lícom hore do línie.
        expect(t.pred.hraci[o.hrac].ruka.find((k) => k.uid === o.uid)?.defId).toBe(o.defId);
      }
      // Rovnaká pre oboch hráčov.
      expect(eventsFor(t.events, 0).some((e) => e.type === "odpovedNaNaex")).toBe(true);
      expect(eventsFor(t.events, 1).some((e) => e.type === "odpovedNaNaex")).toBe(true);
    }
  });

  it("výsledok bitky nesie líniu, z ktorej sa rátal — tie isté karty ako príspevky kariet", () => {
    const bitky = tahy.flatMap((t) => t.events.filter((e): e is Extract<Event, { type: "bitkaVysledok" }> => e.type === "bitkaVysledok"));
    expect(bitky.length).toBeGreaterThan(0);
    for (const b of bitky) {
      const vLinii = new Set([...(b.strany?.[0] ?? []), ...(b.strany?.[1] ?? [])].map((pl) => pl.card.uid));
      for (const k of b.karty) expect(vLinii.has(k.uid)).toBe(true);
    }
  });
});
