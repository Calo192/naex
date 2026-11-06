// Režim Päta, Lakeť, Otočka: čísla a príklady z rozhodnutí Michala 2026-11-01 a 2026-11-06.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import katalogJson from "../data/vyucba/napovedy.json";
import type { CardInstance, KrokBitkyPata, PataStav, PlayerId, StarsiPata, ZamerLieceniaPata, ZamerUtokuPata } from "../src/index.ts";
import {
  MA_DOST,
  NAPOVEDY_MIMO_PATY,
  PATA,
  apply,
  dajVyzrat,
  legalCommands,
  mozeHrat,
  setupGame,
  tahBotaPata,
  viewFor,
  jeVyradenaVPate,
  loadGameData,
  lokalityNaVyberPata,
  maDost,
  naTahuDraftu,
  novyStarsi,
  odohrajLokalitu,
  palenePriExekucii,
  platnyZamerLiecenia,
  platnyZamerUtoku,
  preskladajRad,
  spocitajSumy,
  stojaci,
  sumyRadu,
  vyhodnotRad,
  tuheHrobara,
  tuheStrany,
  vitazBitkyPata,
  vyhodnotLieceniePata,
  vyhodnotUtokPata,
  vymenVRadeSupera,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uid = 90000;
const karta = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
const starsi = (defId: string, zmeny: Partial<StarsiPata> = {}): StarsiPata => ({ ...novyStarsi(karta(defId)), ...zmeny });

function stav(a: readonly StarsiPata[], b: readonly StarsiPata[]): PataStav {
  return { rady: [a, b] };
}

function zaklad(): PataStav {
  return stav(
    [starsi("farar"), starsi("krcmarka"), starsi("starosta"), starsi("postarka")],
    [starsi("hrobar"), starsi("autobusar"), starsi("veterinar"), starsi("vychovavatelka")],
  );
}

/** Vstup testu: oba kroky bitky jedného hráča. */
interface VstupBitkyPata {
  readonly tuhe: number;
  readonly povery: number;
  readonly pohorsenie: number;
  readonly viera: number;
  readonly roboty: number;
  readonly silaRoboty: number;
  readonly abstaky: number;
  readonly dlhy: number;
  readonly bezExekucie: boolean;
  readonly zamer: ZamerLieceniaPata & ZamerUtokuPata;
}

const nic: VstupBitkyPata = {
  tuhe: 0,
  povery: 0,
  pohorsenie: 0,
  viera: 0,
  roboty: 0,
  silaRoboty: 1,
  abstaky: 0,
  dlhy: 0,
  bezExekucie: false,
  zamer: { tuhe: {}, jed: {}, robotyNaDlh: 0, liecenie: {} },
};
const vstup = (z: Partial<VstupBitkyPata>): VstupBitkyPata => ({ ...nic, ...z });

/** Celá bitka: prvý krok, a ak ním partia neskončila, druhý. */
function vyhodnotBitkuPata(s: PataStav, v: readonly [VstupBitkyPata, VstupBitkyPata], utocnik: PlayerId): KrokBitkyPata {
  const b = { tuhe: [v[0].tuhe, v[1].tuhe], abstaky: [v[0].abstaky, v[1].abstaky], dlhy: [v[0].dlhy, v[1].dlhy], utocnik } as const;
  const krok = vyhodnotLieceniePata(s, v, b);
  return krok.vitazPartie === null ? vyhodnotUtokPata(krok, v, b) : krok;
}
const najdi = (s: PataStav, p: PlayerId, id: string): StarsiPata => s.rady[p].find((x) => x.karta.defId === id)!;

describe("draft a pečeň", () => {
  it("draft je hadovitý A B B A A B B A a po ôsmich výberoch končí", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => naTahuDraftu(1, i))).toEqual([1, 0, 0, 1, 1, 0, 0, 1]);
    expect(naTahuDraftu(0, 8)).toBeNull();
  });

  it("pečeň × 2 podľa Michala 2026-11-06, Farár znížený po prvom meraní", () => {
    expect(PATA.PECEN).toEqual({
      farar: 27,
      krcmarka: 36,
      starosta: 33,
      postarka: 24,
      hrobar: 33,
      autobusar: 30,
      veterinar: 27,
      vychovavatelka: 27,
    });
  });

  it("každý z ôsmich starších v dátach má pečeň a unikátne Má dosť", () => {
    const idy = [...data.elders.keys()].sort();
    expect(Object.keys(PATA.PECEN).sort()).toEqual(idy);
    expect(Object.keys(MA_DOST).sort()).toEqual(idy);
    expect(new Set(Object.values(MA_DOST).map((m) => m.text)).size).toBe(8);
  });

  it("vyradené karty a lokality existujú v sade", () => {
    for (const id of PATA.VYRADENE) {
      expect(data.cards.has(id), id).toBe(true);
      expect(jeVyradenaVPate(id)).toBe(true);
    }
    expect(jeVyradenaVPate("polovnicka_chata")).toBe(false);
  });
});

