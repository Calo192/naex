// Kombo dielňa — obsah a ovládanie stránky (ukážky komb, pokus K1, mock Štrngu, laboratórium).
(function () {
  "use strict";
  const KB = window.KOMBO;
  if (!KB) {
    document.querySelectorAll("[data-potrebuje-jadro]").forEach((n) => { n.innerHTML = '<p class="chyba">Jadro hry sa nenačítalo (súbory kombo-20261120/jadro.js, data.js, dielna.js musia ležať pri stránke).</p>'; });
    return;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const klon = (x) => JSON.parse(JSON.stringify(x));

  // ---------- K1: Otoč a zdvoj ----------
  (function k1() {
    const stol = $("#k1-stol"), ucet = $("#k1-ucet"), pozn = $("#k1-pozn");
    if (!stol) return;
    const zaklad = () => ({ lok: "krcma", L: [], R: [{ id: "snubenica", l: 0, r: 0 }, { id: "recidivista", l: 0, r: 0 }] });
    const POPIS = {
      "0-nic": ["bez odznaku", "Recidivista je spojený so Snúbenicou: jeho dva Hazardy bežia (2 Dlhy v každej Pitke), Petelica a Rana na voľnej hrane spia."],
      "1-nic": ["↻ ×2", "NA EX = Naopak a Zdvoj. Spojené Hazardy zhasnú, spiaca Petelica a Rana sa zobudia dvakrát: 8 tuhého z jednej karty a žiadny Dlh."],
      "1-energetak": ["↻ ×4", "Energeťák pridá druhé ×2. Dva odznaky Zdvoj sa násobia: Petelica a Rana ×4, 16 tuhého."],
      "0-vidly": ["↻", "Vidly dajú len Naopak (dnes „Vzbura“): Hazardy zhasnú, Petelica a Rana bežia raz."],
      "1-vidly": ["↻ ↻ ×2", "Dva odznaky Naopak sa zrušia, ×2 ostane: karta je späť v pôvodnom stave a jej Hazardy sa rátajú dvakrát. Jadro to takto počíta už dnes; pravidlá len zakazujú dať NA EX na Vzburu (výnimka 3 nižšie)."],
      "0-energetak": ["×2", "Samotné Zdvoj zosilní to, čo práve beží — tu dva Hazardy. Forsáž nie je vždy dar."],
    };
    function prekresli() {
      const naex = $("#k1-naex").checked;
      const nastroj = (document.querySelector('input[name="k1-nastroj"]:checked') || {}).value || "nic";
      const st = zaklad();
      if (naex) st.R[1].naex = 0;
      if (nastroj !== "nic") st.R[1].pod = [{ id: nastroj, h: "horna" }];
      const v = KB.kresli(stol, st, { strng: false });
      ucet.innerHTML = KB.ucet(v, st, { navrhy: false });
      const p = POPIS[(naex ? "1" : "0") + "-" + nastroj];
      pozn.innerHTML = `<b class="k1-vzorec">${p[0]}</b> ${p[1]}`;
    }
    document.querySelectorAll("#k1-ovladanie input").forEach((i) => i.addEventListener("change", prekresli));
    prekresli();
  })();

  // ---------- K2: mock Štrngu ----------
  (function k2() {
    const stol = $("#k2-stol");
    if (!stol) return;
    const kroky = [
      { st: { lok: "lesna_cesta", L: [], R: [{ id: "veteran", l: 1, r: 0 }] }, pol: [1, 1, 0], t: "Vyložíš Veterána k Lesnej ceste. Stojí plný poldeci ako každá karta." },
      { st: { lok: "lesna_cesta", L: [], R: [{ id: "veteran", l: 1, r: 0 }, { id: "milujuca_manzelka", l: 1, r: 1 }] }, pol: [1, 2, 0], t: "Priložíš Milujúcu manželku. Jej tri akcie sadnú presne na tri akcie Veterána: tri páry, Štrng. Poldeci, ktorý si práve otočil, sa dolieva späť." },
    ];
    let i = 0;
    const pohare = $("#k2-pohare"), text = $("#k2-text"), btn = $("#k2-dalej");
    function prekresli(anim) {
      const k = kroky[i];
      KB.kresli(stol, k.st, {});
      stol.classList.toggle("stol--oslava", i === 1 && anim);
      // 1 = plný, 0 = vypitý, 2 = práve doliaty
      pohare.innerHTML = k.pol.map((x) => `<span class="pohar pohar--${x === 0 ? "prazdny" : x === 2 ? "doliaty" : "plny"}" title="${x === 0 ? "vypitý" : "plný"} poldeci"></span>`).join("") + `<small>${k.pol.filter((x) => x > 0).length} z 3 plné</small>`;
      text.textContent = k.t;
      btn.textContent = i === 0 ? "Prilož Milujúcu manželku" : "Odznova";
    }
    btn.addEventListener("click", () => { i = (i + 1) % kroky.length; prekresli(true); });
    prekresli(false);
  })();

  // ---------- nové karty ----------
  (function noveKarty() {
    const el = $("#nove-karty");
    if (!el) return;
    const P = {
      n_druzba: { ilustracia: "Družba s ružou v klope štrngá dvoma poldecákmi naraz, tretí má v náprsnom vrecku.", preco: "Otvárač. Znižuje prah Štrngu na dva páry, a tých je v hre takmer polovica spojov. Jeden Družba = dva takmer isté Štrngy okolo neho.", s: "Harmonikár, Dievčina na vydaj, každá karta s dvoma akciami na indexoch 1 a 2." },
      n_harmonikar: { ilustracia: "Harmonikár hrá so zavretými očami; mech harmoniky je poskladaný z kariet.", preco: "Štrng mu vráti poldeci a navyše kartu: zahraješ ho a nič ťa nestál. Tri akcie na oboch stranách, aby trojitý spoj naozaj trafil.", s: "Družba, Štamperlík, Veštica a Šarlatán (Povery do hádky)." },
      n_kucharka: { ilustracia: "Kuchárka zo školskej jedálne s naberačkou dvíha obrovský hrniec: „Repete!“", preco: "Jediné nové kľúčové slovo. Podpora či Nástup susednej karty sa spustí ešte raz: druhý Nástroj od Živnostníka, druhá karta od Predavačky, druhá karta z odhadzovacieho od Hasiča.", s: "Živnostník, Predavačka, Hasič, Dievčina na vydaj, Degustátorka." },
      n_stahovak: { ilustracia: "Dvaja chlapi nesú skriňu cez plnú krčmu; hostia dvíhajú poldecáky nad hlavu.", preco: "Jediná karta, ktorá smie medzi dve tvoje karty. Jedno vyloženie = dva nové spoje, teda šanca na dva Štrngy naraz a dve Podpory.", s: "Kuchárka, Sypač, Vedúcko (Podpora na obe strany), Štamperlík." },
      n_mamka: { ilustracia: "Mamka v zástere ťahá dospelého syna za ucho von z krčmy.", preco: "Vezmeš si susednú kartu späť do ruky a zahráš ju znova: druhý Nástup, druhá Podpora, lepší spoj. Stojí ťa to poldeci, takže je to voľba, nie dar.", s: "Vandal, Poľovník, Degustátorka, Dohadzovačka (Nástupy), karta uviaznutá v zlom spoji." },
      n_brigadnik: { ilustracia: "Brigádnik v montérkach spí opretý o lopatu, v druhej ruke plechovka.", preco: "Lacná výplň s dvoma frakciami naraz. Parta potrebuje hustotu tagov; on ráta do Pracujúcich aj do Závislých.", s: "Opatrovateľka, Zámočník, Živnostník, Vedúcko; každý Spoločník: Pracujúci a Závislý." },
      n_stamperlik: { ilustracia: "Brúsený štamperlík po starej mame, na dne vyrytý letopočet.", preco: "Trvalý motor do Dedičstva: každý tvoj Štrng dolieva dva poldeci namiesto jedného. Bez stropu, drahý len tým, že Dedičstvo zdražuje obom.", s: "Družba, Harmonikár, Sťahovák; hrana Dole robí z Poldeci dvojitú akciu." },
    };
    el.innerHTML = Object.keys(P).map((id) => KB.velkaKarta(id, P[id])).join("");
  })();

  // ---------- ukážky komb ----------
  const VE = { id: "veteran", l: 1, r: 0 }, MM = { id: "milujuca_manzelka", l: 1, r: 1 }, MI = { id: "ministrant", l: 2, r: 1 }, OP = { id: "opatrovatelka", l: 0, r: 2 }, KO = { id: "kocovnik", l: 0, r: 0 };
  const SILNA = { id: "silna_nezavisla_zena", l: 0, r: 0 };
  const V8 = { id: "veteran", l: 1, r: 0 };
  const KOMBA = {
    veteran: {
      nazov: "Veterán na ex", stitok: "dnešné pravidlá",
      kroky: [
        { t: "Veterán pri Vínnej pivnici. Jeho Pecka a dve Rany sadnú na tri akcie hrany lokality: 4 tuhé.", st: { lok: "vinna_pivnica", L: [V8], R: [] } },
        { t: "Silná, nezávislá žena za ním: aktívne akcie susedného Občana sa rátajú dvakrát. 8 tuhého, ale jej Hazard ti dá Dlh v každej Pitke.", st: { lok: "vinna_pivnica", L: [V8, SILNA], R: [] } },
        { t: "NA EX na Veterána. Jemu aktívne akcie nezruší, ale zdvojí: ×4, 16 tuhého.", st: { lok: "vinna_pivnica", L: [{ ...V8, naex: 0 }, SILNA], R: [] } },
        { t: "Energeťák podložený hranou Forsáž: ×8. Štyri akcie jednej karty dávajú 32 tuhého a 8 cigariet v každej Pitke.", st: { lok: "vinna_pivnica", L: [{ ...V8, naex: 0, pod: [{ id: "energetak", h: "horna" }] }, SILNA], R: [] } },
        { t: "Vidly v Dedičstve (Rana o 1 viac): 48 tuhého. Všetko je to dnes legálne. V 358 bitkách botov sa ×8 neobjavilo ani raz.", st: { lok: "vinna_pivnica", L: [{ ...V8, naex: 0, pod: [{ id: "energetak", h: "horna" }] }, SILNA], R: [], ded: [["vidly"], []] } },
      ],
    },
    strng: {
      nazov: "Päť kariet z troch poldeci", stitok: "návrh K2 · Štrng",
      kroky: [
        { t: "Jedno Zhromaždenie, tri plné poldeci. Veterán k Lesnej ceste. Ostávajú 2.", st: { lok: "lesna_cesta", L: [], R: [VE] } },
        { t: "Milujúca manželka na Veterána: tri páry, Štrng. Poldeci sa vráti, stále 2. Veteránova Pecka a dve Rany sa zobudia (4 tuhé), jej dve Pohoršenia dajú 4 mäkké.", st: { lok: "lesna_cesta", L: [], R: [VE, MM] } },
        { t: "Miňištrant k druhej hrane lokality zobudí jej Pecku: 6 tuhého a druhá Pitka v kole. Ostáva 1.", st: { lok: "lesna_cesta", L: [MI], R: [VE, MM] } },
        { t: "Opatrovateľka na Miňištranta: Viera na Vieru, Viera na Vieru, pečeň na pečeň. Druhý Štrng, poldeci späť, stále 1.", st: { lok: "lesna_cesta", L: [MI, OP], R: [VE, MM] } },
        { t: "Posledný poldeci: Kočovník na Manželku. Jej Odpor mu zhasne Hazard, jeho Odpor jej zhasne pečeň, jeho Spoločník pridá Pecku. Päť kariet z troch poldeci; dnes by boli tri.", st: { lok: "lesna_cesta", L: [MI, OP], R: [VE, MM, KO] } },
      ],
    },
    parta: {
      nazov: "Pamätníci", stitok: "návrh K3 · Parta",
      kroky: [
        { t: "Tri karty s tagom Pamätník v tvojej partii: Stryná, Veterán, Milujúca manželka.", st: { lok: "lesna_cesta", L: [{ id: "niekoho_stryna", l: 0, r: 1 }], R: [VE, MM] } },
        { t: "Veštica (Spoločník: Pamätník, dve Povery). Dnes dá 2 Povery, nech máš Pamätníkov koľkokoľvek. S Partou 2 za každého: 6 Povier.", st: { lok: "lesna_cesta", L: [{ id: "niekoho_stryna", l: 0, r: 1 }, { id: "vestica", l: 2, r: 0 }], R: [VE, MM] } },
        { t: "Kočovník (Spoločník: Pamätník, Pecka): dnes 1 Pecka, s Partou 3. Spolu z dvoch pečatí 3 akcie dnes, 9 s Partou. Horoskop v Dedičstve urobí zo 6 Povier 12 mäkkého.", st: { lok: "lesna_cesta", L: [{ id: "niekoho_stryna", l: 0, r: 1 }, { id: "vestica", l: 2, r: 0 }], R: [VE, MM, KO], ded: [["horoskop"], []] } },
      ],
    },
    svadba: {
      nazov: "Svadba", stitok: "návrh K2 + nové karty",
      kroky: [
        { t: "Harmonikár ku Kultúrnemu domu. Nové karty jadro pozná len ako akcie na hranách; ich efekty počíta stránka.", st: { lok: "kulturny_dom", L: [{ id: "n_harmonikar" }], R: [] } },
        { t: "Družba na Harmonikára: dva páry, a s Družbom to stačí. Štrng: poldeci späť a Harmonikár si doberie kartu.", st: { lok: "kulturny_dom", L: [{ id: "n_harmonikar" }, { id: "n_druzba" }], R: [] } },
        { t: "Dievčina na vydaj na Družbu: zase dva páry, druhý Štrng. Jej Pakt kopíruje Družbovu Cigaretu a Podpora jej dá Poveru navyše.", st: { lok: "kulturny_dom", L: [{ id: "n_harmonikar" }, { id: "n_druzba" }, { id: "dievcina_na_vydaj", l: 0, r: 0, nav: [1] }], R: [] } },
        { t: "Kuchárka na Dievčinu: Podpora Dievčiny sa spustí priložením a Repete ju spustí ešte raz, spolu tri Povery navyše. Štyri karty za dva poldeci, 5 cigariet a 3 doliate poldeci v každej Pitke. Cena: pečeň 4, teda Cirhóza v každej Pitke.", st: { lok: "kulturny_dom", L: [{ id: "n_harmonikar" }, { id: "n_druzba" }, { id: "dievcina_na_vydaj", l: 0, r: 0, nav: [3] }, { id: "n_kucharka" }], R: [] } },
      ],
    },
  };

  window.KOMBO_UKAZKY = KOMBA;

  document.querySelectorAll("[data-kombo]").forEach((box) => {
    const k = KOMBA[box.dataset.kombo];
    if (!k) return;
    let i = k.kroky.length - 1;
    box.innerHTML = `<header class="kombo-hlava"><h3>${k.nazov}</h3><span class="stitok">${k.stitok}</span>
      <div class="kroky" role="group" aria-label="Kroky komba">${k.kroky.map((_, j) => `<button type="button" data-j="${j}">${j + 1}</button>`).join("")}</div>
      <button type="button" class="tl tl--tichy" data-do-lab>Otvoriť v laboratóriu</button></header>
      <p class="kombo-text" aria-live="polite"></p><div class="stol"></div><div class="kombo-ucet"></div>`;
    const stol = $(".stol", box), text = $(".kombo-text", box), uc = $(".kombo-ucet", box);
    function ukaz(j) {
      i = j;
      const kr = k.kroky[i];
      const v = KB.kresli(stol, kr.st, {});
      uc.innerHTML = KB.ucet(v, kr.st, {});
      text.textContent = kr.t;
      box.querySelectorAll(".kroky button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.j) === i)));
    }
    box.querySelectorAll(".kroky button").forEach((b) => b.addEventListener("click", () => ukaz(Number(b.dataset.j))));
    $("[data-do-lab]", box).addEventListener("click", () => { LAB.nacitaj(k.kroky[i].st); document.getElementById("lab").scrollIntoView({ behavior: "smooth", block: "start" }); });
    ukaz(i);
  });

  // ---------- laboratórium ----------
  const LAB = (function () {
    const koren = $("#lab-telo");
    if (!koren) return { nacitaj() {} };
    let stav = klon(KOMBA.strng.kroky[4].st);
    stav.ded = stav.ded || [[], []];
    let vyber = null;
    const D = KB.DATA;
    const zoznam = [...D.cards.values()];
    const jeTyp = (d, t) => d.tags.includes(t);
    const obcania = zoznam.filter((d) => !jeTyp(d, "Lokalita") && !jeTyp(d, "Nástroj") && !jeTyp(d, "Kliatba") && !jeTyp(d, "Starešina") && !KB.NOVE.has(d.id)).sort((a, b) => a.name.localeCompare(b.name, "sk"));
    const starsi = zoznam.filter((d) => jeTyp(d, "Starešina")).sort((a, b) => a.name.localeCompare(b.name, "sk"));
    const lokality = zoznam.filter((d) => jeTyp(d, "Lokalita")).sort((a, b) => a.name.localeCompare(b.name, "sk"));
    const nastroje = zoznam.filter((d) => jeTyp(d, "Nástroj")).sort((a, b) => a.name.localeCompare(b.name, "sk"));
    const navrhy = zoznam.filter((d) => KB.NOVE.has(d.id) && !jeTyp(d, "Nástroj"));
    const opt = (d) => `<option value="${d.id}">${KB.esc(d.name)}</option>`;

    koren.innerHTML = `
      <div class="lab-ovl">
        <fieldset><legend>Lokalita</legend>
          <select id="lab-lok" aria-label="Lokalita">${lokality.map(opt).join("")}</select>
          <label class="zask"><input type="checkbox" id="lab-ot"> otočená o 180°</label>
        </fieldset>
        <fieldset><legend>Pridať kartu</legend>
          <select id="lab-karta" aria-label="Karta"><optgroup label="Občania a Zvieratá">${obcania.map(opt).join("")}</optgroup><optgroup label="Starší (presvedčení)">${starsi.map(opt).join("")}</optgroup><optgroup label="Návrhy z tejto stránky">${navrhy.map(opt).join("")}</optgroup></select>
          <div class="riadok"><label class="zask"><input type="radio" name="lab-by" value="0" id="lab-by0" checked> tvoja</label><label class="zask"><input type="radio" name="lab-by" value="1" id="lab-by1"> súperova</label>
          <label class="zask" title="Vyberie variant karty s najviac pármi na novom spoji"><input type="checkbox" id="lab-fit" checked> najlepší variant</label></div>
          <div class="riadok"><button type="button" class="tl" id="lab-vlavo">← na ľavý koniec</button><button type="button" class="tl" id="lab-vpravo">na pravý koniec →</button></div>
        </fieldset>
        <fieldset id="lab-vybrana"><legend>Vybraná karta</legend><p class="tlmene">Klikni na kartu v línii.</p></fieldset>
        <fieldset><legend>Tvoje Dedičstvo</legend><div class="cipy" id="lab-ded"></div></fieldset>
        <fieldset><legend>Ukážky</legend><div class="riadok">${Object.keys(KOMBA).map((k) => `<button type="button" class="tl tl--tichy" data-ukazka="${k}">${KOMBA[k].nazov}</button>`).join("")}<button type="button" class="tl tl--tichy" id="lab-prazdne">Prázdna línia</button></div></fieldset>
      </div>
      <div class="lab-plocha"><div class="stol" id="lab-stol"></div><div id="lab-ucet"></div>
      <p class="tlmene lab-pozn">Vyhodnotenie línie je <code>evaluateLine</code> z <code>packages/core</code> (v12.7), teda to isté, čo počíta server. Tuhé a mäkké sú odhad len z akcií a Náradia v Dedičstve, bez priazní, kliatob a efektov lokalít mimo hrán. Laboratórium nestráži legálnosť (NA EX na chránenú kartu, dva Nástroje pod kartou).</p></div>`;

    const DED = ["vidly", "boxer", "horoskop", "svaty_text", "energetak", "zapalovac", "vyherne_zreby", "hrable", "zrkadlo", "puska", "pasca", "telefon"].filter((id) => D.cards.has(id));
    function kresliDed() {
      $("#lab-ded").innerHTML = DED.map((id) => `<label class="cip"><input type="checkbox" data-ded="${id}"${stav.ded[0].includes(id) ? " checked" : ""}><span title="${KB.esc(KB.def(id).effectText)}">${KB.esc(KB.def(id).name)}</span></label>`).join("");
      $("#lab-ded").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
        stav.ded[0] = DED.filter((id) => $(`[data-ded="${id}"]`).checked);
        prekresli();
      }));
    }
    function karta(v) { return v ? stav[v.kraj === 0 ? "L" : "R"][v.idx] : null; }
    function kresliVybranu() {
      const box = $("#lab-vybrana"), c = karta(vyber);
      if (!c) { box.innerHTML = '<legend>Vybraná karta</legend><p class="tlmene">Klikni na kartu v línii.</p>'; return; }
      const d = KB.def(c.id), va = D.variants.get(c.id);
      const tvar = (lay) => lay.map((a) => (a ? (a === "Dlh" ? "Haz" : a === "PoškodeniePečene" ? "Peč" : a.slice(0, 3)) : "·")).join(" ");
      box.innerHTML = `<legend>Vybraná: ${KB.esc(d.name)}</legend>
        <div class="riadok"><label>ľavá hrana <select id="lab-vl">${va.left.map((x, i) => `<option value="${i}"${i === (c.l || 0) ? " selected" : ""}>${tvar(x)}</option>`).join("")}</select></label>
        <label>pravá hrana <select id="lab-vr">${va.right.map((x, i) => `<option value="${i}"${i === (c.r || 0) ? " selected" : ""}>${tvar(x)}</option>`).join("")}</select></label></div>
        <div class="riadok"><label class="zask"><input type="checkbox" id="lab-naex"${c.naex !== undefined ? " checked" : ""}> NA EX</label>
        <label class="zask"><input type="checkbox" id="lab-su"${c.by === 1 ? " checked" : ""}> súperova karta</label></div>
        <div class="riadok"><select id="lab-nastroj" aria-label="Nástroj pod kartu"><option value="">Nástroj pod kartu…</option>${nastroje.map(opt).join("")}</select>
        <select id="lab-hrana" aria-label="Hrana Nástroja"><option value="horna">Hore</option><option value="dolna">Dole</option></select><button type="button" class="tl" id="lab-podloz">Podložiť</button></div>
        ${(c.pod || []).length ? `<p class="tlmene">Pod kartou: ${c.pod.map((t) => `${KB.esc(KB.def(t.id).name)} (${t.h === "horna" ? "hore" : "dole"})`).join(", ")} <button type="button" class="tl tl--tichy" id="lab-bez">odobrať</button></p>` : ""}
        <p class="efekt-vybranej">${KB.textEfektu(d.effectText)}</p>
        <button type="button" class="tl tl--zly" id="lab-prec">Odstrániť kartu z línie</button>`;
      $("#lab-vl").addEventListener("change", (e) => { c.l = Number(e.target.value); prekresli(); });
      $("#lab-vr").addEventListener("change", (e) => { c.r = Number(e.target.value); prekresli(); });
      $("#lab-naex").addEventListener("change", (e) => { if (e.target.checked) c.naex = c.by || 0; else delete c.naex; prekresli(); });
      $("#lab-su").addEventListener("change", (e) => { c.by = e.target.checked ? 1 : 0; if (c.naex !== undefined) c.naex = c.by; prekresli(); });
      $("#lab-podloz").addEventListener("click", () => { const id = $("#lab-nastroj").value; if (!id) return; c.pod = [...(c.pod || []), { id, h: $("#lab-hrana").value }]; prekresli(); });
      const bez = $("#lab-bez"); if (bez) bez.addEventListener("click", () => { delete c.pod; prekresli(); });
      $("#lab-prec").addEventListener("click", () => { stav[vyber.kraj === 0 ? "L" : "R"].splice(vyber.idx, 1); vyber = null; prekresli(); });
    }
    function prekresli() {
      const v = KB.kresli($("#lab-stol"), stav, { vyber, onKarta: (kde) => { vyber = vyber && vyber.kraj === kde.kraj && vyber.idx === kde.idx ? null : kde; prekresli(); } });
      $("#lab-ucet").innerHTML = KB.ucet(v, stav, {});
      $("#lab-lok").value = stav.lok;
      $("#lab-ot").checked = !!stav.ot;
      kresliVybranu();
    }
    function pridaj(kraj) {
      const id = $("#lab-karta").value, by = $("#lab-by1").checked ? 1 : 0;
      const zoz = stav[kraj === 0 ? "L" : "R"];
      const va = D.variants.get(id);
      let naj = { l: 0, r: 0 }, najPary = -1;
      if ($("#lab-fit").checked) {
        for (let l = 0; l < va.left.length; l++) for (let r = 0; r < va.right.length; r++) {
          const skus = klon(stav);
          skus[kraj === 0 ? "L" : "R"].push({ id, l, r, by });
          const v = KB.vyhodnot(skus);
          // Nový spoj je prvý (ľavý koniec) alebo posledný (pravý koniec) v poradí zľava doprava.
          const sp = kraj === 0 ? v.spoje[0] : v.spoje[v.spoje.length - 1];
          const n = sp ? sp.pary.length : 0;
          if (n > najPary) { najPary = n; naj = { l, r }; }
        }
      }
      zoz.push({ id, l: naj.l, r: naj.r, by });
      vyber = { kraj, idx: zoz.length - 1 };
      prekresli();
    }
    $("#lab-vlavo").addEventListener("click", () => pridaj(0));
    $("#lab-vpravo").addEventListener("click", () => pridaj(1));
    $("#lab-lok").addEventListener("change", (e) => { stav.lok = e.target.value; prekresli(); });
    $("#lab-ot").addEventListener("change", (e) => { stav.ot = e.target.checked; prekresli(); });
    $("#lab-prazdne").addEventListener("click", () => { stav = { lok: stav.lok, ot: stav.ot, L: [], R: [], ded: [[], []] }; vyber = null; kresliDed(); prekresli(); });
    koren.querySelectorAll("[data-ukazka]").forEach((b) => b.addEventListener("click", () => { const k = KOMBA[b.dataset.ukazka]; nacitaj(k.kroky[k.kroky.length - 1].st); }));
    function nacitaj(st) { stav = klon(st); stav.ded = stav.ded || [[], []]; stav.L = stav.L || []; stav.R = stav.R || []; vyber = null; kresliDed(); prekresli(); }
    kresliDed();
    prekresli();
    return { nacitaj };
  })();
})();
