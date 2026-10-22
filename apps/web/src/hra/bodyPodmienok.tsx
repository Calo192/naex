// Body po bodovacích podmienkach (lokality, starší, cigarety, zóny strachu,
// Dlhy, Cirhóza) — z bodyTeraz, spoločné pre všetky zobrazenia skóre:
// dlaždice v bare hráča aj krčmové účty (preferencia v profile, Michal 2026-10-22).
// Predtým to rátal Scoreboard nad staršími (Michal 2026-10-18).

import type { BodPodmienky, BodyTeraz, GameData, Podmienka, PlayerId } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import type { TipObsah } from "../karta/Tip.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { vypocetPodmienky, znamienko } from "./Scorecard.tsx";

export const PORADIE_PODMIENOK: readonly Podmienka[] = ["lokality", "starsi", "cigarety", "znepokojenie", "strach", "vydesenie", "dlh", "cirhoza"];

/** Za čo podmienka dáva kusy — prvý riadok nápovedy. */
export const ZA_CO: Readonly<Record<Podmienka, string>> = {
  lokality: "Za každú ovládnutú lokalitu (vyhraná bitka o lokalitu).",
  starsi: "Za každého staršieho získaného patronátom (vyhratá bitka, keď bol tvojou kartou v ruke).",
  cigarety: `Za každé ${KONSTANTY.CIGARIET_NA_KUS} cigarety, ktoré ti ostanú na konci hry.`,
  znepokojenie: "Za každého staršieho, ktorý sa ťa bojí aspoň na úrovni 1 (marker v žltej zóne na súperovej polovici).",
  strach: "Za každého staršieho, ktorý sa ťa bojí aspoň na úrovni 2 (oranžová zóna).",
  vydesenie: "Za každého vydeseného staršieho (červená krajná pozícia).",
  dlh: "Za každý tvoj Dlh — aj priznaný. Nový Dlh sa hneď prizná; zbavíš sa ho len pálením v bitke a kartami (Dievčina, Robota, Stryná…).",
  cirhoza: "Za každú nepriznanú Cirhózu v ruke a v balíčkoch — priznaj ju.",
};

/** Starší a pozícia podmienky na jeho scorecarde — tá istá podmienka môže byť aktívna dvakrát. */
export interface ZdrojPodmienky {
  readonly kluc: string;
  readonly elderId: string;
  readonly polozky: readonly [BodPodmienky | null, BodPodmienky | null];
}

export interface BodyPodmienky {
  readonly podmienka: Podmienka;
  readonly body: readonly [number, number];
  readonly kusy: readonly [number, number];
  /** Scorecardy, na ktorých je podmienka aktívna, a čo z nich má každý hráč. */
  readonly zdroje: readonly ZdrojPodmienky[];
}

/** Súčty po podmienkach v poradí PORADIE_PODMIENOK; podmienka, ktorá nie je aktívna nikde, chýba. */
export function bodyPoPodmienkach(body: BodyTeraz): Map<Podmienka, BodyPodmienky> {
  const out = new Map<Podmienka, { podmienka: Podmienka; body: [number, number]; kusy: [number, number]; zdroje: ZdrojPodmienky[] }>();
  for (const s of body.starsi) {
    for (const p of [0, 1] as const) {
      for (const pol of s.polozky[p]) {
        const m = out.get(pol.podmienka) ?? { podmienka: pol.podmienka, body: [0, 0], kusy: [0, 0], zdroje: [] };
        m.body[p] += pol.body;
        // Kusy sú pre hráča rovnaké na každom scorecarde (lokality, strach…) — stačí najväčší.
        m.kusy[p] = Math.max(m.kusy[p], pol.kusy);
        const kluc = `${s.elderId}/${pol.strana}/${pol.index}`;
        const i = m.zdroje.findIndex((z) => z.kluc === kluc);
        const zdroj = m.zdroje[i];
        if (zdroj === undefined) m.zdroje.push({ kluc, elderId: s.elderId, polozky: p === 0 ? [pol, null] : [null, pol] });
        else m.zdroje[i] = { ...zdroj, polozky: p === 0 ? [pol, zdroj.polozky[1]] : [zdroj.polozky[0], pol] };
        out.set(pol.podmienka, m);
      }
    }
  }
  return new Map(PORADIE_PODMIENOK.flatMap((p) => {
    const m = out.get(p);
    return m === undefined ? [] : [[p, m] as const];
  }));
}

/** Nápoveda podmienky z pohľadu hráča `ja`: za čo, za kus, a čo z ktorého staršieho má kto. */
export function tipPodmienky(
  m: BodyPodmienky,
  data: GameData,
  ja: PlayerId,
  menoSupera: string,
  menoStarsieho: (elderId: string) => string,
): TipObsah {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const zaKus = data.bodyPodmienok[m.podmienka];
  const kliatba = m.podmienka === "dlh" || m.podmienka === "cirhoza";
  const vypocet = (pol: BodPodmienky | null): string => (pol === null ? "0" : vypocetPodmienky(pol, zaKus));
  return {
    nadpis: `${NAZOV_PODMIENKY[m.podmienka]} — ty ${znamienko(m.body[ja])}, ${menoSupera} ${znamienko(m.body[su])}`,
    text: (
      <>
        {ZA_CO[m.podmienka]} {zaKus > 0 ? "+" : "−"}
        {Math.abs(zaKus)} za kus na každom scorecarde, kde je podmienka aktívna — teraz na{" "}
        {m.zdroje.length === 1 ? "jednom" : `${m.zdroje.length}`}. Boduje obom hráčom.
        {m.zdroje.map((z) => (
          <span key={z.kluc} className="tip-riadok">
            <b>{menoStarsieho(z.elderId)}:</b> ty {vypocet(z.polozky[ja])} · {menoSupera} {vypocet(z.polozky[su])}
          </span>
        ))}
        {kliatba && (
          <span className="tip-stav">
            Súperove nepriznané kliatby sa rátajú z toho, čo sa ukázalo na stole (vznik, priznanie, zahodenie) — ktoré karty a kde ležia,
            nevidíš, ale ich počet áno.
          </span>
        )}
      </>
    ),
  };
}
