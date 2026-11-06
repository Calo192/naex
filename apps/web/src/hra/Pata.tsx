// Stôl režimu Päta, Lakeť, Otočka, rozloženie A (Michal 2026-11-06,
// docs/napady/pata-laket-otocka-stol-mock.html): rady starších nad a pod líniou, draft a rozhodnutia
// v bitke ako okná. Klient posiela len zámery; čo smie, overí server. Náhľady počíta rovnaký kód ako jadro.

import { useState } from "react";
import type { Action, ClientState, Command, GameData, PlayerId, StarsiId, StarsiPata } from "@naex/core";
import { MA_DOST, PATA, defOf, stojaci, sumyRadu } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";
import { vzhladKarty } from "./HernaKarta.tsx";
import "./pata.css";

function menoStarsieho(data: GameData, id: string): string {
  return data.cards.get(id)?.name ?? id;
}

function maDostStarsieho(id: string): { readonly nazov: string; readonly text: string } | null {
  return MA_DOST[id as StarsiId] ?? null;
}

function FotoStarsieho({ data, sada, id }: { readonly data: GameData; readonly sada: Sada; readonly id: string }) {
  const o = vzhladKarty(sada, data, id).obrazok;
  return o === null ? null : <img src={mediaUrl(o.nahlad)} alt="" loading="lazy" />;
}

/** Karta staršieho v rade: pečeň, štít, jed; podrazený ukáže Má dosť. */
function KartaStarsieho({ s, data, sada }: { readonly s: StarsiPata; readonly data: GameData; readonly sada: Sada }) {
  const id = s.karta.defId;
  const meno = defOf(data, s.karta).name;
  const md = maDostStarsieho(id);
  if (s.podrazeny) {
    return (
      <li className="pt-st padol">
        <b>{meno}</b>
        {md !== null && (
          <span>
            Má dosť: <em>{md.text}</em>
          </span>
        )}
      </li>
    );
  }
  const max = PATA.PECEN[id as StarsiId] ?? s.pecen;
  return (
    <li className="pt-st" title={md === null ? meno : `Keď padne: ${md.nazov}. ${md.text}`}>
      <FotoStarsieho data={data} sada={sada} id={id} />
      <b>{meno}</b>
      <span className="pt-pecen">
        <strong>{s.pecen}</strong>/{max}
      </span>
      <span className="pt-ukaz" role="img" aria-label={`Pečeň ${s.pecen} z ${max}`}>
        <i style={{ width: `${Math.min(100, (100 * s.pecen) / max)}%` }} />
      </span>
      <span className="pt-znacky">
        {s.stit > 0 && <span className="pt-z stit">štít {s.stit}</span>}
        {s.jed > 0 && <span className="pt-z jed">jed {s.jed}</span>}
      </span>
    </li>
  );
}

/** Rad hráča na stole, nad alebo pod líniou. */
export function RadStarsich({
  view,
  p,
  data,
  sada,
}: {
  readonly view: ClientState;
  readonly p: PlayerId;
  readonly data: GameData;
  readonly sada: Sada;
}) {
  const h = view.pata;
  if (h === undefined) return null;
  return (
    <ul className={`pt-rad${p === view.ja ? " moj" : " super"}`} aria-label={p === view.ja ? "Môj rad starších" : "Súperov rad starších"}>
      {h.rady[p].map((s) => (
        <KartaStarsieho key={s.karta.uid} s={s} data={data} sada={sada} />
      ))}
    </ul>
  );
}

const POPIS_AKCII: Partial<Record<Action, string>> = {
  Rana: "Rana",
  Pecka: "Pecka",
  Petelica: "Petelica",
  Povera: "Povera",
  Pohoršenie: "Pohoršenie",
  Viera: "Viera",
  Dlh: "Hazard",
  PoškodeniePečene: "Pečeň",
  Obmedzenie: "Obmedzenie",
  Cigareta: "Cigareta",
  Vízia: "Vízia",
  Poldeci: "Poldeci",
  Robota: "Robota",
};

