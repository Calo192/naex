// Návrh „50 nových kariet“: node docs/napady/nove-karty-50/gen.cjs → docs/napady/nove-karty-50.html a .json.
// Dáta sú v data.cjs. Pred zápisom skontroluje power level, počty variantov, najviac 1 Odpor, duplicity akcií
// a jedinečnosť preškolení nad packages/core/data/cards.json; pri chybe nič nezapíše.
const fs = require("fs");
const path = require("path");
const { karty, skupiny, rework } = require("./data.cjs");

const cestaSady = process.argv[2] || path.join(__dirname, "../../../packages/core/data/cards.json");
const vystup = process.argv[3] || path.join(__dirname, "..");
const sada = JSON.parse(fs.readFileSync(cestaSady, "utf8"));

// Predvolené váhy akcií z packages/tvorba/src/powerLevel.ts (kľúče tu po mene akcie).
const VAHY = { Rana: 1, Pecka: 2, Petelica: 3, Povera: 1, "Pohoršenie": 2, Viera: 1.5, Cigareta: 1, "Vízia": 1.5, Poldeci: 0.5, Posilnenie: 1.5, Odpor: 1, Pakt: 1, Robota: 1, Obmedzenie: 1, Hazard: -2, "Pečeň": -1.5 };
const KLUC = { Hazard: "Dlh", "Pečeň": "PoškodeniePečene" };
const MENO_AKCIE = { Dlh: "Hazard", "PoškodeniePečene": "Pečeň" };
const SKRATKA = { "Pohoršenie": "Pohorš.", Obmedzenie: "Obmedz.", Posilnenie: "Posiln." };
const TRIEDA = { Rana: "utok", Pecka: "utok", Petelica: "utok", Hazard: "zle", "Pečeň": "zle", Povera: "makke", "Pohoršenie": "makke" };

const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fakt = (n) => (n <= 1 ? 1 : n * fakt(n - 1));

const chyby = [];
const varovania = [];

function strana(s) {
  const pevne = Object.keys(s.f).map(Number);
  for (const i of pevne) if (s.b.includes(i)) chyby.push("pevná akcia na blokovanom slote");
  const volne = [0, 1, 2, 3].filter((i) => !s.b.includes(i) && !pevne.includes(i));
  if (s.l.length > volne.length) chyby.push("viac akcií než slotov");
  const pocty = {};
  for (const a of s.l) pocty[a] = (pocty[a] || 0) + 1;
  let perm = fakt(volne.length) / fakt(volne.length - s.l.length);
  for (const c of Object.values(pocty)) perm /= fakt(c);
  // Ukážkové rozloženie: pevné na mieste, voľné po poradí.
  const sloty = [0, 1, 2, 3].map((i) => (s.b.includes(i) ? "#" : s.f[i] || ""));
  let k = 0;
  for (const i of volne) if (k < s.l.length) sloty[i] = s.l[k++];
  const akcie = [...Object.values(s.f), ...s.l];
  return { sloty, perm, akcie, volne, pevne: s.f, volneAkcie: s.l, blokovane: s.b };
}

function pocetAkcii(akcie) {
  const p = {};
  for (const a of akcie) p[a] = (p[a] || 0) + 1;
  return p;
}

// ── Existujúca sada: mená, podpisy akcií, dvojice preškolení ──
const existMena = new Set(sada.cards.map((c) => c.name.toLowerCase()));
const existPodpisy = new Map();
for (const c of sada.cards) {
  const t = c.tags || [];
  if (t.includes("Lokalita") || t.includes("Kliatba") || t.includes("Nástroj")) continue;
  const akcie = [];
  for (const s of ["left", "right"]) for (const [k, v] of Object.entries((c[s] || {}).actions || {})) for (let i = 0; i < v; i++) akcie.push(MENO_AKCIE[k] || k);
  existPodpisy.set(akcie.sort().join("+"), c.name);
}
const norm = (x) => (x === "PoškodeniePečene" ? "Pečeň" : x === "Dlh" ? "Hazard" : x);
function dvojice(text) {
  const von = [];
  const re = /\{([^}]+)\}→\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(text))) von.push(norm(m[1]) + "→" + norm(m[2]));
  const re2 = /Posilnen[áéý] \{([^}]+)\}/g;
  while ((m = re2.exec(text))) von.push("Posilnená " + norm(m[1]));
  return von;
}
const existDvojice = new Map();
for (const c of sada.cards) for (const d of dvojice(c.effect_text || "")) existDvojice.set(d, c.name);
// Šesť premien, ktoré čakajú na verdikt O13 (docs/napady/premeny-akcii.html).
for (const d of ["Robota→Pečeň", "Poldeci→Pečeň", "Viera→Hazard", "Pecka→Rana"]) existDvojice.set(d, "čakajúca premena O13");

