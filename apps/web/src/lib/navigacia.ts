// Navigácia webu (Michal 2026-10-26, #23 variant A): Hrať prvé a zvýraznené, skupina
// hry a za oddeľovačom vývoj a komunita; správa webu v jednom menu „Správa ▾“ a menu
// účtu bez položiek, ktoré sú inde. Kto čo vidí, rozhoduje tu — Layout len kreslí.
// Práva stráži server; skrytý odkaz len šetrí hráča od stránky, ktorá ho odmietne.

import { jeSpravca, maPravo, type Instancia, type Pouzivatel, type Pravo } from "./ucet.tsx";

export interface PolozkaNavigacie {
  readonly href: string;
  readonly text: string;
  readonly skupina: "hra" | "komunita";
  /** Pri nedostatku miesta ide do „Viac ▾“ najprv položka s najnižšou prioritou; Hrať nikdy. */
  readonly priorita: number;
  /** Hlavná výzva (tlačidlo). */
  readonly hlavna?: boolean;
}

interface Definicia extends PolozkaNavigacie {
  readonly pravo?: Pravo;
}

/**
 * Zrejúca (Michal 2026-11-02) je len hra: komunita, Vývoj, tvorca kariet a Playtest sú vo
 * Vypálenej — odkaz vedie tam (plná adresa; Layout ju kreslí ako obyčajný odkaz).
 */
const VO_VYPALENEJ = new Set(["/novinky", "/vyvoj", "/spatna-vazba", "/playtest", "/admin"]);

const doVypalenej = <T extends { readonly href: string }>(polozky: readonly T[], instancia: Instancia | undefined): T[] =>
  polozky.map((p) => (instancia?.nazov === "zrejuca" && VO_VYPALENEJ.has(p.href) ? { ...p, href: `${instancia.vypalena ?? ""}${p.href}` } : p));

/** Odkaz von zo stránky (do Vypálenej) — nejde cez router. */
export const jeVonkajsi = (href: string): boolean => /^https?:\/\//.test(href);

const NAVIGACIA: readonly Definicia[] = [
  { href: "/hra", text: "Hrať", skupina: "hra", priorita: 99, hlavna: true },
  { href: "/pravidla", text: "Pravidlá", skupina: "hra", priorita: 6 },
  { href: "/karty", text: "Karty", skupina: "hra", priorita: 5 },
  { href: "/rebricek", text: "Rebríček", skupina: "hra", priorita: 4, pravo: "profily_inych" },
  { href: "/novinky", text: "Novinky", skupina: "komunita", priorita: 3 },
  { href: "/vyvoj", text: "Vývoj", skupina: "komunita", priorita: 2, pravo: "vidiet_vyvoj" },
  { href: "/spatna-vazba", text: "Spätná väzba", skupina: "komunita", priorita: 1 },
];

/**
 * Hlavné menu. Neprihlásený má práva Nealka (/api/ja ich pošle aj bez účtu);
 * bez nich (starý server) sa ukáže všetko ako doteraz — server aj tak overí.
 */
export function hlavneMenu(ja: Pouzivatel | null, pravaNavstevnika: readonly Pravo[] | null, instancia?: Instancia): PolozkaNavigacie[] {
  const smie = (p: Pravo): boolean => (ja !== null ? maPravo(ja, p) : pravaNavstevnika === null || pravaNavstevnika.includes(p));
  return doVypalenej(NAVIGACIA.filter((n) => n.pravo === undefined || smie(n.pravo)), instancia);
}

export interface PolozkaSpravy {
  readonly href: string;
  readonly text: string;
  /** Pri Playteste počet návrhov na rozhodnutie. */
  readonly pocet?: "navrhy";
  /** Odkaz do Zrejúcej s prenosom prihlásenia (Layout si vyžiada jednorazový odkaz). */
  readonly prenos?: true;
}

/** Menu „Správa ▾“ — admin aj subadmin vidia všetko (stránky si práva strážia samé). */
export function spravaWebu(ja: Pouzivatel | null, instancia?: Instancia): PolozkaSpravy[] {
  if (ja === null || !jeSpravca(ja.rola)) return [];
  const polozky: PolozkaSpravy[] = [
    { href: "/playtest", text: "Playtest", pocet: "navrhy" },
    { href: "/admin", text: "Tvorba kariet" },
    { href: "/hraci", text: "Hráči" },
  ];
  // Počet návrhov na rozhodnutie pozná Vypálená, nie Zrejúca.
  if (instancia?.nazov === "zrejuca") return doVypalenej(polozky, instancia).map(({ pocet: _, ...p }) => p);
  // Vypálená: správca prejde do pokusnej Zrejúcej tým istým účtom (Michal 2026-11-02).
  const zrejuca = instancia?.zrejuca ?? null;
  return zrejuca === null ? polozky : [...polozky, { href: zrejuca, text: "Zrejúca (pokusná verzia) ↗", prenos: true }];
}

/**
 * Menu účtu: profil, štatistiky a odhlásenie. Rank s právom na reporty playtestov,
 * ktorý nie je správca, tu má Playtest — inde by ho nenašiel.
 */
export function menuUctu(ja: Pouzivatel): { readonly href: string; readonly text: string }[] {
  const polozky = [
    { href: "/profil", text: "Môj profil" },
    { href: `/hrac/${ja.id}`, text: "Moje štatistiky" },
  ];
  if (!jeSpravca(ja.rola) && maPravo(ja, "reporty_playtestov")) polozky.push({ href: "/playtest", text: "Reporty playtestov" });
  return polozky;
}

/** Aktívna položka: presná cesta alebo jej podstránka (/karty/dielna patrí Kartám). */
export const jeAktivna = (cesta: string, href: string): boolean => cesta === href || cesta.startsWith(`${href}/`);
