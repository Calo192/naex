// Priazeň staršieho v tomto kole (Michal 2026-10-31, mockup „Priazeň podľa Michala“): stôl ukazuje
// priazeň, ktorá v kole naozaj platí (ucinnaPriazen jadra), nie tú z markera. Od pravidiel v10
// „Hádka“ ju v kole mení víťaz hádky — rozdiel mäkkého poškodenia rozdelí na sily priazní len
// k sebe, marker sa nehýbe a platí to do konca kola. Dátovým zdrojom ostávajú klebety kola.
// Každý prvok odpovedá na inú otázku a neopakuje druhého:
//   krúžok priazne — komu priazeň v tomto kole patrí, akú akciu dáva a akú silnú (výsledok);
//   dvojitý marker — prsteň = strach podľa markera (podľa neho sa skóruje), bodka = priazeň kola;
//   lístok Hádky — kto hádku vyhral (farba) a o koľko stupňov silu posunul (príčina);
//   nápoveda — všetko celou vetou (myš, fokus, podržanie prsta).
// Bez Reactu, aby sa dalo otestovať. Klebety sú verejné a už sú v pohľade — server neposiela nič nové.

import type { BitkaNaNastenke, ElderState, Favour, GameData, Klebety, MarkerPos, PlayerId } from "@naex/core";
import { MARKER_STRED, STUPNICA_ZONY, favourStarsieho, scorecardStarsieho, ucinnaPriazen } from "@naex/core";
import { UCINOK_KRATKO } from "./Scorecard.tsx";
import { riadokStrachu, textStupna } from "./textyStarsich.ts";

/** Komu priazeň patrí z pohľadu hráča, ktorý sa pozerá. */
export type KomuPriazen = "ja" | "su" | null;

/** Priazeň v tomto kole: komu (z pohľadu `ja`) a akej sily; sila 0 = nikto. */
export interface PriazenKola {
  readonly komu: KomuPriazen;
  readonly hrac: PlayerId | null;
  readonly sila: number;
}

type StarsiNaStupnici = Pick<ElderState, "marker" | "elderId">;

const komuZ = (hrac: PlayerId | null, ja: PlayerId): KomuPriazen => (hrac === null ? null : hrac === ja ? "ja" : "su");

/** Účinná priazeň staršieho v tomto kole z pohľadu hráča `ja`. */
export function priazenKola(elder: StarsiNaStupnici, klebety: Klebety | undefined, ja: PlayerId): PriazenKola {
  const u = ucinnaPriazen(elder, klebety);
  return { komu: komuZ(u.hrac, ja), hrac: u.hrac, sila: u.sila };
}

/** Priazeň len z markera (bez hádky) — „z markera“ v nápovede a po konci kola. */
export function priazenMarkera(elder: StarsiNaStupnici, ja: PlayerId): PriazenKola {
  return priazenKola(elder, undefined, ja);
}

/** Priazeň ako pozícia na stupnici (0–6): kam patrí bodka, keď je priazeň `hrac` v sile `sila`. */
function poziciaPriazne(hrac: PlayerId | null, sila: number): MarkerPos {
  const v = hrac === null ? 0 : hrac === 0 ? sila : -sila;
  return (MARKER_STRED - v) as MarkerPos;
}

/** Dvojitý marker na stupnici v zobrazení hráča `ja` (tvoja polovica vľavo). */
export interface DvojityMarker {
  /** Vonkajší neutrálny prsteň: marker (strach, skóruje sa). */
  readonly prsten: number;
  /** Vnútorná bodka: priazeň tohto kola. */
  readonly bodka: number;
  /** Farba bodky: komu priazeň v kole patrí; null = sivá bodka (nikto). */
  readonly komu: KomuPriazen;
  /** Hádka bodku od prsteňa odsunula (do konca kola). */
  readonly posunute: boolean;
}

/** Pozícia na stupnici, ako ju vidí hráč `ja` — každý má svoju polovicu vľavo. */
export const polohaPreHraca = (m: number, ja: PlayerId): number => (ja === 0 ? m : 6 - m);

export function dvojityMarker(elder: StarsiNaStupnici, klebety: Klebety | undefined, ja: PlayerId): DvojityMarker {
  const p = priazenKola(elder, klebety, ja);
  const bodka = poziciaPriazne(p.hrac, p.sila);
  return { prsten: polohaPreHraca(elder.marker, ja), bodka: polohaPreHraca(bodka, ja), komu: p.komu, posunute: bodka !== elder.marker };
}

/**
 * Bodka, kam by ju posunul ďalší bod hádky hráča `ja` (prerušovaná bodka pri výbere staršieho) —
 * null, keď už nie je kam (priazeň je jeho v sile 3).
 */
