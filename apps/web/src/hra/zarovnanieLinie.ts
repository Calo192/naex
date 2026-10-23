// Zarovnanie línie akcia ku akcii (Michal 2026-10-23): spárované akcie na spoji
// sa majú stretnúť slot pri slote. Vzpriamená karta má sloty pri ilustrácii hore,
// otočená dole — karty sa teda posúvajú zvislo. Posun sa meria z DOM (kotvy
// prvého a posledného slotu v KartaLico otočenie karty prenesie), takže sedí
// pre každú kartu aj lokalitu, nech má akúkoľvek geometriu.

import { useLayoutEffect, type RefObject } from "react";

/** Výška hornej kotvy karty v okne (index 0 hrany z pohľadu diváka = vyššia z dvoch kotiev). */
function kotva(kl: Element): number | null {
  const k = [...kl.querySelectorAll(".kl-kotva")].map((x) => x.getBoundingClientRect().top);
  return k.length === 0 ? null : Math.min(...k);
}

function zarovnaj(linia: HTMLElement): void {
  // Položky radov (karty, miesta na kartu, prázdne) — posúva sa obal, nie .kl (tá má transform hoveru).
  const polozky = [...linia.querySelectorAll<HTMLElement>(".partia-rad > *")].map((el) => {
    const posun = parseFloat(el.style.marginTop) || 0;
    const kl = el.querySelector(".kl");
    const k = kl === null ? null : kotva(kl);
    // Poloha bez doterajšieho posunu: horná hrana položky a kotva (absolútne — rady
    // strán a lokality nemusia začínať v jednej výške).
    const hore = el.getBoundingClientRect().top - posun;
    return { el, hore, kotva: k === null ? null : k - posun };
  });
  const karty = polozky.filter((p): p is typeof p & { kotva: number } => p.kotva !== null);
  if (karty.length === 0) {
    for (const p of polozky) p.el.style.marginTop = "";
    return;
  }
  const ciel = Math.max(...karty.map((p) => p.kotva));
  // Kotva vzpriamenej karty od jej hornej hrany — miesto na kartu sa posunie ako ona.
  const vzpriamena = Math.min(...karty.map((p) => p.kotva - p.hore));
  for (const p of polozky) {
    // Úzke miesto na klik ostáva hore, aby rad zbytočne nenarástol.
    const posun = p.kotva !== null ? ciel - p.kotva : p.el.querySelector(".miesto-volby") !== null ? 0 : Math.max(0, ciel - (p.hore + vzpriamena));
    const v = posun < 0.5 ? "" : `${Math.round(posun * 10) / 10}px`;
    if (p.el.style.marginTop !== v) p.el.style.marginTop = v;
  }
}

/** Po každom prekreslení plochy (pred vykreslením) a pri zmene šírky línie. */
export function useZarovnanieLinie(liniaRef: RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    if (liniaRef.current !== null) zarovnaj(liniaRef.current);
  });
  useLayoutEffect(() => {
    const el = liniaRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(() => zarovnaj(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [liniaRef]);
}
