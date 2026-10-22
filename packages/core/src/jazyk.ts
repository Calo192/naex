// Tvary počítaných slov v hláškach motora (akuzatív): 1 cigaretu, 2–4 cigarety,
// 0 a 5+ cigariet. Predtým mali hlášky pevný tvar — „1 cigariet“, „0 karty“.

export function pocet(n: number, jeden: string, dvaAzStyri: string, inak: string): string {
  return `${n} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dvaAzStyri : inak}`;
}

export const cigariet = (n: number): string => pocet(n, "cigaretu", "cigarety", "cigariet");
export const kariet = (n: number): string => pocet(n, "kartu", "karty", "kariet");

// Rod v hláškach (Michal 2026-10-22): hráč si v profile voliteľne zvolí
// pohlavie a hlášky sa skloňujú („Eva skončila“); bez voľby sú neutrálne.
// Bot je „Bot Teta Gizka“ a sloveso je v mužskom rode („Bot … skončil“).

export const POHLAVIA = ["muz", "zena"] as const;
export type Pohlavie = (typeof POHLAVIA)[number];
/** Ako sa o hráčovi hovorí: pohlavie z profilu, bot, alebo neuvedené (null). */
export type Rod = Pohlavie | "bot" | null;

/** Tvar podľa rodu — neutrálny, keď hráč pohlavie neuviedol (často prítomný čas: „vyberá“). */
export function tvar(rod: Rod, muz: string, zena: string, neutralne: string): string {
  return rod === "zena" ? zena : rod === "muz" || rod === "bot" ? muz : neutralne;
}

/**
 * Značka rodu v hláške motora: {N:muž|žena|neutrálne}, N je číslo hráča ako
 * v „Hráč N“. Motor rod hráčov nepozná — tvar dosadí až klient (rozlozRod).
 */
export function rodovo(p: 0 | 1, muz: string, zena: string, neutralne: string): string {
  return `{${p + 1}:${muz}|${zena}|${neutralne}}`;
}

const ZNACKA_RODU = /\{([12]):([^|{}]*)\|([^|{}]*)\|([^{}]*)\}/g;

/** Hláška motora pre človeka: značky rodu podľa hráčov ([hráč 1, hráč 2]). */
export function rozlozRod(text: string, rody: readonly [Rod, Rod]): string {
  return text.replace(ZNACKA_RODU, (_m, n: string, muz: string, zena: string, neutralne: string) =>
    tvar(rody[Number(n) - 1] ?? null, muz, zena, neutralne),
  );
}
