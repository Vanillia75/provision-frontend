// ============================================================================
//  CARNET DE BORD DE TOTOR — "Ce que j'ai appris"
//  Écrit À LA MAIN par Camille. Pour éditer : modifie les listes ci-dessous.
//
//  Champ "public" sur CHAQUE entrée : "tous" | "intermittent" | "auto".
//  L'app affiche les entrées "tous" + celles du statut de l'utilisateur — JAMAIS le
//  jargon de l'autre métier (un auto-entrepreneur ne voit pas "AEM", etc.).
//
//  enCours       : fonctionnalités en apprentissage (cartes, 3 max, plus récentes en haut).
//  apprisRecemment : avancées terminées → encart "Cette semaine, j'ai appris…".
//                  Chaque entrée disparaît toute seule 7 jours après sa date.
//
//  Une entrée : { date: "AAAA-MM-JJ", texte: "...", public: "tous" }.
//
//  ⚠️ VOIX : toujours le bénéfice pour toi, jamais de technique. 1ʳᵉ personne, chaleureux.
// ============================================================================

export const CARNET = {
  // ── Fonctionnalités en cours d'apprentissage (valables pour les deux métiers) ──
  enCours: [
    {
      titre: "Tes Congés Spectacles dans mes simulations",
      entrees: [
        { date: "2026-08-04", public: "intermittent", texte: "Une intermittente m'a demandé de te dire aussi ce que tes futurs cachets ajouteraient à tes Congés Spectacles. C'est commencé : chaque simulation te le dit déjà en gros. J'apprends à l'affiner, saison par saison." },
      ],
    },
    {
      // Connexion bancaire : ne parle qu'aux auto-entrepreneurs (suivi de trésorerie).
      // Côté intermittent, ça n'a aucun sens (leur sujet = heures et droits, pas le solde).
      titre: "Me connecter à ta banque, si un jour tu le souhaites",
      entrees: [
        { date: "2026-06-28", public: "auto", texte: "J'apprends à lire ton solde et tes encaissements tout seul, en lecture seule, pour t'éviter la saisie à la main. Ce sera toujours ton choix : tu actives si tu veux, tu débranches quand tu veux. Encore un peu de patience." },
      ],
    },
  ],

  // ── Avancées terminées récemment → encart "Cette semaine, j'ai appris…" ──
  apprisRecemment: [
    // Communes (les deux métiers)
    { date: "2026-08-04", public: "tous", texte: "Mon briefing du jour est arrivé sur ton cockpit : ce qu'il y a à faire, ce qui peut attendre, et quand tout va bien, je te le dis aussi. Promis fin juin, tenu." },
    { date: "2026-08-04", public: "intermittent", texte: "Un vrai versement France Travail est tombé, et mon estimation du mois était juste au centime près. Je m'entraînais depuis des semaines pour ça." },
    { date: "2026-06-28", public: "tous", texte: "À me mettre à jour tout seul, pour que tu aies toujours ma dernière version." },
    { date: "2026-06-27", public: "tous", texte: "À te montrer clairement ce qu'il te reste chaque mois." },
    { date: "2026-06-26", public: "tous", texte: "À te laisser m'offrir à tes proches, pour qu'ils profitent de moi eux aussi." },
    // Intermittent uniquement
    { date: "2026-06-25", public: "intermittent", texte: "À lire tes attestations encore plus vite et sans me tromper." },
    { date: "2026-06-23", public: "intermittent", texte: "À te dire à l'avance si tu sécurises tes droits, sereinement." },
    // Auto-entrepreneur uniquement
    { date: "2026-06-24", public: "auto", texte: "À lire tes factures et tes justificatifs en deux secondes." },
    { date: "2026-06-22", public: "auto", texte: "À garder un œil sur ta trésorerie pour que tu saches toujours où tu en es." },
  ],
};
