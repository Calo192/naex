// Prihlásenie, registrácia a profil (herné meno, avatar, heslo).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, mediaUrl, textChyby } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { navratZ } from "../lib/navrat.ts";
import { prepniInstanciu } from "../lib/instancia.ts";
import {
  HUDBA_PREDVOLENA,
  LUPA_DO,
  LUPA_OD,
  LUPA_PREDVOLENA,
  MELICHAR_PREDVOLENY,
  nazovUrovne,
  jeSpravca,
  maPravo,
  useUcet,
  type Pouzivatel,
} from "../lib/ucet.tsx";
import { Avatar, Hlaska, Pole } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import type { Pohlavie } from "@naex/core";
import { hlasitostZvuku, nacitajSkladby, urlSkladby } from "../hra/Hudba.tsx";
import { nacitajHlasky, urlHlasky } from "../hra/Melichar.tsx";
import { SCHEMY, aktualnaSchema, pouziSchemu } from "../lib/schemy.ts";
import { VyberParu } from "./VyberParu.tsx";
import { JAZYKY, NAZVY_JAZYKOV, t, tr, useJazyk } from "../i18n/jazyk.tsx";
import { zvolJazyk } from "../i18n/PrepinacJazyka.tsx";

/** Pohlavie v profile (Michal 2026-10-22) — súper ho vidí len v tvare hlášok. */
// Funkcia: texty v jazyku hráča pri vykreslení; {meno} dosadí t().
const volbyPohlavia = (meno: string): readonly { readonly id: Pohlavie | null; readonly nazov: string; readonly popis: string }[] => [
  { id: "muz", nazov: t("profil.muz"), popis: t("profil.muzPopis", { meno }) },
  { id: "zena", nazov: t("profil.zena"), popis: t("profil.zenaPopis", { meno }) },
  { id: null, nazov: t("profil.neuvadzat"), popis: t("profil.neuvadzatPopis", { meno }) },
];

/**
 * Prihlásenie. Zrejúca ho ukáže namiesto každej stránky, kým v nej nie je nikto s oprávnením
 * (Michal 2026-11-02): účet aj relácia sú tie isté ako vo Vypálenej, prihlásenie robí ona.
 * bezPrava = prihlásený vo Vypálenej, ale Zrejúcu hrať nesmie — formulár netreba.
 */
export function Prihlasenie({ zrejuca = null }: { readonly zrejuca?: { readonly bezPrava: boolean } | null } = {}) {
  useTitulok(zrejuca === null ? t("ucet.prihlasenie") : t("ucet.zrejuca"));
  const { nastav } = useUcet();
  const [login, setLogin] = useState("");
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [caka, setCaka] = useState(false);
  const doVypalenej = (cesta?: string): void => {
    prepniInstanciu("vypalena", cesta).catch((err: unknown) => setChyba(textChyby(err)));
  };

  const odosli = async (e: FormEvent) => {
    e.preventDefault();
    setCaka(true);
    setChyba(null);
    try {
      const r = await api.post<{ pouzivatel: Pouzivatel }>("/prihlasenie", { login, heslo });
      nastav(r.pouzivatel);
      // V Zrejúcej ostane hráč na stránke, ktorú otvoril.
      if (zrejuca === null || location.pathname === "/prihlasenie") chod(navratZ(location.search) ?? "/hra", true);
    } catch (err) {
      setChyba(textChyby(err));
    } finally {
      setCaka(false);
    }
  };

  if (zrejuca?.bezPrava === true) {
    return (
      <HlavaStranky
        nadpis={t("ucet.zrejucaBezPrava")}
        uvod={t("ucet.zrejucaBezPravaUvod")}
        akcia={
          <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => doVypalenej()}>
            {t("ucet.spatDoVypalenej")}
          </button>
        }
      />
    );
  }

  return (
    <>
    {zrejuca === null ? (
      <HlavaStranky nadpis={t("ucet.vitajSpat")} uvod={t("ucet.vitajSpatUvod")} />
    ) : (
      <HlavaStranky nadpis={t("ucet.zrejucaNadpis")} uvod={t("ucet.zrejucaUvod")} />
    )}
    <div className="formular-stred">
      <form className="panel" onSubmit={(e) => void odosli(e)}>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <Pole label={t("ucet.login")}>
          <input autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus />
        </Pole>
        <Pole label={t("ucet.heslo")}>
          <input type="password" autoComplete="current-password" value={heslo} onChange={(e) => setHeslo(e.target.value)} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={caka}>
          {caka ? t("ucet.prihlasujem") : t("ucet.prihlasitSa")}
        </button>
        <p className="prihlasenie-zabudol">
          {zrejuca === null ? (
            <Odkaz href="/zabudnute-heslo">{t("ucet.zabudolHeslo")}</Odkaz>
          ) : (
            <a href="/zabudnute-heslo" onClick={(e) => (e.preventDefault(), doVypalenej("/zabudnute-heslo"))}>
              {t("ucet.zabudolHeslo")}
            </a>
          )}
        </p>
      </form>
      {zrejuca === null ? (
        <p className="formular-paticka">
          {tr("ucet.nemasUcet", { odkaz: <Odkaz href={`/registracia${location.search}`}>{t("ucet.zaregistrujSa")}</Odkaz> })}
        </p>
      ) : (
        <p className="formular-paticka">
          {tr("ucet.oficialna", {
            odkaz: (
              <a href="/" onClick={(e) => (e.preventDefault(), doVypalenej())}>
                {t("ucet.spatDoVypalenej")}
              </a>
            ),
          })}
        </p>
      )}
    </div>
    </>
  );
}

