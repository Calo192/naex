// Kostra stránky: hlavička s navigáciou (podľa roly) a obsah.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./lib/api.ts";
import { NOVINKY_VIDENE, citajVidene } from "./lib/novinky.ts";
import { Odkaz, chod, useCesta } from "./lib/router.tsx";
import { NAZOV_UROVNE, jeSpravca, maPravo, useUcet, type Pravo } from "./lib/ucet.tsx";
import { Avatar } from "./komponenty.tsx";

const NAVIGACIA: readonly { readonly href: string; readonly text: string; readonly admin?: boolean; readonly pravo?: Pravo }[] = [
  { href: "/pravidla", text: "Pravidlá" },
  { href: "/karty", text: "Karty" },
  { href: "/hra", text: "Hrať" },
  { href: "/rebricek", text: "Rebríček", pravo: "profily_inych" },
  { href: "/spatna-vazba", text: "Spätná väzba" },
  { href: "/novinky", text: "Novinky" },
  { href: "/vyvoj", text: "Vývoj" },
  { href: "/playtest", text: "Playtest", pravo: "reporty_playtestov" },
  { href: "/admin", text: "Tvorba", admin: true },
];

/**
 * Koľko noviniek pribudlo od poslednej návštevy stránky Novinky (roadmapa #20) —
 * prihlásenému to ráta server, návštevníkovi od času uloženého v prehliadači.
 * Zistí sa pri každom prechode na inú stránku; na Novinkách je 0.
 */
function useNoveNovinky(cesta: string, nacitane: boolean, prihlaseny: boolean): number {
  const [pocet, setPocet] = useState(0);
  useEffect(() => {
    const zhasni = (): void => setPocet(0);
    window.addEventListener(NOVINKY_VIDENE, zhasni);
    return () => window.removeEventListener(NOVINKY_VIDENE, zhasni);
  }, []);
  useEffect(() => {
    if (!nacitane || cesta === "/novinky") return;
    const od = prihlaseny ? null : citajVidene();
    // Návštevník, ktorý Novinky ešte neotvoril, značku nevidí — všetko by bolo „nové“.
    if (!prihlaseny && od === null) return;
    let zive = true;
    api
      .get<{ pocet: number }>(od === null ? "/novinky/nove" : `/novinky/nove?od=${od}`)
      .then((r) => {
        if (zive) setPocet(r.pocet);
      })
      .catch(() => undefined);
    return () => {
      zive = false;
    };
  }, [cesta, nacitane, prihlaseny]);
  return cesta === "/novinky" ? 0 : pocet;
}

/** siroky = do 1600 px; plna = celé okno pod hlavičkou bez posúvania stránky a bez pätičky (pravidlá). */
export function Layout({
  children,
  siroky = false,
  plna = false,
}: {
  readonly children: ReactNode;
  readonly siroky?: boolean;
  readonly plna?: boolean;
}) {
  const cesta = useCesta();
  const { ja, nacitane, odhlas } = useUcet();
  const [menu, setMenu] = useState(false);
  const [mobilne, setMobilne] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const noveNovinky = useNoveNovinky(cesta, nacitane, ja !== null);

  useEffect(() => {
    setMenu(false);
    setMobilne(false);
  }, [cesta]);

  useEffect(() => {
    if (!menu) return;
    const zavri = (e: MouseEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", zavri);
    return () => document.removeEventListener("mousedown", zavri);
  }, [menu]);

  return (
    <div className="aplikacia">
      <header className="hlavicka">
        <div className="hlavicka-vnutro">
          <Odkaz href="/" className="logo" aria-label="NA EX! — domov">
            <span className="logo-pohar" aria-hidden="true" />
            NA EX!
          </Odkaz>
          <button
            className={noveNovinky > 0 ? "hamburger ma-novinky" : "hamburger"}
            aria-label={noveNovinky > 0 ? "Menu (nové novinky)" : "Menu"}
            aria-expanded={mobilne}
            onClick={() => setMobilne(!mobilne)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className={mobilne ? "navigacia otvorena" : "navigacia"}>
            {NAVIGACIA.filter(
              (n) => (n.admin !== true || (ja !== null && jeSpravca(ja.rola))) && (n.pravo === undefined || ja === null || maPravo(ja, n.pravo)),
            ).map((n) => (
              <Odkaz key={n.href} href={n.href} className={cesta === n.href || cesta.startsWith(`${n.href}/`) ? "aktivna" : undefined}>
                {n.text}
                {n.href === "/novinky" && noveNovinky > 0 && (
                  <span className="nav-znacka" aria-label={`${noveNovinky} ${noveNovinky === 1 ? "nová" : noveNovinky < 5 ? "nové" : "nových"}`}>
                    {noveNovinky > 9 ? "9+" : noveNovinky}
                  </span>
                )}
              </Odkaz>
            ))}
          </nav>
          {/* Počas partie sem herná plocha cez portál dá ovládanie partie (vzdať sa, odísť…). */}
          <div id="hlavicka-hra" className="hlavicka-hra" />
          <div className="ucet" ref={menuRef}>
            {!nacitane ? null : ja === null ? (
              <>
                <Odkaz href="/prihlasenie" className="tlacidlo tlacidlo-jemne">
                  Prihlásiť
                </Odkaz>
                <Odkaz href="/registracia" className="tlacidlo tlacidlo-hlavne skryt-mobil">
                  Registrovať
                </Odkaz>
              </>
            ) : (
              <>
                <button className="ucet-tlacidlo" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
                  <Avatar meno={ja.meno} avatar={ja.avatar} velkost={34} />
                  <span className="ucet-meno skryt-mobil">{ja.meno}</span>
                </button>
                {menu && (
                  <div className="ucet-menu" role="menu">
                    <div className="ucet-menu-hlava">
                      <strong>{ja.meno}</strong>
                      <span>@{ja.login} · {NAZOV_UROVNE[ja.rola]}</span>
                    </div>
                    <Odkaz href="/profil" role="menuitem">
                      Môj profil
                    </Odkaz>
                    <Odkaz href={`/hrac/${ja.id}`} role="menuitem">
                      Moje štatistiky
                    </Odkaz>
                    <Odkaz href="/hra" role="menuitem">
                      Hrať
                    </Odkaz>
                    {maPravo(ja, "reporty_playtestov") && (
                      <Odkaz href="/playtest" role="menuitem">
                        Playtest
                      </Odkaz>
                    )}
                    {jeSpravca(ja.rola) && (
                      <>
                        <Odkaz href="/admin" role="menuitem">
                          Tvorba kariet
                        </Odkaz>
                        <Odkaz href="/hraci" role="menuitem">
                          Hráči
                        </Odkaz>
                      </>
                    )}
                    <button
                      role="menuitem"
                      onClick={() => {
                        void odhlas().then(() => chod("/"));
                      }}
                    >
                      Odhlásiť sa
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className={plna ? "obsah obsah-plna" : siroky ? "obsah obsah-siroky" : "obsah"}>{children}</main>
      <footer className={plna ? "paticka paticka-skryta" : "paticka"}>
        <span>NA EX! — kartová hra pre dvoch · © Michal Calík</span>
        <span>Hra je fikcia a karikatúra. Alkohol, fajčenie a hazard škodia zdraviu.</span>
      </footer>
    </div>
  );
}