function textRadu(data: GameData, rad: readonly StarsiPata[], p: PlayerId): string {
  const sumy = sumyRadu(data, rad, p);
  const casti = (Object.keys(sumy) as Action[]).flatMap((a) => {
    const n = sumy[a] ?? 0;
    const popis = POPIS_AKCII[a];
    return n > 0 && popis !== undefined ? [`${popis} ${n}`] : [];
  });
  return casti.length === 0 ? "Rad teraz nedá žiadne akcie." : `Rad dá: ${casti.join(", ")}.`;
}

/** Draft: hadovito 4 a 4, na výber s pečeňou a Má dosť. */
function Draft({ view, data, sada, cmd }: Vlastnosti) {
  const h = view.pata;
  if (h === undefined) return null;
  const naRade = view.mozemHrat;
  return (
    <div className="pt-okno">
      <h2>Draft starších</h2>
      <p>{naRade ? "Vyber si staršieho." : "Vyberá súper."} Hadovito: každý 4, cieľ je podraziť všetkých súperových.</p>
      <div className="pt-draft">
        {h.ponuka.map((k) => {
          const md = maDostStarsieho(k.defId);
          return (
            <button key={k.uid} type="button" className="pt-volba" disabled={!naRade} onClick={() => cmd({ type: "pataVyber", elderId: k.defId })}>
              <FotoStarsieho data={data} sada={sada} id={k.defId} />
              <b>{defOf(data, k).name}</b>
              <span>Pečeň {PATA.PECEN[k.defId as StarsiId]}</span>
              {md !== null && <span className="tlmene">Má dosť: {md.text}</span>}
            </button>
          );
        })}
      </div>
      <div className="pt-vybrate">
        <div>
          <h3>Tvoji</h3>
          <p>{h.rady[view.ja].map((s) => menoStarsieho(data, s.karta.defId)).join(", ") || "zatiaľ nikto"}</p>
        </div>
        <div>
          <h3>Súperovi</h3>
          <p>{h.rady[view.ja === 0 ? 1 : 0].map((s) => menoStarsieho(data, s.karta.defId)).join(", ") || "zatiaľ nikto"}</p>
        </div>
      </div>
    </div>
  );
}

/** Preskladanie radu: skryto, odhalí sa, keď vyberú obaja. */
function Rad({ view, data, cmd }: Vlastnosti) {
  const h = view.pata;
  const [poradie, setPoradie] = useState<readonly string[]>(h?.rady[view.ja].map((s) => s.karta.defId) ?? []);
  if (h === undefined) return null;
  const rad = poradie.map((id) => h.rady[view.ja].find((s) => s.karta.defId === id)).filter((s): s is StarsiPata => s !== undefined);
  const presun = (i: number, o: number): void => {
    const nove = [...poradie];
    const a = nove[i];
    const b = nove[i + o];
    if (a === undefined || b === undefined) return;
    nove[i] = b;
    nove[i + o] = a;
    setPoradie(nove);
  };
  return (
    <div className="pt-okno">
      <h2>Preskladaj rad</h2>
      <p>Súper tvoje poradie uvidí, až keď vyberiete obaja. Podrazený ostáva spojkou.</p>
      <ol className="pt-poradie">
        {poradie.map((id, i) => (
          <li key={id}>
            <button type="button" className="tlacidlo" disabled={i === 0} aria-label={`${menoStarsieho(data, id)} doľava`} onClick={() => presun(i, -1)}>
              ←
            </button>
            <span>{menoStarsieho(data, id)}</span>
            <button type="button" className="tlacidlo" disabled={i === poradie.length - 1} aria-label={`${menoStarsieho(data, id)} doprava`} onClick={() => presun(i, 1)}>
              →
            </button>
          </li>
        ))}
      </ol>
      <p>{textRadu(data, rad, view.ja)}</p>
      <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => cmd({ type: "pataRad", poradie })}>
        Potvrdiť rad
      </button>
    </div>
  );
}

