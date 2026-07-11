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
import { fetchOffresFranceTravail } from "./francetravail.adapter";

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

// `sansTitre` : posé sur la landing publique, le module laisse la section porter
// son propre titre (un seul h1 par page). Dans l'appli connectée, rien ne change.
export default function TrouverDesHeures({ sansTitre = false } = {}) {
  const [roleType, setRoleType] = useState("");
  const [contractType, setContractType] = useState("");
  const [lieu, setLieu] = useState(() => {
    try { return localStorage.getItem("th_lieu") || ""; } catch { return ""; }
  });
  const [rayon, setRayon] = useState(() => {
    try { return Number(localStorage.getItem("th_rayon")) || 20; } catch { return 20; }
  });
  // Lieu réellement appliqué à la recherche (on ne relance pas à chaque frappe).
  const [lieuApplique, setLieuApplique] = useState(() => {
    try { return localStorage.getItem("th_lieu") || ""; } catch { return ""; }
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);

  const [offres, setOffres] = useState([]);
  const [statut, setStatut] = useState("chargement"); // "chargement" | "ok" | "erreur"
  // Offre dont la description est dépliée (id) — cartes compactes par défaut,
  // sinon la liste devient un puits à scroller. Affichage pur.
  const [offreOuverte, setOffreOuverte] = useState(null);
  // Nombre d'offres affichées : 10 d’abord, « Voir plus » pour la suite (la page
  // reste courte même quand la recherche renvoie 20+ offres). Affichage pur.
  const [nbVisibles, setNbVisibles] = useState(10);
  // Rayon RÉELLEMENT utilisé (le rayon choisi peut être auto-élargi une fois s'il ne donne rien).
  const [rayonEffectif, setRayonEffectif] = useState(() => {
    try { return Number(localStorage.getItem("th_rayon")) || 20; } catch { return 20; }
  });
  // Auto-élargissement pour le message discret : { de, vers } ou null.
  const [autoElargi, setAutoElargi] = useState(null);

  const charger = useCallback(async () => {
    setStatut("chargement");
    setAutoElargi(null);
    const fetchR = (r) => fetchOffresFranceTravail({
      roleType: roleType || undefined,
      contractType: contractType || undefined,
      lieu: lieuApplique || undefined,
      rayon: r,
    });
    try {
      let r = rayon;
      let data = await fetchR(r);
      // Hector essaie tout seul : si vide (ville renseignée), il élargit UNE fois avant de demander.
      if (data.length === 0 && lieuApplique) {
        const rPlus = [10, 20, 50, 100].find((x) => x > r);
        if (rPlus) {
          const data2 = await fetchR(rPlus);
          if (data2.length > 0) setAutoElargi({ de: r, vers: rPlus });
          data = data2;
          r = rPlus;
        }
      }
      setRayonEffectif(r);
      setOffres(data);
      setNbVisibles(10);     // nouvelle recherche → on repart sur une page courte
      setOffreOuverte(null); // et aucune description dépliée
      setStatut("ok");
    } catch (e) {
      setStatut("erreur");
    }
  }, [roleType, contractType, lieuApplique, rayon]);

  useEffect(() => { charger(); }, [charger]);

  // Mémorise le dernier choix de localisation (localStorage suffit en V1).
  useEffect(() => {
    try {
      localStorage.setItem("th_lieu", lieu);
      localStorage.setItem("th_rayon", String(rayon));
    } catch { /* stockage indisponible : on ignore */ }
  }, [lieu, rayon]);

  const appliquerLieu = () => setLieuApplique(lieu.trim());

  // Autocomplétion ville / code postal via geo.api.gouv.fr (public, sans credential).
  useEffect(() => {
    const q = lieu.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    let annule = false;
    const id = setTimeout(async () => {
      try {
        const champs = "nom,code,codeDepartement,codesPostaux";
        const numerique = /^\d{4,5}$/.test(q); // 4-5 chiffres = code postal
        const url = numerique
          ? `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(q)}&fields=${champs}&limit=6`
          : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=${champs}&boost=population&limit=6`;
        const arr = await fetch(url).then((r) => r.json());
        if (!annule) setSuggestions(Array.isArray(arr) ? arr : []);
      } catch {
        if (!annule) setSuggestions([]);
      }
    }, 250);
    return () => { annule = true; clearTimeout(id); };
  }, [lieu]);

  const choisirVille = (s) => {
    setLieu(s.nom);
    setLieuApplique(s.code);   // code INSEE → précis (le backend gère Paris/Lyon/Marseille)
    setSuggestions([]);
    setShowSug(false);
  };

  const ouvrirOffre = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* En-tête (masqué sur la landing publique : la section a déjà son titre) */}
      {!sansTitre && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#07192E", border: `1.5px solid rgba(55,138,221,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="ti ti-briefcase" aria-hidden="true" style={{ color: BLEU_CLAIR, fontSize: 20 }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0 }}>Trouver des cachets & des heures</h1>
            <p style={{ fontSize: 13.5, color: TEXTE_DOUX, margin: "2px 0 0" }}>Des missions qui peuvent t'aider à te rapprocher des 507h.</p>
          </div>
        </div>
      )}

      {/* Mention obligatoire — toujours visible */}
      <div style={{ margin: "16px 0", display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(250,199,117,0.08)", border: "1px solid rgba(250,199,117,0.3)", borderRadius: 10, padding: "11px 14px" }}>
        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ color: "#FAC775", fontSize: 15, flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: "#E7C98A", lineHeight: 1.5 }}>
          Vérifie toujours que le contrat est bien éligible à ton annexe.
        </div>
      </div>

      {/* Où cherches-tu ? */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <input type="text" value={lieu} autoComplete="off"
            onChange={(e) => { setLieu(e.target.value); setShowSug(true); }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            onKeyDown={(e) => { if (e.key === "Enter") { appliquerLieu(); setShowSug(false); } }}
            placeholder="Où cherches-tu ? (ville ou code postal)"
            style={{ ...champStyle, width: "100%" }} aria-label="Où cherches-tu ?" />
          {showSug && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, overflow: "hidden", boxShadow: "0 10px 28px rgba(0,0,0,0.45)" }}>
              {suggestions.map((s) => (
                <button type="button" key={s.code} onMouseDown={(e) => e.preventDefault()} onClick={() => choisirVille(s)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid rgba(255,255,255,0.05)", color: "white", fontSize: 13, padding: "9px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  {s.nom} <span style={{ color: "#6B8299" }}>· {s.codeDepartement || (s.codesPostaux && s.codesPostaux[0]) || ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={rayon} onChange={(e) => setRayon(Number(e.target.value))} style={{ ...champStyle, flex: "0 1 110px" }} aria-label="Rayon">
          <option value={10}>10 km</option>
          <option value={20}>20 km</option>
          <option value={50}>50 km</option>
          <option value={100}>100 km</option>
        </select>
        <button type="button" onClick={appliquerLieu}
          style={{ flex: "0 0 auto", background: VERT, color: "#04342C", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Rechercher
        </button>
      </div>

      {/* Filtres métier / contrat */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <select value={roleType} onChange={(e) => setRoleType(e.target.value)} style={{ ...champStyle, flex: "1 1 150px" }} aria-label="Filtrer par métier">
          <option value="">Tous les métiers</option>
          <option value="artiste">Artiste</option>
          <option value="technicien">Technicien</option>
        </select>
        <select value={contractType} onChange={(e) => setContractType(e.target.value)} style={{ ...champStyle, flex: "1 1 150px" }} aria-label="Filtrer par type de contrat">
          <option value="">Tous les contrats</option>
          <option value="CDDU">CDDU</option>
          <option value="mission">Mission</option>
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

      {statut === "ok" && offres.length === 0 && (() => {
        // Hector a déjà essayé d'élargir tout seul une fois (voir charger). Ici, il ne reste qu'à proposer.
        const nom = lieu.trim();
        const rayonPlus = [10, 20, 50, 100].find((r) => r > rayonEffectif);
        const aElargiSeul = nom && rayonEffectif > rayon;
        const actions = [];
        if (nom && rayonPlus) actions.push({ k: "rayon", label: `Élargir à ${rayonPlus} km`, on: () => setRayon(rayonPlus) });
        if (roleType) actions.push({ k: "role", label: "Retirer le filtre métier", on: () => setRoleType("") });
        if (contractType) actions.push({ k: "contrat", label: "Retirer le filtre contrat", on: () => setContractType("") });
        return (
          <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🐾</div>
            <div style={{ fontSize: 14, color: "#B5D4F4", lineHeight: 1.6, maxWidth: 400, margin: actions.length > 0 ? "0 auto 16px" : "0 auto 2px" }}>
              {!nom
                ? "Rien pour l'instant."
                : aElargiSeul
                  ? `Rien autour de « ${nom} », même en élargissant à ${rayonEffectif} km.`
                  : `Rien autour de « ${nom} » pour l'instant.`}
            </div>
            {actions.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {actions.map((a) => (
                  <button key={a.k} type="button" onClick={a.on}
                    style={{ background: "rgba(93,202,165,0.12)", border: `1px solid rgba(93,202,165,0.4)`, color: VERT, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {a.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: TEXTE_DOUX, marginTop: 2 }}>Je continue de chercher — reviens un peu plus tard. 🐾</div>
            )}
          </div>
        );
      })()}

      {statut === "ok" && offres.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {autoElargi && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(93,202,165,0.07)", border: `1px solid rgba(93,202,165,0.25)`, borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "#C2E6D8", lineHeight: 1.5 }}>
              <span aria-hidden="true" style={{ flexShrink: 0 }}>🐾</span>
              Je n'ai rien trouvé à moins de {autoElargi.de} km. J'ai regardé jusqu'à {autoElargi.vers} km pour toi.
            </div>
          )}
          {offres.slice(0, nbVisibles).map((o) => (
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
                  Source : {o.source}{o.publishedAt ? ` · ${formatDateFr(o.publishedAt)}` : ""}
                </span>
              </div>

              {/* Description repliée par défaut : cartes compactes, on déplie ce qui intéresse. */}
              {o.description && (offreOuverte === o.id ? (
                <>
                  <div style={{ fontSize: 12.5, color: "#9FB6CE", lineHeight: 1.5, marginTop: 10 }}>{o.description}</div>
                  <button type="button" onClick={() => setOffreOuverte(null)}
                    style={{ background: "none", border: "none", color: "#6B8299", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Réduire <i className="ti ti-chevron-up" aria-hidden="true" style={{ fontSize: 13 }} />
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setOffreOuverte(o.id)}
                  style={{ background: "none", border: "none", color: BLEU_CLAIR, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 9, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Voir le détail <i className="ti ti-chevron-down" aria-hidden="true" style={{ fontSize: 13 }} />
                </button>
              ))}
            </div>
          ))}
          {offres.length > nbVisibles && (
            <button type="button" onClick={() => setNbVisibles((n) => n + 10)}
              style={{ width: "100%", background: "rgba(93,202,165,0.10)", border: `1px solid rgba(93,202,165,0.35)`, color: VERT, borderRadius: 12, padding: "13px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <i className="ti ti-chevron-down" aria-hidden="true" style={{ fontSize: 16 }} />
              Voir plus d'offres ({offres.length - nbVisibles} restante{offres.length - nbVisibles > 1 ? "s" : ""})
            </button>
          )}
        </div>
      )}
    </>
  );
}
