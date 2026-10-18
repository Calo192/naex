// Administrácia (/admin/*) — webová verzia MAUI aplikácie KartyAI.

import type { ReactNode } from "react";
import { Odkaz } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { AdminProvider, useAdmin } from "./stav.tsx";
import { Prehlad } from "./Prehlad.tsx";
import { Navrhy } from "./Navrhy.tsx";
import { Tvorca } from "./Tvorca.tsx";
import { Akcie } from "./Akcie.tsx";
import { KlucoveSlova } from "./KlucoveSlova.tsx";
import { Nastavenia } from "./Nastavenia.tsx";
import { Statistiky } from "./Statistiky.tsx";
import { Simulacia } from "./Simulacia.tsx";
import { Bodovacie } from "./Bodovacie.tsx";
import { Tlac } from "./Tlac.tsx";
import { ImportExport } from "./ImportExport.tsx";
import { Pouzivatelia } from "./Pouzivatelia.tsx";
import { Playtesty } from "./Playtesty.tsx";
import "./admin.css";

const SEKCIE: readonly { readonly href: string; readonly text: string; readonly znak: string }[] = [
  { href: "/admin", text: "Prehľad a zverejnenie", znak: "◎" },
  { href: "/admin/karty", text: "Karty", znak: "🃏" },
  { href: "/admin/akcie", text: "Akcie a ikony", znak: "✦" },
  { href: "/admin/klucove-slova", text: "Kľúčové slová", znak: "¶" },
  { href: "/admin/nastavenia", text: "Farby a nastavenia", znak: "◐" },
  { href: "/admin/statistiky", text: "Štatistiky", znak: "▤" },
  { href: "/admin/simulacia", text: "Simulácia", znak: "⇄" },
  { href: "/admin/bodovacie", text: "Bodovacie karty", znak: "◫" },
  { href: "/admin/tlac", text: "Tlač", znak: "⎙" },
  { href: "/admin/import-export", text: "Import / export", znak: "⇅" },
  { href: "/admin/pouzivatelia", text: "Hráči", znak: "☺" },
  { href: "/admin/playtesty", text: "Playtesty", znak: "⚑" },
];

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
    statistiky: () => <Statistiky />,
    simulacia: () => <Simulacia />,
    bodovacie: () => <Bodovacie />,
    tlac: () => <Tlac />,
    "import-export": () => <ImportExport />,
    pouzivatelia: () => <Pouzivatelia />,
    playtesty: () => <Playtesty subor={casti[2] !== undefined ? decodeURIComponent(casti[2]) : null} />,
  };
  return <>{(stranky[sekcia] ?? (() => <Hlaska>Neznáma sekcia.</Hlaska>))()}</>;
}

export function Admin({ cesta }: { readonly cesta: string }) {
  const aktivna = (href: string) => (href === "/admin" ? cesta === "/admin" : cesta.startsWith(href));
  return (
    <AdminProvider>
      <div className="admin">
        <nav className="admin-menu" aria-label="Tvorba kariet">
          <div className="admin-menu-titul">Tvorba kariet</div>
          {SEKCIE.map((s) => (
            <Odkaz key={s.href} href={s.href} className={aktivna(s.href) ? "aktivna" : undefined}>
              <span className="admin-znak" aria-hidden="true">
                {s.znak}
              </span>
              {s.text}
            </Odkaz>
          ))}
        </nav>
        <div className="admin-obsah">
          <Obsah cesta={cesta} />
        </div>
      </div>
    </AdminProvider>
  );
}