export function bodkaPoBode(elder: StarsiNaStupnici, klebety: Klebety | undefined, ja: PlayerId): number | null {
  const po = ucinnaPriazen(elder, { ...klebety, [elder.elderId]: (klebety?.[elder.elderId] ?? 0) + (ja === 0 ? 1 : -1) });
  const pred = ucinnaPriazen(elder, klebety);
  if (po.hrac === pred.hrac && po.sila === pred.sila) return null;
  return polohaPreHraca(poziciaPriazne(po.hrac, po.sila), ja);
}

/** Lístok Hádky: kto hádku vyhral (farba) a o koľko stupňov posunul silu priazne k sebe. */
export interface ListokHadky {
  readonly hrac: PlayerId;
  readonly komu: "ja" | "su";
  readonly stupne: number;
}

/**
 * Lístok Hádky na staršom. Hádka posúva silu priazne len k víťazovi (v10), takže znamienko klebiet
 * povie, kto ju vyhral (kladné hráč 0). Aj keď súperovi priazeň zníži alebo preklopí, lístok je vo
 * farbe víťaza — ukazuje príčinu, výsledok nesie krúžok.
 */
export function listokHadky(elderId: string, klebety: Klebety | undefined, ja: PlayerId): ListokHadky | null {
  const n = klebety?.[elderId] ?? 0;
  if (n === 0) return null;
  const hrac: PlayerId = n > 0 ? 0 : 1;
  return { hrac, komu: hrac === ja ? "ja" : "su", stupne: Math.abs(n) };
}

/** Text na lístku: „Hádka +2“. */
export const textListka = (l: ListokHadky): string => `Hádka +${l.stupne}`;

/** Celý popis lístka pre čítačku a titulok. */
export function popisListka(l: ListokHadky, menoSupera: string): string {
  const kto = l.komu === "ja" ? "tvoja hádka" : `hádka — vyhral ${kratkeMeno(menoSupera)}`;
  return `${textListka(l)}: ${kto}, priazeň posunutá hádkou do konca kola`;
}

/** Krátky účinok priazne pre riadok nápovedy („ty: +1 tuhé v bitke“, „nikomu · pri +1: …“). */
export function ucinokKola(fav: Favour, p: PriazenKola, mena: { readonly ja: string; readonly su: string }): { readonly komu: KomuPriazen; readonly kto: string | null; readonly text: string } {
  if (p.komu === null || p.sila <= 0) return { komu: null, kto: null, text: `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` };
  return { komu: p.komu, kto: p.komu === "ja" ? mena.ja : mena.su, text: UCINOK_KRATKO[fav](p.sila) };
}

/** „ty +2“, „Fero +1“, „nikto“ — priazeň v riadku Hádka. */
export function ktoPriazen(p: PriazenKola, mena: { readonly ja: string; readonly su: string }): string {
  return p.komu === null ? "nikto" : `${p.komu === "ja" ? mena.ja : mena.su} +${p.sila}`;
}

const zn = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

/**
 * Riadok Hádka v nápovede: „z markera ty +2 · Fero v hádke −1 · toto kolo ty +1“. Číslo hádky
 * je z pohľadu toho, kto sa pozerá (+ k tebe, − k súperovi).
 */
export function vetaHadky(zMarkera: PriazenKola, listok: ListokHadky, teraz: PriazenKola, menoSupera: string): string {
  const m = { ja: "ty", su: kratkeMeno(menoSupera) };
  return `z markera ${ktoPriazen(zMarkera, m)} · ${listok.komu === "ja" ? "ty" : m.su} v hádke ${zn(listok.komu === "ja" ? listok.stupne : -listok.stupne)} · toto kolo ${ktoPriazen(teraz, m)}`;
}

/** Obsah nápovedy nad staršom — kreslí ho ObsahNapovedyStarsieho (KruzokPriazne.tsx). */
export interface ObsahNapovedy {
  readonly meno: string;
  /** Meno priazne zo scorecardu („Bitkár“). */
  readonly nazovPriazne: string;
  readonly favour: Favour;
  readonly priazen: PriazenKola;
  readonly ucinok: ReturnType<typeof ucinokKola>;
  /** Riadok Hádka — len kým na staršom platí posun z hádky. */
  readonly hadka: {
    readonly listok: ListokHadky;
    readonly zMarkera: PriazenKola;
    readonly teraz: PriazenKola;
  } | null;
  readonly strach: { readonly komu: KomuPriazen; readonly text: string };
  readonly stupen: string;
  /** Čo urobí klik v kroku (hádka, zajatie) — inak null. */
  readonly akcia: string | null;
  /** Ďalší riadok (koniec partie: koľko špakov starší komu dal). */
  readonly dalsi: { readonly nazov: string; readonly text: string } | null;
}

