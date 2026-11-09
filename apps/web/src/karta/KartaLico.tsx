// Líce karty — presne podľa tlače (MAUI CardPdfService), bez 3 mm presahu.
//
// Rozloženie počíta @naex/tvorba/geometriaKarty v bodoch; CSS ich prepočíta
// cez jednotku --pt (šírka karty / šírka v bodoch), takže karta sa zväčšuje
// ako celok a pri akejkoľvek veľkosti drží proporcie tlačenej karty.

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { KartaNavrh, RozlozenieStrany, Vzhlad } from "@naex/tvorba";
import { farbaKarty, formatujEfekt, geometriaKarty } from "@naex/tvorba";
import type { HranaNastroja, KtoraHrana } from "@naex/core";
import { menoAkcie, popisPodmienky, posilnenaSlovami, rozborNavyse, textBezAkcii, textBezHran } from "@naex/core";
import { mediaUrl } from "../lib/api.ts";
import { IkonaAkcie } from "./IkonaAkcie.tsx";
import { useTip, type TipObsah } from "./Tip.tsx";
import type { ZarSlotu } from "./zar.ts";
import { POPIS_UCINKU, hranyZTextu, preskoleniaZTextu, textBezPreskolenia } from "./preskolenie.ts";
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
  /** Akcia, ktorou sa akcia [j] ráta (Vedúcko, Sypač) — pečať ju kreslí namiesto vytlačenej. */
  readonly ako?: readonly string[];
  /** Podpora a Konflikt: ktorá vytlačená strana susedí s kartou, s ktorou sa efekt spustil (šípka svieti). */
  readonly sipky?: { readonly lava: boolean; readonly prava: boolean };
}

/**
 * Stav Preškolenia {X}→{Y} z textu karty v hre (pečať R5, Michal 2026-11-08): krat 0 = nemá čo
 * meniť (pečať sivá), N = koľko akcií práve mení (×N od 2); šípky k susedom ako pri Podpore.
 */
export interface PreskolenieNaKarte {
  readonly krat: number;
  readonly sipky?: { readonly lava: boolean; readonly prava: boolean };
}

/** Pôvodná akcia premeneného slotu (D2): kreslí sa malá v rohu, popis ide do nápovedy. */
export interface RohSlotu {
  readonly akcia: string;
  /** „Preškolenie: Vidly“, „Výtržník“… */
  readonly preco: string;
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
  /** Preškolenia {X}→{Y} v hre, v poradí textu; chýba = mimo hry (pečať bez stavu). */
  readonly preskolenia?: readonly PreskolenieNaKarte[] | undefined;
  /** Sloty premenené Nástrojom, efektom karty či Výtržníkom — pôvodná akcia v rohu (D2). */
  readonly rohy?: { readonly lava: readonly (RohSlotu | null)[]; readonly prava: readonly (RohSlotu | null)[] } | undefined;
  /** Karta Nástroja v lupe podloženého Nástroja: pretŕčajúca hrana svieti, druhá je tlmená. */
  readonly aktivnaHrana?: KtoraHrana | undefined;
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
  // Nástroj s hranami (Náradie 2026-11-08) má rám V1: hrany hore a dole, v strede len Dedičstvo.
  const hranyN = useMemo(() => hranyZTextu(karta.efekt, karta.tagy), [karta.efekt, karta.tagy]);
  // Zápis {X}→{Y} kreslí pečať Preškolenia — v texte ostáva len slovo (ako pri akciách navyše).
  const zakladEfektu = useMemo(() => textBezPreskolenia(hranyN === null ? karta.efekt : textBezHran(karta.efekt)), [karta.efekt, hranyN]);
  const preskoleniaTextu = useMemo(() => preskoleniaZTextu(karta.efekt), [karta.efekt]);
  const efektyNavyse = useMemo(() => rozborNavyse(zakladEfektu).efekty, [zakladEfektu]);
  const g = useMemo(
    () => geometriaKarty({ ...karta, maTagy: karta.tagy.length > 0 }),
    [karta.sirkaMm, karta.vyskaMm, karta.mierkaTextu, karta.mierkaIkon, karta.tagy.length],
  );

