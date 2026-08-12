// Herné dáta na strane klienta — ten istý JSON a ten istý loader ako server.
// Klient ich používa len na KRESLENIE (názvy, texty, rozloženia) a na živé
// zvýraznenie cez evaluateLine; pravda o stave hry žije výhradne na serveri.

import cardsJson from "@naex/core/data/cards.json";
import eldersJson from "@naex/core/data/elders.json";
import { loadGameData } from "@naex/core";

export const DATA = loadGameData(cardsJson, eldersJson);
