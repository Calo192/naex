// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A): osem
// scorecardov v rade na mieste línie kariet. Ukáže sa po kliku na Body
// a sama pri krokoch na staršom (Pohoršenie, prebytok, patronát).
// Scorecard je prekreslený v HTML: podmienky po bokoch portrétu, schodová
// stupnica so zrkadlením (tvoja polovica vľavo), priazeň, body a strach.

import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { BodyStarsieho, ElderState, GameData, PlayerId, Podmienka } from "@naex/core";
import { STUPNICA_ZONY, favourStarsieho, obavanyHrac, podmienkyStarsieho, prekraciaHranicu, priazenHraca, priazenSila, scorecardStarsieho, type MarkerPos } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { KRATKO_PODMIENKA } from "./BodovyBar.tsx";
import { UCINOK_KRATKO, UCINOK_PRIAZNE, znamienko } from "./Scorecard.tsx";

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
  /** Pri Pohoršení svietia hranice zón (§9.2: najviac 2 na marker). */
  readonly hraniceZon: boolean;
  /** Starší, ktorých posun sa práve zmenil (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
  /** Podmienka z bodového baru pod myšou — svietia starší, u ktorých boduje (Michal 2026-10-23). */
  readonly zvyraznena?: Podmienka | null;
  /** Lupa staršieho mimo krokov (prejdenie myšou) — udalosti a data-lupa z HernaPlocha. */
  readonly lupa?: ((s: StarsiVLinii) => HTMLAttributes<HTMLElement>) | undefined;
}

const triedaBodov = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

