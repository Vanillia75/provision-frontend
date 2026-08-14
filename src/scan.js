// ─────────────────────────────────────────────────────────────────────────────
//  Les décisions du scan qui méritent d'être vérifiées à part.
//
//  Quand on envoie plusieurs photos d'un coup, Totor lit d'abord chaque photo
//  séparément, puis, s'il reste des échecs ou des trous, il retente une lecture
//  GROUPÉE (le lecteur voit alors le document entier, comme un humain qui tourne
//  les pages). Reste à décider laquelle des deux lectures on garde.
//
//  Cette décision vivait au milieu de l'écran, où elle était intestable. Sortie
//  ici le 14/08/2026 après la découverte d'un défaut : voir plus bas.
// ─────────────────────────────────────────────────────────────────────────────

/** Le nombre de champs manquants dans une liste d'attestations lues.
 *  L'employeur et le métier sont les deux champs typiquement écrits sur la
 *  PAGE 1 : ce sont eux qui disparaissent quand les pages sont lues isolément. */
export function trous(liste) {
  return (liste || []).reduce((n, d) => n + (!d.employeur ? 1 : 0) + (!d.metier ? 1 : 0), 0);
}

/**
 * Faut-il remplacer la lecture page par page par la lecture groupée ?
 *
 * ⚠️ DÉFAUT CORRIGÉ LE 14/08/2026. La règle était « autant d'attestations ou
 *  plus, ET strictement moins de trous ». Elle échouait exactement là où la
 *  lecture groupée est la plus précieuse : quand AUCUNE page n'a pu être lue
 *  seule. Dans ce cas la lecture page par page ne rend rien du tout, donc elle
 *  compte zéro trou, et « moins de zéro trou » est impossible. Le résultat
 *  groupé, pourtant complet, était donc jeté, et la personne voyait « je n'ai
 *  pas réussi à lire ce document » alors que Totor venait de le lire.
 */
/**
 * Les périodes d'un relevé de situation, regroupées PAR MOIS.
 *
 * ⚠️ Ajouté le 14/08/2026. Un relevé découpe le temps en périodes, et Totor
 *  range ensuite une ligne par mois. La plupart du temps une période = un mois
 *  entier, donc tout allait bien. Mais quand les droits s'ouvrent ou reprennent
 *  en cours de mois, France Travail écrit DEUX périodes dans le même mois
 *  (« du 1er au 14 » puis « du 15 au 31 »). Chacune devenait une ligne du même
 *  mois, et la seconde écrasait la première à l'enregistrement : Totor ne
 *  voyait plus que la moitié du versement et annonçait un écart qui n'existait
 *  pas. On additionne les deux moitiés, ce qui est la réalité du mois.
 *
 *  Les périodes gardent leur ordre d'apparition ; la personne voit le total et
 *  peut le corriger avant d'enregistrer, comme pour tout le reste.
 */
export function regrouperParMois(periodes) {
  const parMois = new Map();
  const somme = (a, b) => (a == null && b == null ? null : Number(a || 0) + Number(b || 0));

  for (const p of periodes || []) {
    const ref = p.fin || p.debut || "";
    const annee = parseInt(String(ref).slice(0, 4), 10);
    const mois = parseInt(String(ref).slice(5, 7), 10);
    if (!annee || !mois) continue;
    const cle = `${annee}-${mois}`;
    const deja = parMois.get(cle);
    if (!deja) {
      parMois.set(cle, {
        annee, mois,
        aj_dues: p.aj_dues ?? null,
        net_du: p.net_du ?? null,
        jours_travail: p.jours_travail ?? null,
        jours_franchise_cp: p.jours_franchise_cp ?? null,
        jours_franchise_salaires: p.jours_franchise_salaires ?? null,
      });
      continue;
    }
    deja.aj_dues = somme(deja.aj_dues, p.aj_dues);
    deja.net_du = somme(deja.net_du, p.net_du);
    deja.jours_travail = somme(deja.jours_travail, p.jours_travail);
    deja.jours_franchise_cp = somme(deja.jours_franchise_cp, p.jours_franchise_cp);
    deja.jours_franchise_salaires = somme(deja.jours_franchise_salaires, p.jours_franchise_salaires);
  }
  // Les euros se recollent mal : 915.00 + 446.36 doit donner 1361.36, pas
  // 1361.3600000000001.
  for (const m of parMois.values()) {
    if (m.net_du != null) m.net_du = Math.round(m.net_du * 100) / 100;
  }
  return [...parMois.values()];
}

export function doitPrendreLaLectureGroupee(groupee, pageParPage) {
  const g = groupee || [];
  const p = pageParPage || [];
  if (g.length === 0) return false;          // rien à prendre
  if (p.length === 0) return true;           // on n'avait RIEN : tout vaut mieux
  return g.length >= p.length && trous(g) < trous(p);
}
