// Herná časť (/hra): lobby → čakáreň → partia. Len pre prihlásených.

import { useCallback, useEffect, useState } from "react";
import type { DlzkaHry, NaladaMomentu } from "@naex/core";
import { ALL_DLZKY, DLZKY_HRY, NAZOV_DLZKY, PREDVOLENA_DLZKA } from "@naex/core";
import { api, mediaUrl } from "../lib/api.ts";
import { useSada } from "../lib/sada.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { maPravo, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { HudbaPartie } from "./Hudba.tsx";
import { useMelichar } from "./Melichar.tsx";
import { MelicharVBare } from "./MelicharBar.tsx";
import { Momenty } from "./Momenty.tsx";
import { NapovedaMelichara } from "./Napovedy.tsx";
import { Soundboard } from "./Soundboard.tsx";
import { useHra } from "./useHra.ts";
import { OznamZiskov } from "../achievementy/VPartii.tsx";
import { tvar } from "../stranky/Statistiky.tsx";
import { PonukaVyucby, useVyucbaUctu, VyucbaStol, VyucbaVLobby, type VyucbaUctu } from "./Vyucba.tsx";
import { useNepodporovaneZariadenie } from "./zariadenie.ts";
import "./hra.css";

interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null; readonly frajerina: number | null };
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
}

/** „3 lokality“, „5 lokalít“ — krátka hra má od 2026-10-24 len 3. */
const lokalit = (n: number): string => `${n} ${tvar(n, "lokalita", "lokality", "lokalít")}`;

/** Popis dĺžky hry: „Stredná · 5 lokalít“. */
export function popisDlzky(d: DlzkaHry): string {
  return `${NAZOV_DLZKY[d]} · ${lokalit(DLZKY_HRY[d])}`;
}

