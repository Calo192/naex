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
    popis: "Slonovinový papier, sépia a okrová.",
    wada: "Ivory Buff · Sepia · Yellow Ocher",
    tmava: false,
    nahlad: ["#f5ecd9", "#fef9ee", "#723f00", "#312317"],
  },
  {
    id: "lan",
    nazov: "Ľan",
    popis: "Chladné plátno, bridlicový text a slivková.",
    wada: "Pale Gull Gray · Dark Slate · Vinaceous",
    tmava: false,
    nahlad: ["#e7eef4", "#f6f9fd", "#70335f", "#22272d"],
  },
  // Michal 2026-10-23: zemité a krémové schémy, príjemné pre oči — bez jasnej bielej.
  {
    id: "salvia",
    nazov: "Šalvia",
    popis: "Krémová šalvia a pálená terakota.",
    wada: "Sage Green · Olive Buff · Ochraceous Salmon",
    tmava: false,
    nahlad: ["#e6e4d2", "#efede0", "#7a2b00", "#272a1f"],
  },
  {
    id: "olivovnik",
    nazov: "Olivovník",
    popis: "Teplý krémový papier, olivová a umbra.",
    wada: "Olive Buff · Olive Green · Cream Color",
    tmava: false,
    nahlad: ["#eee6cf", "#f5eedb", "#424b00", "#2d2716"],
  },
  {
    id: "modrotlac",
    nazov: "Modrotlač",
    popis: "Krémové plátno a tlmená indigová.",
    wada: "Dull Blue Violet · Cream Buff · Yellow Ocher",
    tmava: false,
    nahlad: ["#ebe4d3", "#f3eee1", "#2d466a", "#212634"],
  },
  {
    id: "terakota",
    nazov: "Terakota",
    popis: "Tmavá pálená hlina a šalviová zelená.",
    wada: "Hays Russet · Sage Green · Ochraceous Buff",
    tmava: true,
    nahlad: ["#1a110d", "#251812", "#b4c38f", "#f0e6d6"],
  },
  // Michal 2026-10-23: 14 tmavých a 14 svetlých schém — v profile v dvoch skupinách.
  {
    id: "les",
    nazov: "Les",
    popis: "Hlboká smreková zelená a sírová žltá.",
    wada: "Night Green · Sulphur Yellow",
    tmava: true,
    nahlad: ["#04120a", "#061b10", "#e0cb62", "#f2ebd5"],
  },
  {
    id: "mlyn",
    nazov: "Mlynský náhon",
    popis: "Tmavá benátska zelenomodrá a bledá citrónová.",
    wada: "Venice Green · Pale Lemon Yellow",
    tmava: true,
    nahlad: ["#001211", "#011b19", "#d8cc84", "#e7eee5"],
  },
  {
    id: "sumrak",
    nazov: "Súmrak",
    popis: "Medicejská modrá a koralová ružová.",
    wada: "Dark Medici Blue · Coral Pink",
    tmava: true,
    nahlad: ["#040f1a", "#071725", "#f2a28c", "#f1e9e4"],
  },
  {
    id: "cucoriedky",
    nazov: "Čučoriedky",
    popis: "Tyrská modrá a svetlá ružovofialová.",
    wada: "Dark Tyrian Blue · Light Mauve",
    tmava: true,
    nahlad: ["#0a0d1a", "#101526", "#d9b3dc", "#eee8f2"],
  },
  {
    id: "kovac",
    nazov: "Kováčska dielňa",
    popis: "Čiernobridlicová a žeravá marsovská oranžová.",
    wada: "Blackish Slate · Mars Orange",
    tmava: true,
    nahlad: ["#0a0f12", "#11171b", "#fd9c61", "#f0eae3"],
  },
  {
    id: "marhula",
    nazov: "Marhuľa",
    popis: "Marhuľová krémová a broskyňová červená.",
    wada: "Apricot Yellow · Peach Red",
    tmava: false,
    nahlad: ["#f7e8cc", "#fcf1dc", "#92371a", "#322317"],
  },
  {
    id: "fialka",
    nazov: "Fialka",
    popis: "Sivá levanduľa a hortenziová červená.",
    wada: "Grayish Lavender · Hydrangea Red",
    tmava: false,
    nahlad: ["#eee6f7", "#f6effc", "#7a2f5d", "#2a2331"],
  },
  {
    id: "mata",
    nazov: "Mätový čaj",
    popis: "Ekrú a kobaltová zelená.",
    wada: "Ecru · Cobalt Green",
    tmava: false,
    nahlad: ["#e5edd5", "#eff5e3", "#266342", "#1f2a1a"],
  },
  {
    id: "ruza",
    nazov: "Ruža",
    popis: "Kamejová ružová a stará ruža.",
    wada: "Cameo Pink · Old Rose",
    tmava: false,
    nahlad: ["#fbe4df", "#feeeeb", "#8b3a44", "#312128"],
  },
  {
    id: "piesok",
    nazov: "Piesok",
    popis: "Izabelová piesková a pálená siena.",
    wada: "Isabella Color · Burnt Sienna",
    tmava: false,
    nahlad: ["#f5e9cc", "#fbf2dc", "#8a3d1d", "#2e2419"],
  },
  {
    id: "pena",
    nazov: "Morská pena",
    popis: "Bledá modrá a pávia modrá.",
    wada: "Pale Blue · Peacock Blue",
    tmava: false,
    nahlad: ["#ddedee", "#e9f5f5", "#1f5f78", "#1d282e"],
  },
  {
    id: "kava",
    nazov: "Káva s mliekom",
    popis: "Plavá a vandykova hnedá.",
    wada: "Fawn · Vandyke Brown",
    tmava: false,
    nahlad: ["#f7e7d3", "#fdf0e2", "#5a3a26", "#2f241d"],
  },
  {
    id: "jesen",
    nazov: "Jeseň",
    popis: "Ekrú a pompejská červená.",
    wada: "Ecru · Pompeian Red",
    tmava: false,
    nahlad: ["#f3e9cf", "#faf2de", "#93332e", "#2f2420"],
  },
  {
    id: "slnecnica",
    nazov: "Slnečnica",
    popis: "Bledá citrónová a tmavá bridlica.",
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
