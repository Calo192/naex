// Smerovanie stránok. Verejné: domov, pravidlá, karty. Hra a profil pre
// prihlásených, tvorba kariet, playtesty a správa hráčov len pre admina a subadminov
// (overuje aj server).
// Vývoj hry (známky v čase a roadmapa) a Novinky sú verejné.

import type { ReactNode } from "react";
import { Layout } from "./Layout.tsx";
import { Nacitavanie } from "./komponenty.tsx";
import { Odkaz, useCesta } from "./lib/router.tsx";
import { jeSpravca, maPravo, useUcet } from "./lib/ucet.tsx";
import { Domov } from "./stranky/Domov.tsx";
import { Glosar } from "./stranky/Glosar.tsx";
import { Pravidla } from "./stranky/Pravidla.tsx";
import { Prihlasenie, Profil, Registracia } from "./stranky/Ucet.tsx";
import { Hra } from "./hra/Hra.tsx";
import { HracProfil } from "./stranky/profil/Profil.tsx";
import { DetailPartie } from "./stranky/profil/DetailPartie.tsx";
import { Prehravac } from "./hra/Prehravac.tsx";
import { Rebricek } from "./stranky/Rebricek.tsx";
import { SpatnaVazba } from "./stranky/SpatnaVazba.tsx";
import { Vyvoj } from "./stranky/Vyvoj.tsx";
import { Novinky } from "./stranky/Novinky.tsx";
import { Dielna } from "./dielna/Dielna.tsx";
import { Admin } from "./admin/Admin.tsx";
import { Hraci } from "./stranky/Hraci.tsx";
import { Playtest } from "./playtest/Playtest.tsx";

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

  // Reporty playtestov vidí aj rank s právom (Michal 2026-10-22); návrhy len správca (Playtest to rozlíši).
  if (cesta === "/playtest" || cesta.startsWith("/playtest/")) {
    return <Layout siroky>{chranene(<Playtest cesta={cesta} />, !maPravo(ja, "reporty_playtestov"))}</Layout>;
  }
  if (cesta.startsWith("/admin")) return <Layout siroky>{chranene(<Admin cesta={cesta} />, true)}</Layout>;
  if (cesta === "/hraci") return <Layout siroky>{chranene(<Hraci />, true)}</Layout>;
  if (cesta === "/hra") return <Layout siroky><Hra /></Layout>;
  if (cesta === "/pravidla") return <Layout siroky><Pravidla /></Layout>;
  // Vývoj hry a roadmapa sú verejné (Michal 2026-10-21); upravuje ich správca.
  if (cesta === "/vyvoj" || cesta.startsWith("/vyvoj/")) return <Layout siroky><Vyvoj cesta={cesta} /></Layout>;
  const hrac = /^\/hrac\/(\d+)$/.exec(cesta);
  if (hrac !== null) return <Layout siroky>{chranene(<HracProfil id={Number(hrac[1])} />)}</Layout>;
  const partia = /^\/partia\/(\d+)$/.exec(cesta);
  if (partia !== null) return <Layout siroky>{chranene(<DetailPartie id={Number(partia[1])} />)}</Layout>;
  const prehravac = /^\/partia\/(\d+)\/prehravac$/.exec(cesta);
  if (prehravac !== null) return <Layout siroky>{chranene(<Prehravac id={Number(prehravac[1])} />)}</Layout>;
  if (cesta === "/profil") return <Layout siroky>{chranene(<Profil />)}</Layout>;
  // Dielňa je záložka stránky Karty (Michal 2026-10-22); čítať smie každý.
  if (cesta === "/karty/dielna" || cesta.startsWith("/karty/dielna/")) return <Layout siroky><Dielna cesta={cesta} /></Layout>;

  const stranka: ReactNode =
    cesta === "/" ? <Domov />
    : cesta === "/karty" ? <Glosar />
    : cesta === "/novinky" ? <Novinky />
    : cesta === "/prihlasenie" ? <Prihlasenie />
    : cesta === "/registracia" ? <Registracia />
    : cesta === "/rebricek" ? chranene(<Rebricek />)
    : cesta === "/spatna-vazba" ? chranene(<SpatnaVazba />)
    : <Nenajdene />;
  return <Layout>{stranka}</Layout>;
}
