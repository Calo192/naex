// Drobné zdieľané prvky rozhrania.

import type { ReactNode } from "react";
import { mediaUrl } from "./lib/api.ts";

/**
 * Avatar hráča. `farba` len v partii (a v hlavičke profilu, kde sa pár volí): iniciály
 * vyplní farbou hráča, fotke dá prstenec — mimo stola farba hráča nič neznamená.
 */
export function Avatar({
  meno,
  avatar,
  velkost = 40,
  farba,
}: {
  readonly meno: string;
  readonly avatar: string | null;
  readonly velkost?: number;
  readonly farba?: "ja" | "su";
}) {
  const inicialy = meno
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Stála farba podľa mena — hráč je rozpoznateľný aj bez fotky.
  let h = 0;
  for (const ch of meno) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const hraca = farba === undefined ? "" : ` avatar-hraca avatar-${farba}`;
  return avatar !== null ? (
    <img className={`avatar${hraca}`} src={mediaUrl(avatar, true)} alt="" width={velkost} height={velkost} style={{ width: velkost, height: velkost }} />
  ) : (
    <span
      className={`avatar avatar-inicialy${hraca}`}
      style={{ width: velkost, height: velkost, fontSize: velkost * 0.4, ...(farba === undefined ? { background: `hsl(${h} 38% 42%)` } : {}) }}
      aria-hidden="true"
    >
      {inicialy}
    </span>
  );
}

export function Nacitavanie({ text = "Načítavam…" }: { readonly text?: string }) {
  return (
    <div className="nacitavanie" role="status">
      <span className="spinner" aria-hidden="true" />
      {text}
    </div>
  );
}

export function Hlaska({ druh = "chyba", children }: { readonly druh?: "chyba" | "ok" | "info"; readonly children: ReactNode }) {
  return <div className={`hlaska hlaska-${druh}`}>{children}</div>;
}

export function Pole({ label, children, pomoc }: { readonly label: string; readonly children: ReactNode; readonly pomoc?: ReactNode }) {
  return (
    <label className="pole">
      <span className="pole-label">{label}</span>
      {children}
      {pomoc !== undefined && <span className="pole-pomoc">{pomoc}</span>}
    </label>
  );
}
