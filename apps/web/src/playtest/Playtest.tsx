// Sekcia Playtest (Michal 2026-10-21) — len admin a subadmin: návrhy zlepšení
// z playtestov na rozhodnutie a reporty playtestov (predtým Tvorba → Playtesty).

import { Odkaz } from "../lib/router.tsx";
import { Navrhy } from "./Navrhy.tsx";
import { Reporty } from "./Reporty.tsx";
import "./playtest.css";

export function Playtest({ cesta }: { readonly cesta: string }) {
  const casti = cesta.split("/").filter((c) => c !== "");
  const reporty = casti[1] === "reporty";
  return (
    <div className="playtest-stranka">
      <header className="playtest-hlavicka">
        <h1>Playtest</h1>
        <nav className="cipy" aria-label="Playtest">
          <Odkaz href="/playtest" className={`cip ${reporty ? "" : "aktivny"}`}>
            Návrhy
          </Odkaz>
          <Odkaz href="/playtest/reporty" className={`cip ${reporty ? "aktivny" : ""}`}>
            Reporty
          </Odkaz>
        </nav>
      </header>
      {reporty ? <Reporty subor={casti[2] !== undefined ? decodeURIComponent(casti[2]) : null} /> : <Navrhy />}
    </div>
  );
}