  /** Výška hrany Nástroja v bodoch — to, čo spod hostiteľa pretŕča (mock 2, M2). */
  const vyskaHrany = g.vyska * PODIEL_HRANY;
  // Nástroj (M2 „Plný obraz“, Michal 2026-11-09, docs/napady/naradie-karta-mocky.html): ilustrácia
  // vyplní celý stred medzi hranami, meno a Dedičstvo ležia na jej stmavenom spodku.
  const posunN = hranyN === null ? 0 : vyskaHrany;
  const nastroj = hranyN !== null;

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
      // Nástroj neleží v línii so slotmi — jamky by mu len prekryli ilustráciu.
      if (tlac || hranyN !== null || props.jamky?.[strana] !== true) return null;
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
    const roh = props.rohy?.[strana][i] ?? null;
    return ikona(
      `${strana}${i}`,
      r,
      kluc,
      sloty?.[strana][i] ?? null,
      zar,
      `${props.spoj?.[strana].includes(i) === true ? " kl-spoj" : ""}${zar === null ? "" : ` kl-zar-${strana}`}${roh === null ? "" : ` kl-s-rohom kl-roh-${strana}`}`,
      undefined,
      undefined,
      roh,
    );
  };

  /** Ikona akcie v ráme slotu — na hrane karty aj v pečati akcií navyše (rovnaký tvar aj žiar). */
  const ikona = (key: string, r: { readonly x: number; readonly y: number; readonly w: number }, kluc: string, st: SlotStav | null, zar: ZarNaKarte | null, trieda: string, navyse?: string, odznak?: number, roh: RohSlotu | null = null) => {
    const akcia = vzhlad.akcie.find((a) => a.kluc === kluc);
    const nazov = akcia?.nazov ?? kluc;
    const povodna = roh === null ? undefined : vzhlad.akcie.find((a) => a.kluc === roh.akcia);
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
        aria-label={`${nazov}: ${akcia?.popis ?? ""}${roh === null ? "" : ` Bola ${povodna?.nazov ?? roh.akcia}.`}${zar === null ? "" : ` ${zar.popis}`}`}
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
              {roh !== null && <span className="tip-stav">{`Bola ${povodna?.nazov ?? roh.akcia} — ${roh.preco}.`}</span>}
              {zar !== null && <span className={`tip-zar tip-zar-${zar.smer}`}>{zar.popis}</span>}
              {stavText !== null && <span className="tip-stav">{stavText}</span>}
            </>
          ),
        })}
      >
        <IkonaAkcie kluc={kluc} akcia={akcia} zar={zar?.smer === "plus"} />
        {zar?.smer === "plus" && <Iskra nova={zar.nova} />}
        {zar !== null && !bezPopisov && <span className="kl-zar-stitok">{zar.stitok}</span>}
        {roh !== null && (
          <span className="kl-roh" aria-hidden="true">
            <IkonaAkcie kluc={roh.akcia} akcia={povodna} />
          </span>
        )}
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
    if (efektyNavyse.length === 0 && preskoleniaTextu.length === 0) return null;
    const vzor = g.slotyLave[0] ?? g.slotyPrave[0];
    if (vzor === undefined) return null;
    const w = vzor.w;
    const medzera = w * 0.3;
    // Rovnaké akcie jedného efektu sú jedna ikona s odznakom ×N (Veštica: 2 Povery = Povera ×2).
    // Vedúcko a Sypač (Michal 2026-11-08): pečať ukáže akciu, ktorou sa akcia ráta (Robota → Pecka).
    const skupiny = efektyNavyse.map((e, ei) => {
      const ako = e.akcie.map((a, j) => props.navyse?.[ei]?.ako?.[j] ?? a);
      return [...new Set(ako)].map((a) => ({ a, kusov: ako.filter((x) => x === a).length, prva: ako.indexOf(a) }));
    });
    // Podpora a Konflikt majú po bokoch šípky k susedom (mock M3) — miesto pre ne v rade.
    const sipkaW = w * 0.32;
    const sipkovych = efektyNavyse.filter((e) => e.spustac === "Podpora" || e.spustac === "Konflikt").length;
    const ikon = skupiny.reduce((n, g2) => n + g2.length, 0);
    // Preškolenie (R5, Michal 2026-11-08): pilulka A1 → A2 v jednom ráme; šípky k susedom pri Podpore, Konflikte aj Furt.
    const sirkaPilulky = sirkaPilulkyPt(w);
    const pilulkySoSipkami = preskoleniaTextu.filter((p) => maSipky(p.spustac)).length;
    const poloziek = ikon + preskoleniaTextu.length;
    const sirkaRadu =
      ikon * w + preskoleniaTextu.length * sirkaPilulky + Math.max(0, poloziek - 1) * medzera + (sipkovych + pilulkySoSipkami) * 2 * (sipkaW + medzera * 0.5);
    let x = (g.sirka - sirkaRadu) / 2;
    const y = g.pas.y - posunN - w - 5;
    const navyse = efektyNavyse.flatMap((e, ei) => {
      const stav = props.navyse?.[ei];
      const podmienka = popisPodmienky(e);
      const sSipkami = e.spustac === "Podpora" || e.spustac === "Konflikt";
      const sipka = (strana: "lava" | "prava") => {
        const sviti = stav?.sipky?.[strana] === true;
        const el = (
          <span
            key={`navyse${ei}-sipka-${strana}`}
            className={`kl-navyse-sipka kl-navyse-sipka-${strana}${sviti ? " kl-navyse-sipka-sviti" : ""}`}
            style={{ "--x": x, "--y": y + w / 2, "--s": sipkaW } as CSSProperties}
            aria-hidden="true"
          />
        );
        x += sipkaW + medzera * 0.5;
        return el;
      };
      const lava = sSipkami ? [sipka("lava")] : [];
      const ikony = (skupiny[ei] ?? []).map(({ a, kusov, prva }, gi, vsetky) => {
        const r = { x, y, w };
        x += w + (gi < vsetky.length - 1 || !sSipkami ? medzera : medzera * 0.5);
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
      return [...lava, ...ikony, ...(sSipkami ? [sipka("prava")] : [])];
    });
    const pilulky = preskoleniaTextu.flatMap((p, pi) => {
      const stav = props.preskolenia?.[pi];
      const sSipkami = maSipky(p.spustac);
      const sipka = (strana: "lava" | "prava") => {
        const el = (
          <span
            key={`presk${pi}-sipka-${strana}`}
            className={`kl-navyse-sipka kl-navyse-sipka-${strana}${stav?.sipky?.[strana] === true ? " kl-navyse-sipka-sviti" : ""}`}
            style={{ "--x": x, "--y": y + w / 2, "--s": sipkaW } as CSSProperties}
            aria-hidden="true"
          />
        );
        x += sipkaW + medzera * 0.5;
        return el;
      };
      const lava = sSipkami ? [sipka("lava")] : [];
      const tip: TipObsah = {
        nadpis: "Preškolenie",
        text: (
          <>
            {`${menoAkcie(p.z)} sa ráta ako ${menoAkcie(p.na)}.`}
            {stav !== undefined && <span className="tip-stav">{stav.krat === 0 ? "Teraz nemá čo preškoliť." : `Teraz preškoľuje ${stav.krat}×.`}</span>}
          </>
        ),
      };
      const el = (
        <Pilulka
          key={`presk${pi}`}
          z={p.z}
          na={p.na}
          vzhlad={vzhlad}
          trieda={stav === undefined ? "" : stav.krat === 0 ? " kl-pil-spi" : " kl-pil-akt"}
          style={{ "--x": x, "--y": y, "--s": w, "--r": g.polomerSlotu } as CSSProperties}
          krat={stav?.krat ?? 1}
          udalosti={hover(tip)}
        />
      );
      x += sirkaPilulky + (sSipkami ? medzera * 0.5 : medzera);
      return [...lava, el, ...(sSipkami ? [sipka("prava")] : [])];
    });
    return [...navyse, ...pilulky];
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
        <div
          className={`kl-ilustracia${nastroj ? " kl-ilustracia-n" : ""}`}
          style={{ "--t": nastroj ? vyskaHrany : 0, "--h": nastroj ? g.vyska - 2 * vyskaHrany : g.obrazok.h } as CSSProperties}
        >
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

        {(() => {
          const pas = (
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
          );
          const efekt = (
            <Efekt
              text={efektyNavyse.length > 0 ? textBezAkcii(zakladEfektu) : zakladEfektu}
              vzhlad={vzhlad}
              y={g.efekt.y}
              h={g.efekt.h}
              okraj={g.okrajTextu}
              velkost={g.velkostEfektu}
              hover={hover}
            />
          );
          return nastroj ? (
            <div className="kl-nastroj-text" style={{ "--d": vyskaHrany, "--o": g.okrajTextu } as CSSProperties}>
              {pas}
              {efekt}
            </div>
          ) : (
            <>
              {pas}
              {efekt}
            </>
          );
        })()}

        {hranyN !== null &&
          (["horna", "dolna"] as const).map((kde) => {
            const h = hranyN[kde];
            const stav = props.aktivnaHrana === undefined ? "" : props.aktivnaHrana === kde ? " kl-hrana-n-pretrca" : " kl-hrana-n-tlmena";
            return (
              <div
                key={kde}
                className={`kl-hrana-n kl-hrana-n-${kde}${stav}`}
                style={{ "--h": vyskaHrany } as CSSProperties}
                {...hover({ nadpis: kde === "horna" ? "Horná hrana" : "Dolná hrana", text: popisHranyNastroja(h) })}
              >
                <ObsahHrany hrana={h} vzhlad={vzhlad} pil={`calc(${vyskaHrany * 0.62} * var(--pt))`} />
              </div>
            );
          })}
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

/** Šírka pilulky Preškolenia v jednotkách slotu (karta.css .kl-pil: odsadenie, dve ikony, šípka). */
export const SIRKA_PILULKY = 2.2;
const sirkaPilulkyPt = (slot: number): number => SIRKA_PILULKY * slot;
/** Podpora a Konflikt platia so susedom, Furt pri susedoch — pečať má šípky k obom. */
const maSipky = (spustac: string | null): boolean => spustac === "Podpora" || spustac === "Konflikt" || spustac === "Furt";

/**
 * Pečať Preškolenia R5 „pilulka“ (Michal 2026-11-08, docs/napady/premeny-akcii.html): jeden rám,
 * v ňom pôvodná akcia, šípka a nová. Tá istá na karte s efektom, na hrane Nástroja aj pod hostiteľom.
 * Bez `style` s --x/--y leží v riadku (kl-pil-volna, veľkosť --pil).
 */
export function Pilulka({
  z,
  na,
  vzhlad,
  trieda = "",
  style,
  krat = 1,
  udalosti,
}: {
  readonly z: string;
  readonly na: string;
  readonly vzhlad: Pick<Vzhlad, "akcie">;
  readonly trieda?: string;
  readonly style?: CSSProperties;
  readonly krat?: number;
  readonly udalosti?: Record<string, unknown>;
}) {
  const az = vzhlad.akcie.find((a) => a.kluc === z);
  const an = vzhlad.akcie.find((a) => a.kluc === na);
  return (
    <span className={`kl-pil${trieda}`} style={style} aria-label={`${az?.nazov ?? z} → ${an?.nazov ?? na}`} {...udalosti}>
      <span className="kl-pil-a kl-pil-z">
        <IkonaAkcie kluc={z} akcia={az} />
      </span>
      <i className="kl-pil-sipka" aria-hidden="true" />
      <span className="kl-pil-a">
        <IkonaAkcie kluc={na} akcia={an} />
      </span>
      {krat > 1 && <span className="kl-nasobok">×{krat}</span>}
    </span>
  );
}

/**
 * Obsah hrany Nástroja: pilulka premeny, posilnená akcia alebo slovo kartového účinku. Posilnená
 * akcia (Puška, Michal 2026-11-09) je ikona v tom istom ráme s odznakom ×2 — tak hra ukazuje
 * posilnenú akciu na hrane karty.
 */
export function ObsahHrany({ hrana, vzhlad, pil }: { readonly hrana: HranaNastroja; readonly vzhlad: Pick<Vzhlad, "akcie">; readonly pil?: string }) {
  const style = pil === undefined ? undefined : ({ "--pil": pil } as CSSProperties);
  if (hrana.druh === "posilnenie") {
    const a = vzhlad.akcie.find((x) => x.kluc === hrana.akcia);
    return (
      <span className="kl-pil kl-pil-volna kl-pil-posil" style={style} aria-label={posilnenaSlovami(hrana.akcia)}>
        <span className="kl-pil-a">
          <IkonaAkcie kluc={hrana.akcia} akcia={a} />
        </span>
        <span className="kl-nasobok">×2</span>
      </span>
    );
  }
  return hrana.druh === "akcia" ? (
    <Pilulka z={hrana.z} na={hrana.na} vzhlad={vzhlad} trieda=" kl-pil-volna" {...(style === undefined ? {} : { style })} />
  ) : (
    <b className="kl-hrana-ucinok">{hrana.ucinok.toLocaleUpperCase("sk")}</b>
  );
}

/** Nápoveda hrany Nástroja: čo pretŕčajúca hrana robí hostiteľovi. */
export function popisHranyNastroja(hrana: HranaNastroja): string {
  if (hrana.druh === "posilnenie") {
    return `${posilnenaSlovami(hrana.akcia)}: aktívna akcia ${menoAkcie(hrana.akcia)} hostiteľa sa ráta dvakrát (×2), ako pri Posilnení.`;
  }
  return hrana.druh === "akcia"
    ? `Preškolenie ${menoAkcie(hrana.z)} → ${menoAkcie(hrana.na)}: všetky ${menoAkcie(hrana.z)} hostiteľa sa rátajú ako ${menoAkcie(hrana.na)}.`
    : (POPIS_UCINKU[hrana.ucinok] ?? hrana.ucinok);
}

/** Hrana Nástroja ako podiel výšky karty (mock 2: 36 px pri karte vysokej 190 px). */
export const PODIEL_HRANY = 0.17;
