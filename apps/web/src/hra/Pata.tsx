// Stôl režimu Päta, Lakeť, Otočka, rozloženie A (Michal 2026-11-06,
// docs/napady/pata-laket-otocka-stol-mock.html): rady starších nad a pod líniou, draft a rozhodnutia
// v bitke ako okná. Klient posiela len zámery; čo smie, overí server. Náhľady počíta rovnaký kód ako jadro.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { Action, ActionSums, ClientState, Command, GameData, PlayerId, StarsiId, StarsiPata } from "@naex/core";
import { MA_DOST, PATA, defOf, opponentOf, stojaci, vyhodnotRad } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { mediaUrl } from "../lib/api.ts";
import { HernaKarta, vzhladKarty } from "./HernaKarta.tsx";
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

const POMER_STARSIEHO = 80 / 54;
const SIRKA_LUPY = 260;

/** V režime nie je schopnosť väzňa: karta staršieho nesie jeho Má dosť. */
function useSadaPata(sada: Sada): Sada {
  return useMemo(
    () => ({
      ...sada,
      karty: sada.karty.map((k) => {
        const md = maDostStarsieho(k.id);
        return md === null ? k : { ...k, efekt: `Má dosť — ${md.nazov}: ${md.text}` };
      }),
    }),
    [sada],
  );
}

function radHraca(view: ClientState, data: GameData, rad: readonly StarsiPata[], p: PlayerId) {
  const nastroje = [view.hraci[0].dedicstvo.map((k) => k.defId), view.hraci[1].dedicstvo.map((k) => k.defId)] as const;
  return vyhodnotRad(data, rad, p, nastroje);
}

/** Aktívne akcie ako piktogramy z karty s počtom. */
function Akcie({ sumy, sada, velke = false }: { readonly sumy: ActionSums | undefined; readonly sada: Sada; readonly velke?: boolean }) {
  const akcie = [...sada.akcie].sort((a, b) => a.poradie - b.poradie).filter((a) => (sumy?.[a.kluc as Action] ?? 0) > 0);
  if (akcie.length === 0) return <span className="pt-akcie-nic">žiadna akcia</span>;
  return (
    <span className={`pt-akcie${velke ? " velke" : ""}`}>
      {akcie.map((a) => {
        const n = sumy?.[a.kluc as Action] ?? 0;
        return (
          <span key={a.kluc} className="pt-akcia" title={`${a.nazov}: ${n}`}>
            <span className="pt-ikona">
              <IkonaAkcie kluc={a.kluc} akcia={a} />
            </span>
            <b>{n}</b>
          </span>
        );
      })}
    </span>
  );
}

/** Štít je z Viery a jed z Pohoršenia: rovnaké piktogramy ako na kartách (Michal 2026-11-06). */
function Znacky({ s, sada }: { readonly s: StarsiPata; readonly sada: Sada }) {
  const znacka = (kluc: Action, trieda: string, nazov: string, n: number) =>
    n > 0 && (
      <span className={`pt-z ${trieda}`} title={`${nazov} ${n}`}>
        <span className="pt-ikona">
          <IkonaAkcie kluc={kluc} akcia={sada.akcie.find((x) => x.kluc === kluc)} />
        </span>
        {n}
      </span>
    );
  return (
    <span className="pt-znacky">
      {znacka("Viera", "stit", "Štít", s.stit)}
      {znacka("Pohoršenie", "jed", "Jed", s.jed)}
    </span>
  );
}

interface Lupa {
  readonly s: StarsiPata;
  readonly stred: number;
  readonly hore: number;
  readonly dole: number;
}

