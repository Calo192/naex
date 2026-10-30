// Bar špakov (Michal 2026-10-27, dizajn spaky-starsi-20261027): kým je otvorená krčmová
// nástenka, oba bary hráčov ukážu namiesto zdrojov, odkiaľ hráč špaky má a čo ešte
// príde — lokality, starší, sekera a finále, Exekútor, koniec hry (výkupné zdrojov a Cirhóza)
// a „keby skončila teraz“.
// Súčet dlaždíc doteraz dá popolník; čísla ráta jadro (nástenka, spakyTeraz, rozpisSpakov).

import type { CSSProperties } from "react";
import type { ClientState, PlayerId, SpakyTeraz } from "@naex/core";
import { KONSTANTY, pocet } from "@naex/core";
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
  const vykupne = body.vykupne[p];
  const zaKoniec = vykupne.spaky - cirhozy * KONSTANTY.SPAKY_ZA_CIRHOZU;
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
      pod: `+${body.zaStarsich[p]} za nové zóny, ak ${ja ? "vyhráš" : "vyhrá"}`,
      popis: `Doteraz od starších ${zn(rozpis.zaStarsich)}. Po najbližšej bitke, ktorú ${ja ? "vyhráš" : "vyhrá"}, ${ja ? "ti" : "mu"} dajú ${body.zaStarsich[p]}: každý, kto sa ${ja ? "ťa" : "ho"} bojí, zaplatí len zóny, ktoré ešte nezaplatil (žltá 1, oranžová 2, červená 3) — zaparkovaný marker druhýkrát nič nedá, kým neustúpi k stredu. Porazený od starších nedostane nič, pri sekere dostanú obaja.`,
    },
    {
      kluc: "finale",
      nazov: "Sekera · finále",
      hodnota: zn(zaFinale),
      trieda: zaFinale > 0 ? "plus" : "",
      pod: [
        finale === null ? "finále: ako každá bitka" : `finále ${zn(finale.zaBitku[p])}`,
        rozpis.prebytok > 0 ? `prebytok +${rozpis.prebytok}` : null,
        view.spakyNaSekere > 0 ? `na sekere ${view.spakyNaSekere}` : null,
      ]
        .filter((t): t is string => t !== null)
        .join(" · "),
      popis: `Finále je posledná bitka, o vrcholovú lokalitu, a boduje sa ako každá (víťaz 1 špak za každú kartu v línii); prebytok v ňom rozdelí jeho držiteľ a nové zóny strachu sa vyplatia hneď. Remíza dá špaky bitky na sekeru — vezme ich víťaz ďalšej bitky, vo finále prepadnú.${view.spakyNaSekere > 0 ? ` Teraz na nej čaká ${view.spakyNaSekere}.` : ""}`,
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
      // Výkupné a Cirhóza v jednej dlaždici — siedma by sa na notebooku nezmestila.
      kluc: "koniec",
      nazov: "Koniec hry",
      hodnota: zn(zaKoniec),
      trieda: zaKoniec > 0 ? "plus" : zaKoniec < 0 ? "minus" : "",
      pod: [`výkupné ${zn(vykupne.spaky)}`, cirhozy > 0 ? `Cirhóza −${cirhozy * KONSTANTY.SPAKY_ZA_CIRHOZU}` : null].filter((t): t is string => t !== null).join(" · "),
      popis:
        `Výkupné po finále: každý plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak — ` +
        `${view.koniec === null ? "teraz" : "na konci"} ${pocet(vykupne.poldeci, "plný poldeci", "plné poldeci", "plných poldeci")} a ${pocet(vykupne.cigarety, "cigareta", "cigarety", "cigariet")} = ${zn(vykupne.spaky)}. ` +
        `Nepriznaná Cirhóza zoberie na konci hry ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")} za kus (ruka aj oba balíčky)${cirhozy > 0 ? `, ${ja ? "máš" : "má"} ${cirhozy}` : ""}.`,
    },
    {
      kluc: "teraz",
      nazov: "Keby skončila",
      hodnota: sMinusom(body.spolu[p]),
      trieda: "",
      pod: `teraz · so staršími až ${sMinusom(body.odhad[p])}`,
      popis: `Špaky v popolníku, výkupné zvyšných poldeci a cigariet, mínus nepriznaná Cirhóza. „Až“ pridá nevyplatené zóny starších, keby ${ja ? "si" : ""} ešte ${ja ? "vyhral" : "vyhral"} bitku a markery sa nepohli — špaky za bitky nerátá.`,
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
