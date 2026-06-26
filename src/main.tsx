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

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Hide splash screen after React has committed
const splash = document.getElementById("splash");
if (splash) {
  // Use requestAnimationFrame to ensure the first paint has happened
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add("splash--hidden");
      // Remove from DOM after transition completes
      setTimeout(() => splash.remove(), 600);
    });
  });
}
