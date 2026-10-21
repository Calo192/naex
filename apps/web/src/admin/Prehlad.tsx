// Prehľad tvorcu: stav návrhov oproti zverejnenej sade a zverejnenie.

import { useState } from "react";
import { kontrolaTextov, variantyKarty } from "@naex/tvorba";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Hlaska } from "../komponenty.tsx";
import { problemyNavrhov, useAdmin, zmeneneOdZverejnenia } from "./stav.tsx";
import { AdminHlava, Ikona } from "./spolocne.tsx";

const kariet = (n: number) => (n === 1 ? "karta" : n >= 2 && n <= 4 ? "karty" : "kariet");

export function Prehlad() {
  useTitulok("Tvorba kariet");
  const { obsah, sady, obnovSady, zverejni, obnov: obnovObsah } = useAdmin();
  const { sada, obnov: obnovSadu } = useSada();
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [caka, setCaka] = useState(false);

  if (obsah === null) return null;
  const posledna = sady?.[0];
  const zmenene = zmeneneOdZverejnenia(obsah, sady);
  const problemy = problemyNavrhov(obsah);
  const vytlacenych = obsah.karty.reduce((s, k) => s + variantyKarty(k).pocet * k.kopie, 0);
  // Texty efektov: preklepy, spúšťače a zmenený text efektu, ktorý hra vyhodnocuje kódom.
  const texty = kontrolaTextov(obsah.karty, { klucoveSlova: obsah.klucoveSlova, akcie: obsah.akcie, zverejnene: sada?.karty ?? [] });
  const chybyTextov = texty.filter((t) => t.uroven === "chyba").length;
  const stav = problemy.length > 0 ? "blokovane" : zmenene.length > 0 ? "pripravene" : "aktualne";
  const dalsia = obsah.zverejnenaVerzia + 1;

  // Návrat na staršiu sadu = jej opätovné zverejnenie ako nová verzia.
  const vratit = async (verzia: number) => {
    if (!window.confirm(`Vrátiť hru na sadu v${verzia}? Zverejní sa znova ako nová verzia a nové partie pobežia na nej.`)) return;
    const navrhy = window.confirm(
      `Vrátiť aj návrhy kariet v tvorcovi na stav v${verzia}?\n\nOK = áno (úpravy kariet z tej sady sa prepíšu)\nZrušiť = nie, návrhy nechať`,
    );
    setCaka(true);
    setSprava(null);
    try {
      const r = await api.post<{ verzia: number; kariet: number; mimoSady: string[] }>(`/admin/sady/${verzia}/obnovit`, { navrhy });
      setSprava({
        druh: "ok",
        text: `Sada v${verzia} je znova v hre ako v${r.verzia} (${r.kariet} kariet).${navrhy && r.mimoSady.length > 0 ? ` Návrhy mimo tej sady ostali: ${r.mimoSady.join(", ")}.` : ""}`,
      });
      obnovSadu();
      obnovSady();
      await obnovObsah();
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCaka(false);
    }
  };

  const zverejnit = async () => {
    // Zverejnenie mení hru všetkým hráčom a vydá všetky návrhy naraz — aj rozpracované.
    const co = zmenene.length > 0 ? `${zmenene.length} ${kariet(zmenene.length)} upravených od v${obsah.zverejnenaVerzia}` : "bez zmien v kartách";
    if (!window.confirm(`Zverejniť sadu v${dalsia} (${co})?\n\nNové partie, glosár a pravidlá pobežia na nej; rozohrané partie dohrajú na starej.`)) return;
    setCaka(true);
    setSprava(null);
    try {
      const v = await zverejni();
      setSprava({ druh: "ok", text: `Zverejnená verzia ${v}. Nové hry, glosár a pravidlá už bežia na nej.` });
      obnovSadu();
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCaka(false);
    }
  };

  return (
    <div className="admin-stranka">
      <AdminHlava
        titul="Prehľad a zverejnenie"
        popis={
          <>
            Hráči hrajú <strong>zverejnenú</strong> sadu v{obsah.zverejnenaVerzia}. Úpravy kariet sa prejavia až po zverejnení; rozohrané
            partie dohrajú na sade, s ktorou začali.
          </>
        }
      >
        <Odkaz href="/karty" className="tlacidlo tlacidlo-jemne">
          Glosár očami hráča
        </Odkaz>
        <Odkaz href="/admin/karty/nova" className="tlacidlo tlacidlo-hlavne">
          <Ikona nazov="plus" /> Nová karta
        </Odkaz>
      </AdminHlava>

      <section className={`panel zverejnenie zverejnenie-${stav}`} aria-labelledby="zverejnenie-titul">
        <div className="zverejnenie-hlava">
          <div>
            <h2 id="zverejnenie-titul">
              {stav === "blokovane"
                ? `Zverejnenie blokuje ${problemy.length} ${problemy.length === 1 ? "problém" : problemy.length <= 4 ? "problémy" : "problémov"}`
                : stav === "pripravene"
                  ? `${zmenene.length} ${kariet(zmenene.length)} ${zmenene.length === 1 ? "čaká" : "čakajú"} na zverejnenie`
                  : "Návrhy sú totožné so zverejnenou sadou"}
            </h2>
            <p className="tlmene">
              {stav === "blokovane"
                ? "Oprav ich v tvorcovi karty — klikni na kartu."
                : stav === "pripravene"
                  ? `Zverejnením vznikne sada v${dalsia} so všetkými návrhmi naraz.`
                  : posledna !== undefined
                    ? `Posledné zverejnenie ${new Date(posledna.cas).toLocaleString("sk")}.`
                    : "Zatiaľ žiadne zverejnenie."}
            </p>
          </div>
          <button className="tlacidlo-hlavne" onClick={() => void zverejnit()} disabled={caka || problemy.length > 0}>
            {caka ? "Zverejňujem…" : `Zverejniť v${dalsia}`}
          </button>
        </div>

        {problemy.length > 0 && (
          <ul className="zverejnenie-zoznam zle">
            {problemy.map((p, i) => (
              <li key={i}>
                <Odkaz href={`/admin/karty/${encodeURIComponent(p.karta.id)}`}>{p.karta.nazov || p.karta.id}</Odkaz>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        )}

        {zmenene.length > 0 && (
          <div className="zverejnenie-karty">
            <span className="tlmene">Upravené:</span>
            {zmenene.map((k) => (
              <Odkaz key={k.id} href={`/admin/karty/${encodeURIComponent(k.id)}`} className="cip">
                {k.nazov}
              </Odkaz>
            ))}
          </div>
        )}

        {texty.length > 0 && (
          <details className="zverejnenie-texty" open={chybyTextov > 0}>
            <summary>
              Texty efektov: {texty.length} {texty.length === 1 ? "upozornenie" : texty.length <= 4 ? "upozornenia" : "upozornení"}
              {chybyTextov > 0 && <span className="admin-znacka zla">{chybyTextov} chýb</span>}
            </summary>
            <ul className="zverejnenie-zoznam">
              {texty.map((t, i) => (
                <li key={i} className={t.uroven === "chyba" ? "zle" : undefined}>
                  <Odkaz href={`/admin/karty/${encodeURIComponent(t.id)}`}>{t.nazov}</Odkaz>
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}
      </section>

      <div className="dlazdice">
        <Odkaz href="/admin/karty" className="dlazdica">
          <span>Návrhov kariet</span>
          <strong>{obsah.karty.length}</strong>
        </Odkaz>
        <Odkaz href="/admin/tlac" className="dlazdica">
          <span>Kariet v tlači</span>
          <strong>{vytlacenych}</strong>
        </Odkaz>
        <Odkaz href="/admin/akcie" className="dlazdica">
          <span>Akcií</span>
          <strong>{obsah.akcie.length}</strong>
        </Odkaz>
        <div className="dlazdica">
          <span>Zverejnená sada</span>
          <strong>v{obsah.zverejnenaVerzia}</strong>
        </div>
      </div>

      <section className="panel">
        <h2>História sád</h2>
        <p className="tlmene">Vrátiť = staršia sada sa zverejní znova ako nová verzia; história sa neprepisuje.</p>
        <div className="tabulka-obal">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Verzia</th>
                <th>Zverejnená</th>
                <th className="cislo">Kariet</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(sady ?? []).map((s) => (
                <tr key={s.verzia}>
                  <td>
                    v{s.verzia}
                    {s.verzia === posledna?.verzia && <span className="odznak odznak-aktualna">v hre</span>}
                  </td>
                  <td>{new Date(s.cas).toLocaleString("sk")}</td>
                  <td className="cislo">{s.kariet}</td>
                  <td className="cislo">
                    {s.verzia !== posledna?.verzia && (
                      <button className="tlacidlo-male tlacidlo-jemne" disabled={caka} onClick={() => void vratit(s.verzia)}>
                        Vrátiť na v{s.verzia}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
