// Veľkosť krčmovej nástenky na stole (Michal 2026-10-28: „nástenku zväčšiť, a to o dosť…
// nech poriadne využíva priestor“). Karta lokality je taká veľká, ako dovolí šírka aj výška
// plste; písmo lístkov, účteniek, popolníkov a päty rastie s ňou (--nk). Od 10 lístkov
// sa nástenka smie zalomiť do dvoch radov, keď sú tak karty väčšie než v jednom rade.
// Bez Reactu, aby sa dalo otestovať.

/** Výška / šírka karty (54 × 80 mm). */
export const POMER = 80 / 54;
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

/**
 * Lístok lokality na výber (Leader 2026-10-30: na 1366 × 650 boli karty 105 px a efekt 5 px).
 * Karta s čitateľným efektom by mala ~260 px, na takú výška stola nestačí — lístok preto
 * nesie ilustráciu karty s akciami na hranách a pod ňou názov a efekt písmom stola.
 * Ilustrácia sa smie orezať zhora a zdola, akcie sú v jej strede. Lístok má vždy pomer strán
 * karty (Michal 2026-10-31: „hráč vidí ‚zmrštené‘ karty“) — keď sa nezmestí, zmenší sa celý.
 */
export interface ListokNaVyber {
  /** Šírka lístka v px. */
  readonly sirka: number;
  /** Výška lístka v px = šírka × pomer karty. */
  readonly vyska: number;
  /** Šírka karty, z ktorej je ilustrácia (= strana štvorca ilustrácie). */
  readonly obraz: number;
  /** Odohrané bitky sú krátke lístky (bez karty a účtenky) v dvoch radoch nad sebou. */
  readonly kratkeBitky: boolean;
  /** Popolníky so skóre stoja vedľa radu (nízky stôl), nie nad ním. */
  readonly popolnikyVedla: boolean;
}

const LISTOK_VYBERU_MAX = 300;
/** Pod touto šírkou sa efekt na lístku nezmestí čitateľne ani pod ilustráciu. */
const LISTOK_VYBERU_MIN = 110;
/** Najnižšia ilustrácia na lístku ako podiel jej šírky — akcie na hranách sú v strednej polovici. */
export const OREZ_MIN = 0.6;
/** Lístky na výber aspoň takto široké nechajú odohrané bitky v plnej podobe. */
const LISTOK_PLNY_PRAH = 170;
/** Šírky ostatných lístkov pri voľbe cieľa (px): odohraná bitka bez karty s účtenkou, krátka
 *  bitka a finále bez karty. Koniec má pri voľbe veľkosť karty na výber (Michal 2026-10-31). */
const LISTOK_ODOHRANY = 132;
const LISTOK_KRATKY = 84;
const MEDZERA_KRATKYCH = 8;
const LISTOK_FINALE = 60;
/** Šírka stĺpca popolníkov vedľa radu pri --nk = 1 (spaky.css .nastenka-ucet.vedla). */
export const POPOLNIKY_VEDLA = 150;
/** Popolníky vedľa radu len na nízkom stole (notebooky) — na veľkej obrazovke ostanú nad ním. */
const NIZKA_NASTENKA = 400;

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
  /** Lístky lokalít na výber (voľba cieľa v jednom rade), inak null — karty ako doteraz. */
  readonly vyber: ListokNaVyber | null;
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
 * nástenky). `naVyber` = koľko z lístkov sú lokality na výber (voľba cieľa) — tie sú lístky
 * s čitateľným efektom (ListokNaVyber), ak sa dajú; `odohranych` = lístky odohraných bitiek.
 */
export function rozmerNastenky(sirka: number, vyska: number, listkov: number, naVyber = 0, odohranych = 0): RozmerNastenky {
  const jeden = najvacsia(sirka, vyska, listkov, 1);
  if (naVyber > 0) {
    const s = sListkamiNaVyber(sirka, vyska, listkov, naVyber, odohranych, jeden);
    if (s !== null) return s;
  }
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
    // Koniec (posledný lístok) má veľkosť karty na výber. Rezerva 6 % na naklonené lístky
    // a okraje kariet — rad sa nesmie zalomiť.
    const koniec = listkov > naVyber ? 1 : 0;
    const zvysok = (sirka - 48 - (listkov - 1) * MEDZERA - (listkov - naVyber - koniec) * sirkaListka) * 0.94;
    sirkaVyberu = Math.max(zRadu, Math.floor(Math.min(SIRKA_MAX, podlaVysky, zvysok / (naVyber + koniec))));
  }
  return { sirkaKarty: w, sirkaVyberu, nk: Math.round(nk * 100) / 100, rady, stlpcov, vyber: null };
}

