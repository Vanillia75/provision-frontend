// ─────────────────────────────────────────────────────────────────────────────
//  « Pourquoi H€CTOR ? » — la lettre du fondateur. Page hommage cachée,
//  accessible depuis le profil (AE) et les réglages (intermittent).
//  Vouvoiement volontaire (Loi IX : zone hors tutoiement, comme le légal).
//  Aucune fonction, aucun CTA : une photo, une lettre, un merci.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";

export function PourquoiHector({ onBack }) {
  // Le geste retour Android (TWA) doit ramener au profil, pas quitter l'app :
  // on pousse une entrée d'historique à l'ouverture ; popstate ferme la page.
  useEffect(() => {
    window.history.pushState({ pourquoi: true }, "");
    const onPop = () => onBack();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retour = () => window.history.back(); // déclenche popstate → onBack

  const pStyle = { fontSize: 15, color: "#C5D4E3", lineHeight: 1.85, margin: "0 0 20px" };

  return (
    <div style={{ minHeight: "100vh", background: "#07192E", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 90 }}>

        {/* Portrait — nu, pleine largeur, fondu dans le fond sombre */}
        <div style={{ position: "relative" }}>
          <img src="/hector-hommage.webp" alt="Hector" style={{ width: "100%", display: "block" }} />
          {/* Fondu des QUATRE bords dans le fond de l'app : ombre interne couleur du fond
              (les côtés/le haut) + dégradé renforcé en bas. La photo se fond, elle n'est pas « posée ». */}
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 64px 32px #07192E", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(to bottom, rgba(7,25,46,0), #07192E)", pointerEvents: "none" }} />
          <button type="button" onClick={retour} aria-label="Retour"
            style={{ position: "absolute", top: 14, left: 14, background: "rgba(7,25,46,0.55)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.15)", color: "#B5D4F4", borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 15 }} /> Retour
          </button>
        </div>

        {/* La lettre — texte exact, vouvoiement volontaire */}
        <div style={{ padding: "26px 24px 0" }}>
          <p style={pStyle}>Avant d'être une application, H€CTOR était mon chien.</p>
          <p style={pStyle}>Un Bull Terrier. Têtu, drôle, parfois complètement fou… mais surtout toujours là.</p>
          <p style={pStyle}>Il ne savait rien des factures, des impôts, des devis ou de la comptabilité. Pourtant, il faisait déjà ce que cette application essaie de faire aujourd'hui : il rendait les journées un peu plus légères.</p>
          <p style={pStyle}>Quand tout allait bien, il faisait la fête avec moi. Quand les journées étaient compliquées, il était simplement présent. Sans jugement. Sans rien demander.</p>
          <p style={pStyle}>En créant cette application, je ne voulais pas construire un logiciel de plus.<br />Je voulais créer un compagnon.</p>
          <p style={pStyle}>Un compagnon qui veille sur votre activité, qui vous prévient avant les mauvaises surprises, qui vous rassure quand tout paraît flou et qui vous aide à y voir plus clair.</p>
          <p style={pStyle}>C'est pour ça que cette application porte son nom.</p>
          <p style={pStyle}>Parce que derrière chaque auto-entrepreneur, chaque intermittent, il y a une personne qui porte énormément de choses seule.</p>
          <p style={pStyle}>Je souhaite à chacun d'avoir un Hector dans sa vie.</p>
          <p style={pStyle}>Si cette application peut vous enlever un peu de ce poids, alors elle porte parfaitement son nom.</p>

          <p style={{ fontSize: 14, color: "#8BA5C0", fontStyle: "italic", margin: "30px 0 0" }}>— Camille, créateur de H€CTOR</p>

          <p style={{ textAlign: "center", fontSize: 15.5, color: "#5DCAA5", fontWeight: 600, margin: "80px 0 0" }}>Merci, mon vieux. 🐾</p>
        </div>
      </div>
    </div>
  );
}
