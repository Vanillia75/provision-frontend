// ─────────────────────────────────────────────────────────────────────────────
//  Fonctions utilitaires de mise en forme et de calcul d'heures.
//  Extraites de App.jsx (refactorisation) : code identique, simplement déplacé.
//  Ces fonctions sont "pures" — elles ne dépendent d'aucun état de l'application,
//  uniquement de leurs arguments (et de valeurDe() pour les règles intermittent).
// ─────────────────────────────────────────────────────────────────────────────
import { valeurDe } from "./regles_intermittent";

export function formatEUR(n) {
  const val = n || 0;
  const hasDecimals = Math.abs(val) % 1 !== 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: hasDecimals ? 2 : 0 }).format(val);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONVERSION HEURES — SOURCE UNIQUE côté front (jumeau de heures_de() backend).
//  Tous les cachets comptent 12h (cf. regles_intermittent : règle "8h" abandonnée).
//  Toute la logique de conversion DOIT passer par ici : ne jamais réécrire un
//  objet { cachet_isole: 12, ... } ailleurs, sous peine de divergence front/back.
// ─────────────────────────────────────────────────────────────────────────────
export function heuresDe(activite) {
  if (!activite) return 0;
  const n = Math.max(0, parseFloat(activite.nombre) || 0);
  const t = activite.type_activite;
  if (t === "heures") return n;
  if (t === "cachet_isole" || t === "cachet_groupe" || t === "cachet") return n * valeurDe("cachetHeures");
  return 0; // type inconnu : on ne devine pas (comme le backend)
}

// Affiche la date d'une activité, ou la période "JJ/MM → JJ/MM" si une date de fin
// distincte existe (AEM couvrant plusieurs jours). N'affecte jamais le calcul,
// purement cosmétique. Format court par défaut, ou la date ISO brute en repli.
export function formatPeriode(a, court = true) {
  if (!a || !a.date) return "";
  const fmt = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return court
      ? String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0")
      : iso;
  };
  if (a.date_fin && a.date_fin !== a.date) {
    return fmt(a.date) + " → " + fmt(a.date_fin);
  }
  return court ? fmt(a.date) : a.date;
}

// Normalise un nom d'employeur pour comparaison souple : minuscules, sans accents,
// espaces multiples réduits. "ÉTOILE DE RÊVE" et "etoile de reve" deviennent identiques.
export function normEmployeur(nom) {
  if (!nom) return "";
  return nom
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Retrouve les contrats passés chez un employeur donné, pour servir de repère
// lors d'une estimation. Ne renvoie QUE des données réelles déjà enregistrées,
// du même type (heures/cachets) que celui en cours de saisie. Jamais d'invention.
// Retourne { count, moyenne, derniers: [{date, nombre, type}] } ou null si rien.
export function historiqueEmployeur(activites, nomEmployeur, typeActivite) {
  const cible = normEmployeur(nomEmployeur);
  if (!cible || !Array.isArray(activites)) return null;
  // Même famille de type : on regroupe les cachets ensemble, les heures ensemble.
  const memeFamille = (t) => {
    const estCachet = (x) => x === "cachet_isole" || x === "cachet_groupe" || x === "cachet";
    return estCachet(typeActivite) ? estCachet(t) : t === "heures";
  };
  const passes = activites
    .filter(a => normEmployeur(a.employeur) === cible && memeFamille(a.type_activite) && (a.nombre || 0) > 0)
    .sort((x, y) => String(y.date).localeCompare(String(x.date))); // plus récent d'abord
  if (passes.length === 0) return null;
  const total = passes.reduce((s, a) => s + (a.nombre || 0), 0);
  const moyenne = Math.round((total / passes.length) * 10) / 10;
  return {
    count: passes.length,
    moyenne,
    derniers: passes.slice(0, 3).map(a => ({ date: a.date, nombre: a.nombre, type: a.type_activite })),
  };
}

// Total des heures sur la fenêtre glissante de 365 jours (identique au backend).
// On ignore ce qui est hors fenêtre ou dans le futur. C'est CE total qui doit
// être affiché partout (cockpit, "Que se passe-t-il si", analyses), pour ne jamais
// contredire le compteur officiel renvoyé par le backend.
export function heuresFenetre(activites, aujourdhui = new Date()) {
  const fenetreJours = valeurDe("periodeReferenceJours") || 365;
  const borneBasse = new Date(aujourdhui);
  borneBasse.setDate(borneBasse.getDate() - fenetreJours);
  return (activites || []).reduce((s, a) => {
    const d = new Date(a.date);
    if (isNaN(d) || d < borneBasse || d > aujourdhui) return s;
    return s + heuresDe(a);
  }, 0);
}
