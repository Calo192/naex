// Nápovedy majstra Melichara v partii (Michal 2026-10-24, roadmapa #85 a #14).
// Krátka výučba učí jedno kolo; keď sa hráč v partii prvýkrát ocitne v situácii,
// ktorej ešte nečelil, Melichar ju povie bublinou. Platí v každej partii (bot aj
// ľudia), každá nápoveda raz za účet, v profile sa dajú vypnúť a ukázať znova.
//
// Situáciu rozpoznáva jadro (napovedy.ts) z pohľadu hráča — z toho istého, čo
// klient kreslí, takže nápoveda nič neprezradí. Melichar ju povie v bare (MelicharBar);
// nestmavuje stôl a hru neblokuje: zavrie ju „rozumiem“ alebo Esc. Kým beží Počítadlo bitky, pečiatka
// momentu či ťah súpera, nápoveda počká.
// Ukážka na snímky a UI inšpekciu: /hra?ukazka-napovedy=<id> (neuloží sa ako videná).

import { useCallback, useEffect, useRef, useState } from "react";
import katalogJson from "@naex/core/data/vyucba/napovedy.json";
import type { ClientState, Event, GameData, KatalogNapoved, Napoveda } from "@naex/core";
import { dalsiaNapoveda, napovedy } from "@naex/core";
import { api } from "../lib/api.ts";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import type { Sada } from "@naex/tvorba";
import { rezimMelichara } from "./bar.ts";
import { CisloStrany, MelicharVBare, NaJednomMieste, StrankovanaVeta, kusyVety, useStrany } from "./MelicharBar.tsx";
import { prvkyKluca } from "./Vyucba.tsx";
import "./vyucba.css";

const katalog = katalogJson as unknown as KatalogNapoved;

/** Bez účtu (alebo keď server neodpovedá) sa videné pamätajú v prehliadači. */
const KLUC_VIDENE = "naex.napovedy.videne";
const KLUC_VYPNUTE = "naex.napovedy.vypnute";
/** Pečiatka momentu s hláškou Melichara je na stole ~3 s (Momenty.tsx) — nápoveda počká. */
const MOMENT_MS = 3_500;
/** Ako dlho musí byť pokoj (žiadny ťah súpera, Počítadlo ani moment), kým sa bublina ukáže. */
const POKOJ_MS = 600;

function videneVPrehliadaci(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KLUC_VIDENE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ulozVPrehliadaci(id: string): void {
  const v = videneVPrehliadaci();
  if (!v.includes(id)) localStorage.setItem(KLUC_VIDENE, JSON.stringify([...v, id]));
}

/** Zapnuté nápovedy a videné id — pri účte na serveri, bez účtu v prehliadači. */
export function useNapovedyUctu(): {
  readonly zapnute: boolean;
  readonly videne: ReadonlySet<string> | null;
  readonly oznac: (id: string) => void;
  readonly vypni: () => void;
} {
  const { ja, nastav } = useUcet();
  const prihlaseny = ja !== null;
  const [videne, setVidene] = useState<ReadonlySet<string> | null>(null);
  const [vypnuteBezUctu, setVypnuteBezUctu] = useState(() => localStorage.getItem(KLUC_VYPNUTE) === "1");
  useEffect(() => {
    if (!prihlaseny) {
      setVidene(new Set(videneVPrehliadaci()));
      return;
    }
    let zive = true;
    api
      .get<{ videne: string[] }>("/napovedy")
      .then((r) => zive && setVidene(new Set(r.videne)))
      .catch(() => zive && setVidene(new Set(videneVPrehliadaci())));
    return () => {
      zive = false;
    };
  }, [prihlaseny]);
  const oznac = useCallback(
    (id: string) => {
      setVidene((v) => new Set([...(v ?? []), id]));
      if (prihlaseny) void api.post("/napovedy/videna", { id }).catch(() => ulozVPrehliadaci(id));
      else ulozVPrehliadaci(id);
    },
    [prihlaseny],
  );
  const vypni = useCallback(() => {
    if (!prihlaseny) {
      localStorage.setItem(KLUC_VYPNUTE, "1");
      setVypnuteBezUctu(true);
      return;
    }
    void api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { napovedy: false })
      .then((r) => nastav(r.pouzivatel))
      .catch(() => undefined);
  }, [prihlaseny, nastav]);
  return { zapnute: prihlaseny ? ja.napovedy !== false : !vypnuteBezUctu, videne, oznac, vypni };
}

/** Ukážka z adresy (?ukazka-napovedy=id): text z pohľadu, ak situácia platí, inak prvý variant. */
function ukazkaZAdresy(data: GameData, view: ClientState): Napoveda | null {
  const id = new URLSearchParams(location.search).get("ukazka-napovedy");
  const def = katalog.napovedy.find((n) => n.id === id);
  if (def === undefined) return null;
  const zive = napovedy(data, katalog, view).find((n) => n.id === def.id);
  if (zive !== undefined) return zive;
  const text = typeof def.melichar === "string" ? def.melichar : (Object.values(def.melichar)[0] ?? "");
  return { id: def.id, poradie: def.poradie, text, zvyraznit: def.zvyraznit.filter((k) => !k.includes("{")) };
}

/** Jemný rámik na prvkoch, o ktorých nápoveda hovorí — bez stmavenia stola. */
function useRamik(kluce: readonly string[] | null): void {
  const sig = kluce?.join("|") ?? "";
  useEffect(() => {
    if (sig === "") return;
    const zoznam = sig.split("|");
    const oznac = (): void => {
      const najdene = new Set(zoznam.flatMap((k) => prvkyKluca(k)));
      for (const el of document.querySelectorAll<HTMLElement>("[data-napoveda-zvyraznene]")) if (!najdene.has(el)) el.removeAttribute("data-napoveda-zvyraznene");
      for (const el of najdene) el.setAttribute("data-napoveda-zvyraznene", "");
    };
    oznac();
    const t = setInterval(oznac, 500);
    return () => {
      clearInterval(t);
      for (const el of document.querySelectorAll<HTMLElement>("[data-napoveda-zvyraznene]")) el.removeAttribute("data-napoveda-zvyraznene");
    };
  }, [sig]);
}

