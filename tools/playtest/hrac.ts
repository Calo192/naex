// Konzolový klient pre playtesterov — hrá cez skutočný server ako prehliadač.
//
// Vidí presne to, čo server pošle danému hráčovi (viewFor): súperovu ruku
// ani poradie balíčkov nie. Posiela zámery (príkazy), výsledky počíta server.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/hrac.ts <relacia> <1|2> stav
//   node ... hrac.ts <relacia> <1|2> cakaj [sekundy]     počká, kým si na ťahu (alebo koniec)
//   node ... hrac.ts <relacia> <1|2> tah '<json príkazu>'
//   node ... hrac.ts <relacia> <1|2> karty               verejný zoznam kariet sady
//
// Kódy ukončenia: 0 = ok, 1 = chyba (aj odmietnutý ťah), 2 = vypršal čas čakania.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import type { ActionSums, CardInstance, CenyKliatob, ClientState, DopadyNahladu, Command, ElderState, Event, GameData, PlacedCard, PlayerId, Pohlavie, Rod, Slot, VerejnyStav } from "@naex/core";
import {
  naexZaPitku,
  stavZavislosti,
  textNeresti,
  jeCoTahat,
  cigaretyZaPas,
  KONSTANTY,
  cakaSBzdochou,
  hraVPitke,
  jeFinaleNaNastenke,
  STAV_STARSIEHO,
  poveraMozna,
  klebetyKola,
  ucinnaPriazen,
  STUPNICA_ZONY,
  cigariet,
  spakov,
  battleOutcome,
  nahladPokusu,
  pokusMozny,
  ponukaKseftuVazna,
  stavKseftuVaznaZPohladu,
  spakyTeraz,
  pohorsenieMozne,
  cenaKliatby,
  rozlozRod,
  nahladNaexNaKartu,
  najhorsiaOdpovedNaNaex,
  dopadyNahladu,
  stavPoPokuse,
  nahladPitky,
  sMojimiSkrytymiNaex,
  favourStarsieho,
  krokStavby,
  cieleVykladania,
  cielLokalitaId,
  evaluateLine,
  hrozbaNaex,
  bitkaPoPohorseni,
  nepridelenePohorsenia,
  rozsahPohorseni,
  barterCena,
  limitBuduceKolo,
  limitZhromazdenia,
  lineState,
  loadGameData,
  nahladPosunuMarkera,
  nahladPosunuPrebytkom,
  dovodZakazuFajcit,
  jednotaZakazuje,
  efektHraca,
  efektPotlaceny,
  cenaFajceniaHraca,
  zakazVypit,
  nahladVylozenia,
  moznostiNaexVPohlade,
  naexLimitMinuty,
  obavanyHrac,
  posunMarker,
  posunZaBody,
  telefonHraca,
  bodyNaPohorsenie,
  hrozbaKliatob,
  mozeEsteNaex,
  textHrozbyKliatob,
  priazen,
  poskodenieBitky,
  prahyHraca,
  printedSides,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
  stranyLokality,
  stolPriPoskodeni,
  dalsiePitkyKola,
  strachNaVyplatu,
  krajeStran,
  prevahaStran,
  vydesil,
  vidiVolbuSupera,
  zablokovaneStrany,
} from "@naex/core";
import { bzdochaText, prehraNaexText, prehraText, starsiNaNakladacku, stavkaText, superoveSkryteNaex, sVidenymiSkrytymiNaex } from "./texty-hraca.ts";

interface Relacia {
  /** Server dočasnej partie (playtest dvoch agentov). */
  readonly port?: number;
  /** Alebo skutočný web (agent proti človeku) — napr. http://localhost:8787. */
  readonly url?: string;
  readonly kod: string;
  readonly hraci: readonly { readonly login: string; readonly heslo: string; readonly meno: string }[];
}

interface Sada {
  readonly cardsJson: unknown;
  readonly scorecardsJson?: unknown;
}

const [relaciaDir, hracArg, prikaz, arg] = process.argv.slice(2);
if (relaciaDir === undefined || (hracArg !== "1" && hracArg !== "2") || prikaz === undefined) {
  console.error("Použitie: hrac.ts <relacia> <1|2> <stav|cakaj|tah|karty> [argument]");
  process.exit(1);
}
const relacia = JSON.parse(readFileSync(join(relaciaDir, "hra.json"), "utf8")) as Relacia;
const zaklad = (relacia.url ?? `http://localhost:${relacia.port ?? 8787}`).replace(/\/+$/, "");
const ucetHraca = relacia.hraci[Number(hracArg) - 1];
if (ucetHraca === undefined) throw new Error("Neznámy hráč.");
const ucet = ucetHraca;
const mojDir = join(relaciaDir, `hrac${hracArg}`);
mkdirSync(mojDir, { recursive: true });
const eldersJson = JSON.parse(readFileSync("packages/core/data/elders.json", "utf8")) as unknown;

/** Akuzatív — „dober 1 kartu“, „2 karty“, „5 kariet“. */
function kariet(n: number): string {
  return n === 1 ? "1 kartu" : n >= 2 && n <= 4 ? `${n} karty` : `${n} kariet`;
}

/** Nominatív — „súperov balíček: 1 karta / 3 karty / 5 kariet“. */
function kartyNom(n: number): string {
  return n === 1 ? "1 karta" : n >= 2 && n <= 4 ? `${n} karty` : `${n} kariet`;
}

function zapis(text: string): void {
  appendFileSync(join(mojDir, "priebeh.log"), `[${new Date().toISOString()}] ${text}\n`);
}

// ---- spojenie -----------------------------------------------------------------

interface Spojenie {
  readonly ws: WebSocket;
  readonly sada: Sada;
  /** null = partia ešte nezačala, súper sa nepripojil. */
  view: ClientState | null;
  mena: string[];
  /** História udalostí miestnosti z pripojenia (server ju posiela pri každom návrate). */
  historia: Event[];
  /** Ďalšia správa zo servera (state, error, alebo zatvorené spojenie). */
  dalsia(timeoutMs: number): Promise<Sprava | null>;
}

type Sprava =
  | { typ: "state"; view: ClientState; events: Event[] }
  | { typ: "error"; text: string }
  // Snímka (tools/playtest/snimka.ts) otvára partiu v prehliadači za toho istého hráča a server
  // mu na chvíľu odovzdá miesto — čakanie sa vtedy pripojí znova.
  | { typ: "zatvorene" };

async function pripoj(): Promise<Spojenie> {
  const r = await fetch(`${zaklad}/api/prihlasenie`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-naex": "1" },
    body: JSON.stringify({ login: ucet.login, heslo: ucet.heslo }),
  });
  if (!r.ok) throw new Error(`Prihlásenie zlyhalo: ${await r.text()}`);
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const ws = new WebSocket(`${zaklad.replace(/^http/, "ws")}/ws`, { headers: { cookie } });
  const fronta: Sprava[] = [];
  let cakatel: (() => void) | null = null;
  let sada: Sada | null = null;
  let zacata = true;
  const mena = ["Hráč 1", "Hráč 2"];
  const historia: Event[] = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as { type: string; [k: string]: unknown };
    if (m.type === "historia") historia.splice(0, historia.length, ...(m.events as Event[]));
    if (m.type === "privitanie") {
      sada = m.sada as Sada;
      zacata = m.started === true;
    }
    if (m.type === "hraci") {
      const h = m.hraci as ({ meno: string; bot?: boolean; pohlavie?: Pohlavie | null } | null)[];
      h.forEach((x, i) => x !== null && (mena[i] = x.meno));
      // Tvary hlášok podľa rodu hráčov (Michal 2026-10-22) — motor ich značí {N:muž|žena|neutrálne}.
      h.forEach((x, i) => (rodyHracov[i] = x?.bot === true ? "bot" : (x?.pohlavie ?? null)));
    }
    if (m.type === "state") fronta.push({ typ: "state", view: m.view as ClientState, events: m.events as Event[] });
    if (m.type === "error") fronta.push({ typ: "error", text: String(m.text) });
    cakatel?.();
  });
  ws.on("close", () => {
    fronta.push({ typ: "zatvorene" });
    cakatel?.();
  });
  await new Promise<void>((ok, zle) => {
    ws.on("open", () => ok());
    ws.on("error", zle);
  });
  ws.send(JSON.stringify({ type: "rejoin", code: relacia.kod }));
  const dalsia: Spojenie["dalsia"] = async (timeoutMs) => {
    const koniec = Date.now() + timeoutMs;
    while (fronta.length === 0) {
      const zostava = koniec - Date.now();
      if (zostava <= 0) return null;
      await new Promise<void>((ok) => {
        cakatel = ok;
        setTimeout(ok, Math.min(zostava, 1000));
      });
      cakatel = null;
    }
    return fronta.shift() ?? null;
  };
  // Kým sa súper nepripojí, stav partie nepríde — stačí privítanie so sadou.
  const koniec = Date.now() + 10_000;
  while (sada === null && fronta.length === 0 && Date.now() < koniec) await new Promise((ok) => setTimeout(ok, 100));
  if (fronta[0]?.typ === "error") throw new Error(fronta[0].text);
  if (sada === null) throw new Error("Server neposlal privítanie.");
  if (!zacata && fronta.length === 0) return { ws, sada, view: null, mena, historia, dalsia };
  const prva = await dalsia(10_000);
  if (prva === null) throw new Error("Server neposlal stav partie.");
  if (prva.typ === "error") throw new Error(prva.text);
  if (prva.typ === "zatvorene") throw new Error("Server zatvoril spojenie.");
  return { ws, sada, view: prva.view, mena, historia, dalsia };
}

// ---- vykreslenie stavu ----------------------------------------------------------

let DATA: GameData;
const meno = (defId: string): string => DATA.cards.get(defId)?.name ?? defId;

function strany(karta: CardInstance): { left: string[]; right: string[] } {
  const s = printedSides(DATA, karta);
  const f = (a: readonly (string | null)[]) => a.map((x) => x ?? "—");
  return { left: f(s.left), right: f(s.right) };
}

function popisKarty(k: CardInstance): string {
  const def = DATA.cards.get(k.defId);
  const s = strany(k);
  return `#${k.uid} ${meno(k.defId)} [${def?.tags.join(", ") ?? ""}] — ${def?.effectText ?? ""}\n      ľavá strana (zhora): ${s.left.join(", ")} | pravá strana: ${s.right.join(", ")}`;
}

const ZNAK = { aktivna: "✓", zrusena: "✗", neaktivna: "·" } as const;

/** Strach za stupne z jadra (strachNaVyplatu, v8.3 udržané): marker 2/1/0 sa bojí hráča 2, stupeň po stupni a spolu zo stredu. */
const zonaStrachu = (m: 0 | 1 | 2): number => strachNaVyplatu({ marker: m, vyplatene: STUPNICA_ZONY[m] - 1, drzane: STUPNICA_ZONY[m] }, 1);
const ZONY_STRACHU = `žltá ${zonaStrachu(2)}, oranžová ${zonaStrachu(1)}, červená ${zonaStrachu(0)}; zo stredu na červenú spolu ${strachNaVyplatu({ marker: 0, drzane: 3 }, 1)}`;

/** Karta v línii z pohľadu hráča: efektívne strany (otočená = vymenené a obrátené). */
function kartaVLinii(
  k: CardInstance,
  otocena: boolean,
  ev: ReturnType<typeof evaluateLine>,
  poznamka: string,
  popisHran: readonly [string, string],
): string {
  const p = printedSides(DATA, k);
  const e = ev.cards.get(k.uid);
  const strana = (vlastna: "left" | "right"): string => {
    const ps = otocena ? (vlastna === "left" ? "right" : "left") : vlastna;
    return [0, 1, 2, 3]
      .map((i) => {
        const idx = otocena ? 3 - i : i;
        const a = p[ps][idx as 0 | 1 | 2 | 3];
        if (a === null || a === undefined) return "—";
        const st = e?.[ps][idx];
        return st === null || st === undefined ? a : `${a}${ZNAK[st.stav]}${st.nasobok > 1 ? `×${st.nasobok}` : ""}`;
      })
      .join(", ");
  };
  return `  #${k.uid} ${meno(k.defId)}${otocena ? " (otočená k tebe nohami hore)" : ""}${poznamka}${e?.vzbura === true ? " VZBURA" : ""}\n      ${popisHran[0]}: ${strana("left")}\n      ${popisHran[1]}: ${strana("right")}`;
}

/**
 * Výhľad Pitky hráča p (Michal 2026-10-21): pečeň a zadĺženie „po Pitke“ —
 * ten istý výpočet ako vyhodnotenie (nahladPitky). Mimo Zhromaždenia a Pitky null.
 */
