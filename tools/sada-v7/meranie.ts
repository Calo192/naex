// Meranie sady v7 partiami botov (revízia sady, Michal 2026-10-27): podiel špakov,
// remízy bitiek, Dlhy a Exekútori, ako často sa hrá Pakt, dĺžka partie.
//
// Použitie (z koreňa repozitára; ťažký výpočet — beží najviac jeden naraz):
//   node --experimental-strip-types --no-warnings tools/sada-v7/meranie.ts [partií na dĺžku=100] [vzorky bota=1]

import { readFileSync } from "node:fs";
import type { Command, DlzkaHry, GameState, PlayerId } from "../../packages/core/src/index.ts";
import { DLZKY_HRY, apply, evaluateLine, lineState, loadGameData, naTahu, setupGame, tahBota } from "../../packages/core/src/index.ts";

const nacitaj = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const data = loadGameData(nacitaj("packages/core/data/cards.json"), nacitaj("packages/core/data/elders.json"), nacitaj("packages/core/data/scorecards.json"));
const partii = Number(process.argv[2] ?? 100);
const vzorky = Number(process.argv[3] ?? 1);

interface Suhrn {
  partie: number;
  chyby: string[];
  kola: number;
  prikazy: number;
  bitky: number;
  remizy: number;
  spaky: Record<"bitky" | "finale" | "starsi" | "prebytok" | "exekutor" | "vykupne" | "cirhozy", number>;
  dlhyNove: number;
  exekucie: number;
  paktAktivny: number;
  bitkySPaktom: number;
  paktVylozeny: number;
  kseft: Record<string, number>;
  pitkyFinale: number;
  vitazFinaleVyhral: number;
  finale: number;
  /** Cirhózy, ktoré hráči v partii získali (oba). */
  cirhozyNove: number;
  /** Partie s rozdielom konečných špakov nad 15 (stomp). */
  stompy: number;
  rozdiel: number;
  konflikty: number;
  uplatky: number;
}

function zmeraj(dlzka: DlzkaHry): Suhrn {
  const s: Suhrn = {
    partie: 0, chyby: [], kola: 0, prikazy: 0, bitky: 0, remizy: 0,
    spaky: { bitky: 0, finale: 0, starsi: 0, prebytok: 0, exekutor: 0, vykupne: 0, cirhozy: 0 },
    dlhyNove: 0, exekucie: 0, paktAktivny: 0, bitkySPaktom: 0, paktVylozeny: 0, kseft: {}, pitkyFinale: 0, vitazFinaleVyhral: 0, finale: 0,
    cirhozyNove: 0, stompy: 0, rozdiel: 0, konflikty: 0, uplatky: 0,
  };
  const paktKarty = new Set(["zivnostnik", "dohadzovacka"]);
  for (let i = 0; i < partii; i++) {
    const seed = 7000 + i;
    let st: GameState = setupGame(data, seed, { lokalit: DLZKY_HRY[dlzka] });
    let n = 0;
    try {
      for (; st.koniec === null && n < 6000; n++) {
        const p = naTahu(st) as PlayerId | null;
        if (p === null) throw new Error("nikto nie je na ťahu");
        const cmd: Command = tahBota(data, st, p, seed * 1000 + n, { vzorky, povaha: p === 0 ? "stamgast" : "rapavy_fero" });
        if (cmd.type === "place" && (cmd.target === "vlastna" || cmd.target === "superova")) {
          const k = st.hraci[p].ruka.find((x) => x.uid === cmd.uid);
          if (k !== undefined && paktKarty.has(k.defId)) s.paktVylozeny++;
        }
        if (cmd.type === "uplatok") s.uplatky++;
        if (cmd.type === "kseft") {
          const pl =
            [...st.strany[0], ...st.strany[1]].find((x) => x.card.uid === cmd.uid)?.card.defId ??
            st.starsi.find((e) => e.karta.uid === cmd.uid)?.karta.defId ??
            st.ciel?.lokalita?.defId ??
            "?";
          s.kseft[pl] = (s.kseft[pl] ?? 0) + 1;
        }
        const pred = st;
        const r = apply(data, st, cmd, p);
        st = r.state;
        for (const e of r.events) {
          if (e.type === "log" && /získava Dlh/.test(e.text)) s.dlhyNove++;
          if (e.type === "log" && /získava Cirhózu/.test(e.text)) s.cirhozyNove++;
          if (e.type === "log" && e.text.startsWith("Konflikt — ")) s.konflikty++;
          if (e.type === "bitkaVysledok") {
            const ev = evaluateLine(data, lineState(pred));
            let pakt = 0;
            for (const q of [0, 1] as const) for (const zoznam of Object.values(ev.zdroje[q])) for (const z of zoznam ?? []) if (z.dovody.includes("Pakt")) pakt++;
            s.paktAktivny += pakt;
            if (pakt > 0) s.bitkySPaktom++;
          }
        }
      }
      if (st.koniec === null) throw new Error("partia sa neskončila");
    } catch (e) {
      s.chyby.push(`seed ${seed}: ${(e as Error).message}`);
      continue;
    }
    s.partie++;
    s.kola += st.kolo;
    s.prikazy += n;
    for (const b of st.nastenka) {
      s.bitky++;
      if (b.vitaz === null) s.remizy++;
      const zaBitku = b.zaBitku[0] + b.zaBitku[1];
      if (b === st.nastenka.at(-1) && st.koniec.body !== null) s.spaky.finale += zaBitku;
      else s.spaky.bitky += zaBitku;
      s.spaky.starsi += b.zaStarsich[0] + b.zaStarsich[1];
      s.spaky.prebytok += b.prebytok[0] + b.prebytok[1];
      s.spaky.exekutor -= b.exekutor[0] + b.exekutor[1];
      if (b.exekutor[0] > 0) s.exekucie++;
      if (b.exekutor[1] > 0) s.exekucie++;
    }
    const posledna = st.nastenka.at(-1);
    if (st.koniec.body !== null) {
      const r = Math.abs(st.koniec.body[0] - st.koniec.body[1]);
      s.rozdiel += r;
      if (r > 15) s.stompy++;
    }
    if (st.koniec.body !== null && posledna !== undefined) {
      s.finale++;
      s.pitkyFinale += posledna.pitky;
      if (posledna.vitaz !== null && posledna.vitaz === st.koniec.vitaz) s.vitazFinaleVyhral++;
      const vyk = st.koniec.vykupne;
      if (vyk !== undefined) s.spaky.vykupne += vyk[0].spaky + vyk[1].spaky;
      const c = st.koniec.cirhozy;
      if (c !== undefined) s.spaky.cirhozy -= 5 * (c[0] + c[1]);
    }
  }
  return s;
}

