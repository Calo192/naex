// Kostol v11.7 (Michal 2026-11-06, §15): „V kostole sa nesmie piť — piť môžu len karty najďalej
// od kostola — posledné v línii na jednej alebo druhej strane.“ Oltár a otočenie Kostola pre
// NA EX zanikli. Motor, možnosti servera aj značky v klientovi musia vidieť to isté — aj keď
// poslednú kartu klient nepozná (súperova skrytá Záverečná).

import { describe, expect, it } from "vitest";
// Sada v6: testy nesmú závisieť od rozpracovaných akcií kariet v tvorcovi.
import cardsJson from "./data/cards-v6.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  legalCommands,
  lineState,
  loadGameData,
  moznostiNaex,
  moznostiNaexVPohlade,
  naexCieleVLinii,
  setupGame,
  uidZaverecnej,
  viewFor,
  zablokovaneStrany,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
// Bzdocha (klebetnica) v sade v6 ešte nie je — vo vyhodnotení stačí, že leží v línii.
const dataSBzdochou: GameData = {
  ...data,
  cards: new Map([...data.cards, ["klebetnica", { ...data.cards.get("zamocnik")!, id: "klebetnica" }]]),
  variants: new Map([...data.variants, ["klebetnica", data.variants.get("zamocnik")!]]),
};

let uidSeq = 91000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (defId: string, playedBy: PlayerId, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card: inst(defId), playedBy, ...extra });
const uid = (pl: PlacedCard): number => pl.card.uid;
const zoradene = (xs: readonly number[]): number[] => [...xs].sort((a, b) => a - b);

/** Dvojica kariet — spoj im dá aktívnu aj neaktívnu akciu, takže NA EX na ne má zmysel. */
const dvojica = (p: PlayerId): [PlacedCard, PlacedCard] => [lezi("zamocnik", p), lezi("zamocnik", p)];

function vPitke(strany: GameState["strany"], o: { lokalita?: string; otocena?: boolean; ruka?: boolean; pitkyCelkom?: number } = {}): GameState {
  const s = setupGame(data, 3);
  const ruka = (): CardInstance[] => (o.ruka === true ? [inst("zamocnik")] : []);
  return {
    ...s,
    faza: "pitka",
    pitkyCelkom: o.pitkyCelkom ?? 1,
    pitkaCislo: 1,
    ciel: { typ: "lokalita", lokalita: inst(o.lokalita ?? "kostol") },
    lokalitaOtocena: o.otocena ?? false,
    strany,
    hraci: [
      { ...s.hraci[0], poldeciPlne: 2, cigarety: 3, ruka: ruka() },
      { ...s.hraci[1], poldeciPlne: 2, cigarety: 3, ruka: ruka() },
    ],
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
  } as GameState;
}

/** Hráč skončí svoju časť Pitky — ak ju za neho neskončila hra sama (nemá čo ďalšie robiť). */
const skonci = (s: GameState, p: PlayerId, d: GameData = data): GameState => (s.pitkaStav?.hotovy[p] === false ? apply(d, s, { type: "skipNaex" }, p).state : s);

/** Možnosti motora, príkazy aj pohľad klienta musia hovoriť to isté — a vrátia to. */
function ciele(s: GameState, p: PlayerId): number[] {
  const motor = zoradene(moznostiNaex(data, s, p));
  expect(zoradene(moznostiNaexVPohlade(data, viewFor(data, s, p)))).toEqual(motor);
  expect(zoradene(legalCommands(data, s, p).flatMap((c) => (c.type === "naex" ? [c.uid] : [])))).toEqual(motor);
  return motor;
}

