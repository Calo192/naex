// Geometria líca karty v bodoch (pt) — port MAUI CardPdfService.DrawCard
// a CardSlotGeometry. Rovnaké čísla používa obrazovka (KartaLico) aj tlač,
// takže karta na webe vyzerá presne ako vytlačená (bez presahu).

export const MM_NA_PT = 72 / 25.4;
/** Tlačový presah na každej strane (mm). */
export const PRESAH_MM = 3;
export const ZNACKA_MM = 3;

export interface Obdlznik {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GeometriaKarty {
  readonly sirka: number;
  readonly vyska: number;
  /** Štvorcová ilustrácia cez celú šírku karty. */
  readonly obrazok: Obdlznik;
  readonly pas: Obdlznik;
  readonly efekt: Obdlznik;
  /** Odsadenie textu od okraja. */
  readonly okrajTextu: number;
  readonly velkostNazvu: number;
  readonly velkostTagov: number;
  readonly velkostEfektu: number;
  /** Stred názvu a tagov v páse (y), ak má karta tagy. */
  readonly nazovY: number;
  readonly tagyY: number;
  readonly slotyLave: readonly Obdlznik[];
  readonly slotyPrave: readonly Obdlznik[];
  readonly polomerSlotu: number;
  /** Šírka bieleho obrysu slotu (0.4 mm). */
  readonly obrysSlotu: number;
}

function vyskyTextu(zostava: number, maTagy: boolean): { pas: number; efekt: number } {
  const minPas = (maTagy ? 9 : 7) * MM_NA_PT;
  const minEfekt = 8 * MM_NA_PT;
  if (zostava >= minPas + minEfekt) {
    const pas = zostava * (maTagy ? 0.45 : 0.35);
    return { pas, efekt: zostava - pas };
  }
  if (zostava >= minPas) {
    const pas = Math.min(minPas, zostava * 0.4);
    return { pas, efekt: Math.max(minEfekt, zostava - pas) };
  }
  return { pas: Math.max(minPas * 0.5, zostava * 0.4), efekt: Math.max(minEfekt * 0.5, zostava * 0.6) };
}

export function geometriaKarty(k: {
  readonly sirkaMm: number;
  readonly vyskaMm: number;
  readonly mierkaTextu: number;
  readonly mierkaIkon: number;
  readonly maTagy: boolean;
}): GeometriaKarty {
  const w = k.sirkaMm * MM_NA_PT;
  const h = k.vyskaMm * MM_NA_PT;
  const mt = Math.min(1.8, Math.max(0.6, k.mierkaTextu));
  const mi = Math.min(1.8, Math.max(0.5, k.mierkaIkon));

  const obrazok = { x: 0, y: 0, w, h: w };
  const { pas: pasH, efekt: efektH } = vyskyTextu(Math.max(0, h - w), k.maTagy);
  const pas = { x: 0, y: w, w, h: pasH };
  const efekt = { x: 0, y: w + pasH, w, h: Math.max(0, h - w - pasH) || efektH };

  // Sloty: blok 4 pozícií vycentrovaný na ilustrácii.
  const MEDZERA = 0.28;
  let cip = Math.min(6 * MM_NA_PT, obrazok.h / 5) * mi;
  cip = Math.min(cip, obrazok.h / (4 + 3 * MEDZERA));
  const medzera = cip * MEDZERA;
  const blok = 4 * cip + 3 * medzera;
  const hore = obrazok.y + obrazok.h / 2 - blok / 2;
  const okraj = Math.min(0.8 * MM_NA_PT, Math.max(0, (obrazok.w - cip) / 2));
  const sloty = (lava: boolean): Obdlznik[] =>
    [0, 1, 2, 3].map((i) => ({
      x: lava ? obrazok.x + okraj : obrazok.x + obrazok.w - cip - okraj,
      y: hore + i * (cip + medzera),
      w: cip,
      h: cip,
    }));

  return {
    sirka: w,
    vyska: h,
    obrazok,
    pas,
    efekt,
    okrajTextu: 2 * MM_NA_PT,
    velkostNazvu: 10 * mt,
    velkostTagov: 6.5 * mt,
    velkostEfektu: 6.5 * mt,
    nazovY: pas.y + pasH * 0.34,
    tagyY: pas.y + pasH * 0.72,
    slotyLave: sloty(true),
    slotyPrave: sloty(false),
    polomerSlotu: cip * 0.24,
    obrysSlotu: 0.4 * MM_NA_PT,
  };
}

/** Rozloženie bodovacej karty (MAUI DashboardScoringCardPdfService.ComputeLayout). */
export interface GeometriaBodovacej {
  readonly sirka: number;
  readonly vyska: number;
  /** Miesto, kam sa vkladá karta staršieho. */
  readonly odtlacok: Obdlznik;
  readonly slotyLave: readonly Obdlznik[];
  readonly slotyPrave: readonly Obdlznik[];
  readonly polomer: number;
  /** 9 krúžkov stupnice strachu (zľava doprava). */
  readonly kruzky: readonly Obdlznik[];
  readonly nazov: Obdlznik;
  readonly velkostNazvu: number;
}

export const FARBY_STUPNICE = ["#dc2626", "#f97316", "#facc15", "#e5e7eb", "#e5e7eb", "#e5e7eb", "#facc15", "#f97316", "#dc2626"] as const;

export function geometriaBodovacej(b: { readonly sirkaMm: number; readonly vyskaMm: number; readonly mierkaIkon: number }): GeometriaBodovacej {
  const kartaW = b.sirkaMm * MM_NA_PT;
  const kartaH = b.vyskaMm * MM_NA_PT;
  const karta = geometriaKarty({ sirkaMm: b.sirkaMm, vyskaMm: b.vyskaMm, mierkaTextu: 1, mierkaIkon: b.mierkaIkon, maTagy: true });
  const cip = karta.slotyLave[0]?.w ?? 6 * MM_NA_PT;
  const odsadenie = 2 * MM_NA_PT;
  const ziabok = cip + 2 * odsadenie;
  const blokW = kartaW + 2 * ziabok;
  const kruhD = (kartaW / 9) * 0.7 * 2;
  const kruhMedzera = kruhD * 0.35;
  const radW = 9 * kruhD + 8 * kruhMedzera;
  const pad = 6 * MM_NA_PT;
  const obsahW = Math.max(blokW, radW);
  const odtlacok = { x: pad + (obsahW - blokW) / 2 + ziabok, y: pad, w: kartaW, h: kartaH };
  const sloty = (lava: boolean): Obdlznik[] =>
    karta.slotyLave.map((s) => ({
      x: lava ? odtlacok.x - odsadenie - cip : odtlacok.x + kartaW + odsadenie,
      y: odtlacok.y + s.y,
      w: cip,
      h: cip,
    }));
  const kruhY = odtlacok.y + kartaH + 5 * MM_NA_PT;
  const radX = pad + (obsahW - radW) / 2;
  const kruzky = Array.from({ length: 9 }, (_, i) => ({ x: radX + i * (kruhD + kruhMedzera), y: kruhY, w: kruhD, h: kruhD }));
  const velkostNazvu = 4.2 * MM_NA_PT;
  const nazovY = kruhY + kruhD + 5 * MM_NA_PT;
  const nazov = { x: pad, y: nazovY, w: obsahW, h: velkostNazvu * 1.4 };
  return {
    sirka: obsahW + 2 * pad,
    vyska: nazovY + nazov.h + pad,
    odtlacok,
    slotyLave: sloty(true),
    slotyPrave: sloty(false),
    polomer: karta.polomerSlotu,
    kruzky,
    nazov,
    velkostNazvu,
  };
}
