// Rekapitulácia bitky a Pitky (roadmapa #106, Michal 2026-10-26, mock 2): tabuľka „koľko
// čoho“ — ty vľavo, piktogram v strede, súper vpravo; pruhy od stredu, riadky nabiehajú po
// vlnách Počítadla bitky. Viera proti Povere ako súboj v riadku (V2): každý riadok je jedna
// dvojica, ktorá sa ruší, v strede ✕n; pri zvyšnej Povere vidno súperove priznané Dlhy.
// NA EX ide majiteľovi karty. Čísla sú z jadra (rekapitulaciaBitky, rekapitulaciaPitky) —
// tu sa len kreslia a odkrývajú po vlnách. Tabuľka nezmizne sama, zavrie ju až Ďalej.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Action, AkciaRekapitulacie, AkciaTuha, CielVykladania, NaexRekapitulacie, PlayerId, PolozkaRekapitulacie, RekapitulaciaBitky, RekapitulaciaPitky, ZaverecnaOdhalena } from "@naex/core";
import { AKCIE_TUHE, pecenPitky, prahDlhuPitky, rozlozRod, zadlzeniePitky } from "@naex/core";
import { SpakyBitky, riadkovRozpisuStarsich } from "./Spaky.tsx";

/** Piktogram akcie a jej názov zo sady (HernaPlocha). */
export interface PiktogramyRekapitulacie {
  readonly ikona: (k: Action) => ReactNode;
  readonly nazov: (k: Action) => string;
}

type Strana = "l" | "r";

/** Odpoveď na odkryté NA EX (udalosť odpovedNaNaex) — defId null = bez odpovede. */
export interface OdpovedNaNaex {
  readonly hrac: PlayerId;
  readonly defId: string | null;
  readonly ciel: CielVykladania | null;
}

/**
 * Čo sa stalo s NA EX v Pitke, slovami (Michal 2026-10-28: „neviem, ako súper zareagoval na
 * moje NA EX“): kto dal NA EX na ktorú kartu a čo spravilo, potom odpovede. Prvé v rekapitulácii.
 */
export function vetyNaex(
  naex: NaexRekapitulacie,
  odpovede: readonly OdpovedNaNaex[],
  ja: PlayerId,
  mena: readonly [string, string],
  menoKarty: (defId: string) => string,
): string[] {
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const vety = naex.karty.map((x) => {
    const ucinok = [x.zdvojilo > 0 ? `zdvojilo ${x.zdvojilo}` : "", x.zrusilo > 0 ? `zrušilo ${x.zrusilo}` : ""].filter(Boolean).join(", ");
    return `NA EX — ${kto(x.dal)}: na ${x.majitel === x.dal ? "svoju" : x.majitel === ja ? "tvoju" : "súperovu"} kartu ${menoKarty(x.defId)}${ucinok === "" ? " (bez aktívnych akcií)" : ` → ${ucinok}`}`;
  });
  for (const o of odpovede) {
    vety.push(
      o.defId === null
        ? `Odpoveď na NA EX — ${kto(o.hrac)}: žiadna`
        : `Odpoveď na NA EX — ${kto(o.hrac)}: ${menoKarty(o.defId)} ${o.ciel === "vlastna" ? (o.hrac === ja ? "na tvoju stranu" : "na svoju stranu") : o.hrac === ja ? "na súperovu stranu" : "na tvoju stranu"}`,
    );
  }
  return vety;
}

/** Vety o NA EX a odpovediach na začiatku rekapitulácie — čitateľne, nie len v titulkoch pruhov. */
function NaexSlovami({ vety }: { readonly vety: readonly string[] }) {
  if (vety.length === 0) return null;
  return (
    <div className="rk-naex-vety" role="row">
      {vety.map((v) => (
        <span key={v}>{v}</span>
      ))}
    </div>
  );
}

