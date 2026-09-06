import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// The server may send users to /reset?token=... (password reset email). Move
// the query into the hash route so HashRouter can read it.
if (window.location.pathname.startsWith("/reset") && window.location.search) {
  window.location.replace(`/#/reset${window.location.search}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
