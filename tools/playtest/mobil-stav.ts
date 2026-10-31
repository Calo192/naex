// Čisté funkcie playtestu mobilného stola (mobil.ts) — displej, stav partie zo
// záznamu WebSocketu, ciele ťukov a výpis prvkov. Oddelené od prehliadača kvôli testu.

/**
 * Okná telefónu na šírku v CSS px — s lištou prehliadača, nie celý displej (Michal 2026-10-31:
 * Android Chrome na šírku mal ~762×340). 844x350 = iPhone v Safari, 780x300 = malý telefón.
 */
export const DISPLEJE = ["762x340", "800x330", "844x350", "915x380", "780x300"] as const;
export const PREDVOLENY_DISPLEJ = "762x340";
/** Hustota pixelov telefónu — ostré výrezy (príkaz detail) sú v nej. */
export const DPR = 3;
/** User-agent telefónu: Chrome na Androide (headless Chrome je ten istý engine). */
export const UA_TELEFONU = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
/** Najmenší pohodlný cieľ pre prst (Apple HIG 44 pt, Material 48 dp). */
export const MALY_CIEL = 44;
/** Menšie písmo je na telefóne ťažko čitateľné. */
export const MALE_PISMO = 11;
/**
 * Mená agentských účtov playtesterov („<meno> (AI)“, login ai-palec…) — bez čísla na konci,
 * server login ai-…-číslo odmietne (2026-10-31).
 */
export const MENA_TESTEROV = ["Palec", "Ukazovák", "Prsteník"] as const;
/** Ligy v poradí tlačidiel lobby (ALL_DLZKY). */
export const LIGY = ["kratka", "stredna", "dlha"] as const;
export type Liga = (typeof LIGY)[number];

export interface Displej {
  readonly sirka: number;
  readonly vyska: number;
}

/** „844x390“ → rozmer na šírku; telefón na výšku sa zadáva otočením (príkaz otoc). */
export function citajDisplej(s: string | undefined): Displej {
  const m = /^(\d{3,4})[x×](\d{3,4})$/.exec(s ?? PREDVOLENY_DISPLEJ);
  const a = Number(m?.[1]);
  const b = Number(m?.[2]);
  if (m === null || !(a > 0) || !(b > 0)) throw new Error(`Displej „${s ?? ""}“ — zadaj šírka×výška, napr. ${DISPLEJE.join(", ")}.`);
  return { sirka: Math.max(a, b), vyska: Math.min(a, b) };
}

/** Rozmer okna podľa natočenia telefónu. */
export function oknoDispleja(d: Displej, naVysku: boolean): Displej {
  return naVysku ? { sirka: d.vyska, vyska: d.sirka } : d;
}

export function citajLigu(s: string | undefined): Liga {
  const l = LIGY.find((x) => x === (s ?? "kratka"));
  if (l === undefined) throw new Error(`Liga „${s ?? ""}“ — zadaj ${LIGY.join(" | ")} (kratka = Tretia liga, najkratšia partia).`);
  return l;
}

/** Čo strážca prehliadača vyčítal zo správ servera a čo nastavil. */
export interface StavMobilu {
  pripraveny: boolean;
  naVysku: boolean;
  kolo: number | null;
  lokalitCelkom: number | null;
  faza: string | null;
  mozemHrat: boolean;
  /** Čas poslednej správy so stavom partie (príkaz partia čaká na novú). */
  poslednyStav: number | null;
  chyby: { t: number; text: string }[];
  konzola: { t: number; text: string }[];
}

export const PRAZDNY_STAV: StavMobilu = { pripraveny: false, naVysku: false, kolo: null, lokalitCelkom: null, faza: null, mozemHrat: false, poslednyStav: null, chyby: [], konzola: [] };

/** Výrez zo stavu partie (ClientState), ktorý strážca potrebuje — zvyšok správy zahodí. */
export function zapisView(stav: StavMobilu, view: unknown): void {
  if (typeof view !== "object" || view === null) return;
  const v = view as { kolo?: unknown; lokalitCelkom?: unknown; faza?: unknown; mozemHrat?: unknown };
  if (typeof v.kolo === "number") stav.kolo = v.kolo;
  if (typeof v.lokalitCelkom === "number") stav.lokalitCelkom = v.lokalitCelkom;
  if (typeof v.faza === "string") stav.faza = v.faza;
  stav.mozemHrat = v.mozemHrat === true;
}

