// Dôvod konca partie z archívu pre zoznam aj detail partie. Partie zapísané pred 2026-11-20
// nesú v dôvode značku rodu {N:muž|žena|neutrálne} — server ju vtedy nerozkladal.

import { rozlozRod, type Rod } from "@naex/core";
import { prelozHlasku } from "../../i18n/jazyk.tsx";

/** Rod hráčov v archíve nepoznáme (okrem bota) — bez neho neutrálny tvar („vyhráva“). */
export function dovodPartie(dovod: string, rody: readonly [Rod, Rod] = [null, null]): string {
  return prelozHlasku(rozlozRod(dovod, rody));
}
