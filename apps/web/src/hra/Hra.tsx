// Herná časť (/hra): lobby → čakáreň → partia. Len pre prihlásených.

import { useEffect, useState } from "react";
import type { DlzkaHry } from "@naex/core";
import { ALL_DLZKY, DLZKY_HRY, NAZOV_DLZKY, PREDVOLENA_DLZKA } from "@naex/core";
import { api, mediaUrl } from "../lib/api.ts";
import { useSada } from "../lib/sada.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { maPravo, useUcet } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { HudbaPartie } from "./Hudba.tsx";
import { useMelichar } from "./Melichar.tsx";
import { Momenty } from "./Momenty.tsx";
import { Soundboard } from "./Soundboard.tsx";
import { useHra } from "./useHra.ts";
import { useNepodporovaneZariadenie } from "./zariadenie.ts";
import "./hra.css";

interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null; readonly frajerina: number | null };
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
}

/** Popis dĺžky hry: „Stredná · 7 lokalít“. */
export function popisDlzky(d: DlzkaHry): string {
  return `${NAZOV_DLZKY[d]} · ${DLZKY_HRY[d]} lokalít`;
}

function Lobby({
  zaloz,
  pripoj,
  chyba,
}: {
  readonly zaloz: (verejna: boolean, dlzka: DlzkaHry, bot?: boolean) => void;
  readonly pripoj: (kod: string) => void;
  readonly chyba: string | null;
}) {
  const { ja } = useUcet();
  const { sada } = useSada();
  // Scorecardy sú na stole hneď po štarte — ich náhľady sa stiahnu už v lobby
  // (Michal 2026-10-22: pri prázdnej cache bol stôl 5 – 8 s tmavý).
  useEffect(() => {
    for (const b of sada?.bodovacie ?? []) {
      if (b.pozadie === null) continue;
      const img = new Image();
      img.fetchPriority = "low";
      img.src = mediaUrl(b.pozadie, true);
    }
  }, [sada]);
  const [kod, setKod] = useState("");
  const [hry, setHry] = useState<readonly OtvorenaHra[] | null>(null);
  const [dostupne, setDostupne] = useState<readonly DlzkaHry[]>([PREDVOLENA_DLZKA]);
  const [dlzka, setDlzka] = useState<DlzkaHry>(PREDVOLENA_DLZKA);
  // Uzávierka pred nasadením (Michal 2026-10-23): text oznamu zo servera, alebo null.
  const [uzavierka, setUzavierka] = useState<string | null>(null);
  const zavrete = uzavierka !== null;
  // Vypnuté tlačidlo pri uzávierke povie prečo; hlavné nesmie ostať zlaté, akoby išlo (UI inšpekcia).
  const preco = zavrete ? uzavierka : undefined;

  useEffect(() => {
    let zive = true;
    const nacitaj = () =>
      api
        .get<{ hry: OtvorenaHra[]; dlzky: DlzkaHry[]; uzavierka: string | null }>("/hry/otvorene")
        .then((r) => {
          if (!zive) return;
          setHry(r.hry);
          setDostupne(r.dlzky);
          setUzavierka(r.uzavierka);
        })
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
      {uzavierka !== null && <Hlaska druh="info">{uzavierka}</Hlaska>}
      {chyba !== null && chyba !== uzavierka && <Hlaska>{chyba}</Hlaska>}
      <div className="lobby">
        <section className="panel">
          <h2>Nová hra</h2>
          <p className="tlmene">Súkromná hra je len pre toho, komu pošleš kód. Verejná sa ukáže v zozname vpravo.</p>
          <div className="dlzka-hry" role="radiogroup" aria-label="Dĺžka hry">
            {ALL_DLZKY.map((d) => {
              const ide = dostupne.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={dlzka === d}
                  className={`dlzka-volba ${dlzka === d ? "aktivna" : ""}`}
                  disabled={!ide}
                  onClick={() => setDlzka(d)}
                  title={ide ? undefined : `Sada zatiaľ nemá ${DLZKY_HRY[d]} lokalít — pribudnú v tvorbe kariet.`}
                >
                  <strong>{NAZOV_DLZKY[d]}</strong>
                  <span>{DLZKY_HRY[d]} lokalít</span>
                </button>
              );
            })}
          </div>
          {maPravo(ja, "hrat_ludia") ? (
            <div className="riadok-tlacidiel">
              {maPravo(ja, "sukromne_miestnosti") && (
                <button className={zavrete ? undefined : "tlacidlo-hlavne"} onClick={() => zaloz(false, dlzka)} disabled={zavrete} title={preco}>
                  Súkromná hra s kódom
                </button>
              )}
              <button onClick={() => zaloz(true, dlzka)} disabled={zavrete} title={preco}>
                Verejná hra
              </button>
            </div>
          ) : (
            <p className="tlmene">Hrať proti ľuďom tvoj rank zatiaľ nesmie.</p>
          )}
          <h2 style={{ marginTop: 28 }}>Proti počítaču</h2>
          <p className="tlmene">
            Pri stole ťa čaká jeden z troch počítačových súperov — vyvážený Štamgast, rabiátor Rapavý Fero alebo vypočítavá Teta Gizka.
            Koho dostaneš, je náhoda. Hrajú podľa pravidiel, vidia len to, čo by videl hráč pri stole, a nevzdávajú sa. Partia začne
            hneď a do Frajeriny sa neráta.
          </p>
          <div className="riadok-tlacidiel">
            <button onClick={() => zaloz(false, dlzka, true)} disabled={!maPravo(ja, "hrat_bot") || zavrete} title={preco}>
              Hrať proti počítaču
            </button>
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
            <p className="tlmene">{zavrete ? "Práve nikto nečaká." : "Práve nikto nečaká. Založ verejnú hru — zobrazí sa tu ostatným."}</p>
          ) : (
            <ul className="otvorene-hry">
              {hry.map((h) => (
                <li key={h.kod}>
                  <Avatar meno={h.hostitel.meno} avatar={h.hostitel.avatar} velkost={36} />
                  <div>
                    <strong>{h.hostitel.meno}</strong>
                    {h.hostitel.frajerina !== null && <span className="frajerina-cislo" title="Frajerina"> {h.hostitel.frajerina}</span>}
                    <div className="tlmene">
                      {popisDlzky(h.dlzka)} · čaká {Math.max(1, Math.round((Date.now() - h.vytvorena) / 60000))} min
                    </div>
                  </div>
                  <button className="tlacidlo-hlavne tlacidlo-male" onClick={() => pripoj(h.kod)} disabled={zavrete} title={preco}>
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

/** Mobil a úzke okno: hra sa tu zatiaľ hrať nedá (Michal 2026-10-22), zvyšok webu áno. */
function NepodporovaneZariadenie({ dovod }: { readonly dovod: "dotyk" | "uzke" }) {
  return (
    <div className="formular-stred panel" style={{ textAlign: "center" }}>
      <h1>Tu sa NA EX! zatiaľ hrať nedá</h1>
      {dovod === "dotyk" ? (
        <p>
          Herný stôl potrebuje širokú obrazovku a myš. Otvor NA EX! na počítači alebo na tablete na šírku — rozohraná partia ťa tam
          počká.
        </p>
      ) : (
        <p>Okno je na herný stôl príliš úzke. Roztiahni ho aspoň na 900 px a hra sa ukáže — rozohraná partia ťa počká.</p>
      )}
      <p className="tlmene">Kým sa hra dostane aj na mobil, môžeš si tu čítať:</p>
      <div className="riadok-tlacidiel" style={{ justifyContent: "center" }}>
        <Odkaz href="/pravidla" className="tlacidlo tlacidlo-hlavne">
          Pravidlá
        </Odkaz>
        <Odkaz href="/karty" className="tlacidlo">
          Karty
        </Odkaz>
        <Odkaz href="/novinky" className="tlacidlo">
          Novinky
        </Odkaz>
        <Odkaz href="/profil" className="tlacidlo">
          Profil
        </Odkaz>
      </div>
    </div>
  );
}

export function Hra() {
  useTitulok("Hrať");
  const { ja, nacitane } = useUcet();
  const nepodporovane = useNepodporovaneZariadenie();
  // Na nepodporovanom zariadení sa ani nepripája — po roztiahnutí okna sa pripojí a vráti do partie.
  const hra = useHra(ja !== null && nepodporovane === null);

  // Majster Melichar komentuje len partie proti počítaču — ľudia si nadávajú sami.
  // Ozve sa pri pečiatke momentu (Momenty), nie po každom ťahu (Michal 2026-10-23).
  const { ozviMoment } = useMelichar(hra.view !== null && hra.hraci.some((h) => h?.bot === true));
  const cmd = hra.cmd;

  // Odkaz /hra?kod=ABCD rovno pripojí do miestnosti.
  const { pripojene, miestnost, pripoj } = hra;
  useEffect(() => {
    const kod = new URLSearchParams(location.search).get("kod");
    if (kod !== null && pripojene && miestnost === null) {
      pripoj(kod);
      // Kód z adresy preč, ostatné parametre (napr. ukážka pečiatky) ostanú.
      const zvysok = new URLSearchParams(location.search);
      zvysok.delete("kod");
      history.replaceState(null, "", zvysok.size > 0 ? `/hra?${zvysok}` : "/hra");
    }
  }, [pripojene, miestnost, pripoj]);

  if (nepodporovane !== null) return <NepodporovaneZariadenie dovod={nepodporovane} />;
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
        <p className="tlmene" style={{ margin: 0 }}>{popisDlzky(m.dlzka)}</p>
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
                {h.frajerina !== undefined && (
                  <span className="tlmene">
                    Frajerina <span className="frajerina-cislo">{h.frajerina}</span> · {h.titul}
                  </span>
                )}
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
    <>
    <HudbaPartie />
    <Momenty udalosti={hra.udalosti} ja={hra.view.ja} mena={hra.hraci.map((h, i) => h?.meno ?? `Hráč ${i + 1}`)} hovor={ozviMoment} />
    <HernaPlocha
      view={hra.view}
      data={hra.data}
      sada={m.sada}
      hraci={hra.hraci}
      log={hra.log}
      udalosti={hra.udalosti}
      chyba={hra.chyba}
      zrusChybu={hra.zrusChybu}
      superPripojeny={hra.superPripojeny}
      kod={m.code}
      cmd={cmd}
      opustit={hra.odid}
      frajerina={hra.frajerina}
      kontumacia={hra.kontumacia}
      vHlavicke={
        hra.view.koniec === null && maPravo(ja, "melichar_soundboard") && (
          <Soundboard
            ja={m.seat}
            menoSupera={hra.hraci[m.seat === 0 ? 1 : 0]?.meno ?? "Súper"}
            udalost={hra.melichar}
            pusti={hra.pustiMelichara}
          />
        )
      }
    />
    </>
  );
}
