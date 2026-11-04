// Návrh „Mäkké 3 a 2“ (Michal 2026-11-04): menej Viery, viac Povier a Pohoršenia, najviac 2 identity na kartu.
// Strana "blokované|akcie" (kódy nižšie); karta, ktorá tu nie je, ostáva bez zmeny.
export const KODY = {
  R: 'Rana', P: 'Pecka', T: 'Petelica', Po: 'Povera', Ph: 'Pohoršenie', V: 'Viera',
  Pd: 'Poldeci', C: 'Cigareta', Rb: 'Robota', Vz: 'Vízia', S: 'Posilnenie', Pk: 'Pakt',
  O: 'Odpor', Ob: 'Obmedzenie', L: 'PoškodeniePečene', H: 'Dlh',
};
// Váhy power score: stare = mock Identita kariet (mäkké 2 a 1), nove = mäkké 3 a 2.
const STARE = { Rana: 1, Pecka: 2.2, Petelica: 3.5, Povera: 0.9, Pohoršenie: 2, Viera: 1.1, Poldeci: 1.3, Cigareta: 1, Robota: 1.1,
  Vízia: 1.4, Posilnenie: 1.6, Pakt: 1.2, Odpor: 1.2, Obmedzenie: 0.8, PoškodeniePečene: -1, Dlh: -0.9 };
// Mäkké 2 a 1 bolo v hre „priam až extrémne slabé“ (Michal) — bod mäkkého nestojí toľko ako bod tuhého.
// Nové váhy: Pohoršenie 3 mäkké × 0,8, Povera 2 × 0,7; Viera ruší vzácnejšiu a silnejšiu Poveru.
export const VAHY = { stare: STARE, nove: { ...STARE, Povera: 1.4, Pohoršenie: 2.4, Viera: 1.3 } };
// Sila efektu 0–4 z mocku Identita kariet (design.mjs); chýbajúce = 1.
export const SILA_EFEKTU = {"veterinar":1.5,"autobusar":2.5,"starosta":2,"farar":2.5,"postarka":2,"hrobar":2,"vychovavatelka":2.5,"krcmarka":2,"noviny":0.5,"cigorky":1.2,"vinko":1.5,"pasca":1.5,"puska":1.2,"svaty_text":2,"nealko":1.5,"vyherny_automat":1,"vidly":1.8,"lievik":1.5,"boxer":2,"energetak":1.5,"furik":1.5,"horoskop":2,"hrable":2,"jogurt":1.5,"kristalova_gula":2,"pistalka":1.5,"telefon":1.5,"vyherne_zreby":1.5,"zapalovac":1.5,"zrkadlo":3,"lesna_cesta":1,"ihrisko":1,"zberny_dvor":1,"benzinka":1,"zastavka":1,"krcma":1.5,"kostol":1,"most":1,"obecny_urad":1.2,"jednota":1,"kulturny_dom":1,"vinna_pivnica":1.5,"druzstvo":1,"cintorin":1,"kar":1,"sklad":1,"polovnicka_chata":2.5,"predsedova_vila":1.5,"herna":2,"cierna_macka":1.5,"pes":2,"krokodil":2.5,"kapybara":1.2,"kon":1,"pijan":1.5,"milujuca_manzelka":1,"ministrant":1,"financna_poradkyna":4,"velmi_smutiaca_vdova":2,"vestica":1.5,"silna_nezavisla_zena":4,"policajtka":1.5,"hasic":0.8,"praudovravec":2,"zamocnik":2,"niekoho_stryna":1,"veteran":1.2,"recidivista":2,"liberal":2,"dievcina_na_vydaj":1.5,"zivnostnik":1.5,"kocovnik":1.5,"svokra":1.5,"sarlatan":2.5,"podvodnik":1.2,"zahradkar":1.2,"anonymny_alkoholik":1,"dvojcata":1.5,"sofer":1,"snubenica":1.2,"degustatorka":1.2,"klebetnica":2,"dohadzovacka":1,"vandal":1.2,"stryko_z_ameriky":1.5,"masiar":1,"kulturista":0.8,"traktoristka":1,"vymahac":1.5,"profesionalny_tiper":1.2,"opatrovatelka":0.8,"polovnik":1.5,"predavacka":1.5,"veducko":1.2};
export const ZMENY = {
  // Viera → Pohoršenie a Povery (Viera 29 → 22)
  milujuca_manzelka: { L: "3|Ph Ph H", R: "0|O L", pozn: "Chráni a kazí → robí scény: Viery na dve Pohoršenia, tretia na pečeň (pije s ním). Mäkká + Sabotáž." },
  niekoho_stryna: { R: "2,3|Ph Po", pozn: "Stryná nosí klebety a pohoršuje sa: dve Viery na Pohoršenie a Poveru, Cigareta preč (inak 12 variantov). Mäkká + Ekonomická." },
  kar: { L: "0,3|Ph Po", pozn: "Na kare sa pije a ohovára: Viery na Pohoršenie a Poveru. Mäkká + Ekonomická." },
  klebetnica: { pozn: "Bez zmeny: na hornej hrane pásma (6,4) len vďaka novým váham mäkkého." },
  // Tri identity → dve
  polovnicka_chata: { L: "1|H P T Po", pozn: "Poľovnícka latina: Posilnenie na Poveru — Tuhá + Mäkká namiesto troch identít. Nad pásmom už pred zmenou (8 akcií, efekt)." },
  // Rebalans po mäkkom 3 a 2
  telefon: { R: "2,3|Po H", pozn: "Po mäkkom 3 a 2 nad pásmom (9,1): jedno Pohoršenie na Hazard na podstrčenie." },
  liberal: { R: "1,3|Po H", pozn: "Po mäkkom 3 a 2 nad pásmom (6,8): druhá Cigareta na Hazard — liberál na dlh." },
  nealko: { L: "0,1|Ph Po", pozn: "Po mäkkom 3 a 2 nad pásmom (8,3): jedno Pohoršenie na Poveru." },
  postarka: { L: "0|Vz Ph Po", pozn: "Za Pohoršenie z Nealka: listy aj škandály — jedna Povera na Pohoršenie. Podpora + Mäkká." },
  jednota: { L: "0,2,3|Ph", pozn: "Za Pohoršenie z Telefónu: v Jednote sa ohovára na oboch hranách. Len Mäkká." },
};