function vyhladPitkyText(v: ClientState, p: PlayerId): string | null {
  if (v.ciel === null || (v.faza !== "zhromazdenie" && v.faza !== "pitka")) return null;
  const n = nahladPitky(DATA, { ...v, hraci: v.hraci })[p];
  const cC = cenaKliatby(DATA, v, p, "cirhoza");
  const cD = cenaKliatby(DATA, v, p, "dlh");
  const kedy = v.faza === "pitka" ? "po Pitke" : "v najbližšej Pitke";
  const kliatby: string[] = [];
  if (n.cirhozy > 0) kliatby.push(`Cirhóza ×${n.cirhozy} (nepriznaná na konci ${spakov(n.cirhozy * cC)})`);
  if (n.dlhy > 0) kliatby.push(`Dlh ×${n.dlhy}${cD !== 0 ? ` (${spakov(n.dlhy * cD)})` : " (k Exekútorovi)"}`);
  return `pečeň ${n.pecen} ▸ ${n.pecen + n.pecenZoStola}/${n.prahPecene}, zadĺženie ${n.zadlzenie} ▸ ${n.zadlzenie + n.zadlzenieZoStola}/${n.prahDlhu} → ${kedy}: ${kliatby.length > 0 ? kliatby.join(", ") : "žiadna kliatba"} (karty na stole pripíšu pečeň ${n.pecenZoStola}, zadĺženie ${n.zadlzenieZoStola}; za každý celý prah jedna kliatba)`;
}

/**
 * Zvyšok ceny ťahu ako na webe (návrh #1, playtest 20261024-075830): cigarety
 * z Pitiek kola, Pohoršenia v najbližšej bitke s ≈ bodmi a mäkké. Prázdny
 * reťazec, keď sa nič z toho nemení.
 */
function dopadyText(d: readonly [DopadyNahladu, DopadyNahladu], ja: PlayerId): string {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const znak = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
  const kto = (p: PlayerId): string => (p === ja ? "ty" : "súper");
  const casti: string[] = [];
  const cig = [ja, su].filter((p) => d[p].cigarety !== 0).map((p) => `${kto(p)} ${znak(d[p].cigarety)}`);
  if (cig.length > 0) casti.push(`cigarety: ${cig.join(", ")}`);
  const poh = [ja, su]
    .filter((p) => d[p].pohorsenia !== 0)
    .map((p) => {
      const n = d[p].pohorsenia;
      const spolu = d[p].pohorseniaSpolu !== n ? `spolu ${d[p].pohorseniaSpolu}; ` : "";
      return `${kto(p)} ${znak(n)} ${Math.abs(n) === 1 ? "posun" : Math.abs(n) <= 4 ? "posuny" : "posunov"} markera (${spolu}≈ ${znak(d[p].pohorseniaBody)} špakov do konca ${p === ja ? "pre teba voči súperovi" : "pre súpera voči tebe"}, ak ich dá najvýhodnejšie)`;
    });
  if (poh.length > 0) casti.push(`Pohoršenia v bitke: ${poh.join(", ")}`);
  const makke = [ja, su].filter((p) => d[p].makke !== 0).map((p) => `${kto(p)} ${znak(d[p].makke)}`);
  if (makke.length > 0) casti.push(`mäkké poškodenie v bitke (od v8.3 vždy 0): ${makke.join(", ")}`);
  return casti.length === 0 ? "" : `; ${casti.join("; ")}`;
}

/** Cena NA EX na kartu uid pre oboch — ten istý náhľad ako na webe (nahladNaexNaKartu, návrh #49). */
function cenaNaexText(v: ClientState, uid: number): string {
  const ja = v.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const ceny = ([0, 1] as const).map((p) => ({ cirhoza: cenaKliatby(DATA, v, p, "cirhoza"), dlh: cenaKliatby(DATA, v, p, "dlh") })) as [CenyKliatob, CenyKliatob];
  const n = nahladNaexNaKartu(DATA, v, uid, ceny);
  if (n === null) return "";
  const pre = (p: PlayerId): string => {
    const k = n.kliatby[p];
    const c = k.cirhozy + k.dalejCirhozy;
    const d = k.dlhy + k.dalejDlhy;
    if (c === 0 && d === 0) return "nič";
    const poBitke = d !== k.dlhyPoBitke ? ` → po bitke ${k.dlhyPoBitke} (Robota či Dievčina na vydaj spáli)` : "";
    return `${c !== 0 ? `Cirhóza ${c > 0 ? "+" : "−"}${Math.abs(c)} (nepriznaná na konci −${spakov(KONSTANTY.SPAKY_ZA_CIRHOZU)}; priznaná nič, ale súper za ňu +1 tuhé v každej bitke) ` : ""}${d !== 0 ? `Dlh ${d > 0 ? "+" : "−"}${Math.abs(d)}${poBitke} ` : ""}(${k.body < 0 ? "−" : "+"}${Math.abs(k.body)} špakov)`;
  };
  const dopady = dopadyText(n.dopady, ja);
  const o = n.odkrytie;
  const prebytok = (x: typeof n.prebytokPo): string =>
    x.drzi === null || x.prebytok === 0
      ? "žiadny"
      : `${x.drzi === ja ? "tvoj" : "súperov"} ${x.prebytok}${x.naRozdelenie !== x.prebytok ? ` (Puška −${x.prebytok - x.naRozdelenie})` : ""}${x.cenaPosunu > 1 ? ` (posun za ${x.cenaPosunu}, Miňištrant)` : ""}`;
  const navyse = [
    o.svokra > 0 ? `Svokra súpera: za toto NA EX na jeho kartu ti v bitke udelí ${o.svokra === 1 ? "Ranu" : `${o.svokra} Rany`} (v tuhom už je)` : "",
    o.kar ? "Kar: pečeň za toto NA EX dostane súper, nie ty" : "",
    o.doDna ? "Na zdravie: poldeci sa ti po bitke vráti plný" : "",
  ].filter((x) => x !== "");
  // Najhoršia verejne možná odpoveď (playtest 20261026-173610-3 N5) a limit po NA EX na túto kartu (akcie Poldeci).
  const odp = najhorsiaOdpovedNaNaex(DATA, v, n);
  const odpoved =
    odp === null
      ? ""
      : `, po najhoršej možnej odpovedi súpera až ${odp.damage.tuhe[ja]}:${odp.damage.tuhe[su]} (napr. ${meno(odp.karta.defId)} na koniec ${odp.strana === ja ? "tvojej" : "jeho"} strany; jeho ruku nevidíš)`;
  const limitPo = limitBuduceKolo(n.odkrytie.view, ja, false, DATA);
  const limitBez = limitBuduceKolo(sMojimiSkrytymiNaex(DATA, v), ja, false, DATA);
  const limit = `; v ďalšom kole limit ${limitPo === limitBez ? `ostane ${limitBez}` : `${limitPo} namiesto ${limitBez}`}`;
  // Efekty Prehra (Dievčina na vydaj) náhľad jadra nemodeluje — playtest 20261028-090549-2, Eva.
  const prehra = prehraNaexText(DATA, sVidenymiSkrytymiNaex(DATA, v), sVidenymiSkrytymiNaex(DATA, n.odkrytie.view), uid);
  return `; bitka (tuhé) ${n.pred.tuhe[ja]}:${n.pred.tuhe[su]} → ${n.po.tuhe[ja]}:${n.po.tuhe[su]}${odpoved}${limit}, Nakladačka ${prebytok(n.prebytokPred)} → ${prebytok(n.prebytokPo)}; kliatby z tejto a ďalších Pitiek kola (NA EX leží do bitky): ty ${pre(ja)}, súper ${pre(su)}${dopady}${prehra}${navyse.length > 0 ? `; ${navyse.join("; ")}` : ""}; súper má v ruke ${kariet(v.hraci[su].rukaPocet)} a smie odpovedať jednou`;
}

