import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "./lib/theme";
import { seedIfEmpty } from "./lib/collections";
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
