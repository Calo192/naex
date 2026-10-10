// Minimalistický router nad History API — pár stránok nepotrebuje knižnicu.

import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

const POSLUCHACI = new Set<() => void>();

export function chod(cesta: string, nahradit = false): void {
  if (cesta === location.pathname + location.search) return;
  if (nahradit) history.replaceState(null, "", cesta);
  else history.pushState(null, "", cesta);
  window.scrollTo({ top: 0 });
  for (const f of POSLUCHACI) f();
}

window.addEventListener("popstate", () => {
  for (const f of POSLUCHACI) f();
});

export function useCesta(): string {
  const [cesta, setCesta] = useState(location.pathname);
  useEffect(() => {
    const f = () => setCesta(location.pathname);
    POSLUCHACI.add(f);
    return () => {
      POSLUCHACI.delete(f);
    };
  }, []);
  return cesta.replace(/\/+$/, "") || "/";
}

/** Odkaz, ktorý nenačíta stránku znova (ctrl/stredné tlačidlo funguje normálne). */
export function Odkaz({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const klik = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    chod(href);
  };
  return <a href={href} onClick={klik} {...rest} />;
}

export function useTitulok(titulok: string): void {
  useEffect(() => {
    document.title = titulok === "" ? "NA EX!" : `${titulok} · NA EX!`;
  }, [titulok]);
}
