// ============================================================================
//  legalMentions.js — Mentions légales de facturation (factures + devis)
// ============================================================================
//  ⚠️ JUMEAU BACKEND : miroir EXACT de provision-backend/legal_mentions.py.
//  Si tu modifies une mention ici, modifie-la AUSSI là-bas (et inversement).
//  C'est l'UNIQUE source de vérité côté front — ne pas réécrire cette logique
//  ailleurs dans App.jsx.
//
//  Sert UNIQUEMENT à l'APERÇU dans l'interface. Les documents officiels
//  (PDF facture + emails facture/devis) sont produits par le backend, qui
//  applique exactement les mêmes règles.
// ============================================================================

// Mention TVA pour un émetteur en franchise en base de TVA (cas par défaut de
// l'auto-entrepreneur sous les seuils). Ne calcule aucune TVA.
// `invoiceDate` est accepté pour garder la signature stable (cf. backend :
// éventuelle bascule 293 B CGI → L.223-3 CIBS, à vérifier à la source).
export function franchiseVatMention(invoiceDate = null) {
  return "TVA non applicable, art. 293 B du CGI";
}

// Suffixe « – EI » (Entrepreneur Individuel) au nom de l'émetteur : mention
// légale obligatoire depuis 2022 pour les entrepreneurs individuels (dont les
// auto-entrepreneurs). Ne s'applique qu'aux EI, préserve le nom commercial
// existant, et ne duplique pas la mention si elle est déjà là.
export function appendEiMention(nom, statut) {
  if (!nom || statut !== "auto_entrepreneur") return nom;
  if (/\bEI\b\s*$/.test(nom.trim())) return nom;
  return `${nom} – EI`;
}