/** Číslo a pruh od stredu; „+n“ vyletí, keď hodnota v tejto vlne narástla. */
function Hodnota({
  strana,
  n,
  max,
  prirastok,
  title,
  detail,
  children,
}: {
  readonly strana: Strana;
  readonly n: number;
  readonly max: number;
  readonly prirastok?: number;
  readonly title?: string | undefined;
  /** Ikony jednotlivých akcií — podrobný náhľad ich ukáže namiesto pruhu. */
  readonly detail?: ReactNode;
  readonly children?: ReactNode;
}) {
  const maDetail = detail !== undefined && detail !== null;
  return (
    <div className={`rk-hod ${strana}${maDetail ? " ma-detail" : ""}`} role="cell" title={title}>
      <b className={n === 0 ? "nula" : prirastok !== undefined && prirastok > 0 ? "buch" : undefined} key={prirastok !== undefined && prirastok > 0 ? `b${n}` : "b"}>
        {n > 0 ? n : "–"}
      </b>
      {max > 0 && <span className="rk-pruh" style={{ width: `${Math.min(1, n / max) * 7.5}rem` }} />}
      {maDetail && <span className="rk-detail">{detail}</span>}
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
// Podrobný náhľad (Michal 2026-10-30): zjednodušený ukáže súčet a pruh, podrobný (prepínač
// v hlavičke alebo prejdenie myšou nad riadok) ikony akcií za sebou — aktívne, zdvojené ×2
// aj zrušené (sivé, dali 0). Posilnenie a Odpor sa neukazujú, sú to modifikátory.

const KLUC_PODROBNE = "naex-rekap-podrobne";

/** Prepínač náhľadu — prehliadač si ho pamätá aj pre ďalšie rekapitulácie. */
function usePodrobne(): readonly [boolean, () => void] {
  const [podrobne, setPodrobne] = useState(() => localStorage.getItem(KLUC_PODROBNE) === "1");
  const prepni = (): void => {
    localStorage.setItem(KLUC_PODROBNE, podrobne ? "0" : "1");
    setPodrobne(!podrobne);
  };
  return [podrobne, prepni];
}

function PrepinacNahladu({ podrobne, onPrepni }: { readonly podrobne: boolean; readonly onPrepni: () => void }) {
  return (
    <button
      type="button"
      className="rk-prepni"
      aria-pressed={podrobne}
      onClick={onPrepni}
      title={podrobne ? "Späť na súčty a pruhy" : "Ikony jednotlivých akcií: zdvojené ×2, zrušené sivé (jeden riadok ukáže aj prejdenie myšou)"}
    >
      {podrobne ? "súčty" : "podrobne"}
    </button>
  );
}

/** Hlavička tabuľky: ty · akcia · súper; prepínač náhľadu v pravom rohu tabuľky. */
function HlavickaRekapitulacie({ menoSupera, podrobne, onPrepni }: { readonly menoSupera: string; readonly podrobne: boolean; readonly onPrepni: () => void }) {
  return (
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
      <PrepinacNahladu podrobne={podrobne} onPrepni={onPrepni} />
    </div>
  );
}

/** Slovami, čo akcia urobila — tooltip ikony v podrobnom náhľade. */
function popisAkcie(x: AkciaRekapitulacie, nazov: string, menoKarty: (defId: string) => string): string {
  const odkial = x.defId === null ? "mimo línie (priazeň, patronát, efekt karty)" : menoKarty(x.defId);
  if (x.zrusena) return `${nazov} — ${odkial}: zrušená ${x.dovody[0] === "Odpor" ? "Odporom" : "cez NA EX"}, dala 0`;
  if (x.n < 0) return `${nazov} — ${odkial}: efekt karty ubral ${-x.n}`;
  const preco = x.dovody.map((d) => (d === "Posilnenie" ? "posilnená" : d.startsWith("karta:") ? menoKarty(d.slice(6)) : d));
  return `${nazov} — ${odkial}${x.n > 1 ? ` ×${x.n}` : ""}${preco.length > 0 ? ` (${preco.join(", ")})` : ""}`;
}

/** Poradie ikon: obyčajné, zdvojené, mimo línie, zrušené, ubrané. */
function poradieIkony(x: AkciaRekapitulacie): number {
  if (x.n < 0) return 9;
  if (x.zrusena) return 8;
  if (x.uid === null) return 7;
  return x.n;
}

/** Ikony jednej akcie jedného hráča za sebou. */
function IkonyAkcie({
  akcia,
  xs,
  kto,
  ja,
  piktogramy,
  menoKarty,
  vid = () => true,
}: {
  readonly akcia: Action;
  readonly xs: readonly AkciaRekapitulacie[] | undefined;
  readonly kto: PlayerId;
  readonly ja: PlayerId;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly menoKarty: (defId: string) => string;
  readonly vid?: (uid: number | null) => boolean;
}) {
  const moje = (xs ?? []).filter((x) => x.kto === kto && vid(x.uid)).sort((a, b) => poradieIkony(a) - poradieIkony(b));
  if (moje.length === 0) return null;
  const nazov = piktogramy.nazov(akcia);
  return (
    <span className="rk-ikony">
      {moje.map((x, i) =>
        x.n < 0 ? (
          <span key={i} className="rk-ik-ubral" title={popisAkcie(x, nazov, menoKarty)}>
            −{-x.n}
          </span>
        ) : (
          <span key={i} className={`rk-ik ${kto === ja ? "ja" : "su"}${x.zrusena ? " zrusena" : ""}${x.uid === null ? " mimo" : ""}`} title={popisAkcie(x, nazov, menoKarty)}>
            {piktogramy.ikona(akcia)}
            {x.n > 1 && <i>×{x.n}</i>}
          </span>
        ),
      )}
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
  /** Odpovede na NA EX v Pitkách kola — blok „z Pitiek kola“ ich povie slovami. */
  readonly odpovede?: readonly OdpovedNaNaex[];
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
  if (r.spaky !== undefined) n += 3 + riadkovRozpisuStarsich(r.spaky);
  return n;
}

export function RekapBitky({ r, ja, menoSupera, menoKarty, piktogramy, vlna, hotovo, vlnaKarty, vlnaRusenia, vlnaUcinku, mena, odpovede = [] }: RekapBitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona, nazov } = piktogramy;
  const [podrobne, prepni] = usePodrobne();
  const vid = (uid: number | null, w = vlna): boolean => hotovo || vlnaKarty(uid) <= w;
  const sucet = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId, w = vlna): number => xs.filter((x) => x.kto === kto && vid(x.uid, w)).reduce((a, x) => a + x.n, 0);
  const konecne = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId): number => xs.filter((x) => x.kto === kto).reduce((a, x) => a + x.n, 0);
  const naexPolozky = (k: "zdvojilo" | "zrusilo"): PolozkaRekapitulacie[] => r.naex.karty.filter((x) => x[k] > 0).map((x) => ({ kto: x.majitel, uid: x.uid, n: x[k] }));
  const naexX2 = naexPolozky("zdvojilo");
  const naexZrus = naexPolozky("zrusilo");
  const riadkyPruhov: readonly (readonly PolozkaRekapitulacie[])[] = [...AKCIE_TUHE.map((a) => r.tuhe[a]), r.viera, r.povera, r.pohorsenie.polozky, naexX2, naexZrus];
  const max = Math.max(1, ...riadkyPruhov.flatMap((xs) => [konecne(xs, ja), konecne(xs, su)]));
  const prirastok = (xs: readonly PolozkaRekapitulacie[], kto: PlayerId): number => (hotovo ? 0 : sucet(xs, kto) - sucet(xs, kto, vlna - 1));
  const titulNaex = (k: "zdvojilo" | "zrusilo", kto: PlayerId): string =>
    r.naex.karty
      .filter((x) => x.majitel === kto && x[k] > 0)
      .map((x) => `${x.dal === ja ? "tvoje" : "súperovo"} NA EX na ${kto === ja ? "tvojej karte" : "jeho karte"} ${menoKarty(x.defId)}: ${x[k]}`)
      .join(" · ");

  const riadok = (kluc: string, xs: readonly PolozkaRekapitulacie[], stred: ReactNode, novaSkupina: boolean, title?: (kto: PlayerId) => string, akcia?: Action): ReactNode => {
    // Riadok ukáže aj akcia, ktorú celú zrušili — v podrobnom náhľade sivé ikony, súčet „–“.
    const ikony = akcia === undefined ? undefined : r.akcie?.[akcia];
    if (!xs.some((x) => vid(x.uid)) && !(ikony ?? []).some((x) => vid(x.uid))) return null;
    const detail = (kto: PlayerId): ReactNode =>
      ikony === undefined || akcia === undefined ? undefined : <IkonyAkcie akcia={akcia} xs={ikony} kto={kto} ja={ja} piktogramy={piktogramy} menoKarty={menoKarty} vid={(uid) => vid(uid)} />;
    return (
      <div key={kluc} className={`rk-riadok${novaSkupina ? " nova-skupina" : ""}`} role="row">
        <Hodnota strana="l" n={sucet(xs, ja)} max={max} prirastok={prirastok(xs, ja)} title={title?.(ja)} detail={detail(ja)} />
        {stred}
        <Hodnota strana="r" n={sucet(xs, su)} max={max} prirastok={prirastok(xs, su)} title={title?.(su)} detail={detail(su)} />
      </div>
    );
  };
  const tuhe = AKCIE_TUHE.map((a: AkciaTuha, i) => riadok(a, r.tuhe[a], <Stred ikona={ikona(a)} nazov={nazov(a)} pod={`${i + 1} tuhé`} />, false, undefined, a));
  const poldeci = ikona("Poldeci");
  const pitky = r.pitkyKola;

  return (
    // Miesto pre všetky riadky od začiatku — línia nad tabuľkou neposkakuje, keď riadky nabiehajú.
    <div className={`rekap${podrobne ? " podrobne" : ""}`} role="table" aria-label="Rekapitulácia bitky" style={{ "--rk-riadkov": riadkovRekapitulacieBitky(r) } as CSSProperties}>
      <HlavickaRekapitulacie menoSupera={menoSupera} podrobne={podrobne} onPrepni={prepni} />
      {tuhe}
      <VieraPovera
        r={r}
        ja={ja}
        menoSupera={menoSupera}
        menoKarty={menoKarty}
        piktogramy={piktogramy}
        vid={vid}
        max={max}
        rusi={hotovo || vlna >= vlnaRusenia}
        ucinkuje={hotovo || vlna >= vlnaUcinku}
      />
      {riadok("pohorsenie", r.pohorsenie.polozky, <Stred ikona={ikona("Pohoršenie")} nazov={nazov("Pohoršenie")} />, true, undefined, "Pohoršenie")}
      {hotovo && <NaexSlovami vety={vetyNaex(r.naex, odpovede, ja, mena ?? (ja === 0 ? ["ty", menoSupera] : [menoSupera, "ty"]), menoKarty)} />}
      {riadok("naex-x2", naexX2, <Stred ikona={<ZnakNaex znak="×2" ikona={poldeci} />} nazov="NA EX" pod="zdvojilo" />, true, (kto) => titulNaex("zdvojilo", kto))}
      {riadok("naex-zrus", naexZrus, <Stred ikona={<ZnakNaex znak="✕" ikona={poldeci} />} nazov="NA EX" pod="zrušilo" />, naexX2.length === 0, (kto) => titulNaex("zrusilo", kto))}
      {hotovo && pitky !== null && (
        <>
          <div className="rk-sekcia" role="row">
            z Pitiek kola · {pitky.pocet} {pitky.pocet === 1 ? "Pitka" : pitky.pocet < 5 ? "Pitky" : "Pitiek"}
          </div>
          {(
            [
              ["dlh", "Dlh", nazov("Dlh"), "zadĺženie", pitky.zadlzenie, pitky.dlhy, "Dlhov"],
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
          <SpakyBitky b={r.spaky} ja={ja} mena={ja === 0 ? ["ty", menoSupera] : [menoSupera, "ty"]} menoKarty={menoKarty} />
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
 * tvoja Povera proti jeho Viere. Zjednodušene súčet a pruh, podrobne žetóny od stredu
 * (Michal 2026-10-30): zrušené súbojom zhasnú, v strede ostane ✕n; zdvojené nesú ×2 a za
 * nimi sivé tie, ktoré zrušil Odpor či NA EX. Zvyšná Viera uberie tuhé, zvyšná Povera
 * zaberie len na súperove priznané Dlhy.
 */
function VieraPovera({
  r,
  ja,
  menoSupera,
  menoKarty,
  piktogramy,
  vid,
  max,
  rusi,
  ucinkuje,
}: {
  readonly r: RekapitulaciaBitky;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly vid: (uid: number | null) => boolean;
  readonly max: number;
  readonly rusi: boolean;
  readonly ucinkuje: boolean;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona, nazov } = piktogramy;
  const zruseneSloty = (druh: "Viera" | "Povera", kto: PlayerId): readonly AkciaRekapitulacie[] => (r.akcie?.[druh] ?? []).filter((x) => x.kto === kto && x.zrusena);
  if (r.viera.length + r.povera.length + zruseneSloty("Viera", 0).length + zruseneSloty("Viera", 1).length + zruseneSloty("Povera", 0).length + zruseneSloty("Povera", 1).length === 0) return null;
  /**
   * Žetóny jednej strany: každá jednotka zvlášť, s vlnou svojej karty. Zo slotov (r.akcie), aby
   * zdvojená niesla ×2 — orezané na počet, ktorý išiel do rušenia (Farár, Presbiter uberú).
   */
  const zetony = (druh: "Viera" | "Povera", kto: PlayerId): { readonly uid: number | null; readonly x: AkciaRekapitulacie | null; readonly nasobok: number }[] => {
    const polozky = (druh === "Viera" ? r.viera : r.povera).filter((x) => x.kto === kto);
    const spolu = polozky.reduce((a, x) => a + x.n, 0);
    const sloty = r.akcie?.[druh];
    if (sloty === undefined) return polozky.flatMap((x) => Array.from({ length: x.n }, () => ({ uid: x.uid, x: null, nasobok: 1 })));
    return sloty
      .filter((x) => x.kto === kto && !x.zrusena && x.n > 0)
      .sort((a, b) => poradieIkony(a) - poradieIkony(b))
      .flatMap((x) => Array.from({ length: x.n }, (_, i) => ({ uid: x.uid, x, nasobok: i === 0 ? x.n : 1 })))
      .slice(0, spolu);
  };
  const strana = (s: Strana, druh: "Viera" | "Povera", kto: PlayerId): ReactNode => {
    const z = zetony(druh, kto);
    const zrusenych = druh === "Viera" ? r.zrusenaViera[kto] : r.zrusenaPovera[kto];
    const kto2 = kto === ja ? "ja" : "su";
    const proti: PlayerId = kto === 0 ? 1 : 0;
    const videne = z.filter((x) => vid(x.uid)).length;
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
    const sive = zruseneSloty(druh, kto).filter((x) => vid(x.uid));
    return (
      <div className={`vp-strana ${s}`} role="cell">
        <span className="vp-suhrn">
          <b className={`vp-pocet ${kto2}${videne === 0 ? " nula" : ""}`}>{videne > 0 ? videne : "–"}</b>
          {videne > 0 && <span className="rk-pruh" style={{ width: `${Math.min(1, videne / Math.max(1, max)) * 7.5}rem` }} />}
        </span>
        <span className="vp-zetony">
          {z.map(({ uid, x, nasobok }, i) => {
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
              <span key={i} className={`vp-zeton ${kto2}${stav}`} title={x === null ? undefined : popisAkcie(x, nazov(druh), menoKarty)}>
                {ikona(druh)}
                {nasobok > 1 && <i>×{nasobok}</i>}
              </span>
            );
          })}
          {sive.map((x, i) => (
            <span key={`z${i}`} className={`vp-zeton ${kto2} zrusena-slot`} title={popisAkcie(x, nazov(druh), menoKarty)}>
              {ikona(druh)}
            </span>
          ))}
        </span>
        {ucinok !== null && <span className="vp-ucinok">{ucinok}</span>}
      </div>
    );
  };
  const riadok = (id: string, lavy: "Viera" | "Povera", pravy: "Viera" | "Povera", zrusene: number): ReactNode => {
    const viditelne = [...zetony(lavy, ja), ...zetony(pravy, su)].some((x) => vid(x.uid)) || [...zruseneSloty(lavy, ja), ...zruseneSloty(pravy, su)].some((x) => vid(x.uid));
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

/**
 * Dieliky zoskupené po prahu: plný prah = karta. Neúplný posledný pri pečeni po Pitke
 * prepadne, pri zadĺžení ostáva na účte do ďalšej Pitky (v7, D6).
 */
function Meter({ bunky, prah, zvysok }: { readonly bunky: readonly string[]; readonly prah: number; readonly zvysok: "prepadne" | "ostava" }) {
  const skupiny: string[][] = [];
  for (let i = 0; i < bunky.length; i += prah) skupiny.push(bunky.slice(i, i + prah));
  return (
    <span className="rk-mer">
      {skupiny.map((g, i) => (
        <span
          key={i}
          className={`rk-prah ${g.length === prah ? "plny" : zvysok}`}
          title={g.length === prah ? "plný prah = karta" : `${g.length} z ${prah} — ${zvysok === "prepadne" ? "zvyšok po Pitke prepadne" : "zvyšok ostáva na účte do ďalšej Pitky"}`}
        >
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
  /** Odpovede na NA EX v tejto Pitke. */
  readonly odpovede?: readonly OdpovedNaNaex[];
}

/** Stred riadku Pitky: len ikona; názov a vysvetlenie v tooltipe (Michal 2026-10-30: popisy spod ikon preč). */
function StredPitky({ ikona, title }: { readonly ikona: ReactNode; readonly title: string }) {
  return (
    <div className="rk-stred" role="rowheader" title={title} aria-label={title}>
      {ikona}
    </div>
  );
}

export function RekapitulaciaPitkyVrstva({ r, ja, mena, nadpis, menoKarty, piktogramy, onKoniec, odpovede = [] }: RekapitulaciaPitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { ikona, nazov } = piktogramy;
  const [podrobne, prepni] = usePodrobne();
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
  const ikony = (akcia: Action, kto: PlayerId): ReactNode =>
    r.akcie === undefined ? null : <IkonyAkcie akcia={akcia} xs={r.akcie[akcia]} kto={kto} ja={ja} piktogramy={piktogramy} menoKarty={menoKarty} />;
  /** Bunka riadku Pitky: súčet a dieliky; podrobne namiesto dielikov ikony akcií. */
  const bunka = (s: Strana, n: number, mer: ReactNode, detail: ReactNode, cip: ReactNode, title?: string): ReactNode => (
    <div className={`rk-hod ${s}${detail !== null ? " ma-detail" : ""}`} role="cell" title={title}>
      <b className={n === 0 ? "nula" : undefined}>{n > 0 ? n : "–"}</b>
      {mer}
      {detail !== null && <span className="rk-detail">{detail}</span>}
      {cip}
    </div>
  );

  const dlh = (s: Strana, kto: PlayerId): ReactNode => {
    const n = zadlzeniePitky(r, kto);
    const karty = r.zadlzenie.dlhy[kto];
    const zUctu = r.zadlzenie.pred[kto];
    return bunka(
      s,
      n,
      <Meter bunky={Array<string>(n).fill("")} prah={prahDlhuPitky(r, kto)} zvysok="ostava" />,
      r.akcie === undefined ? null : (
        <>
          {zUctu > 0 && (
            <span className="rk-ik-ucet" title={`${zUctu} zadĺženia z účtu z minulých Pitiek`}>
              +{zUctu} z účtu
            </span>
          )}
          {ikony("Dlh", kto)}
        </>
      ),
      n > 0 && (
        <Cip trieda={karty > 0 ? "zisk" : "nic"} title={`${karty} kariet Dlh, hneď priznané`}>
          +{karty} <KartaKliatby ikona={ikona("Dlh")} />
        </Cip>
      ),
    );
  };
  const pecen = (s: Strana, kto: PlayerId): ReactNode => {
    const p = r.pecen;
    const zPitia = p.zPitia[kto] + p.zNaex[kto];
    const bunky = [...Array<string>(zPitia).fill("z-pitia"), ...Array<string>(p.poskodenie[kto]).fill(""), ...Array<string>(p.poldeci[kto]).fill("z-poldeci")];
    const n = pecenPitky(r, kto);
    const cir = p.cirhozy[kto];
    return bunka(
      s,
      n,
      <Meter bunky={bunky} prah={p.prah[kto]} zvysok="prepadne" />,
      r.akcie === undefined ? null : (
        <>
          {zPitia > 0 && (
            <span className="rk-ik-ucet" title={`vypité do dna ${p.zPitia[kto]} · NA EX ${p.zNaex[kto]}`}>
              {Array.from({ length: zPitia }, (_, i) => (
                <span key={i} className="rk-bk z-pitia" />
              ))}
            </span>
          )}
          {ikony("PoškodeniePečene", kto)}
          {ikony("Poldeci", kto)}
        </>
      ),
      <Cip trieda={cir > 0 ? "zisk" : "nic"} title={cir > 0 ? `${cir} Cirhóza do odhadzovacieho balíčka` : `${n} z ${p.prah[kto]} — prepadne`}>
        +{cir} <KartaKliatby ikona={ikona("PoškodeniePečene")} />
      </Cip>,
      `vypité do dna ${p.zPitia[kto]} · NA EX ${p.zNaex[kto]} · ${nazov("PoškodeniePečene")} ${p.poskodenie[kto]} · ${nazov("Poldeci")} ${p.poldeci[kto]}`,
    );
  };
  const cigarety = (s: Strana, kto: PlayerId): ReactNode => {
    const c = r.cigarety;
    const a = c.akcie[kto];
    const obm = c.obmedzenie[kto];
    const bunky = [...Array<string>(a - obm).fill(""), ...Array<string>(obm).fill("obm"), ...Array<string>(c.cigorky[kto]).fill("z-cigorky")];
    return bunka(
      s,
      a,
      <>
        {bunky.length > 0 && <Meter bunky={bunky} prah={Math.max(1, bunky.length)} zvysok="prepadne" />}
        {obm > 0 && (
          <span className="rk-obm" aria-label={`súperovo ${nazov("Obmedzenie")}`}>
            {ikona("Obmedzenie")}
          </span>
        )}
      </>,
      r.akcie === undefined ? null : (
        <>
          {ikony("Cigareta", kto)}
          {obm > 0 && (
            <span className="rk-ik-ucet obm" title={`súperovo ${nazov("Obmedzenie")} ubralo ${obm}`}>
              −{obm} {ikona("Obmedzenie")}
            </span>
          )}
        </>
      ),
      <Cip trieda={c.zisk[kto] > 0 ? "zisk" : "nic"}>
        +{c.zisk[kto]} {ikona("Cigareta")}
      </Cip>,
      `${a} ${nazov("Cigareta")} − ${obm} súperovo ${nazov("Obmedzenie")}${c.cigorky[kto] > 0 ? ` + ${c.cigorky[kto]} Cigorky` : ""}`,
    );
  };
  const vizia = r.vizia[0] + r.vizia[1] > 0;
  const prah = (x: readonly [number, number]): string => (x[ja] === x[su] ? `${x[ja]}` : `${x[ja]} : ${x[su]}`);
  const prahDlhu: readonly [number, number] = [prahDlhuPitky(r, 0), prahDlhuPitky(r, 1)];

  return (
    <div
      className={`pocitadlo-bitky rekap-pitky${hotovo ? " hotova" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${nadpis}: rekapitulácia`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".rk-dalej, .rk-prepni")) dobehni();
      }}
    >
      <div className="pocitadlo-scena">
        <div className="pocitadlo-panel hotovo">
          <span className="pocitadlo-nadpis">{nadpis}</span>
          <span className="pocitadlo-vyhodnotena">vyhodnotená</span>
          <span className="pocitadlo-mena">ty · {mena[su]}</span>
        </div>
        <div className={`rekap${podrobne ? " podrobne" : ""}`} role="table" aria-label="Rekapitulácia Pitky">
          <HlavickaRekapitulacie menoSupera={mena[su]} podrobne={podrobne} onPrepni={prepni} />
          {/* Čo sa stalo s NA EX — prvé a slovami, ešte pred číslami. */}
          <NaexSlovami vety={vetyNaex(r.naex, odpovede, ja, mena, menoKarty)} />
          {naex && vid(0) && (
            <>
              {(
                [
                  ["zdvojilo", "×2", "NA EX zdvojilo akcie"],
                  ["zrusilo", "✕", "NA EX zrušilo akcie"],
                ] as const
              ).map(([k, znak, popis]) => (
                <div key={k} className="rk-riadok" role="row">
                  <Hodnota strana="l" n={r.naex[k][ja]} max={maxNaex} prirastok={krok === 0 ? r.naex[k][ja] : 0} title={titulNaex(k, ja)} />
                  <StredPitky ikona={<ZnakNaex znak={znak} ikona={ikona("Poldeci")} />} title={popis} />
                  <Hodnota strana="r" n={r.naex[k][su]} max={maxNaex} prirastok={krok === 0 ? r.naex[k][su] : 0} title={titulNaex(k, su)} />
                </div>
              ))}
            </>
          )}
          {vid(1) && (
            <div className={`rk-riadok${naex ? " nova-skupina" : ""}`} role="row">
              {dlh("l", ja)}
              <StredPitky ikona={ikona("Dlh")} title={`${nazov("Dlh")}: zadĺženie, za každé ${prah(prahDlhu)} karta Dlh; zvyšok ostáva na účte`} />
              {dlh("r", su)}
            </div>
          )}
          {vid(2) && (
            <div className="rk-riadok" role="row">
              {pecen("l", ja)}
              <StredPitky ikona={ikona("PoškodeniePečene")} title={`pečeň: za každých ${prah(r.pecen.prah)} Cirhóza; zvyšok po Pitke prepadne`} />
              {pecen("r", su)}
            </div>
          )}
          {vid(3) && (
            <div className="rk-riadok nova-skupina" role="row">
              {cigarety("l", ja)}
              <StredPitky ikona={ikona("Cigareta")} title={`cigarety: ${nazov("Cigareta")} mínus súperovo ${nazov("Obmedzenie")}`} />
              {cigarety("r", su)}
            </div>
          )}
          {vid(3) && vizia && (
            <div className="rk-riadok" role="row">
              <Hodnota strana="l" n={r.vizia[ja]} max={Math.max(1, ...r.vizia)} title="vrchné karty, ktoré prezrieš" detail={ikony("Vízia", ja)} />
              <StredPitky ikona={ikona("Vízia")} title={`${nazov("Vízia")}: koľko vrchných kariet prezrieš`} />
              <Hodnota strana="r" n={r.vizia[su]} max={Math.max(1, ...r.vizia)} detail={ikony("Vízia", su)} />
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
            plný prah → karta
          </span>
          <span>
            <span className="rk-prah ostava">
              <span className="rk-bk" />
            </span>{" "}
            zadĺženie: zvyšok ostáva na účte
          </span>
          <span>
            <span className="rk-prah prepadne">
              <span className="rk-bk" />
            </span>{" "}
            pečeň: zvyšok prepadne
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
