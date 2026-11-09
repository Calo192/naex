// NA EX × Odpor × Posilnenie (v11.17, Michal 2026-11-09 „Teraz sú to čisto mŕtve akcie pri NA EX.“;
// docs/napady/naex-odpor-posilnenie.html, P2 „Poldeci ako partner“ v miernejšej podobe):
//  - Odpor zrušený cez NA EX pustí partnera — akcia, ktorú rušil, ožije ×1 (§7),
//  - neaktívny Odpor pod NA EX je štít: NA EX zahasí, karta je ako bez neho,
//  - neaktívne Posilnenie pod NA EX: NA EX nezruší aktívne akcie karty, neaktívne zdvojí,
//  - na kartu s neaktívnym Odporom NA EX nejde a neaktívne Posilnenie sa do „neaktívnej“ neráta.
// Očakávané hodnoty sú z textu §7.

import { describe, expect, it } from "vitest";
import type { CardDef, CardInstance, GameData, LineEval, LineState, PlacedCard, PlayerId } from "../src/index.ts";
import { evaluateLine, naexCieleVLinii, ucinokNaex } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const OBCAN = { tags: ["Občan"] } as const;
const nastrojDef = (id: string, hore: string, dole: string): CardDef => makeDef(id, EMPTY, EMPTY, { tags: ["Nástroj"], effectText: `Hore: ${hore}. Dole: ${dole}.` });

/** Rozloženia: ľavá hrana, pravá hrana. */
const K: Record<string, [Layout4, Layout4]> = {
  // Odpor proti Rane suseda, Pecka proti jeho druhej Rane, Viera bez partnera (cieľ NA EX).
  odporca: [["Viera", null, null, null], ["Odpor", "Pecka", null, null]],
  obet: [["Rana", "Rana", null, null], EMPTY],
  // Obeť s Odporom na pravej hrane proti Odporu tretej karty — Vzbura.
  obet_vzbura: [["Rana", "Rana", null, null], [null, null, null, "Odpor"]],
  odpor3: [[null, null, null, "Odpor"], EMPTY],
  // Nespárovaný Odpor na ľavej hrane, Rana proti Pecke suseda, Viera bez partnera.
  stit: [["Odpor", null, null, null], ["Rana", "Viera", null, null]],
  bez_stitu: [["Rana", null, null, null], ["Rana", "Viera", null, null]],
  sused: [EMPTY, ["Pecka", null, null, null]],
  sused_l: [["Pecka", null, null, null], EMPTY],
  // Nespárované Posilnenie; Rana aktívna, Viera neaktívna.
  posil: [["Posilnenie", null, null, null], ["Rana", "Viera", null, null]],
  posil_len: [["Posilnenie", null, null, null], ["Rana", null, null, null]],
  // Nespárované Posilnenie a Posilnenie na spoji (Pecka suseda ×2).
  posil_dve: [["Posilnenie", null, null, null], ["Posilnenie", "Viera", null, null]],
  oboje: [["Odpor", "Posilnenie", null, null], ["Rana", "Viera", null, null]],
  // Zapaľovač: Cigareta na spoji ostáva.
  zap: [["Viera", null, null, null], ["Odpor", "Cigareta", null, null]],
  veteran: [["Viera", null, null, null], ["Odpor", "Pecka", null, null]],
  vzbura_po: [["Viera", null, null, null], ["Odpor", "Pecka", null, null]],
  odpor_vl: [["Odpor", "Rana", null, null], EMPTY],
  odpor_l: [EMPTY, ["Odpor", "Rana", null, null]],
};

const sada: GameData = syntheticData([
  ...Object.entries(K).map(([id, [l, r]]) => makeDef(id, l, r, OBCAN)),
  makeDef("lok", ["Rana", "Rana", null, null], EMPTY, { tags: ["Lokalita"] }),
  nastrojDef("vinko", "NA EX", "{Pečeň}→{Poldeci}"),
]);
const k = (id: string): CardInstance => {
  const [l, r] = K[id] as [Layout4, Layout4];
  return instanceFor(sada, id, l, r);
};
const lezi = (card: CardInstance, naexBy?: PlayerId, extra: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy: 0, ...(naexBy === undefined ? {} : { naexBy }), ...extra });
/** Karty hráča 0 zľava doprava (bez lokality, neotočené): pravá hrana karty stretne ľavú nasledujúcej. */
const linia = (...karty: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[], karty] });
const ev = (line: LineState): LineEval => evaluateLine(sada, line);
const slot = (e: LineEval, uid: number, strana: "left" | "right", i: number) => e.cards.get(uid)?.[strana][i];

