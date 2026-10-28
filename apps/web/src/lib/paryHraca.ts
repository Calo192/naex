// Pár farieb hráča v partii (Michal 2026-10-27, dizajn farba-hraca-20261027): moja farba
// a farba, v ktorej vidím súpera. Súper moju voľbu nevidí — je to nastavenie prehliadača
// a účtu ako schéma. Tóny sú v schemy.css (--par-<id>-1/2), voľbu nesie <html data-par
// data-prehod>; pred prvým vykreslením ju nastaví public/schema.js.

export interface ParHraca {
  readonly id: string;
  readonly nazov: string;
  /** Slovné mená farieb (1. a 2. tón) — pre čítačku a popis vybraného páru. */
  readonly farby: readonly [string, string];
}

export const PAR_PREDVOLENY = "w20";

/** Poradie podľa návrhu: od seba najvzdialenejšie páry, predvolený prvý. */
export const PARY: readonly ParHraca[] = [
  { id: "w20", nazov: "Sifón a malinovka", farby: ["tyrkysová", "ružová"] },
  { id: "w9", nazov: "Levanduľa a slivovica", farby: ["levanduľová", "purpurová"] },
  { id: "w67", nazov: "Nebo a modrotlač", farby: ["nebeská modrá", "kráľovská modrá"] },
  { id: "w106", nazov: "Azúr a čučoriedky", farby: ["azúrová", "fialová"] },
  { id: "w287", nazov: "Sóda a borovička", farby: ["bledomodrá", "tmavý tyrkys"] },
];

export interface VolbaParu {
  readonly par: string;
  /** ⇄ — moja farba je druhý tón páru, súperova prvý. */
  readonly prehod: boolean;
}

const KLUC_PAR = "naex-par";
const KLUC_PREHOD = "naex-prehod";
const PRIPONA_PREHOD = "-prehod";

function platnyPar(id: string | null | undefined): string {
  return PARY.some((p) => p.id === id) ? (id as string) : PAR_PREDVOLENY;
}

/** Voľba z účtu ("w20", "w20-prehod"); neznámy pár = predvolený. */
export function volbaZUctu(ulozene: string): VolbaParu {
  const prehod = ulozene.endsWith(PRIPONA_PREHOD);
  return { par: platnyPar(prehod ? ulozene.slice(0, -PRIPONA_PREHOD.length) : ulozene), prehod };
}

/** Tvar pre účet — jeden stĺpec na serveri. */
export function volbaDoUctu(v: VolbaParu): string {
  return v.par + (v.prehod ? PRIPONA_PREHOD : "");
}

/** Moja a súperova farba ako CSS premenné (náhľad páru v profile). */
export function tonyParu(id: string, prehod: boolean): { readonly ja: string; readonly su: string } {
  const [a, b] = prehod ? [2, 1] : [1, 2];
  return { ja: `var(--par-${id}-${a})`, su: `var(--par-${id}-${b})` };
}

/** Popis pre čítačku a riadok pod výberom: „ty tyrkysová, súper ružová“. */
export function popisParu(p: ParHraca, prehod: boolean): string {
  const [ja, su] = prehod ? [p.farby[1], p.farby[0]] : p.farby;
  return `ty ${ja}, súper ${su}`;
}

/** Aktuálna voľba na stránke (nastavuje ju public/schema.js a pouziPar). */
export function aktualnyPar(): VolbaParu {
  const koren = document.documentElement;
  return { par: platnyPar(koren.getAttribute("data-par")), prehod: koren.hasAttribute("data-prehod") };
}

/** Prefarbí web hneď a zapamätá si voľbu v prehliadači (pre ďalšie načítanie bez bliknutia). */
export function pouziPar(v: VolbaParu): void {
  const koren = document.documentElement;
  const par = platnyPar(v.par);
  koren.setAttribute("data-par", par);
  if (v.prehod) koren.setAttribute("data-prehod", "");
  else koren.removeAttribute("data-prehod");
  try {
    localStorage.setItem(KLUC_PAR, par);
    localStorage.setItem(KLUC_PREHOD, v.prehod ? "1" : "0");
  } catch {
    // Súkromné okno — pár platí do zatvorenia stránky.
  }
}