describe("rad", () => {
  const rad = (ids: readonly string[], podrazeni: readonly string[] = []): StarsiPata[] =>
    ids.map((id) => starsi(id, { podrazeny: podrazeni.includes(id) }));

  it("spoj rad[i].pravá ↔ rad[i + 1].ľavá je rovnaký pre oboch hráčov", () => {
    const r = rad(["farar", "hrobar", "krcmarka", "autobusar"]);
    expect(sumyRadu(data, r, 1)).toEqual(sumyRadu(data, r, 0));
  });

  it("rad dá nejaké akcie a osamotený starší žiadne", () => {
    const sumy = sumyRadu(data, rad(["farar", "hrobar", "krcmarka", "autobusar"]), 0);
    expect(Object.values(sumy).reduce((a, n) => a + (n ?? 0), 0)).toBeGreaterThan(0);
    expect(sumyRadu(data, rad(["farar"]), 0)).toEqual({});
  });

  it("presné akcie spojov: Poštárka vedľa Hrobára, Posilnenie zdvojí Pohoršenie", () => {
    // Poštárka pravá [Vízia, Dlh, Posilnenie, –] ↔ Hrobár ľavá [Petelica, Pečeň, Pohoršenie, –].
    expect(sumyRadu(data, rad(["postarka", "hrobar"]), 0)).toEqual({ Vízia: 1, Dlh: 1, Petelica: 1, PoškodeniePečene: 1, Pohoršenie: 2 });
  });

  it("akcie po starších: Poštárka vedľa Hrobára, súčet sedí s radom a podrazený v rozpise nie je", () => {
    const r = rad(["postarka", "hrobar"]);
    const [postarka, hrobar] = r as [StarsiPata, StarsiPata];
    const v = vyhodnotRad(data, r, 0);
    expect(v.naStarsom.get(postarka.karta.uid)).toEqual({ Vízia: 1, Dlh: 1 });
    expect(v.naStarsom.get(hrobar.karta.uid)).toEqual({ Petelica: 1, PoškodeniePečene: 1, Pohoršenie: 2 });
    expect(v.sumy).toEqual(sumyRadu(data, r, 0));
    const spadnuty = rad(["postarka", "hrobar"], ["postarka"]);
    const s = vyhodnotRad(data, spadnuty, 0);
    expect(s.naStarsom.has((spadnuty[0] as StarsiPata).karta.uid)).toBe(false);
    expect(s.naStarsom.get((spadnuty[1] as StarsiPata).karta.uid)).toEqual({ Petelica: 1, PoškodeniePečene: 1, Pohoršenie: 1 });
  });

  it("podrazený: jeho akcie neplatia, sused svoju dostane a jeho Posilnenie nezdvojuje", () => {
    expect(sumyRadu(data, rad(["postarka", "hrobar"], ["postarka"]), 0)).toEqual({ Petelica: 1, PoškodeniePečene: 1, Pohoršenie: 1 });
    expect(sumyRadu(data, rad(["postarka", "hrobar"], ["hrobar"]), 0)).toEqual({ Vízia: 1, Dlh: 1 });
  });

  it("podrazený v strede radu spája oboch susedov", () => {
    // Hrobár pravá [–, Dlh, Rana, Pohoršenie] ↔ Krčmárka ľavá [–, Poldeci, Obmedzenie, Cigareta].
    expect(sumyRadu(data, rad(["postarka", "hrobar", "krcmarka"], ["hrobar"]), 0)).toEqual({
      Vízia: 1,
      Dlh: 1,
      Poldeci: 1,
      Obmedzenie: 1,
      Cigareta: 1,
    });
  });

  it("Odpor podrazeného suseda neruší, Odpor živého áno", () => {
    // Vychovávateľka pravá [–, Odpor, Rana, Pečeň] ↔ Autobusár ľavá [Pecka, Cigareta, Rana, –].
    expect(sumyRadu(data, rad(["vychovavatelka", "autobusar"]), 0).Cigareta).toBeUndefined();
    expect(sumyRadu(data, rad(["vychovavatelka", "autobusar"], ["vychovavatelka"]), 0)).toEqual({ Cigareta: 1, Rana: 1 });
  });

  it("podrazený spoj bez partnera nič neaktivuje: krajný starší v rade má vonkajšiu hranu voľnú", () => {
    expect(sumyRadu(data, rad(["postarka", "hrobar"], ["postarka", "hrobar"]), 0)).toEqual({});
  });

  it("súčty radu a línie sa sčítajú", () => {
    expect(spocitajSumy({ Rana: 2, Viera: 1 }, { Rana: 3, Pecka: 1 })).toEqual({ Rana: 5, Viera: 1, Pecka: 1 });
  });

  it("preskladanie berie len vlastných starších, každého raz", () => {
    const s = zaklad();
    const po = preskladajRad(s, 0, ["postarka", "starosta", "krcmarka", "farar"]);
    expect(po?.rady[0].map((x) => x.karta.defId)).toEqual(["postarka", "starosta", "krcmarka", "farar"]);
    expect(preskladajRad(s, 0, ["farar", "farar", "krcmarka", "starosta"])).toBeNull();
    expect(preskladajRad(s, 0, ["hrobar", "krcmarka", "starosta", "postarka"])).toBeNull();
    expect(preskladajRad(s, 0, ["farar"])).toBeNull();
  });
});