/**
 * Voľba cieľa s lístkami na výber v jednom rade. Odohrané bitky a finále sú bez kariet —
 * karta s účtenkou pod ňou by bola vyššia než rad (Zberný dvor s Exekútorom); Koniec má
 * veľkosť karty na výber (Michal 2026-10-31). Keď by aj tak lokalitám na výber nechali málo
 * miesta (finále dlhej hry), sú odohrané bitky krátke — bez účtenky, v dvoch radoch nad sebou.
 */
function sListkamiNaVyber(sirka: number, vyska: number, listkov: number, naVyber: number, odohranych: number, jeden: number): RozmerNastenky | null {
  const nk = nkPre(jeden);
  // Nad radom sú popolníky (52 px pri --nk = 1) a okraje zoznamu. Na nízkom stole (Michal
  // 2026-10-31) môžu stáť vedľa radu — rad dostane celú výšku, ak tak budú karty väčšie.
  const nad = radNaVyber(sirka, Math.floor(vyska - 20 - 60 * nk), listkov, naVyber, odohranych, false);
  const vedla = vyska < NIZKA_NASTENKA ? radNaVyber(sirka - Math.round(POPOLNIKY_VEDLA * nk) - MEDZERA, Math.floor(vyska - 20), listkov, naVyber, odohranych, true) : null;
  const vyber = vedla !== null && (nad === null || vedla.sirka > nad.sirka) ? vedla : nad;
  if (vyber === null) return null;
  return { sirkaKarty: 0, sirkaVyberu: vyber.obraz, nk: Math.round(nk * 100) / 100, rady: 1, stlpcov: listkov, vyber };
}

/** Lístky na výber v jednom rade šírky `sirka` a výšky `vyskaRadu`, alebo null, keď by boli nečitateľné. */
function radNaVyber(sirka: number, vyskaRadu: number, listkov: number, naVyber: number, odohranych: number, popolnikyVedla: boolean): ListokNaVyber | null {
  // Finále a Koniec (Koniec je vždy posledný a delí sa o šírku s lokalitami na výber).
  const ostatnych = Math.max(0, listkov - naVyber - odohranych);
  const kariet = naVyber + (ostatnych > 0 ? 1 : 0);
  const finale = Math.max(0, ostatnych - 1) * LISTOK_FINALE;
  const listok = (sirkaOstatnych: number, poloziek: number): ListokNaVyber | null => {
    // Rezerva 6 % na naklonené lístky — rad sa nesmie zalomiť.
    const naListok = ((sirka - 48 - (poloziek - 1) * MEDZERA - sirkaOstatnych) * 0.94) / kariet;
    // Pomer strán karty: nízky rad zúži aj lístok — zmenší sa celý, nikdy nie len na výšku.
    const w = Math.floor(Math.min(LISTOK_VYBERU_MAX, naListok, vyskaRadu / POMER));
    return w >= LISTOK_VYBERU_MIN ? { sirka: w, vyska: Math.round(w * POMER), obraz: w, kratkeBitky: false, popolnikyVedla } : null;
  };
  const plne = listok(odohranych * LISTOK_ODOHRANY + finale, listkov);
  const stlpcovKratkych = Math.ceil(odohranych / 2);
  const kratke = odohranych === 0 ? null : listok(stlpcovKratkych * LISTOK_KRATKY + (stlpcovKratkych - 1) * MEDZERA_KRATKYCH + finale, naVyber + ostatnych + 1);
  return plne !== null && (plne.sirka >= LISTOK_PLNY_PRAH || kratke === null || kratke.sirka <= plne.sirka) ? plne : kratke === null ? null : { ...kratke, kratkeBitky: true };
}
