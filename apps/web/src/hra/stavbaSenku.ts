// Výber kariet do Šenku pri stavbe (Michal 2026-10-28, roadmapa #147 a #148): klik kartu
// vyberie do Šenku, ďalší klik výber zruší; pri plnom výbere klik na inú kartu nič neurobí
// (ostatné sú zosivené). Nevybraté karty idú naspodok spoločného balíčka. Pravidlo §5 sa nemení.

/** Výber po kliku na kartu `uid`; `max` = koľko kariet ide do Šenku (krokStavby). */
export function prepniVyber(vybrate: readonly number[], uid: number, max: number): readonly number[] {
  if (vybrate.includes(uid)) return vybrate.filter((u) => u !== uid);
  return vybrate.length >= max ? vybrate : [...vybrate, uid];
}

/** Rozdelenie balíčka podľa výberu — v poradí balíčka, ako ho dostane server (stavbaSenku). */
export function rozdelenieStavby(balicek: readonly { readonly uid: number }[], vybrate: readonly number[]): { readonly doSenku: number[]; readonly odhod: number[] } {
  return {
    doSenku: balicek.filter((k) => vybrate.includes(k.uid)).map((k) => k.uid),
    odhod: balicek.filter((k) => !vybrate.includes(k.uid)).map((k) => k.uid),
  };
}
