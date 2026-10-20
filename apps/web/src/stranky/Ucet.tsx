// Prihlásenie, registrácia a profil (herné meno, avatar, heslo).

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, mediaUrl } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { LUPA_DO, LUPA_OD, LUPA_PREDVOLENA, NAZOV_UROVNE, PARTII_NA_HRACA, jeSpravca, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Pole } from "../komponenty.tsx";
import { MojeStatistiky } from "./Statistiky.tsx";

/** Kam sa vrátiť po prihlásení (?spat=/hra). */
function navrat(): string {
  const spat = new URLSearchParams(location.search).get("spat");
  return spat !== null && spat.startsWith("/") && !spat.startsWith("//") ? spat : "/hra";
}

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
      chod(navrat(), true);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <div className="formular-stred">
      <h1>Vitaj späť</h1>
      <p className="podnadpis">Prihlás sa a pokračuj tam, kde si prestal.</p>
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
      chod("/profil?novy=1", true);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setCaka(false);
    }
  };

  return (
    <div className="formular-stred">
      <h1>Nový účet</h1>
      <p className="podnadpis">Účet potrebuješ na hranie. Pravidlá a karty sú voľne prístupné.</p>
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
      <h1>Môj profil</h1>
      {novy && <Hlaska druh="ok">Účet je pripravený. Nastav si herné meno a fotku — uvidí ich tvoj súper.</Hlaska>}
      {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}

      <section className="panel profil-hlava">
        <div className="profil-avatar">
          <Avatar meno={ja.meno} avatar={ja.avatar} velkost={112} />
        </div>
        <div>
          <h2 style={{ marginBottom: 4 }}>{ja.meno}</h2>
          <div className="riadok-tlacidiel" style={{ color: "var(--slaby)" }}>
            @{ja.login} <span className={jeSpravca(ja.rola) ? "odznak odznak-admin" : "odznak"}>{NAZOV_UROVNE[ja.rola]}</span>
          </div>
          {ja.rola === "navstevnik" && (
            <p className="tlmene" style={{ margin: "6px 0 0" }}>
              Hráčom sa staneš po {PARTII_NA_HRACA} dohratých partiách — máš {ja.dohrate ?? 0}. Hráč môže písať spätnú väzbu.
            </p>
          )}
          <p style={{ margin: "6px 0 0" }}>
            <Odkaz href={`/hrac/${ja.id}`}>Ako ma vidia ostatní</Odkaz>
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
            <button className="tlacidlo-male" onClick={() => subor.current?.click()} disabled={nahrava}>
              {nahrava ? "Nahrávam…" : ja.avatar === null ? "Nahrať fotku" : "Zmeniť fotku"}
            </button>
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

      <MojeStatistiky id={ja.id} />

      <h2 className="profil-nastavenia-nadpis">Nastavenia účtu</h2>
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
          pomoc={`V hre sa karta v ruke zväčší, keď na ňu ukážeš myšou, ostatné karty (stôl, starší, lokality) keď na ne klikneš — na ${lupa} % (${LUPA_OD} – ${LUPA_DO} %). Ukladá sa samo.`}
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
        </Pole>
        <div className="posuvnik-stupnica" aria-hidden="true">
          <span>{LUPA_OD} %</span>
          <span>{LUPA_PREDVOLENA} %</span>
          <span>{LUPA_DO} %</span>
        </div>
      </div>
      </div>
    </div>
  );
}
