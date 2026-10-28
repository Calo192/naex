// Štatistiky hráča: Frajerina (hodnotenie po vzore šachového Elo), jej vývoj,
// bilancia partií a podrobné počítadlá z archívu dohraných partií.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Action, StatistikyHraca } from "@naex/core";
import { rozlozRod } from "@naex/core";
import { Odkaz } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Avatar } from "../komponenty.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import "./statistiky.css";

// ---- tvar odpovede /api/hraci/:id -------------------------------------------

type Vysledok = "vyhra" | "prehra" | "remiza";

interface HracVerejny {
  readonly id: number | null;
  readonly meno: string;
  readonly avatar: string | null;
}

export interface Frajerina {
  readonly hodnota: number;
  readonly najvyssia: number;
  readonly partie: number;
  readonly vyhry: number;
  readonly prehry: number;
  readonly remizy: number;
  readonly titul: string;
  readonly provizorna: boolean;
  readonly poradie: number | null;
}

interface PartiaVProfile {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly kola: number;
  readonly dovod: string;
  readonly vysledok: Vysledok;
  readonly body: readonly [number, number] | null;
  readonly frajerina: { readonly pred: number; readonly po: number };
  readonly super: HracVerejny & { readonly frajerina: number };
}

export interface ProfilHraca {
  readonly hrac: HracVerejny & { readonly id: number; readonly rola: string; readonly vytvoreny: number };
  readonly frajerina: Frajerina;
  readonly historia: readonly { readonly cas: number; readonly hodnota: number }[];
  readonly statistiky: StatistikyHraca;
  readonly casSpolu: number;
  readonly partie: readonly PartiaVProfile[];
  readonly superi: readonly (HracVerejny & { readonly partie: number; readonly vyhry: number; readonly prehry: number; readonly remizy: number })[];
}

// ---- formátovanie -------------------------------------------------------------

const cislo = (n: number, des = 0): string => n.toLocaleString("sk-SK", { minimumFractionDigits: des, maximumFractionDigits: des });

/** Podiel v percentách; bez menovateľa pomlčka. */
const percento = (cast: number, celok: number): string => (celok === 0 ? "—" : `${Math.round((100 * cast) / celok)} %`);

/** Priemer na jednotku; bez menovateľa pomlčka. */
const priemer = (sucet: number, pocet: number, des = 1): string => (pocet === 0 ? "—" : cislo(sucet / pocet, des));