export interface VstupNapovedy {
  readonly data: GameData;
  readonly elder: ElderState;
  readonly meno: string;
  readonly klebety: Klebety | undefined;
  readonly ja: PlayerId;
  /** Mená hráčov podľa miesta (0, 1) — súper menom, ja sa píše „ty“. */
  readonly mena: readonly [string, string];
  /** Špaky za strach na konci kola a čo čaká na udržanie — pre toho, koho sa bojí. */
  readonly spaky: number;
  readonly naUdrzanie: number;
  readonly akcia?: string | null;
  readonly dalsi?: { readonly nazov: string; readonly text: string } | null;
}

export function obsahNapovedy(v: VstupNapovedy): ObsahNapovedy {
  const su: PlayerId = v.ja === 0 ? 1 : 0;
  const m = { ja: "ty", su: v.mena[su] };
  const fav = favourStarsieho(v.data, v.elder);
  const teraz = priazenKola(v.elder, v.klebety, v.ja);
  const zMarkera = priazenMarkera(v.elder, v.ja);
  const listok = listokHadky(v.elder.elderId, v.klebety, v.ja);
  // Strach je vždy podľa markera — hádka ho nemení (v10).
  const obavany = zMarkera.hrac === null ? null : zMarkera.hrac === 0 ? 1 : 0;
  return {
    meno: v.meno,
    nazovPriazne: scorecardStarsieho(v.data, v.elder).nazov,
    favour: fav,
    priazen: teraz,
    ucinok: ucinokKola(fav, teraz, m),
    hadka: listok === null ? null : { listok, zMarkera, teraz },
    strach: {
      komu: komuZ(obavany, v.ja),
      text: riadokStrachu(obavany === null ? null : v.mena[obavany], obavany === v.ja, v.spaky, v.naUdrzanie),
    },
    stupen: textStupna(STUPNICA_ZONY[v.elder.marker]),
    akcia: v.akcia ?? null,
    dalsi: v.dalsi ?? null,
  };
}

/** Nápoveda nad krúžkami stupnice: 1 riadok, druhý len keď hádka bodku odsunula od prsteňa. */
export function riadkyKruzkov(posunute: boolean): readonly string[] {
  const r = "Prsteň: strach (skóruje sa) · bodka: komu patrí priazeň v tomto kole.";
  return posunute ? [r, "Bodku posunula hádka, do konca kola."] : [r];
}

/** Koľko starších dáva hráčovi `p` priazeň v tomto kole (dlaždica Starší, stĺpec na telefóne). */
export function pocetPriazniKola(starsi: readonly StarsiNaStupnici[], klebety: Klebety | undefined, p: PlayerId): number {
  return starsi.filter((e) => ucinnaPriazen(e, klebety).hrac === p).length;
}

/** Krátky riadok dlaždice staršieho v bare hráča `p` podľa priazne tohto kola. */
export function riadokPriazneDlazdice(hrac: PlayerId | null, p: PlayerId, ja: PlayerId): string {
  if (hrac === null) return "nikomu";
  if (hrac === p) return p === ja ? "pomáha ti" : "pomáha mu";
  return p === ja ? "pomáha súperovi" : "pomáha tebe";
}

/** Meno na lístok a do riadkov (portrét je úzky): „Bot Rapavý Fero“ → „Fero“, „Jano (AI)“ → „Jano“. */
export function kratkeMeno(meno: string): string {
  const slova = meno
    .replace(/\s*\(AI\)\s*$/, "")
    .trim()
    .split(/\s+/);
  return slova.at(-1) || meno;
}

/** Hádka bitky na jednom staršom (rekapitulácia, súhrn): kto, o koľko, priazeň z markera → toto kolo. */
export interface HadkaNaStarsom {
  readonly elderId: string;
  readonly hrac: PlayerId;
  readonly komu: "ja" | "su";
  readonly stupne: number;
  readonly z: PriazenKola;
  readonly teraz: PriazenKola;
}

/**
 * Hádka bitky po starších. Po bitke ju nesie záznam nástenky po hráčoch (BitkaNaNastenke.povery),
 * kým bitka beží, pohľad má len súčet klebiet — vtedy je víťaz podľa znamienka.
 */
