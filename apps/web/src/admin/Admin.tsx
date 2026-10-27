// Tvorba kariet (/admin/*) — webová verzia MAUI aplikácie KartyAI.
// Hráči sú od 2026-10-21 na samostatnej stránke /hraci; štatistiky a simulácia
// sú zatiaľ z webu preč (Michal 2026-10-21).

import { useEffect, type ReactNode } from "react";
import { Odkaz, chod } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { AdminProvider, problemyNavrhov, useAdmin, zmeneneOdZverejnenia } from "./stav.tsx";
import { Ikona, type NazovIkony } from "./spolocne.tsx";
import { Prehlad } from "./Prehlad.tsx";
import { Navrhy } from "./Navrhy.tsx";
import { Tvorca } from "./Tvorca.tsx";
import { Akcie } from "./Akcie.tsx";
import { KlucoveSlova } from "./KlucoveSlova.tsx";
import { Nastavenia } from "./Nastavenia.tsx";
import { Bodovacie } from "./Bodovacie.tsx";
import { Tlac } from "./Tlac.tsx";
import { ImportExport } from "./ImportExport.tsx";
import "./admin.css";

interface Sekcia {
  readonly href: string;
  readonly text: string;
  readonly ikona: NazovIkony;
}

const SKUPINY: readonly { readonly nazov: string; readonly sekcie: readonly Sekcia[] }[] = [
  {
    nazov: "Sada",
    sekcie: [
      { href: "/admin", text: "Prehľad a zverejnenie", ikona: "prehlad" },
      { href: "/admin/karty", text: "Karty", ikona: "karty" },
    ],
  },
  {
    nazov: "Vzhľad kariet",
    sekcie: [
      { href: "/admin/akcie", text: "Akcie a ikony", ikona: "akcie" },
      { href: "/admin/klucove-slova", text: "Kľúčové slová", ikona: "slova" },
      { href: "/admin/nastavenia", text: "Farby a rozmery", ikona: "farby" },
      { href: "/admin/bodovacie", text: "Bodovacie karty", ikona: "bodovacie" },
    ],
  },
  {
    nazov: "Výstup",
    sekcie: [
      { href: "/admin/tlac", text: "Tlač", ikona: "tlac" },
      { href: "/admin/import-export", text: "Import / export", ikona: "import" },
    ],
  },
];

/** Staré odkazy (playtesty → sekcia Playtest, hráči → /hraci, zrušené štatistiky a simulácia). */
function Presmeruj({ na }: { readonly na: string }) {
  useEffect(() => chod(na, true), [na]);
  return <Nacitavanie />;
}

function Obsah({ cesta }: { readonly cesta: string }) {
  const { obsah, chyba } = useAdmin();
  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (obsah === null) return <Nacitavanie />;
  const casti = cesta.split("/").filter((c) => c !== "");
  const sekcia = casti[1] ?? "";
  const stranky: Record<string, () => ReactNode> = {
    "": () => <Prehlad />,
    karty: () => (casti[2] !== undefined ? <Tvorca id={decodeURIComponent(casti[2])} /> : <Navrhy />),
    akcie: () => <Akcie />,
    "klucove-slova": () => <KlucoveSlova />,
    nastavenia: () => <Nastavenia />,
    bodovacie: () => <Bodovacie />,
    tlac: () => <Tlac />,
    "import-export": () => <ImportExport />,
    pouzivatelia: () => <Presmeruj na="/hraci" />,
    statistiky: () => <Presmeruj na="/admin" />,
    simulacia: () => <Presmeruj na="/admin" />,
    playtesty: () => <Presmeruj na={`/playtest/reporty${casti[2] !== undefined ? `/${casti[2]}` : ""}`} />,
  };
  return <>{(stranky[sekcia] ?? (() => <Hlaska>Neznáma sekcia.</Hlaska>))()}</>;
}

/** Počítadlo pri položke menu: počet kariet, neuverejnené zmeny, problémy. */
function Znacka({ href }: { readonly href: string }) {
  const { obsah, sady } = useAdmin();
  if (obsah === null) return null;
  if (href === "/admin") {
    const problemy = problemyNavrhov(obsah).length;
    if (problemy > 0) {
      return (
        <span className="admin-znacka zla" title={`${problemy} ${problemy === 1 ? "problém bráni" : "problémov bráni"} zverejneniu`}>
          {problemy}
        </span>
      );
    }
    const zmenene = zmeneneOdZverejnenia(obsah, sady).length;
    return zmenene > 0 ? (
      <span className="admin-znacka nova" title={`${zmenene} ${zmenene === 1 ? "karta upravená" : "kariet upravených"} od zverejnenia`}>
        {zmenene}
      </span>
    ) : null;
  }
  if (href === "/admin/karty") return <span className="admin-znacka">{obsah.karty.length}</span>;
  return null;
}

export function Admin({ cesta }: { readonly cesta: string }) {
  const aktivna = (href: string) => (href === "/admin" ? cesta === "/admin" : cesta.startsWith(href));
  return (
    <AdminProvider>
      <HlavaStranky nadpis="Tvorba kariet" uvod="Karty, akcie a vzhľad sady. Hra beží na zverejnenej sade." />
      <div className="admin">
        <nav className="admin-menu" aria-label="Tvorba kariet">
          {SKUPINY.map((g) => (
            <div key={g.nazov} className="admin-menu-skupina" role="group" aria-label={g.nazov}>
              <div className="admin-menu-nazov">{g.nazov}</div>
              {g.sekcie.map((s) => (
                <Odkaz
                  key={s.href}
                  href={s.href}
                  className={aktivna(s.href) ? "aktivna" : undefined}
                  aria-current={aktivna(s.href) ? "page" : undefined}
                >
                  <Ikona nazov={s.ikona} />
                  <span className="admin-menu-text">{s.text}</span>
                  <Znacka href={s.href} />
                </Odkaz>
              ))}
            </div>
          ))}
          <Odkaz href="/admin/karty/nova" className="admin-menu-nova">
            <Ikona nazov="plus" />
            Nová karta
          </Odkaz>
        </nav>
        <div className="admin-obsah">
          <Obsah cesta={cesta} />
        </div>
      </div>
    </AdminProvider>
  );
}
