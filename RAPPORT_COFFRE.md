# RAPPORT_COFFRE.md — périmètre & décision (pour que le malentendu ne revienne jamais)

> Rédigé le 2026-07-07. Deux choses portent le nom « coffre » dans H€CTOR. Elles n'ont
> RIEN à voir. Ce document fige laquelle a été supprimée et laquelle est **intouchable**.

## Les deux « coffre » — à ne PLUS jamais confondre

### 1. Coffre V1 frontend = ancienne PAGE de scan (SUPPRIMÉ ✅)
- **Ce que c'était** : le bloc `{interNav === "coffre" && (…)}` dans `App.jsx` — l'ancienne
  vue « Photographie ton AEM », page de scan legacy.
- **Pourquoi supprimable** : remplacée par le parcours **« Mes AEM » V2** (`interNav === "mesaem"`).
  **Injoignable depuis le 1er juillet 2026** : aucune entrée de menu n'y mène, aucun
  `setInterNav("coffre")` n'existe, et `interNav` démarre à `"cockpit"` sans jamais être
  réhydraté depuis le stockage. → **code mort d'interface pur.**
- **Action** : bloc retiré d'`App.jsx` (327 lignes). **Frontend uniquement.** Aucun backend,
  aucune colonne DB, aucun R2, aucune donnée touchée.

### 2. Coffre-fort R2 backend = stockage des AEM originales (VIVANT — INTOUCHABLE 🔒)
- **Ce que c'est** : `r2_storage.py` + son câblage dans `api.py`. Stocke sur Cloudflare R2
  les **documents AEM originaux**, qui **contiennent le NIR (n° de sécu) du salarié**.
  Données sensibles, réelles, en production (R2 actif, ex. les AEM de la testeuse « cas réel n°2 »).
- **HORS PÉRIMÈTRE, sous aucun prétexte** :
  - `upload_aem` (stockage au scan) — tuyauterie VIVANTE de Mes AEM V2 ;
  - endpoint `GET /intermittent/activite/{id}/document` + `a_document` — VIVANTS ;
  - bouton **« Voir le document original »** (front) — fonctionnalité VIVANTE, on la garde ;
  - **`delete_file` et `delete_all_for_user`** — chemins de **suppression RGPD** (effacement
    réel des documents quand l'utilisateur supprime une activité ou son compte). **Obligation
    légale, pas une option d'architecture. On n'y touche JAMAIS.**
  - **Aucune purge** des objets R2 existants, jamais.

## Règle pour l'avenir
« Supprimer le coffre » = **uniquement** retirer du code mort d'interface frontend qui n'est
plus atteignable. Si un bloc touche R2, un document, ou un chemin de suppression → **STOP**,
c'est le coffre-fort vivant, on ne le touche pas et on demande.

Au moindre doute V1-mort vs V2-vivant : **on laisse et on signale.**