describe("§7 Odpor zrušený cez NA EX pustí partnera (v11.17)", () => {
  it("akcia, ktorú Odpor rušil, ožije ×1; NA EX karte zruší Pecku a zdvojí Vieru", () => {
    const o = k("odporca");
    const b = k("obet");
    const bez = ev(linia(lezi(o), lezi(b)));
    expect(bez.sums[0]).toEqual({ Pecka: 1, Rana: 1 });
    expect(slot(bez, b.uid, "left", 0)).toMatchObject({ stav: "zrusena" });
    const s = ev(linia(lezi(o, 1), lezi(b)));
    expect(slot(s, b.uid, "left", 0)).toMatchObject({ action: "Rana", stav: "aktivna", nasobok: 1 });
    expect(slot(s, o.uid, "right", 0)).toMatchObject({ action: "Odpor", stav: "zrusena" });
    expect(s.sums[0]).toEqual({ Rana: 2, Viera: 2 });
    // Oživená akcia už nie je „zrušená Odporom“ — rozpis zrušených ju neukazuje.
    expect(s.zrusene[0].Rana ?? []).toEqual([]);
  });

  it("Hrable: zrušená akcia, ktorú Hrable kradli, sa po NA EX vráti majiteľovi ×1", () => {
    const o = k("odporca");
    const b = k("obet");
    const nastroje = [["hrable"], []] as const;
    const bez = ev({ ...linia(lezi(o), lezi(b)), nastroje });
    // Rana ukradnutá Hrabľami ×2 + druhá Rana obete.
    expect(bez.sums[0].Rana).toBe(3);
    const s = ev({ ...linia(lezi(o, 1), lezi(b)), nastroje });
    expect(s.sums[0].Rana).toBe(2);
    expect(s.zdroje[0].Rana?.every((z) => !z.dovody.includes("karta:hrable"))).toBe(true);
  });

  it("partner pod Vzburou ožije ako spojený, teda neaktívny", () => {
    const o = k("odporca");
    const b = k("obet_vzbura");
    const bez = ev(linia(lezi(o), lezi(b), lezi(k("odpor3"))));
    expect(bez.cards.get(b.uid)?.vzbura).toBe(true);
    expect(slot(bez, b.uid, "left", 0)).toMatchObject({ stav: "zrusena" });
    const s = ev(linia(lezi(o, 1), lezi(b), lezi(k("odpor3"))));
    expect(slot(s, b.uid, "left", 0)).toMatchObject({ stav: "neaktivna", nasobok: 0 });
  });

  it("partner s vlastným NA EX: ožije a jeho NA EX ho zruší", () => {
    const o = k("odporca");
    const b = k("obet");
    const s = ev(linia(lezi(o, 1), lezi(b, 1)));
    expect(slot(s, b.uid, "left", 0)).toMatchObject({ stav: "zrusena", nasobok: 0 });
    expect(s.zrusene[0].Rana?.map((z) => z.dovody)).toEqual([["NA EX"], ["NA EX"]]);
  });

  it("súperov Odpor na akcii karty s NA EX: bez NA EX na karte s Odporom akcia ostáva zrušená", () => {
    const o = k("odporca");
    const b = k("obet");
    const s = ev(linia(lezi(o), lezi(b, 1)));
    expect(slot(s, b.uid, "left", 0)).toMatchObject({ stav: "zrusena" });
    expect(s.zrusene[0].Rana?.map((z) => z.dovody)).toEqual([["Odpor"], ["NA EX"]]);
  });

  it("Energeťák chráni Posilnenie, Odpor nie; Zapaľovač podrží Cigaretu a Odpor aj tak zruší", () => {
    const o = k("odporca");
    const b = k("obet");
    const e = ev({ ...linia(lezi(o, 1), lezi(b)), nastroje: [["energetak"], []] });
    expect(slot(e, b.uid, "left", 0)).toMatchObject({ stav: "aktivna", nasobok: 1 });
    const z = k("zap");
    const b2 = k("obet");
    const s = ev({ ...linia(lezi(z, 1), lezi(b2)), nastroje: [["zapalovac"], []] });
    expect(slot(s, z.uid, "right", 1)).toMatchObject({ action: "Cigareta", stav: "aktivna", nasobok: 1 });
    expect(slot(s, b2.uid, "left", 0)).toMatchObject({ action: "Rana", stav: "aktivna", nasobok: 1 });
    expect(s.sums[0]).toEqual({ Cigareta: 1, Rana: 2, Viera: 2 });
  });

  it("Veterán: NA EX mu Odpor nezruší (zdvojí ho naprázdno) — partner ostáva zrušený, Pecka ×2", () => {
    const v = k("veteran");
    const b = k("obet");
    const s = ev(linia(lezi(v, 1), lezi(b)));
    expect(slot(s, b.uid, "left", 0)).toMatchObject({ stav: "zrusena" });
    expect(s.sums[0]).toEqual({ Pecka: 2, Rana: 1 });
  });

  it("hrana lokality zrušená Odporom karty ožije — aktivuje Pitku", () => {
    const lok = instanceFor(sada, "lok", ["Rana", "Rana", null, null], EMPTY);
    const o = k("odporca");
    // Hráč 0 pri lokalite: pravá hrana karty stretne ľavú hranu lokality.
    const line = (naexBy?: PlayerId): LineState => ({ lokalita: lok, lokalitaOtocena: false, strany: [[lezi(o, naexBy)], []] });
    expect(ev(line()).aktivneStredu[0]).toBe(1);
    expect(ev(line(1)).aktivneStredu[0]).toBe(2);
  });

  it("Vzbura, ktorá vznikla až po výbere: NA EX zruší Odpory spoja, Vzbura ostáva, nič neožije", () => {
    const v = k("vzbura_po");
    const o = k("odpor_vl");
    const s = ev(linia(lezi(v, 1), lezi(o)));
    expect(s.cards.get(v.uid)?.vzbura).toBe(true);
    expect(slot(s, v.uid, "right", 0)).toMatchObject({ action: "Odpor", stav: "zrusena" });
    // Spojená Rana suseda pod jeho Vzburou ostáva neaktívna; nespojená Viera (aktívna po obrátení) zrušená, spojená Pecka ×2.
    expect(slot(s, o.uid, "left", 1)).toMatchObject({ action: "Rana", stav: "neaktivna" });
    expect(slot(s, v.uid, "left", 0)).toMatchObject({ action: "Viera", stav: "zrusena" });
    expect(slot(s, v.uid, "right", 1)).toMatchObject({ action: "Pecka", stav: "aktivna", nasobok: 2 });
  });
});