// ── Výpočty a kontroly ──
const noveDvojice = new Map();
const novePodpisy = new Map();
karty.forEach((k, i) => {
  k.n = i + 1;
  if (existMena.has(k.meno.toLowerCase())) chyby.push(`${k.meno}: meno už v sade je`);
  const text = k.typ === "Nástroj" ? `${k.hore} ${k.dole}` : k.efekt;
  for (const d of dvojice(text)) {
    if (existDvojice.has(d)) chyby.push(`${k.meno}: dvojica ${d} už je (${existDvojice.get(d)})`);
    if (noveDvojice.has(d)) chyby.push(`${k.meno}: dvojica ${d} sa opakuje (${noveDvojice.get(d)})`);
    noveDvojice.set(d, k.meno);
  }
  if (k.typ === "Občan" || k.typ === "Zviera") {
    const L = strana(k.L), P = strana(k.P);
    k.vL = L; k.vP = P;
    k.akcie = [...L.akcie, ...P.akcie];
    k.plAkcie = k.akcie.reduce((s, a) => s + (VAHY[a] ?? NaN), 0);
    if (Number.isNaN(k.plAkcie)) chyby.push(`${k.meno}: neznáma akcia`);
    k.pl = k.plAkcie + k.efv;
    k.varianty = L.perm * P.perm;
    const odpory = k.akcie.filter((a) => a === "Odpor").length;
    if (odpory > 1) chyby.push(`${k.meno}: viac než 1 Odpor`);
    for (const s of [k.L, k.P]) {
      for (const [i2, a] of Object.entries(s.f)) {
        if (a === "Odpor" && Number(i2) !== 1) chyby.push(`${k.meno}: Odpor mimo slotu 1`);
        if (a === "Posilnenie" && Number(i2) !== 2) chyby.push(`${k.meno}: Posilnenie mimo slotu 2`);
      }
      if (s.l.includes("Odpor") || s.l.includes("Posilnenie")) chyby.push(`${k.meno}: Odpor/Posilnenie nie je pripnuté`);
    }
    const [lo, hi] = k.typ === "Občan" ? [4, 8] : [2, 4];
    if (k.varianty < lo || k.varianty > hi) chyby.push(`${k.meno}: ${k.varianty} variantov (má byť ${lo}–${hi})`);
    const n = k.akcie.length;
    if (k.typ === "Občan" && (n < 3 || n > 6)) chyby.push(`${k.meno}: ${n} akcií`);
    if (k.typ === "Zviera" && (n < 1 || n > 3)) chyby.push(`${k.meno}: ${n} akcií`);
    if (k.typ === "Občan" && (k.pl < 2 || k.pl > 5.5)) varovania.push(`${k.meno}: power level ${k.pl}`);
    if (k.typ === "Zviera" && (k.pl < 3 || k.pl > 5.5)) varovania.push(`${k.meno}: power level ${k.pl}`);
    const podpis = [...k.akcie].sort().join("+");
    if (existPodpisy.has(podpis)) varovania.push(`${k.meno}: rovnaké akcie ako ${existPodpisy.get(podpis)} (${podpis})`);
    if (novePodpisy.has(podpis)) chyby.push(`${k.meno}: rovnaké akcie ako ${novePodpisy.get(podpis)} (${podpis})`);
    novePodpisy.set(podpis, k.meno);
  }
});
if (karty.length !== 50) chyby.push(`kariet je ${karty.length}, nie 50`);
const idMnozina = new Set(karty.map((k) => k.id));
if (idMnozina.size !== karty.length) chyby.push("opakované id");

