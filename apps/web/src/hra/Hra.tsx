// Herná časť (/hra): lobby → čakáreň → partia. Len pre prihlásených.

import { VolbaZrejucej } from "../VolbaZrejucej.tsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DlzkaHry, NaladaMomentu } from "@naex/core";
import { ALL_DLZKY, DLZKY_HRY, NAZOV_DLZKY, PREDVOLENA_DLZKA, opponentOf } from "@naex/core";
import { api, mediaUrl } from "../lib/api.ts";
import { vzhladKarty } from "./HernaKarta.tsx";
import { useSada } from "../lib/sada.tsx";
import { chod, Odkaz, useTitulok } from "../lib/router.tsx";
import { sNavratom } from "../lib/navrat.ts";
import { jeSpravca, maPravo, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { HudbaPartie } from "./Hudba.tsx";
import { useMelichar } from "./Melichar.tsx";
import { MelicharVBare } from "./MelicharBar.tsx";
import { Momenty } from "./Momenty.tsx";
import { NapovedaMelichara } from "./Napovedy.tsx";
import { Soundboard } from "./Soundboard.tsx";
import { useHra } from "./useHra.ts";
import { OznamZiskov } from "../achievementy/VPartii.tsx";
import { tvar } from "../lib/jazyk.ts";
import { bezPrvejCasti, rozpracovana, ukazStarsichVoVyucbe, useVyucbaUctu, VyucbaStol, type VyucbaUctu } from "./Vyucba.tsx";
import { PonukaVyucby, VyucbaVLobby } from "./VstupyVyucby.tsx";
import { smieTelefon, useNepodporovaneZariadenie, useStolNaSirku, type DovodNepodporovania } from "./zariadenie.ts";
import { OtocTelefon } from "./OtocTelefon.tsx";
import { VyzvaCelejObrazovky, useVyzvaTelefonu } from "./CelaObrazovka.tsx";
import { UpozornenieTelefonu, upozornenieSkryte } from "./UpozornenieTelefonu.tsx";
import { popisZamku, smieLigu, volitelnaLiga, zvolenaLiga, type StavLigy } from "./ligy.ts";
import type { BotNaVyber } from "./boti.ts";
import { VyberBota } from "./VyberBota.tsx";
import { Cakaren2na2, Lobby2na2, Panel2na2 } from "./Stol2na2.tsx";
import { PortretyStarsich, RadNaPlsti, RadStarsich, RadyNaStole, RozhodnutiePata, RukaSupera, useRadyNaStole } from "./Pata.tsx";
import "./hra.css";

interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null; readonly frajerina: number | null };
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
}

/** „3 lokality“, „5 lokalít“ — Tretia liga má od 2026-10-24 len 3. */
const lokalit = (n: number): string => `${n} ${tvar(n, "lokalita", "lokality", "lokalít")}`;

