// Voľba hry „Zrejúca (pokusná verzia)“ na titulke a na stránke Hrať vo Vypálenej
// (Michal 2026-11-02) — len pre toho, komu server dal oprávnenie hrat_zrejucu. Keď Zrejúca
// nemá oproti Vypálenej nič nové, neprepne sa a hráč dostane len hlášku, nech hrá Vypálenú.

import { useEffect, useRef, useState } from "react";
import { Hlaska } from "./komponenty.tsx";
import { prepniInstanciu } from "./lib/instancia.ts";
import { ZAVES_ODCHODU } from "./lib/odchod.ts";
import { chod } from "./lib/router.tsx";
import { smieZrejucu, useUcet } from "./lib/ucet.tsx";

function BezZmien({ sprava, zavri }: { readonly sprava: string; readonly zavri: () => void }) {
  const tlacidlo = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    tlacidlo.current?.focus();
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") zavri();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [zavri]);
  return (
    <div className={ZAVES_ODCHODU} onClick={zavri}>
      <div className="odchod-dialog" role="alertdialog" aria-modal="true" aria-labelledby="zrejuca-bez-zmien" onClick={(e) => e.stopPropagation()}>
        <h2 id="zrejuca-bez-zmien">Zrejúca nemá nič nové</h2>
        <p>{sprava}</p>
        <div className="odchod-tlacidla">
          <button
            type="button"
            className="tlacidlo-hlavne"
            ref={tlacidlo}
            onClick={() => {
              zavri();
              chod("/hra");
            }}
          >
            Späť na Hrať
          </button>
        </div>
      </div>
    </div>
  );
}

export function VolbaZrejucej({ tvar }: { readonly tvar: "panel" | "tlacidlo" }) {
  const { ja, instancia } = useUcet();
  const [chyba, setChyba] = useState<string | null>(null);
  const [bezZmien, setBezZmien] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);
  if (!smieZrejucu(ja, instancia)) return null;

  const prepni = (): void => {
    setCaka(true);
    setChyba(null);
    prepniInstanciu("zrejuca").then(
      (sprava) => {
        // Pri prepnutí sa stránka načíta nanovo; ostávame len pri Zrejúcej bez zmien.
        if (sprava !== null) {
          setBezZmien(sprava);
          setCaka(false);
        }
      },
      (err: unknown) => {
        setChyba(err instanceof Error ? err.message : String(err));
        setCaka(false);
      },
    );
  };
  const tlacidlo = (
    <button type="button" className="tlacidlo zrejuca-tlacidlo" onClick={prepni} disabled={caka}>
      {caka ? "Prepínam…" : "Zrejúca (pokusná verzia)"}
    </button>
  );
  const dialog = bezZmien !== null && <BezZmien sprava={bezZmien} zavri={() => setBezZmien(null)} />;
  if (tvar === "tlacidlo") {
    return (
      <>
        {tlacidlo}
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        {dialog}
      </>
    );
  }
  return (
    <section className="panel zrejuca-volba">
      <div>
        <h2>
          Zrejúca <span className="zrejuca-znacka">pokusná verzia</span>
        </h2>
        <p className="tlmene">
          Pravidlá a karty, ktoré sa ešte skúšajú. Partie sa rátajú do štatistík Zrejúcej, nie Vypálenej; späť sa prepneš v páse hore.
        </p>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      </div>
      {tlacidlo}
      {dialog}
    </section>
  );
}
