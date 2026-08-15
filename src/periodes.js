// ─────────────────────────────────────────────────────────────────────────────
//  Les périodes du récapitulatif de revenus.
//
//  Jusqu'au 15/08/2026, le récap prenait TOUJOURS les douze derniers mois, sans
//  choix possible. Or on ne demande pas ce document pour le plaisir : on le
//  demande parce qu'un tiers le réclame, et chacun réclame une période
//  différente. Un propriétaire veut les trois derniers mois, une banque veut
//  l'année civile, un comptable veut l'exercice, et le milieu du spectacle
//  raisonne en saisons.
//
//  Ce module ne fait QUE calculer des bornes de dates. Aucun affichage, aucun
//  calcul d'argent : c'est ce qui le rend vérifiable.
// ─────────────────────────────────────────────────────────────────────────────

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Le premier jour d'un mois, en date civile locale (jamais d'UTC ici : un
 *  décalage d'un fuseau ferait basculer un contrat dans le mois d'à côté). */
function premierJour(annee, mois) {
  return new Date(annee, mois, 1);
}

/** Le dernier instant d'un mois. */
function dernierJour(annee, mois) {
  return new Date(annee, mois + 1, 0, 23, 59, 59, 999);
}

/** La saison du spectacle court de septembre à août.
 *  Une date de septembre 2026 appartient donc à la saison 2026-2027. */
export function saisonDe(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
}

/**
 * Les bornes d'une période, et son libellé.
 *
 * `choix` :
 *   { type: "12mois" }                    les douze derniers mois (défaut)
 *   { type: "3mois" }                     les trois derniers mois
 *   { type: "annee", annee: 2025 }        une année civile
 *   { type: "saison", saison: 2025 }      la saison 2025-2026 (sept → août)
 *   { type: "mois", annee, mois }         un mois précis (mois : 0 = janvier)
 *
 * `aujourdhui` est injectable pour que les tests ne dépendent pas du jour où
 * on les lance.
 */
export function bornesPeriode(choix, aujourdhui = new Date()) {
  const now = aujourdhui instanceof Date ? aujourdhui : new Date(aujourdhui);
  const type = (choix && choix.type) || "12mois";

  if (type === "annee") {
    const a = Number(choix.annee) || now.getFullYear();
    return { debut: premierJour(a, 0), fin: dernierJour(a, 11), label: `année ${a}` };
  }

  if (type === "saison") {
    const s = Number(choix.saison);
    const a = Number.isFinite(s) ? s : saisonDe(now);
    return {
      debut: premierJour(a, 8),                    // 1er septembre
      fin: dernierJour(a + 1, 7),                  // 31 août
      label: `saison ${a}-${a + 1}`,
    };
  }

  if (type === "mois") {
    const a = Number(choix.annee) || now.getFullYear();
    const m = Number.isFinite(Number(choix.mois)) ? Number(choix.mois) : now.getMonth();
    return { debut: premierJour(a, m), fin: dernierJour(a, m), label: `${MOIS[m]} ${a}` };
  }

  // Les fenêtres glissantes. On part du 1er du mois pour que le document
  // couvre des mois ENTIERS : un récap qui commencerait au 14 du mois donnerait
  // un premier mois amputé, et le total paraîtrait faux à qui le relit.
  const nbMois = type === "3mois" ? 3 : 12;
  const debut = premierJour(now.getFullYear(), now.getMonth() - (nbMois - 1));
  const fin = dernierJour(now.getFullYear(), now.getMonth());
  return {
    debut,
    fin,
    label: `${MOIS[debut.getMonth()]} ${debut.getFullYear()} – ${MOIS[fin.getMonth()]} ${fin.getFullYear()}`,
  };
}

/**
 * Les choix à proposer à l'écran, construits à partir de ce que la personne a
 * réellement saisi. On ne propose JAMAIS une année ou une saison vide : une
 * liste pleine de périodes sans revenu donne l'impression que l'app a perdu les
 * données.
 */
export function choixDisponibles(activites, aujourdhui = new Date()) {
  const now = aujourdhui instanceof Date ? aujourdhui : new Date(aujourdhui);
  // ⚠️ On écarte les valeurs vides AVANT de convertir : « new Date(null) »
  //  ne renvoie pas une date invalide mais le 1er janvier 1970, ce qui ferait
  //  apparaître « Année 1970 » dans la liste des choix (trouvé par le test).
  const dates = (activites || [])
    .map((a) => (a && a.date ? new Date(a.date) : null))
    .filter((d) => d && !isNaN(d));

  const choix = [
    { cle: "12mois", type: "12mois", label: "12 derniers mois" },
    { cle: "3mois", type: "3mois", label: "3 derniers mois" },
  ];

  const annees = [...new Set(dates.map((d) => d.getFullYear()))].sort((a, b) => b - a);
  for (const a of annees) choix.push({ cle: `annee-${a}`, type: "annee", annee: a, label: `Année ${a}` });

  const saisons = [...new Set(dates.map(saisonDe))].sort((a, b) => b - a);
  for (const s of saisons) {
    choix.push({ cle: `saison-${s}`, type: "saison", saison: s, label: `Saison ${s}-${s + 1}` });
  }
  return choix;
}
