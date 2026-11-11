// Počítané slová a názvy z jadra v jazyku hráča. Jadro má vlastné slovenské tvary (pocet,
// spakov, kariet v @naex/core) pre hlášky motora; klient ich na zobrazenie berie odtiaľto,
// aby ich prekladateľ našiel v sk.json. Slovenské tvary sú tie isté ako v jadre.

import type { ZdrojPrisunu } from "@naex/core";
import { t } from "./jazyk.tsx";

/** „1 špak“, „3 špaky“, „5 špakov“. */
export const spakov = (n: number): string => t("pocet.spakov", { n });
/** Akuzatív: „1 kartu“, „2 karty“, „5 kariet“. */
export const kariet = (n: number): string => t("pocet.kariet", { n });
/** Akuzatív: „1 cigaretu“, „2 cigarety“, „5 cigariet“. */
export const cigariet = (n: number): string => t("pocet.cigariet", { n });

/** Názov zdroja prísunu (NAZVY_ZDROJOV_PRISUNU v jadre). */
export const nazovZdrojaPrisunu = (z: ZdrojPrisunu): string => t(`prisun.${z}`);
