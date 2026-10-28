// Tlač (MAUI Print File / Print ALL). Prehliadač vytlačí stránky alebo ich
// uloží ako PDF („Uložiť ako PDF“ v dialógu tlače).
//
// * Tlačový súbor: jedna permutácia na stranu, strana = orez + 2 × (3 mm
//   presah + 3 mm značky), orezové značky na línii orezu — ako PDF z MAUI.
// * Hárok A4: karty v skutočnej veľkosti vedľa seba (okraj 12 mm, medzera
//   6 mm) s L-značkami v rohoch, voliteľne aj bodovacie karty.
//
// CMYK prehliadač nevie — tlačiareň dostane RGB (MAUI to robil Ghostscriptom).

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { KartaNavrh, RozlozenieStrany } from "@naex/tvorba";
import { PRESAH_MM, ZNACKA_MM, geometriaBodovacej, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { BodovaciaSvg } from "./Bodovacie.tsx";
import { useAdmin } from "./stav.tsx";

type Rezim = "subor" | "a4";

interface Kus {
  readonly karta: KartaNavrh;
  readonly lava: RozlozenieStrany;
  readonly prava: RozlozenieStrany;
}

const A4 = { w: 210, h: 297, okraj: 12, medzera: 6 };
const PT_NA_MM = 25.4 / 72;

/** Orezové značky tlačového súboru: z okraja strany k presahu, na línii orezu. */
function ZnackyStrany({ w, h }: { readonly w: number; readonly h: number }) {
  const m = PRESAH_MM + ZNACKA_MM;
  const L = ZNACKA_MM;
  const ciary: [number, number, number, number][] = [
    [0, m, L, m], [m, 0, m, L], [w + 2 * m - L, m, w + 2 * m, m], [w + m, 0, w + m, L],
    [0, h + m, L, h + m], [m, h + 2 * m - L, m, h + 2 * m], [w + 2 * m - L, h + m, w + 2 * m, h + m], [w + m, h + 2 * m - L, w + m, h + 2 * m],
  ];
  return (
    <svg className="znacky" viewBox={`0 0 ${w + 2 * m} ${h + 2 * m}`} width={`${w + 2 * m}mm`} height={`${h + 2 * m}mm`}>
      {ciary.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={0.25} />
      ))}
    </svg>
  );
}

/** L-značky okolo karty na hárku (MAUI PdfDecorations: dĺžka 3 mm, medzera 1 mm). */
function ZnackyRohov({ x, y, w, h }: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }) {
  const g = 1;
  const L = ZNACKA_MM;
  const c: [number, number, number, number][] = [
    [x - g - L, y, x - g, y], [x, y - g - L, x, y - g],
    [x + w + g, y, x + w + g + L, y], [x + w, y - g - L, x + w, y - g],
    [x - g - L, y + h, x - g, y + h], [x, y + h + g, x, y + h + g + L],
    [x + w + g, y + h, x + w + g + L, y + h], [x + w, y + h + g, x + w, y + h + g + L],
  ];
  return (
    <>
      {c.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={0.25} />
      ))}
    </>
  );
}

