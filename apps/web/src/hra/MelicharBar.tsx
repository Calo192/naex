// Majster Melichar hovorí v jednotnom bare (Michal 2026-10-25, mock „Melichar v bare“):
// jeho bublina obsadí bar, ktorý ostane rovnako vysoký; po „ďalej“ či zatvorení sa bar
// vráti. Hovorí tak výučba, nápovedy aj hláška pri pečiatke momentu. Bublina sa vkladá
// do miesta v bare (portál) — výučba a nápovedy žijú mimo hernej plochy (Hra.tsx).
// Na to isté miesto ide aj pult hlášok (Soundboard); keď Melichar hovorí, pult mu ustúpi.

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { IKONY } from "../karta/ikony.ts";
import { castiVety, type RezimMelichara } from "./bar.ts";
import { MELICHAR_PRIBEH } from "./melicharPribeh.ts";

/** Miesto v bare (JednotnyBar), kam sa bublina vkladá. */
export const ID_MIESTA_MELICHARA = "jbar-melichar";

/** Miesto v bare — po novej partii je to iný prvok, preto sa overuje, či ešte žije. */
export function useMiestoVBare(): HTMLElement | null {
  const [miesto, setMiesto] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const najdi = (): void => setMiesto((m) => (m !== null && m.isConnected ? m : document.getElementById(ID_MIESTA_MELICHARA)));
    najdi();
    const t = setInterval(najdi, 400);
    return () => clearInterval(t);
  }, []);
  return miesto;
}

/** Hovorí Melichar v bare (výučba, nápoveda, hláška momentu)? Pult hlášok mu vtedy ustúpi (Soundboard). */
export function useMelicharHovoriVBare(miesto: HTMLElement | null): boolean {
  const [hovori, setHovori] = useState(false);
  useEffect(() => {
    if (miesto === null) {
      setHovori(false);
      return;
    }
    const zisti = (): void => setHovori([...miesto.children].some((el) => el.classList.contains("mel")));
    zisti();
    const mo = new MutationObserver(zisti);
    mo.observe(miesto, { childList: true });
    return () => mo.disconnect();
  }, [miesto]);
  return hovori;
}

/** Veta Melichara s piktogramami akcií namiesto značiek [Rana] (bar.ts, castiVety). */
export function VetaMelichara({ text, sada }: { readonly text: string; readonly sada: Sada | null }) {
  const akcia = (k: string) => sada?.akcie.find((a) => a.kluc === k);
  const jeAkcia = (k: string): boolean => Object.hasOwn(IKONY, k) || akcia(k) !== undefined;
  return (
    <>
      {castiVety(text, jeAkcia).map((c, i) =>
        "akcia" in c ? (
          <span key={i} className="mel-ikona" title={akcia(c.akcia)?.nazov ?? c.akcia}>
            <IkonaAkcie kluc={c.akcia} akcia={akcia(c.akcia)} />
          </span>
        ) : (
          <Fragment key={i}>{c.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Fotka Melichara: pri myši (na dotyku po ťuknutí) sa zväčší a povie, kto je. */
function AvatarMelichara() {
  const [otvoreny, setOtvoreny] = useState(false);
  const mys = useRef(false);
  return (
    <span className={`mel-avatar-obal${otvoreny ? " otvoreny" : ""}`} onMouseLeave={() => setOtvoreny(false)}>
      <button
        type="button"
        className="mel-avatar"
        aria-label={`Kto je ${MELICHAR_PRIBEH.meno}`}
        aria-expanded={otvoreny}
        onPointerDown={(e) => {
          mys.current = e.pointerType === "mouse";
        }}
        // Myš ukazuje príbeh prejdením (CSS :hover) — klik ho prepína len na dotyku a z klávesnice.
        onClick={() => {
          if (!mys.current) setOtvoreny((o) => !o);
          mys.current = false;
        }}
      >
        <img src="/melichar.jpg" alt="" draggable={false} />
      </button>
      <span className="mel-pribeh" role="tooltip">
        <img src="/melichar.jpg" alt={MELICHAR_PRIBEH.meno} draggable={false} />
        <span>
          <b>{MELICHAR_PRIBEH.meno}.</b> {MELICHAR_PRIBEH.text}
        </span>
      </span>
    </span>
  );
}

export interface MelicharVBareProps {
  readonly rezim: RezimMelichara;
  /** Veta a čo k nej patrí (štítok ťahu, chyba, možnosti otázky). */
  readonly children: ReactNode;
  /** Počítadlo krokov vedľa menovky (výučba). */
  readonly pocitadlo?: ReactNode;
  /** Vpravo: stav a tlačidlá („ďalej“, „rozumiem“…). */
  readonly vpravo: ReactNode;
  readonly trieda?: string;
  /**
   * Otázka výučby (Michal 2026-10-25: v kvíze sa nesmie scrollovať): bublina sa rozbalí dole
   * cez zošednutý stôl ako karta pod barom; bar ostane rovnako vysoký.
   */
  readonly rozbalena?: boolean;
  /** Atribúty pre nástroje (data-vyucba-bublina, data-vyucba-krok, data-napoveda). */
  readonly atributy?: Readonly<Record<`data-${string}`, string>>;
}

export function MelicharVBare({ rezim, children, pocitadlo, vpravo, trieda, rozbalena = false, atributy }: MelicharVBareProps) {
  const miesto = useMiestoVBare();
  if (miesto === null) return null;
  return createPortal(
    <aside className={`mel${trieda === undefined ? "" : ` ${trieda}`}${rozbalena ? " rozbalena" : ""}`} data-mel-rezim={rezim} aria-label={MELICHAR_PRIBEH.meno} {...atributy}>
      <AvatarMelichara />
      <div className="mel-telo">
        <span className="mel-kto">
          {MELICHAR_PRIBEH.meno}
          {pocitadlo}
        </span>
        <div className="mel-veta">{children}</div>
      </div>
      {/* Sem bar vloží odhad bitky, keď o ňom Melichar hovorí (JednotnyBar). */}
      {rezim === "odhad" && <span className="mel-ukazka" />}
      <div className="mel-vpravo">{vpravo}</div>
    </aside>,
    miesto,
  );
}
