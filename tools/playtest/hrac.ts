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

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import type { ActionSums, CardInstance, ClientState, Command, ElderState, Event, GameData, GameState, PlayerId, Slot, VerejnyStav } from "@naex/core";
import {
  stavZavislosti,
  textNeresti,
  KONSTANTY,
  STUPNICA_ZONY,
  battleOutcome,
  cenaPatronatu,
  kandidatiNaNahradu,
  nahladPatronatu,
  patronatMozny,
  pohorsenieMozne,
  bodyTeraz,
  cenaKliatby,
  cenaPrebytku,
  nahladPitky,
  favourStarsieho,
  krokStavby,
  cieleVykladania,
  cielLokalitaId,
  evaluateLine,
  barterCena,
  limitBuduceKolo,
  limitZhromazdenia,
  lineState,
  loadGameData,
  nahladPosunuMarkera,
  pohorsenieNaKraj,
  vykupZoSrotu,
  zakazFajcit,
  zakazNaex,
  zakazVypit,
  nahladVylozenia,
  naexCieleVLinii,
  obavanyHrac,
  posunMarker,
  priazen,
  podmienkyStarsieho,
  poskodenieBitky,
  prahyHraca,
  prebudenyPre,
  printedSides,
  priazenHraca,
  priazenSila,
  prahVydesenia,
  scorecardStarsieho,
  stranyLokality,
  krajeStran,
  prevahaStran,
  vydesil,
} from "@naex/core";

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
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as { type: string; [k: string]: unknown };
    if (m.type === "privitanie") {
      sada = m.sada as Sada;
      zacata = m.started === true;
    }
    if (m.type === "hraci") {
      const h = m.hraci as ({ meno: string } | null)[];
      h.forEach((x, i) => x !== null && (mena[i] = x.meno));
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
  if (!zacata && fronta.length === 0) return { ws, sada, view: null, mena, dalsia };
  const prva = await dalsia(10_000);
  if (prva === null) throw new Error("Server neposlal stav partie.");
  if (prva.typ === "error") throw new Error(prva.text);
  if (prva.typ === "zatvorene") throw new Error("Server zatvoril spojenie.");
  return { ws, sada, view: prva.view, mena, dalsia };
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
  if (n.cirhozy > 0) kliatby.push(`Cirhóza ×${n.cirhozy} (${n.cirhozy * cC} b)`);
  if (n.dlhy > 0) kliatby.push(`Dlh ×${n.dlhy} (${n.dlhy * cD} b)`);
  return `pečeň ${n.pecen} ▸ ${n.pecen + n.pecenZoStola}/${n.prahPecene}, zadĺženie ${n.zadlzenie} ▸ ${n.zadlzenie + n.zadlzenieZoStola}/${n.prahDlhu} → ${kedy}: ${kliatby.length > 0 ? kliatby.join(", ") : "žiadna kliatba"} (karty na stole pripíšu pečeň ${n.pecenZoStola}, zadĺženie ${n.zadlzenieZoStola}; za každý celý prah jedna kliatba)`;
}

/** Cena NA EX na kartu uid v kliatbách a bodoch pre oboch (tá istá logika ako náhľad na webe). */
function cenaNaexText(v: ClientState, uid: number): string {
  const ja = v.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const strany: ClientState["strany"] = [
    v.strany[0].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl)),
    v.strany[1].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl)),
  ];
  const h = v.hraci;
  const hraci: ClientState["hraci"] = ja === 0 ? [{ ...h[0], pecen: h[0].pecen + 1 }, h[1]] : [h[0], { ...h[1], pecen: h[1].pecen + 1 }];
  const pred = nahladPitky(DATA, v);
  const po = nahladPitky(DATA, { ...v, strany, hraci });
  const dalsie = Math.max(0, v.pitkyCelkom - v.pitkaCislo);
  const pre = (p: PlayerId): string => {
    const a = pred[p];
    const b = po[p];
    const c = b.cirhozy - a.cirhozy + (Math.floor(b.pecenZoStola / b.prahPecene) - Math.floor(a.pecenZoStola / a.prahPecene)) * dalsie;
    const d = b.dlhy - a.dlhy + (Math.floor(b.zadlzenieZoStola / b.prahDlhu) - Math.floor(a.zadlzenieZoStola / a.prahDlhu)) * dalsie;
    if (c === 0 && d === 0) return "nič";
    const body = c * cenaKliatby(DATA, v, p, "cirhoza") + d * cenaKliatby(DATA, v, p, "dlh");
    return `${c !== 0 ? `Cirhóza ${c > 0 ? "+" : "−"}${Math.abs(c)} ` : ""}${d !== 0 ? `Dlh ${d > 0 ? "+" : "−"}${Math.abs(d)} ` : ""}(${body < 0 ? "−" : "+"}${Math.abs(body)} b)`;
  };
  const abstaky = v.ruka.filter((k) => k.defId === "abstak").length;
  const stol: VerejnyStav = { ciel: v.ciel, ovladnute: v.ovladnute, strany, starsi: v.starsi, hraci: v.hraci };
  const d0 = poskodenieBitky(DATA, v, evaluateLine(DATA, lineState(v)).sums, ja === 0 ? [abstaky, 0] : [0, abstaky]);
  const d1 = poskodenieBitky(DATA, stol, evaluateLine(DATA, { ...lineState(v), strany }).sums, ja === 0 ? [abstaky, 0] : [0, abstaky]);
  return `; bitka (tuhé) ${d0.tuhe[ja]}:${d0.tuhe[su]} → ${d1.tuhe[ja]}:${d1.tuhe[su]}; kliatby z tejto a ďalších Pitiek kola (NA EX leží do bitky): ty ${pre(ja)}, súper ${pre(su)}`;
}