/** Dlaždica staršieho v páse: pečeň, aktívne akcie, štít a jed; podrazený ukáže Má dosť. */
function KartaStarsieho({
  s,
  data,
  sada,
  sumy,
  ukaz,
  skry,
}: {
  readonly s: StarsiPata;
  readonly data: GameData;
  readonly sada: Sada;
  readonly sumy: ActionSums | undefined;
  readonly ukaz: (l: Lupa) => void;
  readonly skry: () => void;
}) {
  const id = s.karta.defId;
  const meno = defOf(data, s.karta).name;
  const max = PATA.PECEN[id as StarsiId] ?? s.pecen;
  const nad = (el: Element): void => {
    const r = el.getBoundingClientRect();
    ukaz({ s, stred: r.left + r.width / 2, hore: r.top, dole: r.bottom });
  };
  return (
    <li
      className={`pt-st${s.podrazeny ? " padol" : ""}`}
      tabIndex={0}
      onMouseEnter={(e) => nad(e.currentTarget)}
      onMouseLeave={skry}
      onFocus={(e) => nad(e.currentTarget)}
      onBlur={skry}
    >
      <FotoStarsieho data={data} sada={sada} id={id} />
      <div className="pt-telo">
        <div className="pt-hore">
          <b>{meno}</b>
          {s.podrazeny ? (
            <span className="pt-padol">padol</span>
          ) : (
            <>
              <span className="pt-pecen" title={`Pečeň ${s.pecen} z ${max}`}>
                <strong>{s.pecen}</strong>/{max}
              </span>
              <span className="pt-ukaz" role="img" aria-label={`Pečeň ${s.pecen} z ${max}`}>
                <i className={s.pecen <= max / 3 ? "nizka" : undefined} style={{ width: `${Math.min(100, (100 * s.pecen) / max)}%` }} />
              </span>
            </>
          )}
        </div>
        <div className="pt-dole">
          {s.podrazeny ? <span className="pt-md">{maDostStarsieho(id)?.text}</span> : <Akcie sumy={sumy} sada={sada} />}
          <Znacky s={s} sada={sada} />
        </div>
      </div>
    </li>
  );
}

const SIRKA_RUKY = 320;

/** Klik na staršieho v paneli vymení líniu za oba rady; zavrie ďalší klik, Esc alebo ďalší krok hry. */
export interface StavRadov {
  readonly uid: number | null;
  prepni(uid: number): void;
  zavri(): void;
}

export function useRadyNaStole(view: ClientState | null): StavRadov {
  const [otvorene, setOtvorene] = useState<{ readonly uid: number; readonly kluc: string } | null>(null);
  const kluc = view === null ? "" : `${view.kolo}-${view.faza}-${view.pata?.krok ?? ""}`;
  const uid = otvorene !== null && otvorene.kluc === kluc ? otvorene.uid : null;
  const zavri = (): void => setOtvorene(null);
  useEffect(() => {
    if (uid === null) return;
    const klaves = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") setOtvorene(null);
    };
    document.addEventListener("keydown", klaves);
    return () => document.removeEventListener("keydown", klaves);
  }, [uid]);
  return { uid, prepni: (u) => setOtvorene(u === uid ? null : { uid: u, kluc }), zavri };
}

/**
 * Starší v paneli hráča, na mieste dlaždíc Špaky a Starší, ktoré v režime nie sú (Michal 2026-11-06:
 * portréty z mocku). Pod myšou karta so spojmi, po kliku oba rady namiesto línie (RadyNaStole).
 */
