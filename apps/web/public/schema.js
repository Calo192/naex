// Farebná schéma ešte pred prvým vykreslením, aby web neblikol predvolenými farbami.
// Profil ju ukladá sem aj na server (apps/web/src/lib/schemy.ts); CSP púšťa len skripty
// z vlastnej domény, preto je to samostatný súbor.
try {
  var s = localStorage.getItem("naex-schema");
  if (s && /^[a-z]{2,20}$/.test(s)) document.documentElement.setAttribute("data-schema", s);
} catch (e) {
  // Súkromné okno alebo zakázané úložisko — ostane predvolená schéma.
}