/** Odohrané kolá: kolo sa zvýši po bitke, koniec partie = všetky lokality aj finále. */
export function odohraneKola(s: Pick<StavMobilu, "kolo" | "lokalitCelkom" | "faza">): number {
  if (s.kolo === null) return 0;
  if (s.faza === "koniec") return (s.lokalitCelkom ?? s.kolo - 1) + 1;
  return s.kolo - 1;
}

const NAZVY_FAZ: Readonly<Record<string, string>> = {
  volbaCiela: "Voľba cieľa",
  draft: "Stavba šenku",
  zhromazdenie: "Zhromaždenie",
  pitka: "Pitka",
  bitka: "Bitka",
  koniec: "Koniec partie",
};

/**
 * Riadky o partii pre playtestera: kolo a fáza (kde nález vznikol), kto je na ťahu
 * (či čakať na bota) a či už je odohraný počet kôl relácie.
 */
export function popisPartie(s: StavMobilu, kola: number): string[] {
  if (s.kolo === null || s.faza === null) return [];
  const finale = s.lokalitCelkom !== null && s.kolo > s.lokalitCelkom;
  const kolo = finale ? "finále" : `kolo ${s.kolo}${s.lokalitCelkom !== null ? ` z ${s.lokalitCelkom} (+ finále)` : ""}`;
  const tah = s.faza === "koniec" ? "" : s.mozemHrat ? " · hráš ty" : " · ťahá súper (počkaj: pockaj 3)";
  const out = [`Partia: ${kolo} · fáza ${NAZVY_FAZ[s.faza] ?? s.faza}${tah}`];
  const odohrane = odohraneKola(s);
  if (odohrane >= kola) {
    out.push(`KONIEC PLAYTESTU: odohral si ${odohrane} ${odohrane === 1 ? "kolo" : "kolá"} (relácia má ${kola}). Pozri ešte obrazovku po kole, dopíš nálezy do naleze.md a skonči.`);
  }
  return out;
}

export interface Prvok {
  readonly c: number;
  readonly druh: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly nedostupne: boolean;
}

/** Cieľ ťuku: číslo prvku z posledného výpisu alebo x,y v CSS px. */
export function bodCiela(a: string | undefined, prvky: readonly Prvok[], prikaz: string): { x: number; y: number } {
  if (a === undefined) throw new Error(`Príkaz ${prikaz} potrebuje cieľ: číslo prvku z posledného výpisu alebo x,y.`);
  const xy = /^(\d+),(\d+)$/.exec(a);
  if (xy !== null) return { x: Number(xy[1]), y: Number(xy[2]) };
  const p = prvky.find((x) => x.c === Number(a));
  if (p === undefined) throw new Error(`Prvok ${a} v poslednom výpise nie je — najprv „pozri“.`);
  return { x: p.x, y: p.y };
}

/** Výrez na ostrú snímku: číslo prvku (s okrajom 12 px) alebo x,y,w,h v CSS px, orezaný na okno. */
export function vyrez(a: string | undefined, prvky: readonly Prvok[], okno: Displej): { x: number; y: number; w: number; h: number } {
  const xywh = /^(\d+),(\d+),(\d+),(\d+)$/.exec(a ?? "");
  let r: { x: number; y: number; w: number; h: number };
  if (xywh !== null) r = { x: Number(xywh[1]), y: Number(xywh[2]), w: Number(xywh[3]), h: Number(xywh[4]) };
  else {
    const p = prvky.find((x) => x.c === Number(a));
    if (p === undefined) throw new Error("detail <číslo prvku | x,y,šírka,výška> — výrez v CSS px.");
    r = { x: p.x - p.w / 2 - 12, y: p.y - p.h / 2 - 12, w: p.w + 24, h: p.h + 24 };
  }
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return { x, y, w: Math.max(1, Math.min(Math.round(r.w), okno.sirka - x)), h: Math.max(1, Math.min(Math.round(r.h), okno.vyska - y)) };
}

/** Riadok výpisu prvku: rozmer v CSS px, aby playtester vedel nahlásiť malý cieľ. */
export function riadokPrvku(p: Prvok): string {
  const maly = p.w < MALY_CIEL || p.h < MALY_CIEL ? ` ⚠ < ${MALY_CIEL} px` : "";
  return `  ${p.c}. [${p.druh}] ${p.text || "(bez textu)"} @ ${p.x},${p.y} · ${p.w}×${p.h}${maly}${p.nedostupne ? " (nedostupné)" : ""}`;
}
