// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A): osem
// scorecardov v rade na mieste línie kariet. Ukáže sa po kliku na Body
// a sama pri krokoch na staršom (Pohoršenie, prebytok, patronát).
// Scorecard je prekreslený v HTML: podmienky po bokoch portrétu, schodová
// stupnica so zrkadlením (tvoja polovica vľavo), priazeň, body a strach.

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { BodyStarsieho, ElderState, GameData, PlayerId } from "@naex/core";
import { STUPNICA_ZONY, favourStarsieho, obavanyHrac, podmienkyStarsieho, prekraciaHranicu, priazenHraca, priazenSila, scorecardStarsieho, type MarkerPos } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { UCINOK_PRIAZNE, znamienko } from "./Scorecard.tsx";

const NAZOV_ZONY = ["neutrál", "žltá", "oranžová", "červená"] as const;

/** Jeden starší v línii — dáta pripraví HernaPlocha. */
export interface StarsiVLinii {
  readonly elder: ElderState;
  readonly meno: string;
  /** Ilustrácia karty staršieho (portrét). */
  readonly obrazok: string | null;
  readonly body: BodyStarsieho | undefined;
  /** Klik v kroku (Pohoršenie, prebytok, patronát) a čo urobí. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Kam by sa marker posunul (duch markera pri prejdení myšou). */
  readonly ciel?: MarkerPos | null | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Prejdené hranice zón v tejto bitke — ukazujú sa pri Pohoršení. */
  readonly hranice?: number | undefined;
  readonly patron: { readonly kto: PlayerId; readonly pohorsenia: number } | null;
  /** Vybraný v patronáte (čaká sa na kartu z ruky). */
  readonly vybrany?: boolean;
}

