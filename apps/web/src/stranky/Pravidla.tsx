// Pravidlá ako jedna stránka na čítanie od začiatku (Michal 2026-10-24: dizajn
// UI A „Kniha s obsahom“ + UX A „obsah s kde som“, osnova Navrhára). Kapitoly
// sú v poradí, v akom plynie partia; obsah vľavo ukazuje, kde si, a skáče na
// kapitoly aj podkapitoly; vyhľadávanie prehľadá celý text; pojmy sa vysvetlia
// pod myšou a slovník je na konci.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PRAVIDLA_PLATNE_OD, VERZIA_PRAVIDIEL } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { CASTI, KAPITOLY, STARE_KOTVY, type Kapitola } from "./pravidla/kapitoly.tsx";
import { PojmyPravidiel, chodNaPojem } from "./pravidla/Pojem.tsx";
import { SLOVNIK } from "./pravidla/slovnik.ts";
import { VyzvaVyucby } from "../hra/VstupyVyucby.tsx";

/** Ilustrácie kapitol (generuje Admin, bez nápisu) — chýbajúca = zástupný pás, žiadne 404. */
const OBRAZKY = import.meta.glob("./pravidla-obrazky/*.{jpg,jpeg,webp,png}", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;
const obrazokKapitoly = (meno: string): string | null =>
  Object.entries(OBRAZKY).find(([cesta]) => cesta.replace(/^.*\//, "").replace(/\.[a-z]+$/, "") === meno)?.[1] ?? null;

/** „2026-10-24“ → „24. 10. 2026“ — tak, ako dátum píšu hráči. */
const [rokPlatnosti, mesiacPlatnosti, denPlatnosti] = PRAVIDLA_PLATNE_OD.split("-").map(Number);
const VERZIA = `Pravidlá ${VERZIA_PRAVIDIEL}, platné od ${denPlatnosti}. ${mesiacPlatnosti}. ${rokPlatnosti}`;

/** Kam dopadne skok na kotvu: pod lepkavú hlavičku webu, na mobile aj pod lištu „N / 15“. */
function odsadenie(): number {
  const lista = document.querySelector<HTMLElement>(".pravidla-lista");
  const spodok =
    lista !== null && lista.offsetParent !== null
      ? lista.getBoundingClientRect().bottom
      : (document.querySelector(".hlavicka")?.getBoundingClientRect().bottom ?? 65);
  return Math.max(0, spodok) + 16;
}

const bezDiakritiky = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Element podľa kotvy (aj staré kotvy kapitol pred osnovou 2026-10-24). */
function cielKotvy(hash: string): HTMLElement | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (id === "") return null;
  return document.getElementById(STARE_KOTVY[id] ?? id);
}

/**
 * Okamžitý posun na prvok pod hlavičku. Plynulé posúvanie cieľ minulo: kým stránka
 * „letela“, menila sa výška obsahu nad cieľom (na 1920 o ~400 px, UI 2026-10-24).
 */
function posunNa(el: HTMLElement): void {
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - odsadenie(), behavior: "instant" });
}

function skocNa(id: string): void {
  const el = document.getElementById(id);
  if (el === null) return;
  history.pushState(null, "", `#${id}`);
  posunNa(el);
}

interface Podkapitola {
  readonly id: string;
  readonly nazov: string;
}

interface Vysledok {
  readonly kotva: string;
  readonly kde: string;
  readonly ukazka: ReactNode;
}

/** Úryvok okolo nájdeného slova so zvýraznením. */
function uryvok(text: string, i: number, dlzka: number): ReactNode {
  const od = Math.max(0, i - 40);
  const po = Math.min(text.length, i + dlzka + 60);
  return (
    <>
      {od > 0 && "…"}
      {text.slice(od, i)}
      <mark>{text.slice(i, i + dlzka)}</mark>
      {text.slice(i + dlzka, po)}
      {po < text.length && "…"}
    </>
  );
}

