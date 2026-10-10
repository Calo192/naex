// Drobné zdieľané prvky rozhrania.

import type { ReactNode } from "react";
import { mediaUrl } from "./lib/api.ts";

export function Avatar({ meno, avatar, velkost = 40 }: { readonly meno: string; readonly avatar: string | null; readonly velkost?: number }) {
  const inicialy = meno
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // Stála farba podľa mena — hráč je rozpoznateľný aj bez fotky.
  let h = 0;
  for (const ch of meno) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return avatar !== null ? (
    <img className="avatar" src={mediaUrl(avatar)} alt="" width={velkost} height={velkost} style={{ width: velkost, height: velkost }} />
  ) : (
    <span
      className="avatar avatar-inicialy"
      style={{ width: velkost, height: velkost, fontSize: velkost * 0.4, background: `hsl(${h} 38% 42%)` }}
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
