// Pred testami zmaže staré zvyšky v %TEMP% (tools/docasne.ts) — test zabitý uprostred
// nechá dočasnú databázu a pri plnom disku ďalšie behy padajú na ENOSPC.

import { upratStare } from "./docasne.ts";

export default function setup(): void {
  const { zmazane, mb } = upratStare();
  if (zmazane > 0) console.log(`Upratané staré dočasné priečinky: ${zmazane} (${mb} MB).`);
}
