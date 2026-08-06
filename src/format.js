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

// ⚠️ RÈGLE DES DATES CIVILES (posée le 06/08/2026, après trois bugs trouvés par
// les tests). Une date "AAAA-MM-JJ" est une date de CALENDRIER : le 6 août est le
// 6 août, où qu'on soit. Or `new Date("2026-08-06")` la lit comme minuit à
// Greenwich, ce qui la décale ensuite dans le fuseau de l'utilisateur :
//   aux Antilles et en Polynésie, toutes les dates reculaient d'un jour ;
//   en métropole, une activité du jour saisie avant 2 h du matin passait pour
//   FUTURE et disparaissait du compteur des 507 heures.
// Ce lecteur ramène toute date civile à minuit LOCAL. C'est le pendant de la
// règle qui interdit déjà toISOString dans l'autre sens.
export function lireDateCivile(d) {
  if (typeof d === "string") {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(d);
}

export function formatDate(d) {
  if (!d) return "—";
  return lireDateCivile(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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
  // Formation suivie : heure pour heure ICI (conversion brute d'une ligne).
  // Le plafond des 338h est GLOBAL par fenêtre : il s'applique dans heuresFenetre,
  // jamais ligne par ligne (jumeau de heures_de() backend).
  if (t === "formation") return n;
  // Enseignement dispensé : heure pour heure ; plafonds (70h + partage 338h) dans heuresFenetre.
  if (t === "enseignement") return n;
  // Arrêt assimilé (maternité, AT/MP, ALD, suspension) : 5h par jour, sans plafond.
  if (t === "arret_maternite" || t === "arret_accident" || t === "arret_ald" || t === "arret_suspension") {
    return n * (valeurDe("assimilationArretParJour") || 5);
  }
  // Arrêt neutralisé (maladie ordinaire, paternité) : 0h — il allonge la fenêtre
  // (géré côté backend), il n'ajoute pas d'heures. Jumeau de heures_de().
  if (t === "arret_maladie_ordinaire" || t === "arret_paternite") return 0;
  return 0; // type inconnu : on ne devine pas (comme le backend)
}

// Affiche la date d'une activité, ou la période "JJ/MM → JJ/MM" si une date de fin
// distincte existe (AEM couvrant plusieurs jours). N'affecte jamais le calcul,
// purement cosmétique. Format court par défaut, ou la date ISO brute en repli.
export function formatPeriode(a, court = true) {
  if (!a || !a.date) return "";
  const fmt = (iso) => {
    const d = lireDateCivile(iso);
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
  // Fenêtre en jours CIVILS : on compare des journées entières, pas des instants.
  // Sans cela, une activité du jour saisie à 0 h 30 était jugée future (sa date
  // civile vaut minuit local, or l'heure courante était plus tôt dans la journée
  // UTC) et ses heures disparaissaient du compteur jusqu'à 2 h du matin.
  const finDeJournee = new Date(aujourdhui);
  finDeJournee.setHours(23, 59, 59, 999);
  const borneBasse = new Date(aujourdhui);
  borneBasse.setDate(borneBasse.getDate() - fenetreJours);
  borneBasse.setHours(0, 0, 0, 0);
  // Plafond de 338h PARTAGÉ formation + enseignement (jumeau de _compter_sur_fenetre) ;
  // l'enseignement a en plus son sous-plafond propre de 70h.
  const plafondPartage = valeurDe("formationPlafondNouvelleAdmission") || 338;
  const plafondEnseignement = valeurDe("enseignementPlafond") || 70;
  let formationRetenue = 0, enseignementRetenue = 0;
  return (activites || []).reduce((s, a) => {
    const d = lireDateCivile(a.date);
    if (isNaN(d) || d < borneBasse || d > finDeJournee) return s;
    let h = heuresDe(a);
    if (a.type_activite === "formation") {
      h = Math.min(h, Math.max(0, plafondPartage - (formationRetenue + enseignementRetenue)));
      formationRetenue += h;
    } else if (a.type_activite === "enseignement") {
      h = Math.min(h, Math.max(0, plafondPartage - (formationRetenue + enseignementRetenue)), Math.max(0, plafondEnseignement - enseignementRetenue));
      enseignementRetenue += h;
    }
    return s + h;
  }, 0);
}
