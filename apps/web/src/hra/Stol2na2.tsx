// Stôl 2 na 2, rozloženie A (Michal 2026-11-06, docs/napady/2na2-stol-mock.html): dnešný stôl ostáva,
// pribudne bočný panel s tímom, rukou partnera, signálmi a chatom. Herňa a čakáreň sú len tu,
// aby sa lobby 1 na 1 nemenilo. Klient len posiela zámery, čo smie, rozhodne server.

import { useState } from "react";
import type { CardInstance, ClientState, GameData, Miesto } from "@naex/core";
import { defOf, timMiesta } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { Avatar } from "../komponenty.tsx";
import { vzhladKarty } from "./HernaKarta.tsx";
import type { SpravaTimu, Stol2na2Info } from "./useHra.ts";
import "./stol2na2.css";
import { nazovKarty, t, tZoServera } from "../i18n/jazyk.tsx";

/** Herňa 2 na 2 v lobby: pozvánka kódom, voľné miesta, náhodné párovanie, boti. */
export function Lobby2na2({
  zaloz,
  nahodne,
  pripoj,
}: {
  readonly zaloz: (verejny: boolean, boti: readonly number[]) => void;
  readonly nahodne: () => void;
  readonly pripoj: (code: string) => void;
}) {
  const [kod, setKod] = useState("");
  return (
    <section className="panel">
      <h2>2 na 2</h2>
      <p className="tlmene">{t("stol2na2.uvod")}</p>
      <div className="riadok-tlacidiel">
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => zaloz(false, [])}>
          {t("stol2na2.zalozit")}
        </button>
        <button type="button" className="tlacidlo" onClick={nahodne}>
          {t("stol2na2.nahodne")}
        </button>
        <button type="button" className="tlacidlo st2-boti" onClick={() => zaloz(false, [1, 2, 3])}>
          {t("stol2na2.sBotmi")}
        </button>
      </div>
      <form
        className="riadok-tlacidiel"
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (kod.trim() !== "") pripoj(kod.trim().toUpperCase());
        }}
      >
        <input aria-label={t("stol2na2.kodStola")} placeholder={t("stol2na2.kodStola")} value={kod} maxLength={4} onChange={(e) => setKod(e.target.value)} />
        <button type="submit" className="tlacidlo">
          {t("stol2na2.pripojit")}
        </button>
      </form>
    </section>
  );
}

function menoMiesta(stol: Stol2na2Info, m: Miesto): string {
  return stol.miesta[m]?.meno ?? t("stol2na2.volneMiesto");
}

