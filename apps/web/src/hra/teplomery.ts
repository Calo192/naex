// Starší na stole v11 Strach a reči (Michal 2026-11-02, docs/napady/strach-reci-mocky.html,
// mock 3 Teplomery a mock 5 Pult). Bez Reactu, aby sa dalo otestovať: rad starších s väzňami
// na ich mieste a rozdeľovanie Nakladačky (strach) a hádky (reči) klikom na stupeň.
//
// Rozdelenie drží klient ako zdvihy (Zdvih[]) a posiela ich jedným zámerom; či ich server
// prijme, ráta jadro (planRozdelenia) — klik tu len navrhne nové zdvihy a nikdy nepustí
// rozdelenie drahšie, než sú body.

import type { ClientState, DruhMarkera, ElderState, PlayerId, StarsiVerejne, Stupen, Vazen, Zdvih } from "@naex/core";
import { CERVENA, KONSTANTY, bodyRozdelenia, cenaDalsiehoStupna, cenaDvihnutia, krokRozdelenia, markerRozdelenia, planRozdelenia, stupenOdkial } from "@naex/core";

/** Miesto v rade starších: starší na stupnici, alebo väzeň na mieste svojho ukazovateľa. */
export type MiestoVRade = { readonly typ: "starsi"; readonly elder: StarsiVerejne } | { readonly typ: "vazen"; readonly vazen: Vazen };

/** Rad starších ako na stole: väzni ostanú na svojom mieste (Vazen.miesto) ako prázdne miesto. */
export function radStarsich(starsi: readonly StarsiVerejne[], vazni: readonly Vazen[]): readonly MiestoVRade[] {
  const n = starsi.length + vazni.length;
  const out: MiestoVRade[] = [];
  let i = 0;
  for (let m = 0; m < n; m++) {
    const v = vazni.find((x) => x.miesto === m);
    if (v !== undefined) out.push({ typ: "vazen", vazen: v });
    else if (i < starsi.length) out.push({ typ: "starsi", elder: starsi[i++]! });
  }
  // Miesto mimo radu (archívna partia) — zvyšok na koniec, nech nikto nezmizne.
  for (; i < starsi.length; i++) out.push({ typ: "starsi", elder: starsi[i]! });
  for (const v of vazni) if (!out.some((x) => x.typ === "vazen" && x.vazen.elderId === v.elderId)) out.push({ typ: "vazen", vazen: v });
  return out;
}

/** Špaky za stupeň (žltá 1, oranžová 3, červená 5) — číslo v bubline rečí. */
export const spakyStupna = (s: number): number => KONSTANTY.SPAKY_ZA_STUPEN[s] ?? 0;

// ---------------------------------------------------------------------------
// Rozdeľovanie klikom na stupeň

type StavPreRozdelenie = Pick<ClientState, "starsi" | "pokusy" | "bitkaStav">;

/** Stupeň pri staršom v rozdeľovaní: čo by klik urobil a za koľko. */
export interface StupenRozdelenia {
  readonly stupen: 1 | 2 | 3;
  /**
   * pod = už ho mám (strach, pri rečiach aj strach pod nimi), vybrany = v nepotvrdenom zdvihu,
   * dosah = zvyšok naň stačí, mimo = nestačí, zamknuty = tu sa nedvíha (v ohrození, červená).
   */
  readonly stav: "pod" | "vybrany" | "dosah" | "mimo" | "zamknuty";
  /** Cena od terajšieho stupňa po tento (1 / 2 / 3 za každý stupeň). */
  readonly cena: number;
}

/** Marker, ktorý hráč ja v práve čakajúcom kroku dvíha, a body naň; null = nerozdeľuje. */
export function rozdelenieHraca(view: StavPreRozdelenie, ja: PlayerId): { readonly krok: "prebytok" | "reci"; readonly marker: DruhMarkera; readonly body: number } | null {
  const krok = krokRozdelenia(view, ja);
  return krok === null ? null : { krok, marker: markerRozdelenia(krok), body: bodyRozdelenia(view, ja) };
}

const cenaZdvihov = (view: StavPreRozdelenie, ja: PlayerId, marker: DruhMarkera, zdvihy: readonly Zdvih[]): number =>
  zdvihy.reduce((a, z) => {
    const e = view.starsi.find((x) => x.elderId === z.elderId);
    return e === undefined ? a : a + cenaDvihnutia(stupenOdkial(e, ja, marker), z.na);
  }, 0);

