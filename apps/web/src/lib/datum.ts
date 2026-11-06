// Dátumy v rozhraní tak, ako ich píšu hráči: „6. 11. 2026“, krátko „6. 11.“.

/** Čas (ms) → „6. 11. 2026“. */
export const datum = (cas: number): string => new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

/** Deň z API (RRRR-MM-DD) → „6. 11.“. */
export const kratkyDen = (den: string): string => {
  const [, m, d] = den.split("-");
  return `${Number(d)}. ${Number(m)}.`;
};
