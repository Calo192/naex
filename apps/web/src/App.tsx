// Smerovanie stránok. Verejné: domov, pravidlá, karty. Hra a profil pre
// prihlásených, tvorba kariet, playtesty a správa hráčov len pre admina a subadminov
// (overuje aj server).
// Vývoj hry (známky v čase a roadmapa) a Novinky sú verejné.

import { lazy, Suspense, type ReactNode } from "react";
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
import { UkazkaAchievementov } from "./achievementy/Ukazka.tsx";
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

// Ukážka rekapitulácie hrá partiu botov v prehliadači — bot nepatrí do hlavného balíka.
const UkazkaRekapitulacie = lazy(() => import("./hra/UkazkaRekapitulacie.tsx").then((m) => ({ default: m.UkazkaRekapitulacie })));
const UkazkaStola = lazy(() => import("./hra/UkazkaStola.tsx").then((m) => ({ default: m.UkazkaStola })));

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
    return <Layout>{chranene(<Playtest cesta={cesta} />, !maPravo(ja, "reporty_playtestov"))}</Layout>;
  }
  // Všetky stránky mimo hry sú v jednej kostre na stred, aj Tvorba a Vývoj (Michal 2026-10-26);
  // celú šírku má len herný stôl.
  if (cesta.startsWith("/admin")) return <Layout>{chranene(<Admin cesta={cesta} />, true)}</Layout>;
  if (cesta === "/hraci") return <Layout>{chranene(<Hraci />, true)}</Layout>;
  if (cesta === "/hra") return <Layout><Hra /></Layout>;
  if (cesta === "/pravidla") return <Layout><Pravidla /></Layout>;
  // Vývoj hry a roadmapa sú verejné (Michal 2026-10-21); upravuje ich správca.
  if (cesta === "/vyvoj" || cesta.startsWith("/vyvoj/")) return <Layout><Vyvoj cesta={cesta} /></Layout>;
  const hrac = /^\/hrac\/(\d+)$/.exec(cesta);
  if (hrac !== null) return <Layout>{chranene(<HracProfil id={Number(hrac[1])} />)}</Layout>;
  const partia = /^\/partia\/(\d+)$/.exec(cesta);
  if (partia !== null) return <Layout>{chranene(<DetailPartie id={Number(partia[1])} />)}</Layout>;
  const prehravac = /^\/partia\/(\d+)\/prehravac$/.exec(cesta);
  if (prehravac !== null) return <Layout stol>{chranene(<Prehravac id={Number(prehravac[1])} />)}</Layout>;
  if (cesta === "/profil") return <Layout>{chranene(<Profil />)}</Layout>;
  // Ukážka UI achievementov na snímky a inšpekciu, kým nie je napojené API (len správca).
  if (cesta === "/achievementy/ukazka") return <Layout>{chranene(<UkazkaAchievementov />, true)}</Layout>;
  // Rekapitulácia bitky a Pitky na skutočnej partii botov — snímky a inšpekcia bez živej partie.
  if (cesta === "/hra/ukazka-rekapitulacie") return <Layout>{chranene(<Suspense fallback={<Nacitavanie />}><UkazkaRekapitulacie /></Suspense>, true)}</Layout>;
  // Herný stôl v zvolenom okamihu partie botov (finále, bitka, koniec) — snímky bez živej partie.
  if (cesta === "/hra/ukazka-stola") return <Layout stol>{chranene(<Suspense fallback={<Nacitavanie />}><UkazkaStola /></Suspense>, true)}</Layout>;
  // Dielňa je záložka stránky Karty (Michal 2026-10-22); čítať smie každý.
  if (cesta === "/karty/dielna" || cesta.startsWith("/karty/dielna/")) return <Layout><Dielna cesta={cesta} /></Layout>;

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
