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

/** Zvislý posun ducha z jeho `translate` („0 12px“). */
function posunDucha(duch: HTMLElement): number {
  return parseFloat(duch.style.translate.split(" ")[1] ?? "") || 0;
}

function zarovnaj(linia: HTMLElement): void {
  // Položky radov (karty, miesta na kartu, prázdne) — posúva sa obal, nie .kl (tá má transform hoveru).
  // Duch karty z ruky (.duch-karty, náhľad pri prejdení myšou) sa do položky neráta: jej miesto
  // ostáva ako úzke miesto na klik hore.
  const polozky = [...linia.querySelectorAll<HTMLElement>(".partia-rad > *")].map((el) => {
    const posun = parseFloat(el.style.marginTop) || 0;
    const kl = el.querySelector(".kl:not(.duch-karty .kl)");
    const k = kl === null ? null : kotva(kl);
    // Poloha bez doterajšieho posunu: horná hrana položky a kotva (absolútne — rady
    // strán a lokality nemusia začínať v jednej výške).
    const hore = el.getBoundingClientRect().top - posun;
    return { el, hore, kotva: k === null ? null : k - posun };
  });
  const duchovia = [...linia.querySelectorAll<HTMLElement>(".partia-rad > * > .duch-karty")];
  const karty = polozky.filter((p): p is typeof p & { kotva: number } => p.kotva !== null);
  if (karty.length === 0) {
    for (const p of polozky) p.el.style.marginTop = "";
    for (const d of duchovia) d.style.translate = "";
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
  // Popis strán pod lokalitou zaberal na vysokom okne vlastný riadok pod celou líniou, hoci pod
  // lokalitou je v rade kariet voľno (karty strán ležia nakrivo nižšie) — vysunie sa doňho, karty
  // dostanú výšku (rozloženie A, Michal 2026-11-11: karty majú využiť priestor aj na veľkom monitore).
  const strany = linia.querySelector<HTMLElement>(".linia-skupina.lokalita > .strany-stredu");
  const radLokality = strany?.parentElement?.querySelector<HTMLElement>(":scope > .partia-rad");
  if (strany != null && radLokality != null) {
    if (strany.style.marginTop !== "") strany.style.marginTop = "";
    const spodok = Math.max(...[...radLokality.children].map((c) => c.getBoundingClientRect().bottom));
    const volne = Math.floor(radLokality.getBoundingClientRect().bottom - spodok);
    const v = strany.offsetHeight === 0 || volne < 1 ? "" : `${-Math.min(volne, strany.offsetHeight)}px`;
    if (strany.style.marginTop !== v) strany.style.marginTop = v;
  }
  // Duch leží tak, ako by ležala karta, ale rozloženie nemení (translate, nie okraj) a cieľ
  // ostatných kariet neovplyvní — línia sa pri prechode myšou po ruke nehýbe.
  for (const d of duchovia) {
    const kl = d.querySelector(".kl");
    const k = kl === null ? null : kotva(kl);
    if (k === null) continue;
    const posun = Math.max(0, ciel - (k - posunDucha(d)));
    const v = posun < 0.5 ? "" : `0 ${Math.round(posun * 10) / 10}px`;
    if (d.style.translate !== v) d.style.translate = v;
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
