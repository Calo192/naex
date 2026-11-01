// Výber kariet do Šenku pri stavbe (Michal 2026-10-28, roadmapa #147 a #148): klik kartu
// vyberie do Šenku, ďalší klik výber zruší; pri plnom výbere klik na inú kartu nič neurobí
// (ostatné sú zosivené). Nevybraté karty idú naspodok Náradia a Občanov (v8.5). Pravidlo §5 sa nemení.
// Karta zadarmo (v10.1): kto ju má, prvým klikom vyberie kartu do ruky, ďalšími do Šenku.

/** Výber po kliku na kartu `uid`; `max` = koľko kariet ide do Šenku (krokStavby). */
export function prepniVyber(vybrate: readonly number[], uid: number, max: number): readonly number[] {
  if (vybrate.includes(uid)) return vybrate.filter((u) => u !== uid);
  return vybrate.length >= max ? vybrate : [...vybrate, uid];
}

/** Výber stavby s kartou zadarmo: karty do Šenku a karta, ktorú si hráč nechá do ruky. */
export interface VyberSNechanim {
  readonly doSenku: readonly number[];
  readonly nechaj: number | null;
}

/**
 * Klik pri stavbe s kartou zadarmo: klik na nechanú kartu ju vráti; kým nechaná nie je,
 * klik na nevybratú kartu ju nechá do ruky; inak klik prepína výber do Šenku.
 */
export function prepniSNechanim(v: VyberSNechanim, uid: number, max: number, zadarmo: boolean): VyberSNechanim {
  if (zadarmo && v.nechaj === uid) return { ...v, nechaj: null };
  if (zadarmo && v.nechaj === null && !v.doSenku.includes(uid)) return { ...v, nechaj: uid };
  return { ...v, doSenku: prepniVyber(v.doSenku, uid, max) };
}

/** Rozdelenie balíčka podľa výberu — v poradí balíčka, ako ho dostane server (stavbaSenku). */
export function rozdelenieStavby(
  balicek: readonly { readonly uid: number }[],
  vybrate: readonly number[],
  nechaj: number | null = null,
): { readonly doSenku: number[]; readonly odhod: number[] } {
  return {
    doSenku: balicek.filter((k) => vybrate.includes(k.uid)).map((k) => k.uid),
    odhod: balicek.filter((k) => !vybrate.includes(k.uid) && k.uid !== nechaj).map((k) => k.uid),
  };
}
