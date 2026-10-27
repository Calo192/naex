// Výsledné akcie hráčskych kariet po revízii sady (27. 10. 2026).
//
// Zdroj akcií: packages/core/data/cards.json (dnešná sada), plan.md časť 3 a 10.1
// (git 7a2b0d7), Dávka 3 (Svokra a Degustátorka Obmedzenie → Dlh, Vymáhač, Manželka
// M2 bez zmeny akcií, Dievčina bez zmeny akcií) a Pakt z časti 12. Efekty E3 (27. 10.): Presbiter
// a Opatrovateľka zo sady odchádzajú, Smetiarka, Brigádnik a Oslávenec sú zatiaľ len návrhy (nie
// v sade), Kulturista má Petelica ×2 / Dlh ×2, premenovanie Klebetnica → Bzdocha (a Stryná z E2).
// Pakt tým ostáva na 2 nosičoch (4 kópie). Mimo rozsahu: starešinovia, kliatby, lokality.
// Okná (blocked/allowed) tu nie sú — tie sú v sloty.ts.

export type Akcie = Readonly<Record<string, number>>;

export interface KartaPoRevizii {
  readonly id: string;
  readonly nazov: string;
  readonly druh: "Nástroj" | "Zviera" | "Občan" | "Štart";
  /** Kópie v hre: balíček 2×, štartovka 1× u každého hráča = tiež 2. */
  readonly kopie: number;
  readonly lava: Akcie;
  readonly prava: Akcie;
  /** Odkiaľ akcie pochádzajú (pre čitateľa). */
  readonly zdroj: string;
  /** true = karta je v dnešnom cards.json (PRED sa ráta z jej dnešných dát). */
  readonly vHre: boolean;
}

const k = (
  id: string, nazov: string, druh: KartaPoRevizii["druh"], lava: Akcie, prava: Akcie,
  zdroj: string, vHre = true,
): KartaPoRevizii => ({ id, nazov, druh, kopie: 2, lava, prava, zdroj, vHre });

const CIG = "Cigareta", DLH = "Dlh", OBM = "Obmedzenie", ODP = "Odpor", PEC = "Pecka",
  PET = "Petelica", POH = "Pohoršenie", POL = "Poldeci", POS = "Posilnenie", POV = "Povera",
  PEN = "PoškodeniePečene", RAN = "Rana", ROB = "Robota", VIE = "Viera", VIZ = "Vízia",
  PAK = "Pakt";

export const AKCIE_PORADIE = [
  PET, PEC, RAN, PEN, POL, DLH, POV, VIE, POH, CIG, ROB, ODP, OBM, VIZ, POS, PAK,
] as const;

export const SKRATKY: Readonly<Record<string, string>> = {
  [CIG]: "Cig", [DLH]: "Dlh", [OBM]: "Obmedz", [ODP]: "Odpor", [PEC]: "Pecka",
  [PET]: "Petelica", [POH]: "Pohorš", [POL]: "Poldeci", [POS]: "Posil", [POV]: "Povera",
  [PEN]: "Pečeň", [RAN]: "Rana", [ROB]: "Robota", [VIE]: "Viera", [VIZ]: "Vízia", [PAK]: "Pakt",
};