// ── Výpis kontroly ──
const poTypoch = {};
for (const k of karty) poTypoch[k.typ] = (poTypoch[k.typ] || 0) + 1;
console.log("Typy:", JSON.stringify(poTypoch), "· prvá vlna:", karty.filter((k) => k.hviezda).length);
for (const k of karty) if (k.pl !== undefined) console.log(`${String(k.n).padStart(2)} ${k.meno.padEnd(34)} ${k.typ.padEnd(7)} akcií ${k.akcie.length}  akcie ${fmt(k.plAkcie).padStart(5)} + efekt ${fmt(k.efv).padStart(4)} = ${fmt(k.pl).padStart(4)}  variantov ${k.varianty}`);
const plO = karty.filter((k) => k.typ === "Občan").map((k) => k.pl).sort((a, b) => a - b);
console.log("Občania: min", plO[0], "medián", plO[Math.floor(plO.length / 2)], "max", plO[plO.length - 1]);
const vyskyt = {};
for (const k of karty) for (const a of k.akcie || []) vyskyt[a] = (vyskyt[a] || 0) + 1;
console.log("Výskyt akcií na hranách:", JSON.stringify(vyskyt));
console.log("Nové dvojice:", [...noveDvojice.keys()].join(" · "));
if (varovania.length) console.log("VAROVANIA:\n  " + varovania.join("\n  "));
if (chyby.length) { console.log("CHYBY:\n  " + chyby.join("\n  ")); process.exit(1); }

// ── HTML ──
const cislo = (id) => karty.find((k) => k.id === id).n;
const odkaz = (id) => `<a href="#k${cislo(id)}">${cislo(id)}</a>`;
const akcSpan = (a) => `<span class="akc ${TRIEDA[a] || ""}">${esc(a)}</span>`;
const efektHtml = (t) => {
  const i = t.indexOf(":");
  const spustac = i > 0 && i < 22 ? `<b class="sp">${esc(t.slice(0, i + 1))}</b>` : "";
  const zvysok = esc(i > 0 && i < 22 ? t.slice(i + 1) : t).replace(/\{([^}]+)\}/g, (_, a) => akcSpan(a));
  return spustac + zvysok;
};
const textSAkciami = (t) => esc(t).replace(/{([^}]+)}/g, (_, a) => akcSpan(a));
const slotHtml = (v) => {
  if (v === "#") return `<div class="slot blok" aria-label="blokovaný slot"></div>`;
  if (v === "") return `<div class="slot volny" aria-label="prázdny slot"></div>`;
  return `<div class="slot ${TRIEDA[v] || ""}">${esc(SKRATKA[v] || v)}</div>`;
};

function miniKarta(k) {
  if (k.typ === "Nástroj") {
    return `<figure class="mk mk-nastroj" aria-label="Náhľad karty ${esc(k.meno)}">
      <div class="hrana">▲ Hore: ${efektHtml(k.hore)}</div>
      <div class="mk-stred"><p class="mk-nazov">${esc(k.meno)}</p><p class="mk-efekt"><b class="sp">Dedičstvo:</b> ${esc(k.dedicstvo)}</p></div>
      <div class="hrana">▼ Dole: ${efektHtml(k.dole)}</div>
    </figure>`;
  }
  if (k.typ === "Tiket") {
    return `<figure class="mk mk-tiket" aria-label="Náhľad karty ${esc(k.meno)}">
      <p class="mk-stitok">Tiket · lícom dole · 1 cigareta</p>
      <p class="mk-nazov">${esc(k.meno)}</p>
      <p class="mk-efekt">${efektHtml(k.efekt)}</p>
    </figure>`;
  }
  return `<figure class="mk" aria-label="Náhľad karty ${esc(k.meno)}">
    <div class="mk-telo">
      <div class="mk-strana">${k.vL.sloty.map(slotHtml).join("")}</div>
      <div class="mk-stred"><p class="mk-nazov">${esc(k.meno)}</p><p class="mk-efekt">${efektHtml(k.efekt)}</p></div>
      <div class="mk-strana">${k.vP.sloty.map(slotHtml).join("")}</div>
    </div>
    <figcaption>Jedno z ${k.varianty} rozložení</figcaption>
  </figure>`;
}

function zoznamAkcii(s) {
  const p = pocetAkcii(s.akcie);
  const t = Object.entries(p).map(([a, n]) => (n > 1 ? `${a} ×${n}` : a)).join(", ");
  return t || "bez akcií (všetky sloty blokované)";
}