const pct = (a: number, b: number): string => (b === 0 ? "–" : `${((100 * a) / b).toFixed(1)} %`);
const avg = (a: number, b: number): string => (b === 0 ? "–" : (a / b).toFixed(2));
for (const dlzka of ["kratka", "stredna"] as const) {
  const t0 = Date.now();
  const s = zmeraj(dlzka);
  const kladne = s.spaky.bitky + s.spaky.finale + s.spaky.starsi + s.spaky.prebytok + s.spaky.vykupne;
  console.log(`\n=== ${dlzka}: ${s.partie}/${partii} partií dohraných, chyby ${s.chyby.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  for (const ch of s.chyby.slice(0, 5)) console.log(`  CHYBA ${ch}`);
  console.log(`dĺžka: ${avg(s.kola, s.partie)} kôl, ${avg(s.prikazy, s.partie)} príkazov, ${avg(s.bitky, s.partie)} bitiek na partiu`);
  console.log(`remízy bitiek (sekera): ${s.remizy}/${s.bitky} = ${pct(s.remizy, s.bitky)}`);
  console.log(
    `podiel kladných špakov: bitky ${pct(s.spaky.bitky, kladne)}, finále ${pct(s.spaky.finale, kladne)}, starší ${pct(s.spaky.starsi, kladne)}, prebytok ${pct(s.spaky.prebytok, kladne)}, výkupné ${pct(s.spaky.vykupne, kladne)}; záporné na partiu: Exekútor ${avg(s.spaky.exekutor, s.partie)}, Cirhóza ${avg(s.spaky.cirhozy, s.partie)}`,
  );
  console.log(`Dlhy: ${avg(s.dlhyNove, s.partie)} nových za partiu (oba hráči), exekúcie ${avg(s.exekucie, s.partie)} za partiu; Cirhózy ${avg(s.cirhozyNove, s.partie)} nových za partiu`);
  console.log(`konečný rozdiel špakov: priemer ${avg(s.rozdiel, s.partie)}, stompy (rozdiel > 15) ${s.stompy}/${s.partie} = ${pct(s.stompy, s.partie)}`);
  console.log(`Konflikty ${avg(s.konflikty, s.partie)} za partiu, Úplatky ${avg(s.uplatky, s.partie)} za partiu`);
  console.log(`Pakt: karty s Paktom vyložené ${avg(s.paktVylozeny, s.partie)}× za partiu, aktívny Pakt v ${pct(s.bitkySPaktom, s.bitky)} bitiek (${avg(s.paktAktivny, s.partie)} aktívnych za partiu)`);
  console.log(`finále: ${avg(s.pitkyFinale, s.finale)} Pitky, víťaz finále vyhral partiu v ${pct(s.vitazFinaleVyhral, s.finale)}`);
  console.log(`Kšefty za partiu: ${Object.entries(s.kseft).map(([k, v]) => `${k} ${avg(v, s.partie)}`).join(", ") || "žiadne"}`);
}
