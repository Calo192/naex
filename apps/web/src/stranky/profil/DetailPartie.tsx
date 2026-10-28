// Detail partie (Michal 2026-10-22): priebeh bodov po kolách, kolá a záverečné
// bodovanie ako krčmový účet (KrcmovyUcet). Vidí ho účastník a správca;
// súperove skryté čísla server neposiela.

import { useEffect, useMemo, useState } from "react";
import { NAZOV_DLZKY, loadGameData, type DlzkaHry, type PlayerId } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import { api } from "../../lib/api.ts";
import { Odkaz, useTitulok } from "../../lib/router.tsx";
import { useSada } from "../../lib/sada.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../../komponenty.tsx";
import { HlavaStranky } from "../../HlavaStranky.tsx";
import { KrcmovyUcet } from "../../hra/KrcmovyUcet.tsx";
import { UcetSpakov } from "../../hra/UcetSpakov.tsx";
import { Nastenka } from "../../hra/Spaky.tsx";
import { tvar } from "../Statistiky.tsx";
import { TEXT_VYSLEDKU, datum, trvanie, type DetailPartieApi } from "./typy.ts";
import "./profil.css";

/** Body oboch po kolách ako dve čiary (ty a súper). */
function PriebehBodov({ body, mena, ja }: { readonly body: readonly (readonly [number, number])[]; readonly mena: readonly [string, string]; readonly ja: PlayerId }) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const w = 640;
  const h = 180;
  const p = 28;
  const vsetky = body.flat();
  const min = Math.min(0, ...vsetky);
  const max = Math.max(1, ...vsetky);
  const x = (i: number): number => p + (body.length <= 1 ? 0 : (i * (w - 2 * p)) / (body.length - 1));
  const y = (v: number): number => h - p - ((v - min) * (h - 2 * p)) / (max - min);
  const ciara = (k: PlayerId): string => body.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b[k]).toFixed(1)}`).join(" ");
  return (
    <svg className="priebeh-bodov" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Body po kolách: ${mena[ja]} ${body.map((b) => b[ja]).join(", ")}; ${mena[su]} ${body.map((b) => b[su]).join(", ")}`}>
      <line x1={p} x2={w - p} y1={y(0)} y2={y(0)} className="priebeh-nula" />
      <path d={ciara(su)} className="priebeh-su" />
      <path d={ciara(ja)} className="priebeh-ja" />
      {body.map((b, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(b[ja])} r={4} className="priebeh-ja-bod" />
          <circle cx={x(i)} cy={y(b[su])} r={4} className="priebeh-su-bod" />
          <text x={x(i)} y={h - 6} textAnchor="middle" className="priebeh-kolo">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function DetailPartie({ id }: { readonly id: number }) {
  const { sada } = useSada();
  const [d, setD] = useState<DetailPartieApi | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  useTitulok("Detail partie");
  useEffect(() => {
    let zive = true;
    api
      .get<DetailPartieApi>(`/partie/${id}`)
      .then((x) => zive && setD(x))
      .catch((e: unknown) => zive && setChyba(e instanceof Error ? e.message : String(e)));
    return () => {
      zive = false;
    };
  }, [id]);
  // Prehrávač ponúkne len partia, ktorú server vie prehrať (rovnaká verzia jadra a sady).
  const [prehratelna, setPrehratelna] = useState<{ readonly dostupny: boolean; readonly dovod: string | null } | null>(null);
  useEffect(() => {
    let zive = true;
    api
      .get<{ dostupny: boolean; dovod: string | null }>(`/partie/${id}/kroky`)
      .then((k) => zive && setPrehratelna(k))
      .catch(() => undefined);
    return () => {
      zive = false;
    };
  }, [id]);
  const data = useMemo(() => (sada === null ? null : loadGameData(sada.cardsJson, eldersJson, sada.scorecardsJson ?? scorecardsJson)), [sada]);

  if (chyba !== null) {
    return (
      <HlavaStranky nadpis="Partia sa nenašla" uvod={chyba} />
    );
  }
  if (d === null || data === null) return <Nacitavanie />;

  // Správca, ktorý nehral, sa pozerá z miesta hráča 1.
  const ja: PlayerId = d.ja ?? 0;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const mena: [string, string] = [d.hraci[0].meno, d.hraci[1].meno];
  // Partie v6: víťazné body sú špaky (Michal 2026-10-26); staršie archívy ostávajú v bodoch.
  const v6 = d.zaverecne !== null && "verzia" in d.zaverecne;
  const ty = (p: PlayerId): string => (d.ja === p ? "ty" : mena[p]);
  const menoLokality = (defId: string | null): string => (defId === null ? "—" : (data.cards.get(defId)?.name ?? defId));
  const bodyPo = d.kola.flatMap((k) => (k.bodyPo === null ? [] : [k.bodyPo]));
  const moj = d.hraci[ja];

  return (
    <div className="profil-hraca detail-partie">
      <HlavaStranky nadpis={`${mena[ja]} – ${mena[su]}`} uvod={`Partia z ${datum(d.koniec)}, kolo po kole.`} />
      <section className="panel profil-hlavicka detail-hlavicka">
        {([ja, su] as const).map((p) => {
          const h = d.hraci[p];
          return (
            <div key={p} className={`detail-hrac ${p === ja ? "ja" : "su"}`}>
              <Avatar meno={h.meno} avatar={h.avatar} velkost={64} />
              <div>
                <strong>{h.id === null ? h.meno : <Odkaz href={`/hrac/${h.id}`}>{h.meno}</Odkaz>}</strong>
                {h.bot !== undefined && <span className="odznak">bot</span>}
                <span className={`vysledok-stitok ${h.vysledok}`}>{TEXT_VYSLEDKU[h.vysledok]}</span>
                <span className="tlmene">
                  {h.body === null ? "" : `${h.body} b`}
                  {h.frajerina !== null && ` · Frajerina ${h.frajerina.pred} → ${h.frajerina.po}`}
                </span>
              </div>
            </div>
          );
        })}
        <p className="detail-meta tlmene">
          {datum(d.koniec)} · {d.kola.length > 0 ? `${d.kola.length} ${tvar(d.kola.length, "kolo", "kolá", "kôl")} · ` : ""}
          {trvanie(d.trvanie)}
          {d.dlzka !== null && ` · ${NAZOV_DLZKY[d.dlzka as DlzkaHry] ?? d.dlzka}`}
          {!d.dohrata && " · nedohraná"}
          {d.verziaPravidiel !== null && ` · pravidlá ${d.verziaPravidiel}`}
          {` · ${d.dovod}`}
        </p>
        {prehratelna !== null && (
          <div className="detail-prehrat">
            {prehratelna.dostupny ? (
              <Odkaz href={`/partia/${id}/prehravac`} className="tlacidlo tlacidlo-hlavne">
                ▶ Prehrať partiu
              </Odkaz>
            ) : (
              <span className="tlmene">Prehrávač: {prehratelna.dovod}</span>
            )}
          </div>
        )}
      </section>

      {bodyPo.length > 1 && (
        <section className="panel profil-karta">
          <header className="profil-karta-hlava">
            <h2>{v6 ? "Priebeh špakov" : "Priebeh bodov (partia do v5)"}</h2>
            <span className="tlmene">
              <span className="priebeh-legenda ja">{ty(ja)}</span> · <span className="priebeh-legenda su">{mena[su]}</span> ·{" "}
              {v6 ? "špaky v popolníku po kole" : "body po kole, keby sa skončilo"}
            </span>
          </header>
          <PriebehBodov body={bodyPo} mena={mena} ja={ja} />
        </section>
      )}

      {d.kola.length > 0 ? (
        <section className="panel profil-karta">
          <h2>Kolá</h2>
          <div className="tabulka-obal">
            <table className="suhrn-tabulka kola-tabulka">
              <thead>
                <tr>
                  <th>Kolo</th>
                  <th>Lokalita</th>
                  <th>Útočník</th>
                  <th>Tuhé</th>
                  <th>Víťaz</th>
                  <th>Prebytok</th>
                  <th>NA EX</th>
                  <th>Pas</th>
                  <th>Šenok</th>
                  <th>Kliatby</th>
                  <th>{v6 ? "Špaky" : "Body"}</th>
                </tr>
              </thead>
              <tbody>
                {d.kola.map((k) => (
                  <tr key={k.cislo} className={k.vitaz === null ? "" : k.vitaz === ja ? "vyhra" : "prehra"}>
                    <th scope="row">{k.cislo}</th>
                    <td>
                      {k.lokalita === null && v6 ? "finále" : menoLokality(k.lokalita)}
                      {k.sekera && (v6 ? " · sekera" : " · na sekeru")}
                    </td>
                    <td>{ty(k.utocnik)}</td>
                    <td className="cislo">
                      {k.tuhe[ja]} : {k.tuhe[su]}
                    </td>
                    <td>{k.vitaz === null ? "remíza" : ty(k.vitaz)}</td>
                    <td>{k.prebytok === null ? "—" : `${ty(k.prebytok.drzi)} ${k.prebytok.kolko}`}</td>
                    <td>
                      {k.naex.length === 0
                        ? "—"
                        : k.naex.map((n, i) => (
                            <span key={i} className={n.uspech === true ? "dobre" : n.uspech === false ? "zle" : ""} title={n.uspech === null ? "nedalo sa posúdiť" : n.uspech ? "zlepšilo bitku" : "nezlepšilo bitku"}>
                              {i > 0 && ", "}
                              {ty(n.kto)}
                            </span>
                          ))}
                    </td>
                    <td>{k.pasy.length === 0 ? "—" : k.pasy.map((x) => `${ty(x.kto)} +${x.cigarety}`).join(", ")}</td>
                    <td className="cislo">
                      {k.senok[ja]} : {k.senok[su]}
                    </td>
                    <td className="cislo" title="nové Dlhy · Cirhózy (ty : súper)">
                      {k.dlhy[ja] + k.cirhozy[ja]} : {k.dlhy[su] + k.cirhozy[su]}
                    </td>
                    <td className="cislo">{k.bodyPo === null ? "—" : `${k.bodyPo[ja]} : ${k.bodyPo[su]}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="panel profil-karta">
          <p className="tlmene">Táto partia je zo staršieho archívu — priebeh po kolách sa vtedy ešte nezapisoval.</p>
        </section>
      )}

      {d.zaverecne !== null && "verzia" in d.zaverecne ? (
        <section className="profil-karta detail-ucet">
          <h2>Záverečný účet špakov</h2>
          {/* Krčmová nástenka (v6): kto vyhral ktorú bitku a koľko špakov za ňu dostal. */}
          {d.zaverecne.nastenka.length > 0 && (
            <Nastenka
              nastenka={d.zaverecne.nastenka}
              zostava={[]}
              ciel={null}
              ja={ja}
              mena={mena}
              avatary={[d.hraci[0].avatar, d.hraci[1].avatar]}
              menoKarty={(defId) => menoLokality(defId)}
              kompaktna
              koniec
            />
          )}
          <div className="detail-ucet-obal">
            <UcetSpakov rozpis={d.zaverecne.rozpis} ja={ja} mena={mena} />
          </div>
        </section>
      ) : d.zaverecne !== null ? (
        <section className="profil-karta detail-ucet">
          <h2>Záverečné body (partia do v5)</h2>
          <div className="detail-ucet-obal">
            <KrcmovyUcet
              body={d.zaverecne}
              data={data}
              ja={ja}
              mena={mena}
              menoStarsieho={(elderId) => d.menaStarsich[elderId] ?? elderId}
              kolo={d.kola.length}
            />
          </div>
        </section>
      ) : (
        moj.body !== null && <Hlaska druh="info">Rozpis záverečného účtu sa pri tejto partii nezapísal (starší archív).</Hlaska>
      )}
    </div>
  );
}
