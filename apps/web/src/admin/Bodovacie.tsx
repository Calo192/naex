// Bodovacie karty starších (MAUI Scorecard): podložka, do ktorej sa vkladá
// karta staršieho. Bočné ikony ležia presne na výškach slotov karty, pod
// ňou stupnica strachu a názov. Kreslí sa ako SVG v bodoch — rovnaký výstup
// na obrazovke aj v tlači.

import { useRef, useState } from "react";
import type { Podmienka } from "@naex/core";
import { ALL_PODMIENKY } from "@naex/core";
import type { BodovaciaKarta, IkonaBodovania } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska, Pole } from "../komponenty.tsx";
import { nahrajMedia, noveId, useAdmin } from "./stav.tsx";
import { AdminHlava } from "./spolocne.tsx";

import { BodovaciaSvg } from "../karta/BodovaciaSvg.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";

export { BodovaciaSvg };

function IkonyBodovania() {
  const { obsah, ulozIkonuBodovania, zmazIkonuBodovania } = useAdmin();
  const [chyba, setChyba] = useState<string | null>(null);
  const subor = useRef<HTMLInputElement>(null);
  if (obsah === null) return null;
  return (
    <section className="panel">
      <div className="admin-hlava">
        <h3>Ikony bodovania</h3>
        <input
          ref={subor}
          type="file"
          accept=".svg,image/svg+xml,image/png"
          multiple
          hidden
          onChange={(e) => {
            const subory = Array.from(e.target.files ?? []);
            e.target.value = "";
            void (async () => {
              try {
                for (const f of subory) {
                  const media = await nahrajMedia(f, "ikona", f.name);
                  await ulozIkonuBodovania({ id: noveId("ikona"), nazov: f.name.replace(/\.[a-z]+$/i, ""), media });
                }
              } catch (err) {
                setChyba(err instanceof Error ? err.message : String(err));
              }
            })();
          }}
        />
        <button className="tlacidlo-male" onClick={() => subor.current?.click()}>
          + Nahrať SVG
        </button>
      </div>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <p className="tlmene">Ikony bočných bodovacích pozícií. Každej treba určiť, čo v hre znamená.</p>
      <div className="ikony-bodovania">
        {obsah.ikonyBodovania.map((i) => (
          <div key={i.id} className="ikona-bodovania">
            <img src={mediaUrl(i.media)} alt="" />
            <span>{i.nazov}</span>
            {/* Bez významu sa scorecard s touto ikonou nedá zverejniť. */}
            <select
              value={i.podmienka ?? ""}
              aria-label={`Význam ikony ${i.nazov}`}
              onChange={(e) => {
                const v = e.target.value;
                void ulozIkonuBodovania({ ...i, podmienka: v === "" ? null : (v as Podmienka) });
              }}
            >
              <option value="">— význam v hre —</option>
              {ALL_PODMIENKY.map((p) => (
                <option key={p} value={p}>
                  {NAZOV_PODMIENKY[p]}
                </option>
              ))}
            </select>
            <button className="tlacidlo-male tlacidlo-jemne" onClick={() => void zmazIkonuBodovania(i.id)} aria-label={`Zmazať ${i.nazov}`}>
              ✕
            </button>
          </div>
        ))}
        {obsah.ikonyBodovania.length === 0 && <span className="tlmene">Zatiaľ žiadne ikony.</span>}
      </div>
    </section>
  );
}

