import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";

// Vercel Web Analytics : mesure du trafic SANS cookie ni donnée personnelle
// (RGPD-friendly, pas de bandeau de consentement requis). Ne collecte rien
// tant que « Web Analytics » n'est pas activé dans le tableau de bord Vercel.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);
