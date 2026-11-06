// Výstraha pečene pred vyložením (Michal 2026-11-06, playtest 20261106): koľko Cirhóz
// karta s akciou Poškodenie pečene či Poldeci hrozí — z pohľadu hráča, nie z celého stavu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, ClientState, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, cenaKliatby, hrozbaKliatob, lineState, loadGameData, maAkciuPecene, naexCieleVLinii, nahladPitky, sPrilozenou, setupGame, viewFor, vystrahaPecene } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 99500;
const inst = (defId: string, leftLayout = 0, rightLayout = 0): CardInstance => ({ uid: ++uidSeq, defId, leftLayout, rightLayout });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

function zhromazdenie(strany: GameState["strany"], pecen = 0): GameState {
  const s0 = setupGame(data, 9);
  return {
    ...s0,
    faza: "zhromazdenie",
    kolo: 2,
    utocnik: 0,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    ciel: { typ: "lokalita", lokalita: null },
    strany,
    hraci: [
      { ...s0.hraci[0], ruka: [], poldeciPlne: 1, poldeciVypite: 0, pecen },
      { ...s0.hraci[1], ruka: [], poldeciPlne: 1, poldeciVypite: 0 },
    ],
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

const poVylozeni = (v: ClientState, karta: CardInstance, kam: PlayerId): ClientState => sPrilozenou(data, v, kam, karta, v.ja);

/** Všetky kombinácie rozložení hrán karty — výstraha nesmie závisieť od toho, ktoré vyšlo v partii. */
function* rozlozenia(defId: string): Generator<CardInstance> {
  const v = data.variants.get(defId);
  if (v === undefined) throw new Error(defId);
  for (let l = 0; l < v.left.length; l++) for (let r = 0; r < v.right.length; r++) yield inst(defId, l, r);
}

// Pár susedov stačí a test ostane pod časovým limitom aj na vyťaženom stroji (hrozba NA EX skúša celú líniu).
const susedia = (): readonly CardInstance[] => [...rozlozenia("pijan")].slice(0, 2);

describe("výstraha pečene pred vyložením", () => {
  it("maAkciuPecene: Pijan a karty s Poldeci áno, karta bez nich nie", () => {
    expect(maAkciuPecene(data, inst("pijan"))).toBe(true);
    const bez = [...data.cards.values()].find((d) => !("PoškodeniePečene" in d.left.actions) && !("Poldeci" in d.left.actions) && !("PoškodeniePečene" in d.right.actions) && !("Poldeci" in d.right.actions));
    expect(bez).toBeDefined();
    expect(maAkciuPecene(data, inst(bez!.id))).toBe(false);
  });

  it("sedí s VÝHĽADOM PITKY: toľko Cirhóz, o koľko ich pribudne v nahladPitky po vyložení, a ich cena v špakoch", () => {
    let naslo = 0;
    for (const pecen of [0, 2]) {
      for (const karta of rozlozenia("pijan")) {
        for (const sused of susedia()) {
          const v = viewFor(data, zhromazdenie([[lezi(sused, 0)], []], pecen), 0);
          const po = poVylozeni(v, karta, 0);
          const a = nahladPitky(data, v)[0].cirhozy;
          const b = nahladPitky(data, po)[0].cirhozy;
          const x = vystrahaPecene(data, v, po);
          // Jediná Pitka v kole: žiadne „ďalšie Pitky“, súčet je presne rozdiel výhľadu.
          expect(x?.cirhozy[0] ?? 0).toBe(Math.max(0, b - a));
          if (b > a) {
            naslo++;
            expect(x?.spaky[0]).toBe((b - a) * cenaKliatby("cirhoza"));
          }
        }
      }
    }
    expect(naslo).toBeGreaterThan(0);
  });

  it("ráta aj ďalšie Pitky kola: karta na stole pripisuje pečeň v každej", () => {
    let naslo = 0;
    for (const karta of rozlozenia("pijan")) {
      for (const sused of susedia()) {
        const s = zhromazdenie([[lezi(sused, 0)], []]);
        const jedna = vystrahaPecene(data, viewFor(data, s, 0), poVylozeni(viewFor(data, s, 0), karta, 0));
        const v3 = viewFor(data, { ...s, pitkyCelkom: 3 }, 0);
        const po3 = poVylozeni(v3, karta, 0);
        const tri = vystrahaPecene(data, v3, po3);
        const zaPitku = Math.floor(nahladPitky(data, po3)[0].pecenZoStola / nahladPitky(data, po3)[0].prahPecene);
        if (zaPitku > 0) {
          naslo++;
          expect(tri?.cirhozy[0]).toBe((jedna?.cirhozy[0] ?? 0) + 2 * zaPitku);
        }
      }
    }
    expect(naslo).toBeGreaterThan(0);
  });

  it("súperove skryté NA EX do výpočtu nevstúpi: bez Bzdochy je výstraha rovnaká, aj keď ho dal", () => {
    const zaciatok = [...rozlozenia("pijan")].flatMap((a) => [...rozlozenia("pijan")].map((b) => zhromazdenie([[lezi(a, 0), lezi(b, 0)], []])));
    let naslo = 0;
    for (const z of zaciatok) {
      if (naslo >= 3) break;
      const ciel = naexCieleVLinii(data, lineState(z), 1)[0];
      if (ciel === undefined) continue;
      const hraci: GameState["hraci"] = [{ ...z.hraci[0], cigarety: 5 }, { ...z.hraci[1], cigarety: 5 }];
      let s: GameState = apply(data, { ...z, hraci }, { type: "pass" }, 0).state;
      if (s.faza !== "pitka") s = apply(data, s, { type: "pass" }, 1).state;
      if (s.faza !== "pitka" || s.pitkaStav?.hotovy[1] !== false) continue;
      const karta = inst("pijan");
      const vyp = (t: GameState) => {
        const v = viewFor(data, t, 0);
        return vystrahaPecene(data, v, poVylozeni(v, karta, 0));
      };
      const sNaex = apply(data, s, { type: "naex", uid: ciel }, 1).state;
      expect(sNaex.pitkaStav?.skryteNaex).toEqual([{ hrac: 1, uid: ciel }]);
      expect(viewFor(data, sNaex, 0).pitkaStav?.skryteNaex).toEqual([]);
      expect(vyp(sNaex)).toEqual(vyp(s));
      naslo++;
    }
    expect(naslo).toBeGreaterThan(0);
  });

  it("hrozba NA EX sa ukáže, len keď ju vyloženie zhorší, a je to HROZBA KLIATOB toho istého stola", () => {
    const hrozba = (v: ClientState) => hrozbaKliatob(data, v, 1, true);
    let naslo = 0;
    let bez = 0;
    const bezPecene = [...data.cards.values()].map((d) => inst(d.id)).filter((k) => !maAkciuPecene(data, k)).slice(0, 5);
    for (const karta of [...rozlozenia("pijan"), ...bezPecene]) {
      for (const sused of susedia()) {
        const v = viewFor(data, zhromazdenie([[lezi(sused, 0)], []]), 0);
        const po = poVylozeni(v, karta, 0);
        const x = vystrahaPecene(data, v, po);
        const hPo = hrozba(po);
        const zhorsi = hPo !== null && hPo.cirhozy > (hrozba(v)?.cirhozy ?? 0);
        expect(x?.naex ?? null).toEqual(zhorsi ? hPo : null);
        if (zhorsi) {
          naslo++;
          expect(hPo.hrac).toBe(1);
          expect(hPo.obet).toBe(0);
        } else bez++;
      }
    }
    expect(naslo).toBeGreaterThan(0);
    expect(bez).toBeGreaterThan(0);
  });

  it("bez zmeny na stole výstraha nie je", () => {
    const v = viewFor(data, zhromazdenie([[], []]), 0);
    expect(vystrahaPecene(data, v, v)).toBeNull();
  });
});