/** Stupne 1–3 pri staršom: ktoré mám, ktoré sú vo výbere a na ktoré zvyšok stačí. */
export function stupneRozdelenia(view: StavPreRozdelenie, ja: PlayerId, zdvihy: readonly Zdvih[], elderId: string): readonly StupenRozdelenia[] {
  const r = rozdelenieHraca(view, ja);
  const e = view.starsi.find((x) => x.elderId === elderId);
  if (r === null || e === undefined) return [];
  const od = stupenOdkial(e, ja, r.marker);
  const zamknuty = cenaDalsiehoStupna(e, view.pokusy, ja, r.marker) === null;
  const moj = zdvihy.find((z) => z.elderId === elderId)?.na ?? od;
  // Zvyšok pre tohto staršieho: body mínus zdvihy ostatných.
  const volne = r.body - cenaZdvihov(view, ja, r.marker, zdvihy.filter((z) => z.elderId !== elderId));
  return ([1, 2, 3] as const).map((s) => {
    const cena = s > od ? cenaDvihnutia(od, s) : 0;
    const stav: StupenRozdelenia["stav"] = s <= od ? "pod" : zamknuty ? "zamknuty" : s <= moj ? "vybrany" : cena <= volne ? "dosah" : "mimo";
    return { stupen: s, stav, cena };
  });
}

/**
 * Klik na stupeň `s` pri staršom: zdvihne marker naň, klik na najvyšší vybraný ho o stupeň
 * vráti (pod terajší stupeň zdvih zmizne). Keď zvyšok na `s` nestačí, zdvihne tak vysoko, ako
 * stačí; keď ani o stupeň, nič sa nezmení.
 */
export function klikNaStupen(view: StavPreRozdelenie, ja: PlayerId, zdvihy: readonly Zdvih[], elderId: string, s: number): readonly Zdvih[] {
  const r = rozdelenieHraca(view, ja);
  const e = view.starsi.find((x) => x.elderId === elderId);
  if (r === null || e === undefined || cenaDalsiehoStupna(e, view.pokusy, ja, r.marker) === null) return zdvihy;
  const od = stupenOdkial(e, ja, r.marker);
  if (s <= od || s > CERVENA) return zdvihy;
  const ostatne = zdvihy.filter((z) => z.elderId !== elderId);
  const teraz = zdvihy.find((z) => z.elderId === elderId)?.na ?? od;
  let na = s === teraz ? s - 1 : s;
  const volne = r.body - cenaZdvihov(view, ja, r.marker, ostatne);
  while (na > od && cenaDvihnutia(od, na) > volne) na--;
  if (na <= od) return s === teraz ? ostatne : zdvihy;
  const novy: Zdvih = { elderId, na: na as Stupen };
  // Poradie zdvihov drží poradie klikov — nový starší ide na koniec.
  return zdvihy.some((z) => z.elderId === elderId) ? zdvihy.map((z) => (z.elderId === elderId ? novy : z)) : [...zdvihy, novy];
}

/** Stav rozdelenia pre bublinu a tlačidlá: koľko ide, koľko ostáva, čo prepadne, či sa dá potvrdiť. */
export interface SuhrnRozdelenia {
  readonly krok: "prebytok" | "reci";
  readonly marker: DruhMarkera;
  readonly body: number;
  readonly cena: number;
  readonly zvysok: number;
  /** Starší, na ktorých by zvyšok ešte stačil — kým nie je prázdne, Potvrdiť nejde. */
  readonly esteSaDa: readonly string[];
  /** Body, ktoré po potvrdení prepadnú (zvyšok už nikam nestačí). */
  readonly prepadne: number;
  /** Zámer pre server — len úplné rozdelenie (server iné neprijme). */
  readonly prikaz: Extract<ReturnType<typeof planRozdelenia>, object>["prikaz"];
  readonly chyba: string | null;
}

export function suhrnRozdelenia(view: Parameters<typeof planRozdelenia>[0], ja: PlayerId, zdvihy: readonly Zdvih[]): SuhrnRozdelenia | null {
  const krok = krokRozdelenia(view, ja);
  const plan = planRozdelenia(view, ja, zdvihy);
  if (krok === null || plan === null) return null;
  return {
    krok,
    marker: plan.marker,
    body: plan.body,
    cena: plan.cena,
    zvysok: plan.zvysok,
    esteSaDa: plan.esteSaDa,
    prepadne: plan.chyba === null && plan.esteSaDa.length === 0 ? plan.zvysok : 0,
    prikaz: plan.prikaz,
    chyba: plan.chyba,
  };
}

/** Zdvih staršieho v rozdelení: zo stupňa na stupeň (náhľad na karte a v Pulte). */
export function zdvihStarsieho(e: Pick<ElderState, "elderId" | "strach" | "reci">, ja: PlayerId, marker: DruhMarkera, zdvihy: readonly Zdvih[]): { readonly z: Stupen; readonly na: Stupen; readonly cena: number } | null {
  const zd = zdvihy.find((x) => x.elderId === e.elderId);
  if (zd === undefined) return null;
  const z = stupenOdkial(e, ja, marker);
  return { z, na: zd.na, cena: cenaDvihnutia(z, zd.na) };
}
