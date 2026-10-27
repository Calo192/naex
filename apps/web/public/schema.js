// Farebná schéma a pár farieb hráča ešte pred prvým vykreslením, aby web neblikol
// predvolenými farbami. Profil ich ukladá sem aj na server (apps/web/src/lib/schemy.ts,
// lib/paryHraca.ts); CSP púšťa len skripty z vlastnej domény, preto je to samostatný súbor.
var koren = document.documentElement;
koren.setAttribute("data-par", "w20");
try {
  var s = localStorage.getItem("naex-schema");
  if (s && /^[a-z]{2,20}$/.test(s)) koren.setAttribute("data-schema", s);
  var p = localStorage.getItem("naex-par");
  if (p && /^w[0-9]{1,3}$/.test(p)) koren.setAttribute("data-par", p);
  if (localStorage.getItem("naex-prehod") === "1") koren.setAttribute("data-prehod", "");
} catch (e) {
  // Súkromné okno alebo zakázané úložisko — ostane predvolená schéma a pár.
}
