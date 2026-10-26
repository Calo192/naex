// Kostra stránky: hlavička s navigáciou (podľa roly) a obsah.
// Jedna kostra v hre aj mimo nej (Michal 2026-10-26, #21 B a #22 A): hlavička na celú
// šírku s okrajom --okraj-stranky, logo · menu · pravá zóna · účet. Pri stole menu
// webu nie je (#23) — v pravej zóne je štítok partie a menu Partia (portál z hernej
// plochy). Mimo stola s rozohranou partiou je tam pilulka „Späť ku stolu“.

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { api } from "./lib/api.ts";
import { NOVINKY_VIDENE, citajVidene } from "./lib/novinky.ts";
import { hlavneMenu, jeAktivna, menuUctu, spravaWebu, type PolozkaNavigacie } from "./lib/navigacia.ts";
import { KLUC_MIESTNOSTI, ZAVES_ODCHODU, useJeStolVHlavicke, useStrazenaPartia, type StrazenaPartia } from "./lib/odchod.ts";
import { Odkaz, chod, useCesta } from "./lib/router.tsx";
import { NAZOV_UROVNE, jeSpravca, useUcet } from "./lib/ucet.tsx";
import { Avatar } from "./komponenty.tsx";

/** Šírka obsahu (tokeny v styles.css): čítanie 760 px, stránka 1280 px, široká = celé okno. */
export type SirkaStranky = "citanie" | "stranka" | "siroka";

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

/** Návrhy z Playtestu, ktoré čakajú na rozhodnutie — počet pri Playteste v menu Správa. */
function usePocetNavrhov(cesta: string, spravca: boolean): number {
  const [pocet, setPocet] = useState(0);
  useEffect(() => {
    if (!spravca) {
      setPocet(0);
      return;
    }
    let zive = true;
    api
      .get<{ naRozhodnutie: number }>("/admin/navrhy/pocet")
      .then((r) => {
        if (zive) setPocet(r.naRozhodnutie);
      })
      .catch(() => undefined);
    return () => {
      zive = false;
    };
  }, [cesta, spravca]);
  return pocet;
}

/**
 * Rozohraná partia, keď hráč nesedí pri stole (#22 A): kód je v prehliadači (useHra),
 * či partia ešte beží, povie server. Na /hra nie — tam sa hráč k stolu vráti sám.
 */
function useRozohranaPartia(cesta: string, prihlaseny: boolean, priStole: boolean): { readonly kod: string; readonly vyucba: boolean } | null {
  const [partia, setPartia] = useState<{ readonly kod: string; readonly vyucba: boolean } | null>(null);
  const ziadna = !prihlaseny || priStole || cesta === "/hra";
  useEffect(() => {
    if (ziadna) {
      setPartia(null);
      return;
    }
    const kod = localStorage.getItem(KLUC_MIESTNOSTI);
    if (kod === null) {
      setPartia(null);
      return;
    }
    let zive = true;
    api
      .get<{ partia: { kod: string; vyucba: boolean } | null }>(`/hry/moja?kod=${encodeURIComponent(kod)}`)
      .then((r) => {
        if (zive) setPartia(r.partia);
      })
      .catch(() => undefined);
    return () => {
      zive = false;
    };
  }, [cesta, ziadna]);
  return ziadna ? null : partia;
}

/**
 * Položky menu, ktoré sa nezmestia, idú do „Viac ▾“ — od najnižšej priority (Hrať nikdy).
 * Meria sa v prehliadači: šírku položiek dáva písmo a značky noviniek.
 */
function useViac(nav: RefObject<HTMLElement | null>, viac: RefObject<HTMLElement | null>, pozoruj: RefObject<HTMLElement | null>, kluc: string): readonly string[] {
  const [skryte, setSkryte] = useState<readonly string[]>([]);
  useLayoutEffect(() => {
    const el = nav.current;
    if (el === null) {
      setSkryte([]);
      return;
    }
    const prisposob = (): void => {
      const polozky = [...el.querySelectorAll<HTMLElement>("[data-priorita]")];
      const oddelovac = el.querySelector<HTMLElement>(".nav-oddelovac");
      for (const p of polozky) p.hidden = false;
      if (oddelovac !== null) oddelovac.hidden = false;
      if (viac.current !== null) viac.current.hidden = true;
      const vela = (): boolean => el.scrollWidth > el.clientWidth + 1;
      const nove: string[] = [];
      if (vela()) {
        if (viac.current !== null) viac.current.hidden = false;
        for (const p of [...polozky].sort((a, b) => Number(a.dataset.priorita) - Number(b.dataset.priorita))) {
          if (!vela()) break;
          p.hidden = true;
          nove.push(p.dataset.href ?? "");
        }
      }
      // Oddeľovač len medzi dvoma viditeľnými skupinami.
      if (oddelovac !== null) oddelovac.hidden = polozky.filter((p) => p.dataset.skupina === "komunita").every((p) => p.hidden);
      setSkryte((s) => (s.join() === nove.join() ? s : nove));
    };
    prisposob();
    const ro = new ResizeObserver(prisposob);
    if (el.parentElement !== null) ro.observe(el.parentElement);
    if (pozoruj.current !== null) ro.observe(pozoruj.current);
    return () => ro.disconnect();
  }, [nav, viac, pozoruj, kluc]);
  return skryte;
}

