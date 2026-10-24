// Záverečná ako spôsob, ako ukončiť ťah (Michal 2026-10-24): hráč si vyloží návrh ako
// pri bežnom ťahu a tlačidlo „Záverečná“ vedľa potvrdenia ho odošle tak, že posledná
// karta do línie či do Dedičstva pôjde lícom dole. Pravidlá overí planVykladania —
// ten istý výpočet, aký urobí server s príkazom „tah“.

import { cigariet, KONSTANTY, planVykladania } from "@naex/core";
import type { ClientState, Command, GameData, PlayerId, PolozkaVykladania } from "@naex/core";

export type TahSoZaverecnou = { readonly kroky: readonly Command[]; readonly dovod: null } | { readonly kroky: null; readonly dovod: string };

/** Návrh, v ktorom je Záverečnou posledná karta ťahu (priznania ťah nekončia, tie sa nerátajú). */
export function polozkySoZaverecnou(polozky: readonly PolozkaVykladania[]): readonly PolozkaVykladania[] {
  const posledna = polozky.map((x) => x.ciel !== "priznanie").lastIndexOf(true);
  return polozky.map((x, i) => (i === posledna ? { ...x, zaverecna: true as const } : x));
}

/** Príkazy ťahu so Záverečnou, alebo krátky dôvod, prečo sa to teraz nedá. */
export function tahSoZaverecnou(data: GameData, view: ClientState, ja: PlayerId, polozky: readonly PolozkaVykladania[]): TahSoZaverecnou {
  const nie = (dovod: string): TahSoZaverecnou => ({ kroky: null, dovod });
  const z = view.zhromazdenieStav;
  if (view.faza !== "zhromazdenie" || z === null) return nie("Záverečná sa hrá len v Zhromaždení.");
  // Záverečná z minulej Pitky sa na jej konci otočila — skrytá vlastná je teda z tohto Zhromaždenia.
  if (view.zaverecne.some((x) => x.majitel === ja)) return nie("Záverečná z tohto Zhromaždenia už leží na stole — druhá nejde.");
  if (z.pasoval[ja]) return nie("V tomto Zhromaždení už nevykladáš.");
  if (view.hraci[ja].cigarety < KONSTANTY.CENA_ZAVERECNEJ) return nie(`Záverečná stojí ${cigariet(KONSTANTY.CENA_ZAVERECNEJ)} — nemáš.`);
  const tahove = polozky.filter((x) => x.ciel !== "priznanie");
  if (tahove.length === 0) return nie("Najprv polož kartu na stôl — Záverečnou bude posledná karta ťahu.");
  if (tahove[tahove.length - 1]?.ciel === "dedicstvo") return nie("Posledná karta ide do Dedičstva — Záverečná ide len do línie.");
  const plan = planVykladania(data, view, ja, z.zostavaLimit[ja], polozkySoZaverecnou(polozky));
  return plan.chyba === null ? { kroky: plan.kroky, dovod: null } : nie(plan.chyba);
}
