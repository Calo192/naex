// Smerovanie stránok. Verejné: domov, pravidlá, karty. Hra a profil pre
// prihlásených, tvorba kariet len pre admina (overuje aj server).

import type { ReactNode } from "react";
import { Layout } from "./Layout.tsx";
import { Nacitavanie } from "./komponenty.tsx";
import { Odkaz, useCesta } from "./lib/router.tsx";
import { jeSpravca, useUcet } from "./lib/ucet.tsx";
import { Domov } from "./stranky/Domov.tsx";
import { Glosar } from "./stranky/Glosar.tsx";
import { Pravidla } from "./stranky/Pravidla.tsx";
import { Prihlasenie, Profil, Registracia } from "./stranky/Ucet.tsx";
import { Hra } from "./hra/Hra.tsx";
import { HracProfil } from "./stranky/Statistiky.tsx";
import { Rebricek } from "./stranky/Rebricek.tsx";
import { SpatnaVazba } from "./stranky/SpatnaVazba.tsx";
import { Admin } from "./admin/Admin.tsx";

function Neprihlaseny() {
  return (
    <div className="formular-stred panel" style={{ textAlign: "center" }}>
      <h1>Najprv sa prihlás</h1>
      <Odkaz href={`/prihlasenie?spat=${encodeURIComponent(location.pathname)}`} className="tlacidlo tlacidlo-hlavne">
        Prihlásiť sa
      </Odkaz>
    </div>
  );
}

function Nenajdene() {
  return (
    <div className="formular-stred" style={{ textAlign: "center" }}>
      <h1>Tu nič nie je</h1>
      <p className="tlmene">Táto stránka v dedine neexistuje.</p>
      <Odkaz href="/" className="tlacidlo">
        Domov
      </Odkaz>
    </div>
  );
}

export function App() {
  const cesta = useCesta();
  const { ja, nacitane } = useUcet();

  const chranene = (obsah: ReactNode, admin = false): ReactNode => {
    if (!nacitane) return <Nacitavanie />;
    if (ja === null) return <Neprihlaseny />;
    if (admin && !jeSpravca(ja.rola)) return <Nenajdene />;
    return obsah;
  };

  if (cesta.startsWith("/admin")) return <Layout siroky>{chranene(<Admin cesta={cesta} />, true)}</Layout>;
  if (cesta === "/hra") return <Layout siroky><Hra /></Layout>;
  if (cesta === "/pravidla") return <Layout siroky><Pravidla /></Layout>;
  const hrac = /^\/hrac\/(\d+)$/.exec(cesta);
  if (hrac !== null) return <Layout siroky>{chranene(<HracProfil id={Number(hrac[1])} />)}</Layout>;
  if (cesta === "/profil") return <Layout siroky>{chranene(<Profil />)}</Layout>;

  const stranka: ReactNode =
    cesta === "/" ? <Domov />
    : cesta === "/karty" ? <Glosar />
    : cesta === "/prihlasenie" ? <Prihlasenie />
    : cesta === "/registracia" ? <Registracia />
    : cesta === "/rebricek" ? chranene(<Rebricek />)
    : cesta === "/spatna-vazba" ? chranene(<SpatnaVazba />)
    : <Nenajdene />;
  return <Layout>{stranka}</Layout>;
}
