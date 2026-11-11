// Prechody fáz na stole (Michal 2026-10-27): línia starších zmizne, hneď ako prestane byť
// aktuálna, a pri prechode do novej fázy sa ukáže medziobrazovka (nadpis a 1–2 vety).

import { KONSTANTY, opponentOf } from "@naex/core";
import { cigariet } from "../i18n/pocty.ts";
import type { ClientState, PlayerId } from "@naex/core";
import { cenaPola } from "./textyStarsich.ts";
import { t } from "../i18n/jazyk.tsx";

/**
 * Kľúč fázy stola: mení sa pri každom prechode, ktorý hráča posúva k ďalšej práci —
 * nové kolo, výber lokality, šenok, Zhromaždenie, Pitka, bitka.
 */
export function klucPrechodu(view: Pick<ClientState, "kolo" | "faza" | "draftStav" | "pitkaCislo">): string {
  const krok = view.faza === "draft" ? "senok" : "";
  return `${view.kolo}|${view.faza}|${krok}|${view.faza === "pitka" ? view.pitkaCislo : ""}`;
}

/** Medziobrazovka pri prechode fázy: veľký nadpis a 1–2 vety, čo sa ide diať a čo má hráč urobiť. */
export interface Medziobrazovka {
  readonly kluc: string;
  /** Malý riadok nad nadpisom (kolo, finále). */
  readonly nadnadpis: string;
  readonly nadpis: string;
  readonly text: string;
}

/**
 * Medziobrazovka pre to, čo sa na stole práve začína (Michal 2026-10-27: výber lokality,
 * šenok, Zhromaždenie, Pitka, hádka (v10), bitka, prebytok, nové kolo, finále). Finále nahradilo
 * starý oznam finále.
 * `bitkaKola` = kolo bitky, ktorej počítadlo čaká na stole — bitka sa často vyhodnotí
 * naraz s koncom kola a stôl je už v ďalšom kole, kým počítadlo len začína.
 */
