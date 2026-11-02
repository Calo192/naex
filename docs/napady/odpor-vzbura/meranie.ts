// Meranie pozícií Odporu a Posilnenia (Vymyselník, 2026-11-02, zadanie Michala).
//
// Výpočet, nie simulácia: pre každú dvojicu kariet sa prejdú VŠETKY varianty
// (ľavé × pravé rozloženie, ako ich losuje engine — rovnomerne) a spočíta sa,
// ako často vznikne Vzbura / Forsáž a čo Odpor zruší. Geometria (packages/core/src/partia.ts,
// evaluateLine + makeElem): tlačené súradnice, slot 0 hore.
//   vlastná k vlastnej:          nová.P[k]  ↔ staršia.Ľ[k]
//   otočená k súperovej (hosť):  hosť.Ľ[3−k] ↔ hostiteľ.Ľ[k]
//   súper priloží k podstrčenej: hostiteľova nová.P[k] ↔ hosť.P[3−k]
//
// Spustenie: node --experimental-strip-types --no-warnings docs/napady/odpor-vzbura/meranie.ts
// Výstup: čísla na konzolu a dáta vložené do docs/napady/odpor-vzbura-poc.html (<script id="data">).

import { readFileSync, writeFileSync } from "node:fs";
import { sideLayouts } from "../../../packages/core/src/variants.ts";
import type { SideDef, SideLayout } from "../../../packages/core/src/types.ts";

type Acts = Record<string, number>;
interface Side { actions: Acts; blocked: number[]; allowed?: Record<string, string[]> }
interface Card { id: string; name: string; tags: string[]; left: Side; right: Side; effect_text?: string }
interface Zmena { left?: Side; right?: Side; pozn: string }
type Par = [string | null, string | null];

const ROOT = new URL("../../../", import.meta.url);
const cards: Card[] = JSON.parse(readFileSync(new URL("packages/core/data/cards.json", ROOT), "utf8")).cards;

const OBRANNE = ["milujuca_manzelka", "veteran", "zivnostnik", "anonymny_alkoholik", "dvojcata", "sofer", "krokodil", "vandal"];
const VZBURENCI = ["recidivista", "kocovnik"];
const ZLE = new Set(["Dlh", "PoškodeniePečene"]);
const MOD = new Set(["Posilnenie", "Odpor", "Pakt"]);

const S = (actions: Acts, blocked: number[] = [], allowed?: Record<string, string[]>): Side =>
  ({ actions, blocked, ...(allowed ? { allowed } : {}) });
const any = (...a: string[]): string[] => a;

// ---------- Nový stav (zmeny naex-admin 2026-11-02, pozície ešte neurčené) ----------
// Nástroje so 4 akciami: rozdelené rovnomerne na strany, pozície voľné (bez okien).
const NASTROJE_NOVE: Record<string, [Acts, Acts]> = {
  puska: [{ Rana: 2 }, { Rana: 1, Petelica: 1 }],
  vinko: [{ Poldeci: 1, Posilnenie: 1 }, { Poldeci: 1, Posilnenie: 1 }],
  nealko: [{ Pohoršenie: 1, Odpor: 1 }, { Pohoršenie: 1, Odpor: 1 }],
  vidly: [{ Robota: 1, Rana: 1 }, { Robota: 1, Rana: 1 }],
  lievik: [{ Posilnenie: 1, Poldeci: 1 }, { Posilnenie: 1, Poldeci: 1 }],
  boxer: [{ Pecka: 1, Odpor: 1 }, { Pecka: 1, Odpor: 1 }],
  energetak: [{ Posilnenie: 1 }, { Posilnenie: 1, PoškodeniePečene: 1 }],
  furik: [{ Robota: 2 }, { Robota: 1, Cigareta: 1 }],
  horoskop: [{ Vízia: 1, Povera: 1 }, { Vízia: 1, Povera: 1 }],
  hrable: [{ Odpor: 2 }, { Odpor: 1, Robota: 1 }],
  jogurt: [{ PoškodeniePečene: 2 }, { PoškodeniePečene: 1, Poldeci: 1 }],
  kristalova_gula: [{ Vízia: 1, Povera: 1 }, { Vízia: 1, Povera: 1 }],
  pistalka: [{ Obmedzenie: 2 }, { Obmedzenie: 1, Pohoršenie: 1 }],
  telefon: [{ Pohoršenie: 1, Povera: 1 }, { Pohoršenie: 1, Povera: 1 }],
  vyherne_zreby: [{ Dlh: 2 }, { Dlh: 1, Robota: 1 }],
  zapalovac: [{ Cigareta: 1, Posilnenie: 1 }, { Cigareta: 1, Posilnenie: 1 }],
  zrkadlo: [{ Pakt: 1 }, { Pakt: 1 }],
};