function Editor({ povodna, zavri }: { readonly povodna: BodovaciaKarta; readonly zavri: () => void }) {
  const { obsah, ulozBodovaciu, zmazBodovaciu } = useAdmin();
  const [b, setB] = useState(povodna);
  const [vyber, setVyber] = useState<{ strana: "lava" | "prava"; i: number } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const pozadie = useRef<HTMLInputElement>(null);
  if (obsah === null) return null;

  const nastavSlot = (id: string | null) => {
    if (vyber === null) return;
    const z = [...b[vyber.strana]];
    z[vyber.i] = id;
    setB({ ...b, [vyber.strana]: z });
    setVyber(null);
  };

  return (
    <div className="bodovacia-editor">
      <div className="bodovacia-nahlad">
        <BodovaciaSvg karta={b} ikony={obsah.ikonyBodovania} sirka="100%" znacky onSlot={(strana, i) => setVyber({ strana, i })} />
        <p className="tlmene">Klikni na pozíciu po stranách a vyber ikonu.</p>
      </div>
      <div>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <Pole label="Názov">
          <input value={b.nazov} onChange={(e) => setB({ ...b, nazov: e.target.value })} maxLength={80} />
        </Pole>
        <div className="mriezka-poli">
          <Pole label="Šírka karty (mm)">
            <input type="number" value={b.sirkaMm} min={20} max={200} step={0.5} onChange={(e) => setB({ ...b, sirkaMm: Number(e.target.value) })} />
          </Pole>
          <Pole label="Výška karty (mm)">
            <input type="number" value={b.vyskaMm} min={20} max={300} step={0.5} onChange={(e) => setB({ ...b, vyskaMm: Number(e.target.value) })} />
          </Pole>
          <Pole label={`Mierka ikon ${b.mierkaIkon.toFixed(2)}×`}>
            <input type="range" min={0.5} max={1.8} step={0.02} value={b.mierkaIkon} onChange={(e) => setB({ ...b, mierkaIkon: Number(e.target.value) })} />
          </Pole>
          <Pole label="Farba obrysu">
            <input type="color" value={b.farba ?? "#94a3b8"} onChange={(e) => setB({ ...b, farba: e.target.value })} />
          </Pole>
        </div>
        <div className="riadok-tlacidiel" style={{ marginBottom: 16 }}>
          <input
            ref={pozadie}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f === undefined) return;
              void (async () => {
                try {
                  const blob = await stvorec(await nacitajObrazok(f), 1400);
                  setB({ ...b, pozadie: await nahrajMedia(blob, "pozadie", f.name) });
                } catch (err) {
                  setChyba(err instanceof Error ? err.message : String(err));
                }
              })();
            }}
          />
          <button onClick={() => pozadie.current?.click()}>{b.pozadie === null ? "Pozadie (obrázok)" : "Zmeniť pozadie"}</button>
          {b.pozadie !== null && (
            <button className="tlacidlo-jemne" onClick={() => setB({ ...b, pozadie: null })}>
              Bez pozadia
            </button>
          )}
        </div>
        <div className="riadok-tlacidiel">
          <button
            className="tlacidlo-hlavne"
            onClick={() =>
              void ulozBodovaciu(b)
                .then(zavri)
                .catch((err: unknown) => setChyba(err instanceof Error ? err.message : String(err)))
            }
          >
            Uložiť
          </button>
          <button onClick={zavri}>Zrušiť</button>
          {obsah.bodovacie.some((x) => x.id === b.id) && (
            <button className="tlacidlo-nebezpecne" onClick={() => window.confirm("Zmazať bodovaciu kartu?") && void zmazBodovaciu(b.id).then(zavri)}>
              Zmazať
            </button>
          )}
        </div>
      </div>

      {vyber !== null && (
        <div className="modal" onClick={() => setVyber(null)}>
          <div className="modal-obsah" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>
              {vyber.strana === "lava" ? "Ľavá" : "Pravá"} pozícia {vyber.i}
            </h3>
            <div className="ikony-bodovania">
              <button className="ikona-bodovania" onClick={() => nastavSlot(null)}>
                <span className="tlmene">prázdne</span>
              </button>
              {obsah.ikonyBodovania.map((i) => (
                <button key={i.id} className="ikona-bodovania" onClick={() => nastavSlot(i.id)}>
                  <img src={mediaUrl(i.media)} alt="" />
                  <span>{i.nazov}</span>
                </button>
              ))}
            </div>
            {obsah.ikonyBodovania.length === 0 && <p className="tlmene">Najprv nahraj ikony v sekcii „Ikony bodovania“.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function Bodovacie() {
  useTitulok("Bodovacie karty — tvorba");
  const { obsah } = useAdmin();
  const [upravuje, setUpravuje] = useState<BodovaciaKarta | null>(null);
  if (obsah === null) return null;

  const nova = (): BodovaciaKarta => ({
    id: noveId("bodovacia"),
    nazov: "",
    sirkaMm: obsah.nastavenia.sirkaMm,
    vyskaMm: obsah.nastavenia.vyskaMm,
    mierkaIkon: obsah.nastavenia.mierkaIkon,
    farba: null,
    pozadie: null,
    lava: [null, null, null, null],
    prava: [null, null, null, null],
    upravene: 0,
  });

  return (
    <div className="admin-stranka">
      <AdminHlava
        titul="Bodovacie karty"
        popis="Podložka, do ktorej sa vkladá karta staršieho. Bočné pozície ležia presne na výškach akcií karty, takže neprázdna akcia staršieho „ukazuje“ na bodovaciu podmienku."
      >
        {upravuje === null && (
          <button className="tlacidlo-hlavne" onClick={() => setUpravuje(nova())}>
            + Nová bodovacia karta
          </button>
        )}
      </AdminHlava>
      {upravuje !== null ? (
        <section className="panel">
          <Editor key={upravuje.id} povodna={upravuje} zavri={() => setUpravuje(null)} />
        </section>
      ) : (
        <div className="bodovacie-mriezka">
          {obsah.bodovacie.map((b) => (
            <button key={b.id} className="bodovacia-polozka" onClick={() => setUpravuje(b)}>
              <BodovaciaSvg karta={b} ikony={obsah.ikonyBodovania} sirka="100%" />
              <span>{b.nazov || "bez názvu"}</span>
            </button>
          ))}
          {obsah.bodovacie.length === 0 && <p className="tlmene">Zatiaľ žiadne bodovacie karty.</p>}
        </div>
      )}
      <IkonyBodovania />
    </div>
  );
}