function vykresli(v: ClientState, mena: readonly string[]): string {
  const ja = v.ja;
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const out: string[] = [];
  const kto = (p: PlayerId | null) => (p === null ? "nikto" : p === ja ? "TY" : mena[p] ?? `Hráč ${p + 1}`);
  out.push(
    `=== Kolo ${v.kolo}, fáza ${v.faza}${v.faza === "pitka" ? ` ${v.pitkaCislo}/${v.pitkyCelkom}` : ""}${v.faza === "zhromazdenie" ? ` (pred Pitkou ${v.pitkaCislo + 1}/${v.pitkyCelkom})` : ""}${v.vizia !== null ? " (VÍZIA)" : ""}${v.hasicVolba !== null ? " (HASIČ)" : ""}${v.bitkaStav?.krok ? ` (krok ${v.bitkaStav.krok})` : ""} — na ťahu: ${v.draftStav?.krok === "stavba" ? "obaja naraz (stavba šenku)" : kto(v.naTahu)} ===`,
  );
  if (v.koniec !== null) {
    out.push(`KONIEC HRY: vyhral ${kto(v.koniec.vitaz)}. ${rozlozRod(v.koniec.dovod, rodyHracov)}${v.koniec.body ? ` Špaky: ty ${v.koniec.body[ja]}, súper ${v.koniec.body[su]}.` : ""}`);
  }
  out.push(
    `Ty si ${mena[ja]} (${v.utocnik === ja ? "útočník — zo šenku berieš prvý a vykladáš prvý" : "obranca — vyberáš a natáčaš cieľ kola, zo šenku berieš aj vykladáš druhý"}), súper ${mena[su]}. Hrá sa o ${v.lokalitCelkom} ${v.lokalitCelkom <= 4 ? "lokality" : "lokalít"} a potom FINÁLE${v.rozpis !== undefined ? ` (úrovne lokalít po kolách ${v.rozpis.map((u) => (u === 4 ? "P" : String(u))).join(" · ")}; úroveň = počet akcií na hrane lokality; obranca vyberá zo všetkých neodohraných lokalít úrovne kola; finále je bitka o pinnacle lokalitu ako o každú inú, vyberá a natáča ju obranca — vedúci; útočí zaostávajúci (menej špakov, pri rovnosti porazený poslednej bitky); Pitky podľa spojov s lokalitou, 1–5)` : ""}${v.ciel?.typ === "finale" ? " — TERAZ JE FINÁLE na pinnacle lokalite" : ""}; odohraných bitiek ${v.nastenka.length}. ŠPAKY (víťazné body): ty ${v.spaky[ja]}, súper ${v.spaky[su]}${v.spakyNaSekere > 0 ? `, na sekere ${v.spakyNaSekere}` : ""}. Limit ruky nie je; po každej bitke si každý dobere ${kariet(KONSTANTY.KARTY_PO_BITKE)}. Ďalší Nástroj do Dedičstva stojí ${v.cenaDedicstva} cig. (cena rastie pre oboch). Pitiek v bitke = 1 + menší počet aktivovaných akcií karty v strede (z dvoch strán).`,
  );

  // Stôl po prípadnom vyhodnotení — rovnako ako klient. V strede leží lokalita.
  // Moje skryté NA EX sú pre mňa dané: stôl, odhad bitky, hrozby aj výhľad Pitky ich
  // rátajú tak, ako ich motor zúčtuje pri odkrytí — ako web (sMojimiSkrytymiNaex).
  // S Bzdochou aj súperove skryté NA EX, ktoré server poslal (playtest 20261028-090549: hrali naslepo).
  const vs = sVidenymiSkrytymiNaex(DATA, v);
  const mojeSkryteNaex = (v.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja);
  const jehoSkryteNaex = superoveSkryteNaex(v);
  const vidimCezBzdochu = v.pitkaStav !== null && vidiVolbuSupera(DATA, v, ja);
  const lineEval = evaluateLine(DATA, lineState(vs));
  // Celý verejný stôl: Šofér, Strýko, Vychovávateľka, Pasca a Vidly čítajú aj NA EX v kole, Kšefty a špaky (playtest v7 131033).
  const stol: VerejnyStav = vs;
  for (const p of [ja, su] as const) {
    const h = v.hraci[p];
    const pr = prahyHraca(DATA, stol, p);
    const poOdkryti = vs.hraci[p];
    const poSkrytom =
      p === ja && mojeSkryteNaex.length > 0
        ? ` | po odkrytí tvojho skrytého NA EX: poldeci plné ${poOdkryti.poldeciPlne}, pečeň ${poOdkryti.pecen}, cigarety ${poOdkryti.cigarety}`
        : "";
    out.push(
      `${p === ja ? "TVOJE ZDROJE" : "SÚPEROVE ZDROJE"}: poldeci plné ${h.poldeciPlne}, vypité ${h.poldeciVypite} (limit vykladania ${limitZhromazdenia(v, p)}, v ďalšom kole ${limitBuduceKolo(vs, p, false, DATA)}) | cigarety ${h.cigarety} | pečeň ${h.pecen}/${pr.cirhoza} | pečeň žije len počas Pitky, zadĺženie ${h.zadlzenie}/${pr.dlh} ostáva na účte aj do ďalšieho kola (D6) | priznané dlhy ${pr.priznaneDlhy} (Exekútor v každej bitke: zhorí polovica nahor a rovnako veľa špakov — teraz ${pr.exekucia}${pr.priznaneDlhy > 0 && pr.exekucia === 0 ? ", Záhradkár ťa obíde" : ""}; pri remíze v bitke prehráva viac Dlhov) | Absťáky ${h.abstaky} v balíčku (karty, počet verejný) | nepriznané Cirhózy ${v.nepriznaneKliatby[p].cirhoza} (verejný počet) | ruka ${h.rukaPocet}, balíček ${h.doberaciPocet}, odhodené ${h.odhadzovaci.length}${poSkrytom}`,
    );
    const vyhladP = vyhladPitkyText(vs, p);
    if (vyhladP !== null) out.push(`  VÝHĽAD PITKY: ${vyhladP}`);
    const z = stavZavislosti(DATA, { ...stol, kolo: v.kolo, hraci: v.hraci }, p);
    const vyhlad =
      v.bezChuti === true
        ? "výučba bez Chuti — Absťák nepríde"
        : z.vyhlad === "ziska"
          ? `na konci kola karta Absťák do odhadzovacieho balíčka, ak nepribudne ešte ${textNeresti(z.doBezpecia)}`
          : "Absťák nepríde";
    out.push(
      `  CHUŤ ${z.chut}${z.latka < z.chut ? ` (Opatrovateľka: porovná sa ${Math.max(0, z.latka)})` : ""} | dnes ${z.teraz}${z.naexNaStole > 0 ? ` (z toho ${z.naexNaStole} NA EX na stole, každé za ${KONSTANTY.NEREST_NAEX})` : ""}${z.doBezpecia > 0 ? ` | chýba ${z.doBezpecia}` : ""} → ${vyhlad}; Chuť po kole ${z.chutPo}. ABSŤÁK v balíčku: ${z.abstaky} (v bitke −${z.ubera} tuhé). Nerest = Vypiť 1, NA EX ${KONSTANTY.NEREST_NAEX}, každá vyfajčená cigareta 1, Kšeft väzňa 1; doliatie, barter, šenok, Dedičstvo a Kšefty lokalít nie.`,
    );
    if (h.priznane.length > 0) out.push(`  priznané: ${h.priznane.map((k) => meno(k.defId)).join(", ")}`);
    if (h.dedicstvo.length > 0) out.push(`  dedičstvo: ${h.dedicstvo.map((k) => meno(k.defId)).join(", ")}`);
  }
  if (v.draftStav !== null) {
    const d = v.draftStav;
    if (d.krok === "stavba") {
      out.push(
        `STAVBA ŠENKU (naraz): ty ${d.vybral[ja] ? "si už vybral" : "vyberáš"}, súper ${d.vybral[su] ? "už vybral" : "vyberá"}; súperov balíček: ${kartyNom(d.balicekPocet[su])} (nevidíš ho).`,
      );
      out.push(`TVOJ BALÍČEK STAVBY (${d.mojBalicek.length}; najprv Náradie, potom Občania — do šenku dáš polovicu v ľubovoľnom mixe):`);
      for (const k of d.mojBalicek) out.push(`  ${popisKarty(k)}`);
    } else {
      out.push(
        `BRANIE ZO ŠENKU (striedavo, začína útočník; na ťahu 1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu alebo 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety, poldeci sa neplatí; kto nemá cigaretu, prestane): ty ${d.noveKarty[ja]}${d.hotovo[ja] ? " (skončil si)" : ""}, súper ${d.noveKarty[su]}${d.hotovo[su] ? " (skončil)" : ""}.`,
      );
    }
  }
  if (v.zhromazdenieStav !== null) {
    const z = v.zhromazdenieStav;
    out.push(`Zhromaždenie: tebe zostáva vyložiť ${z.zostavaLimit[ja]}${z.navyse[ja] > 0 ? ` — po vypití ti ďalšia karta neukončí ťah` : ""}${z.pasoval[ja] ? " (pasoval si)" : ""}, súperovi ${z.zostavaLimit[su]}${z.pasoval[su] ? " (pasoval)" : ""}.`);
  }
  // Pitka naraz (Michal 2026-10-27): obaja hrajú súčasne, Bzdocha čaká; poradie platí len pre odpovede na NA EX.
  if (v.pitkaStav !== null && v.faza === "pitka") {
    const ps = v.pitkaStav;
    const obr: PlayerId = v.utocnik === 0 ? 1 : 0;
    // NA EX je skryté, kým neskončia obaja: naexPocet sa plní až pri odkrytí, takže
    // „bez NA EX“ pred ním klamalo (playtest 20261027-062058). O sebe hráč vie.
    const odkryte = ps.hotovy[0] && ps.hotovy[1];
    const mojeSkryte = (ps.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
    const koniec = (p: PlayerId): string =>
      odkryte
        ? (ps.naexPocet?.[p] ?? 0) > 0
          ? " (po NA EX)"
          : " bez NA EX"
        : p === ja
          ? mojeSkryte > 0
            ? " (skryto si dal NA EX)"
            : " bez NA EX"
          : vidimCezBzdochu
            ? jehoSkryteNaex.length > 0
              ? ` (skryto dal NA EX — vidíš ho cez Bzdochu: ${jehoSkryteNaex.map((x) => `[${x.uid}]`).join(", ")})`
              : " bez NA EX (vidíš cez Bzdochu)"
            : " (či dal NA EX, uvidíš až pri odkrytí)";
    const stav = (p: PlayerId): string =>
      ps.hotovy[p]
        ? `skončil${koniec(p)}`
        : ps.reakcia === p
          ? "odpovedá na NA EX"
          : cakaSBzdochou(ps, p)
            ? "čaká s Bzdochou, kým súper skončí (potom uvidí jeho NA EX)"
            : hraVPitke(ps, p)
              ? `hrá${p === ja && mojeSkryte > 0 ? " (skryto si dal NA EX)" : ""}`
              : "čaká";
    out.push(
      `PITKA NARAZ — obaja hráte súčasne a každý skončí sám: ${kto(obr)} (obranca): ${stav(obr)} · ${kto(v.utocnik)} (útočník, na NA EX odpovedá posledný): ${stav(v.utocnik)}. „hotovo“ je nevratné; NA EX sa odkryjú, keď skončia obaja.`,
    );
    const bz = bzdochaText(DATA, v);
    if (bz !== null) out.push(bz);
  }

  out.push("");
  out.push(
    v.ciel === null ? "CIEĽ KOLA: ešte nevybraný." : `CIEĽ KOLA: bitka o lokalitu ${meno(v.ciel.lokalita?.defId ?? "")}.`,
  );
  out.push("LÍNIA zľava doprava (tvoja strana vľavo, lokalita v strede, súperova strana vpravo), hrany zhora nadol tak, ako ich vidíš.");
  out.push(
    "Každá karta sa páruje VNÚTORNOU hranou (obrátenou k lokalite) so susedom bližšie k stredu; VONKAJŠIA hrana ostáva voľná pre ďalšiu kartu. Na spoji sa stretnú akcie na rovnakej pozícii zhora. ✓ aktívna, ✗ zrušená Odporom, · neaktívna (bez páru).",
  );
  out.push("Karta PATRÍ tomu, kto ju zahral (je natočená k nemu) — jej akcie a efekty sa rátajú jemu, nech leží na ktorejkoľvek strane. Tvoja PARTIA = tvoje karty.");
  // Prevaha (Michal 2026-10-20): akcie hrany lokality dostane, kto má v kraji viac svojich Občanov, Zvierat a Starešinov.
  const kraje = krajeStran(DATA, v.ciel?.lokalita ?? null, v.lokalitaOtocena);
  const prevaha = prevahaStran(DATA, v.strany);
  const nazovKraja = (p: PlayerId): string => (kraje[p] === null ? (p === ja ? "tvoja strana" : "súperova strana") : `kraj „${kraje[p]}“ (${p === ja ? "tvoja strana" : "súperova strana"})`);
  out.push(
    `PREVAHA: akcie hrany lokality dostane, kto má v tom kraji viac svojich Občanov, Zvierat a Starešinov (Nástroje a Cirhóza nie; pri rovnosti ten, koho karta v kraji leží hneď pri lokalite — vyložená ako prvá). ${nazovKraja(ja)}: ${prevaha[ja] === null ? "prázdna" : kto(prevaha[ja])}; ${nazovKraja(su)}: ${prevaha[su] === null ? "prázdna" : kto(prevaha[su])}.`,
  );
  const majitel = (p: PlayerId) => (p === ja ? "TVOJA karta" : "SÚPEROVA karta");
  const skryteText = (uid: number): string =>
    mojeSkryteNaex.some((x) => x.uid === uid)
      ? " (tvoje skryté — súper ho uvidí až pri odkrytí)"
      : jehoSkryteNaex.some((x) => x.uid === uid)
        ? " (súperovo skryté — vidíš ho cez Bzdochu, odkryje sa, keď skončíš)"
        : "";
  // Zrážka (playtest 20261027-062058): pri dvoch NA EX na jednej karte treba oboch.
  const naexText = (pl: PlacedCard): string =>
    pl.naexBy === undefined
      ? ""
      : `, NA EX: ${kto(pl.naexBy)}${pl.naexBy2 !== undefined ? ` aj ${kto(pl.naexBy2)} — zrážka${pl.vytrznik === true ? ", z karty je Výtržník" : ""}` : ""}${skryteText(pl.card.uid)}`;
  const zaverecnaText = (pl: PlacedCard): string => (pl.zaverecna === true ? ", TVOJA ZÁVEREČNÁ lícom dole — súper ju nevidí" : "");
  // Úplatok na karte (playtest 20261030-184957: Rany Výtržníka zmizli zo súčtov a na karte nebolo prečo).
  const uplatokText = (pl: PlacedCard): string =>
    (pl.uplatky ?? 0) > 0 ? `, ÚPLATOK ×${pl.uplatky}: útoky karty do konca kola o ${pl.uplatky} ${pl.uplatky === 1 ? "stupeň" : "stupne"} slabšie (Petelica → Pecka → Rana → nič)` : "";
  const moja = [...vs.strany[ja]].reverse();
  for (const pl of moja)
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na tvojej strane${zaverecnaText(pl)}${naexText(pl)}${uplatokText(pl)}]`, [
        "vonkajšia hrana",
        "vnútorná hrana (k lokalite)",
      ]),
    );
  if (v.ciel !== null && v.ciel.lokalita !== null) {
    const popis = " [LOKALITA]";
    out.push(kartaVLinii(v.ciel.lokalita, v.lokalitaOtocena !== (ja === 1), lineEval, popis, [`hrana k TEBE — ${nazovKraja(ja)}`, `hrana k SÚPEROVI — ${nazovKraja(su)}`]));
  } else out.push("  (stred línie — ešte nič)");
  for (const pl of vs.strany[su])
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na súperovej strane${zaverecnaText(pl)}${naexText(pl)}${uplatokText(pl)}]`, [
        "vnútorná hrana (k lokalite)",
        "vonkajšia hrana",
      ]),
    );
  // Záverečná súpera (roadmapa #83): leží lícom dole na konci strany, nevieš čo to je.
  for (const z of vs.zaverecne.filter((x) => x.majitel !== ja))
    out.push(`  [SÚPEROVA ZÁVEREČNÁ lícom dole na konci ${z.strana === ja ? "tvojej" : "súperovej"} strany${z.naexBy !== null ? `, NA EX: ${kto(z.naexBy)}${skryteText(z.uid)}` : ""} — nevieš, čo to je, ráta sa do bitky (v súčtoch nižšie chýba); za ňu sa nedá priložiť, otočí sa na konci Pitky]`);

  const sumy = (p: PlayerId) => Object.entries(lineEval.sums[p]).map(([a, n]) => `${a} ${n}`).join(", ") || "nič";
  out.push(`Tvoje aktívne akcie (tvoja partia + akcie lokality, ktoré aktivuje tvoja karta): ${sumy(ja)}`);
  out.push(`Súperove aktívne akcie: ${sumy(su)}`);
  if (v.ciel !== null && v.koniec === null) {
    // Priznané Dlhy (strop mäkkého, remíza) také, aké budú pri poškodení: s Dlhmi z Pitiek kola,
    // exekúcia až po poškodení (v8, 3ab061b) — ako hrozba a najhoršia odpoveď v jadre.
    const d = v.bitkaStav?.damage ?? poskodenieBitky(DATA, stolPriPoskodeni(DATA, vs, dalsiePitkyKola(DATA, vs)), lineEval.sums);
    const nepridelene = v.bitkaStav?.damage == null ? nepridelenePohorsenia(DATA, { ...stol, lokalitaOtocena: v.lokalitaOtocena, pokusy: v.pokusy, bitkaStav: v.bitkaStav }, lineEval.sums) : null;
    const bezPohorseni = nepridelene !== null && nepridelene.pocet[0] + nepridelene.pocet[1] > 0 ? "; bez nepridelených Pohoršení — ich rozsah je v riadku POHORŠENIA" : "";
    out.push(
      `${v.bitkaStav?.damage ? "VÝSLEDOK BITKY" : `ODHAD BITKY (podľa línie${bezPohorseni})`}: tuhé poškodenie ty ${d.tuhe[ja]} : súper ${d.tuhe[su]}; zvyšné Povery po Viere ty ${d.zvysnaPovera[ja]} : súper ${d.zvysnaPovera[su]} (v bitke posunú silu priazní, v8.3).`,
    );
    const o = battleOutcome(d);
    const finale = v.ciel.typ === "finale";
    // Stávku ráta jadro (stavkaBitky) ako výplata — Noviny, Herňa, sekera, Kultúrny dom (playtest 20261028-090549-2, Jano).
    const stavka = stavkaText(DATA, v);
    out.push(
      `  → ${o.vitaz === null ? "REMÍZA V TUHOM — rozhodnú Absťáky (menej vyhrá), potom priznané Dlhy (menej vyhrá), inak sekera" : o.vitaz === ja ? "vyhrávaš" : "prehrávaš"}. ${stavka === null ? "" : `${stavka} `}Špaky za bitku (v8): 1 za každú kartu v línii na oboch stranách (Absťáky ich od v8.1 neuberajú), aspoň ${KONSTANTY.SPAKY_ZA_BITKU_MIN} — každá ďalšia karta v línii pridá víťazovi špak; lokalitu si nikto neberie. Sekera: špaky kola vezme víťaz ďalšej bitky${finale ? " — vo finále prepadnú" : ""}; útočník ostáva; Nakladačku drží vyššie celkové, ${finale ? "vo finále sa nerozdeľuje" : "rozdeľuje ho ten, proti komu sa ráta — spravidla porazený si vyberá, ktoré priazne dostane"}. Strach starších v stávke nie je — platí na konci kola za udržanie.`,
    );
    const prehra = prehraText(DATA, vs);
    if (prehra !== null) out.push(`  ${prehra}`);
    // Hrozba na stole (Michal 2026-10-23): to isté, čo web ukáže v riadku bitky — najsilnejšie
    // NA EX z kariet na stole, ruka sa neráta. Len keď mení víťaza alebo prebytok.
    if (v.bitkaStav === null) {
      const ps = v.pitkaStav;
      const priebeh = { faza: v.faza, pitkaStav: ps, pitkaCislo: v.pitkaCislo, pitkyCelkom: v.pitkyCelkom, poldeciPlne: [v.hraci[0].poldeciPlne, v.hraci[1].poldeciPlne] as const };
      // Súper, ktorý už skončil, mohol NA EX dať skryto — kým sa neodkryje, hrozba trvá
      // (playtest 20261027-062058: „súper ešte môže“ po jeho hotovo zavádzalo).
      // S Bzdochou jeho NA EX poznám (stôl ho už ráta) — hrozí len v ďalšej Pitke.
      const suSkoncil = v.faza === "pitka" && ps !== null && ps.hotovy[su] && !ps.hotovy[ja] && !vidimCezBzdochu;
      const priebehSupera =
        suSkoncil && ps !== null ? { ...priebeh, pitkaStav: { ...ps, hotovy: (su === 0 ? [false, ps.hotovy[1]] : [ps.hotovy[0], false]) as [boolean, boolean] } } : priebeh;
      const dalsiaPitka = v.faza === "pitka" && v.pitkaCislo < v.pitkyCelkom;
      // Moje NA EX v tejto Pitke sú minuté (hotovo alebo limit so skrytými) — hrozím až v ďalšej.
      const jaVTejto = ps !== null && v.faza === "pitka" && !ps.hotovy[ja] && (ps.naexPocet?.[ja] ?? 0) + mojeSkryteNaex.length < naexZaPitku(v);
      const ktoHrozi = (p: PlayerId): readonly [string, string] =>
        p === ja
          ? [v.faza === "pitka" && !jaVTejto ? "v ďalšej Pitke ešte môžeš dať" : "ty ešte môžeš dať", ""]
          : suSkoncil
            ? ["súper mohol v tejto Pitke skryto dať", ` (odkryje sa, keď skončíš${dalsiaPitka ? "; inak ho môže dať v ďalšej Pitke" : ""})`]
            : vidimCezBzdochu
              ? ["súper v ďalšej Pitke ešte môže dať", ""]
              : v.faza === "pitka"
              ? ["súper ešte môže dať (alebo už skryto dal)", ""]
              : ["súper ešte môže dať", ""];
      for (const p of [su, ja]) {
        const h = hrozbaNaex(DATA, { ...stol, lokalitaOtocena: v.lokalitaOtocena }, p === su ? priebehSupera : priebeh, p);
        const pl = h === null ? undefined : vs.strany.flat().find((x) => x.card.uid === h.uid);
        if (h === null || pl === undefined) continue;
        const kto = h.vysledok.vitaz === null ? "remíza" : h.vysledok.vitaz === ja ? "vyhrávaš" : "prehrávaš";
        out.push(
          `  HROZBA NA STOLE: ${ktoHrozi(p)[0]} NA EX na ${meno(pl.card.defId)} [${h.uid}]${ktoHrozi(p)[1]} → tuhé ty ${h.damage.tuhe[ja]} : súper ${h.damage.tuhe[su]}, ${kto}${h.vysledok.prebytokDrzi === null ? "" : `, Nakladačka ${h.vysledok.prebytok} → ${h.vysledok.prebytokDrzi === ja ? "tebe" : "súperovi"}`} (ruka sa neráta).`,
        );
      }
      // Hrozba kliatob (návrh #38 B): NA EX, ktoré pridá Cirhózu či Dlh, aj keď víťaza bitky nezmení — to isté, čo web.
      for (const p of [su, ja]) {
        const k = hrozbaKliatob(DATA, vs, p, mozeEsteNaex({ ...stol, lokalitaOtocena: v.lokalitaOtocena }, p === su ? priebehSupera : priebeh, p));
        const pl = k === null ? undefined : vs.strany.flat().find((x) => x.card.uid === k.uid);
        if (k === null || pl === undefined) continue;
        out.push(`  HROZBA KLIATOB: ${ktoHrozi(p)[0]} NA EX na ${meno(pl.card.defId)} [${k.uid}]${ktoHrozi(p)[1]} → ${k.obet === ja ? "tebe" : "súperovi"} do konca kola ${textHrozbyKliatob(k)} (ruka sa neráta).`);
      }
    }
    // Nepridelené Pohoršenia (Michal 2026-10-27 „ukázať rozsah“) — to isté, čo web v riadku bitky:
    // odhad ráta s markermi, ako stoja, no priazeň z Pohoršení platí v bitke hneď.
    if (nepridelene !== null) {
      const stolP = { ...stol, lokalitaOtocena: v.lokalitaOtocena, pokusy: v.pokusy, bitkaStav: v.bitkaStav };
      const nep = nepridelene;
      for (const p of [su, ja]) {
        if (nep.pocet[p] <= 0) continue;
        const r = rozsahPohorseni(DATA, stolP, lineEval.sums, nep, p);
        const kto = r === null ? "" : r.vysledok.vitaz === null ? "remíza" : r.vysledok.vitaz === ja ? "vyhrávaš" : "prehrávaš";
        // Rozsah je najlepší prípad rozdeľujúceho pri stojacich Pohoršeniach druhého (playtest 20261028-090549-3, Hela:
        // „až 4 : 12“, súper dal 5 : 9 a jej Pohoršenie vrátilo 7 : 9) — nie predpoveď.
        const druhy = nep.pocet[p === ja ? su : ja] > 0 ? `; ${p === ja ? "súperove" : "tvoje"} Pohoršenia tu stoja — ${p === ja ? "on" : "ty"} ${p === ja ? "rozdeľuje" : "rozdeľuješ"} tiež a ${p === ja ? "môže" : "môžeš"} to vrátiť` : "";
        out.push(
          `  POHORŠENIA: ${p === ja ? "máš" : "súper má"} ${nep.pocet[p]} nepridelených (rozdelia sa v bitke, priazeň Bitkára či Veriaceho platí hneď) → ${
            r === null
              ? `bitku v ${p === ja ? "tvoj" : "jeho"} prospech nepohnú`
              : `${p === ja ? "ty" : "súper"} nimi v najlepšom prípade pre ${p === ja ? "teba" : "neho"} až tuhé ty ${r.damage.tuhe[ja]} : súper ${r.damage.tuhe[su]}, ${kto}${r.vysledok.prebytokDrzi === null ? "" : `, Nakladačka ${r.vysledok.prebytok} → ${r.vysledok.prebytokDrzi === ja ? "tebe" : "súperovi"}`} (horná hranica, nie predpoveď — ${p === ja ? "Pohoršenia môžeš" : "súper ich môže"} dať aj pre špaky za strach${druhy})`
          }.`,
        );
      }
    }
    // Pokus o zajatie (v9): kto skúša zajať — boss je v súperovej ruke, starší v ohrození.
    for (const p of [ja, su] as const) {
      const pokus = v.pokusy[p];
      if (pokus === null) continue;
      const e = v.starsi.find((x) => x.elderId === pokus.elderId);
      out.push(
        `  POKUS O ZAJATIE: ${p === ja ? "TY skúšaš" : "SÚPER skúša"} zajať ${meno(e?.karta.defId ?? "")} — jeho karta je v ruke ${p === ja ? "súpera" : "tvojej"} (smie sa vyložiť ako Starešina, len akcie). Starší je v ohrození: v tomto kole ním nehýbe Pohoršenie, Nakladačka, Povery, Vila ani Kapybara. ${p === ja ? "Vyhráš bitku = tvoj väzeň; prehráš alebo sekera = vráti sa a marker ustúpi o stupeň." : "Ak súper bitku vyhrá, je jeho väzeň; ak ju vyhráš ty alebo je sekera, pokus zlyhá."}`,
      );
    }
  }

  out.push("");
  const body = spakyTeraz(v);
  out.push("STARŠÍ (stupnica 0–6: 0–2 polovica hráča 1, 3 sivý stred, 4–6 polovica hráča 2):");
  out.push(
    `  STUPEŇ 0–3 od stredu (0 sivý stred pokojný, 1 žltá znepokojený, 2 oranžová vystrašený, 3 červená vydesený). PRIAZEŇ má hráč, ku ktorému je marker posunutý — sila = stupeň; starší sa bojí toho DRUHÉHO na tom istom stupni. ` +
      `ŠPAKY ZA STRACH (v8.3): stupeň, kam sa marker dostal, zaplatí hráčovi, ktorého sa starší bojí, AŽ NA KONCI NASLEDUJÚCEHO KOLA, ak sa na ňom marker dovtedy udrží (${ZONY_STRACHU}) — NECH BITKU VYHRAL KTOKOĽVEK, aj porazenému. Odtlačený stupeň nič; zaparkovaný marker druhýkrát nič nedá; ústup k stredu zaplatené stupne zmaže. Vo finále nové stupne nič, udržané z posledného kola sa vyplatia po finále. ` +
      "Pohoršenie (od seba = desíš, k sebe = upokojuješ) a Nakladačka posúvajú marker, pole stojí podľa zóny (von 1 / 2 / 3, k stredu 2 / 3 / 4), bez limitu, aj na červenú a z nej späť. Scorecard nesie len priazeň.",
  );
  out.push(`  ŠPAKY: ty ${body.spaky[ja]}, súper ${body.spaky[su]}; na konci tohto kola od starších za udržané stupne: ty +${body.zaStarsich[ja]}, súper +${body.zaStarsich[su]} (nech bitku vyhrá ktokoľvek); čaká na udržanie do konca ďalšieho kola: ty +${body.naUdrzanie[ja]}, súper +${body.naUdrzanie[su]}; nepriznaná Cirhóza na konci −${KONSTANTY.SPAKY_ZA_CIRHOZU} za kus (ty ${body.cirhozy[ja]}, súper ${body.cirhozy[su]}); výkupné na konci (plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI}, každých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1): ty +${body.vykupne[ja].spaky}, súper +${body.vykupne[su].spaky}; keby skončila teraz ty ${body.spolu[ja]}, súper ${body.spolu[su]}; odhad do konca (markery stoja) ty ${body.odhad[ja]}, súper ${body.odhad[su]}.`);
  // Väzni (v9): tretí väzeň vyhráva, ostatní dajú po finále špaky podľa poradia zajatia.
  const vazni = (p: PlayerId) => v.vazni.filter((x) => x.hrac === p);
  const ciele = (p: PlayerId) => v.starsi.filter((e) => vydesil(e, p)).map((e) => meno(e.karta.defId));
  out.push(
    `  VÄZNI (tretí = výhra hneď; po finále podľa poradia zajatia v partii ${KONSTANTY.SPAKY_ZA_VAZNOV.join(" / ")} špakov): ty ${vazni(ja).length}/${KONSTANTY.VAZNI_NA_VYHRU}${vazni(ja).length > 0 ? ` (${vazni(ja).map((x) => `${meno(x.karta.defId)} ${x.poradie}.`).join(", ")})` : ""}, súper ${vazni(su).length}/${KONSTANTY.VAZNI_NA_VYHRU}${vazni(su).length > 0 ? ` (${vazni(su).map((x) => `${meno(x.karta.defId)} ${x.poradie}.`).join(", ")})` : ""}. Na stupni 3 sa bojí — teba: ${ciele(ja).join(", ") || "nikto"}; súpera: ${ciele(su).join(", ") || "nikto"} (tých sa dá po šenku skúsiť zajať).`,
  );
  for (const e of v.starsi) {
    const b = body.starsi.find((x) => x.elderId === e.elderId);
    out.push(popisStarsieho(e, kto, b?.spaky[ja] ?? 0, b?.spaky[su] ?? 0, b?.naUdrzanie[ja] ?? 0, b?.naUdrzanie[su] ?? 0));
  }

  out.push("");
  out.push(`ŠENOK (${v.senok.length}, Náradie ${v.naradiePocet}, Občania ${v.obcaniaPocet}):`);
  for (const k of v.senok) out.push(`  ${popisKarty(k)}`);
  out.push(`LOKALITY V HRE (${v.lokalityVHre.length}):`);
  for (const k of v.lokalityVHre) out.push(`  ${popisKarty(k)}`);
  if (v.nastenka.length > 0)
    out.push(
      `NÁSTENKA (odohrané bitky): ${v.nastenka.map((b) => `${jeFinaleNaNastenke(b) ? `finále${b.lokalita === null ? "" : ` (${meno(b.lokalita.defId)})`}` : b.lokalita === null ? "?" : meno(b.lokalita.defId)} — ${b.vitaz === null ? "sekera" : `${kto(b.vitaz)} +${b.zaBitku[b.vitaz]}`}, za starších ty +${b.zaStarsich[ja]} / súper +${b.zaStarsich[su]}${b.exekutor[ja] + b.exekutor[su] > 0 ? `, Exekútor ty −${b.exekutor[ja]} / súper −${b.exekutor[su]}` : ""}`).join("; ")}`,
    );
  if (v.spakyNaSekere > 0) out.push(`NA SEKERE: ${spakov(v.spakyNaSekere)} (vezme ich víťaz najbližšej bitky, vo finále prepadnú)`);

  out.push("");
  out.push(
    `TVOJA RUKA (${v.ruka.length}) — vytlačené strany; na TVOJU stranu sa k lokalite obráti PRAVÁ, na SÚPEROVU ĽAVÁ (karta ostáva natočená k tebe). Presný spoj ukazuje každá možnosť „vylož“:`,
  );
  for (const k of v.ruka) out.push(`  ${popisKarty(k)}`);
  // Balíčky, ktoré hráčovi podľa karty odhalil server (Veštica).
  if (v.volbaVestica !== null) {
    out.push("");
    out.push("VEŠTICA — TVOJ DOBERACÍ BALÍČEK (poradové číslo: karta):");
    v.volbaVestica.moj.forEach((k, i) => out.push(`  ${i}: ${popisKarty(k)}`));
    out.push("SÚPEROV DOBERACÍ BALÍČEK:");
    v.volbaVestica.jeho.forEach((k, i) => out.push(`  ${i}: ${popisKarty(k)}`));
  }
  return out.join("\n");
}

