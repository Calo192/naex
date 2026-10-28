// Ikona strachu staršieho (Michal 2026-10-27, dizajn ikony-strachu-20261027, sada 5
// „Výkričníky“): Znepokojenie = !, Strach = !!, Vydesenie = pečiatka s vyrezanými !!!.
// Stupeň nesie počet výkričníkov, farbu hráč, ktorého sa starší bojí (currentColor —
// rodič nastaví var(--ja) / var(--su)). Tvary sú z návrhu (mriežka 24 × 24), prepočítané
// do jednej cesty na tvar: vyrezanie !!! je evenodd namiesto masky, aby sa ikona dala
// vložiť stokrát bez kolízie id a aby ju podtácok achievementu a tlačová ikona bodovania
// (seed/bodovanie/ikony) kreslili z tých istých čísel.
//
// Výkričník je aj znak chyby a je v logu NA EX! — preto stoja všetky tri stupne na
// naklonenej pečiatke (! a !! na jej slabom odtlačku, !!! na plnej), nikdy nie ako
// písmeno „!“ v texte a nikdy v chybovej farbe.

export type StupenStrachu = 1 | 2 | 3;

export interface CestaStrachu {
  readonly d: string;
  readonly evenOdd: boolean;
  /** Odtlačok pečiatky pod ! a !! — kreslí sa priesvitne (PRIESVITNOST_PODKLADU). */
  readonly podklad: boolean;
}

/** Krytie odtlačku pečiatky pod ! a !!, aby výkričník ostal čitateľný aj pri 16 px. */
export const PRIESVITNOST_PODKLADU = 0.22;

/** Pečiatka je v návrhu naklonená o −6° okolo stredu mriežky. */
const NAKLON = (-6 * Math.PI) / 180;

type Bod = readonly [number, number];

const cislo = (n: number): string => String(Math.round(n * 1000) / 1000);

/** Podobnosť: naklonenie okolo (12, 12) a mierka — kružnicové oblúky ostanú kružnicami. */
function zobrazenie(mierka: number, naklon: number): { readonly b: (x: number, y: number) => string; readonly r: (n: number) => string; readonly stred: (x: number, y: number) => Bod } {
  const cos = Math.cos(naklon);
  const sin = Math.sin(naklon);
  const stred = (x: number, y: number): Bod => {
    const dx = x - 12;
    const dy = y - 12;
    return [(12 + dx * cos - dy * sin) * mierka, (12 + dx * sin + dy * cos) * mierka];
  };
  return {
    stred,
    b: (x, y) => stred(x, y).map(cislo).join(" "),
    r: (n) => cislo(n * mierka),
  };
}

type Zobrazenie = ReturnType<typeof zobrazenie>;

/** Výkričník z návrhu (`<g id="vykr">`) posunutý na (x, y) a zväčšený s-krát: klin s okrúhlou bodkou. */
function vykricnik(z: Zobrazenie, x: number, y: number, s: number): string {
  const b = (px: number, py: number): string => z.b(x + s * px, y + s * py);
  const r = z.r(1.2 * s);
  const klin = `M${b(-1.8, 1.2)}A${r} ${r} 0 0 1 ${b(-0.6, 0)}L${b(0.6, 0)}A${r} ${r} 0 0 1 ${b(1.8, 1.2)}L${b(1.1, 11.6)}L${b(-1.1, 11.6)}Z`;
  const [cx, cy] = z.stred(x, y + s * 15.1);
  const rb = 1.85 * s;
  const rr = z.r(rb);
  const priemer = Number(z.r(rb)) * 2;
  const bodka = `M${cislo(cx - priemer / 2)} ${cislo(cy)}a${rr} ${rr} 0 1 0 ${cislo(priemer)} 0a${rr} ${rr} 0 1 0 ${cislo(-priemer)} 0Z`;
  return klin + bodka;
}

/** Zaoblený štvorec pečiatky z návrhu (x, y 1,8; strana 20,4; rx 3). */
function peciatka(z: Zobrazenie): string {
  const b = z.b;
  const r = z.r(3);
  const a = `A${r} ${r} 0 0 1 `;
  return `M${b(4.8, 1.8)}L${b(19.2, 1.8)}${a}${b(22.2, 4.8)}L${b(22.2, 19.2)}${a}${b(19.2, 22.2)}L${b(4.8, 22.2)}${a}${b(1.8, 19.2)}L${b(1.8, 4.8)}${a}${b(4.8, 1.8)}Z`;
}

/** Cesty ikony v mriežke 24 × mierka (24 = ikona na webe, 100/24 = piktogramy akcií a podtácok). */
export function cestyStrachu(stupen: StupenStrachu, mierka = 1): readonly CestaStrachu[] {
  const rovno = zobrazenie(mierka, 0);
  const sikmo = zobrazenie(mierka, NAKLON);
  const podklad: CestaStrachu = { d: peciatka(sikmo), evenOdd: false, podklad: true };
  if (stupen === 1) return [podklad, { d: vykricnik(rovno, 12, 2.6, 1.14), evenOdd: false, podklad: false }];
  if (stupen === 2) return [podklad, { d: vykricnik(rovno, 7.6, 2.8, 1.1) + vykricnik(rovno, 16.4, 2.8, 1.1), evenOdd: false, podklad: false }];
  // Vydesenie: plná pečiatka, tri výkričníky z nej vyrezané (naklonené s ňou).
  const vyrez = [7, 12, 17].map((x) => vykricnik(sikmo, x, 4.4, 0.86)).join("");
  return [{ d: peciatka(sikmo) + vyrez, evenOdd: true, podklad: false }];
}

/** Tri výkričníky pečiatky vydesenia bez rámu (ten kreslí CSS pečiatky na portréte). */
export function cestaVykricnikovPeciatky(): string {
  const rovno = zobrazenie(1, 0);
  return [7, 12, 17].map((x) => vykricnik(rovno, x, 4.4, 0.86)).join("");
}

export const NAZOV_STUPNA: Readonly<Record<StupenStrachu, string>> = { 1: "Znepokojenie", 2: "Strach", 3: "Vydesenie" };

/** Stupeň z úrovne zóny alebo počtu špakov za strach (1–3); 0 a menej = žiadny strach. */
export function stupenStrachu(uroven: number): StupenStrachu | null {
  return uroven <= 0 ? null : uroven >= 3 ? 3 : uroven === 2 ? 2 : 1;
}

/**
 * Samostatné SVG (ikona bodovania v tvorcovi a na scorecarde): biele na čiernom štvorci
 * ako ostatné ikony bodovania (seed/bodovanie/ikony) — tak ich čaká tlač aj podtácok.
 */
export function svgIkonyBodovania(stupen: StupenStrachu): string {
  const cesty = cestyStrachu(stupen)
    .map((c) => `<path d="${c.d}" fill="#fff"${c.evenOdd ? ' fill-rule="evenodd"' : ""}${c.podklad ? ` fill-opacity="${PRIESVITNOST_PODKLADU}"` : ""}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28"><title>${NAZOV_STUPNA[stupen]}</title><rect x="-2" y="-2" width="28" height="28"/>${cesty}</svg>\n`;
}
