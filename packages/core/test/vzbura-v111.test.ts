// Pravidlá v11.1 (Michal 2026-11-02, Zrejúca): „Majú sa aktivovať akcie naopak, nie aktivovať
// všetky.“ Vzbura obráti aktivitu karty — nespojené akcie sú aktívne, spojené neaktívne; spoj
// Odpor–Odpor sám nič neaktivuje. „Ak je Odpor spojený s Posilnením, vznikne Vzbura, ale len pre
// kartu, na ktorej je Odpor, jej akcie sa aktivujú naopak, ale sú posilnené. … na karty so
// Vzburou … sa nedá dať NA EX.“

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, GameState, LineState, PlacedCard, Tag } from "../src/index.ts";
import { apply, evaluateLine, legalCommands, lineState, loadGameData, naexCieleVLinii, setupGame } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const own = (card: CardInstance, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy: 0, ...x });
/** Partia hráča 0 bez lokality: [A, B, C] sa vyhodnotí ako línia C · B · A (C.pravá ↔ B.ľavá, B.pravá ↔ A.ľavá). */
const lineP0 = (...cards: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [cards, []] });

describe("Vzbura obráti aktivitu karty (v11.1)", () => {
  // B · A: B.pravá ↔ A.ľavá. Index 0 Odpor + Odpor (Vzbura), index 1 Rana proti Pecke (spojené),
  // index 2 len Viera A, index 3 len Cigareta B. A.pravá a B.ľavá nemajú suseda.
  const aL: Layout4 = ["Odpor", "Pecka", "Viera", null];
  const aR: Layout4 = [null, "Robota", null, null];
  const bL: Layout4 = ["Dlh", null, null, null];
  const bR: Layout4 = ["Odpor", "Rana", null, "Cigareta"];
  const zostav = () => {
    const data = syntheticData([makeDef("a", aL, aR), makeDef("b", bL, bR)]);
    return { data, a: instanceFor(data, "a", aL, aR), b: instanceFor(data, "b", bL, bR) };
  };

  it("nespojené akcie sú aktívne, spojené neaktívne; Odpory spoja ostávajú (nič nedajú)", () => {
    const { data, a, b } = zostav();
    const ev = evaluateLine(data, lineP0(own(a), own(b)));
    // Pecka a Rana sa stretli na spoji — pod Vzburou nič nedajú.
    expect(ev.sums[0]).toEqual({ Viera: 1, Robota: 1, Dlh: 1, Cigareta: 1 });
    const ea = ev.cards.get(a.uid)!;
    const eb = ev.cards.get(b.uid)!;
    expect(ea.vzbura).toBe(true);
    expect(eb.vzbura).toBe(true);
    expect(ea.left.map((s) => s?.stav ?? null)).toEqual(["aktivna", "neaktivna", "aktivna", null]);
    expect(eb.right.map((s) => s?.stav ?? null)).toEqual(["aktivna", "neaktivna", null, "aktivna"]);
    expect(ea.right[1]?.stav).toBe("aktivna");
    expect(ev.zdroje[0].Viera?.[0]?.dovody).toEqual(["Vzbura"]);
  });

  it("NA EX po obrátení: aktívne (nespojené) zruší, neaktívne (spojené) zdvojí", () => {
    const { data, a, b } = zostav();
    const ev = evaluateLine(data, lineP0(own(a, { naexBy: 0 }), own(b)));
    // A: Viera a Robota zrušené, Pecka ×2; B ako bez NA EX.
    expect(ev.sums[0]).toEqual({ Pecka: 2, Dlh: 1, Cigareta: 1 });
    const ea = ev.cards.get(a.uid)!;
    expect(ea.left[0]?.stav).toBe("zrusena");
    expect(ea.left[1]).toMatchObject({ stav: "aktivna", nasobok: 2 });
    expect(ea.left[2]?.stav).toBe("zrusena");
  });

  it("akcia spojená s Posilnením suseda je neaktívna; Posilnenie karty so Vzburou suseda zdvojí ďalej", () => {
    // C · B · A: C–B Odpor + Odpor (index 0); B–A: B Posilnenie proti Rane A (index 0),
    // B Pecka proti Posilneniu A (index 1).
    const aL2: Layout4 = ["Rana", "Posilnenie", null, null];
    const bL2: Layout4 = ["Odpor", null, null, "Viera"];
    const bR2: Layout4 = ["Posilnenie", "Pecka", null, null];
    const cR2: Layout4 = ["Odpor", null, null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const b = instanceFor(data, "b", bL2, bR2);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "a", aL2, EMPTY)), own(b), own(instanceFor(data, "c", EMPTY, cR2))));
    // Rana A ×2 od Posilnenia B; Pecka B (spojená, ×2 od A) zhasne; Viera B nespojená ožije.
    expect(ev.sums[0]).toEqual({ Rana: 2, Viera: 1 });
    expect(ev.cards.get(b.uid)?.right[1]).toMatchObject({ stav: "neaktivna", nasobok: 0 });
  });

  it("Odpor karty so Vzburou na druhom spoji ruší ďalej", () => {
    // C · B · A: C–B Odpor + Odpor (index 0), B Odpor proti Pecke A (index 1).
    const aL2: Layout4 = [null, "Pecka", null, null];
    const bL2: Layout4 = ["Odpor", null, null, null];
    const bR2: Layout4 = [null, "Odpor", "Rana", null];
    const cR2: Layout4 = ["Odpor", null, null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const a = instanceFor(data, "a", aL2, EMPTY);
    const ev = evaluateLine(data, lineP0(own(a), own(instanceFor(data, "b", bL2, bR2)), own(instanceFor(data, "c", EMPTY, cR2))));
    expect(ev.cards.get(a.uid)?.left[1]?.stav).toBe("zrusena");
    expect(ev.sums[0]).toEqual({ Rana: 1 });
  });

  it("Forsáž zdvojí akcie aktívne po obrátení — spojené ostanú neaktívne", () => {
    // C · B · A: C–B Odpor + Odpor (index 0) a Rana proti Viere (index 1); B–A Posilnenie + Posilnenie (index 0).
    const aL2: Layout4 = ["Posilnenie", null, null, null];
    const bL2: Layout4 = ["Odpor", "Rana", "Pecka", null];
    const bR2: Layout4 = ["Posilnenie", null, null, null];
    const cR2: Layout4 = ["Odpor", "Viera", null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const b = instanceFor(data, "b", bL2, bR2);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "a", aL2, EMPTY)), own(b), own(instanceFor(data, "c", EMPTY, cR2))));
    expect(ev.sums[0]).toEqual({ Pecka: 2 });
    expect(ev.cards.get(b.uid)?.forsaz).toBe(true);
    expect(ev.zdroje[0].Pecka?.[0]?.dovody).toEqual(["Vzbura", "Forsáž"]);
  });

  it("Odpor proti Posilneniu: Vzbura len karty s Odporom, jej aktívne akcie posilnené", () => {
    // B · A: index 0 Odpor A proti Posilneniu B, index 1 Pecka A proti Rane B, index 2 len Viera A.
    const aL2: Layout4 = ["Odpor", "Pecka", "Viera", null];
    const bR2: Layout4 = ["Posilnenie", "Rana", null, "Cigareta"];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", EMPTY, bR2)]);
    const a = instanceFor(data, "a", aL2, EMPTY);
    const b = instanceFor(data, "b", EMPTY, bR2);
    const ev = evaluateLine(data, lineP0(own(a), own(b)));
    // A: Pecka zhasne, Viera ožije ×2; B: Rana ×1, Cigareta neaktívna, Posilnenie zrušené.
    expect(ev.sums[0]).toEqual({ Viera: 2, Rana: 1 });
    expect(ev.cards.get(a.uid)?.vzbura).toBe(true);
    expect(ev.cards.get(b.uid)?.vzbura).toBe(false);
    expect(ev.zdroje[0].Viera?.[0]?.dovody).toEqual(["Vzbura", "Posilnenie"]);
    expect(ev.cards.get(b.uid)?.right[0]?.stav).toBe("zrusena");
    // NA EX na kartu s Posilnením ho zruší — zdvojenie zanikne, obrátenie ostáva.
    const naB = evaluateLine(data, lineP0(own(a), own(b, { naexBy: 1 })));
    expect(naB.sums[0].Viera).toBe(1);
    expect(naB.cards.get(a.uid)?.vzbura).toBe(true);
  });

  it("Vzbura s Posilnením a Forsáž na druhom spoji: nespojené akcie ×4", () => {
    // C · B · A: C–B Posilnenie C proti Odporu B (index 0); B–A Posilnenie + Posilnenie (index 0).
    // Viera B (index 2 vľavo) nemá partnera.
    const aL2: Layout4 = ["Posilnenie", null, null, null];
    const bL2: Layout4 = ["Odpor", null, "Viera", null];
    const bR2: Layout4 = ["Posilnenie", null, null, null];
    const cR2: Layout4 = ["Posilnenie", null, null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "a", aL2, EMPTY)), own(instanceFor(data, "b", bL2, bR2)), own(instanceFor(data, "c", EMPTY, cR2))));
    expect(ev.sums[0]).toEqual({ Viera: 4 });
    expect(ev.zdroje[0].Viera?.[0]?.dovody).toEqual(["Vzbura", "Forsáž", "Posilnenie"]);
  });

  it("na kartu so Vzburou (oboch druhov) NA EX nejde", () => {
    // B · A Odpor + Odpor: obe so Vzburou, obe majú aktívnu aj neaktívnu akciu.
    const { data, a, b } = zostav();
    expect(naexCieleVLinii(data, lineP0(own(a), own(b)), 0)).toEqual([]);
    // Odpor proti Posilneniu: karta s Odporom nie, karta s Posilnením áno (aktívna Rana, neaktívna Cigareta).
    const aL2: Layout4 = ["Odpor", "Pecka", "Viera", null];
    const bR2: Layout4 = ["Posilnenie", "Rana", null, "Cigareta"];
    const d2 = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", EMPTY, bR2)]);
    const a2 = instanceFor(d2, "a", aL2, EMPTY);
    const b2 = instanceFor(d2, "b", EMPTY, bR2);
    expect(naexCieleVLinii(d2, lineP0(own(a2), own(b2)), 0)).toEqual([b2.uid]);
  });

  it("lokalita sa obráti len na hrane pri tom kraji — aj počet Pitiek", () => {
    // Lokalita: ľavá hrana (hráč 0) Odpor, Rana (spojená s Peckou A), Povera (nespojená); pravá Viera.
    const lokL: Layout4 = [null, "Odpor", "Rana", "Povera"];
    const lokR: Layout4 = ["Viera", null, null, null];
    const aR: Layout4 = [null, "Odpor", "Pecka", null];
    const data = syntheticData([makeDef("lok", lokL, lokR, { tags: ["Lokalita" as Tag] }), makeDef("a", EMPTY, aR)]);
    const ev = evaluateLine(data, {
      lokalita: instanceFor(data, "lok", lokL, lokR),
      lokalitaOtocena: false,
      strany: [[own(instanceFor(data, "a", EMPTY, aR))], []],
    });
    // Hráč 0: Povera z lokality; Rana lokality a Pecka A zhasli. Pravá hrana bez suseda nič.
    expect(ev.sums[0]).toEqual({ Povera: 1 });
    expect(ev.sums[1]).toEqual({});
    // Pitky na strane hráča 0: Odpor spoja (ako doteraz) a Povera; Rana zhasla.
    expect(ev.aktivneStredu).toEqual([2, 0]);
  });

  it("Výtržník Vzburu nevyvolá a jeho akcie ostávajú aktívne Rany", () => {
    const aL2: Layout4 = ["Odpor", "Pecka", null, null];
    const bR2: Layout4 = ["Odpor", "Viera", null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", EMPTY, bR2)]);
    const a = instanceFor(data, "a", aL2, EMPTY);
    const b = instanceFor(data, "b", EMPTY, bR2);
    const ev = evaluateLine(data, lineP0(own(a), own(b, { vytrznik: true, naexBy: 0, naexBy2: 1 })));
    expect(ev.cards.get(a.uid)?.vzbura).toBe(false);
    expect(ev.sums[0]).toEqual({ Pecka: 1, Rana: 2 });
  });

  it("Pohoršenie karty so Vzburou proti Odporu je zrušené, do súčtov nejde (Telefón ho do 2026-11-09 chránil len pred zrušením)", () => {
    // C · B · A: C–B Odpor + Odpor (index 0); B Pohoršenie proti Odporu A (index 1).
    const aL2: Layout4 = [null, "Odpor", null, null];
    const bL2: Layout4 = ["Odpor", null, null, null];
    const bR2: Layout4 = [null, "Pohoršenie", null, null];
    const cR2: Layout4 = ["Odpor", null, null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const b = instanceFor(data, "b", bL2, bR2);
    const strany: LineState["strany"] = [[own(instanceFor(data, "a", aL2, EMPTY)), own(b), own(instanceFor(data, "c", EMPTY, cR2))], []];
    const ev = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany, nastroje: [[], []] });
    expect(ev.cards.get(b.uid)?.right[1]?.stav).toBe("zrusena");
    expect(ev.sums[0].Pohoršenie).toBeUndefined();
  });

  it("Pakt karty so Vzburou: spojený (kópia) je neaktívny, nespojený nič nedá", () => {
    // C · B · A: C–B Odpor + Odpor (index 0); B Pakt proti Pecke A (index 1); B Pakt bez partnera (index 2).
    const aL2: Layout4 = [null, "Pecka", null, null];
    const bL2: Layout4 = ["Odpor", null, null, null];
    const bR2: Layout4 = [null, "Pakt", "Pakt", null];
    const cR2: Layout4 = ["Odpor", null, null, null];
    const data = syntheticData([makeDef("a", aL2, EMPTY), makeDef("b", bL2, bR2), makeDef("c", EMPTY, cR2)]);
    const ev = evaluateLine(data, lineP0(own(instanceFor(data, "a", aL2, EMPTY)), own(instanceFor(data, "b", bL2, bR2)), own(instanceFor(data, "c", EMPTY, cR2))));
    // Pecka A ×1 (A Vzburu nemá); Pakt B ako Pecka zhasne.
    expect(ev.sums[0]).toEqual({ Pecka: 1 });
  });
});

