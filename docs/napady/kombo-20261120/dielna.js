// Kombo dielňa — logika stránky docs/napady/kombo-20261120.html.
// Línie vyhodnocuje skutočné jadro hry (jadro.js = packages/core, evaluateLine); stránka k nemu
// pridáva len kreslenie a „prekryvy“ navrhovaných pravidiel (Štrng, Parta), ktoré jadro nepozná.
(function () {
  "use strict";
  const K = window.KOMBO_DATA;
  const N = window.NAEX;
  if (!K || !N) return;

  // ---------- dáta: zverejnená sada + navrhované karty ----------
  const strana = (arr) => {
    const blocked = [];
    const actions = {};
    const allowed = {};
    arr.forEach((a, i) => {
      if (a === null) blocked.push(i);
      else {
        actions[a] = (actions[a] || 0) + 1;
        allowed[String(i)] = [a];
      }
    });
    return { blocked, actions, allowed };
  };
  const NOVE = new Map(K.nove.map((n) => [n.id, n]));
  const noveDef = K.nove.map((n, i) => ({
    id: n.id, index: 200 + i, name: n.name, tags: n.tags, effect_text: n.effect_text, triggers: [],
    left: strana(n.L), right: strana(n.R), permutations: { total: 1, left: 1, right: 1 },
  }));
  const DATA = N.loadGameData({ ...N.raw.cards, cards: [...N.raw.cards.cards, ...noveDef] }, N.raw.elders, N.raw.scorecards);
  const def = (id) => DATA.cards.get(id);
  const maTag = (id, t) => def(id).tags.includes(t);

  // Farba pásu s názvom: pastel podľa odtieňa ako v tvorcovi (packages/tvorba/src/farby.ts); odtiene sú odhad.
  const ODTIEN = { "Závislý": 292, "Pamätník": 182, "Kriminál": 4, "Autorita": 222, "Influencer": 332, "Zahraničný": 48, "Pracujúci": 26, "Zviera": 262, "Nástroj": 150, "Lokalita": 118, "Starešina": 44 };
  function pastel(h) {
    const c = 0.72 * 0.42, hh = (((h % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hh % 2) - 1)), m = 0.72 - c;
    const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
  }
  const farbaPasu = (id) => {
    const t = def(id).tags.find((x) => ODTIEN[x] !== undefined);
    return t === undefined ? "#6b7280" : pastel(ODTIEN[t]);
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NAZOV_AKCIE = { Dlh: "Hazard", "PoškodeniePečene": "Pečeň" };
  const nazovAkcie = (a) => NAZOV_AKCIE[a] || a;
  function ikona(a) {
    const cesty = K.ikony[a];
    if (!cesty) return "";
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${cesty.map((c) => `<path d="${c.d}"${c.e ? ' fill-rule="evenodd"' : ""}/>`).join("")}</svg>`;
  }
  // Text efektu: {Akcia} → piktogram.
  const textEfektu = (t) => esc(t).replace(/\{([^}]+)\}/g, (_, a) => {
    const kluc = a === "Hazard" ? "Dlh" : a === "Pečeň" ? "PoškodeniePečene" : a;
    return K.ikony[kluc] ? `<span class="pik" title="${esc(a)}">${ikona(kluc)}</span>` : esc(a);
  });
  function obrazok(id) {
    const i = K.sprite.ids.indexOf(id);
    if (i === -1) return "";
    const c = K.sprite.cols, r = K.sprite.rows;
    return `background-image:url(kombo-20261120/karty.jpg);background-size:${c * 100}% ${r * 100}%;background-position:${((i % c) / (c - 1)) * 100}% ${(Math.floor(i / c) / (r - 1)) * 100}%`;
  }

  // ---------- stav → línia jadra ----------
  function postav(stav) {
    let uid = 1;
    const mk = (c) => ({ uid: uid++, defId: c.id, leftLayout: c.l || 0, rightLayout: c.r || 0 });
    const pl = (c) => {
      const o = { card: mk(c), playedBy: c.by || 0 };
      if (c.naex !== undefined && c.naex !== null) o.naexBy = c.naex;
      // Koľkokrát sa spustila Podpora či Konflikt karty (jadro si to pamätá z vykladania; tu to zadáva ukážka).
      if (c.nav) o.navyse = c.nav;
      if (c.pod && c.pod.length) o.podlozene = c.pod.map((t) => ({ card: mk({ id: t.id }), majitel: c.by || 0, hrana: t.h }));
      return o;
    };
    const strany = [(stav.L || []).map(pl), (stav.R || []).map(pl)];
    const ded = stav.ded || [[], []];
    const vsetky = [...strany[0], ...strany[1]];
    return {
      lokalita: stav.lok ? mk({ id: stav.lok }) : null,
      lokalitaOtocena: !!stav.ot,
      strany,
      nastroje: ded,
      kolo: {
        naexVKole: [0, 1].map((p) => vsetky.some((x) => x.naexBy === p)),
        dlhy: [0, 0], prilozeniaKu: [0, 0],
        dedicstvo: ded.map((a) => a.map((id) => mk({ id }))),
        poslednaPitka: true,
      },
    };
  }

  const rev = (a) => [...a].reverse();
  /** Prvky línie zľava doprava v ráme stola (karta súpera je otočená o 180°). */
  function prvky(line, ev) {
    const els = [];
    const pridaj = (pl, kraj, idx) => {
      const ce = ev.cards.get(pl.card.uid);
      const o = pl.playedBy === 1;
      els.push({ pl, kraj, idx, ce, id: pl.card.defId, by: pl.playedBy, L: o ? rev(ce.right) : ce.left, R: o ? rev(ce.left) : ce.right, lok: false });
    };
    line.strany[0].map((pl, i) => [pl, i]).reverse().forEach(([pl, i]) => pridaj(pl, 0, i));
    if (line.lokalita) {
      const ce = ev.cards.get(line.lokalita.uid);
      const o = line.lokalitaOtocena;
      els.push({ lok: true, id: line.lokalita.defId, ce, L: o ? rev(ce.right) : ce.left, R: o ? rev(ce.left) : ce.right });
    }
    line.strany[1].forEach((pl, i) => pridaj(pl, 1, i));
    return els;
  }

  /** Vyhodnotenie stavu: jadro + prekryvy návrhov (Štrng, Parta). */
  function vyhodnot(stav) {
    const line = postav(stav);
    const ev = N.evaluateLine(DATA, line);
    const els = prvky(line, ev);
    const spoje = [];
    const strngy = [0, 0];
    for (let k = 0; k + 1 < els.length; k++) {
      const a = els[k], b = els[k + 1];
      const pary = [0, 1, 2, 3].filter((i) => a.R[i] && b.L[i]);
      const karty = !a.lok && !b.lok;
      const druzba = karty && (a.id === "n_druzba" || b.id === "n_druzba");
      const strng = karty && (pary.length >= 3 || (druzba && pary.length >= 2));
      // Štrng patrí tomu, kto kartu priložil — vonkajšej karte spoja.
      const vonkajsia = karty ? (a.kraj === 0 ? a : b) : null;
      if (strng) strngy[vonkajsia.by] += 1;
      spoje.push({ k, pary, strng });
    }
    // Parta: Spoločník ráta každú inú tvoju kartu s tagom (dnes raz).
    const parta = [{ dnes: 0, navrh: 0 }, { dnes: 0, navrh: 0 }];
    const karty = els.filter((e) => !e.lok);
    for (const e of karty) {
      for (const n of e.ce.navyse || []) {
        if (n.spustac !== "Spoločník" || !n.tag) continue;
        const ine = karty.filter((x) => x !== e && x.by === e.by && maTag(x.id, n.tag)).length;
        parta[e.by].dnes += n.krat * n.akcie.length;
        parta[e.by].navrh += ine * n.akcie.length;
      }
    }
    return { line, ev, els, spoje, strngy, parta };
  }

  /** Odhad bitky a Pitky len z akcií v línii a Náradia v Dedičstve (bez priazní, kliatob a starších). */
  function odhad(v, stav) {
    const ded = stav.ded || [[], []];
    const ma = (p, id) => ded[p].includes(id);
    const s = (p, a) => v.ev.sums[p][a] || 0;
    const out = [];
    for (const p of [0, 1]) {
      const o = 1 - p;
      const povery = s(p, "Povera"), viera = s(p, "Viera");
      const zvysnePovery = ma(p, "cierna_macka") ? povery : Math.max(0, povery - s(o, "Viera"));
      const zvysnaVieraSupera = Math.max(0, s(o, "Viera") - s(p, "Povera"));
      const hrube = s(p, "Rana") * (ma(p, "vidly") ? 2 : 1) + s(p, "Pecka") * (ma(p, "boxer") ? 3 : 2) + s(p, "Petelica") * 3;
      out.push({
        tuhe: Math.max(0, hrube - zvysnaVieraSupera * (ma(o, "svaty_text") ? 2 : 1)),
        hrube,
        makke: s(p, "Pohoršenie") * 2 + zvysnePovery * (ma(p, "horoskop") ? 2 : 1),
        viera,
        cigarety: Math.max(0, s(p, "Cigareta") - s(o, "Obmedzenie")),
        poldeci: s(p, "Poldeci"),
        dlh: s(p, "Dlh"),
        pecen: s(p, "PoškodeniePečene") + s(p, "Poldeci"),
        vizia: s(p, "Vízia"),
        robota: s(p, "Robota"),
      });
    }
    let max = 0, akt = 0, neakt = 0;
    for (const e of v.els) {
      if (e.lok) continue;
      for (const sl of [...e.L, ...e.R]) {
        if (!sl || sl.action === "Posilnenie" || sl.action === "Odpor" || sl.action === "Pakt") continue;
        if (sl.stav === "aktivna" && sl.nasobok > 0) { akt++; max = Math.max(max, sl.nasobok); } else neakt++;
      }
      for (const n of e.ce.navyse || []) (n.nasobok || []).forEach((x) => { if (n.krat > 0) max = Math.max(max, x); });
    }
    return { hraci: out, max, akt, neakt, pitiek: 1 + Math.min(v.ev.aktivneStredu[0], v.ev.aktivneStredu[1]) };
  }

  // ---------- kreslenie ----------
  function slotHtml(sl, strana, i, by) {
    if (!sl) return `<span class="sl sl--prazdny" style="--i:${i}"></span>`;
    const a = sl.ako || sl.action;
    const on = sl.stav === "aktivna" && sl.nasobok > 0;
    const trieda = on ? "sl--on" : sl.stav === "zrusena" ? "sl--zr" : "sl--off";
    const krat = on && sl.nasobok > 1 ? `<b class="krat krat--${Math.min(8, sl.nasobok)}">×${sl.nasobok}</b>` : "";
    const zmena = sl.povodna ? `<i class="zmena" title="preškolené z ${esc(nazovAkcie(sl.povodna))}"></i>` : "";
    const popis = `${nazovAkcie(a)} — ${on ? "aktívna" + (sl.nasobok > 1 ? " ×" + sl.nasobok : "") : sl.stav === "zrusena" ? "zrušená" : "neaktívna"}`;
    return `<span class="sl ${trieda} sl--${strana}${by === undefined ? " sl--lok" : by === 0 ? " sl--ja" : " sl--su"}" style="--i:${i}" title="${esc(popis)}">${ikona(a)}${krat}${zmena}</span>`;
  }

  /** Odznaky karty: ↻ naopak (Vzbura / NA EX), ×N (spoločný násobok aktívnych akcií), NA EX. */
  function odznaky(e) {
    const ce = e.ce, pl = e.pl;
    const maNaex = pl.naexBy !== undefined && ce.naexStit !== "Odpor";
    const veteran = e.id === "veteran";
    const naopak = (ce.vzbura ? 1 : 0) + (maNaex && !veteran ? 1 : 0);
    const on = [...e.L, ...e.R].filter((s) => s && s.stav === "aktivna" && s.nasobok > 0 && !["Posilnenie", "Odpor", "Pakt"].includes(s.action));
    const spolocny = on.length ? Math.min(...on.map((s) => s.nasobok)) : 1;
    const out = [];
    if (naopak % 2 === 1) out.push(`<span class="odz odz--naopak" title="Naopak: nespojené akcie sú aktívne, spojené nie">↻</span>`);
    if (spolocny > 1) out.push(`<span class="odz odz--krat" title="Všetky aktívne akcie karty sa rátajú ${spolocny}×">×${spolocny}</span>`);
    return out.join("");
  }

  function chvost(id, navyse) {
    const d = def(id);
    const tagy = d.tags.filter((t) => t !== "Občan").join(" · ");
    const pec = (navyse || []).filter((n) => n.krat > 0 && n.akcie.length).map((n) => `<span class="pec" title="akcie navyše: ${esc(n.spustac)}">${n.akcie.map((a, j) => ikona((n.ako && n.ako[j]) || a)).join("")}${n.krat * ((n.nasobok && n.nasobok[0]) || 1) > 1 ? `<b>×${n.krat * ((n.nasobok && n.nasobok[0]) || 1)}</b>` : ""}</span>`).join("");
    return { meno: `<div class="k-meno"><strong>${esc(d.name)}</strong><small>${esc(tagy)}</small>${pec}</div>`, text: `<div class="k-text" title="${esc(d.effectText)}"><span>${textEfektu(d.effectText)}</span></div>` };
  }

  function kartaHtml(e, vybrana) {
    const novy = NOVE.has(e.id);
    const ch = chvost(e.id, e.ce.navyse);
    const sloty = e.L.map((s, i) => slotHtml(s, "L", i, e.lok ? undefined : e.by)).join("") + e.R.map((s, i) => slotHtml(s, "R", i, e.lok ? undefined : e.by)).join("");
    const art = `<div class="k-art${novy ? " k-art--navrh" : ""}" style="${obrazok(e.id)}">${novy ? '<span class="navrh-stitok">návrh</span>' : ""}${sloty}${e.lok ? "" : `<div class="odznaky">${odznaky(e)}</div>`}${e.pl && e.pl.naexBy !== undefined ? '<span class="naex-peciatka" title="Na karte leží poldeci: NA EX">NA EX</span>' : ""}${e.pl && e.pl.podlozene && e.pl.podlozene.length ? `<div class="pody">${e.pl.podlozene.map((t) => `<span class="pod" title="${esc(def(t.card.defId).effectText)}">${t.hrana === "horna" ? "▲" : "▼"} ${esc(def(t.card.defId).name)}</span>`).join("")}</div>` : ""}</div>`;
    const hore = e.lok || e.by === 1 ? "" : ch.text + ch.meno;
    const dole = e.lok || e.by === 1 ? ch.meno + ch.text : "";
    const trieda = e.lok ? "k k--lok" : `k k--${e.by === 0 ? "ja" : "su"}${vybrana ? " k--vybrana" : ""}`;
    const data = e.lok ? "" : ` data-kraj="${e.kraj}" data-idx="${e.idx}" tabindex="0" role="button" aria-label="${esc(def(e.id).name)}"`;
    return `<div class="${trieda}" style="--pas:${farbaPasu(e.id)}"${data}><div class="k-hore">${hore}</div>${art}<div class="k-dole">${dole}</div></div>`;
  }

  /** Nakreslí líniu do prvku; vráti vyhodnotenie. opts: {strng, vyber:{kraj,idx}, onKarta} */
  function kresli(el, stav, opts) {
    opts = opts || {};
    const v = vyhodnot(stav);
    const casti = [];
    v.els.forEach((e, k) => {
      const vybrana = !e.lok && opts.vyber && opts.vyber.kraj === e.kraj && opts.vyber.idx === e.idx;
      let html = kartaHtml(e, vybrana);
      const spoj = v.spoje[k - 1];
      if (spoj) {
        const mosty = spoj.pary.map((i) => `<i class="most" style="--i:${i}"></i>`).join("");
        const st = spoj.strng && opts.strng !== false ? `<span class="strng" title="Štrng (návrh): ${spoj.pary.length} páry na spoji">ŠTRNG!</span>` : "";
        html = `<div class="sev">${mosty}${st}</div>` + html;
      }
      casti.push(html);
    });
    el.innerHTML = `<div class="linia">${casti.join("")}</div>`;
    if (opts.onKarta) {
      el.querySelectorAll(".k[data-kraj]").forEach((n) => {
        const klik = () => opts.onKarta({ kraj: Number(n.dataset.kraj), idx: Number(n.dataset.idx) });
        n.addEventListener("click", klik);
        n.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); klik(); } });
      });
    }
    return v;
  }

  function ucet(v, stav, opts) {
    opts = opts || {};
    const o = odhad(v, stav);
    const r = (p) => {
      const h = o.hraci[p];
      const polozky = [
        ["tuhé", h.tuhe, "u-tuhe"], ["mäkké", h.makke, "u-makke"], ["cigarety / Pitka", h.cigarety, ""], ["doliate poldeci", h.poldeci, ""],
        ["Dlhy / Pitka", h.dlh, h.dlh ? "u-zle" : ""], ["pečeň / Pitka", h.pecen, h.pecen >= 3 ? "u-zle" : ""],
      ];
      if (h.vizia) polozky.push(["Vízie", h.vizia, ""]);
      if (h.robota) polozky.push(["Robota", h.robota, ""]);
      return `<div class="ucet-hrac ucet-hrac--${p === 0 ? "ja" : "su"}"><h4>${p === 0 ? "Ty" : "Súper"}</h4><dl>${polozky.map(([n, x, t]) => `<div class="${t}"><dt>${n}</dt><dd>${x}</dd></div>`).join("")}</dl></div>`;
    };
    const navrhy = opts.navrhy === false ? "" : `<div class="ucet-navrh"><h4>Navrhované pravidlá <small>jadro ich nepozná, počíta stránka</small></h4><dl>
      <div><dt>Štrng (trojitý spoj) — poldeci späť</dt><dd>ty ${v.strngy[0]} · súper ${v.strngy[1]}</dd></div>
      <div><dt>Parta — akcie navyše zo Spoločníka</dt><dd>ty ${v.parta[0].dnes} → ${v.parta[0].navrh} · súper ${v.parta[1].dnes} → ${v.parta[1].navrh}</dd></div></dl></div>`;
    return `<div class="ucet">${r(0)}${r(1)}<div class="ucet-stred"><h4>Línia</h4><dl>
      <div><dt>najväčší násobok</dt><dd class="${o.max >= 4 ? "u-zlato" : ""}">×${o.max || 1}</dd></div>
      <div><dt>akcie aktívne / spia</dt><dd>${o.akt} / ${o.neakt}</dd></div>
      <div><dt>Pitiek v kole</dt><dd>${o.pitiek}</dd></div></dl></div>${navrhy}</div>`;
  }

  // ---------- veľká karta (návrhy nových kariet) ----------
  function velkaKarta(id, popis) {
    const d = def(id), n = NOVE.get(id);
    const sl = (arr, s) => arr.map((a, i) => (a ? `<span class="sl sl--on sl--${s} sl--ja" style="--i:${i}" title="${esc(nazovAkcie(a))}">${ikona(a)}</span>` : `<span class="sl sl--prazdny" style="--i:${i}"></span>`)).join("");
    const nastroj = d.tags.includes("Nástroj");
    return `<figure class="vk" style="--pas:${farbaPasu(id)}">
      <div class="vk-karta"><div class="k-text"><span>${textEfektu(d.effectText)}</span></div><div class="k-meno"><strong>${esc(d.name)}</strong><small>${esc(d.tags.filter((t) => t !== "Občan").join(" · "))}</small></div>
      <div class="k-art k-art--navrh"><span class="brief">${esc(popis.ilustracia)}</span>${nastroj ? "" : sl(n.L, "L") + sl(n.R, "R")}</div></div>
      <figcaption><p>${popis.preco}</p><p class="kombuje"><b>Kombuje s:</b> ${popis.s}</p></figcaption></figure>`;
  }

  window.KOMBO = { DATA, def, kresli, ucet, vyhodnot, odhad, velkaKarta, ikona, NOVE, textEfektu, esc, maTag };
})();
