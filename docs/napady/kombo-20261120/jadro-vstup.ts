// Vstup pre Kombo dielňu: skutočné vyhodnotenie línie z jadra (packages/core) pre prehliadač.
// Zostavenie: node_modules/.bin/esbuild <tento súbor> --bundle --format=iife --global-name=NAEX --minify
import { loadGameData, printedSides } from "../../../packages/core/src/data.ts";
import { evaluateLine } from "../../../packages/core/src/partia.ts";
import cards from "../../../packages/core/data/cards.json";
import elders from "../../../packages/core/data/elders.json";
import scorecards from "../../../packages/core/data/scorecards.json";
export const raw = { cards, elders, scorecards };
export { loadGameData, evaluateLine, printedSides };