// Bonus priazne = NASOBOK_PRIAZNE × sila (Michal 2026-10-16: sila 1 / 2 / 3, účinok dvojnásobný).
const bonus = (s: number): number => KONSTANTY.NASOBOK_PRIAZNE * s;
const UCINOK: Record<string, (s: number) => string> = {
  // Priazne v9 (Michal 2026-10-30): sila 1 / 2 / 3 bez dvojnásobku.
  UZERNIK: (s) => `Kmotor: po bitke prejdú až ${s + 1} tvoje priznané Dlhy medzi súperove priznané`,
  LAKOMEC: (s) => `Abstinent: v bitke +${s} Pohoršenia`,
  ROBOTA: (s) => `Robota: v bitke ${s} akcie Robota navyše (spália Dlh, inak 1 špak)`,
  BITKAR: (s) => `+${s} tuhého poškodenia v bitke`,
  VERIACI: (s) => `+${s} Viery v každej bitke`,
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} po bitke`,
  ALKOHOLIK: (s) => `Na zdravie: poldeci z ${s} tvojich NA EX za kolo sa po bitke vráti plný`,
  ADVOKAT: (s) => `Advokát: exekúcia ti vezme o ${s} špakov menej (Dlhy zhoria ako vždy)`,
};

function popisStarsieho(e: ElderState, kto: (p: PlayerId | null) => string, mojeSpaky: number, jehoSpaky: number, mojeCaka: number, jehoCaka: number): string {
  const sc = scorecardStarsieho(DATA, e);
  const pr = priazenHraca(e);
  const ob = obavanyHrac(e);
  const favour = favourStarsieho(DATA, e);
  const ucinok = UCINOK[favour]?.(pr === null ? 1 : priazenSila(e)) ?? "";
  return `  ${e.elderId}: ${meno(e.karta.defId)} na scorecarde ${sc.nazov} | marker ${e.marker} (stupeň ${STUPNICA_ZONY[e.marker]}, ${STAV_STARSIEHO[STUPNICA_ZONY[e.marker]]})${e.marker === 0 || e.marker === 6 ? " | na krajnej pozícii (červená)" : ""} | ${pr !== null ? `priazeň ${kto(pr)} +${priazenSila(e)} (${ucinok})` : `priazeň nikto (kto ju získa: ${ucinok})`}${ob !== null ? ` | bojí sa: ${kto(ob)} (stupeň ${STUPNICA_ZONY[e.marker]})` : " | nikoho sa nebojí"}\n      strach na konci kola: ty +${mojeSpaky}, súper +${jehoSpaky}; čaká na udržanie: ty +${mojeCaka}, súper +${jehoCaka}`;
}

// ---- možné ťahy -------------------------------------------------------------------

const hranaText = (h: readonly Slot[]): string => h.map((x) => x ?? "—").join(", ");
const zmenyText = (z: ActionSums): string =>
  Object.entries(z)
    .map(([a, n]) => `${a} ${n > 0 ? "+" : "−"}${Math.abs(n)}`)
    .join(", ") || "bez zmeny";

/** Strany lokality pri voľbe cieľa — ktorá hrana bude obrátená k tebe. */
function popisStranLokality(v: ClientState, k: CardInstance, otocena: boolean): string {
  const s = stranyLokality(DATA, k, otocena, v.ja);
  return `k TEBE: ${hranaText(s.kTebe)} | k SÚPEROVI: ${hranaText(s.kSuperovi)}`;
}

/**
 * Náhľad vyloženia na koniec strany (playtest 20261017-164450: hrany sa
 * dali zistiť len skúšaním) — vnútorná hrana, s čím sa stretne a čo to zmení.
 */
function popisVylozenia(v: ClientState, k: CardInstance, kam: "vlastna" | "superova"): string {
  const su = (v.ja === 0 ? 1 : 0) as PlayerId;
  const line = lineState(v);
  const n = nahladVylozenia(DATA, line, v.ja, k, kam, v.naexVKole);
  const s = n.sused;
  const spoj =
    s === null
      ? "nič sa nespojí"
      : `↔ ${s.stred ? "stred" : s.majitel === v.ja ? "tvoja karta" : "súperova karta"} ${meno(s.karta.defId)} (${hranaText(s.hrana)}): ${
          n.pary.length > 0 ? n.pary.map((p) => `${p.moja}+${p.susedova}`).join(", ") : "žiadny pár"
        }`;
  // Tuhé navyše z kariet (Pes, Recidivista…) — bonus Psa náhľad vynechal (playtest 20261026-173610-1).
  const tuhe = (q: PlayerId): string => (n.tuhe[q] === 0 ? "" : `, tuhé navyše ${n.tuhe[q] > 0 ? "+" : "−"}${Math.abs(n.tuhe[q])}`);
  return ` | vnútorná hrana ${hranaText(n.vnutorna)} ${spoj} | ty: ${zmenyText(n.zmeny[v.ja])}${tuhe(v.ja)} · súper: ${zmenyText(n.zmeny[su])}${tuhe(su)}`;
}

const POPIS_CIELA: Record<string, string> = {
  vlastna: "na koniec tvojej strany",
  superova: "na koniec súperovej strany (karta ostane tvoja, natočená k tebe)",
  priznanie: "priznať — kliatba je NAVŽDY mimo balíčka (čistí ho) a hneď si dobereš kartu (za Cirhózu nie; Dlh sa prizná sám, keď si ho dobereš); nemíňa limit a neodovzdá ťah (môžeš priznať viac kliatob za sebou a potom ešte vyložiť); priznaný Dlh sa ráta k Exekútorovi a súperovým Poverám",
  dedicstvo: "do Dedičstva — pasívny efekt Nástroja platí, kým tam leží (cena vyššie, rastie pre oboch)",
};

function moznosti(v: ClientState): string[] {
  if (v.koniec !== null || !v.mozemHrat) return [];
  const ja = v.ja;
  const out: string[] = [];
  const c = (cmd: Command, popis: string) => out.push(`${JSON.stringify(cmd)}   — ${popis}`);
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const nv = v.volbaNastupu;
  if (nv !== null && nv.hrac === ja) {
    // Voľby v7: karta zo šenku (Starosta, Dohadzovačka), Nástroj za Živnostníka, Kapybara.
    if (nv.typ === "senok") {
      for (const k of v.senok) c({ type: "senok", uid: k.uid }, `ZO ŠENKU: vezmi si ${popisKarty(k)} do ruky`);
      return out;
    }
    if (nv.typ === "nastroj") {
      c({ type: "nastroj", uid: null }, "ŽIVNOSTNÍK: Nástroj za neho neprikladať");
      for (const k of v.ruka) if ((DATA.cards.get(k.defId)?.tags ?? []).includes("Nástroj")) c({ type: "nastroj", uid: k.uid }, `ŽIVNOSTNÍK: prilož za neho ${popisKarty(k)} (limit nemíňa)`);
      return out;
    }
    if (nv.typ === "kapybara") {
      for (const e of v.starsi) if (e.marker !== 3) c({ type: "kapybara", elderId: e.elderId }, `KAPYBARA: marker ${meno(e.karta.defId)} o 1 pole k stredu`);
      return out;
    }
    if (nv.typ === "klebetnica") {
      for (const k of nv.ruka ?? []) c({ type: "klebetnica", uid: k.uid }, `KLEBETNICA: súperovu kartu ${popisKarty(k)} pošli naspodok jeho doberacieho balíčka`);
    } else {
      v.starsi.forEach((a, i) =>
        v.starsi.slice(i + 1).forEach((b) =>
          c({ type: "dohadzovacka", elderA: a.elderId, elderB: b.elderId }, `DOHADZOVAČKA: vymeň priazne (scorecardy) starším ${meno(a.karta.defId)} a ${meno(b.karta.defId)}; markery ostanú, kde sú`),
        ),
      );
    }
    return out;
  }
  if (v.hasicVolba !== null) {
    // Hasič (Michal 2026-10-26): náhodná karta z odhadzovacieho balíčka — nechať, alebo vrátiť.
    const k = v.hasicVolba.karta;
    if (k === null) {
      c({ type: "hasic", nechat: false }, "HASIČ: vytiahnutá karta už v odhadzovacom balíčku nie je — pokračuj");
      return out;
    }
    c({ type: "hasic", nechat: true }, `HASIČ: kartu ${popisKarty(k)} z tvojho odhadzovacieho balíčka si nechaj v ruke (Dlh sa sám prizná a ťaháš kartu)`);
    c({ type: "hasic", nechat: false }, `HASIČ: kartu ${meno(k.defId)} vráť do odhadzovacieho balíčka (kliatba, slabá karta)`);
    return out;
  }
  switch (v.faza) {
    case "volbaCiela": {
      for (const k of v.lokalityVHre) {
        c({ type: "chooseLocation", uid: k.uid, otocena: false }, `bitka o lokalitu ${meno(k.defId)} — ${popisStranLokality(v, k, false)}`);
        c({ type: "chooseLocation", uid: k.uid, otocena: true }, `bitka o lokalitu ${meno(k.defId)}, otočenú o 180° — ${popisStranLokality(v, k, true)}`);
      }
      break;
    }
    case "draft": {
      const ds = v.draftStav;
      if (ds === null) break;
      if (ds.krok === "stavba") {
        const krok = krokStavby(ds.mojBalicek.length);
        out.push(
          `{"type":"stavbaSenku","doSenku":[${Array.from({ length: krok.doSenku }, (_, i) => `A${i + 1}`).join(",")}],"odhod":[${Array.from({ length: krok.odhod }, (_, i) => `B${i + 1}`).join(",")}]}   — z TVOJHO BALÍČKA STAVBY (vyššie) daj ${krok.doSenku} ${krok.doSenku === 1 ? "kartu" : "karty"} do šenku (uvidia ich obaja, berie sa z neho) a ${krok.odhod} naspodok (Nástroj naspodok Náradia, ostatné naspodok Občanov; súper ich neuvidí). Nič si nepodávate. Súper vyberá naraz s tebou; karty do šenku sa odhalia, keď vyberiete obaja.`,
        );
        break;
      }
      if (ds.krok === "zajatie") {
        // Pokus o zajatie (v9): staršieho, ktorý sa ťa bojí na stupni 3, za cigaretu.
        c({ type: "bezPokusu" }, "o zajatie sa nepokúšaš");
        const h = v.hraci[ja];
        const ciele = v.starsi.filter((e) => pokusMozny(e, ja) && !v.pokusy.some((x) => x?.elderId === e.elderId));
        if (ciele.length > 0 && h.cigarety < KONSTANTY.CENA_POKUSU) {
          out.push(`(Pokus o zajatie ${ciele.map((e) => meno(e.karta.defId)).join(", ")} nejde: nemáš cigaretu.)`);
          break;
        }
        if (v.pokusy[ja] !== null) break;
        const n = nahladPokusu(v);
        for (const e of ciele) {
          const dopady = dopadyText(dopadyNahladu(DATA, v, stavPoPokuse(v, e.elderId), 0), ja);
          c(
            { type: "pokus", elderId: e.elderId },
            `POKUS O ZAJATIE: ${meno(e.karta.defId)} (bojí sa ťa na stupni 3) — zaplatíš ${KONSTANTY.CENA_POKUSU} cig. (prepadne), jeho karta ide súperovi do ruky a v tomto kole sa marker nehýbe. Vyhráš bitku = tvoj väzeň (${n.poradie}. v partii, po finále ${n.spaky} špakov${n.vyhra ? "; TRETÍ VÄZEŇ = VYHRÁŠ HNEĎ" : ""}); prehráš alebo sekera = vráti sa a marker ustúpi o stupeň (nezaplatená červená prepadne)${dopady}`,
          );
        }
        break;
      }
      // Michal 2026-10-19: na ťahu 1 karta za cigaretu, alebo 2 karty za 3 cigarety; poldeci sa neplatí.
      const mam = ds.noveKarty[ja];
      const cig = v.hraci[ja].cigarety;
      c(
        { type: "draftStop" },
        `prestaň brať — nových kariet máš ${mam}, v Zhromaždení vyložíš ${limitZhromazdenia(v, ja)}${ds.hotovo[su] ? "" : "; súper potom má už len jeden posledný ťah"}`,
      );
      for (const k of v.senok) {
        if (cig >= (KONSTANTY.CENA_SENKU[1] ?? 1)) c({ type: "draftBer", uids: [k.uid] }, `vezmi zo šenku ${meno(k.defId)} za ${KONSTANTY.CENA_SENKU[1]} cigaretu (máš ${cig})`);
      }
      if (cig >= (KONSTANTY.CENA_SENKU[2] ?? 3) && v.senok.length >= 2)
        out.push(`{"type":"draftBer","uids":[U1,U2]}   — vezmi zo šenku DVE karty (uid zo šenku vyššie) za ${KONSTANTY.CENA_SENKU[2]} cigarety (máš ${cig}); potom berie súper`);
      break;
    }
    case "zhromazdenie": {
      const z = v.zhromazdenieStav;
      c({ type: "pass" }, `pasovať (do Pitky už nevykladáš, súper vykladá sám; dostaneš ${cigaretyZaPas(DATA, v, ja, v.hraci[ja].rukaPocet)} cig. — cigaretu za každú kartu, ktorú si ešte smel vyložiť, najviac toľko, koľko máš kariet v ruke; na Zastávke len z vlastného limitu)`);
      // V Zhromaždení sa nefajčí (§7) — motor smoke odmietne, preto ho ani neponúkať.
      if (zakazVypit(v)) out.push("(Kostol: nikto nesmie vypiť — v ťahu len jedna karta)");
      if (v.hraci[ja].poldeciPlne > 0 && z !== null && !zakazVypit(v)) {
        const zostava = z.zostavaLimit[ja];
        c(
          { type: "vypit" },
          `VYPIŤ do dna: plný poldeci → vypitý; limit vykladania hneď ${zostava} → ${Math.max(0, zostava - 1)}, zato ďalšou kartou ti ťah neskončí; pečeň +1 (vyhodnotí sa v najbližšej Pitke)${zostava <= 1 ? ". POZOR: po vypití už nič nevyložíš" : ""}`,
        );
      }
      if (z !== null) {
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, z.zostavaLimit[ja], v.hraci[ja].cigarety >= v.cenaDedicstva, cielLokalitaId(v), zablokovaneStrany(v))) {
            c({ type: "place", uid: k.uid, target: t }, `vylož ${meno(k.defId)} → ${POPIS_CIELA[t]}${t === "vlastna" || t === "superova" ? popisVylozenia(v, k, t) : ""}`);
            if (v.zaverecnaMozna && (t === "vlastna" || t === "superova"))
              c({ type: "zaverecna", uid: k.uid, target: t }, `ZÁVEREČNÁ: ${meno(k.defId)} lícom dole → ${POPIS_CIELA[t]} za ${KONSTANTY.CENA_ZAVERECNEJ} cig.; súper ju nevidí do konca Pitky a za ňu nepriloží (ani odpoveď na NA EX), ty už v tomto Zhromaždení nevykladáš (bez cigariet za pas); Nástup až pri otočení`);
          }
        }
      }
      // Playtest 20261012-101447: Jano držal 6 Cirhóz v ruke a nikdy ich nepriznal.
      if (v.ruka.some((k) => k.defId === "cirhoza"))
        out.push(
          `(Máš v ruke Cirhózu: zváž priznanie — nepriznaná ťa na konci hry stojí ${KONSTANTY.SPAKY_ZA_CIRHOZU} špakov (ráta sa v ruke aj v balíčkoch; po bitke ide z ruky do odhadzovacieho balíčka), priznaná na konci nestojí nič, ale súperovi dá v každej bitke +1 tuhé.)`,
        );
      break;
    }
    case "pitka": {
      if (v.vizia !== null) {
        // Vízia (Michal 2026-10-19): vrchnú kartu do ruky, alebo zahodiť.
        const k = v.volbaVizia;
        const zostava = v.vizia.zostava[ja];
        c({ type: "vizia", vziat: true }, `VÍZIA: vrchnú kartu balíčka ${k === null ? "" : popisKarty(k)} si vezmi do ruky${zostava > 1 ? ` (ešte ${zostava - 1} Vízie)` : ""}`);
        c({ type: "vizia", vziat: false }, "VÍZIA: vrchnú kartu ZAHOĎ — je navždy preč z hry (kliatba, slabá karta)");
        const k2 = v.volbaViziaDruha ?? null;
        if (k2 !== null) {
          // Krištáľová guľa (Náradie 2026-10-30): o druhej karte zhora; vrchná ostane navrchu.
          c({ type: "vizia", vziat: true, druha: true }, `VÍZIA (Krištáľová guľa): DRUHÚ kartu zhora ${popisKarty(k2)} si vezmi do ruky — vrchná ostane navrchu`);
          c({ type: "vizia", vziat: false, druha: true }, "VÍZIA (Krištáľová guľa): DRUHÚ kartu zhora ZAHOĎ — vrchná ostane navrchu");
        }
        break;
      }
      const h = v.hraci[ja];
      const pk = v.pitkaStav;
      if (pk?.reakcia === ja) {
        // Odpoveď na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
        c({ type: "bezReakcie" }, "na súperovo NA EX neodpovedať");
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(v), zablokovaneStrany(v))) {
            if (t === "vlastna" || t === "superova") {
              c({ type: "place", uid: k.uid, target: t }, `odpoveď na NA EX: vylož ${meno(k.defId)} → ${POPIS_CIELA[t]} (limit nemíňa)${popisVylozenia(v, k, t)}`);
            }
          }
        }
        break;
      }
      let naexMoznosti = 0;
      if (v.ciel?.lokalita?.defId === "kostol") out.push("(Kostol: NA EX len na kartu v kraji pri oltári)");
      // NA EX naraz (v5): moje skryté NA EX sa rátajú do limitu Pitky aj poldeci.
      // S Bzdochou prídu aj súperove — do môjho limitu a poldeci sa nerátajú.
      const mojeSkryte = (pk?.skryteNaex ?? []).filter((x) => x.hrac === ja);
      // Tie isté podmienky ako motor.
      const ciele = new Set(moznostiNaexVPohlade(DATA, v));
      const naexEste = ciele.size > 0;
      if (mojeSkryte.length > 0) out.push(`(Skryto si dal ${mojeSkryte.length === 1 ? "NA EX" : `${mojeSkryte.length} NA EX`} — odkryje sa, keď obaja skončíte Pitku; súper potom smie odpovedať jednou kartou za každé.)`);
      if (naexEste) {
        for (const p of [0, 1] as const) {
          for (const pl of v.strany[p]) {
            if (!ciele.has(pl.card.uid)) continue;
            naexMoznosti++;
            const moja = pl.playedBy === ja;
            c(
              { type: "naex", uid: pl.card.uid },
              `NA EX na ${moja ? "svoju" : "SÚPEROVU"} kartu ${meno(pl.card.defId)} (na ${p === ja ? "tvojej" : "súperovej"} strane) — ${pl.card.defId === "veteran" ? "Veterán: zdvojí jeho aktívne akcie a nezruší ich, neaktívne nechá" : "zruší jej aktívne akcie, zdvojí neaktívne"} (rátajú sa ${moja ? "tebe" : "súperovi"}; násobky sa násobia, NA EX × Silná žena = ×4); pečeň +1 tebe, poldeci sa pri bitke vypije; skryto — súper ho uvidí až po tom, čo obaja skončíte Pitku (ak naň dá NA EX aj on, je z karty Výtržník: všetky akcie Rany pre majiteľa), potom smie odpovedať jednou kartou${cenaNaexText(v, pl.card.uid)}`,
            );
          }
        }
      }
      if (naexEste) {
        for (const z of v.zaverecne.filter((x) => ciele.has(x.uid))) {
          naexMoznosti++;
          c({ type: "naex", uid: z.uid }, `NA EX na SÚPEROVU ZÁVEREČNÚ lícom dole (${z.strana === ja ? "na tvojej" : "na súperovej"} strane) — nevieš, čo to je; prejde vždy, aktívne akcie zruší a neaktívne zdvojí ako pri každej karte; pečeň +1 tebe`);
        }
      }
      if (naexLimitMinuty(DATA, v, ja) && (pk?.naexPouzity[ja] === true || mojeSkryte.length > 0)) {
        out.push("(NA EX si v tejto Pitke už dal)");
      } else if (naexMoznosti === 0) out.push("(NA EX ide len na Občana či Starešinu v línii, ktorý má aspoň 1 aktívnu a aspoň 1 neaktívnu akciu, bez poldeci — tvojho aj súperovho, nie Nástroj — a len s plným poldeci)");
      const cenaFajc = cenaFajceniaHraca(v, ja);
      const zakazFajc = dovodZakazuFajcit(DATA, v, ja);
      if (zakazFajc !== null) out.push(`(${zakazFajc})`);
      else if (h.cigarety >= cenaFajc && jeCoTahat(h.doberaciPocet, h.odhadzovaci.length)) {
        c({ type: "smoke", pocet: 1 }, `fajči za ${cigariet(cenaFajc)} — hneď si doberieš kartu (ťah nekončí); ďalšie fajčenie v tejto Pitke o cigaretu drahšie`);
      }
      const cenaBarteru = barterCena(DATA, v, ja);
      if (h.cigarety >= cenaBarteru) c({ type: "barter" }, `barter ${cenaBarteru} cigariet → nový plný poldeci navyše`);
      if (h.cigarety >= KONSTANTY.REFILL_CENA && h.poldeciVypite > 0 && !h.dedicstvo.some((x) => x.defId === "vinko") && !jednotaZakazuje(v, ja))
        c({ type: "refillPoldeci" }, `${KONSTANTY.REFILL_CENA} cigarety → dolej vypitý poldeci`);
      // Kšeft (v7): každá karta raz za Pitku; Kšeft lokality smie použiť každý hráč.
      if (pk !== null && pk.reakcia === null) {
        const pouzite = pk.kseft?.[ja] ?? [];
        const skryteMoje = (pk.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
        for (const pl of [...v.strany[0], ...v.strany[1]]) {
          if (pl.playedBy !== ja || pl.zaverecna === true || pouzite.includes(pl.card.uid)) continue;
          const uid = pl.card.uid;
          if (pl.card.defId === "stryko_z_ameriky" && h.cigarety >= KONSTANTY.EFEKT.STRYKO_CENA) c({ type: "kseft", uid }, `KŠEFT Strýko z Ameriky: za ${cigariet(KONSTANTY.EFEKT.STRYKO_CENA)} udelíš v bitke tohto kola súperovi 1 Ranu navyše (raz za Pitku)`);
          if (pl.card.defId === "oslavenec" && h.poldeciPlne - skryteMoje > 0 && !zakazVypit(v))
            c({ type: "kseft", uid }, "KŠEFT Oslávenec: tvoj plný poldeci → vypitý (nie nerest, tebe pečeň nie), súper dostane hneď 2 poškodenia pečene (raz za Pitku)");
          if (pl.card.defId === "smetiarka")
            for (const k of v.ruka) if (!(DATA.cards.get(k.defId)?.tags ?? []).includes("Kliatba")) c({ type: "kseft", uid, kartaUid: k.uid }, `KŠEFT Smetiarka: odhoď ${meno(k.defId)} z ruky do odhadzovacieho balíčka a dostaneš 1 cigaretu (raz za Pitku)`);
        }
        // Kšeft väzňa (v9): len držiteľ, za vypitý plný poldeci, raz za Pitku na väzňa — ten istý výpočet ako jadro.
        for (const k of ponukaKseftuVazna(stavKseftuVaznaZPohladu(v), ja)) {
          if (k.type !== "kseftVazna") continue;
          const vazen = v.vazni.find((x) => x.elderId === k.elderId);
          const text = vazen === undefined ? "" : (DATA.cards.get(vazen.karta.defId)?.effectText ?? "");
          const karta = k.kartaUid === undefined ? "" : ` — karta ${meno([...v.senok, ...v.ruka, ...h.priznane].find((x) => x.uid === k.kartaUid)?.defId ?? "")}`;
          c(k, `KŠEFT VÄZŇA ${meno(vazen?.karta.defId ?? "")}${karta}: za vypitý plný poldeci (nerest, +1 pečeň, limit ďalšieho Zhromaždenia −1). ${text}`);
        }
        // Úplatok (v7): cigareta na súperovho Kulturistu, raz za Pitku na kartu.
        if (h.cigarety >= 1) {
          for (const pl of [...v.strany[0], ...v.strany[1]]) {
            if (pl.playedBy !== su || pl.card.defId !== "kulturista" || pl.zaverecna === true || (pk.uplatok ?? []).includes(pl.card.uid)) continue;
            c({ type: "uplatok", uid: pl.card.uid }, `ÚPLATOK: 1 cigareta na súperovho Kulturistu — jeho útoky do konca kola o stupeň slabšie (Petelica → Pecka → Rana → nič; teraz ${pl.uplatky ?? 0}); cigareta prepadne`);
          }
        }
        const lok = v.ciel?.lokalita ?? null;
        if (lok !== null && !pouzite.includes(lok.uid)) {
          if (lok.defId === "zberny_dvor" && h.cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA)
            for (const k of h.odhadzovaci) c({ type: "kseft", uid: lok.uid, kartaUid: k.uid }, `KŠEFT Zberný dvor: za ${KONSTANTY.EFEKT.ZBERNY_DVOR_CENA} cigaretu ${popisKarty(k)} z tvojho odhadzovacieho balíčka do ruky (raz za Pitku)`);
          if (lok.defId === "obecny_urad" && h.cigarety >= KONSTANTY.EFEKT.URAD_CENA && h.dlhy > 0)
            c({ type: "kseft", uid: lok.uid }, `KŠEFT Obecný úrad: za ${KONSTANTY.EFEKT.URAD_CENA} cigarety presuň 1 svoj priznaný Dlh medzi súperove priznané (raz za Pitku)`);
          const supOdh = v.hraci[su].odhadzovaci;
          const vrchna = supOdh[supOdh.length - 1];
          if (lok.defId === "sklad" && h.cigarety >= 1 && vrchna !== undefined)
            c({ type: "kseft", uid: lok.uid }, `KŠEFT Sklad: za 1 cigaretu si vezmi vrchnú kartu súperovho odhadzovacieho balíčka ${popisKarty(vrchna)} do ruky — odteraz je tvoja (raz za Pitku)`);
          if (lok.defId === "predsedova_vila" && h.cigarety >= 2) {
            for (const e of v.starsi) {
              if (v.pokusy.some((x) => x?.elderId === e.elderId)) continue;
              if (posunMarker(e, su) !== null) c({ type: "kseft", uid: lok.uid, elderId: e.elderId, kSebe: false }, `KŠEFT Predsedova vila: za 2 cigarety posuň marker ${meno(e.karta.defId)} o 1 od seba`);
              if (posunMarker(e, ja) !== null) c({ type: "kseft", uid: lok.uid, elderId: e.elderId, kSebe: true }, `KŠEFT Predsedova vila: za 2 cigarety posuň marker ${meno(e.karta.defId)} o 1 k sebe`);
            }
          }
        }
      }
      if (v.ciel?.lokalita?.defId === "krcma" && naexMoznosti > 0) out.push("(Krčma: kým máš plný poldeci a kam ho dať, musíš dať NA EX — hotovo zatiaľ nejde)");
      else
        c(
          { type: "skipNaex" },
          pk?.hotovy[v.ja === 0 ? 1 : 0] === true
            ? "hotovo — súper už skončil, Pitka sa vyhodnotí (nevratné)"
            : "hotovo — končíš svoju časť Pitky (nevratné; v tejto Pitke už nedáš NA EX; súper hrá ďalej a tvoje NA EX uvidí až pri odkrytí, s Bzdochou hneď)",
        );
      break;
    }
    case "bitka": {
      const b = v.bitkaStav;
      if (b?.krok === "benzinka") {
        const obcania = [...v.strany[0], ...v.strany[1]].filter(
          (pl) => pl.playedBy === ja && !b.spalit.includes(pl.card.uid) && (DATA.cards.get(pl.card.defId)?.tags ?? []).includes("Občan"),
        );
        out.push(
          `{"type":"benzinka","uids":[…]}   — Benzínka: vyber presne ${b.benzinkaZostava[ja]} svojich Občanov z línie, ktorí sa zahodia (spália): ${obcania.map((pl) => `#${pl.card.uid} ${meno(pl.card.defId)}`).join(", ")}`,
        );
      }
      if (b?.krok === "vestica") {
        out.push(`{"type":"vestica","moja":I,"jeho":J}   — Veštica: vymeň kartu I zo svojho doberacieho balíčka za kartu J zo súperovho (zoznamy vyššie); balíčky sa potom zamiešajú`);
      }
      if (b?.krok === "kar") {
        // Kar (roadmapa #80): nepriznaná Cirhóza z ruky preč — na konci by uberala body.
        const cirhoza = v.ruka.find((k) => k.defId === "cirhoza");
        if (cirhoza !== undefined) c({ type: "kar", uid: cirhoza.uid }, "Kar: zahoď jednu nepriznanú Cirhózu z ruky (navždy z hry)");
        c({ type: "kar", uid: null }, "Kar: Cirhózu si nechať");
      }
      if (b?.krok === "cintorin") {
        // Cintorín (Michal 2026-10-27, Pozostalosť): porazený dá Nástroj z ruky alebo zo šenku do Dedičstva zadarmo.
        for (const [kde, karty] of [["z ruky", v.ruka], ["zo šenku", v.senok]] as const) {
          for (const k of karty) {
            if ((DATA.cards.get(k.defId)?.tags ?? []).includes("Nástroj")) c({ type: "cintorin", uid: k.uid }, `Cintorín: ${meno(k.defId)} ${kde} do Dedičstva zadarmo (cena Dedičstva pre oboch aj tak stúpne)`);
          }
        }
        c({ type: "cintorin", uid: null }, "Cintorín: nič nedávať do Dedičstva");
      }
      if (b?.krok === "zivnostnik") {
        // Živnostník (Výhra, Michal 2026-10-26): víťaz vyberá, ktoré súperovo Dedičstvo zahodí.
        const videne = new Set<string>();
        for (const k of v.hraci[su].dedicstvo) {
          if (videne.has(k.defId)) continue;
          videne.add(k.defId);
          c({ type: "zivnostnik", uid: k.uid }, `Živnostník: súperovi zahoď z Dedičstva ${meno(k.defId)} (navždy z hry)`);
        }
      }
      // Len markery, na ktorých posun body stačia (v8.2: pole von zo stredu 1 / 2 / 3, k stredu 2 / 3 / 4).
      const nahlad = (e: ElderState, cezPohorsenie: boolean, k: PlayerId = su): string => {
        // Ten istý výpočet ako web (nahladPosunuMarkera, nahladPosunuPrebytkom).
        const body = cezPohorsenie ? bodyNaPohorsenie(v, ja, e) : (b?.prebytokZostava ?? 0);
        const n = cezPohorsenie ? nahladPosunuMarkera(DATA, v, e.elderId, k, body) : nahladPosunuPrebytkom(DATA, v, e.elderId);
        // Ten istý smer a Telefón ako web — Nakladačka ide k tomu, kto ju rozdeľuje (ULTRA 20261030, mocky QW 1·1).
        const posun = posunZaBody(e, k, body, cezPohorsenie && telefonHraca(v, ja));
        if (n === null || posun === null) return "";
        const zn = (x: number): string => (x > 0 ? `+${x}` : x < 0 ? `${x}` : "±0");
        // Priazeň z Pohoršenia platí hneď — zmena bitky (playtest 20261026-181227-1 N2).
        const zmena = cezPohorsenie ? bitkaPoPohorseni(DATA, v, e.elderId, ja, k === ja) : null;
        const bitka = zmena === null ? "" : `; bitka (tuhé) ${zmena.pred.tuhe[ja]}:${zmena.pred.tuhe[su]} → ${zmena.po.tuhe[ja]}:${zmena.po.tuhe[su]}`;
        return ` — marker o ${posun.kroky} ${posun.kroky === 1 ? "pole" : posun.kroky <= 4 ? "polia" : "polí"} za ${posun.cena}${cezPohorsenie ? " Pohoršení" : " z Nakladačky"} (ostane ${body - posun.cena}) — NÁHĽAD: odhad špakov do konca ty ${zn(n.zmena[ja])}, súper ${zn(n.zmena[su])}; od tohto staršieho na konci kola ty +${n.spakyZaStarsieho[ja]}, súper +${n.spakyZaStarsieho[su]}, čaká na udržanie ty +${n.naUdrzanie[ja]}, súper +${n.naUdrzanie[su]}; priazeň po posune: ${n.priazen === null ? "nikto" : `${n.priazen === ja ? "ty" : "súper"} sila ${n.sila}`}${bitka}; na stupni 3 po posune (ciele pokusu o zajatie) ty ${n.vydeseni[ja]} / súper ${n.vydeseni[su]}`;
      };
      if (b?.krok === "povery") {
        // v8.3 „Výpožička priazne“: každá Povera posunie silu priazne staršieho o stupeň k tebe, len na toto kolo.
        out.push(`(Povery ${b.poveryZostava[ja]}: každá posunie silu priazne jedného staršieho o stupeň k tebe — zníži súperovu, preklopí ju, požičia zo stredu alebo zosilní tvoju, najviac na 3. Marker sa nehýbe, strach ani udržanie sa nemenia; platí do konca kola. Obranca rozdeľuje prvý.)`);
        for (const e of v.starsi) {
          const kl = klebetyKola(v) ?? {};
          if (!poveraMozna(e, ja, kl)) continue;
          const pred = ucinnaPriazen(e, kl);
          const po = ucinnaPriazen(e, { ...kl, [e.elderId]: (kl[e.elderId] ?? 0) + (ja === 0 ? 1 : -1) });
          const kto = (u: { hrac: PlayerId | null; sila: number }): string => (u.hrac === null ? "nikto" : `${u.hrac === ja ? "ty" : "súper"} +${u.sila}`);
          c({ type: "povera", elderId: e.elderId }, `Povera na ${meno(e.karta.defId)} (${scorecardStarsieho(DATA, e).nazov}): priazeň v tomto kole ${kto(pred)} → ${kto(po)}`);
        }
      }
      if (b?.krok === "pohorsenie") {
        // v8.2: vyberáš staršieho a smer, marker ide, kým Pohoršenia stačia; nový stupeň platí až po udržaní (v8.3).
        out.push(`(Pohoršenia ${b.pohorsenieZostava[ja]}: vyber staršieho a smer — marker pôjde tak ďaleko, ako stačia. Pole von zo stredu stojí 1 / 2 / 3 (žltá, oranžová, červená), k stredu 4 / 3 / 2 (z červenej, oranžovej, žltej). Čo nevyjde na žiadny posun, prepadne.)`);
        for (const e of v.starsi) {
          if (!pohorsenieMozne(v, ja, e)) continue;
          c({ type: "pohorsenie", elderId: e.elderId }, `posuň marker ${meno(e.karta.defId)} od seba — desíš ho (súper dostane priazeň, starší sa začne báť teba)${nahlad(e, true)}`);
        }
        for (const e of v.starsi) {
          if (!pohorsenieMozne(v, ja, e, true)) continue;
          c({ type: "pohorsenie", elderId: e.elderId, kSebe: true }, `posuň marker ${meno(e.karta.defId)} k sebe — upokojuješ ho (ty dostaneš priazeň hneď, platí už v tejto bitke; starší sa začne báť súpera)${nahlad(e, true, ja)}`);
        }
      }
      if (b?.krok === "prebytok") {
        // v8: prebytok rozdeľuje ten, proti komu sa ráta (spravidla porazený); markery idú k nemu.
        const drzim = b.prebytokDrzi === ja;
        const k: PlayerId = drzim ? su : ja;
        out.push(
          drzim
            ? `(Tvoju Nakladačku ${b.prebytokZostava} rozdeľuješ ty; markery idú k súperovi. Vyberáš len staršieho, marker ide, kým zvyšok stačí (pole von zo stredu 1 / 2 / 3, k stredu 4 / 3 / 2); čo nevyjde na žiadny posun, prepadne.)`
            : `(Nakladačku súpera ${b.prebytokZostava} rozdeľuješ TY: markery idú k tebe — vyber si priazne, ktoré chceš; súpera sa tí starší začnú báť. Vyberáš len staršieho, marker ide, kým zvyšok stačí (pole von zo stredu 1 / 2 / 3, k stredu 4 / 3 / 2); čo nevyjde na žiadny posun, prepadne. Za každého posunutého staršieho cigareta.)`,
        );
        for (const e of starsiNaNakladacku(v)) {
          c(
            { type: "prebytok", elderId: e.elderId },
            drzim
              ? `Nakladačka: posuň marker ${meno(e.karta.defId)} k súperovi (súper dostane priazeň, starší sa začne báť teba)${nahlad(e, false, k)}`
              : `Nakladačka: posuň marker ${meno(e.karta.defId)} k sebe (dostaneš jeho priazeň, starší sa začne báť súpera)${nahlad(e, false, k)}`,
          );
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}

// ---- udalosti -----------------------------------------------------------------------

/** Rod hráčov z miestnosti — pre tvary hlášok motora. */
const rodyHracov: [Rod, Rod] = [null, null];

function textUdalosti(e: Event, mena: readonly string[], ja: PlayerId): string | null {
  const m = (p: number) => (p === ja ? "ty" : (mena[p] ?? `Hráč ${p + 1}`));
  switch (e.type) {
    case "log":
      return rozlozRod(e.text, rodyHracov);
    case "faza":
      return `— fáza: ${e.faza}`;
    case "tahal":
      return `${e.hrac === ja ? "ty ťaháš" : `${m(e.hrac)} ťahá`} ${kariet(e.pocet)}.`;
    case "kartyTahane":
      return `Dobral si: ${e.karty.map((k) => `#${k.uid} ${meno(k.defId)}`).join(", ")}`;
    case "manualEfekt":
      return `⚠ EFEKT, ktorý hra nevyhodnocuje automaticky: ${e.nazov} — ${e.text}`;
    case "bitkaVysledok":
      return `Bitka: tuhé ${e.damage.tuhe[ja]}:${e.damage.tuhe[ja === 0 ? 1 : 0]} (ty:súper) — vyhráva ${e.vitaz === null ? "nikto" : m(e.vitaz)}${e.prebytok > 0 ? `, Nakladačka ${e.prebytok}${e.prebytokNaRozdelenie < e.prebytok ? ` (po Puške ${e.prebytokNaRozdelenie})` : ""}` : ""}.`;
    case "pitkaRekap": {
      // Odhalená Záverečná (Michal 2026-10-27) — karta a čo v Pitke dala; efekty pri otočení sú v logu.
      const z = e.rekap.zaverecne ?? [];
      if (z.length === 0) return null;
      return z
        .map((x) => {
          const akcie = Object.entries(x.akcie).map(([a, n]) => `${a}${n > 1 ? `×${n}` : ""}`).join(", ");
          return `Odhalená Záverečná (${m(x.majitel)}): ${meno(x.defId)} — v Pitke dala ${akcie === "" ? "nič" : akcie}.`;
        })
        .join(" | ");
    }
    case "koniec":
      return `KONIEC: vyhral ${e.vitaz === null ? "nikto (remíza)" : m(e.vitaz)}. ${rozlozRod(e.dovod, rodyHracov)}${e.body ? ` Špaky ${e.body[0]}:${e.body[1]} (hráč 1 : hráč 2).` : ""}`;
    default:
      return null;
  }
}

function vypisStav(s: Spojenie, udalosti: readonly string[]): void {
  if (udalosti.length > 0) {
    console.log("ČO SA MEDZITÝM STALO:");
    for (const u of udalosti) console.log(`  ${u}`);
    console.log("");
  }
  const view = s.view;
  if (view === null) {
    console.log(`Partia ešte nezačala — súper sa nepripojil do miestnosti ${relacia.kod}. Zavolaj: cakaj`);
    return;
  }
  console.log(vykresli(view, s.mena));
  const m = moznosti(view);
  console.log("");
  if (view.koniec !== null) console.log("Hra skončila. Napíš spätnú väzbu.");
  else if (m.length > 0) {
    console.log("MOŽNÉ ŤAHY (pošli príkazom: tah '<json>'):");
    for (const x of m) console.log(`  ${x}`);
  } else console.log("Nie si na ťahu — zavolaj: cakaj");
}

// ---- zmeškané udalosti ---------------------------------------------------------------

// Každý príkaz je nový proces a nové spojenie — čo súper urobil medzi dvoma príkazmi, prišlo
// len v histórii miestnosti. Bez nej v logu chýbalo napr. otočenie Záverečnej a Pohoršenia
// v bitke (playtest 20261026-173610-3, hrac2, N10). Chvost videných hlášok drží súbor.

/** Typy udalostí, ktoré server ukladá do histórie (DO_HISTORIE v packages/server/src/server.ts). */
const DO_HISTORIE: ReadonlySet<Event["type"]> = new Set(["log", "tahal", "manualEfekt", "bitkaVysledok", "moment", "koniec"]);
const CHVOST = 12;
const suborChvosta = join(mojDir, "historia-chvost.json");

/** Hlášky z histórie, ktoré tento hráč ešte nevidel (prvý príkaz relácie: žiadne). */
function zmeskaneHlasky(texty: readonly string[]): string[] {
  if (!existsSync(suborChvosta)) return [];
  const chvost = JSON.parse(readFileSync(suborChvosta, "utf8")) as string[];
  if (chvost.length === 0) return [...texty];
  for (let i = texty.length; i >= chvost.length; i--) {
    if (chvost.every((x, j) => texty[i - chvost.length + j] === x)) return texty.slice(i);
  }
  // História je orezaná (najviac 600 udalostí) — aspoň posledné hlášky.
  return texty.slice(-20);
}

function ulozChvost(texty: readonly string[]): void {
  writeFileSync(suborChvosta, JSON.stringify(texty.slice(-CHVOST)));
}

// ---- príkazy -------------------------------------------------------------------------

async function main(): Promise<void> {
  if (prikaz === "karty") {
    const s = await pripoj();
    const cards = (s.sada.cardsJson as { cards: { id: string; name: string; tags: string[]; effect_text: string; left: { actions: Record<string, number>; blocked: number[] }; right: { actions: Record<string, number>; blocked: number[] } }[] }).cards;
    // Počet kópií ako pri rozdaní (setupGame): Náradie a Občania, štartovky, starší, lokality, kliatby.
    const kopie = (c: (typeof cards)[number]): string => {
      const start = KONSTANTY.START_RUKA[c.id];
      if (start !== undefined) return `štartovacia: ${start}× v ruke každého hráča, v Náradí, Občanoch ani v šenku nie je`;
      if (c.tags.includes("Lokalita")) return "lokalita: 1 kus (do hry ide len časť lokalít)";
      if (c.tags.includes("Starešina")) return "starší: 1 kus na ukazovateli (do ruky len ako boss pri súperovom pokuse o zajatie)";
      if (c.id === "cirhoza") return "kliatba: v balíčku nie je, vzniká počas hry (bez limitu)";
      return `${KONSTANTY.KOPIE_V_SPOLOCNOM_BALICKU} kópie v balíčku ${c.tags.includes("Nástroj") ? "Náradie" : "Občania"} (každá s náhodným rozložením akcií)`;
    };
    for (const c of cards) {
      const a = (x: Record<string, number>) => Object.entries(x).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ") || "—";
      console.log(`${c.name} [${c.tags.join(", ")}] — ${c.effect_text}\n   počet: ${kopie(c)}\n   akcie vľavo: ${a(c.left.actions)} | vpravo: ${a(c.right.actions)} (rozloženie na pozíciách sa líši podľa kópie)`);
    }
    s.ws.close();
    return;
  }

  let s = await pripoj();
  DATA = loadGameData(s.sada.cardsJson, eldersJson, s.sada.scorecardsJson);
  if (s.view === null) {
    // Súper (človek) sa ešte nepripojil — stav partie zatiaľ neexistuje.
    const limit = prikaz === "cakaj" ? Number(arg ?? "600") * 1000 : 0;
    const zaciatok = Date.now();
    while (s.view === null) {
      const m = await s.dalsia(limit - (Date.now() - zaciatok));
      if (m === null) {
        console.log(`Súper sa ešte nepripojil do miestnosti ${relacia.kod} (${zaklad}/hra?kod=${relacia.kod}). Zavolaj znova: cakaj`);
        s.ws.close();
        process.exit(2);
      }
      if (m.typ === "state") s.view = m.view;
      else if (m.typ === "error") throw new Error(m.text);
      else {
        await new Promise((ok) => setTimeout(ok, 1500));
        s = await pripoj();
      }
    }
  }
  const ja = s.view.ja;
  const txt = (events: readonly Event[]) => events.map((e) => textUdalosti(e, s.mena, ja)).filter((t): t is string => t !== null);
  const videne = txt(s.historia);
  const zmeskane = zmeskaneHlasky(videne);
  if (zmeskane.length > 0) zapis(`(zmeškané) ${zmeskane.join(" | ")}`);
  /** Udalosti zo servera, ktoré pribudnú aj do histórie — chvost sa s ňou neskôr porovná. */
  const pamataj = (events: readonly Event[]): void => {
    videne.push(...txt(events.filter((e) => DO_HISTORIE.has(e.type))));
    ulozChvost(videne);
  };
  pamataj([]);

  if (prikaz === "stav") {
    vypisStav(s, zmeskane);
  } else if (prikaz === "cakaj") {
    const limit = Number(arg ?? "600") * 1000;
    const zaciatok = Date.now();
    const udalosti: string[] = [];
    // Stavbu šenku hrajú obaja naraz — čaká sa, kým smiem hrať, nie na „na ťahu“.
    while (s.view !== null && s.view.koniec === null && !s.view.mozemHrat) {
      const m = await s.dalsia(limit - (Date.now() - zaciatok));
      if (m === null) {
        if (udalosti.length > 0) zapis(`(čakanie) ${udalosti.join(" | ")}`);
        console.log(`Súper ešte hrá (čakal som ${Math.round((Date.now() - zaciatok) / 1000)} s). Zavolaj znova: cakaj`);
        for (const u of [...zmeskane, ...udalosti]) console.log(`  ${u}`);
        s.ws.close();
        process.exit(2);
      }
      if (m.typ === "state") {
        s.view = m.view;
        udalosti.push(...txt(m.events));
        pamataj(m.events);
      } else if (m.typ === "zatvorene") {
        await new Promise((ok) => setTimeout(ok, 1500));
        s = await pripoj();
      }
    }
    if (udalosti.length > 0) zapis(`(medzitým) ${udalosti.join(" | ")}`);
    vypisStav(s, [...zmeskane, ...udalosti]);
  } else if (prikaz === "tah") {
    if (arg === undefined) throw new Error("Chýba JSON príkazu.");
    const cmd = JSON.parse(arg) as Command;
    s.ws.send(JSON.stringify({ type: "cmd", cmd }));
    let m = await s.dalsia(15_000);
    // Miesto na chvíľu prevzala snímka z prehliadača — pošli ťah ešte raz.
    if (m?.typ === "zatvorene" || (m?.typ === "error" && m.text.includes("prevzal"))) {
      await new Promise((ok) => setTimeout(ok, 1500));
      s = await pripoj();
      s.ws.send(JSON.stringify({ type: "cmd", cmd }));
      m = await s.dalsia(15_000);
    }
    if (m === null || m.typ === "zatvorene") throw new Error("Server neodpovedal.");
    if (m.typ === "error") {
      zapis(`ŤAH ${arg} → ODMIETNUTÝ: ${m.text}`);
      console.log(`ŤAH ODMIETNUTÝ: ${m.text}`);
      s.ws.close();
      process.exit(1);
    }
    s.view = m.view;
    pamataj(m.events);
    const u = txt(m.events);
    zapis(`ŤAH ${arg} → ${u.join(" | ")}`);
    vypisStav(s, [...zmeskane, ...u]);
  } else {
    throw new Error(`Neznámy príkaz ${prikaz}.`);
  }
  s.ws.close();
}

main().catch((err: unknown) => {
  console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
