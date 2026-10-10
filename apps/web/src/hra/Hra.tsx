// Herná časť (/hra): lobby → čakáreň → partia. Len pre prihlásených.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { useHra } from "./useHra.ts";
import "./hra.css";

interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null };
  readonly vytvorena: number;
}

function Lobby({ zaloz, pripoj, chyba }: { readonly zaloz: (verejna: boolean) => void; readonly pripoj: (kod: string) => void; readonly chyba: string | null }) {
  const [kod, setKod] = useState("");
  const [hry, setHry] = useState<readonly OtvorenaHra[] | null>(null);

  useEffect(() => {
    let zive = true;
    const nacitaj = () =>
      api
        .get<{ hry: OtvorenaHra[] }>("/hry/otvorene")
        .then((r) => zive && setHry(r.hry))
        .catch(() => zive && setHry([]));
    void nacitaj();
    const t = setInterval(() => void nacitaj(), 4000);
    return () => {
      zive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <header className="stranka-hlava">
        <h1>Hrať</h1>
        <p className="tlmene">Založ hru a pošli kamarátovi kód, alebo sa pridaj k niekomu, kto čaká na súpera.</p>
      </header>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="lobby">
        <section className="panel">
          <h2>Nová hra</h2>
          <p className="tlmene">Súkromná hra je len pre toho, komu pošleš kód. Verejná sa ukáže v zozname vpravo.</p>
          <div className="riadok-tlacidiel">
            <button className="tlacidlo-hlavne" onClick={() => zaloz(false)}>
              Súkromná hra s kódom
            </button>
            <button onClick={() => zaloz(true)}>Verejná hra</button>
          </div>
          <h2 style={{ marginTop: 28 }}>Mám kód</h2>
          <form
            className="lobby-kod"
            onSubmit={(e) => {
              e.preventDefault();
              if (kod.length === 4) pripoj(kod);
            }}
          >
            <input value={kod} onChange={(e) => setKod(e.target.value.toUpperCase().slice(0, 4))} placeholder="KÓD" aria-label="Kód miestnosti" />
            <button type="submit" disabled={kod.length !== 4}>
              Pripojiť sa
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Čakajú na súpera</h2>
          {hry === null ? (
            <Nacitavanie />
          ) : hry.length === 0 ? (
            <p className="tlmene">Práve nikto nečaká. Založ verejnú hru — zobrazí sa tu ostatným.</p>
          ) : (
            <ul className="otvorene-hry">
              {hry.map((h) => (
                <li key={h.kod}>
                  <Avatar meno={h.hostitel.meno} avatar={h.hostitel.avatar} velkost={36} />
                  <div>
                    <strong>{h.hostitel.meno}</strong>
                    <div className="tlmene">čaká {Math.max(1, Math.round((Date.now() - h.vytvorena) / 60000))} min</div>
                  </div>
                  <button className="tlacidlo-hlavne tlacidlo-male" onClick={() => pripoj(h.kod)}>
                    Hrať
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function Hra() {
  useTitulok("Hrať");
  const { ja, nacitane } = useUcet();
  const hra = useHra(ja !== null);

  // Odkaz /hra?kod=ABCD rovno pripojí do miestnosti.
  const { pripojene, miestnost, pripoj } = hra;
  useEffect(() => {
    const kod = new URLSearchParams(location.search).get("kod");
    if (kod !== null && pripojene && miestnost === null) {
      pripoj(kod);
      history.replaceState(null, "", "/hra");
    }
  }, [pripojene, miestnost, pripoj]);

  if (!nacitane) return <Nacitavanie />;
  if (ja === null) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>Hrať môžu prihlásení</h1>
        <p className="tlmene">Súper ťa uvidí pod tvojím herným menom a s fotkou z profilu.</p>
        <div className="riadok-tlacidiel" style={{ justifyContent: "center" }}>
          <Odkaz href="/prihlasenie?spat=/hra" className="tlacidlo tlacidlo-hlavne">
            Prihlásiť sa
          </Odkaz>
          <Odkaz href="/registracia?spat=/hra" className="tlacidlo">
            Vytvoriť účet
          </Odkaz>
        </div>
      </div>
    );
  }
  if (!hra.pripojene && hra.miestnost === null) return <Nacitavanie text="Pripájam sa na server…" />;

  const m = hra.miestnost;
  if (m === null) return <Lobby zaloz={hra.zaloz} pripoj={hra.pripoj} chyba={hra.chyba} />;

  if (hra.view === null || hra.data === null) {
    const [h0, h1] = hra.hraci;
    return (
      <div className="cakaren panel">
        <h1>Čaká sa na súpera</h1>
        {m.verejna ? (
          <p className="tlmene">Hra je verejná — ktokoľvek sa môže pridať zo zoznamu. Alebo pošli kód:</p>
        ) : (
          <p className="tlmene">Pošli súperovi tento kód. Hra začne, keď sa pripojí.</p>
        )}
        <div className="cakaren-kod">{m.code}</div>
        <button
          className="tlacidlo-male"
          onClick={() => void navigator.clipboard?.writeText(`${location.origin}/hra?kod=${m.code}`)}
        >
          Skopírovať odkaz
        </button>
        <div className="cakaren-hraci">
          {[h0, h1].map((h, i) =>
            h === null ? (
              <div key={i} className="cakaren-hrac">
                <span className="cakaren-prazdny">?</span>
                <span className="tlmene">čaká sa…</span>
              </div>
            ) : (
              <div key={i} className="cakaren-hrac">
                <Avatar meno={h.meno} avatar={h.avatar} velkost={72} />
                <strong>{h.meno}</strong>
              </div>
            ),
          )}
        </div>
        {hra.chyba !== null && <Hlaska>{hra.chyba}</Hlaska>}
        <button className="tlacidlo-jemne" onClick={hra.odid}>
          Zrušiť
        </button>
      </div>
    );
  }

  return (
    <HernaPlocha
      view={hra.view}
      data={hra.data}
      sada={m.sada}
      hraci={hra.hraci}
      log={hra.log}
      chyba={hra.chyba}
      superPripojeny={hra.superPripojeny}
      kod={m.code}
      cmd={hra.cmd}
      opustit={hra.odid}
    />
  );
}
