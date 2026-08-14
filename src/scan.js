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
export function doitPrendreLaLectureGroupee(groupee, pageParPage) {
  const g = groupee || [];
  const p = pageParPage || [];
  if (g.length === 0) return false;          // rien à prendre
  if (p.length === 0) return true;           // on n'avait RIEN : tout vaut mieux
  return g.length >= p.length && trous(g) < trous(p);
}