function kartaHtml(k) {
  const tagy = [k.typ, ...k.tagy].join(" · ");
  let cisla = "";
  if (k.typ === "Občan" || k.typ === "Zviera") {
    cisla = `<b>${fmt(k.pl)}</b> = akcie ${fmt(k.plAkcie)} + efekt ${fmt(k.efv)} · ${k.akcie.length} ${k.akcie.length === 1 ? "akcia" : k.akcie.length < 5 ? "akcie" : "akcií"} · ${k.varianty} ${k.varianty < 5 ? "varianty" : "variantov"}${k.typ === "Občan" && k.kat ? " · " + esc(k.kat) : ""}`;
  } else if (k.typ === "Nástroj") {
    cisla = `<b>${fmt(k.efv)}</b> = váha efektu v Dedičstve (dnešné Nástroje 0 – 4,5)`;
  } else {
    cisla = "mimo power levelu (karta bez akcií; výhra 2–3 špaky proti 1 cigarete a riziku Dlhu)";
  }
  const hrany = k.typ === "Občan" || k.typ === "Zviera"
    ? `<dt>Akcie</dt><dd><span class="strany">Ľavá: ${esc(zoznamAkcii(k.vL))} · Pravá: ${esc(zoznamAkcii(k.vP))}.</span> ${esc(k.akc)}</dd>`
    : k.typ === "Nástroj" ? `<dt>Hrany</dt><dd>${esc(k.akc)}</dd>` : "";
  return `<article class="karta" id="k${k.n}" data-typ="${k.typ}" data-hv="${k.hviezda ? 1 : 0}">
  <header class="karta-hlava"><h3><span class="cislo">${k.n}</span>${esc(k.meno)}${k.hviezda ? ' <span class="hv" title="Odporúčam do prvej vlny">★ prvá vlna</span>' : ""}${k.novy ? ` <span class="novy">nový spúšťač</span>` : ""}</h3>
  <p class="tagy">${esc(tagy)}</p></header>
  <div class="dva">
    ${miniKarta(k)}
    <div class="txt">
      <p class="efekt">${k.typ === "Nástroj" ? `<b class="sp">Dedičstvo:</b> ${esc(k.dedicstvo)}<br><span class="hr"><span class="nw">Hore: ${efektHtml(k.hore)}.</span> <span class="nw">Dole: ${efektHtml(k.dole)}.</span></span>` : efektHtml(k.efekt)}</p>
      <p class="sat">${esc(k.sat)}</p>
    </div>
  </div>
  <dl class="fakty">
    <dt>Medzera</dt><dd>${esc(k.med)}</dd>
    <dt>V hre</dt><dd>${esc(k.hra)}</dd>
    ${hrany}
    <dt>Sila</dt><dd>${cisla}</dd>
    ${k.pozn ? `<dt>Poznámka</dt><dd>${esc(k.pozn)}</dd>` : ""}
  </dl>
  <fieldset class="volba" data-kluc="k${k.n}" data-nazov="${k.n} · ${esc(k.meno)}" data-moznosti="ano:Áno|uprav:Áno, s úpravou|neskor:Neskôr|nie:Nie">
    <legend class="skryte-legend">Verdikt: ${esc(k.meno)}</legend>
    <div class="volby"></div>
    <textarea rows="1" aria-label="Poznámka ku karte ${esc(k.meno)}" placeholder="Poznámka ku karte (nepovinné)"></textarea>
  </fieldset>
</article>`;
}