function Vymena({ view, data, cmd }: Vlastnosti) {
  const h = view.pata;
  if (h === undefined) return null;
  const su: PlayerId = view.ja === 0 ? 1 : 0;
  return (
    <div className="pt-okno">
      <h2>Do radu!</h2>
      <p>Má dosť Vychovávateľky: smieš vymeniť dvoch susedných starších v súperovom rade.</p>
      <div className="riadok-tlacidiel">
        {h.rady[su].slice(1).map((s, i) => (
          <button key={s.karta.uid} type="button" className="tlacidlo" onClick={() => cmd({ type: "pataVymena", index: i })}>
            {menoStarsieho(data, h.rady[su][i]?.karta.defId ?? "")} ↔ {menoStarsieho(data, s.karta.defId)}
          </button>
        ))}
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => cmd({ type: "pataVymena", index: null })}>
          Nechať tak
        </button>
      </div>
    </div>
  );
}

function pricitaj(r: Readonly<Record<string, number>>, id: string, o: number): Readonly<Record<string, number>> {
  const n = (r[id] ?? 0) + o;
  const { [id]: _, ...zvysok } = r;
  return n > 0 ? { ...zvysok, [id]: n } : zvysok;
}

function sucet(r: Readonly<Record<string, number>>): number {
  return Object.values(r).reduce((a, n) => a + n, 0);
}

function Pocitadlo({
  nazov,
  hodnota,
  menej,
  viac,
}: {
  readonly nazov: string;
  readonly hodnota: number;
  readonly menej: () => void;
  readonly viac: () => void;
}) {
  return (
    <span className="pt-pocitadlo">
      {nazov}
      <button type="button" className="tlacidlo" aria-label={`${nazov} menej`} onClick={menej}>
        −
      </button>
      <output>{hodnota}</output>
      <button type="button" className="tlacidlo" aria-label={`${nazov} viac`} onClick={viac}>
        +
      </button>
    </span>
  );
}

/** Krok 1 bitky: čo spravia Roboty. */
function Liecenie({ view, data, cmd }: Vlastnosti) {
  const h = view.pata;
  const [liecenie, setLiecenie] = useState<Readonly<Record<string, number>>>({});
  const roboty = h?.bitka?.vstupL[view.ja].roboty ?? 0;
  if (h === undefined) return null;
  const naDlh = roboty - sucet(liecenie);
  return (
    <div className="pt-okno">
      <h2>Robota</h2>
      <p>
        Máš {roboty} Robôt. Každá spáli Dlh, alebo vylieči {PATA.ROBOTA_LIECI} pečene. Potom príde exekúcia.
      </p>
      <ul className="pt-ciele">
        {stojaci(h, view.ja).map((s) => {
          const id = s.karta.defId;
          return (
            <li key={id}>
              <b>{menoStarsieho(data, id)}</b> pečeň {s.pecen}
              <Pocitadlo
                nazov="Liečiť"
                hodnota={liecenie[id] ?? 0}
                menej={() => setLiecenie((r) => pricitaj(r, id, -1))}
                viac={() => naDlh > 0 && setLiecenie((r) => pricitaj(r, id, 1))}
              />
            </li>
          );
        })}
      </ul>
      <p>Na spálenie Dlhov ostáva {naDlh} Robôt.</p>
      <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => cmd({ type: "pataLiecenie", robotyNaDlh: naDlh, liecenie })}>
        Potvrdiť
      </button>
    </div>
  );
}

