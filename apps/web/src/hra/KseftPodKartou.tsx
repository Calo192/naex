// Tlačidlo Kšeftu pod kartou, ktorá ho ponúka (Michal 2026-11-02) — Strýko v línii, lokalita;
// to isté tlačidlo nesie schopnosť väzňa v Pivnici (v11.2, raz za hru, „Schopnosť“ namiesto „Kšeft“). Na tlačidle len „Kšeft“ a cena („Kšeft bude obsahovať len minimum textu
// a pri mouseover sa otvoria detaily“); čo dá, celé znenie a prečo teraz nie, je v nápovede.
// Voľba (Kšeft vily: starší a smer; Autobusár, Veterinár: karta) sa otvorí nad tlačidlom
// (playtest výučby 20261030, k-kseft: rozbaľovač nezabral). Na telefóne ťuk otvorí ponuku
// s detailom a veľkým tlačidlom (aspoň 44 px). Ponuka ide do <body>: línia sa posúva do strany
// (overflow) a harmonika ju posúva transformom.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cigariet } from "@naex/core";
import { createPortal } from "react-dom";
import type { Command } from "@naex/core";
import type { KseftNaStole, TlacidloVolby } from "./kseftyNaStole.ts";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { CenaCigariet, Vymena } from "./ikonyZdrojov.tsx";

export interface KseftPodKartouProps {
  readonly kseft: KseftNaStole;
  readonly cmd: (c: Command) => void;
  /** Telefón: ťuk najprv otvorí ponuku s veľkým tlačidlom. */
  readonly naDotyk?: boolean;
  /** Zberný dvor: výber karty zo šrotu v pilulke. */
  readonly onVykup?: () => void;
  /** Nedostupný Kšeft povie prečo aj na ťuk (nápoveda pod myšou na dotyku nie je). */
  readonly onNedostupny?: (text: string, x: number, y: number) => void;
  /** Len pre test — na stole sa ponuka otvorí klikom. */
  readonly otvorena?: boolean;
}

/** Kľúč výučby: Kšeft vily ostáva „tlacidlo:kseft“ (krok k-kseft vo výučbe Prvá hra). */
export function klucVyucbyKseftu(k: Pick<KseftNaStole, "defId">): string {
  return k.defId === "predsedova_vila" ? "tlacidlo:kseft" : `tlacidlo:kseft-${k.defId}`;
}

/** Detail Kšeftu — nápoveda pod myšou aj ponuka po ťuknutí: čo dáš, čo dostaneš, celé znenie, prečo nie. */
function Detail({ k }: { readonly k: KseftNaStole }) {
  return (
    <>
      <span className="kseft-detail-vymena">
        <Vymena das={<Cena k={k} />} dostanes={<b>{k.zisk}</b>} />
      </span>
      <span className="kseft-detail-tip">{k.tip}</span>
      {k.dovod !== null && <span className="kseft-detail-dovod">{k.dovod}</span>}
    </>
  );
}

/** „Kšeft“, pri väzňovi „Schopnosť“ (v11.2). */
function druhNazov(k: Pick<KseftNaStole, "druh">): string {
  return k.druh === "vazen" ? "Schopnosť" : "Kšeft";
}

export function obsahNapovedy(k: KseftNaStole): TipObsah {
  return { nadpis: `${druhNazov(k)} · ${k.nazov}`, text: <Detail k={k} /> };
}

function Cena({ k }: { readonly k: KseftNaStole }) {
  return "cigarety" in k.cena ? (
    <CenaCigariet n={k.cena.cigarety} />
  ) : (
    <span className="cena-raz" title="raz za hru, zadarmo">
      1× za hru
    </span>
  );
}

