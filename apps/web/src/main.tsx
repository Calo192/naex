// Vstupný bod klienta — zatiaľ len kostra, aby sa dalo overiť, že
// reťaz nástrojov beží. Obsah predpisuje docs/BRIEF.md (míľnik M8).

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", lineHeight: 1.6 }}>
      <h1>NA EX!</h1>
      <p>Kostra projektu. Hra ešte nie je implementovaná.</p>
      <p>
        Zadanie je v <code>docs/BRIEF.md</code>, pravidlá v{" "}
        <code>docs/PRAVIDLA.md</code>.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
