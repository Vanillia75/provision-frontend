# Retours bêta — le carnet d'écoute

> Un retour = une ligne. On note ce que le testeur DIT, ce qu'il VIT, et le signal.
> 🔴 bloque · 🟡 gêne · 🟢 idée. Le pattern (2×, 3×…) décide des chantiers — pas l'enthousiasme.

| Date | Signal | Ce qu'il dit | Ce qu'il vit | Piste | Occurrences |
|------|--------|--------------|--------------|-------|-------------|
| 2026-07-03 | 🟢 idée | « des relances de paiement pour les clients qui n'ont pas réglé » | courir après l'argent = la pire corvée ; il veut ne plus avoir à y penser ni à trouver les mots | ✅ **LIVRÉ le jour même** (16cb19a) : Hector voit la facture en retard et propose la relance rédigée avec les vraies données, l'utilisateur relit et envoie | 1× |
| 2026-07-03 | 🟢 idée | relances appliquées automatiquement (Camille) | ne même plus avoir à cliquer — la relance part toute seule | **Relance automatique OPT-IN** : l'utilisateur active une règle une fois (« relance mes factures après X jours de retard ») et Hector envoie en le prévenant. Respecte la Loi IV (c'est l'utilisateur qui décide la règle) mais exige : cron backend, garde-fous (1 relance max, jamais 2), notification après envoi. Chantier backend — à cadrer si les testeurs utilisent la relance manuelle | 1× |
