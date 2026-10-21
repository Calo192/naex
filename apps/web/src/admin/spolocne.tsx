// Spoločné prvky podstránok Tvorby: hlavička stránky a ikony menu.

import type { ReactNode } from "react";

/** Hlavička podstránky: nadpis, jedna veta o tom, na čo stránka je, a akcie vpravo. */
export function AdminHlava({ titul, popis, children }: { readonly titul: ReactNode; readonly popis?: ReactNode; readonly children?: ReactNode }) {
  return (
    <header className="admin-hlavicka">
      <div className="admin-hlavicka-text">
        <h1>{titul}</h1>
        {popis !== undefined && <p>{popis}</p>}
      </div>
      {children !== undefined && <div className="admin-hlavicka-akcie">{children}</div>}
    </header>
  );
}

export type NazovIkony = "prehlad" | "karty" | "akcie" | "slova" | "farby" | "bodovacie" | "tlac" | "import" | "plus" | "kopia" | "kos" | "hladat";

// Obrysové ikony 24 × 24 kreslené ťahom aktuálnej farby textu — namiesto emoji,
// ktoré sa v každom systéme kreslia inak.
const CESTY: Record<NazovIkony, ReactNode> = {
  prehlad: (
    <>
      <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4h6v4h-6zM4 20h6v-3H4z" />
    </>
  ),
  karty: (
    <>
      <rect x="7" y="3" width="12" height="17" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h9" />
    </>
  ),
  akcie: <path d="M12 3l2.4 5.6L20 9.2l-4.3 3.9 1.3 5.9L12 16l-5 3 1.3-5.9L4 9.2l5.6-.6z" />,
  slova: (
    <>
      <path d="M5 6h14M5 12h9M5 18h11" />
      <path d="M19 15v6" />
    </>
  ),
  farby: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </>
  ),
  bodovacie: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h2M8 12h2M8 16h2M14 8h2M14 12h2M14 16h2" />
    </>
  ),
  tlac: (
    <>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  import: (
    <>
      <path d="M8 4v13M4 13l4 4 4-4" />
      <path d="M16 20V7M12 11l4-4 4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  kopia: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  kos: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  hladat: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
};

export function Ikona({ nazov, velkost = 18 }: { readonly nazov: NazovIkony; readonly velkost?: number }) {
  return (
    <svg
      className="ikona"
      width={velkost}
      height={velkost}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CESTY[nazov]}
    </svg>
  );
}
