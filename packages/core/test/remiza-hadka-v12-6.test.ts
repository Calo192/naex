// Pravidlá v12.6 (Michal 2026-11-17, session): remízu v tuhom najprv rozhodne hádka, potom Dlhy (§9.4).
// Pri rovnakom tuhom vyhrá víťaz hádky (aj remízy v hádke vyhranej Telefónom); keď hádku nevyhral nikto,
// vyhrá menej Dlhov; aj tu rovnosť = sekera. Nakladačka pri remíze v tuhom ostáva 0. Očakávané hodnoty
// sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, DamageResult, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { battleOutcome, evaluateLine, lineState, loadGameData, odhadSpakovKola, setupGame, vitazBitkyPata } from "../src/index.ts";
import { spustBitku } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

const remiza: DamageResult = { tuhe: [3, 3], makke: [0, 2], celkove: [3, 3], zvysnaViera: [0, 0], zvysnaPovera: [0, 0] };

describe("§9.4 remíza v tuhom: najprv hádka, potom Dlhy (v12.6)", () => {
  it("víťaz hádky vyhrá remízu v tuhom aj s viac Dlhmi; Nakladačku nemá nikto", () => {
    expect(battleOutcome(remiza, { dlhy: [0, 5], hadka: 1 })).toEqual({ vitaz: 1, rozhodlo: "hadka", prebytokDrzi: null, prebytok: 0 });
    expect(battleOutcome(remiza, { dlhy: [5, 0], hadka: 0 })).toMatchObject({ vitaz: 0, rozhodlo: "hadka" });
  });

  it("hádku nevyhral nikto → menej Dlhov; aj Dlhy rovnako → sekera", () => {
    expect(battleOutcome(remiza, { dlhy: [2, 1], hadka: null })).toMatchObject({ vitaz: 1, rozhodlo: "dlhy", prebytokDrzi: null });
    expect(battleOutcome(remiza, { dlhy: [1, 1], hadka: null })).toMatchObject({ vitaz: null, rozhodlo: "sekera" });
  });

  it("rozhoduje tuhé — hádka ani Dlhy pri rozdielnom tuhom nič nemenia", () => {
    expect(battleOutcome({ ...remiza, tuhe: [4, 3] }, { dlhy: [9, 0], hadka: 1 })).toMatchObject({ vitaz: 0, rozhodlo: "tuhe", prebytokDrzi: 0, prebytok: 1 });
  });

  /** Stav tesne pred bitkou s danou hádkou (makke, víťaz, veľkosť) a Dlhmi; hráč 0 má v línii 3 karty, hráč 1 dve. */
  function pred(tuhe: readonly [number, number], hadka: { makke: [number, number]; vitaz: PlayerId | null; velkost: number }, dlhy: readonly [number, number] = [0, 0]): GameState {
    const s0 = setupGame(data, 11, { lokalit: 5 });
    const karty = s0.hraci[0].ruka;
    const polozena = (i: number, playedBy: PlayerId): PlacedCard => ({ card: { ...karty[i % karty.length]!, uid: 9600 + i }, playedBy }) as PlacedCard;
    const b = {
      krok: "hadka",
      caka: null,
      sums: [{ Rana: tuhe[0] }, { Rana: tuhe[1] }],
      exekutorHotovy: [false, false],
      exekutor: [0, 0],
      hadka: { ...hadka, zostava: hadka.velkost, prepadlo: 0, zdvihy: [] },
      damage: null,
      vitaz: null,
      prebytokDrzi: null,
      prebytokZostava: 0,
      prebytokZdvihy: [],
      prebytokPrepadlo: 0,
      spalit: [],
      vesticaHotova: true,
    } as unknown as BitkaStav;
    return {
      ...s0,
      faza: "bitka",
      draftStav: null,
      kolo: 2,
      utocnik: 1,
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
      strany: [[polozena(0, 0), polozena(1, 0), polozena(2, 1)], [polozena(3, 1), polozena(4, 0)]],
      hraci: [
        { ...s0.hraci[0], dlhy: dlhy[0] },
        { ...s0.hraci[1], dlhy: dlhy[1] },
      ],
      bitkaStav: b,
      spaky: [0, 0],
    };
  }

  const logy = (s: GameState): string[] => spustBitku(data, s).events.flatMap((e) => (e.type === "log" ? [e.text] : []));

  it("v bitke: remíza v tuhom, hádku vyhral hráč 2 → bitku vyhráva on (aj s viac Dlhmi), log povie prečo", () => {
    const s = pred([2, 2], { makke: [0, 2], vitaz: 1, velkost: 2 }, [0, 3]);
    const { state: po } = spustBitku(data, s);
    const zaznam = po.nastenka.at(-1)!;
    expect([zaznam.vitaz, zaznam.rozhodlo]).toEqual([1, "hadka"]);
    // Víťaz bitky: 1 špak za každú kartu v línii (5); na sekeru nič nejde.
    expect(zaznam.zaBitku).toEqual([0, 5]);
    expect(po.spakyNaSekere).toBe(0);
    // Nakladačka pri remíze v tuhom nie je.
    expect(zaznam.prebytok).toEqual([0, 0]);
    expect(logy(s).some((t) => t.startsWith("Bitku") && t.includes("hráč 2 (remíza v tuhom, rozhodla hádka)"))).toBe(true);
  });

  it("remíza v hádke vyhraná Telefónom (o 0) je víťazstvo v hádke — rozhodne remízu v tuhom", () => {
    const po = spustBitku(data, pred([2, 2], { makke: [2, 2], vitaz: 0, velkost: 0 }, [4, 0])).state;
    expect([po.nastenka.at(-1)!.vitaz, po.nastenka.at(-1)!.rozhodlo]).toEqual([0, "hadka"]);
  });

  it("hádku nevyhral nikto: rozhodnú Dlhy; aj rovnako Dlhov → sekera, log to povie", () => {
    const dlhy = spustBitku(data, pred([2, 2], { makke: [1, 1], vitaz: null, velkost: 0 }, [2, 1])).state;
    expect([dlhy.nastenka.at(-1)!.vitaz, dlhy.nastenka.at(-1)!.rozhodlo]).toEqual([1, "dlhy"]);
    const s = pred([2, 2], { makke: [0, 0], vitaz: null, velkost: 0 }, [1, 1]);
    const sekera = spustBitku(data, s).state;
    expect([sekera.nastenka.at(-1)!.vitaz, sekera.nastenka.at(-1)!.rozhodlo]).toEqual([null, "sekera"]);
    expect(sekera.spakyNaSekere).toBe(5);
    expect(logy(s).some((t) => t.startsWith("Sekera: remíza v tuhom, hádku nevyhral nikto a Dlhov rovnako"))).toBe(true);
  });

  it("odhad špakov kola ráta remízu v tuhom rovnako ako bitka (hádka pred Dlhmi)", () => {
    const s = pred([2, 2], { makke: [0, 2], vitaz: 1, velkost: 2 }, [0, 3]);
    const linia = evaluateLine(data, lineState(s));
    const odhad = odhadSpakovKola(data, s, linia, { ...remiza, tuhe: [2, 2], makke: [0, 2] });
    expect([odhad.vitaz, odhad.rozhodlo]).toEqual([1, "hadka"]);
    const bezHadky = odhadSpakovKola(data, s, linia, { ...remiza, tuhe: [2, 2], makke: [0, 0] });
    expect([bezHadky.vitaz, bezHadky.rozhodlo]).toEqual([0, "dlhy"]);
  });

  it("Päta, Lakeť, Otočka hádku nemá — remízu v tuhom ďalej rozhodujú Dlhy", () => {
    expect(vitazBitkyPata({ tuhe: [3, 3], dlhy: [2, 1] })).toBe(1);
    expect(vitazBitkyPata({ tuhe: [3, 3], dlhy: [1, 1] })).toBeNull();
  });
});
