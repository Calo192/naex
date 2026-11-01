// Odosielanie e-mailov (Michal 2026-11-01): zatiaľ len odkaz na obnovu hesla.
// Odosielanie je vypnuté — jediný režim „log“ zapíše e-mail do logu servera.
// Ďalší režim (Gmail SMTP cez node:tls alebo HTTPS API služby, bez nových
// závislostí) pribudne ako ďalšia implementácia PosliEmail; volí sa premennou
// NAEX_EMAIL_REZIM (docs/NASADENIE.md).

/** Pošle e-mail; chyba odosielania sa nesmie dostať k žiadateľovi (prezradila by účet). */
export type PosliEmail = (komu: string, predmet: string, text: string) => Promise<void>;

export const REZIMY_EMAILU = ["log"] as const;
export type RezimEmailu = (typeof REZIMY_EMAILU)[number];

/** Režim „log“: e-mail sa neodošle, len sa vypíše do logu servera (kto, kam, odkaz). */
export function emailDoLogu(vypis: (riadok: string) => void = console.log): PosliEmail {
  return async (komu, predmet, text) => {
    vypis(`[e-mail, neodoslaný — NAEX_EMAIL_REZIM=log] komu: ${komu} | predmet: ${predmet}\n${text}`);
  };
}

/** Odosielač podľa NAEX_EMAIL_REZIM; neznámy režim spadne na „log“, aby preklep nezhodil server. */
export function odosielacZProstredia(rezim: string | undefined): PosliEmail {
  const r = rezim === undefined || rezim === "" ? "log" : rezim;
  if (!(REZIMY_EMAILU as readonly string[]).includes(r)) {
    console.warn(`NAEX_EMAIL_REZIM=${r} nepoznám (poznám: ${REZIMY_EMAILU.join(", ")}) — e-maily idú len do logu.`);
  }
  return emailDoLogu();
}
