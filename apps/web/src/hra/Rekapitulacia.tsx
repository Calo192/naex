// Rekapitulácia bitky a Pitky (roadmapa #106, Michal 2026-10-26, mock 2): tabuľka „koľko
// čoho“ — ty vľavo, piktogram v strede, súper vpravo; pruhy od stredu, riadky nabiehajú po
// vlnách Počítadla bitky. Viera proti Povere ako súboj v riadku (V2): každý riadok je jedna
// dvojica, ktorá sa ruší, v strede ✕n; pri zvyšnej Povere vidno súperove priznané Dlhy.
// NA EX ide majiteľovi karty. Čísla sú z jadra (rekapitulaciaBitky, rekapitulaciaPitky) —
// tu sa len kreslia a odkrývajú po vlnách. Tabuľka nezmizne sama, zavrie ju až Ďalej.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Action, AkciaTuha, PlayerId, PolozkaRekapitulacie, RekapitulaciaBitky, RekapitulaciaPitky, ZaverecnaOdhalena } from "@naex/core";
import { AKCIE_TUHE, pecenPitky, rozlozRod, zadlzeniePitky } from "@naex/core";
import { SpakyBitky } from "./Spaky.tsx";

/** Piktogram akcie a jej názov zo sady (HernaPlocha). */
export interface PiktogramyRekapitulacie {
  readonly ikona: (k: Action) => ReactNode;
  readonly nazov: (k: Action) => string;
}

type Strana = "l" | "r";

/** Číslo a pruh od stredu; „+n“ vyletí, keď hodnota v tejto vlne narástla. */
function Hodnota({ strana, n, max, prirastok, title, children }: { readonly strana: Strana; readonly n: number; readonly max: number; readonly prirastok?: number; readonly title?: string | undefined; readonly children?: ReactNode }) {
  return (
    <div className={`rk-hod ${strana}`} role="cell" title={title}>
      <b className={n === 0 ? "nula" : prirastok !== undefined && prirastok > 0 ? "buch" : undefined} key={prirastok !== undefined && prirastok > 0 ? `b${n}` : "b"}>
        {n > 0 ? n : "–"}
      </b>
      {max > 0 && <span className="rk-pruh" style={{ width: `${Math.min(1, n / max) * 7.5}rem` }} />}
      {children}
      {prirastok !== undefined && prirastok > 0 && (
        <span className="rk-plus" key={`p${n}`}>
          +{prirastok}
        </span>
      )}
    </div>
  );
}

function Stred({ ikona, nazov, pod, title }: { readonly ikona: ReactNode; readonly nazov: string; readonly pod?: string; readonly title?: string | undefined }) {
  return (
    // Na nízkom okne je názov skrytý (hra.css) — ostane v tooltipe.
    <div className="rk-stred" role="rowheader" title={title ?? (pod === undefined ? nazov : `${nazov} · ${pod}`)}>
      {ikona}
      <span className="rk-nazov">
        {nazov}
        {pod !== undefined && <small> {pod}</small>}
      </span>
    </div>
  );
}

/** NA EX v strede riadku: poldeci a „×2“ či „✕“. */
function ZnakNaex({ znak, ikona }: { readonly znak: string; readonly ikona: ReactNode }) {
  return (
    <span className="rk-naex">
      {ikona}
      {znak}
    </span>
  );
}

/** Karta kliatby na výšku (priznaný Dlh, nová Cirhóza) — ako malá karta, nie ako akcia. */
export function KartaKliatby({ ikona, kto, svieti = false, prazdna = false }: { readonly ikona?: ReactNode; readonly kto?: "ja" | "su"; readonly svieti?: boolean; readonly prazdna?: boolean }) {
  return <span className={`rk-kk${kto === undefined ? "" : ` ${kto}`}${svieti ? " svieti" : ""}${prazdna ? " prazdna" : ""}`}>{prazdna ? null : ikona}</span>;
}

