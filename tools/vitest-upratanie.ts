// Pred testami zmaže staré zvyšky (základ projektu aj starý %TEMP%, tools/docasne.ts) — test zabitý uprostred
// nechá dočasnú databázu a pri plnom disku ďalšie behy padajú na ENOSPC.

import { nastavDocasneEnv, upratStare } from "./docasne.ts";

export default function setup(): void {
  nastavDocasneEnv();
  const { zmazane, mb } = upratStare();
  if (zmazane > 0) console.log(`Upratané staré dočasné priečinky: ${zmazane} (${mb} MB).`);
}
