// Líce karty — presne podľa tlače (MAUI CardPdfService), bez 3 mm presahu.
//
// Rozloženie počíta @naex/tvorba/geometriaKarty v bodoch; CSS ich prepočíta
// cez jednotku --pt (šírka karty / šírka v bodoch), takže karta sa zväčšuje
// ako celok a pri akejkoľvek veľkosti drží proporcie tlačenej karty.

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { KartaNavrh, RozlozenieStrany, Vzhlad } from "@naex/tvorba";
import { farbaKarty, formatujEfekt, geometriaKarty } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { IkonaAkcie } from "./IkonaAkcie.tsx";
import { useTip, type TipObsah } from "./Tip.tsx";
import "./karta.css";

/** Stav slotu v hre (živé vyhodnotenie línie). */
export interface SlotStav {
  readonly stav: "aktivna" | "zrusena" | "neaktivna";
  readonly nasobok: number;
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
  readonly odznaky?: ReactNode;
  readonly onClick?: (() => void) | undefined;
  readonly vybrana?: boolean;
  /** Karta leží voči divákovi nohami hore (zahral ju ten druhý hráč). */
  readonly otocena?: boolean;
  /** Vytlačená strana, ktorou sa karta v línii páruje k lokalite — zvýrazní sa, protiľahlá ostane voľná. */
  readonly hranaVnutorna?: "lava" | "prava" | undefined;
  /** Sloty (vytlačené strany, indexy zhora), ktoré by pri vybranom vyložení vytvorili spoj. */
  readonly spoj?: { readonly lava: readonly number[]; readonly prava: readonly number[] } | undefined;
  /** Bez tooltipov a efektu — malá karta v zozname. */
  readonly bezPopisov?: boolean;
  /**
   * Sloty bez vlastnej zastávky klávesnice (herný stôl, dizajn UX N4: karta =
   * jedna zastávka, nie desiatky slotov). Tooltip ostáva myšou; tvorca kariet nechá predvolené.
   */
  readonly slotyBezFokusu?: boolean;
  readonly className?: string;
}

export function KartaLico(props: KartaLicoProps) {
  const { karta, lava, prava, vzhlad, sirka = 240, sloty, onClick, vybrana, presahMm = 0 } = props;
  const tlac = typeof sirka === "string";
  const bezPopisov = props.bezPopisov === true || tlac;
  const sirkaPx = typeof sirka === "number" ? sirka : 1024;
  const { tip, ukaz, skry } = useTip();
  const [bezObrazka, setBezObrazka] = useState(false);
  const farba = farbaKarty(karta, vzhlad.kategorie);
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
    if (kluc === null) return null;
    const r = (strana === "lava" ? g.slotyLave : g.slotyPrave)[i];
    if (r === undefined) return null;
    const akcia = vzhlad.akcie.find((a) => a.kluc === kluc);
    const st = sloty?.[strana][i] ?? null;
    const nazov = akcia?.nazov ?? kluc;
    const stavText =
      st === null ? null : st.stav === "aktivna" ? `Aktívna${st.nasobok > 1 ? ` ×${st.nasobok}` : ""}` : st.stav === "zrusena" ? "Zrušená Odporom" : "Neaktívna — na spoji nemá pár";
    return (
      <span
        key={`${strana}${i}`}
        className={`kl-slot${st === null ? "" : ` kl-${st.stav}`}${props.spoj?.[strana].includes(i) === true ? " kl-spoj" : ""}`}
        style={{ "--x": r.x, "--y": r.y, "--s": r.w, "--r": g.polomerSlotu } as CSSProperties}
        tabIndex={bezPopisov ? undefined : props.slotyBezFokusu === true ? -1 : 0}
        aria-label={`${nazov}: ${akcia?.popis ?? ""}`}
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
              {stavText !== null && <span className="tip-stav">{stavText}</span>}
            </>
          ),
        })}
      >
        <IkonaAkcie kluc={kluc} akcia={akcia} />
        {st !== null && st.nasobok > 1 && <span className="kl-nasobok">×{st.nasobok}</span>}
      </span>
    );
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
      tabIndex={onClick !== undefined ? 0 : undefined}
      onKeyDown={onClick !== undefined ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <div className="kl-plocha">
        <div className="kl-ilustracia" style={{ "--h": g.obrazok.h } as CSSProperties}>
          {obrazok !== null ? (
            <img src={obrazok} alt="" draggable={false} />
          ) : karta.obrazok !== null && !bezObrazka ? (
            <img
              src={mediaUrl(sirkaPx <= 260 ? karta.obrazok.nahlad : karta.obrazok.plny, !tlac && sirkaPx <= 260)}
              // ?n: náhľad karty niekedy ukazuje na plný obrázok (seed bez @512) — server pošle menšiu kópiu, ak ju má.
              {...(tlac ? {} : { srcSet: `${mediaUrl(karta.obrazok.nahlad, true)} 512w, ${mediaUrl(karta.obrazok.plny)} 1024w`, sizes: `${Math.round(sirkaPx)}px` })}
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
          text={karta.efekt}
          vzhlad={vzhlad}
          y={g.efekt.y}
          h={g.efekt.h}
          okraj={g.okrajTextu}
          velkost={g.velkostEfektu}
          hover={hover}
        />

        {props.hranaVnutorna !== undefined && [hrana("lava"), hrana("prava")]}
        {lava.map((k, i) => slot("lava", i, k))}
        {prava.map((k, i) => slot("prava", i, k))}
        {props.odznaky !== undefined && <div className="kl-odznaky">{props.odznaky}</div>}
      </div>
      {tip}
    </div>
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
