// Názov bodovacej karty v tvorcovi určuje priazeň: „Ohováračka“ musí prejsť zverejnením (v11.10).

import { describe, expect, it } from "vitest";
import { priazenZKluca } from "@naex/core";
import { slug } from "../src/zverejnenie.ts";

describe("Karta priazne Ohováračka", () => {
  it("názov s diakritikou sa prevedie na kľúč priazne", () => {
    expect(priazenZKluca(slug("Ohováračka").toUpperCase())).toBe("OHOVARACKA");
  });
});