export function LiniaStarsich({
  starsi,
  data,
  ikony,
  ja,
  pohlad,
  mena,
  vydeseni,
  prahVydesenia,
  spolu,
  krok,
  hraniceZon,
  zmenene,
  tlacidlo,
  zvyraznena = null,
  lupa,
}: LiniaStarsichProps) {
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
    <div className={`linia-starsich${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}${zvyraznena !== null ? " so-zvyraznenim" : ""}`}>
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
            zvyraznena={zvyraznena}
            lupa={krok === null ? lupa?.(s) : undefined}
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
  zvyraznena,
  lupa,
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
  readonly zvyraznena: Podmienka | null;
  readonly lupa: HTMLAttributes<HTMLElement> | undefined;
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
            className={`ls-podmienka${p.aktivna ? " aktivna" : ""}${p.aktivna && p.podmienka === zvyraznena ? " zvyraznena" : ""}`}
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
  const zvyrazneny = zvyraznena !== null && podmienky.some((p) => p.aktivna && p.podmienka === zvyraznena);
  const ucinok = ucinokPriazne(data, elder);
  const popisMarkera = `${s.meno}: ${obavany === null ? "neutrál, nebojí sa nikoho" : `${NAZOV_ZONY[uroven]}, bojí sa ${obavany === ja ? "teba" : "súpera"}`}${priazen === null ? "" : `, priazeň ${priazen === ja ? "tvoja" : "súperova"} +${sila}`}`;

  return (
    <div
      className={`ls-sc${krokTrieda}${zmeneny ? " zmena" : ""}${zvyrazneny ? " zvyrazneny" : ""}`}
      data-vyucba={`starsi:${s.elder.elderId}`}
      {...(klik === undefined
        ? { "aria-label": popisMarkera + (s.dovod !== undefined ? ` — ${s.dovod}` : ""), ...lupa }
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
        <span className="ls-ucinok-kratko" title={ucinok.cely}>
          {ucinok.kratko}
        </span>
        {s.dovod !== undefined ? (
          <span className="ls-dovod">{s.dovod}</span>
        ) : (
          <span className="ls-body">
            <span className={`moje ${triedaBodov(body?.body[ja] ?? 0)}`}>★ ty {znamienko(body?.body[ja] ?? 0)}</span>
            <span className={`superove ${triedaBodov(body?.body[su] ?? 0)}`}>súper {znamienko(body?.body[su] ?? 0)}</span>
          </span>
        )}
        <span className="ls-ucinok" title={ucinok.cely}>
          {priazen === null ? (
            <>
              <b>Priazeň</b> zatiaľ nikto — pri +1: {UCINOK_PRIAZNE[favourStarsieho(data, elder)](1)}
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
    <span className="ls-stupnica" aria-hidden="true" data-vyucba="starsi-stupnica">
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

/**
 * Účinok priazne staršieho — vždy, aj keď priazeň nemá nikto (Michal 2026-10-23:
 * hráč má vidieť, koho sa oplatí desiť). Bez priazne pri sile 1 (prvá zóna).
 */
export function ucinokPriazne(data: GameData, elder: ElderState): { readonly kratko: string; readonly cely: string } {
  const fav = favourStarsieho(data, elder);
  const sila = priazenSila(elder);
  const pri = sila > 0 ? sila : 1;
  return {
    kratko: `${sila > 0 ? "" : "pri +1: "}${UCINOK_KRATKO[fav](pri)}`,
    cely: `${sila > 0 ? `Priazeň +${sila}` : "Priazeň (zatiaľ nikoho), pri +1"}: ${UCINOK_PRIAZNE[fav](pri)}`,
  };
}

/**
 * Lupa staršieho (Michal 2026-10-23): karta staršieho s akciami, stupnica, priazeň,
 * strach a kto priazeň získa pri vydesení; pod tým podmienky 4 + 4 ako na scorecarde
 * (ľavá a pravá strana) s bodmi ty / súper a súčet. Výška podľa obsahu (Lupa ju zmeria),
 * dlhé znenia sú v titulkoch.
 */
export function LupaStarsieho({
  s,
  data,
  ikony,
  ja,
  mena,
  sirka,
  karta,
}: {
  readonly s: StarsiVLinii;
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly sirka: number;
  /** Karta staršieho s akciami (HernaKarta) v šírke ≈ 26 % lupy — výška ako text vedľa nej. */
  readonly karta: ReactNode;
}) {
  const { elder, body } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const sc = scorecardStarsieho(data, elder);
  const fav = favourStarsieho(data, elder);
  const priazen = priazenHraca(elder);
  const sila = priazenSila(elder);
  const obavany = obavanyHrac(elder);
  const uroven = STUPNICA_ZONY[elder.marker];
  const poloha = (m: number): number => (ja === 0 ? m : 8 - m);
  const podmienky = podmienkyStarsieho(data, elder);
  const bodyPodmienky = (p: (typeof podmienky)[number], h: PlayerId): number =>
    body?.polozky[h].find((x) => x.strana === p.strana && x.index === p.index)?.body ?? 0;
  const strana = (str: "lava" | "prava"): ReactNode =>
    podmienky
      .filter((p) => p.strana === str)
      .sort((a, b) => a.index - b.index)
      .map((p) => (
        <li
          key={`${p.strana}${p.index}`}
          className={p.aktivna ? "aktivna" : ""}
          title={`${NAZOV_PODMIENKY[p.podmienka]} — ${p.aktivna ? `ty ${znamienko(bodyPodmienky(p, ja))} · ${mena[su]} ${znamienko(bodyPodmienky(p, su))}` : "neaktívna, karta na ukazovateli tu nemá akciu"}`}
        >
          <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
          <span className="lst-nazov">{KRATKO_PODMIENKA[p.podmienka]}</span>
          <span className="lst-body">{p.aktivna ? `${znamienko(bodyPodmienky(p, ja))} / ${znamienko(bodyPodmienky(p, su))}` : "—"}</span>
        </li>
      ));
  return (
    <div className="lupa-starsieho" style={{ width: sirka }}>
      <div className="lst-vrch">
        <div className="lst-karta">{karta}</div>
        <div className="lst-info">
          <div className="lst-hlava">
            <b>{s.meno}</b> <span className="lst-tlmene">· {sc.nazov}</span>
          </div>
          <Stupnica marker={poloha(elder.marker)} ciel={null} priazen={priazen === null ? null : priazen === ja ? "ja" : "su"} hranice={false} />
          <p className={`lst-priazen ${priazen === null ? "" : priazen === ja ? "moja" : "superova"}`} title={UCINOK_PRIAZNE[fav](sila > 0 ? sila : 1)}>
            <b>♥ {priazen === null ? "nikto" : `${priazen === ja ? "ty" : "súper"} +${sila}`}:</b> {UCINOK_KRATKO[fav](sila > 0 ? sila : 1)}
            {sila === 0 && <span className="lst-tlmene"> (pri +1)</span>}
          </p>
          <p>{obavany === null ? "Nikoho sa nebojí." : `Bojí sa ${obavany === ja ? "teba" : "súpera"} · ${NAZOV_ZONY[uroven]}`}</p>
          <p className="lst-vydesenie" title={`Vydesíš ho ty → priazeň +3 dostane ${mena[su]}: ${UCINOK_PRIAZNE[fav](3)} Vydesí ho ${mena[su]} → dostaneš ju ty.`}>
            <b>Vydesíš</b> → súper +3 ({UCINOK_KRATKO[fav](3)}) · <b>vydesí súper</b> → ty +3
          </p>
        </div>
      </div>
      <div className="lst-podmienky" aria-label={`Podmienky scorecardu — body ty / ${mena[su]}`}>
        <ul>{strana("lava")}</ul>
        <ul>{strana("prava")}</ul>
      </div>
      <p className="lst-spolu">
        ★ tento starší: ty {znamienko(body?.body[ja] ?? 0)} · súper {znamienko(body?.body[su] ?? 0)}
        <span className="lst-tlmene"> · podmienky ty / súper</span>
      </p>
    </div>
  );
}