/** Čakáreň: štyri miesta po tímoch, kód na pozvanie, doplnenie botmi. */
export function Cakaren2na2({
  stol,
  botmi,
  odist,
}: {
  readonly stol: Stol2na2Info;
  readonly botmi: () => void;
  readonly odist: () => void;
}) {
  const tim = (tm: 0 | 1, nazov: string) => (
    <div className="st2-tim">
      <h3>{nazov}</h3>
      <ul>
        {([tm, (tm + 2) as Miesto] as const).map((m) => (
          <li key={m} className="st2-hrac">
            <Avatar avatar={stol.miesta[m]?.avatar ?? null} meno={menoMiesta(stol, m as Miesto)} />
            <span>{menoMiesta(stol, m as Miesto)}</span>
            {stol.miesta[m]?.bot === true && <span className="st2-znacka">{t("stol2na2.bot")}</span>}
            {m === stol.miesto && <span className="st2-znacka">{t("stol2na2.ty")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="formular-stred panel">
      <h2>{t("stol2na2.stol")}</h2>
      <p>
        {t("stol2na2.kodNaPozvanie")} <b className="st2-kod">{stol.code}</b>
      </p>
      <div className="st2-timy">
        {tim(0, t("stol2na2.tim", { cislo: 1 }))}
        {tim(1, t("stol2na2.tim", { cislo: 2 }))}
      </div>
      <div className="riadok-tlacidiel">
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={botmi}>
          {t("stol2na2.doplnit")}
        </button>
        <button type="button" className="tlacidlo" onClick={odist}>
          {t("stol2na2.odist")}
        </button>
      </div>
    </div>
  );
}

function MalaKarta({ data, sada, karta }: { readonly data: GameData; readonly sada: Sada; readonly karta: CardInstance }) {
  const obrazok = vzhladKarty(sada, data, karta.defId).obrazok;
  const meno = nazovKarty(defOf(data, karta).name);
  return (
    <figure className="st2-karta" title={meno}>
      {obrazok !== null && <img src={mediaUrl(obrazok.nahlad)} alt="" loading="lazy" />}
      <figcaption>{meno}</figcaption>
    </figure>
  );
}

/** Bočný panel počas partie. */
export function Panel2na2({
  stol,
  view,
  data,
  sada,
  spravy,
  signal,
  chat,
  odovzdajOdpoved,
  potvrdVzdanie,
  zrusVzdanie,
}: {
  readonly stol: Stol2na2Info;
  readonly view: ClientState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly spravy: readonly SpravaTimu[];
  readonly signal: (id: string) => void;
  readonly chat: (text: string) => void;
  readonly odovzdajOdpoved: () => void;
  readonly potvrdVzdanie: () => void;
  readonly zrusVzdanie: () => void;
}) {
  const [text, setText] = useState("");
  const ja = stol.miesto;
  const partner = ((ja + 2) % 4) as Miesto;
  const kapitan = (tm: 0 | 1): Miesto => ((view.kapitani?.[tm] ?? 0) * 2 + tm) as Miesto;
  // Poradie U1 → O1 → U2 → O2: prví sú kapitáni kola.
  const u = view.utocnik;
  const o = (u === 0 ? 1 : 0) as 0 | 1;
  const poradie: readonly Miesto[] = [kapitan(u), kapitan(o), ((kapitan(u) + 2) % 4) as Miesto, ((kapitan(o) + 2) % 4) as Miesto];
  const somKapitan = kapitan(timMiesta(ja)) === ja;
  const odpovedam = view.faza === "pitka" && view.pitkaStav?.reakcia === view.ja && view.miestoNaTahu === ja;
  const nazovMiesta = (m: Miesto): string => menoMiesta(stol, m);
  const navrh = stol.navrhVzdania;

  return (
    <aside className="st2-panel" aria-label={t("stol2na2.timPanel")}>
      <ol className="st2-poradie" aria-label={t("stol2na2.poradie")}>
        {poradie.map((m) => (
          <li key={m} className={m === view.miestoNaTahu ? "ted" : timMiesta(m) === view.ja ? "nasi" : ""}>
            {nazovMiesta(m)}
          </li>
        ))}
      </ol>

      <section>
        <h3>{t("stol2na2.partner", { meno: nazovMiesta(partner) })}</h3>
        {stol.miesta[partner]?.pripojeny === false && <p className="st2-pozor">{t("stol2na2.odpojeny")}</p>}
        {kapitan(timMiesta(ja)) === partner && <p className="tlmene">{t("stol2na2.kapitanPartner")}</p>}
        <div className="st2-ruka">
          {(view.rukaPartnera ?? []).map((k) => (
            <MalaKarta key={k.uid} data={data} sada={sada} karta={k} />
          ))}
        </div>
      </section>

      {odpovedam && somKapitan && (
        <button type="button" className="tlacidlo" onClick={odovzdajOdpoved}>
          {t("stol2na2.odpoviePartner")}
        </button>
      )}

      {navrh !== null && (
        <div className="st2-pozor" role="alert">
          {navrh === ja ? (
            <>
              <p>{t("stol2na2.navrholSi")}</p>
              <button type="button" className="tlacidlo" onClick={zrusVzdanie}>
                {t("stol2na2.zrusitNavrh")}
              </button>
            </>
          ) : (
            <>
              <p>{t("stol2na2.navrhuje", { meno: nazovMiesta(navrh) })}</p>
              <div className="riadok-tlacidiel">
                <button type="button" className="tlacidlo" onClick={potvrdVzdanie}>
                  {t("stol2na2.vzdat")}
                </button>
                <button type="button" className="tlacidlo" onClick={zrusVzdanie}>
                  {t("stol2na2.hrameDalej")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <section>
        <h3>{t("stol2na2.signal")}</h3>
        <div className="st2-signaly">
          {stol.signaly.map((s) => (
            <button key={s.id} type="button" className="tlacidlo-jemne" onClick={() => signal(s.id)}>
              {tZoServera(`stol2na2.signaly.${s.id}`, s.text)}
            </button>
          ))}
        </div>
      </section>

      <section className="st2-chat">
        <h3>{t("stol2na2.chat")}</h3>
        <ul aria-live="polite">
          {spravy.slice(-20).map((s, i) => (
            <li key={i} className={s.signal ? "signal" : ""}>
              <b>{s.od === ja ? t("stol2na2.tyVelke") : nazovMiesta(s.od)}:</b> {s.text}
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() === "") return;
            chat(text);
            setText("");
          }}
        >
          <input aria-label={t("stol2na2.spravaPartnerovi")} placeholder={t("stol2na2.spravaPlaceholder")} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
        </form>
      </section>
    </aside>
  );
}
