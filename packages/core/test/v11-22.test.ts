// Pravidlá v11.22 (Michal 2026-11-11, Zrejúca): akcie navyše mení celý podložený Nástroj aj Forsáž
// Energeťáka; Traktorista „Bitka: S prevahou v jeho kraji {Pecka}.“, Pasca Rana za každú priloženú
// kartu, Výherný automat „Pitka: {Dlh}.“, Kapybara „Furt: Preškolenie {Viera}→{Cigareta}.“.
// Predavačka (karta z ponuky navrch balíčka) je vo frakcie.test.ts a dva-na-dva.test.ts.
// Očakávané hodnoty sú z pravidla (PRAVIDLA §6, §8, §12, §16), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Event, GameState, PitkaStav, PlacedCard, PlayerId } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, lineState, loadGameData, ponukaPodlozenia, setupGame, vyhladDlhov } from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 970000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const pod = (defId: string, hrana: "horna" | "dolna", majitel: PlayerId = 0) => ({ podlozene: [{ card: inst(defId), majitel, hrana }] });

function pitkaStav(naTahu: PlayerId): PitkaStav {
  return { naTahu, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] };
}

/** Pitka na lokalite `lok` s líniou `strany`; Dedičstvo hráča 0 podľa `dedicstvo0`. */
function vPitke(lok: string, strany: GameState["strany"], dedicstvo0: CardInstance[] = [], pitkyCelkom = 1): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = inst(lok);
  const hraci = s0.hraci.map((h, p) => ({ ...h, cigarety: 5, ...(p === 0 ? { dedicstvo: dedicstvo0 } : {}) })) as unknown as GameState["hraci"];
  return { ...s0, hraci, faza: "pitka", utocnik: 1, ciel: { typ: "lokalita", lokalita }, strany, pitkyCelkom, pitkaCislo: 1, pitkaStav: pitkaStav(0), naexVKole: [false, false] };
}

/** Akcia `a` z akcií navyše karty `uid` v súčtoch hráča 0. */
function navyse(s: GameState, uid: number, a: "Pecka" | "Rana" | "Petelica"): number {
  return (evaluateLine(data, lineState(s)).zdroje[0][a] ?? []).filter((z) => z.uid === uid && z.dovody.some((d) => d.startsWith("akcia navyše"))).reduce((n, z) => n + z.hodnota, 0);
}

/** Obaja dohrajú Pitku bez NA EX. */
function dohrajPitku(s0: GameState): { readonly s: GameState; readonly events: Event[] } {
  let s = s0;
  const events: Event[] = [];
  for (let i = 0; i < 8 && s.faza === "pitka"; i++) {
    const q = ([0, 1] as const).find((x) => legalCommands(data, s, x).some((c) => c.type === "skipNaex" || c.type === "bezReakcie"));
    if (q === undefined) break;
    const r = apply(data, s, legalCommands(data, s, q).find((c) => c.type === "skipNaex" || c.type === "bezReakcie")!, q);
    s = r.state;
    events.push(...r.events);
  }
  return { s, events };
}