function Lobby({
  zaloz,
  pripoj,
  chyba,
  vyucba,
  zacniVyucbu,
}: {
  readonly zaloz: (verejna: boolean, dlzka: DlzkaHry, bot?: boolean) => void;
  readonly pripoj: (kod: string) => void;
  readonly chyba: string | null;
  readonly vyucba: VyucbaUctu | null;
  readonly zacniVyucbu: (odznova: boolean) => void;
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
      {vyucba !== null && vyucba.dostupna && !zavrete && <VyucbaVLobby vyucba={vyucba} zacni={zacniVyucbu} />}
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
                  title={ide ? undefined : `Sada zatiaľ nemá ${lokalit(DLZKY_HRY[d])} — pribudnú v tvorbe kariet.`}
                >
                  <strong>{NAZOV_DLZKY[d]}</strong>
                  <span>{lokalit(DLZKY_HRY[d])}</span>
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
            <button onClick={() => zaloz(false, dlzka, true)} disabled={!maPravo(ja, "hrat_bot") || zavrete} title={preco} data-hrat-bot="">
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
  const { ja, nacitane, nastav: nastavUcet } = useUcet();
  const nepodporovane = useNepodporovaneZariadenie();
  // Na nepodporovanom zariadení sa ani nepripája — po roztiahnutí okna sa pripojí a vráti do partie.
  const hra = useHra(ja !== null && nepodporovane === null);

  // Majster Melichar komentuje momenty len v partii proti počítaču — ľudia si nadávajú sami.
  // Ozve sa pri pečiatke momentu (Momenty), nie po každom ťahu (Michal 2026-10-23), a v každej
  // partii pri vzácnom achievemente (3★ alebo tajný). Vo výučbe hovorí v bubline — mlčí.
  const sBotom = hra.hraci.some((h) => h?.bot === true);
  const { ozviMoment, hovori: melicharHovori, umlcBublinu } = useMelichar(hra.view !== null && hra.vyucba === null);
  const hovorPriMomente = useCallback((nalada: NaladaMomentu) => (sBotom ? ozviMoment(nalada) : undefined), [sBotom, ozviMoment]);
  const posledny = hra.achievementy.zisky.at(-1);
  useEffect(() => {
    if (posledny?.vzacny === true) ozviMoment(posledny.tajny ? "udiv" : "pohoda");
    // Nová hviezda mohla zvýšiť rank (server ho prepočíta hneď) — účet sa načíta znova.
    // Výpadok spojenia účet neodhlási, preto nie obnov().
    if (hra.achievementy.n > 0)
      void api
        .get<{ pouzivatel: Pouzivatel | null }>("/ja")
        .then((r) => {
          if (r.pouzivatel !== null) nastavUcet(r.pouzivatel);
        })
        .catch(() => undefined);
    // Len pri novom zisku (n), nie pri prekreslení.
  }, [hra.achievementy.n]);
  const cmd = hra.cmd;
  // Kým beží Počítadlo bitky, pečiatka momentu z bitky čaká (dohoda Bugfixing × New features).
  const [pocitadloBezi, setPocitadloBezi] = useState(false);

  // Výučba „Prvá hra“: vstup v lobby, ponuka novému hráčovi a odkaz /hra?vyucba=1 z titulky.
  const { vyucba: vyucbaUctu, obnov: obnovVyucbu } = useVyucbaUctu(ja !== null);
  const [ponukaZavreta, setPonukaZavreta] = useState(false);
  const { zalozVyucbu, odid } = hra;
  const zacniVyucbu = useCallback(
    (odznova: boolean) => {
      setPonukaZavreta(true);
      if (!odznova) {
        zalozVyucbu();
        return;
      }
      void api
        .post("/vyucba/znova")
        .then(() => zalozVyucbu())
        .catch(() => zalozVyucbu());
    },
    [zalozVyucbu],
  );
  const preskocVyucbu = useCallback(() => {
    setPonukaZavreta(true);
    void api.post("/vyucba/preskocit").finally(obnovVyucbu);
  }, [obnovVyucbu]);
  const prerusVyucbu = useCallback(() => {
    odid();
    obnovVyucbu();
  }, [odid, obnovVyucbu]);

  // Odkaz /hra?kod=ABCD rovno pripojí do miestnosti.
  const { pripojene, miestnost, pripoj } = hra;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("vyucba") === null || !pripojene || miestnost !== null || vyucbaUctu === null) return;
    history.replaceState(null, "", "/hra");
    if (vyucbaUctu.dostupna) zacniVyucbu(vyucbaUctu.stav === "hotova");
  }, [pripojene, miestnost, vyucbaUctu, zacniVyucbu]);
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
  if (m === null) {
    return (
      <>
        <Lobby zaloz={hra.zaloz} pripoj={hra.pripoj} chyba={hra.chyba} vyucba={vyucbaUctu} zacniVyucbu={zacniVyucbu} />
        {vyucbaUctu?.ponuknut === true && !ponukaZavreta && <PonukaVyucby zacni={() => zacniVyucbu(false)} preskoc={preskocVyucbu} />}
      </>
    );
  }

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

  const krokVyucby = hra.vyucba?.krok ?? null;
  const zadrzBitku =
    krokVyucby !== null && (krokVyucby.kto === "bot" || krokVyucby.kto === "auto") && krokVyucby.melichar.trim() !== "" ? krokVyucby.id : null;

  return (
    <>
    <HudbaPartie />
    {/* Vo výučbe len na jej konci — achievement Prvá hra (Michal 2026-10-25). */}
    {(hra.vyucba === null || hra.vyucba.hotovo) && <OznamZiskov zisky={hra.achievementy.zisky} />}
    {hra.vyucba === null && (
      <Momenty udalosti={hra.udalosti} ja={hra.view.ja} mena={hra.hraci.map((h, i) => h?.meno ?? `Hráč ${i + 1}`)} hovor={hovorPriMomente} pocitadloBezi={pocitadloBezi} />
    )}
    {/* Nápovedy Melichara (Michal 2026-10-24): v každej partii, nie vo výučbe — tam hovorí scenár. */}
    {hra.vyucba === null && <NapovedaMelichara data={hra.data} view={hra.view} udalosti={hra.udalosti} pocitadloBezi={pocitadloBezi} sada={m.sada} />}
    {/* Hláška pri pečiatke momentu: kým znie, Melichar je v bare (Michal 2026-10-25). Text hlášky sa
        neukazuje (Michal 2026-10-22), len že hovorí. */}
    {melicharHovori && (
      <MelicharVBare
        rezim="cely"
        trieda="mel-hlaska"
        vpravo={
          <button type="button" className="tlacidlo-jemne" onClick={umlcBublinu}>
            zavrieť
          </button>
        }
      >
        <p className="mel-zvuk" aria-label="Majster Melichar hovorí">
          <span />
          <span />
          <span />
          <span />
          <span />
        </p>
      </MelicharVBare>
    )}
    <HernaPlocha
      onPocitadlo={setPocitadloBezi}
      view={hra.view}
      data={hra.data}
      sada={m.sada}
      hraci={hra.hraci}
      log={hra.log}
      udalosti={hra.udalosti}
      bezOknaKonca={hra.vyucba !== null}
      vyucba={hra.vyucba !== null}
      // Ťah bota či hry s textom Melichara čaká na „ďalej“ — bitka, ktorú spustil, sa prehrá až po ňom (U3).
      zadrzBitku={zadrzBitku}
      // Pri rozhodnutí (volba) je správnych viac kandidátov — potvrdiť sa nezamyká.
      vyucbaOcakava={hra.vyucba?.krok?.kto === "hrac" && hra.vyucba.krok.volba === null ? hra.vyucba.krok.ocakava : null}
      // Vo výučbe chybu ukazuje bublina Melichara.
      chyba={hra.vyucba !== null ? null : hra.chyba}
      zrusChybu={hra.zrusChybu}
      superPripojeny={hra.superPripojeny}
      kod={m.code}
      cmd={cmd}
      opustit={hra.odid}
      frajerina={hra.frajerina}
      achievementy={hra.suhrnAchievementov}
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
    {hra.vyucba !== null && (
      <VyucbaStol
        stav={hra.vyucba}
        dalej={hra.vyucbaDalej}
        chyba={hra.chyba}
        zrusChybu={hra.zrusChybu}
        prerusit={prerusVyucbu}
        hratProtiPocitacu={() => {
          prerusVyucbu();
          hra.zaloz(false, PREDVOLENA_DLZKA, true);
        }}
        menoBota={hra.hraci[1]?.meno ?? "Štamgast"}
        chybaVyucby={hra.chybaVyucby}
        odpovedz={hra.vyucbaOdpoved}
        rada={hra.radaVyucby}
        pocitadloBezi={pocitadloBezi}
        view={hra.view}
        udalosti={hra.udalosti}
        hraci={hra.hraci}
        sada={m.sada}
      />
    )}
    </>
  );
}
