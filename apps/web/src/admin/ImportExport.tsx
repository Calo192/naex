// Textový export/import kariet — formát MAUI (kartyai_cards_*.txt).

import { useRef, useState } from "react";
import { api } from "../lib/api.ts";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";

interface Vysledok {
  readonly kariet: number;
  readonly pridane: number;
  readonly upravene: number;
  readonly nezname: readonly string[];
}

export function ImportExport() {
  useTitulok("Import a export — tvorba");
  const { obnov } = useAdmin();
  const subor = useRef<HTMLInputElement>(null);
  const [vysledok, setVysledok] = useState<Vysledok | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const importuj = async (f: File) => {
    setChyba(null);
    setVysledok(null);
    try {
      const r = await api.post<Vysledok>("/admin/import", await f.text(), "text/plain; charset=utf-8");
      setVysledok(r);
      await obnov();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="admin-stranka">
      <h1>Import a export</h1>
      <section className="panel">
        <h2>Export</h2>
        <p className="tlmene">
          Textový popis všetkých návrhov — názov, tagy, efekt, blokované pozície, akcie a obmedzenia po stranách. Rovnaký
          formát ako „Export“ v MAUI aplikácii KartyAI; dá sa naimportovať späť aj sem.
        </p>
        <a className="tlacidlo tlacidlo-hlavne" href="/api/admin/export" download>
          Stiahnuť export (.txt)
        </a>
      </section>
      <section className="panel">
        <h2>Import</h2>
        <p className="tlmene">
          Karty sa spárujú podľa názvu: existujúcim sa prepíšu tagy, efekt a akcie, nové sa pridajú. Ilustrácie, farby
          a rozmery ostanú. Akcie sa hľadajú podľa názvu — neznáme sa preskočia.
        </p>
        <input
          ref={subor}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f !== undefined) void importuj(f);
          }}
        />
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        {vysledok !== null && (
          <Hlaska druh="ok">
            {`Kariet v súbore: ${vysledok.kariet}\nUpravené: ${vysledok.upravene}\nPridané: ${vysledok.pridane}${
              vysledok.nezname.length > 0 ? `\nPreskočené neznáme akcie: ${vysledok.nezname.join(", ")}` : ""
            }`}
          </Hlaska>
        )}
        <button onClick={() => subor.current?.click()}>Vybrať súbor na import…</button>
      </section>
    </div>
  );
}