const mapa = [
  ["Karta bez spoja, nečinnosť", ["aktivny_uchadzac"]],
  ["Odpoveď na NA EX", ["vitany_host"]],
  ["Limit vykladania", ["samostatny_mladenec"]],
  ["Poradie v línii, miesto pri lokalite, prevaha", ["predbiehacka", "verny_zakaznik", "somar", "posunuty_plot"]],
  ["Počet Pitiek", ["odchadzajuci_host", "kohut", "tip_od_svagra"]],
  ["Obrana proti NA EX a jeho cena", ["zodpovedna_matka", "opica"]],
  ["Súperova ruka a karty lícom dole", ["suseda_za_zaclonou", "plachy_chlapec", "maskace"]],
  ["Dobratie, veľkosť ruky a balíčka", ["doveryhodny_clovek", "minimalista", "setrny_gazda", "postovy_holub", "budik"]],
  ["Preriedenie balíčka a obeta", ["obetava_matka", "koza", "kukucka", "svina"]],
  ["Súperovo Dedičstvo a podložené Nástroje", ["poctivy_nalezca", "ekolog"]],
  ["Súperove cigarety, fajčenie, výpalné", ["nefajciar", "zberac_spakov", "pozor_zly_pes"]],
  ["Premena akcií (Školitelia)", ["mierotvorca", "hluchy_dedo", "ferovy_hrac"]],
  ["Efekt karty sa nedá vypnúť", ["kliest"]],
  ["Chuť a Absťák", ["pohostinna_gazdina", "pokojna_povaha", "ploskacka"]],
  ["Cirhóza ako zdroj", ["pracneschopny"]],
  ["Dobiehanie", ["stastlivec", "kultivovany_diskuter", "dohodnuty_zapas"]],
  ["Starší: priazeň a zajatie", ["clovek_s_nazorom", "susedska_hliadka"]],
  ["Tagy bez využitia", ["ocity_svedok", "konstruktivny_kritik", "bdela_obcianka", "milovnik_vidieka", "milovnicka_zvierat", "preukaz_dochodcu"]],
  ["Málo druhov Zvierat (5)", ["kohut", "koza", "kukucka", "svina", "somar", "opica", "postovy_holub", "kliest"]],
  ["Ceny v šenku", ["vozik_z_jednoty"]],
  ["Stávka a blaf", ["ista_tutovka", "dohodnuty_zapas", "tip_od_svagra"]],
];
const pouzite = new Set(mapa.flatMap((m) => m[1]));
for (const k of karty) if (!pouzite.has(k.id)) { console.log("CHYBA: karta mimo mapy medzier:", k.id); process.exit(1); }

const kratkyEfekt = (k) => (k.typ === "Nástroj" ? `Dedičstvo: ${k.dedicstvo}` : k.efekt);
const prehlad = karty.map((k) => `<tr data-typ="${k.typ}" data-hv="${k.hviezda ? 1 : 0}"><td class="c">${k.n}</td><td><a href="#k${k.n}">${esc(k.meno)}</a>${k.hviezda ? " ★" : ""}</td><td>${esc(k.typ)}</td><td>${efektHtml(kratkyEfekt(k))}</td><td class="c">${k.pl !== undefined ? fmt(k.pl) : k.typ === "Nástroj" ? fmt(k.efv) : "—"}</td></tr>`).join("\n");

const sekcie = skupiny.map((s) => {
  const moje = karty.filter((k) => k.sk === s.id);
  const rozsah = `${moje[0].n}–${moje[moje.length - 1].n}`;
  const tiket = s.id === "I" ? `<div class="ramik pravidla">
    <h3>Ako by Tiket fungoval</h3>
    <ul>
      <li>Karta s tagom <b>Tiket</b> v balíčku Občania (do šenku chodí ako každá iná, 2 kópie).</li>
      <li>V Zhromaždení ho vyložíš ako ťah <b>lícom dole pred seba za 1 cigaretu</b>. Limit nemíňa.</li>
      <li>Súper vidí, že tiket leží. Nevidí ktorý.</li>
      <li>Otočí sa v bitke po výsledku (krok 4a). Podmienka platí → berieš výhru. Neplatí → <b>získaš 1 Dlh</b>.</li>
      <li>Po bitke ide do tvojho odhadzovacieho balíčka.</li>
    </ul>
    <p><b>Prečo nový typ:</b> stávka sa nedá napísať na Občana (v línii by prezradila podmienku) ani na Nástroj (Dedičstvo je natrvalo). Hazard je dnes len trest; Tiket z neho robí rozhodnutie a dáva cigaretám kam ísť. Výhra je v špakoch, nie v cigaretách, ktorými sa platí.</p>
    <p><b>Súvislosti:</b> nadväzuje na Fígeľ z roadmapy (#75, karta lícom dole) v najjednoduchšej podobe — počas kola nič nespúšťa, vyhodnotí sa raz. Nie je to Flek!, ktorý si zamietol: bitku nezdvojuje, je to bočná stávka s vlastnou cenou.</p>
  </div>` : "";
  return `<section class="sekcia" id="s${s.id}">
  <h2>${s.id} · ${esc(s.nazov)} <small>karty ${rozsah}</small></h2>
  ${s.uvod ? `<p class="uvod">${esc(s.uvod)}</p>` : ""}
  ${tiket}
  ${moje.map(kartaHtml).join("\n")}
</section>`;
}).join("\n");

