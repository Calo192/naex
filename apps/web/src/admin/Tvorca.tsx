// Tvorca karty (MAUI Card Creator): obsah, ilustrácia, farba, rozmery,
// akcie po stranách s blokovanými a obmedzenými pozíciami. Vpravo živý
// náhľad so všetkými variantmi.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AkciaDef, KartaNavrh, Pozicia, StranaNavrhu } from "@naex/tvorba";
import {
  POZICIE,
  chybyNavrhu,
  farbaKarty,
  neznameAkcie,
  odtienZHex,
  pastelHex,
  pocetAkcii,
  rozlozeniaStrany,
  slug,
  spustaceVTexte,
  variant,
  variantyKarty,
  volnePozicie,
} from "@naex/tvorba";
import { ALL_TRIGGERS } from "@naex/core";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { Hlaska, Pole } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";
import { VyberObrazka } from "./VyberObrazka.tsx";

function TagyVstup({ tagy, nastav, navrhy }: { readonly tagy: readonly string[]; readonly nastav: (t: string[]) => void; readonly navrhy: readonly string[] }) {
  const [text, setText] = useState("");
  const pridaj = () => {
    const t = text.trim().replace(/,$/, "");
    if (t !== "" && !tagy.includes(t)) nastav([...tagy, t]);
    setText("");
  };
  return (
    <div className="tagy-vstup">
      {tagy.map((t, i) => (
        <span key={t} className="tag-cip">
          {i === 0 && <span className="tag-prvy" title="Prvý tag určuje farbu karty (ak má zapnutú kategóriu)">★</span>}
          {t}
          <button type="button" onClick={() => nastav(tagy.filter((x) => x !== t))} aria-label={`Odstrániť tag ${t}`}>
            ×
          </button>
        </span>
      ))}
      <input
        list="tagy-navrhy"
        value={text}
        placeholder="pridať tag…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            pridaj();
          } else if (e.key === "Backspace" && text === "" && tagy.length > 0) {
            nastav(tagy.slice(0, -1));
          }
        }}
        onBlur={pridaj}
      />
      <datalist id="tagy-navrhy">
        {navrhy.filter((n) => !tagy.includes(n)).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}

