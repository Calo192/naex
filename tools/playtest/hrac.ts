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
import type { ActionSums, CardInstance, CenyKliatob, ClientState, DopadyNahladu, Command, DruhMarkera, Event, GameData, PlacedCard, PlayerId, Pohlavie, Rod, Slot, StarsiVerejne, Stupen, VerejnyStav, Zdvih } from "@naex/core";
import {
  naexZaPitku,
  stavZavislosti,
  textNeresti,
  jeCoTahat,
  KONSTANTY,
  cakaSBzdochou,
  hraVPitke,
  jeFinaleNaNastenke,
  STAV_STARSIEHO,
  planRozdelenia,
  navrhRozdelenia,
  kandidatiRozdelenia,
  krokRozdelenia,
  bodyRozdelenia,
  markerRozdelenia,
  cenaDalsiehoStupna,
  cenaDvihnutia,
  cenaZdvihu,
  dalsiStupenReci,
  krokyZdvihu,
  opisReci,
  sMarkerom,
  pohladPoRozdeleni,
  pultStarsich,
  NAZVY_ZON,
  CERVENA,
  skladPonuka,
  priazenPre,
  spakyOdStarsieho,
  ktoNatacaLokalitu,
  cigariet,
  spakov,
  battleOutcome,
  nahladZajatia,
  vyberyAkcii,
  cenaAkcieUplna,
  ponukaSchopnostiVazna,
  stavSchopnostiVaznaZPohladu,
  spakyTeraz,
  cenaKliatby,
  rozlozRod,
  nahladNaexNaKartu,
  najhorsiaOdpovedNaNaex,
  dopadyNahladu,
  nahladPitky,
  sMojimiSkrytymiNaex,
  krokStavby,
  cieleOdpovede,
  cieleVykladania,
  ponukaPodlozenia,
  ponukaSenku,
  skoncilVykladanie,
  popisPodlozenych,
  cielLokalitaId,
  evaluateLine,
  hrozbaNaex,
  nerozdelenaHadka,
  barterCena,
  limitBuduceKolo,
  limitPoPitke,
  limitZhromazdenia,
  lineState,
  loadGameData,
  dovodZakazuFajcit,
  cenaFajceniaHraca,
  prveFajcenieZadarmo,
  sDlhmiPoradkyne,
  zakazVypit,
  nahladVylozenia,
  sPrilozenou,
  moznostiNaexVPohlade,
  naexLimitMinuty,
  hrozbaKliatob,
  mozeEsteNaex,
  textHrozbyKliatob,
  prahyHraca,
  printedSides,
  scorecardStarsieho,
  stranyLokality,
  stolPriPoskodeni,
  poskodenieStola,
  dalsiePitkyKola,
  krajeStran,
  prevahaStran,
  vydesil,
  vidiVolbuSupera,
  zablokovaneStrany,
  maxZoSenku,
} from "@naex/core";
import { bzdochaText, prehraNaexText, prehraText, stavkaText, superoveSkryteNaex, sVidenymiSkrytymiNaex, vystrahaPeceneText } from "./texty-hraca.ts";

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

/** Koniec línie, kde ležia karty strany p — konce nepatria hráčom (Michal 2026-11-08), menujú sa krajom lokality. */
function koniecLinie(v: ClientState, p: PlayerId): string {
  const kraj = krajeStran(DATA, v.ciel?.lokalita ?? null, v.lokalitaOtocena)[p];
  const kde = p === v.ja ? "vľavo" : "vpravo";
  return kraj === null ? `koniec línie ${kde}` : `koniec línie ${kde} (kraj „${kraj}“)`;
}

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

/** Stupeň slovom aj číslom — „oranžová (2)“; 0 pri rečiach = žiadne. */
const stupenText = (st: number): string => `${NAZVY_ZON[st] ?? "?"} (${st})`;
const reciText = (st: number): string => (st === 0 ? "žiadne" : stupenText(st));
/** Špaky, ktoré starší dá hráčovi p po bitke pri jeho výhre a prehre. */
const spakovStarsieho = (e: Pick<StarsiVerejne, "strach" | "reci" | "reciOd">, p: PlayerId): { vyhra: number; prehra: number } => ({ vyhra: spakyOdStarsieho(e, p, true), prehra: spakyOdStarsieho(e, p, false) });

/** Ceny stupňov a špaky za ne z konštánt jadra (v11) — text pre AI nesmie mať čísla natvrdo. */
/** Pády názvov stupňov — „do žltej“, „na žltú“. */
const DO_STUPNA = ["sivej", "žltej", "oranžovej", "červenej"] as const;
const NA_STUPEN = ["sivú", "žltú", "oranžovú", "červenú"] as const;
const CENY_STUPNOV = [1, 2, 3].map((st) => `do ${DO_STUPNA[st]} ${KONSTANTY.CENA_STUPNA[st]}`).join(", ");
const HODNOTY_STUPNOV = [1, 2, 3].map((st) => `${NAZVY_ZON[st]} ${KONSTANTY.HODNOTA_STUPNA[st]}`).join(", ");
/** Čo páli Dlhy pred bitkou — karty z dát, ktoré Robotám pridávajú (Fúrik, Kôň…), aby text nezastaral so sadou. */
function paliDlh(): string {
  const karty = [...DATA.cards.values()].filter((d) => /pál\S* .*Dlh/.test(d.effectText)).map((d) => d.name);
  return `pália ich Roboty v línii${karty.length > 0 ? ` (viac s: ${karty.join(", ")})` : ""}, zvyšok exekúcia`;
}

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
        // Preškolená akcia (Nástroj pod kartou, Školiteľ): „Robota→Pecka“ — ráta sa ako tá druhá.
        const akcia = st?.povodna !== undefined ? `${st.povodna}→${st.action}` : a;
        return st === null || st === undefined ? a : `${akcia}${ZNAK[st.stav]}${st.nasobok > 1 ? `×${st.nasobok}` : ""}`;
      })
      .join(", ");
  };
  return `  #${k.uid} ${meno(k.defId)}${otocena ? " (otočená k tebe nohami hore)" : ""}${poznamka}${e?.vzbura === true ? " VZBURA" : ""}${e?.forsaz === true ? " FORSÁŽ (všetky aktívne akcie ×2)" : ""}\n      ${popisHran[0]}: ${strana("left")}\n      ${popisHran[1]}: ${strana("right")}`;
}

/**
 * Výhľad Pitky hráča p (Michal 2026-10-21): pečeň a zadĺženie „po Pitke“ —
 * ten istý výpočet ako vyhodnotenie (nahladPitky). Mimo Zhromaždenia a Pitky null.
 */
function vyhladPitkyText(v: ClientState, p: PlayerId): string | null {
  if (v.ciel === null || (v.faza !== "zhromazdenie" && v.faza !== "pitka")) return null;
  const n = nahladPitky(DATA, { ...v, hraci: v.hraci })[p];
  const cC = cenaKliatby("cirhoza");
  const cD = cenaKliatby("dlh");
  const kedy = v.faza === "pitka" ? "po Pitke" : "v najbližšej Pitke";
  const kliatby: string[] = [];
  if (n.cirhozy > 0) kliatby.push(`Cirhóza ×${n.cirhozy} (nepriznaná na konci ${spakov(n.cirhozy * cC)})`);
  if (n.dlhy > 0) kliatby.push(`Dlh ×${n.dlhy}${cD !== 0 ? ` (${spakov(n.dlhy * cD)})` : " (k Exekútorovi)"}`);
  // Zadĺženie len s prahom nad 1 (Výherný automat); inak karty na stole rovno dajú Dlhy (v11.8).
  const dlh = n.prahDlhu > 1 || n.zadlzenie > 0 ? { stav: `, zadĺženie ${n.zadlzenie} ▸ ${n.zadlzenie + n.zadlzenieZoStola}/${n.prahDlhu}`, stol: `zadĺženie ${n.zadlzenieZoStola}` } : { stav: "", stol: `Dlhy ${n.zadlzenieZoStola}` };
  return `pečeň ${n.pecen} ▸ ${n.pecen + n.pecenZoStola}/${n.prahPecene}${dlh.stav} → ${kedy}: ${kliatby.length > 0 ? kliatby.join(", ") : "žiadna kliatba"} (karty na stole pripíšu pečeň ${n.pecenZoStola}, ${dlh.stol}; za každý celý prah jedna kliatba)`;
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
  const makke = [ja, su].filter((p) => d[p].makke !== 0).map((p) => `${kto(p)} ${znak(d[p].makke)} (spolu ${d[p].makkeSpolu})`);
  if (makke.length > 0) casti.push(`mäkké poškodenie do hádky (Pohoršenie 2, Povera 1): ${makke.join(", ")}`);
  return casti.length === 0 ? "" : `; ${casti.join("; ")}`;
}

