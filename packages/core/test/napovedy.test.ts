// Nápovedy Melichara (Michal 2026-10-24): jadro rozpozná situáciu len z pohľadu
// hráča (viewFor), každá nápoveda má spúšťač a katalog sedí s jadrom.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import katalogJson from "../data/vyucba/napovedy.json";
import type { CardInstance, Command, GameState, KatalogNapoved, MarkerPos } from "../src/index.ts";
import {
  apply,
  dalsiaNapoveda,
  legalCommands,
  loadGameData,
  naTahu,
  napovedy,
  rngInt,
  rngSeed,
  setupGame,
  SPUSTACE_NAPOVED,
  viewFor,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const katalog = katalogJson as unknown as KatalogNapoved;
let uid = 90000;
// Nápovedy čítajú len defId — rozloženie karty je jedno.
const inst = (id: string): CardInstance => ({ uid: uid++, defId: id, leftLayout: 0, rightLayout: 0 });
const ids = (s: GameState, p: 0 | 1): string[] => napovedy(data, katalog, viewFor(data, s, p)).map((n) => n.id);

describe("nápovedy — katalóg", () => {
  it("každá nápoveda v napovedy.json má spúšťač v jadre a naopak; poradie je jedinečné", () => {
    expect([...katalog.napovedy.map((n) => n.id)].sort()).toEqual([...SPUSTACE_NAPOVED].sort());
    expect(new Set(katalog.napovedy.map((n) => n.poradie)).size).toBe(katalog.napovedy.length);
  });

  it("lokality s vlastným pravidlom sú skutočné lokality zo sady", () => {
    const lok = katalog.napovedy.find((n) => n.id === "lokalita-pravidlo")?.spustac?.lokality ?? [];
    expect(lok.length).toBeGreaterThan(0);
    for (const id of lok) expect(data.cards.get(id)?.tags, id).toContain("Lokalita");
  });
});

describe("nápovedy — rozpoznanie z pohľadu hráča", () => {
  const s0 = setupGame(data, 11);

  it("rola: na začiatku prvého kola útočník a obranca dostanú každý svoj text", () => {
    expect(s0.faza).toBe("volbaCiela");
    const u = s0.utocnik;
    const pre = (p: 0 | 1) => napovedy(data, katalog, viewFor(data, s0, p)).find((n) => n.id === "rola")?.text ?? "";
    expect(pre(u)).toMatch(/^Si útočník/);
    expect(pre(u === 0 ? 1 : 0)).toMatch(/^Si obranca/);
    expect(ids({ ...s0, kolo: 2 }, 0)).not.toContain("rola");
  });

  it("Cirhóza v súperovej ruke hráčovi nič neprezradí, v jeho vlastnej áno", () => {
    const sCirhozou = (p: 0 | 1): GameState =>
      ({ ...s0, hraci: s0.hraci.map((h, i) => (i === p ? { ...h, ruka: [...h.ruka, inst("cirhoza")] } : h)) }) as unknown as GameState;
    expect(ids(sCirhozou(1), 0)).not.toContain("cirhoza");
    expect(ids(sCirhozou(0), 0)).toContain("cirhoza");
  });

  it("Nástroj v ruke: nápoveda Dedičstva len na vlastnom ťahu v Zhromaždení, s menom karty", () => {
    const zh = (naTahuHrac: 0 | 1): GameState =>
      ({
        ...s0,
        faza: "zhromazdenie",
        ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] },
        hraci: s0.hraci.map((h) => ({ ...h, ruka: [inst("noviny")] })),
        zhromazdenieStav: { naTahu: naTahuHrac, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
      }) as unknown as GameState;
    const n = napovedy(data, katalog, viewFor(data, zh(0), 0)).find((x) => x.id === "dedicstvo");
    expect(n?.text).toMatch(/^Noviny je Nástroj/);
    expect(n?.zvyraznit).toEqual(["ruka:noviny"]);
    expect(ids(zh(1), 0)).not.toContain("dedicstvo");
  });

  it("lokalita s vlastným pravidlom doplní názov a text karty; Jednota nápovedu nemá", () => {
    const krcma = inst("krcma");
    const s = { ...s0, faza: "zhromazdenie", ciel: { typ: "lokalita", lokalita: krcma } } as unknown as GameState;
    const n = napovedy(data, katalog, viewFor(data, s, 0)).find((x) => x.id === "lokalita-pravidlo");
    expect(n?.text).toBe(`Krčma má vlastné pravidlo a platí celé kolo: ${data.cards.get("krcma")?.effectText}`);
    expect(n?.zvyraznit).toEqual(["linia:krcma"]);
    const jednota = { ...s, ciel: { typ: "lokalita", lokalita: inst("jednota") } } as unknown as GameState;
    expect(ids(jednota, 0)).not.toContain("lokalita-pravidlo");
  });

  it("Pohoršenie: kto vyberá, dostane „moje“, súper „superove“", () => {
    const s = {
      ...s0,
      faza: "bitka",
      ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0] },
      bitkaStav: { krok: "pohorsenie", caka: 1, sums: [{}, {}], exekutorHotovy: [true, true], pohorsenieZostava: [0, 1], cirhozy: 0, dlhy: 0 },
    } as unknown as GameState;
    const text = (p: 0 | 1) => napovedy(data, katalog, viewFor(data, s, p)).find((n) => n.id === "pohorsenie")?.text ?? "";
    expect(text(1)).toMatch(/^Tvoje Pohoršenie/);
    expect(text(0)).toMatch(/^Súperovo Pohoršenie/);
  });

  it("priazeň a vydesenie: meno staršieho z karty a variant podľa toho, koho sa bojí", () => {
    const s = { ...s0, starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker: 8 as MarkerPos } : e)) } as GameState;
    const e = s.starsi[0]!;
    const priazen = napovedy(data, katalog, viewFor(data, s, 1)).find((n) => n.id === "priazen");
    expect(priazen?.text).toMatch(new RegExp(`^${data.cards.get(e.karta.defId)?.name} je na tvojej polovici`));
    expect(priazen?.zvyraznit).toEqual([`starsi:${e.elderId}`]);
    // Marker na 8 = vydesil ho hráč 0.
    const vyd = (p: 0 | 1) => napovedy(data, katalog, viewFor(data, s, p)).find((n) => n.id === "vydesenie")?.text ?? "";
    expect(vyd(0)).toMatch(/^Vydesený starší/);
    expect(vyd(1)).toMatch(/^Súper ti vydesil/);
  });

  it("v skončenej partii žiadna nápoveda", () => {
    const s = { ...s0, koniec: { vitaz: 0, dovod: "test", body: null } } as unknown as GameState;
    expect(ids(s, 0)).toEqual([]);
  });

  it("ďalšia nápoveda: najnižšie poradie, ktoré hráč ešte nevidel", () => {
    const s = { ...s0, hraci: s0.hraci.map((h, i) => (i === 0 ? { ...h, ruka: [...h.ruka, inst("cirhoza")] } : h)) } as unknown as GameState;
    const v = viewFor(data, s, 0);
    expect(dalsiaNapoveda(data, katalog, v, new Set())?.id).toBe("rola");
    expect(dalsiaNapoveda(data, katalog, v, new Set(["rola"]))?.id).toBe("cirhoza");
    expect(dalsiaNapoveda(data, katalog, v, new Set(["rola", "cirhoza"]))).toBeNull();
  });
});

describe("nápovedy — náhodné partie", () => {
  it("v partiách sa ukážu základné nápovedy a každý text je doplnený", () => {
    const videne = new Set<string>();
    for (const seed of [1, 2, 3]) {
      let s = setupGame(data, seed);
      let rng = rngSeed(seed);
      for (let i = 0; i < 3000 && s.koniec === null; i++) {
        for (const p of [0, 1] as const) {
          for (const n of napovedy(data, katalog, viewFor(data, s, p))) {
            expect(n.text, n.id).not.toMatch(/[{}]/);
            for (const k of n.zvyraznit) expect(k, n.id).not.toMatch(/[{}]/);
            videne.add(n.id);
          }
        }
        const kto = naTahu(s);
        if (kto === null) break;
        const cmds = legalCommands(data, s, kto);
        const [idx, r2] = rngInt(rng, cmds.length);
        rng = r2;
        s = apply(data, s, cmds[idx] as Command, kto).state;
      }
    }
    for (const id of ["stavba-senku", "rola", "pas-cigarety", "body", "zaverecna"]) expect([...videne], id).toContain(id);
  });
});
