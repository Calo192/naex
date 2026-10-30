// Ponuka pokusu o zajatie (v9; do v8 ponuka patronátu #110, Michal 2026-10-26): hráč nesmie
// vyberať naslepo — každý starší, ktorého smie skúsiť zajať, leží na stole ako karta
// v čitateľnej veľkosti s akciami po stranách (boss), s priazňou súpera a cenou. Klik na kartu
// alebo na „zajať“ ho vyberie (potom potvrdenie pečaťou).

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { CenaCigariet } from "./Panely.tsx";
import { rozlozeniePonuky } from "./rozlozeniePonuky.ts";

export interface MoznostPatronatu {
  readonly elderId: string;
  readonly meno: string;
  /** Karta staršieho s akciami (HernaKarta s lupou) v danej šírke; klik na ňu ho vyberie. */
  readonly karta: (sirka: number) => ReactNode;
  /** Priazeň, ktorú starší hráčovi teraz prejavuje (scorecard a jej účinok). */
  readonly priazen: { readonly sila: number; readonly nazov: string; readonly kratko: string; readonly cely: string };
  readonly cigarety: number;
  /** Čo väzeň dá: poradie zajatia v partii, špaky po finále a či je to tretí (výhra). */
  readonly vazen: { readonly poradie: number; readonly spaky: number; readonly vyhra: boolean };
  readonly vyber: () => void;
}

export function PonukaPatronatu({
  moznosti,
  menoSupera,
  vsetci,
}: {
  readonly moznosti: readonly MoznostPatronatu[];
  readonly menoSupera: string;
  /** Prepne stôl na celú líniu starších (markery, súboje); späť tlačidlom v línii. */
  readonly vsetci: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rozmer, setRozmer] = useState<{ readonly w: number; readonly h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setRozmer({ w: Math.floor(z?.contentRect.width ?? 0), h: Math.floor(z?.contentRect.height ?? 0) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { sirka, textPod, naStlpec } = rozlozeniePonuky(rozmer.w, rozmer.h, moznosti.length);
  return (
    <div className="ponuka-patronatu" ref={ref} data-vyucba="ponuka-patronatu">
      <div className="pp-hlava">
        <b>Pokus o zajatie — koho skúsiš zajať?</b>
        <span className="pp-tlmene">karta pôjde {menoSupera} do ruky, marker sa v tomto kole nehýbe; vyhráš bitku — je tvoj väzeň; myšou na kartu ju zväčšíš</span>
        <button type="button" className="ls-tlacidlo" onClick={vsetci}>
          všetci starší →
        </button>
      </div>
      <div className={`pp-moznosti${textPod ? " text-pod" : ""}`}>
        {sirka > 0 &&
          moznosti.map((m) => (
            <div key={m.elderId} className="pp-moznost" style={{ maxWidth: naStlpec }}>
              <div className="pp-karta">{m.karta(sirka)}</div>
              <div className="pp-text" style={textPod ? { width: sirka } : undefined}>
                <b className="pp-meno">{m.meno}</b>
                <span className="pp-priazen" title={m.priazen.cely}>
                  ♥ {menoSupera} +{m.priazen.sila} · {m.priazen.nazov}: {m.priazen.kratko}
                </span>
                <span className="pp-cena">
                  {m.cigarety > 0 ? (
                    <>
                      <CenaCigariet n={m.cigarety} /> ·{" "}
                    </>
                  ) : (
                    "zadarmo · "
                  )}
                  väzeň {m.vazen.poradie}. v partii: {m.vazen.spaky} {m.vazen.spaky === 1 ? "špak" : m.vazen.spaky <= 4 ? "špaky" : "špakov"}{m.vazen.vyhra ? " · tretí = výhra" : ""}
                </span>
                <button type="button" className="tlacidlo-hlavne pp-vziat" onClick={m.vyber}>
                  zajať {m.meno}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