export function PortretyStarsich({
  view,
  p,
  data,
  sada,
  rady,
}: {
  readonly view: ClientState;
  readonly p: PlayerId;
  readonly data: GameData;
  readonly sada: Sada;
  readonly rady: StavRadov;
}) {
  const sadaPata = useSadaPata(sada);
  const [lupa, setLupa] = useState<Lupa | null>(null);
  const [rukaNad, setRukaNad] = useState<Lupa | null>(null);
  const h = view.pata;
  if (h === undefined) return null;
  const moj = p === view.ja;
  const rad = h.rady[p];
  const v = radHraca(view, data, rad, p);
  const vyskaLupy = Math.round(SIRKA_LUPY * POMER_STARSIEHO);
  const rukaSupera = !moj ? view.rukaSupera : undefined;
  const poloha = (l: Lupa, sirka: number, vyska: number) => ({
    left: Math.max(8, Math.min(window.innerWidth - sirka - 8, l.stred - sirka / 2)),
    top: Math.max(8, Math.min(window.innerHeight - vyska - 8, moj ? l.hore - vyska - 8 : l.dole + 8)),
  });
  const kotva = (el: Element, s: StarsiPata): Lupa => {
    const r = el.getBoundingClientRect();
    return { s, stred: r.left + r.width / 2, hore: r.top, dole: r.bottom };
  };
  const otvorene = lupa !== null && rady.uid === null ? lupa : null;
  return (
    <div className="pt-pult" aria-label={moj ? "Môj rad starších" : "Súperov rad starších"}>
      {(moj ? rad : [...rad].reverse()).map((x) => {
        const max = PATA.PECEN[x.karta.defId as StarsiId] ?? x.pecen;
        const meno = menoStarsieho(data, x.karta.defId);
        return (
          <button
            key={x.karta.uid}
            type="button"
            className={`pt-m${x.podrazeny ? " padol" : ""}${rady.uid === x.karta.uid ? " stlaceny" : ""}`}
            aria-pressed={rady.uid === x.karta.uid}
            aria-label={x.podrazeny ? `${meno}, padol` : `${meno}, pečeň ${x.pecen} z ${max}${x.stit > 0 ? `, štít ${x.stit}` : ""}${x.jed > 0 ? `, jed ${x.jed}` : ""}`}
            onMouseEnter={(e) => setLupa(kotva(e.currentTarget, x))}
            onMouseLeave={() => setLupa(null)}
            onFocus={(e) => setLupa(kotva(e.currentTarget, x))}
            onBlur={() => setLupa(null)}
            onClick={() => {
              setLupa(null);
              rady.prepni(x.karta.uid);
            }}
          >
            <FotoStarsieho data={data} sada={sada} id={x.karta.defId} />
            <Znacky s={x} sada={sada} />
            {x.podrazeny ? (
              <span className="pt-padol">padol</span>
            ) : (
              <span className="pt-m-stav">
                <span className="pt-pecen">
                  <strong>{x.pecen}</strong>
                  <small>/{max}</small>
                </span>
                <span className="pt-ukaz" aria-hidden="true">
                  <i className={x.pecen <= max / 3 ? "nizka" : undefined} style={{ width: `${Math.min(100, (100 * x.pecen) / max)}%` }} />
                </span>
              </span>
            )}
          </button>
        );
      })}
      {rukaSupera !== undefined && rad[0] !== undefined && (
        <span
          className="pt-m pt-m-ruka"
          tabIndex={0}
          role="img"
          aria-label={`Súperova ruka: ${rukaSupera.map((k) => defOf(data, k).name).join(", ") || "prázdna"}`}
          onMouseEnter={(e) => setRukaNad(kotva(e.currentTarget, rad[0] as StarsiPata))}
          onMouseLeave={() => setRukaNad(null)}
          onFocus={(e) => setRukaNad(kotva(e.currentTarget, rad[0] as StarsiPata))}
          onBlur={() => setRukaNad(null)}
        >
          <small>Ruka</small>
          <strong>{rukaSupera.length}</strong>
        </span>
      )}
      {otvorene !== null &&
        createPortal(
          <div className="pt-lupa" style={poloha(otvorene, SIRKA_LUPY, vyskaLupy)}>
            <div className={otvorene.s.podrazeny ? "pt-karta padol" : "pt-karta"}>
              <HernaKarta karta={otvorene.s.karta} sada={sadaPata} data={data} sirka={SIRKA_LUPY} eval={v.cards.get(otvorene.s.karta.uid) ?? null} bezPopisov />
            </div>
          </div>,
          document.body,
        )}
      {rukaNad !== null &&
        rukaSupera !== undefined &&
        createPortal(
          <div className="pt-detail-ruka" style={poloha(rukaNad, SIRKA_RUKY, 260)}>
            <b>Súperova ruka</b>
            {rukaSupera.length === 0 ? <span className="tlmene">prázdna</span> : <ul>{rukaSupera.map((k) => <li key={k.uid}>{defOf(data, k).name}</li>)}</ul>}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Od tejto šírky sa celá karta v polovici plste oplatí; pod ňou orez na ilustráciu so slotmi dá väčšie ikony. */
const SIRKA_CELEJ_KARTY = 170;
/** Riadok akcií pod orezanou kartou a pečeň s akciami pod celou. */
const RIADOK_OREZU = 24;
const RIADKY_CELEJ = 46;
const OKRAJE_POLOVICE = 2;

/** Súper na hornej polovici plste, hráč na dolnej: ako ich panely (Michal 2026-11-06). */
export function RadyNaStole({ view, data, sada, rady }: Vlastnosti & { readonly rady: StavRadov }) {
  const h = view.pata;
  if (h === undefined || rady.uid === null || (h.krok === "rad" && view.mozemHrat)) return null;
  return <PolovicePlste view={view} data={data} sada={sada} rady={rady} />;
}

function PolovicePlste({ view, data, sada, rady }: Omit<Vlastnosti, "cmd"> & { readonly rady: StavRadov }) {
  const h = view.pata;
  const sadaPata = useSadaPata(sada);
  const [ref, r] = useRozmer();
  if (h === undefined) return null;
  const polovica = r.h / 2 - OKRAJE_POLOVICE;
  const naSirku = (r.w - 24) / 4;
  const celej = Math.floor(Math.min(naSirku, (polovica - RIADKY_CELEJ) / POMER_STARSIEHO));
  const orez = celej < SIRKA_CELEJ_KARTY;
  const sirka = Math.max(70, orez ? Math.floor(Math.min(naSirku, polovica - RIADOK_OREZU)) : celej);
  const rad = (p: PlayerId) => {
    const moj = p === view.ja;
    const v = radHraca(view, data, h.rady[p], p);
    return (
      <div className={`pt-polovica${moj ? " moja" : " super"}`}>
        <span className="pt-polovica-kto">{moj ? "Ty" : "Súper"}</span>
        <ol className={`pt-polovica-rad${orez ? " orez" : ""}`}>
          {(moj ? h.rady[p] : [...h.rady[p]].reverse()).map((s) => {
            const id = s.karta.defId;
            const max = PATA.PECEN[id as StarsiId] ?? s.pecen;
            const pecen = s.podrazeny ? (
              <span className="pt-padol">padol</span>
            ) : (
              <>
                <span className="pt-pecen">
                  <strong>{s.pecen}</strong>/{max}
                </span>
                <Znacky s={s} sada={sada} />
              </>
            );
            return (
              <li key={s.karta.uid} className={rady.uid === s.karta.uid ? "vybrany" : undefined} style={{ width: sirka }}>
                <div className={`pt-polovica-karta${s.podrazeny ? " pt-karta padol" : " pt-karta"}`} style={orez ? { height: sirka } : undefined}>
                  <HernaKarta karta={s.karta} sada={sadaPata} data={data} sirka={sirka} otocena={!moj} eval={v.cards.get(s.karta.uid) ?? null} />
                  {orez && <div className="pt-polovica-stav">{pecen}</div>}
                </div>
                <div className="pt-polovica-pod">
                  {!orez && <div className="pt-polovica-pecen">{pecen}</div>}
                  {s.podrazeny ? <span className="pt-md">{maDostStarsieho(id)?.text}</span> : <Akcie sumy={v.naStarsom.get(s.karta.uid)} sada={sada} />}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };
  return (
    <div className="pt-polovice">
      <div className="pt-polovice-plocha" ref={ref}>
        {rad(opponentOf(view.ja))}
        {rad(view.ja)}
      </div>
      <button type="button" className="tlacidlo pt-polovice-spat" onClick={rady.zavri}>
        Späť na líniu
      </button>
    </div>
  );
}

/** Stav radov na konci partie: kto ostal stáť a s koľkou pečeňou. */
export function RadyNaKonci({
  view,
  data,
  mena,
  obrazok,
}: {
  readonly view: ClientState;
  readonly data: GameData;
  readonly mena: readonly [string, string];
  readonly obrazok: (defId: string) => string | null;
}) {
  const h = view.pata;
  if (h === undefined) return null;
  return (
    <div className="pt-koniec">
      {([view.ja, opponentOf(view.ja)] as const).map((p) => (
        <div key={p} className="pt-koniec-rad">
          <b>{p === view.ja ? "Ty" : mena[p]}</b>
          {h.rady[p].map((s) => {
            const src = obrazok(s.karta.defId);
            return (
              <span key={s.karta.uid} className={`pt-m${s.podrazeny ? " padol" : ""}`} title={menoStarsieho(data, s.karta.defId)}>
                {src !== null && <img src={src} alt="" loading="lazy" />}
                {s.podrazeny ? (
                  <span className="pt-padol">padol</span>
                ) : (
                  <span className="pt-m-stav">
                    <span className="pt-pecen">
                      <strong>{s.pecen}</strong>
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Rad na úzkom stole telefónu, nad alebo pod líniou. Súperov ide opačne: sedí oproti. */
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
  const sadaPata = useSadaPata(sada);
  const [lupa, setLupa] = useState<Lupa | null>(null);
  const h = view.pata;
  if (h === undefined || h.rady[p].length === 0) return null;
  const moj = p === view.ja;
  const rad = h.rady[p];
  const v = radHraca(view, data, rad, p);
  const vyskaLupy = Math.round(SIRKA_LUPY * POMER_STARSIEHO);
  return (
    <>
      <ul className={`pt-rad${moj ? " moj" : " super"}`} aria-label={moj ? "Môj rad starších" : "Súperov rad starších"}>
        {(moj ? rad : [...rad].reverse()).map((s) => (
          <KartaStarsieho key={s.karta.uid} s={s} data={data} sada={sada} sumy={v.naStarsom.get(s.karta.uid)} ukaz={setLupa} skry={() => setLupa(null)} />
        ))}
      </ul>
      {lupa !== null &&
        createPortal(
          <div
            className="pt-lupa"
            style={{
              left: Math.max(8, Math.min(window.innerWidth - SIRKA_LUPY - 8, lupa.stred - SIRKA_LUPY / 2)),
              top: Math.max(8, Math.min(window.innerHeight - vyskaLupy - 8, moj ? lupa.hore - vyskaLupy - 8 : lupa.dole + 8)),
            }}
          >
            <div className={lupa.s.podrazeny ? "pt-karta padol" : "pt-karta"}>
              <HernaKarta karta={lupa.s.karta} sada={sadaPata} data={data} sirka={SIRKA_LUPY} eval={v.cards.get(lupa.s.karta.uid) ?? null} bezPopisov />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
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

function useRozmer() {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const zmeraj = (): void => setR({ w: el.clientWidth, h: el.clientHeight });
    zmeraj();
    const ro = new ResizeObserver(zmeraj);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, r] as const;
}

/** Výška plste bez kariet: súperovi starší nad radom, akcie pod kartou, súčet a potvrdenie. */
const REZERVA_NAD_RADOM = 136;
/** Pod touto výškou plste idú súper a súčet po bokoch, inak by karty boli nečitateľne malé (notebook 1366×650). */
const NIZKA_PLST = 460;
/** Akcie pod kartou a okraje, keď súper a súčet ležia po bokoch. */
const REZERVA_NIZKEJ_PLSTE = 56;
const SIRKA_BOKU = 230;

/**
 * Preskladanie radu priamo na plsti (mock B, Michal 2026-11-06): skutočné karty tesne vedľa seba, aby bolo
 * vidno spoje. Ťahá sa myšou či prstom, dve kliknuté sa vymenia, šípky posúvajú zvýrazneného. Skryto, odhalí sa, keď vyberú obaja.
 */
function RadNaStole({ view, data, sada, cmd }: Vlastnosti) {
  const h = view.pata;
  const sadaPata = useSadaPata(sada);
  const [poradie, setPoradie] = useState<readonly string[]>(h?.rady[view.ja].map((s) => s.karta.defId) ?? []);
  const [tah, setTah] = useState<{ readonly id: string; readonly x0: number; readonly dx: number; readonly hybal: boolean } | null>(null);
  const [vyber, setVyber] = useState<string | null>(null);
  const [ref, r] = useRozmer();
  if (h === undefined) return null;
  const rad = poradie.map((id) => h.rady[view.ja].find((s) => s.karta.defId === id)).filter((s): s is StarsiPata => s !== undefined);
  const v = radHraca(view, data, rad, view.ja);
  const nizka = r.h < NIZKA_PLST && r.w > 900;
  const sirka = Math.max(
    70,
    Math.floor(nizka ? Math.min((r.w - 2 * SIRKA_BOKU) / 4, (r.h - REZERVA_NIZKEJ_PLSTE) / POMER_STARSIEHO) : Math.min((r.w - 24) / 4, (r.h - REZERVA_NAD_RADOM) / POMER_STARSIEHO)),
  );
  const vymen = (i: number, j: number): void => {
    const nove = [...poradie];
    const a = nove[i];
    const b = nove[j];
    if (a === undefined || b === undefined) return;
    nove[i] = b;
    nove[j] = a;
    setPoradie(nove);
  };
  const pohyb = (e: PointerEvent): void => {
    if (tah === null) return;
    let { x0 } = tah;
    let dx = e.clientX - x0;
    const hybal = tah.hybal || Math.abs(dx) > 5;
    const i = poradie.indexOf(tah.id);
    if (dx > sirka / 2 && i < poradie.length - 1) {
      vymen(i, i + 1);
      x0 += sirka;
      dx -= sirka;
    } else if (dx < -sirka / 2 && i > 0) {
      vymen(i, i - 1);
      x0 -= sirka;
      dx += sirka;
    }
    setTah({ ...tah, x0, dx, hybal });
  };
  const pusti = (id: string): void => {
    if (tah !== null && !tah.hybal) {
      if (vyber === null) setVyber(id);
      else {
        if (vyber !== id) vymen(poradie.indexOf(vyber), poradie.indexOf(id));
        setVyber(null);
      }
    }
    setTah(null);
  };
  const klaves = (e: KeyboardEvent, i: number): void => {
    const j = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : -1;
    if (j < 0 || j >= poradie.length) return;
    e.preventDefault();
    vymen(i, j);
  };
  return (
    <div className={`pt-rad-stol${nizka ? " nizka" : ""}`} ref={ref}>
      <div className="pt-rad-super">
        <span className="tlmene">Súper skladá, poradie uvidíš po odhalení</span>
        {h.rady[opponentOf(view.ja)].map((s) => (
          <span key={s.karta.uid} className={`pt-rub${s.podrazeny ? " padol" : ""}`}>
            <FotoStarsieho data={data} sada={sada} id={s.karta.defId} />
            <b>{menoStarsieho(data, s.karta.defId)}</b>
            {s.podrazeny ? "padol" : s.pecen}
          </span>
        ))}
      </div>
      <ol className="pt-rad-karty" aria-label="Poradie môjho radu">
        {rad.map((s, i) => {
          const id = s.karta.defId;
          const taha = tah?.id === id;
          return (
            <li key={s.karta.uid} style={{ width: sirka }}>
              <div
                className={`pt-tahaj${taha ? " taha" : ""}${vyber === id ? " vybrany" : ""}${s.podrazeny ? " padol" : ""}`}
                style={taha ? { transform: `translateX(${tah.dx}px)` } : undefined}
                tabIndex={0}
                role="button"
                aria-label={`${menoStarsieho(data, id)}, ${i + 1}. v rade. Šípky ho posúvajú.`}
                onKeyDown={(e) => klaves(e, i)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setTah({ id, x0: e.clientX, dx: 0, hybal: false });
                }}
                onPointerMove={pohyb}
                onPointerUp={() => pusti(id)}
                onPointerCancel={() => setTah(null)}
              >
                <HernaKarta karta={s.karta} sada={sadaPata} data={data} sirka={sirka} eval={v.cards.get(s.karta.uid) ?? null} />
              </div>
              <div className="pt-pod-kartou">
                <Akcie sumy={v.naStarsom.get(s.karta.uid)} sada={sada} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="pt-rad-hrana">
        <span className="pt-rad-spolu">
          <span className="tlmene">Rad dá</span>
          <Akcie sumy={v.sumy} sada={sada} velke />
        </span>
        <button type="button" className="tlacidlo tlacidlo-hlavne" onClick={() => cmd({ type: "pataRad", poradie })}>
          Potvrdiť rad
        </button>
        <span className="tlmene pt-rad-tip">Potiahni, alebo klikni na dve karty a vymenia sa.</span>
      </div>
    </div>
  );
}

/** Rad sa skladá na plsti stola, ostatné rozhodnutia sú okná (RozhodnutiePata). */
export function RadNaPlsti(p: Vlastnosti) {
  const h = p.view.pata;
  if (h === undefined || h.krok !== "rad" || !p.view.mozemHrat) return null;
  return <RadNaStole key={`${p.view.kolo}-rad`} {...p} />;
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

export interface Vlastnosti {
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
      return null;
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