describe("akcie navyše mení celý podložený Nástroj (v11.22: „Áno, celý Nástroj“)", () => {
  it("Puška dole (Posilnená Pecka) pod Šoférom bez NA EX: Pecka navyše ×2, Rana navyše ×1; pečať nesie násobok", () => {
    const sofer = inst("sofer");
    const s = vPitke("most", [[lezi(sofer, 0, pod("puska", "dolna"))], []]);
    expect(navyse(s, sofer.uid, "Pecka")).toBe(2);
    expect(navyse(s, sofer.uid, "Rana")).toBe(1);
    const pecat = evaluateLine(data, lineState(s)).cards.get(sofer.uid)?.navyse?.[0];
    expect(pecat).toMatchObject({ krat: 1, akcie: ["Pecka", "Rana"], nasobok: [2, 1] });
    // Bez Pušky ×1.
    const bez = vPitke("most", [[lezi(sofer, 0)], []]);
    expect(navyse(bez, sofer.uid, "Pecka")).toBe(1);
    expect(evaluateLine(data, lineState(bez)).cards.get(sofer.uid)?.navyse?.[0]?.nasobok).toBeUndefined();
  });

  it("Forsáž Energeťáka (hore) zdvojí všetky akcie navyše; s Puškou pod Zámočníkom sa násobí ×4", () => {
    const sofer = inst("sofer");
    const s = vPitke("most", [[lezi(sofer, 0, pod("energetak", "horna"))], []]);
    expect(navyse(s, sofer.uid, "Pecka")).toBe(2);
    expect(navyse(s, sofer.uid, "Rana")).toBe(2);
    const zdroj = (evaluateLine(data, lineState(s)).zdroje[0].Rana ?? []).find((z) => z.uid === sofer.uid && z.dovody.some((d) => d.startsWith("akcia navyše")));
    expect(zdroj?.dovody).toContain("Forsáž");
  });

  it("Forsáž zo spoja (Posilnenie + Posilnenie) zdvojí akcie navyše; NA EX, ktorý Posilnenie zruší, ju zruší aj tu (výklad Leadera 2026-11-11)", () => {
    const a = makeDef("a", [null, "Posilnenie", null, null], EMPTY, { tags: ["Občan"], triggers: ["Furt"], effectText: "Furt: {Pecka}." });
    const b = makeDef("b", EMPTY, [null, "Posilnenie", null, null], { tags: ["Občan"] });
    const sd = syntheticData([a, b]);
    const kartaA = instanceFor(sd, "a", [null, "Posilnenie", null, null], EMPTY);
    const kartaB = instanceFor(sd, "b", EMPTY, [null, "Posilnenie", null, null]);
    const pecky = (naex: boolean) =>
      evaluateLine(sd, { lokalita: null, lokalitaOtocena: false, strany: [[{ card: kartaA, playedBy: 0, ...(naex ? { naexBy: 1 as const } : {}) }, { card: kartaB, playedBy: 0 }], []] });
    const s = pecky(false);
    expect(s.cards.get(kartaA.uid)?.forsaz).toBe(true);
    expect(s.sums[0].Pecka).toBe(2);
    expect(s.cards.get(kartaA.uid)?.navyse?.[0]).toMatchObject({ akcie: ["Pecka"], nasobok: [2] });
    expect(pecky(true).sums[0].Pecka).toBe(1);
  });

  it("NA EX na kartu akcie navyše nemení — Puška ich posilní ×2 aj pod NA EX", () => {
    const sofer = inst("sofer");
    const s = vPitke("most", [[lezi(sofer, 0, { ...pod("puska", "dolna"), naexBy: 1 })], []]);
    expect(navyse(s, sofer.uid, "Pecka")).toBe(2);
  });

  it("akciová hrana preškolí akciu navyše: Valaška hore ({Pecka}→{Petelica}) pod Šoférom — Petelica navyše, pečať ukáže Petelicu", () => {
    const sofer = inst("sofer");
    const s = vPitke("most", [[lezi(sofer, 0, pod("boxer", "horna"))], []]);
    const ev = evaluateLine(data, lineState(s));
    const valaska = [...s.strany[0]][0]!.podlozene![0]!.card.uid;
    expect(ev.cards.get(sofer.uid)?.navyse?.[0]).toMatchObject({ akcie: ["Pecka", "Rana"], ako: ["Petelica", "Rana"], akoOd: [valaska, null] });
    expect(navyse(s, sofer.uid, "Petelica")).toBe(1);
    expect(navyse(s, sofer.uid, "Pecka")).toBe(0);
    // Preškolenie na karte ráta aj akciu z pečate.
    expect(ev.cards.get(sofer.uid)?.preskolena).toEqual([expect.objectContaining({ z: "Pecka", na: "Petelica", od: valaska, zdroj: "Nástroj", akcii: 1 })]);
  });

  it("ponuka podloženia vidí akcie navyše: Puška dole pod Traktoristom (Pecka len v pečati) má čo robiť", () => {
    const t = inst("traktoristka");
    const s = vPitke("most", [[lezi(t, 0)], []]);
    const ponuka = ponukaPodlozenia(data, lineState(s), inst("puska"), 0).find((m) => m.hostitel === t.uid && m.hrana === "dolna");
    expect(ponuka).toMatchObject({ maCoRobit: true, popis: "Posilnená Pecka" });
    const valaska = ponukaPodlozenia(data, lineState(s), inst("boxer"), 0).find((m) => m.hostitel === t.uid && m.hrana === "horna");
    expect(valaska).toMatchObject({ maCoRobit: true, popis: "Pecka → Petelica" });
  });
});