export function medziobrazovka(
  view: Pick<ClientState, "kolo" | "faza" | "utocnik" | "pitkaCislo" | "pitkyCelkom" | "lokalitCelkom" | "rozpis" | "bitkaStav" | "koniec" | "ciel" | "spaky" | "vitazPoslednejHadky"> & {
    readonly pitkaStav?: { readonly bzdocha?: PlayerId | null } | null;
    readonly draftStav?: { readonly krok: string } | null;
  },
  ja: PlayerId,
  menoSupera: string,
  bitkaKola: number | null,
): Medziobrazovka | null {
  if (view.koniec !== null) return null;
  const S = menoSupera;
  // Vo finále sa kolo nepočíta — nad nadpisom stojí „Finále“.
  const kolo = view.rozpis !== undefined && view.kolo > view.lokalitCelkom ? t("faza.finale") : t("faza.kolo", { n: view.kolo });
  /** Poradie Zhromaždenia či Pitky v kole ide nad nadpis — dlhý nadpis by sa zalomil. */
  const poradie = (n: number): string => (view.pitkyCelkom > 1 ? `${kolo} · ${t("os.izN", { i: n, n: view.pitkyCelkom })}` : kolo);
  // Hádka (v10): jednorazové okno, keď víťaz hádky rozdeľuje — pred poškodením, ešte bez počítadla.
  const hd = view.bitkaStav?.hadka;
  if (bitkaKola === null && view.faza === "bitka" && view.bitkaStav?.krok === "hadka" && hd !== undefined && hd.vitaz !== null && hd.zostava > 0) {
    const skore = `${hd.makke[hd.vitaz]} : ${hd.makke[opponentOf(hd.vitaz)]}`;
    return {
      kluc: `${view.kolo}|hadka`,
      nadnadpis: kolo,
      nadpis: t("delenie.hadka"),
      text:
        hd.vitaz === ja
          ? t("prechod.hadkaJa", { skore, n: hd.velkost, cena: cenaPola() })
          : t("prechod.hadkaSu", { meno: S, skore, n: hd.velkost }),
    };
  }
  if (bitkaKola !== null || (view.faza === "bitka" && view.bitkaStav?.krok !== "prebytok")) {
    return {
      kluc: `${bitkaKola ?? view.kolo}|bitka`,
      nadnadpis: t("faza.kolo", { n: bitkaKola ?? view.kolo }),
      nadpis: t("faza.bitka"),
      text: t("prechod.bitka"),
    };
  }
  const obranca = view.utocnik !== ja;
  // v11.11: minulú hádku vyhral útočník, takže lokalitu vyberá obranca a natáča útočník.
  const natacaUtocnik = view.vitazPoslednejHadky === view.utocnik;
  const vyberas = natacaUtocnik ? t("prechod.vyberas") : t("prechod.vyberasNatacas");
  const vybera = natacaUtocnik ? t("prechod.vybera") : t("prechod.vyberaNataca");
  const ktoNataca = !natacaUtocnik ? "" : obranca ? t("plocha.natociSuper", { meno: S }) : t("prechod.natocisTy");
  switch (view.faza) {
    case "volbaCiela": {
      // Pred finále (§14b): vedúci vyberá vrcholovú lokalitu, útočí zaostávajúci. Okno Finále
      // príde až s vybranou lokalitou (návrh #32) — teraz len kto vyberá.
      if (view.rozpis !== undefined && view.kolo > view.lokalitCelkom) {
        const rovnako = view.spaky[0] === view.spaky[1];
        const kto = rovnako
          ? obranca
            ? t("prechod.rovnakoUtociSuper", { meno: S, vyberas, nataca: ktoNataca })
            : t("prechod.rovnakoUtocisTy", { meno: S, vybera, nataca: ktoNataca })
          : obranca
            ? t("prechod.vedies", { meno: S, vyberas, nataca: ktoNataca })
            : t("prechod.menejSpakov", { meno: S, vybera, nataca: ktoNataca });
        return {
          kluc: `${view.kolo}|lokalita-finale`,
          nadnadpis: t("prechod.poslednaBitka"),
          nadpis: t("prechod.vyberVrcholovej"),
          text: kto,
        };
      }
      return {
        kluc: `${view.kolo}|lokalita`,
        nadnadpis: kolo,
        nadpis: t("faza.volbaCiela"),
        text: obranca
            ? natacaUtocnik
              ? t("prechod.vyberLokalitu", { nataca: ktoNataca })
              : t("prechod.vyberANatoc")
            : t("prechod.superObranca", { meno: S, vybera, nataca: ktoNataca }),
      };
    }
    case "natocenieCiela":
      return {
        kluc: `${view.kolo}|natocenie`,
        nadnadpis: kolo,
        nadpis: t("faza.natocenieCiela"),
        text: !obranca
          ? t("prechod.natacasTy")
          : t("prechod.natacaSuper", { meno: S }),
      };
    case "draft":
      // Finále sa ohlási až s vybranou vrcholovou lokalitou (návrh #32), namiesto šenku.
      if (view.ciel?.typ === "finale") {
        return {
          kluc: `${view.kolo}|finale`,
          nadnadpis: t("prechod.poslednaBitka"),
          nadpis: t("faza.finale"),
          text:
            t("prechod.finale"),
        };
      }
      return {
        kluc: `${view.kolo}|senok`,
        nadnadpis: kolo,
        nadpis: t("faza.draft"),
        text:
          t("prechod.ponuka", { naradie: KONSTANTY.STAVBA_NARADIE, obcania: KONSTANTY.STAVBA_OBCANIA, jedna: cigariet(KONSTANTY.CENA_SENKU[1] ?? 1), dve: cigariet(KONSTANTY.CENA_SENKU[2] ?? 3) }),
      };
    case "zhromazdenie": {
      const n = view.pitkaCislo + 1;
      return {
        kluc: `${view.kolo}|zhromazdenie|${n}`,
        nadnadpis: poradie(n),
        nadpis: t("os.zhromazdenie"),
        text:
          (obranca ? t("prechod.superVykladaPrvy", { meno: S }) : t("prechod.vykladasPrvy")) +
          t("prechod.kladies"),
      };
    }
    case "pitka":
      return {
        kluc: `${view.kolo}|pitka|${view.pitkaCislo}`,
        nadnadpis: poradie(view.pitkaCislo),
        nadpis: t("faza.pitka"),
        // Pitka naraz (Michal 2026-10-27): hrajú obaja súčasne, len Bzdocha čaká na súpera.
        text:
          view.pitkaStav?.bzdocha === ja
            ? t("prechod.masBzdochu", { meno: S })
            : `${t("prechod.hrateNaraz")} ${
                view.pitkaStav?.bzdocha != null ? t("prechod.superMaBzdochu", { meno: S }) : t("prechod.odkryjuSa")
              }${view.pitkaStav?.bzdocha != null ? "" : obranca ? t("prechod.superOdpovie", { meno: S }) : t("prechod.odpoviesPrvy")}`,
      };
    case "bitka": {
      // v11: Nakladačku rozdeľuje víťaz bitky na svoj strach (vo finále sa nerozdeľuje).
      const drzi = view.bitkaStav?.prebytokDrzi ?? null;
      const vyberam = view.bitkaStav?.caka === ja;
      const text =
        drzi === ja
          ? vyberam
            ? t("prechod.rozdelNakladacku", { cena: cenaPola(), zajatie: KONSTANTY.CENA_ZAJATIA })
            : t("prechod.nakladackaTvoja")
          : t("prechod.superRozdeluje", { meno: S });
      return { kluc: `${view.kolo}|Nakladačka`, nadnadpis: kolo, nadpis: t("delenie.nakladacka"), text };
    }
    default:
      return null;
  }
}

