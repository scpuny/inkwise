import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "./lib/theme/theme";
import { seedIfEmpty } from "./lib/storage/collections";
import "./styles.css";

// Seed demo data on first launch
seedIfEmpty();

// Apply saved appearance before first paint
initTheme();

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

// Hide splash screen after a short delay (runs regardless of render outcome)
const splash = document.getElementById("splash");
if (splash) {
  setTimeout(() => {
    splash.classList.add("splash--hidden");
    setTimeout(() => splash.remove(), 600);
  }, 300);
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
