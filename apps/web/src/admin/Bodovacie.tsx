// Bodovacie karty starších (MAUI Scorecard): podložka, do ktorej sa vkladá
// karta staršieho. Bočné ikony ležia presne na výškach slotov karty, pod
// ňou stupnica strachu a názov. Kreslí sa ako SVG v bodoch — rovnaký výstup
// na obrazovke aj v tlači.

import { useRef, useState } from "react";
import type { BodovaciaKarta, IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE, geometriaBodovacej } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska, Pole } from "../komponenty.tsx";
import { nahrajMedia, noveId, useAdmin } from "./stav.tsx";

export function BodovaciaSvg({
  karta,
  ikony,
  sirka,
  znacky = false,
  onSlot,
}: {
  readonly karta: BodovaciaKarta;
  readonly ikony: readonly IkonaBodovania[];
  readonly sirka?: number | string;
  /** Prázdne sloty ako „+“ (len v editore). */
  readonly znacky?: boolean;
  readonly onSlot?: (strana: "lava" | "prava", i: number) => void;
}) {
  const g = geometriaBodovacej(karta);
  const o = g.odtlacok;
  const sloty = (strana: "lava" | "prava") =>
    (strana === "lava" ? g.slotyLave : g.slotyPrave).map((r, i) => {
      const id = karta[strana][i] ?? null;
      const ik = id === null ? undefined : ikony.find((x) => x.id === id);
      const klik = onSlot === undefined ? undefined : () => onSlot(strana, i);
      if (ik === undefined) {
        if (!znacky) return null;
        const s = r.w * 0.22;
        return (
          <g key={`${strana}${i}`} onClick={klik} style={{ cursor: klik === undefined ? undefined : "pointer" }}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={g.polomer} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.66)" strokeWidth={1} />
            <path d={`M${r.x + r.w / 2 - s} ${r.y + r.h / 2}h${2 * s}M${r.x + r.w / 2} ${r.y + r.h / 2 - s}v${2 * s}`} stroke="rgba(255,255,255,0.66)" strokeWidth={1} strokeLinecap="round" />
          </g>
        );
      }
      const pad = r.w * 0.12;
      return (
        <g key={`${strana}${i}`} onClick={klik} style={{ cursor: klik === undefined ? undefined : "pointer" }}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={g.polomer} fill="#fff" stroke="#cbd5e1" strokeWidth={1.13} />
          <image href={mediaUrl(ik.media)} x={r.x + pad} y={r.y + pad} width={r.w - 2 * pad} height={r.h - 2 * pad} preserveAspectRatio="xMidYMid meet" />
        </g>
      );
    });

  return (
    <svg
      className="bodovacia-svg"
      viewBox={`0 0 ${g.sirka} ${g.vyska}`}
      width={sirka}
      style={{ aspectRatio: `${g.sirka} / ${g.vyska}` }}
      role="img"
      aria-label={`Bodovacia karta ${karta.nazov}`}
    >
      <defs>
        <clipPath id={`bk-${karta.id}`}>
          <rect width={g.sirka} height={g.vyska} />
        </clipPath>
      </defs>
      <rect width={g.sirka} height={g.vyska} fill="#374151" />
      {karta.pozadie !== null && (
        <image href={mediaUrl(karta.pozadie)} width={g.sirka} height={g.vyska} preserveAspectRatio="xMidYMid slice" clipPath={`url(#bk-${karta.id})`} />
      )}
      <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke={karta.farba ?? "#94a3b8"} strokeWidth={0.5 * 2.835} />
      {sloty("lava")}
      {sloty("prava")}
      {g.kruzky.map((c, i) => (
        <circle key={i} cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={c.w / 2} fill={FARBY_STUPNICE[i]} stroke="#fff" strokeWidth={1.13} />
      ))}
      {karta.nazov !== "" && (
        <>
          <rect
            x={g.nazov.x + g.nazov.w / 2 - Math.min(g.nazov.w, karta.nazov.length * g.velkostNazvu * 0.6 + 1.4 * g.velkostNazvu) / 2}
            y={g.nazov.y - g.nazov.h * 0.075}
            width={Math.min(g.nazov.w, karta.nazov.length * g.velkostNazvu * 0.6 + 1.4 * g.velkostNazvu)}
            height={g.nazov.h * 1.15}
            rx={1.7}
            fill="#374151"
          />
          <text
            x={g.nazov.x + g.nazov.w / 2}
            y={g.nazov.y + g.nazov.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f8fafc"
            fontFamily="Roboto, sans-serif"
            fontWeight={700}
            fontSize={g.velkostNazvu}
          >
            {karta.nazov}
          </text>
        </>
      )}
    </svg>
  );
}

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
      <p className="tlmene">Vlastný zoznam ikon pre bočné bodovacie pozície (napr. zóny strachu a body).</p>
      <div className="ikony-bodovania">
        {obsah.ikonyBodovania.map((i) => (
          <div key={i.id} className="ikona-bodovania">
            <img src={mediaUrl(i.media)} alt="" />
            <span>{i.nazov}</span>
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
      <div className="admin-hlava">
        <h1>Bodovacie karty</h1>
        {upravuje === null && (
          <button className="tlacidlo-hlavne" onClick={() => setUpravuje(nova())}>
            + Nová bodovacia karta
          </button>
        )}
      </div>
      <p className="tlmene">
        Podložka, do ktorej sa vkladá karta staršieho. Bočné pozície ležia presne na výškach akcií karty, takže neprázdna akcia
        staršieho „ukazuje“ na bodovaciu podmienku.
      </p>
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