function vykresli(v: ClientState, mena: readonly string[]): string {
  const ja = v.ja;
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const out: string[] = [];
  const kto = (p: PlayerId | null) => (p === null ? "nikto" : p === ja ? "TY" : mena[p] ?? `Hráč ${p + 1}`);
  out.push(
    `=== Kolo ${v.kolo}, fáza ${v.faza}${v.faza === "pitka" ? ` ${v.pitkaCislo}/${v.pitkyCelkom}` : ""}${v.faza === "zhromazdenie" ? ` (pred Pitkou ${v.pitkaCislo + 1}/${v.pitkyCelkom})` : ""}${v.vizia !== null ? " (VÍZIA)" : ""}${v.bitkaStav?.krok ? ` (krok ${v.bitkaStav.krok})` : ""} — na ťahu: ${v.draftStav?.krok === "stavba" ? "obaja naraz (stavba šenku)" : kto(v.naTahu)} ===`,
  );
  if (v.koniec !== null) {
    out.push(`KONIEC HRY: vyhral ${kto(v.koniec.vitaz)}. ${v.koniec.dovod}${v.koniec.body ? ` Body: ty ${v.koniec.body[ja]}, súper ${v.koniec.body[su]}.` : ""}`);
  }
  out.push(
    `Ty si ${mena[ja]} (${v.utocnik === ja ? "útočník — zo šenku berieš prvý a vykladáš prvý" : "obranca — vyberáš a natáčaš cieľ kola, zo šenku berieš aj vykladáš druhý"}), súper ${mena[su]}. Hrá sa o ${v.lokalitCelkom} lokalít, ovládnutých ${v.ovladnute.length}${v.prepadnute.length > 0 ? `, prepadnutých ${v.prepadnute.length}` : ""}. Limit ruky nie je; po každej bitke si každý dobere ${KONSTANTY.KARTY_PO_BITKE} karty. Ďalší Nástroj do Dedičstva stojí ${v.cenaDedicstva} cig. (cena rastie pre oboch). Pitiek v bitke = 1 + menší počet aktivovaných akcií karty v strede (z dvoch strán).`,
  );

  // Stôl po prípadnom vyhodnotení — rovnako ako klient. V strede leží lokalita.
  const lineEval = evaluateLine(DATA, lineState(v));
  const stol: VerejnyStav = { ciel: v.ciel, ovladnute: v.ovladnute, strany: v.strany, starsi: v.starsi, hraci: v.hraci };
  for (const p of [ja, su] as const) {
    const h = v.hraci[p];
    const pr = prahyHraca(DATA, stol, p);
    out.push(
      `${p === ja ? "TVOJE ZDROJE" : "SÚPEROVE ZDROJE"}: poldeci plné ${h.poldeciPlne}, vypité ${h.poldeciVypite} (limit vykladania ${limitZhromazdenia(v, p)}, v ďalšom kole ${limitBuduceKolo(v, p)}) | cigarety ${h.cigarety} | pečeň ${h.pecen}/${pr.cirhoza} | zadĺženie ${h.zadlzenie}/${pr.dlh} (žijú len počas Pitky) | priznané dlhy ${pr.priznaneDlhy}/${pr.exekutor} (do Exekútora; na konci hry uberajú body aj priznané) | nepriznané kliatby: Cirhóza ${v.nepriznaneKliatby[p].cirhoza}, Dlh ${v.nepriznaneKliatby[p].dlh} (verejný počet) | ruka ${h.rukaPocet}, balíček ${h.doberaciPocet}, odhodené ${h.odhadzovaci.length}`,
    );
    const vyhladP = vyhladPitkyText(v, p);
    if (vyhladP !== null) out.push(`  VÝHĽAD PITKY: ${vyhladP}`);
    const z = stavZavislosti(DATA, { ...stol, kolo: v.kolo, hraci: v.hraci }, p);
    const vyhlad =
      z.vyhlad === "zaklad"
        ? "1. kolo len nastaví základ"
        : z.vyhlad === "ziska"
          ? `na konci kola +1 Absťák, ak nepribudne ešte ${textNeresti(z.doBezpecia)}`
          : z.vyhlad === "zbavi"
            ? "na konci kola odíde 1 Absťák"
            : z.doZbavenia > 0
              ? `bez zmeny; ešte ${textNeresti(z.doZbavenia)} a 1 Absťák odíde`
              : "bez zmeny";
    out.push(
      `  ABSŤÁK: ${z.abstaky} (v bitke −${z.ubera} tuhé) | neresti v kole ${z.teraz}${z.naexNaStole > 0 ? ` (z toho ${z.naexNaStole} NA EX na stole)` : ""}, minulé kolo ${z.minule} → ${vyhlad}. Nerest = Vypiť, NA EX, každá vyfajčená cigareta, doliatie a barter (cigarety); šenok, Dedičstvo a Starosta nie.`,
    );
    if (h.priznane.length > 0) out.push(`  priznané: ${h.priznane.map((k) => meno(k.defId)).join(", ")}`);
    if (h.dedicstvo.length > 0) out.push(`  dedičstvo: ${h.dedicstvo.map((k) => meno(k.defId)).join(", ")}`);
  }
  if (v.draftStav !== null) {
    const d = v.draftStav;
    if (d.krok === "stavba") {
      out.push(
        `STAVBA ŠENKU (naraz): ty ${d.vybral[ja] ? "si už vybral" : "vyberáš"}, súper ${d.vybral[su] ? "už vybral" : "vyberá"}; súperov balíček ${d.balicekPocet[su]} kariet (nevidíš ho).`,
      );
      out.push(`TVOJ BALÍČEK STAVBY (${d.mojBalicek.length}):`);
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
  // Poradie v Pitke (Michal 2026-10-21): obranca začína, útočník má posledné slovo; „hotovo“ je v logu.
  if (v.pitkaStav !== null && v.faza === "pitka") {
    const ps = v.pitkaStav;
    const obr: PlayerId = v.utocnik === 0 ? 1 : 0;
    const stav = (p: PlayerId): string =>
      ps.hotovy[p] ? `skončil${(ps.naexPocet?.[p] ?? 0) > 0 ? " (po NA EX)" : " bez NA EX"}` : ps.reakcia === p ? "odpovedá na NA EX" : ps.naTahu === p ? "na ťahu" : "čaká";
    out.push(
      `PITKA — poradie: 1. ${kto(obr)} (obranca, začína): ${stav(obr)} · 2. ${kto(v.utocnik)} (útočník, posledné slovo): ${stav(v.utocnik)}. „hotovo“ je nevratné; kto skončí, súper už vie, že je posledný.`,
    );
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
    `PREVAHA: akcie hrany lokality dostane, kto má v tom kraji viac svojich Občanov, Zvierat a Starešinov (Nástroje a Cirhóza nie; pri rovnosti majiteľ karty pri lokalite). ${nazovKraja(ja)}: ${prevaha[ja] === null ? "prázdna" : kto(prevaha[ja])}; ${nazovKraja(su)}: ${prevaha[su] === null ? "prázdna" : kto(prevaha[su])}.`,
  );
  const majitel = (p: PlayerId) => (p === ja ? "TVOJA karta" : "SÚPEROVA karta");
  const moja = [...v.strany[ja]].reverse();
  for (const pl of moja)
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na tvojej strane${pl.naexBy !== undefined ? `, NA EX: ${kto(pl.naexBy)}` : ""}]`, [
        "vonkajšia hrana",
        "vnútorná hrana (k lokalite)",
      ]),
    );
  if (v.ciel !== null && v.ciel.lokalita !== null) {
    const popis = " [LOKALITA]";
    out.push(kartaVLinii(v.ciel.lokalita, v.lokalitaOtocena !== (ja === 1), lineEval, popis, [`hrana k TEBE — ${nazovKraja(ja)}`, `hrana k SÚPEROVI — ${nazovKraja(su)}`]));
  } else out.push("  (stred línie — ešte nič)");
  for (const pl of v.strany[su])
    out.push(
      kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na súperovej strane${pl.naexBy !== undefined ? `, NA EX: ${kto(pl.naexBy)}` : ""}]`, [
        "vnútorná hrana (k lokalite)",
        "vonkajšia hrana",
      ]),
    );

  const sumy = (p: PlayerId) => Object.entries(lineEval.sums[p]).map(([a, n]) => `${a} ${n}`).join(", ") || "nič";
  out.push(`Tvoje aktívne akcie (tvoja partia + akcie lokality, ktoré aktivuje tvoja karta): ${sumy(ja)}`);
  out.push(`Súperove aktívne akcie: ${sumy(su)}`);
  if (v.ciel !== null && v.koniec === null) {
    const abstaky = v.ruka.filter((k) => k.defId === "abstak").length;
    const d = v.bitkaStav?.damage ?? poskodenieBitky(DATA, stol, lineEval.sums, ja === 0 ? [abstaky, 0] : [0, abstaky]);
    out.push(
      `${v.bitkaStav?.damage ? "VÝSLEDOK BITKY" : "ODHAD BITKY (súperove absťáky v ruke nepoznáš)"}: tuhé poškodenie ty ${d.tuhe[ja]} : súper ${d.tuhe[su]}, celkové ty ${d.celkove[ja]} : súper ${d.celkove[su]}.`,
    );
    const o = battleOutcome(d);
    const posledna = v.lokalityVHre.length === 0;
    const sekera = v.naSekeru.length > 0 ? ` Na sekere leží ${v.naSekeru.map((k) => meno(k.defId)).join(", ")} — víťaz tejto bitky ich berie tiež (ide o ${v.naSekeru.length + 1} lokality).` : "";
    out.push(
      `  → ${o.vitaz === null ? `REMÍZA — ${posledna ? "posledná bitka: lokalita (aj sekera) prepadne" : "lokalita ide na sekeru, berie ju víťaz najbližšej bitky"}` : o.vitaz === ja ? "vyhrávaš" : "prehrávaš"}. Pravidlo remízy: pri rovnakom tuhom nevyhrá nikto — lokalita na sekeru (v poslednej bitke prepadne), útočník ostáva; prebytok drží vyššie celkové.${sekera}`,
    );
    // Patronát (Michal 2026-10-20): kto má staršieho v ruke, pri výhre si ho nechá, pri prehre odhodí poldeci.
    for (const p of [ja, su] as const) {
      const pat = v.patronat[p];
      if (pat === null) continue;
      const e = v.starsi.find((x) => x.elderId === pat.elderId);
      out.push(
        `  PATRONÁT: ${p === ja ? "TY máš" : "SÚPER má"} v ruke staršieho ${meno(e?.karta.defId ?? "")}${p === ja && v.mojaNahrada !== null ? ` (na scorecarde lícom dole ${meno(v.mojaNahrada.defId)})` : " (na scorecarde karta lícom dole)"} — ${p === ja ? "vyhráš bitku = starší je tvoj; prehráš = odhodíš poldeci" : "ak bitku vyhrá, staršieho si nechá; ak prehrá, odhodí poldeci"}. ${p === ja ? "Súper" : "Ty"} dostane${p === ja ? "" : "š"} v bitke ${pat.pohorsenia} Pohoršení navyše.`,
      );
    }
  }

  out.push("");
  const body = bodyTeraz(DATA, v);
  out.push("STARŠÍ (stupnica 0–8: 0–2 polovica hráča 1, 3–5 neutrál, 6–8 polovica hráča 2):");
  out.push(
    "  PRIAZEŇ (počas hry) má hráč, ku ktorému je marker posunutý — sila 1/2/3 podľa zóny, účinok 2 × sila; starší sa bojí toho DRUHÉHO (úroveň strachu 1–3 = zóna markera). " +
      "BODY (koniec hry): každá AKTÍVNA podmienka scorecardu (na ktorejkoľvek strane) boduje OBOM hráčom, bez ohľadu na marker tohto staršieho. " +
      "Za kus: lokality ×2, získaní starší ×2, cigarety 1 bod za každé 3, nepriznaná Cirhóza −2, každý Dlh (aj priznaný) −1. " +
      "Znepokojenie/Strach/Vydesenie (1/2/3 b.): za každého staršieho v hre (aj tohto), ktorý sa hráča bojí aspoň na tú úroveň; " +
      "pri jednom staršom sa ráta len najvyššia aktívna zónová podmienka, ktorú jeho strach spĺňa.",
  );
  out.push(`  BODY TERAZ (keby hra skončila teraz): ty ${body.spolu[ja]}, súper ${body.spolu[su]} (presne — súperove nepriznané kliatby sú v nich podľa verejného počtu).`);
  // Ohlásené vydesenie (Michal 2026-10-16): výhra až po udržaní do konca ďalšieho kola.
  const prahVyd = prahVydesenia(v);
  const vyd = (p: PlayerId) => v.starsi.filter((e) => vydesil(e, p)).length;
  out.push(`  VYDESENÍ (krajná pozícia): ty ${vyd(ja)}/${prahVyd}, súper ${vyd(su)}/${prahVyd}. Kto vydesí ${prahVyd} a udrží ich do konca ĎALŠIEHO kola, vyhrá.`);
  for (const p of [ja, su] as const) {
    const o = v.ohlaseneVydesenie[p];
    if (o !== null)
      out.push(`  ⚠ ${p === ja ? "TY si vydesil" : "SÚPER vydesil"} polovicu starších v kole ${o} — ${p === ja ? "vyhráš" : "vyhrá"} na konci kola ${o + 1}, ak ich ${p === ja ? "udržíš" : "udrží"}. Vrátiť vydeseného do stredu sa dá patronátom — vezme si ho do ruky ten, komu prejavuje priazeň (po šenku).`);
  }
  for (const e of v.starsi) {
    const b = body.starsi.find((x) => x.elderId === e.elderId);
    out.push(popisStarsieho(e, kto, b?.body[ja] ?? 0, b?.body[su] ?? 0));
  }

  out.push("");
  out.push(`ŠENOK (${v.senok.length}, spoločný balíček ${v.spolocnyBalicekPocet}):`);
  for (const k of v.senok) out.push(`  ${popisKarty(k)}`);
  out.push(`LOKALITY V HRE (${v.lokalityVHre.length}):`);
  for (const k of v.lokalityVHre) out.push(`  ${popisKarty(k)}`);
  if (v.ovladnute.length > 0) out.push(`OVLÁDNUTÉ: ${v.ovladnute.map((o) => `${meno(o.karta.defId)} (${kto(o.hrac)})`).join(", ")}`);
  if (v.prepadnute.length > 0) out.push(`PREPADNUTÉ (nikto ich nevyhral): ${v.prepadnute.map((k) => meno(k.defId)).join(", ")}`);
  if (v.naSekeru.length > 0) out.push(`NA SEKERE (z remíz, berie ich víťaz najbližšej bitky): ${v.naSekeru.map((k) => meno(k.defId)).join(", ")}`);

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
  UZERNIK: (s) => `prah Dlhu ${KONSTANTY.PRAH_DLHU_ZAKLAD + s} namiesto ${KONSTANTY.PRAH_DLHU_ZAKLAD}`,
  LAKOMEC: (s) => `stokársky barter za ${KONSTANTY.BARTER_CENA - s} cigariet`,
  NEPRAJNIK: (s) => `tvoje Povery smú dať o ${bonus(s)} mäkkého viac, než má súper priznaných Dlhov`,
  BITKAR: (s) => `+${bonus(s)} tuhého poškodenia v bitke`,
  VERIACI: (s) => `+${s} Viery v každej bitke`,
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} v 1. Pitke bitky o lokalitu`,
  ALKOHOLIK: (s) => `prah Cirhózy ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD + bonus(s)}`,
  EXEKUTOR: (s) => `prah Exekútora ${KONSTANTY.PRAH_EXEKUTORA_ZAKLAD + 2 * bonus(s)}`,
};

function popisStarsieho(e: ElderState, kto: (p: PlayerId | null) => string, mojeBody: number, jehoBody: number): string {
  const sc = scorecardStarsieho(DATA, e);
  const pr = priazenHraca(e);
  const preb = prebudenyPre(e);
  const ob = obavanyHrac(e);
  const podm = podmienkyStarsieho(DATA, e)
    .filter((p) => p.aktivna)
    .map((p) => p.podmienka)
    .join(", ");
  const favour = favourStarsieho(DATA, e);
  const ucinok = UCINOK[favour]?.(pr === null ? 1 : priazenSila(e)) ?? "";
  return `  ${e.elderId}: ${meno(e.karta.defId)} na scorecarde ${sc.nazov} | marker ${e.marker} (zóna ${STUPNICA_ZONY[e.marker]})${e.nahradeny ? " | NÁHRADA (hrá ďalej: marker, priazeň, body; bojovať o ňu sa nedá)" : ""}${e.marker === 0 || e.marker === 8 ? " | ZAMKNUTÝ na krajnej pozícii" : ""} | ${preb !== null ? `prebudený pre ${kto(preb)} | ` : ""}${pr !== null ? `priazeň ${kto(pr)} +${priazenSila(e)} (${ucinok})` : `priazeň nikto (kto ju získa: ${ucinok})`}${ob !== null ? ` | bojí sa: ${kto(ob)} (úroveň ${STUPNICA_ZONY[e.marker]})` : " | nikoho sa nebojí"}\n      aktívne podmienky (bodujú obom): ${podm || "žiadne"} → body teraz: ty ${mojeBody}, súper ${jehoBody}`;
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
  const n = nahladVylozenia(DATA, line, v.ja, k, kam);
  const s = n.sused;
  const spoj =
    s === null
      ? "nič sa nespojí"
      : `↔ ${s.stred ? "stred" : s.majitel === v.ja ? "tvoja karta" : "súperova karta"} ${meno(s.karta.defId)} (${hranaText(s.hrana)}): ${
          n.pary.length > 0 ? n.pary.map((p) => `${p.moja}+${p.susedova}`).join(", ") : "žiadny pár"
        }`;
  return ` | vnútorná hrana ${hranaText(n.vnutorna)} ${spoj} | ty: ${zmenyText(n.zmeny[v.ja])} · súper: ${zmenyText(n.zmeny[su])}`;
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
          `{"type":"stavbaSenku","doSenku":[${Array.from({ length: krok.doSenku }, (_, i) => `A${i + 1}`).join(",")}],"odhod":[${Array.from({ length: krok.odhod }, (_, i) => `B${i + 1}`).join(",")}]}   — z TVOJHO BALÍČKA STAVBY (vyššie) daj ${krok.doSenku} ${krok.doSenku === 1 ? "kartu" : "karty"} do šenku (uvidia ich obaja, berie sa z neho) a ${krok.odhod} naspodok spoločného balíčka (súper ich neuvidí). Nič si nepodávate. Súper vyberá naraz s tebou; karty do šenku sa odhalia, keď vyberiete obaja.`,
        );
        break;
      }
      if (ds.krok === "patronat") {
        // Patronát (Michal 2026-10-20): staršieho, ktorý ti prejavuje priazeň, si vezmeš do ruky.
        c({ type: "bezPatronatu" }, "staršieho do ruky neberieš");
        const h = v.hraci[ja];
        const kandidati = kandidatiNaNahradu(DATA, v.ruka);
        if (h.poldeciPlne + h.poldeciVypite < 1 || kandidati.length === 0) break;
        const b = (x: readonly [number, number]) => `${x[ja]}:${x[su]}`;
        for (const e of v.starsi) {
          const cena = cenaPatronatu(e);
          if (!patronatMozny(e, ja) || h.cigarety < cena.cigarety) continue;
          for (const k of kandidati) {
            const n = nahladPatronatu(DATA, v, e.elderId, k);
            c(
              { type: "patronat", elderId: e.elderId, uid: k.uid },
              `PATRONÁT: vezmi do ruky staršieho ${meno(e.karta.defId)} (v tomto kole ho smieš vyložiť), na jeho scorecard lícom dole ${meno(k.defId)}, marker do stredu; zaplatíš ${cena.cigarety} cig., súper dostane v bitke ${cena.pohorsenia} Pohoršení navyše (môže nimi vrátiť marker späť). Vyhráš bitku = starší je tvoj, prehráš = odhodíš poldeci natrvalo. Body ty:súper teraz ${b(n.teraz)}, pri výhre ${b(n.vyhra)}, pri prehre ${b(n.prehra)} (bez Pohoršení súpera)`,
            );
          }
        }
        break;
      }
      // Michal 2026-10-19: na ťahu 1 karta za cigaretu, alebo 2 karty za 3 cigarety; poldeci sa neplatí.
      const mam = ds.noveKarty[ja];
      const cig = v.hraci[ja].cigarety;
      c(
        { type: "draftStop" },
        `prestaň brať — máš ${mam} nových kariet, v Zhromaždení vyložíš ${limitZhromazdenia(v, ja)}${ds.hotovo[su] ? "" : "; súper potom má už len jeden posledný ťah"}`,
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
      c({ type: "pass" }, `pasovať (do Pitky už nevykladáš, súper vykladá sám; dostaneš ${v.zhromazdenieStav?.zostavaLimit[ja] ?? 0} cig. — cigaretu za každú kartu, ktorú si ešte smel vyložiť)`);
      if (v.hraci[ja].cigarety > 0 && !zakazFajcit(v))
        c({ type: "smoke", pocet: 1 }, `vyfajč 1 cigaretu (máš ${v.hraci[ja].cigarety}) — hneď si doberieš kartu; ťah ti neskončí`);
      if (zakazFajcit(v)) out.push("(Benzínka: nikto nesmie fajčiť)");
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
          for (const t of cieleVykladania(DATA, v.strany, ja, k, z.zostavaLimit[ja], v.hraci[ja].cigarety >= v.cenaDedicstva, cielLokalitaId(v)))
            c({ type: "place", uid: k.uid, target: t }, `vylož ${meno(k.defId)} → ${POPIS_CIELA[t]}${t === "vlastna" || t === "superova" ? popisVylozenia(v, k, t) : ""}`);
        }
      }
      // Playtest 20261012-101447: Dlhy v ruke nikto nepriznal, hoci bol od
      // Exekútora ďaleko — odhadzovali ich a dotiahli znova.
      const dlhyVRuke = v.ruka.filter((k) => k.defId === "dlh").length;
      if (dlhyVRuke > 0) {
        const stol: VerejnyStav = { ciel: v.ciel, ovladnute: v.ovladnute, strany: v.strany, starsi: v.starsi, hraci: v.hraci };
        const pr = prahyHraca(DATA, stol, ja);
        if (pr.priznaneDlhy + dlhyVRuke < pr.exekutor - 2)
          out.push(
            `(Máš v ruke ${dlhyVRuke}× Dlh a od Exekútora si ďaleko (${pr.priznaneDlhy}/${pr.exekutor}): priznaním za každý Dlh hneď dobereš kartu, Dlh navždy zmizne z balíčka a na konci ti neuberie bod. Odhodený Dlh sa vráti do balíčka.)`,
          );
      }
      // Tamže: Jano držal 6 Cirhóz v ruke, takže Liečbu ani Pohreb nikdy nevidel.
      if (v.ruka.some((k) => k.defId === "cirhoza"))
        out.push(
          "(Máš v ruke Cirhózu: zváž priznanie — nepriznaná uberá na konci 2 body, priznaná dá súperovi v každej bitke +1 tuhé, ale po bitke ti odomkne Liečbu alebo Pohreb (tie ju spália). Pohreb navždy spáli tvoju slabú kartu, ktorú si vyložil do línie; Liečba vymení tvojho Závislého z línie za kartu zo šenku.)",
        );
      break;
    }
    case "pitka": {
      if (v.vizia !== null) {
        // Vízia (Michal 2026-10-19): vrchnú kartu do ruky, alebo zahodiť.
        const k = v.volbaVizia;
        const zostava = v.vizia.zostava[ja];
        c({ type: "vizia", vziat: true }, `VÍZIA: vrchnú kartu balíčka ${k === null ? "" : popisKarty(k)} si vezmi do ruky${zostava > 1 ? ` (ešte ${zostava - 1} Vízie)` : ""}`);
        c({ type: "vizia", vziat: false }, "VÍZIA: vrchnú kartu ZAHOĎ — je navždy preč z hry (kliatba, slabá karta); pozor, balíček pod 5 kariet = prehra");
        break;
      }
      const h = v.hraci[ja];
      const pk = v.pitkaStav;
      if (pk?.reakcia === ja) {
        // Odpoveď na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
        c({ type: "bezReakcie" }, "na súperovo NA EX neodpovedať");
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, Number.POSITIVE_INFINITY, true, cielLokalitaId(v))) {
            if (t === "vlastna" || t === "superova") {
              c({ type: "place", uid: k.uid, target: t }, `odpoveď na NA EX: vylož ${meno(k.defId)} → ${POPIS_CIELA[t]} (limit nemíňa)${popisVylozenia(v, k, t)}`);
            }
          }
        }
        break;
      }
      let naexMoznosti = 0;
      if (zakazNaex(v)) out.push("(Kostol: nikto nesmie dať NA EX)");
      if (pk?.naexPouzity[ja] !== true && h.poldeciPlne > 0 && !zakazNaex(v)) {
        const ciele = new Set(naexCieleVLinii(DATA, v.strany, ja));
        for (const p of [0, 1] as const) {
          for (const pl of v.strany[p]) {
            if (!ciele.has(pl.card.uid)) continue;
            naexMoznosti++;
            const moja = pl.playedBy === ja;
            c(
              { type: "naex", uid: pl.card.uid },
              `NA EX na ${moja ? "svoju" : "SÚPEROVU"} kartu ${meno(pl.card.defId)} (na ${p === ja ? "tvojej" : "súperovej"} strane) — zruší jej aktívne akcie, zdvojí neaktívne (rátajú sa ${moja ? "tebe" : "súperovi"}; násobky sa násobia, NA EX × Silná žena = ×4); pečeň +1 tebe, poldeci sa pri bitke vypije (v ďalšom kole limit ${limitBuduceKolo(v, ja, true) === limitBuduceKolo(v, ja) ? `ostane ${limitBuduceKolo(v, ja)}` : `${limitBuduceKolo(v, ja, true)} namiesto ${limitBuduceKolo(v, ja)}`}); súper smie hneď odpovedať jednou kartou${cenaNaexText(v, pl.card.uid)}`,
            );
          }
        }
      }
      if (pk?.naexPouzity[ja] === true) out.push("(NA EX si v tejto Pitke už dal)");
      else if (naexMoznosti === 0 && !zakazNaex(v)) out.push("(NA EX ide len na Občana či Starešinu v línii bez poldeci — tvojho aj súperovho, nie Nástroj, nie Liberál, nie na súperovho Anonymného alkoholika a súperove karty vedľa neho — a len s plným poldeci)");
      const mamKartu = (defId: string) => [...v.strany[0], ...v.strany[1]].some((pl) => pl.playedBy === ja && pl.card.defId === defId);
      if (mamKartu("postarka") && pk?.postarka[ja] !== true) {
        for (let n = 1; n <= KONSTANTY.EFEKT.POSTARKA_KARTY; n++)
          c({ type: "postarka", pocet: n }, `Poštárka: dober ${n} kariet navyše a získaj ${KONSTANTY.EFEKT.POSTARKA_DLHY} Dlh (hneď priznaný)`);
      }
      if (mamKartu("starosta") && pk?.starosta[ja] !== true && h.cigarety > 0) {
        out.push(`{"type":"starosta","rukaUid":U,"senokUid":S}   — Starosta: za 1 cigaretu vymeň kartu z ruky (U) za kartu zo šenku (S)`);
      }
      if (h.cigarety > 0 && !zakazFajcit(v)) c({ type: "smoke", pocet: 1 }, "vyfajč 1 cigaretu — hneď si doberieš kartu (ťah nekončí)");
      // Zberný dvor (Michal 2026-10-20): raz za Pitku za cigaretu karta z odhadzovacieho balíčka.
      if (vykupZoSrotu(v) && pk?.vykup?.[ja] !== true && h.cigarety >= KONSTANTY.EFEKT.ZBERNY_DVOR_CENA) {
        for (const k of h.odhadzovaci) c({ type: "vykup", uid: k.uid }, `Zberný dvor: výkup zo šrotu za ${KONSTANTY.EFEKT.ZBERNY_DVOR_CENA} cigaretu — ${popisKarty(k)} z odhadzovacieho balíčka do ruky (raz za Pitku)`);
      }
      const cenaBarteru = barterCena(DATA, v, ja);
      if (h.cigarety >= cenaBarteru) c({ type: "barter" }, `barter ${cenaBarteru} cigariet → nový plný poldeci navyše`);
      if (h.cigarety >= KONSTANTY.REFILL_CENA && h.poldeciVypite > 0 && !h.dedicstvo.some((x) => x.defId === "vinko"))
        c({ type: "refillPoldeci" }, `${KONSTANTY.REFILL_CENA} cigarety → dolej vypitý poldeci`);
      if (v.ciel?.lokalita?.defId === "krcma" && naexMoznosti > 0) out.push("(Krčma: kým máš plný poldeci a kam ho dať, musíš dať NA EX — hotovo zatiaľ nejde)");
      else
        c(
          { type: "skipNaex" },
          pk?.hotovy[v.ja === 0 ? 1 : 0] === true
            ? "hotovo — súper už skončil, Pitka sa vyhodnotí (nevratné)"
            : "hotovo — končíš svoju časť Pitky (nevratné; v tejto Pitke už nedáš NA EX a súper bude mať posledné slovo)",
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
      if (b?.krok === "cintorin") {
        // Cintorín (Michal 2026-10-20): porazený dá Nástroj z ruky do Dedičstva zadarmo.
        for (const k of v.ruka) {
          if ((DATA.cards.get(k.defId)?.tags ?? []).includes("Nástroj")) c({ type: "cintorin", uid: k.uid }, `Cintorín: ${meno(k.defId)} z ruky do Dedičstva zadarmo (cena Dedičstva pre oboch aj tak stúpne)`);
        }
        c({ type: "cintorin", uid: null }, "Cintorín: nič nedávať do Dedičstva");
      }
      if (b?.krok === "exekutor") for (const o of v.volbyExekutor ?? []) c({ type: "exekutorTool", defId: o.defId, kde: o.kde }, `odovzdaj Exekútorovi ${meno(o.defId)} (${o.kde})`);
      // Len markery, ktoré sa naozaj dajú posunúť (krajná pozícia je zamknutá).
      const nahlad = (e: ElderState, cezPohorsenie: boolean, naKraj = false): string => {
        const n = nahladPosunuMarkera(DATA, v, e.elderId, su, cezPohorsenie, naKraj);
        if (n === null) return "";
        const zn = (x: number): string => (x > 0 ? `+${x}` : `${x}`);
        return ` — NÁHĽAD: body spolu ty ${zn(n.zmena[ja])} (→ ${n.body[ja]}), súper ${zn(n.zmena[su])} (→ ${n.body[su]}); priazeň po posune: ${n.priazen === null ? "nikto" : `${n.priazen === ja ? "ty" : "súper"} sila ${n.sila}`}`;
      };
      if (b?.krok === "pohorsenie") {
        const naKraj = pohorsenieNaKraj(v, ja);
        for (const e of v.starsi) {
          // Ten istý marker aj viackrát, najviac cez dve hranice zón (Kultúrny dom bez limitu).
          if (!pohorsenieMozne(v, ja, e)) continue;
          c({ type: "pohorsenie", elderId: e.elderId }, `posuň marker ${meno(e.karta.defId)} k súperovi (on dostane priazeň, starší sa začne báť teba)${nahlad(e, true, naKraj)}`);
        }
      }
      if (b?.krok === "prebytok") {
        const cena = b.vitaz === ja ? cenaPrebytku({ strany: v.strany } as unknown as GameState, ja) : 1;
        out.push(`(Prebytok zostáva ${b.prebytokZostava}; jeden posun ťa stojí ${cena}${cena > 1 ? " — Miňištrant vo tvojej partii" : ""}.)`);
        for (const e of v.starsi) {
          if (b.prebytokZostava < cena || posunMarker(e, su, false) === null) continue;
          c({ type: "prebytok", elderId: e.elderId }, `prebytok: posuň marker ${meno(e.karta.defId)} smerom k porazenému (súper dostane priazeň, starší sa začne báť teba)${nahlad(e, false)}`);
        }
      }
      if (b?.krok === "liecba") {
        c({ type: "skipLiecba" }, "preskočiť Liečbu/Pohreb");
        const cirhoza = v.hraci[ja].priznane.find((k) => k.defId === "cirhoza");
        if (cirhoza !== undefined) {
          for (const pl of [...v.strany[0], ...v.strany[1]].filter((x) => x.playedBy === ja)) {
            c({ type: "pohreb", cirhozaUid: cirhoza.uid, kartaUid: pl.card.uid }, `Pohreb: spáľ Cirhózu a ${meno(pl.card.defId)}`);
            if (DATA.cards.get(pl.card.defId)?.tags.includes("Závislý") === true)
              for (const s of v.senok) c({ type: "liecba", cirhozaUid: cirhoza.uid, zavislyUid: pl.card.uid, senokUid: s.uid }, `Liečba: ${meno(pl.card.defId)} preč, zober ${meno(s.defId)} zo šenku`);
          }
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

function textUdalosti(e: Event, mena: readonly string[], ja: PlayerId): string | null {
  const m = (p: number) => (p === ja ? "ty" : (mena[p] ?? `Hráč ${p + 1}`));
  switch (e.type) {
    case "log":
      return e.text;
    case "faza":
      return `— fáza: ${e.faza}`;
    case "tahal":
      return `${m(e.hrac)} ťahá ${e.pocet} kariet.`;
    case "kartyTahane":
      return `Dobral si: ${e.karty.map((k) => `#${k.uid} ${meno(k.defId)}`).join(", ")}`;
    case "manualEfekt":
      return `⚠ EFEKT, ktorý hra nevyhodnocuje automaticky: ${e.nazov} — ${e.text}`;
    case "bitkaVysledok":
      return `Bitka: tuhé ${e.damage.tuhe[ja]}:${e.damage.tuhe[ja === 0 ? 1 : 0]} (ty:súper), celkové ${e.damage.celkove[ja]}:${e.damage.celkove[ja === 0 ? 1 : 0]} — vyhráva ${e.vitaz === null ? "nikto" : m(e.vitaz)}${e.prebytok > 0 ? `, prebytok ${e.prebytok}${e.prebytokNaRozdelenie < e.prebytok ? ` (po Puške ${e.prebytokNaRozdelenie})` : ""}` : ""}.`;
    case "koniec":
      return `KONIEC: vyhral ${e.vitaz === null ? "nikto (remíza)" : m(e.vitaz)}. ${e.dovod}${e.body ? ` Body ${e.body[0]}:${e.body[1]} (hráč 1 : hráč 2).` : ""}`;
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

// ---- príkazy -------------------------------------------------------------------------

async function main(): Promise<void> {
  if (prikaz === "karty") {
    const s = await pripoj();
    const cards = (s.sada.cardsJson as { cards: { name: string; tags: string[]; effect_text: string; left: { actions: Record<string, number>; blocked: number[] }; right: { actions: Record<string, number>; blocked: number[] } }[] }).cards;
    for (const c of cards) {
      const a = (x: Record<string, number>) => Object.entries(x).map(([k, n]) => `${k}${n > 1 ? `×${n}` : ""}`).join(", ") || "—";
      console.log(`${c.name} [${c.tags.join(", ")}] — ${c.effect_text}\n   akcie vľavo: ${a(c.left.actions)} | vpravo: ${a(c.right.actions)} (rozloženie na pozíciách sa líši podľa kópie)`);
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

  if (prikaz === "stav") {
    vypisStav(s, []);
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
        for (const u of udalosti) console.log(`  ${u}`);
        s.ws.close();
        process.exit(2);
      }
      if (m.typ === "state") {
        s.view = m.view;
        udalosti.push(...txt(m.events));
      } else if (m.typ === "zatvorene") {
        await new Promise((ok) => setTimeout(ok, 1500));
        s = await pripoj();
      }
    }
    if (udalosti.length > 0) zapis(`(medzitým) ${udalosti.join(" | ")}`);
    vypisStav(s, udalosti);
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
    const u = txt(m.events);
    zapis(`ŤAH ${arg} → ${u.join(" | ")}`);
    vypisStav(s, u);
  } else {
    throw new Error(`Neznámy príkaz ${prikaz}.`);
  }
  s.ws.close();
}

main().catch((err: unknown) => {
  console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
