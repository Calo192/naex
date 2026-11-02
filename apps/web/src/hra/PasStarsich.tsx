// Pás starších na konci partie (Michal 2026-10-31, rozhodnutie 5 k mockupu „Priazeň podľa Michala“):
// všetci starší s krúžkom priazne a strachom a rečami oboch (v11) tak, ako partia skončila. Nápoveda nad
// staršom (myš, fokus, podržanie prsta) povie aj to, koľko špakov komu počas partie dal.

import type { CSSProperties } from "react";
import type { ClientState, ElderState, GameData } from "@naex/core";
import { favourStarsieho, opponentOf } from "@naex/core";
import { farbaZony } from "./LiniaStarsich.tsx";
import { KruzokPriazne, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { ktoPriazen, kratkeMeno, obsahNapovedy, priazenKola, spakyOdStarsieho } from "./priazenKola.ts";

export interface PasStarsichProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly obrazok: (defId: string) => string | null;
}

export function PasStarsich({ view, data, mena, menoKarty, obrazok }: PasStarsichProps) {
  const su = opponentOf(view.ja);
  if (view.starsi.length + view.vazni.length === 0) return null;
  return (
    <section className="pas-starsich" aria-label="Starší na konci partie">
      <h3 className="pas-st-nadpis">Starší na konci partie</h3>
      <ul className="pas-st-rad">
        {view.starsi.map((e) => (
          <StarsiVPase key={e.elderId} view={view} data={data} e={e} mena={mena} meno={menoKarty(e.karta.defId)} obrazok={obrazok(e.karta.defId)} />
        ))}
        {/* Väzeň nedáva priazeň ani strach — len portrét a čí je. */}
        {view.vazni.map((v) => {
          const o = obrazok(v.karta.defId);
          const kto = v.hrac === view.ja ? "tvoj väzeň" : `väzeň: ${kratkeMeno(mena[su])}`;
          return (
            <li key={v.elderId} className={`pas-st vazen ${v.hrac === view.ja ? "ja" : "su"}`} title={`${menoKarty(v.karta.defId)} — ${kto}`}>
              <span className="pas-st-portret">{o !== null && <img src={o} alt="" draggable={false} />}</span>
              <span className="pas-st-meno">{menoKarty(v.karta.defId)}</span>
              <span className="pas-st-vazen">{kto}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StarsiVPase({
  view,
  data,
  e,
  mena,
  meno,
  obrazok,
}: {
  readonly view: ClientState;
  readonly data: GameData;
  readonly e: ElderState;
  readonly mena: readonly [string, string];
  readonly meno: string;
  readonly obrazok: string | null;
}) {
  const ja = view.ja;
  const su = opponentOf(ja);
  const fav = favourStarsieho(data, e);
  const pk = priazenKola(e, ja);
  const spaky = spakyOdStarsieho(view.nastenka, e.elderId);
  const textSpakov = `ty +${spaky[ja]} · ${kratkeMeno(mena[su])} +${spaky[su]}`;
  const napoveda = useNapovedaStarsieho(
    () => obsahNapovedy({ data, elder: e, meno, ja, mena, dalsi: { nazov: "Dal špaky", text: textSpakov } }),
    {
      menoSupera: mena[su],
      zvacsenina: () => (
        <span className="np-zoom-karta">
          <span className="np-zoom-portret">
            {obrazok !== null && <img src={obrazok} alt="" draggable={false} />}
            <KruzokPriazne fav={fav} p={pk} velkost={46} />
          </span>
          <b>{meno}</b>
        </span>
      ),
    },
  );
  return (
    <li
      className="pas-st"
      tabIndex={0}
      aria-label={`${meno}: priazeň ${ktoPriazen(pk, { ja: "ty", su: mena[su] })}; špaky za strach a reči počas partie ${textSpakov}`}
      {...napoveda.props}
    >
      <span className="pas-st-portret">
        {obrazok !== null && <img src={obrazok} alt="" draggable={false} />}
        <KruzokPriazne fav={fav} p={pk} trieda="pas-st-kruzok" />
      </span>
      <span className="pas-st-meno">{meno}</span>
      <span className="pas-st-markery" aria-hidden="true">
        {[ja, su].map((p) => (
          <span key={p} className={`pas-st-tep ${p === ja ? "ja" : "su"}`}>
            {([1, 2, 3] as const).map((z) => (
              <i key={z} className={e.strach[p] >= z ? "on" : e.reci[p] === z ? "reci" : ""} style={e.strach[p] >= z || e.reci[p] === z ? ({ "--farba": farbaZony(z) } as CSSProperties) : undefined} />
            ))}
          </span>
        ))}
      </span>
      {napoveda.vrstva}
    </li>
  );
}
