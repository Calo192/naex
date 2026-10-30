// Tvar ikony priazne (krígeľ piva s penou, Michal 2026-10-30) — bez Reactu, aby z tých istých
// čísel kreslil stôl, pravidlá aj náhľad ikony. Súradnice 0..100 ako piktogramy akcií,
// každá cesta sa vypĺňa evenodd (rebrá skla, otvor ucha).
//
// Pri 12 px nesie tvar ucho s otvorom a hrboľatá pena nad pohárom; medzera medzi penou
// a sklom, stekajúca kvapka a rebrá skla pribudnú od ≈ 20 px.

/** Pena: hrboľatý oblak presahujúci okraj pohára, vpravo stekajúca kvapka. */
const PENA =
  "M15 35C8 33 8 23 15 21C14 12 25 7 32 12C36 4 51 4 54 11C60 6 71 9 69 18C77 20 78 31 71 34" +
  "C66 37 61 35 58 37L58 47C58 51 52 51 52 47L52 38C45 39 39 36 33 38C27 40 20 39 15 35Z";

/** Sklo: horný okraj obchádza penu aj kvapku s medzerou, hrubé dno, tri vyrezané rebrá. */
const SKLO =
  "M20 41C25 43 29 42 33 42C39 41 43 43 48 42L48 46C48 56 62 56 62 46L62 41C64 41 66 40 67 39" +
  "L65 85L69 86L69 93C69 95 68 96 66 96L18 96C16 96 15 95 15 93L15 86L19 85Z" +
  "M27 58C27 56 31 56 31 58L31 77C31 79 27 79 27 77Z" +
  "M39 58C39 56 43 56 43 58L43 77C43 79 39 79 39 77Z" +
  "M51 60C51 58 55 58 55 60L55 77C55 79 51 79 51 77Z";

/** Ucho: hrubý oblúk s otvorom, ktorý ostane otvorený aj pri 12 px. */
const UCHO = "M64 46C81 43 93 50 92 63C91 76 81 82 64 80Z" + "M64 55C76 54 82 57 82 63C82 69 76 72 64 71Z";

export const CESTY_PRIAZNE: readonly string[] = [PENA, SKLO, UCHO];