export function NapovedaMelichara({
  data,
  view,
  udalosti,
  pocitadloBezi,
  sada,
}: {
  readonly data: GameData;
  readonly view: ClientState;
  readonly udalosti: { readonly id: number; readonly events: readonly Event[] };
  readonly pocitadloBezi: boolean;
  readonly sada: Sada | null;
}) {
  const { zapnute, videne, oznac, vypni } = useNapovedyUctu();
  const [cakajuca, setCakajuca] = useState<Napoveda | null>(null);
  const [ukazana, setUkazana] = useState<Napoveda | null>(() => ukazkaZAdresy(data, view));
  const ukazka = useRef(ukazana !== null);

  // Pečiatka momentu s hláškou Melichara — nápoveda počká, nech nehovorí cez neho.
  const [moment, setMoment] = useState(false);
  useEffect(() => {
    if (!udalosti.events.some((e) => e.type === "moment")) return;
    setMoment(true);
    const t = setTimeout(() => setMoment(false), MOMENT_MS);
    return () => clearTimeout(t);
  }, [udalosti]);

  // Situácia sa zachytí hneď (bot ťahá rýchlo — voľba cieľa trvá chvíľu), ukáže sa, keď je pokoj.
  useEffect(() => {
    if (!zapnute || videne === null || cakajuca !== null || ukazana !== null) return;
    const n = dalsiaNapoveda(data, katalog, view, videne);
    if (n !== null) setCakajuca(n);
  }, [data, view, zapnute, videne, cakajuca, ukazana]);

  const superNaTahu = view.naTahu !== null && view.naTahu !== view.ja;
  const caka = pocitadloBezi || moment || superNaTahu;
  useEffect(() => {
    if (cakajuca === null || ukazana !== null || caka) return;
    // Chvíľa pokoja: bublina nevyskočí uprostred rýchlych ťahov a pri vstupe do výučby
    // (krok výučby príde správou hneď po stave) sa komponent odpojí skôr, než ju ukáže.
    const t = setTimeout(() => {
      setCakajuca(null);
      setUkazana(cakajuca);
      // Videná je už ukázaná — „raz“ platí, aj keď ju hráč nezavrie (odíde, obnoví stránku).
      oznac(cakajuca.id);
    }, POKOJ_MS);
    return () => clearTimeout(t);
  }, [cakajuca, ukazana, caka, oznac]);

  useEffect(() => {
    if (!zapnute && !ukazka.current) {
      setCakajuca(null);
      setUkazana(null);
    }
  }, [zapnute]);
  useEffect(() => {
    if (view.koniec !== null) setUkazana(null);
  }, [view.koniec]);

  const zavri = useCallback(() => setUkazana(null), []);

  // Esc zavrie najprv bublinu (capture) — návrh ťahu na stole ostane.
  const viditelna = ukazana !== null;
  useEffect(() => {
    if (!viditelna) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      zavri();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, [viditelna, zavri]);

  useRamik(viditelna ? (ukazana?.zvyraznit ?? null) : null);
  // Dlhšia nápoveda ide na strany s „ďalej“ — bar sa nerozbalí ani nescrolluje (Michal 2026-10-25).
  const strany = useStrany(ukazana === null ? "" : `${ukazana.id}|${ukazana.text}`);

  if (ukazana === null) return null;
  // Nápoveda hovorí v bare (Michal 2026-10-25) — nič na stole nezakryje, hru neblokuje.
  return (
    <MelicharVBare
      rezim={rezimMelichara(ukazana.zvyraznit)}
      trieda="napoveda-bublina"
      atributy={{ "data-napoveda": ukazana.id }}
      pocitadlo={<CisloStrany strany={strany} />}
      vpravo={
        <>
          {strany.strana > 0 && (
            <button type="button" className="tlacidlo-jemne mel-spat" onClick={strany.predosla} title="Predošlá strana textu" aria-label="Predošlá strana textu">
              ‹
            </button>
          )}
          {/* „ďalej“ aj „rozumiem“ na jednom mieste — šírka vety sa so stranou nemení, strany sa neprepínajú dookola. */}
          <NaJednomMieste
            ukaz={strany.dalsiaJe ? "a" : "b"}
            a={(ziva) => (
              <button type="button" className="tlacidlo-hlavne mel-dalej" tabIndex={ziva ? undefined : -1} onClick={ziva ? strany.dalsia : undefined} title="Ďalšia strana nápovedy">
                ďalej
              </button>
            )}
            b={(ziva) => (
              <button type="button" className="tlacidlo-hlavne mel-dalej" tabIndex={ziva ? undefined : -1} onClick={ziva ? zavri : undefined} title="Nápoveda zmizne (aj Esc).">
                rozumiem
              </button>
            )}
          />
          <button
            type="button"
            className="tlacidlo-jemne napoveda-vypnut"
            onClick={() => {
              vypni();
              zavri();
            }}
            title="Nápovedy zapneš znova v profile."
          >
            vypnúť nápovedy
          </button>
        </>
      }
    >
      <div className="napoveda-text" aria-live="polite">
        <StrankovanaVeta kusy={kusyVety(ukazana.id, ukazana.text, sada)} podpis={`${ukazana.id}|${ukazana.text}`} strany={strany} />
      </div>
    </MelicharVBare>
  );
}