const reworkHtml = rework.map((r, i) => `<article class="karta rw" id="${r.id}">
  <header class="karta-hlava"><h3><span class="cislo">R${i + 1}</span>${esc(r.meno)}</h3></header>
  <dl class="fakty">
    <dt>Prečo</dt><dd>${textSAkciami(r.preco)}</dd>
    <dt>Návrh</dt><dd>${textSAkciami(r.navrh)}</dd>
  </dl>
  <fieldset class="volba" data-kluc="${r.id}" data-nazov="Rework ${i + 1} · ${esc(r.meno)}" data-moznosti="${esc(r.volby)}">
    <legend class="skryte-legend">Verdikt: ${esc(r.meno)}</legend>
    <div class="volby"></div>
    <textarea rows="1" aria-label="Poznámka: ${esc(r.meno)}" placeholder="Poznámka (nepovinné)"></textarea>
  </fieldset>
</article>`).join("\n");

const otazky = [
  ["q1", "Štyri nové spúšťače", "Odpoveď (karta 2), Odhalenie (12), Spálenie (36), Návrat (39). Každý je na jednej karte a každý treba doprogramovať.", "ano:Áno, všetky|cast:Len niektoré (napíš)|nie:Nie, len dnešné spúšťače"],
  ["q2", "Nový typ Tiket", "Karty 48–50. Bez neho ich nahradím tromi Občanmi.", "ano:Áno, rozpracovať|inak:Inak (napíš)|nie:Nie"],
  ["q3", "Karty, ktoré siahajú na starších", "Dnes na strach, reči, priazeň a zajatie nesiaha žiadna karta. Navrhol som len dve (21 priazeň, 22 zajatie), lebo systém sa ešte ladí.", "viac:Chcem ich viac|dve:Tieto dve stačia|nie:Starších nechať len bitke a hádke"],
  ["q4", "Koľko kariet naraz", `50 kariet × 2 kópie by zdvojnásobilo balíček Občania a rozriedilo tagy. Odporúčam prvú vlnu ${karty.filter((k) => k.hviezda).length} kariet (★) a zvyšok po playteste.`, "vlna:Prvá vlna ★|vsetko:Všetko, čo schválim|inak:Inak (napíš)"],
];
const otazkyHtml = otazky.map(([kluc, nazov, text, volby]) => `<article class="karta ot" id="${kluc}">
  <header class="karta-hlava"><h3>${esc(nazov)}</h3></header>
  <p>${esc(text)}</p>
  <fieldset class="volba" data-kluc="${kluc}" data-nazov="Otázka · ${esc(nazov)}" data-moznosti="${esc(volby)}">
    <legend class="skryte-legend">${esc(nazov)}</legend>
    <div class="volby"></div>
    <textarea rows="1" aria-label="Poznámka: ${esc(nazov)}" placeholder="Poznámka (nepovinné)"></textarea>
  </fieldset>
</article>`).join("\n");