describe("štít Viery", () => {
  it("Michalov príklad: 3 a nazbierané 5 bez poškodenia = 8 na každom", () => {
    const s = stav(
      [starsi("farar", { stit: 3 }), starsi("krcmarka", { stit: 3 }), starsi("starosta", { stit: 3 }), starsi("postarka", { stit: 3 })],
      zaklad().rady[1],
    );
    const po = vyhodnotBitkuPata(s, [vstup({ viera: 5 }), nic], 0).stav;
    expect(po.rady[0].map((x) => x.stit)).toEqual([8, 8, 8, 8]);
    expect(po.rady[0].map((x) => x.pecen)).toEqual([27, 36, 33, 24]);
  });

  it("schválený príklad: štít 3, 2 Povery, 4 tuhé na Farára", () => {
    const s = stav(
      [starsi("farar", { stit: 3 }), starsi("krcmarka", { stit: 3 }), starsi("starosta", { stit: 3 }), starsi("postarka", { stit: 3 })],
      zaklad().rady[1],
    );
    const po = vyhodnotBitkuPata(s, [nic, vstup({ tuhe: 4, povery: 2, zamer: { ...nic.zamer, tuhe: { farar: 4 } } })], 0).stav;
    expect(najdi(po, 0, "farar")).toMatchObject({ pecen: 24, stit: 0 });
    for (const id of ["krcmarka", "starosta", "postarka"]) expect(najdi(po, 0, id).stit, id).toBe(1);
    expect(najdi(po, 0, "krcmarka").pecen).toBe(36);
    const dalsie = vyhodnotBitkuPata(po, [vstup({ viera: 5 }), nic], 0).stav;
    expect(najdi(dalsie, 0, "farar").stit).toBe(5);
    expect(najdi(dalsie, 0, "krcmarka").stit).toBe(6);
  });

  it("nová Viera chráni už v tej istej bitke a jed ani exekúciu netlmí", () => {
    const s = zaklad();
    const po = vyhodnotBitkuPata(
      s,
      [vstup({ viera: 10, dlhy: 2 }), vstup({ pohorsenie: 2, zamer: { ...nic.zamer, jed: { farar: 2 } } })],
      0,
    ).stav;
    // Jed 2 + exekúcia 1 idú mimo štítu, ostatným len exekúcia.
    expect(najdi(po, 0, "farar")).toMatchObject({ pecen: 24, stit: 10, jed: 1 });
    expect(najdi(po, 0, "krcmarka")).toMatchObject({ pecen: 35, stit: 10 });
  });
});

describe("jed", () => {
  it("3 → 3 poškodenia, ostane 2, v ďalšej bitke 2; nové sa pripočíta", () => {
    let s = zaklad();
    const naFarara = (n: number): VstupBitkyPata => vstup({ pohorsenie: n, zamer: { ...nic.zamer, jed: { farar: n } } });
    s = vyhodnotBitkuPata(s, [nic, naFarara(3)], 0).stav;
    expect(najdi(s, 0, "farar")).toMatchObject({ pecen: 24, jed: 2 });
    s = vyhodnotBitkuPata(s, [nic, nic], 0).stav;
    expect(najdi(s, 0, "farar")).toMatchObject({ pecen: 22, jed: 1 });
    s = vyhodnotBitkuPata(s, [nic, naFarara(2)], 0).stav;
    expect(najdi(s, 0, "farar")).toMatchObject({ pecen: 19, jed: 2 });
  });

  it("Má dosť Farára: jed klesá o 2 a nejde pod nulu", () => {
    const s = stav(
      [starsi("farar", { podrazeny: true, pecen: 0 }), starsi("krcmarka", { jed: 3 }), starsi("starosta", { jed: 1 }), starsi("postarka")],
      zaklad().rady[1],
    );
    const po = vyhodnotBitkuPata(s, [nic, nic], 0).stav;
    expect(najdi(po, 0, "krcmarka")).toMatchObject({ pecen: 33, jed: 1 });
    expect(najdi(po, 0, "starosta")).toMatchObject({ pecen: 32, jed: 0 });
  });

  it("jed na staršom, ktorý v tej bitke padol, prepadne", () => {
    const s = stav(
      [starsi("farar", { pecen: 2 }), ...zaklad().rady[0].slice(1)],
      zaklad().rady[1],
    );
    const v = vyhodnotBitkuPata(s, [nic, vstup({ tuhe: 2, pohorsenie: 5, zamer: { ...nic.zamer, tuhe: { farar: 2 }, jed: { farar: 5 } } })], 0);
    expect(najdi(v.stav, 0, "farar")).toMatchObject({ podrazeny: true, jed: 0 });
    expect(v.precerpanie[0]).toBe(0);
  });
});