describe("Pasca: Za každú kartu, ktorú súper v tomto kole priložil k tvojej karte {Rana}", () => {
  it("Rana navyše za každé súperovo priloženie; bez priloženia nič", () => {
    const pasca = inst("pasca");
    const s = { ...vPitke("most", [[lezi(inst("vandal"), 0)], []], [pasca]), prilozeniaKu: [3, 0] as const };
    const ev = evaluateLine(data, lineState(s));
    expect(ev.navyseDedicstva?.get(pasca.uid)?.[0]?.krat).toBe(3);
    expect((ev.zdroje[0].Rana ?? []).filter((z) => z.uid === pasca.uid).reduce((n, z) => n + z.hodnota, 0)).toBe(3);
    const nic = evaluateLine(data, lineState({ ...s, prilozeniaKu: [0, 3] as const }));
    expect(nic.navyseDedicstva?.get(pasca.uid)?.[0]?.krat).toBe(0);
  });

  it("každá súperova karta priložená k tvojej sa ráta raz; tvoja priložená k súperovej sa ráta súperovi", () => {
    const s0 = vPitke("zastavka", [[lezi(inst("vandal"), 0)], []]);
    const a = inst("masiar");
    const b = inst("pijan");
    const c = inst("hasic");
    const zhrom: GameState = {
      ...s0,
      faza: "zhromazdenie",
      pitkaStav: null,
      pitkaCislo: 0,
      zhromazdenieStav: { naTahu: 1, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
      hraci: [{ ...s0.hraci[0], ruka: [c] }, { ...s0.hraci[1], ruka: [a, b] }] as unknown as GameState["hraci"],
    };
    // Súper prikladá k mojej karte na koniec môjho kraja (target „superova“ = kraj súpera ťahajúceho).
    const po1 = apply(data, zhrom, { type: "place", uid: a.uid, target: "superova" }, 1).state;
    expect(po1.prilozeniaKu).toEqual([1, 0]);
    // Ja prikladám k súperovej karte (Mäsiar na konci môjho kraja) — ráta sa súperovi, mne nie.
    const po2 = apply(data, po1, { type: "place", uid: c.uid, target: "vlastna" }, 0).state;
    expect(po2.prilozeniaKu).toEqual([1, 1]);
  });
});

describe("Výherný automat: Tvoj prah Dlhu je o 1 vyšší. Pitka: {Dlh}.", () => {
  it("v Pitke 1 Dlh rovno (nie zadĺženie cez prah); Obecný úrad ho zdvojí", () => {
    const s = vPitke("most", [[], []], [inst("vyherny_automat")]);
    const { s: po, events } = dohrajPitku(s);
    const vysledok = events.find((e) => e.type === "pitkaVysledok");
    expect(vysledok).toMatchObject({ dlhy: [1, 0] });
    expect(po.hraci[0].dlhy + po.nastenka.reduce((n, x) => n + x.exekutor[0], 0)).toBe(s.hraci[0].dlhy + 1);
    expect(po.hraci[0].zadlzenie).toBe(s.hraci[0].zadlzenie);
    const urad = vPitke("obecny_urad", [[], []], [inst("vyherny_automat")]);
    expect(dohrajPitku(urad).events.find((e) => e.type === "pitkaVysledok")).toMatchObject({ dlhy: [2, 0] });
  });

  it("náhľad Dlhov ráta automat v tejto aj v každej ďalšej Pitke", () => {
    const s = vPitke("most", [[], []], [inst("vyherny_automat")]);
    const bez = vPitke("most", [[], []]);
    expect(vyhladDlhov(data, s, 0)[0].nove - vyhladDlhov(data, bez, 0)[0].nove).toBe(1);
    expect(vyhladDlhov(data, s, 2)[0].nove - vyhladDlhov(data, bez, 2)[0].nove).toBe(3);
  });
});

describe("Kapybara: Furt: Preškolenie {Viera}→{Cigareta}", () => {
  /** Preškolenia od Kapybary na karte `uid`. */
  const odKapybary = (s: GameState, kap: number, uid: number) => (evaluateLine(data, lineState(s)).cards.get(uid)?.preskolena ?? []).filter((p) => p.od === kap);

  it("obaja priami susedia (moja aj súperova karta) majú Viery ako Cigarety; ďalšia karta ani Kapybara sama nie", () => {
    const vlastna = inst("farar");
    const kap = inst("kapybara");
    const superova = inst("veterinar");
    const dalsia = inst("farar");
    const s = vPitke("most", [[lezi(vlastna, 0), lezi(kap, 0), lezi(superova, 1), lezi(dalsia, 1)], []]);
    expect(odKapybary(s, kap.uid, vlastna.uid)).toEqual([expect.objectContaining({ z: "Viera", na: "Cigareta", zdroj: "Furt" })]);
    expect(odKapybary(s, kap.uid, superova.uid)).toEqual([expect.objectContaining({ z: "Viera", na: "Cigareta", zdroj: "Furt" })]);
    expect(odKapybary(s, kap.uid, dalsia.uid)).toEqual([]);
    expect(odKapybary(s, kap.uid, kap.uid)).toEqual([]);
    // Furt {Cigareta} zanikol — Kapybara akcie navyše nemá.
    expect(evaluateLine(data, lineState(s)).cards.get(kap.uid)?.navyse).toBeUndefined();
  });

  it("vedľa Mäsiara Preškolenie neplatí", () => {
    const kap = inst("kapybara");
    const superova = inst("veterinar");
    const s = vPitke("most", [[lezi(inst("masiar"), 1), lezi(kap, 0), lezi(superova, 1)], []]);
    expect(odKapybary(s, kap.uid, superova.uid)).toEqual([]);
  });
});
