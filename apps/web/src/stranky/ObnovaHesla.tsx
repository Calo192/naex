// Obnova zabudnutého hesla (Michal 2026-11-01): žiadosť e-mailom z profilu
// a nové heslo z odkazu. Odpoveď na žiadosť je vždy rovnaká — server neprezradí,
// či účet s e-mailom existuje.

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie, Pole } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";

export function ZabudnuteHeslo() {
  useTitulok("Zabudnuté heslo");
  const [email, setEmail] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [odoslane, setOdoslane] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);

  const odosli = async (e: FormEvent) => {
    e.preventDefault();
    setCaka(true);
    setChyba(null);
    try {
      const r = await api.post<{ sprava: string }>("/obnova-hesla", { email });
      setOdoslane(r.sprava);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <>
      <HlavaStranky nadpis="Zabudnuté heslo" uvod="Pošleme ti odkaz, cez ktorý si nastavíš nové heslo." />
      <div className="formular-stred">
        {odoslane !== null ? (
          <div className="panel">
            <Hlaska druh="ok">{odoslane}</Hlaska>
            <p className="tlmene">Odkaz platí 1 hodinu a dá sa použiť len raz. Nič neprišlo? Pozri aj nevyžiadanú poštu.</p>
          </div>
        ) : (
          <form className="panel" onSubmit={(e) => void odosli(e)}>
            {chyba !== null && <Hlaska>{chyba}</Hlaska>}
            <Pole label="E-mail" pomoc="Ten, ktorý máš uložený v profile. Bez e-mailu v profile sa heslo obnoviť nedá.">
              <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required autoFocus />
            </Pole>
            <button type="submit" className="tlacidlo-hlavne" disabled={caka}>
              {caka ? "Posielam…" : "Poslať odkaz"}
            </button>
          </form>
        )}
        <p className="formular-paticka">
          Spomenul si si? <Odkaz href="/prihlasenie">Prihlás sa</Odkaz>
        </p>
      </div>
    </>
  );
}

export function NoveHeslo() {
  useTitulok("Nové heslo");
  const { nastav } = useUcet();
  const [token] = useState(() => new URLSearchParams(location.search).get("t") ?? "");
  const [platny, setPlatny] = useState<boolean | null>(null);
  const [heslo, setHeslo] = useState("");
  const [heslo2, setHeslo2] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);

  // Neplatný odkaz povieme hneď, nie až po vyplnení hesla.
  useEffect(() => {
    if (token === "") {
      setPlatny(false);
      return;
    }
    api
      .post<{ platny: boolean }>("/obnova-hesla/over", { token })
      .then((r) => setPlatny(r.platny))
      .catch((err: unknown) => setChyba(err instanceof Error ? err.message : String(err)));
  }, [token]);

  const odosli = async (e: FormEvent) => {
    e.preventDefault();
    if (heslo !== heslo2) {
      setChyba("Heslá sa nezhodujú.");
      return;
    }
    setCaka(true);
    setChyba(null);
    try {
      const r = await api.post<{ pouzivatel: Pouzivatel }>("/obnova-hesla/nove", { token, heslo });
      nastav(r.pouzivatel);
      chod("/profil?obnovene=1", true);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <>
      <HlavaStranky nadpis="Nové heslo" uvod="Zvoľ si nové heslo. Na všetkých zariadeniach ťa potom odhlásime a tu prihlásime." />
      <div className="formular-stred">
        {platny === null && chyba === null ? (
          <Nacitavanie />
        ) : platny === false ? (
          <div className="panel">
            <Hlaska>Odkaz na obnovu hesla je neplatný alebo už vypršal. Platí 1 hodinu a dá sa použiť len raz.</Hlaska>
            <Odkaz href="/zabudnute-heslo" className="tlacidlo tlacidlo-hlavne">
              Poslať nový odkaz
            </Odkaz>
          </div>
        ) : (
          <form className="panel" onSubmit={(e) => void odosli(e)}>
            {chyba !== null && <Hlaska>{chyba}</Hlaska>}
            <Pole label="Nové heslo" pomoc="Aspoň 8 znakov.">
              <input type="password" autoComplete="new-password" value={heslo} onChange={(e) => setHeslo(e.target.value)} minLength={8} required autoFocus />
            </Pole>
            <Pole label="Nové heslo znova">
              <input type="password" autoComplete="new-password" value={heslo2} onChange={(e) => setHeslo2(e.target.value)} minLength={8} required />
            </Pole>
            <button type="submit" className="tlacidlo-hlavne" disabled={caka || platny !== true}>
              {caka ? "Ukladám…" : "Nastaviť heslo a prihlásiť"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
