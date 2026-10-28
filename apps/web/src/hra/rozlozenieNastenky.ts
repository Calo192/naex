// Veľkosť krčmovej nástenky na stole (Michal 2026-10-28: „nástenku zväčšiť, a to o dosť…
// nech poriadne využíva priestor“). Karta lokality je taká veľká, ako dovolí šírka aj výška
// plste; písmo lístkov, účteniek, popolníkov a päty rastie s ňou (--nk). Od 10 lístkov
// sa nástenka smie zalomiť do dvoch radov, keď sú tak karty väčšie než v jednom rade.
// Bez Reactu, aby sa dalo otestovať.

/** Výška / šírka karty (54 × 80 mm). */
const POMER = 80 / 54;
/** Šírka karty, pri ktorej je písmo nástenky základné (--nk = 1). */
const ZAKLAD = 110;
const NK_MAX = 1.5;
const SIRKA_MAX = 240;
const SIRKA_MIN = 40;
/** Medzera medzi lístkami a vnútorný okraj lístka po bokoch (px). */
const MEDZERA = 14;
const OKRAJ_LISTKA = 14;
/** Menšia karta lokality na lístku je nečitateľná — lístky sú potom bez kariet. */
export const KARTA_MIN = 56;
/** Šírka lístka bez karty (víťaz, názov, účtenka). */
const LISTOK_BEZ_KARTY = 104;
/** Pri voľbe cieľa majú odohrané lístky kartu až od tejto šírky. */
const VYBER_S_KARTOU = 84;
/** Od koľkých lístkov smie nástenka ísť do dvoch radov. */
export const DVA_RADY_OD = 10;

export interface RozmerNastenky {
  /** Šírka karty lokality na lístku v px. */
  readonly sirkaKarty: number;
  /** Šírka karty na výber pri voľbe cieľa (bez víťaza a účtenky — smie byť vyššia). */
  readonly sirkaVyberu: number;
  /** Mierka písma a prvkov okolo kariet (1 = základ). */
  readonly nk: number;
  readonly rady: number;
  /** Lístkov v jednom rade. */
  readonly stlpcov: number;
}

const nkPre = (w: number): number => Math.min(NK_MAX, Math.max(1, w / ZAKLAD));
/** Popolníky hore, päta dole a okraje zoznamu. */
const okolie = (nk: number): number => 36 + 68 * nk;
/** Lístok okrem karty: okraje, víťaz, názov a účtenka (≈ 4 riadky). */
const listokBezKarty = (nk: number): number => 32 + 105 * nk;

function najvacsia(sirka: number, vyska: number, listkov: number, rady: number): number {
  const stlpcov = Math.max(1, Math.ceil(listkov / rady));
  const vyskaPre = (w: number): number => {
    const nk = nkPre(w);
    return okolie(nk) + rady * (listokBezKarty(nk) + w * POMER) + (rady - 1) * MEDZERA;
  };
  const sirkaPre = (w: number): number => stlpcov * (w + OKRAJ_LISTKA) + (stlpcov - 1) * MEDZERA + 24;
  let w = SIRKA_MAX;
  while (w > SIRKA_MIN && (vyskaPre(w) > vyska || sirkaPre(w) > sirka)) w -= 2;
  return w;
}

/**
 * Najväčšia karta, pri ktorej sa nástenka zmestí do plochy `sirka` × `vyska` (vnútro vrstvy
 * nástenky). `naVyber` = koľko z lístkov sú karty na výber (voľba cieľa) — tie nemajú
 * víťaza ani účtenku, preto smú byť vyššie, kým sa rad zmestí do šírky.
 */
export function rozmerNastenky(sirka: number, vyska: number, listkov: number, naVyber = 0): RozmerNastenky {
  const jeden = najvacsia(sirka, vyska, listkov, 1);
  const dva = listkov >= DVA_RADY_OD ? najvacsia(sirka, vyska, listkov, 2) : 0;
  // Dva rady len vtedy, keď v nich budú karty väčšie a čitateľné — inak jeden rad lístkov.
  const rady = dva > jeden && dva >= KARTA_MIN ? 2 : 1;
  const zRadu = rady === 2 ? dva : jeden;
  // Pri voľbe cieľa sú hlavné karty na výber; odohrané lístky s drobnou kartou by sa úzkym
  // textom natiahli do výšky — pod VYBER_S_KARTOU sú bez karty (šírka podľa textu).
  const w = naVyber > 0 && zRadu < VYBER_S_KARTOU ? 0 : zRadu;
  const nk = nkPre(zRadu);
  const stlpcov = Math.max(1, Math.ceil(listkov / rady));
  let sirkaVyberu = Math.max(w, zRadu);
  if (naVyber > 0 && rady === 1) {
    const sirkaListka = w >= KARTA_MIN ? w + OKRAJ_LISTKA : LISTOK_BEZ_KARTY;
    // Karta na výber nemá víťaza ani účtenku — nad ňou sú len popolníky, pod ňou päta.
    const podlaVysky = (vyska - 24 - 66 * nk) / POMER;
    // Rezerva 6 % na naklonené lístky a okraje kariet — rad sa nesmie zalomiť.
    const zvysok = (sirka - 48 - (listkov - 1) * MEDZERA - (listkov - naVyber) * sirkaListka) * 0.94;
    sirkaVyberu = Math.max(zRadu, Math.floor(Math.min(SIRKA_MAX, podlaVysky, zvysok / naVyber)));
  }
  return { sirkaKarty: w, sirkaVyberu, nk: Math.round(nk * 100) / 100, rady, stlpcov };
}
