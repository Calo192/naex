// Kšeft Predsedovej vily (v7): za 2 cigarety posun markera jedného staršieho o pole. Výber bol
// natívny rozbaľovač so 16 položkami „X od seba / X k sebe“ — v playteste výučby 20261030 (krok
// k-kseft) sa v ňom zasekli všetci traja nováčikovia, klik myšou na položku nezabral. Teraz je to
// pečiatka, ktorá otvorí tlačidlá: riadok na staršieho, „k sebe“ vľavo a „od seba“ vpravo — ako na
// stupnici, kde má každý svoju polovicu vľavo (LiniaStarsich).

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Command } from "@naex/core";
import { klucVily, type MoznostVily } from "./volbaVily.ts";

export function KseftVily({
  uid,
  moznosti,
  meno,
  cmd,
  napis,
  otvorena: otvorenaNaZaciatku = false,
}: {
  /** Lokalita (Predsedova vila) — Kšeft sa posiela s jej uid. */
  readonly uid: number;
  readonly moznosti: readonly MoznostVily[];
  readonly meno: (defId: string) => string;
  readonly cmd: (c: Command) => void;
  /** Riadok pečiatky nad názvom (cena → čo dostaneš), ako pri ostatných nákupoch. */
  readonly napis: ReactNode;
  /** Len pre test — na stole sa ponuka otvorí klikom na pečiatku. */
  readonly otvorena?: boolean;
}) {
  const [otvorena, setOtvorena] = useState(otvorenaNaZaciatku);
  const obal = useRef<HTMLSpanElement>(null);
  // Ponuka sa zavrie klikom mimo nej alebo Esc — ako lupa či výber karty.
  useEffect(() => {
    if (!otvorena) return;
    const mimo = (e: PointerEvent): void => {
      if (e.target instanceof Node && obal.current?.contains(e.target) !== true) setOtvorena(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOtvorena(false);
    };
    window.addEventListener("pointerdown", mimo);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", mimo);
      window.removeEventListener("keydown", esc, true);
    };
  }, [otvorena]);
  const posli = (elderId: string, kSebe: boolean): void => {
    setOtvorena(false);
    cmd({ type: "kseft", uid, elderId, kSebe });
  };
  return (
    // Výučba (3. časť) svieti Kšeft vily ako tlacidlo:kseft.
    <span className="kseft-vila" ref={obal} data-vyucba="tlacidlo:kseft">
      <button
        type="button"
        className="pecat pecat-nakup"
        aria-expanded={otvorena}
        aria-haspopup="true"
        title="Kšeft vily: za 2 cigarety posunieš marker jedného staršieho o pole — vyberieš ktorého a kam."
        onClick={() => setOtvorena((o) => !o)}
      >
        <span className="pecat-riadok">{napis}</span>
        <span className="pecat-nazov">Vila {otvorena ? "▾" : "▴"}</span>
      </button>
      {otvorena && (
        <span className="kseft-vila-ponuka" role="group" aria-label="Kšeft vily: ktorého staršieho a kam posunúť">
          <span className="kseft-vila-nadpis">Kšeft vily · posuň marker o pole</span>
          {moznosti.map((m) => (
            <span key={m.elderId} className="kseft-vila-riadok">
              <button type="button" data-vyucba={klucVily(m.elderId, true)} onClick={() => posli(m.elderId, true)} title={`${meno(m.defId)}: marker o pole k sebe`}>
                ‹ k sebe
              </button>
              <span className="kseft-vila-meno">{meno(m.defId)}</span>
              <button type="button" data-vyucba={klucVily(m.elderId, false)} onClick={() => posli(m.elderId, false)} title={`${meno(m.defId)}: marker o pole od seba`}>
                od seba ›
              </button>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
