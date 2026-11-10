import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { SadaProvider } from "./lib/sada.tsx";
import { UcetProvider } from "./lib/ucet.tsx";
import { nastavJazyk, pociatocnyJazyk } from "./i18n/jazyk.tsx";
import "./schemy.css";
import "./styles.css";
import "./stranky/stranky.css";
import "./stranky/statistiky.css";

// Slovník jazyka sa načíta pred prvým vykreslením — inak by cudzinec na okamih videl slovenčinu.
void nastavJazyk(pociatocnyJazyk()).finally(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <UcetProvider>
        <SadaProvider>
          <App />
        </SadaProvider>
      </UcetProvider>
    </StrictMode>,
  ),
);
