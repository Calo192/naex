// Náhľad hrán pred vyložením (playtest 20261017-164450: orientácia hrán
// mätie šiesty playtest za sebou). Náhľad musí presne sedieť s tým, čo
// potom vyhodnotí evaluateLine — inak by hráča zaviedol.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, LineState, PlacedCard, PlayerId, StranaLinie } from "../src/index.ts";
import { evaluateLine, hranyZPohladu, loadGameData, nahladVylozenia, printedSides, stranyLokality, zadlzenieZLinie } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

const obcania = [...data.cards.values()].filter((c) => !c.tags.includes("Lokalita") && !c.tags.includes("Kliatba"));
const lokality = data.lokality;

describe("hrany z pohľadu hráča", () => {
  it("otočená karta má vymenené strany v obrátenom poradí", () => {
    const k = inst(obcania[0]!.id);
    const p = printedSides(data, k);
    const h = hranyZPohladu(data, k, true);
    expect(h.lava).toEqual([...p.right].reverse());
    expect(h.prava).toEqual([...p.left].reverse());
  });

  it("strany lokality sú pre oboch hráčov navzájom vymenené", () => {
    const lok = inst(lokality[0]!.id);
    for (const otocena of [false, true]) {
      const a = stranyLokality(data, lok, otocena, 0);
      const b = stranyLokality(data, lok, otocena, 1);
      expect(b.kTebe).toEqual([...a.kSuperovi].reverse());
      expect(b.kSuperovi).toEqual([...a.kTebe].reverse());
    }
    // Neotočená lokalita obracia k hráčovi 0 svoju vytlačenú ľavú stranu.
    expect(stranyLokality(data, lok, false, 0).kTebe).toEqual([...printedSides(data, lok).left]);
  });
});

describe("náhľad vyloženia sedí s vyhodnotením línie", () => {
  // Pre každú kombináciu: páry z náhľadu = aktivované sloty vnútornej hrany
  // nové karty vo vyhodnotení a zmeny súčtov = rozdiel evaluateLine.
  const pripady: { ja: PlayerId; kam: StranaLinie; otocena: boolean; sused: boolean }[] = [];
  for (const ja of [0, 1] as const)
    for (const kam of ["vlastna", "superova"] as const)
      for (const otocena of [false, true]) for (const sused of [false, true]) pripady.push({ ja, kam, otocena, sused });

  it.each(pripady)("hráč $ja → $kam, lokalita otočená $otocena, sused $sused", ({ ja, kam, otocena, sused }) => {
    let skontrolovane = 0;
    for (let i = 0; i < obcania.length; i++) {
      const karta = inst(obcania[i]!.id);
      const lokalita = inst(lokality[i % lokality.length]!.id);
      const p: PlayerId = kam === "vlastna" ? ja : ja === 0 ? 1 : 0;
      const susedKarta: PlacedCard | null = sused
        ? { card: inst(obcania[(i * 7 + 3) % obcania.length]!.id), playedBy: (i % 2) as PlayerId }
        : null;
      const strana = susedKarta === null ? [] : [susedKarta];
      const line: LineState = { lokalita, lokalitaOtocena: otocena, strany: p === 0 ? [strana, []] : [[], strana] };

      const n = nahladVylozenia(data, line, ja, karta, kam);
      const nova = [...strana, { card: karta, playedBy: ja }];
      const po = evaluateLine(data, { ...line, strany: p === 0 ? [nova, []] : [[], nova] });
      const ev = po.cards.get(karta.uid)!;
      // Vzbura aktivuje aj sloty bez páru — tam sa páry s vyhodnotením nekryjú.
      if (ev.vzbura) continue;
      skontrolovane++;

      expect(n.sused?.stred).toBe(!sused);
      const vytlacena = printedSides(data, karta)[n.vnutornaVytlacena];
      expect(n.vnutorna).toEqual([...vytlacena]);
      const sparovane = new Set(n.pary.map((x) => x.index));
      for (let k = 0; k < 4; k++) {
        const slot = ev[n.vnutornaVytlacena][k];
        if (slot === null || slot === undefined) continue;
        expect(slot.stav !== "neaktivna", `${karta.defId} index ${k}`).toBe(sparovane.has(k));
      }

      const pred = evaluateLine(data, line);
      // Dlh ako ho pripíše Pitka — Finančná poradkyňa ho posiela súperovi (zadlzenieZLinie).
      const dlhPred = zadlzenieZLinie(data, line, pred);
      const dlhPo = zadlzenieZLinie(data, { strany: p === 0 ? [nova, []] : [[], nova] }, po);
      for (const h of [0, 1] as const) {
        for (const a of new Set([...Object.keys(pred.sums[h]), ...Object.keys(po.sums[h]), "Dlh"]) as Set<keyof (typeof po.sums)[0]>) {
          const cakane = a === "Dlh" ? dlhPo[h] - dlhPred[h] : (po.sums[h][a] ?? 0) - (pred.sums[h][a] ?? 0);
          expect(n.zmeny[h][a] ?? 0, `${karta.defId} ${h} ${a}`).toBe(cakane);
        }
      }
    }
    expect(skontrolovane).toBeGreaterThan(20);
  });

  it("na súperovu stranu ide k lokalite tvoja ľavá hrana, na tvoju pravá", () => {
    const karta = inst(obcania[0]!.id);
    const line: LineState = { lokalita: inst(lokality[0]!.id), lokalitaOtocena: false, strany: [[], []] };
    expect(nahladVylozenia(data, line, 0, karta, "vlastna").vnutornaVytlacena).toBe("right");
    expect(nahladVylozenia(data, line, 0, karta, "superova").vnutornaVytlacena).toBe("left");
    expect(nahladVylozenia(data, line, 1, karta, "vlastna").vnutornaVytlacena).toBe("right");
    expect(nahladVylozenia(data, line, 1, karta, "superova").vnutornaVytlacena).toBe("left");
  });
});