export function KseftPodKartou({ kseft: k, cmd, naDotyk = false, onVykup, onNedostupny, otvorena: otvorenaNaZaciatku = false }: KseftPodKartouProps) {
  const [otvorena, setOtvorena] = useState(otvorenaNaZaciatku);
  const obal = useRef<HTMLSpanElement>(null);
  const ponuka = useRef<HTMLDivElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly top: number } | null>(null);
  const ne = k.dovod !== null;
  // Voľba (vila, karta, karty Autobusára) sa ponúkne, len keď Kšeft ide; inak ponuka ukáže detail s dôvodom.
  const ponukaVolby = (k.akcia.typ === "volba" || k.akcia.typ === "karty") && !ne;
  const [vybrane, setVybrane] = useState<readonly number[]>([]);
  const napoveda = useTip();

  // Ponuka sa zavrie klikom mimo nej alebo Esc — ako lupa či výber karty.
  useEffect(() => {
    if (!otvorena) return;
    const mimo = (e: PointerEvent): void => {
      const t = e.target;
      if (t instanceof Node && obal.current?.contains(t) !== true && ponuka.current?.contains(t) !== true) setOtvorena(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOtvorena(false);
    };
    const zavri = (): void => setOtvorena(false);
    window.addEventListener("pointerdown", mimo);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("resize", zavri);
    return () => {
      window.removeEventListener("pointerdown", mimo);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("resize", zavri);
    };
  }, [otvorena]);

  // Nad tlačidlom, vystredená a v okne; keď hore nie je miesto, pod ním.
  useLayoutEffect(() => {
    if (!otvorena) {
      setPoloha(null);
      return;
    }
    const b = obal.current?.getBoundingClientRect();
    const p = ponuka.current;
    if (b === undefined || p === null) return;
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, b.left + b.width / 2 - w / 2));
    const top = b.top - h - 8 >= 8 ? b.top - h - 8 : Math.min(window.innerHeight - h - 8, b.bottom + 8);
    setPoloha({ left, top: Math.max(8, top) });
  }, [otvorena]);

  const posli = (c: Command): void => {
    setOtvorena(false);
    setVybrane([]);
    cmd(c);
  };
  const vykonaj = (): void => {
    if (k.akcia.typ === "prikaz") posli(k.akcia.prikaz);
    else if (k.akcia.typ === "vykup") {
      setOtvorena(false);
      onVykup?.();
    }
  };

  const tlacidloVolby = (t: TlacidloVolby): ReactNode => (
    <button type="button" data-vyucba={t.vyucba} onClick={() => posli(t.prikaz)}>
      {t.text}
    </button>
  );
  const obsahPonuky =
    ponukaVolby && k.akcia.typ === "karty" ? (
      // Autobusár: karty zo šenku po jednej do výberu, potom jedno potvrdenie s cenou.
      <>
        <span className="kseft-ponuka-nadpis">{k.akcia.nadpis}</span>
        {k.akcia.karty.map((karta) => {
          const ano = vybrane.includes(karta.uid);
          const plne = !ano && vybrane.length >= (k.akcia.typ === "karty" ? k.akcia.najviac : 0);
          return (
            <span key={karta.uid} className="kseft-ponuka-riadok bez-vlavo">
              <span className="kseft-ponuka-meno">{karta.meno}</span>
              <button
                type="button"
                aria-pressed={ano}
                disabled={plne}
                title={plne ? "Na ďalšiu kartu nemáš cigaretu." : undefined}
                onClick={() => setVybrane((v) => (ano ? v.filter((u) => u !== karta.uid) : [...v, karta.uid]))}
              >
                {ano ? "✓ beriem" : "vziať"}
              </button>
            </span>
          );
        })}
        <span className="kseft-ponuka-riadok potvrdenie">
          <button type="button" className="kseft-ponuka-hlavne" disabled={vybrane.length === 0} onClick={() => k.akcia.typ === "karty" && posli(k.akcia.prikaz(vybrane))}>
            {vybrane.length === 0 ? "vyber karty" : `vziať ${vybrane.length} za ${cigariet(vybrane.length * k.akcia.cenaZaKus)}`}
          </button>
          <button type="button" onClick={() => setOtvorena(false)}>
            zrušiť
          </button>
        </span>
      </>
    ) : ponukaVolby && k.akcia.typ === "volba" ? (
      <>
        <span className="kseft-ponuka-nadpis">{k.akcia.nadpis}</span>
        {k.akcia.riadky.map((r) => (
          <span key={r.kluc} className={`kseft-ponuka-riadok${r.vlavo === undefined ? " bez-vlavo" : ""}`}>
            {r.vlavo !== undefined && tlacidloVolby(r.vlavo)}
            <span className="kseft-ponuka-meno">{r.meno}</span>
            {tlacidloVolby(r.vpravo)}
          </span>
        ))}
      </>
    ) : (
      // Telefón: detail a veľké tlačidlo — štítok pod kartou je len pozvánka; nedostupný povie prečo.
      <>
        <span className="kseft-ponuka-nadpis">
          {druhNazov(k)} · {k.nazov}
        </span>
        <span className="kseft-ponuka-tip">
          <Detail k={k} />
        </span>
        <span className="kseft-ponuka-riadok potvrdenie">
          {ne ? (
            <span />
          ) : (
            <button type="button" className="kseft-ponuka-hlavne" onClick={vykonaj}>
              <Vymena das={<Cena k={k} />} dostanes={<span>{k.zisk}</span>} />
            </button>
          )}
          <button type="button" onClick={() => setOtvorena(false)}>
            {ne ? "zavrieť" : "zrušiť"}
          </button>
        </span>
      </>
    );
  const ponukaEl = otvorena && (
    <div
      ref={ponuka}
      className="kseft-ponuka"
      role="group"
      aria-label={ponukaVolby && (k.akcia.typ === "volba" || k.akcia.typ === "karty") ? k.akcia.nadpis : `${druhNazov(k)} · ${k.nazov}`}
      style={poloha === null ? { visibility: "hidden", left: 0, top: 0 } : { left: poloha.left, top: poloha.top }}
    >
      {obsahPonuky}
    </div>
  );

  return (
    <span className={`kseft-pod${k.pouzity ? " pouzity" : ""}`} ref={obal} data-vyucba={klucVyucbyKseftu(k)}>
      <button
        type="button"
        className={`pecat pecat-nakup kseft-pod-tlacidlo${ne ? " ne" : ""}`}
        aria-disabled={ne}
        aria-expanded={ponukaVolby || naDotyk ? otvorena : undefined}
        aria-haspopup={ponukaVolby || naDotyk ? "true" : undefined}
        aria-label={`${druhNazov(k)} · ${k.nazov}: ${k.zisk}${k.dovod === null ? "" : ` — ${k.dovod}`}`}
        onMouseEnter={(e) => !naDotyk && napoveda.ukaz(e.currentTarget, obsahNapovedy(k))}
        onMouseLeave={napoveda.skry}
        onFocus={(e) => !naDotyk && napoveda.ukaz(e.currentTarget, obsahNapovedy(k))}
        onBlur={napoveda.skry}
        onClick={(e) => {
          napoveda.skry();
          if (naDotyk && !ponukaVolby) {
            // Telefón: najprv detail s veľkým tlačidlom (alebo s dôvodom, prečo nie).
            setOtvorena((o) => !o);
            return;
          }
          if (ne) {
            onNedostupny?.(k.dovod ?? "", e.clientX, e.clientY);
            return;
          }
          if (ponukaVolby) setOtvorena((o) => !o);
          else vykonaj();
        }}
      >
        {/* Schopnosť väzňa po použití nesie značku „použitá“ (raz za hru); Kšeft len ✓ do konca Pitky. */}
        <span className="kseft-pod-nazov">{k.druh === "vazen" && k.pouzity ? "použitá" : `${druhNazov(k)}${k.pouzity ? " ✓" : ""}`}</span>
        {!k.pouzity && k.druh !== "vazen" && <Cena k={k} />}
        {ponukaVolby && <span aria-hidden="true">{otvorena ? "▾" : "▴"}</span>}
      </button>
      {napoveda.tip}
      {/* Server (test) nemá document — ponuka sa vykreslí na mieste. */}
      {ponukaEl !== false && (typeof document === "undefined" ? ponukaEl : createPortal(ponukaEl, document.body))}
    </span>
  );
}