describe("Robota, exekúcia, Dať vyžrať", () => {
  it("Robota vylieči 2, aj nad pôvodnú pečeň", () => {
    const v = vyhodnotBitkuPata(zaklad(), [vstup({ roboty: 1, zamer: { ...nic.zamer, liecenie: { farar: 1 } } }), nic], 0);
    expect(najdi(v.stav, 0, "farar").pecen).toBe(29);
  });

  it("Robota spáli Dlh, s Fúrikom dva, a tým ušetrí exekúciu", () => {
    const palenie = vstup({ roboty: 1, silaRoboty: 2, dlhy: 2, zamer: { ...nic.zamer, robotyNaDlh: 1 } });
    const v = vyhodnotBitkuPata(zaklad(), [palenie, nic], 0);
    expect(v.dlhyPo[0]).toBe(0);
    expect(najdi(v.stav, 0, "farar").pecen).toBe(27);
  });

  it("Robota padnutého neoživí", () => {
    const s = stav([starsi("farar", { podrazeny: true, pecen: -2 }), ...zaklad().rady[0].slice(1)], zaklad().rady[1]);
    const v = vyhodnotBitkuPata(s, [vstup({ roboty: 2, zamer: { ...nic.zamer, liecenie: { farar: 2 } } }), nic], 0);
    expect(najdi(v.stav, 0, "farar")).toMatchObject({ podrazeny: true, pecen: -2 });
  });

  it("exekúcia páli polovicu Dlhov nahor a uberie toľko každému stojacemu", () => {
    expect(palenePriExekucii(3)).toBe(2);
    const v = vyhodnotBitkuPata(zaklad(), [vstup({ dlhy: 3 }), nic], 0);
    expect(v.dlhyPo[0]).toBe(1);
    expect(v.stav.rady[0].map((x) => x.pecen)).toEqual([25, 34, 31, 22]);
  });

  it("Záhradkár: exekúcia neplatí a Dlhy ostanú", () => {
    const v = vyhodnotBitkuPata(zaklad(), [vstup({ dlhy: 3, bezExekucie: true }), nic], 0);
    expect(v.dlhyPo[0]).toBe(3);
    expect(v.stav.rady[0].map((x) => x.pecen)).toEqual([27, 36, 33, 24]);
  });

  it("Dať vyžrať dá stojacemu 3 pečene, aj opakovane; podrazeného neoživí", () => {
    const s = stav([starsi("farar", { podrazeny: true, pecen: 0 }), ...zaklad().rady[0].slice(1)], zaklad().rady[1]);
    expect(dajVyzrat(s, 0, "farar")).toBeNull();
    expect(dajVyzrat(s, 0, "hrobar")).toBeNull();
    const raz = dajVyzrat(s, 0, "krcmarka")!;
    const dva = dajVyzrat(raz, 0, "krcmarka")!;
    expect(najdi(dva, 0, "krcmarka").pecen).toBe(42);
  });
});

describe("Má dosť a podrazenie", () => {
  it("platí aj pri podrazení vlastnou exekúciou", () => {
    const s = stav([starsi("krcmarka", { pecen: 1 }), ...zaklad().rady[0].filter((x) => x.karta.defId !== "krcmarka")], zaklad().rady[1]);
    const v = vyhodnotBitkuPata(s, [vstup({ dlhy: 2 }), nic], 0);
    expect(v.padli[0]).toEqual(["krcmarka"]);
    expect(maDost(v.stav, 0, "krcmarka")).toBe(true);
    expect(stojaci(v.stav, 0)).toHaveLength(3);
  });

  it("Hrobár: +1 tuhé za každého podrazeného na stole, len ak sám padol", () => {
    const s = stav(
      [starsi("farar", { podrazeny: true }), ...zaklad().rady[0].slice(1)],
      [starsi("hrobar", { podrazeny: true }), starsi("autobusar", { podrazeny: true }), ...zaklad().rady[1].slice(2)],
    );
    expect(tuheHrobara(s, 1)).toBe(3);
    expect(tuheHrobara(s, 0)).toBe(0);
    expect(tuheHrobara(zaklad(), 1)).toBe(0);
  });

  it("Vychovávateľka: vymení susedov v súperovom rade, len po svojom páde", () => {
    const s = stav(zaklad().rady[0], [starsi("vychovavatelka", { podrazeny: true }), ...zaklad().rady[1].slice(0, 3)]);
    const po = vymenVRadeSupera(s, 1, 0)!;
    expect(po.rady[0].slice(0, 2).map((x) => x.karta.defId)).toEqual(["krcmarka", "farar"]);
    expect(vymenVRadeSupera(s, 1, 3)).toBeNull();
    expect(vymenVRadeSupera(zaklad(), 1, 0)).toBeNull();
  });
});