function StranaEditor({
  nazov,
  strana,
  nastav,
  akcie,
  farba,
}: {
  readonly nazov: string;
  readonly strana: StranaNavrhu;
  readonly nastav: (s: StranaNavrhu) => void;
  readonly akcie: readonly AkciaDef[];
  readonly farba: string;
}) {
  const pouzite = Object.entries(strana.akcie).filter(([, n]) => n > 0);
  const volne = volnePozicie(strana).length;
  const pocet = pocetAkcii(strana);
  const rozlozeni = rozlozeniaStrany(strana).length;
  const ikona = (kluc: string) => (
    <span className="mini-slot" style={{ background: farba }}>
      <IkonaAkcie kluc={kluc} akcia={akcie.find((a) => a.kluc === kluc)} />
    </span>
  );

  const nastavPocet = (kluc: string, n: number) => {
    const nove = { ...strana.akcie };
    if (n <= 0) delete nove[kluc];
    else nove[kluc] = n;
    // Akcia, ktorá zo strany zmizla, nesmie ostať v obmedzeniach pozícií.
    const povolene: Partial<Record<Pozicia, string[]>> = {};
    for (const p of POZICIE) {
      const z = (strana.povolene[p] ?? []).filter((k) => (nove[k] ?? 0) > 0);
      if (z.length > 0) povolene[p] = z;
    }
    nastav({ ...strana, akcie: nove, povolene });
  };

  const prepniBlok = (p: Pozicia) => {
    const blokovane = strana.blokovane.includes(p) ? strana.blokovane.filter((x) => x !== p) : [...strana.blokovane, p].sort();
    const povolene = { ...strana.povolene };
    delete povolene[p];
    nastav({ ...strana, blokovane, povolene });
  };

  const prepniPovolenu = (p: Pozicia, kluc: string) => {
    const z = strana.povolene[p] ?? [];
    const nove = z.includes(kluc) ? z.filter((k) => k !== kluc) : [...z, kluc];
    const povolene = { ...strana.povolene };
    if (nove.length === 0) delete povolene[p];
    else povolene[p] = nove;
    nastav({ ...strana, povolene });
  };

  return (
    <div className="strana-editor">
      <div className="strana-hlava">
        <h3>{nazov}</h3>
        <span className={pocet > volne ? "strana-stav zle" : "strana-stav"}>
          {pocet}/{volne} akcií · {rozlozeni} {rozlozeni === 1 ? "rozloženie" : "rozložení"}
        </span>
      </div>

      <div className="strana-akcie">
        {pouzite.map(([kluc, n]) => (
          <div key={kluc} className="strana-akcia">
            {ikona(kluc)}
            <span className="strana-akcia-meno">{akcie.find((a) => a.kluc === kluc)?.nazov ?? kluc}</span>
            <span className="pocitadlo-ovladanie">
              <button type="button" className="tlacidlo-male" onClick={() => nastavPocet(kluc, n - 1)} aria-label="Menej">
                −
              </button>
              <output>{n}</output>
              <button type="button" className="tlacidlo-male" onClick={() => nastavPocet(kluc, n + 1)} disabled={pocet >= volne} aria-label="Viac">
                +
              </button>
            </span>
          </div>
        ))}
        <select
          value=""
          onChange={(e) => e.target.value !== "" && nastavPocet(e.target.value, 1)}
          disabled={pocet >= volne}
          aria-label="Pridať akciu"
        >
          <option value="">{pocet >= volne ? "strana je plná" : "+ pridať akciu…"}</option>
          {akcie
            .filter((a) => (strana.akcie[a.kluc] ?? 0) === 0)
            .map((a) => (
              <option key={a.kluc} value={a.kluc}>
                {a.nazov}
              </option>
            ))}
        </select>
      </div>

      <div className="strana-pozicie">
        {POZICIE.map((p) => {
          const blok = strana.blokovane.includes(p);
          const povolene = strana.povolene[p] ?? [];
          return (
            <div key={p} className={blok ? "pozicia-riadok blokovana" : "pozicia-riadok"}>
              <span className="pozicia-cislo">{p}</span>
              <label className="pozicia-blok">
                <input type="checkbox" checked={blok} onChange={() => prepniBlok(p)} /> blokovaná
              </label>
              {!blok && pouzite.length > 1 && (
                <span className="pozicia-povolene" title="Obmedzenie: pozícia smie držať len vybrané akcie. Nič nevybraté = všetky.">
                  {pouzite.map(([kluc]) => (
                    <button
                      type="button"
                      key={kluc}
                      className={povolene.includes(kluc) ? "povolena aktivna" : "povolena"}
                      onClick={() => prepniPovolenu(p, kluc)}
                      title={`${akcie.find((a) => a.kluc === kluc)?.nazov ?? kluc} — ${povolene.length === 0 ? "povolené všetky" : povolene.includes(kluc) ? "povolená" : "zakázaná"}`}
                    >
                      {ikona(kluc)}
                    </button>
                  ))}
                  <span className="tlmene">{povolene.length === 0 ? "všetky" : "len vybrané"}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Riadok({ children }: { readonly children: ReactNode }) {
  return <div className="tvorca-riadok">{children}</div>;
}

export function Tvorca({ id }: { readonly id: string }) {
  const { obsah, vzhlad, ulozKartu, zmazKartu } = useAdmin();
  const nova = id === "nova";
  const povodna = useMemo(() => obsah?.karty.find((k) => k.id === id) ?? null, [obsah, id]);
  const [k, setK] = useState<KartaNavrh | null>(null);
  const [v, setV] = useState(0);
  const [vyberObrazka, setVyberObrazka] = useState(false);
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [uklada, setUklada] = useState(false);
  useTitulok(k === null ? "Tvorca" : `${k.nazov || "Nová karta"} — tvorca`);

  useEffect(() => {
    if (obsah === null) return;
    if (nova) {
      setK({
        id: "",
        nazov: "",
        tagy: [],
        efekt: "",
        obrazok: null,
        farba: null,
        ...obsah.nastavenia,
        kopie: 1,
        lava: { blokovane: [], akcie: {}, povolene: {} },
        prava: { blokovane: [], akcie: {}, povolene: {} },
        upravene: 0,
      });
    } else if (povodna !== null) {
      setK(povodna);
    }
    setV(0);
    // Pri každom otvorení inej karty začíname z uloženej verzie.
  }, [id, obsah === null]);

  const zmenene = k !== null && (nova || JSON.stringify(k) !== JSON.stringify(povodna));

  useEffect(() => {
    if (!zmenene) return;
    const pred = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", pred);
    return () => window.removeEventListener("beforeunload", pred);
  }, [zmenene]);

  if (obsah === null || vzhlad === null) return null;
  if (k === null) {
    return nova ? null : (
      <Hlaska>
        Karta „{id}“ neexistuje. <Odkaz href="/admin/karty">Späť na karty</Odkaz>
      </Hlaska>
    );
  }

  const nastav = <K extends keyof KartaNavrh>(pole: K, hodnota: KartaNavrh[K]) => setK({ ...k, [pole]: hodnota });
  const varianty = variantyKarty(k);
  const roz = variant(varianty, v);
  const chyby = chybyNavrhu(k);
  const nezname = neznameAkcie(k);
  const farba = farbaKarty(k, vzhlad.kategorie);
  const spustace = spustaceVTexte(k.efekt, ALL_TRIGGERS);
  const vsetkyTagy = [...new Set(obsah.karty.flatMap((x) => x.tagy))].sort((a, b) => a.localeCompare(b, "sk"));

  const uloz = async () => {
    setUklada(true);
    setSprava(null);
    try {
      let noveId = k.id;
      if (nova) {
        noveId = slug(k.nazov) || "karta";
        while (obsah.karty.some((x) => x.id === noveId)) noveId += "_2";
      }
      await ulozKartu({ ...k, id: noveId });
      setSprava({ druh: "ok", text: "Uložené. Hráči zmenu uvidia po zverejnení sady." });
      if (nova) chod(`/admin/karty/${noveId}`, true);
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setUklada(false);
    }
  };

  const zmaz = async () => {
    if (!window.confirm(`Zmazať návrh „${k.nazov}“?`)) return;
    await zmazKartu(k.id);
    chod("/admin/karty");
  };

  return (
    <div
      className="tvorca"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          if (chyby.length === 0) void uloz();
        }
      }}
    >
      <div className="tvorca-formular">
        <div className="admin-hlava">
          <div>
            <Odkaz href="/admin/karty" className="spat">
              ← Karty
            </Odkaz>
            <h1>{nova ? "Nová karta" : k.nazov}</h1>
            {!nova && <span className="tlmene">id: {k.id}</span>}
          </div>
          <div className="riadok-tlacidiel">
            {!nova && (
              <button className="tlacidlo-nebezpecne tlacidlo-male" onClick={() => void zmaz()}>
                Zmazať
              </button>
            )}
            <button className="tlacidlo-hlavne" onClick={() => void uloz()} disabled={uklada || chyby.length > 0 || !zmenene}>
              {uklada ? "Ukladám…" : zmenene ? "Uložiť (Ctrl+S)" : "Uložené"}
            </button>
          </div>
        </div>

        {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}
        {chyby.length > 0 && <Hlaska>{chyby.join("\n")}</Hlaska>}
        {nezname.length > 0 && (
          <Hlaska druh="info">
            Vlastná akcia {nezname.map((a) => vzhlad.akcie.find((x) => x.kluc === a)?.nazov ?? a).join(", ")} nemá v hre
            pravidlá — kartu môžeš navrhovať a tlačiť, ale do hry ju nezverejníš, kým akciu nenaprogramujeme.
          </Hlaska>
        )}

        <section className="panel">
          <Pole label="Názov">
            <input value={k.nazov} onChange={(e) => nastav("nazov", e.target.value)} maxLength={80} autoFocus={nova} />
          </Pole>
          <Pole label="Tagy" pomoc="Enter alebo čiarka pridá tag. Prvý tag so zapnutou kategóriou určuje farbu.">
            <TagyVstup tagy={k.tagy} nastav={(t) => nastav("tagy", t)} navrhy={vsetkyTagy} />
          </Pole>
          <Pole
            label="Efekt"
            pomoc={
              spustace.length > 0
                ? `Spúšťače: ${spustace.join(", ")}. Kľúčové slová sa formátujú podľa sekcie Kľúčové slová.`
                : "Začni spúšťačom, napr. „Bitka: …“, „Furt: …“."
            }
          >
            <textarea value={k.efekt} onChange={(e) => nastav("efekt", e.target.value)} rows={3} maxLength={600} />
          </Pole>
        </section>

        <section className="panel">
          <h3>Ilustrácia a farba</h3>
          <Riadok>
            <div className="tvorca-obrazok">
              {k.obrazok !== null ? (
                <img src={`/media/${k.obrazok.nahlad}`} alt="" />
              ) : (
                <span className="tlmene">bez obrázka</span>
              )}
            </div>
            <div className="riadok-tlacidiel">
              <button onClick={() => setVyberObrazka(true)}>{k.obrazok === null ? "Vybrať obrázok" : "Zmeniť obrázok"}</button>
              {k.obrazok !== null && (
                <button className="tlacidlo-jemne" onClick={() => nastav("obrazok", null)}>
                  Odstrániť
                </button>
              )}
            </div>
          </Riadok>
          <div className="farba-volba">
            <label>
              <input type="radio" checked={k.farba === null} onChange={() => nastav("farba", null)} /> Podľa kategórie{" "}
              <span className="farba-vzorka" style={{ background: farbaKarty({ ...k, farba: null }, vzhlad.kategorie) }} />
            </label>
            <label>
              <input type="radio" checked={k.farba !== null} onChange={() => nastav("farba", farba)} /> Vlastná farba
            </label>
            {k.farba !== null && (
              <span className="farba-vlastna">
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={odtienZHex(k.farba)}
                  onChange={(e) => nastav("farba", pastelHex(Number(e.target.value)))}
                  className="duha"
                  aria-label="Odtieň (pastel)"
                />
                <input type="color" value={k.farba} onChange={(e) => nastav("farba", e.target.value)} aria-label="Presná farba" />
              </span>
            )}
          </div>
        </section>

        <section className="panel">
          <h3>Rozmer a tlač</h3>
          <div className="mriezka-poli">
            <Pole label="Šírka (mm)">
              <input type="number" min={20} max={200} step={0.5} value={k.sirkaMm} onChange={(e) => nastav("sirkaMm", Number(e.target.value))} />
            </Pole>
            <Pole label="Výška (mm)">
              <input type="number" min={20} max={300} step={0.5} value={k.vyskaMm} onChange={(e) => nastav("vyskaMm", Number(e.target.value))} />
            </Pole>
            <Pole label={`Mierka textu ${k.mierkaTextu.toFixed(2)}×`}>
              <input type="range" min={0.6} max={1.8} step={0.02} value={k.mierkaTextu} onChange={(e) => nastav("mierkaTextu", Number(e.target.value))} />
            </Pole>
            <Pole label={`Mierka ikon ${k.mierkaIkon.toFixed(2)}×`}>
              <input type="range" min={0.5} max={1.8} step={0.02} value={k.mierkaIkon} onChange={(e) => nastav("mierkaIkon", Number(e.target.value))} />
            </Pole>
            <Pole label="Kópie každej permutácie" pomoc={`Vytlačí sa ${varianty.pocet * k.kopie} kariet.`}>
              <input type="number" min={1} max={1000} value={k.kopie} onChange={(e) => nastav("kopie", Math.max(1, Math.round(Number(e.target.value))))} />
            </Pole>
          </div>
        </section>

        <section className="panel strany">
          <StranaEditor nazov="Ľavá strana" strana={k.lava} nastav={(s) => nastav("lava", s)} akcie={vzhlad.akcie} farba={farba} />
          <StranaEditor nazov="Pravá strana" strana={k.prava} nastav={(s) => nastav("prava", s)} akcie={vzhlad.akcie} farba={farba} />
        </section>
      </div>

      <aside className="tvorca-nahlad">
        <div className="tvorca-nahlad-karta">
          {roz !== null ? (
            <KartaLico karta={k} lava={roz.lava} prava={roz.prava} vzhlad={vzhlad} sirka={320} />
          ) : (
            <div className="navrh-chybny" style={{ width: 320 }}>
              žiadne platné rozloženie
            </div>
          )}
        </div>
        <div className="glosar-varianty" style={{ justifyContent: "center", display: "flex" }}>
          <button className="tlacidlo-male" onClick={() => setV((v - 1 + varianty.pocet) % Math.max(1, varianty.pocet))} disabled={varianty.pocet <= 1}>
            ‹
          </button>
          variant {varianty.pocet === 0 ? 0 : (v % varianty.pocet) + 1} / {varianty.pocet}
          <button className="tlacidlo-male" onClick={() => setV((v + 1) % Math.max(1, varianty.pocet))} disabled={varianty.pocet <= 1}>
            ›
          </button>
        </div>
        {varianty.pocet > 1 && (
          <div className="tvorca-varianty">
            {Array.from({ length: Math.min(varianty.pocet, 60) }, (_, i) => {
              const r = variant(varianty, i);
              return r === null ? null : (
                <KartaLico
                  key={i}
                  karta={k}
                  lava={r.lava}
                  prava={r.prava}
                  vzhlad={vzhlad}
                  sirka={74}
                  bezPopisov
                  vybrana={i === v % varianty.pocet}
                  onClick={() => setV(i)}
                />
              );
            })}
            {varianty.pocet > 60 && <span className="tlmene">… a ďalších {varianty.pocet - 60}</span>}
          </div>
        )}
      </aside>

      {vyberObrazka && <VyberObrazka nazov={k.nazov || "karta"} zavri={() => setVyberObrazka(false)} vyber={(o) => nastav("obrazok", o)} />}
    </div>
  );
}
