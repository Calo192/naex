import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Vstupný bod klienta — zatiaľ len kostra, aby sa dalo overiť, že
// reťaz nástrojov beží. Obsah predpisuje docs/BRIEF.md (míľnik M8).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
function App() {
    return (_jsxs("main", { style: { fontFamily: "system-ui", padding: "3rem", lineHeight: 1.6 }, children: [_jsx("h1", { children: "NA EX!" }), _jsx("p", { children: "Kostra projektu. Hra e\u0161te nie je implementovan\u00E1." }), _jsxs("p", { children: ["Zadanie je v ", _jsx("code", { children: "docs/BRIEF.md" }), ", pravidl\u00E1 v", " ", _jsx("code", { children: "docs/PRAVIDLA.md" }), "."] })] }));
}
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
//# sourceMappingURL=main.js.map