describe("koniec partie a prečerpanie", () => {
  const poslednych = (pecen: number): readonly StarsiPata[] => [
    starsi("farar", { podrazeny: true }),
    starsi("krcmarka", { podrazeny: true }),
    starsi("starosta", { podrazeny: true }),
    starsi("postarka", { pecen }),
  ];
  const posledni2 = (pecen: number): readonly StarsiPata[] => [
    starsi("hrobar", { podrazeny: true }),
    starsi("autobusar", { podrazeny: true }),
    starsi("veterinar", { podrazeny: true }),
    starsi("vychovavatelka", { pecen }),
  ];
  const uder = (id: string, tuhe: number, z: Partial<VstupBitkyPata> = {}): VstupBitkyPata =>
    vstup({ tuhe, zamer: { ...nic.zamer, tuhe: { [id]: tuhe } }, ...z });

  it("kto príde o všetkých starších, prehráva", () => {
    const v = vyhodnotBitkuPata(stav(poslednych(3), posledni2(10)), [nic, uder("postarka", 3)], 0);
    expect(v.vitazPartie).toBe(1);
  });

  it("padnú poslední oboch: vyhrá menšie prečerpanie", () => {
    const v = vyhodnotBitkuPata(stav(poslednych(3), posledni2(3)), [uder("vychovavatelka", 8), uder("postarka", 5)], 0);
    // Postarka −2, Vychovávateľka −5: hráč 0 má menšie prečerpanie.
    expect(v.precerpanie).toEqual([2, 5]);
    expect(v.vitazPartie).toBe(0);
  });

  it("prečerpanie je súčet všetkých padnutých v tejto bitke", () => {
    const s = stav(
      [starsi("farar", { podrazeny: true }), starsi("krcmarka", { podrazeny: true }), starsi("starosta", { pecen: 1 }), starsi("postarka", { pecen: 1 })],
      posledni2(5),
    );
    const v = vyhodnotBitkuPata(s, [uder("vychovavatelka", 5), vstup({ tuhe: 6, zamer: { ...nic.zamer, tuhe: { starosta: 3, postarka: 3 } } })], 0);
    expect(v.precerpanie).toEqual([4, 0]);
    expect(v.vitazPartie).toBe(1);
  });

  it("zhoda prečerpania: vyššie tuhé, potom Absťáky, Dlhy, nakoniec útočník", () => {
    const s = stav(poslednych(3), posledni2(3));
    const koniec = (a: VstupBitkyPata, b: VstupBitkyPata, utocnik: PlayerId = 0): PlayerId | null =>
      vyhodnotBitkuPata(s, [a, b], utocnik).vitazPartie;
    expect(koniec(uder("vychovavatelka", 5), uder("postarka", 3, { povery: 2 }))).toBe(0);
    expect(koniec(uder("vychovavatelka", 3, { abstaky: 1 }), uder("postarka", 3))).toBe(1);
    expect(koniec(uder("vychovavatelka", 3), uder("postarka", 3, { dlhy: 1, bezExekucie: true }))).toBe(0);
    expect(koniec(uder("vychovavatelka", 3), uder("postarka", 3), 1)).toBe(1);
    expect(koniec(uder("vychovavatelka", 3), uder("postarka", 3), 0)).toBe(0);
  });

  it("víťaz bitky: tuhé, Absťáky, Dlhy, inak sekera", () => {
    expect(vitazBitkyPata({ tuhe: [5, 3], abstaky: [0, 0], dlhy: [0, 0] })).toBe(0);
    expect(vitazBitkyPata({ tuhe: [3, 3], abstaky: [2, 1], dlhy: [0, 0] })).toBe(1);
    expect(vitazBitkyPata({ tuhe: [3, 3], abstaky: [1, 1], dlhy: [0, 4] })).toBe(0);
    expect(vitazBitkyPata({ tuhe: [3, 3], abstaky: [1, 1], dlhy: [2, 2] })).toBeNull();
  });

  it("tuhé strany: Rana 1, Pecka 2, Petelica 3, bonusy a Absťáky; Viera nie", () => {
    expect(tuheStrany({ sums: { Rana: 1, Pecka: 1, Petelica: 1, Viera: 9 }, cirhozaBonus: 1, tuheBonus: 2, abstaky: 1 })).toBe(8);
    expect(tuheStrany({ sums: { Rana: 1 }, cirhozaBonus: 0, tuheBonus: 0, abstaky: 5 })).toBe(0);
  });
});

