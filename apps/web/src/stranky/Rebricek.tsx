// Rebríček hráčov podľa Frajeriny (/rebricek).

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { CisloFrajeriny, tvar } from "./Statistiky.tsx";
import "./statistiky.css";

interface RiadokRebricka {
  readonly poradie: number;
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly hodnota: number;
  readonly najvyssia: number;
  readonly partie: number;
  readonly vyhry: number;
  readonly prehry: number;
  readonly remizy: number;
  readonly titul: string;
  readonly provizorna: boolean;
}

/** Hodnosti podľa Frajeriny — rovnaké hranice ako na serveri (frajerina.ts). */
const HODNOSTI: readonly [number, string][] = [
  [2000, "Kráľ krčmy"],
  [1800, "Postrach dediny"],
  [1600, "Veľký frajer"],
  [1450, "Frajer"],
  [1300, "Štamgast"],
  [1100, "Návštevník"],
  [950, "Zelenáč"],
  [0, "Abstinent"],
];

export function Rebricek() {
  useTitulok("Rebríček");
  const { ja } = useUcet();
  const [hraci, setHraci] = useState<readonly RiadokRebricka[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ hraci: RiadokRebricka[] }>("/rebricek")
      .then((r) => setHraci(r.hraci))
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="rebricek">
      <header className="stranka-hlava">
        <h1>Rebríček</h1>
        <p className="tlmene">
          Poradie hráčov podľa <strong>Frajeriny</strong>. Funguje ako šachové Elo: za výhru nad rovnako silným súperom získaš asi 16 bodov a on ich
          toľko stratí. Keď porazíš oveľa slabšieho, pohnete sa obaja len o pár bodov. Keď slabší porazí favorita, získa skoro 30. Otáznik znamená
          provizórne hodnotenie — ustáli sa po piatich partiách.
        </p>
      </header>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {hraci === null && chyba === null && <Nacitavanie />}
      {hraci !== null && hraci.length === 0 && (
        <div className="panel" style={{ textAlign: "center" }}>
          <p>Rebríček je zatiaľ prázdny — nikto ešte nedohral partiu.</p>
          <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
            Buď prvý
          </Odkaz>
        </div>
      )}
      {hraci !== null && hraci.length > 0 && (
        <div className="panel tabulka-obal">
          <table className="tabulka-rebricka">
            <thead>
              <tr>
                <th className="cislo">#</th>
                <th>Hráč</th>
                <th className="cislo">Frajerina</th>
                <th className="cislo">Partie</th>
                <th className="cislo skryt-mobil">V – R – P</th>
                <th className="cislo skryt-mobil">Najvyššia</th>
              </tr>
            </thead>
            <tbody>
              {hraci.map((h) => (
                <tr key={h.id} className={h.id === ja?.id ? "ja" : undefined}>
                  <td className={`cislo poradie ${h.poradie <= 3 ? `medaila-${h.poradie}` : ""}`}>{h.poradie}</td>
                  <td>
                    <Odkaz href={`/hrac/${h.id}`} className="rebricek-hrac">
                      <Avatar meno={h.meno} avatar={h.avatar} velkost={34} />
                      <span>
                        <strong>{h.meno}</strong>
                        <span className="tlmene">{h.titul}</span>
                      </span>
                    </Odkaz>
                  </td>
                  <td className="cislo">
                    <CisloFrajeriny f={h} />
                  </td>
                  <td className="cislo">{h.partie}</td>
                  <td className="cislo skryt-mobil">
                    <span className="plus">{h.vyhry}</span> – {h.remizy} – <span className="minus">{h.prehry}</span>
                  </td>
                  <td className="cislo skryt-mobil tlmene">{h.najvyssia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="panel hodnosti">
        <h3>Hodnosti</h3>
        <ul>
          {HODNOSTI.map(([od, nazov]) => (
            <li key={nazov}>
              <strong>{nazov}</strong>
              <span className="tlmene">od {od}</span>
            </li>
          ))}
        </ul>
        <p className="tlmene" style={{ marginBottom: 0 }}>
          Každý začína na 1200. Vzdaná partia sa počíta ako prehra; ak súper odíde a 3 minúty sa nevráti, môžeš si vyžiadať kontumačnú výhru.
          {hraci !== null && hraci.length > 0 && ` V rebríčku je ${hraci.length} ${tvar(hraci.length, "hráč", "hráči", "hráčov")}.`}
        </p>
      </section>
    </div>
  );
}