describe("§7 neaktívny Odpor pod NA EX je štít (v11.17)", () => {
  it("NA EX zhasne: karta sa ráta ako bez neho a vyhodnotenie nesie naexStit", () => {
    const st = k("stit");
    const bez = ev(linia(lezi(st), lezi(k("sused_l"))));
    const sNaex = ev(linia(lezi(st, 1), lezi(k("sused_l"))));
    expect(bez.sums).toEqual([{ Rana: 1, Pecka: 1 }, {}]);
    expect(sNaex.sums).toEqual(bez.sums);
    expect(sNaex.cards.get(st.uid)?.naexStit).toBe("Odpor");
    expect(sNaex.cards.get(st.uid)?.left).toEqual(bez.cards.get(st.uid)?.left);
    expect(sNaex.cards.get(st.uid)?.right).toEqual(bez.cards.get(st.uid)?.right);
  });

  it("na kartu so štítom NA EX nejde; bez Odporu áno", () => {
    const st = k("stit");
    const bs = k("bez_stitu");
    expect(naexCieleVLinii(sada, linia(lezi(st), lezi(k("sused_l"))), 0)).toEqual([]);
    expect(naexCieleVLinii(sada, linia(lezi(bs), lezi(k("sused_l"))), 0)).toEqual([bs.uid]);
  });

  it("Odpor a Posilnenie bez partnera na jednej karte: vyhrá Odpor", () => {
    const ob = k("oboje");
    const s = ev(linia(lezi(ob, 1), lezi(k("sused_l"))));
    expect(s.cards.get(ob.uid)?.naexStit).toBe("Odpor");
    expect(s.sums[0]).toEqual({ Rana: 1, Pecka: 1 });
  });

  it("štít platí aj pre NA EX z Vínka; keď sa Odpor spáruje, NA EX platí", () => {
    const st = k("stit");
    const vinko: PlacedCard["podlozene"] = [{ card: instanceFor(sada, "vinko", EMPTY, EMPTY), majitel: 0, hrana: "horna" }];
    const s = ev(linia(lezi(st, undefined, { podlozene: vinko }), lezi(k("sused_l"))));
    expect(s.cards.get(st.uid)?.naexStit).toBe("Odpor");
    expect(s.sums[0]).toEqual({ Rana: 1, Pecka: 1 });
    // Karta priložená k vonkajšej hrane Odpor spáruje (zruší jej Pecku) — štít padne: NA EX zruší Odpor
    // (Pecka ožije) aj Ranu a zdvojí Vieru.
    const su = k("sused");
    const spar = ev(linia(lezi(su), lezi(st, 1), lezi(k("sused_l"))));
    expect(spar.cards.get(st.uid)?.naexStit).toBeUndefined();
    expect(slot(spar, su.uid, "right", 0)).toMatchObject({ action: "Pecka", stav: "aktivna", nasobok: 1 });
    expect(slot(spar, st.uid, "right", 0)).toMatchObject({ action: "Rana", stav: "zrusena" });
    expect(slot(spar, st.uid, "right", 1)).toMatchObject({ action: "Viera", stav: "aktivna", nasobok: 2 });
  });

  it("Veterán so štítom: NA EX mu aktívne nezdvojí", () => {
    const d = syntheticData([makeDef("veteran", ...K.stit!, OBCAN), makeDef("sused_l", ...K.sused_l!, OBCAN)]);
    const vet = instanceFor(d, "veteran", ...K.stit!);
    const s = evaluateLine(d, linia(lezi(vet, 1), lezi(instanceFor(d, "sused_l", ...K.sused_l!))));
    expect(s.sums[0]).toEqual({ Rana: 1, Pecka: 1 });
  });

  it("zrážka (Výtržník): štít nevznikne, všetky akcie sú Rany", () => {
    const st = k("stit");
    const s = ev(linia(lezi(st, 0, { naexBy2: 1, vytrznik: true }), lezi(k("sused_l"))));
    expect(s.cards.get(st.uid)?.naexStit).toBeUndefined();
    expect(s.sums[0]).toEqual({ Rana: 3, Pecka: 1 });
  });

  it("rekapitulácia: NA EX nič nezdvojilo ani nezrušilo, zahasil ho Odpor", () => {
    const st = k("stit");
    const line = linia(lezi(st, 1), lezi(k("sused_l")));
    expect(ucinokNaex(sada, line).karty).toEqual([expect.objectContaining({ uid: st.uid, zdvojilo: 0, zrusilo: 0, stit: "Odpor" })]);
  });
});