/** Krok, ktorý sa robí na staršom (hádka, Nakladačka) — vtedy stôl ukazuje líniu starších. */
export interface KrokNaStarsich {
  readonly typ: "reci" | "prebytok";
  readonly kto: PlayerId;
}

export function krokNaStarsich(view: Pick<ClientState, "koniec" | "faza" | "bitkaStav" | "draftStav">): KrokNaStarsich | null {
  if (view.koniec !== null) return null;
  const bs = view.bitkaStav;
  if (view.faza === "bitka" && bs !== null && bs.caka !== null && (bs.krok === "reci" || bs.krok === "prebytok")) {
    return { typ: bs.krok, kto: bs.caka };
  }
  return null;
}

/**
 * Hráč má ťah, ktorý sa robí na stole — voľba cieľa na nástenke, stavba a branie šenku,
 * Zhromaždenie, Pitka, kroky bitky na kartách. Línia starších by ho zakryla.
 */
export function tahNaStole(view: Pick<ClientState, "koniec" | "faza" | "bitkaStav" | "draftStav">, somNaTahu: boolean): boolean {
  return somNaTahu && view.koniec === null && krokNaStarsich(view) === null;
}

/**
 * Či stôl ukazuje líniu starších (bez pauzy, ťahania a počítadla bitky, tie rieši stôl): len
 * v kroku na staršom, po kliku na Starší a vo výučbe. Po súperovom posune markerov ani po
 * skončenom kroku sa sama neotvorí — hráč na nej zastal, hoci mal ťah na stole (Michal 2026-10-30:
 * pred stavbou šenku); posuny neskôr ukáže animácia.
 */
export function starsiNaStole(o: { readonly krok: boolean; readonly nahliadnutie: boolean; readonly rucne: boolean; readonly vyucba: boolean }): boolean {
  return o.krok ? !o.nahliadnutie : o.rucne || o.vyucba;
}
