// Kostra stránky: hlavička s navigáciou (podľa roly) a obsah.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Odkaz, chod, useCesta } from "./lib/router.tsx";
import { NAZOV_UROVNE, jeSpravca, useUcet } from "./lib/ucet.tsx";
import { Avatar } from "./komponenty.tsx";

const NAVIGACIA: readonly { readonly href: string; readonly text: string; readonly admin?: boolean }[] = [
  { href: "/pravidla", text: "Pravidlá" },
  { href: "/karty", text: "Karty" },
  { href: "/hra", text: "Hrať" },
  { href: "/rebricek", text: "Rebríček" },
  { href: "/spatna-vazba", text: "Spätná väzba" },
  { href: "/admin", text: "Tvorba", admin: true },
];

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
          <button className="hamburger" aria-label="Menu" aria-expanded={mobilne} onClick={() => setMobilne(!mobilne)}>
            <span />
            <span />
            <span />
          </button>
          <nav className={mobilne ? "navigacia otvorena" : "navigacia"}>
            {NAVIGACIA.filter((n) => n.admin !== true || (ja !== null && jeSpravca(ja.rola))).map((n) => (
              <Odkaz key={n.href} href={n.href} className={cesta.startsWith(n.href) ? "aktivna" : undefined}>
                {n.text}
              </Odkaz>
            ))}
          </nav>
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
                    {jeSpravca(ja.rola) && (
                      <>
                        <Odkaz href="/admin" role="menuitem">
                          Tvorba kariet
                        </Odkaz>
                        <Odkaz href="/admin/pouzivatelia" role="menuitem">
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
