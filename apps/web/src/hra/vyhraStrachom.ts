// Výhra strachom na stole (PRAVIDLA §9, krok 4c) — čisté funkcie bez DOM. Výhra strachom ukončí
// hru ešte pred exekúciou (4d), takže hráč s Dlhmi o špaky nepríde; bez slova o tom si to vykladal
// ako chybu (Michal 2026-11-10). Väzeň sa ráta ako červená, ale na stupnici starších nie je —
// „4/4“ pri troch červených stĺpčekoch mýlilo, preto ho text menuje zvlášť.

import type { BitkaNaNastenke, ClientState, PlayerId, StavVyhier } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

/**
 * Niekto už teraz má dosť červených: keď vyhrá najbližšiu bitku, hra skončí výhrou strachom
 * a exekúcia sa nekoná nikomu (ani porazenému).
 */
export function hroziVyhraStrachom(vyhry: StavVyhier): boolean {
  return Math.max(vyhry.cervene[0], vyhry.cervene[1]) >= vyhry.cervenychNaVyhru;
}

/** Vysvetlenie k „nie pri výhre strachom“ (dlaždica a tabuľa Dlhov); funkcia, aby platil jazyk hráča. */
export const titulBezExekucie = (): string =>
  t("strach.bezExekucie", { n: KONSTANTY.CERVENYCH_NA_VYHRU });

/** Väzni: „1 väzeň“, „2 väzni“, „5 väzňov“. */
export const vaznov = (n: number): string => t("strach.vaznov", { n });

export interface TextCervenych {
  /** „3 + 1 väzeň = 4/4“, bez väzňov „4/4“. */
  readonly kratko: string;
  /** Odznak na úzke miesto: „3+1/4“, bez väzňov „4/4“. */
  readonly odznak: string;
  /** Plné vysvetlenie do title. */
  readonly titul: string;
}

/** Červené strachy hráča (väzni sa rátajú) tak, aby súčet sedel so stĺpčekmi na stupnici. */
export function textCervenych(cervene: number, vazni: number, naVyhru: number): TextCervenych {
  const naStupnici = cervene - vazni;
  return {
    kratko: vazni > 0 ? `${naStupnici} + ${vaznov(vazni)} = ${cervene}/${naVyhru}` : `${cervene}/${naVyhru}`,
    odznak: vazni > 0 ? `${naStupnici}+${vazni}/${naVyhru}` : `${cervene}/${naVyhru}`,
    titul:
      vazni > 0
        ? t("strach.titulVazni", { cervene, naVyhru, starsi: starsich(naStupnici), vazni: vaznov(vazni) })
        : t("strach.titul", { cervene, naVyhru, starsi: starsich(naStupnici) }),
  };
}

const starsich = (n: number): string => t("strach.starsich", { n });

export interface VyhraStrachom {
  readonly hrac: PlayerId;
  /** Červené víťaza spolu s väzňami. */
  readonly cervene: number;
  readonly vazni: number;
  /** Niekto mal priznané Dlhy — bez výhry strachom by prišla exekúcia. */
  readonly bezExekucie: boolean;
}

/**
 * Skončila bitka kola `kolo` výhrou strachom? Odvodené z pohľadu po konci hry: posledná bitka,
 * víťaz hry je jej víťaz a má dosť červených. Výhra väzňami prichádza až po Nakladačke a 4c ju
 * predbehne — keď má víťaz dosť väzňov, vyhral nimi (v tej bitke exekúcia bola).
 */
export function vyhraStrachomBitky(view: Pick<ClientState, "koniec" | "nastenka" | "vyhry" | "hraci">, kolo: number): VyhraStrachom | null {
  const k = view.koniec;
  if (k === null || k.body !== null || k.vitaz === null) return null;
  const b: BitkaNaNastenke | undefined = view.nastenka[view.nastenka.length - 1];
  if (b === undefined || b.kolo !== kolo || b.vitaz !== k.vitaz) return null;
  const v = view.vyhry;
  const p = k.vitaz;
  if (v.cervene[p] < v.cervenychNaVyhru || v.vazni[p] >= v.vazniNaVyhru) return null;
  // Vzdanie a kontumácia tiež končia bez bodov — so stavom starších nesúvisia.
  if (/vzdáva|Kontumácia/.test(k.dovod)) return null;
  return { hrac: p, cervene: v.cervene[p], vazni: v.vazni[p], bezExekucie: view.hraci[0].dlhy + view.hraci[1].dlhy > 0 };
}

/** Riadok pod špakmi bitky: „Výhra strachom (4 červené) — exekúcia sa nekonala.“ */
export function textVyhryStrachom(v: VyhraStrachom): string {
  const cervene = v.vazni > 0 ? t("strach.cerveneZToho", { n: v.cervene, vazni: vaznov(v.vazni) }) : t("strach.cervene", { n: v.cervene });
  return v.bezExekucie ? t("strach.vyhraBezExekucie", { cervene }) : t("strach.vyhra", { cervene });
}
