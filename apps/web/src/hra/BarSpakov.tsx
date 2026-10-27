// Bar špakov (Michal 2026-10-27, dizajn spaky-starsi-20261027): kým je otvorená krčmová
// nástenka, oba bary hráčov ukážu namiesto zdrojov, odkiaľ hráč špaky má a čo ešte
// príde — lokality, starší, sekera a finále, Exekútor, Cirhóza a „keby skončila teraz“.
// Súčet dlaždíc doteraz dá popolník; čísla ráta jadro (nástenka, spakyTeraz, rozpisSpakov).

import type { CSSProperties } from "react";
import type { ClientState, PlayerId, SpakyTeraz } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import { sMinusom } from "./Spaky.tsx";
import { spakyPodlaZdroja } from "./spakyAStarsi.ts";

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
  const dlazdice = [
    {
      kluc: "lokality",
      nazov: "Lokality",
      hodnota: zn(zaLokality),
      trieda: zaLokality > 0 ? "plus" : "",
      pod: vyhrate.length === 0 ? "zatiaľ žiadna" : `${vyhrate.length}: ${mena.join(", ")}`,
      popis: `Špaky za vyhraté bitky o lokality: ${vyhrate.length === 0 ? "zatiaľ žiadna" : mena.join(", ")}${zoSekery > 0 ? ` (z toho ${zoSekery} zo sekery)` : ""}.`,
    },
    {
      kluc: "starsi",
      nazov: "Starší",
      hodnota: zn(rozpis.zaStarsich),
      trieda: rozpis.zaStarsich > 0 ? "plus" : "",
      pod: `+${body.zaStarsich[p]} po ďalšej bitke · ešte ${body.vyplat}×`,
      popis: `Doteraz od starších ${zn(rozpis.zaStarsich)}. Po ďalšej bitke ${ja ? "ti" : "mu"} dajú ${body.zaStarsich[p]} (kto sa ${ja ? "ťa" : "ho"} bojí: žltá 1, oranžová 2, červená 3); vyplácajú ešte ${body.vyplat}×.`,
    },
    {
      kluc: "finale",
      nazov: "Sekera · finále",
      hodnota: zn(zaFinale),
      trieda: zaFinale > 0 ? "plus" : "",
      pod: [
        finale === null ? `finále až +${KONSTANTY.FINALE_PITKY}` : `finále ${zn(finale.zaBitku[p])}`,
        rozpis.prebytok > 0 ? `prebytok +${rozpis.prebytok}` : null,
        view.spakyNaSekere > 0 ? `na sekere ${view.spakyNaSekere}` : null,
      ]
        .filter((t): t is string => t !== null)
        .join(" · "),
      popis: `Finále (${KONSTANTY.FINALE_PITKY} Pitky) a prebytok. Remíza dá špaky bitky na sekeru — vezme ich víťaz ďalšej bitky, vo finále prepadnú.${view.spakyNaSekere > 0 ? ` Teraz na nej čaká ${view.spakyNaSekere}.` : ""}`,
    },
    {
      kluc: "exekutor",
      nazov: "Exekútor",
      hodnota: zn(rozpis.exekutor),
      trieda: rozpis.exekutor < 0 ? "minus" : "",
      pod: rozpis.exekutor < 0 ? "zhorené pri exekúcii" : "zatiaľ nič",
      popis: "Špaky, ktoré zhoreli pri exekúcii (polovica priznaných Dlhov).",
    },
    {
      kluc: "cirhoza",
      nazov: "Cirhóza",
      hodnota: zn(-cirhozy * KONSTANTY.SPAKY_ZA_CIRHOZU),
      trieda: cirhozy > 0 ? "minus" : "",
      pod: `${cirhozy} nepriznané`,
      popis: `Nepriznaná Cirhóza zoberie na konci hry ${KONSTANTY.SPAKY_ZA_CIRHOZU} špakov za kus (ruka aj oba balíčky).`,
    },
    {
      kluc: "teraz",
      nazov: "Keby skončila",
      hodnota: sMinusom(body.spolu[p]),
      trieda: "",
      pod: `teraz · so staršími ≈ ${sMinusom(body.odhad[p])}`,
      popis: "Špaky v popolníku mínus nepriznaná Cirhóza. Odhad pridá starších za bitky, ktoré ešte prídu, keby sa markery nepohli — výhry nerátá.",
    },
  ];
  return (
    <div className="bar-spakov" style={{ "--n": dlazdice.length } as CSSProperties} role="list" aria-label="Špaky">
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
