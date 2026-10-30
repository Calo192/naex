// Prihlásenie, registrácia a profil (herné meno, avatar, heslo).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, mediaUrl } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { navratZ } from "../lib/navrat.ts";
import {
  HUDBA_PREDVOLENA,
  LUPA_DO,
  LUPA_OD,
  LUPA_PREDVOLENA,
  MELICHAR_PREDVOLENY,
  NAZOV_UROVNE,
  jeSpravca,
  maPravo,
  useUcet,
  type Pouzivatel,
} from "../lib/ucet.tsx";
import { Avatar, Hlaska, Pole } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import type { Pohlavie } from "@naex/core";

/** Pohlavie v profile (Michal 2026-10-22) — súper ho vidí len v tvare hlášok. */
const VOLBY_POHLAVIA: readonly { readonly id: Pohlavie | null; readonly nazov: string; readonly popis: string }[] = [
  { id: "muz", nazov: "Muž", popis: "„{meno} skončil bez NA EX.“" },
  { id: "zena", nazov: "Žena", popis: "„{meno} skončila bez NA EX.“" },
  { id: null, nazov: "Neuvádzať", popis: "„{meno}: koniec bez NA EX.“" },
];
import { hlasitostZvuku, nacitajSkladby, urlSkladby } from "../hra/Hudba.tsx";
import { nacitajHlasky, urlHlasky } from "../hra/Melichar.tsx";
import { SCHEMY, aktualnaSchema, pouziSchemu } from "../lib/schemy.ts";
import { VyberParu } from "./VyberParu.tsx";

export function Prihlasenie() {
  useTitulok("Prihlásenie");
  const { nastav } = useUcet();
  const [login, setLogin] = useState("");
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);

  const odosli = async (e: FormEvent) => {
    e.preventDefault();
    setCaka(true);
    setChyba(null);
    try {
      const r = await api.post<{ pouzivatel: Pouzivatel }>("/prihlasenie", { login, heslo });
      nastav(r.pouzivatel);
      chod(navratZ(location.search) ?? "/hra", true);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <>
    <HlavaStranky nadpis="Vitaj späť" uvod="Prihlás sa a pokračuj tam, kde si prestal." />
    <div className="formular-stred">
      <form className="panel" onSubmit={(e) => void odosli(e)}>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <Pole label="Prihlasovacie meno">
          <input autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
        </Pole>
        <Pole label="Heslo">
          <input type="password" autoComplete="current-password" value={heslo} onChange={(e) => setHeslo(e.target.value)} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={caka}>
          {caka ? "Prihlasujem…" : "Prihlásiť sa"}
        </button>
      </form>
      <p className="formular-paticka">
        Ešte nemáš účet? <Odkaz href={`/registracia${location.search}`}>Zaregistruj sa</Odkaz>
      </p>
    </div>
    </>
  );
}

export function Registracia() {
  useTitulok("Registrácia");
  const { nastav } = useUcet();
  const [login, setLogin] = useState("");
  const [meno, setMeno] = useState("");
  const [heslo, setHeslo] = useState("");
  const [heslo2, setHeslo2] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);

  const odosli = async (e: FormEvent) => {
    e.preventDefault();
    if (heslo !== heslo2) {
      setChyba("Heslá sa nezhodujú.");
      return;
    }
    setCaka(true);
    setChyba(null);
    try {
      const r = await api.post<{ pouzivatel: Pouzivatel }>("/registracia", { login, heslo, meno: meno.trim() || login });
      nastav(r.pouzivatel);
      // S návratom (pozvánka do miestnosti) rovno späť, inak nováčik začína profilom.
      chod(navratZ(location.search) ?? "/profil?novy=1", true);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <>
    <HlavaStranky nadpis="Nový účet" uvod="Účet potrebuješ na hranie. Pravidlá a karty sú voľne prístupné." />
    <div className="formular-stred">
      <form className="panel" onSubmit={(e) => void odosli(e)}>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <Pole label="Prihlasovacie meno" pomoc="3 – 32 znakov bez diakritiky. Slúži len na prihlásenie.">
          <input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            pattern="[a-zA-Z0-9._\-]{3,32}"
            required
            autoFocus
          />
        </Pole>
        <Pole label="Herné meno" pomoc="Toto uvidí súper. Môžeš ho kedykoľvek zmeniť.">
          <input value={meno} onChange={(e) => setMeno(e.target.value)} maxLength={24} placeholder={login || "napr. Fero z dolného konca"} />
        </Pole>
        <Pole label="Heslo" pomoc="Aspoň 8 znakov.">
          <input type="password" autoComplete="new-password" value={heslo} onChange={(e) => setHeslo(e.target.value)} minLength={8} required />
        </Pole>
        <Pole label="Heslo znova">
          <input type="password" autoComplete="new-password" value={heslo2} onChange={(e) => setHeslo2(e.target.value)} minLength={8} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={caka}>
          {caka ? "Vytváram…" : "Vytvoriť účet"}
        </button>
      </form>
      <p className="formular-paticka">
        Už máš účet? <Odkaz href={`/prihlasenie${location.search}`}>Prihlás sa</Odkaz>
      </p>
    </div>
    </>
  );
}

