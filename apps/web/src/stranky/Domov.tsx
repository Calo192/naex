// Úvodná stránka — vejár kariet a rozcestník na tri časti webu.

import type { CSSProperties } from "react";
import { variant, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaPoldeci } from "../hra/Panely.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada, vzhladSady } from "../lib/sada.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { rozpracovana, useVyucbaUctu } from "../hra/Vyucba.tsx";

const VEJAR = ["pijan", "farar", "krcma"];

export function Domov() {
  useTitulok("");
  const { sada } = useSada();
  const { ja } = useUcet();
  const { vyucba } = useVyucbaUctu(ja !== null);
  const karty = sada === null ? [] : VEJAR.map((id) => sada.karty.find((k) => k.id === id)).filter((k) => k !== undefined);

  return (
    <>
      <section className="hero">
        <div>
          <h1>
            Bitka o dedinu.
            <br />
            <em>Na ex!</em>
          </h1>
          <p className="hero-text">
            Kompetitívna kartová hra pre dvoch v drsnom dedinskom prostredí. Stav partiu z kariet, ktoré sa
            dotýkajú stranami, bi sa o lokality, des starších — a nezabudni na vlastné dlhy.
          </p>
          <div className="riadok-tlacidiel">
            <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
              {ja === null ? "Prihlás sa a hraj" : "Hrať teraz"}
            </Odkaz>
            {/* Výučba pri stole (Michal 2026-10-23) — /hra?vyucba=1 ju rovno spustí. */}
            {vyucba !== null && vyucba.dostupna && (
              <Odkaz href="/hra?vyucba=1" className="tlacidlo" data-vyucba-vstup="titulka">
                {rozpracovana(vyucba) ? "Pokračovať vo výučbe" : "Prvá hra — nauč sa hrať"}
              </Odkaz>
            )}
            <Odkaz href="/pravidla" className="tlacidlo">
              Naučiť sa pravidlá
            </Odkaz>
          </div>
        </div>
        <div className="hero-vejar" aria-hidden="true">
          {sada !== null &&
            karty.map((k, i) => {
              const v = variant(variantyKarty(k), 0);
              if (v === null) return null;
              return (
                <div key={k.id} className="vejar-pozicia" style={{ "--i": i - 1 } as CSSProperties}>
                  <KartaLico karta={k} lava={v.lava} prava={v.prava} vzhlad={vzhladSady(sada)} sirka={250} bezPopisov />
                </div>
              );
            })}
        </div>
      </section>

      <section className="tri-casti">
        <Odkaz href="/pravidla" className="cast">
          <span className="cast-znak" aria-hidden="true">📖</span>
          <h2>Nauč sa hrať</h2>
          <p>Pravidlá krok za krokom, s interaktívnymi príkladmi spájania kariet a výpočtu bitky.</p>
        </Odkaz>
        <Odkaz href="/karty" className="cast">
          <span className="cast-znak" aria-hidden="true">🃏</span>
          <h2>Glosár kariet</h2>
          <p>Všetky karty hry. Prejdi myšou ponad akciu alebo pojem a uvidíš, čo robí.</p>
        </Odkaz>
        <Odkaz href="/hra" className="cast">
          <span className="cast-znak" aria-hidden="true">
            <IkonaPoldeci />
          </span>
          <h2>Hraj proti kamarátovi</h2>
          <p>Založ hru, pošli kód alebo si vyber súpera zo zoznamu otvorených hier.</p>
        </Odkaz>
      </section>
    </>
  );
}
