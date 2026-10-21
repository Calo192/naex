// Akcie a ich ikony (MAUI ActionNameStore + CustomActionStore): premenovanie,
// popis pre hráčov, vlastná SVG ikona, nové vlastné akcie.

import { useRef, useState } from "react";
import type { AkciaDef } from "@naex/tvorba";
import { ALL_ACTIONS } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { nahrajMedia, useAdmin } from "./stav.tsx";
import { AdminHlava } from "./spolocne.tsx";

function RiadokAkcie({ akcia, pouzitie }: { readonly akcia: AkciaDef; readonly pouzitie: number }) {
  const { ulozAkciu, zmazAkciu } = useAdmin();
  const [nazov, setNazov] = useState(akcia.nazov);
  const [popis, setPopis] = useState(akcia.popis);
  const [chyba, setChyba] = useState<string | null>(null);
  const subor = useRef<HTMLInputElement>(null);
  const vHre = (ALL_ACTIONS as readonly string[]).includes(akcia.kluc);
  const zmenene = nazov !== akcia.nazov || popis !== akcia.popis;

  const obal = async (f: () => Promise<void>) => {
    setChyba(null);
    try {
      await f();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="akcia-riadok panel">
      <span className="legenda-ikona velka">
        <IkonaAkcie kluc={akcia.kluc} akcia={akcia} />
      </span>
      <div className="akcia-polia">
        <div className="akcia-hlava">
          <input value={nazov} onChange={(e) => setNazov(e.target.value)} aria-label="Názov akcie" className="akcia-nazov" />
          <span className="tlmene">
            kľúč <code>{akcia.kluc}</code> · {pouzitie} {pouzitie === 1 ? "karta" : "kariet"}
          </span>
          {vHre ? <span className="odznak">pravidlá v hre</span> : <span className="odznak odznak-admin">bez pravidiel v hre</span>}
        </div>
        <textarea value={popis} onChange={(e) => setPopis(e.target.value)} rows={2} placeholder="Čo akcia robí — uvidia to hráči v tooltipe." />
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        <div className="riadok-tlacidiel">
          <button className="tlacidlo-male tlacidlo-hlavne" disabled={!zmenene} onClick={() => void obal(() => ulozAkciu({ ...akcia, nazov, popis }))}>
            Uložiť
          </button>
          <input
            ref={subor}
            type="file"
            accept=".svg,image/svg+xml,image/png"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f !== undefined) {
                void obal(async () => {
                  const id = await nahrajMedia(f, "ikona", f.name);
                  await ulozAkciu({ ...akcia, nazov, popis, ikona: { typ: "svg", media: id } });
                });
              }
            }}
          />
          <button className="tlacidlo-male" onClick={() => subor.current?.click()}>
            Nahrať SVG ikonu
          </button>
          {akcia.ikona.typ === "svg" && vHre && (
            <button className="tlacidlo-male tlacidlo-jemne" onClick={() => void obal(() => ulozAkciu({ ...akcia, ikona: { typ: "vstavana" } }))}>
              Vrátiť pôvodnú ikonu
            </button>
          )}
          {!vHre && (
            <button
              className="tlacidlo-male tlacidlo-nebezpecne"
              disabled={pouzitie > 0}
              title={pouzitie > 0 ? "Akciu používajú karty" : undefined}
              onClick={() => window.confirm(`Zmazať akciu ${akcia.nazov}?`) && void obal(() => zmazAkciu(akcia.kluc))}
            >
              Zmazať
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Akcie() {
  useTitulok("Akcie — tvorba");
  const { obsah, ulozAkciu } = useAdmin();
  const [nova, setNova] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  if (obsah === null) return null;

  const pouzitie = (kluc: string) => obsah.karty.filter((k) => (k.lava.akcie[kluc] ?? 0) + (k.prava.akcie[kluc] ?? 0) > 0).length;

  const pridaj = async () => {
    const nazov = nova.trim();
    if (nazov === "") return;
    const kluc = `vlastna_${nazov.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").toLowerCase()}`;
    try {
      await ulozAkciu({ kluc, nazov, popis: "", ikona: { typ: "vstavana" }, poradie: obsah.akcie.length });
      setNova("");
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="admin-stranka">
      <AdminHlava
        titul="Akcie a ikony"
        popis="Názov a popis vidia hráči v tooltipe nad akciou. Vlastnú akciu môžeš navrhovať a tlačiť hneď; do hry sa dostane, až keď jej pravidlá naprogramujeme v jadre."
      />
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <form
        className="panel riadok-tlacidiel"
        onSubmit={(e) => {
          e.preventDefault();
          void pridaj();
        }}
      >
        <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Názov novej akcie" style={{ maxWidth: 280 }} />
        <button type="submit" disabled={nova.trim() === ""}>
          + Pridať vlastnú akciu
        </button>
      </form>
      <div className="akcie-zoznam">
        {obsah.akcie.map((a) => (
          <RiadokAkcie key={`${a.kluc}:${a.nazov}:${a.popis}:${JSON.stringify(a.ikona)}`} akcia={a} pouzitie={pouzitie(a.kluc)} />
        ))}
      </div>
    </div>
  );
}