function Cip({ trieda, title, children }: { readonly trieda: string; readonly title?: string | undefined; readonly children: ReactNode }) {
  return (
    <span className={`rk-cip ${trieda}`} title={title}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bitka

export interface RekapBitkyProps {
  readonly r: RekapitulaciaBitky;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  /** Vlna Počítadla bitky (−1 = ešte nič); po poslednej je hotovo. */
  readonly vlna: number;
  readonly hotovo: boolean;
  /** Vlna karty v línii (null = mimo línie: priazeň, patronát). */
  readonly vlnaKarty: (uid: number | null) => number;
  /** Kedy sa Viera s Poverou zrušia a kedy zvyšok zaberie (vlny bonusov a zrážok). */
  readonly vlnaRusenia: number;
  readonly vlnaUcinku: number;
  /** Mená oboch hráčov (index = miesto) — hlášky odhalenej Záverečnej. */
  readonly mena?: readonly [string, string];
}

/**
 * Odhalené Záverečné (Michal 2026-10-27: „nevidel som, čo vlastne zahral“): riadok
 * „Záverečná: karta — čo urobila“ cez celú šírku — akcie, ktoré v Pitke dávala, a čo
 * spravila pri otočení (Nástup, odložené efekty). Hlášky motora s menami hráčov.
 */
function ZaverecneRiadky({
  zaverecne,
  ja,
  mena,
  menoKarty,
  piktogramy,
}: {
  readonly zaverecne: readonly ZaverecnaOdhalena[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
}) {
  const hlaska = (text: string): string => rozlozRod(text, [null, null]).replace(/[Hh]ráč ([12])/g, (_, n: string) => mena[Number(n) - 1] ?? `Hráč ${n}`);
  return (
    <>
      {zaverecne.map((z, i) => {
        const akcie = (Object.entries(z.akcie) as [Action, number][]).filter(([, n]) => n > 0);
        const efekty = z.efekty.map(hlaska);
        return (
          <div key={z.uid} className={`rk-riadok rk-zaverecna${i === 0 ? " nova-skupina" : ""}`} role="row">
            <span className="rk-zaverecna-text" role="cell">
              <span className="rk-zaverecna-kto">Záverečná · {z.majitel === ja ? "tvoja" : mena[z.majitel]}:</span> <b>{menoKarty(z.defId)}</b> —{" "}
              {akcie.length > 0 && (
                <span className="rk-zaverecna-akcie" title={akcie.map(([a, n]) => `${piktogramy.nazov(a)} ${n}`).join(" · ")}>
                  dala{" "}
                  {akcie.map(([a, n]) => (
                    <span key={a} className="rk-zaverecna-akcia">
                      {piktogramy.ikona(a)}
                      {n > 1 ? `×${n}` : ""}
                    </span>
                  ))}
                </span>
              )}
              {akcie.length > 0 && efekty.length > 0 && " · "}
              {efekty.length > 0 ? efekty.join(" ") : akcie.length === 0 ? "žiadna jej akcia nebola aktívna, pri otočení bez efektu" : ""}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** Koľko riadkov tabuľka bitky na konci má — HernaPlocha podľa toho zmenší karty línie. */
export function riadkovRekapitulacieBitky(r: RekapitulaciaBitky): number {
  let n = 2; // hlavička a súčet
  for (const a of AKCIE_TUHE) if (r.tuhe[a].length > 0) n++;
  if (r.viera.length + r.povera.length > 0) n += 2.6;
  if (r.pohorsenie.polozky.length > 0) n++;
  if (r.naex.karty.length > 0) n += 2;
  if (r.pitkyKola !== null) n += 2.5 + 1.4 * (r.pitkyKola.zaverecne?.length ?? 0);
  if (r.spaky !== undefined) n += 3;
  return n;
}

export function RekapBitky({ r, ja, menoSupera, menoKarty, piktogramy, vlna, hotovo, vlnaKarty, vlnaRusenia, vlnaUcinku, mena }: RekapBitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona, nazov } = piktogramy;
  const vid = (uid: number | null, w = vlna): boolean => hotovo || vlnaKarty(uid) <= w;
  const sucet = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId, w = vlna): number => xs.filter((x) => x.kto === kto && vid(x.uid, w)).reduce((a, x) => a + x.n, 0);
  const konecne = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId): number => xs.filter((x) => x.kto === kto).reduce((a, x) => a + x.n, 0);
  const naexPolozky = (k: "zdvojilo" | "zrusilo"): PolozkaRekapitulacie[] => r.naex.karty.filter((x) => x[k] > 0).map((x) => ({ kto: x.majitel, uid: x.uid, n: x[k] }));
  const naexX2 = naexPolozky("zdvojilo");
  const naexZrus = naexPolozky("zrusilo");
  const riadkyPruhov: readonly (readonly PolozkaRekapitulacie[])[] = [...AKCIE_TUHE.map((a) => r.tuhe[a]), r.pohorsenie.polozky, naexX2, naexZrus];
  const max = Math.max(1, ...riadkyPruhov.flatMap((xs) => [konecne(xs, ja), konecne(xs, su)]));
  const prirastok = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId): number => (hotovo ? 0 : sucet(xs, kto) - sucet(xs, kto, vlna - 1));
  const titulNaex = (k: "zdvojilo" | "zrusilo", kto: PlayerId): string =>
    r.naex.karty
      .filter((x) => x.majitel === kto && x[k] > 0)
      .map((x) => `${x.dal === ja ? "tvoje" : "súperovo"} NA EX na ${kto === ja ? "tvojej karte" : "jeho karte"} ${menoKarty(x.defId)}: ${x[k]}`)
      .join(" · ");

  const riadok = (kluc: string, xs: readonly PolozkaRekapitulacie[], stred: ReactNode, novaSkupina: boolean, title?: (kto: PlayerId) => string): ReactNode => {
    if (xs.length === 0 || !xs.some((x) => vid(x.uid))) return null;
    return (
      <div key={kluc} className={`rk-riadok${novaSkupina ? " nova-skupina" : ""}`} role="row">
        <Hodnota strana="l" n={sucet(xs, ja)} max={max} prirastok={prirastok(xs, ja)} title={title?.(ja)} />
        {stred}
        <Hodnota strana="r" n={sucet(xs, su)} max={max} prirastok={prirastok(xs, su)} title={title?.(su)} />
      </div>
    );
  };
  const tuhe = AKCIE_TUHE.map((a: AkciaTuha, i) => riadok(a, r.tuhe[a], <Stred ikona={ikona(a)} nazov={nazov(a)} pod={`${i + 1} tuhé`} />, false));
  const poldeci = ikona("Poldeci");
  const pitky = r.pitkyKola;

  return (
    // Miesto pre všetky riadky od začiatku — línia nad tabuľkou neposkakuje, keď riadky nabiehajú.
    <div className="rekap" role="table" aria-label="Rekapitulácia bitky" style={{ "--rk-riadkov": riadkovRekapitulacieBitky(r) } as CSSProperties}>
      <div className="rk-hlava" role="row">
        <span className="l" role="columnheader">
          ty
        </span>
        <span className="s" role="columnheader">
          akcia
        </span>
        <span className="r" role="columnheader">
          {menoSupera}
        </span>
      </div>
      {tuhe}
      <VieraPovera r={r} ja={ja} menoSupera={menoSupera} piktogramy={piktogramy} vid={vid} rusi={hotovo || vlna >= vlnaRusenia} ucinkuje={hotovo || vlna >= vlnaUcinku} />
      {riadok("pohorsenie", r.pohorsenie.polozky, <Stred ikona={ikona("Pohoršenie")} nazov={nazov("Pohoršenie")} />, true)}
      {riadok("naex-x2", naexX2, <Stred ikona={<ZnakNaex znak="×2" ikona={poldeci} />} nazov="NA EX" pod="zdvojilo" />, true, (kto) => titulNaex("zdvojilo", kto))}
      {riadok("naex-zrus", naexZrus, <Stred ikona={<ZnakNaex znak="✕" ikona={poldeci} />} nazov="NA EX" pod="zrušilo" />, naexX2.length === 0, (kto) => titulNaex("zrusilo", kto))}
      {hotovo && pitky !== null && (
        <>
          <div className="rk-sekcia" role="row">
            z Pitiek kola · {pitky.pocet} {pitky.pocet === 1 ? "Pitka" : pitky.pocet < 5 ? "Pitky" : "Pitiek"}
          </div>
          {(
            [
              ["dlh", "Dlh", nazov("Dlh"), "zadĺženie", pitky.zadlzenie, pitky.dlhy, "kariet Dlh"],
              ["pecen", "PoškodeniePečene", "pečeň", "poškodenie", pitky.pecen, pitky.cirhozy, "Cirhóz"],
            ] as const
          ).map(([kluc, akcia, meno, pod, hodnoty, karty, coKarty]) => {
            const m = Math.max(1, hodnoty[0], hodnoty[1]);
            const strana = (s: Strana, kto: PlayerId): ReactNode => (
              <Hodnota strana={s} n={hodnoty[kto]} max={m}>
                <Cip trieda={karty[kto] > 0 ? "zisk" : "nic"} title={`${karty[kto]} ${coKarty} za kolo`}>
                  → {karty[kto]} <KartaKliatby ikona={ikona(akcia)} />
                </Cip>
              </Hodnota>
            );
            return (
              <div key={kluc} className="rk-riadok" role="row">
                {strana("l", ja)}
                <Stred ikona={ikona(akcia)} nazov={meno} pod={pod} />
                {strana("r", su)}
              </div>
            );
          })}
          {(pitky.zaverecne?.length ?? 0) > 0 && (
            <ZaverecneRiadky
              zaverecne={pitky.zaverecne ?? []}
              ja={ja}
              mena={mena ?? (ja === 0 ? ["ty", menoSupera] : [menoSupera, "ty"])}
              menoKarty={menoKarty}
              piktogramy={piktogramy}
            />
          )}
        </>
      )}
      {hotovo && <SucetBitky r={r} ja={ja} menoSupera={menoSupera} ikonaPovery={ikona("Povera")} />}
      {/* Špaky bitky (v6): za bitku, za starších, Exekútor; prebytok vo finále dopíše až nástenka. */}
      {hotovo && r.spaky !== undefined && (
        <div className="rk-spaky" role="row">
          <SpakyBitky b={r.spaky} ja={ja} mena={ja === 0 ? ["ty", menoSupera] : [menoSupera, "ty"]} />
        </div>
      )}
    </div>
  );
}

/** Celkové = tuhé + Povery, ktoré zabrali; komu ide prebytok (PRAVIDLA §9.4). */
function SucetBitky({ r, ja, menoSupera, ikonaPovery }: { readonly r: RekapitulaciaBitky; readonly ja: PlayerId; readonly menoSupera: string; readonly ikonaPovery: ReactNode }) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const cast = (kto: PlayerId): ReactNode => (
    <span className={kto === ja ? "ja" : "su"}>
      <b>{r.tuheSpolu[kto]}</b>
      {r.makke[kto] > 0 && (
        <>
          {" + "}
          {ikonaPovery}
          <b>{r.makke[kto]}</b>
          {" = "}
          <b>{r.celkove[kto]}</b>
        </>
      )}
    </span>
  );
  return (
    <div className="rk-sucet" role="row">
      celkové {cast(ja)} : {cast(su)}
      <span>
        {r.prebytokDrzi === null ? " · prebytok nikto" : ` · prebytok ${r.prebytok} → ${r.prebytokDrzi === ja ? "ty" : menoSupera}`}
      </span>
    </div>
  );
}

/**
 * Viera × Povera, súboj v riadku (V2): riadok A je tvoja Viera proti jeho Povere, riadok B
 * tvoja Povera proti jeho Viere. Žetóny od stredu; zrušené zhasnú, v strede ostane ✕n.
 * Zvyšná Viera uberie tuhé, zvyšná Povera zaberie len na súperove priznané Dlhy.
 */
function VieraPovera({
  r,
  ja,
  menoSupera,
  piktogramy,
  vid,
  rusi,
  ucinkuje,
}: {
  readonly r: RekapitulaciaBitky;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly vid: (uid: number | null) => boolean;
  readonly rusi: boolean;
  readonly ucinkuje: boolean;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona } = piktogramy;
  if (r.viera.length + r.povera.length === 0) return null;
  /** Žetóny jednej strany: každá jednotka zvlášť, s vlnou svojej karty. */
  const zetony = (druh: "Viera" | "Povera", kto: PlayerId): (number | null)[] =>
    (druh === "Viera" ? r.viera : r.povera).filter((x) => x.kto === kto).flatMap((x) => Array<number | null>(x.n).fill(x.uid));
  const strana = (s: Strana, druh: "Viera" | "Povera", kto: PlayerId): ReactNode => {
    const z = zetony(druh, kto);
    const zrusenych = druh === "Viera" ? r.zrusenaViera[kto] : r.zrusenaPovera[kto];
    const kto2 = kto === ja ? "ja" : "su";
    const proti: PlayerId = kto === 0 ? 1 : 0;
    let ucinok: ReactNode = null;
    if (ucinkuje && druh === "Viera" && r.vieraUbera[kto] > 0) {
      ucinok = (
        <Cip trieda={kto2} title={`zvyšná Viera uberá ${kto === ja ? menoSupera : "tebe"} ${r.vieraUbera[kto]} tuhé`}>
          −{r.vieraUbera[kto]} tuhé
        </Cip>
      );
    }
    if (ucinkuje && druh === "Povera" && z.length > zrusenych) {
      // Súperove priznané Dlhy ako karty: tie, na ktoré Povera zabrala, svietia.
      const strop = r.bezStropu[kto] ? r.makke[kto] : r.priznaneDlhy[proti];
      const kariet = Math.min(strop, 6);
      ucinok = (
        <>
          <span className="vp-karty" title={r.bezStropu[kto] ? "Čierna mačka: bez stropu" : `${proti === ja ? "Ty máš" : `${menoSupera} má`} ${r.priznaneDlhy[proti]} priznaných Dlhov`}>
            {kariet === 0 && <KartaKliatby prazdna />}
            {Array.from({ length: kariet }, (_, i) => (
              <KartaKliatby key={i} ikona={ikona("Dlh")} kto={proti === ja ? "ja" : "su"} svieti={i < r.makke[kto]} />
            ))}
          </span>
          <Cip trieda={r.makke[kto] > 0 ? "zisk" : "nic"} title={`${r.makke[kto]} z ${z.length - zrusenych} zabrali (do celkového, prebytok)`}>
            {r.makke[kto] > 0 ? `+${r.makke[kto]}` : "0"}
          </Cip>
        </>
      );
    }
    return (
      <div className={`vp-strana ${s}`} role="cell">
        <span className="vp-zetony">
          {z.map((uid, i) => {
            if (!vid(uid)) return null;
            const zrusena = rusi && i < zrusenych;
            const zvysok = i - zrusenych;
            const stav = zrusena
              ? " zrusena"
              : !ucinkuje
                ? ""
                : druh === "Viera"
                  ? " zostala"
                  : zvysok < r.makke[kto]
                    ? " zabrala"
                    : " naprazdno";
            return (
              <span key={i} className={`vp-zeton ${kto2}${stav}`}>
                {ikona(druh)}
              </span>
            );
          })}
        </span>
        {ucinok !== null && <span className="vp-ucinok">{ucinok}</span>}
      </div>
    );
  };
  const riadok = (id: string, lavy: "Viera" | "Povera", pravy: "Viera" | "Povera", zrusene: number): ReactNode => {
    const viditelne = [...zetony(lavy, ja), ...zetony(pravy, su)].some((uid) => vid(uid));
    if (!viditelne) return null;
    return (
      <div key={id} className="vp-riadok" role="row">
        {strana("l", lavy, ja)}
        <div className="vp-stred" role="rowheader" title={`tvoja ${lavy} proti jeho ${pravy === "Viera" ? "Viere" : "Povere"}`}>
          <span className="vp-dvojica">
            {ikona(lavy)}
            <span className="vs">×</span>
            {ikona(pravy)}
          </span>
          {rusi && zrusene > 0 && (
            <span className="vp-ruseni" title={`${zrusene} ${zrusene === 1 ? "dvojica sa zrušila" : "dvojice sa zrušili"}`}>
              ✕{zrusene}
            </span>
          )}
        </div>
        {strana("r", pravy, su)}
      </div>
    );
  };
  return (
    <div className="vp" role="rowgroup">
      {riadok("A", "Viera", "Povera", r.zrusenaViera[ja])}
      {riadok("B", "Povera", "Viera", r.zrusenaPovera[ja])}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pitka

/** Dieliky zoskupené po prahu: plný prah = karta, neúplný posledný prepadne (po Pitke sa nuluje). */
function Meter({ bunky, prah }: { readonly bunky: readonly string[]; readonly prah: number }) {
  const skupiny: string[][] = [];
  for (let i = 0; i < bunky.length; i += prah) skupiny.push(bunky.slice(i, i + prah));
  return (
    <span className="rk-mer">
      {skupiny.map((g, i) => (
        <span key={i} className={`rk-prah ${g.length === prah ? "plny" : "prepadne"}`} title={g.length === prah ? "plný prah = karta" : `${g.length} z ${prah} — zvyšok po Pitke prepadne`}>
          {g.map((c, j) => (
            <span key={j} className={`rk-bk${c === "" ? "" : ` ${c}`}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

export interface RekapitulaciaPitkyProps {
  readonly r: RekapitulaciaPitky;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  /** „Pitka 2 / 4 · Krčma“. */
  readonly nadpis: string;
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly onKoniec: () => void;
}


export function RekapitulaciaPitkyVrstva({ r, ja, mena, nadpis, menoKarty, piktogramy, onKoniec }: RekapitulaciaPitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona, nazov } = piktogramy;
  const tlmene = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const zaverecne = r.zaverecne ?? [];
  // Krok: 0 NA EX, 1 Dlh, 2 pečeň, 3 cigarety a Vízia, 4 odhalené Záverečné (PRAVIDLA §7 Vyhodnotenie Pitky).
  const KROKOV_PITKY = zaverecne.length > 0 ? 5 : 4;
  const [krok, setKrok] = useState(tlmene ? KROKOV_PITKY - 1 : -1);
  const hotovo = krok >= KROKOV_PITKY - 1;
  useEffect(() => {
    if (hotovo) return;
    const t = setTimeout(() => setKrok((k) => k + 1), krok < 0 ? 600 : 1100);
    return () => clearTimeout(t);
  }, [krok, hotovo]);
  const dobehni = (): void => setKrok(KROKOV_PITKY - 1);
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" && e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Enter" && hotovo) onKoniec();
      else dobehni();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  });

  const vid = (k: number): boolean => hotovo || krok >= k;
  const naex = r.naex.karty.length > 0;
  const maxNaex = Math.max(1, ...r.naex.zdvojilo, ...r.naex.zrusilo);
  const titulNaex = (k: "zdvojilo" | "zrusilo", kto: PlayerId): string =>
    r.naex.karty
      .filter((x) => x.majitel === kto && x[k] > 0)
      .map((x) => `${x.dal === ja ? "tvoje" : "súperovo"} NA EX na ${kto === ja ? "tvojej karte" : "jeho karte"} ${menoKarty(x.defId)}: ${x[k]}`)
      .join(" · ");

  const dlh = (s: Strana, kto: PlayerId): ReactNode => {
    const n = zadlzeniePitky(r, kto);
    const karty = r.zadlzenie.dlhy[kto];
    return (
      <div className={`rk-hod ${s}`} role="cell">
        <b className={n === 0 ? "nula" : undefined}>{n > 0 ? n : "–"}</b>
        <Meter bunky={Array<string>(n).fill("")} prah={r.zadlzenie.prah} />
        {n > 0 && (
          <Cip trieda={karty > 0 ? "zisk" : "nic"} title={`${karty} kariet Dlh, hneď priznané`}>
            +{karty} <KartaKliatby ikona={ikona("Dlh")} />
          </Cip>
        )}
      </div>
    );
  };
  const pecen = (s: Strana, kto: PlayerId): ReactNode => {
    const p = r.pecen;
    const bunky = [
      ...Array<string>(p.zPitia[kto] + p.zNaex[kto]).fill("z-pitia"),
      ...Array<string>(p.poskodenie[kto]).fill(""),
      ...Array<string>(p.poldeci[kto]).fill("z-poldeci"),
    ];
    const n = pecenPitky(r, kto);
    const cir = p.cirhozy[kto];
    return (
      <div
        className={`rk-hod ${s}`}
        role="cell"
        title={`vypité do dna ${p.zPitia[kto]} · NA EX ${p.zNaex[kto]} · ${nazov("PoškodeniePečene")} ${p.poskodenie[kto]} · ${nazov("Poldeci")} ${p.poldeci[kto]}`}
      >
        <b className={n === 0 ? "nula" : undefined}>{n > 0 ? n : "–"}</b>
        <Meter bunky={bunky} prah={p.prah[kto]} />
        <Cip trieda={cir > 0 ? "zisk" : "nic"} title={cir > 0 ? `${cir} Cirhóza do odhadzovacieho balíčka` : `${n} z ${p.prah[kto]} — prepadne`}>
          +{cir} <KartaKliatby ikona={ikona("PoškodeniePečene")} />
        </Cip>
      </div>
    );
  };
  const cigarety = (s: Strana, kto: PlayerId): ReactNode => {
    const c = r.cigarety;
    const a = c.akcie[kto];
    const obm = c.obmedzenie[kto];
    const bunky = [...Array<string>(a - obm).fill(""), ...Array<string>(obm).fill("obm"), ...Array<string>(c.cigorky[kto]).fill("z-cigorky")];
    return (
      <div className={`rk-hod ${s}`} role="cell" title={`${a} ${nazov("Cigareta")} − ${obm} súperovo ${nazov("Obmedzenie")}${c.cigorky[kto] > 0 ? ` + ${c.cigorky[kto]} Cigorky` : ""}`}>
        <b className={a === 0 ? "nula" : undefined}>{a > 0 ? a : "–"}</b>
        {bunky.length > 0 && <Meter bunky={bunky} prah={Math.max(1, bunky.length)} />}
        {obm > 0 && <span className="rk-obm" aria-label={`súperovo ${nazov("Obmedzenie")}`}>{ikona("Obmedzenie")}</span>}
        <Cip trieda={c.zisk[kto] > 0 ? "zisk" : "nic"}>
          +{c.zisk[kto]} {ikona("Cigareta")}
        </Cip>
      </div>
    );
  };
  const vizia = r.vizia[0] + r.vizia[1] > 0;

  return (
    <div
      className={`pocitadlo-bitky rekap-pitky${hotovo ? " hotova" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${nadpis}: rekapitulácia`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".rk-dalej")) dobehni();
      }}
    >
      <div className="pocitadlo-scena">
        <div className="pocitadlo-panel hotovo">
          <span className="pocitadlo-nadpis">{nadpis}</span>
          <span className="pocitadlo-vyhodnotena">vyhodnotená</span>
          <span className="pocitadlo-mena">ty · {mena[su]}</span>
        </div>
        <div className="rekap" role="table" aria-label="Rekapitulácia Pitky">
          <div className="rk-hlava" role="row">
            <span className="l" role="columnheader">
              ty
            </span>
            <span className="s" role="columnheader">
              krok
            </span>
            <span className="r" role="columnheader">
              {mena[su]}
            </span>
          </div>
          {naex && vid(0) && (
            <>
              {(
                [
                  ["zdvojilo", "×2"],
                  ["zrusilo", "✕"],
                ] as const
              ).map(([k, znak]) => (
                <div key={k} className="rk-riadok" role="row">
                  <Hodnota strana="l" n={r.naex[k][ja]} max={maxNaex} prirastok={krok === 0 ? r.naex[k][ja] : 0} title={titulNaex(k, ja)} />
                  <Stred ikona={<ZnakNaex znak={znak} ikona={ikona("Poldeci")} />} nazov="NA EX" pod={k === "zdvojilo" ? "zdvojilo" : "zrušilo"} />
                  <Hodnota strana="r" n={r.naex[k][su]} max={maxNaex} prirastok={krok === 0 ? r.naex[k][su] : 0} title={titulNaex(k, su)} />
                </div>
              ))}
            </>
          )}
          {vid(1) && (
            <div className={`rk-riadok${naex ? " nova-skupina" : ""}`} role="row">
              {dlh("l", ja)}
              <Stred ikona={ikona("Dlh")} nazov={nazov("Dlh")} pod={`zadĺženie, prah ${r.zadlzenie.prah}`} />
              {dlh("r", su)}
            </div>
          )}
          {vid(2) && (
            <div className="rk-riadok" role="row">
              {pecen("l", ja)}
              <Stred
                ikona={ikona("PoškodeniePečene")}
                nazov="pečeň"
                pod={r.pecen.prah[0] === r.pecen.prah[1] ? `prah ${r.pecen.prah[0]}` : `prah ${r.pecen.prah[ja]} : ${r.pecen.prah[su]}`}
              />
              {pecen("r", su)}
            </div>
          )}
          {vid(3) && (
            <div className="rk-riadok nova-skupina" role="row">
              {cigarety("l", ja)}
              <Stred ikona={ikona("Cigareta")} nazov="cigarety" pod={`− ${nazov("Obmedzenie")}`} />
              {cigarety("r", su)}
            </div>
          )}
          {vid(3) && vizia && (
            <div className="rk-riadok" role="row">
              <Hodnota strana="l" n={r.vizia[ja]} max={Math.max(1, ...r.vizia)} title="vrchné karty, ktoré prezrieš" />
              <Stred ikona={ikona("Vízia")} nazov={nazov("Vízia")} pod="pozretí" />
              <Hodnota strana="r" n={r.vizia[su]} max={Math.max(1, ...r.vizia)} />
            </div>
          )}
          {vid(4) && zaverecne.length > 0 && <ZaverecneRiadky zaverecne={zaverecne} ja={ja} mena={mena} menoKarty={menoKarty} piktogramy={piktogramy} />}
        </div>
        <div className="rk-legenda" aria-hidden="true">
          <span>
            <span className="rk-bk z-pitia" /> pitie a NA EX
          </span>
          <span>
            <span className="rk-bk z-poldeci" /> z akcie {nazov("Poldeci")}
          </span>
          <span>
            <span className="rk-bk obm" /> zrušilo súperovo {nazov("Obmedzenie")}
          </span>
          <span>
            <span className="rk-prah plny">
              <span className="rk-bk" />
              <span className="rk-bk" />
            </span>{" "}
            plný prah → karta ·{" "}
            <span className="rk-prah prepadne">
              <span className="rk-bk" />
            </span>{" "}
            zvyšok prepadne
          </span>
        </div>
        <div className="pocitadlo-pata">
          <div className="pocitadlo-koniec">
            {hotovo && (
              <button type="button" className="rk-dalej" onClick={onKoniec} autoFocus>
                Ďalej
              </button>
            )}
          </div>
          <span className="pocitadlo-tip">{hotovo ? "Enter alebo Ďalej zavrie" : "klik, Esc alebo medzerník dobehne"}</span>
        </div>
      </div>
      {/* Hráč s čítačkou počuje aj to, kto čo dostal — nielen pruhy. */}
      <span className="rk-citacka" aria-live="polite">
        {hotovo
          ? `Ty: ${r.zadlzenie.dlhy[ja]} Dlh, ${r.pecen.cirhozy[ja]} Cirhóza, ${r.cigarety.zisk[ja]} cigariet. ${mena[su]}: ${r.zadlzenie.dlhy[su]} Dlh, ${r.pecen.cirhozy[su]} Cirhóza, ${r.cigarety.zisk[su]} cigariet.`
          : ""}
      </span>
    </div>
  );
}