describe("náhľad vyloženia vo finále (playtest 20261027-062058)", () => {
  // Prvá karta finále leží na začiatku jednej strany a susedí s oboma: karta na
  // prázdnu druhú stranu sa páruje s ňou, nie s ničím („nič sa nespojí“).
  const pripady: { ja: PlayerId; kam: StranaLinie }[] = [];
  for (const ja of [0, 1] as const) for (const kam of ["vlastna", "superova"] as const) pripady.push({ ja, kam });

  it.each(pripady)("hráč $ja → $kam pri stredovej karte na druhej strane", ({ ja, kam }) => {
    let skontrolovane = 0;
    for (let i = 0; i < obcania.length; i++) {
      const karta = inst(obcania[i]!.id);
      const p: PlayerId = kam === "vlastna" ? ja : ja === 0 ? 1 : 0;
      const stredova: PlacedCard = { card: inst(obcania[(i * 7 + 3) % obcania.length]!.id), playedBy: (i % 2) as PlayerId };
      const line: LineState = { lokalita: null, lokalitaOtocena: false, finale: true, strany: p === 0 ? [[], [stredova]] : [[stredova], []] };

      const n = nahladVylozenia(data, line, ja, karta, kam);
      expect(n.sused?.karta.uid).toBe(stredova.card.uid);
      const nova = [{ card: karta, playedBy: ja }];
      const po = evaluateLine(data, { ...line, strany: p === 0 ? [nova, [stredova]] : [[stredova], nova] });
      const ev = po.cards.get(karta.uid)!;
      if (ev.vzbura) continue;
      skontrolovane++;
      const sparovane = new Set(n.pary.map((x) => x.index));
      for (let k = 0; k < 4; k++) {
        const slot = ev[n.vnutornaVytlacena][k];
        if (slot === null || slot === undefined) continue;
        expect(slot.stav !== "neaktivna", `${karta.defId} index ${k}`).toBe(sparovane.has(k));
      }
    }
    expect(skontrolovane).toBeGreaterThan(20);
  });
});
