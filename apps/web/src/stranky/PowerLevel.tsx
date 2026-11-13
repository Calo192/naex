// Power level kariet (/karty/power-level, Michal 2026-11-08): sila karty zo
// spoločných váh akcií a vlastnej váhy efektu. Vidí každý; slidre má len admin —
// server zápis inému odmietne. Počíta powerLevelKarty z @naex/tvorba, tu je kreslenie.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AkciaDef, KartaNavrh, PowerLevel as PowerLevelKarty, VahyPowerLevelu, Vzhlad } from "@naex/tvorba";
import { PREDVOLENE_VAHY_AKCII, ROZSAH_VAHY, powerLevelKarty, variant, variantyKarty } from "@naex/tvorba";
import { api, textChyby } from "../lib/api.ts";
import { useTitulok } from "../lib/router.tsx";
import { useSada, vzhladSady } from "../lib/sada.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { useTelefonStranky } from "../hra/zariadenie.ts";
import { Hlaska, Nacitavanie, type SpravaHlasky } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KartyZalozky } from "../dielna/Dielna.tsx";
import "./powerLevel.css";

/** Hlavné typy kariet idú prvé (ako na Heatmape); ostatné tagy podľa počtu. */
const HLAVNE_TAGY = ["Občan", "Nástroj", "Starešina", "Zviera", "Lokalita", "Kliatba"];

const PORADIA = {
  silne: "najsilnejšie",
  slabe: "najslabšie",
  akcie: "podľa akcií",
  efekt: "podľa efektu",
  nazov: "podľa názvu",
} as const;
type Poradie = keyof typeof PORADIA;

interface StavServera {
  readonly vahy: VahyPowerLevelu;
  readonly upravene: number | null;
}

const cislo = (x: number): string => x.toLocaleString("sk", { maximumFractionDigits: 2 });
const znamienko = (x: number): string => (x > 0 ? `+${cislo(x)}` : cislo(x));
const tonCisla = (x: number): string => (x > 0 ? "pl-kladne" : x < 0 ? "pl-zaporne" : "pl-nula");

function porovnaj(poradie: Poradie, a: { k: KartaNavrh; p: PowerLevelKarty }, b: { k: KartaNavrh; p: PowerLevelKarty }): number {
  const nazov = a.k.nazov.localeCompare(b.k.nazov, "sk");
  if (poradie === "nazov") return nazov;
  if (poradie === "slabe") return a.p.spolu - b.p.spolu || nazov;
  if (poradie === "akcie") return b.p.lava + b.p.prava - (a.p.lava + a.p.prava) || nazov;
  if (poradie === "efekt") return b.p.efekt - a.p.efekt || b.p.spolu - a.p.spolu || nazov;
  return b.p.spolu - a.p.spolu || nazov;
}

function Ikona({ kluc, akcia }: { readonly kluc: string; readonly akcia: AkciaDef | undefined }) {
  return (
    <span className="pl-ikona" aria-hidden="true">
      <IkonaAkcie kluc={kluc} akcia={akcia} />
    </span>
  );
}

function Slider({
  hodnota,
  nastav,
  popis,
  zmraz,
}: {
  readonly hodnota: number;
  readonly nastav: (v: number) => void;
  readonly popis: string;
  /** Kým sa slider ťahá, zoznam sa nepreusporiada — riadok by ušiel spod myši. */
  readonly zmraz?: (ano: boolean) => void;
}) {
  return (
    <input
      type="range"
      min={ROZSAH_VAHY.min}
      max={ROZSAH_VAHY.max}
      step={ROZSAH_VAHY.krok}
      value={hodnota}
      onChange={(e) => nastav(Number(e.target.value))}
      aria-label={popis}
      aria-valuetext={znamienko(hodnota)}
      onPointerDown={() => zmraz?.(true)}
      onPointerUp={() => zmraz?.(false)}
      onFocus={() => zmraz?.(true)}
      onBlur={() => zmraz?.(false)}
    />
  );
}

