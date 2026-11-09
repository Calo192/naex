// Ikony zdrojov (cigareta, poldeci, karta) a výmena „cena → zisk“ — spoločné pre dosku hráča,
// pečiatky na hrane stola a Kšeft pod kartou. Bez routera a API, aby sa dali vykresliť aj v teste.

import type { ReactNode } from "react";
import { IKONY } from "../karta/ikony.ts";

// ---- ikony zdrojov -----------------------------------------------------------

// Cigareta a poldeci majú v celej hre jednu podobu — piktogram z karty
// (Michal 2026-10-21); stav hovorí farba: plný jantárový, vypitý sivý.
const piktogram = (kluc: "Cigareta" | "Poldeci"): ReactNode =>
  IKONY[kluc].map((c, i) => <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />);

/** `naStole` = poldeci z NA EX: kreslí sa ako vypitý (v bitke sa vypije), s jemnou značkou. */
export function IkonaPoldeci({ plny = true, novy = false, naStole = false }: { readonly plny?: boolean; readonly novy?: boolean; readonly naStole?: boolean }) {
  return (
    <svg className={`ikona-poldeci ${plny && !naStole ? "plny" : "vypity"}${novy ? " novy" : ""}${naStole ? " na-stole" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      {piktogram("Poldeci")}
      {novy && <path className="plus" d="M78 62v34M61 79h34" />}
      {naStole && <path className="stol" d="M6 98H94" />}
    </svg>
  );
}

export function IkonaCigareta({ zakaz = false }: { readonly zakaz?: boolean }) {
  return (
    <svg className={`ikona-cigareta${zakaz ? " zakaz" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      {piktogram("Cigareta")}
      {zakaz && <path className="preskrt" d="M10 92L90 8" />}
    </svg>
  );
}

/** Karta, ktorú hráč dostane (fajčenie: cigarety → karta). */
export function IkonaKarty({ zakaz = false }: { readonly zakaz?: boolean }) {
  return (
    <svg className={`ikona-karty${zakaz ? " zakaz" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.2" />
      <rect className="ilustracia" x="7.3" y="4.8" width="9.4" height="8.4" rx="0.8" />
      {zakaz && <path className="preskrt" d="M3 22L21 2" />}
    </svg>
  );
}

/** Cena v cigaretách: „−2“ a malá cigareta. */
export function CenaCigariet({ n, znamienko = "−" }: { readonly n: number; readonly znamienko?: "−" | "+" }) {
  return (
    <span className="cena-cig">
      {znamienko}
      {n}
      <IkonaCigareta />
    </span>
  );
}

/** Cena v plných poldeci (odpoveď na NA EX, v11.16): „−1“ a malý poldeci, ktorý sa vypije. */
export function CenaPoldeci({ n }: { readonly n: number }) {
  return (
    <span className="cena-cig cena-poldeci">
      −{n}
      <IkonaPoldeci />
    </span>
  );
}

/**
 * Výmena v jednom poradí na každom tlačidle a náhľade (Michal 2026-10-28: „zjednotiť to treba“):
 * čo dáš → čo dostaneš. Cena v cigaretách vľavo, odmena vpravo; pri zisku cigariet
 * (pas) je vľavo úkon a vpravo +cigarety. Bez odmeny ostane len cena.
 */
export function Vymena({ das, dostanes }: { readonly das: ReactNode; readonly dostanes?: ReactNode }) {
  return (
    <span className="vymena">
      {das}
      {dostanes !== undefined && dostanes !== null && (
        <>
          <span className="pecat-sipka" aria-hidden="true">
            →
          </span>
          {dostanes}
        </>
      )}
    </span>
  );
}

/** Mreže väzenia — väzeň v súhrne posunov, Pivnica na hrane stola a v stĺpci hráča. */
export function IkonaMrezi({ className = "ikona-mrezi" }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 2.5h18v2.2H3zm0 16.8h18v2.2H3zM5 4.7h2.2v14.6H5zm4.1 0h2.2v14.6H9.1zm4.1 0h2.2v14.6h-2.2zm4.1 0H19.5v14.6h-2.2z" />
    </svg>
  );
}
