#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
════════════════════════════════════════════════════════════════════════════
 GÉNÉRATEUR DU RÉFÉRENTIEL FRONTEND (.js) DEPUIS LE BACKEND (.py)
════════════════════════════════════════════════════════════════════════════

 SOURCE UNIQUE DE VÉRITÉ : regles_intermittent.py (backend).
 Le fichier regles_intermittent.js (frontend) est GÉNÉRÉ par ce script — il ne
 doit JAMAIS être édité à la main. Pour changer une règle, on modifie le .py,
 puis ce script régénère le .js à l'identique. Divergence devenue impossible.

 Sur GitHub, le workflow .github/workflows/generer-regles.yml lance ce script à
 chaque push qui touche le .py, et committe le .js régénéré automatiquement.

 USAGE :  python3 generer_regles_js.py
   - lit  regles_intermittent.py  (cherché ici, sinon dans le repo backend monté)
   - écrit regles_intermittent.js  (à côté, et/ou dans src/ selon l'arborescence)

 Le .js produit contient : VERSION_REFERENTIEL, toutes les REGLES (y compris les
 règles frontOnly), et les fonctions JS (valeurDe, tracer, getRegle,
 moteurHeuresValide) attendues par App.jsx.
════════════════════════════════════════════════════════════════════════════
"""

import importlib.util
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))


def charger_py(chemin):
    spec = importlib.util.spec_from_file_location("regles_py", chemin)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.VERSION_REFERENTIEL, mod.REGLES


def js_valeur(v):
    """Convertit une valeur Python en littéral JS."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, dict):
        # objet JS : { cle: valeur, ... }
        paires = ", ".join(f"{k}: {js_valeur(val)}" for k, val in v.items())
        return "{ " + paires + " }"
    # chaîne : on échappe les guillemets doubles et les antislashes
    s = str(v).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def js_regle(cle, r):
    """Génère le bloc JS d'une règle, en préservant tous ses champs."""
    lignes = [f"  {cle}: {{"]
    # ordre des champs : valeur, libelle, source, version, dateAppli, verifie, puis le reste
    ordre = ["valeur", "libelle", "source", "version", "dateAppli", "verifie"]
    vus = set()
    for champ in ordre:
        if champ in r:
            lignes.append(f"    {champ}: {js_valeur(r[champ])},")
            vus.add(champ)
    # champs restants (frontOnly, nePasUtiliser, aValiderUrgent, commentaire, statut...)
    for champ, val in r.items():
        if champ in vus:
            continue
        lignes.append(f"    {champ}: {js_valeur(val)},")
    lignes.append("  },")
    return "\n".join(lignes)


def generer_js(version_ref, regles):
    entete = '''/**
 * ════════════════════════════════════════════════════════════════════════
 *  RÉFÉRENTIEL DES RÈGLES DU RÉGIME INTERMITTENT DU SPECTACLE (frontend)
 * ════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS ÉDITER À LA MAIN.
 *  Source unique : regles_intermittent.py (backend). Ce fichier est produit
 *  par generer_regles_js.py. Pour changer une règle, modifie le .py.
 *  Toute édition manuelle ici sera écrasée à la prochaine génération.
 * ════════════════════════════════════════════════════════════════════════
 */

export const VERSION_REFERENTIEL = ''' + js_valeur_objet(version_ref) + ''';

export const REGLES = {

'''
    corps = "\n\n".join(js_regle(cle, r) for cle, r in regles.items())

    fonctions = '''

};

/**
 * Indique si les règles-clés du calcul des heures (seuil, conversion cachet,
 * période de référence) sont toutes validées. Si oui, le badge de confiance
 * peut basculer de "fiable" à "certain".
 */
export function moteurHeuresValide() {
  const clesCles = ["seuilHeures", "cachetHeures", "periodeReferenceJours"];
  return clesCles.every((c) => REGLES[c] && REGLES[c].verifie === true);
}

/** Renvoie une règle avec sa traçabilité complète, ou null. */
export function getRegle(cle) {
  const r = REGLES[cle];
  if (!r) {
    console.warn(`[regles_intermittent] Règle inconnue : "${cle}"`);
    return null;
  }
  return r;
}

/** Renvoie juste la valeur d'une règle (raccourci pour les calculs). */
export function valeurDe(cle) {
  const r = REGLES[cle];
  return r ? r.valeur : null;
}

/** Construit une phrase de traçabilité pour le bouton "Pourquoi ?". */
export function tracer(cle) {
  const r = REGLES[cle];
  if (!r) return "";
  const valeurTxt = typeof r.valeur === "object" ? JSON.stringify(r.valeur) : r.valeur;
  const fiabilite = r.verifie ? "" : " (valeur documentée, validation experte en cours)";
  return `${r.libelle} : ${valeurTxt}. Source : ${r.source}, version ${r.version}${fiabilite}.`;
}
'''
    return entete + corps + fonctions


def js_valeur_objet(d):
    """Sérialise le dict VERSION_REFERENTIEL en objet JS multi-lignes."""
    lignes = ["{"]
    for k, v in d.items():
        lignes.append(f"  {k}: {js_valeur(v)},")
    lignes.append("}")
    return "\n".join(lignes)


def trouver_py():
    # cherche le .py ici, puis dans un éventuel dossier backend monté
    for chemin in [
        os.path.join(ICI, "regles_intermittent.py"),
        os.path.join(ICI, "..", "provision-backend", "regles_intermittent.py"),
    ]:
        if os.path.isfile(chemin):
            return chemin
    return None


def cibles_js():
    # écrit le .js là où il doit vivre : racine et/ou src/
    cibles = []
    for sous in ["", "src"]:
        d = os.path.join(ICI, sous)
        if os.path.isdir(d) or sous == "":
            cibles.append(os.path.join(d, "regles_intermittent.js"))
    return cibles


def main():
    chemin_py = trouver_py()
    if not chemin_py:
        print("❌ regles_intermittent.py introuvable.")
        return 1
    version_ref, regles = charger_py(chemin_py)
    contenu = generer_js(version_ref, regles)

    ecrits = []
    for cible in cibles_js():
        os.makedirs(os.path.dirname(cible) or ".", exist_ok=True)
        with open(cible, "w", encoding="utf-8") as f:
            f.write(contenu)
        ecrits.append(cible)

    print(f"✓ {len(regles)} règles générées depuis {os.path.basename(chemin_py)}")
    for c in ecrits:
        print(f"  → écrit : {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
