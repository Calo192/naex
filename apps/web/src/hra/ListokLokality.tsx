// Lístok lokality na výber pri voľbe cieľa (Leader 2026-10-30): na nízkom stole bola celá
// karta 105 px široká a jej efekt nečitateľný. Lístok nesie hornú časť karty — ilustráciu
// s akciami na hranách, orezanú zhora a zdola, aby sa zmestila — a názov s efektom písmom
// stola. Celú kartu ukáže lupa. Rozmery ráta rozmerNastenky (ListokNaVyber).

import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import type { KartaNavrh, Vzhlad } from "@naex/tvorba";
import { farbaKarty, formatujEfekt } from "@naex/tvorba";
import { OREZ_MIN } from "./rozlozenieNastenky.ts";

/** Najmenšia mierka písma, keď sa ani pri najnižšej ilustrácii efekt nezmestí (≈ 10,5 px). */
const MIERKA_MIN = 0.9;
/** Nižšia ilustrácia (podiel šírky), keď sa efekt nezmestí ani pri OREZ_MIN — krajné akcie sa
 *  orežú trochu, až po zmenšení písma viac (celú kartu ukáže lupa). */
const OREZ_NIZSI = 0.45;
const OREZ_NUDZA = 0.3;

export function ListokLokality({
  karta,
  vzhladKarty,
  vzhlad,
  onClick,
}: {
  /** Karta v šírke ilustrácie (ListokNaVyber.obraz) — klik a ťahanie nesie ona. */
  readonly karta: ReactNode;
  readonly vzhladKarty: KartaNavrh;
  readonly vzhlad: Vzhlad;
  /** Klik na text robí to isté ako klik na kartu. */
  readonly onClick?: (() => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const riadky = useMemo(() => formatujEfekt(vzhladKarty.efekt, vzhlad.klucoveSlova), [vzhladKarty.efekt, vzhlad.klucoveSlova]);

  // Dlhý efekt (Predsedova vila) na nízkom lístku: ilustrácia ustúpi na OREZ_MIN (CSS), potom ďalej
  // za cenu orezaných krajných akcií, potom mierne písmo a nakoniec ešte ilustrácia — text má prednosť.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const prisposob = (): void => {
      let m = 1;
      let orez = OREZ_MIN;
      el.style.setProperty("--m", "1");
      el.style.setProperty("--ll-orez", String(orez));
      const pretieka = (): boolean => el.scrollHeight > el.clientHeight + 1;
      const znizObraz = (po: number): void => {
        while (pretieka() && orez > po) {
          orez = Math.round((orez - 0.025) * 1000) / 1000;
          el.style.setProperty("--ll-orez", String(orez));
        }
      };
      znizObraz(OREZ_NIZSI);
      while (pretieka() && m > MIERKA_MIN) {
        m = Math.round((m - 0.025) * 1000) / 1000;
        el.style.setProperty("--m", String(m));
      }
      znizObraz(OREZ_NUDZA);
    };
    prisposob();
    const ro = new ResizeObserver(prisposob);
    ro.observe(el);
    return () => ro.disconnect();
  }, [riadky]);

  return (
    <div className="listok-lokality" ref={ref} style={{ "--lc-farba": farbaKarty(vzhladKarty, vzhlad.kategorie) } as CSSProperties}>
      <div className="ll-obraz">{karta}</div>
      <div className="ll-text" onClick={onClick}>
        <span className="ll-nazov">{vzhladKarty.nazov}</span>
        <span className="ll-efekt">
          {riadky.map((riadok, i) => (
            <span key={i} className="ll-riadok">
              {riadok.map((u, j) => {
                const obsah = u.kurziva && u.tucne ? <i>{u.text}</i> : u.text;
                return u.tucne ? <b key={j}>{obsah}</b> : u.kurziva ? <i key={j}>{u.text}</i> : <span key={j}>{u.text}</span>;
              })}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