describe("Kostol: NA EX len na poslednú kartu línie (v11.7)", () => {
  it("na výber sú oba konce, karty bližšie ku Kostolu motor odmietne — obom hráčom", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const s = vPitke([[a1, a2], [b1, b2]]);
    const konce = zoradene([uid(a2), uid(b2)]);
    for (const p of [0, 1] as const) {
      expect(ciele(s, p)).toEqual(konce);
      for (const blizko of [a1, b1]) expect(() => apply(data, s, { type: "naex", uid: uid(blizko) }, p)).toThrow(/Kostol/);
      expect(apply(data, s, { type: "naex", uid: uid(a2) }, p).state.pitkaStav?.skryteNaex).toEqual([{ hrac: p, uid: uid(a2) }]);
    }
  });

  it("mimo Kostola platí stará voľnosť — ten istý stôl má aj karty bližšie k lokalite", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const inde = vPitke([[a1, a2], [b1, b2]], { lokalita: "krcma" });
    expect(ciele(inde, 0).length).toBeGreaterThan(2);
  });

  it("otočenie Kostola nič nemení — oltár pre NA EX zanikol", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const konce = zoradene([uid(a2), uid(b2)]);
    expect(ciele(vPitke([[a1, a2], [b1, b2]], { otocena: true }), 0)).toEqual(konce);
    expect(ciele(vPitke([[a1, a2], [b1, b2]], { otocena: false }), 0)).toEqual(konce);
  });

  it("strana bez karty cieľ nemá: ostáva koniec druhej strany, prázdna línia nedá nič", () => {
    const [b1, b2] = dvojica(1);
    expect(ciele(vPitke([[], [b1, b2]]), 0)).toEqual([uid(b2)]);
    expect(ciele(vPitke([[b1, b2], []]), 1)).toEqual([uid(b2)]);
    expect(ciele(vPitke([[], []]), 0)).toEqual([]);
  });

  it("koniec, ktorý cieľom byť nemôže, sa neposúva na kartu pred ním: poldeci aj Nástroj", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const sPoldeci = { ...a2, naexBy: 1 as const };
    expect(ciele(vPitke([[a1, sPoldeci], [b1, b2]]), 0)).toEqual([uid(b2)]);
    // Nástroj nie je Občan ani Starešina — tá strana v tejto chvíli cieľ nemá.
    const nastroj = lezi("puska", 0);
    expect(data.cards.get("puska")?.tags).toContain("Nástroj");
    expect(ciele(vPitke([[a1, a2, nastroj], [b1, b2]]), 0)).toEqual([uid(b2)]);
  });

  it("súperova skrytá Záverečná je posledná: súper ju smie aj cez náhradné uid, karta pred ňou cieľom nie je", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const rub = lezi("zamocnik", 0, { zaverecna: true });
    const s = vPitke([[a1, a2, rub], [b1, b2]]);
    expect(ciele(s, 1)).toEqual(zoradene([uidZaverecnej(0), uid(b2)]));
    expect(() => apply(data, s, { type: "naex", uid: uid(a2) }, 1)).toThrow(/Kostol/);
    const po = apply(data, s, { type: "naex", uid: uidZaverecnej(0) }, 1).state;
    expect(po.pitkaStav?.skryteNaex).toEqual([{ hrac: 1, uid: uid(rub) }]);
    // Klient skutočné uid nedostane, ani v pohľade na vlastné skryté NA EX.
    expect(JSON.stringify(viewFor(data, po, 1).strany)).not.toContain(`"uid":${uid(rub)}`);
    expect(viewFor(data, po, 1).pitkaStav?.skryteNaex).toEqual([{ hrac: 1, uid: uidZaverecnej(0) }]);
  });

  it("majiteľ skrytej Záverečnej nemá na tej strane cieľ — jeho vlastná je posledná, NA EX na ňu nesmie", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const rub = lezi("zamocnik", 0, { zaverecna: true });
    const s = vPitke([[a1, a2, rub], [b1, b2]]);
    expect(ciele(s, 0)).toEqual([uid(b2)]);
    expect(() => apply(data, s, { type: "naex", uid: uid(a2) }, 0)).toThrow(/Kostol/);
    expect(() => apply(data, s, { type: "naex", uid: uid(rub) }, 0)).toThrow(/Záverečnú/);
    // Rovnako, keď ju má majiteľ podstrčenú na súperovej strane.
    const podstrcena = vPitke([[a1, a2], [b1, b2, rub]]);
    expect(ciele(podstrcena, 0)).toEqual([uid(a2)]);
    expect(ciele(podstrcena, 1)).toEqual(zoradene([uid(a2), uidZaverecnej(1)]));
  });

  it("Záverečná s poldeci už cieľom nie je a karta pred ňou tiež nie", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const rub = lezi("zamocnik", 0, { zaverecna: true, naexBy: 1 });
    expect(ciele(vPitke([[a1, a2, rub], [b1, b2]]), 1)).toEqual([uid(b2)]);
  });

  it("naexCieleVLinii na stole bez súperovej Záverečnej: bez údaja o nej by vybral kartu pred ňou", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const rub = lezi("zamocnik", 0, { zaverecna: true });
    const pohlad = viewFor(data, vPitke([[a1, a2, rub], [b1, b2]]), 1);
    expect(zoradene(naexCieleVLinii(data, lineState(pohlad), 1))).toEqual(zoradene([uid(a2), uid(b2)]));
    expect(naexCieleVLinii(data, lineState(pohlad), 1, false, zablokovaneStrany(pohlad))).toEqual([uid(b2)]);
  });

  it("zrážka: obaja na ten istý koniec — Výtržník ako všade", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const s = vPitke([[a1, a2], [b1, b2]]);
    const prvy = apply(data, s, { type: "naex", uid: uid(a2) }, 0).state;
    // Súperovo skryté NA EX neskončí možnosti druhého: ten istý koniec ostáva cieľom.
    expect(ciele(prvy, 1)).toEqual(zoradene([uid(a2), uid(b2)]));
    const druhy = apply(data, prvy, { type: "naex", uid: uid(a2) }, 1).state;
    const po = skonci(skonci(druhy, 0), 1);
    const karta = po.strany[0].find((pl) => uid(pl) === uid(a2));
    expect(karta?.vytrznik).toBe(true);
    expect([karta?.naexBy, karta?.naexBy2].sort()).toEqual([0, 1]);
  });

  it("Bzdocha: kto hrá po súperovi a vidí jeho NA EX, má na výber ten istý aj druhý koniec", () => {
    const bzdocha = lezi("klebetnica", 1);
    const [a1, a2] = dvojica(0);
    const b2 = lezi("zamocnik", 1);
    const s = vPitke([[a1, a2], [bzdocha, b2]]);
    const stav = { ...s, pitkaStav: { ...s.pitkaStav!, bzdocha: 1 as const } } as GameState;
    const superHotovy = skonci(apply(dataSBzdochou, stav, { type: "naex", uid: uid(a2) }, 0).state, 0, dataSBzdochou);
    const pohlad = viewFor(dataSBzdochou, superHotovy, 1);
    expect(pohlad.pitkaStav?.skryteNaex).toEqual([{ hrac: 0, uid: uid(a2) }]);
    const moznosti = zoradene(moznostiNaexVPohlade(dataSBzdochou, pohlad));
    expect(moznosti).toEqual(zoradene(moznostiNaex(dataSBzdochou, superHotovy, 1)));
    expect(moznosti).toEqual(zoradene([uid(a2), uid(b2)]));
  });

  it("odpoveď zmení koniec línie: NA EX dané legálne ostáva, novým cieľom je odpoveď", () => {
    const [a1, a2] = dvojica(0);
    const [b1, b2] = dvojica(1);
    const s = vPitke([[a1, a2], [b1, b2]], { ruka: true, pitkyCelkom: 2 });
    const odpoved = s.hraci[1].ruka[0]!;
    const poNaex = skonci(skonci(apply(data, s, { type: "naex", uid: uid(b2) }, 0).state, 0), 1);
    expect(poNaex.pitkaStav?.reakcia).toBe(1);
    const poOdpovedi = apply(data, poNaex, { type: "place", uid: odpoved.uid, target: "vlastna" }, 1).state;
    expect(poOdpovedi.strany[1].map(uid)).toEqual([uid(b1), uid(b2), odpoved.uid]);
    expect(poOdpovedi.strany[1][1]?.naexBy).toBe(0);
    // Ďalšia Pitka kola: novým koncom je odpoveď, karta s NA EX pred ňou ostáva a cieľom nie je.
    expect(poOdpovedi.faza).toBe("zhromazdenie");
    const druhaPitka = apply(data, poOdpovedi, { type: "pass" }, 0).state;
    expect(druhaPitka.faza).toBe("pitka");
    expect(druhaPitka.strany[1][1]?.naexBy).toBe(0);
    expect(ciele(druhaPitka, 0)).toEqual(zoradene([uid(a2), odpoved.uid]));
  });
});
