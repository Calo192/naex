// Návrat po prihlásení a registrácii (?spat=…). Pozvánka /hra?kod=ABCD musí
// prežiť cestu cez prihlásenie aj registráciu nového hráča — inak skončí
// v lobby bez kamaráta (nález UX 2026-10-27).

/** Bezpečná cesta zo `?spat=` (len vlastný web, nie „//iny.web“); null = žiadna. */
export function navratZ(search: string): string | null {
  const spat = new URLSearchParams(search).get("spat");
  return spat !== null && spat.startsWith("/") && !spat.startsWith("//") ? spat : null;
}

/** Odkaz na prihlásenie či registráciu, ktorý sa vráti na `cesta` aj s parametrami. */
export function sNavratom(stranka: "/prihlasenie" | "/registracia", cesta: string): string {
  return `${stranka}?spat=${encodeURIComponent(cesta)}`;
}
