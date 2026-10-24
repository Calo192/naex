# Šablóna reportu — playtest výučby „Prvá hra“

Pre agenta `naex-spisovatel` v režime `vyucba` skillu `naex-playtest`. Report je
interaktívne HTML `docs/playtesty/vyucba-<id>.html` (rovnaký vzhľad ako
ostatné reporty playtestov), čitateľ je Michal. Zaujíma ho, **či sa
z výučby nováčik naučí hrať a kde ju treba opraviť**, nie priebeh.

## Podklady (relácia `playtest/vyucba-<id>/`)

- `vyucba.json`: nováčikovia, postavy (`tools/playtest/novacikovia.json`) a rozlíšenia,
- `hrac<n>/feedback.md`: známky V1–V10, test pochopenia, nálezy,
- `hrac<n>/dennik.md`: riadok za každý krok (jasnosť 1–5, čo urobil, poznámka, ZASEKNUTIE),
- `hrac<n>/snimky/*.png`: snímky obrazovky (na nálezy UI vyber 3–8 najlepších,
  skopíruj ich do `docs/playtesty/vyucba-<id>/`),
- `suhrn.json` (`tools/playtest/vyucba.ts <R> suhrn`): po krokoch akcie, chyby servera a čas,
- `hrac<n>/zaznam/akcie.jsonl`: každá akcia s krokom a hláškou servera,
- scenár `packages/core/data/vyucba/prva-hra.json` (id kroku → text Melichara,
  `zvyraznit`) a `docs/PRAVIDLA.md`. **Ty** ich čítať smieš, nováčikovia nie.

## Časti reportu

1. **Verdikt jednou vetou**: dá sa výučba zverejniť? (áno / áno po opravách / nie)
   a tri najdôležitejšie opravy.
2. **Nováčikovia**: postava, rozlíšenie, dokončil (krok X z Y), dĺžka v minútach,
   počet akcií, chyby servera.
3. **Známky V1–V10**: tabuľka (nováčik × kritérium, priemer) s jednou vetou
   zdôvodnenia na bunku po rozkliknutí. Kritériá sú v `.claude/agents/naex-novacik.md`.
4. **Test pochopenia**: tabuľka otázka × nováčik so stavom **správne / čiastočne /
   zle / nevie**. Odpovede over proti `docs/PRAVIDLA.md` a pri každom
   „zle“ citáciou napíš, čo je správne a ktorý krok to mal naučiť. Na konci:
   čo výučba naučila spoľahlivo a čo nenaučila nikoho.
   **Meradlo krátkej výučby** (od 2026-10-24: jedno kolo, zvyšok učia nápovedy
   v prvej partii): „správne“ znamená, že odpoveď pokrýva, čo **výučba naozaj
   učí**: cieľ (body od starších, vydesenie ako okamžitá výhra), poradie kola,
   Zhromaždenie a limit, Pitka a NA EX, bitka a tuhé, poldeci a cigarety.
   Pojmy, ktoré učia až nápovedy (počet Pitiek do hĺbky, Dlh a zadĺženie,
   Absťák, patronát, Pohoršenie, prevaha, Dedičstvo, Záverečná, Exekútor), sa do
   „správne“ nevyžadujú. Ich chýbanie nie je chyba výučby.
5. **Mapa krokov**: riadok = krok scenára (index, id, prvých ~60 znakov
   Melichara), stĺpce = nováčikovia; bunka = jasnosť z denníka (1–5)
   a farba podľa `suhrn.json` (zelená: bez chyby, žltá: chyba alebo viac
   ako 3 akcie, červená: ZASEKNUTIE). Filter „len problémové kroky“.
6. **Zaseknutia**: pre každé krok, čo nováčik chcel, čo sa stalo (hláška
   servera z `akcie.jsonl`), snímka a návrh opravy (text Melichara,
   zvýraznenie, UI). Rozlíš chybu **scenára**, chybu **UI výučby**
   a chybu **hry**.
7. **UI a UX**: bublina, zvýraznenie, čitateľnosť, ovládanie a rozlíšenia
   (najmä 1366×650). Nálezy so snímkou, zoskupené podľa prvku, s tým,
   koľko nováčikov ich hlásilo.
8. **Dĺžka a tempo**: celkový čas, najdlhšie kroky, kde výučba hovorí
   priveľa naraz (dlhé bubliny: počet viet) a kde chýba pauza.
9. **Melichar**: tón, najlepšie a najhoršie hlášky podľa nováčikov.
10. **Čo chýba a čo je navyše**: zlúčené zo všetkých troch.
11. **Návrhy opráv**: zoradené podľa dopadu, každý s krokom scenára (id),
    druhom (scenár / UI / hra), konkrétnym návrhom nového textu alebo
    zmeny a s tým, kto ho urobí (Navrhár scenára, UX/UI, Developer).

## Zhrnutie pre organizátora (najviac 8 riadkov)

Verdikt, priemer V1–V10, skóre testu pochopenia (koľko odpovedí správne
z koľkých), počet zaseknutí, tri najdôležitejšie opravy a cesta k reportu.
