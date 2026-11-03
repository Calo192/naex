// Rozdelenie Nakladačky a hádky (v11 Strach a reči, Michal 2026-11-02): víťaz bitky rozdelí
// body Nakladačky na svoj strach, víťaz hádky body hádky na svoje reči — ľubovoľne medzi
// starších, stupeň za 1 / 2 / 3 (cenaDvihnutia). Rozdelí sa, čo sa dá, zvyšok prepadne:
// po rozdelení nesmie ostať zvyšok, ktorý by ešte stačil na ďalší stupeň niektorého staršieho.
//
// Akcie rozdelenia (v11.4, Michal 2026-11-03): za CENA_ZAJATIA bodov Nakladačky smie držiteľ
// zajať staršieho, ktorý sa ho po zdvihoch bojí na červenej; za CENA_PRESVEDCENIA bodov hádky
// smie víťaz hádky presvedčiť staršieho, pri ktorom má súper vyšší strach a jeho reči sú po
// zdvihoch na červenej. Obe sú dobrovoľné (do „rozdeľ, čo sa dá“ sa nerátajú) a smie ich byť viac.
//
// Klient drží rozpracované zdvihy a akcie a pošle ich jedným zámerom ({ type: "prebytok",
// zdvihy, zajatia } | { type: "reci", zdvihy, presvedcenia }); server ich overí tou istou
// funkciou (overRozdelenie), takže náhľad v klientovi ukáže presne to, čo server prijme.