export interface LiniaStarsichProps {
  readonly starsi: readonly StarsiVLinii[];
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  /** Čie čísla sú zvýraznené — po kliku na súperove Body súperove. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  readonly vydeseni: readonly [number, number];
  readonly prahVydesenia: number;
  readonly spolu: readonly [number, number];
  /** Krok na staršom, ktorý línia práve ukazuje (Pohoršenie…) — inak null. */
  readonly krok: string | null;
  /** Pri Pohoršení svietia hranice zón (§8.2: najviac 2 na marker). */
  readonly hraniceZon: boolean;
  /** Starší, ktorých posun sa práve zmenil (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
}

const triedaBodov = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

export function LiniaStarsich({ starsi, data, ikony, ja, pohlad, mena, vydeseni, prahVydesenia, spolu, krok, hraniceZon, zmenene, tlacidlo }: LiniaStarsichProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  // Náhľad posunu v hlavičke — celý text, dlaždica sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<string | null>(null);
  const nahladovany = starsi.find((s) => s.elder.elderId === nahlad);
  const priazne = (p: PlayerId): string =>
    starsi
      .filter((s) => priazenHraca(s.elder) === p)
      .map((s) => `${scorecardStarsieho(data, s.elder).nazov} +${priazenSila(s.elder)}`)
      .join(" · ") || "žiadna";
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);

  const stred =
    krok !== null ? (
      <span className="ls-nahlad" aria-live="polite">
        {nahladovany?.klik !== undefined ? (
          <>
            <b>{nahladovany.meno}</b>
            {" — "}
            {nahladovany.klik.akcia}
          </>
        ) : (
          <span className="ls-tlmene">Prejdi myšou alebo Tabom na staršieho — tu uvidíš, čo posun urobí.</span>
        )}
      </span>
    ) : (
      <span className="ls-suhrn">
        vydesení <b className="moje">ty {vydeseni[ja]}/{prahVydesenia}</b> · <b className="superove">{mena[su]} {vydeseni[su]}/{prahVydesenia}</b>
        <span className="ls-oddel" aria-hidden="true">·</span>
        body <b className="moje">ty {znamienko(spolu[ja])}</b> · <b className="superove">{mena[su]} {znamienko(spolu[su])}</b>
      </span>
    );

  return (
    <div className={`linia-starsich${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}`}>
      <div className="ls-hlava">
        {tlacidlo}
        <span className="ls-priazne moje">
          <b>♥ tvoje:</b> {priazne(ja)}
        </span>
        {stred}
        <span className="ls-priazne superove">
          <b>♥ {mena[su]}:</b> {priazne(su)}
        </span>
      </div>
      <div className="ls-rad">
        {starsi.map((s, i) => (
          <ScorecardVLinii
            key={s.elder.elderId}
            s={s}
            poradie={i + 1}
            data={data}
            ikony={ikony}
            ja={ja}
            pohlad={pohlad}
            krok={krok}
            hraniceZon={hraniceZon}
            zmeneny={zmenene.has(s.elder.elderId)}
            nahlad={nahlad === s.elder.elderId}
            onNahlad={(n) => setNahlad(n ? s.elder.elderId : (x) => (x === s.elder.elderId ? null : x))}
            kto={kto}
          />
        ))}
      </div>
    </div>
  );
}

function ScorecardVLinii({
  s,
  poradie,
  data,
  ikony,
  ja,
  pohlad,
  krok,
  hraniceZon,
  zmeneny,
  nahlad,
  onNahlad,
  kto,
}: {
  readonly s: StarsiVLinii;
  readonly poradie: number;
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  readonly pohlad: PlayerId;
  readonly krok: string | null;
  readonly hraniceZon: boolean;
  readonly zmeneny: boolean;
  readonly nahlad: boolean;
  readonly onNahlad: (n: boolean) => void;
  readonly kto: (p: PlayerId) => string;
}) {
  const { elder, body, klik } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const sc = scorecardStarsieho(data, elder);
  const priazen = priazenHraca(elder);
  const sila = priazenSila(elder);
  const obavany = obavanyHrac(elder);
  const uroven = STUPNICA_ZONY[elder.marker];
  const podmienky = podmienkyStarsieho(data, elder);
  // Zrkadlenie (Michal 2026-10-22, #55): každý vidí svoju polovicu stupnice vľavo.
  const poloha = (m: number): number => (ja === 0 ? m : 8 - m);
  const bodyPodmienky = (strana: "lava" | "prava", index: number) =>
    body?.polozky[pohlad].find((x) => x.strana === strana && x.index === index);

  const strana = (str: "lava" | "prava"): ReactNode =>
    podmienky
      .filter((p) => p.strana === str)
      .map((p) => {
        const b = bodyPodmienky(str, p.index);
        return (
          <span
            key={p.index}
            className={`ls-podmienka${p.aktivna ? " aktivna" : ""}`}
            title={`${NAZOV_PODMIENKY[p.podmienka]} — ${p.aktivna ? `aktívna, boduje obom${b !== undefined ? ` (${kto(pohlad)} ${znamienko(b.body)})` : ""}` : "neaktívna, karta staršieho tu nemá akciu"}`}
          >
            <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
            {p.aktivna && b !== undefined && b.body !== 0 && <span className={`ls-odznak ${triedaBodov(b.body)}`}>{znamienko(b.body)}</span>}
          </span>
        );
      });

  const krokTrieda = krok === null ? "" : s.vybrany === true ? " vybrany" : klik !== undefined ? ` klik${nahlad ? " nahl" : ""}` : " nedost";
  const ciel = nahlad || s.vybrany === true ? s.ciel : null;
  const vydeseny = uroven === 3;
  const popisMarkera = `${s.meno}: ${obavany === null ? "neutrál, nebojí sa nikoho" : `${NAZOV_ZONY[uroven]}, bojí sa ${obavany === ja ? "teba" : "súpera"}`}${priazen === null ? "" : `, priazeň ${priazen === ja ? "tvoja" : "súperova"} +${sila}`}`;

  return (
    <div
      className={`ls-sc${krokTrieda}${zmeneny ? " zmena" : ""}`}
      {...(klik === undefined
        ? { "aria-label": popisMarkera + (s.dovod !== undefined ? ` — ${s.dovod}` : "") }
        : {
            role: "button",
            tabIndex: 0,
            "aria-label": `${popisMarkera} — klikni: ${klik.akcia}`,
            onClick: klik.klik,
            onKeyDown: (e: ReactKeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                klik.klik();
              }
            },
            onMouseEnter: () => onNahlad(true),
            onMouseLeave: () => onNahlad(false),
            onFocus: () => onNahlad(true),
            onBlur: () => onNahlad(false),
          })}
    >
      <div className="ls-sc-hlava">
        <b className="ls-meno">{s.meno}</b>
        <span className="ls-poradie">{poradie}</span>
      </div>
      <div className="ls-telo">
        <span className="ls-podmienky">{strana("lava")}</span>
        <span className="ls-portret">
          {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          {vydeseny && <span className={`ls-peciatka ${obavany === ja ? "moja" : "superova"}`}>vydesený</span>}
          {s.patron !== null && (
            <span className="ls-patron">
              {s.patron.kto === ja ? "v tvojej ruke" : `v ruke: ${kto(s.patron.kto)}`} · {s.patron.kto === ja ? "súper" : "ty"} +{s.patron.pohorsenia} Pohoršenia
            </span>
          )}
        </span>
        <span className="ls-podmienky">{strana("prava")}</span>
      </div>
      <Stupnica marker={poloha(elder.marker)} ciel={ciel === null || ciel === undefined ? null : poloha(ciel)} priazen={priazen === null ? null : priazen === ja ? "ja" : "su"} hranice={hraniceZon} />
      <div className="ls-pata">
        <span className={`ls-priazen ${priazen === null ? "" : priazen === ja ? "moja" : "superova"}`}>
          ♥ {priazen === null ? "nikto" : `${kto(priazen)} +${sila}`} · {sc.nazov}
        </span>
        {s.dovod !== undefined ? (
          <span className="ls-dovod">{s.dovod}</span>
        ) : (
          <span className="ls-body">
            <span className={`moje ${triedaBodov(body?.body[ja] ?? 0)}`}>★ ty {znamienko(body?.body[ja] ?? 0)}</span>
            <span className={`superove ${triedaBodov(body?.body[su] ?? 0)}`}>súper {znamienko(body?.body[su] ?? 0)}</span>
          </span>
        )}
        <span className="ls-ucinok">
          {priazen === null ? (
            <>
              <b>Priazeň</b> nemá nikto — získa ju, kto marker potiahne k sebe.
            </>
          ) : (
            <>
              <b>{priazen === ja ? "Tvoja" : "Súperova"} priazeň:</b> {UCINOK_PRIAZNE[favourStarsieho(data, elder)](sila)}
            </>
          )}
          <br />
          {obavany === null ? "nikoho sa nebojí" : `bojí sa ${obavany === ja ? "teba" : "súpera"} · úroveň ${uroven}`}
          {hraniceZon && s.hranice !== undefined && ` · hranice ${s.hranice}/2`}
        </span>
      </div>
    </div>
  );
}

/** Schodová stupnica: výška segmentu = úroveň zóny, marker je tmavý disk s prstencom priazne. */
function Stupnica({
  marker,
  ciel,
  priazen,
  hranice,
}: {
  readonly marker: number;
  readonly ciel: number | null;
  readonly priazen: "ja" | "su" | null;
  readonly hranice: boolean;
}) {
  return (
    <span className="ls-stupnica" aria-hidden="true">
      {FARBY_STUPNICE.map((f, k) => (
        <i key={k} style={{ background: f, "--z": STUPNICA_ZONY[k] } as CSSProperties} />
      ))}
      {hranice &&
        [1, 2, 3, 6, 7, 8]
          .filter((b) => prekraciaHranicu((b - 1) as MarkerPos, b as MarkerPos))
          .map((b) => <em key={b} style={{ "--b": b } as CSSProperties} />)}
      <b className={`ls-marker${priazen === null ? "" : ` ${priazen}`}`} style={{ "--p": marker } as CSSProperties} />
      {ciel !== null && ciel !== marker && <b className="ls-marker duch" style={{ "--p": ciel } as CSSProperties} />}
    </span>
  );
}