export function Tlac() {
  useTitulok("Tlač — tvorba");
  const { obsah, vzhlad } = useAdmin();
  const [rezim, setRezim] = useState<Rezim>("subor");
  const [vybrane, setVybrane] = useState<ReadonlySet<string> | null>(null);
  const [kopie, setKopie] = useState(true);
  const [sBodovacimi, setSBodovacimi] = useState(true);
  const [nahlad, setNahlad] = useState(0.5);

  const kusy = useMemo((): Kus[] => {
    if (obsah === null) return [];
    const out: Kus[] = [];
    for (const k of obsah.karty) {
      if (vybrane !== null && !vybrane.has(k.id)) continue;
      const v = variantyKarty(k);
      for (const l of v.lava) for (const r of v.prava) for (let c = 0; c < (kopie ? k.kopie : 1); c++) out.push({ karta: k, lava: l, prava: r });
    }
    return out;
  }, [obsah, vybrane, kopie]);

  if (obsah === null || vzhlad === null) return null;

  // Hárky A4: rozmiestnenie po riadkoch (karty rovnakej veľkosti vedľa seba).
  const harky: { x: number; y: number; w: number; h: number; obsah: ReactNode }[][] = [];
  if (rezim === "a4") {
    const polozky: { w: number; h: number; obsah: ReactNode }[] = kusy.map((k, i) => ({
      w: k.karta.sirkaMm,
      h: k.karta.vyskaMm,
      obsah: <KartaLico key={i} karta={k.karta} lava={k.lava} prava={k.prava} vzhlad={vzhlad} sirka={`${k.karta.sirkaMm}mm`} />,
    }));
    if (sBodovacimi) {
      for (const b of obsah.bodovacie) {
        const g = geometriaBodovacej(b);
        polozky.push({ w: g.sirka * PT_NA_MM, h: g.vyska * PT_NA_MM, obsah: <BodovaciaSvg karta={b} ikony={obsah.ikonyBodovania} sirka={`${g.sirka * PT_NA_MM}mm`} /> });
      }
    }
    let harok: (typeof harky)[number] = [];
    let x = A4.okraj;
    let y = A4.okraj;
    let riadokH = 0;
    for (const p of polozky) {
      if (x + p.w > A4.w - A4.okraj + 0.01) {
        x = A4.okraj;
        y += riadokH + A4.medzera;
        riadokH = 0;
      }
      if (y + p.h > A4.h - A4.okraj + 0.01) {
        harky.push(harok);
        harok = [];
        x = A4.okraj;
        y = A4.okraj;
        riadokH = 0;
      }
      harok.push({ x, y, ...p });
      x += p.w + A4.medzera;
      riadokH = Math.max(riadokH, p.h);
    }
    if (harok.length > 0) harky.push(harok);
  }

  const m = PRESAH_MM + ZNACKA_MM;
  const velkosti = [...new Set(kusy.map((k) => `${k.karta.sirkaMm}x${k.karta.vyskaMm}`))];
  // Pomenované @page pre každú veľkosť karty (Chrome rešpektuje vlastnosť `page`).
  const stranyCss =
    rezim === "a4"
      ? `@page { size: 210mm 297mm; margin: 0 }`
      : velkosti
          .map((v) => {
            const [w, h] = v.split("x").map(Number) as [number, number];
            return `@page s${v.replace(".", "_")} { size: ${w + 2 * m}mm ${h + 2 * m}mm; margin: 0 }`;
          })
          .join("\n");
  const bezObrazka = obsah.karty.filter((k) => k.obrazok === null && (vybrane === null || vybrane.has(k.id)));

  return (
    <div className="admin-stranka tlac">
      <style>{stranyCss}</style>
      <div className="tlac-ovladanie">
        <h2>Tlač</h2>
        <div className="cipy">
          <button className={rezim === "subor" ? "cip aktivny" : "cip"} onClick={() => setRezim("subor")}>
            Tlačový súbor (1 karta na stranu, presah 3 mm)
          </button>
          <button className={rezim === "a4" ? "cip aktivny" : "cip"} onClick={() => setRezim("a4")}>
            Hárok A4 (všetko vedľa seba)
          </button>
        </div>
        <div className="riadok-tlacidiel" style={{ margin: "14px 0" }}>
          <label>
            <input type="checkbox" checked={kopie} onChange={(e) => setKopie(e.target.checked)} /> kópie podľa nastavenia kariet
          </label>
          {rezim === "a4" && (
            <label>
              <input type="checkbox" checked={sBodovacimi} onChange={(e) => setSBodovacimi(e.target.checked)} /> aj karty priazne
            </label>
          )}
          <label className="glosar-velkost">
            <span className="tlmene">Náhľad</span>
            <input type="range" min={0.25} max={1} step={0.05} value={nahlad} onChange={(e) => setNahlad(Number(e.target.value))} />
          </label>
        </div>
        <details className="tlac-vyber">
          <summary>
            Karty: {vybrane === null ? "všetky" : `${vybrane.size} vybraných`} · {kusy.length} kariet · {rezim === "a4" ? `${harky.length} hárkov A4` : `${kusy.length} strán`}
          </summary>
          <div className="riadok-tlacidiel" style={{ margin: "10px 0" }}>
            <button className="tlacidlo-male" onClick={() => setVybrane(null)}>
              Všetky
            </button>
            <button className="tlacidlo-male" onClick={() => setVybrane(new Set())}>
              Žiadne
            </button>
          </div>
          <div className="tlac-zoznam">
            {obsah.karty.map((k) => (
              <label key={k.id}>
                <input
                  type="checkbox"
                  checked={vybrane === null || vybrane.has(k.id)}
                  onChange={(e) => {
                    const z = new Set(vybrane ?? obsah.karty.map((x) => x.id));
                    if (e.target.checked) z.add(k.id);
                    else z.delete(k.id);
                    setVybrane(z);
                  }}
                />
                {k.nazov}
              </label>
            ))}
          </div>
        </details>
        {bezObrazka.length > 0 && <Hlaska druh="info">Bez ilustrácie: {bezObrazka.map((k) => k.nazov).join(", ")}.</Hlaska>}
        <p className="tlmene">
          V dialógu tlače zvoľ <strong>Uložiť ako PDF</strong>, okraje <strong>žiadne</strong> a zapni <strong>grafiku pozadia</strong>.
          Veľkosť strany sa nastaví sama. Výstup je RGB.
        </p>
        <button className="tlacidlo-hlavne" onClick={() => window.print()} disabled={kusy.length === 0 && harky.length === 0}>
          Tlačiť / uložiť PDF
        </button>
      </div>

      <div className="tlac-strany" style={{ "--nahlad": nahlad } as CSSProperties}>
        {rezim === "subor"
          ? kusy.map((k, i) => (
              <div
                key={i}
                className="tlac-strana"
                style={{
                  width: `${k.karta.sirkaMm + 2 * m}mm`,
                  height: `${k.karta.vyskaMm + 2 * m}mm`,
                  page: `s${k.karta.sirkaMm}x${k.karta.vyskaMm}`.replace(".", "_"),
                } as CSSProperties}
              >
                <ZnackyStrany w={k.karta.sirkaMm} h={k.karta.vyskaMm} />
                <div className="tlac-karta" style={{ left: `${m}mm`, top: `${m}mm` }}>
                  <KartaLico karta={k.karta} lava={k.lava} prava={k.prava} vzhlad={vzhlad} sirka={`${k.karta.sirkaMm}mm`} presahMm={PRESAH_MM} />
                </div>
              </div>
            ))
          : harky.map((h, i) => (
              <div key={i} className="tlac-strana" style={{ width: "210mm", height: "297mm" }}>
                <svg className="znacky" viewBox="0 0 210 297" width="210mm" height="297mm">
                  {h.map((p, j) => (
                    <ZnackyRohov key={j} x={p.x} y={p.y} w={p.w} h={p.h} />
                  ))}
                </svg>
                {h.map((p, j) => (
                  <div key={j} className="tlac-karta" style={{ left: `${p.x}mm`, top: `${p.y}mm` }}>
                    {p.obsah}
                  </div>
                ))}
              </div>
            ))}
      </div>
    </div>
  );
}
