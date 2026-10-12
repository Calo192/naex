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
import type { CardInstance, ClientState, Command, ElderState, Event, GameData, GameState, PlayerId, VerejnyStav } from "@naex/core";
import {
  KONSTANTY,
  STUPNICA_ZONY,
  bitkaOStarsiehoMozna,
  bodyTeraz,
  cenaPrebytku,
  favourStarsieho,
  cieleVykladania,
  evaluateLine,
  hodnotaZopar,
  loadGameData,
  nahladBitkyOStarsieho,
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
  scorecardStarsieho,
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
  // Sledovateľ si otvára partiu v prehliadači za toho istého hráča a server
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
function kartaVLinii(k: CardInstance, otocena: boolean, ev: ReturnType<typeof evaluateLine>, poznamka: string): string {
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
  return `  #${k.uid} ${meno(k.defId)}${otocena ? " (otočená k tebe nohami hore)" : ""}${poznamka}${e?.vzbura === true ? " VZBURA" : ""}\n      ľavý okraj: ${strana("left")}\n      pravý okraj: ${strana("right")}`;
}

function vykresli(v: ClientState, mena: readonly string[]): string {
  const ja = v.ja;
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const out: string[] = [];
  const kto = (p: PlayerId | null) => (p === null ? "nikto" : p === ja ? "TY" : mena[p] ?? `Hráč ${p + 1}`);
  out.push(
    `=== Kolo ${v.kolo}, fáza ${v.faza}${v.faza === "pitka" ? ` ${v.pitkaCislo}/${v.pitkyCelkom}` : ""}${v.bitkaStav?.krok ? ` (krok ${v.bitkaStav.krok})` : ""} — na ťahu: ${v.draftStav?.krok === "stavba" ? "obaja naraz (stavba šenku)" : kto(v.naTahu)} ===`,
  );
  if (v.koniec !== null) {
    out.push(`KONIEC HRY: vyhral ${kto(v.koniec.vitaz)}. ${v.koniec.dovod}${v.koniec.body ? ` Body: ty ${v.koniec.body[ja]}, súper ${v.koniec.body[su]}.` : ""}`);
  }
  out.push(
    `Ty si ${mena[ja]} (${v.utocnik === ja ? "útočník — vyberáš cieľ kola" : "obranca — zo šenku berieš prvý a vykladáš prvý"}), súper ${mena[su]}. Hrá sa o ${v.lokalitCelkom} lokalít, ovládnutých ${v.ovladnute.length}${v.prepadnute.length > 0 ? `, prepadnutých ${v.prepadnute.length}` : ""}. Limit ruky na konci kola: ty ${v.limitRuky[ja]}, súper ${v.limitRuky[su]}.`,
  );

  // Stôl po prípadnom vyhodnotení — rovnako ako klient. V strede leží
  // lokalita, v bitke o staršieho karta staršieho.
  const lineEval = evaluateLine(DATA, {
    lokalita: v.ciel?.lokalita ?? null,
    lokalitaOtocena: v.lokalitaOtocena,
    strany: v.strany,
  });
  const stol: VerejnyStav = { ciel: v.ciel, ovladnute: v.ovladnute, strany: v.strany, starsi: v.starsi, hraci: v.hraci };
  for (const p of [ja, su] as const) {
    const h = v.hraci[p];
    const pr = prahyHraca(DATA, stol, p);
    out.push(
      `${p === ja ? "TVOJE ZDROJE" : "SÚPEROVE ZDROJE"}: poldeci plné ${h.poldeciPlne}, vypité ${h.poldeciVypite} | cigarety ${h.cigarety} | pečeň ${h.pecen}/${pr.cirhoza} | zadĺženie ${h.zadlzenie}/${pr.dlh} | priznané dlhy ${pr.priznaneDlhy}/${pr.exekutor} | ruka ${h.rukaPocet}, balíček ${h.doberaciPocet}, odhodené ${h.odhadzovaci.length}`,
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
        `BRANIE ZO ŠENKU (striedavo po jednej, začína obranca, najviac 3): ty ${d.noveKarty[ja]}/3${d.hotovo[ja] ? " (skončil si)" : ""}, súper ${d.noveKarty[su]}/3${d.hotovo[su] ? " (skončil)" : ""}.`,
      );
    }
  }
  if (v.zhromazdenieStav !== null) {
    const z = v.zhromazdenieStav;
    out.push(`Zhromaždenie: tebe zostáva vyložiť ${z.zostavaLimit[ja]}${z.navyse[ja] > 0 ? ` — po vypití hráš ešte ${z.navyse[ja] + 1} vyloženia za sebou` : ""}${z.pasoval[ja] ? " (pasoval si)" : ""}, súperovi ${z.zostavaLimit[su]}${z.pasoval[su] ? " (pasoval)" : ""}.`);
  }

  out.push("");
  out.push(
    v.ciel === null
      ? "CIEĽ KOLA: ešte nevybraný."
      : v.ciel.typ === "lokalita"
        ? `CIEĽ KOLA: bitka o lokalitu ${meno(v.ciel.lokalita?.defId ?? "")}.`
        : `CIEĽ KOLA: bitka o staršieho ${meno(v.starsi.find((e) => e.elderId === v.ciel?.elderId)?.karta.defId ?? "")}.`,
  );
  out.push("LÍNIA zľava doprava (tvoja strana končí vľavo, lokalita v strede, súperova strana vpravo).");
  out.push("Spoj = pravý okraj karty + ľavý okraj nasledujúcej. ✓ aktívna, ✗ zrušená Odporom, · neaktívna (bez páru).");
  out.push("Karta PATRÍ tomu, kto ju zahral (je natočená k nemu) — jej akcie a efekty sa rátajú jemu, nech leží na ktorejkoľvek strane. Tvoja PARTIA = tvoje karty. Akciu lokality na spoji dostane majiteľ susednej karty.");
  const majitel = (p: PlayerId) => (p === ja ? "TVOJA karta" : "SÚPEROVA karta");
  const moja = [...v.strany[ja]].reverse();
  for (const pl of moja) out.push(kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na tvojej strane${pl.naexBy !== undefined ? `, NA EX: ${kto(pl.naexBy)}` : ""}]`));
  if (v.ciel !== null && v.ciel.lokalita !== null) {
    const popis = v.ciel.typ === "lokalita" ? " [LOKALITA]" : " [KARTA STARŠIEHO V STREDE — jej akcie na spoji dostane majiteľ susednej karty, efekt nie]";
    out.push(kartaVLinii(v.ciel.lokalita, v.lokalitaOtocena !== (ja === 1), lineEval, popis));
  } else out.push("  (stred línie — ešte nič)");
  for (const pl of v.strany[su]) out.push(kartaVLinii(pl.card, pl.playedBy !== ja, lineEval, ` [${majitel(pl.playedBy)} na súperovej strane${pl.naexBy !== undefined ? `, NA EX: ${kto(pl.naexBy)}` : ""}]`));

  const sumy = (p: PlayerId) => Object.entries(lineEval.sums[p]).map(([a, n]) => `${a} ${n}`).join(", ") || "nič";
  out.push(`Tvoje aktívne akcie (tvoja partia + akcie lokality, ktoré aktivuje tvoja karta): ${sumy(ja)}`);
  out.push(`Súperove aktívne akcie: ${sumy(su)}`);
  if (v.ciel !== null && v.koniec === null) {
    const abstaky = v.ruka.filter((k) => k.defId === "abstak").length;
    const d = v.bitkaStav?.damage ?? poskodenieBitky(DATA, stol, lineEval.sums, ja === 0 ? [abstaky, 0] : [0, abstaky]);
    out.push(
      `${v.bitkaStav?.damage ? "VÝSLEDOK BITKY" : "ODHAD BITKY (súperove absťáky v ruke nepoznáš)"}: tuhé poškodenie ty ${d.tuhe[ja]} : súper ${d.tuhe[su]}, celkové ty ${d.celkove[ja]} : súper ${d.celkove[su]}.`,
    );
  }

  out.push("");
  const body = bodyTeraz(DATA, v);
  out.push("STARŠÍ (stupnica 0–8: 0–2 polovica hráča 1, 3–5 neutrál, 6–8 polovica hráča 2; ľavá strana scorecardu patrí hráčovi 1):");
  out.push("  PRIAZEŇ (počas hry) má hráč, ku ktorému je marker posunutý. BODY (koniec hry) dostane ten DRUHÝ — koho sa starší bojí — za aktivované podmienky na svojej strane. Lokality, starší a cigarety za kus bodujú len od oranžovej zóny (marker 0–1 alebo 7–8).");
  out.push(`  BODY TERAZ (keby hra skončila teraz): ty ${body.spolu[ja]}, súper ${body.spolu[su]}${body.neiste[su] ? " (najviac — jeho skryté Dlhy a Cirhózy nevidíš)" : ""}.`);
  for (const e of v.starsi) out.push(popisStarsieho(e, ja, kto, body.starsi.find((b) => b.elderId === e.elderId)?.body ?? 0));

  out.push("");
  out.push(`ŠENOK (${v.senok.length}, spoločný balíček ${v.spolocnyBalicekPocet}):`);
  for (const k of v.senok) out.push(`  ${popisKarty(k)}`);
  out.push(`LOKALITY V HRE (${v.lokalityVHre.length}):`);
  for (const k of v.lokalityVHre) out.push(`  ${popisKarty(k)}`);
  if (v.ovladnute.length > 0) out.push(`OVLÁDNUTÉ: ${v.ovladnute.map((o) => `${meno(o.karta.defId)} (${kto(o.hrac)})`).join(", ")}`);
  if (v.prepadnute.length > 0) out.push(`PREPADNUTÉ (nikto ich nevyhral): ${v.prepadnute.map((k) => meno(k.defId)).join(", ")}`);

  out.push("");
  out.push(`TVOJA RUKA (${v.ruka.length}):`);
  for (const k of v.ruka) out.push(`  ${popisKarty(k)}`);
  // Balíčky, ktoré hráčovi podľa karty odhalil server (Policajtka, Veštica).
  if (v.volbaPolicajtka !== null) {
    out.push("");
    out.push(`POLICAJTKA — TVOJ DOBERACÍ BALÍČEK zhora (poradové číslo: karta):`);
    v.volbaPolicajtka.forEach((k, i) => out.push(`  ${i}: ${popisKarty(k)}`));
  }
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
  ZBERATEL: (s) => `limit ruky na konci kola ${KONSTANTY.LIMIT_RUKY_ZAKLAD + s}`,
  LAKOMEC: (s) => `trocha = ${1 + s}`,
  NEPRAJNIK: (s) => `zopár = ${2 + s}`,
  BITKAR: (s) => `+${s} tuhého poškodenia v bitke`,
  VERIACI: (s) => `Viera má hodnotu ${1 + s}`,
  FAJCIAR: (s) => `+${s} Cigaretiek v 1. Pitke bitky o lokalitu`,
  ALKOHOLIK: (s) => `prah Cirhózy ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD + s}`,
  EXEKUTOR: (s) => `prah Exekútora ${10 + 2 * s}`,
};

function popisStarsieho(e: ElderState, ja: PlayerId, kto: (p: PlayerId | null) => string, bodyTeraz: number): string {
  const sc = scorecardStarsieho(DATA, e);
  const pr = priazenHraca(e);
  const preb = prebudenyPre(e);
  const ob = obavanyHrac(e);
  const podm = podmienkyStarsieho(DATA, e)
    .filter((p) => p.aktivna)
    .map((p) => `${p.hrac === ja ? "tvoja" : "súperova"} ${p.podmienka}`)
    .join(", ");
  const favour = favourStarsieho(DATA, e);
  const ucinok = UCINOK[favour]?.(pr === null ? 1 : priazenSila(e)) ?? "";
  return `  ${e.elderId}: ${meno(e.karta.defId)} na scorecarde ${sc.nazov} | marker ${e.marker} (zóna ${STUPNICA_ZONY[e.marker]})${e.nahradeny ? " | NÁHRADA (hrá ďalej: marker, priazeň, body; bojovať o ňu sa nedá)" : ""}${e.marker === 0 || e.marker === 8 ? " | ZAMKNUTÝ na krajnej pozícii" : ""} | ${preb !== null ? `prebudený pre ${kto(preb)} | ` : ""}${pr !== null ? `priazeň ${kto(pr)} +${priazenSila(e)} (${ucinok})` : `priazeň nikto (kto ju získa: ${ucinok})`}${ob !== null ? ` | bojí sa: ${kto(ob)} → body teraz ${bodyTeraz} pre ${kto(ob)}` : " | nikoho sa nebojí → body nikto"}\n      aktivované podmienky: ${podm || "žiadne"}`;
}

// ---- možné ťahy -------------------------------------------------------------------

const POPIS_CIELA: Record<string, string> = {
  vlastna: "na koniec tvojej strany",
  superova: "na koniec súperovej strany (karta ostane tvoja, natočená k tebe)",
  priznanie: "priznať — kliatba je NAVŽDY mimo balíčka (čistí ho), nemíňa limit a neodovzdá ťah (môžeš priznať viac kliatob za sebou a potom ešte vyložiť); Dlh: dobereš kartu, ale ráta sa k Exekútorovi a súperovým Poverám",
  dedicstvo: "do Dedičstva",
};

function moznosti(v: ClientState): string[] {
  if (v.koniec !== null || !v.mozemHrat) return [];
  const ja = v.ja;
  const out: string[] = [];
  const c = (cmd: Command, popis: string) => out.push(`${JSON.stringify(cmd)}   — ${popis}`);
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  if (v.volbaPolicajtka !== null) {
    out.push(
      `{"type":"policajtka","hore":[poradové čísla…]}   — Policajtka: karty s týmito číslami (balíček vyššie) dáš NAVRCH v tomto poradí, ostatné idú naspodok`,
    );
    return out;
  }
  switch (v.faza) {
    case "volbaCiela": {
      for (const k of v.lokalityVHre) {
        c({ type: "chooseLocation", uid: k.uid, otocena: false }, `bitka o lokalitu ${meno(k.defId)}`);
        c({ type: "chooseLocation", uid: k.uid, otocena: true }, `bitka o lokalitu ${meno(k.defId)}, otočenú o 180°`);
      }
      for (const e of v.starsi) {
        if (!bitkaOStarsiehoMozna(e)) continue;
        // Náhľad: víťaz dá marker do sivej — body z toho staršieho zmiznú obom.
        const n = nahladBitkyOStarsieho(DATA, v, e.elderId);
        const b = (x: readonly [number, number]) => `${x[ja]}:${x[su]}`;
        const popis = `bitka o staršieho ${meno(e.karta.defId)} (jeho karta leží v strede ako lokalita); body ty:súper teraz ${b(n.teraz)}, ak vyhráš ${b(n.vyhra[ja])}, ak prehráš ${b(n.vyhra[su])} (bez prebytku)`;
        c({ type: "chooseElder", elderId: e.elderId, otocena: false }, popis);
        c({ type: "chooseElder", elderId: e.elderId, otocena: true }, `${popis}, karta otočená o 180°`);
      }
      break;
    }
    case "draft": {
      const ds = v.draftStav;
      if (ds === null) break;
      if (ds.krok === "stavba") {
        out.push(
          `{"type":"stavbaSenku","doSenku":A,"odhod":B}   — z TVOJHO BALÍČKA STAVBY (vyššie) daj kartu A do šenku (uvidia ju obaja, berie sa z neho) a kartu B naspodok spoločného balíčka (súper ju neuvidí). Zvyšných ${Math.max(0, ds.mojBalicek.length - 2)} podáš súperovi. Súper vyberá naraz s tebou; karty do šenku sa odhalia, keď vyberiete obaja.`,
        );
        break;
      }
      const mam = ds.noveKarty[ja];
      const manzelky = v.hraci[ja].priznane.filter((k) => k.defId === "milujuca_manzelka").length;
      const cig = Math.max(0, 3 - mam - manzelky);
      c({ type: "draftStop" }, `prestaň brať — máš ${mam}/3 kariet, dostaneš ${cig} cigariet${manzelky > 0 ? " (Milujúca manželka uberá)" : ""}${ds.hotovo[su] ? "" : "; súper potom berie ďalej sám"}`);
      for (const k of v.senok) c({ type: "draftBer", uid: k.uid }, `vezmi zo šenku ${meno(k.defId)} (${mam + 1}/3)`);
      const pitky = (moje: number) => Math.max(1, Math.abs(moje - ds.noveKarty[su]));
      if (ds.hotovo[su]) out.push(`(Súper skončil s ${ds.noveKarty[su]} kartami. Pitiek bude |rozdiel kariet|, aspoň 1: ak prestaneš teraz, ${pitky(mam)}.)`);
      break;
    }
    case "zhromazdenie": {
      const z = v.zhromazdenieStav;
      c({ type: "pass" }, "pasovať (v tomto Zhromaždení už nevykladáš)");
      if (v.hraci[ja].poldeciPlne > 0)
        c({ type: "vypit" }, "VYPIŤ do dna: plný poldeci → vypitý; ďalšou kartou ti ťah neskončí (dve za sebou), ale limit −1 a pečeň +1; dá sa opakovať");
      if (z !== null) {
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, z.zostavaLimit[ja])) c({ type: "place", uid: k.uid, target: t }, `vylož ${meno(k.defId)} → ${POPIS_CIELA[t]}`);
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
          "(Máš v ruke Cirhózu: priznaj ju — body neuberá a po bitke ti odomkne Liečbu alebo Pohreb. Pohreb navždy spáli tvoju slabú kartu, ktorú si vyložil do línie; Liečba vymení tvojho Závislého z línie za kartu zo šenku.)",
        );
      break;
    }
    case "pitka": {
      const h = v.hraci[ja];
      const pk = v.pitkaStav;
      if (pk?.reakcia === ja) {
        // Odpoveď na súperovo NA EX (Michal 2026-10-12): jedna karta mimo limitu.
        c({ type: "bezReakcie" }, "na súperovo NA EX neodpovedať");
        for (const k of v.ruka) {
          for (const t of cieleVykladania(DATA, v.strany, ja, k, Number.POSITIVE_INFINITY)) {
            if (t === "vlastna" || t === "superova") {
              c({ type: "place", uid: k.uid, target: t }, `odpoveď na NA EX: vylož ${meno(k.defId)} → ${POPIS_CIELA[t]} (limit nemíňa)`);
            }
          }
        }
        break;
      }
      if (pk?.zakazNaex[ja] === true) out.push("(Svokra: v tejto Pitke nesmieš dať NA EX)");
      let naexMoznosti = 0;
      if (pk?.naexPouzity[ja] !== true && pk?.zakazNaex[ja] !== true && h.poldeciPlne > 0) {
        for (const p of [0, 1] as const) {
          for (const pl of v.strany[p]) {
            // NA EX len na vlastnú kartu (natočenú k tebe) bez poldeci; Liberál nie.
            if (pl.naexBy !== undefined || pl.playedBy !== ja || pl.card.defId === "liberal") continue;
            const tagy = DATA.cards.get(pl.card.defId)?.tags ?? [];
            if (tagy.includes("Občan") || tagy.includes("Starešina")) {
              naexMoznosti++;
              c(
                { type: "naex", uid: pl.card.uid },
                `NA EX na svoju kartu ${meno(pl.card.defId)} (na ${p === ja ? "tvojej" : "súperovej"} strane) — zruší jej aktívne akcie, zdvojí neaktívne; pečeň +1, poldeci sa pri bitke vypije (ďalšie kolo limit −1); súper smie hneď odpovedať jednou kartou`,
              );
            }
          }
        }
      }
      if (pk?.naexPouzity[ja] === true) out.push("(NA EX si v tejto Pitke už dal)");
      else if (naexMoznosti === 0) out.push("(NA EX ide len na tvojho Občana či Starešinu v línii bez poldeci — nie Nástroj, nie Liberál — a len s plným poldeci)");
      const mamKartu = (defId: string) => [...v.strany[0], ...v.strany[1]].some((pl) => pl.playedBy === ja && pl.card.defId === defId);
      if (mamKartu("postarka") && pk?.postarka[ja] !== true) {
        const zopar = hodnotaZopar(priazen(DATA, v, "NEPRAJNIK", ja));
        for (let n = 1; n <= zopar; n++) c({ type: "postarka", pocet: n }, `Poštárka: dober ${n} kariet navyše a s nimi Trocha Dlhov`);
      }
      if (mamKartu("starosta") && pk?.starosta[ja] !== true && h.cigarety > 0) {
        out.push(`{"type":"starosta","rukaUid":U,"senokUid":S}   — Starosta: za 1 cigaretu vymeň kartu z ruky (U) za kartu zo šenku (S)`);
      }
      if (h.cigarety > 0) c({ type: "smoke", pocet: 1 }, "vyfajč 1 cigaretu (+1 ťahanie)");
      if (h.cigarety >= 5) c({ type: "barter" }, "barter 5 cigariet → nový plný poldeci");
      if (h.cigarety >= 2 && h.poldeciVypite > 0) c({ type: "refillPoldeci" }, "2 cigarety → dolej vypitý poldeci");
      if (v.ciel?.lokalita?.defId === "krcma" && naexMoznosti > 0) out.push("(Krčma: kým máš plný poldeci a kam ho dať, musíš dať NA EX — hotovo zatiaľ nejde)");
      else c({ type: "skipNaex" }, "hotovo (ukonči svoju časť Pitky)");
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
      if (b?.krok === "limitRuky") {
        const nadbytok = v.ruka.length - v.limitRuky[ja];
        out.push(`{"type":"odhod","uids":[…]}   — limit ruky ${v.limitRuky[ja]}: odhoď presne ${nadbytok} kariet z ruky do odhadzovacieho balíčka (uid z ruky nižšie)${v.ruka.some((k) => k.defId === "dlh") ? ". Odhodený Dlh sa vráti do balíčka — nabudúce ho radšej prizn v Zhromaždení (dobereš kartu a zmizne navždy)" : ""}`);
      }
      if (b?.krok === "exekutor") for (const o of v.volbyExekutor ?? []) c({ type: "exekutorTool", defId: o.defId, kde: o.kde }, `odovzdaj Exekútorovi ${meno(o.defId)} (${o.kde})`);
      // Len markery, ktoré sa naozaj dajú posunúť (krajná pozícia je zamknutá).
      if (b?.krok === "pohorsenie") {
        for (const e of v.starsi) {
          if (b.pohnuteMarkery.includes(e.elderId) || posunMarker(e, su, true) === null) continue;
          c({ type: "pohorsenie", elderId: e.elderId }, `posuň marker ${meno(e.karta.defId)} k súperovi (on dostane priazeň teraz, ty body na konci)`);
        }
      }
      if (b?.krok === "prebytok") {
        const vyluceny = v.ciel?.typ === "starsi" ? v.ciel.elderId : null;
        const cena = b.vitaz === ja ? cenaPrebytku({ strany: v.strany } as unknown as GameState, ja) : 1;
        out.push(`(Prebytok zostáva ${b.prebytokZostava}; jeden posun ťa stojí ${cena}${cena > 1 ? " — Miňištrant vo tvojej partii" : ""}.)`);
        for (const e of v.starsi) {
          if (e.elderId === vyluceny || posunMarker(e, su, false) === null) continue;
          c({ type: "prebytok", elderId: e.elderId }, `prebytok: posuň marker ${meno(e.karta.defId)} smerom k porazenému (súper priazeň teraz, ty body na konci)`);
        }
      }
      if (b?.krok === "nahrada")
        for (const o of v.volbyNahrada ?? []) for (const m of [3, 4, 5] as const) out.push(`${JSON.stringify({ type: "nahrada", defId: o.defId, kde: o.kde, marker: m })}   — náhrada staršieho kartou ${meno(o.defId)}, marker na ${m}`);
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
      return `Bitka: tuhé ${e.damage.tuhe[ja]}:${e.damage.tuhe[ja === 0 ? 1 : 0]} (ty:súper), celkové ${e.damage.celkove[ja]}:${e.damage.celkove[ja === 0 ? 1 : 0]} — vyhráva ${m(e.vitaz)}${e.prebytok > 0 ? `, prebytok ${e.prebytok}` : ""}.`;
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
    // Miesto na chvíľu prevzal sledovateľ — pošli ťah ešte raz.
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