export function hadkaBitky(
  starsi: readonly StarsiNaStupnici[],
  zdroj: { readonly hracov?: readonly [Klebety, Klebety] | undefined; readonly sucet?: Klebety | undefined },
  ja: PlayerId,
): readonly HadkaNaStarsom[] {
  const h = zdroj.hracov;
  const spolu: Klebety | undefined = h !== undefined ? spojDva(h[0], h[1]) : zdroj.sucet;
  const out: HadkaNaStarsom[] = [];
  for (const e of starsi) {
    const z = priazenMarkera(e, ja);
    const teraz = priazenKola(e, spolu, ja);
    const casti: [PlayerId, number][] =
      h !== undefined
        ? [
            [0, Math.abs(h[0][e.elderId] ?? 0)],
            [1, Math.abs(h[1][e.elderId] ?? 0)],
          ]
        : [[(spolu?.[e.elderId] ?? 0) > 0 ? 0 : 1, Math.abs(spolu?.[e.elderId] ?? 0)]];
    for (const [hrac, stupne] of casti) if (stupne > 0) out.push({ elderId: e.elderId, hrac, komu: hrac === ja ? "ja" : "su", stupne, z, teraz });
  }
  return out;
}

function spojDva(a: Klebety, b: Klebety): Klebety {
  const out: Record<string, number> = { ...a };
  for (const [id, n] of Object.entries(b)) out[id] = (out[id] ?? 0) + n;
  return out;
}

/** „nikto → ty“, „ty 2 → 1“, „Fero 1 → ty“ — krúžok vedľa nesie výslednú silu. */
export function prechodPriazne(z: PriazenKola, teraz: PriazenKola, menoSupera: string): string {
  const kto = (p: PriazenKola): string => (p.komu === "ja" ? "ty" : kratkeMeno(menoSupera));
  const pred = z.komu === null ? "nikto" : `${kto(z)} ${z.sila}`;
  const po = teraz.komu === null ? "nikto" : teraz.komu === z.komu ? `${teraz.sila}` : kto(teraz);
  return `${pred} → ${po}`;
}

/** Priazne v rekapitulácii bitky: hádka po starších a meno staršieho podľa priazne. */
export interface PriazneBitky {
  readonly hadka: readonly (HadkaNaStarsom & { readonly meno: string; readonly fav: Favour })[];
  /** Meno staršieho, ktorý dáva priazeň daného druhu (pečiatka „priazeň Bitkára“ → meno a krúžok). */
  readonly menoStarsieho: (fav: Favour) => string | null;
}

/**
 * Súhrn kola: priazeň, ktorú starší dával v kole po hádke, a priazeň po kole (z markera). Hádka
 * sa ráta k markeru po kole — v kole bez posunu markera je to presne to, čo platilo v bitke.
 */
export function priazenSuhrnu(
  elder: StarsiNaStupnici,
  hadka: readonly { readonly hrac: PlayerId; readonly stupne: number }[],
  ja: PlayerId,
): { readonly vKole: PriazenKola; readonly poKole: PriazenKola; readonly dm: DvojityMarker } {
  const n = hadka.reduce((a, x) => a + (x.hrac === 0 ? x.stupne : -x.stupne), 0);
  const klebety: Klebety | undefined = n === 0 ? undefined : { [elder.elderId]: n };
  return { vKole: priazenKola(elder, klebety, ja), poKole: priazenMarkera(elder, ja), dm: dvojityMarker(elder, klebety, ja) };
}

/** Koľko špakov starší za strach komu dal počas partie (pás starších na konci partie). */
export function spakyOdStarsieho(nastenka: readonly Pick<BitkaNaNastenke, "zaStarsichRozpis">[], elderId: string): readonly [number, number] {
  const sucet = (p: PlayerId): number =>
    nastenka.reduce((a, b) => a + (b.zaStarsichRozpis?.[p] ?? []).filter((x) => x.elderId === elderId).reduce((c, x) => c + x.spaky, 0), 0);
  return [sucet(0), sucet(1)];
}

/** Titulok čipu hádky v rekapitulácii: „hádka +1 na Krčmárke: priazeň nikto → ty — len na toto kolo“. */
export function popisHadkyNaStarsom(x: HadkaNaStarsom & { readonly meno: string }, menoSupera: string): string {
  return `${x.komu === "ja" ? "tvoja hádka" : `hádka (${kratkeMeno(menoSupera)})`} +${x.stupne} na staršom ${x.meno}: priazeň ${prechodPriazne(x.z, x.teraz, menoSupera)} — do konca kola`;
}

/** Priazeň staršieho podľa jeho id (aj väzňa) — pre záznamy, ktoré nesú len elderId (nástenka, súhrny). */
export function favourPodlaId(
  data: Pick<GameData, "scorecards">,
  stol: { readonly starsi: readonly Pick<ElderState, "elderId" | "scorecard">[]; readonly vazni: readonly { readonly elderId: string; readonly scorecard: string }[] },
  elderId: string,
): Favour | null {
  const sc = stol.starsi.find((e) => e.elderId === elderId)?.scorecard ?? stol.vazni.find((v) => v.elderId === elderId)?.scorecard;
  return data.scorecards.find((x) => x.id === sc)?.favour ?? null;
}
