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
      <p className="tlmene">Dva tímy po dvoch, jedna línia. Partnerovu ruku vidíš, súperovu nie.</p>
      <div className="riadok-tlacidiel">
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => zaloz(false, [])}>
          Založiť stôl s pozvánkou
        </button>
        <button type="button" className="tlacidlo" onClick={nahodne}>
          Náhodné párovanie
        </button>
        <button type="button" className="tlacidlo st2-boti" onClick={() => zaloz(false, [1, 2, 3])}>
          Hrať s botmi
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
        <input aria-label="Kód stola" placeholder="Kód stola" value={kod} maxLength={4} onChange={(e) => setKod(e.target.value)} />
        <button type="submit" className="tlacidlo">
          Pripojiť sa
        </button>
      </form>
    </section>
  );
}

function menoMiesta(stol: Stol2na2Info, m: Miesto): string {
  return stol.miesta[m]?.meno ?? "voľné miesto";
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
  const tim = (t: 0 | 1, nazov: string) => (
    <div className="st2-tim">
      <h3>{nazov}</h3>
      <ul>
        {([t, (t + 2) as Miesto] as const).map((m) => (
          <li key={m} className="st2-hrac">
            <Avatar avatar={stol.miesta[m]?.avatar ?? null} meno={menoMiesta(stol, m as Miesto)} />
            <span>{menoMiesta(stol, m as Miesto)}</span>
            {stol.miesta[m]?.bot === true && <span className="st2-znacka">bot</span>}
            {m === stol.miesto && <span className="st2-znacka">ty</span>}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="formular-stred panel">
      <h2>Stôl 2 na 2</h2>
      <p>
        Kód na pozvanie: <b className="st2-kod">{stol.code}</b>
      </p>
      <div className="st2-timy">
        {tim(0, "Tím 1")}
        {tim(1, "Tím 2")}
      </div>
      <div className="riadok-tlacidiel">
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={botmi}>
          Doplniť botmi a začať
        </button>
        <button type="button" className="tlacidlo" onClick={odist}>
          Odísť
        </button>
      </div>
    </div>
  );
}

function MalaKarta({ data, sada, karta }: { readonly data: GameData; readonly sada: Sada; readonly karta: CardInstance }) {
  const obrazok = vzhladKarty(sada, data, karta.defId).obrazok;
  const meno = defOf(data, karta).name;
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
  const kapitan = (t: 0 | 1): Miesto => ((view.kapitani?.[t] ?? 0) * 2 + t) as Miesto;
  // Poradie U1 → O1 → U2 → O2: prví sú kapitáni kola.
  const u = view.utocnik;
  const o = (u === 0 ? 1 : 0) as 0 | 1;
  const poradie: readonly Miesto[] = [kapitan(u), kapitan(o), ((kapitan(u) + 2) % 4) as Miesto, ((kapitan(o) + 2) % 4) as Miesto];
  const somKapitan = kapitan(timMiesta(ja)) === ja;
  const odpovedam = view.faza === "pitka" && view.pitkaStav?.reakcia === view.ja && view.miestoNaTahu === ja;
  const nazovMiesta = (m: Miesto): string => menoMiesta(stol, m);
  const navrh = stol.navrhVzdania;

  return (
    <aside className="st2-panel" aria-label="Tím 2 na 2">
      <ol className="st2-poradie" aria-label="Poradie ťahov">
        {poradie.map((m) => (
          <li key={m} className={m === view.miestoNaTahu ? "ted" : timMiesta(m) === view.ja ? "nasi" : ""}>
            {nazovMiesta(m)}
          </li>
        ))}
      </ol>

      <section>
        <h3>Partner {nazovMiesta(partner)}</h3>
        {stol.miesta[partner]?.pripojeny === false && <p className="st2-pozor">Partner je odpojený.</p>}
        {kapitan(timMiesta(ja)) === partner && <p className="tlmene">V tomto kole je kapitánom partner.</p>}
        <div className="st2-ruka">
          {(view.rukaPartnera ?? []).map((k) => (
            <MalaKarta key={k.uid} data={data} sada={sada} karta={k} />
          ))}
        </div>
      </section>

      {odpovedam && somKapitan && (
        <button type="button" className="tlacidlo" onClick={odovzdajOdpoved}>
          Nech na NA EX odpovie partner
        </button>
      )}

      {navrh !== null && (
        <div className="st2-pozor" role="alert">
          {navrh === ja ? (
            <>
              <p>Navrhol si vzdať partiu, čaká sa na partnera.</p>
              <button type="button" className="tlacidlo" onClick={zrusVzdanie}>
                Zrušiť návrh
              </button>
            </>
          ) : (
            <>
              <p>{nazovMiesta(navrh)} navrhuje vzdať partiu.</p>
              <div className="riadok-tlacidiel">
                <button type="button" className="tlacidlo" onClick={potvrdVzdanie}>
                  Vzdať
                </button>
                <button type="button" className="tlacidlo" onClick={zrusVzdanie}>
                  Hráme ďalej
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <section>
        <h3>Signál partnerovi</h3>
        <div className="st2-signaly">
          {stol.signaly.map((s) => (
            <button key={s.id} type="button" className="tlacidlo-jemne" onClick={() => signal(s.id)}>
              {s.text}
            </button>
          ))}
        </div>
      </section>

      <section className="st2-chat">
        <h3>Tímový chat</h3>
        <ul aria-live="polite">
          {spravy.slice(-20).map((s, i) => (
            <li key={i} className={s.signal ? "signal" : ""}>
              <b>{s.od === ja ? "Ty" : nazovMiesta(s.od)}:</b> {s.text}
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
          <input aria-label="Správa partnerovi" placeholder="Správa, súper nevidí" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
        </form>
      </section>
    </aside>
  );
}
