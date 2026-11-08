// Líce karty — presne podľa tlače (MAUI CardPdfService), bez 3 mm presahu.
//
// Rozloženie počíta @naex/tvorba/geometriaKarty v bodoch; CSS ich prepočíta
// cez jednotku --pt (šírka karty / šírka v bodoch), takže karta sa zväčšuje
// ako celok a pri akejkoľvek veľkosti drží proporcie tlačenej karty.

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { KartaNavrh, RozlozenieStrany, Vzhlad } from "@naex/tvorba";
import { farbaKarty, formatujEfekt, geometriaKarty } from "@naex/tvorba";
import { rozborNavyse, textBezAkcii } from "@naex/core";
import { mediaUrl } from "../lib/api.ts";
import { IkonaAkcie } from "./IkonaAkcie.tsx";
import { useTip, type TipObsah } from "./Tip.tsx";
import type { ZarSlotu } from "./zar.ts";
import "./karta.css";

/** Stav slotu v hre (živé vyhodnotenie línie). */
export interface SlotStav {
  readonly stav: "aktivna" | "zrusena" | "neaktivna";
  readonly nasobok: number;
}

/** Žeravá či vyhasnutá ikona v slote; nova = prvé zobrazenie (odletí iskra). */
export interface ZarNaKarte extends ZarSlotu {
  readonly nova: boolean;
}

/**
 * Stav efektu s akciami navyše v hre (frakcie, Michal 2026-11-08): krat 0 = podmienka nesplnená
 * (pečať sivá), 1 = platí, 2+ = platí toľkokrát (odznak ×N). zar = posilnenie ikon z Dedičstva.
 */
export interface NavyseNaKarte {
  readonly krat: number;
  readonly zar?: readonly (ZarNaKarte | null)[];
}

export type VzhladKarty = Pick<
  KartaNavrh,
  "nazov" | "tagy" | "efekt" | "obrazok" | "farba" | "mierkaTextu" | "mierkaIkon" | "sirkaMm" | "vyskaMm"
>;

export interface KartaLicoProps {
  readonly karta: VzhladKarty;
  readonly lava: RozlozenieStrany;
  readonly prava: RozlozenieStrany;
  readonly vzhlad: Vzhlad;
  /** Šírka v px alebo CSS dĺžka (napr. "54mm" pre tlač); výška z pomeru strán. */
  readonly sirka?: number | string;
  /** Tlač: presah v mm za orezom (ilustrácia a plochy pokračujú za okraj). */
  readonly presahMm?: number;
  /** Lokálny náhľad obrázka (tvorca pred nahraním). */
  readonly nahladObrazka?: string | null;
  readonly sloty?: { readonly lava: readonly (SlotStav | null)[]; readonly prava: readonly (SlotStav | null)[] } | null;
  /** Akcie zmenené Nástrojom v Dedičstve (sloty vytlačených strán, indexy zhora). */
  readonly zar?: { readonly lava: readonly (ZarNaKarte | null)[]; readonly prava: readonly (ZarNaKarte | null)[] } | undefined;
  readonly odznaky?: ReactNode;
  readonly onClick?: (() => void) | undefined;
  readonly vybrana?: boolean;
  /** Karta je prepínač (výber do šenku): aria-pressed; undefined = obyčajné tlačidlo. */
  readonly stlacena?: boolean | undefined;
  /** Klik nič neurobí (plný výber) — aria-disabled, karta je zosivená. */
  readonly zakazana?: boolean | undefined;
  /** Karta leží voči divákovi nohami hore (zahral ju ten druhý hráč). */
  readonly otocena?: boolean;
  /** Vytlačená strana, ktorou sa karta v línii páruje k lokalite — zvýrazní sa, protiľahlá ostane voľná. */
  readonly hranaVnutorna?: "lava" | "prava" | undefined;
  /** Sloty (vytlačené strany, indexy zhora), ktoré by pri vybranom vyložení vytvorili spoj. */
  readonly spoj?: { readonly lava: readonly number[]; readonly prava: readonly number[] } | undefined;
  /**
   * Vytlačené strany, na ktorých sa prázdne indexy kreslia ako jamky (Michal 2026-11-08):
   * hráč inak nevidí, kde spoj nevznikne. Len tam, kde ešte môže vzniknúť — ruka a otvorená hrana línie.
   */
  readonly jamky?: { readonly lava: boolean; readonly prava: boolean } | undefined;
  /**
   * Akcie navyše v hre — stav každého efektu „Spúšťač: Tag {Akcia}“ v poradí textu. Chýba = mimo
   * hry (glosár, tvorca): pečať ako vytlačená, bez stavu.
   */
  readonly navyse?: readonly NavyseNaKarte[] | undefined;
  /** Bez tooltipov a efektu — malá karta v zozname. */
  readonly bezPopisov?: boolean;
  /**
   * Sloty bez vlastnej zastávky klávesnice (herný stôl, dizajn UX N4: karta =
   * jedna zastávka, nie desiatky slotov). Tooltip ostáva myšou; tvorca kariet nechá predvolené.
   */
  readonly slotyBezFokusu?: boolean;
  readonly className?: string;
  /** Id karty pre výučbu (data-vyucba-karta) — zvýraznenie „ruka:pijan“ ju nájde v zóne ruky. */
  readonly idKarty?: string;
  /** Inštancia karty (data-vyucba-uid) — výučba zvýrazní presne kartu z očakávaného ťahu. */
  readonly uidKarty?: number;
}

