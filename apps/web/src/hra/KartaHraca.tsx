// Karta hráča počas partie (Michal 2026-10-22): nemodálna bublina pri avatare,
// aby hráč neodišiel zo stola — hra beží ďalej a dá sa klikať aj s otvorenou
// bublinou. Celý profil sa otvára v novej karte prehliadača.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api.ts";
import { Avatar } from "../komponenty.tsx";
import { CisloFrajeriny } from "../stranky/Statistiky.tsx";
import { FormaStvorce } from "../stranky/profil/Profil.tsx";
import { hodnotaMetriky, type Bilancia, type ProfilApi } from "../stranky/profil/typy.ts";
import type { HracInfo } from "./useHra.ts";
import { t } from "../i18n/jazyk.tsx";

const SIRKA = 300;
const OKRAJ = 8;

const bilanciaText = (b: Bilancia): string => t("kartaHraca.bilancia", { v: b.vyhry, r: b.remizy, p: b.prehry });

function Obsah({ info, ja }: { readonly info: HracInfo; readonly ja: boolean }) {
  const id = info.id;
  const verejny = info.profil !== "skryty" && info.profil !== "ziadny" && info.bot !== true && id !== undefined;
  const [profil, setProfil] = useState<ProfilApi | null>(null);
  const [chyba, setChyba] = useState(false);
  useEffect(() => {
    if (!verejny) return;
    let zive = true;
    api
      .get<ProfilApi>(`/hraci/${id}`)
      .then((p) => zive && setProfil(p))
      .catch(() => zive && setChyba(true));
    return () => {
      zive = false;
    };
  }, [id, verejny]);

  if (info.bot === true) return <p className="tlmene">{t("kartaHraca.bot")}</p>;
  if (!verejny || chyba) return <p className="tlmene">{t("kartaHraca.neverejny")}</p>;
  if (profil === null) return <p className="tlmene">{t("kartaHraca.nacitavam")}</p>;

  const f = profil.frajerina;
  const ludia = profil.bilancia.ludia;
  const boti = profil.bilancia.boti.partie;
  const metriky = profil.suhrn?.metriky.filter((m) => m.kluc === "vyhry" || m.kluc === "body") ?? [];
  return (
    <>
      <div className="karta-hraca-frajerina">
        <span>
          {t("kartaHraca.frajerina")} <CisloFrajeriny f={f} />
        </span>
        <span className="tlmene">{f.poradie !== null ? t("kartaHraca.vRebricku", { n: f.poradie }) : f.titul}</span>
      </div>
      {ludia.partie === 0 ? (
        <p className="tlmene">{boti > 0 ? t("kartaHraca.prvaSBotmi", { n: boti }) : t("kartaHraca.prva")}</p>
      ) : (
        <>
          <div className="karta-hraca-riadok">
            <span className="tlmene">{t("kartaHraca.forma")}</span>
            <FormaStvorce vysledky={profil.forma} nazov={t("kartaHraca.posledne5")} />
          </div>
          {!ja && profil.vyDvaja !== null && profil.vyDvaja.partie > 0 && (
            <div className="karta-hraca-riadok">
              <span className="tlmene">{t("kartaHraca.vyDvaja")}</span>
              <span title={t("kartaHraca.protiSebe", { n: profil.vyDvaja.partie })}>{bilanciaText(profil.vyDvaja)}</span>
            </div>
          )}
          {metriky.map((m) => (
            <div key={m.kluc} className="karta-hraca-riadok" title={m.popis}>
              <span className="tlmene">{m.nazov}</span>
              <span>{hodnotaMetriky(m, m.hodnota)}</span>
            </div>
          ))}
          <p className="karta-hraca-pocet tlmene">
            {t("kartaHraca.sLudmi", { n: ludia.partie })}
            {boti > 0 && t("kartaHraca.plusBoti", { n: boti })}
          </p>
        </>
      )}
      <a className="karta-hraca-odkaz" href={`/hrac/${profil.hrac.id}`} target="_blank" rel="noopener">
        {t("kartaHraca.celyProfil")}
      </a>
    </>
  );
}

/** Avatar na doske ako tlačidlo, ktoré otvorí kartu hráča. */
export function KartaHraca({ info, meno, ja, children }: { readonly info: HracInfo | null; readonly meno: string; readonly ja: boolean; readonly children: ReactNode }) {
  const [poloha, setPoloha] = useState<{ x: number; y: number; hore: boolean } | null>(null);
  const kotva = useRef<HTMLButtonElement>(null);
  const bublina = useRef<HTMLDivElement>(null);

  const otvor = (): void => {
    const r = kotva.current?.getBoundingClientRect();
    if (r === undefined) return;
    const x = Math.min(Math.max(r.left, OKRAJ), document.documentElement.clientWidth - SIRKA - OKRAJ);
    // Súperova doska je hore — bublina ide pod avatar; moja dole — nad avatar.
    const hore = r.top > window.innerHeight / 2;
    setPoloha({ x, y: hore ? window.innerHeight - r.top + 6 : r.bottom + 6, hore });
  };

  // Zatvorí ju Escape, klik mimo nej alebo posun stola; nič iné neblokuje.
  useEffect(() => {
    if (poloha === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setPoloha(null);
    };
    const klik = (e: PointerEvent): void => {
      const t = e.target as Node;
      if (bublina.current?.contains(t) === true || kotva.current?.contains(t) === true) return;
      setPoloha(null);
    };
    const posun = (): void => setPoloha(null);
    window.addEventListener("keydown", klaves);
    window.addEventListener("pointerdown", klik);
    window.addEventListener("resize", posun);
    return () => {
      window.removeEventListener("keydown", klaves);
      window.removeEventListener("pointerdown", klik);
      window.removeEventListener("resize", posun);
    };
  }, [poloha]);

  // Vysoká bublina by vyliezla z okna — prisunie sa k okraju.
  useLayoutEffect(() => {
    const el = bublina.current;
    if (poloha === null || el === null) return;
    // Hore aj dole platí to isté: odstup od kotvy + výška sa musí zmestiť do okna.
    const y = Math.max(OKRAJ, Math.min(poloha.y, window.innerHeight - el.offsetHeight - OKRAJ));
    if (y !== poloha.y) setPoloha({ ...poloha, y });
  }, [poloha]);

  return (
    <>
      <button
        ref={kotva}
        type="button"
        className="karta-hraca-kotva"
        aria-haspopup="dialog"
        aria-expanded={poloha !== null}
        title={t("kartaHraca.karta", { meno })}
        onClick={() => (poloha === null ? otvor() : setPoloha(null))}
      >
        {children}
      </button>
      {poloha !== null &&
        info !== null &&
        createPortal(
          <div
            ref={bublina}
            className="karta-hraca"
            role="dialog"
            aria-label={t("kartaHraca.karta", { meno })}
            style={{ left: poloha.x, width: SIRKA, ...(poloha.hore ? { bottom: poloha.y } : { top: poloha.y }) } as CSSProperties}
          >
            <header className="karta-hraca-hlava">
              <Avatar meno={meno} avatar={info.avatar} velkost={44} farba={ja ? "ja" : "su"} />
              <strong>{meno}</strong>
              <button type="button" className="karta-hraca-zavri" aria-label={t("kartaHraca.zavriet")} onClick={() => setPoloha(null)}>
                ×
              </button>
            </header>
            <Obsah info={info} ja={ja} />
          </div>,
          document.body,
        )}
    </>
  );
}