/** Hľadá v celom texte stránky (DOM) aj v slovníku; výsledok vedie na najbližšiu kotvu. */
function hladaj(dotaz: string): Vysledok[] {
  const q = bezDiakritiky(dotaz.trim());
  if (q.length < 2) return [];
  const out: Vysledok[] = [];
  const videne = new Set<string>();
  for (const p of SLOVNIK) {
    const t = bezDiakritiky(`${p.pojem} ${p.popis}`);
    if (!t.includes(q)) continue;
    const kotva = `pojem-${p.id}`;
    videne.add(kotva);
    out.push({ kotva, kde: `Slovník › ${p.pojem}`, ukazka: p.popis });
  }
  for (const sekcia of document.querySelectorAll<HTMLElement>("section.kapitola")) {
    const nazov = sekcia.querySelector("h2")?.textContent ?? "";
    let kotva = sekcia.id;
    let kde = nazov;
    for (const el of sekcia.querySelectorAll<HTMLElement>(".kapitola-telo h3, .kapitola-telo p, .kapitola-telo li, .kapitola-telo td, .v-skratke li")) {
      if (el.tagName === "H3") {
        kotva = el.id || kotva;
        kde = `${nazov} › ${(el.firstChild?.textContent ?? "").trim()}`;
        // Nadpis sám je len kotva — výsledok je text pod ním.
        continue;
      }
      const text = (el.textContent ?? "").replace(/§$/, "").trim();
      const i = bezDiakritiky(text).indexOf(q);
      if (i === -1 || videne.has(`${kotva}|${text}`)) continue;
      videne.add(`${kotva}|${text}`);
      out.push({ kotva, kde, ukazka: uryvok(text, i, q.length) });
      if (out.length >= 12) return out;
    }
  }
  return out;
}

