// Texty o staršom na jednom mieste (Michal 2026-10-28: „každá informácia na JEDNOM mieste“;
// v11 Strach a reči 2026-11-02). Línia starších (Teplomery, Pult), dlaždice v baroch, súhrny
// a nástenka skladajú vety o strachu, rečiach a ich zmenách odtiaľto.

import type { Favour, PlayerId, ZmenaMarkera } from "@naex/core";
import { KONSTANTY, NAZVY_ZON } from "@naex/core";
import { UCINOK_KRATKO } from "./Scorecard.tsx";
import { spakov } from "../i18n/pocty.ts";
import { t } from "../i18n/jazyk.tsx";

/** Prečo sa marker zmenil (ZmenaMarkera.zdroj) — krátko, na štítok a do logu zmien. */
// Gettery, aby sa text čítal v jazyku hráča pri každom vykreslení, nie raz pri načítaní modulu.
export const NAZOV_ZDROJA: Readonly<Record<ZmenaMarkera["zdroj"], string>> = {
  get nakladacka() {
    return t("delenie.nakladacka");
  },
  get hadka() {
    return t("delenie.hadka");
  },
  get bodovanie() {
    return t("delenie.bodovanie");
  },
  get vila() {
    return t("delenie.vila");
  },
  get posun() {
    return t("delenie.posun");
  },
};

/**
 * Riadok priazne: komu a akú priazeň dáva — bez priazne účinok pri +1 (Michal 2026-10-23).
 * Sila je už v účinku („+2 tuhé v bitke“), druhýkrát sa nepíše (2026-10-30).
 */
export function riadokPriazne(fav: Favour, komu: string | null, sila: number): string {
  return komu === null || sila <= 0 ? t("priazen.nikomu", { ucinok: UCINOK_KRATKO[fav](1) }) : `${komu}: ${UCINOK_KRATKO[fav](sila)}`;
}

/** Názov stupňa: „žltá“; 0 = „nič“. */
export const nazovStupna = (s: number): string => (s === 0 ? t("starsi.nic") : s >= 1 && s < NAZVY_ZON.length ? t(`zona.${s}`) : "");

/**
 * Zmena markera slovami z pohľadu hráča `ja`: „tvoj strach žltá → oranžová“,
 * „reči Fera oranžová → zanikli“.
 */
export function textZmeny(z: Pick<ZmenaMarkera, "hrac" | "marker" | "z" | "na">, ja: PlayerId, mena: readonly [string, string]): string {
  const ty = z.hrac === ja;
  const co =
    z.marker === "strach"
      ? ty
        ? t("starsi.tvojStrach")
        : t("starsi.strachHraca", { meno: mena[z.hrac] })
      : ty
        ? t("starsi.tvojeReci")
        : t("starsi.reciHraca", { meno: mena[z.hrac] });
  const na = z.na === 0 ? (z.marker === "strach" ? t("starsi.nic") : t("starsi.zanikli")) : nazovStupna(z.na);
  return `${co} ${nazovStupna(z.z)} → ${na}`;
}

/** Krátky riadok dlaždice v bare hráča: ako starší k nemu stojí. */
export function riadokDlazdice(smer: "hore" | "dole" | "nic", ja: boolean): string {
  if (smer === "hore") return ja ? t("starsi.pomahaTi") : t("starsi.pomahaMu");
  if (smer === "dole") return ja ? t("starsi.bojiSaTa") : t("starsi.bojiSaHo");
  return t("starsi.neutralny");
}

/** Ako sa čítajú teplomery (v11.12) — titulok v hlavičke línie a v ukážkach. */
export const pravidloStrachu = (): string =>
  t("starsi.pravidloStrachu", { cena: `${KONSTANTY.CENA_STUPNA[1]} / ${KONSTANTY.CENA_STUPNA[2]} / ${KONSTANTY.CENA_STUPNA[3]}`, hodnota: HODNOTA_POLA });

/** Rod staršieho pre slová stupňov („vydesený“ / „vydesená“). */
export type Rod = "m" | "z";

const ZENSKY_ROD: ReadonlySet<string> = new Set(["krcmarka", "postarka", "vychovavatelka"]);

/**
 * Rod karty staršieho: známi starší podľa karty, inak podľa mena (náhrada bossa) — „-ka“ je
 * ženský rod; „Starosta“ na „-a“ je mužský, preto len „-ka“.
 */
export function rodStarsieho(defId: string, meno: string): Rod {
  if (ZENSKY_ROD.has(defId)) return "z";
  return /ka$/i.test(meno.trim()) ? "z" : "m";
}

/** Stupeň slovom v rode staršieho — nikdy farbou (Michal 2026-11-02); kľúče stupen.m0 … stupen.z3. */
export const slovoStupna = (s: number, rod: Rod): string => t(`stupen.${rod}${s >= 0 && s <= 3 ? s : 0}`);

/**
 * Názov kroku rozdeľovania na stole (bublina, línia starších) — na jednom mieste. Prebytok
 * poškodenia sa hráčovi volá Nakladačka (Michal 2026-10-30); v kóde ostáva „prebytok“.
 */
export const NAZOV_DELENIA = {
  get hadka() {
    return t("delenie.hadka");
  },
  get reci() {
    return t("delenie.hadka");
  },
  get prebytok() {
    return t("delenie.nakladacka");
  },
} as const;

/** Hodnota stupňa po bitke slovami: „1 / 2 / 3“ (v11.20; do v11.19 1 / 2 / 2). */
export const HODNOTA_POLA = `${KONSTANTY.HODNOTA_STUPNA[1]} / ${KONSTANTY.HODNOTA_STUPNA[2]} / ${KONSTANTY.HODNOTA_STUPNA[3]}`;

/** Cena stupňa (v11): do žltej 1, do oranžovej 2, do červenej 3 — Nakladačka aj hádka. */
export const cenaPola = (): string =>
  t("starsi.cenaPola", { cena: `${KONSTANTY.CENA_STUPNA[1]} / ${KONSTANTY.CENA_STUPNA[2]} / ${KONSTANTY.CENA_STUPNA[3]}` });

/** Špaky slovom („1 špak“, „3 špaky“). */
export const textSpakov = (n: number): string => spakov(n);