describe("zámery bitky — server musí vedieť odmietnuť", () => {
  it("Roboty: presný počet, liečiť len vlastných stojacich", () => {
    expect(platnyZamerLiecenia(zaklad(), 0, 2, { robotyNaDlh: 2, liecenie: {} })).toBe(true);
    expect(platnyZamerLiecenia(zaklad(), 0, 2, { robotyNaDlh: 1, liecenie: { farar: 1 } })).toBe(true);
    expect(platnyZamerLiecenia(zaklad(), 0, 2, { robotyNaDlh: 3, liecenie: {} })).toBe(false);
    expect(platnyZamerLiecenia(zaklad(), 0, 2, { robotyNaDlh: 1, liecenie: {} })).toBe(false);
    expect(platnyZamerLiecenia(zaklad(), 0, 1, { robotyNaDlh: 0, liecenie: { hrobar: 1 } })).toBe(false);
    expect(platnyZamerLiecenia(zaklad(), 0, 1, { robotyNaDlh: -1, liecenie: { farar: 2 } })).toBe(false);
    const sPadnutym = stav([starsi("farar", { podrazeny: true }), ...zaklad().rady[0].slice(1)], zaklad().rady[1]);
    expect(platnyZamerLiecenia(sPadnutym, 0, 1, { robotyNaDlh: 0, liecenie: { farar: 1 } })).toBe(false);
  });

  it("útok: celé tuhé a jed na stojacich súpera", () => {
    expect(platnyZamerUtoku(zaklad(), 0, 3, 1, { tuhe: { hrobar: 3 }, jed: { veterinar: 1 } })).toBe(true);
    expect(platnyZamerUtoku(zaklad(), 0, 3, 1, { tuhe: { hrobar: 2 }, jed: { hrobar: 1 } })).toBe(false);
    expect(platnyZamerUtoku(zaklad(), 0, 3, 1, { tuhe: { farar: 3 }, jed: { hrobar: 1 } })).toBe(false);
    expect(platnyZamerUtoku(zaklad(), 0, 3.5, 1, { tuhe: { hrobar: 3.5 }, jed: { hrobar: 1 } })).toBe(false);
    expect(platnyZamerUtoku(zaklad(), 0, 3, 1, { tuhe: { hrobar: 4, autobusar: -1 }, jed: { hrobar: 1 } })).toBe(false);
    const sPadnutym = stav(zaklad().rady[0], [starsi("hrobar", { podrazeny: true }), ...zaklad().rady[1].slice(1)]);
    expect(platnyZamerUtoku(sPadnutym, 0, 3, 1, { tuhe: { hrobar: 3 }, jed: { autobusar: 1 } })).toBe(false);
  });
});