/** Váhy akcií: admin ich ťahá slidrami, ostatní vidia hodnoty. */
function VahyAkcii({
  akcie,
  vahy,
  ulozene,
  admin,
  nastav,
}: {
  readonly akcie: readonly AkciaDef[];
  readonly vahy: VahyPowerLevelu;
  readonly ulozene: VahyPowerLevelu;
  readonly admin: boolean;
  readonly nastav: (kluc: string, v: number) => void;
}) {
  return (
    <ul className={admin ? "pl-vahy-zoznam s-slidrami" : "pl-vahy-zoznam"}>
      {akcie.map((a) => {
        const v = vahy.akcie[a.kluc] ?? 0;
        const zmenena = v !== (ulozene.akcie[a.kluc] ?? 0);
        return (
          <li key={a.kluc} className={zmenena ? "zmenena" : undefined} title={a.popis}>
            <Ikona kluc={a.kluc} akcia={a} />
            <span className="pl-vaha-nazov">{a.nazov}</span>
            <output className={`pl-vaha-hodnota ${tonCisla(v)}`}>{znamienko(v)}</output>
            {admin && <Slider hodnota={v} nastav={(n) => nastav(a.kluc, n)} popis={`Váha akcie ${a.nazov}`} />}
          </li>
        );
      })}
    </ul>
  );
}

function RiadokKarty({
  poradie,
  karta,
  p,
  vzhlad,
  akcie,
  sirkaKarty,
  admin,
  zmenenyEfekt,
  nastavEfekt,
  zmraz,
}: {
  readonly poradie: number;
  readonly karta: KartaNavrh;
  readonly p: PowerLevelKarty;
  readonly vzhlad: Vzhlad;
  readonly akcie: ReadonlyMap<string, AkciaDef>;
  readonly sirkaKarty: number;
  readonly admin: boolean;
  readonly zmenenyEfekt: boolean;
  readonly nastavEfekt: (v: number) => void;
  readonly zmraz: (ano: boolean) => void;
}) {
  const roz = useMemo(() => variant(variantyKarty(karta), 0), [karta]);
  const maEfekt = karta.efekt.trim() !== "";
  return (
    <li className="pl-karta">
      <span className="pl-poradie">{poradie}.</span>
      <div className="pl-nahlad">
        {roz === null ? (
          <div className="pl-bez-nahladu" style={{ width: sirkaKarty }}>
            Karta sa nedá zložiť
          </div>
        ) : (
          <KartaLico karta={karta} lava={roz.lava} prava={roz.prava} vzhlad={vzhlad} sirka={sirkaKarty} bezPopisov />
        )}
      </div>
      <div className="pl-info">
        <h3>
          {karta.nazov} <span className="pl-tagy">{karta.tagy.join(" · ")}</span>
        </h3>
        <div className="pl-rozpad">
          {(["lava", "prava"] as const).map((s) => (
            <div key={s} className="pl-strana">
              <span className="pl-strana-nazov">{s === "lava" ? "Vľavo" : "Vpravo"}</span>
              {p.polozky
                .filter((x) => x.strana === s)
                .map((x) => (
                  <span key={x.akcia} className="pl-polozka" title={`${akcie.get(x.akcia)?.nazov ?? x.akcia}: ${x.pocet} × ${znamienko(x.vaha)}`}>
                    <Ikona kluc={x.akcia} akcia={akcie.get(x.akcia)} />
                    {x.pocet > 1 && <span className="pl-pocet">×{x.pocet}</span>}
                    <span className={tonCisla(x.body)}>{znamienko(x.body)}</span>
                  </span>
                ))}
              <b className={`pl-medzisucet ${tonCisla(p[s])}`}>= {znamienko(p[s])}</b>
            </div>
          ))}
        </div>
        {maEfekt && (
          <div className={zmenenyEfekt ? "pl-efekt zmeneny" : "pl-efekt"}>
            <p>{karta.efekt}</p>
            <div className="pl-efekt-vaha">
              <span>Efekt</span>
              {admin && <Slider hodnota={p.efekt} nastav={nastavEfekt} popis={`Váha efektu karty ${karta.nazov}`} zmraz={zmraz} />}
              <output className={tonCisla(p.efekt)}>{znamienko(p.efekt)}</output>
            </div>
          </div>
        )}
      </div>
      <div className="pl-spolu" aria-label={`Power level ${cislo(p.spolu)}`}>
        <b className={tonCisla(p.spolu)}>{cislo(p.spolu)}</b>
        <dl>
          <dt>akcie</dt>
          <dd>{znamienko(p.lava + p.prava)}</dd>
          <dt>efekt</dt>
          <dd>{maEfekt ? znamienko(p.efekt) : "—"}</dd>
        </dl>
      </div>
    </li>
  );
}

