// Farebné schémy webu (Michal 2026-10-21) — zoznam pre výber v profile. Farby sú
// v schemy.css pod :root[data-schema="id"]; náhľad tu musí sedieť s nimi.

export interface Schema {
  readonly id: string;
  readonly nazov: string;
  readonly popis: string;
  /** Farby z Wadovho slovníka, z ktorých schéma vychádza. */
  readonly wada: string;
  readonly tmava: boolean;
  /** Náhľad: pozadie, plocha, akcent, text. */
  readonly nahlad: readonly [string, string, string, string];
}

export const SCHEMA_PREDVOLENA = "krcma";

export const SCHEMY: readonly Schema[] = [
  {
    id: "krcma",
    nazov: "Krčma",
    popis: "Tmavé drevo, jantárové svetlo, tehlová červená. Predvolená.",
    wada: "Vandyke Brown · Cinnamon Buff · Brick Red",
    tmava: true,
    nahlad: ["#14110e", "#1e1914", "#e9ad45", "#f1e8d8"],
  },
  {
    id: "noc",
    nazov: "Polnoc na dedine",
    popis: "Indigová noc a teplé svetlo lampy za oknom.",
    wada: "Indigo Blue · Cinnamon Buff",
    tmava: true,
    nahlad: ["#0d1219", "#121a26", "#efc179", "#f0e8da"],
  },
  {
    id: "vino",
    nazov: "Vínna pivnica",
    popis: "Tmavé víno a svetlá škoricová.",
    wada: "Vistoris Lake · Light Pinkish Cinnamon",
    tmava: true,
    nahlad: ["#190e10", "#271418", "#f0c690", "#f4e6db"],
  },
  {
    id: "tabak",
    nazov: "Tabak",
    popis: "Olivová tma a suchý tabakový list.",
    wada: "Deep Grayish Olive · Olive Buff",
    tmava: true,
    nahlad: ["#12120a", "#1a1b0e", "#dcc66e", "#ede9da"],
  },
  {
    id: "bridlica",
    nazov: "Bridlica",
    popis: "Chladná sivá bridlica a neapolská žltá.",
    wada: "Slate Color · Naples Yellow",
    tmava: true,
    nahlad: ["#0c1317", "#101c22", "#efd27c", "#eee9da"],
  },
  {
    id: "slivovica",
    nazov: "Slivovica",
    popis: "Slivková tma a bledá citrónová.",
    wada: "Dark Vinaceous · Pale Lemon Yellow",
    tmava: true,
    nahlad: ["#170e15", "#23151f", "#e9d78e", "#f1e8da"],
  },
  {
    id: "levandula",
    nazov: "Levanduľa",
    popis: "Sivofialový súmrak a bledá levanduľa.",
    wada: "Dusky Slate Violet · Light Lavender",
    tmava: true,
    nahlad: ["#121017", "#1b1823", "#cbb9ea", "#ebe6f6"],
  },
  {
    id: "dym",
    nazov: "Dym",
    popis: "Uhoľná sivá a medové svetlo.",
    wada: "Neutral Gray · Pale Orange Yellow",
    tmava: true,
    nahlad: ["#121110", "#1b1a18", "#f2c46e", "#f1e8da"],
  },
  {
    id: "listok",
    nazov: "Jedálny lístok",
    popis: "Svetlá: slonovinový papier, sépia a okrová.",
    wada: "Ivory Buff · Sepia · Yellow Ocher",
    tmava: false,
    nahlad: ["#f5ecd9", "#fef9ee", "#865100", "#312317"],
  },
  {
    id: "lan",
    nazov: "Ľan",
    popis: "Svetlá: chladné plátno, bridlicový text a slivková.",
    wada: "Pale Gull Gray · Dark Slate · Vinaceous",
    tmava: false,
    nahlad: ["#e7eef4", "#f6f9fd", "#7b3d69", "#22272d"],
  },
  // Michal 2026-10-23: zemité a krémové schémy, príjemné pre oči — bez jasnej bielej.
  {
    id: "salvia",
    nazov: "Šalvia",
    popis: "Svetlá: krémová šalvia a pálená terakota.",
    wada: "Sage Green · Olive Buff · Ochraceous Salmon",
    tmava: false,
    nahlad: ["#e6e4d2", "#efede0", "#974522", "#272a1f"],
  },
  {
    id: "olivovnik",
    nazov: "Olivovník",
    popis: "Svetlá: teplý krémový papier, olivová a umbra.",
    wada: "Olive Buff · Olive Green · Cream Color",
    tmava: false,
    nahlad: ["#eee6cf", "#f5eedb", "#56601a", "#2d2716"],
  },
  {
    id: "modrotlac",
    nazov: "Modrotlač",
    popis: "Svetlá: krémové plátno a tlmená indigová.",
    wada: "Dull Blue Violet · Cream Buff · Yellow Ocher",
    tmava: false,
    nahlad: ["#ebe4d3", "#f3eee1", "#3a5479", "#212634"],
  },
  {
    id: "terakota",
    nazov: "Terakota",
    popis: "Tmavá pálená hlina a šalviová zelená.",
    wada: "Hays Russet · Sage Green · Ochraceous Buff",
    tmava: true,
    nahlad: ["#1a110d", "#251812", "#b4c38f", "#f0e6d6"],
  },
];

const KLUC = "naex-schema";


/** Aktuálna schéma na stránke (nastavuje ju public/schema.js a pouziSchemu). */
export function aktualnaSchema(): string {
  const id = document.documentElement.getAttribute("data-schema");
  return SCHEMY.some((s) => s.id === id) ? (id as string) : SCHEMA_PREDVOLENA;
}

/** Prefarbí web hneď a zapamätá si schému v prehliadači (pre ďalšie načítanie bez bliknutia). */
export function pouziSchemu(id: string): void {
  const platna = SCHEMY.some((s) => s.id === id) ? id : SCHEMA_PREDVOLENA;
  document.documentElement.setAttribute("data-schema", platna);
  try {
    localStorage.setItem(KLUC, platna);
  } catch {
    // Súkromné okno — schéma platí do zatvorenia stránky.
  }
}
