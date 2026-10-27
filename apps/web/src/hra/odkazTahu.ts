// „Odkazujem“ (Michal 2026-10-27): vybraný Nástroj z ruky ide do Dedičstva jedným klikom.
// Nie je to vlastná cesta k jadru — je to ten istý ťah ako návrh + „potvrdiť“: Nástroj sa
// pridá na koniec návrhu s cieľom Dedičstvo a planVykladania z toho urobí príkaz „tah“
// (Vypiť pred ďalšou kartou, cena Dedičstva, chyby) presne tak, ako ho overí server.

import { planVykladania } from "@naex/core";
import type { CardInstance, ClientState, Command, GameData, PlayerId, PolozkaVykladania } from "@naex/core";

export type TahOdkazu = { readonly kroky: readonly Command[]; readonly dovod: null } | { readonly kroky: null; readonly dovod: string };

/** Návrh, v ktorom Nástroj ide do Dedičstva ako posledná karta ťahu (z iného miesta návrhu sa presunie). */
export function polozkyOdkazu(polozky: readonly PolozkaVykladania[], nastroj: CardInstance): readonly PolozkaVykladania[] {
  return [...polozky.filter((x) => x.karta.uid !== nastroj.uid), { karta: nastroj, ciel: "dedicstvo" }];
}

/** Príkazy ťahu s Nástrojom v Dedičstve, alebo dôvod, prečo sa to teraz nedá. */
export function tahOdkazu(data: GameData, view: ClientState, ja: PlayerId, polozky: readonly PolozkaVykladania[], nastroj: CardInstance): TahOdkazu {
  const z = view.zhromazdenieStav;
  if (view.faza !== "zhromazdenie" || z === null) return { kroky: null, dovod: "Do Dedičstva sa odkazuje len v Zhromaždení." };
  if (z.pasoval[ja]) return { kroky: null, dovod: "V tomto Zhromaždení už nevykladáš." };
  const plan = planVykladania(data, view, ja, z.zostavaLimit[ja], polozkyOdkazu(polozky, nastroj));
  return plan.chyba === null ? { kroky: plan.kroky, dovod: null } : { kroky: null, dovod: plan.chyba };
}
