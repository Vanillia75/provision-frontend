// ============================================================================
//  CARNET DE BORD D'HECTOR — "Ce que j'ai appris"
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
      titre: "Mon briefing du matin",
      entrees: [
        { date: "2026-06-28", public: "tous", texte: "J'apprends à te résumer l'essentiel chaque matin : ce que tu peux faire, ce qu'il te reste à régler. Bientôt prêt." },
      ],
    },
    {
      titre: "Me connecter à ta banque — si tu le veux, un jour",
      entrees: [
        { date: "2026-06-28", public: "tous", texte: "J'apprends à récupérer tes opérations bancaires pour t'éviter de la saisie — uniquement si tu me le demandes, jamais sans toi. Encore un peu de patience." },
      ],
    },
  ],

  // ── Avancées terminées récemment → encart "Cette semaine, j'ai appris…" ──
  apprisRecemment: [
    // Communes (les deux métiers)
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
