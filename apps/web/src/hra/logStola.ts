// Log partie na stole (UI inšpekcia 20261120, Z-12): najnovšie hore, skupiny „Kolo · fáza“ a mená
// hráčov vo farbe. Log jadra sa nemení — nadpisy vkladá klient (riadkyLogu v useHra.ts).

/** Riadok logu, ktorý je nadpisom skupiny „Kolo · fáza“. */
export const NADPIS_LOGU = "§ ";

export interface SkupinaLogu {
  /** „Kolo 2 · Pitka“; null = záznamy pred prvým nadpisom. */
  readonly nadpis: string | null;
  /** Najnovší riadok prvý; `i` = poradie v celom logu (kľúč). */
  readonly riadky: readonly { readonly riadok: string; readonly i: number }[];
}

/** Log po skupinách, najnovšia skupina aj riadok hore. Fáza bez záznamu nadpis nedostane. */
export function skupinyLogu(log: readonly string[]): SkupinaLogu[] {
  const skupiny: { nadpis: string | null; riadky: { riadok: string; i: number }[] }[] = [{ nadpis: null, riadky: [] }];
  log.forEach((riadok, i) => {
    if (riadok.startsWith(NADPIS_LOGU)) skupiny.push({ nadpis: riadok.slice(NADPIS_LOGU.length), riadky: [] });
    else skupiny[skupiny.length - 1]!.riadky.push({ riadok, i });
  });
  return skupiny
    .filter((s) => s.riadky.length > 0)
    .map((s) => ({ nadpis: s.nadpis, riadky: [...s.riadky].reverse() }))
    .reverse();
}

/** Úseky riadku: text a mená hráčov (index hráča) — na farbu mena. Dlhšie meno má prednosť. */
export function usekyMien(riadok: string, mena: readonly string[]): readonly { readonly text: string; readonly hrac: number | null }[] {
  const platne = mena.map((m, hrac) => ({ m, hrac })).filter((x) => x.m.length > 0).sort((a, b) => b.m.length - a.m.length);
  const out: { text: string; hrac: number | null }[] = [];
  let zvysok = riadok;
  while (zvysok.length > 0) {
    let najblizsie: { idx: number; m: string; hrac: number } | null = null;
    for (const { m, hrac } of platne) {
      const idx = zvysok.indexOf(m);
      if (idx >= 0 && (najblizsie === null || idx < najblizsie.idx)) najblizsie = { idx, m, hrac };
    }
    if (najblizsie === null) {
      out.push({ text: zvysok, hrac: null });
      break;
    }
    if (najblizsie.idx > 0) out.push({ text: zvysok.slice(0, najblizsie.idx), hrac: null });
    out.push({ text: najblizsie.m, hrac: najblizsie.hrac });
    zvysok = zvysok.slice(najblizsie.idx + najblizsie.m.length);
  }
  return out;
}