const linia = karty.filter((k) => k.akcie);
const sHazardom = linia.filter((k) => k.akcie.includes("Hazard")).length;
const rozsahO = `${fmt(plO[0])} – ${fmt(plO[plO.length - 1])} (medián ${fmt(plO[Math.floor(plO.length / 2)])})`;
console.log("Hazard na", sHazardom, "z", linia.length, "kariet línie · noví Občania", rozsahO);
const css = fs.readFileSync(path.join(__dirname, "styl.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "skript.js"), "utf8");

const html = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>50 nových kariet — návrh — NA EX!</title>
<style>
${css}
</style>
</head>
<body>
<main>
<div class="hlavicka">
  <h1>50 nových kariet</h1>
  <button type="button" id="tema" aria-label="Prepnúť svetlý a tmavý režim">Svetlo / tma</button>
</div>
<p class="uvod">Návrh pre Michala · 9. 11. 2026 · pravidlá v11.18, sada z <code>master</code> (75d9ba23, 96 kariet). Pri každej karte vyber verdikt a podľa potreby pripíš poznámku. Voľby sa ukladajú v tomto prehliadači; tlačidlo dole skopíruje súhrn pre Leadera. Nič som nesimuloval ani nezapísal do tvorcu.</p>

<section class="ramik">
  <h2>Čo tu je</h2>
  <ul>
    <li><b>32 Občanov, 8 Zvierat, 7 Nástrojov a 3 karty nového typu Tiket.</b> Každá karta rieši jednu medzeru dnešnej hry — <a href="#mapa">mapa medzier</a> je nižšie.</li>
    <li>Meno hovorí opak toho, čo karta je, a mechanika sa dá uhádnuť z mena. Akcie na hranách patria k postave; pri každej je napísané prečo.</li>
    <li><b>Sila</b> je power level podľa predvolených váh akcií (<code>packages/tvorba/src/powerLevel.ts</code>) plus môj odhad váhy efektu. Dnešní Občania majú 1 – 5,5 (medián 3,5), Zvieratá 3,5 – 5,5. Noví Občania ${rozsahO}.</li>
    <li>Na konci je <a href="#rework">6 dnešných kariet na rework</a> a <a href="#otazky">4 otázky</a>.</li>
  </ul>
  <h3>Čoho som sa držal</h3>
  <ul>
    <li>Len 16 dnešných akcií a dnešné tagy. Žiadna nová Autorita, len radoví ľudia.</li>
    <li>Efekty stroho, bez stropov („najviac“, „raz za“), bez mien iných kariet. Občan je Školiteľ, má vedľajšiu akciu, alebo textový efekt.</li>
    <li>Najviac 1 Odpor, rozloženie B+ (Odpor a zlá akcia v slote 1, Posilnenie v slote 2). Občan 4–8 variantov, Zviera 2–4.</li>
    <li>Menej Hazardu: má ho ${sHazardom} zo ${linia.length} kariet do línie (dnes zhruba každá druhá). Viac Vízie, Obmedzenia, Paktu a Posilnenia, ktorých je v sade málo.</li>
    <li>Všetky dvojice preškolení sú nové — v sade ani medzi šiestimi premenami, ktoré čakajú na tvoj verdikt.</li>
  </ul>
</section>

<section class="ramik" id="mapa">
  <h2>Mapa medzier</h2>
  <div class="tab-obal"><table>
    <thead><tr><th>Čo dnes v hre chýba</th><th>Karty</th></tr></thead>
    <tbody>
${mapa.map(([m, ids]) => `<tr><td>${esc(m)}</td><td>${ids.map(odkaz).join(" · ")}</td></tr>`).join("\n")}
    </tbody>
  </table></div>
</section>

<section class="ramik" id="prehlad">
  <h2>Prehľad</h2>
  <div class="filtre" role="group" aria-label="Filter kariet">
    <button type="button" class="filter zap" data-filter="vsetko">Všetko <small>50</small></button>
    <button type="button" class="filter" data-filter="hv">★ Prvá vlna <small>${karty.filter((k) => k.hviezda).length}</small></button>
    <button type="button" class="filter" data-filter="Občan">Občania <small>${poTypoch["Občan"]}</small></button>
    <button type="button" class="filter" data-filter="Zviera">Zvieratá <small>${poTypoch["Zviera"]}</small></button>
    <button type="button" class="filter" data-filter="Nástroj">Nástroje <small>${poTypoch["Nástroj"]}</small></button>
    <button type="button" class="filter" data-filter="Tiket">Tikety <small>${poTypoch["Tiket"]}</small></button>
  </div>
  <div class="tab-obal"><table class="prehlad">
    <thead><tr><th class="c">#</th><th>Karta</th><th>Typ</th><th>Efekt</th><th class="c">Sila</th></tr></thead>
    <tbody>
${prehlad}
    </tbody>
  </table></div>
  <p class="legenda"><span class="akc utok">tuhé</span> <span class="akc makke">mäkké</span> <span class="akc zle">škodí majiteľovi</span> <span class="akc">ostatné</span></p>
</section>

${sekcie}

<section class="sekcia" id="rework">
  <h2>Dnešné karty na rework <small>6</small></h2>
  <p class="uvod">Len to, čo podľa mňa naozaj treba. Dáta z ľudských partií zatiaľ nie sú, preto sú dôvody z pravidiel a z tvojho power levelu, nie zo štatistík.</p>
  ${reworkHtml}
  <p class="pozn">Menšie veci, ktoré rework nepýtajú: Šarlatán a Veštica majú tú istú šablónu (dve Povery za tag) a Šarlatán má akcie za 0,5 — sedelo by mu „Konflikt: Preškolenie ${akcSpan("Viera")}→${akcSpan("Povera")}“. Kočovník má Pecku za tag bez príbehu. Dievčina na vydaj má power level 1 a efekt bez väzby na meno.</p>
</section>

<section class="sekcia" id="otazky">
  <h2>Otázky <small>4</small></h2>
  ${otazkyHtml}
</section>

<section class="ramik">
  <h2>Čo v päťdesiatke nie je</h2>
  <ul>
    <li><b>Odložené karty</b> som nezdvojoval: Večná sťažovateľka, Predajca hrncov, Smetiarka, Brigádnik, Oslávenec, Zverák. Večná sťažovateľka (zmenší súperovu Nakladačku) by dnes proti snehovej guli pomohla najviac — odporúčam ju vrátiť.</li>
    <li><b>Bez tvojho vyjadrenia</b> ostávajú Čašník a Vyhadzovač z 23. 10. a šesť premien súperových akcií z <code>docs/napady/premeny-akcii.html</code> (O13).</li>
    <li><b>Zamietnuté nevraciam:</b> nové Autority, Kšeft, stropy, odstránenie Cirhózy z balíčka, Handrár, Kibic, Flek!, udalosti typu Fašiangy.</li>
    <li><b>Dve karty sú blízko zamietnutého</b> a píšem to pri nich: 1 (karta na pas) a 48–50 (stávka).</li>
  </ul>
</section>

<footer>Návrh z 9. 11. 2026. Dáta kariet pre tvorcu: <code>docs/napady/nove-karty-50.json</code>.</footer>
</main>

<div class="lista" role="region" aria-label="Súhrn volieb">
  <div class="lista-in">
    <span class="lista-text" id="lista-text" aria-live="polite"></span>
    <button type="button" id="kopiruj" class="hlavne">Skopírovať súhrn</button>
  </div>
</div>
<textarea id="schranka" class="skryte" tabindex="-1" aria-hidden="true"></textarea>
<script>
${js}
</script>
</body>
</html>
`;

// ── JSON pre tvorcu ──
const stranaJson = (v) => {
  const actions = {};
  for (const x of v.akcie) actions[KLUC[x] || x] = (actions[KLUC[x] || x] || 0) + 1;
  const von = { blocked: [...v.blokovane].sort(), actions };
  if (Object.keys(v.pevne).length) {
    const allowed = {};
    for (const [i, x] of Object.entries(v.pevne)) allowed[i] = [KLUC[x] || x];
    const volne = [...new Set(v.volneAkcie)].map((x) => KLUC[x] || x);
    if (volne.length) for (const i of v.volne) allowed[i] = volne;
    von.allowed = allowed;
  }
  return von;
};
const json = {
  source: "Návrh 50 nových kariet, 2026-11-09, pravidlá v11.18, nad sadou master 75d9ba23. Neschválené — čaká na Michalove verdikty (docs/napady/nove-karty-50.html).",
  cards: karty.map((k) => {
    const zaklad = { n: k.n, id: k.id, name: k.meno, type: k.typ, tags: [k.typ === "Tiket" ? "Tiket" : k.typ, ...k.tagy], prva_vlna: !!k.hviezda };
    if (k.typ === "Nástroj") return { ...zaklad, effect_text: `Dedičstvo: ${k.dedicstvo} Hore: ${k.hore}. Dole: ${k.dole}.`, vaha_efektu: k.efv, satira: k.sat, medzera: k.med };
    if (k.typ === "Tiket") return { ...zaklad, effect_text: k.efekt, satira: k.sat, medzera: k.med };
    return { ...zaklad, effect_text: k.efekt, kategoria: k.kat, novy_spustac: k.novy || null, left: stranaJson(k.vL), right: stranaJson(k.vP), permutations: k.varianty, power_level: { akcie: k.plAkcie, efekt: k.efv, spolu: k.pl }, satira: k.sat, medzera: k.med };
  }),
  rework: rework.map((r) => ({ karta: r.meno, preco: r.preco, navrh: r.navrh })),
};

fs.mkdirSync(vystup, { recursive: true });
fs.writeFileSync(path.join(vystup, "nove-karty-50.html"), html, "utf8");
fs.writeFileSync(path.join(vystup, "nove-karty-50.json"), JSON.stringify(json, null, 1) + "\n", "utf8");
console.log("OK →", path.join(vystup, "nove-karty-50.html"), Math.round(html.length / 1024) + " kB");