export function KartaLico(props: KartaLicoProps) {
  const { karta, lava, prava, vzhlad, sirka = 240, sloty, onClick, vybrana, presahMm = 0 } = props;
  const tlac = typeof sirka === "string";
  const bezPopisov = props.bezPopisov === true || tlac;
  const sirkaPx = typeof sirka === "number" ? sirka : 1024;
  const { tip, ukaz, skry } = useTip();
  const [bezObrazka, setBezObrazka] = useState(false);
  const farba = farbaKarty(karta, vzhlad.kategorie);
  const efektyNavyse = useMemo(() => rozborNavyse(karta.efekt).efekty, [karta.efekt]);
  const g = useMemo(
    () => geometriaKarty({ ...karta, maTagy: karta.tagy.length > 0 }),
    [karta.sirkaMm, karta.vyskaMm, karta.mierkaTextu, karta.mierkaIkon, karta.tagy.length],
  );

  const hover = (obsah: TipObsah) =>
    bezPopisov
      ? {}
      : {
          onMouseEnter: (e: React.MouseEvent) => ukaz(e.currentTarget, { ...obsah, farba }),
          onMouseLeave: skry,
          onFocus: (e: React.FocusEvent) => ukaz(e.currentTarget, { ...obsah, farba }),
          onBlur: skry,
        };

  const slot = (strana: "lava" | "prava", i: number, kluc: string | null) => {
    const r = (strana === "lava" ? g.slotyLave : g.slotyPrave)[i];
    if (r === undefined) return null;
    if (kluc === null) {
      if (tlac || props.jamky?.[strana] !== true) return null;
      return (
        <span
          key={`${strana}${i}`}
          className="kl-jamka"
          style={{ "--x": r.x, "--y": r.y, "--s": r.w, "--r": g.polomerSlotu } as CSSProperties}
          aria-hidden="true"
        />
      );
    }
    const zar = props.zar?.[strana][i] ?? null;
    return ikona(`${strana}${i}`, r, kluc, sloty?.[strana][i] ?? null, zar, `${props.spoj?.[strana].includes(i) === true ? " kl-spoj" : ""}${zar === null ? "" : ` kl-zar-${strana}`}`);
  };

  /** Ikona akcie v ráme slotu — na hrane karty aj v pečati akcií navyše (rovnaký tvar aj žiar). */
  const ikona = (key: string, r: { readonly x: number; readonly y: number; readonly w: number }, kluc: string, st: SlotStav | null, zar: ZarNaKarte | null, trieda: string, navyse?: string, odznak?: number) => {
    const akcia = vzhlad.akcie.find((a) => a.kluc === kluc);
    const nazov = akcia?.nazov ?? kluc;
    const stavText =
      navyse !== undefined
        ? navyse
        : st === null ? null : st.stav === "aktivna" ? `Aktívna${st.nasobok > 1 ? ` ×${st.nasobok}` : ""}` : st.stav === "zrusena" ? "Zrušená Odporom" : "Neaktívna — na spoji nemá pár";
    return (
      <span
        key={key}
        className={`kl-slot${st === null ? "" : ` kl-${st.stav}`}${trieda}${zar === null ? "" : ` kl-zar-${zar.smer}${zar.nova ? " kl-zar-nova" : ""}`}`}
        data-akcia={kluc}
        style={{ "--x": r.x, "--y": r.y, "--s": r.w, "--r": g.polomerSlotu } as CSSProperties}
        tabIndex={bezPopisov ? undefined : props.slotyBezFokusu === true ? -1 : 0}
        aria-label={`${nazov}: ${akcia?.popis ?? ""}${zar === null ? "" : ` ${zar.popis}`}`}
        {...hover({
          nadpis: nazov,
          ikona: (
            <span className="tip-ikona-ram">
              <IkonaAkcie kluc={kluc} akcia={akcia} />
            </span>
          ),
          text: (
            <>
              {akcia?.popis ?? "Akcia bez popisu."}
              {zar !== null && <span className={`tip-zar tip-zar-${zar.smer}`}>{zar.popis}</span>}
              {stavText !== null && <span className="tip-stav">{stavText}</span>}
            </>
          ),
        })}
      >
        <IkonaAkcie kluc={kluc} akcia={akcia} zar={zar?.smer === "plus"} />
        {zar?.smer === "plus" && <Iskra nova={zar.nova} />}
        {zar !== null && !bezPopisov && <span className="kl-zar-stitok">{zar.stitok}</span>}
        {(odznak ?? (st === null ? 1 : st.nasobok)) > 1 && <span className="kl-nasobok">×{odznak ?? st?.nasobok}</span>}
      </span>
    );
  };

  /**
   * Pečať akcií navyše (M3, Michal 2026-11-08): ikony v dolnom strede ilustrácie, v tvare slotu
   * na hrane — nová forma by sa musela vysvetľovať. Nesplnená podmienka sivá, splnená žiari ako
   * aktívna akcia, ×N až od 2.
   */
  const pecat = () => {
    if (efektyNavyse.length === 0) return null;
    const vzor = g.slotyLave[0] ?? g.slotyPrave[0];
    if (vzor === undefined) return null;
    const w = vzor.w;
    const medzera = w * 0.3;
    // Rovnaké akcie jedného efektu sú jedna ikona s odznakom ×N (Veštica: 2 Povery = Povera ×2).
    const skupiny = efektyNavyse.map((e) => [...new Set(e.akcie)].map((a) => ({ a, kusov: e.akcie.filter((x) => x === a).length, prva: e.akcie.indexOf(a) })));
    const ikon = skupiny.reduce((n, g2) => n + g2.length, 0);
    const x0 = (g.sirka - ikon * w - (ikon - 1) * medzera) / 2;
    const y = g.pas.y - w - 5;
    let n = 0;
    return efektyNavyse.flatMap((e, ei) => {
      const stav = props.navyse?.[ei];
      const podmienka = `${e.spustac}${e.tag === null ? "" : `: ${e.tag}`}`;
      return (skupiny[ei] ?? []).map(({ a, kusov, prva }) => {
        const r = { x: x0 + n * (w + medzera), y, w };
        n++;
        // Stavy ako na hrane: splnená = aktívna (žiar), nesplnená = neaktívna a sivá; mimo hry ako vytlačená.
        const st: SlotStav | null = stav === undefined ? null : { stav: stav.krat === 0 ? "neaktivna" : "aktivna", nasobok: 1 };
        const text =
          stav === undefined
            ? `Akcia navyše — ${podmienka}.`
            : stav.krat === 0
              ? `Akcia navyše — ${podmienka}: podmienka nesplnená.`
              : `Akcia navyše — ${podmienka}: platí${stav.krat > 1 ? ` ${stav.krat}×` : ""}.`;
        const zar = stav?.zar?.[prva] ?? null;
        return ikona(`navyse${ei}-${a}`, r, a, st, zar, ` kl-navyse${stav !== undefined && stav.krat === 0 ? " kl-navyse-spi" : ""}${zar !== null ? " kl-zar-prava" : ""}`, text, kusov * Math.max(1, stav?.krat ?? 1));
      });
    });
  };

  /** Rám okolo stĺpca slotov jednej strany (playtest 20261017-164450: ktorá hrana sa spáruje). */
  const hrana = (strana: "lava" | "prava") => {
    const sl = strana === "lava" ? g.slotyLave : g.slotyPrave;
    const prvy = sl[0];
    const posledny = sl[sl.length - 1];
    if (prvy === undefined || posledny === undefined) return null;
    const vnutorna = props.hranaVnutorna === strana;
    return (
      <span
        key={`hrana-${strana}`}
        className={`kl-hrana ${vnutorna ? "kl-hrana-vnutorna" : "kl-hrana-vonkajsia"}`}
        style={{ "--x": prvy.x, "--y": prvy.y, "--s": prvy.w, "--h": posledny.y + posledny.h - prvy.y } as CSSProperties}
        aria-hidden="true"
      />
    );
  };

  const obrazok = props.nahladObrazka ?? null;
  const triedy = ["kl"];
  if (onClick !== undefined) triedy.push("kl-klik");
  if (vybrana === true) triedy.push("kl-vybrana");
  if (props.otocena === true) triedy.push("kl-otocena");
  if (props.className !== undefined) triedy.push(props.className);
  if (tlac) triedy.push("kl-tlac");

  return (
    <div
      className={triedy.join(" ")}
      data-vyucba-karta={props.idKarty}
      data-vyucba-uid={props.uidKarty}
      style={{
        "--farba": farba,
        "--w": g.sirka,
        "--b": presahMm * (72 / 25.4),
        width: sirka,
        aspectRatio: `${g.sirka} / ${g.vyska}`,
        // Zaoblenie 3 mm — digitálna karta nemá ostré rohy tlačového hárku.
        borderRadius: tlac ? 0 : `${(3 / karta.sirkaMm) * 100}% / ${(3 / karta.vyskaMm) * 100}%`,
      } as CSSProperties}
      onClick={onClick}
      role={onClick !== undefined ? "button" : undefined}
      aria-pressed={onClick !== undefined ? props.stlacena : undefined}
      aria-disabled={onClick !== undefined && props.zakazana === true ? true : undefined}
      tabIndex={onClick !== undefined ? 0 : undefined}
      onKeyDown={onClick !== undefined ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <div className="kl-plocha">
        <div className="kl-ilustracia" style={{ "--h": g.obrazok.h } as CSSProperties}>
          {obrazok !== null ? (
            <img src={obrazok} alt="" draggable={false} />
          ) : karta.obrazok !== null && !bezObrazka ? (
            <img
              src={mediaUrl(sirkaPx <= 260 ? karta.obrazok.nahlad : karta.obrazok.plny)}
              // Prehliadač vyberie podľa šírky na stole: 320 px (?n — náhľad náhľadu, ak ho má), 512, 1024 (lupa).
              {...(tlac
                ? {}
                : {
                    srcSet: `${mediaUrl(karta.obrazok.nahlad, true)} 320w, ${mediaUrl(karta.obrazok.nahlad)} 512w, ${mediaUrl(karta.obrazok.plny)} 1024w`,
                    sizes: `${Math.round(sirkaPx)}px`,
                  })}
              alt=""
              loading={tlac ? "eager" : "lazy"}
              draggable={false}
              onError={() => setBezObrazka(true)}
            />
          ) : (
            <div className="kl-bez-obrazka">{karta.nazov.charAt(0)}</div>
          )}
        </div>

        <div className="kl-pas" style={{ "--y": g.pas.y, "--h": g.pas.h } as CSSProperties}>
          <div className="kl-nazov" style={{ "--f": g.velkostNazvu } as CSSProperties}>
            {karta.nazov}
          </div>
          {karta.tagy.length > 0 && (
            <div className="kl-tagy" style={{ "--f": g.velkostTagov } as CSSProperties}>
              {karta.tagy.join(" • ")}
            </div>
          )}
        </div>

        <Efekt
          text={efektyNavyse.length > 0 ? textBezAkcii(karta.efekt) : karta.efekt}
          vzhlad={vzhlad}
          y={g.efekt.y}
          h={g.efekt.h}
          okraj={g.okrajTextu}
          velkost={g.velkostEfektu}
          hover={hover}
        />

        {pecat()}
        {props.hranaVnutorna !== undefined && [hrana("lava"), hrana("prava")]}
        {lava.map((k, i) => slot("lava", i, k))}
        {prava.map((k, i) => slot("prava", i, k))}
        {/* Kotvy prvého a posledného slotu (aj prázdneho) — línia podľa nich zarovná akcie na spoji. */}
        {[g.slotyLave[0], g.slotyLave[g.slotyLave.length - 1]].map(
          (r, i) => r !== undefined && <span key={`kotva${i}`} className="kl-kotva" style={{ "--y": r.y + r.h / 2 } as CSSProperties} aria-hidden="true" />,
        )}
        {props.odznaky !== undefined && <div className="kl-odznaky">{props.odznaky}</div>}
      </div>
      {tip}
    </div>
  );
}

/**
 * Iskra pri žeravej ikone (ostáva, aby ju nezlial žiar aktívnej akcie), pri prvom
 * zobrazení navyše jedna odletí. Vyhasnutá ikona nemá nič (Michal 2026-10-30: bez dymu).
 */
function Iskra({ nova }: { readonly nova: boolean }) {
  const hviezda = <path d="M10 0L12 8L20 10L12 12L10 20L8 12L0 10L8 8Z" />;
  return (
    <>
      <span className="kl-iskra" aria-hidden="true">
        <svg viewBox="0 0 20 20">{hviezda}</svg>
      </span>
      {nova && (
        <span className="kl-iskra kl-iskra-let" aria-hidden="true">
          <svg viewBox="0 0 20 20">{hviezda}</svg>
        </span>
      )}
    </>
  );
}

function Efekt({
  text,
  vzhlad,
  y,
  h,
  okraj,
  velkost,
  hover,
}: {
  readonly text: string;
  readonly vzhlad: Vzhlad;
  readonly y: number;
  readonly h: number;
  readonly okraj: number;
  readonly velkost: number;
  readonly hover: (o: TipObsah) => Record<string, unknown>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const riadky = useMemo(() => formatujEfekt(text, vzhlad.klucoveSlova), [text, vzhlad.klucoveSlova]);

  // Dlhší text, než sa zmestí, sa zmenší (MAUI ho oreže — tu radšej zmenšíme).
  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null) return;
    const prisposob = () => {
      let m = 1;
      box.style.setProperty("--m", "1");
      while (box.scrollHeight > box.clientHeight + 1 && m > 0.55) {
        m -= 0.05;
        box.style.setProperty("--m", String(m));
      }
    };
    prisposob();
    const ro = new ResizeObserver(prisposob);
    ro.observe(box);
    return () => ro.disconnect();
  }, [riadky]);

  return (
    <div className="kl-efekt" ref={ref} style={{ "--y": y, "--h": h, "--o": okraj, "--f": velkost } as CSSProperties}>
      <div className="kl-efekt-text">
        {riadky.map((riadok, i) => (
          <div key={i}>
            {riadok.map((u, j) => {
              const maPopis = u.pravidlo !== null && u.pravidlo.popis !== "";
              if (u.pravidlo === null || (!u.tucne && !u.kurziva && !maPopis)) return <span key={j}>{u.text}</span>;
              // Popis má aj slovo bez zvýraznenia — tooltip nesmie závisieť od štýlu.
              const Tag = u.tucne ? "b" : u.kurziva ? "i" : "span";
              return (
                <Tag
                  key={j}
                  className={maPopis ? "kl-pojem" : undefined}
                  {...(maPopis ? hover({ nadpis: u.pravidlo.slovo, text: u.pravidlo.popis }) : {})}
                >
                  {u.kurziva && u.tucne ? <i>{u.text}</i> : u.text}
                </Tag>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