/** Cena NA EX na kartu uid pre oboch — ten istý náhľad ako na webe (nahladNaexNaKartu, návrh #49). */
function cenaNaexText(v: ClientState, uid: number): string {
  const ja = v.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const ceny = ([0, 1] as const).map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [CenyKliatob, CenyKliatob];
  const n = nahladNaexNaKartu(DATA, v, uid, ceny);
  if (n === null) return "";
  const pre = (p: PlayerId): string => {
    const k = n.kliatby[p];
    const c = k.cirhozy + k.dalejCirhozy;
    const d = k.dlhy + k.dalejDlhy;
    if (c === 0 && d === 0) return "nič";
    const poBitke = d !== k.dlhyPoBitke ? ` → po bitke ${k.dlhyPoBitke} (${paliDlh()})` : "";
    return `${c !== 0 ? `Cirhóza ${c > 0 ? "+" : "−"}${Math.abs(c)} (nepriznaná na konci −${spakov(KONSTANTY.SPAKY_ZA_CIRHOZU)}; priznaná nič, ale súper za ňu +1 tuhé v každej bitke) ` : ""}${d !== 0 ? `Dlh ${d > 0 ? "+" : "−"}${Math.abs(d)}${poBitke} ` : ""}(${k.body < 0 ? "−" : "+"}${Math.abs(k.body)} špakov)`;
  };
  const dopady = dopadyText(n.dopady, ja);
  const o = n.odkrytie;
  // Vo finále sa Nakladačka nerozdeľuje (prebytokNaRozdelenie vráti 0) — Puška by bola falošná.
  const finale = v.ciel?.typ === "finale";
  const prebytok = (x: typeof n.prebytokPo): string =>
    x.drzi === null || x.prebytok === 0
      ? "žiadny"
      : finale
        ? `${x.prebytok} ${x.drzi === ja ? "tebe" : "súperovi"} na špaky (finále 1 : 1)`
        : `${x.prebytok} na ${x.drzi === ja ? "tvoj" : "súperov"} strach${x.naRozdelenie !== x.prebytok ? ` (Puška −${x.prebytok - x.naRozdelenie})` : ""}`;
  const navyse = [
    o.svokra > 0 ? `Svokra súpera: za toto NA EX na jeho kartu ti v bitke udelí ${o.svokra === 1 ? "Ranu" : `${o.svokra} Rany`} (v tuhom už je)` : "",
    o.kar ? "Kar: pečeň za toto NA EX dostane súper, nie ty" : "",
  ].filter((x) => x !== "");
  // Najhoršia verejne možná odpoveď (playtest 20261026-173610-3 N5) a limit po NA EX na túto kartu (akcie Poldeci).
  const odp = najhorsiaOdpovedNaNaex(DATA, n);
  const odpoved =
    odp === null
      ? ""
      : `, po najhoršej možnej odpovedi súpera až ${odp.damage.tuhe[ja]}:${odp.damage.tuhe[su]} (napr. ${meno(odp.karta.defId)} na ${koniecLinie(v, odp.strana)}; jeho ruku nevidíš)`;
  // v12.2: poldeci z NA EX chýba v ďalšom Zhromaždení kola; po bitke sa obnoví.
  const dalsie = v.pitkaCislo < v.pitkyCelkom;
  const limitPo = dalsie ? limitPoPitke(n.odkrytie.view, ja, DATA) : limitBuduceKolo(n.odkrytie.view, ja, false, DATA);
  const bez = sMojimiSkrytymiNaex(DATA, v);
  const limitBez = dalsie ? limitPoPitke(bez, ja, DATA) : limitBuduceKolo(bez, ja, false, DATA);
  const limit = `; ${dalsie ? "v ďalšom Zhromaždení" : "v ďalšom kole"} limit ${limitPo === limitBez ? `ostane ${limitBez}` : `${limitPo} namiesto ${limitBez}`}`;
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
    `=== Kolo ${v.kolo}, fáza ${v.faza}${v.faza === "pitka" ? ` ${v.pitkaCislo}/${v.pitkyCelkom}` : ""}${v.faza === "zhromazdenie" ? ` (pred Pitkou ${v.pitkaCislo + 1}/${v.pitkyCelkom})` : ""}${v.vizia !== null ? " (VÍZIA)" : ""}${v.hasicVolba !== null ? " (HASIČ)" : ""}${v.bitkaStav?.krok ? ` (krok ${v.bitkaStav.krok})` : ""} — na ťahu: ${v.draftStav?.krok === "stavba" ? "obaja naraz (stavba ponuky)" : kto(v.naTahu)} ===`,
  );
  // Súperovo NA EX z Bzdochy patrí do hlavičky: v strede dlhého výpisu ho Agresor prehliadol (playtest 20261106).
  const bzdocha = bzdochaText(DATA, v);
  if (bzdocha !== null) out.push(bzdocha);
  if (v.koniec !== null) {
    out.push(`KONIEC HRY: vyhral ${kto(v.koniec.vitaz)}. ${rozlozRod(v.koniec.dovod, rodyHracov)}${v.koniec.body ? ` Špaky: ty ${v.koniec.body[ja]}, súper ${v.koniec.body[su]}.` : ""}`);
  }
  out.push(
    `Ty si ${mena[ja]} (${v.utocnik === ja ? "útočník — z ponuky berieš druhý, vykladáš prvý a na NA EX odpovedáš prvý (lícom dole)" : "obranca — vyberáš cieľ kola, natáča ho víťaz minulej hádky, z ponuky berieš prvý (na prvom ťahu len 1 kartu), vykladáš druhý a na NA EX odpovedáš druhý (na druhý kraj línie)"}), súper ${mena[su]}. Hrá sa o ${v.lokalitCelkom} ${v.lokalitCelkom <= 4 ? "lokality" : "lokalít"} a potom FINÁLE${v.rozpis !== undefined ? ` (úrovne lokalít po kolách ${v.rozpis.map((u) => (u === 4 ? "P" : String(u))).join(" · ")}; úroveň = počet akcií na hrane lokality; obranca vyberá zo všetkých neodohraných lokalít úrovne kola; finále je bitka o pinnacle lokalitu ako o každú inú, vyberá a natáča ju obranca — vedúci; útočí zaostávajúci (menej špakov, pri rovnosti porazený poslednej bitky); Pitky podľa spojov s lokalitou, 1–5)` : ""}${v.ciel?.typ === "finale" ? " — TERAZ JE FINÁLE na pinnacle lokalite" : ""}; odohraných bitiek ${v.nastenka.length}. ŠPAKY (víťazné body): ty ${v.spaky[ja]}, súper ${v.spaky[su]}${v.spakyNaSekere > 0 ? `, na sekere ${v.spakyNaSekere}` : ""}. Limit ruky nie je; na začiatku kola si každý dobere ${KONSTANTY.DOBRATIE_PO_BITKE} karty, nech má v ruke koľkokoľvek. Ďalší Nástroj do Dedičstva stojí ${v.cenaDedicstva} cig. (cena rastie pre oboch). Pitiek v bitke = 1 + menší počet aktivovaných akcií karty v strede (z dvoch strán).`,
  );

  // Stôl po prípadnom vyhodnotení — rovnako ako klient. V strede leží lokalita.
  // Moje skryté NA EX sú pre mňa dané: stôl, odhad bitky, hrozby aj výhľad Pitky ich
  // rátajú tak, ako ich motor zúčtuje pri odkrytí — ako web (sMojimiSkrytymiNaex).
  // S Bzdochou aj súperove skryté NA EX, ktoré server poslal (playtest 20261028-090549: hrali naslepo).
  const vs = sVidenymiSkrytymiNaex(DATA, v);
  const mojeSkryteNaex = (v.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja);
  const jehoSkryteNaex = superoveSkryteNaex(v);
  const vidimCezBzdochu = v.pitkaStav !== null && vidiVolbuSupera(DATA, v, ja);
  // Dlh Finančnej poradkyne v súčtoch súpera, ako ho pripíše Pitka.
  const lineEval = sDlhmiPoradkyne(DATA, vs, evaluateLine(DATA, lineState(vs)));
  // Celý verejný stôl: Šofér, Vychovávateľka, Pasca a Vidly čítajú aj NA EX v kole, schopnosti väzňov a špaky (playtest v7 131033).
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
      `${p === ja ? "TVOJE ZDROJE" : "SÚPEROVE ZDROJE"}: poldeci plné ${h.poldeciPlne}, vypité ${h.poldeciVypite} (limit vykladania = plné ${limitZhromazdenia(v, p)}, po bitke ${limitBuduceKolo(vs, p, false, DATA)}) | cigarety ${h.cigarety} | pečeň ${h.pecen}/${pr.cirhoza} | pečeň žije len počas Pitky${pr.dlh > 1 || h.zadlzenie > 0 ? `, zadĺženie ${h.zadlzenie}/${pr.dlh} ostáva na účte aj do ďalšieho kola (D6)` : ""} | priznané dlhy ${pr.priznaneDlhy} (Exekútor v každej bitke: zhorí polovica nahor a rovnako veľa špakov — teraz ${pr.exekucia}${pr.priznaneDlhy > 0 && pr.exekucia === 0 ? ", Záhradkár ťa obíde" : ""}; pri remíze v bitke prehráva viac Dlhov) | Absťáky ${h.abstaky} v balíčku (karty, počet verejný) | nepriznané Cirhózy ${v.nepriznaneKliatby[p].cirhoza} (verejný počet) | ruka ${h.rukaPocet}, balíček ${h.doberaciPocet}, odhodené ${h.odhadzovaci.length}${poSkrytom}`,
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
      `  CHUŤ ${z.chut} | dnes ${z.teraz}${z.naexNaStole > 0 ? ` (z toho ${z.naexNaStole} NA EX na stole, každé za ${KONSTANTY.NEREST_NAEX})` : ""}${z.doBezpecia > 0 ? ` | chýba ${z.doBezpecia}` : ""} → ${vyhlad}; Chuť po kole ${z.chutPo}. ABSŤÁK v balíčku: ${z.abstaky} (v bitke −${z.ubera} tuhé). Nerest = Vypiť 1, NA EX ${KONSTANTY.NEREST_NAEX}, každá vyfajčená cigareta 1; doliatie, barter, ponuka a Dedičstvo nie.`,
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
      out.push(`TVOJ BALÍČEK STAVBY (${d.mojBalicek.length}; najprv Náradie, potom Občania — do ponuky dáš polovicu v ľubovoľnom mixe):`);
      for (const k of d.mojBalicek) out.push(`  ${popisKarty(k)}`);
    } else {
      out.push(
        `BRANIE ZO ŠENKU (striedavo, začína obranca — na svojom prvom ťahu len 1 kartu; inak na ťahu 1 karta za ${KONSTANTY.CENA_SENKU[1]} cigaretu alebo 2 karty za ${KONSTANTY.CENA_SENKU[2]} cigarety, poldeci sa neplatí; kto nemá cigaretu, prestane): ty ${d.noveKarty[ja]}${d.hotovo[ja] ? " (skončil si)" : ""}, súper ${d.noveKarty[su]}${d.hotovo[su] ? " (skončil)" : ""}.`,
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
          ? "odpovedá na NA EX (lícom dole)"
          : cakaSBzdochou(ps, p)
            ? "čaká s Bzdochou, kým súper skončí (potom uvidí jeho NA EX)"
            : hraVPitke(ps, p)
              ? `hrá${p === ja && mojeSkryte > 0 ? " (skryto si dal NA EX)" : ""}`
              : "čaká";
    out.push(
      `PITKA NARAZ — obaja hráte súčasne a každý skončí sám: ${kto(obr)} (obranca): ${stav(obr)} · ${kto(v.utocnik)} (útočník, na NA EX odpovedá prvý): ${stav(v.utocnik)}. „hotovo“ je nevratné; NA EX sa odkryjú naraz, keď skončia obaja. Odpovede (v9.2): najprv útočník lícom dole, potom obranca lícom dole na druhý kraj línie (ak útočník neodpovedal, na ktorýkoľvek); obe sa otočia naraz a Pitka sa vyhodnotí — posledné slovo nemá nikto.`,
    );
  }

  out.push("");
  out.push(
    v.ciel === null ? "CIEĽ KOLA: ešte nevybraný." : `CIEĽ KOLA: bitka o lokalitu ${meno(v.ciel.lokalita?.defId ?? "")}.`,
  );
  out.push("LÍNIA zľava doprava (kraj vľavo, lokalita v strede, kraj vpravo; konce línie nepatria nikomu, vykladáš na ktorýkoľvek), hrany zhora nadol tak, ako ich vidíš.");
  out.push(
    "Každá karta sa páruje VNÚTORNOU hranou (obrátenou k lokalite) so susedom bližšie k stredu; VONKAJŠIA hrana ostáva voľná pre ďalšiu kartu. Na spoji sa stretnú akcie na rovnakej pozícii zhora. ✓ aktívna, ✗ zrušená Odporom, · neaktívna (bez páru).",
  );
  out.push("Karta PATRÍ tomu, kto ju zahral (je natočená k nemu) — jej akcie a efekty sa rátajú jemu, nech leží kdekoľvek v línii. Tvoja PARTIA = tvoje karty.");
  // Prevaha (Michal 2026-10-20): akcie hrany lokality dostane, kto má v kraji viac svojich Občanov, Zvierat a Starešinov.
  const kraje = krajeStran(DATA, v.ciel?.lokalita ?? null, v.lokalitaOtocena);
  const prevaha = prevahaStran(DATA, v.strany);
  const nazovKraja = (p: PlayerId): string => (kraje[p] === null ? (p === ja ? "kraj vľavo" : "kraj vpravo") : `kraj „${kraje[p]}“ (${p === ja ? "vľavo" : "vpravo"})`);
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
  // Poldeci ako partner (v11.17): nespárovaný Odpor NA EX zahasí, nespárované Posilnenie podrží aktívne akcie.
  const stitText = (uid: number): string => {
    const stit = lineEval.cards.get(uid)?.naexStit;
    return stit === "Odpor" ? " — nespárovaný Odpor ho ZAHASIL (karta sa ráta ako bez NA EX, kým sa Odpor nespáruje)" : stit === "Posilnenie" ? " — nespárované Posilnenie ho podrží: aktívne akcie karty nezruší, neaktívne zdvojí" : "";
  };
  // Zrážka (playtest 20261027-062058): pri dvoch NA EX na jednej karte treba oboch.
  const naexText = (pl: PlacedCard): string =>
    pl.naexBy === undefined
      ? ""
      : `, NA EX: ${kto(pl.naexBy)}${pl.naexBy2 !== undefined ? ` aj ${kto(pl.naexBy2)} — zrážka${pl.vytrznik === true ? ", z karty je Výtržník" : ""}` : ""}${skryteText(pl.card.uid)}${stitText(pl.card.uid)}`;
  const podlozeneText = (pl: PlacedCard): string =>
    (pl.podlozene ?? []).length === 0 ? "" : `, pod ňou: ${popisPodlozenych(DATA, pl).map((t, i) => `${t} — ${kto(pl.podlozene?.[i]?.majitel ?? ja)}`).join("; ")}`;
  const zaverecnaText = (pl: PlacedCard): string =>
    pl.zaverecna !== true ? "" : pl.odpoved === true ? ", TVOJA ODPOVEĎ NA NA EX lícom dole — súper ju nevidí, otočí sa s jeho odpoveďou" : ", TVOJA ZÁVEREČNÁ lícom dole — súper ju nevidí";

  const moja = [...vs.strany[ja]].reverse();
  for (const pl of moja)
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} vľavo${zaverecnaText(pl)}${naexText(pl)}${podlozeneText(pl)}]`, [
        "vonkajšia hrana",
        "vnútorná hrana (k lokalite)",
      ]),
    );
  if (v.ciel !== null && v.ciel.lokalita !== null) {
    const popis = " [LOKALITA]";
    out.push(kartaVLinii(v.ciel.lokalita, v.lokalitaOtocena !== (ja === 1), lineEval, popis, [`hrana VĽAVO — ${nazovKraja(ja)}`, `hrana VPRAVO — ${nazovKraja(su)}`]));
  } else out.push("  (stred línie — ešte nič)");
  for (const pl of vs.strany[su])
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} vpravo${zaverecnaText(pl)}${naexText(pl)}${podlozeneText(pl)}]`, [
        "vnútorná hrana (k lokalite)",
        "vonkajšia hrana",
      ]),
    );
  // Záverečná súpera (roadmapa #83): leží lícom dole na konci línie, nevieš čo to je.
  for (const z of vs.zaverecne.filter((x) => x.majitel !== ja))
    out.push(`  [SÚPEROVA ${z.odpoved === true ? "ODPOVEĎ NA NA EX" : "ZÁVEREČNÁ"} lícom dole — ${koniecLinie(v, z.strana)}${z.naexBy !== null ? `, NA EX: ${kto(z.naexBy)}${skryteText(z.uid)}` : ""} — nevieš, čo to je, ráta sa do bitky (v súčtoch nižšie chýba); za ňu sa nedá priložiť, ${z.odpoved === true ? "otočí sa spolu s odpoveďou druhého hráča, pred vyhodnotením Pitky" : "otočí sa na konci Pitky"}]`);

  const sumy = (p: PlayerId) => Object.entries(lineEval.sums[p]).map(([a, n]) => `${a} ${n}`).join(", ") || "nič";
  out.push(`Tvoje aktívne akcie (tvoja partia + akcie lokality, ktoré aktivuje tvoja karta): ${sumy(ja)}`);
  out.push(`Súperove aktívne akcie: ${sumy(su)}`);
  if (v.ciel !== null && v.koniec === null) {
    // Priznané Dlhy (strop mäkkého, remíza, Vymáhač) také, aké budú pri poškodení: s Dlhmi z Pitiek kola,
    // exekúcia až po poškodení (v8, 3ab061b) — ako hrozba a najhoršia odpoveď v jadre.
    const d = v.bitkaStav?.damage ?? poskodenieStola(DATA, stolPriPoskodeni(DATA, vs, dalsiePitkyKola(DATA, vs)));
    const nerozdelena = v.bitkaStav?.damage == null ? nerozdelenaHadka(DATA, { ...stol, lokalitaOtocena: v.lokalitaOtocena, bitkaStav: v.bitkaStav }, lineEval.sums) : null;
    const finaleHadky = v.ciel.typ === "finale";
    out.push(
      `${v.bitkaStav?.damage ? "VÝSLEDOK BITKY" : "ODHAD BITKY (podľa línie)"}: tuhé poškodenie ty ${d.tuhe[ja]} : súper ${d.tuhe[su]}; mäkké (hádka) ty ${d.makke[ja]} : súper ${d.makke[su]} — kto má viac mäkkého, vyhrá hádku o rozdiel a ${finaleHadky ? "vo finále dostane za každý bod špak" : "po bitke ho rozdelí na svoje reči (v11; bitku, priazne ani strach hádka nemení)"}.`,
    );
    const o = battleOutcome(d);
    const finale = v.ciel.typ === "finale";
    // Stávku ráta jadro (stavkaBitky) ako výplata — Noviny, Herňa, sekera, Kultúrny dom (playtest 20261028-090549-2, Jano).
    const stavka = stavkaText(DATA, v);
    out.push(
      `  → ${o.vitaz === null ? "REMÍZA V TUHOM — rozhodnú Absťáky (menej vyhrá), potom priznané Dlhy (menej vyhrá), inak sekera" : o.vitaz === ja ? "vyhrávaš" : "prehrávaš"}. ${stavka === null ? "" : `${stavka} `}Špaky za bitku (v8): 1 za každú kartu v línii na oboch stranách (Absťáky ich od v8.1 neuberajú), aspoň ${KONSTANTY.SPAKY_ZA_BITKU_MIN} — každá ďalšia karta v línii pridá víťazovi špak; lokalitu si nikto neberie. Sekera: špaky kola vezme víťaz ďalšej bitky${finale ? " — vo finále prepadnú" : ""}; útočník ostáva, cigaretu nedostane nikto. Nakladačka (rozdiel tuhého) ${finale ? "vo finále ide víťazovi 1 : 1 na špaky" : "patrí víťazovi bitky — po bitke ju rozdelí na svoj strach"}. Porazený dostane ${cigariet(KONSTANTY.CIGARETY_PORAZENEMU)}.`,
    );
    // Starší po bitke (v11.12, krok 4b): obaja za stupne, ktoré držia rečami, víťaz navyše za strach bez nich.
    const sp = spakyTeraz(v);
    out.push(
      `  STARŠÍ PO BITKE (bodujú podľa markerov pred Nakladačkou a hádkou): keď vyhráš ty — ty +${sp.zaStarsichVyhra[ja]}, súper +${sp.zaStarsichPrehra[su]} (len reči); keď vyhrá súper — súper +${sp.zaStarsichVyhra[su]}, ty +${sp.zaStarsichPrehra[ja]} (len reči); pri sekere obaja len reči. Potom klesnú reči zospodu o stupeň tomu, kto prehral hádku (pri remíze v hádke nikomu).`,
    );
    const vy = v.vyhry;
    out.push(
      `  OKAMŽITÉ VÝHRY (len vo vyhratej bitke): VÝHRA STRACHOM — červený strach u ${vy.cervenychNaVyhru} starších (väzni sa rátajú): ty ${vy.cervene[ja]}/${vy.cervenychNaVyhru}, súper ${vy.cervene[su]}/${vy.cervenychNaVyhru}; VÝHRA VÄZŇAMI: ty ${vy.vazni[ja]}/${vy.vazniNaVyhru}, súper ${vy.vazni[su]}/${vy.vazniNaVyhru}.`,
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
        const h = hrozbaNaex(DATA, { ...stol, lokalitaOtocena: v.lokalitaOtocena, zaverecne: v.zaverecne }, p === su ? priebehSupera : priebeh, p);
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
    // Nerozdelená hádka (v11): bitku nemení — víťaz ju po bitke rozdelí na svoje reči, vo finále na špaky.
    if (nerozdelena !== null && nerozdelena.vitaz !== null && nerozdelena.zostava > 0) {
      const p = nerozdelena.vitaz;
      out.push(
        `  HÁDKA: ${p === ja ? "vyhrávaš" : "súper vyhráva"} hádku o ${nerozdelena.zostava} → ${
          v.ciel.typ === "finale" ? `vo finále ${spakov(nerozdelena.zostava)} ${p === ja ? "tebe" : "súperovi"}` : `po bitke ${p === ja ? "ju rozdelíš na svoje reči" : "ju súper rozdelí na svoje reči"} (aj keď bitku prehrá)`
        }.`,
      );
    }
  }

  out.push("");
  const body = spakyTeraz(v);
  const pult = pultStarsich(v);
  out.push("STARŠÍ — STRACH A REČI (v11.12): pri každom staršom má každý hráč svoj teplomer 0–3 so strachom; reči kladie na teplomer SÚPERA:");
  out.push(
    `  STRACH (0 sivá, 1 žltá, 2 oranžová, 3 červená) — ako veľmi sa starší bojí hráča; neklesá. REČI — súvislý blok stupňov na SÚPEROVOM teplomere: obsadzujú sa od vrchu jeho strachu nadol, potom nad neho (zo sivej zdola nahor); keď jeho strach reči prekoná, blok sa posunie nahor a počet stupňov ostáva (spodný zanikne). Reči priazeň, strach, výhru strachom ani zajatie nemenia. ` +
      `PRIAZEŇ pre teba = súperov strach − tvoj strach (najmenej 0; reči sa nerátajú) — vyšší strach ti teda dáva body, ale súperovi priazeň. Stav staršieho podľa vyššieho strachu: ${STAV_STARSIEHO.map((x, i) => `${i} ${x}`).join(", ")}. ` +
      `PO KAŽDEJ BITKE starší bodujú (stav pred zdvihnutím): stupne majú hodnotu ${HODNOTY_STUPNOV} (spolu ${[1, 2, 3].map((st) => KONSTANTY.SPAKY_ZA_STUPEN[st]).join(" / ")}) a dostane ich ten, kto stupeň drží, reči majú prednosť — víťaz bitky za svoj strach bez stupňov, ktoré obsadil súper rečami, KAŽDÝ hráč (vyhral, prehral aj pri sekere) za stupne, ktoré obsadil rečami. Potom klesnú reči zospodu o stupeň tomu, kto prehral hádku (pri remíze v hádke nikomu). ` +
      `DVÍHANIE: víťaz bitky rozdelí Nakladačku na svoj strach, víťaz hádky hádku na svoje reči na SÚPEROVOM teplomere, Predsedova vila za každé 2 cigarety vyfajčené v Pitke pridá tvoje reči o stupeň. Stupeň stojí ${CENY_STUPNOV} (napr. strach zo sivej na červenú ${cenaDvihnutia(0, CERVENA)}), strach na stupeň so súperovými rečami o ${KONSTANTY.REC_PRIRAZKA} viac. ` +
      `ZAJATIE (v11.4, v11.6): pri rozdelení Nakladačky zajmeš za ${KONSTANTY.CENA_ZAJATIA} staršieho, pri ktorom je tvoj strach na červenej UŽ PRED touto Nakladačkou (väzeň; súper ti odovzdá toľko špakov, koľko bodov hádky má v rečiach pri ňom, najviac koľko má). PRESVEDČENIE (v11.12): pri rozdelení hádky za ${KONSTANTY.CENA_PRESVEDCENIA} ktoréhokoľvek staršieho, pri ktorom máš reči na celom súperovom teplomere (smieš ich dotiahnuť v tom istom rozdelení) — reči, strach oboch aj priazeň ostanú, jeho karta ide tebe do ruky a natrvalo do tvojho balíčka. Vo finále ani jedno.`,
  );
  out.push(
    `  ŠPAKY: ty ${body.spaky[ja]}, súper ${body.spaky[su]}; od starších po najbližšej bitke: keď ju vyhráš ty — ty +${body.zaStarsichVyhra[ja]}, súper +${body.zaStarsichPrehra[su]}; keď ju vyhrá súper — súper +${body.zaStarsichVyhra[su]}, ty +${body.zaStarsichPrehra[ja]}; nepriznaná Cirhóza na konci −${KONSTANTY.SPAKY_ZA_CIRHOZU} za kus (ty ${body.cirhozy[ja]}, súper ${body.cirhozy[su]}); výkupné na konci (plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI}, každých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1): ty +${body.vykupne[ja].spaky}, súper +${body.vykupne[su].spaky}; keby skončila teraz ty ${body.spolu[ja]}, súper ${body.spolu[su]}.`,
  );
  const vy = pult.vyhry;
  const vazni = (p: PlayerId) => v.vazni.filter((x) => x.hrac === p);
  const ciele = (p: PlayerId) => v.starsi.filter((e) => vydesil(e, p)).map((e) => meno(e.karta.defId));
  out.push(
    `  VÝHRY HNEĎ (len vo vyhratej bitke): strachom — červený strach u ${vy.cervenychNaVyhru} starších, tvoj väzeň sa ráta ako tvoja červená: ty ${vy.cervene[ja]}/${vy.cervenychNaVyhru}, súper ${vy.cervene[su]}/${vy.cervenychNaVyhru}; väzňami: ty ${vy.vazni[ja]}/${vy.vazniNaVyhru}${vazni(ja).length > 0 ? ` (${vazni(ja).map((x) => meno(x.karta.defId)).join(", ")})` : ""}, súper ${vy.vazni[su]}/${vy.vazniNaVyhru}${vazni(su).length > 0 ? ` (${vazni(su).map((x) => meno(x.karta.defId)).join(", ")})` : ""}. Červený strach (po vyhratej bitke ho zajmeš za ${KONSTANTY.CENA_ZAJATIA} z Nakladačky) — tvoj: ${ciele(ja).join(", ") || "nikde"}; súperov: ${ciele(su).join(", ") || "nikde"}.`,
  );
  for (const r of pult.riadky) {
    const e = v.starsi.find((x) => x.elderId === r.elderId);
    if (e !== undefined) out.push(popisStarsieho(e, r, kto, ja));
  }
  // Stopa zmien markerov od začiatku Zhromaždenia po bitke — čo sa s markermi stalo naposledy.
  if (v.zmenyMarkerov.length > 0) {
    const ZDROJ: Record<string, string> = {
      nakladacka: "Nakladačka",
      hadka: "hádka",
      bodovanie: "po bodovaní o stupeň nižšie",
      zanik: "zanikli pod strachom",
      presvedcenie: "zanikli presvedčením",
      vila: "Predsedova vila",
    };
    const nazovStarsieho = (id: string): string => meno(v.starsi.find((x) => x.elderId === id)?.karta.defId ?? v.vazni.find((x) => x.elderId === id)?.karta.defId ?? id);
    out.push(
      `  POSLEDNÉ ZMENY MARKEROV: ${v.zmenyMarkerov
        .map((z) => `${nazovStarsieho(z.elderId)}: ${z.hrac === ja ? "tvoj" : "súperov"} ${z.marker === "strach" ? "strach" : "reči"} ${z.marker === "strach" ? stupenText(z.z) : reciText(z.z)} → ${z.marker === "strach" ? stupenText(z.na) : reciText(z.na)} (${ZDROJ[z.zdroj] ?? z.zdroj}${z.kto !== z.hrac ? `, ${z.kto === ja ? "tvojím" : "súperovým"} ťahom` : ""})`)
        .join("; ")}`,
    );
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
    `TVOJA RUKA (${v.ruka.length}) — vytlačené strany; vľavo od lokality sa k nej obráti PRAVÁ, vpravo ĽAVÁ (karta ostáva natočená k tebe na oboch koncoch). Presný spoj ukazuje každá možnosť „vylož“:`,
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

const UCINOK: Record<string, (s: number) => string> = {
  // Priazne v9 (Michal 2026-10-30): sila 1 / 2 / 3 bez dvojnásobku.
  UZERNIK: (s) => `Kmotor: po bitke prejdú až ${s + 1} tvoje priznané Dlhy medzi súperove priznané`,
  LAKOMEC: (s) => `Abstinent: v bitke sa ti neráta ${s} Absťákov (v10)`,
  ROBOTA: (s) => `Robota: v bitke ${s} akcie Robota navyše (spália Dlh, inak 1 špak)`,
  BITKAR: (s) => `+${s} tuhého poškodenia v bitke`,
  VERIACI: (s) => `+${s} Viery v každej bitke`,
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} po bitke`,
  OHOVARACKA: (s) => `Ohováračka: +${s} ${s === 1 ? "Povera" : "Povery"} v hádke (súperova Viera ich ruší)`,
  ADVOKAT: (s) => `Advokát: exekúcia ti vezme o ${s} špakov menej (Dlhy zhoria ako vždy)`,
};

function popisStarsieho(e: StarsiVerejne, r: ReturnType<typeof pultStarsich>["riadky"][number], kto: (p: PlayerId | null) => string, ja: PlayerId): string {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const sc = scorecardStarsieho(DATA, e);
  const ucinok = (sila: number): string => UCINOK[e.priazen]?.(sila) ?? e.priazen;
  const priazen =
    r.priazenHrac === null
      ? `priazeň nikto — strachy sú rovnaké (o 1 stupeň vyšší súperov strach by ti dal: ${ucinok(1)})`
      : `priazeň ${kto(r.priazenHrac)} +${r.priazenSila} (${ucinok(r.priazenSila)})`;
  const dalsi = (marker: DruhMarkera): string => {
    const c = cenaDalsiehoStupna(e, ja, marker);
    return c === null ? "nedá sa" : `na ${NA_STUPEN[krokyZdvihu(e, ja, marker)[0]?.na ?? 0]} za ${c}`;
  };
  const ohrozenie = r.presvedcil === null ? "" : ` | PRESVEDČIL ${r.presvedcil === ja ? "SI HO TY" : "HO SÚPER"} — jeho karta je v balíčku ${r.presvedcil === ja ? "tvojom" : "súpera"}, ďalej ho nikto nepresvedčí, zajať ho smú obaja`;
  return (
    `  ${e.elderId}: ${meno(e.karta.defId)} (scorecard ${sc.nazov}), ${STAV_STARSIEHO[r.stav]}${ohrozenie}\n` +
    `      TY strach ${stupenText(e.strach[ja])}, tvoje reči na súperovom teplomere ${opisReci(e, ja)} | SÚPER strach ${stupenText(e.strach[su])}, jeho reči na tvojom teplomere ${opisReci(e, su)} | ${priazen}\n` +
    `      po bitke: keď vyhráš ty — ty +${r.vyhra[ja]}, súper +${r.prehra[su]}; keď vyhrá súper — súper +${r.vyhra[su]}, ty +${r.prehra[ja]}` +
    ` | tvoj ďalší stupeň: strach ${dalsi("strach")}, reči ${dalsi("reci")}`
  );
}

/** Rozdelenie slovami (v11): zdvihy, cena, čo prepadne a čo sa po ňom zmení pri starších. */
function popisRozdelenia(v: ClientState, marker: DruhMarkera, zdvihy: readonly Zdvih[], cena: number, zvysok: number): string {
  const ja = v.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const casti = zdvihy.map((z) => {
    const e = v.starsi.find((x) => x.elderId === z.elderId);
    if (e === undefined) return z.elderId;
    const po = sMarkerom(e, ja, marker, z.na);
    return `${meno(e.karta.defId)} ${marker === "strach" ? `strach ${stupenText(e.strach[ja])} → ${stupenText(z.na)}` : `reči ${opisReci(e, ja)} → ${opisReci(po, ja)}`} za ${cenaZdvihu(e, ja, marker, z.na) ?? 0}`;
  });
  const po = pohladPoRozdeleni(v, ja, marker, zdvihy);
  const pultPred = pultStarsich(v);
  const pultPo = pultStarsich(po);
  const priazenSupera = (x: { readonly starsi: readonly StarsiVerejne[] }): number => x.starsi.reduce((a, e) => a + priazenPre(e, su), 0);
  const strach =
    marker === "strach"
      ? `; tvoj červený strach ${pultPred.vyhry.cervene[ja]} → ${pultPo.vyhry.cervene[ja]} z ${pultPo.vyhry.cervenychNaVyhru}; súperove priazne spolu ${priazenSupera(v)} → ${priazenSupera(po)}`
      : "";
  return `${casti.join(", ")} — spolu ${cena}, PREPADNE ${zvysok}; potom tvoje špaky od starších po ďalšej bitke: pri výhre ${pultPred.vyhra[ja]} → ${pultPo.vyhra[ja]}, pri prehre ${pultPred.prehra[ja]} → ${pultPo.prehra[ja]}${strach}`;
}

// ---- možné ťahy -------------------------------------------------------------------

const hranaText = (h: readonly Slot[]): string => h.map((x) => x ?? "—").join(", ");
const zmenyText = (z: ActionSums): string =>
  Object.entries(z)
    .map(([a, n]) => `${a} ${n > 0 ? "+" : "−"}${Math.abs(n)}`)
    .join(", ") || "bez zmeny";

/** Hrany lokality pri voľbe cieľa — ktorá bude vľavo a ktorá vpravo. */
function popisStranLokality(v: ClientState, k: CardInstance, otocena: boolean): string {
  const s = stranyLokality(DATA, k, otocena, v.ja);
  return `VĽAVO: ${hranaText(s.kTebe)} | VPRAVO: ${hranaText(s.kSuperovi)}`;
}

/**
 * Náhľad vyloženia na koniec línie (playtest 20261017-164450: hrany sa
 * dali zistiť len skúšaním) — vnútorná hrana, s čím sa stretne a čo to zmení.
 */
function popisVylozenia(v: ClientState, k: CardInstance, kam: "vlastna" | "superova"): string {
  const su = (v.ja === 0 ? 1 : 0) as PlayerId;
  const line = lineState(v);
  // Konflikt a Podpora pri priložení (playtest 2026-11-09, Hela N4) — línia, akú zloží motor.
  const stranyPo = sPrilozenou(DATA, v, kam === "vlastna" ? v.ja : su, k, v.ja).strany;
  const n = nahladVylozenia(DATA, line, v.ja, k, kam, v.naexVKole, stranyPo);
  const s = n.sused;
  const spoj =
    s === null
      ? "nič sa nespojí"
      : `↔ ${s.stred ? "stred" : s.majitel === v.ja ? "tvoja karta" : "súperova karta"} ${meno(s.karta.defId)} (${hranaText(s.hrana)}): ${
          n.pary.length > 0 ? n.pary.map((p) => `${p.moja}+${p.susedova}`).join(", ") : "žiadny pár"
        }`;
  // Tuhé navyše z kariet (Pes, Recidivista…) — bonus Psa náhľad vynechal (playtest 20261026-173610-1).
  const tuhe = (q: PlayerId): string => (n.tuhe[q] === 0 ? "" : `, tuhé navyše ${n.tuhe[q] > 0 ? "+" : "−"}${Math.abs(n.tuhe[q])}`);
  const vystraha = vystrahaPeceneText(DATA, v, k, kam);
  return ` | vnútorná hrana ${hranaText(n.vnutorna)} ${spoj} | ty: ${zmenyText(n.zmeny[v.ja])}${tuhe(v.ja)} · súper: ${zmenyText(n.zmeny[su])}${tuhe(su)}${vystraha === null ? "" : ` | ${vystraha}`}`;
}

const POPIS_CIELA: Record<string, string> = {
  vlastna: "na koniec línie vľavo",
  superova: "na koniec línie vpravo (karta je tvoja na oboch koncoch, natočená k tebe)",
  priznanie: "priznať Cirhózu — je NAVŽDY mimo balíčka (čistí ho) a na konci hry nestojí 3 špaky, ale súper za ňu v bitke dostane +1 tuhé; kartu za ňu nedostaneš; nemíňa limit a neodovzdá ťah (môžeš priznať viac Cirhóz za sebou a potom ešte vyložiť)",
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
    // Voľby v7: karta zo šenku (Zastávka, Predavačka, Živnostník); frakcie (2026-11-08): Zberný dvor, vila.
    if (nv.typ === "dvor") {
      c({ type: "spal", uid: null }, "ZBERNÝ DVOR: nič nepáliť");
      for (const k of v.ruka) if (!(DATA.cards.get(k.defId)?.tags ?? []).includes("Kliatba")) c({ type: "spal", uid: k.uid }, `ZBERNÝ DVOR: spáľ z ruky ${popisKarty(k)} — navždy z hry, tenší balíček`);
      return out;
    }
    if (nv.typ === "vila") {
      for (const e of v.starsi) {
        const na = dalsiStupenReci(e, ja);
        if (na === null) continue;
        const pred = spakovStarsieho(e, ja);
        const eP = sMarkerom(e, ja, "reci", na);
        const po = spakovStarsieho(eP, ja);
        c({ type: "vila", elderId: e.elderId }, `PREDSEDOVA VILA: tvoje reči pri ${meno(e.karta.defId)} ${opisReci(e, ja)} → ${opisReci(eP, ja)} (tvoje špaky od neho po bitke: pri výhre ${pred.vyhra} → ${po.vyhra}, pri prehre ${pred.prehra} → ${po.prehra})`);
      }
      return out;
    }
    // Živnostník ponúka len Nástroje (Podpora, 2026-11-09); Predavačka (v12) hocijakú kartu navrch balíčka.
    const kto = nv.zdroj === "predavacka" ? "PREDAVAČKA" : nv.zdroj === "zivnostnik" ? "ŽIVNOSTNÍK" : "ZO ŠENKU";
    const kam = nv.kam === "balicek" ? "navrch svojho doberacieho balíčka (dobereš ju pri najbližšom ťahaní)" : "do ruky";
    for (const k of ponukaSenku(DATA, v, nv)) c({ type: "senok", uid: k.uid }, `${kto}: vezmi si z ponuky ${popisKarty(k)} zadarmo ${kam}`);
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
      // v11.11: keď natáča víťaz minulej hádky (súper), obranca vyberá len lokalitu.
      const natociSuper = ktoNatacaLokalitu(v) !== v.ja;
      for (const k of v.lokalityVHre) {
        if (natociSuper) {
          c({ type: "chooseLocation", uid: k.uid, otocena: false }, `bitka o lokalitu ${meno(k.defId)} — natočí ju súper (víťaz minulej hádky); na výber: ${popisStranLokality(v, k, false)} ALEBO ${popisStranLokality(v, k, true)}`);
          continue;
        }
        c({ type: "chooseLocation", uid: k.uid, otocena: false }, `bitka o lokalitu ${meno(k.defId)} — ${popisStranLokality(v, k, false)}`);
        c({ type: "chooseLocation", uid: k.uid, otocena: true }, `bitka o lokalitu ${meno(k.defId)}, otočenú o 180° — ${popisStranLokality(v, k, true)}`);
      }
      break;
    }
    case "natocenieCiela": {
      // v11.11: lokalitu vybral súper, natáča ju víťaz minulej hádky — ty.
      const k = v.ciel?.lokalita;
      if (k == null) break;
      c({ type: "natocLokalitu", otocena: false }, `natoč lokalitu ${meno(k.defId)} — ${popisStranLokality(v, k, false)}`);
      c({ type: "natocLokalitu", otocena: true }, `natoč lokalitu ${meno(k.defId)}, otočenú o 180° — ${popisStranLokality(v, k, true)}`);
      break;
    }
    case "draft": {
      const ds = v.draftStav;
      if (ds === null) break;
      if (ds.krok === "stavba") {
        const krok = krokStavby(ds.mojBalicek.length);
        out.push(
          `{"type":"stavbaSenku","doSenku":[${Array.from({ length: krok.doSenku }, (_, i) => `A${i + 1}`).join(",")}],"odhod":[${Array.from({ length: krok.odhod }, (_, i) => `B${i + 1}`).join(",")}]}   — z TVOJHO BALÍČKA STAVBY (vyššie) daj ${krok.doSenku} ${krok.doSenku === 1 ? "kartu" : "karty"} do ponuky (uvidia ich obaja, berie sa z neho) a ${krok.odhod} naspodok (Nástroj naspodok Náradia, ostatné naspodok Občanov; súper ich neuvidí). Nič si nepodávate. Súper vyberá naraz s tebou; karty do ponuky sa odhalia, keď vyberiete obaja.`,
        );
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
        if (cig >= (KONSTANTY.CENA_SENKU[1] ?? 1)) c({ type: "draftBer", uids: [k.uid] }, `vezmi z ponuky ${meno(k.defId)} za ${KONSTANTY.CENA_SENKU[1]} cigaretu (máš ${cig})`);
      }
      if (maxZoSenku(v, ja) < 2) out.push(`(Berieš z ponuky prvý — na prvom ťahu len 1 kartu; 2 karty za ${KONSTANTY.CENA_SENKU[2]} až na ďalšom ťahu.)`);
      else if (cig >= (KONSTANTY.CENA_SENKU[2] ?? 3) && v.senok.length >= 2)
        out.push(`{"type":"draftBer","uids":[U1,U2]}   — vezmi z ponuky DVE karty (uid z ponuky vyššie) za ${KONSTANTY.CENA_SENKU[2]} cigarety (máš ${cig}); potom berie súper`);
      break;
    }
    case "zhromazdenie": {
      const z = v.zhromazdenieStav;
      c({ type: "pass" }, "pasovať (do Pitky už nevykladáš, súper vykladá sám; za pas nič nedostaneš — v12.2; plné poldeci ti ostanú)");
      // V Zhromaždení sa nefajčí (§7) — motor smoke odmietne, preto ho ani neponúkať.
      if (zakazVypit(v)) out.push("(Kostol: v ťahu sa smie vyložiť len 1 karta)");
      // v12.2: Vypiť = ďalšia karta v ťahu — treba plný poldeci na túto aj ďalšiu kartu a cigaretu.
      if (z !== null && v.hraci[ja].poldeciPlne >= z.navyse[ja] + 2 && v.hraci[ja].cigarety >= KONSTANTY.CENA_KARTY_NAVYSE && !zakazVypit(v)) {
        c(
          { type: "vypit" },
          `VYPIŤ do dna: ďalšia karta v tomto ťahu — ${cigariet(KONSTANTY.CENA_KARTY_NAVYSE)}, pečeň +1 (vyhodnotí sa v najbližšej Pitke) a nerest; každá karta aj tak otočí svoj plný poldeci (máš ${v.hraci[ja].poldeciPlne}); ďalšou kartou ti ťah neskončí`,
        );
      }
      // Sklad (frakcie 2026-11-08): Nástroj zo šenku rovno do Dedičstva za cenu Dedičstva.
      if (z !== null && skladPonuka(DATA, v) && v.hraci[ja].cigarety >= v.cenaDedicstva)
        for (const k of v.senok) if ((DATA.cards.get(k.defId)?.tags ?? []).includes("Nástroj")) c({ type: "place", uid: k.uid, target: "dedicstvo" }, `SKLAD: ${popisKarty(k)} z ponuky rovno do Dedičstva za ${cigariet(v.cenaDedicstva)} (do ponuky príde z Náradia nový Nástroj)`);
      if (z !== null) {
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, z.zostavaLimit[ja], v.hraci[ja].cigarety >= v.cenaDedicstva, cielLokalitaId(v), zablokovaneStrany(v))) {
            c({ type: "place", uid: k.uid, target: t }, `vylož ${meno(k.defId)} → ${POPIS_CIELA[t]}${t === "vlastna" || t === "superova" ? popisVylozenia(v, k, t) : ""}`);
            if (v.zaverecnaMozna && (t === "vlastna" || t === "superova"))
              c({ type: "zaverecna", uid: k.uid, target: t }, `ZÁVEREČNÁ: ${meno(k.defId)} lícom dole → ${POPIS_CIELA[t]} za ${KONSTANTY.CENA_ZAVERECNEJ} cig.; súper ju nevidí do konca Pitky a za ňu nepriloží (ani odpoveď na NA EX), ty už v tomto Zhromaždení nevykladáš (bez cigariet za pas); Nástup až pri otočení`);
          }
        }
        // Podloženie (Náradie 2026-11-08): Nástroj pod vlastnú kartu v línii za cigaretu (v11.16 len pod svoje) — aj hrana, ktorá nič nezmení, s varovaním.
        if (v.hraci[ja].cigarety >= KONSTANTY.CENA_PODLOZENIA && !skoncilVykladanie(z, ja)) {
          const line = lineState(v);
          const vsetky = [...v.strany[0], ...v.strany[1]];
          for (const k of v.ruka) {
            for (const m of ponukaPodlozenia(DATA, line, k, ja)) {
              const host = vsetky.find((pl) => pl.card.uid === m.hostitel);
              if (host === undefined) continue;
              c(
                { type: "podloz", nastrojId: k.uid, hostitelId: m.hostitel, hrana: m.hrana },
                `PODLOŽ ${meno(k.defId)} pod svoju kartu ${meno(host.card.defId)}, ${m.hrana === "horna" ? "horná" : "dolná"} hrana: ${m.popis}${m.maCoRobit ? "" : " — NAPRÁZDNO, hrana tu nič nezmení (len minieš cigaretu a ťah)"}; za ${cigariet(KONSTANTY.CENA_PODLOZENIA)}, je to ťah, limit nemíňa; leží do bitky, potom ide do tvojho odhadzovacieho balíčka`,
              );
            }
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
        // Vízia (Michal 2026-10-19): vrchnú kartu do ruky, alebo spáliť.
        const k = v.volbaVizia;
        const zostava = v.vizia.zostava[ja];
        c({ type: "vizia", vziat: true }, `VÍZIA: vrchnú kartu balíčka ${k === null ? "" : popisKarty(k)} si vezmi do ruky${zostava > 1 ? ` (ešte ${zostava - 1} Vízie)` : ""}`);
        c({ type: "vizia", vziat: false }, "VÍZIA: vrchnú kartu SPÁĽ — je navždy preč z hry (kliatba, slabá karta)");
        const k2 = v.volbaViziaDruha ?? null;
        if (k2 !== null) {
          // Krištáľová guľa (Náradie 2026-10-30): o druhej karte zhora; vrchná ostane navrchu.
          c({ type: "vizia", vziat: true, druha: true }, `VÍZIA (Krištáľová guľa): DRUHÚ kartu zhora ${popisKarty(k2)} si vezmi do ruky — vrchná ostane navrchu`);
          c({ type: "vizia", vziat: false, druha: true }, "VÍZIA (Krištáľová guľa): DRUHÚ kartu zhora SPÁĽ — vrchná ostane navrchu");
        }
        break;
      }
      const h = v.hraci[ja];
      const pk = v.pitkaStav;
      if (pk?.reakcia === ja) {
        // Odpoveď na súperovo NA EX (v9.2): jedna karta lícom dole za plný poldeci (v11.16), mimo limitu;
        // po útočníkovi obranca len na druhý kraj línie. Otočia sa naraz.
        const kraj = pk.krajOdpovede ?? null;
        out.push(
          kraj === null
            ? `(Odpoveď ide LÍCOM DOLE — súper ju neuvidí, kým neodpovie aj on${v.utocnik === ja ? "; obranca potom smie len na druhý kraj línie" : ""}. Obe sa otočia naraz a Pitka sa vyhodnotí.)`
            : `(Súper odpovedal lícom dole na ${koniecLinie(v, kraj)} — ty smieš len na druhý koniec línie. Potom sa obe otočia naraz.)`,
        );
        c({ type: "bezReakcie" }, "na súperovo NA EX neodpovedať (v tejto Pitke už neodpovedáš)");
        for (const k of v.ruka) {
          for (const t of cieleOdpovede(DATA, v, ja, k)) {
            if (zablokovaneStrany(v)[t === "vlastna" ? ja : su]) continue;
            c({ type: "place", uid: k.uid, target: t }, `odpoveď na NA EX LÍCOM DOLE: vylož ${meno(k.defId)} → ${POPIS_CIELA[t]} (stojí plný poldeci — vypiješ ho: pečeň +1 hneď, 1 nerest; limit nemíňa; Nástup až pri otočení)${popisVylozenia(v, k, t)}`);
          }
        }
        break;
      }
      let naexMoznosti = 0;
      if (v.ciel?.lokalita?.defId === "kostol") out.push("(Kostol: NA EX len na kartu na konci línie — na ktoromkoľvek z dvoch koncov, najďalej od Kostola)");
      // NA EX naraz (v5): moje skryté NA EX sa rátajú do limitu Pitky aj poldeci.
      // S Bzdochou prídu aj súperove — do môjho limitu a poldeci sa nerátajú.
      const mojeSkryte = (pk?.skryteNaex ?? []).filter((x) => x.hrac === ja);
      // Tie isté podmienky ako motor.
      const ciele = new Set(moznostiNaexVPohlade(DATA, v));
      const naexEste = ciele.size > 0;
      if (mojeSkryte.length > 0) out.push(`(Skryto si dal ${mojeSkryte.length === 1 ? "NA EX" : `${mojeSkryte.length} NA EX`} — odkryje sa, keď obaja skončíte Pitku; súper potom smie odpovedať jednou kartou lícom dole za každé.)`);
      // Čo NA EX na karte urobí (v11.17): nespárované Posilnenie ho podrží. Odpor na spoji NA EX nechá
      // tak (v12.1) — partner ostáva zrušený; karta s aktívnym (nespárovaným) Odporom cieľom nie je.
      const evNaex = naexEste ? evaluateLine(DATA, lineState(v)) : null;
      const ucinokNaexText = (uid: number, defId: string): string => {
        const k = evNaex?.cards.get(uid);
        const sloty = [...(k?.left ?? []), ...(k?.right ?? [])];
        if (defId === "veteran") return "Veterán: zdvojí jeho aktívne akcie a nezruší ich, neaktívne nechá";
        const posil = sloty.some((x) => x?.action === "Posilnenie" && x.stav === "neaktivna");
        const odpor = sloty.some((x) => x?.action === "Odpor");
        if (posil) return "nespárované Posilnenie NA EX podrží: aktívne akcie karty nezruší, neaktívne zdvojí";
        return `zruší jej aktívne akcie, zdvojí neaktívne${odpor ? "; jej Odpor na spoji nechá tak (partner ostáva zrušený)" : ""}`;
      };
      if (naexEste) {
        for (const p of [0, 1] as const) {
          for (const pl of v.strany[p]) {
            if (!ciele.has(pl.card.uid)) continue;
            naexMoznosti++;
            const moja = pl.playedBy === ja;
            c(
              { type: "naex", uid: pl.card.uid },
              `NA EX na ${moja ? "svoju" : "SÚPEROVU"} kartu ${meno(pl.card.defId)} (${p === ja ? "vľavo" : "vpravo"}) — ${ucinokNaexText(pl.card.uid, pl.card.defId)} (rátajú sa ${moja ? "tebe" : "súperovi"}; násobky sa násobia, NA EX × Silná žena = ×4); pečeň +1 tebe, poldeci sa pri bitke vypije; skryto — súper ho uvidí až po tom, čo obaja skončíte Pitku (ak naň dá NA EX aj on, je z karty Výtržník: všetky akcie Rany pre majiteľa), potom smie odpovedať jednou kartou${cenaNaexText(v, pl.card.uid)}`,
            );
          }
        }
      }
      if (naexEste) {
        for (const z of v.zaverecne.filter((x) => ciele.has(x.uid))) {
          naexMoznosti++;
          c({ type: "naex", uid: z.uid }, `NA EX na SÚPEROVU ZÁVEREČNÚ lícom dole (${z.strana === ja ? "vľavo" : "vpravo"}) — nevieš, čo to je; prejde vždy, aktívne akcie zruší a neaktívne zdvojí ako pri každej karte; pečeň +1 tebe`);
        }
      }
      if (naexLimitMinuty(v, ja) && (pk?.naexPouzity[ja] === true || mojeSkryte.length > 0)) {
        out.push("(NA EX si v tejto Pitke už dal)");
      } else if (naexMoznosti === 0) out.push("(NA EX ide len na Občana či Starešinu v línii, ktorý má aspoň 1 aktívnu a aspoň 1 neaktívnu akciu, bez poldeci — tvojho aj súperovho, nie Nástroj — a len s plným poldeci)");
      const cenaFajc = cenaFajceniaHraca(v, ja);
      const zakazFajc = dovodZakazuFajcit(DATA, v, ja);
      if (zakazFajc !== null) out.push(`(${zakazFajc})`);
      else if (h.cigarety >= cenaFajc && jeCoTahat(h.doberaciPocet, h.odhadzovaci.length)) {
        c({ type: "smoke", pocet: 1 }, cenaFajc === 0 ? `fajči zadarmo (Benzínka: každé fajčenie o 1 cigaretu lacnejšie) — hneď si doberieš kartu (ťah nekončí); ďalšie v tejto Pitke za ${cigariet(cenaFajceniaHraca(v, ja, 2))}` : `fajči za ${cigariet(cenaFajc)}${prveFajcenieZadarmo(v) ? " (Benzínka: o 1 lacnejšie)" : ""} — hneď si doberieš kartu (ťah nekončí); ďalšie fajčenie v tejto Pitke o cigaretu drahšie`);
      }
      const cenaBarteru = barterCena(DATA, v, ja);
      if (h.cigarety >= cenaBarteru && zakazFajc === null) c({ type: "barter" }, `barter ${cenaBarteru} cigariet → nový plný poldeci navyše (maximum +1 natrvalo, po bitke sa obnoví)`);
      // v12.2: doliatie za cigarety zaniklo — po Pitke sa doleje 1 vypitý zadarmo a akcie Poldeci.
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
      if (b?.krok === "vestica") {
        out.push(`{"type":"vestica","moja":I,"jeho":J}   — Veštica: vymeň kartu I zo svojho doberacieho balíčka za kartu J zo súperovho (zoznamy vyššie); balíčky sa potom zamiešajú`);
      }
      if (b?.krok === "cintorin") {
        // Cintorín (v11.13): porazený si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka.
        for (const k of v.hraci[ja].odhadzovaci) c({ type: "cintorin", uid: k.uid }, `Cintorín: ${popisKarty(k)} z tvojho odhadzovacieho balíčka do ruky`);
        c({ type: "cintorin", uid: null }, "Cintorín: nič si nevziať");
      }
      // Rozdelenie (v11): víťaz bitky Nakladačku na svoj strach, víťaz hádky hádku na svoje reči —
      // jedným zámerom s celým rozdelením; server prijme len úplné (overRozdelenie v jadre).
      const krok = krokRozdelenia(v, ja);
      if (krok !== null) {
        const marker = markerRozdelenia(krok);
        const body = bodyRozdelenia(v, ja);
        const coje = marker === "strach" ? "STRACH" : "REČI";
        const odkial =
          marker === "reci"
            ? "Reči ležia na SÚPEROVOM teplomere: obsadzuješ od vrchu jeho strachu nadol, potom nad neho (zo sivej zdola nahor); `na` = stupeň, po ktorý v tomto poradí obsadzuješ. Každý stupeň má hodnotu " + HODNOTY_STUPNOV + " a špaky za neho dostaneš ty, nie súper; bodujú pri každej bitke, vyhratej aj prehratej, klesajú zospodu len po prehratej hádke. Obsadená červená sa súperovi ráta do výhry strachom a dá sa zajať; súper za obsadený stupeň platí o 1 viac."
            : "Strach neklesá. Vyšší strach ti po bitkách dáva špaky a červený strach vedie k výhre strachom a k zajatiu, ale súperovi dáva priazeň (súperov strach − tvoj).";
        const akciaText =
          krok === "prebytok"
            ? `ZAJATIE (v11.4, v11.6): staršieho, pri ktorom máš strach na červenej UŽ PRED touto Nakladačkou (dotiahnutý v tomto rozdelení nestačí), zajmeš za ${KONSTANTY.CENA_ZAJATIA} — pridaj "zajatia":["<id>",…]. Je tvoj väzeň, súper ti odovzdá toľko špakov, koľko bodov hádky má v rečiach pri ňom; väzni na výhru podľa ligy vyhrávajú hneď. Dobrovoľné, aj viac naraz; do „rozdeľ, čo sa dá“ sa nerátajú. `
            : `PRESVEDČENIE (v11.12): ktoréhokoľvek staršieho presvedčíš za ${KONSTANTY.CENA_PRESVEDCENIA}, keď máš (aj po zdvihu v tomto rozdelení) reči na celom teplomere — pridaj "presvedcenia":["<id>",…]. Reči, strach aj priazeň ostanú, jeho karta ide tebe do ruky a natrvalo patrí do tvojho balíčka (hráš ju ako Starešinu, len akcie). Kto prvý presvedčí, toho je; zajať ho smú obaja. Dobrovoľné, aj viac naraz. `;
        out.push(
          `(ROZDEĽUJEŠ ${body} ${body === 1 ? "bod" : body <= 4 ? "body" : "bodov"} ${krok === "prebytok" ? `NAKLADAČKY (vyhral si bitku ${b?.damage?.tuhe[ja] ?? "?"} : ${b?.damage?.tuhe[su] ?? "?"} v tuhom)` : `HÁDKY (vyhral si hádku ${b?.hadka?.makke[ja] ?? "?"} : ${b?.hadka?.makke[su] ?? "?"} v mäkkom)`} na SVOJ ${coje} — ľubovoľne medzi starších. ` +
            `Stupeň stojí ${CENY_STUPNOV}; skok o viac stupňov = súčet (zo sivej na červenú ${cenaDvihnutia(0, CERVENA)}). ${odkial} ` +
            `Pošli JEDEN príkaz s celým rozdelením: {"type":"${krok}","zdvihy":[{"elderId":"<id>","na":<cieľový stupeň 1 žltá / 2 oranžová / 3 červená>}, …]} — každý starší najviac raz. ` +
            "Server prijme len ÚPLNÉ rozdelenie: kým by zvyšok ešte stačil na ďalší stupeň niektorého staršieho, odmietne ho. Čo už na žiadny stupeň nestačí, PREPADNE (aj keď nemáš kam dvíhať). " +
            akciaText +
            ")",
        );
        out.push(`CENNÍK TVOJHO ${coje === "STRACH" ? "STRACHU" : "REČÍ"} (z ${body}):`);
        for (const e of v.starsi) {
          const stav = `${marker === "strach" ? `strach ${stupenText(e.strach[ja])}${opisReci(e, su) === "nič" ? "" : `, súperove reči ${opisReci(e, su)}`}` : `tvoje reči ${opisReci(e, ja)}, súperov strach ${stupenText(e.strach[su])}`}`;
          const ceny =
            cenaDalsiehoStupna(e, ja, marker) === null
              ? "už na červenej — nedá sa"
              : krokyZdvihu(e, ja, marker)
                  .map((k) => `na ${NA_STUPEN[k.na]} (${k.na}) za ${k.cena}${k.cena > body ? " (nestačí)" : ""}`)
                  .join(", ");
          const akcia = cenaAkcieUplna(e, ja, marker);
          const akciaPopis = akcia === null ? "" : ` | ${krok === "prebytok" ? "ZAJATIE" : "PRESVEDČENIE"} za ${akcia}${akcia > body ? " (nestačí)" : ""}${krok === "prebytok" ? ` (súper odovzdá ${spakov(nahladZajatia(v, e.elderId).kradez)})` : ""}`;
          out.push(`  ${e.elderId} ${meno(e.karta.defId)}: ${stav} → ${ceny}${akciaPopis}`);
        }
        const navrh = navrhRozdelenia(v);
        const kluc = (z: readonly Zdvih[]): string => [...z].map((x) => `${x.elderId}:${x.na}`).sort().join(",");
        // Zajatie / presvedčenie (v11.4): popis výberu akcií — viac naraz smie (§10), krádež sa sčíta.
        const popisAkcii = (ids: readonly string[]): string => {
          const mena = ids.map((id) => meno(v.starsi.find((x) => x.elderId === id)?.karta.defId ?? id)).join(" a ");
          if (krok !== "prebytok") return `PRESVEDČENIE ${mena} (karta do tvojej ruky a balíčka; reči, strach oboch aj priazeň ostávajú)`;
          const n = nahladZajatia(v);
          const vaznov = n.mojichVaznov - 1 + ids.length;
          const kradez = Math.min(ids.reduce((s, id) => s + nahladZajatia(v, id).kradez, 0), v.spaky[su]);
          return `ZAJATIE ${mena} (väzňov ${vaznov}/${n.vazniNaVyhru}${vaznov >= n.vazniNaVyhru ? " — VÝHRA VÄZŇAMI HNEĎ" : ""}, súper ti odovzdá ${spakov(kradez)})`;
        };
        const navrhAkcie = navrh?.akcie ?? [];
        if (navrh !== null && navrhAkcie.length > 0) {
          const plan = planRozdelenia(v, ja, navrh.zdvihy, navrhAkcie);
          if (plan?.prikaz != null) c(plan.prikaz, `NÁVRH: ${popisAkcii(navrhAkcie)}; zvyšok: ${popisRozdelenia(v, marker, navrh.zdvihy, plan.cena, plan.zvysok)}`);
        }
        const ponuka: (readonly Zdvih[])[] = navrh === null || navrhAkcie.length > 0 ? [] : [navrh.zdvihy];
        for (const z of kandidatiRozdelenia(v, ja, marker, body, 48)) {
          if (ponuka.length >= 8) break;
          if (!ponuka.some((x) => kluc(x) === kluc(z))) ponuka.push(z);
        }
        ponuka.forEach((zdvihy, i) => {
          const plan = planRozdelenia(v, ja, zdvihy);
          if (plan?.prikaz == null) return;
          c(plan.prikaz, `${i === 0 && navrh !== null && navrhAkcie.length === 0 ? "NÁVRH (najlepšia hodnota markerov podľa jadra): " : ""}${popisRozdelenia(v, marker, zdvihy, plan.cena, plan.zvysok)}`);
        });
        for (const ids of vyberyAkcii(v, ja, marker, body, 16)) {
          if (ids.length === navrhAkcie.length && ids.every((id) => navrhAkcie.includes(id))) continue;
          const navrhA = navrhRozdelenia(v, ids);
          const plan = navrhA === null ? null : planRozdelenia(v, ja, navrhA.zdvihy, ids);
          if (navrhA === null || plan?.prikaz == null) continue;
          c(plan.prikaz, `${popisAkcii(ids)}; zvyšok: ${popisRozdelenia(v, marker, navrhA.zdvihy, plan.cena, plan.zvysok)}`);
        }
        if (ponuka.length === 0) out.push("(Body nestačia na žiadny stupeň — počkaj, server ich nechá prepadnúť.)");
        else out.push(`(Môžeš poslať aj vlastné úplné rozdelenie {"type":"${krok}","zdvihy":[…]} — klient ho pred odoslaním overí a povie, či by zvyšok ešte niekam stačil.)`);
      }
      break;
    }
    default:
      break;
  }
  // Schopnosť väzňa (v11.2): raz za hru vo svojom ťahu (branie zo šenku, Zhromaždenie, Pitka) — ten istý výpočet ako jadro.
  for (const k of ponukaSchopnostiVazna(stavSchopnostiVaznaZPohladu(v), ja)) {
    if (k.type !== "schopnostVazna") continue;
    const vazen = v.vazni.find((x) => x.elderId === k.elderId);
    const text = DATA.elders.get(k.elderId)?.schopnost ?? "";
    const kde = [...v.strany[0], ...v.strany[1]].find((x) => x.card.uid === k.uid);
    const karta =
      k.uids !== undefined
        ? " (uids = ľubovoľné karty ponuky, každá za 1 cigaretu; tu príklad s jednou)"
        : kde !== undefined
          ? ` — NA EX na karte ${meno(kde.card.defId)}`
          : k.uid !== undefined
            ? ` — karta ${meno(v.hraci[su].odhadzovaci.find((x) => x.uid === k.uid)?.defId ?? "")}`
            : "";
    c(k, `SCHOPNOSŤ VÄZŇA ${meno(vazen?.karta.defId ?? "")}${karta} — raz za hru, nič nestojí: ${text}`);
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
      return `Bitka: tuhé ${e.damage.tuhe[ja]}:${e.damage.tuhe[ja === 0 ? 1 : 0]} (ty:súper) — vyhráva ${e.vitaz === null ? "nikto" : m(e.vitaz)}${e.prebytok > 0 ? `, Nakladačka ${e.prebytok}${e.prebytokNaRozdelenie < e.prebytok ? " (vo finále sa nerozdeľuje — víťaz za každý bod dostane špak)" : ""}` : ""}.`;
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
      if (start !== undefined) return `štartovacia: ${start}× v ruke každého hráča, v Náradí, Občanoch ani v ponuke nie je`;
      if (c.tags.includes("Lokalita")) return "lokalita: 1 kus (do hry ide len časť lokalít)";
      if (c.tags.includes("Starešina")) return "starší: 1 kus na ukazovateli (do ruky a balíčka len presvedčením)";
      // Dlh je od v8.2 počítadlo — sada v tvorcovi ho môže ešte niesť ako kartu.
      if (c.id === "dlh") return "kliatba: nie je karta ani v balíčku — počítadlo priznaných Dlhov (vzniká z Hazardu a efektov)";
      if (c.id === "cirhoza") return "kliatba: v balíčku nie je, vzniká počas hry (bez limitu)";
      // Absťák (v9.1) vzniká z Chuti na konci kola — do Občanov ani do šenku nepatrí (playtest 20261030-184957, Eva N2).
      if (c.id === "abstak") return "kliatba: v balíčku nie je, vzniká počas hry (z Chuti na konci kola, do odhadzovacieho balíčka)";
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
    // Rozdelenie (v11) overí klient tou istou funkciou ako server — AI dostane konkrétne, čo chýba.
    if ((cmd.type === "prebytok" || cmd.type === "reci") && s.view !== null) {
      // Zajatia / presvedčenia sa platia z tých istých bodov — bez nich by kontrola zvyšok určený
      // na akciu brala ako nerozdelený a zajatie by nikdy neprešlo (playtest štýlov 2026-11-06).
      const akcie = cmd.type === "prebytok" ? cmd.zajatia : cmd.presvedcenia;
      const plan = planRozdelenia(s.view, s.view.ja, Array.isArray(cmd.zdvihy) ? cmd.zdvihy : [], Array.isArray(akcie) ? akcie : []);
      const chyba =
        plan === null
          ? "Teraz nič nerozdeľuješ."
          : plan.chyba ??
            (plan.esteSaDa.length > 0
              ? `Rozdelenie nie je úplné: stojí ${plan.cena} z ${plan.body}, zvyšok ${plan.zvysok} by ešte stačil na ďalší stupeň pri ${plan.esteSaDa.map((id) => `${meno(s.view?.starsi.find((e) => e.elderId === id)?.karta.defId ?? id)} (${id})`).join(", ")} — minúť treba, čo sa dá.`
              : plan.prikaz === null || plan.prikaz.type !== cmd.type
                ? `Teraz sa rozdeľuje „${plan.marker === "strach" ? "prebytok" : "reci"}“, nie „${cmd.type}“.`
                : null);
      if (chyba !== null) {
        zapis(`ŤAH ${arg} → ODMIETNUTÝ KLIENTOM: ${chyba}`);
        console.log(`ŤAH ODMIETNUTÝ (neposlal som ho): ${chyba}`);
        s.ws.close();
        process.exit(1);
      }
    }
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
