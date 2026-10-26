// Pravidlá › Karty (Michal 2026-10-26): každá karta zverejnenej sady s príbehom
// a účelom v hre. Texty píše admin v tvorcovi; ukazuje ich len táto stránka —
// hra ani výučba nie. Karta, ktorá ich ešte nemá, ostane len s efektom.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { KartaNavrh, KlucoveSlovo, Vzhlad } from "@naex/tvorba";
import { blokyTextu, farbaKarty, formatujEfekt } from "@naex/tvorba";
import { mediaUrl } from "../../lib/api.ts";
import { Odkaz, useTitulok } from "../../lib/router.tsx";
import { useSada, vzhladSady } from "../../lib/sada.tsx";
import { Hlaska, Nacitavanie } from "../../komponenty.tsx";
import { TYPY_KARIET } from "../Glosar.tsx";
import "./karty.css";

function Efekt({ text, klucoveSlova }: { readonly text: string; readonly klucoveSlova: readonly KlucoveSlovo[] }) {
  const riadky = useMemo(() => formatujEfekt(text, klucoveSlova), [text, klucoveSlova]);
  return (
    <div className="kp-efekt">
      {riadky.map((riadok, i) => (
        <p key={i}>
          {riadok.map((u, j) => {
            const popis = u.pravidlo?.popis || undefined;
            if (u.tucne) return <b key={j} title={popis}>{u.text}</b>;
            if (u.kurziva) return <i key={j} title={popis}>{u.text}</i>;
            return <span key={j} title={popis}>{u.text}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

function TextKarty({ nadpis, text, trieda }: { readonly nadpis: string; readonly text: string; readonly trieda: string }) {
  const bloky = useMemo(() => blokyTextu(text), [text]);
  return (
    <section className={`kp-text ${trieda}`}>
      <h3>{nadpis}</h3>
      {bloky.map((b, i) =>
        b.typ === "odrazky" ? (
          <ul key={i}>
            {b.polozky.map((p, j) => (
              <li key={j}>{p}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.riadky.join("\n")}</p>
        ),
      )}
    </section>
  );
}

function Karta({ karta, vzhlad }: { readonly karta: KartaNavrh; readonly vzhlad: Vzhlad }) {
  const [bezObrazka, setBezObrazka] = useState(false);
  return (
    <article id={`karta-${karta.id}`} className="kp-karta" style={{ "--farba-karty": farbaKarty(karta, vzhlad.kategorie) } as CSSProperties}>
      <div className="kp-obraz">
        {karta.obrazok !== null && !bezObrazka ? (
          <img
            src={mediaUrl(karta.obrazok.nahlad)}
            srcSet={`${mediaUrl(karta.obrazok.nahlad, true)} 320w, ${mediaUrl(karta.obrazok.nahlad)} 512w`}
            sizes="(max-width: 600px) 84px, 148px"
            alt=""
            loading="lazy"
            onError={() => setBezObrazka(true)}
          />
        ) : (
          <span aria-hidden="true">{karta.nazov.charAt(0)}</span>
        )}
      </div>
      <div className="kp-hlava">
        <h2>{karta.nazov}</h2>
        {karta.tagy.length > 0 && <p className="kp-tagy">{karta.tagy.join(" · ")}</p>}
      </div>
      <div className="kp-telo">
        {karta.efekt.trim() !== "" && <Efekt text={karta.efekt} klucoveSlova={vzhlad.klucoveSlova} />}
        {karta.pribeh !== undefined && <TextKarty nadpis="Príbeh" text={karta.pribeh} trieda="kp-pribeh" />}
        {karta.ucel !== undefined && <TextKarty nadpis="Účel v hre" text={karta.ucel} trieda="kp-ucel" />}
      </div>
    </article>
  );
}

const bezDiakritiky = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function KartyPravidiel() {
  useTitulok("Karty — pravidlá");
  const { sada, chyba } = useSada();
  const [typ, setTyp] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");

  // Odkaz na konkrétnu kartu (#karta-<id>) — karty sa vykreslia až po načítaní sady.
  useEffect(() => {
    if (sada === null || location.hash === "") return;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [sada]);

  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (sada === null) return <Nacitavanie />;
  const vzhlad = vzhladSady(sada);

  const q = bezDiakritiky(hladat.trim());
  const viditelne = sada.karty.filter(
    (k) =>
      (typ === null || k.tagy.includes(typ)) &&
      (q === "" || bezDiakritiky([k.nazov, k.efekt, ...k.tagy, k.pribeh ?? "", k.ucel ?? ""].join(" ")).includes(q)),
  );
  const sTextami = sada.karty.filter((k) => k.pribeh !== undefined || k.ucel !== undefined).length;

  return (
    <div className="kp">
      <header className="stranka-hlava">
        <Odkaz href="/pravidla" className="kp-spat">
          ← Pravidlá
        </Odkaz>
        <span className="kapitola-kicker">Pravidlá · karty</span>
        <h1>Karty</h1>
        <p className="tlmene">
          {sada.karty.length} kariet hry: čo robia, odkiaľ sa v dedine vzali a čo s nimi v partii dosiahneš.{" "}
          {sTextami === 0
            ? "Príbehy a účel kariet pripravujeme."
            : sTextami < sada.karty.length && `Príbeh a účel v hre má zatiaľ ${sTextami} z ${sada.karty.length} kariet.`}{" "}
          Varianty rozloženia akcií ukazuje <Odkaz href="/karty">glosár kariet</Odkaz>.
        </p>
        <div className="glosar-ovladanie">
          <div className="cipy" role="group" aria-label="Typ karty">
            {TYPY_KARIET.map((t) => (
              <button key={t.nazov} className={typ === t.tag ? "cip aktivny" : "cip"} aria-pressed={typ === t.tag} onClick={() => setTyp(t.tag)}>
                {t.nazov}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Hľadať kartu, efekt alebo príbeh…"
            aria-label="Hľadať v kartách"
            value={hladat}
            onChange={(e) => setHladat(e.target.value)}
          />
        </div>
      </header>

      <div className="kp-zoznam">
        {viditelne.map((k) => (
          <Karta key={k.id} karta={k} vzhlad={vzhlad} />
        ))}
      </div>
      {viditelne.length === 0 && <p className="tlmene">Žiadna karta nezodpovedá filtru.</p>}
    </div>
  );
}
