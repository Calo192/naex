---
name: naex-kontrola-stylu
description: Skontroluje, či všetky používané ilustrácie NA EX! (karty zverejnenej sady, ilustrácie kapitol pravidiel, avatary, Melichar, výučba) sú v jednotnom štýle — nájde obrázky, ktoré zo sady vytŕčajú (iná paleta, kresba, realizmus, svetlo, proporcie, nápisy), a porušenia pevných pravidiel obrazu (dym, ruky, predmety, klony). Spustí agenta naex-ilustrator, ktorý obrázky porovná so štýlom z katalógu tools/admin/styly.json a napíše HTML report s kolážou a odporúčaním (nechať / prerobiť). Nič nemení ani negeneruje. Použi, keď používateľ povie /naex-kontrola-stylu, „skontroluj štýl ilustrácií“, „vytŕča niektorá ilustrácia“, „sú obrázky jednotné“, „kontrola artworkov“.
argument-hint: "[karty | pravidla | avatary | vsetko (predvolené) | id štýlu]"
---

# Kontrola jednotnosti štýlu ilustrácií

Spustíš agenta `naex-ilustrator` v režime **len kontrola**: nič negeneruje,
nič nezapisuje do tvorcu ani na živý web a neminie žiadny kredit Leonarda.
Jeho report odovzdáš Michalovi. Obrázky nečítaj sám. Michal je často na
telefóne, takže mu pošli koláž s nálezmi (SendUserFile).

`$ARGUMENTS` určuje rozsah: `karty`, `pravidla`, `avatary` alebo `vsetko`
(predvolené). Ak je to id štýlu z `tools/admin/styly.json`, kontrolujú sa len
obrázky v tom štýle.

## Postup

1. **Id** = dátum a čas (`20261024-1800`).
2. **Spusti agenta** `naex-ilustrator` (nástroj Agent, na pozadí) s týmto zadaním:

   > Režim KONTROLA ŠTÝLU, id `<id>`, rozsah `<rozsah>`. Nič negeneruj, Leonardo
   > nepoužívaj, do tvorcu ani na živý web nič nezapisuj, kód nemeň.
   >
   > **Zbierka obrázkov** (čo naozaj vidí hráč):
   > - **karty zverejnenej sady** zo živého webu: z verejného `/api/sada`
   >   (cardsJson, obrázok karty) a z `/media/…`. Ak to nejde bez prihlásenia,
   >   použi `packages/server/seed/karty/<id>.jpg` a v reporte to uveď;
   > - **pásy kapitol pravidiel** `apps/web/src/stranky/pravidla-obrazky/`;
   > - **avatary** `packages/server/seed/avatary/` (aj `boti/`);
   > - **Melichar** `apps/web/public/melichar.jpg` a obrázky výučby,
   >   ak nejaké sú.
   >
   > **Jadro štýlu (Michal 2026-10-30):** Michalove vzorové prompty v `tools/admin/styl.md` (sekcia „Jadro štýlu“) a vzory Krčmárka, Veterinár, Kočovník, Finančná poradkyňa — obrázok, ktorý sa od nich líši linkou, zrnom, svetlom alebo farbami, vytŕča.
   > **Merítko:** štýl z katalógu `tools/admin/styly.json` (pre štýl `hra`
   > `tools/admin/styl.md` a vzory z katalógu) a pevné pravidlá obrazu z tvojej
   > definície.
   >
   > **Postup:**
   > 1. Poskladaj koláže po skupinách (karty po 12–16, s menom pod každou),
   >    pozri si ich a podozrivé obrázky aj pri plnej veľkosti.
   > 2. Ku každému obrázku urči odchýlku od štýlu: paleta (tlmené špinavé tóny,
   >    jeden teplý akcent), kontúra a šrafovanie, karikatúra tvárí a realistické
   >    proporcie, svetlo a nálada, kompozícia a výrez, ostrosť a textúra.
   >    Hodnoť na stupnici 0 (sedí) – 3 (vytŕča).
   > 3. Zisti aj porušenia pravidiel: dym nie z cigarety, popolníka ani úst,
   >    zložité alebo chybné ruky, prsty, nesprávne predmety (krígeľ s dvoma
   >    uchami), klony postáv, nápisy a rámiky.
   > 4. Report: `docs/playtesty/kontrola-stylu-<id>.html`, interaktívny.
   >    Na začiatku 3 vety verdiktu, potom tabuľka nálezov zoradená podľa
   >    závažnosti (obrázok, skupina, odchýlka 0–3, čo presne vytŕča, odporúčanie
   >    nechať / doladiť / prerobiť) a koláž vytŕčajúcich obrázkov vedľa 3 vzorov
   >    štýlu. Koláž nálezov ulož aj samostatne ako
   >    `docs/playtesty/kontrola-stylu-<id>/nalezy.jpg`.
   > 5. Necommituj. Výstup najviac 8 riadkov: počet skontrolovaných obrázkov,
   >    počet vytŕčajúcich (2–3) a porušení pravidiel, top 5 s dôvodom, cesty
   >    k reportu a koláži.
3. **Keď skončí:** report a koláž commitni na vetvu
   `kontrola-stylu/<id>` a zlúč do master (len dokumenty). Michalovi pošli
   `nalezy.jpg` a 3–5 viet: čo vytŕča a čo odporúčaš prerobiť.
4. Prerábanie je **samostatná úloha** pre `naex-ilustrator`, až keď ju Michal
   schváli. Priradenie nových obrázkov ku kartám robí `naex-admin` a zverejnenie
   sady len so súhlasom Michala.
