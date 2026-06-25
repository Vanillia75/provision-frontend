#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
════════════════════════════════════════════════════════════════════════════
 TEST DE COHÉRENCE DES RÉFÉRENTIELS INTERMITTENT (.py backend ↔ .js frontend)
════════════════════════════════════════════════════════════════════════════

 BUT : garantir que regles_intermittent.py (backend, source des calculs) et
 regles_intermittent.js (frontend, source de l'affichage) ne divergent JAMAIS
 en silence. Tant que les deux fichiers coexistent, ce test est le garde-fou.

 CE QUE LE TEST VÉRIFIE, pour chaque règle présente DANS LES DEUX fichiers :
   - même valeur
   - même version
   - même source
   - même statut "verifie"
 Toute différence sur une règle commune  →  ÉCHEC (sortie code 1, bloquant).

 CE QU'IL SIGNALE SANS BLOQUER (avertissement) :
   - une règle présente d'un seul côté (asymétrie connue : 8 règles ne sont
     pour l'instant que dans le .js). Non bloquant pour pouvoir combler petit
     à petit, mais affiché clairement.

 USAGE :  python3 test_coherence_intermittent.py
   - code retour 0  →  cohérent (les divergences éventuelles ne sont que des
                       asymétries de présence, non bloquantes)
   - code retour 1  →  AU MOINS UNE règle commune diverge : à corriger.

 NOTE : ce test lit le .js comme du TEXTE (pas besoin de Node.js). Le parsing
 est volontairement simple et robuste ; si le format du .js change beaucoup,
 adapter les expressions régulières ci-dessous.

 Les deux fichiers doivent être accessibles. Par défaut on les cherche :
   - regles_intermittent.py  : à côté de ce test
   - regles_intermittent.js  : à côté de ce test, sinon dans ./src/
════════════════════════════════════════════════════════════════════════════
"""

import importlib.util
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))


# ─────────────────────────────────────────────────────────────────────────────
#  Localisation des deux fichiers
# ─────────────────────────────────────────────────────────────────────────────
def trouver(nom, sous_dossiers=("", "src")):
    for sd in sous_dossiers:
        chemin = os.path.join(ICI, sd, nom)
        if os.path.isfile(chemin):
            return chemin
    return None


CHEMIN_PY = trouver("regles_intermittent.py")
CHEMIN_JS = trouver("regles_intermittent.js")


# ─────────────────────────────────────────────────────────────────────────────
#  Chargement du référentiel Python (backend)
# ─────────────────────────────────────────────────────────────────────────────
def charger_py(chemin):
    spec = importlib.util.spec_from_file_location("regles_py", chemin)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    regles = {}
    for cle, r in mod.REGLES.items():
        regles[cle] = {
            "valeur": r.get("valeur"),
            "version": r.get("version"),
            "source": (r.get("source") or "").strip(),
            "verifie": bool(r.get("verifie", False)),
        }
    version_ref = mod.VERSION_REFERENTIEL.get("version")
    return regles, version_ref


# ─────────────────────────────────────────────────────────────────────────────
#  Chargement du référentiel JS (frontend) — parsing texte
# ─────────────────────────────────────────────────────────────────────────────
def charger_js(chemin):
    js = open(chemin, encoding="utf-8").read()

    # Version du référentiel
    mver = re.search(r'VERSION_REFERENTIEL\s*=\s*\{[^}]*version:\s*"([^"]+)"', js)
    version_ref = mver.group(1) if mver else None

    # Corps de l'objet REGLES
    m = re.search(r'export const REGLES\s*=\s*\{(.*)\n\};', js, re.DOTALL)
    if not m:
        raise ValueError("Impossible de localiser l'objet REGLES dans le .js")
    body = m.group(1)

    # Chaque règle commence par "  nomCle: {" (2 espaces d'indentation)
    debuts = [
        (mm.group(1), mm.start())
        for mm in re.finditer(r'^  ([a-zA-Z_][a-zA-Z0-9_]*):\s*\{', body, re.MULTILINE)
    ]

    regles = {}
    for i, (cle, start) in enumerate(debuts):
        end = debuts[i + 1][1] if i + 1 < len(debuts) else len(body)
        bloc = body[start:end]

        regle = {"valeur": None, "version": None, "source": "", "verifie": False}

        # valeur : nombre simple OU objet { ... }
        vmatch = re.search(r'valeur:\s*(\{[^}]*\}|-?[0-9][0-9.]*)', bloc)
        if vmatch:
            v = vmatch.group(1)
            if v.startswith("{"):
                regle["valeur"] = re.sub(r"\s+", "", v)  # objet normalisé en texte
            else:
                regle["valeur"] = float(v) if "." in v else int(v)

        # champs texte éventuellement répartis sur plusieurs lignes / concaténés
        for champ in ("version", "source"):
            cm = re.search(champ + r':\s*\n?\s*"((?:[^"\\]|\\.)*)"', bloc)
            if cm:
                regle[champ] = cm.group(1).strip()

        vf = re.search(r'verifie:\s*(true|false)', bloc)
        if vf:
            regle["verifie"] = (vf.group(1) == "true")

        regles[cle] = regle

    return regles, version_ref


# ─────────────────────────────────────────────────────────────────────────────
#  Comparaison
# ─────────────────────────────────────────────────────────────────────────────
def normaliser_valeur(v):
    """Pour comparer 12 (py) et 12.0 (js) comme égaux, et les objets en texte."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def comparer(py, py_ver, js, js_ver):
    echecs = []        # divergences bloquantes (règles communes)
    avertissements = []  # asymétries de présence (non bloquant)

    # 1. Version globale du référentiel
    if py_ver != js_ver:
        echecs.append(f"Version du référentiel différente : .py={py_ver} | .js={js_ver}")

    cles_py = set(py)
    cles_js = set(js)
    communes = sorted(cles_py & cles_js)

    # 2. Règles communes : tout doit matcher
    for cle in communes:
        p, j = py[cle], js[cle]
        if normaliser_valeur(p["valeur"]) != normaliser_valeur(j["valeur"]):
            echecs.append(f"[{cle}] VALEUR : .py={p['valeur']!r} | .js={j['valeur']!r}")
        if p["version"] != j["version"]:
            echecs.append(f"[{cle}] VERSION : .py={p['version']!r} | .js={j['version']!r}")
        if p["source"] != j["source"]:
            echecs.append(f"[{cle}] SOURCE :\n        .py={p['source']!r}\n        .js={j['source']!r}")
        if p["verifie"] != j["verifie"]:
            echecs.append(f"[{cle}] VERIFIE : .py={p['verifie']} | .js={j['verifie']}")

    # 3. Asymétries de présence (non bloquant)
    for cle in sorted(cles_js - cles_py):
        avertissements.append(f"Règle présente seulement dans le .js (absente du .py) : {cle}")
    for cle in sorted(cles_py - cles_js):
        avertissements.append(f"Règle présente seulement dans le .py (absente du .js) : {cle}")

    return echecs, avertissements, communes


# ─────────────────────────────────────────────────────────────────────────────
#  Programme principal
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("═" * 70)
    print(" TEST DE COHÉRENCE — référentiels intermittent (.py ↔ .js)")
    print("═" * 70)

    if not CHEMIN_PY:
        print("❌ regles_intermittent.py introuvable (cherché ici et dans ./src/).")
        return 1
    if not CHEMIN_JS:
        print("❌ regles_intermittent.js introuvable (cherché ici et dans ./src/).")
        return 1

    print(f" .py : {CHEMIN_PY}")
    print(f" .js : {CHEMIN_JS}")
    print("─" * 70)

    py, py_ver = charger_py(CHEMIN_PY)
    js, js_ver = charger_js(CHEMIN_JS)

    echecs, avertissements, communes = comparer(py, py_ver, js, js_ver)

    print(f" Règles communes comparées : {len(communes)}")
    print(f" Version référentiel : .py={py_ver} | .js={js_ver}")
    print("─" * 70)

    if avertissements:
        print(" ⚠️  AVERTISSEMENTS (non bloquants) :")
        for a in avertissements:
            print(f"     - {a}")
        print("─" * 70)

    if echecs:
        print(" ❌ DIVERGENCES BLOQUANTES :")
        for e in echecs:
            print(f"     - {e}")
        print("─" * 70)
        print(f" RÉSULTAT : ÉCHEC — {len(echecs)} divergence(s) à corriger.")
        print("═" * 70)
        return 1

    print(" ✅ RÉSULTAT : COHÉRENT — aucune divergence sur les règles communes.")
    if avertissements:
        print("    (des asymétries de présence subsistent, voir avertissements ci-dessus)")
    print("═" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
