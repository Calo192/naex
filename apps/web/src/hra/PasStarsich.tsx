// Pás starších na konci partie (Michal 2026-10-31, rozhodnutie 5 k mockupu „Priazeň podľa Michala“):
// všetci starší s krúžkom priazne a dvojitým markerom tak, ako partia skončila. Nápoveda nad
// staršom (myš, fokus, podržanie prsta) povie aj to, koľko špakov komu počas partie dal.

import type { CSSProperties } from "react";
import type { ClientState, ElderState, GameData, PlayerId } from "@naex/core";
import { STUPNICA_ZONY, favourStarsieho, klebetyKola, obavanyHrac, strachNaUdrzanie, strachNaVyplatu } from "@naex/core";
import { farbaZony } from "./LiniaStarsich.tsx";
import { KruzokPriazne, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { dvojityMarker, ktoPriazen, kratkeMeno, obsahNapovedy, priazenKola, spakyOdStarsieho } from "./priazenKola.ts";

export interface PasStarsichProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly obrazok: (defId: string) => string | null;
}

export function PasStarsich({ view, data, mena, menoKarty, obrazok }: PasStarsichProps) {
  const su: PlayerId = view.ja === 0 ? 1 : 0;
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
  const su: PlayerId = ja === 0 ? 1 : 0;
  const klebety = klebetyKola(view);
  const fav = favourStarsieho(data, e);
  const pk = priazenKola(e, klebety, ja);
  const dm = dvojityMarker(e, klebety, ja);
  const spaky = spakyOdStarsieho(view.nastenka, e.elderId);
  const textSpakov = `ty +${spaky[ja]} · ${kratkeMeno(mena[su])} +${spaky[su]}`;
  const napoveda = useNapovedaStarsieho(
    () => {
      const o = obavanyHrac(e);
      return obsahNapovedy({
        data,
        elder: e,
        meno,
        klebety,
        ja,
        mena,
        spaky: o === null ? 0 : strachNaVyplatu(e, o),
        naUdrzanie: o === null ? 0 : strachNaUdrzanie(e, o),
        dalsi: { nazov: "Dal špaky", text: textSpakov },
      });
    },
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
      aria-label={`${meno}: priazeň ${ktoPriazen(pk, { ja: "ty", su: mena[su] })}; špaky za strach počas partie ${textSpakov}`}
      {...napoveda.props}
    >
      <span className="pas-st-portret">
        {obrazok !== null && <img src={obrazok} alt="" draggable={false} />}
        <KruzokPriazne fav={fav} p={pk} trieda="pas-st-kruzok" />
      </span>
      <span className="pas-st-meno">{meno}</span>
      <span className="pas-st-stupnica" aria-hidden="true">
        {STUPNICA_ZONY.map((z, k) => (
          <i key={k} style={{ background: farbaZony(z), "--z": z } as CSSProperties} />
        ))}
        <b className="dm-prsten" style={{ "--p": dm.prsten } as CSSProperties} />
        <b className={`dm-bodka${dm.komu === null ? "" : ` ${dm.komu}`}`} style={{ "--p": dm.bodka } as CSSProperties} />
      </span>
      {napoveda.vrstva}
    </li>
  );
}
