// Hláška, keď hráč pustí kartu z ruky mimo povoleného miesta (playtest výučby 2026-10-23:
// ticho bolo horšie než samo zlyhanie). Musí povedať, čo sa naozaj dá — pri vyčerpanom
// limite odkazovala na „+“, ktoré na stole nebolo, len ⊘ (playtest výučby 20261025, K11).

/** Predpona cieľa „na miesto navrhnutej karty“ (HernaPlocha). */
export const NAHRADIT = "nahradit:";

export interface StavNepolozenej {
  /** Kam smie karta teraz ísť (data-ciel: vlastna, superova, priznanie, dedicstvo, nahradit:<uid>…). */
  readonly ciele: ReadonlySet<string>;
  /** Či je na konci niektorej strany voľné „+“ (nie ⊘). */
  readonly plus: boolean;
  /** Prečo sa na stôl nedá nič vyložiť (dôvod pri ⊘), ak sa nedá. */
  readonly dovodStola: string | null;
  /** Zhromaždenie: hráč môže pasovať do Pitky (pri odpovedi na NA EX nie). */
  readonly pas: boolean;
}

const sBodkou = (t: string): string => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

export function textNepolozenejKarty(s: StavNepolozenej): string {
  const naStol = [...s.ciele].some((c) => c === "vlastna" || c === "superova" || c.startsWith(NAHRADIT));
  if (naStol) return `Karta sa nepoložila. Pusti ju na zvýraznené miesto${s.plus ? " alebo klikni na „+“ a potom na kartu" : ""}.`;
  const dovod = s.dovodStola === null ? "" : ` ${sBodkou(s.dovodStola)}`;
  const inam = s.ciele.has("priznanie") || s.ciele.has("dedicstvo");
  const dalej = inam
    ? s.pas
      ? " Pustiť ju môžeš ešte na zvýraznené miesto mimo stola, inak pasuj (P)."
      : " Pustiť ju môžeš ešte na zvýraznené miesto mimo stola."
    : s.pas
      ? " Ak už nič nevykladáš, pasuj (P)."
      : "";
  return `Na stôl už kartu nevyložíš.${dovod}${dalej}`;
}