import type { BitkaKrok, Command } from "./engine.ts";
import type { DruhMarkera, ElderState, Stupen, Zdvih } from "./elders.ts";
import { CERVENA, cenaDvihnutia, moznyZdvih, sMarkerom, stupenOdkial } from "./elders.ts";
import { KONSTANTY } from "./constants.ts";
import type { PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";

type StarsiRozdelenia = Pick<ElderState, "elderId" | "strach" | "reci" | "presvedcil">;

/** Čo rozdelenie potrebuje zo stavu — ClientState aj GameState. */
export interface StavRozdelenia {
  readonly starsi: readonly StarsiRozdelenia[];
  readonly bitkaStav: {
    readonly krok: BitkaKrok | null;
    readonly caka: PlayerId | null;
    readonly prebytokDrzi: PlayerId | null;
    readonly prebytokZostava: number;
    readonly hadka?: { readonly vitaz: PlayerId | null; readonly zostava: number };
  } | null;
}

/** Krok bitky, v ktorom sa rozdeľuje: prebytok = Nakladačka na strach, reci = hádka na reči. */
export type DruhRozdelenia = "prebytok" | "reci";

/** Marker, ktorý krok dvíha. */
export function markerRozdelenia(krok: DruhRozdelenia): DruhMarkera {
  return krok === "prebytok" ? "strach" : "reci";
}

/** Krok, v ktorom hráč p práve rozdeľuje, alebo null. */
export function krokRozdelenia(state: Pick<StavRozdelenia, "bitkaStav">, p: PlayerId): DruhRozdelenia | null {
  const b = state.bitkaStav;
  if (b === null || b.caka !== p) return null;
  if (b.krok === "prebytok" && b.prebytokDrzi === p && b.prebytokZostava > 0) return "prebytok";
  if (b.krok === "reci" && b.hadka?.vitaz === p && b.hadka.zostava > 0) return "reci";
  return null;
}

/** Body na rozdelenie v kroku (Nakladačka alebo hádka). */
export function bodyRozdelenia(state: Pick<StavRozdelenia, "bitkaStav">, p: PlayerId): number {
  const krok = krokRozdelenia(state, p);
  const b = state.bitkaStav;
  if (krok === null || b === null) return 0;
  return krok === "prebytok" ? b.prebytokZostava : (b.hadka?.zostava ?? 0);
}

/** Cena ďalšieho stupňa markera hráča p pri staršom, alebo null (marker je na červenej). */
export function cenaDalsiehoStupna(elder: Pick<ElderState, "strach" | "reci">, p: PlayerId, marker: DruhMarkera): number | null {
  const z = moznyZdvih(elder, p, marker);
  return z === null ? null : cenaDvihnutia(z.od, z.od + 1);
}

/** Cena akcie rozdelenia: zajatie pri strachu, presvedčenie pri rečiach (v11.4). */
export function cenaAkcieRozdelenia(marker: DruhMarkera): number {
  return marker === "strach" ? KONSTANTY.CENA_ZAJATIA : KONSTANTY.CENA_PRESVEDCENIA;
}

/**
 * Prečo hráč p pri tomto staršom akciu rozdelenia (zajatie / presvedčenie) neurobí bez ohľadu
 * na body — null = smie, keď dotiahne marker na červenú. Zajať sa dá každého staršieho na
 * stupnici (aj presvedčeného, aj vlastného presvedčeného); presvedčiť len nepresvedčeného,
 * pri ktorom má súper vyšší strach.
 */
export function dovodBezAkcie(elder: StarsiRozdelenia, p: PlayerId, marker: DruhMarkera): string | null {
  if (marker === "strach") return null;
  if (elder.presvedcil !== undefined) return "Tohto staršieho už niekto presvedčil.";
  if (elder.strach[opponentOf(p)] <= elder.strach[p]) return "Presvedčiť sa dá len staršieho, ktorý sa súpera bojí viac než teba.";
  return null;
}

/**
 * Celá cena akcie pri staršom: dotiahnutie markera na červenú za bežnú cenu + cena akcie;
 * null = akcia tu nejde (dovodBezAkcie).
 */
export function cenaAkcieUplna(elder: StarsiRozdelenia, p: PlayerId, marker: DruhMarkera): number | null {
  if (dovodBezAkcie(elder, p, marker) !== null) return null;
  return cenaDvihnutia(stupenOdkial(elder, p, marker), CERVENA) + cenaAkcieRozdelenia(marker);
}

/** Overené rozdelenie: čo sa zmení a koľko prepadne. */
export interface PlanRozdelenia {
  readonly marker: DruhMarkera;
  readonly body: number;
  /** Zdvihy so stupňom odkiaľ a cenou, v poradí zámeru. */
  readonly zdvihy: readonly { readonly elderId: string; readonly z: Stupen; readonly na: Stupen; readonly cena: number }[];
  /** Zajatia (strach) či presvedčenia (reči) — starší v poradí zámeru (v11.4). */
  readonly akcie: readonly string[];
  /** Cena zdvihov a akcií spolu. */
  readonly cena: number;
  /** Body, ktoré po rozdelení ostanú a prepadnú. */
  readonly zvysok: number;
  /**
   * Starší, na ktorých by zvyšok ešte stačil (ďalší stupeň). Prázdne = rozdelenie je úplné
   * a server ho prijme; inak ho odmietne („rozdelí sa, čo sa dá“). Akcie sa do toho nerátajú.
   */
  readonly esteSaDa: readonly string[];
  /** Chyba zámeru (neznámy starší, nie nad markerom, akcia bez červenej, cena nad body) — server odmietne. */
  readonly chyba: string | null;
}

/**
 * Overí rozdelenie `zdvihy` a akcie `akcie` bodov `body` na marker hráča p (server aj náhľad
 * klienta). Každý starší v zdvihoch najviac raz, na stupeň vyšší, ako je teraz (reči nad
 * strachom); akcia pri staršom, ktorého marker je po zdvihoch na červenej; cena spolu najviac
 * body; po rozdelení zvyšok nesmie stačiť na ďalší stupeň.
 */
export function overRozdelenie(
  state: Pick<StavRozdelenia, "starsi">,
  p: PlayerId,
  marker: DruhMarkera,
  body: number,
  zdvihy: readonly Zdvih[],
  akcie: readonly string[] = [],
): PlanRozdelenia {
  const vysledok: { elderId: string; z: Stupen; na: Stupen; cena: number }[] = [];
  let chyba: string | null = null;
  const videne = new Set<string>();
  let cena = 0;
  for (const zd of zdvihy) {
    const elder = state.starsi.find((e) => e.elderId === zd.elderId);
    if (elder === undefined) {
      chyba ??= "Taký starší na stupnici nie je.";
      continue;
    }
    if (videne.has(zd.elderId)) {
      chyba ??= "Každého staršieho uveď v rozdelení najviac raz.";
      continue;
    }
    videne.add(zd.elderId);
    const z = stupenOdkial(elder, p, marker);
    if (!Number.isInteger(zd.na) || zd.na <= z || zd.na > CERVENA) {
      chyba ??= marker === "reci" ? "Reči idú len nad tvoj strach a najvyššie na červenú." : "Strach sa dá len zdvihnúť, najvyššie na červenú.";
      continue;
    }
    const c = cenaDvihnutia(z, zd.na);
    cena += c;
    vysledok.push({ elderId: zd.elderId, z, na: zd.na, cena: c });
  }
  const po = state.starsi.map((e) => {
    const zd = vysledok.find((x) => x.elderId === e.elderId);
    return zd === undefined ? e : sMarkerom(e, p, marker, zd.na);
  });
  const akcieOk: string[] = [];
  for (const id of akcie) {
    const elder = po.find((e) => e.elderId === id);
    if (elder === undefined) {
      chyba ??= "Taký starší na stupnici nie je.";
      continue;
    }
    if (akcieOk.includes(id)) {
      chyba ??= "Každého staršieho uveď v rozdelení najviac raz.";
      continue;
    }
    const dovod = dovodBezAkcie(elder, p, marker);
    if (dovod !== null) {
      chyba ??= dovod;
      continue;
    }
    if (stupenOdkial(elder, p, marker) !== CERVENA) {
      chyba ??= marker === "strach" ? "Zajať sa dá len staršieho, ktorý sa ťa bojí na červenej — dotiahni strach na červenú." : "Presvedčiť sa dá len s rečami na červenej — dotiahni reči na červenú.";
      continue;
    }
    akcieOk.push(id);
    cena += cenaAkcieRozdelenia(marker);
  }
  if (chyba === null && cena > body) chyba = `Rozdelenie stojí ${cena}, máš len ${body}.`;
  const zvysok = Math.max(0, body - cena);
  const esteSaDa = po.filter((e) => {
    const c = cenaDalsiehoStupna(e, p, marker);
    return c !== null && c <= zvysok;
  }).map((e) => e.elderId);
  return { marker, body, zdvihy: vysledok, akcie: akcieOk, cena, zvysok, esteSaDa, chyba };
}

/** Zámer rozdelenia v kroku `krok` — akcie idú do zajatia (Nakladačka) či presvedčenia (hádka). */
export function prikazRozdelenia(krok: DruhRozdelenia, zdvihy: readonly Zdvih[], akcie: readonly string[]): Command {
  if (krok === "prebytok") return { type: "prebytok", zdvihy, ...(akcie.length > 0 ? { zajatia: akcie } : {}) };
  return { type: "reci", zdvihy, ...(akcie.length > 0 ? { presvedcenia: akcie } : {}) };
}

/** Plán rozdelenia z pohľadu hráča p v práve čakajúcom kroku (null = p nerozdeľuje). */
export function planRozdelenia(
  state: StavRozdelenia,
  p: PlayerId,
  zdvihy: readonly Zdvih[],
  akcie: readonly string[] = [],
): (PlanRozdelenia & { readonly prikaz: Command | null }) | null {
  const krok = krokRozdelenia(state, p);
  if (krok === null) return null;
  const plan = overRozdelenie(state, p, markerRozdelenia(krok), bodyRozdelenia(state, p), zdvihy, akcie);
  const ok = plan.chyba === null && plan.esteSaDa.length === 0;
  return { ...plan, prikaz: ok ? prikazRozdelenia(krok, plan.zdvihy.map((z) => ({ elderId: z.elderId, na: z.na })), plan.akcie) : null };
}

/** Dá sa body vôbec niekam minúť (aspoň jeden stupeň niektorého staršieho)? */
export function rozdelenieMozne(state: Pick<StavRozdelenia, "starsi">, p: PlayerId, marker: DruhMarkera, body: number): boolean {
  return overRozdelenie(state, p, marker, body, []).esteSaDa.length > 0;
}

/** Starší, pri ktorých sa na body ešte dá akcia rozdelenia (zajatie / presvedčenie) aj s dotiahnutím na červenú. */
export function moznostiAkcie(state: Pick<StavRozdelenia, "starsi">, p: PlayerId, marker: DruhMarkera, body: number): readonly string[] {
  return state.starsi.filter((e) => {
    const c = cenaAkcieUplna(e, p, marker);
    return c !== null && c <= body;
  }).map((e) => e.elderId);
}

/**
 * Zdvihy, ktoré akcie vyžadujú — marker každého staršieho v akciách dotiahnutý na červenú
 * (ak tam ešte nie je). Klient ich pridá, keď hráč klikne Zajať či Presvedčiť.
 */
export function zdvihyPreAkcie(state: Pick<StavRozdelenia, "starsi">, p: PlayerId, marker: DruhMarkera, akcie: readonly string[]): readonly Zdvih[] {
  const out: Zdvih[] = [];
  for (const id of akcie) {
    const e = state.starsi.find((x) => x.elderId === id);
    if (e !== undefined && stupenOdkial(e, p, marker) < CERVENA) out.push({ elderId: id, na: CERVENA });
  }
  return out;
}

/**
 * Výbery akcií, ktoré sa na body zmestia (každá podmnožina možných, bez prázdnej) — ponuka
 * pre bota a testy, najviac `limit`.
 */
export function vyberyAkcii(state: Pick<StavRozdelenia, "starsi">, p: PlayerId, marker: DruhMarkera, body: number, limit = 8): readonly (readonly string[])[] {
  const mozne = moznostiAkcie(state, p, marker, body);
  const out: string[][] = [];
  const skus = (i: number, vyber: string[], cena: number): void => {
    if (out.length >= limit) return;
    if (i === mozne.length) {
      if (vyber.length > 0) out.push([...vyber]);
      return;
    }
    const id = mozne[i]!;
    const e = state.starsi.find((x) => x.elderId === id)!;
    const c = cenaAkcieUplna(e, p, marker) ?? Number.POSITIVE_INFINITY;
    if (cena + c <= body) {
      vyber.push(id);
      skus(i + 1, vyber, cena + c);
      vyber.pop();
    }
    skus(i + 1, vyber, cena);
  };
  skus(0, [], 0);
  return out;
}

/**
 * Úplné rozdelenia (žiadny zvyšok, ktorý by ešte niekam stačil) pri daných akciách — ponuka
 * legálnych zámerov pre bota a testy, najviac `limit`. Zdvihy obsahujú aj dotiahnutie
 * starších z akcií na červenú. Prehľadáva starších postupne od každého z nich (inak by
 * ponuka zvýhodnila prvých na stupnici); rovnaké rozdelenie sa neopakuje. Keď sa nedá
 * dvíhať nikde, ponuka je jediné rozdelenie bez ďalších zdvihov (zvyšok prepadne).
 */
export function kandidatiRozdelenia(
  state: Pick<StavRozdelenia, "starsi">,
  p: PlayerId,
  marker: DruhMarkera,
  body: number,
  limit = 48,
  akcie: readonly string[] = [],
): readonly (readonly Zdvih[])[] {
  const vynutene = zdvihyPreAkcie(state, p, marker, akcie);
  const zaklad = overRozdelenie(state, p, marker, body, vynutene, akcie);
  if (zaklad.chyba !== null) return [];
  const st = { starsi: state.starsi.map((e) => {
    const zd = vynutene.find((x) => x.elderId === e.elderId);
    return zd === undefined ? e : sMarkerom(e, p, marker, zd.na);
  }) };
  const zostatok = zaklad.zvysok;
  const uplne = (zdvihy: readonly Zdvih[]): boolean => {
    const plan = overRozdelenie(state, p, marker, body, [...vynutene, ...zdvihy], akcie);
    return plan.chyba === null && plan.esteSaDa.length === 0;
  };
  const volni = st.starsi.filter((e) => cenaDalsiehoStupna(e, p, marker) !== null);
  const out: Zdvih[][] = [];
  const kluce = new Set<string>();
  const naZaciatok = Math.max(1, Math.ceil(limit / Math.max(1, volni.length)));
  for (let r = 0; r < volni.length && out.length < limit; r++) {
    const poradie = [...volni.slice(r), ...volni.slice(0, r)];
    // Koľko sa ešte dá minúť na starších od i-teho ďalej — vetva, ktorej zvyšok by aj tak
    // stačil na ďalší stupeň už prejdeného staršieho, sa nedoprehľadáva.
    const kapacita = poradie.map((e) => cenaDvihnutia(stupenOdkial(e, p, marker), CERVENA));
    for (let i = kapacita.length - 2; i >= 0; i--) kapacita[i]! += kapacita[i + 1]!;
    const zdvihy: Zdvih[] = [];
    let pridane = 0;
    const skus = (i: number, zostava: number, najlacnejsiDalsi: number): void => {
      if (pridane >= naZaciatok || out.length >= limit) return;
      if (zostava - (kapacita[i] ?? 0) >= najlacnejsiDalsi) return;
      if (i === poradie.length) {
        if ((zdvihy.length === 0 && akcie.length === 0) || !uplne(zdvihy)) return;
        const kluc = [...zdvihy].map((z) => `${z.elderId}:${z.na}`).sort().join(",");
        if (kluce.has(kluc)) return;
        kluce.add(kluc);
        out.push([...vynutene, ...zdvihy]);
        pridane++;
        return;
      }
      const e = poradie[i]!;
      const od = stupenOdkial(e, p, marker);
      const dalsi = (na: number): number => (na >= CERVENA ? Number.POSITIVE_INFINITY : cenaDvihnutia(na, na + 1));
      // Vyššie stupne najprv — sústredené rozdelenia prídu na rad skôr než rozdrobené.
      for (let na = CERVENA as number; na > od; na--) {
        const c = cenaDvihnutia(od, na);
        if (c > zostava) continue;
        zdvihy.push({ elderId: e.elderId, na: na as Stupen });
        skus(i + 1, zostava - c, Math.min(najlacnejsiDalsi, dalsi(na)));
        zdvihy.pop();
      }
      skus(i + 1, zostava, Math.min(najlacnejsiDalsi, dalsi(od)));
    };
    skus(0, zostatok, Number.POSITIVE_INFINITY);
  }
  if (out.length === 0 && uplne([])) out.push([...vynutene]);
  return out;
}