export function PowerLevel() {
  useTitulok("Power level kariet");
  const { sada, chyba } = useSada();
  const { ja } = useUcet();
  const admin = ja?.rola === "admin";
  const { telefon } = useTelefonStranky();
  const [server, setServer] = useState<StavServera | null>(null);
  const [chybaVah, setChybaVah] = useState<string | null>(null);
  const [upravyAkcii, setUpravyAkcii] = useState<Readonly<Record<string, number>>>({});
  const [upravyEfektov, setUpravyEfektov] = useState<Readonly<Record<string, number>>>({});
  const [uklada, setUklada] = useState(false);
  const [hlaska, setHlaska] = useState<SpravaHlasky | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [poradie, setPoradie] = useState<Poradie>("silne");
  const [hladat, setHladat] = useState("");
  const [zmrazene, setZmrazene] = useState(false);
  // Na úzkej obrazovke je panel nad zoznamom — zbalený, aby karty neboli až pod 16 slidrami.
  const [panelOtvoreny] = useState(() => window.matchMedia("(min-width: 1100.02px)").matches);
  const [vahyPoradia, setVahyPoradia] = useState<VahyPowerLevelu | null>(null);

  useEffect(() => {
    api
      .get<StavServera>("/power-level")
      .then(setServer)
      .catch((e: unknown) => setChybaVah(textChyby(e)));
  }, []);

  const ulozene = server?.vahy ?? null;
  const vahy = useMemo<VahyPowerLevelu | null>(
    () => (ulozene === null ? null : { akcie: { ...ulozene.akcie, ...upravyAkcii }, efekty: { ...ulozene.efekty, ...upravyEfektov } }),
    [ulozene, upravyAkcii, upravyEfektov],
  );
  // Len to, čo sa od uloženého naozaj líši — slider vrátený späť nie je zmena.
  const zmeny = useMemo(() => {
    if (ulozene === null) return { akcie: {}, efekty: {}, pocet: 0 };
    const akcie = Object.fromEntries(Object.entries(upravyAkcii).filter(([k, v]) => v !== (ulozene.akcie[k] ?? 0)));
    const efekty = Object.fromEntries(Object.entries(upravyEfektov).filter(([k, v]) => v !== (ulozene.efekty[k] ?? 0)));
    return { akcie, efekty, pocet: Object.keys(akcie).length + Object.keys(efekty).length };
  }, [ulozene, upravyAkcii, upravyEfektov]);

  useEffect(() => {
    if (!zmrazene) setVahyPoradia(vahy);
  }, [vahy, zmrazene]);

  const tagy = useMemo(() => {
    if (sada === null) return [];
    const pocty = new Map<string, number>();
    for (const k of sada.karty) for (const t of k.tagy) pocty.set(t, (pocty.get(t) ?? 0) + 1);
    const hlavne = HLAVNE_TAGY.filter((t) => pocty.has(t));
    const ostatne = [...pocty.keys()].filter((t) => !HLAVNE_TAGY.includes(t)).sort((a, b) => (pocty.get(b) ?? 0) - (pocty.get(a) ?? 0) || a.localeCompare(b, "sk"));
    return [...hlavne, ...ostatne].map((t) => ({ tag: t, pocet: pocty.get(t) ?? 0 }));
  }, [sada]);

  const filtr = hladat.trim().toLocaleLowerCase("sk");
  const riadky = useMemo(() => {
    if (sada === null || vahy === null) return [];
    const vybrane = sada.karty.filter((k) => (tag === null || k.tagy.includes(tag)) && (filtr === "" || [k.nazov, k.efekt].some((t) => t.toLocaleLowerCase("sk").includes(filtr))));
    // Poradie podľa váh pred ťahaním slidera efektu, čísla podľa aktuálnych.
    const vahyZoradenia = vahyPoradia ?? vahy;
    const miesto = new Map(
      vybrane
        .map((k) => ({ k, p: powerLevelKarty(k, vahyZoradenia) }))
        .sort((a, b) => porovnaj(poradie, a, b))
        .map((r, i) => [r.k.id, i]),
    );
    return vybrane.map((k) => ({ k, p: powerLevelKarty(k, vahy) })).sort((a, b) => (miesto.get(a.k.id) ?? 0) - (miesto.get(b.k.id) ?? 0));
  }, [sada, vahy, vahyPoradia, tag, filtr, poradie]);

  const uloz = useCallback(() => {
    setUklada(true);
    setHlaska(null);
    api
      .put<StavServera>("/admin/power-level", { akcie: zmeny.akcie, efekty: zmeny.efekty })
      .then((s) => {
        setServer(s);
        setUpravyAkcii({});
        setUpravyEfektov({});
        setHlaska({ druh: "ok", text: "Váhy uložené — hráči ich vidia hneď." });
      })
      .catch((e: unknown) => setHlaska({ druh: "chyba", text: textChyby(e) }))
      .finally(() => setUklada(false));
  }, [zmeny]);

  const hlava = (
    <HlavaStranky
      nadpis="Karty"
      uvod="Power level — sila karty z akcií na oboch stranách a z jej efektu."
      zalozky={<KartyZalozky aktivna="power-level" />}
      viac={
        <p>
          Každá akcia má spoločnú váhu: kladná power level karty zvyšuje, záporná (akcia, ktorá hráčovi škodí) ho znižuje. Akcie karty sa sčítajú ako
          počet × váha na ľavej aj pravej strane, bez ohľadu na variant. K tomu sa pripočíta váha efektu, ktorú má každá karta s efektom vlastnú. Váhy
          nastavuje admin; je to odhad sily, nie pravidlo hry.
        </p>
      }
    />
  );
  const chybaStranky = chyba ?? chybaVah;
  if (chybaStranky !== null || sada === null || vahy === null || ulozene === null)
    return <div className="power-level">{hlava}{chybaStranky !== null ? <Hlaska>{chybaStranky}</Hlaska> : <Nacitavanie />}</div>;

  const vzhlad = vzhladSady(sada);
  const akcieSady = new Map(sada.akcie.map((a) => [a.kluc, a]));
  // V paneli len akcie, ktoré sú na kartách sady, plus tie s predvolenou váhou (aj keď ich sada práve nemá).
  const naKartach = new Set(sada.karty.flatMap((k) => [...Object.keys(k.lava.akcie), ...Object.keys(k.prava.akcie)]));
  const akciePanela = sada.akcie.filter((a) => naKartach.has(a.kluc) || a.kluc in PREDVOLENE_VAHY_AKCII);
  const priemer = riadky.length === 0 ? 0 : riadky.reduce((s, r) => s + r.p.spolu, 0) / riadky.length;
  const sirkaKarty = telefon ? 72 : 96;

  return (
    <div className="power-level">
      {hlava}
      <div className="pl-rozlozenie">
        <details className="pl-panel" open={panelOtvoreny}>
          <summary>Váhy akcií</summary>
          {admin ? (
            <p className="tlmene">Ťahaj slidre — zoznam sa prepočíta hneď, hráči uvidia zmenu po uložení.</p>
          ) : (
            <p className="tlmene">Koľko pridá jeden kus akcie. Nastavuje ich admin.</p>
          )}
          <VahyAkcii akcie={akciePanela} vahy={vahy} ulozene={ulozene} admin={admin} nastav={(k, v) => setUpravyAkcii((u) => ({ ...u, [k]: v }))} />
          {admin && (
            <div className="pl-ulozenie">
              <button type="button" className="tlacidlo tlacidlo-hlavne tlacidlo-male" disabled={zmeny.pocet === 0 || uklada} onClick={uloz}>
                {uklada ? "Ukladám…" : zmeny.pocet === 0 ? "Bez zmien" : `Uložiť (${zmeny.pocet})`}
              </button>
              <button
                type="button"
                className="tlacidlo tlacidlo-jemne tlacidlo-male"
                disabled={zmeny.pocet === 0 || uklada}
                onClick={() => {
                  setUpravyAkcii({});
                  setUpravyEfektov({});
                }}
              >
                Zahodiť
              </button>
              <button
                type="button"
                className="tlacidlo tlacidlo-jemne tlacidlo-male"
                disabled={uklada}
                title="Vráti váhy akcií na predvolené; efekty ostanú"
                onClick={() => setUpravyAkcii(Object.fromEntries(akciePanela.map((a) => [a.kluc, PREDVOLENE_VAHY_AKCII[a.kluc] ?? 0])))}
              >
                Predvolené
              </button>
            </div>
          )}
          {hlaska !== null && <Hlaska druh={hlaska.druh}>{hlaska.text}</Hlaska>}
        </details>

        <section className="pl-hlavna" aria-label="Karty podľa power levelu">
          <div className="pl-ovladanie">
            <div className="cipy" role="group" aria-label="Tag kariet">
              <button className={tag === null ? "cip aktivny" : "cip"} onClick={() => setTag(null)}>
                Všetky <span className="pl-pocet-tagu">{sada.karty.length}</span>
              </button>
              {tagy.map((t) => (
                <button key={t.tag} className={tag === t.tag ? "cip aktivny" : "cip"} onClick={() => setTag(t.tag)}>
                  {t.tag} <span className="pl-pocet-tagu">{t.pocet}</span>
                </button>
              ))}
            </div>
            <div className="pl-riadok-ovladania">
              <label>
                <span className="tlmene">Zoradiť</span>{" "}
                <select value={poradie} onChange={(e) => setPoradie(e.target.value as Poradie)}>
                  {(Object.keys(PORADIA) as Poradie[]).map((p) => (
                    <option key={p} value={p}>
                      {PORADIA[p]}
                    </option>
                  ))}
                </select>
              </label>
              <input type="search" placeholder="Hľadať názov alebo efekt…" value={hladat} onChange={(e) => setHladat(e.target.value)} />
              <span className="tlmene pl-suhrn">
                {riadky.length} {riadky.length === 1 ? "karta" : riadky.length >= 2 && riadky.length <= 4 ? "karty" : "kariet"} · priemer {cislo(Math.round(priemer * 10) / 10)}
              </span>
            </div>
          </div>
          <ol className="pl-zoznam">
            {riadky.map(({ k, p }, i) => (
              <RiadokKarty
                key={k.id}
                poradie={i + 1}
                karta={k}
                p={p}
                vzhlad={vzhlad}
                akcie={akcieSady}
                sirkaKarty={sirkaKarty}
                admin={admin}
                zmenenyEfekt={k.id in zmeny.efekty}
                nastavEfekt={(v) => setUpravyEfektov((u) => ({ ...u, [k.id]: v }))}
                zmraz={setZmrazene}
              />
            ))}
            {riadky.length === 0 && <p className="tlmene">Žiadna karta nezodpovedá filtru.</p>}
          </ol>
        </section>
      </div>
    </div>
  );
}
