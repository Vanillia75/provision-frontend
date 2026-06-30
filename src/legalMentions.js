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

// Formate un taux de TVA pour l'affichage : 20 -> « 20 », 5.5 -> « 5,5 ». Miroir de format_vat_rate.
export function formatVatRate(rate) {
  const s = Number(rate).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
}

// Totaux d'AFFICHAGE d'une facture/devis à partir du montant HT (= Σ quantité ×
// prix_unitaire). Miroir EXACT de legal_mentions.compute_invoice_totals (back).
// Une seule logique : franchise = taux 0 (HT = TTC) ; assujetti applique vat_rate.
// Purement affichage — ne touche jamais le montant HT (qui seul alimente le CA URSSAF).
export function computeInvoiceTotals(montantHt, fiscal, invoiceDate = null) {
  const ht = Math.round((Number(montantHt) || 0) * 100) / 100;
  const f = fiscal || {};
  if (f.vat_mode === "assujetti") {
    const rate = f.vat_rate == null ? 20 : Number(f.vat_rate);
    const tva = Math.round(ht * rate) / 100; // ht × rate/100, arrondi 2 décimales
    return {
      mode: "assujetti", ht, rate, tva,
      ttc: Math.round((ht + tva) * 100) / 100,
      vat_number: f.vat_number || null, mention: null,
    };
  }
  return {
    mode: "franchise", ht, rate: 0, tva: 0, ttc: ht,
    vat_number: null, mention: franchiseVatMention(invoiceDate),
  };
}
