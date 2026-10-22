// Sekcia Playtest (Michal 2026-10-21): návrhy zlepšení z playtestov na
// rozhodnutie (admin a subadmin) a reporty playtestov — tie vidí aj rank
// s právom reporty_playtestov (Michal 2026-10-22).

import { Odkaz } from "../lib/router.tsx";
import { jeSpravca, useUcet } from "../lib/ucet.tsx";
import { Navrhy } from "./Navrhy.tsx";
import { Reporty } from "./Reporty.tsx";
import "./playtest.css";

export function Playtest({ cesta }: { readonly cesta: string }) {
  const casti = cesta.split("/").filter((c) => c !== "");
  const { ja } = useUcet();
  const spravca = ja !== null && jeSpravca(ja.rola);
  const reporty = casti[1] === "reporty" || !spravca;
  return (
    <div className="playtest-stranka">
      <header className="playtest-hlavicka">
        <h1>Playtest</h1>
        <nav className="cipy" aria-label="Playtest">
          {spravca && (
            <Odkaz href="/playtest" className={`cip ${reporty ? "" : "aktivny"}`}>
              Návrhy
            </Odkaz>
          )}
          <Odkaz href="/playtest/reporty" className={`cip ${reporty ? "aktivny" : ""}`}>
            Reporty
          </Odkaz>
        </nav>
      </header>
      {reporty ? <Reporty subor={casti[2] !== undefined ? decodeURIComponent(casti[2]) : null} /> : <Navrhy />}
    </div>
  );
}