function trvanie(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

const datum = (cas: number): string => new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

/** Slovenské tvary: 1 partia, 2–4 partie, 5 partií. */
export function tvar(n: number, jeden: string, dva: string, pat: string): string {
  const a = Math.abs(n);
  return a === 1 ? jeden : a >= 2 && a <= 4 ? dva : pat;
}

const ZNAK_ZMENY = (d: number): string => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0");

// ---- Frajerina ------------------------------------------------------------------

/** Číslo Frajeriny; provizórne hodnotenie má otáznik ako v šachu („1200?“). */
export function CisloFrajeriny({ f, velke = false }: { readonly f: Pick<Frajerina, "hodnota" | "provizorna">; readonly velke?: boolean }) {
  return (
    <span className={velke ? "frajerina-velka" : "frajerina-cislo"} title={f.provizorna ? "Provizórne hodnotenie — ustáli sa po 5 partiách." : "Frajerina"}>
      {f.hodnota}
      {f.provizorna && <span className="frajerina-otaznik">?</span>}
    </span>
  );
}

export function BilanciaPruh({ vyhry, remizy, prehry }: { readonly vyhry: number; readonly remizy: number; readonly prehry: number }) {
  const spolu = vyhry + remizy + prehry;
  if (spolu === 0) return null;
  const casti = [
    { trieda: "vyhry", n: vyhry, text: "výhry" },
    { trieda: "remizy", n: remizy, text: "remízy" },
    { trieda: "prehry", n: prehry, text: "prehry" },
  ].filter((c) => c.n > 0);
  return (
    <div className="bilancia-pruh" role="img" aria-label={`${vyhry} výhier, ${remizy} remíz, ${prehry} prehier`}>
      {casti.map((c) => (
        <span key={c.trieda} className={c.trieda} style={{ flexGrow: c.n }} title={`${c.n} ${c.text} (${percento(c.n, spolu)})`} />
      ))}
    </div>
  );
}

/** Zaokrúhlené hodnoty osi: 3 – 5 čiar s krokom 10/20/25/50/100… */
function osY(min: number, max: number): { od: number; do_: number; ciary: number[] } {
  const rozpatie = Math.max(max - min, 40);
  const hruby = rozpatie / 4;
  const rad = 10 ** Math.floor(Math.log10(hruby));
  const krok = [1, 2, 2.5, 5, 10].map((k) => k * rad).find((k) => k >= hruby) ?? rad * 10;
  const od = Math.floor((min - rozpatie * 0.08) / krok) * krok;
  const do_ = Math.ceil((max + rozpatie * 0.08) / krok) * krok;
  const ciary: number[] = [];
  for (let v = od; v <= do_ + 1e-9; v += krok) ciary.push(Math.round(v));
  return { od, do_, ciary };
}

/** Vývoj Frajeriny: čiara cez partie, nitkový kríž a tooltip pri prejdení myšou. */
export function GrafFrajeriny({ historia }: { readonly historia: ProfilHraca["historia"] }) {
  const obal = useRef<HTMLDivElement>(null);
  const [sirka, setSirka] = useState(600);
  const [aktivny, setAktivny] = useState<number | null>(null);

  useEffect(() => {
    const el = obal.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => {
      if (z !== undefined) setSirka(Math.max(260, Math.round(z.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vyska = 220;
  const okraj = { hore: 14, dole: 26, vlavo: 46, vpravo: 14 };
  const hodnoty = historia.map((h) => h.hodnota);
  const { od, do_, ciary } = osY(Math.min(...hodnoty), Math.max(...hodnoty));
  const n = historia.length;
  const x = (i: number): number => okraj.vlavo + (n <= 1 ? 0 : (i / (n - 1)) * (sirka - okraj.vlavo - okraj.vpravo));
  const y = (v: number): number => okraj.hore + (1 - (v - od) / (do_ - od || 1)) * (vyska - okraj.hore - okraj.dole);
  const cesta = historia.map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(h.hodnota).toFixed(1)}`).join(" ");
  const plocha = `${cesta} L${x(n - 1).toFixed(1)},${vyska - okraj.dole} L${x(0).toFixed(1)},${vyska - okraj.dole} Z`;
  // Popisy osi X: začiatok, koniec a pár medzi nimi, aby sa neprekrývali.
  const krokX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(sirka / 90))));

  const pohyb = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let naj = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(naj) - px)) naj = i;
    setAktivny(naj);
  };

  const a = aktivny === null ? null : (historia[aktivny] ?? null);
  const predA = aktivny === null || aktivny === 0 ? null : (historia[aktivny - 1] ?? null);

  return (
    <div className="graf-frajeriny" ref={obal}>
      <svg
        width={sirka}
        height={vyska}
        role="img"
        aria-label={`Vývoj Frajeriny za ${n - 1} ${tvar(n - 1, "partiu", "partie", "partií")}: od ${hodnoty[0]} po ${hodnoty[n - 1]}.`}
        onPointerMove={pohyb}
        onPointerLeave={() => setAktivny(null)}
      >
        <defs>
          <linearGradient id="frajerina-plocha" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--akcent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--akcent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ciary.map((v) => (
          <g key={v} className="graf-mriezka">
            <line x1={okraj.vlavo} x2={sirka - okraj.vpravo} y1={y(v)} y2={y(v)} />
            <text x={okraj.vlavo - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {historia.map((_, i) =>
          i % krokX === 0 || i === n - 1 ? (
            <text key={i} className="graf-os-x" x={x(i)} y={vyska - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {i === 0 ? "štart" : i}
            </text>
          ) : null,
        )}
        <path d={plocha} fill="url(#frajerina-plocha)" />
        <path d={cesta} className="graf-ciara" />
        {n <= 40 && historia.map((h, i) => <circle key={i} className="graf-bod" cx={x(i)} cy={y(h.hodnota)} r={3} />)}
        {a !== null && aktivny !== null && (
          <g className="graf-kriz">
            <line x1={x(aktivny)} x2={x(aktivny)} y1={okraj.hore} y2={vyska - okraj.dole} />
            <circle cx={x(aktivny)} cy={y(a.hodnota)} r={5} />
          </g>
        )}
      </svg>
      {a !== null && aktivny !== null && (
        <div className="graf-tooltip" style={{ left: Math.min(Math.max(x(aktivny), 70), sirka - 70), top: y(a.hodnota) }}>
          <strong>{a.hodnota}</strong>
          {predA !== null && <span className={a.hodnota >= predA.hodnota ? "plus" : "minus"}> {ZNAK_ZMENY(a.hodnota - predA.hodnota)}</span>}
          <span className="tlmene">{aktivny === 0 ? `registrácia ${datum(a.cas)}` : `po ${aktivny}. partii · ${datum(a.cas)}`}</span>
        </div>
      )}
    </div>
  );
}

// ---- dlaždice ---------------------------------------------------------------------

function Udaj({ nazov, hodnota, pomoc, vyrazny = false }: { readonly nazov: string; readonly hodnota: ReactNode; readonly pomoc?: string; readonly vyrazny?: boolean }) {
  return (
    <div className={`udaj ${vyrazny ? "vyrazny" : ""}`} title={pomoc}>
      <span className="udaj-hodnota">{hodnota}</span>
      <span className="udaj-nazov">{nazov}</span>
    </div>
  );
}

function Sekcia({
  nazov,
  ikona,
  popis,
  siroka = false,
  children,
}: {
  readonly nazov: string;
  readonly ikona?: ReactNode;
  readonly popis?: string;
  readonly siroka?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section className={`panel stat-sekcia ${siroka ? "siroka" : ""}`}>
      <h3>
        {ikona !== undefined && <span className="stat-ikona">{ikona}</span>}
        {nazov}
      </h3>
      {popis !== undefined && <p className="tlmene stat-popis">{popis}</p>}
      <div className="udaje">{children}</div>
    </section>
  );
}

function Akcia({ kluc }: { readonly kluc: Action }) {
  const { sada } = useSada();
  return <IkonaAkcie kluc={kluc} akcia={sada?.akcie.find((a) => a.kluc === kluc)} />;
}

/** Aktívne akcie z bitiek ako riadok ikon s počtami. */
function AkcieVBitkach({ akcie, bitky }: { readonly akcie: StatistikyHraca["akcie"]; readonly bitky: number }) {
  const { sada } = useSada();
  const poradie: Action[] = ["Rana", "Pecka", "Petelica", "Povera", "Viera", "Pohoršenie", "Dlh", "PoškodeniePečene", "Cigareta", "Vízia", "Poldeci", "Robota"];
  const zoznam = poradie.filter((k) => (akcie[k] ?? 0) > 0);
  if (zoznam.length === 0) return <p className="tlmene">Zatiaľ žiadna aktívna akcia v bitke.</p>;
  return (
    <ul className="akcie-v-bitkach">
      {zoznam.map((k) => {
        const def = sada?.akcie.find((a) => a.kluc === k);
        return (
          <li key={k} title={`${def?.nazov ?? k}: ${akcie[k] ?? 0} spolu, ${priemer(akcie[k] ?? 0, bitky)} na bitku`}>
            <span className="stat-ikona">
              <IkonaAkcie kluc={k} akcia={def} />
            </span>
            <strong>{cislo(akcie[k] ?? 0)}</strong>
            <span className="tlmene">{def?.nazov ?? k}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---- partie a súperi -------------------------------------------------------------

const TEXT_VYSLEDKU: Record<Vysledok, string> = { vyhra: "výhra", prehra: "prehra", remiza: "remíza" };

function PoslednePartie({ partie }: { readonly partie: readonly PartiaVProfile[] }) {
  return (
    <div className="tabulka-obal">
      <table className="tabulka-partii">
        <thead>
          <tr>
            <th>Výsledok</th>
            <th>Súper</th>
            <th className="cislo">Špaky</th>
            <th className="cislo">Frajerina</th>
            <th className="cislo skryt-mobil">Kolá</th>
            <th className="cislo skryt-mobil">Trvanie</th>
            <th className="skryt-mobil">Dátum</th>
          </tr>
        </thead>
        <tbody>
          {partie.map((p) => {
            const d = p.frajerina.po - p.frajerina.pred;
            return (
              <tr key={p.id} title={rozlozRod(p.dovod, [null, null])}>
                <td>
                  <span className={`vysledok ${p.vysledok}`}>{TEXT_VYSLEDKU[p.vysledok]}</span>
                </td>
                <td>
                  <span className="super-bunka">
                    <Avatar meno={p.super.meno} avatar={p.super.avatar} velkost={26} />
                    {p.super.id === null ? p.super.meno : <Odkaz href={`/hrac/${p.super.id}`}>{p.super.meno}</Odkaz>}
                    <span className="tlmene frajerina-mala">({p.super.frajerina})</span>
                  </span>
                  <span className="dovod">{rozlozRod(p.dovod, [null, null])}</span>
                </td>
                <td className="cislo">{p.body === null ? <span className="tlmene">—</span> : `${p.body[0]} : ${p.body[1]}`}</td>
                <td className="cislo">
                  {p.frajerina.po} <span className={`zmena ${d > 0 ? "plus" : d < 0 ? "minus" : ""}`}>{ZNAK_ZMENY(d)}</span>
                </td>
                <td className="cislo skryt-mobil">{p.kola}</td>
                <td className="cislo skryt-mobil">{trvanie(p.trvanie)}</td>
                <td className="skryt-mobil tlmene">{datum(p.koniec)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Superi({ superi }: { readonly superi: ProfilHraca["superi"] }) {
  return (
    <ul className="superi">
      {superi.map((s) => (
        <li key={s.id}>
          <Avatar meno={s.meno} avatar={s.avatar} velkost={32} />
          <div>
            {s.id === null ? <strong>{s.meno}</strong> : <Odkaz href={`/hrac/${s.id}`}>{s.meno}</Odkaz>}
            <span className="tlmene">
              {s.partie} {tvar(s.partie, "partia", "partie", "partií")}
            </span>
          </div>
          <span className="superi-skore" title="výhry – remízy – prehry">
            <span className="plus">{s.vyhry}</span> – {s.remizy} – <span className="minus">{s.prehry}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---- celé štatistiky ----------------------------------------------------------------

export function Statistiky({ profil, vlastny }: { readonly profil: ProfilHraca; readonly vlastny: boolean }) {
  const { frajerina: f, statistiky: s } = profil;
  const bitkyPriemer = (n: number) => priemer(n, s.bitky);

  if (f.partie === 0) {
    return (
      <section className="panel frajerina-hero prazdny">
        <div>
          <span className="frajerina-nazov">Frajerina</span>
          <CisloFrajeriny f={f} velke />
          <span className="frajerina-titul">{f.titul}</span>
        </div>
        <div>
          <p>
            {vlastny ? "Zatiaľ nemáš dohranú žiadnu partiu." : "Tento hráč ešte nedohral žiadnu partiu."} Každý začína na Frajerine {f.hodnota}. Po prvých piatich
            partiách sa hodnotenie ustáli a potom ho hýbe každá výhra aj prehra — podľa toho, aký silný bol súper.
          </p>
          {vlastny && (
            <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
              Zahrať si partiu
            </Odkaz>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="statistiky">
      <section className="panel frajerina-hero">
        <div className="frajerina-hlavna">
          <span className="frajerina-nazov">Frajerina</span>
          <CisloFrajeriny f={f} velke />
          <span className="frajerina-titul">{f.titul}</span>
          <span className="tlmene frajerina-doplnok">
            {f.poradie !== null && (
              <>
                <Odkaz href="/rebricek">{f.poradie}. miesto v rebríčku</Odkaz> ·{" "}
              </>
            )}
            najvyššia {f.najvyssia}
          </span>
        </div>
        <div className="frajerina-bilancia">
          <div className="bilancia-cisla">
            <Udaj nazov={tvar(f.partie, "partia", "partie", "partií")} hodnota={f.partie} vyrazny />
            <Udaj nazov={tvar(f.vyhry, "výhra", "výhry", "výhier")} hodnota={<span className="plus">{f.vyhry}</span>} />
            <Udaj nazov={tvar(f.remizy, "remíza", "remízy", "remíz")} hodnota={f.remizy} />
            <Udaj nazov={tvar(f.prehry, "prehra", "prehry", "prehier")} hodnota={<span className="minus">{f.prehry}</span>} />
            <Udaj nazov="úspešnosť" hodnota={percento(f.vyhry + f.remizy / 2, f.partie)} pomoc="Výhry + polovica remíz, ako v šachu." />
          </div>
          <BilanciaPruh vyhry={f.vyhry} remizy={f.remizy} prehry={f.prehry} />
        </div>
      </section>

      <section className="panel">
        <h3>Vývoj Frajeriny</h3>
        <GrafFrajeriny historia={profil.historia} />
      </section>

      <Sekcia siroka nazov="Špaky" ikona={<span className="stat-ikona-text">★</span>} popis="Konečné špaky (od pravidiel v6) a body zo záverečného bodovania starších partií.">
        <Udaj nazov="špakov spolu" hodnota={cislo(s.body)} vyrazny />
        <Udaj nazov="na bodovanú partiu" hodnota={priemer(s.body, s.bodovanePartie)} pomoc={`${s.bodovanePartie} ${tvar(s.bodovanePartie, "partia sa skončila", "partie sa skončili", "partií sa skončilo")} záverečným bodovaním.`} />
        <Udaj nazov="najviac v partii" hodnota={cislo(s.najviacBodov)} />
      </Sekcia>

      <div className="stat-mriezka">
        <Sekcia nazov="Bitky" ikona={<Akcia kluc="Pecka" />}>
          <Udaj nazov="odohraných bitiek" hodnota={cislo(s.bitky)} vyrazny />
          <Udaj nazov="vyhraných" hodnota={percento(s.bitkyVyhrane, s.bitky)} pomoc={`${s.bitkyVyhrane} z ${s.bitky}`} />
          <Udaj nazov="ako útočník" hodnota={percento(s.bitkyAkoUtocnikVyhrane, s.bitkyAkoUtocnik)} pomoc={`Vyhral ${s.bitkyAkoUtocnikVyhrane} z ${s.bitkyAkoUtocnik} bitiek, v ktorých útočil.`} />
          <Udaj
            nazov="ako obranca"
            hodnota={percento(s.bitkyVyhrane - s.bitkyAkoUtocnikVyhrane, s.bitky - s.bitkyAkoUtocnik)}
            pomoc={`Vyhral ${s.bitkyVyhrane - s.bitkyAkoUtocnikVyhrane} z ${s.bitky - s.bitkyAkoUtocnik} bitiek, v ktorých sa bránil.`}
          />
          <Udaj nazov="patronáty (starší v ruke)" hodnota={cislo(s.bitkyOStarsich)} />
          <Udaj nazov="prebytku získaného" hodnota={cislo(s.prebytokZiskany)} pomoc="Rozdiel celkového poškodenia, ktorý hráč rozdelil na posuny markerov." />
        </Sekcia>

        <Sekcia nazov="Poškodenie" ikona={<Akcia kluc="Petelica" />}>
          <Udaj nazov="tuhého udeleného" hodnota={cislo(s.tuheUdelene)} vyrazny pomoc="Rany, Pecky, Petelice a bonusy po odpočítaní súperovej Viery." />
          <Udaj nazov="mäkkého udeleného" hodnota={cislo(s.makkeUdelene)} pomoc="Povery zastropené súperovými priznanými dlhmi." />
          <Udaj nazov="na bitku" hodnota={bitkyPriemer(s.tuheUdelene + s.makkeUdelene)} pomoc="Priemerné celkové poškodenie v jednej bitke." />
          <Udaj nazov="obdržaného" hodnota={cislo(s.poskodenieObdrzane)} />
          <Udaj nazov="obdržaného na bitku" hodnota={bitkyPriemer(s.poskodenieObdrzane)} />
          <Udaj nazov="najväčší zásah" hodnota={cislo(s.najvacsiZasah)} pomoc="Najvyššie celkové poškodenie v jednej bitke." />
        </Sekcia>


        <Sekcia nazov="Pečeň a cirhózy" ikona={<Akcia kluc="PoškodeniePečene" />}>
          <Udaj nazov="poškodenia pečene" hodnota={cislo(s.poskodeniePecene)} vyrazny pomoc="Poškodenie započítané k prahu Cirhózy (pečeň, poldeci, NA EX)." />
          <Udaj nazov="cirhóz získaných" hodnota={cislo(s.cirhozyZiskane)} />
          <Udaj nazov="cirhóz na partiu" hodnota={priemer(s.cirhozyZiskane, s.partie)} />
          <Udaj nazov="cirhóz priznaných" hodnota={cislo(s.cirhozyPriznane)} />
        </Sekcia>

        <Sekcia nazov="Povery a viera" ikona={<Akcia kluc="Povera" />}>
          <Udaj nazov="aktívnych Povier" hodnota={cislo(s.akcie.Povera ?? 0)} vyrazny />
          <Udaj nazov="Povier účinných" hodnota={percento(s.poveryUcinne, s.akcie.Povera ?? 0)} pomoc="Povery, ktoré nevyrušila súperova Viera." />
          <Udaj nazov="aktívnej Viery" hodnota={cislo(s.akcie.Viera ?? 0)} />
          <Udaj nazov="aktívnych Pohoršení" hodnota={cislo(s.akcie.Pohoršenie ?? 0)} />
          <Udaj nazov="posunov Pohoršením" hodnota={cislo(s.posunyPohorsenim)} pomoc="Markery starších posunuté Pohoršením k súperovi." />
          <Udaj nazov="absťákov" hodnota={cislo(s.abstakyZiskane)} />
        </Sekcia>

        <Sekcia nazov="Dlhy" ikona={<Akcia kluc="Dlh" />}>
          <Udaj nazov="dlhov získaných" hodnota={cislo(s.dlhyZiskane)} vyrazny />
          <Udaj nazov="dlhov na partiu" hodnota={priemer(s.dlhyZiskane, s.partie)} />
          <Udaj nazov="dlhov priznaných" hodnota={cislo(s.dlhyPriznane)} />
          <Udaj nazov="dlhov zbavených" hodnota={cislo(s.dlhyZbavene)} pomoc="Spálené Exekútorom, Robotou alebo efektmi kariet." />
          <Udaj nazov="exekúcií" hodnota={cislo(s.exekucie)} pomoc="Koľkokrát musel Exekútorovi odovzdať Nástroj." />
        </Sekcia>

        <Sekcia nazov="Neresti" ikona={<Akcia kluc="Poldeci" />}>
          <Udaj nazov="vypitých poldeci" hodnota={cislo(s.poldeciVypite)} vyrazny />
          <Udaj nazov="NA EX" hodnota={cislo(s.naex)} pomoc={`Z toho ${s.naexNaSuperove} na súperove karty.`} />
          <Udaj nazov="NA EX na súpera" hodnota={percento(s.naexNaSuperove, s.naex)} />
          <Udaj nazov="vyfajčených cigariet" hodnota={cislo(s.cigaretyVyfajcene)} />
          <Udaj nazov="cigariet získaných" hodnota={cislo(s.cigaretyZiskane)} />
          <Udaj nazov="barterov a dolievaní" hodnota={`${s.bartery} / ${s.dolievania}`} pomoc="Stokársky barter (cigarety → poldeci) / dolievanie vypitého poldeci." />
        </Sekcia>

        <Sekcia nazov="Starší a lokality" ikona={<Akcia kluc="Pohoršenie" />}>
          <Udaj nazov="lokalít ovládnutých" hodnota={cislo(s.lokalityOvladnute)} vyrazny />
          <Udaj nazov="starších získaných" hodnota={cislo(s.starsiZiskani)} />
          <Udaj nazov="starších vydesených" hodnota={cislo(s.starsiVydeseni)} pomoc="Starší, ktorých marker skončil na krajnej pozícii súperovej polovice." />
          <Udaj nazov="posunov prebytkom" hodnota={cislo(s.posunyPrebytkom)} />
        </Sekcia>

        <Sekcia nazov="Partie" ikona={<Akcia kluc="Robota" />}>
          <Udaj nazov="ťahov" hodnota={cislo(s.tahy)} vyrazny />
          <Udaj nazov="ťahov na partiu" hodnota={priemer(s.tahy, s.partie, 0)} />
          <Udaj nazov="kôl na partiu" hodnota={priemer(s.kola, s.partie)} />
          <Udaj nazov="vyložených kariet" hodnota={cislo(s.kartyVylozene)} pomoc={`Z toho ${s.kartyDoSuperovej} do súperovej partie.`} />
          <Udaj nazov="priemerná partia" hodnota={trvanie(profil.casSpolu / Math.max(1, s.partie))} />
          <Udaj nazov="pri stole spolu" hodnota={trvanie(profil.casSpolu)} />
        </Sekcia>
      </div>

      <section className="panel">
        <h3>Aktívne akcie v bitkách</h3>
        <AkcieVBitkach akcie={s.akcie} bitky={s.bitky} />
      </section>

      <div className="stat-dva">
        <section className="panel">
          <h3>Posledné partie</h3>
          <PoslednePartie partie={profil.partie} />
        </section>
        {profil.superi.length > 0 && (
          <section className="panel">
            <h3>Súperi</h3>
            <Superi superi={profil.superi} />
          </section>
        )}
      </div>
    </div>
  );
}