/**
 * Odísť z partie? (Michal 2026-10-23) — klik na odkaz v hlavičke počas partie. Partia
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
            Výučba počká — vrátiš sa do nej cez <b>Späť ku stolu</b> v hlavičke, na tom istom mieste.
          </p>
        ) : (
          <>
            <p id="odchod-text">
              Partia beží ďalej — nie je to vzdanie sa. Vrátiš sa do nej na jeden klik cez <b>Späť ku stolu</b> v hlavičke (kód miestnosti{" "}
              <span className="odchod-kod">{partia.kod}</span>).
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

const pocetNovych = (n: number): string => `${n} ${n === 1 ? "nová" : n < 5 ? "nové" : "nových"}`;

/** Pilulka „● Partia HZ3T beží · Späť ku stolu“ — na mobile len jej tlačidlo. */
function PilulkaPartie({ partia }: { readonly partia: { readonly kod: string; readonly vyucba: boolean } }) {
  return (
    <Odkaz href="/hra" className="partia-pilulka" aria-label={`${partia.vyucba ? "Prvá hra" : `Partia ${partia.kod}`} beží — späť ku stolu`}>
      <span className="pilulka-bodka" aria-hidden="true" />
      <span className="pilulka-text skryt-mobil">{partia.vyucba ? <>Prvá hra beží</> : <>Partia <b>{partia.kod}</b> beží</>}</span>
      <span className="pilulka-spat">Späť ku stolu</span>
    </Odkaz>
  );
}