/** Zámok zamknutej ligy (Michal 2026-10-28). */
function IkonaZamku() {
  return (
    <svg className="liga-zamok" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Popis ligy: „Druhá liga · 5 lokalít“. */
export function popisDlzky(d: DlzkaHry): string {
  return `${NAZOV_DLZKY[d]} · ${lokalit(DLZKY_HRY[d])}`;
}

function Lobby({
  zaloz,
  pripoj,
  chyba,
  vyucba,
  zacniVyucbu,
  vyucbaNaPocitaci,
}: {
  readonly zaloz: (verejna: boolean, dlzka: DlzkaHry, bot?: boolean, povaha?: string) => void;
  readonly pripoj: (kod: string) => void;
  readonly chyba: string | null;
  readonly vyucba: VyucbaUctu | null;
  readonly zacniVyucbu: (odznova: boolean) => void;
  /** Telefón: výučba tu nie je odladená — namiesto vstupu len oznam, že patrí na počítač. */
  readonly vyucbaNaPocitaci: boolean;
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
  // Ligy, ktoré hráč smie (Michal 2026-10-28); null = ešte nedošli.
  const [ligy, setLigy] = useState<readonly StavLigy[] | null>(null);
  const [ligyAjProtiPocitacu, setLigyAjProtiPocitacu] = useState(false);
  // Súper proti počítaču: zoznam od servera; okno s výberom sa otvorí po voľbe hry proti počítaču.
  const [boti, setBoti] = useState<readonly BotNaVyber[]>([]);
  const [vyberBotaOtvoreny, setVyberBotaOtvoreny] = useState(false);
  // Kým hráč ligu sám nezvolí, predvolí sa taká, ktorú smie aj proti ľuďom — inak by mal
  // nováčik (zamknutá Druhá liga, voľná na počítač) založenie hry s ľuďmi hneď vypnuté.
  const ligaOdHraca = useRef(false);
  const zamokZvolenej = popisZamku(ligy, dlzka);
  // Uzávierka pred nasadením (Michal 2026-10-23): text oznamu zo servera, alebo null.
  const [uzavierka, setUzavierka] = useState<string | null>(null);
  const zavrete = uzavierka !== null;
  // Vypnuté tlačidlo pri uzávierke povie prečo; hlavné nesmie ostať zlaté, akoby išlo (UI inšpekcia).
  const preco = zavrete ? uzavierka : undefined;
  // Nováčikovi bez 1. časti je hlavnou výzvou výučba (#104) — založenie hry je druhoradé.
  const hlavneZalozenie = !zavrete && !(vyucba !== null && !vyucbaNaPocitaci && bezPrvejCasti(true, vyucba));

  useEffect(() => {
    let zive = true;
    const nacitaj = () =>
      api
        .get<{ hry: OtvorenaHra[]; dlzky: DlzkaHry[]; ligy?: StavLigy[]; ligyAjProtiPocitacu?: boolean; boti?: BotNaVyber[]; uzavierka: string | null }>("/hry/otvorene")
        .then((r) => {
          if (!zive) return;
          setHry(r.hry);
          setDostupne(r.dlzky);
          setLigy(r.ligy ?? null);
          setLigyAjProtiPocitacu(r.ligyAjProtiPocitacu ?? false);
          setBoti(r.boti ?? []);
          // Zamknutá voľba (nový hráč a predvolená Druhá liga) sa prepne na najvyššiu, ktorú smie.
          setDlzka((d) => zvolenaLiga(r.ligy ?? null, ligaOdHraca.current ? (r.ligyAjProtiPocitacu ?? false) : true, r.dlzky, d));
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
      <HlavaStranky nadpis="Hrať" uvod="Založ hru a pošli kamarátovi kód, alebo sa pridaj k niekomu, kto čaká na súpera." />
      <VolbaZrejucej tvar="panel" />
      {uzavierka !== null && <Hlaska druh="info">{uzavierka}</Hlaska>}
      {chyba !== null && chyba !== uzavierka && <Hlaska>{chyba}</Hlaska>}
      {vyucba !== null && vyucba.dostupna && !zavrete && !vyucbaNaPocitaci && <VyucbaVLobby vyucba={vyucba} zacni={zacniVyucbu} />}
      {vyucba !== null && vyucba.dostupna && vyucbaNaPocitaci && (
        <Hlaska druh="info">Výučbu Prvá hra si zahraj na počítači — na telefóne zatiaľ nie je odladená.</Hlaska>
      )}
      <div className="lobby">
        <section className="panel">
          <h2>Nová hra</h2>
          <p className="tlmene">Súkromná hra je len pre toho, komu pošleš kód. Verejná sa ukáže v zozname vpravo.</p>
          <div className="dlzka-hry" role="radiogroup" aria-label="Liga">
            {ALL_DLZKY.map((d) => {
              const ide = dostupne.includes(d);
              const zamok = popisZamku(ligy, d);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={dlzka === d}
                  className={`dlzka-volba ${dlzka === d ? "aktivna" : ""} ${zamok !== null ? "zamknuta" : ""}`}
                  disabled={!ide || !volitelnaLiga(ligy, ligyAjProtiPocitacu, d)}
                  onClick={() => {
                    ligaOdHraca.current = true;
                    setDlzka(d);
                  }}
                  title={zamok ?? (ide ? undefined : `Sada zatiaľ nemá ${lokalit(DLZKY_HRY[d])} — pribudnú v tvorbe kariet.`)}
                >
                  <strong>
                    {zamok !== null && <IkonaZamku />}
                    {NAZOV_DLZKY[d]}
                  </strong>
                  <span>{lokalit(DLZKY_HRY[d])}</span>
                  {zamok !== null && <span className="liga-podmienka">{zamok}</span>}
                </button>
              );
            })}
          </div>
          {maPravo(ja, "hrat_ludia") ? (
            <div className="riadok-tlacidiel">
              {maPravo(ja, "sukromne_miestnosti") && (
                <button
                  className={hlavneZalozenie && zamokZvolenej === null ? "tlacidlo-hlavne" : undefined}
                  onClick={() => zaloz(false, dlzka)}
                  disabled={zavrete || zamokZvolenej !== null}
                  title={preco ?? zamokZvolenej ?? undefined}
                >
                  Súkromná hra s kódom
                </button>
              )}
              <button onClick={() => zaloz(true, dlzka)} disabled={zavrete || zamokZvolenej !== null} title={preco ?? zamokZvolenej ?? undefined}>
                Verejná hra
              </button>
            </div>
          ) : (
            <p className="tlmene">Hrať proti ľuďom tvoj rank zatiaľ nesmie.</p>
          )}
          <h2 style={{ marginTop: 28 }}>Proti počítaču</h2>
          <p className="tlmene">
            Počítačoví súperi hrajú podľa pravidiel, vidia len to, čo by videl hráč pri stole, a nevzdávajú sa. Partia sa do Frajeriny neráta.
          </p>
          <div className="riadok-tlacidiel">
            {/* Bez zoznamu (starší server) sa niet na čo pýtať: rovno náhodný súper. */}
            <button
              onClick={() => (boti.length > 0 ? setVyberBotaOtvoreny(true) : zaloz(false, dlzka, true))}
              disabled={!maPravo(ja, "hrat_bot") || zavrete}
              title={preco}
              data-hrat-bot=""
            >
              Hrať proti počítaču
            </button>
          </div>
          {vyberBotaOtvoreny && (
            <VyberBota
              boti={boti}
              vypnute={!maPravo(ja, "hrat_bot") || zavrete}
              hraj={(povaha) => {
                setVyberBotaOtvoreny(false);
                zaloz(false, dlzka, true, povaha ?? undefined);
              }}
              zavri={() => setVyberBotaOtvoreny(false)}
            />
          )}
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
              {hry.map((h) => {
                // Do cudzej ligy, ktorú hráč nemá, sa nepripojí — vidí prečo (server to overí tiež).
                const zamok = popisZamku(ligy, h.dlzka);
                return (
                  <li key={h.kod}>
                    <Avatar meno={h.hostitel.meno} avatar={h.hostitel.avatar} velkost={36} />
                    <div>
                      <strong>{h.hostitel.meno}</strong>
                      {h.hostitel.frajerina !== null && <span className="frajerina-cislo" title="Frajerina"> {h.hostitel.frajerina}</span>}
                      <div className="tlmene">
                        {popisDlzky(h.dlzka)} · čaká {Math.max(1, Math.round((Date.now() - h.vytvorena) / 60000))} min
                      </div>
                      {zamok !== null && (
                        <div className="liga-podmienka">
                          <IkonaZamku /> {zamok}
                        </div>
                      )}
                    </div>
                    <button
                      className={zamok === null ? "tlacidlo-hlavne tlacidlo-male" : "tlacidlo-male"}
                      onClick={() => pripoj(h.kod)}
                      disabled={zavrete || !smieLigu(ligy, h.dlzka)}
                      title={preco ?? zamok ?? undefined}
                    >
                      Hrať
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const NADPIS_NEPODPOROVANEHO: Readonly<Record<DovodNepodporovania, string>> = {
  otoc: "Otoč telefón na šírku",
  iphone: "Na iPhone sa hra zatiaľ nedá hrať",
  rank: "Na telefóne hrajú hráči od ranku Poldeci",
  dotyk: "Tu sa NA EX! zatiaľ hrať nedá",
  uzke: "Tu sa NA EX! zatiaľ hrať nedá",
};

/** Späť, odkiaľ hráč prišiel; keď prišiel rovno na /hra (odkaz, záložka), na úvod. */
function spat(): void {
  if (history.length > 1) history.back();
  else chod("/");
}

/** Mobil a úzke okno: hra sa tu zatiaľ hrať nedá (Michal 2026-10-22), zvyšok webu áno. */
function NepodporovaneZariadenie({ dovod }: { readonly dovod: DovodNepodporovania }) {
  return (
    <>
    <HlavaStranky nadpis={NADPIS_NEPODPOROVANEHO[dovod]} />
    <div className="formular-stred panel">
      {dovod === "iphone" ? (
        // Michal 2026-10-31: na mobile zatiaľ len Android — na iPhone ani správca, partia sa ani nezaloží.
        <p>Zahraj si na počítači, tablete alebo telefóne s Androidom — rozohraná partia ťa tam počká.</p>
      ) : dovod === "rank" ? (
        // Michal 2026-11-01: na Androide od ranku Poldeci; výučba je na telefóne neodladená, preto na počítači.
        <>
          <p>Na telefóne môžu hrať hráči od ranku Poldeci. Najprv prejdi výučbu Prvá hra na počítači.</p>
          <p className="tlmene">Poldeci budeš po výučbe alebo po prvej dohratej partii. Potom si zahráš aj na telefóne s Androidom.</p>
        </>
      ) : dovod === "otoc" ? (
        <p>Stôl pre telefón sa hrá len na šírku. Otoč telefón — rozohraná partia ťa počká.</p>
      ) : dovod === "dotyk" ? (
        <p>
          Herný stôl potrebuje širokú obrazovku a myš. Otvor NA EX! na počítači alebo na tablete na šírku — rozohraná partia ťa tam
          počká.
        </p>
      ) : (
        <p>Okno je na herný stôl príliš úzke. Roztiahni ho aspoň na 900 px a hra sa ukáže — rozohraná partia ťa počká.</p>
      )}
      <p className="tlmene">{dovod === "rank" ? "Dovtedy si tu môžeš čítať:" : "Kým sa hra dostane aj na mobil, môžeš si tu čítať:"}</p>
      <div className="riadok-tlacidiel">
        {dovod === "iphone" && (
          <Odkaz href="/" className="tlacidlo tlacidlo-hlavne">
            Späť na úvod
          </Odkaz>
        )}
        {dovod === "rank" && (
          <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={spat}>
            Späť
          </button>
        )}
        <Odkaz href="/pravidla" className={dovod === "iphone" || dovod === "rank" ? "tlacidlo" : "tlacidlo tlacidlo-hlavne"}>
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
    </>
  );
}

/** Výučba je na telefóne neodladená (Michal 2026-11-01) — rozohranú dohrá hráč na počítači. */
function VyucbaNaTelefone({ prerus }: { readonly prerus: () => void }) {
  return (
    <>
      <HlavaStranky nadpis="Výučbu dohraj na počítači" />
      <div className="formular-stred panel">
        <p>Výučba Prvá hra zatiaľ nie je odladená pre telefón. Majster Melichar ťa počká na počítači — rozohraná časť ostane, kde si skončil.</p>
        <div className="riadok-tlacidiel">
          <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={prerus}>
            Prerušiť výučbu
          </button>
          <Odkaz href="/pravidla" className="tlacidlo">
            Pravidlá
          </Odkaz>
        </div>
      </div>
    </>
  );
}

/** Trieda režimu na body: stôl má rovnakú štruktúru DOM vo všetkých režimoch, nič sa okolo neho neobalí. */
function useTriedaRezimu(trieda: string | null): void {
  useEffect(() => {
    if (trieda === null) return;
    document.body.classList.add(trieda);
    return () => document.body.classList.remove(trieda);
  }, [trieda]);
}

export function Hra() {
  useTitulok("Hrať");
  const { ja, nacitane, nastav: nastavUcet } = useUcet();
  // Telefón na šírku smie hráč od ranku Poldeci (Michal 2026-11-01; predtým len správca) — ostatným oznam.
  const spravca = ja !== null && jeSpravca(ja.rola);
  const mobil = smieTelefon(ja?.rola ?? null);
  const nepodporovane = useNepodporovaneZariadenie(mobil);
  const { naSirku, otoc } = useStolNaSirku(mobil);
  // Na telefóne povinne celá obrazovka (Michal 2026-10-31); kde ju prehliadač nevie, aspoň na šírku.
  const telefon = useVyzvaTelefonu(naSirku, otoc);
  // Výučba na telefóne nie je odladená — hráč ju dostane na počítači; správca ju tu smie skúšať.
  const vyucbaNaPocitaci = naSirku && !spravca;
  // Upozornenie pred stolom (Michal 2026-11-01): pri každej partii (kód miestnosti), kým ho hráč neskryje.
  const [upozornenieSkryl, setUpozornenieSkryl] = useState(upozornenieSkryte);
  const [upozornenieVidel, setUpozornenieVidel] = useState<string | null>(null);
  // Na nepodporovanom zariadení sa ani nepripája — po roztiahnutí okna sa pripojí a vráti do partie.
  const hra = useHra(ja !== null && nepodporovane === null);
  useTriedaRezimu(hra.stol2na2 !== null ? "st2-so-stolom" : hra.view?.pata !== undefined ? "rezim-pata" : null);
  const radyNaStole = useRadyNaStole(hra.view);

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
  // Hra, ktorú nováčik zakladal, kým sa ho ponuka „Najprv výučba?“ pýta (#104); preskočenie ju založí.
  const [zalozPoPonuke, setZalozPoPonuke] = useState<{ readonly verejna: boolean; readonly dlzka: DlzkaHry; readonly bot: boolean; readonly povaha: string | undefined } | null>(null);
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
  const { zaloz } = hra;
  const zalozSPonukou = useCallback(
    (verejna: boolean, dlzka: DlzkaHry, bot = false, povaha?: string) => {
      if (vyucbaUctu?.ponuknut === true && !ponukaZavreta && !vyucbaNaPocitaci) setZalozPoPonuke({ verejna, dlzka, bot, povaha });
      else zaloz(verejna, dlzka, bot, povaha);
    },
    [vyucbaUctu, ponukaZavreta, zaloz, vyucbaNaPocitaci],
  );
  const preskocPonuku = useCallback(() => {
    preskocVyucbu();
    if (zalozPoPonuke !== null) zaloz(zalozPoPonuke.verejna, zalozPoPonuke.dlzka, zalozPoPonuke.bot, zalozPoPonuke.povaha);
    setZalozPoPonuke(null);
  }, [preskocVyucbu, zalozPoPonuke, zaloz]);
  const prerusVyucbu = useCallback(() => {
    odid();
    obnovVyucbu();
  }, [odid, obnovVyucbu]);
  // „Preskočiť výučbu“ pri stole (úvod s cigaretou) = to isté ako v ponuke, a odchod od stola.
  const preskocVyucbuPriStole = useCallback(() => {
    odid();
    preskocVyucbu();
  }, [odid, preskocVyucbu]);

  // Odkaz /hra?kod=ABCD rovno pripojí do miestnosti.
  const { pripojene, miestnost, pripoj } = hra;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("vyucba") === null || !pripojene || miestnost !== null || vyucbaUctu === null) return;
    history.replaceState(null, "", "/hra");
    // Na telefóne výučba nezačne — lobby povie, že patrí na počítač.
    if (vyucbaNaPocitaci) return;
    // Odznova, len keď nie je čím pokračovať (rozohraná časť, alebo hotová časť a ďalšia čaká).
    if (vyucbaUctu.dostupna) zacniVyucbu(vyucbaUctu.stav !== null && !rozpracovana(vyucbaUctu));
  }, [pripojene, miestnost, vyucbaUctu, zacniVyucbu, vyucbaNaPocitaci]);
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

  // Rola správcu je známa až po načítaní účtu — dovtedy by telefón na šírku bliklo oznamom.
  if (!nacitane) return <Nacitavanie />;
  // Odhlásený na telefóne sa najprv prihlási — o ranku sa rozhodne až podľa účtu.
  if (nepodporovane !== null && !(nepodporovane === "rank" && ja === null)) return <NepodporovaneZariadenie dovod={nepodporovane} />;
  if (ja === null) {
    // Pozvánka /hra?kod=ABCD: po prihlásení aj registrácii späť s kódom — efekt vyššie hráča pripojí.
    // Bez pozvánky začína nový účet profilom ako doteraz.
    const cesta = location.pathname + location.search;
    const pozvanka = new URLSearchParams(location.search).get("kod") !== null;
    return (
      <HlavaStranky
        nadpis="Hrať môžu prihlásení"
        uvod="Súper ťa uvidí pod tvojím herným menom a s fotkou z profilu."
        akcia={
          <>
            <Odkaz href={pozvanka ? sNavratom("/registracia", cesta) : "/registracia"} className="tlacidlo">
              Vytvoriť účet
            </Odkaz>
            <Odkaz href={sNavratom("/prihlasenie", cesta)} className="tlacidlo tlacidlo-hlavne">
              Prihlásiť sa
            </Odkaz>
          </>
        }
      />
    );
  }
  if (!hra.pripojene && hra.miestnost === null) return <Nacitavanie text="Pripájam sa na server…" />;

  const m = hra.miestnost;
  if (m === null) {
    return (
      <>
        <Lobby zaloz={zalozSPonukou} pripoj={hra.pripoj} chyba={hra.chyba} vyucba={vyucbaUctu} zacniVyucbu={zacniVyucbu} vyucbaNaPocitaci={vyucbaNaPocitaci} />
        <Lobby2na2 zaloz={hra.zalozStol2na2} nahodne={hra.nahodne2na2} pripoj={hra.pripojStol2na2} />
        <section className="panel">
          <h2>Päta, Lakeť, Otočka</h2>
          <p className="tlmene">Draft štyroch starších s pečeňou. Vyhrá, kto podrazí všetkých súperových. Zatiaľ sa nepočíta do Frajeriny.</p>
          <div className="riadok-tlacidiel">
            <button type="button" className="tlacidlo tlacidlo-hlavne pt-bot" onClick={() => hra.zalozPata(true)}>
              Proti počítaču
            </button>
            <button type="button" className="tlacidlo" onClick={() => hra.zalozPata(false)}>
              Založiť stôl s kódom
            </button>
          </div>
        </section>
        {zalozPoPonuke !== null && vyucbaUctu !== null && !ponukaZavreta && (
          <PonukaVyucby vyucba={vyucbaUctu} zacni={() => zacniVyucbu(false)} preskoc={preskocPonuku} />
        )}
      </>
    );
  }

  if (hra.stol2na2 !== null && !hra.stol2na2.zacala) {
    return <Cakaren2na2 stol={hra.stol2na2} botmi={hra.botiDoStola} odist={hra.odid} />;
  }
  if (hra.view === null || hra.data === null) {
    const [h0, h1] = hra.hraci;
    return (
      <>
      <HlavaStranky
        nadpis="Čaká sa na súpera"
        uvod={m.verejna ? "Hra je verejná — ktokoľvek sa môže pridať zo zoznamu. Alebo pošli kód." : "Pošli súperovi tento kód. Hra začne, keď sa pripojí."}
      />
      <div className="cakaren panel">
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
      </>
    );
  }

  // Rozohraná výučba otvorená na telefóne (napr. z počítača) — stôl výučby sa tu neukáže.
  if (hra.vyucba !== null && vyucbaNaPocitaci) return <VyucbaNaTelefone prerus={prerusVyucbu} />;

  const ukazUpozornenie = naSirku && !upozornenieSkryl && upozornenieVidel !== m.code;
  const rozumiemUpozorneniu = (neukazovat: boolean): void => {
    setUpozornenieVidel(m.code);
    if (neukazovat) setUpozornenieSkryl(true);
    // Ťuk na „Rozumiem“ je gesto, ktoré prehliadač chce pre celú obrazovku — druhá výzva netreba.
    if (telefon.vyzva === "cela") telefon.zapni();
  };
  const krokVyucby = hra.vyucba?.krok ?? null;
  const zadrzBitku =
    krokVyucby !== null && (krokVyucby.kto === "bot" || krokVyucby.kto === "auto") && krokVyucby.melichar.trim() !== "" ? krokVyucby.id : null;

  const viewPata = hra.view.pata === undefined ? null : hra.view;
  const dataPata = hra.data;
  return (
    <>
    {ukazUpozornenie ? (
      <UpozornenieTelefonu rozumiem={rozumiemUpozorneniu} />
    ) : telefon.vyzva === "cela" ? (
      <VyzvaCelejObrazovky zapni={telefon.zapni} />
    ) : (
      telefon.vyzva === "otoc" && <OtocTelefon />
    )}
    <HudbaPartie />
    {/* Vo výučbe len na jej konci — achievement Prvá hra (Michal 2026-10-25). */}
    {(hra.vyucba === null || hra.vyucba.hotovo) && <OznamZiskov zisky={hra.achievementy.zisky} />}
    {hra.vyucba === null && (
      <Momenty
        udalosti={hra.udalosti}
        ja={hra.view.ja}
        mena={hra.hraci.map((h, i) => h?.meno ?? `Hráč ${i + 1}`)}
        hovor={hovorPriMomente}
        pocitadloBezi={pocitadloBezi}
        portret={(elderId) => {
          // Starší má id svojej karty (elders.json) — portrét je jej ilustrácia.
          const o = hra.data === null ? null : vzhladKarty(m.sada, hra.data, elderId).obrazok;
          return o === null ? null : mediaUrl(o.nahlad);
        }}
      />
    )}
    {/* Nápovedy Melichara (Michal 2026-10-24): v každej partii, nie vo výučbe — tam hovorí scenár. */}
    {hra.vyucba === null && <NapovedaMelichara data={hra.data} view={hra.view} udalosti={hra.udalosti} pocitadloBezi={pocitadloBezi} sada={m.sada} jednaNaFazu={naSirku} />}
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
    {hra.stol2na2 !== null && (
      <Panel2na2
        stol={hra.stol2na2}
        view={hra.view}
        data={hra.data}
        sada={m.sada}
        spravy={hra.spravyTimu}
        signal={hra.signal2na2}
        chat={hra.chat2na2}
        odovzdajOdpoved={hra.odovzdajOdpoved2na2}
        potvrdVzdanie={hra.vzdat2na2}
        zrusVzdanie={hra.zrusVzdanie2na2}
      />
    )}
    {hra.view.pata !== undefined && <RozhodnutiePata view={hra.view} data={hra.data} sada={m.sada} cmd={cmd} />}
    <HernaPlocha
      naSirku={naSirku}
      onPocitadlo={setPocitadloBezi}
      view={hra.view}
      data={hra.data}
      sada={m.sada}
      hraci={hra.hraci}
      log={hra.log}
      udalosti={hra.udalosti}
      lokality={hra.lokality}
      bezOknaKonca={hra.vyucba !== null}
      vyucba={hra.vyucba !== null}
      // Ťah bota či hry s textom Melichara čaká na „ďalej“ — bitka, ktorú spustil, sa prehrá až po ňom (U3).
      zadrzBitku={zadrzBitku}
      // Pri rozhodnutí (volba) je správnych viac kandidátov — potvrdiť sa nezamyká.
      vyucbaOcakava={hra.vyucba?.krok?.kto === "hrac" && hra.vyucba.krok.volba === null ? hra.vyucba.krok.ocakava : null}
      zaHracaHra={krokVyucby?.kto === "auto" && !krokVyucby.vykonany}
      naneisto={krokVyucby?.kto === "info" && krokVyucby.naneisto}
      // 1. časť výučby končí po prvej bitke: o starších hovorí, keď je partia už v 2. kole.
      ukazStarsich={hra.vyucba !== null && ukazStarsichVoVyucbe(hra.vyucba, hra.view.kolo)}
      // Vo výučbe chybu ukazuje bublina Melichara.
      chyba={hra.vyucba !== null ? null : hra.chyba}
      zrusChybu={hra.zrusChybu}
      superPripojeny={hra.superPripojeny}
      superOdpojenyOd={hra.superOdpojenyOd}
      kod={m.code}
      cmd={cmd}
      opustit={hra.odid}
      frajerina={hra.frajerina}
      achievementy={hra.suhrnAchievementov}
      kontumacia={hra.kontumacia}
      portretyStarsich={viewPata === null || dataPata === null || naSirku ? undefined : (p) => <PortretyStarsich view={viewPata} p={p} data={dataPata} sada={m.sada} rady={radyNaStole} />}
      nadLiniou={
        hra.view.pata === undefined || !naSirku ? undefined : (
          <>
            <RukaSupera view={hra.view} data={hra.data} />
            <RadStarsich view={hra.view} p={opponentOf(hra.view.ja)} data={hra.data} sada={m.sada} />
          </>
        )
      }
      podLiniou={hra.view.pata === undefined || !naSirku ? undefined : <RadStarsich view={hra.view} p={hra.view.ja} data={hra.data} sada={m.sada} />}
      naPlsti={
        hra.view.pata === undefined ? undefined : (
          <>
            <RadNaPlsti view={hra.view} data={hra.data} sada={m.sada} cmd={cmd} />
            <RadyNaStole view={hra.view} data={hra.data} sada={m.sada} cmd={cmd} rady={radyNaStole} />
          </>
        )
      }
      vHlavicke={
        // Hlášky Melichara sú pre 1 na 1, stôl 2 na 2 ich zatiaľ nerozposiela.
        hra.stol2na2 === null && hra.view.koniec === null && maPravo(ja, "melichar_soundboard") && (
          <Soundboard
            ja={m.seat}
            menoSupera={hra.hraci[opponentOf(m.seat)]?.meno ?? "Súper"}
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
        preskocit={preskocVyucbuPriStole}
        hratProtiPocitacu={() => {
          prerusVyucbu();
          // Ligu vyberie server — predvolenú, alebo najvyššiu, ktorú hráč smie.
          hra.zaloz(false, undefined, true);
        }}
        pokracovat={hra.vyucbaPokracuj}
        hlaskaChyby={hra.hlaskaChybyVyucby}
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
