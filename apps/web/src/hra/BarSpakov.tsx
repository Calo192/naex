// Bar špakov (Michal 2026-10-27, dizajn spaky-starsi-20261027): kým je otvorená krčmová
// nástenka, oba bary hráčov ukážu namiesto zdrojov, odkiaľ hráč špaky má a čo ešte
// príde — lokality, starší, sekera a finále, Exekútor, koniec hry (výkupné zdrojov a Cirhóza).
// Dlaždica „Keby skončila teraz“ zrušená (Michal 2026-10-30) — čo dajú starší, je pod staršinom.
// Súčet dlaždíc doteraz dá popolník; čísla ráta jadro (nástenka, spakyTeraz, rozpisSpakov).

import type { CSSProperties } from "react";
import type { ClientState, PlayerId } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import { spakov } from "../i18n/pocty.ts";
import { spakyPodlaZdroja } from "./spakyAStarsi.ts";
import type { SpakyTeraz } from "@naex/core";
import { HODNOTA_POLA } from "./textyStarsich.ts";
import { t } from "../i18n/jazyk.tsx";

export interface BarSpakovProps {
  readonly view: ClientState;
  /** Čí bar — špaky tohto hráča. */
  readonly p: PlayerId;
  readonly body: SpakyTeraz;
  readonly menoKarty: (defId: string) => string;
}

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function BarSpakov({ view, p, body, menoKarty }: BarSpakovProps) {
  const ja = p === view.ja;
  const rozpis = spakyPodlaZdroja(view, p);
  const { vyhrate, zaLokality, zaFinale, zoSekery, finale } = rozpis;
  const mena = vyhrate.map((k) => menoKarty(k.defId));
  const cirhozy = view.koniec === null ? body.cirhozy[p] : (view.koniec.cirhozy?.[p] ?? 0);
  const vykupne = body.vykupne[p];
  const zaKoniec = vykupne.spaky - cirhozy * KONSTANTY.SPAKY_ZA_CIRHOZU;
  const dlazdice = [
    {
      kluc: "lokality",
      nazov: t("barSpakov.lokality"),
      hodnota: zn(zaLokality),
      trieda: zaLokality > 0 ? "plus" : "",
      pod: vyhrate.length === 0 ? t("barSpakov.ziadna") : `${vyhrate.length}: ${mena.join(", ")}`,
      popis: t("barSpakov.lokalityPopis", { zoznam: vyhrate.length === 0 ? t("barSpakov.ziadna") : mena.join(", "), sekera: zoSekery > 0 ? t("barSpakov.zTohoSekera", { n: zoSekery }) : "" }),
    },
    {
      kluc: "starsi",
      nazov: t("starsi.nazov"),
      hodnota: zn(rozpis.zaStarsich),
      trieda: rozpis.zaStarsich > 0 ? "plus" : "",
      pod: t("barSpakov.starsiPod", { vyhra: body.zaStarsichVyhra[p], prehra: body.zaStarsichPrehra[p] }),
      popis: ja ? t("barSpakov.starsiPopisJa", { doteraz: zn(rozpis.zaStarsich), vyhra: body.zaStarsichVyhra[p], prehra: body.zaStarsichPrehra[p], hodnota: HODNOTA_POLA }) : t("barSpakov.starsiPopisSu", { doteraz: zn(rozpis.zaStarsich), vyhra: body.zaStarsichVyhra[p], prehra: body.zaStarsichPrehra[p], hodnota: HODNOTA_POLA }),
    },
    {
      kluc: "finale",
      nazov: t("barSpakov.sekeraFinale"),
      hodnota: zn(zaFinale),
      trieda: zaFinale > 0 ? "plus" : "",
      pod: [
        finale === null ? t("barSpakov.finaleAkoKazda") : t("barSpakov.finaleN", { n: zn(finale.zaBitku[p]) }),
        rozpis.prebytok > 0 ? t("spaky.nakladackaN", { n: `+${rozpis.prebytok}` }) : null,
        view.spakyNaSekere > 0 ? t("panel.naSekere", { n: view.spakyNaSekere }) : null,
      ]
        .filter((t): t is string => t !== null)
        .join(" · "),
      popis: t("barSpakov.finalePopis") + (view.spakyNaSekere > 0 ? t("barSpakov.terazCaka", { n: view.spakyNaSekere }) : ""),
    },
    {
      kluc: "exekutor",
      nazov: t("spaky.exekutor"),
      hodnota: zn(rozpis.exekutor),
      trieda: rozpis.exekutor < 0 ? "minus" : "",
      pod: rozpis.exekutor < 0 ? t("barSpakov.zhorene") : t("barSpakov.zatialNic"),
      popis: t("barSpakov.exekutorPopis"),
    },
    {
      // Výkupné a Cirhóza v jednej dlaždici — siedma by sa na notebooku nezmestila.
      kluc: "koniec",
      nazov: t("faza.koniecHry"),
      hodnota: zn(zaKoniec),
      trieda: zaKoniec > 0 ? "plus" : zaKoniec < 0 ? "minus" : "",
      pod: [t("barSpakov.vykupne", { n: zn(vykupne.spaky) }), cirhozy > 0 ? t("barSpakov.cirhozaMinus", { n: cirhozy * KONSTANTY.SPAKY_ZA_CIRHOZU }) : null].filter((t): t is string => t !== null).join(" · "),
      popis:
        t("barSpakov.vykupnePopis", { zaPoldeci: KONSTANTY.SPAKY_ZA_POLDECI, zaCigarety: KONSTANTY.CIGARIET_ZA_SPAK, kedy: view.koniec === null ? t("spaky.teraz") : t("barSpakov.naKonci"), poldeci: t("koniec.plnychPoldeci", { n: vykupne.poldeci }), cigarety: t("koniec.cigariet", { n: vykupne.cigarety }), spolu: zn(vykupne.spaky) }) +
        t("barSpakov.cirhozaPopis", { spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) }) +
        (cirhozy > 0 ? (ja ? t("barSpakov.mas", { n: cirhozy }) : t("barSpakov.ma", { n: cirhozy })) : "") +
        ".",
    },
  ];
  return (
    <div className="bar-spakov" style={{ "--n": dlazdice.length } as CSSProperties} role="list" aria-label={t("pult.spaky")}>
      {dlazdice.map((d) => (
        <div key={d.kluc} role="listitem" tabIndex={0} className={`zdroj spaky-dlazdica ${d.trieda}`} title={d.popis}>
          <span className="zdroj-nazov">{d.nazov}</span>
          <span className="zdroj-hodnota">
            <span className="velke-cislo">{d.hodnota}</span>
          </span>
          <span className="zdroj-pod">
            <span>{d.pod}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
