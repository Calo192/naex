// Kostra stránky: hlavička s navigáciou (podľa roly) a obsah.

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { api } from "./lib/api.ts";
import { NOVINKY_VIDENE, citajVidene } from "./lib/novinky.ts";
import { ZAVES_ODCHODU, useStrazenaPartia, type StrazenaPartia } from "./lib/odchod.ts";
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

/** Koľko rozhodnutí o mojich návrhoch v Dielni som ešte nevidel — značka pri Kartách. */
function useDielnaZnacka(cesta: string, prihlaseny: boolean): number {
  const [pocet, setPocet] = useState(0);
  useEffect(() => {
    if (!prihlaseny) {
      setPocet(0);
      return;
    }
    let zive = true;
    api
      .get<{ pocet: number }>("/dielna/znacka")
      .then((r) => {
        if (zive) setPocet(r.pocet);
      })
      .catch(() => undefined);
    return () => {
      zive = false;
    };
  }, [cesta, prihlaseny]);
  return pocet;
}

/**
 * Odísť z partie? (Michal 2026-10-23) — klik na položku menu počas partie. Partia
 * beží ďalej; predvolené (fokus, Esc, klik mimo) je zostať.
 */
function OdchodZPartie({
  partia,
  nazov,
  onZostat,
  onOdist,
}: {
  readonly partia: StrazenaPartia;
  readonly nazov: string;
  readonly onZostat: () => void;
  readonly onOdist: () => void;
}) {
  const zostatRef = useRef<HTMLButtonElement>(null);
  const zostat = useRef(onZostat);
  zostat.current = onZostat;
  useEffect(() => {
    zostatRef.current?.focus();
    // Zachytené skôr než Esc hernej plochy (línia starších, lupa…).
    // Ostatné klávesy tiež nesmú k stolu: Enter na tlačidle dialógu by vo výučbe posunul
    // krok a jeho preventDefault zrušil klik tlačidla. Predvolená akcia (Tab, Enter) ostáva.
    const klaves = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (e.key === "Escape") zostat.current();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, []);
  return (
    <div className={ZAVES_ODCHODU} onClick={onZostat}>
      <div
        className="odchod-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="odchod-nadpis"
        aria-describedby="odchod-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="odchod-nadpis">Odísť z partie?</h2>
        {partia.vyucba ? (
          <p id="odchod-text">
            Výučba počká — vrátiš sa do nej cez <b>Hrať</b>, na tom istom mieste.
          </p>
        ) : (
          <>
            <p id="odchod-text">
              Partia beží ďalej — nie je to vzdanie sa. Vrátiš sa do nej cez <b>Hrať</b> alebo kódom miestnosti{" "}
              <span className="odchod-kod">{partia.kod}</span>.
            </p>
            <p>Súper medzitým čaká; po 3 minútach bez teba si môže vyžiadať kontumačnú výhru.</p>
          </>
        )}
        <div className="odchod-tlacidla">
          <button type="button" onClick={onOdist}>
            {nazov}
          </button>
          <button type="button" className="tlacidlo-hlavne" ref={zostatRef} onClick={onZostat}>
            Zostať v partii
          </button>
        </div>
      </div>
    </div>
  );
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
  const dielna = useDielnaZnacka(cesta, nacitane && ja !== null);
  const strazenaPartia = useStrazenaPartia();
  const [odchod, setOdchod] = useState<{ readonly href: string | null; readonly nazov: string } | null>(null);
  // Klik na odkaz v hlavičke (menu, logo, účet) počas partie zachytí dialóg — ovládanie
  // partie (#hlavicka-hra) a „Hrať“ nie. Ctrl/stredné tlačidlo otvárajú novú kartu ďalej.
  const strazOdchodu = (e: ReactMouseEvent<HTMLElement>): void => {
    if (strazenaPartia === null || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const ciel = (e.target as Element).closest<HTMLElement>("a[href], [data-odchod]");
    if (ciel === null || ciel.closest("#hlavicka-hra") !== null) return;
    const href = ciel.getAttribute("href");
    if (href === "/hra" || href === cesta) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu(false);
    setMobilne(false);
    const nazov = ciel.dataset.odchod ?? `Odísť na ${ciel.dataset.nazov ?? ciel.firstChild?.textContent?.trim() ?? "inú stránku"}`;
    setOdchod({ href, nazov });
  };

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
      <header className="hlavicka" onClickCapture={strazOdchodu}>
        <div className="hlavicka-vnutro">
          <Odkaz href="/" className="logo" aria-label="NA EX! — domov" data-nazov="úvodnú stránku">
            <span className="logo-pohar" aria-hidden="true" />
            NA EX!
          </Odkaz>
          <button
            className={noveNovinky > 0 || dielna > 0 ? "hamburger ma-novinky" : "hamburger"}
            aria-label={noveNovinky > 0 ? "Menu (nové novinky)" : dielna > 0 ? "Menu (nové rozhodnutie v Dielni)" : "Menu"}
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
                {n.href === "/karty" && dielna > 0 && (
                  <span className="nav-znacka" title="Nové rozhodnutie o tvojom návrhu v Dielni" aria-label="nové rozhodnutie v Dielni">
                    {dielna > 9 ? "9+" : dielna}
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
                      data-odchod="Odhlásiť sa"
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
      {odchod !== null && strazenaPartia !== null && (
        <OdchodZPartie
          partia={strazenaPartia}
          nazov={odchod.nazov}
          onZostat={() => setOdchod(null)}
          onOdist={() => {
            const href = odchod.href;
            setOdchod(null);
            if (href === null) void odhlas().then(() => chod("/"));
            else chod(href);
          }}
        />
      )}
      <main className={plna ? "obsah obsah-plna" : siroky ? "obsah obsah-siroky" : "obsah"}>{children}</main>
      <footer className={plna ? "paticka paticka-skryta" : "paticka"}>
        <span>NA EX! — kartová hra pre dvoch · © Michal Calík</span>
        <span>Hra je fikcia a karikatúra. Alkohol, fajčenie a hazard škodia zdraviu.</span>
      </footer>
    </div>
  );
}