export function Layout({
  children,
  sirka = "stranka",
  plna = false,
}: {
  readonly children: ReactNode;
  readonly sirka?: SirkaStranky;
  /** Celé okno pod hlavičkou bez posúvania stránky a bez pätičky. */
  readonly plna?: boolean;
}) {
  const cesta = useCesta();
  const { ja, nacitane, odhlas, pravaNavstevnika } = useUcet();
  const [otvoreneMenu, setOtvoreneMenu] = useState<"ucet" | "sprava" | "viac" | null>(null);
  const [mobilne, setMobilne] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const spravaRef = useRef<HTMLDivElement>(null);
  const viacRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const viacTlacidlo = useRef<HTMLButtonElement>(null);
  const pravaRef = useRef<HTMLDivElement>(null);
  const prihlaseny = ja !== null;
  const spravca = ja !== null && jeSpravca(ja.rola);
  const noveNovinky = useNoveNovinky(cesta, nacitane, prihlaseny);
  const dielna = useDielnaZnacka(cesta, nacitane && prihlaseny);
  const navrhy = usePocetNavrhov(cesta, spravca);
  const strazenaPartia = useStrazenaPartia();
  const priStole = useJeStolVHlavicke();
  const rozohrana = useRozohranaPartia(cesta, prihlaseny, priStole);
  const polozky = nacitane ? hlavneMenu(ja, pravaNavstevnika) : [];
  const sprava = spravaWebu(ja);
  const skryte = useViac(navRef, viacTlacidlo, pravaRef, `${priStole}|${polozky.map((p) => p.href).join()}|${noveNovinky}|${dielna}|${navrhy}|${rozohrana?.kod ?? ""}|${ja?.meno ?? ""}`);
  const [odchod, setOdchod] = useState<{ readonly href: string | null; readonly nazov: string } | null>(null);
  // Klik na odkaz v hlavičke (logo, účet) počas partie zachytí dialóg — ovládanie
  // partie (#hlavicka-hra) nie. Ctrl/stredné tlačidlo otvárajú novú kartu ďalej.
  const strazOdchodu = (e: ReactMouseEvent<HTMLElement>): void => {
    if (strazenaPartia === null || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const ciel = (e.target as Element).closest<HTMLElement>("a[href], [data-odchod]");
    if (ciel === null || ciel.closest("#hlavicka-hra") !== null) return;
    const href = ciel.getAttribute("href");
    if (href === "/hra" || href === cesta) return;
    e.preventDefault();
    e.stopPropagation();
    setOtvoreneMenu(null);
    setMobilne(false);
    const nazov = ciel.dataset.odchod ?? `Odísť na ${ciel.dataset.nazov ?? ciel.firstChild?.textContent?.trim() ?? "inú stránku"}`;
    setOdchod({ href, nazov });
  };

  useEffect(() => {
    setOtvoreneMenu(null);
    setMobilne(false);
  }, [cesta]);

  useEffect(() => {
    if (otvoreneMenu === null) return;
    const ref = otvoreneMenu === "ucet" ? menuRef : otvoreneMenu === "sprava" ? spravaRef : viacRef;
    const zavri = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOtvoreneMenu(null);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOtvoreneMenu(null);
    };
    document.addEventListener("mousedown", zavri);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", zavri);
      document.removeEventListener("keydown", esc);
    };
  }, [otvoreneMenu]);

  const prepni = (m: "ucet" | "sprava" | "viac"): void => setOtvoreneMenu((o) => (o === m ? null : m));

  const znacka = (href: string): ReactNode =>
    href === "/novinky" && noveNovinky > 0 ? (
      <span className="nav-znacka" aria-label={pocetNovych(noveNovinky)}>
        {noveNovinky > 9 ? "9+" : noveNovinky}
      </span>
    ) : href === "/karty" && dielna > 0 ? (
      <span className="nav-znacka" title="Nové rozhodnutie o tvojom návrhu v Dielni" aria-label="nové rozhodnutie v Dielni">
        {dielna > 9 ? "9+" : dielna}
      </span>
    ) : null;

  const odkaz = (n: PolozkaNavigacie, trieda: string, sPrioritou: boolean): ReactNode => {
    const aktivna = jeAktivna(cesta, n.href);
    return (
      <Odkaz
        key={n.href}
        href={n.href}
        className={[trieda, n.hlavna === true ? "nav-hlavna" : "", aktivna ? "aktivna" : ""].filter((t) => t !== "").join(" ") || undefined}
        aria-current={aktivna ? "page" : undefined}
        {...(sPrioritou && n.hlavna !== true ? { "data-priorita": n.priorita, "data-href": n.href, "data-skupina": n.skupina } : {})}
      >
        {n.text}
        {znacka(n.href)}
      </Odkaz>
    );
  };
  const hra = polozky.filter((p) => p.skupina === "hra");
  const komunita = polozky.filter((p) => p.skupina === "komunita");
  const skrytePolozky = polozky.filter((p) => skryte.includes(p.href));
  const znackaMenu = noveNovinky > 0 || dielna > 0 || navrhy > 0;
  const pocetNavrhov =
    navrhy > 0 ? (
      <span className="nav-pocet" aria-label={`${navrhy} na rozhodnutie`}>
        {navrhy} na rozhodnutie
      </span>
    ) : null;

  return (
    <div className="aplikacia">
      <header className="hlavicka" onClickCapture={strazOdchodu}>
        <div className={priStole ? "hlavicka-vnutro pri-stole" : "hlavicka-vnutro"}>
          <Odkaz href="/" className="logo" aria-label="NA EX! — domov" data-nazov="úvodnú stránku">
            <span className="logo-pohar" aria-hidden="true" />
            <span className="logo-text">NA EX!</span>
          </Odkaz>
          {!priStole && (
            <>
              <nav className="navigacia" ref={navRef} aria-label="Hlavné menu">
                {hra.map((n) => odkaz(n, "", true))}
                {komunita.length > 0 && <span className="nav-oddelovac" aria-hidden="true" />}
                {komunita.map((n) => odkaz(n, "", true))}
              </nav>
              <div className="nav-viac-obal" ref={viacRef}>
                <button
                  type="button"
                  ref={viacTlacidlo}
                  className={skrytePolozky.some((p) => jeAktivna(cesta, p.href)) ? "nav-viac aktivna" : "nav-viac"}
                  aria-haspopup="menu"
                  aria-expanded={otvoreneMenu === "viac"}
                  hidden={skryte.length === 0}
                  onClick={() => prepni("viac")}
                >
                  Viac
                  {skrytePolozky.some((p) => znacka(p.href) !== null) && <span className="nav-bodka" aria-label="nové" />}
                  <span className="sipka" aria-hidden="true">▾</span>
                </button>
                {otvoreneMenu === "viac" && skrytePolozky.length > 0 && (
                  <div className="ucet-menu menu-vlavo" role="menu">
                    {skrytePolozky.map((n) => odkaz(n, "", false))}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="hlavicka-prava" ref={pravaRef}>
            {/* Pri stole sem herná plocha cez portál dá štítok partie a menu Partia ▾. */}
            <div id="hlavicka-hra" className="hlavicka-hra" />
            {!priStole && rozohrana !== null && <PilulkaPartie partia={rozohrana} />}
            {!priStole && rozohrana === null && prihlaseny && (
              <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne tlacidlo-male len-mobil hrat-mobil">
                Hrať
              </Odkaz>
            )}
            {!priStole && sprava.length > 0 && (
              <div className="sprava-obal skryt-mobil" ref={spravaRef}>
                <button
                  type="button"
                  className={sprava.some((s) => jeAktivna(cesta, s.href)) ? "sprava-tlacidlo aktivna" : "sprava-tlacidlo"}
                  aria-haspopup="menu" aria-expanded={otvoreneMenu === "sprava"} onClick={() => prepni("sprava")}>
                  Správa
                  {navrhy > 0 && (
                    <span className="nav-znacka" aria-label={`${navrhy} na rozhodnutie`}>
                      {navrhy > 9 ? "9+" : navrhy}
                    </span>
                  )}
                  <span className="sipka" aria-hidden="true">▾</span>
                </button>
                {otvoreneMenu === "sprava" && (
                  <div className="ucet-menu" role="menu">
                    <div className="ucet-menu-hlava">
                      <strong>Správa</strong>
                      <span>{ja !== null ? NAZOV_UROVNE[ja.rola] : ""}</span>
                    </div>
                    {sprava.map((s) => (
                      <Odkaz key={s.href} href={s.href} role="menuitem" className={jeAktivna(cesta, s.href) ? "aktivna" : undefined}>
                        {s.text}
                        {s.pocet === "navrhy" && pocetNavrhov}
                      </Odkaz>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
                <button className="ucet-tlacidlo" onClick={() => prepni("ucet")} aria-haspopup="menu" aria-expanded={otvoreneMenu === "ucet"} aria-label={`Účet ${ja.meno}`}>
                  <Avatar meno={ja.meno} avatar={ja.avatar} velkost={34} />
                  <span className="ucet-meno">{ja.meno}</span>
                </button>
                {otvoreneMenu === "ucet" && (
                  <div className="ucet-menu" role="menu">
                    <div className="ucet-menu-hlava">
                      <strong>{ja.meno}</strong>
                      <span>@{ja.login} · {NAZOV_UROVNE[ja.rola]}</span>
                    </div>
                    {menuUctu(ja).map((m) => (
                      <Odkaz key={m.href} href={m.href} role="menuitem">
                        {m.text}
                      </Odkaz>
                    ))}
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
          {!priStole && (
            <button
              className={znackaMenu ? "hamburger ma-novinky" : "hamburger"}
              aria-label={noveNovinky > 0 ? "Menu (nové novinky)" : dielna > 0 ? "Menu (nové rozhodnutie v Dielni)" : navrhy > 0 ? "Menu (návrhy na rozhodnutie)" : "Menu"}
              aria-expanded={mobilne}
              onClick={() => setMobilne(!mobilne)}
            >
              <span />
              <span />
              <span />
            </button>
          )}
        </div>
        {/* Mobil: tie isté skupiny s nadpismi. */}
        {mobilne && !priStole && (
          <nav className="navigacia-mobil" aria-label="Menu">
            <div className="nav-skupina">Hra</div>
            {hra.map((n) => odkaz(n, "", false))}
            {komunita.length > 0 && <div className="nav-skupina">Vývoj a komunita</div>}
            {komunita.map((n) => odkaz(n, "", false))}
            {sprava.length > 0 && <div className="nav-skupina">Správa</div>}
            {sprava.map((s) => (
              <Odkaz key={s.href} href={s.href} className={jeAktivna(cesta, s.href) ? "aktivna" : undefined}>
                {s.text}
                {s.pocet === "navrhy" && pocetNavrhov}
              </Odkaz>
            ))}
          </nav>
        )}
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
      <main className={plna ? "obsah obsah-plna" : `obsah obsah-${sirka}`}>{children}</main>
      <footer className={plna ? "paticka paticka-skryta" : "paticka"}>
        <span>NA EX! — kartová hra pre dvoch · © Michal Calík</span>
        <span>Hra je fikcia a karikatúra. Alkohol, fajčenie a hazard škodia zdraviu.</span>
      </footer>
    </div>
  );
}
