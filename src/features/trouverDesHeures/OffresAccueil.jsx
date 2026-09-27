// ─────────────────────────────────────────────────────────────────────────────
//  OffresAccueil.jsx — Les offres du spectacle, directement sur l'accueil
//  (refonte du 27/09/2026, maquette validée par Camille : « les offres sont
//  affichées directement », rien à chercher derrière un bouton).
//
//  Même source et même isolation que TrouverDesHeures : notre backend
//  (/intermittent/offres), jamais France Travail en direct, et AUCUN lien avec
//  le moteur 507 h. Une offre ne promet JAMAIS d'heures : la maquette montrait
//  « +80 h » par offre, mais les offres de France Travail ne le disent pas, et
//  on n'invente pas un chiffre. Chaque offre montre ce qu'elle dit vraiment :
//  son type de contrat, son intitulé, son lieu.
//
//  Téléphone (« bande ») : une rangée qui défile au doigt. Ordinateur
//  (« liste ») : trois offres en colonne, à la place de la photo de Totor
//  (une bande à faire défiler à la souris n'a pas de sens).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { fetchOffresFranceTravail } from "./francetravail.adapter";

const VERT = "#5DCAA5";
const BRUME = "#B5C8DC";
const CONTRAT_LABELS = { cachet: "Cachet", heures: "Heures", CDDU: "CDDU", mission: "Mission" };

// Une seule requête par session : l'accueil se réaffiche souvent et les offres
// bougent peu dans la journée (le backend garde en plus son propre cache).
let cache = null;

function lieuRetenu() {
  try {
    return { lieu: localStorage.getItem("th_lieu") || undefined, rayon: Number(localStorage.getItem("th_rayon")) || 20 };
  } catch {
    return { lieu: undefined, rayon: 20 };
  }
}

const ouvrirOffre = (url) => {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
};

export default function OffresAccueil({ heuresManquantes, variante = "bande", onToutVoir, repli = null }) {
  const [offres, setOffres] = useState(cache);

  useEffect(() => {
    if (cache) return undefined;
    let annule = false;
    fetchOffresFranceTravail(lieuRetenu())
      .then((data) => { cache = data; if (!annule) setOffres(data); })
      .catch(() => { if (!annule) setOffres([]); });
    return () => { annule = true; };
  }, []);

  // Pas encore chargé, service muet ou aucune offre : on n'affiche pas de cadre
  // vide. La porte « Trouver du travail » reste toujours dans l'onglet Contrats.
  if (!offres || offres.length === 0) return repli;

  const nb = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(heuresManquantes);
  const titre = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: variante === "liste" ? 15.5 : 14.5, fontWeight: 600, color: "#DCE7F2" }}>
      <span>Des offres pour tes {nb} h</span>
      <button type="button" onClick={onToutVoir}
        style={{ background: "none", border: "none", padding: 0, color: VERT, fontWeight: 600, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        Tout voir
      </button>
    </div>
  );
  const typeContrat = (o) => CONTRAT_LABELS[o.contractType] || o.contractType || "Offre";

  if (variante === "liste") {
    return (
      <div>
        {titre}
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {offres.slice(0, 3).map((o) => (
            <button key={o.id} type="button" onClick={() => ouvrirOffre(o.sourceUrl)}
              style={{ display: "grid", gridTemplateColumns: "76px minmax(0, 1fr)", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: "1px solid rgba(93,202,165,0.3)", background: "rgba(11,32,56,0.92)", color: "white", borderRadius: 16, padding: "13px 16px", cursor: "pointer", fontFamily: "inherit" }}>
              <b style={{ fontSize: 15, fontWeight: 800, color: VERT }}>{typeContrat(o)}</b>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</span>
                <span style={{ display: "block", fontSize: 13, color: BRUME, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.location}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      {titre}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "10px -20px 0", padding: "0 20px 4px", scrollPaddingInline: 20, scrollbarWidth: "none", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        {offres.slice(0, 8).map((o) => (
          <button key={o.id} type="button" onClick={() => ouvrirOffre(o.sourceUrl)}
            style={{ flex: "none", width: 158, scrollSnapAlign: "start", textAlign: "left", border: "1px solid rgba(93,202,165,0.3)", background: "rgba(11,32,56,0.92)", color: "white", borderRadius: 16, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 3, cursor: "pointer", fontFamily: "inherit" }}>
            <b style={{ fontSize: 14, fontWeight: 800, color: VERT }}>{typeContrat(o)}</b>
            <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{o.title}</span>
            <span style={{ fontSize: 12.5, color: BRUME, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.location}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