describe("§7 neaktívne Posilnenie pod NA EX: aktívne akcie nezruší (v11.17, miernejšia podoba P2)", () => {
  it("Rana ostáva ×1, neaktívna Viera ×2 — nie ×4", () => {
    const p = k("posil");
    const s = ev(linia(lezi(p, 1), lezi(k("sused_l"))));
    expect(s.cards.get(p.uid)?.naexStit).toBe("Posilnenie");
    expect(slot(s, p.uid, "right", 0)).toMatchObject({ action: "Rana", stav: "aktivna", nasobok: 1 });
    expect(slot(s, p.uid, "right", 1)).toMatchObject({ action: "Viera", stav: "aktivna", nasobok: 2 });
    // Posilnenie samo ostáva neaktívne — do „zdvojilo“ sa neráta.
    expect(slot(s, p.uid, "left", 0)).toMatchObject({ action: "Posilnenie", stav: "neaktivna" });
    expect(ucinokNaex(sada, linia(lezi(p, 1), lezi(k("sused_l")))).karty[0]).toMatchObject({ zdvojilo: 1, zrusilo: 0, stit: "Posilnenie" });
  });

  it("aktívne Posilnenie tej karty NA EX tiež nezruší — partner má ×2 ďalej", () => {
    const p = k("posil_dve");
    const s = ev(linia(lezi(p, 1), lezi(k("sused_l"))));
    expect(s.sums[0]).toEqual({ Pecka: 2, Viera: 2 });
  });

  it("výber: neaktívne Posilnenie sa do „neaktívnej“ neráta — sama by NA EX nič nezmenilo", () => {
    const len = k("posil_len");
    const p = k("posil");
    expect(naexCieleVLinii(sada, linia(lezi(len), lezi(k("sused_l"))), 0)).toEqual([]);
    expect(naexCieleVLinii(sada, linia(lezi(p), lezi(k("sused_l"))), 0)).toEqual([p.uid]);
  });

  it("výber: karta, ktorej jediná aktívna akcia je Odpor, je cieľ — NA EX partnera pustí", () => {
    // odpor_l: Odpor proti Pecke suseda, Rana bez partnera.
    const o = k("odpor_l");
    const sl = k("sused_l");
    const line = linia(lezi(o), lezi(sl));
    expect(naexCieleVLinii(sada, line, 0)).toEqual([o.uid]);
    expect(slot(ev(line), sl.uid, "left", 0)).toMatchObject({ stav: "zrusena" });
    expect(slot(ev(linia(lezi(o, 1), lezi(sl))), sl.uid, "left", 0)).toMatchObject({ stav: "aktivna", nasobok: 1 });
  });
});
