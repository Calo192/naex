(function () {
  "use strict";
  var KLUC = "naex-nove-karty-50-v1", koren = document.documentElement, stav = {};
  try { var t = localStorage.getItem(KLUC + "-tema"); if (t === "light" || t === "dark") koren.setAttribute("data-theme", t); } catch (e) { /* bez úložiska */ }
  document.getElementById("tema").addEventListener("click", function () {
    var teraz = koren.getAttribute("data-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    var nova = teraz === "light" ? "dark" : "light";
    koren.setAttribute("data-theme", nova);
    try { localStorage.setItem(KLUC + "-tema", nova); } catch (e) { /* bez úložiska */ }
  });
  try { var ul = JSON.parse(localStorage.getItem(KLUC) || "{}"); if (ul && typeof ul === "object") stav = ul; } catch (e) { /* bez úložiska */ }
  function uloz() { try { localStorage.setItem(KLUC, JSON.stringify(stav)); } catch (e) { /* bez úložiska */ } }
  function zaznam(k) { if (!stav[k] || typeof stav[k] !== "object") stav[k] = {}; return stav[k]; }
  var bloky = Array.prototype.slice.call(document.querySelectorAll("[data-kluc]"));
  function moznosti(b) {
    return b.getAttribute("data-moznosti").split("|").map(function (m) { var p = m.indexOf(":"); return [m.slice(0, p), m.slice(p + 1)]; });
  }
  bloky.forEach(function (b) {
    var k = b.getAttribute("data-kluc"), obal = b.querySelector(".volby");
    moznosti(b).forEach(function (m) {
      var l = document.createElement("label"), i = document.createElement("input");
      i.type = "radio"; i.name = "v-" + k; i.value = m[0]; i.checked = (stav[k] && stav[k].v) === m[0];
      i.addEventListener("change", function () { zaznam(k).v = m[0]; uloz(); obnov(); });
      l.appendChild(i); l.appendChild(document.createTextNode(m[1])); obal.appendChild(l);
    });
    var ta = b.querySelector("textarea");
    ta.value = (stav[k] && stav[k].p) || "";
    ta.addEventListener("input", function () { zaznam(k).p = ta.value; uloz(); });
  });
  function obnov() {
    var n = 0, ano = 0;
    bloky.forEach(function (b) {
      var k = b.getAttribute("data-kluc"), v = stav[k] && stav[k].v, karta = b.closest(".karta");
      if (karta) karta.classList.toggle("ma-verdikt", !!v);
      if (v) n++;
      if (/^k\d+$/.test(k) && (v === "ano" || v === "uprav")) ano++;
    });
    document.getElementById("lista-text").textContent = "Rozhodnuté " + n + " z " + bloky.length + " · schválených kariet " + ano + ". Ukladá sa v tomto prehliadači.";
  }
  obnov();

  // Filter prehľadu a kariet podľa typu alebo prvej vlny.
  var filtre = Array.prototype.slice.call(document.querySelectorAll(".filter"));
  function filtruj(f) {
    filtre.forEach(function (x) { var zap = x.getAttribute("data-filter") === f; x.classList.toggle("zap", zap); x.setAttribute("aria-pressed", zap ? "true" : "false"); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-typ]"), function (el) {
      var ukaz = f === "vsetko" || (f === "hv" ? el.getAttribute("data-hv") === "1" : el.getAttribute("data-typ") === f);
      el.hidden = !ukaz;
    });
    // Sekcia bez viditeľnej karty sa skryje celá.
    Array.prototype.forEach.call(document.querySelectorAll(".sekcia"), function (sek) {
      var karty = sek.querySelectorAll("article[data-typ]");
      if (!karty.length) return;
      sek.hidden = !Array.prototype.some.call(karty, function (k) { return !k.hidden; });
    });
  }
  filtre.forEach(function (x) { x.addEventListener("click", function () { filtruj(x.getAttribute("data-filter")); }); });
  // Odkaz na skrytú kartu filter zruší, aby skok fungoval.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#k"]');
    if (!a) return;
    var ciel = document.getElementById(a.getAttribute("href").slice(1));
    if (ciel && ciel.hidden) filtruj("vsetko");
  });

  function suhrn() {
    var r = ["Michal — 50 nových kariet (docs/napady/nove-karty-50.html):", ""];
    bloky.forEach(function (b) {
      var k = b.getAttribute("data-kluc"), s = stav[k] || {}, p = (s.p || "").trim(), txt = "bez voľby";
      moznosti(b).forEach(function (m) { if (m[0] === s.v) txt = m[1]; });
      r.push(b.getAttribute("data-nazov") + ": " + txt + (p ? " — " + p : ""));
    });
    return r.join("\n");
  }
  function kopiruj(text, hlaska) {
    var hotovo = function () { document.getElementById("lista-text").textContent = hlaska; };
    var zaloha = function () {
      var s = document.getElementById("schranka"); s.value = text; s.select();
      try { if (document.execCommand("copy")) { hotovo(); return; } } catch (e) { /* ďalej prompt */ }
      window.prompt("Skopíruj text:", text);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(hotovo, zaloha);
      else zaloha();
    } catch (e) { zaloha(); }
  }
  document.getElementById("kopiruj").addEventListener("click", function () { kopiruj(suhrn(), "Súhrn je skopírovaný. Vlož ho Leaderovi."); });
})();
