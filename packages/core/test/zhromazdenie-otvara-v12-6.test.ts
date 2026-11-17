// Pravidlá v12.6, návrh #73 A (Michal 2026-11-17: „kto skončí Zhromaždenie prvý, otvára ďalšie“), §4 a §6:
// prvé Zhromaždenie kola začína útočník, každé ďalšie toho kola hráč, ktorý v predošlom skončil
// vykladanie prvý (pas, pas za hráča, nútený pas Vychovávateľky aj Záverečná). Vo finále rovnako;
// 2 na 2 a Päta, Lakeť, Otočka bez zmeny. Očakávané hodnoty sú z pravidla, nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, dalsieZhromazdenieOtvara, legalCommands, loadGameData, naTahu, pasomOtvoriZhromazdenie, setupGame, viewFor } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uid = 973000;
const inst = (defId: string): CardInstance => ({ uid: ++uid, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId): PlacedCard => ({ card: inst(defId), playedBy });

/** Zhromaždenie kola s útočníkom 0; na ťahu `naTahuZhrom`, v kole `pitkyCelkom` Pitiek, odohraných `pitkaCislo`. */
function vZhromazdeni(o: { naTahuZhrom?: PlayerId; pitkaCislo?: number; pitkyCelkom?: number; finale?: boolean; ruky?: [CardInstance[], CardInstance[]] } = {}): GameState {
  const s0 = setupGame(data, 31);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "krcma")!;
  const ruky = o.ruky ?? [[inst("pijan"), inst("pijan")], [inst("pijan"), inst("pijan")]];
  return {
    ...s0,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: o.finale === true ? { typ: "finale", lokalita } : { typ: "lokalita", lokalita },
    // Línia na dve Pitky (aktivované akcie stredu na oboch stranách) — po prvej Pitke ďalšie Zhromaždenie.
    strany: o.pitkyCelkom === 1 || o.pitkaCislo === 1 ? [[], []] : [[lezi("autobusar", 0)], [lezi("autobusar", 1)]],
    pitkyCelkom: o.pitkyCelkom ?? 2,
    pitkaCislo: o.pitkaCislo ?? 0,
    hraci: [
      { ...s0.hraci[0], ruka: ruky[0], poldeciPlne: 3, poldeciVypite: 0, cigarety: 3 },
      { ...s0.hraci[1], ruka: ruky[1], poldeciPlne: 3, poldeciVypite: 0, cigarety: 3 },
    ],
    zhromazdenieStav: { naTahu: o.naTahuZhrom ?? 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

const PITKA_PREDNOST: readonly Command["type"][] = ["skipNaex", "bezReakcie", "vizia", "spal", "cintorin", "hasic"];

/** Dohrá Pitku najkratšou cestou (bez NA EX), kým sa nezačne ďalšia fáza. */
function dohrajPitku(s: GameState, log: string[] = []): GameState {
  let t = s;
  for (let i = 0; i < 60 && t.faza === "pitka"; i++) {
    const p = naTahu(t);
    if (p === null) break;
    const cmds = legalCommands(data, t, p);
    const cmd = PITKA_PREDNOST.map((typ) => cmds.find((c) => c.type === typ)).find((c) => c !== undefined) ?? cmds[0];
    if (cmd === undefined) break;
    const r = apply(data, t, cmd, p);
    log.push(...r.events.flatMap((e) => (e.type === "log" ? [e.text] : [])));
    t = r.state;
  }
  return t;
}

const pas = (s: GameState, p: PlayerId): GameState => apply(data, s, { type: "pass" }, p).state;

describe("§4 a §6 kto otvára ďalšie Zhromaždenie kola (v12.6, #73 A)", () => {
  it("obranca pasuje prvý → ďalšie Zhromaždenie kola otvára obranca; log to povie", () => {
    let s = vZhromazdeni({ naTahuZhrom: 1 });
    s = pas(s, 1);
    expect(s.zhromazdenieOtvara).toBe(1);
    s = pas(s, 0);
    // Pas útočníka po obrancovi nič neprepíše.
    expect(s.zhromazdenieOtvara).toBe(1);
    expect(s.faza).toBe("pitka");
    const log: string[] = [];
    const t = dohrajPitku(s, log);
    expect(t.faza).toBe("zhromazdenie");
    expect(t.pitkaCislo).toBe(1);
    expect(t.zhromazdenieStav?.naTahu).toBe(1);
    // Stôl z toho píše „vykladá prvý“ pri prechode do Zhromaždenia.
    expect(t.zhromazdenieStav?.zacal).toBe(1);
    // Nové Zhromaždenie si pamäť zmaže — rozhodne ďalší, kto skončí prvý.
    expect(t.zhromazdenieOtvara).toBeUndefined();
    expect(log).toContain("Zhromaždenie otvára hráč 2 — v predošlom skončil vykladanie prvý.");
  });

  it("útočník pasuje prvý → ďalšie Zhromaždenie otvára znova útočník", () => {
    let s = vZhromazdeni({ naTahuZhrom: 0 });
    s = pas(pas(s, 0), 1);
    expect(s.zhromazdenieOtvara).toBe(0);
    const t = dohrajPitku(s);
    expect(t.faza).toBe("zhromazdenie");
    expect(t.zhromazdenieStav?.naTahu).toBe(0);
    expect(t.zhromazdenieStav?.zacal).toBeUndefined();
  });

  it("Záverečná ukončí vykladanie — kto ju zahrá prvý, otvára ďalšie Zhromaždenie", () => {
    const zav = inst("pijan");
    let s = vZhromazdeni({ naTahuZhrom: 1, ruky: [[inst("pijan")], [zav, inst("pijan")]] });
    s = apply(data, s, { type: "zaverecna", uid: zav.uid, target: "vlastna" }, 1).state;
    expect(s.zhromazdenieOtvara).toBe(1);
    s = pas(s, 0);
    const t = dohrajPitku(s);
    expect(t.zhromazdenieStav?.naTahu).toBe(1);
  });

  it("pas, ktorý urobí hra (prázdna ruka), sa ráta ako skončenie vykladania", () => {
    const karta = inst("pijan");
    let s = vZhromazdeni({ naTahuZhrom: 0, ruky: [[karta, inst("pijan")], []] });
    s = apply(data, s, { type: "place", uid: karta.uid, target: "vlastna" }, 0).state;
    // Hráč 2 nemá čo vyložiť — hra za neho pasuje hneď, ako na neho príde ťah.
    expect(s.zhromazdenieStav?.pasoval[1]).toBe(true);
    expect(s.zhromazdenieOtvara).toBe(1);
    s = pas(s, 0);
    // V ďalšom Zhromaždení hra za neho pasuje hneď — otvoril ho však on.
    const log: string[] = [];
    expect(dohrajPitku(s, log).faza).toBe("zhromazdenie");
    expect(log).toContain("Zhromaždenie otvára hráč 2 — v predošlom skončil vykladanie prvý.");
  });

  it("nútený pas Vychovávateľky: súper skončil prvý, otvára ďalšie Zhromaždenie", () => {
    const s0 = vZhromazdeni({ naTahuZhrom: 0 });
    const e = s0.starsi.find((x) => x.elderId === "vychovavatelka");
    if (e === undefined) throw new Error("Vychovávateľka v hre nie je.");
    let s: GameState = {
      ...s0,
      starsi: s0.starsi.filter((x) => x !== e),
      vazni: [{ elderId: e.elderId, hrac: 0, poradie: 1, karta: e.karta, scorecard: e.scorecard, miesto: 0 }],
    };
    s = apply(data, s, { type: "schopnostVazna", elderId: "vychovavatelka" }, 0).state;
    expect(s.zhromazdenieOtvara).toBe(1);
    s = pas(s, 0);
    expect(dohrajPitku(s).zhromazdenieStav?.naTahu).toBe(1);
  });

  it("vo finále rovnako", () => {
    let s = vZhromazdeni({ naTahuZhrom: 1, finale: true });
    s = pas(pas(s, 1), 0);
    const t = dohrajPitku(s);
    expect(t.faza).toBe("zhromazdenie");
    expect(t.zhromazdenieStav?.naTahu).toBe(1);
  });

  it("prvé Zhromaždenie kola začína útočník — pamäť sa zmaže pred bitkou a starú hodnotu nové kolo nepoužije", () => {
    // Posledná Pitka kola: po nej bitka, pamäť zmizne.
    let s = vZhromazdeni({ naTahuZhrom: 1, pitkaCislo: 1, pitkyCelkom: 2 });
    s = pas(pas(s, 1), 0);
    expect(s.zhromazdenieOtvara).toBe(1);
    const t = dohrajPitku(s);
    expect(t.faza).not.toBe("zhromazdenie");
    expect(t.zhromazdenieOtvara).toBeUndefined();
  });

  it("aj keby pamäť ostala, prvé Zhromaždenie kola (po ponuke, pitkaCislo 0) začína útočník", () => {
    const s0 = setupGame(data, 7);
    // Dohrať voľbu cieľa a ponuku stopom oboch: prvé Zhromaždenie kola.
    let s: GameState = { ...s0, zhromazdenieOtvara: opponentOfUtocnik(s0) };
    for (let i = 0; i < 60 && s.faza !== "zhromazdenie"; i++) {
      const p = naTahu(s);
      if (p === null) break;
      const cmds = legalCommands(data, s, p);
      const cmd = cmds.find((c) => c.type === "draftStop") ?? cmds.find((c) => c.type === "stavbaSenku") ?? cmds.find((c) => c.type === "chooseLocation") ?? cmds[0];
      if (cmd === undefined) break;
      s = apply(data, s, cmd, p).state;
    }
    expect(s.faza).toBe("zhromazdenie");
    expect(s.pitkaCislo).toBe(0);
    expect(s.zhromazdenieStav?.naTahu).toBe(s.utocnik);
    expect(s.zhromazdenieOtvara).toBeUndefined();
  });

  it("2 na 2 sa nemení — pas člena ani tímu si nezapamätá, kto otvára", () => {
    const s0 = setupGame(data, 31, { format: "2na2" });
    expect(s0.format).toBe("2na2");
    let s: GameState = {
      ...s0,
      faza: "zhromazdenie",
      draftStav: null,
      pitkyCelkom: 2,
      pitkaCislo: 0,
      strany: [[], []],
      zhromazdenieStav: { naTahu: 1, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0], skoncili: [false, false, false, false] },
    };
    // Pasujú postupne miesta, ktoré sú na ťahu, kým nepasuje celý tím.
    for (let i = 0; i < 4 && s.faza === "zhromazdenie"; i++) {
      const m = ([0, 1, 2, 3] as const).find((x) => legalCommands(data, s, x).some((c) => c.type === "pass"));
      if (m === undefined) break;
      s = apply(data, s, { type: "pass" }, m).state;
      expect(s.zhromazdenieOtvara).toBeUndefined();
    }
    expect(s.zhromazdenieStav?.pasoval.some((x) => x) ?? true).toBe(true);
  });

  it("Päta, Lakeť, Otočka sa nemení — pas si nezapamätá, kto otvára", () => {
    const s0 = vZhromazdeni({ naTahuZhrom: 1 });
    const sPata = setupGame(data, 31, { rezim: "pata" });
    expect(sPata.pata).toBeDefined();
    const s = pas({ ...s0, pata: sPata.pata! }, 1);
    expect(s.zhromazdenieStav?.pasoval[1]).toBe(true);
    expect(s.zhromazdenieOtvara).toBeUndefined();
  });

  it("pás kola a náhľad pasu: kto otvorí ďalšie Zhromaždenie, len keď ďalšie v kole príde", () => {
    const s = vZhromazdeni({ naTahuZhrom: 1 });
    // Nikto ešte neskončil: pás nič neukáže, pas obrancu by mu ďalšie Zhromaždenie otvoril.
    expect(dalsieZhromazdenieOtvara(s)).toBeNull();
    expect(pasomOtvoriZhromazdenie(viewFor(data, s, 1), 1)).toBe(true);
    const po = pas(s, 1);
    expect(dalsieZhromazdenieOtvara(viewFor(data, po, 0))).toBe(1);
    // Súper už skončil — pas útočníka nič neotvorí.
    expect(pasomOtvoriZhromazdenie(viewFor(data, po, 0), 0)).toBe(false);
    // V Pitke pred ďalším Zhromaždením pás ukazuje ďalej.
    const vPitke = pas(po, 0);
    expect(vPitke.faza).toBe("pitka");
    expect(dalsieZhromazdenieOtvara(vPitke)).toBe(1);
    // Posledné Zhromaždenie kola: ďalšie nepríde, pás ani náhľad nič nehovoria.
    const posledne = vZhromazdeni({ naTahuZhrom: 1, pitkaCislo: 1, pitkyCelkom: 2 });
    expect(pasomOtvoriZhromazdenie(posledne, 1)).toBe(false);
    expect(dalsieZhromazdenieOtvara(pas(posledne, 1))).toBeNull();
  });

  it("viewFor: kto otvára ďalšie Zhromaždenie, vidia obaja rovnako (je to verejné — pas je na stole)", () => {
    const s = pas(vZhromazdeni({ naTahuZhrom: 1 }), 1);
    expect(viewFor(data, s, 0).zhromazdenieOtvara).toBe(1);
    expect(viewFor(data, s, 1).zhromazdenieOtvara).toBe(1);
    // Pas nič skryté neprezradí: súperova ruka ostáva skrytá.
    const v = JSON.stringify(viewFor(data, s, 0));
    for (const k of s.hraci[1].ruka) expect(v).not.toContain(`"uid":${k.uid}`);
  });
});

function opponentOfUtocnik(s: GameState): PlayerId {
  return (1 - s.utocnik) as PlayerId;
}