export function Registracia() {
  useTitulok(t("ucet.registracia"));
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
      setChyba(t("ucet.hesloNezhoda"));
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
      setChyba(textChyby(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <>
    <HlavaStranky nadpis={t("ucet.novyUcet")} uvod={t("ucet.novyUcetUvod")} />
    <div className="formular-stred">
      <form className="panel" onSubmit={(e) => void odosli(e)}>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <Pole label={t("ucet.login")} pomoc={t("ucet.loginPomoc")}>
          <input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            pattern="[a-zA-Z0-9._\-]{3,32}"
            required
            autoFocus
          />
        </Pole>
        <Pole label={t("ucet.hernemeno")} pomoc={t("ucet.hernemenoPomoc")}>
          <input value={meno} onChange={(e) => setMeno(e.target.value)} maxLength={24} placeholder={login || t("ucet.hernemenoPriklad")} />
        </Pole>
        <Pole label={t("ucet.heslo")} pomoc={t("ucet.hesloPomoc")}>
          <input type="password" autoComplete="new-password" value={heslo} onChange={(e) => setHeslo(e.target.value)} minLength={8} required />
        </Pole>
        <Pole label={t("ucet.hesloZnova")}>
          <input type="password" autoComplete="new-password" value={heslo2} onChange={(e) => setHeslo2(e.target.value)} minLength={8} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={caka}>
          {caka ? t("ucet.vytvaram") : t("ucet.vytvoritUcet")}
        </button>
      </form>
      <p className="formular-paticka">
        {tr("ucet.uzMasUcet", { odkaz: <Odkaz href={`/prihlasenie${location.search}`}>{t("ucet.prihlasSa")}</Odkaz> })}
      </p>
    </div>
    </>
  );
}

export function Profil() {
  useTitulok(t("profil.mojProfil"));
  const { ja, nastav } = useUcet();
  const jazyk = useJazyk();
  const [meno, setMeno] = useState(ja?.meno ?? "");
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [nahrava, setNahrava] = useState(false);
  const [stare, setStare] = useState("");
  const [nove, setNove] = useState("");
  const subor = useRef<HTMLInputElement>(null);
  const novy = new URLSearchParams(location.search).get("novy") === "1";
  const obnovene = new URLSearchParams(location.search).get("obnovene") === "1";
  const [email, setEmail] = useState(ja?.email ?? "");

  if (ja === null) return null;

  const chyba = (err: unknown) => setSprava({ druh: "chyba", text: textChyby(err) });

  const ulozMeno = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.patch<{ pouzivatel: Pouzivatel }>("/profil", { meno });
      nastav(r.pouzivatel);
      setSprava({ druh: "ok", text: t("profil.menoUlozene") });
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
      setSprava({ druh: "chyba", text: t("profil.hudbaNie") });
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
      setSprava({ druh: "chyba", text: t("profil.hlaskyNie") });
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
      setSprava({ druh: "ok", text: t("profil.avatarZmeneny") });
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
      setSprava({ druh: "ok", text: t("profil.avatarNahraty") });
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

  // E-mail (Michal 2026-11-01): nepovinný, zatiaľ len na obnovu zabudnutého hesla.
  const ulozEmail = async (hodnota: string) => {
    try {
      const r = await api.patch<{ pouzivatel: Pouzivatel }>("/profil", { email: hodnota });
      nastav(r.pouzivatel);
      setEmail(r.pouzivatel.email ?? "");
      setSprava({ druh: "ok", text: r.pouzivatel.email == null ? t("profil.emailVymazany") : t("profil.emailUlozeny") });
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
      setSprava({ druh: "ok", text: t("profil.hesloZmenene") });
    } catch (err) {
      chyba(err);
    }
  };

  return (
    <div className="profil profil-siroky">
      <HlavaStranky
        nadpis={t("profil.mojProfil")}
        uvod={t("profil.uvod")}
        akcia={
          <Odkaz href={`/hrac/${ja.id}`} className="tlacidlo">
            {t("profil.statistikyAPartie")}
          </Odkaz>
        }
      />
      {novy && <Hlaska druh="ok">{t("profil.novy")}</Hlaska>}
      {obnovene && <Hlaska druh="ok">{t("profil.obnovene")}</Hlaska>}
      {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}

      <section className="panel profil-hlava">
        <div className="profil-avatar">
          {/* Jediný avatar mimo partie vo farbe hráča — hneď pod ním sa pár volí. */}
          <Avatar meno={ja.meno} avatar={ja.avatar} velkost={112} farba="ja" />
        </div>
        <div>
          <h2 style={{ marginBottom: 4 }}>{ja.meno}</h2>
          <div className="riadok-tlacidiel" style={{ color: "var(--slaby)" }}>
            @{ja.login} <span className={jeSpravca(ja.rola) ? "odznak odznak-admin" : "odznak"}>{nazovUrovne(ja.rola)}</span>
          </div>
          {ja.rola === "navstevnik" && (
            <p className="tlmene" style={{ margin: "6px 0 0" }}>
              {t("profil.rankPoldeci")}
            </p>
          )}
          <p style={{ margin: "6px 0 0" }}>
            <Odkaz href={`/hrac/${ja.id}`}>{t("profil.statistikyAPartie")}</Odkaz>
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
                {nahrava ? t("profil.nahravam") : ja.avatar === null ? t("profil.nahratFotku") : t("profil.zmenitFotku")}
              </button>
            )}
            <button className="tlacidlo-male" onClick={otvorGaleriu} aria-expanded={galeriaOtvorena}>
              {galeriaOtvorena ? t("profil.zavrietVyber") : t("profil.vybratAvatara")}
            </button>
            {ja.avatar !== null && (
              <button
                className="tlacidlo-male tlacidlo-jemne"
                onClick={() => void zmazAvatar()}
                title={t("profil.nahodnyTitul")}
              >
                {t("profil.nahodny")}
              </button>
            )}
          </div>
        </div>
        <VyberParu chyba={chyba} />
      </section>

      {galeriaOtvorena && (
        <section className="panel galeria-avatarov" aria-label={t("profil.vyberAvatara")}>
          <h3>{t("profil.vyberTrosku")}</h3>
          {galeria === null ? (
            <p className="tlmene">{t("profil.nacitavam")}</p>
          ) : galeria.length === 0 ? (
            <p className="tlmene">{t("profil.ziadneAvatary")}</p>
          ) : (
            <div className="galeria-mriezka">
              {galeria.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === ja.avatar ? "galeria-volba zvoleny" : "galeria-volba"}
                  onClick={() => void vyberAvatar(id)}
                  aria-pressed={id === ja.avatar}
                  aria-label={t("profil.vybratTento")}
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
          <h2>{t("profil.statistiky")}</h2>
          <p className="tlmene">{t("profil.statistikyPopis")}</p>
        </div>
        <Odkaz href={`/hrac/${ja.id}`} className="tlacidlo tlacidlo-hlavne">
          {t("profil.otvoritProfil")}
        </Odkaz>
      </section>

      <h2 className="profil-nastavenia-nadpis">{t("profil.nastavenia")}</h2>
      <section className="panel vzhlad-webu" aria-labelledby="vzhlad-webu-nadpis">
        <h3 id="vzhlad-webu-nadpis">{t("profil.vzhlad")}</h3>
        <p className="tlmene">
          {tr("profil.vzhladPopis")}
        </p>
        {/* Dve skupiny, Tmavé a Svetlé, po 14 (Michal 2026-10-23). */}
        {([
          [t("profil.tmave"), true],
          [t("profil.svetle"), false],
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
        <h3 id="preferencie-nadpis">{t("profil.preferencie")}</h3>
        <fieldset className="skore-volby">
          <legend>{t("profil.jazyk")}</legend>
          <p className="tlmene">{t("profil.jazykPomoc")}</p>
          {JAZYKY.map((j) => (
            <label key={j} lang={j} className={j === jazyk ? "skore-volba zvolena" : "skore-volba"}>
              <input type="radio" name="jazyk" checked={j === jazyk} onChange={() => zvolJazyk(j, ja, nastav)} />
              <span className="skore-nazov">{NAZVY_JAZYKOV[j]}</span>
            </label>
          ))}
        </fieldset>
        <label className="skratky-volba">
          <input type="checkbox" checked={skratky} onChange={(e) => prepniSkratky(e.target.checked)} />
          <span>
            {tr("profil.skratky")}
          </span>
        </label>
        <label className="skratky-volba">
          <input type="checkbox" checked={medziobrazovky} onChange={(e) => prepniMedziobrazovky(e.target.checked)} />
          <span>
            {tr("profil.medziobrazovky")}
          </span>
        </label>
        <label className="skratky-volba">
          <input type="checkbox" checked={napovedy} onChange={(e) => prepniNapovedy(e.target.checked)} />
          <span>
            {tr("profil.napovedy")}
          </span>
        </label>
        <div className="riadok-tlacidiel napovedy-znova">
          <button type="button" className="tlacidlo-male" onClick={ukazNapovedyZnova} disabled={napovedyZnova}>
            {napovedyZnova ? t("profil.napovedyUkazuSa") : t("profil.ukazatNapovedy")}
          </button>
        </div>
        <fieldset className="skore-volby">
          <legend>{t("profil.akoOTebe")}</legend>
          {volbyPohlavia(ja.meno).map((v) => (
            <label key={v.id ?? "nie"} className={v.id === pohlavie ? "skore-volba zvolena" : "skore-volba"}>
              <input type="radio" name="pohlavie" checked={v.id === pohlavie} onChange={() => vyberPohlavie(v.id)} />
              <span className="skore-nazov">{v.nazov}</span>
              <span className="skore-popis">{v.popis}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <div className="profil-nastavenia">
      <form className="panel" onSubmit={(e) => void ulozMeno(e)}>
        <h3>{t("ucet.hernemeno")}</h3>
        <Pole label={t("profil.akoTaUvidi")} pomoc={t("profil.dlzkaMena")}>
          <input value={meno} onChange={(e) => setMeno(e.target.value)} maxLength={24} minLength={2} required />
        </Pole>
        <button type="submit" className="tlacidlo-hlavne" disabled={meno.trim() === ja.meno}>
          {t("profil.ulozitMeno")}
        </button>
      </form>

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void ulozEmail(email);
        }}
      >
        <h3>{t("profil.email")}</h3>
        <Pole label={t("profil.emailAdresa")} pomoc={t("profil.emailPomoc")}>
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} placeholder={t("profil.emailPriklad")} />
        </Pole>
        <div className="riadok-tlacidiel">
          <button type="submit" className="tlacidlo-hlavne" disabled={email.trim() === (ja.email ?? "")}>
            {t("profil.ulozitEmail")}
          </button>
          {ja.email != null && (
            <button type="button" className="tlacidlo-jemne" onClick={() => void ulozEmail("")}>
              {t("profil.vymazat")}
            </button>
          )}
        </div>
      </form>

      <form className="panel" onSubmit={(e) => void zmenHeslo(e)}>
        <h3>{t("profil.zmenaHesla")}</h3>
        <Pole label={t("profil.sucasneHeslo")}>
          <input type="password" autoComplete="current-password" value={stare} onChange={(e) => setStare(e.target.value)} required />
        </Pole>
        <Pole label={t("profil.noveHeslo")} pomoc={t("ucet.hesloPomoc")}>
          <input type="password" autoComplete="new-password" value={nove} onChange={(e) => setNove(e.target.value)} minLength={8} required />
        </Pole>
        <button type="submit">{t("profil.zmenitHeslo")}</button>
      </form>

      <div className="panel">
        <h3>{t("profil.zvacsenie")}</h3>
        <Pole
          label={t("profil.zvacsenaKarta", { n: lupa })}
          pomoc={t("profil.lupaPomoc", { n: lupa, od: LUPA_OD, do: LUPA_DO })}
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
        <h3>{t("profil.hudba")}</h3>
        <Pole
          label={hudba === 0 ? t("profil.hlasitostVypnuta") : t("profil.hlasitost", { n: hudba })}
          pomoc={t("profil.hudbaPomoc")}
        >
          <input
            type="range"
            className="posuvnik-lupy"
            min={0}
            max={100}
            step={5}
            value={hudba}
            onChange={(e) => setHudba(Number(e.target.value))}
            aria-valuetext={hudba === 0 ? t("profil.vypnuta") : `${hudba} %`}
          />
          <div className="posuvnik-stupnica" aria-hidden="true">
            <span>{t("profil.vypnuta")}</span>
            <span>50 %</span>
            <span>100 %</span>
          </div>
        </Pole>
        <div className="riadok-tlacidiel" style={{ marginTop: 12 }}>
          <button type="button" className="tlacidlo-male" onClick={() => void prepniUkazku()} disabled={hudba === 0 && ukazkaHra === null}>
            {ukazkaHra === null ? t("profil.vyskusat") : t("profil.zastavitUkazku")}
          </button>
          {ukazkaHra !== null && <span className="tlmene">♪ {ukazkaHra}</span>}
        </div>
      </div>

      <div className="panel">
        <h3>{t("profil.melichar")}</h3>
        <Pole
          label={melichar === 0 ? t("profil.hlasitostVypnuty") : t("profil.hlasitost", { n: melichar })}
          pomoc={t("profil.melicharPomoc")}
        >
          <input
            type="range"
            className="posuvnik-lupy"
            min={0}
            max={100}
            step={5}
            value={melichar}
            onChange={(e) => setMelichar(Number(e.target.value))}
            aria-valuetext={melichar === 0 ? t("profil.vypnuty") : `${melichar} %`}
          />
          <div className="posuvnik-stupnica" aria-hidden="true">
            <span>{t("profil.vypnuty")}</span>
            <span>50 %</span>
            <span>100 %</span>
          </div>
        </Pole>
        <div className="riadok-tlacidiel" style={{ marginTop: 12 }}>
          <button type="button" className="tlacidlo-male" onClick={() => void vyskusajHlasku()} disabled={melichar === 0}>
            {t("profil.vyskusat")}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
