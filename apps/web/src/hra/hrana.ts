// Spodná hrana stola (Michal 2026-10-25): potvrdenie ťahu je pečiatka v strede hrany, na mieste
// NA EX!. Udalosti (↺ čo urobil súper, chyba ťahu) ležia na tej istej čiare — v strede, kým tam
// pečiatka nie je, inak hneď vedľa nej, aby ju nikdy neprekryli. Na mobile ostávajú nad radom
// tlačidiel (hrana sa tam lepí nad ruku a rad sa skladá pod seba).

/** Kam na hrane stola patria udalosti. */
export type MiestoUdalosti = "nad" | "stred" | "vedla";

export function miestoUdalosti(maPecatVStrede: boolean, mobil: boolean): MiestoUdalosti {
  if (mobil) return "nad";
  return maPecatVStrede ? "vedla" : "stred";
}
