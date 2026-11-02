// Tlačidlo Kšeftu pod kartou, ktorá ho ponúka (Michal 2026-11-02) — Strýko v línii, lokalita
// a väzeň v pivnici. Cena → čo dostaneš na tlačidle, celé znenie v nápovede. Voľba (Kšeft vily:
// starší a smer; Autobusár, Veterinár: karta) sa otvorí nad tlačidlom ako predtým ponuka vily
// (playtest výučby 20261030, k-kseft: rozbaľovač nezabral). Na telefóne je tlačidlo pod malou
// kartou úzke — ťuk otvorí rovnakú ponuku s veľkým tlačidlom (aspoň 44 px) a celým znením.
// Ponuka ide do <body>: línia sa posúva do strany (overflow) a harmonika ju posúva transformom.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Command } from "@naex/core";
import type { KseftNaStole, TlacidloVolby } from "./kseftyNaStole.ts";
import { CenaCigariet, IkonaPoldeci, Vymena } from "./ikonyZdrojov.tsx";

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

function Cena({ k }: { readonly k: KseftNaStole }) {
  return "cigarety" in k.cena ? (
    <CenaCigariet n={k.cena.cigarety} />
  ) : (
    <span className="cena-poldeci" title="vypitý plný poldeci">
      −1
      <IkonaPoldeci plny={false} />
    </span>
  );
}

export function KseftPodKartou({ kseft: k, cmd, naDotyk = false, onVykup, onNedostupny, otvorena: otvorenaNaZaciatku = false }: KseftPodKartouProps) {
  const [otvorena, setOtvorena] = useState(otvorenaNaZaciatku);
  const obal = useRef<HTMLSpanElement>(null);
  const ponuka = useRef<HTMLDivElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly top: number } | null>(null);
  const ne = k.dovod !== null;

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
    k.akcia.typ === "volba" ? (
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
      // Telefón: celé znenie a veľké tlačidlo — úzka pečiatka pod kartou je len pozvánka.
      <>
        <span className="kseft-ponuka-nadpis">Kšeft</span>
        <span className="kseft-ponuka-tip">{k.tip}</span>
        <span className="kseft-ponuka-riadok potvrdenie">
          <button type="button" className="kseft-ponuka-hlavne" onClick={vykonaj}>
            <Vymena das={<Cena k={k} />} dostanes={<span>{k.zisk}</span>} />
          </button>
          <button type="button" onClick={() => setOtvorena(false)}>
            zrušiť
          </button>
        </span>
      </>
    );
  const ponukaEl = otvorena && (
    <div
      ref={ponuka}
      className="kseft-ponuka"
      role="group"
      aria-label={k.akcia.typ === "volba" ? k.akcia.nadpis : "Kšeft"}
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
        aria-expanded={k.akcia.typ === "volba" || naDotyk ? otvorena : undefined}
        aria-haspopup={k.akcia.typ === "volba" || naDotyk ? "true" : undefined}
        title={k.dovod ?? k.tip}
        onClick={(e) => {
          if (ne) {
            onNedostupny?.(k.dovod ?? "", e.clientX, e.clientY);
            return;
          }
          if (k.akcia.typ === "volba" || (naDotyk && k.akcia.typ === "prikaz")) setOtvorena((o) => !o);
          else vykonaj();
        }}
      >
        <span className="kseft-pod-nazov">
          Kšeft{k.pouzity ? " ✓" : ""}
          {k.akcia.typ === "volba" && !ne && <span aria-hidden="true">{otvorena ? " ▾" : " ▴"}</span>}
        </span>
        {k.pouzity ? (
          <span className="kseft-pod-zisk">použitý</span>
        ) : (
          <Vymena das={<Cena k={k} />} dostanes={<span className="kseft-pod-zisk">{k.zisk}</span>} />
        )}
      </button>
      {/* Server (test) nemá document — ponuka sa vykreslí na mieste. */}
      {ponukaEl !== false && (typeof document === "undefined" ? ponukaEl : createPortal(ponukaEl, document.body))}
    </span>
  );
}
