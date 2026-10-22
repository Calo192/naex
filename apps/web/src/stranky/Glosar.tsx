// Glosár kariet (/karty) — zverejnená sada v tlačovom vzhľade, s variantmi,
// detailom karty a legendou akcií. Prístupný aj bez prihlásenia.

import { useEffect, useMemo, useState } from "react";
import type { KartaNavrh, Vzhlad } from "@naex/tvorba";
import { farbaKarty, variant, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { api } from "../lib/api.ts";
import { KartyZalozky } from "../dielna/Dielna.tsx";

/** Autor karty z Dielne; „prerobena“ = tvorca ju po prevzatí zmenil, vtedy „nápad: X“. */
type AutoriKariet = Readonly<Record<string, { readonly meno: string; readonly prerobena: boolean; readonly navrh: number }>>;
import { useSada, vzhladSady } from "../lib/sada.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";

const TYPY: readonly { readonly nazov: string; readonly tag: string | null }[] = [
  { nazov: "Všetky", tag: null },
  { nazov: "Starší", tag: "Starešina" },
  { nazov: "Občania", tag: "Občan" },
  { nazov: "Zvieratá", tag: "Zviera" },
  { nazov: "Lokality", tag: "Lokalita" },
  { nazov: "Nástroje", tag: "Nástroj" },
  { nazov: "Kliatby", tag: "Kliatba" },
];

function SipkyVariantov({ v, pocet, nastav }: { readonly v: number; readonly pocet: number; readonly nastav: (n: number) => void }) {
  if (pocet <= 1) return <span className="glosar-jediny">jediný variant</span>;
  return (
    <span className="glosar-varianty">
      <button className="tlacidlo-male" onClick={() => nastav((v - 1 + pocet) % pocet)} aria-label="Predchádzajúci variant">
        ‹
      </button>
      <span>
        {v + 1} / {pocet}
      </span>
      <button className="tlacidlo-male" onClick={() => nastav((v + 1) % pocet)} aria-label="Ďalší variant">
        ›
      </button>
    </span>
  );
}

function Detail({
  karta,
  vzhlad,
  zavri,
  autor,
}: {
  readonly karta: KartaNavrh;
  readonly vzhlad: Vzhlad;
  readonly zavri: () => void;
  readonly autor: AutoriKariet[string] | undefined;
}) {
  const varianty = useMemo(() => variantyKarty(karta), [karta]);
  const [v, setV] = useState(0);
  const roz = variant(varianty, v);
  const farba = farbaKarty(karta, vzhlad.kategorie);
  const akcie = [...new Set([...Object.keys(karta.lava.akcie), ...Object.keys(karta.prava.akcie)])];

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") zavri();
      if (e.key === "ArrowRight") setV((x) => (x + 1) % Math.max(1, varianty.pocet));
      if (e.key === "ArrowLeft") setV((x) => (x - 1 + varianty.pocet) % Math.max(1, varianty.pocet));
    };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [zavri, varianty.pocet]);

  return (
    <div className="modal" onClick={zavri} role="dialog" aria-modal="true" aria-label={karta.nazov}>
      <div className="modal-obsah glosar-detail" onClick={(e) => e.stopPropagation()}>
        <button className="modal-zavriet tlacidlo-jemne" onClick={zavri} aria-label="Zavrieť">
          ✕
        </button>
        <div className="glosar-detail-karta">
          {roz !== null && (
            <KartaLico karta={karta} lava={roz.lava} prava={roz.prava} vzhlad={vzhlad} sirka={Math.min(380, window.innerWidth - 64)} />
          )}
          <SipkyVariantov v={v} pocet={varianty.pocet} nastav={setV} />
        </div>
        <div className="glosar-detail-info">
          <h2 style={{ color: farba }}>{karta.nazov}</h2>
          <p className="glosar-tagy">{karta.tagy.join(" · ")}</p>
          {autor !== undefined && (
            <p className="glosar-autor">
              <span className="odznak odznak-dielna">✦ Dielňa</span>{" "}
              <Odkaz href={`/karty/dielna/${autor.navrh}`}>
                {autor.prerobena ? "nápad" : "autor"}: {autor.meno}
              </Odkaz>
            </p>
          )}
          {karta.efekt !== "" && <p className="glosar-efekt">{karta.efekt}</p>}
          <h3>Akcie na karte</h3>
          {akcie.length === 0 ? (
            <p className="tlmene">Karta nemá žiadne akcie.</p>
          ) : (
            <ul className="legenda legenda-uzka">
              {akcie.map((k) => {
                const a = vzhlad.akcie.find((x) => x.kluc === k);
                const l = karta.lava.akcie[k] ?? 0;
                const p = karta.prava.akcie[k] ?? 0;
                return (
                  <li key={k}>
                    <span className="legenda-ikona" style={{ background: farba }}>
                      <IkonaAkcie kluc={k} akcia={a} />
                    </span>
                    <div>
                      <strong>
                        {a?.nazov ?? k}{" "}
                        <span className="tlmene">
                          {l > 0 && `vľavo ×${l}`}
                          {l > 0 && p > 0 && " · "}
                          {p > 0 && `vpravo ×${p}`}
                        </span>
                      </strong>
                      <span>{a?.popis}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="tlmene glosar-poznamka">
            {varianty.pocet > 1
              ? `Karta existuje v ${varianty.pocet} variantoch — líšia sa pozíciou akcií. Šípky (aj ← →) ich prepínajú.`
              : "Karta má jediné rozloženie akcií."}
          </p>
          <p>
            <Odkaz href={`/karty/dielna/novy?zaklad=${encodeURIComponent(karta.id)}`} className="tlacidlo tlacidlo-male">
              Navrhnúť úpravu v Dielni
            </Odkaz>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Glosar() {
  useTitulok("Karty");
  const { sada, chyba } = useSada();
  const [typ, setTyp] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");
  const [sirka, setSirka] = useState(() => (window.innerWidth < 600 ? 200 : 240));
  const [varianty, setVarianty] = useState<Readonly<Record<string, number>>>({});
  const [detail, setDetail] = useState<KartaNavrh | null>(null);
  const [autori, setAutori] = useState<AutoriKariet>({});
  useEffect(() => {
    api
      .get<{ autori: AutoriKariet }>("/dielna/autori")
      .then((r) => setAutori(r.autori))
      .catch(() => undefined);
  }, []);

  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (sada === null) return <Nacitavanie />;
  const vzhlad = vzhladSady(sada);

  const filtr = hladat.trim().toLocaleLowerCase("sk");
  const viditelne = sada.karty.filter(
    (k) =>
      (typ === null || k.tagy.includes(typ)) &&
      (filtr === "" || k.nazov.toLocaleLowerCase("sk").includes(filtr) || k.efekt.toLocaleLowerCase("sk").includes(filtr) || k.tagy.some((t) => t.toLocaleLowerCase("sk").includes(filtr))),
  );

  return (
    <div className="glosar">
      <header className="stranka-hlava">
        <h1>Karty</h1>
        <KartyZalozky aktivna="karty" />
        <p className="tlmene">
          {sada.karty.length} kariet hry. Prejdi myšou ponad <strong>ikonu akcie</strong>, tučný spúšťač alebo pojem v
          kurzíve — zobrazí sa, čo robí. Klikni na kartu pre detail.
        </p>
        <div className="glosar-ovladanie">
          <div className="cipy" role="group" aria-label="Typ karty">
            {TYPY.map((t) => (
              <button key={t.nazov} className={typ === t.tag ? "cip aktivny" : "cip"} onClick={() => setTyp(t.tag)}>
                {t.nazov}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Hľadať názov, tag alebo efekt…" value={hladat} onChange={(e) => setHladat(e.target.value)} />
          <label className="glosar-velkost">
            <span className="tlmene">Veľkosť</span>
            <input type="range" min={150} max={420} step={10} value={sirka} onChange={(e) => setSirka(Number(e.target.value))} />
          </label>
        </div>
      </header>

      <div className="mriezka-kariet" style={{ gridTemplateColumns: `repeat(auto-fill, ${sirka}px)` }}>
        {viditelne.map((k) => {
          const vs = variantyKarty(k);
          const i = varianty[k.id] ?? 0;
          const roz = variant(vs, i);
          if (roz === null) return null;
          return (
            <figure key={k.id} className="mriezka-polozka">
              <KartaLico karta={k} lava={roz.lava} prava={roz.prava} vzhlad={vzhlad} sirka={sirka} onClick={() => setDetail(k)} />
              <figcaption>
                <SipkyVariantov v={i} pocet={vs.pocet} nastav={(n) => setVarianty((s) => ({ ...s, [k.id]: n }))} />
              </figcaption>
            </figure>
          );
        })}
        {viditelne.length === 0 && <p className="tlmene">Žiadna karta nezodpovedá filtru.</p>}
      </div>

      <section className="glosar-legenda" id="akcie">
        <h2>Akcie</h2>
        <p className="tlmene">
          Akcia sa aktivuje, keď sa na spoji dvoch susedných kariet stretne s inou akciou na rovnakej výške (pravá strana
          jednej karty sa dotýka ľavej strany ďalšej).
        </p>
        <ul className="legenda">
          {sada.akcie.map((a) => (
            <li key={a.kluc}>
              <span className="legenda-ikona">
                <IkonaAkcie kluc={a.kluc} akcia={a} />
              </span>
              <div>
                <strong>{a.nazov}</strong>
                <span>{a.popis}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {detail !== null && <Detail karta={detail} vzhlad={vzhlad} zavri={() => setDetail(null)} autor={autori[detail.id]} />}
    </div>
  );
}