function Hladanie({ poVybere }: { readonly poVybere?: () => void }) {
  const [dotaz, setDotaz] = useState("");
  const vysledky = useMemo(() => hladaj(dotaz), [dotaz]);
  const vyber = (kotva: string): void => {
    setDotaz("");
    poVybere?.();
    if (kotva.startsWith("pojem-")) chodNaPojem(kotva.slice("pojem-".length));
    else skocNa(kotva);
  };
  return (
    <div className="pravidla-hladanie">
      <input
        type="search"
        value={dotaz}
        onChange={(e) => setDotaz(e.target.value)}
        placeholder="Hľadaj pravidlo alebo pojem…"
        aria-label="Hľadať v pravidlách"
        data-pravidla-hladanie=""
        onKeyDown={(e) => {
          if (e.key === "Enter" && vysledky[0] !== undefined) vyber(vysledky[0].kotva);
          if (e.key === "Escape") setDotaz("");
        }}
      />
      {dotaz.trim().length >= 2 && (
        <ul className="pravidla-vysledky" aria-label="Výsledky hľadania" aria-live="polite">
          {vysledky.length === 0 && <li className="tlmene">Nič sa nenašlo.</li>}
          {vysledky.map((v, i) => (
            <li key={`${v.kotva}-${i}`}>
              <button type="button" onClick={() => vyber(v.kotva)}>
                <strong>{v.kde}</strong>
                <span>{v.ukazka}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Poloha {
  /** Index aktívnej kapitoly; KAPITOLY.length = slovník. */
  readonly kapitola: number;
  readonly podkapitola: string | null;
}

/**
 * Vysoké okno: obsah po boku ukáže všetky časti a kapitoly naraz (dizajn #24 A,
 * Michal 2026-10-26); v nízkom okne (notebook) zbalí časti, v ktorých čitateľ nie je.
 */
const VYSOKE_OKNO = "(min-height: 820px)";

function useVysokeOkno(): boolean {
  const [vysoke, setVysoke] = useState(() => window.matchMedia(VYSOKE_OKNO).matches);
  useEffect(() => {
    const mq = window.matchMedia(VYSOKE_OKNO);
    const zmena = (): void => setVysoke(mq.matches);
    mq.addEventListener("change", zmena);
    return () => mq.removeEventListener("change", zmena);
  }, []);
  return vysoke;
}

/** Kde čitateľ je — posledná kapitola a podkapitola, ktorej začiatok prešiel pod hlavičku. */
function usePoloha(): Poloha {
  const [poloha, setPoloha] = useState<Poloha>({ kapitola: 0, podkapitola: null });
  useEffect(() => {
    let raf = 0;
    const zmeraj = (): void => {
      raf = 0;
      const hranica = odsadenie() + 40;
      const sekcie = [...document.querySelectorAll<HTMLElement>("section.kapitola, section#slovnik")];
      let kapitola = 0;
      sekcie.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= hranica) kapitola = i;
      });
      let podkapitola: string | null = null;
      for (const h of sekcie[kapitola]?.querySelectorAll<HTMLElement>("h3[id]") ?? []) {
        if (h.getBoundingClientRect().top <= hranica) podkapitola = h.id;
      }
      setPoloha((p) => (p.kapitola === kapitola && p.podkapitola === podkapitola ? p : { kapitola, podkapitola }));
    };
    const naScroll = (): void => {
      if (raf === 0) raf = requestAnimationFrame(zmeraj);
    };
    zmeraj();
    window.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", naScroll);
    return () => {
      window.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", naScroll);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, []);
  return poloha;
}

function Obsah({
  poloha,
  podkapitoly,
  ukazky,
  poVybere,
  kompaktny = false,
}: {
  readonly poloha: Poloha;
  readonly podkapitoly: ReadonlyMap<string, readonly Podkapitola[]>;
  readonly ukazky: ReadonlySet<string>;
  readonly poVybere?: () => void;
  /** Desktop: rozbalená len časť s aktívnou kapitolou (bok sa zmestí do nízkeho okna). */
  readonly kompaktny?: boolean;
}) {
  const aktivna = KAPITOLY[poloha.kapitola];
  // Kým je čitateľ v slovníku, rozbalená ostáva posledná časť.
  const aktivnaCast = (aktivna ?? KAPITOLY[KAPITOLY.length - 1])?.cast;
  const klik = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    poVybere?.();
    skocNa(id);
  };
  return (
    <nav className="pravidla-obsah" aria-label="Obsah pravidiel">
      {CASTI.map((c) => {
        const kapitolyCasti = KAPITOLY.filter((k) => k.cast === c.id);
        if (kompaktny && c.id !== aktivnaCast) {
          const prva = kapitolyCasti[0];
          return (
            <div key={c.id} className="obsah-cast">
              <button type="button" className="obsah-cast-skok" onClick={() => prva !== undefined && skocNa(prva.id)}>
                {c.id} · {c.nazov} <span>{kapitolyCasti.length} kap.</span>
              </button>
            </div>
          );
        }
        return (
        <div key={c.id} className="obsah-cast">
          <h3>
            {c.id} · {c.nazov}
          </h3>
          <ol>
            {KAPITOLY.map((k, i) => ({ k, i }))
              .filter(({ k }) => k.cast === c.id)
              .map(({ k, i }) => {
                const je = i === poloha.kapitola;
                const precitana = i < poloha.kapitola;
                return (
                  <li key={k.id} className={je ? "aktivna" : precitana ? "precitana" : undefined}>
                    <a href={`#${k.id}`} aria-current={je ? "location" : undefined} onClick={klik(k.id)}>
                      <span className="obsah-cislo">{i + 1}</span>
                      <span className="obsah-nazov">
                        {k.kratky ?? k.nazov}
                        {precitana && <span className="obsah-skryte">, prečítané</span>}
                      </span>
                      {precitana && (
                        <span className="obsah-precitana" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      {ukazky.has(k.id) && <span className="obsah-ukazka">ukážka</span>}
                    </a>
                    {je && aktivna !== undefined && (podkapitoly.get(k.id)?.length ?? 0) > 0 && (
                      <ul className="obsah-pod">
                        {podkapitoly.get(k.id)?.map((p) => (
                          <li key={p.id}>
                            <a href={`#${p.id}`} className={p.id === poloha.podkapitola ? "aktivna" : undefined} onClick={klik(p.id)}>
                              {p.nazov}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
          </ol>
        </div>
        );
      })}
      <a
        href="#slovnik"
        className={`obsah-slovnik ${poloha.kapitola === KAPITOLY.length ? "aktivna" : ""}`}
        aria-current={poloha.kapitola === KAPITOLY.length ? "location" : undefined}
        onClick={klik("slovnik")}
      >
        <span>A–Z</span> Slovník
      </a>
      <Odkaz href="/karty" className="obsah-slovnik">
        <span aria-hidden="true">→</span> Karty: príbeh a účel v hre
      </Odkaz>
    </nav>
  );
}

function PasKapitoly({ kapitola, index }: { readonly kapitola: Kapitola; readonly index: number }) {
  const url = obrazokKapitoly(kapitola.obrazok);
  if (url !== null) return <img className="kapitola-pas" src={url} alt="" loading={index < 2 ? "eager" : "lazy"} />;
  // Zástupný pás, kým Admin nedodá ilustráciu (Michal 2026-10-24: nové, bez nápisu).
  return (
    <div className={`kapitola-pas zastupny cast-${kapitola.cast.toLowerCase()}`} aria-hidden="true">
      <span>{index + 1}</span>
    </div>
  );
}

function Slovnik({ sada }: { readonly sada: Sada }) {
  const [filter, setFilter] = useState("");
  const q = bezDiakritiky(filter.trim());
  const pojmy = [...SLOVNIK].sort((a, b) => a.pojem.localeCompare(b.pojem, "sk")).filter((p) => q === "" || bezDiakritiky(`${p.pojem} ${p.popis}`).includes(q));
  const spustace = sada.klucoveSlova.filter((k) => k.tucne && (q === "" || bezDiakritiky(`${k.slovo} ${k.popis}`).includes(q)));
  const slovesa = sada.klucoveSlova.filter((k) => !k.tucne && (q === "" || bezDiakritiky(`${k.slovo} ${k.popis}`).includes(q)));
  return (
    <section id="slovnik" className="slovnik" aria-labelledby="slovnik-nadpis">
      <span className="kapitola-kicker">Na konci · A–Z</span>
      <h2 id="slovnik-nadpis">Slovník</h2>
      <p className="tlmene">Každý pojem jednou vetou — tie isté vety sa ukážu pod myšou pri podčiarknutom slove v texte.</p>
      <input
        type="search"
        className="slovnik-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrovať pojmy…"
        aria-label="Filtrovať slovník"
      />
      <dl className="slovnik-zoznam">
        {pojmy.map((p) => (
          <div key={p.id} id={`pojem-${p.id}`} className="slovnik-pojem">
            <dt>{p.pojem}</dt>
            <dd>{p.popis}</dd>
          </div>
        ))}
      </dl>
      {spustace.length > 0 && (
        <>
          <h3 id="slovnik-kedy">Kedy efekt platí — tučné slová na kartách</h3>
          <dl className="slovnik-zoznam">
            {spustace.map((k) => (
              <div key={k.slovo} className="slovnik-pojem spustac">
                <dt>{k.slovo}</dt>
                <dd>{k.popis}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {slovesa.length > 0 && (
        <>
          <h3 id="slovnik-co">Čo efekt robí — slová kurzívou</h3>
          <dl className="slovnik-zoznam">
            {slovesa.map((k) => (
              <div key={k.slovo} className="slovnik-pojem sloveso">
                <dt>
                  <em>{k.slovo}</em>
                </dt>
                <dd>{k.popis}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <p>
        Všetky karty s efektmi, variantmi, príbehom a účelom v hre nájdeš v <Odkaz href="/karty">glosári kariet</Odkaz>.
      </p>
    </section>
  );
}

export function Pravidla() {
  useTitulok("Pravidlá");
  const { sada } = useSada();
  const poloha = usePoloha();
  const vysokeOkno = useVysokeOkno();
  const [mobilObsah, setMobilObsah] = useState(false);
  // Obsah zdola je dialóg: fokus do hľadania, Esc zavrie a fokus sa vráti na lištu (UI inšpekcia).
  const listaRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobilObsah) return;
    sheetRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMobilObsah(false);
    };
    window.addEventListener("keydown", esc);
    const lista = listaRef.current;
    return () => {
      window.removeEventListener("keydown", esc);
      lista?.focus();
    };
  }, [mobilObsah]);

  // Podkapitoly, ukážky a čas čítania sa zistia z vykresleného textu — jediný zdroj je obsah kapitoly.
  const knihaRef = useRef<HTMLDivElement>(null);
  const [podkapitoly, setPodkapitoly] = useState<ReadonlyMap<string, readonly Podkapitola[]>>(new Map());
  const [ukazky, setUkazky] = useState<ReadonlySet<string>>(new Set());
  const [minuty, setMinuty] = useState<ReadonlyMap<string, number>>(new Map());
  useLayoutEffect(() => {
    const kniha = knihaRef.current;
    if (kniha === null || sada === null) return;
    const pod = new Map<string, Podkapitola[]>();
    const uk = new Set<string>();
    const min = new Map<string, number>();
    for (const s of kniha.querySelectorAll<HTMLElement>("section.kapitola")) {
      pod.set(
        s.id,
        [...s.querySelectorAll<HTMLElement>("h3[id]")].map((h) => ({ id: h.id, nazov: (h.firstChild?.textContent ?? "").trim() })),
      );
      if (s.querySelector(".ukazka") !== null) uk.add(s.id);
      min.set(s.id, Math.max(1, Math.round((s.textContent ?? "").split(/\s+/).length / 180)));
    }
    setPodkapitoly(pod);
    setUkazky(uk);
    setMinuty(min);
  }, [sada]);

  // Skok na kotvu z adresy (aj stará kapitola) až po vykreslení textu.
  useEffect(() => {
    if (sada === null) return;
    const skoc = (): void => {
      const el = cielKotvy(location.hash);
      if (el !== null) posunNa(el);
    };
    skoc();
    // Písmo a ukážky ešte môžu zmeniť výšku textu nad cieľom — skok sa raz zopakuje,
    // ak medzitým čitateľ sám neposunul stránku.
    let sam = false;
    const posunulSam = (): void => {
      sam = true;
    };
    const opakuj = (): void => {
      if (!sam) skoc();
    };
    const t = setTimeout(opakuj, 600);
    void document.fonts?.ready.then(opakuj);
    for (const u of ["wheel", "touchmove", "keydown"] as const) window.addEventListener(u, posunulSam, { passive: true, once: true });
    window.addEventListener("hashchange", skoc);
    return () => {
      clearTimeout(t);
      for (const u of ["wheel", "touchmove", "keydown"] as const) window.removeEventListener(u, posunulSam);
      window.removeEventListener("hashchange", skoc);
    };
  }, [sada]);

  // „/“ skočí do hľadania (ako na iných weboch s dokumentáciou).
  useEffect(() => {
    const f = (e: KeyboardEvent): void => {
      const t = e.target;
      if (e.key !== "/" || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      const pole = document.querySelector<HTMLInputElement>("[data-pravidla-hladanie]");
      if (pole === null || pole.offsetParent === null) return;
      e.preventDefault();
      pole.focus();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const aktivna = KAPITOLY[poloha.kapitola];
  // Pokrok podľa kapitoly, nie podľa posunu stránky — „6 / 15“ a pruh 40 % (Leader 2026-10-24:
  // percento z posunu pri kapitole 6 ukazovalo 25 % a mátlo).
  const vSlovniku = poloha.kapitola >= KAPITOLY.length;
  const kdeSom = vSlovniku ? "Slovník" : `${poloha.kapitola + 1} / ${KAPITOLY.length}`;
  const percent = vSlovniku ? 100 : Math.round(((poloha.kapitola + 1) / KAPITOLY.length) * 100);

  return (
    <PojmyPravidiel>
      <div className="pravidla">
        <aside className="pravidla-bok">
          <div className="pravidla-bok-hlava">
            <h2>Pravidlá</h2>
            <span className="tlmene">
              {kdeSom}
            </span>
          </div>
          <p className="pravidla-verzia tlmene">{VERZIA}</p>
          <div className="pravidla-pokrok" aria-hidden="true">
            <i style={{ width: `${percent}%` }} />
          </div>
          <Hladanie />
          <Obsah poloha={poloha} podkapitoly={podkapitoly} ukazky={ukazky} kompaktny={!vysokeOkno} />
        </aside>

        {/* Mobil: lišta „kde som“ pod hlavičkou otvorí obsah zdola. */}
        <div className="pravidla-lista">
          <button type="button" ref={listaRef} onClick={() => setMobilObsah(true)} aria-expanded={mobilObsah}>
            <span className="pravidla-lista-cislo">
              {vSlovniku ? "A–Z" : kdeSom}
            </span>
            <span className="pravidla-lista-nazov">{aktivna?.nazov ?? "Slovník"}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <i style={{ width: `${percent}%` }} aria-hidden="true" />
        </div>
        {mobilObsah && (
          <div className="pravidla-sheet-zaclona" onClick={() => setMobilObsah(false)}>
            <div className="pravidla-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Obsah pravidiel" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="pravidla-sheet-zavriet" aria-label="Zavrieť obsah" onClick={() => setMobilObsah(false)}>
                ✕
              </button>
              <Hladanie poVybere={() => setMobilObsah(false)} />
              <Obsah poloha={poloha} podkapitoly={podkapitoly} ukazky={ukazky} poVybere={() => setMobilObsah(false)} />
            </div>
          </div>
        )}

        <div className="pravidla-kniha" ref={knihaRef}>
          {/* Kto ešte nemá 1. časť výučby, toho pošleme najprv k Melicharovi; Pravidlá ostanú príručkou (#104). */}
          <VyzvaVyucby />
          {/* Na mobile bok s nadpisom chýba — verzia ide nad prvú kapitolu. */}
          <p className="pravidla-verzia pravidla-verzia-mobil tlmene">{VERZIA}</p>
          {sada === null ? (
            <div className="kostra-textu" aria-label="Načítava sa">
              {[92, 100, 84, 96, 70, 0, 88, 100, 60].map((w, i) => (
                <span key={i} style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              {KAPITOLY.map((k, i) => {
                const prvaVCasti = KAPITOLY[i - 1]?.cast !== k.cast;
                const cast = CASTI.find((c) => c.id === k.cast);
                return (
                  <section key={k.id} id={k.id} className="kapitola" aria-labelledby={`${k.id}-nadpis`}>
                    {prvaVCasti && cast !== undefined && (
                      <div className="kapitola-cast">
                        Časť {cast.id} · {cast.nazov}
                      </div>
                    )}
                    <PasKapitoly kapitola={k} index={i} />
                    <span className="kapitola-kicker">
                      {k.cast} · kapitola {i + 1} / {KAPITOLY.length}
                      {minuty.has(k.id) && ` · ≈ ${minuty.get(k.id)} min`}
                    </span>
                    <h2 id={`${k.id}-nadpis`}>{k.nazov}</h2>
                    <div className="v-skratke">
                      <strong>V skratke</strong>
                      <ul>
                        {k.vSkratke.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="kapitola-telo">{k.obsah(sada)}</div>
                    {/* Tichý predeľ namiesto „Ďalej: …“ — ďalšia kapitola je hneď pod ním a skáče sa z obsahu po boku (dizajn #24 A). */}
                    <div className="kapitola-koniec" aria-hidden="true">
                      <span>koniec kapitoly {i + 1}</span>
                    </div>
                  </section>
                );
              })}
              <Slovnik sada={sada} />
            </>
          )}
        </div>
      </div>
    </PojmyPravidiel>
  );
}