describe("poradie bitky (Michal 2026-11-06): najprv Robota a exekúcia, potom útok", () => {
  it("liečenie je pred exekúciou, takže zachráni staršieho", () => {
    const s = stav([starsi("farar", { pecen: 1 }), ...zaklad().rady[0].slice(1)], zaklad().rady[1]);
    const v = vyhodnotBitkuPata(s, [vstup({ dlhy: 2, roboty: 1, zamer: { ...nic.zamer, liecenie: { farar: 1 } } }), nic], 0);
    expect(najdi(v.stav, 0, "farar")).toMatchObject({ pecen: 2, podrazeny: false });
  });

  it("obaja liečia naraz, keď môžu", () => {
    const v = vyhodnotBitkuPata(
      zaklad(),
      [vstup({ roboty: 1, zamer: { ...nic.zamer, liecenie: { farar: 1 } } }), vstup({ roboty: 2, zamer: { ...nic.zamer, liecenie: { hrobar: 2 } } })],
      0,
    );
    expect(najdi(v.stav, 0, "farar").pecen).toBe(29);
    expect(najdi(v.stav, 1, "hrobar").pecen).toBe(37);
  });

  it("kto padne pri exekúcii, už v útoku nie je cieľ", () => {
    const s = stav([starsi("farar", { pecen: 1 }), ...zaklad().rady[0].slice(1)], zaklad().rady[1]);
    const b = { tuhe: [0, 5], abstaky: [0, 0], dlhy: [2, 0], utocnik: 0 } as const;
    const krok = vyhodnotLieceniePata(s, [vstup({ dlhy: 2 }), nic], b);
    expect(krok.padli[0]).toEqual(["farar"]);
    expect(platnyZamerUtoku(krok.stav, 1, 5, 0, { tuhe: { farar: 5 }, jed: {} })).toBe(false);
    expect(platnyZamerUtoku(krok.stav, 1, 5, 0, { tuhe: { krcmarka: 5 }, jed: {} })).toBe(true);
  });

  it("Má dosť Farára, ktorý padol pri exekúcii, platí už v útoku tej bitky", () => {
    const s = stav([starsi("farar", { pecen: 1 }), starsi("krcmarka", { jed: 2, pecen: 36 }), ...zaklad().rady[0].slice(2)], zaklad().rady[1]);
    const v = vyhodnotBitkuPata(s, [vstup({ dlhy: 1 }), nic], 0);
    // Exekúcia −1 a jed −2; jed klesne o 2.
    expect(najdi(v.stav, 0, "krcmarka")).toMatchObject({ pecen: 33, jed: 0 });
  });

  it("vlastná exekúcia posledného staršieho partiu ukončí a súper už neútočí", () => {
    const s = stav(
      [starsi("farar", { podrazeny: true }), starsi("krcmarka", { podrazeny: true }), starsi("starosta", { podrazeny: true }), starsi("postarka", { pecen: 1 })],
      zaklad().rady[1],
    );
    const v = vyhodnotBitkuPata(s, [vstup({ dlhy: 1, tuhe: 99, zamer: { ...nic.zamer, tuhe: { hrobar: 99 } } }), nic], 0);
    expect(v.vitazPartie).toBe(1);
    expect(najdi(v.stav, 1, "hrobar").pecen).toBe(33);
  });

  it("prečerpanie sa sčíta z exekúcie aj z útoku", () => {
    const s = stav(
      [starsi("farar", { podrazeny: true }), starsi("krcmarka", { podrazeny: true }), starsi("starosta", { pecen: 1 }), starsi("postarka", { pecen: 9 })],
      zaklad().rady[1],
    );
    const v = vyhodnotBitkuPata(s, [vstup({ dlhy: 3 }), vstup({ tuhe: 10, zamer: { ...nic.zamer, tuhe: { postarka: 10 } } })], 0);
    // Exekúcia −2: Starosta padne s −1, Poštárka má 7. Útok 10: Poštárka −3. Spolu 1 + 3.
    expect(v.precerpanie[0]).toBe(4);
    expect(v.vitazPartie).toBe(1);
  });
});

describe("lokality", () => {
  const lok = (id: string): CardInstance => karta(id);
  const l = [
    [lok("zastavka"), lok("most")],
    [lok("ihrisko"), lok("kar")],
    [lok("kostol"), lok("druzstvo")],
  ] as const;

  it("vždy 3 na výber, po jednej z úrovne", () => {
    expect(lokalityNaVyberPata(l).map((c) => c.defId)).toEqual(["zastavka", "ihrisko", "kostol"]);
  });

  it("odohraná ide naspodok a lokality sa nikdy neminú", () => {
    const po = odohrajLokalitu(l, l[1][0].uid);
    expect(lokalityNaVyberPata(po).map((c) => c.defId)).toEqual(["zastavka", "kar", "kostol"]);
    const znova = odohrajLokalitu(po, po[1][0]!.uid);
    expect(lokalityNaVyberPata(znova).map((c) => c.defId)).toEqual(["zastavka", "ihrisko", "kostol"]);
  });
});