describe("Vzbura s rozložením zo snímky Zrejúcej (Michal 2026-11-02; akcie kariet sa odvtedy zmenili)", () => {
  const M_L: Layout4 = [null, "Dlh", "Viera", null];
  const M_R: Layout4 = [null, "Odpor", null, "Povera"];
  const P_L: Layout4 = ["Obmedzenie", "Odpor", "Rana", "Rana"];
  const P_R: Layout4 = ["Obmedzenie", "Dlh", "Robota", null];
  const data = syntheticData([makeDef("milujuca_manzelka", M_L, M_R), makeDef("policajtka", P_L, P_R)]);

  it("Milujúca manželka · Policajtka spojené Odporom: obe majú aktívne len nespojené akcie", () => {
    // Manželka.pravá [–, Odpor, –, Povera] ↔ Policajtka.ľavá [Obmedzenie, Odpor, Rana, Rana].
    const manzelka = instanceFor(data, "milujuca_manzelka", M_L, M_R);
    const policajtka = instanceFor(data, "policajtka", P_L, P_R);
    const ev = evaluateLine(data, lineP0(own(policajtka), own(manzelka)));
    const ep = ev.cards.get(policajtka.uid)!;
    const em = ev.cards.get(manzelka.uid)!;
    expect(ep.vzbura).toBe(true);
    expect(em.vzbura).toBe(true);
    // Policajtka: spojená Rana pri Povere neaktívna (Odpor spoja ostáva); nespojené Obmedzenie, Rana
    // a celá pravá hrana bez suseda (Obmedzenie, Hazard, Robota) aktívne.
    expect(ep.left.map((s) => s?.stav ?? null)).toEqual(["aktivna", "aktivna", "aktivna", "neaktivna"]);
    expect(ep.right.filter((s) => s !== null).map((s) => s.stav)).toEqual(["aktivna", "aktivna", "aktivna"]);
    // Manželka: Povera stojí proti Rane Policajtky — je spojená, teda neaktívna; ľavá hrana bez suseda aktívna.
    expect(em.right.map((s) => s?.stav ?? null)).toEqual([null, "aktivna", null, "neaktivna"]);
    expect(em.left.filter((s) => s !== null).every((s) => s.stav === "aktivna")).toBe(true);
    expect(ev.sums[0]).toMatchObject({ Rana: 1, Robota: 1 });
    expect(ev.sums[0].Povera).toBeUndefined();
  });
});

describe("NA EX na kartu so Vzburou — server (v11.1)", () => {
  it("legalCommands ju neponúkne a príkaz server odmietne", () => {
    const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
    const s0 = setupGame(data, 41);
    const manzelka: CardInstance = { uid: 99101, defId: "milujuca_manzelka", leftLayout: 0, rightLayout: 0 };
    const policajtka: CardInstance = { uid: 99102, defId: "policajtka", leftLayout: 0, rightLayout: 0 };
    const s: GameState = {
      ...s0,
      faza: "pitka",
      pitkyCelkom: 1,
      pitkaCislo: 1,
      strany: [[own(policajtka), own(manzelka)], []],
      hraci: [{ ...s0.hraci[0], poldeciPlne: 1 }, s0.hraci[1]],
      pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false] },
    } as GameState;
    expect(evaluateLine(data, lineState(s)).cards.get(policajtka.uid)?.vzbura).toBe(true);
    const naex = legalCommands(data, s, 0).filter((c) => c.type === "naex");
    expect(naex).toEqual([]);
    expect(() => apply(data, s, { type: "naex", uid: policajtka.uid }, 0)).toThrow(/bez Vzbury/);
  });
});
