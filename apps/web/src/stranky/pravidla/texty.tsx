// Texty stránky Pravidlá v jazyku hráča (lokalizácia 3c): kapitoly sú v i18n/pravidla/sk.json,
// odsek = jedno pole, preklady sa načítajú až pri inom jazyku (i18n/dlhe.ts). Pojem v texte je
// značka <p k="id">slovo</p> — v preklade smie byť pri inom slove, kľúč pojmu ostáva.

import type { ReactNode } from "react";
import zdroj from "../../i18n/pravidla/sk.json";
import type { ZdrojDlhych } from "../../i18n/dlhe.ts";
import { formatuj, textOblasti, type Znacka } from "../../i18n/jazyk.tsx";
import { Odkaz } from "../../lib/router.tsx";
import { Pojem } from "./Pojem.tsx";

const ZDROJ: ZdrojDlhych = zdroj as unknown as ZdrojDlhych;

/** „kapitola.pole“ → text v jazyku hráča; neznámy kľúč = kľúč sám (stráži ho test). */
export function textPravidiel(kluc: string): string {
  const i = kluc.indexOf(".");
  const id = kluc.slice(0, i);
  const pole = kluc.slice(i + 1);
  const sk = ZDROJ[id]?.[pole];
  return sk === undefined ? kluc : textOblasti("pravidla", id, pole, sk);
}

const ZNACKY: Readonly<Record<string, Znacka>> = {
  p: (o, i, k) => (
    <Pojem key={i} k={k ?? ""}>
      {o}
    </Pojem>
  ),
  a: (o, i, href) => (
    <a key={i} href={href ?? undefined}>
      {o}
    </a>
  ),
  odkaz: (o, i, href) => (
    <Odkaz key={i} href={href ?? "/"}>
      {o}
    </Odkaz>
  ),
};

/** Odsek pravidiel so značkami (pojmy, tučné, odkazy). */
export const tp = (kluc: string): ReactNode => formatuj(textPravidiel(kluc), {}, ZNACKY);

/** Polia kapitoly s predponou v poradí zdroja („skratka.“ → body V skratke). */
export const poliaKapitoly = (id: string, predpona: string): string[] => Object.keys(ZDROJ[id] ?? {}).filter((p) => p.startsWith(predpona));

/** Má kapitola pole (kratší názov do obsahu nemajú všetky)? */
export const maPole = (id: string, pole: string): boolean => ZDROJ[id]?.[pole] !== undefined;