/** Krok 2 bitky: rozdelenie tuhého a jedu, naraz a skryto. */
function Utok({ view, data, cmd }: Vlastnosti) {
  const h = view.pata;
  const [tuhe, setTuhe] = useState<Readonly<Record<string, number>>>({});
  const [jed, setJed] = useState<Readonly<Record<string, number>>>({});
  const v = h?.bitka?.vstupU[view.ja];
  if (h === undefined || v === undefined) return null;
  const su: PlayerId = view.ja === 0 ? 1 : 0;
  const ostTuhe = v.tuhe - sucet(tuhe);
  const ostJed = v.pohorsenie - sucet(jed);
  return (
    <div className="pt-okno">
      <h2>Rozdeľ tuhé a jed</h2>
      <p>
        Tuhé ostáva <strong>{ostTuhe}</strong>, jed ostáva <strong>{ostJed}</strong>. Povery {v.povery} idú samy každému, cez štít.
      </p>
      <ul className="pt-ciele">
        {stojaci(h, su).map((s) => {
          const id = s.karta.defId;
          const body = v.povery + (tuhe[id] ?? 0);
          const pecenPo = s.pecen - (body - Math.min(s.stit + (h.bitka?.vstupU[su].viera ?? 0), body)) - (jed[id] ?? 0) - s.jed;
          return (
            <li key={id}>
              <b>{menoStarsieho(data, id)}</b> pečeň {s.pecen}
              {s.stit > 0 && `, štít ${s.stit}`}
              {s.jed > 0 && `, jed ${s.jed}`}
              <Pocitadlo nazov="Tuhé" hodnota={tuhe[id] ?? 0} menej={() => setTuhe((r) => pricitaj(r, id, -1))} viac={() => ostTuhe > 0 && setTuhe((r) => pricitaj(r, id, 1))} />
              <Pocitadlo nazov="Jed" hodnota={jed[id] ?? 0} menej={() => setJed((r) => pricitaj(r, id, -1))} viac={() => ostJed > 0 && setJed((r) => pricitaj(r, id, 1))} />
              <span className="tlmene">
                Po útoku {pecenPo}
                {pecenPo <= 0 ? ", padne" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="tlacidlo tlacidlo-hlavne" disabled={ostTuhe !== 0 || ostJed !== 0} onClick={() => cmd({ type: "pataUtok", tuhe, jed })}>
        Potvrdiť
      </button>
    </div>
  );
}

/** Koniec kola: Dať vyžrať za plný poldeci. */
function Vyzrat({ view, data, cmd }: Vlastnosti) {
  const h = view.pata;
  if (h === undefined) return null;
  const plne = view.hraci[view.ja].poldeciPlne;
  return (
    <div className="pt-okno">
      <h2>Dať vyžrať</h2>
      <p>
        Plný poldeci za {PATA.VYZRAT_PECEN} pečene staršiemu. Máš plných poldeci: {plne}. Chýbajú v ďalšom kole.
      </p>
      <div className="riadok-tlacidiel">
        {stojaci(h, view.ja).map((s) => (
          <button key={s.karta.uid} type="button" className="tlacidlo" onClick={() => cmd({ type: "pataVyzrat", elderId: s.karta.defId })}>
            {menoStarsieho(data, s.karta.defId)} ({s.pecen})
          </button>
        ))}
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => cmd({ type: "pataVyzrat", elderId: null })}>
          Hotovo
        </button>
      </div>
    </div>
  );
}

interface Vlastnosti {
  readonly view: ClientState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly cmd: (c: Command) => void;
}

/** Okno rozhodnutia, keď režim čaká na hráča; inak krátky oznam, že sa čaká na súpera. */
export function RozhodnutiePata(p: Vlastnosti) {
  const h = p.view.pata;
  if (h === undefined || h.krok === null) return null;
  if (h.krok === "draft") return <Draft {...p} />;
  if (!p.view.mozemHrat) {
    return (
      <div className="pt-oznam" role="status">
        Súper rozhoduje…
      </div>
    );
  }
  // Kľúč: nové okno začína s čistým výberom pri každej bitke a kole.
  const kluc = `${p.view.kolo}-${h.krok}`;
  switch (h.krok) {
    case "rad":
      return <Rad key={kluc} {...p} />;
    case "vymena":
      return <Vymena key={kluc} {...p} />;
    case "liecenie":
      return <Liecenie key={kluc} {...p} />;
    case "utok":
      return <Utok key={kluc} {...p} />;
    case "vyzrat":
      return <Vyzrat key={kluc} {...p} />;
  }
}

/** Súperova ruka z Má dosť Poštárky; prišla zo servera len preto, že ju hráč smie vidieť. */
export function RukaSupera({ view, data }: { readonly view: ClientState; readonly data: GameData }) {
  if (view.rukaSupera === undefined) return null;
  return (
    <div className="pt-ruka-supera">
      <b>Súperova ruka:</b> {view.rukaSupera.map((k) => defOf(data, k).name).join(", ") || "prázdna"}
    </div>
  );
}
