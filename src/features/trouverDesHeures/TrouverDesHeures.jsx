// ─────────────────────────────────────────────────────────────────────────────
//  TrouverDesHeures.jsx — Écran « Trouver des heures » (V1, données mockées).
//
//  ISOLATION STRICTE : ce composant n'importe QUE React + le service mock. Il ne
//  lit ni n'écrit AUCUN état du moteur 507h (compteur, projection, activités…).
//  Une offre ne promet JAMAIS d'être comptée automatiquement pour le renouvellement.
//
//  Couleurs = charte H€CTOR, écrites en dur ici pour NE RIEN importer d'autre
//  (INK #0A2540, ACCENT #378ADD, vert #5DCAA5, bleu nuit #07192E).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { fetchIntermittentJobOffers, regionsDisponibles } from "./jobOffers.mock";

const ACCENT = "#378ADD";
const VERT = "#5DCAA5";
const BLEU_CLAIR = "#7FB8F0";
const TEXTE_DOUX = "#8BA5C0";

const ROLE_LABELS = { artiste: "Artiste", technicien: "Technicien", admin: "Admin", autre: "Autre" };
const CONTRAT_LABELS = { cachet: "Cachet", heures: "Heures", CDDU: "CDDU", mission: "Mission" };

const champStyle = {
  background: "#0d2440",
  border: "1px solid #1e3a5f",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  color: "white",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function formatDateFr(iso) {
  try {
    const M = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

export default function TrouverDesHeures() {
  const [roleType, setRoleType] = useState("");
  const [region, setRegion] = useState("");
  const [contractType, setContractType] = useState("");

  const [offres, setOffres] = useState([]);
  const [statut, setStatut] = useState("chargement"); // "chargement" | "ok" | "erreur"

  const charger = useCallback(async () => {
    setStatut("chargement");
    try {
      const data = await fetchIntermittentJobOffers({
        roleType: roleType || undefined,
        region: region || undefined,
        contractType: contractType || undefined,
      });
      setOffres(data);
      setStatut("ok");
    } catch (e) {
      setStatut("erreur");
    }
  }, [roleType, region, contractType]);

  useEffect(() => { charger(); }, [charger]);

  const ouvrirOffre = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const regions = regionsDisponibles();

  return (
    <>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#07192E", border: `1.5px solid rgba(55,138,221,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-briefcase" aria-hidden="true" style={{ color: BLEU_CLAIR, fontSize: 20 }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0 }}>Trouver des heures</h1>
          <p style={{ fontSize: 13.5, color: TEXTE_DOUX, margin: "2px 0 0" }}>Des missions qui peuvent t'aider à te rapprocher des 507h.</p>
        </div>
      </div>

      {/* Mention obligatoire — toujours visible */}
      <div style={{ margin: "16px 0", display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(250,199,117,0.08)", border: "1px solid rgba(250,199,117,0.3)", borderRadius: 10, padding: "11px 14px" }}>
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ color: "#FAC775", fontSize: 15, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: "#E7C98A", lineHeight: 1.5 }}>
          Vérifie toujours que le contrat est bien éligible à ton annexe.
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <select value={roleType} onChange={(e) => setRoleType(e.target.value)} style={{ ...champStyle, flex: "1 1 150px" }} aria-label="Filtrer par métier">
          <option value="">Tous les métiers</option>
          <option value="artiste">Artiste</option>
          <option value="technicien">Technicien</option>
        </select>
        <select value={contractType} onChange={(e) => setContractType(e.target.value)} style={{ ...champStyle, flex: "1 1 150px" }} aria-label="Filtrer par type de contrat">
          <option value="">Tous les contrats</option>
          <option value="cachet">Cachet</option>
          <option value="CDDU">CDDU</option>
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ ...champStyle, flex: "1 1 180px" }} aria-label="Filtrer par région">
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Contenu : chargement / erreur / vide / liste */}
      {statut === "chargement" && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: TEXTE_DOUX, fontSize: 13.5 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🐾</div>
          H€CTOR regarde les offres pour toi…
        </div>
      )}

      {statut === "erreur" && (
        <div style={{ textAlign: "center", padding: "34px 20px", background: "rgba(226,75,74,0.06)", border: "1px solid rgba(226,75,74,0.25)", borderRadius: 14 }}>
          <div style={{ fontSize: 14, color: "#F0997F", fontWeight: 700, marginBottom: 6 }}>Je n'ai pas pu charger les offres.</div>
          <div style={{ fontSize: 12.5, color: TEXTE_DOUX, marginBottom: 14 }}>Ça arrive. On réessaie ?</div>
          <button type="button" onClick={charger} style={{ background: VERT, color: "#04342C", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Réessayer
          </button>
        </div>
      )}

      {statut === "ok" && offres.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🐾</div>
          <div style={{ fontSize: 14, color: "#B5D4F4", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            H€CTOR cherche les offres utiles pour toi. Reviens bientôt.
          </div>
        </div>
      )}

      {statut === "ok" && offres.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {offres.map((o) => (
            <div key={o.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "15px 17px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "white", lineHeight: 1.35 }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: TEXTE_DOUX, marginTop: 3 }}>
                    <i className="ti ti-map-pin" aria-hidden="true" style={{ fontSize: 13, verticalAlign: -1, marginRight: 3 }} />
                    {o.location}{o.region ? ` · ${o.region}` : ""}
                  </div>
                </div>
                <button type="button" onClick={() => ouvrirOffre(o.sourceUrl)} style={{ flexShrink: 0, background: "transparent", border: `1px solid rgba(55,138,221,0.4)`, color: BLEU_CLAIR, borderRadius: 9, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Voir l'offre <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 14 }} />
                </button>
              </div>

              {/* Badges métier / contrat / date */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: VERT, background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 6, padding: "2px 8px" }}>
                  {ROLE_LABELS[o.roleType] || o.roleType}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: BLEU_CLAIR, background: "rgba(55,138,221,0.12)", border: `1px solid rgba(55,138,221,0.3)`, borderRadius: 6, padding: "2px 8px" }}>
                  {CONTRAT_LABELS[o.contractType] || o.contractType}
                </span>
                <span style={{ fontSize: 10.5, color: "#6B8299", marginLeft: "auto" }}>
                  {o.source} · {formatDateFr(o.publishedAt)}
                </span>
              </div>

              {o.description && (
                <div style={{ fontSize: 12.5, color: "#9FB6CE", lineHeight: 1.5, marginTop: 10 }}>{o.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
