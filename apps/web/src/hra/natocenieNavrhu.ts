// Natočenie navrhnutej lokality na stole (v11.11): natáča víťaz minulej hádky, nie vždy ten, kto lokalitu
// vyberá. Michal 2026-11-09 („nedá sa mi natočiť lokalitu“): pri natočení cieľa server lokalitu už nesie,
// a stôl kreslil ju — bez kliku a v natočení zo servera, takže klik ani „otočiť“ kartu neotočili; pri voľbe
// cieľa, keď natáča súper, zas tip pod kartou sľuboval otočenie. Bez Reactu, aby sa dalo otestovať.

import type { CardInstance, ClientState, PlayerId } from "@naex/core";
import { ktoNatacaLokalitu } from "@naex/core";

/** Lokalita na stole pred potvrdením; otocena je v ráme hráča 0 (ako lokalitaOtocena). */
export interface NavrhLokality {
  readonly karta: CardInstance;
  readonly otocena: boolean;
}

/**
 * Návrh lokality hráča na ťahu: pri natočení cieľa lokalita, ktorú vybral súper (natočenie z návrhu,
 * inak zo servera), pri voľbe cieľa lokalita, ktorú hráč položil na stôl.
 */
export function lokalitaZNavrhu(
  view: Pick<ClientState, "faza" | "ciel" | "lokalitaOtocena" | "lokalityVHre">,
  somNaTahu: boolean,
  navrh: { readonly uid: number; readonly otocena: boolean } | null,
): NavrhLokality | null {
  if (somNaTahu && view.faza === "natocenieCiela" && view.ciel?.lokalita != null) {
    return { karta: view.ciel.lokalita, otocena: navrh === null ? view.lokalitaOtocena : navrh.otocena };
  }
  if (navrh === null || !somNaTahu || view.faza !== "volbaCiela") return null;
  const k = view.lokalityVHre.find((x) => x.uid === navrh.uid);
  return k === undefined ? null : { karta: k, otocena: navrh.otocena };
}

/**
 * Čo leží v strede línie. Návrh má prednosť pred cieľom zo servera — pri natočení cieľa server lokalitu
 * už nesie, ale natáča ju hráč: kreslí sa jeho natočenie a klik ju otáča.
 */
export function lokalitaVStrede(
  ciel: CardInstance | null,
  cielOtocena: boolean,
  navrh: NavrhLokality | null,
): (NavrhLokality & { readonly navrh: boolean }) | null {
  if (navrh !== null) return { ...navrh, navrh: true };
  return ciel === null ? null : { karta: ciel, otocena: cielOtocena, navrh: false };
}

/**
 * Otočí klik hráča ja navrhnutú lokalitu? Pri natočení cieľa je to jeho krok; pri voľbe cieľa len vtedy,
 * keď lokalitu aj natáča — inak ju natočí súper, až ju hráč potvrdí.
 */
export function natacamNavrh(view: Pick<ClientState, "faza" | "pata" | "utocnik" | "vitazPoslednejHadky">, ja: PlayerId): boolean {
  if (view.faza === "natocenieCiela") return true;
  return view.faza === "volbaCiela" && ktoNatacaLokalitu(view) === ja;
}

/** Tip pod navrhnutou lokalitou: ako ju otočiť, alebo kto ju natočí. */
export function tipNavrhuLokality(natacam: boolean, tuk: boolean, natoci: string): string {
  return natacam ? `${tuk ? "ťuk" : "klik"} na kartu = otočiť ↻` : `natočí ju ${natoci}`;
}
