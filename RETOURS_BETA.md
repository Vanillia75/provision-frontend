# Retours bêta — le carnet d'écoute

> Un retour = une ligne. On note ce que le testeur DIT, ce qu'il VIT, et le signal.
> 🔴 bloque · 🟡 gêne · 🟢 idée. Le pattern (2×, 3×…) décide des chantiers — pas l'enthousiasme.

| Date | Signal | Ce qu'il dit | Ce qu'il vit | Piste | Occurrences |
|------|--------|--------------|--------------|-------|-------------|
| 2026-07-03 | 🟢 idée | « des relances de paiement pour les clients qui n'ont pas réglé » | courir après l'argent = la pire corvée ; il veut ne plus avoir à y penser ni à trouver les mots | ✅ **LIVRÉ le jour même** (16cb19a) : Hector voit la facture en retard et propose la relance rédigée avec les vraies données, l'utilisateur relit et envoie | 1× |
| 2026-07-03 | 🟢 idée | relances appliquées automatiquement (Camille) | ne même plus avoir à cliquer — la relance part toute seule | ✅ **LIVRÉ et ARMÉ le jour même** (3d161f3 + armement live) : opt-in par utilisateur (Profil → Relances automatiques, 7/15/30 jours), 1 relance max par facture, moteur toutes les 6h. Chaîne validée de bout en bout : mode répétition → envoi réel → **réception du mail vérifiée par retour humain le 2026-07-03**. Loi IV respectée (l'utilisateur décide la règle, Hector l'applique et le montre) | 1× |