function novyStav(): Map<string, Card> {
  const m = new Map<string, Card>();
  for (const c of cards) m.set(c.id, structuredClone(c));
  for (const [id, [l, r]] of Object.entries(NASTROJE_NOVE)) {
    const c = m.get(id)!;
    c.left = S(l);
    c.right = S(r);
  }
  const set = (id: string, f: (c: Card) => void): void => f(m.get(id)!);
  set("kulturista", (c) => { c.name = "Sypač"; c.left = S({ Rana: 2 }, [0, 3]); c.right = S({ Rana: 2, Dlh: 2 }); });
  set("liberal", (c) => { c.left = S({ Pohoršenie: 1, Cigareta: 1 }, [2, 3]); });
  set("kocovnik", (c) => { c.right = S({ Cigareta: 1, Pecka: 1, Pakt: 1 }, [2], { 3: ["Pakt", "Pecka"] }); });
  set("klebetnica", (c) => { c.name = "Bzdocha"; c.right = S({ Povera: 1, Vízia: 1 }, [0, 2]); });
  set("pistalka", (c) => { c.name = "Izolačka"; });
  return m;
}

// ---------- Návrh B „Obrana a vzbúrenci“ ----------
// Odpor obranný: slot 1. Vzbúrenec (dve zlé akcie na strane s Odporom): slot 2.
// Posilnenie: slot 2 (zrkadlo Odporu). Zlá akcia: slot 1 (druhá 0), nikdy 2.
const NAVRH_B: Record<string, Zmena> = {
  milujuca_manzelka: { left: S({ Dlh: 1, Viera: 1 }, [3], { 0: ["Viera"], 1: ["Dlh"], 2: ["Viera"] }), right: S({ Odpor: 1, Povera: 1 }, [0, 2], { 1: ["Odpor"], 3: ["Povera"] }), pozn: "obranná · Odpor P1, Hazard Ľ1" },
  praudovravec: { left: S({ Odpor: 1, Povera: 1, Viera: 1 }, [3], { 2: ["Odpor"], 0: any("Povera", "Viera"), 1: any("Povera", "Viera") }), right: S({ Odpor: 1, Pohoršenie: 1, Povera: 1 }, [0], { 2: ["Odpor"], 1: any("Pohoršenie", "Povera"), 3: any("Pohoršenie", "Povera") }), pozn: "výnimka · 2× Odpor (= Posilnenie) Ľ2 a P2, Vízia → Odpor" },
  veteran: { left: S({ Poldeci: 1, PoškodeniePečene: 1 }, [3], { 1: ["PoškodeniePečene"], 0: ["Poldeci"], 2: ["Poldeci"] }), right: S({ Odpor: 1, Pecka: 1 }, [3], { 1: ["Odpor"], 0: ["Pecka"], 2: ["Pecka"] }), pozn: "obranný · Odpor P1, Pečeň Ľ1" },
  recidivista: { left: S({ Dlh: 2, Odpor: 1 }, [3], { 0: ["Dlh"], 1: ["Dlh"], 2: ["Odpor"] }), right: S({ Petelica: 1, Rana: 1 }, [0, 1]), pozn: "vzbúrenec · Odpor Ľ2, Hazardy Ľ0–1" },
  zivnostnik: { left: S({ Dlh: 1, Odpor: 1, Pakt: 1, Robota: 1 }, [], { 0: ["Dlh"], 1: ["Odpor"], 2: any("Pakt", "Robota"), 3: any("Pakt", "Robota") }), right: S({ Cigareta: 2, PoškodeniePečene: 1 }, [0], { 1: ["PoškodeniePečene"], 2: ["Cigareta"], 3: ["Cigareta"] }), pozn: "obranný · Odpor Ľ1, Pečeň P1" },
  kocovnik: { left: S({ Dlh: 1, Odpor: 1, PoškodeniePečene: 1 }, [3], { 0: any("Dlh", "PoškodeniePečene"), 1: any("Dlh", "PoškodeniePečene"), 2: ["Odpor"] }), right: S({ Cigareta: 1, Pecka: 1, Pakt: 1 }, [1], { 2: ["Pakt"], 0: any("Cigareta", "Pecka"), 3: any("Cigareta", "Pecka") }), pozn: "vzbúrenec · Odpor Ľ2, zlé Ľ0–1, Pakt P2" },
  anonymny_alkoholik: { left: S({ Odpor: 1, Robota: 1 }, [0], { 1: ["Odpor"], 2: ["Robota"], 3: ["Robota"] }), right: S({ Dlh: 1, Viera: 1 }, [0, 3], { 1: ["Dlh"], 2: ["Viera"] }), pozn: "obranný · Odpor Ľ1, Hazard P1" },
  dvojcata: { left: S({ Dlh: 1, Odpor: 1, Pecka: 1 }, [3], { 0: ["Dlh"], 1: ["Odpor"], 2: ["Pecka"] }), right: S({ PoškodeniePečene: 1, Rana: 1 }, [0], { 1: ["PoškodeniePečene"], 2: ["Rana"], 3: ["Rana"] }), pozn: "obranné · Odpor Ľ1, Pečeň P1" },
  sofer: { right: S({ Cigareta: 1, Odpor: 1, PoškodeniePečene: 1 }, [3], { 0: ["PoškodeniePečene"], 1: ["Odpor"], 2: ["Cigareta"] }), pozn: "obranný · Odpor P1 (ako dnes), Pečeň P0" },
  krokodil: { left: S({ Odpor: 1 }, [0, 2, 3]), pozn: "obranný · Odpor Ľ1" },
  vandal: { left: S({ Pecka: 1, PoškodeniePečene: 1 }, [2, 3], { 0: ["Pecka"], 1: ["PoškodeniePečene"] }), right: S({ Odpor: 1, Rana: 1 }, [2], { 1: ["Odpor"], 0: ["Rana"], 3: ["Rana"] }), pozn: "obranný · Odpor P1, Pečeň Ľ1" },
  // Posilnenie do slotu 2
  hasic: { left: S({ Posilnenie: 1 }, [0, 1, 3]), pozn: "Posilnenie Ľ2" },
  kon: { left: S({ Posilnenie: 1 }, [0, 1, 3]), pozn: "Posilnenie Ľ2" },
  dohadzovacka: { right: S({ Dlh: 1, Posilnenie: 1 }, [0, 3], { 1: ["Dlh"], 2: ["Posilnenie"] }), pozn: "Hazard P1, Posilnenie P2" },
  profesionalny_tiper: { left: S({ Dlh: 1, Posilnenie: 1 }, [0, 3], { 1: ["Dlh"], 2: ["Posilnenie"] }), pozn: "Hazard Ľ1, Posilnenie Ľ2" },
  opatrovatelka: { right: S({ Posilnenie: 1, Viera: 1 }, [0, 1], { 2: ["Posilnenie"], 3: ["Viera"] }), pozn: "Posilnenie P2" },
  // Nástroje: Odpor v slote 1 na oboch stranách, Posilnenie v slote 2
  nealko: { left: S({ Pohoršenie: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Pohoršenie"], 2: ["Pohoršenie"], 3: ["Pohoršenie"] }), right: S({ Pohoršenie: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Pohoršenie"], 2: ["Pohoršenie"], 3: ["Pohoršenie"] }), pozn: "Odpor Ľ1 a P1, Pohoršenie voľne" },
  boxer: { left: S({ Pecka: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Pecka"], 2: ["Pecka"], 3: ["Pecka"] }), right: S({ Pecka: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Pecka"], 2: ["Pecka"], 3: ["Pecka"] }), pozn: "Odpor Ľ1 a P1, Pecka voľne" },
  hrable: { left: S({ Odpor: 2 }, [2, 3]), right: S({ Odpor: 1, Robota: 1 }, [], { 1: ["Odpor"], 0: ["Robota"], 2: ["Robota"], 3: ["Robota"] }), pozn: "Odpor Ľ0, Ľ1, P1, Robota voľne" },
  pasca: { left: S({ Obmedzenie: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Obmedzenie"], 2: ["Obmedzenie"], 3: ["Obmedzenie"] }), right: S({ Obmedzenie: 1, Odpor: 1 }, [], { 1: ["Odpor"], 0: ["Obmedzenie"], 2: ["Obmedzenie"], 3: ["Obmedzenie"] }), pozn: "Odpor Ľ1 a P1 (zloženie ako dnes)" },
  vinko: { left: S({ Poldeci: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Poldeci"], 1: ["Poldeci"], 3: ["Poldeci"] }), right: S({ Poldeci: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Poldeci"], 1: ["Poldeci"], 3: ["Poldeci"] }), pozn: "Posilnenie Ľ2 a P2" },
  lievik: { left: S({ Poldeci: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Poldeci"], 1: ["Poldeci"], 3: ["Poldeci"] }), right: S({ Poldeci: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Poldeci"], 1: ["Poldeci"], 3: ["Poldeci"] }), pozn: "Posilnenie Ľ2 a P2" },
  zapalovac: { left: S({ Cigareta: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Cigareta"], 1: ["Cigareta"], 3: ["Cigareta"] }), right: S({ Cigareta: 1, Posilnenie: 1 }, [], { 2: ["Posilnenie"], 0: ["Cigareta"], 1: ["Cigareta"], 3: ["Cigareta"] }), pozn: "Posilnenie Ľ2 a P2" },
  energetak: { left: S({ Posilnenie: 1 }, [0, 1, 3]), right: S({ Posilnenie: 1, PoškodeniePečene: 1 }, [0, 3], { 1: ["PoškodeniePečene"], 2: ["Posilnenie"] }), pozn: "Posilnenie Ľ2 a P2, Pečeň P1" },
  jogurt: { left: S({ PoškodeniePečene: 2 }, [2, 3]), right: S({ PoškodeniePečene: 1, Poldeci: 1 }, [0, 3], { 1: ["PoškodeniePečene"], 2: ["Poldeci"] }), pozn: "Pečeň Ľ0, Ľ1, P1" },
  vyherne_zreby: { left: S({ Dlh: 2 }, [2, 3]), right: S({ Dlh: 1, Robota: 1 }, [0, 3], { 1: ["Dlh"], 2: ["Robota"] }), pozn: "Hazard Ľ0, Ľ1, P1" },
};

// Návrh A „Všetko hore“: ako B, ale aj vzbúrenci a Praudovravec majú Odpor v slote 1.
const NAVRH_A: Record<string, Zmena> = {
  ...NAVRH_B,
  recidivista: { ...NAVRH_B.recidivista!, left: S({ Dlh: 2, Odpor: 1 }, [3], { 0: ["Dlh"], 1: ["Odpor"], 2: ["Dlh"] }) },
  kocovnik: { ...NAVRH_B.kocovnik!, left: S({ Dlh: 1, Odpor: 1, PoškodeniePečene: 1 }, [3], { 1: ["Odpor"], 0: any("Dlh", "PoškodeniePečene"), 2: any("Dlh", "PoškodeniePečene") }) },
  praudovravec: { left: S({ Odpor: 1, Povera: 1, Viera: 1 }, [3], { 1: ["Odpor"], 0: any("Povera", "Viera"), 2: any("Povera", "Viera") }), pozn: "1× Odpor Ľ1" },
};

// Návrh C „Len Odpory“: pozície Odporu z B, nič iné sa nehýbe (najlacnejšie).
const IBA_ODPORY = ["milujuca_manzelka", "praudovravec", "veteran", "recidivista", "zivnostnik", "kocovnik", "anonymny_alkoholik", "dvojcata", "sofer", "krokodil", "vandal", "nealko", "boxer", "hrable", "pasca"];

function aplikuj(base: Map<string, Card>, navrh: Record<string, Zmena>, ids?: string[]): Map<string, Card> {
  const m = new Map<string, Card>();
  for (const [id, c] of base) m.set(id, structuredClone(c));
  for (const [id, z] of Object.entries(navrh)) {
    if (ids && !ids.includes(id)) continue;
    const c = m.get(id)!;
    if (z.left) c.left = structuredClone(z.left);
    if (z.right) c.right = structuredClone(z.right);
  }
  return m;
}

const jeNastroj = (c: Card): boolean => c.tags.includes("Nástroj");
const jeHrac = (c: Card): boolean => !c.tags.includes("Starešina") && (c.tags.includes("Občan") || c.tags.includes("Zviera") || jeNastroj(c));
const jeObcan = (c: Card): boolean => jeHrac(c) && !jeNastroj(c);
const maOdpor = (c: Card): boolean => (c.left.actions.Odpor ?? 0) + (c.right.actions.Odpor ?? 0) > 0;
const layouts = (s: Side): SideLayout[] => [...sideLayouts(s as unknown as SideDef)];

// B+: celá sada — strana so zlou akciou: slot 1 len zlá (alebo prázdny), slot 2 nikdy zlá.
// B++ (bezDobrejVJednotke): aj strana bez zlej akcie nechá slot 1 prázdny, ak má voľné miesto.
function bPlus(m: Map<string, Card>, skip: Set<string>, bezDobrejVJednotke = false, makke = false): { m: Map<string, Card>; zmenene: string[] } {
  const out = new Map<string, Card>();
  const zmenene: string[] = [];
  for (const [id, c0] of m) {
    const c = structuredClone(c0);
    out.set(id, c);
    if (skip.has(id) || !jeObcan(c)) continue;
    let zmena = false;
    for (const key of ["left", "right"] as const) {
      const s = c[key];
      const akcie = Object.keys(s.actions).filter((a) => (s.actions[a] ?? 0) > 0);
      const pred = JSON.stringify(layouts(s));
      if (!akcie.some((a) => ZLE.has(a))) {
        if (!bezDobrejVJednotke || s.blocked.includes(1) || s.allowed?.[1]) continue;
        const n: Side = { ...s, allowed: { ...(s.allowed ?? {}), 1: ["__nic__"] } };
        const ls = layouts(n);
        if (ls.length > 0) { if (JSON.stringify(ls) !== pred) zmena = true; c[key] = n; }
        continue;
      }
      for (const prisne of makke ? [false] : [true, false]) {
        const allowed: Record<string, string[]> = { ...(s.allowed ?? {}) };
        for (const slot of [1, 2]) {
          if (s.blocked.includes(slot)) continue;
          const pov = allowed[slot] ?? akcie;
          const nove = slot === 1 ? (prisne ? pov.filter((a) => ZLE.has(a)) : pov) : pov.filter((a) => !ZLE.has(a));
          allowed[slot] = nove.length > 0 ? nove : ["__nic__"];
        }
        const n: Side = { ...s, allowed };
        const ls = layouts(n);
        if (ls.length > 0) {
          if (JSON.stringify(ls) !== pred) zmena = true;
          c[key] = n;
          break;
        }
      }
    }
    if (zmena) zmenene.push(id);
  }
  return { m: out, zmenene };
}

interface V { L: SideLayout[]; R: SideLayout[] }
const varianty = (c: Card): V => ({ L: layouts(c.left), R: layouts(c.right) });

const own = (A: SideLayout, B: SideLayout): Par[] => [0, 1, 2, 3].map((k) => [A[k] ?? null, B[k] ?? null]);
const mir = (A: SideLayout, B: SideLayout): Par[] => [0, 1, 2, 3].map((k) => [A[3 - k] ?? null, B[k] ?? null]);
const priemer = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

interface Tr { zla: number; dobra: number; posil: number; odpor: number; pakt: number; prazdno: number }

function meraj(m: Map<string, Card>) {
  const all = [...m.values()].filter(jeHrac);
  const obcania = all.filter(jeObcan);
  const odporObc = obcania.filter(maOdpor);
  const odporNastr = all.filter((c) => jeNastroj(c) && maOdpor(c));
  const V = new Map(all.map((c) => [c.id, varianty(c)]));
  const prauda = (a: Card, b: Card): boolean => a.id === "praudovravec" || b.id === "praudovravec";
  const maPosil = (c: Card): boolean => (c.left.actions.Posilnenie ?? 0) + (c.right.actions.Posilnenie ?? 0) > 0 || c.id === "praudovravec";
  const vz = (a: Card, b: Card) => (p: Par[]): boolean => !prauda(a, b) && p.some(([x, y]) => x === "Odpor" && y === "Odpor");
  const fo = (a: Card, b: Card) => (p: Par[]): boolean => {
    const q = (x: string | null): boolean => x === "Posilnenie" || (prauda(a, b) && x === "Odpor");
    return p.some(([x, y]) => q(x) && q(y));
  };
  const pPar = (a: Card, b: Card, sa: "L" | "R", sb: "L" | "R", geo: typeof own, test: (p: Par[]) => boolean): number => {
    const va = V.get(a.id)![sa], vb = V.get(b.id)![sb];
    let n = 0, t = 0;
    for (const x of va) for (const y of vb) { n++; if (test(geo(x, y))) t++; }
    return t / n;
  };

  const vlastna: number[] = [], otocena: number[] = [], podstrc: number[] = [], volba: number[] = [];
  for (const a of odporObc) for (const b of odporObc) {
    vlastna.push(pPar(a, b, "R", "L", own, vz(a, b)));
    otocena.push(pPar(a, b, "L", "L", mir, vz(a, b)));
    podstrc.push(pPar(a, b, "R", "R", mir, vz(a, b)));
    const va = V.get(a.id)!, vb = V.get(b.id)!;
    let n = 0, t = 0;
    for (const aL of va.L) for (const aR of va.R) for (const bL of vb.L) for (const bR of vb.R) {
      n++;
      if (vz(a, b)(own(aR, bL)) || vz(a, b)(own(bR, aL))) t++;
    }
    volba.push(t / n);
  }
  const nVlastna: number[] = [], nOtocena: number[] = [];
  for (const t of odporNastr) for (const o of odporObc) {
    nVlastna.push(1 - (1 - pPar(t, o, "R", "L", own, vz(t, o))) * (1 - pPar(o, t, "R", "L", own, vz(o, t))));
    nOtocena.push(pPar(t, o, "L", "L", mir, vz(t, o)));
  }

  const novy = (): Tr => ({ zla: 0, dobra: 0, posil: 0, odpor: 0, pakt: 0, prazdno: 0 });
  const zaznac = (tr: Tr, ciel: string | null, w: number): void => {
    if (ciel == null) tr.prazdno += w; else if (ZLE.has(ciel)) tr.zla += w; else if (ciel === "Posilnenie") tr.posil += w; else if (ciel === "Odpor") tr.odpor += w; else if (ciel === "Pakt") tr.pakt += w; else tr.dobra += w;
  };
  const zasah = (zdroje: Card[]) => {
    const vl = novy(), ot = novy();
    const perCard: Record<string, { vl: Tr; ot: Tr }> = {};
    for (const a of zdroje) {
      if (a.id === "praudovravec") continue;
      const pc = { vl: novy(), ot: novy() };
      for (const b of obcania) {
        const va = V.get(a.id)!, vb = V.get(b.id)!;
        for (const [sa, sb] of [["R", "L"], ["L", "R"]] as const) {
          const w = 1 / (va[sa].length * vb[sb].length * obcania.length);
          for (const x of va[sa]) for (const y of vb[sb]) for (let k = 0; k < 4; k++) if (x[k] === "Odpor") { zaznac(vl, y[k] ?? null, w); zaznac(pc.vl, y[k] ?? null, w); }
        }
        for (const s of ["L", "R"] as const) {
          const w = 1 / (va[s].length * vb[s].length * obcania.length);
          for (const x of va[s]) for (const y of vb[s]) for (let k = 0; k < 4; k++) if (x[k] === "Odpor") { zaznac(ot, y[3 - k] ?? null, w); zaznac(pc.ot, y[3 - k] ?? null, w); }
        }
      }
      perCard[a.id] = pc;
    }
    return { vl, ot, perCard };
  };
  const pct = (tr: Tr) => {
    const s = tr.zla + tr.dobra + tr.posil + tr.odpor + tr.pakt;
    return { zla: tr.zla / s, dobra: tr.dobra / s, posil: tr.posil / s, odpor: tr.odpor / s, pakt: tr.pakt / s, prazdno: tr.prazdno / (s + tr.prazdno) };
  };
  const zO = zasah(odporObc), zN = zasah(odporNastr);
  const zObr = zasah(odporObc.filter((c) => OBRANNE.includes(c.id))), zVzb = zasah(odporObc.filter((c) => VZBURENCI.includes(c.id)));
  const perCard: Record<string, unknown> = {};
  for (const [id, pc] of Object.entries({ ...zO.perCard, ...zN.perCard })) perCard[id] = { vl: pct(pc.vl), ot: pct(pc.ot) };

  const posil = obcania.filter(maPosil);
  const fVl: number[] = [], fOt: number[] = [];
  for (const a of posil) for (const b of posil) { fVl.push(pPar(a, b, "R", "L", own, fo(a, b))); fOt.push(pPar(a, b, "L", "L", mir, fo(a, b))); }

  const riadky = { zla: [0, 0, 0, 0], dobra: [0, 0, 0, 0] };
  for (const c of obcania) for (const s of ["L", "R"] as const) {
    const ls = V.get(c.id)![s];
    for (const l of ls) for (let k = 0; k < 4; k++) {
      const x = l[k];
      if (x == null || MOD.has(x)) continue;
      (ZLE.has(x) ? riadky.zla : riadky.dobra)[k]! += 1 / ls.length;
    }
  }

  return {
    pocty: { odporObcania: odporObc.length, odporNastroje: odporNastr.length, obcania: obcania.length, posilnenie: posil.length },
    vzbura: { vlastna: priemer(vlastna), vlastnaSVolbou: priemer(volba), otocena: priemer(otocena), kPodstrcenej: priemer(podstrc), nastrojVlastna: priemer(nVlastna), nastrojOtocena: priemer(nOtocena) },
    forsaz: { vlastna: priemer(fVl), otocena: priemer(fOt) },
    zasahObcania: { vlastna: pct(zO.vl), otocena: pct(zO.ot) },
    zasahNastroje: { vlastna: pct(zN.vl), otocena: pct(zN.ot) },
    zasahObranne: { vlastna: pct(zObr.vl), otocena: pct(zObr.ot) },
    zasahVzburenci: { vlastna: pct(zVzb.vl), otocena: pct(zVzb.ot) },
    riadky,
    perCard,
  };
}

const DNES = novyStav();
const B = aplikuj(DNES, NAVRH_B);
const A = aplikuj(DNES, NAVRH_A);
const C = aplikuj(DNES, NAVRH_B, IBA_ODPORY);
const bp = bPlus(B, new Set(Object.keys(NAVRH_B)));
const bpp = bPlus(B, new Set(Object.keys(NAVRH_B)), true);
const bm = bPlus(B, new Set(Object.keys(NAVRH_B)), false, true);
// Citlivosť: Vandal ako tretí vzbúrenec (Odpor P2), k tomu Krokodíl ako štvrtý (Odpor Ľ2), oba s B+.
const B3v = bPlus(aplikuj(DNES, { ...NAVRH_B, vandal: { ...NAVRH_B.vandal!, right: S({ Odpor: 1, Rana: 1 }, [1], { 2: ["Odpor"], 0: ["Rana"], 3: ["Rana"] }), pozn: "" } }), new Set(Object.keys(NAVRH_B))).m;
const B4v = bPlus(aplikuj(DNES, { ...NAVRH_B, vandal: { ...NAVRH_B.vandal!, right: S({ Odpor: 1, Rana: 1 }, [1], { 2: ["Odpor"], 0: ["Rana"], 3: ["Rana"] }), pozn: "" }, krokodil: { left: S({ Odpor: 1 }, [0, 1, 3]), pozn: "" } }), new Set(Object.keys(NAVRH_B))).m;

const vyber = (m: Map<string, Card>, ids: string[]) => Object.fromEntries(ids.map((id) => {
  const c = m.get(id)!;
  const v = varianty(c);
  return [id, { name: c.name, tags: c.tags, effect: c.effect_text ?? "", L: v.L, R: v.R }];
}));
const ukazkove = [...DNES.values()].filter(jeHrac).map((c) => c.id);

const varPocet = (m: Map<string, Card>, id: string): number => { const v = varianty(m.get(id)!); return v.L.length * v.R.length; };
const tabulka = Object.keys(NAVRH_B).map((id) => ({ id, name: B.get(id)!.name, dnes: varPocet(DNES, id), navrh: varPocet(B, id), pozn: NAVRH_B[id]!.pozn }));
const bPlusTab = bp.zmenene.map((id) => ({ id, name: B.get(id)!.name, pred: varPocet(B, id), po: varPocet(bp.m, id) }));

const vysledok = {
  meranie: { dnes: meraj(DNES), A: meraj(A), B: meraj(B), Bplus: meraj(bp.m), Bpp: meraj(bpp.m), Bmakke: meraj(bm.m), B3v: meraj(B3v), B4v: meraj(B4v), C: meraj(C) },
  bppPocet: bpp.zmenene.length,
  bMakkeTab: bm.zmenene.map((id) => ({ id, name: B.get(id)!.name, pred: varPocet(B, id), po: varPocet(bm.m, id) })),
  tabulka,
  bPlusTab,
  karty: { dnes: vyber(DNES, ukazkove), navrh: vyber(bp.m, ukazkove) },
};
const json = JSON.stringify({ ...vysledok, obranne: OBRANNE, vzburenci: VZBURENCI });
// Vloží dáta do HTML medzi značky (ak HTML existuje).
const html = new URL("../odpor-vzbura-poc.html", import.meta.url);
try {
  const t = readFileSync(html, "utf8");
  const z = '<script id="data" type="application/json">';
  const i = t.indexOf(z), j = t.indexOf("</script>", i);
  if (i >= 0 && j > i) writeFileSync(html, t.slice(0, i + z.length) + json.replaceAll("</", "<\\/") + t.slice(j));
} catch { /* HTML ešte nie je */ }

const r = (x: number): string => (100 * x).toFixed(1) + " %";
for (const [k, v] of Object.entries(vysledok.meranie)) {
  console.log(`== ${k}`, JSON.stringify(v.pocty));
  console.log("  Vzbura vlastná", r(v.vzbura.vlastna), "s voľbou", r(v.vzbura.vlastnaSVolbou), "otočená", r(v.vzbura.otocena), "k podstrčenej", r(v.vzbura.kPodstrcenej), "| nástroj vl", r(v.vzbura.nastrojVlastna), "ot", r(v.vzbura.nastrojOtocena));
  console.log("  Forsáž vlastná", r(v.forsaz.vlastna), "otočená", r(v.forsaz.otocena));
  const f = (n: string, z: { vlastna: Record<string, number>; otocena: Record<string, number> }): void =>
    console.log(`  ${n.padEnd(10)} vl: zlá ${r(z.vlastna.zla!)} dobrá ${r(z.vlastna.dobra!)} posil ${r(z.vlastna.posil!)} odpor ${r(z.vlastna.odpor!)} | ot: dobrá ${r(z.otocena.dobra!)} posil ${r(z.otocena.posil!)} pakt ${r(z.otocena.pakt!)} zlá ${r(z.otocena.zla!)} odpor ${r(z.otocena.odpor!)} | prázdno ${r(z.vlastna.prazdno!)}`);
  f("občania", v.zasahObcania); f("obranné", v.zasahObranne); f("vzbúrenci", v.zasahVzburenci); f("nástroje", v.zasahNastroje);
  console.log("  riadky zlé", v.riadky.zla.map((x) => x.toFixed(1)).join(" "), "| dobré", v.riadky.dobra.map((x) => x.toFixed(1)).join(" "));
}
console.log("B+ zmenené:", bPlusTab.length, bPlusTab.map((x) => `${x.name} ${x.pred}→${x.po}`).join(", "));
console.log(tabulka.map((t) => `${t.name} ${t.dnes}→${t.navrh}`).join(", "));