export const KARTY: readonly KartaPoRevizii[] = [
  // Nástroje
  k("noviny", "Noviny", "Nástroj", { [POH]: 1 }, { [POV]: 1 }, "bez zmeny"),
  k("cigorky", "Krabička cigariet", "Nástroj", { [CIG]: 1 }, { [CIG]: 1 }, "bez zmeny"),
  k("vinko", "Vínko", "Nástroj", { [POL]: 2 }, { [PEN]: 4 }, "bez zmeny"),
  k("pasca", "Pasca", "Nástroj", { [OBM]: 1 }, { [ODP]: 1 }, "bez zmeny"),
  k("puska", "Puška", "Nástroj", { [PEC]: 1 }, { [PET]: 1 }, "10.1: Rana → Pecka, Pecka → Petelica"),
  k("svaty_text", "Svätý text", "Nástroj", { [VIE]: 1 }, { [VIE]: 1 }, "bez zmeny"),
  k("nealko", "Nealko", "Nástroj", { [POH]: 1 }, { [POH]: 1 }, "bez zmeny"),
  k("vyherny_automat", "Výherný automat", "Nástroj", { [ROB]: 1 }, { [DLH]: 4 }, "10.1: akcie bez zmeny"),
  k("vidly", "Vidly", "Nástroj", { [PEC]: 1 }, { [POH]: 1 }, "schválená novinka", false),
  k("lievik", "Lievik", "Nástroj", { [POL]: 1 }, { [PEN]: 2 }, "schválená novinka", false),
  // Zvieratá
  k("cierna_macka", "Čierna mačka", "Zviera", { [POH]: 1, [POV]: 1 }, { [POV]: 1 }, "bez zmeny"),
  k("pes", "Pes", "Zviera", { [RAN]: 1 }, { [RAN]: 2 }, "bez zmeny"),
  k("krokodil", "Krokodíl", "Zviera", { [ODP]: 1 }, { [PEC]: 1 }, "schválená novinka", false),
  k("kapybara", "Kapybara", "Zviera", { [VIE]: 1 }, { [CIG]: 1 }, "schválená novinka", false),
  k("kon", "Kôň", "Zviera", { [POS]: 1 }, { [RAN]: 1 }, "schválená novinka", false),
  k("kohut", "Kohút", "Zviera", { [POH]: 1 }, { [ODP]: 1 }, "schválená novinka", false),
  // Občania
  k("financna_poradkyna", "Finančná poradkyňa", "Občan", { [DLH]: 2, [POV]: 1 }, { [CIG]: 1, [DLH]: 1, [OBM]: 1 }, "10.1: vpravo + Obmedzenie"),
  k("velmi_smutiaca_vdova", "Veľmi smútiaca vdova", "Občan", { [DLH]: 1, [OBM]: 1, [RAN]: 1 }, { [POH]: 2 }, "bez zmeny"),
  k("vestica", "Veštica", "Občan", { [CIG]: 1, [VIZ]: 1, [PEN]: 1 }, { [POV]: 2, [VIE]: 1 }, "10.1: vľavo + Pečeň"),
  k("silna_nezavisla_zena", "Silná, nezávislá žena", "Občan", { [CIG]: 1, [POH]: 1 }, { [DLH]: 2 }, "bez zmeny"),
  k("policajtka", "Policajtka", "Občan", { [OBM]: 1, [RAN]: 1 }, { [ROB]: 1 }, "bez zmeny"),
  k("hasic", "Hasič", "Občan", { [POS]: 1 }, { [PET]: 1, [RAN]: 1 }, "bez zmeny"),
  k("praudovravec", "Praudovravec", "Občan", { [ODP]: 1, [POV]: 1, [VIE]: 1 }, { [POH]: 1, [POV]: 1, [VIZ]: 1 }, "10.1: vľavo + Viera"),
  k("zamocnik", "Zámočník", "Občan", { [CIG]: 1, [POL]: 1 }, { [PEC]: 1, [ROB]: 1 }, "bez zmeny"),
  k("niekoho_stryna", "Stryná", "Občan", { [POL]: 1, [VIE]: 1, [PEN]: 1 }, { [POV]: 1, [VIE]: 1, [VIZ]: 1 }, "10.1: vľavo + Pečeň"),
  k("veteran", "Veterán", "Občan", { [POL]: 1, [PEN]: 1 }, { [ODP]: 1, [PET]: 1 }, "10.1: Pecka → Petelica"),
  k("recidivista", "Recidivista", "Občan", { [DLH]: 2 }, { [PET]: 1, [RAN]: 1 }, "10.1: vľavo Odpor → Dlh"),
  k("liberal", "Liberál", "Občan", { [POH]: 1, [VIE]: 1 }, { [CIG]: 1, [POV]: 1 }, "10.1: akcie 2 → 4"),
  k("zivnostnik", "Živnostník", "Občan", { [DLH]: 1, [ODP]: 1, [ROB]: 1, [PAK]: 1 }, { [CIG]: 2, [PEN]: 1 }, "10.1: vľavo + Robota; 12.1: vľavo + Pakt"),
  k("kocovnik", "Kočovník", "Občan", { [DLH]: 1, [PEN]: 1 }, { [CIG]: 1, [PEN]: 1, [PEC]: 1 }, "10.1: Rana → Pecka"),
  k("svokra", "Svokra", "Občan", { [POL]: 1 }, { [DLH]: 1, [PEC]: 1, [VIE]: 1 }, "Dávka 3 D3: Obmedzenie → Dlh"),
  k("sarlatan", "Šarlatán", "Občan", { [DLH]: 1, [POV]: 2 }, { [CIG]: 1, [POH]: 1, [PEN]: 1 }, "10.1: vpravo + Pečeň"),
  k("podvodnik", "Podvodník", "Občan", { [CIG]: 2, [DLH]: 1 }, { [OBM]: 1, [RAN]: 1 }, "10.1: akcie bez zmeny"),
  k("zahradkar", "Záhradkár", "Občan", { [CIG]: 2, [PEN]: 1 }, { [POL]: 1, [RAN]: 1, [ROB]: 1 }, "10.1: akcie bez zmeny"),
  k("anonymny_alkoholik", "Anonymný alkoholik", "Občan", { [ODP]: 1, [ROB]: 1 }, { [DLH]: 1, [VIE]: 1 }, "bez zmeny"),
  k("dvojcata", "Dvojčatá", "Občan", { [DLH]: 1, [PEC]: 1 }, { [PEN]: 1, [RAN]: 1 }, "10.1: Rana → Pecka, Cig → Pečeň"),
  k("sofer", "Šofér", "Občan", { [POL]: 1, [RAN]: 1 }, { [CIG]: 1, [PEN]: 1 }, "10.1: akcie bez zmeny"),
  k("snubenica", "Snúbenica", "Občan", { [ROB]: 1 }, { [DLH]: 1, [VIE]: 1 }, "bez zmeny"),
  k("degustatorka", "Degustátorka", "Občan", { [PEN]: 1, [POL]: 1 }, { [RAN]: 1, [DLH]: 1 }, "schválená novinka; Dávka 3 D3: Obmedzenie → Dlh", false),
  k("klebetnica", "Bzdocha", "Občan", { [POV]: 1, [VIZ]: 1 }, { [POH]: 1, [DLH]: 1 }, "schválená novinka", false),
  k("dohadzovacka", "Dohadzovačka", "Občan", { [VIE]: 1, [PAK]: 1 }, { [POS]: 1, [DLH]: 1 }, "schválená novinka; 12.1: vľavo Cig → Pakt", false),
  k("vandal", "Vandal", "Občan", { [PEC]: 1, [PEN]: 1 }, { [ODP]: 1, [RAN]: 1 }, "schválená novinka", false),
  k("stryko_z_ameriky", "Strýko z Ameriky", "Občan", { [CIG]: 2 }, { [VIZ]: 1, [POL]: 1 }, "schválená novinka", false),
  k("masiar", "Mäsiar", "Občan", { [PEC]: 1, [PEN]: 1 }, { [PEC]: 1, [PEN]: 1 }, "4: nová", false),
  k("kulturista", "Kulturista", "Občan", { [PET]: 2 }, { [DLH]: 2 }, "4: nová; E3: Petelica ×2 / Dlh ×2", false),
  k("traktoristka", "Traktoristka", "Občan", { [PET]: 1, [PEN]: 1 }, { [DLH]: 1 }, "4: nová", false),
  k("vymahac", "Vymáhač", "Občan", { [PEC]: 1, [DLH]: 1 }, { [RAN]: 1, [DLH]: 1 }, "Dávka 3 D5: nová", false),
  // Štartové (1× u každého hráča)
  k("pijan", "Pijan", "Štart", { [DLH]: 1, [PEN]: 1 }, { [POL]: 1, [PEN]: 1, [RAN]: 1 }, "bez zmeny"),
  k("milujuca_manzelka", "Milujúca manželka", "Štart", { [DLH]: 1, [VIE]: 1 }, { [ODP]: 1, [POV]: 1 }, "Dávka 3 M2: akcie bez zmeny, bez tagu Kliatba"),
  k("ministrant", "Miňištrant", "Štart", { [PEN]: 1, [VIE]: 1 }, { [CIG]: 1, [POV]: 1 }, "bez zmeny"),
  k("dievcina_na_vydaj", "Dievčina na vydaj", "Štart", { [DLH]: 2 }, { [POH]: 1, [POV]: 1 }, "Dávka 3 D4: akcie bez zmeny"),
];