describe("celá partia v jadre", () => {
  const dohraj = (seed: number) => {
    let s = setupGame(data, seed, { rezim: "pata" });
    let x = seed;
    const kroky: string[] = [];
    for (let k = 0; s.koniec === null && k < 12000; k++) {
      const p = ([0, 1] as const).find((q) => mozeHrat(s, q));
      if (p === undefined) throw new Error(`Nikto nemá ťah: ${s.faza}, krok ${s.pata?.krok}.`);
      x = (x * 1103515245 + 12345) % 2147483648;
      s = apply(data, s, tahBotaPata(data, s, p, x, { vzorky: 1 }), p).state;
      if (s.pata?.krok != null) kroky.push(s.pata.krok);
    }
    return { s, kroky };
  };

  it("začína draftom, vyradené karty v hre nie sú, lokality sú 3 a každá inej úrovne", () => {
    const s = setupGame(data, 5, { rezim: "pata" });
    expect(s.faza).toBe("pataDraft");
    expect(s.pata?.ponuka).toHaveLength(8);
    expect(s.starsi).toHaveLength(0);
    for (const k of [...s.naradie, ...s.obcania]) expect(jeVyradenaVPate(k.defId), k.defId).toBe(false);
    const naVyber = s.pata === undefined ? [] : lokalityNaVyberPata(s.pata.lokality);
    expect(naVyber).toHaveLength(3);
    for (const k of naVyber) expect(jeVyradenaVPate(k.defId)).toBe(false);
  });

  it("v Kalamite sa nič nezmení: bez pata", () => {
    expect(setupGame(data, 5).pata).toBeUndefined();
    expect(setupGame(data, 5).faza).toBe("volbaCiela");
  });

  it("2 na 2 sa s režimom nekombinuje (Michal 2026-11-06)", () => {
    expect(() => setupGame(data, 5, { rezim: "pata", format: "2na2" })).toThrow();
  });

  it.each([1, 2, 3, 4])("boti dohrajú partiu a každý krok režimu prebehne (semienko %i)", (seed) => {
    const { s, kroky } = dohraj(seed);
    expect(s.koniec).not.toBeNull();
    expect(s.koniec?.vitaz === 0 || s.koniec?.vitaz === 1).toBe(true);
    for (const k of ["draft", "rad"]) expect(kroky).toContain(k);
    const h = s.pata;
    if (h === undefined) throw new Error("bez režimu");
    const v = s.koniec?.vitaz as PlayerId;
    expect(stojaci(h, v === 0 ? 1 : 0)).toHaveLength(0);
  }, 180000);

  it("priebežne: Cirhóza nikdy neostane v ruke a karty sa nestrácajú", () => {
    let s = setupGame(data, 2, { rezim: "pata" });
    let x = 2;
    for (let k = 0; s.koniec === null && k < 12000; k++) {
      const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) as PlayerId;
      x = (x * 1103515245 + 12345) % 2147483648;
      s = apply(data, s, tahBotaPata(data, s, p, x, { vzorky: 1 }), p).state;
      for (const h of s.hraci) expect(h.ruka.some((c) => c.defId === "cirhoza")).toBe(false);
    }
  }, 180000);

  it("nemenné pravidlo 2: skrytý rad a zámer súpera neodídu, kým nevyberú obaja", () => {
    let s = setupGame(data, 3, { rezim: "pata" });
    let x = 3;
    for (let k = 0; s.pata?.krok !== "rad" && k < 3000; k++) {
      const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) as PlayerId;
      x = (x * 1103515245 + 12345) % 2147483648;
      s = apply(data, s, tahBotaPata(data, s, p, x, { vzorky: 1 }), p).state;
    }
    expect(s.pata?.krok).toBe("rad");
    const moznosti = legalCommands(data, s, 0);
    const posledny = moznosti[moznosti.length - 1];
    if (posledny === undefined) throw new Error("bez možností");
    s = apply(data, s, posledny, 0).state;
    const v1 = viewFor(data, s, 1);
    expect(v1.pata?.radVyber[0]).toEqual([]);
    expect(v1.pata?.radVyber[1]).toBeNull();
    const v0 = viewFor(data, s, 0);
    expect(v0.pata?.radVyber[0]).toHaveLength(4);
    // Z lokalít len tie na výber, ďalšie poradie balíčkov nie.
    expect(v1.pata?.lokality.every((b) => b.length === 1)).toBe(true);
  });

  it("nemenné pravidlo 2: súperova ruka len s Má dosť Poštárky", () => {
    const s = setupGame(data, 3, { rezim: "pata" });
    const ruka = [{ uid: 1, defId: "pijan", leftLayout: 0, rightLayout: 0 }];
    const rady = [[starsi("postarka", { podrazeny: true }), starsi("farar")], [starsi("hrobar"), starsi("krcmarka")]] as const;
    const h = s.pata;
    if (h === undefined) throw new Error("bez režimu");
    const st = { ...s, hraci: [s.hraci[0], { ...s.hraci[1], ruka }] as typeof s.hraci, pata: { ...h, rady, krok: null } };
    expect(viewFor(data, st, 0).rukaSupera?.map((k) => k.uid)).toEqual([1]);
    expect(viewFor(data, st, 1).rukaSupera).toBeUndefined();
    expect(JSON.stringify(viewFor(data, st, 1))).not.toContain('"rukaSupera"');
  });
});

const katalogNapoved = katalogJson as unknown as { readonly napovedy: readonly { readonly id: string; readonly melichar: string | Readonly<Record<string, string>> }[] };

describe("nápovedy v režime", () => {
  it("o špakoch, hádke a Exekútorovi sa v režime nehovorí", () => {
    for (const def of katalogNapoved.napovedy) {
      const text = typeof def.melichar === "string" ? def.melichar : Object.values(def.melichar).join(" ");
      if (/špak|Exekút|Hádk|hádk|Nakladačk/.test(text)) expect(NAPOVEDY_MIMO_PATY, def.id).toContain(def.id);
    }
  });
});
