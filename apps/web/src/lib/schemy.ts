// Farebné schémy webu (Michal 2026-10-21) — zoznam pre výber v profile. Farby sú
// v schemy.css pod :root[data-schema="id"]; náhľad tu musí sedieť s nimi. Názov a popis sú
// gettery na sk.json (schema.<id>.*) — čítajú sa v jazyku hráča.

import { t } from "../i18n/jazyk.tsx";

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
    get nazov() {
      return t("schema.krcma.nazov");
    },
    get popis() {
      return t("schema.krcma.popis");
    },
    wada: "Vandyke Brown · Cinnamon Buff · Brick Red",
    tmava: true,
    nahlad: ["#14110e", "#1e1914", "#e9ad45", "#f1e8d8"],
  },
  {
    id: "noc",
    get nazov() {
      return t("schema.noc.nazov");
    },
    get popis() {
      return t("schema.noc.popis");
    },
    wada: "Indigo Blue · Cinnamon Buff",
    tmava: true,
    nahlad: ["#0d1219", "#121a26", "#efc179", "#f0e8da"],
  },
  {
    id: "vino",
    get nazov() {
      return t("schema.vino.nazov");
    },
    get popis() {
      return t("schema.vino.popis");
    },
    wada: "Vistoris Lake · Light Pinkish Cinnamon",
    tmava: true,
    nahlad: ["#190e10", "#271418", "#f0c690", "#f4e6db"],
  },
  {
    id: "tabak",
    get nazov() {
      return t("schema.tabak.nazov");
    },
    get popis() {
      return t("schema.tabak.popis");
    },
    wada: "Deep Grayish Olive · Olive Buff",
    tmava: true,
    nahlad: ["#12120a", "#1a1b0e", "#dcc66e", "#ede9da"],
  },
  {
    id: "bridlica",
    get nazov() {
      return t("schema.bridlica.nazov");
    },
    get popis() {
      return t("schema.bridlica.popis");
    },
    wada: "Slate Color · Naples Yellow",
    tmava: true,
    nahlad: ["#0c1317", "#101c22", "#efd27c", "#eee9da"],
  },
  {
    id: "slivovica",
    get nazov() {
      return t("schema.slivovica.nazov");
    },
    get popis() {
      return t("schema.slivovica.popis");
    },
    wada: "Dark Vinaceous · Pale Lemon Yellow",
    tmava: true,
    nahlad: ["#170e15", "#23151f", "#e9d78e", "#f1e8da"],
  },
  {
    id: "levandula",
    get nazov() {
      return t("schema.levandula.nazov");
    },
    get popis() {
      return t("schema.levandula.popis");
    },
    wada: "Dusky Slate Violet · Light Lavender",
    tmava: true,
    nahlad: ["#121017", "#1b1823", "#cbb9ea", "#ebe6f6"],
  },
  {
    id: "dym",
    get nazov() {
      return t("schema.dym.nazov");
    },
    get popis() {
      return t("schema.dym.popis");
    },
    wada: "Neutral Gray · Pale Orange Yellow",
    tmava: true,
    nahlad: ["#121110", "#1b1a18", "#f2c46e", "#f1e8da"],
  },
  {
    id: "listok",
    get nazov() {
      return t("schema.listok.nazov");
    },
    get popis() {
      return t("schema.listok.popis");
    },
    wada: "Ivory Buff · Sepia · Yellow Ocher",
    tmava: false,
    nahlad: ["#f5ecd9", "#fef9ee", "#723f00", "#312317"],
  },
  {
    id: "lan",
    get nazov() {
      return t("schema.lan.nazov");
    },
    get popis() {
      return t("schema.lan.popis");
    },
    wada: "Pale Gull Gray · Dark Slate · Vinaceous",
    tmava: false,
    nahlad: ["#e7eef4", "#f6f9fd", "#70335f", "#22272d"],
  },
  // Michal 2026-10-23: zemité a krémové schémy, príjemné pre oči — bez jasnej bielej.
  {
    id: "salvia",
    get nazov() {
      return t("schema.salvia.nazov");
    },
    get popis() {
      return t("schema.salvia.popis");
    },
    wada: "Sage Green · Olive Buff · Ochraceous Salmon",
    tmava: false,
    nahlad: ["#e6e4d2", "#efede0", "#7a2b00", "#272a1f"],
  },
  {
    id: "olivovnik",
    get nazov() {
      return t("schema.olivovnik.nazov");
    },
    get popis() {
      return t("schema.olivovnik.popis");
    },
    wada: "Olive Buff · Olive Green · Cream Color",
    tmava: false,
    nahlad: ["#eee6cf", "#f5eedb", "#424b00", "#2d2716"],
  },
  {
    id: "modrotlac",
    get nazov() {
      return t("schema.modrotlac.nazov");
    },
    get popis() {
      return t("schema.modrotlac.popis");
    },
    wada: "Dull Blue Violet · Cream Buff · Yellow Ocher",
    tmava: false,
    nahlad: ["#ebe4d3", "#f3eee1", "#2d466a", "#212634"],
  },
  {
    id: "terakota",
    get nazov() {
      return t("schema.terakota.nazov");
    },
    get popis() {
      return t("schema.terakota.popis");
    },
    wada: "Hays Russet · Sage Green · Ochraceous Buff",
    tmava: true,
    nahlad: ["#1a110d", "#251812", "#b4c38f", "#f0e6d6"],
  },
  // Michal 2026-10-23: 14 tmavých a 14 svetlých schém — v profile v dvoch skupinách.
  {
    id: "les",
    get nazov() {
      return t("schema.les.nazov");
    },
    get popis() {
      return t("schema.les.popis");
    },
    wada: "Night Green · Sulphur Yellow",
    tmava: true,
    nahlad: ["#04120a", "#061b10", "#e0cb62", "#f2ebd5"],
  },
  {
    id: "mlyn",
    get nazov() {
      return t("schema.mlyn.nazov");
    },
    get popis() {
      return t("schema.mlyn.popis");
    },
    wada: "Venice Green · Pale Lemon Yellow",
    tmava: true,
    nahlad: ["#001211", "#011b19", "#d8cc84", "#e7eee5"],
  },
  {
    id: "sumrak",
    get nazov() {
      return t("schema.sumrak.nazov");
    },
    get popis() {
      return t("schema.sumrak.popis");
    },
    wada: "Dark Medici Blue · Coral Pink",
    tmava: true,
    nahlad: ["#040f1a", "#071725", "#f2a28c", "#f1e9e4"],
  },
  {
    id: "cucoriedky",
    get nazov() {
      return t("schema.cucoriedky.nazov");
    },
    get popis() {
      return t("schema.cucoriedky.popis");
    },
    wada: "Dark Tyrian Blue · Light Mauve",
    tmava: true,
    nahlad: ["#0a0d1a", "#101526", "#d9b3dc", "#eee8f2"],
  },
  {
    id: "kovac",
    get nazov() {
      return t("schema.kovac.nazov");
    },
    get popis() {
      return t("schema.kovac.popis");
    },
    wada: "Blackish Slate · Mars Orange",
    tmava: true,
    nahlad: ["#0a0f12", "#11171b", "#fd9c61", "#f0eae3"],
  },
  {
    id: "marhula",
    get nazov() {
      return t("schema.marhula.nazov");
    },
    get popis() {
      return t("schema.marhula.popis");
    },
    wada: "Apricot Yellow · Peach Red",
    tmava: false,
    nahlad: ["#f7e8cc", "#fcf1dc", "#92371a", "#322317"],
  },
  {
    id: "fialka",
    get nazov() {
      return t("schema.fialka.nazov");
    },
    get popis() {
      return t("schema.fialka.popis");
    },
    wada: "Grayish Lavender · Hydrangea Red",
    tmava: false,
    nahlad: ["#eee6f7", "#f6effc", "#7a2f5d", "#2a2331"],
  },
  {
    id: "mata",
    get nazov() {
      return t("schema.mata.nazov");
    },
    get popis() {
      return t("schema.mata.popis");
    },
    wada: "Ecru · Cobalt Green",
    tmava: false,
    nahlad: ["#e5edd5", "#eff5e3", "#266342", "#1f2a1a"],
  },
  {
    id: "ruza",
    get nazov() {
      return t("schema.ruza.nazov");
    },
    get popis() {
      return t("schema.ruza.popis");
    },
    wada: "Cameo Pink · Old Rose",
    tmava: false,
    nahlad: ["#fbe4df", "#feeeeb", "#8b3a44", "#312128"],
  },
  {
    id: "piesok",
    get nazov() {
      return t("schema.piesok.nazov");
    },
    get popis() {
      return t("schema.piesok.popis");
    },
    wada: "Isabella Color · Burnt Sienna",
    tmava: false,
    nahlad: ["#f5e9cc", "#fbf2dc", "#8a3d1d", "#2e2419"],
  },
  {
    id: "pena",
    get nazov() {
      return t("schema.pena.nazov");
    },
    get popis() {
      return t("schema.pena.popis");
    },
    wada: "Pale Blue · Peacock Blue",
    tmava: false,
    nahlad: ["#ddedee", "#e9f5f5", "#1f5f78", "#1d282e"],
  },
  {
    id: "kava",
    get nazov() {
      return t("schema.kava.nazov");
    },
    get popis() {
      return t("schema.kava.popis");
    },
    wada: "Fawn · Vandyke Brown",
    tmava: false,
    nahlad: ["#f7e7d3", "#fdf0e2", "#5a3a26", "#2f241d"],
  },
  {
    id: "jesen",
    get nazov() {
      return t("schema.jesen.nazov");
    },
    get popis() {
      return t("schema.jesen.popis");
    },
    wada: "Ecru · Pompeian Red",
    tmava: false,
    nahlad: ["#f3e9cf", "#faf2de", "#93332e", "#2f2420"],
  },
  {
    id: "slnecnica",
    get nazov() {
      return t("schema.slnecnica.nazov");
    },
    get popis() {
      return t("schema.slnecnica.popis");
    },
    wada: "Pale Lemon Yellow · Dark Slate",
    tmava: false,
    nahlad: ["#f0ebcc", "#f7f3dd", "#33506a", "#21272e"],
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