export function Profil() {
  useTitulok("Môj profil");
  const { ja, nastav } = useUcet();
  const [meno, setMeno] = useState(ja?.meno ?? "");
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [nahrava, setNahrava] = useState(false);
  const [stare, setStare] = useState("");
  const [nove, setNove] = useState("");
  const subor = useRef<HTMLInputElement>(null);
  const novy = new URLSearchParams(location.search).get("novy") === "1";

  if (ja === null) return null;

  const chyba = (err: unknown) => setSprava({ druh: "chyba", text: err instanceof Error ? err.message : String(err) });

  const ulozMeno = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.patch<{ pouzivatel: Pouzivatel }>("/profil", { meno });
      nastav(r.pouzivatel);
      setSprava({ druh: "ok", text: "Herné meno je uložené." });
    } catch (err) {
      chyba(err);
    }
  };

  // Zväčšenie karty (Michal 2026-10-19; v ruke pod myšou, inde klikom od 2026-10-20) — uloží sa chvíľu
  // po poslednom pohnutí posuvníkom, nie pri každom kroku.
  const [lupa, setLupa] = useState(ja?.lupa ?? LUPA_PREDVOLENA);
  const ulozenaLupa = ja?.lupa ?? LUPA_PREDVOLENA;
  useEffect(() => {
    if (lupa === ulozenaLupa) return;
    const t = setTimeout(() => {
      api
        .patch<{ pouzivatel: Pouzivatel }>("/profil", { lupa })
        .then((r) => nastav(r.pouzivatel))
        .catch(chyba);
    }, 400);
    return () => clearTimeout(t);
  }, [lupa, ulozenaLupa]);

  // Hlasitosť hudby počas partie (Michal 2026-10-20) — ukladá sa ako lupa, chvíľu po pohnutí.
  const [hudba, setHudba] = useState(ja?.hudba ?? HUDBA_PREDVOLENA);
  const ulozenaHudba = ja?.hudba ?? HUDBA_PREDVOLENA;
  useEffect(() => {
    if (hudba === ulozenaHudba) return;
    const t = setTimeout(() => {
      api
        .patch<{ pouzivatel: Pouzivatel }>("/profil", { hudba })
        .then((r) => nastav(r.pouzivatel))
        .catch(chyba);
    }, 400);
    return () => clearTimeout(t);
  }, [hudba, ulozenaHudba]);

  // Ukážka — hlasitosť sa dá nastaviť aj bez rozohranej partie.
  const ukazka = useRef<HTMLAudioElement | null>(null);
  const [ukazkaHra, setUkazkaHra] = useState<string | null>(null);
  useEffect(() => {
    if (ukazka.current !== null) ukazka.current.volume = hlasitostZvuku(hudba);
  }, [hudba]);
  useEffect(() => () => ukazka.current?.pause(), []);
  const prepniUkazku = async (): Promise<void> => {
    if (ukazka.current !== null) {
      ukazka.current.pause();
      ukazka.current = null;
      setUkazkaHra(null);
      return;
    }
    const skladby = await nacitajSkladby();
    const s = skladby[Math.floor(Math.random() * skladby.length)];
    if (s === undefined) {
      setSprava({ druh: "chyba", text: "Hudba na serveri zatiaľ nie je." });
      return;
    }
    const a = new Audio(urlSkladby(s));
    a.volume = hlasitostZvuku(hudba);
    a.addEventListener("ended", () => {
      ukazka.current = null;
      setUkazkaHra(null);
    });
    ukazka.current = a;
    setUkazkaHra(s.nazov);
    a.play().catch(chyba);
  };

  // Hlášky majstra Melichara v partii proti počítaču (Michal 2026-10-21) — hlasitosť
  // sa ukladá ako hudba, chvíľu po pohnutí. Frekvencia nie je: ozve sa len pri
  // pečiatke momentu (Michal 2026-10-23).
  const [melichar, setMelichar] = useState(ja?.melichar ?? MELICHAR_PREDVOLENY);
  const ulozenyMelichar = ja?.melichar ?? MELICHAR_PREDVOLENY;
  useEffect(() => {
    if (melichar === ulozenyMelichar) return;
    const t = setTimeout(() => {
      api
        .patch<{ pouzivatel: Pouzivatel }>("/profil", { melichar })
        .then((r) => nastav(r.pouzivatel))
        .catch(chyba);
    }, 400);
    return () => clearTimeout(t);
  }, [melichar, ulozenyMelichar]);

  const hlaskaUkazky = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => hlaskaUkazky.current?.pause(), []);
  const vyskusajHlasku = async (): Promise<void> => {
    hlaskaUkazky.current?.pause();
    const hlasky = await nacitajHlasky();
    const h = hlasky[Math.floor(Math.random() * hlasky.length)];
    if (h === undefined) {
      setSprava({ druh: "chyba", text: "Hlášky majstra Melichara na serveri zatiaľ nie sú." });
      return;
    }
    const a = new Audio(urlHlasky(h));
    a.volume = hlasitostZvuku(melichar);
    hlaskaUkazky.current = a;
    a.play().catch(chyba);
  };

  // Farebná schéma (Michal 2026-10-21) — prefarbí web hneď, uloží sa v prehliadači aj v účte.
  const [schema, setSchema] = useState(aktualnaSchema);
  const vyberSchemu = (id: string): void => {
    pouziSchemu(id);
    setSchema(id);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { schema: id })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };

  // Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19).
  const [skratky, setSkratky] = useState(ja?.skratky !== false);
  const prepniSkratky = (zapnute: boolean): void => {
    setSkratky(zapnute);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { skratky: zapnute })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };

  // Medziobrazovky pri prechode fáz v partii (Michal 2026-10-27).
  const [medziobrazovky, setMedziobrazovky] = useState(ja?.medziobrazovky !== false);
  const prepniMedziobrazovky = (zapnute: boolean): void => {
    setMedziobrazovky(zapnute);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { medziobrazovky: zapnute })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };

  // Nápovedy majstra Melichara v partii (Michal 2026-10-24): vypnúť a ukázať znova.
  const [napovedy, setNapovedy] = useState(ja?.napovedy !== false);
  const [napovedyZnova, setNapovedyZnova] = useState(false);
  const prepniNapovedy = (zapnute: boolean): void => {
    setNapovedy(zapnute);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { napovedy: zapnute })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };
  const ukazNapovedyZnova = (): void => {
    api
      .post("/napovedy/reset")
      .then(() => setNapovedyZnova(true))
      .catch(chyba);
  };

  // Pohlavie pre tvary hlášok v partii (Michal 2026-10-22) — voliteľné, inak neutrálne hlášky.
  const [pohlavie, setPohlavie] = useState<Pohlavie | null>(ja?.pohlavie ?? null);
  const vyberPohlavie = (p: Pohlavie | null): void => {
    setPohlavie(p);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { pohlavie: p })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };

  // Výber z predvolených avatarov (Michal 2026-10-19) — kto nechce nahrávať fotku.
  const [galeria, setGaleria] = useState<readonly string[] | null>(null);
  const [galeriaOtvorena, setGaleriaOtvorena] = useState(false);
  const otvorGaleriu = (): void => {
    setGaleriaOtvorena(!galeriaOtvorena);
    if (galeria === null) {
      api
        .get<{ avatary: string[] }>("/avatary")
        .then((r) => setGaleria(r.avatary))
        .catch(chyba);
    }
  };
  const vyberAvatar = async (id: string) => {
    try {
      const r = await api.put<{ pouzivatel: Pouzivatel }>("/profil/avatar-predvoleny", { avatar: id });
      nastav(r.pouzivatel);
      setSprava({ druh: "ok", text: "Avatar je zmenený." });
    } catch (err) {
      chyba(err);
    }
  };

  const nahrajAvatar = async (f: File) => {
    setNahrava(true);
    setSprava(null);
    try {
      // Orez na štvorec a zmenšenie v prehliadači — na server ide malý JPEG.
      const blob = await stvorec(await nacitajObrazok(f), 320);
      const r = await api.put<{ pouzivatel: Pouzivatel }>("/profil/avatar", blob, "image/jpeg");
      nastav(r.pouzivatel);
      setSprava({ druh: "ok", text: "Avatar je nahratý." });
    } catch (err) {
      chyba(err);
    } finally {
      setNahrava(false);
    }
  };

  const zmazAvatar = async () => {
    try {
      const r = await api.del<{ pouzivatel: Pouzivatel }>("/profil/avatar");
      nastav(r.pouzivatel);
    } catch (err) {
      chyba(err);
    }
  };

  const zmenHeslo = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/profil/heslo", { stare, nove });
      setStare("");
      setNove("");
      setSprava({ druh: "ok", text: "Heslo je zmenené." });
    } catch (err) {
      chyba(err);
    }
  };

  return (
    <div className="profil profil-siroky">
      <HlavaStranky
        nadpis="Môj profil"
        uvod="Herné meno, fotka a nastavenia webu aj partie."
        akcia={
          <Odkaz href={`/hrac/${ja.id}`} className="tlacidlo">
            Moje štatistiky a partie
          </Odkaz>
        }
      />
      {novy && <Hlaska druh="ok">Účet je pripravený. Nastav si herné meno a fotku — uvidí ich tvoj súper.</Hlaska>}
      {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}

      <section className="panel profil-hlava">
        <div className="profil-avatar">
          {/* Jediný avatar mimo partie vo farbe hráča — hneď pod ním sa pár volí. */}
          <Avatar meno={ja.meno} avatar={ja.avatar} velkost={112} farba="ja" />
        </div>
        <div>
          <h2 style={{ marginBottom: 4 }}>{ja.meno}</h2>
          <div className="riadok-tlacidiel" style={{ color: "var(--slaby)" }}>
            @{ja.login} <span className={jeSpravca(ja.rola) ? "odznak odznak-admin" : "odznak"}>{NAZOV_UROVNE[ja.rola]}</span>
          </div>
          {ja.rola === "navstevnik" && (
            <p className="tlmene" style={{ margin: "6px 0 0" }}>
              Rank Poldeci dostaneš po prvej dohratej partii, aj proti počítaču; Deci a Sedmičku po ďalších partiách s ľuďmi.
            </p>
          )}
          <p style={{ margin: "6px 0 0" }}>
            <Odkaz href={`/hrac/${ja.id}`}>Moje štatistiky a partie</Odkaz>
          </p>
          <div className="profil-avatar-akcie">
            <input
              ref={subor}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f !== undefined) void nahrajAvatar(f);
                e.target.value = "";
              }}
            />
            {maPravo(ja, "vlastna_fotka") && (
              <button className="tlacidlo-male" onClick={() => subor.current?.click()} disabled={nahrava}>
                {nahrava ? "Nahrávam…" : ja.avatar === null ? "Nahrať fotku" : "Zmeniť fotku"}
              </button>
            )}
            <button className="tlacidlo-male" onClick={otvorGaleriu} aria-expanded={galeriaOtvorena}>
              {galeriaOtvorena ? "Zavrieť výber" : "Vybrať avatara"}
            </button>
            {ja.avatar !== null && (
              <button
                className="tlacidlo-male tlacidlo-jemne"
                onClick={() => void zmazAvatar()}
                title="Namiesto fotky ti pridelí náhodnú dedinskú trosku."
              >
                Náhodný avatar
              </button>
            )}
          </div>
        </div>
        <VyberParu chyba={chyba} />
      </section>

      {galeriaOtvorena && (
        <section className="panel galeria-avatarov" aria-label="Výber avatara">
          <h3>Vyber si dedinskú trosku</h3>
          {galeria === null ? (
            <p className="tlmene">Načítavam…</p>
          ) : galeria.length === 0 ? (
            <p className="tlmene">Predvolené avatary zatiaľ nie sú.</p>
          ) : (
            <div className="galeria-mriezka">
              {galeria.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === ja.avatar ? "galeria-volba zvoleny" : "galeria-volba"}
                  onClick={() => void vyberAvatar(id)}
                  aria-pressed={id === ja.avatar}
                  aria-label="Vybrať tento avatar"
                >
                  <img src={mediaUrl(id)} alt="" width={88} height={88} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Štatistiky sú na profile hráča (/hrac/:id) — tu len odkaz, nech nie sú na dvoch miestach. */}
      <section className="panel profil-odkaz-statistiky">
        <div>
          <h2>Štatistiky</h2>
          <p className="tlmene">Frajerina, forma, súhrn, silné a slabé stránky a história partií. Tam si vieš aj skryť súhrn pred ostatnými.</p>
        </div>
        <Odkaz href={`/hrac/${ja.id}`} className="tlacidlo tlacidlo-hlavne">
          Otvoriť profil hráča
        </Odkaz>
      </section>

      <h2 className="profil-nastavenia-nadpis">Nastavenia účtu</h2>
      <section className="panel vzhlad-webu" aria-labelledby="vzhlad-webu-nadpis">
        <h3 id="vzhlad-webu-nadpis">Vzhľad webu</h3>
        <p className="tlmene">
          Farby inšpirované knihou Sanza Wadu <i>A Dictionary of Color Combinations</i>. Mení sa len okolie — karty a zóny
          starších ostávajú. Svoju farbu a farbu súpera si vyberáš hore pri avatare. Ukladá sa samo.
        </p>
        {/* Dve skupiny, Tmavé a Svetlé, po 14 (Michal 2026-10-23). */}
        {([
          ["Tmavé", true],
          ["Svetlé", false],
        ] as const).map(([nadpis, tmava]) => (
          <div key={nadpis} className="schemy-skupina">
            <h4 className="schemy-nadpis">{nadpis}</h4>
            <div className="schemy-mriezka">
              {SCHEMY.filter((s) => s.tmava === tmava).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={s.id === schema ? "schema-volba zvolena" : "schema-volba"}
                  onClick={() => vyberSchemu(s.id)}
                  aria-pressed={s.id === schema}
                  title={s.wada}
                >
                  <span className="schema-nahlad" style={{ background: s.nahlad[0] }} aria-hidden="true">
                    <span className="schema-nahlad-plocha" style={{ background: s.nahlad[1] }}>
                      <span className="schema-nahlad-riadok" style={{ background: s.nahlad[3] }} />
                      <span className="schema-nahlad-riadok kratky" style={{ background: s.nahlad[3] }} />
                      <span className="schema-nahlad-tlacidlo" style={{ background: s.nahlad[2] }} />
                    </span>
                  </span>
                  <span className="schema-nazov">{s.nazov}</span>
                  <span className="schema-popis">{s.popis}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="panel preferencie" aria-labelledby="preferencie-nadpis">
        <h3 id="preferencie-nadpis">Preferencie</h3>
        <label className="skratky-volba">
          <input type="checkbox" checked={skratky} onChange={(e) => prepniSkratky(e.target.checked)} />
          <span>
            <b>Klávesové skratky v partii</b> — K končím / hotovo / potvrdiť, P pasovať, N NA EX!, Esc zrušiť, ? zoznam. Pri písaní do poľa
            nefungujú; M otvorí pult Melichara a číslice na ňom buchnú pečiatkou.
          </span>
        </label>
        <label className="skratky-volba">
          <input type="checkbox" checked={medziobrazovky} onChange={(e) => prepniMedziobrazovky(e.target.checked)} />
          <span>
            <b>Medziobrazovky pri prechode fáz</b> — pri výbere lokality, šenku, Zhromaždení, Pitke, bitke, Nakladačky a vo finále sa ukáže názov fázy a čo máš
            robiť. Ostane, kým neklikneš „Rozumiem“.
          </span>
        </label>
        <label className="skratky-volba">
          <input type="checkbox" checked={napovedy} onChange={(e) => prepniNapovedy(e.target.checked)} />
          <span>
            <b>Nápovedy majstra Melichara v partii</b> — keď sa v partii prvýkrát stretneš s niečím novým (Dlh, Absťák, Pohoršenie…),
            Melichar to krátko vysvetlí. Každú povie len raz.
          </span>
        </label>
        <div className="riadok-tlacidiel napovedy-znova">
          <button type="button" className="tlacidlo-male" onClick={ukazNapovedyZnova} disabled={napovedyZnova}>
            {napovedyZnova ? "Nápovedy sa ukážu znova" : "Ukázať nápovedy znova"}
          </button>
        </div>
        <fieldset className="skore-volby">
          <legend>Ako o tebe písať v hláškach partie</legend>
          {VOLBY_POHLAVIA.map((v) => (
            <label key={v.id ?? "nie"} className={v.id === pohlavie ? "skore-volba zvolena" : "skore-volba"}>
              <input type="radio" name="pohlavie" checked={v.id === pohlavie} onChange={() => vyberPohlavie(v.id)} />
              <span className="skore-nazov">{v.nazov}</span>
              <span className="skore-popis">{v.popis.replace("{meno}", ja.meno)}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <div className="profil-nastavenia">
      <form className="panel" onSubmit={(e) => void ulozMeno(e)}>
        <h3>Herné meno</h3>
        <Pole label="Ako ťa uvidí súper" pomoc="2 – 24 znakov.">
          <input value={meno} onChange={(e) => setMeno(e.target.value)} maxLength={24} minLength={2} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={meno.trim() === ja.meno}>
          Uložiť meno
        </button>
      </form>

      <form className="panel" onSubmit={(e) => void zmenHeslo(e)}>
        <h3>Zmena hesla</h3>
        <Pole label="Súčasné heslo">
          <input type="password" autoComplete="current-password" value={stare} onChange={(e) => setStare(e.target.value)} required />
        </Pole>
        <Pole label="Nové heslo" pomoc="Aspoň 8 znakov.">
          <input type="password" autoComplete="new-password" value={nove} onChange={(e) => setNove(e.target.value)} minLength={8} required />
        </Pole>
        <button type="submit">Zmeniť heslo</button>
      </form>

      <div className="panel">
        <h3>Zväčšenie kariet</h3>
        <Pole
          label={`Zväčšená karta: ${lupa} %`}
          pomoc={`V hre sa karta zväčší, keď na ňu ukážeš myšou (ruka, stôl, starší, lokality), susedia jej uhnú — na ${lupa} % (${LUPA_OD} – ${LUPA_DO} %). Ukladá sa samo.`}
        >
          <input
            type="range"
            className="posuvnik-lupy"
            min={LUPA_OD}
            max={LUPA_DO}
            step={10}
            value={lupa}
            onChange={(e) => setLupa(Number(e.target.value))}
            aria-valuetext={`${lupa} %`}
          />
          <div className="posuvnik-stupnica" aria-hidden="true">
            <span>{LUPA_OD} %</span>
            <span>{LUPA_PREDVOLENA} %</span>
            <span>{LUPA_DO} %</span>
          </div>
        </Pole>
      </div>

      <div className="panel">
        <h3>Hudba počas partie</h3>
        <Pole
          label={hudba === 0 ? "Hlasitosť: vypnutá" : `Hlasitosť: ${hudba} %`}
          pomoc="Počas partie hrajú v náhodnom poradí skladby z playlistu NaEx – PLEBS. Úplne vľavo je hudba vypnutá. Ukladá sa samo."
        >
          <input
            type="range"
            className="posuvnik-lupy"
            min={0}
            max={100}
            step={5}
            value={hudba}
            onChange={(e) => setHudba(Number(e.target.value))}
            aria-valuetext={hudba === 0 ? "vypnutá" : `${hudba} %`}
          />
          <div className="posuvnik-stupnica" aria-hidden="true">
            <span>vypnutá</span>
            <span>50 %</span>
            <span>100 %</span>
          </div>
        </Pole>
        <div className="riadok-tlacidiel" style={{ marginTop: 12 }}>
          <button type="button" className="tlacidlo-male" onClick={() => void prepniUkazku()} disabled={hudba === 0 && ukazkaHra === null}>
            {ukazkaHra === null ? "Vyskúšať" : "Zastaviť ukážku"}
          </button>
          {ukazkaHra !== null && <span className="tlmene">♪ {ukazkaHra}</span>}
        </div>
      </div>

      <div className="panel">
        <h3>Majster Melichar</h3>
        <Pole
          label={melichar === 0 ? "Hlasitosť: vypnutý" : `Hlasitosť: ${melichar} %`}
          pomoc="V partii proti počítaču sa ozve, keď na stole dopadne pečiatka momentu (zvrat, výprask, záchrana…) — nie práve najslušnejšie. Úplne vľavo mlčí. Ukladá sa samo."
        >
          <input
            type="range"
            className="posuvnik-lupy"
            min={0}
            max={100}
            step={5}
            value={melichar}
            onChange={(e) => setMelichar(Number(e.target.value))}
            aria-valuetext={melichar === 0 ? "vypnutý" : `${melichar} %`}
          />
          <div className="posuvnik-stupnica" aria-hidden="true">
            <span>vypnutý</span>
            <span>50 %</span>
            <span>100 %</span>
          </div>
        </Pole>
        <div className="riadok-tlacidiel" style={{ marginTop: 12 }}>
          <button type="button" className="tlacidlo-male" onClick={() => void vyskusajHlasku()} disabled={melichar === 0}>
            Vyskúšať
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
