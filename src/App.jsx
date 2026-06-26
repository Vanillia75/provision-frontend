import { useState, useEffect, useRef, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { FISCALITE, getRegime, calcUrssaf, statutPlafond, statutTVA } from "./fiscalite";
import { valeurDe, tracer, VERSION_REFERENTIEL, moteurHeuresValide } from "./regles_intermittent";
import { formatEUR, formatDate, heuresDe, formatPeriode, normEmployeur, historiqueEmployeur, heuresFenetre } from "./format";
import { INK, ACCENT, PAPER, CSS, S } from "./theme";
import { LegalPageView } from "./LegalPage";

Sentry.init({
  dsn: "https://8304d759a2e2154b99adb465f73ae6b4@o4511600016293888.ingest.de.sentry.io/4511600023175248",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  environment: "production",
});

if (typeof window !== "undefined") {
  window.Sentry = Sentry;
}

const API_BASE = "https://provision-backend-production.up.railway.app";

// Accès localStorage sécurisé : en navigation privée (Safari surtout), ou si le quota
// est plein, localStorage peut LEVER une exception et faire planter toute l'app (écran blanc).
// safeStorage encapsule chaque accès dans un try/catch : en cas d'échec, on retombe sur un
// stockage mémoire temporaire (perdu au refresh, mais l'app ne crashe jamais).
const _memStore = {};
const safeStorage = {
  getItem(key) {
    try { return window.localStorage.getItem(key); }
    catch { return key in _memStore ? _memStore[key] : null; }
  },
  setItem(key, value) {
    try { window.localStorage.setItem(key, value); }
    catch { _memStore[key] = String(value); }
  },
  removeItem(key) {
    try { window.localStorage.removeItem(key); }
    catch { delete _memStore[key]; }
  },
};

// ─── Détection PWA : sait-on déjà installé ? sur quel appareil ? ───
// Sert à afficher la bonne aide à l'installation (bouton Android / instructions iOS).
function isStandalonePWA() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true; // iOS
  } catch { return false; }
}
function isIOSDevice() {
  try {
    const ua = window.navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua)
      // iPad récents se font passer pour Mac : on détecte le tactile
      || (/macintosh/i.test(ua) && "ontouchend" in document);
  } catch { return false; }
}

// Bannière d'installation réutilisable (s'affiche avant ET après connexion).
// Props : pwaPrompt (event Android), onInstall, onDismiss, showHelp, compact.
function InstallBanner({ pwaPrompt, onInstall, onDismiss, showHelp, compact }) {
  if (isStandalonePWA()) return null;
  if (!pwaPrompt && !isIOSDevice()) return null; // rien à proposer sur desktop classique
  return (
    <div style={{ background: "#07192E", border: "1px solid rgba(55,138,221,0.4)", borderRadius: 12, padding: compact ? "11px 13px" : "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "1 1 220px" }}>
          <img src="/hector-icon-192.png" alt="Hector" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Installe Hector sur ton téléphone</div>
            <div style={{ fontSize: 11.5, color: "#9FCBF5", lineHeight: 1.4 }}>Accès direct depuis ton écran d'accueil. <span style={{ color: "#8BA5C0" }}>(En attendant l'app sur les stores)</span></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={onInstall}
            style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Installer
          </button>
          <button type="button" onClick={onDismiss} aria-label="Fermer"
            style={{ background: "transparent", border: "none", color: "#5A7088", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4, fontFamily: "inherit" }}>
            ×
          </button>
        </div>
      </div>
      {showHelp && isIOSDevice() && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "#C8E0F5", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "white" }}>Sur iPhone (dans Safari) :</div>
          1. Appuie sur le bouton <strong>Partager</strong> <i className="ti ti-upload" aria-hidden="true" /> (en bas de l'écran)<br />
          2. Choisis <strong>« Sur l'écran d'accueil »</strong><br />
          3. Appuie sur <strong>Ajouter</strong> 🐾
          <div style={{ marginTop: 8, fontSize: 11.5, color: "#8BA5C0" }}>Si tu es dans Chrome, ouvre d'abord hector-app.fr dans <strong style={{ color: "#9FCBF5" }}>Safari</strong> (l'install marche que là sur iPhone).</div>
        </div>
      )}
      {showHelp && !isIOSDevice() && !pwaPrompt && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "#C8E0F5", lineHeight: 1.7 }}>
          Ouvre le menu de ton navigateur (⋮), puis <strong>« Installer l'application »</strong>.
        </div>
      )}
    </div>
  );
}
const GOOGLE_CLIENT_ID = "1008678142157-vnr5cogc1rvhvenemcahi373adnvvpln.apps.googleusercontent.com";

// Connexion bancaire encore en validation production (ticket Powens PCS-75254).
// Passe à false une fois la prod validée pour réactiver le bouton de connexion.
const BANK_BIENTOT = true;

const STATUTS = [
  { id: "auto_entrepreneur", label: "Auto-entrepreneur", disponible: true },
  { id: "sarl", label: "SARL (gérant)", disponible: false },
  { id: "sas", label: "SAS / SASU", disponible: false },
];

const ACTIVITES = [
  { id: "vente", label: "Vente de marchandises", taux: "12,3%", abattement: 0.71, seuilTva: 85000 },
  { id: "services", label: "Prestations de services", taux: "21,2%", abattement: 0.50, seuilTva: 37500 },
  { id: "bnc", label: "Profession libérale (BNC)", taux: "25,6%", abattement: 0.34, seuilTva: 37500 },
];

const TMI_OPTIONS = [
  { id: "0", label: "0% — je ne paie pas d'impôt actuellement" },
  { id: "11", label: "11%" },
  { id: "30", label: "30%" },
  { id: "41", label: "41%" },
  { id: "45", label: "45%" },
];

const NEWS = [
  { source: "URSSAF", title: "Taux BNC à 25,6% depuis janvier 2026", date: "1 jan. 2026", url: "https://www.urssaf.fr" },
  { source: "Impôts", title: "Plafonds auto-entrepreneur revalorisés : 83 600€", date: "2 jan. 2026", url: "https://www.impots.gouv.fr" },
  { source: "URSSAF", title: "Déclaration T2 2026 : date limite le 31 juillet", date: "1 avr. 2026", url: "https://www.autoentrepreneur.urssaf.fr" },
  { source: "Impôts", title: "Ouverture déclaration revenus 2025 : avril 2026", date: "8 avr. 2026", url: "https://www.impots.gouv.fr" },
];

const CONSEILS = [
  { emoji: "⭐", titre: "ACRE — économisez 50% la 1ère année", texte: "Si vous avez créé votre activité après juillet 2025, vos cotisations sont divisées par 2 pendant 12 mois. Pensez à faire la demande dans les 60 jours." },
  { emoji: "📊", titre: "Versement libératoire", texte: "Payez votre impôt sur le revenu en même temps que vos cotisations, à 1,7% de votre CA. Simple et prévisible." },
  { emoji: "🗓️", titre: "Mensuel vs trimestriel", texte: "En mensuel, vous payez de petites sommes régulières. En trimestriel, vous avez plus de trésorerie mais attention aux gros versements." },
  { emoji: "⚠️", titre: "Surveillez le plafond", texte: "Au-delà de 83 600€ deux années consécutives, vous basculez en régime réel. Anticipez ce changement avec votre comptable." },
];

const PLANS = [
  {
    nom: "Gratuit",
    prix: "0€",
    periode: "/mois",
    couleur: "#E6F1FB",
    couleurTexte: "#0C447C",
    features: [
      "Ce que tu peux vraiment dépenser, calculé en temps réel",
      "Calcul automatique URSSAF, impôts et seuil TVA",
      "Suivi de tes revenus encaissés",
      "3 factures par mois (PDF inclus)",
      "Connexion bancaire optionnelle (bientôt) — ou saisie manuelle, c'est toi qui choisis",
    ],
  },
  {
    nom: "Pro",
    prix: "9€",
    periode: "/mois",
    couleur: "#378ADD",
    couleurTexte: "white",
    badge: "Prix prévu",
    features: [
      "Tout le plan Gratuit, sans limite",
      "Factures illimitées + envoi par email au client",
      "Devis et conversion en facture",
      "Carnet de contacts clients",
      "Hector, ton compagnon financier (assistant IA)",
      "Scan automatique de tes factures de frais",
      "Export complet de tes données (RGPD)",
    ],
  },
];

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];



function HectorTete({ size = 32 }) {
  // Tête d'Hector pour l'assistant. Fallback sur une icône si l'image n'est pas déposée.
  const [ok, setOk] = useState(true);
  if (ok) {
    return <img src="/hector-tete.png" alt="Hector" width={size} height={size}
      onError={() => setOk(false)}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flexShrink: 0 }} />;
  }
  return <i className="ti ti-message-circle-2" aria-hidden="true" style={{ fontSize: size * 0.7, color: "#5DCAA5" }} />;
}

function NiveauImage({ src, fallbackIcon, fallbackColor }) {
  const [ok, setOk] = useState(true);
  if (src && ok) {
    return <img src={src} alt="" onError={() => setOk(false)}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%", borderRadius: "50%", display: "block" }} />;
  }
  return <i className={`ti ${fallbackIcon}`} aria-hidden="true" style={{ fontSize: 18, color: fallbackColor }} />;
}

function HectorImage({ etat, size = 200, cover = false }) {
  // Affiche l'illustration IA si elle est présente dans /public, sinon une silhouette SVG de secours.
  const [imgOk, setImgOk] = useState(true);
  const src = etat?.img;
  if (src && imgOk) {
    return (
      <img src={src} alt={`Hector ${etat?.label || ""}`}
        onError={() => setImgOk(false)}
        style={cover
          ? { width: "100%", height: "100%", objectFit: "contain", objectPosition: "center center", display: "block" }
          : { width: size, height: size, objectFit: "contain", display: "block" }} />
    );
  }
  // Silhouette de secours (bull terrier couché stylisé)
  const c = etat?.couleur || "#5DCAA5";
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 200 160" role="img" aria-label={`Hector ${etat?.label || ""}`}>
      <ellipse cx="100" cy="140" rx="70" ry="10" fill="rgba(0,0,0,0.2)" />
      <ellipse cx="100" cy="110" rx="58" ry="32" fill="#EDE3D4" />
      <circle cx="52" cy="100" r="28" fill="#EDE3D4" />
      <path d="M38 78 q-6 -20 8 -26 q6 14 2 30 Z" fill="#1A1A1A" />
      <path d="M64 76 q4 -20 -8 -26 q-8 14 -2 32 Z" fill="#1A1A1A" />
      <ellipse cx="44" cy="108" rx="20" ry="22" fill="#1A1A1A" opacity="0.85" />
      <circle cx="40" cy="98" r="3.5" fill="#1A1A1A" />
      <circle cx="58" cy="100" r="3.5" fill="#1A1A1A" />
      <ellipse cx="34" cy="112" rx="6" ry="4" fill="#2A2A2A" />
      <path d="M150 105 q16 -3 13 14" stroke="#EDE3D4" stroke-width="9" fill="none" stroke-linecap="round" />
      <circle cx="100" cy="20" r="7" fill={c} opacity="0.5" />
      <circle cx="120" cy="28" r="3" fill={c} opacity="0.4" />
    </svg>
  );
}

function Logo({ size = 28, dark = false }) {
  // Logo = tête d'Hector (dominante) + texte "H€CTOR" en support.
  // size = hauteur de référence. La tête est plus grande pour avoir vraiment de la présence.
  const textColor = dark ? "white" : INK;
  const headSize = size * 1.4;  // la tête déborde au-dessus pour mieux remplir
  const textSize = size * 0.55;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.1, lineHeight: 1 }}>
      <img src="/hector-tete.png" alt="" height={headSize} width={headSize}
           style={{ height: headSize, width: headSize, objectFit: "contain", display: "block", flexShrink: 0, marginTop: -size * 0.2, marginBottom: -size * 0.2 }} />
      <span style={{ fontFamily: "Georgia, serif", fontSize: textSize, fontWeight: 700, color: textColor, letterSpacing: size * 0.01 }}>
        H€CTOR
      </span>
    </div>
  );
}

function LogoIcon({ size = 32 }) {
  return (
    <img src="/hector-tete.png" alt="H€CTOR" height={size} width={size}
         style={{ height: size, width: size, objectFit: "contain", display: "block" }} />
  );
}

// Badge de confiance d'un calcul. Répond à la vraie question de l'utilisateur :
// "est-ce que je peux faire confiance à cette réponse ?"
//   certain  → données complètes ET moteur validé par expert (verifie:true)
//   fiable   → données complètes, arithmétique juste, moteur en cours de validation
//   estimation → projection (rythme, date probable, simulation)
//   manquant → une donnée manque pour conclure
function BadgeConfiance({ niveau }) {
  const [ouvert, setOuvert] = useState(false);
  const conf = {
    certain:    { dot: "🟢", label: "Calcul certain",        c: "#5DCAA5", bg: "rgba(93,202,165,0.1)",  bd: "rgba(93,202,165,0.3)",  expl: "Tes données sont complètes et le moteur réglementaire a été validé sur ce type de calcul." },
    fiable:     { dot: "🟠", label: "Calcul fiable",          c: "#FAC775", bg: "rgba(250,199,117,0.1)", bd: "rgba(250,199,117,0.32)", expl: "J'ai utilisé tes données déclarées et les règles officielles actuellement intégrées dans mon moteur. Ce calcul est fiable, mais le moteur réglementaire est encore en cours de validation sur des dossiers réels." },
    estimation: { dot: "🔵", label: "Estimation",             c: "#7FB8F0", bg: "rgba(55,138,221,0.1)",  bd: "rgba(55,138,221,0.3)",  expl: "C'est une projection (ton rythme, ta date probable d'atteinte des 507h, une simulation). Par nature, ça dépend de ce qui va se passer." },
    manquant:   { dot: "🔴", label: "Informations manquantes", c: "#E88", bg: "rgba(238,136,136,0.1)", bd: "rgba(238,136,136,0.3)", expl: "Il me manque une donnée pour conclure avec certitude (par exemple ta date anniversaire)." },
  }[niveau] || null;
  if (!conf) return null;
  return (
    <span style={{ display: "inline-block" }}>
      <button type="button" onClick={() => setOuvert(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: conf.bg, border: `1px solid ${conf.bd}`, color: conf.c, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        {conf.dot} {conf.label}
      </button>
      {ouvert && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#9FBDDD", lineHeight: 1.5, background: conf.bg, border: `1px solid ${conf.bd}`, borderRadius: 8, padding: "8px 11px" }}>
          {conf.expl}
        </div>
      )}
    </span>
  );
}

function AppInner() {
  const [token, setToken] = useState(() => safeStorage.getItem("token"));
  // ─── PWA : aide à l'installation sur l'écran d'accueil ───
  const [pwaPrompt, setPwaPrompt] = useState(null);     // event Android "beforeinstallprompt"
  const [showInstallHelp, setShowInstallHelp] = useState(false); // affiche les instructions iOS
  const [pwaDismissed, setPwaDismissed] = useState(() => safeStorage.getItem("pwa_dismissed") === "1");
  const [legalPage, setLegalPage] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  // Choix de statut sur la landing (avant connexion) : null = écran de choix,
  // "auto_entrepreneur" = landing AE, "intermittent" = écran "bientôt dispo".
  // On retient le choix entre visites pour ne pas le redemander à chaque fois.
  const [landingStatut, setLandingStatut] = useState(() => safeStorage.getItem("landingStatut") || null);
  const chooseLandingStatut = (s) => { safeStorage.setItem("landingStatut", s); setLandingStatut(s); };
  const resetLandingStatut = () => { safeStorage.removeItem("landingStatut"); setLandingStatut(null); };
  // Fake door intermittent : on collecte les emails intéressés pour mesurer la demande.
  const [intermittentEmail, setIntermittentEmail] = useState("");
  const [intermittentSent, setIntermittentSent] = useState(false);
  const [intermittentSending, setIntermittentSending] = useState(false);
  // Modale "à venir" déclenchée par les boutons de la landing intermittent
  const [showIntermittentAvenir, setShowIntermittentAvenir] = useState(false);
  // Cockpit intermittent (Brique 5) : état calculé renvoyé par /intermittent/cockpit
  const [interCockpit, setInterCockpit] = useState(null);
  const [interCockpitLoading, setInterCockpitLoading] = useState(false);
  const [interCockpitError, setInterCockpitError] = useState("");
  // Brique 5.2 : saisie et liste des activités intermittent
  const [interActivites, setInterActivites] = useState([]);
  const [interShowAdd, setInterShowAdd] = useState(true);
  const [interSaving, setInterSaving] = useState(false);
  const [interForm, setInterForm] = useState({ date: "", type_activite: "cachet_isole", nombre: "", employeur: "", estime: false });
  // Report des heures déjà faites (saisie de départ)
  const [reportForm, setReportForm] = useState({ unite: "heures", nombre: "", periode: "annee" });
  const [reportSaving, setReportSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // Édition d'une activité existante
  const [interEditId, setInterEditId] = useState(null);
  const [interEditForm, setInterEditForm] = useState({ date: "", type_activite: "cachet_isole", nombre: "", employeur: "", estime: false });
  const [interEditSaving, setInterEditSaving] = useState(false);
  // Brique 5.4 : "Parle à Hector" — simulation de contrat
  const [simForm, setSimForm] = useState({ type_activite: "cachet_isole", nombre: "" });
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  // Brique 5.5 : date anniversaire (date de renouvellement des droits)
  const [anniversaireInput, setAnniversaireInput] = useState("");
  const [anniversaireSaving, setAnniversaireSaving] = useState(false);
  const [anniversaireEdit, setAnniversaireEdit] = useState(false);
  // ─── Scan d'AEM (Coffre à AEM) — OCR Claude Vision ───
  const [aemUploading, setAemUploading] = useState(false);
  const [aemExtrait, setAemExtrait] = useState(null); // résultat lu, en attente de validation
  const [aemQueue, setAemQueue] = useState([]); // AEM restantes à valider (si le doc en contenait plusieurs)
  const [aemTotal, setAemTotal] = useState(0); // nb total d'AEM détectées dans le document (pour l'indicateur "1/3")
  const [aemSaving, setAemSaving] = useState(false);
  const [aemError, setAemError] = useState("");
  // Import attestation ARE (date anniversaire + montant journalier lus, jamais calculés).
  const [areUploading, setAreUploading] = useState(false);
  const [areExtrait, setAreExtrait] = useState(null); // résultat lu, en attente de validation
  const [areSaving, setAreSaving] = useState(false);
  const [areError, setAreError] = useState("");
  // Ligne d'activité dont on affiche le détail "AEM scannée" (id ou null)
  const [aemDetailId, setAemDetailId] = useState(null);
  // Sous-onglet de la page "Mes documents" : "revenus" | "aem" | "actualisations"
  const [docTab, setDocTab] = useState("revenus");
  // ─── Vie d'Hector sur le cockpit (micro-interactions) ───
  const [hectorPop, setHectorPop] = useState(false); // déclenche l'animation pop quand on ajoute
  // ─── Centre de calcul conversationnel ───
  const [calcConvo, setCalcConvo] = useState([]); // fil de la conversation : {role, text, questions?}
  const [calcThinking, setCalcThinking] = useState(false); // Hector "réfléchit"
  // ─── Visionneuse de document AEM (overlay, sans quitter l'app) ───
  const [docViewer, setDocViewer] = useState(null); // { url, filename, loading } | null
  // ─── Champ "Que se passe-t-il si…" (saisie libre) ───
  const [etSiInput, setEtSiInput] = useState("");
  const [etSiLoading, setEtSiLoading] = useState(false);
  const [celebPalier, setCelebPalier] = useState(null); // palier fraîchement franchi (objet) ou null
  const prevPalierRef = useRef(null); // mémorise le palier précédent pour détecter un franchissement
  // ─── Module ACTUALISATION France Travail ───
  // Mois ciblé par l'actualisation = le mois civil précédent (on déclare le mois écoulé).
  // Sous-état du mode recopie guidé (null = écran de préparation, sinon n° d'étape 0..3).
  const [actuGuideStep, setActuGuideStep] = useState(null);
  // Cases cochées dans l'étape "employeurs" du mode recopie (par index).
  const [actuEmpChecked, setActuEmpChecked] = useState({});
  // Petit feedback "copié" sur les boutons du mode recopie.
  const [actuCopied, setActuCopied] = useState("");
  // Historique des actualisations marquées comme faites (persistées localement pour la V1).
  const [actuHistorique, setActuHistorique] = useState(() => {
    try { return JSON.parse(safeStorage.getItem("actuHistorique") || "[]"); } catch { return []; }
  });
  // Navigation interne du cockpit intermittent (sidebar)
  const [interNav, setInterNav] = useState("cockpit");
  const [interMenuOpen, setInterMenuOpen] = useState(false);
  // Chat Hector intermittent (assistant IA spécialisé régime)
  const [interChat, setInterChat] = useState([]);
  const [interChatInput, setInterChatInput] = useState("");
  const [interChatLoading, setInterChatLoading] = useState(false);
  // Brique 5.3 : les 6 paliers d'Hector intermittent (frise visuelle, mêmes codes que le cockpit AE)
  const PALIERS_INTERMITTENT = [
    { etat: "chiot",    seuil: 0,   nom: "Chiot",    court: "0h",    sous: "Les premiers pas",        img: "/hector-1.png" },
    { etat: "apprenti", seuil: 100, nom: "Apprenti", court: "100h",  sous: "Ça prend forme",          img: "/hector-2.png" },
    { etat: "jeune",    seuil: 200, nom: "Jeune",    court: "200h",  sous: "Il prend de l'élan",      img: "/hector-3.png" },
    { etat: "confirme", seuil: 350, nom: "Confirmé", court: "350h",  sous: "Il assure",               img: "/hector-4.png" },
    { etat: "pro",      seuil: 450, nom: "Pro",      court: "450h",  sous: "Presque au but",          img: "/hector-5.png" },
    { etat: "gardien",  seuil: 507, nom: "Gardien",  court: "507h",  sous: "Objectif atteint",        img: "/hector-6.png" },
  ];
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState(""); // "", "loading", "sent"
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset_token"));
  const [resetPassword1, setResetPassword1] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [resetStatus, setResetStatus] = useState(""); // "", "loading", "success", "error"
  const [resetMessage, setResetMessage] = useState("");
  const [verifyToken] = useState(() => new URLSearchParams(window.location.search).get("verify_token"));
  const [verifyStatus, setVerifyStatus] = useState(""); // "", "loading", "success", "error"
  // Connexion bancaire (Powens) : callback de retour de la webview + état du solde.
  const [bankCallbackConnId] = useState(() => {
    const inCallback = window.location.pathname.includes("bank-callback");
    if (!inCallback) return null;
    return new URLSearchParams(window.location.search).get("connection_id");
  });
  const [bankConnected, setBankConnected] = useState(false);
  const [bankSolde, setBankSolde] = useState(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSyncing, setBankSyncing] = useState(false);
  const [bankCardOpen, setBankCardOpen] = useState(false); // carte connexion bancaire repliée par défaut (accordéon)
  const [emailVerified, setEmailVerified] = useState(true);
  const [resendVerifStatus, setResendVerifStatus] = useState(""); // "", "sending", "sent"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nav, setNav] = useState(() => safeStorage.getItem("nav") || "dashboard");
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ statut: "auto_entrepreneur", activite: "services", periodicite: "mensuelle", acre: false, versement_liberatoire: false });
  const [estimateData, setEstimateData] = useState(null);
  const [incomeList, setIncomeList] = useState([]);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ date: "", amount: "", description: "" });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [factureExtraite, setFactureExtraite] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ nom: "", email: "", siret: "", adresse: "" });

  async function loadContacts() {
    setContactsLoading(true);
    try {
      const list = await apiFetch("/contacts");
      setContacts(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setContactsLoading(false);
    }
  }

  async function handleAddContact() {
    if (!contactForm.nom) return;
    try {
      await apiFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({
          nom: contactForm.nom,
          email: contactForm.email || null,
          siret: contactForm.siret || null,
          adresse: contactForm.adresse || null,
        }),
      });
      setContactForm({ nom: "", email: "", siret: "", adresse: "" });
      setShowAddContact(false);
      await loadContacts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteContact(id) {
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      await loadContacts();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (nav === "contacts" && token) loadContacts();
  }, [nav, token]);

  // ─── PWA : capte l'événement Android qui permet l'installation en 1 clic ───
  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();          // on garde la main pour déclencher au bon moment
      setPwaPrompt(e);             // Android : on pourra proposer un vrai bouton "Installer"
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // Clic sur "Installer" : Android déclenche l'invite native ; iOS affiche les instructions.
  async function handleInstallClick() {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      try { await pwaPrompt.userChoice; } catch {}
      setPwaPrompt(null);
      return;
    }
    if (isIOSDevice()) {
      setShowInstallHelp(true); // on déroule les étapes Safari
      return;
    }
    // Cas restant (desktop ou navigateur sans invite) : on montre l'aide générique.
    setShowInstallHelp(true);
  }
  function dismissPwa() {
    setPwaDismissed(true);
    setShowInstallHelp(false);
    safeStorage.setItem("pwa_dismissed", "1");
  }
  const [invoicesList, setInvoicesList] = useState([]);
  const [invoicesSummary, setInvoicesSummary] = useState(null);
  const [expensesList, setExpensesList] = useState([]);
  const [expensesSummary, setExpensesSummary] = useState(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [hectorMessages, setHectorMessages] = useState([]);
  const [onbPremierRevenu, setOnbPremierRevenu] = useState("");
  const [briefingOuvert, setBriefingOuvert] = useState(false);
  const [briefingVuAujourdhui, setBriefingVuAujourdhui] = useState(() => safeStorage.getItem("briefingVu") === new Date().toISOString().slice(0, 10));
  const [parlerMontant, setParlerMontant] = useState("");
  const [parlerType, setParlerType] = useState("achat");
  const [parlerVerdict, setParlerVerdict] = useState(null);
  const [parlerPourquoi, setParlerPourquoi] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: "", montant: "", categorie: "autre", description: "" });
  const [uploadingExpenseFile, setUploadingExpenseFile] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showNewFacture, setShowNewFacture] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [sendInvoiceStatus, setSendInvoiceStatus] = useState(""); // "", "sent", "error"
  const [sendInvoiceError, setSendInvoiceError] = useState("");
  const [sendInvoiceMessage, setSendInvoiceMessage] = useState("");

  // ─── Devis ───
  const [quotesList, setQuotesList] = useState([]);
  const [quotesSummary, setQuotesSummary] = useState(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({ client_nom: "", client_email: "", client_adresse: "", date_emission: "", date_validite: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
  const [viewingQuote, setViewingQuote] = useState(null);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sendQuoteStatus, setSendQuoteStatus] = useState("");
  const [sendQuoteError, setSendQuoteError] = useState("");
  const [sendQuoteMessage, setSendQuoteMessage] = useState("");
  const [convertingQuote, setConvertingQuote] = useState(false);

  const [onboardingSiretStatus, setOnboardingSiretStatus] = useState(""); // "", "loading", "success", "error"
  const [onboardingSiretMessage, setOnboardingSiretMessage] = useState("");
  const [onboardingNafCode, setOnboardingNafCode] = useState("");
  const [onboardingNafLabel, setOnboardingNafLabel] = useState("");
  const [onboardingSiretLater, setOnboardingSiretLater] = useState(false);
  // Onboarding 2 temps : "form" (3 questions) puis "result" (premier disponible affiché)
  const [onbStep, setOnbStep] = useState("statut");
  const [onbSolde, setOnbSolde] = useState("");
  const [onbTrainDeVie, setOnbTrainDeVie] = useState("");
  const [onbSiret, setOnbSiret] = useState("");
  const [onbSiretStatus, setOnbSiretStatus] = useState(""); // "", "loading", "success", "error"
  const [onbSiretMessage, setOnbSiretMessage] = useState("");
  const [onbSiretData, setOnbSiretData] = useState(null);

  async function handleOnboardingSiretLookup() {
    if (!profilSiret) return;
    setOnboardingSiretStatus("loading");
    setOnboardingSiretMessage("");
    try {
      const data = await apiFetch(`/siret/lookup?siret=${encodeURIComponent(profilSiret)}`);
      if (data.raison_sociale) setProfilEntreprise(data.raison_sociale);
      const adresseComplete = data.adresse
        ? `${data.adresse}${data.code_postal || data.commune ? ", " : ""}${data.code_postal || ""} ${data.commune || ""}`.trim()
        : "";
      if (adresseComplete) setProfilAdresse(adresseComplete);
      setOnboardingNafCode(data.code_ape || "");
      setOnboardingNafLabel(data.libelle_activite || "");
      await apiFetch("/profile/siret", {
        method: "POST",
        body: JSON.stringify({ siret: data.siret, raison_sociale: data.raison_sociale, adresse: adresseComplete || null }),
      });
      setOnboardingSiretStatus("success");
      setOnboardingSiretMessage(data.raison_sociale ? `${data.raison_sociale} — synchronisé avec votre profil` : "Établissement trouvé et synchronisé");
    } catch (err) {
      setOnboardingSiretStatus("error");
      setOnboardingSiretMessage(err.message);
    }
  }

  useEffect(() => {
    if (viewingInvoice && sendInvoiceStatus !== "sent") {
      setSendInvoiceMessage(
        `Bonjour ${viewingInvoice.client_nom || ""},\n\nVeuillez trouver ci-dessous le détail de la facture ${viewingInvoice.numero || ""}.\n\nCordialement,\n${profilPrenom || profilEntreprise || ""}`
      );
    }
  }, [viewingInvoice?.id]);
  const todayISO = new Date().toISOString().split("T")[0];
  const [factureForm, setFactureForm] = useState({ client_nom: "", client_email: "", client_adresse: "", date_emission: todayISO, date_echeance: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
  const [aiMessages, setAiMessages] = useState([{ role: "assistant", content: "Salut 👋 Qu'est-ce qu'on regarde aujourd'hui ?" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [devisCreating, setDevisCreating] = useState(null);
  const [devisCreated, setDevisCreated] = useState({});
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panique, setPanique] = useState({ solde: "", urssaf: "", impots: "0", cfe: "0", dettes: "0" });
  // Toast global "✓ Sauvegardé" qui apparaît brièvement après une modification réussie
  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimerRef = useRef(null);
  const showSavedToast = () => {
    setSavedToast(true);
    if (savedToastTimerRef.current) clearTimeout(savedToastTimerRef.current);
    savedToastTimerRef.current = setTimeout(() => setSavedToast(false), 2800);
  };
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [soldeSaveStatus, setSoldeSaveStatus] = useState(""); // "", "saving", "saved", "error"
  const [simCaLanding, setSimCaLanding] = useState("3000");
  const [simActLanding, setSimActLanding] = useState("0.212");
  // Simulateur cachets→heures de la landing intermittent
  const [simCachetsLanding, setSimCachetsLanding] = useState("8");
  const [simModeLanding, setSimModeLanding] = useState("cachets"); // "heures" ou "cachets" (1 cachet = 12h)
  const soldeMounted = useRef(false);
  const reserveMounted = useRef(false);
  const tmiMounted = useRef(false);
  const trainDeVieMounted = useRef(false);
  const [tmi, setTmi] = useState(() => safeStorage.getItem("tmi") || "0");
  const [simCa, setSimCa] = useState("");
  const [simActivite, setSimActivite] = useState("services");
  const [objectifAnnuel, setObjectifAnnuel] = useState(() => safeStorage.getItem("objectifAnnuel") || "");
  const [objectifMensuel, setObjectifMensuel] = useState(() => safeStorage.getItem("objectifMensuel") || "");
  const [objectifSaved, setObjectifSaved] = useState(false);
  const objectifMounted = useRef(false);
  const [objectifAnnuelSaved, setObjectifAnnuelSaved] = useState(false);
  const objectifAnnuelMounted = useRef(false);
  const [editingObjectifMensuel, setEditingObjectifMensuel] = useState(false);
  const [editingObjectifAnnuel, setEditingObjectifAnnuel] = useState(false);
  const [profilPrenom, setProfilPrenom] = useState(() => safeStorage.getItem("profilPrenom") || "");
  const [profilNom, setProfilNom] = useState(() => safeStorage.getItem("profilNom") || "");
  const [profilTelephone, setProfilTelephone] = useState(() => safeStorage.getItem("profilTelephone") || "");
  const [profilEntreprise, setProfilEntreprise] = useState(() => safeStorage.getItem("profilEntreprise") || "");
  const [profilSiret, setProfilSiret] = useState(() => safeStorage.getItem("profilSiret") || "");
  const [profilAdresse, setProfilAdresse] = useState(() => safeStorage.getItem("profilAdresse") || "");
  const [siretLookupStatus, setSiretLookupStatus] = useState(""); // "", "loading", "success", "error"
  const [siretLookupMessage, setSiretLookupMessage] = useState("");
  const [outilsOpen, setOutilsOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [facturerOpen, setFacturerOpen] = useState(false);
  const [montantCopie, setMontantCopie] = useState(false);
  const [caCopie, setCaCopie] = useState(false);
  const [declarationPeriode, setDeclarationPeriode] = useState("");
  const [declarationCa, setDeclarationCa] = useState("");
  const [declarationCotisations, setDeclarationCotisations] = useState("");
  const [editingDeclarationCa, setEditingDeclarationCa] = useState(false);
  const [editingDeclarationCotisations, setEditingDeclarationCotisations] = useState(false);
  const [historiqueDeclarations, setHistoriqueDeclarations] = useState(() => {
    try { return JSON.parse(safeStorage.getItem("historiqueDeclarations") || "[]"); } catch { return []; }
  });
  const [objectifSecurite, setObjectifSecurite] = useState(() => safeStorage.getItem("objectifSecurite") || "3000");
  const [depensesMensuelles, setDepensesMensuelles] = useState(() => safeStorage.getItem("depensesMensuelles") || "");
  const [autresRevenus, setAutresRevenus] = useState(() => safeStorage.getItem("autresRevenus") || "");
  const [inclureAutresRevenus, setInclureAutresRevenus] = useState(() => safeStorage.getItem("inclureAutresRevenus") === "true");
  const [achatMontant, setAchatMontant] = useState("");
  const [tarifMontant, setTarifMontant] = useState("");
  const [tarifUnite, setTarifUnite] = useState("heure");
  const [heuresParJour, setHeuresParJourCoach] = useState("7");
  const [heuresParPrestation, setHeuresParPrestation] = useState("3");
  const [joursParSemaineCoach, setJoursParSemaineCoach] = useState("5");
  const [objectifHoraire, setObjectifHoraire] = useState("60");
  const [haussePct, setHaussePct] = useState("10");
  const [simFiscalCa, setSimFiscalCa] = useState("4000");
  const [simFiscalPeriode, setSimFiscalPeriode] = useState("mensuel");
  const [showRetraitTout, setShowRetraitTout] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 900);

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= 900); }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const googleButtonRef = useRef(null);
  const googleButtonRefInter = useRef(null); // bouton Google sur la landing intermittent

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function apiFetch(path, options = {}) {
    // Timeout de sécurité : si le backend ne répond pas (ex : serveur qui se réveille
    // d'une mise en veille), on coupe au bout de 45s au lieu d'attendre indéfiniment.
    // 45s laisse le temps à Railway de se réveiller, sans bloquer l'utilisateur sans fin.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: ctrl.signal,
        headers: {
          ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
          ...(token ? authHeaders() : {}),
          ...options.headers,
        },
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") throw new Error("Le serveur met du temps à répondre. Vérifie ta connexion et réessaie.");
      throw new Error("Connexion impossible. Vérifie ta connexion internet et réessaie.");
    }
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const isObj = body.detail && typeof body.detail === "object";
      const err = new Error(isObj ? (body.detail.message || "Erreur") : (body.detail || `Erreur (code ${res.status})`));
      if (isObj) err.detail = body.detail;
      throw err;
    }
    return res.json();
  }

  async function loadEverything() {
    setLoading(true);
    setError("");
    try {
      const p = await apiFetch("/profile");
      setProfile(p);
      if (p.prenom != null) setProfilPrenom(p.prenom);
      if (p.nom != null) setProfilNom(p.nom);
      if (p.telephone != null) setProfilTelephone(p.telephone);
      if (p.entreprise != null) setProfilEntreprise(p.entreprise);
      if (p.depenses_mensuelles != null) setDepensesMensuelles(String(p.depenses_mensuelles));
      if (p.solde_bancaire != null) setPanique(prev => ({ ...prev, solde: String(p.solde_bancaire) }));
      if (p.email_verified != null) setEmailVerified(p.email_verified);
      if (p.siret != null) setProfilSiret(p.siret);
      if (p.adresse != null) setProfilAdresse(p.adresse);
      if (p.reserve_securite != null) setObjectifSecurite(String(p.reserve_securite));
      if (p.tmi != null) setTmi(p.tmi);
      if (p.onboarding_complete) {
        const [est, inc, expSummary] = await Promise.all([apiFetch("/estimate"), apiFetch("/income"), apiFetch("/expenses/summary")]);
        setEstimateData(est);
        setIncomeList(inc);
        setExpensesSummary(expSummary);
        // État de la connexion bancaire (Powens) — best effort, n'interrompt rien.
        loadBankStatus();
        // Ouvrir le walkthrough au premier login uniquement
        if (!safeStorage.getItem("hector_walkthrough_done")) {
          setShowWalkthrough(true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Efface les données locales propres à un compte (SIRET, adresse, objectifs...) pour éviter
  // qu'elles ne "fuitent" d'un compte à un autre sur le même navigateur — appelée à CHAQUE
  // changement de session (connexion, inscription, déconnexion), pas seulement à la déconnexion.
  function clearLocalAccountData() {
    ["profilPrenom", "profilNom", "profilTelephone", "profilEntreprise", "profilSiret", "profilAdresse",
     "objectifAnnuel", "objectifMensuel", "objectifSecurite", "depensesMensuelles", "tmi",
     "historiqueDeclarations", "actuHistorique", "landingStatut", "hector_walkthrough_done", "nav"].forEach(key => safeStorage.removeItem(key));
    setActuHistorique([]);
    setProfilPrenom("");
    setProfilNom("");
    setProfilTelephone("");
    setProfilEntreprise("");
    setProfilSiret("");
    setProfilAdresse("");
    setObjectifAnnuel("");
    setObjectifMensuel("");
    setObjectifSecurite("3000");
    setDepensesMensuelles("");
    setTmi("0");
    setHistoriqueDeclarations([]);
    setPanique(prev => ({ ...prev, solde: "" }));
    setSoldeSaveStatus("");
    soldeMounted.current = false;
    reserveMounted.current = false;
    tmiMounted.current = false;
  }

  function handleGoogleCredential(response) {
    setError("");
    setLoading(true);
    apiFetch("/auth/google", { method: "POST", body: JSON.stringify({ credential: response.credential }) })
      .then(data => { clearLocalAccountData(); safeStorage.setItem("token", data.token); setToken(data.token); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { safeStorage.setItem("objectifAnnuel", objectifAnnuel); }, [objectifAnnuel]);
  useEffect(() => {
    if (!objectifAnnuelMounted.current) { objectifAnnuelMounted.current = true; return; }
    setObjectifAnnuelSaved(true);
    const t = setTimeout(() => setObjectifAnnuelSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifAnnuel]);
  useEffect(() => { safeStorage.setItem("objectifMensuel", objectifMensuel); }, [objectifMensuel]);
  useEffect(() => {
    if (!objectifMounted.current) { objectifMounted.current = true; return; }
    setObjectifSaved(true);
    const t = setTimeout(() => setObjectifSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifMensuel]);
  useEffect(() => { safeStorage.setItem("profilPrenom", profilPrenom); }, [profilPrenom]);
  useEffect(() => { safeStorage.setItem("profilNom", profilNom); }, [profilNom]);
  useEffect(() => { safeStorage.setItem("profilTelephone", profilTelephone); }, [profilTelephone]);
  useEffect(() => { safeStorage.setItem("profilEntreprise", profilEntreprise); }, [profilEntreprise]);
  useEffect(() => { safeStorage.setItem("profilSiret", profilSiret); }, [profilSiret]);
  useEffect(() => { safeStorage.setItem("profilAdresse", profilAdresse); }, [profilAdresse]);
  useEffect(() => { safeStorage.setItem("objectifSecurite", objectifSecurite); }, [objectifSecurite]);
  useEffect(() => { safeStorage.setItem("depensesMensuelles", depensesMensuelles); }, [depensesMensuelles]);
  useEffect(() => { safeStorage.setItem("autresRevenus", autresRevenus); }, [autresRevenus]);
  useEffect(() => { safeStorage.setItem("inclureAutresRevenus", String(inclureAutresRevenus)); }, [inclureAutresRevenus]);
  useEffect(() => { safeStorage.setItem("tmi", tmi); }, [tmi]);
  useEffect(() => { safeStorage.setItem("nav", nav); }, [nav]);

  // Message Hector si solde périmé (calcul interne, déclenché une fois par session)
  useEffect(() => {
    if (nav !== "dashboard") return;
    const updatedAt = safeStorage.getItem("soldeUpdatedAt") || "";
    if (!updatedAt || panique.solde === "") return;
    const jours = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (jours >= 7 && !hectorMessagesSentRef.current.soldePerime) {
      hectorMessagesSentRef.current.soldePerime = true;
      addHectorMessage("Ça fait plus de 7 jours que je n'ai pas vu ton vrai solde. Mes calculs sont moins précis là. 10 secondes pour me mettre à jour ?", "#FAC775");
    }
  }, [nav, panique.solde]);

  // ─── STREAK : mise à jour une fois par jour à l'ouverture ───
  useEffect(() => {
    if (!token) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastDay = safeStorage.getItem("streakLastDay") || "";
    if (lastDay === today) return; // déjà compté aujourd'hui
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const current = parseInt(safeStorage.getItem("streakCount") || "0", 10);
    let newStreak;
    if (lastDay === yesterday) newStreak = current + 1; // continuité
    else if (lastDay === "") newStreak = 1; // première fois
    else newStreak = 1; // streak cassé, on repart à 1
    safeStorage.setItem("streakCount", String(newStreak));
    safeStorage.setItem("streakLastDay", today);
    // Célébration si on vient de franchir un palier
    const paliers = [7, 14, 30, 90, 180, 365];
    const palierMots = {
      7: "7 jours d'affilée 🛏️ Hector dort maintenant paisiblement dans son panier. Tu prends soin de ta tranquillité.",
      14: "14 jours ensemble 🌱 Hector grandit grâce à toi. Continue, vous formez une belle équipe.",
      30: "30 jours d'affilée 🧸 Hector a reçu un jouet ! Il est heureux de ce rituel avec toi.",
      90: "90 jours 🏡 Hector a maintenant une belle niche, confortable et sûre. Il se sent chez lui.",
      180: "180 jours 🦴 Hector est devenu adulte, serein et solide. Vous êtes une vraie équipe.",
      365: "365 jours 👑 Hector est le gardien légendaire de ta tranquillité. Bravo pour cette année.",
    };
    if (paliers.includes(newStreak) && palierMots[newStreak]) {
      setTimeout(() => addHectorMessage(palierMots[newStreak], "#FAC775"), 1200);
    }
  }, [token]);

  const hectorMessagesSentRef = useRef({});

  useEffect(() => {
    if (token) loadEverything();
  }, [token]);

  useEffect(() => {
    if (!soldeMounted.current) { soldeMounted.current = true; return; }
    if (!token) return;
    setSoldeSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await apiFetch("/profile/solde", {
          method: "POST",
          body: JSON.stringify({ solde: panique.solde !== "" ? parseFloat(panique.solde) : null }),
        });
        setSoldeSaveStatus("saved");
        showSavedToast();
      } catch (err) {
        setSoldeSaveStatus("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [panique.solde, token]);

  useEffect(() => {
    if (!reserveMounted.current) { reserveMounted.current = true; return; }
    if (!token) return;
    const t = setTimeout(async () => {
      try {
        await apiFetch("/profile/settings", {
          method: "POST",
          body: JSON.stringify({ reserve_securite: objectifSecurite !== "" ? parseFloat(objectifSecurite) : null }),
        });
        showSavedToast();
      } catch (err) {
        // best-effort, ne bloque pas l'usage si la sauvegarde echoue ponctuellement
      }
    }, 600);
    return () => clearTimeout(t);
  }, [objectifSecurite, token]);

  useEffect(() => {
    if (!trainDeVieMounted.current) { trainDeVieMounted.current = true; return; }
    if (!token) return;
    const t = setTimeout(async () => {
      try {
        await apiFetch("/profile/settings", {
          method: "POST",
          body: JSON.stringify({ depenses_mensuelles: depensesMensuelles !== "" ? parseFloat(depensesMensuelles) : null }),
        });
        showSavedToast();
      } catch (err) {
        // best-effort
      }
    }, 600);
    return () => clearTimeout(t);
  }, [depensesMensuelles, token]);

  useEffect(() => {
    if (!tmiMounted.current) { tmiMounted.current = true; return; }
    if (!token) return;
    apiFetch("/profile/settings", {
      method: "POST",
      body: JSON.stringify({ tmi }),
    }).then(() => showSavedToast()).catch(() => {});
  }, [tmi, token]);

  useEffect(() => {
    if (estimateData && estimateData.disponible !== false) {
      const urssafCourante = estimateData.montant_a_provisionner || 0;
      const urssafPrecedente = estimateData.periode_precedente?.jours_restants > 0 ? Math.round(estimateData.ca_periode_precedente * (estimateData.taux_global_pct / 100) * 100) / 100 : 0;
      setPanique(p => ({ ...p, urssaf: String(Math.round((urssafCourante + urssafPrecedente) * 100) / 100) }));
    }
  }, [estimateData]);

  useEffect(() => {
    if (token) return;
    if (!googleButtonRef.current && !googleButtonRefInter.current) return;
    function renderButton() {
      if (window.google) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        // Une seule landing est affichée à la fois : on remplit la ref présente dans le DOM.
        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 360, text: "continue_with" });
        }
        if (googleButtonRefInter.current) {
          window.google.accounts.id.renderButton(googleButtonRefInter.current, { theme: "outline", size: "large", width: 360, text: "continue_with" });
        }
      } else {
        setTimeout(renderButton, 200);
      }
    }
    renderButton();
  }, [token, authMode, landingStatut]);

  async function handleAuth(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch(`/auth/${authMode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      clearLocalAccountData();
      safeStorage.setItem("token", data.token);
      setToken(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotStatus("loading");
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStatus("sent");
    } catch (err) {
      // Meme en cas d'erreur reseau, on affiche le meme message generique
      // pour ne jamais reveler si un compte existe ou non avec cet email.
      setForgotStatus("sent");
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetMessage("");
    if (resetPassword1.length < 8) {
      setResetStatus("error");
      setResetMessage("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (resetPassword1 !== resetPassword2) {
      setResetStatus("error");
      setResetMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setResetStatus("loading");
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, new_password: resetPassword1 }),
      });
      setResetStatus("success");
    } catch (err) {
      setResetStatus("error");
      setResetMessage(err.message);
    }
  }

  useEffect(() => {
    if (!verifyToken) return;
    setVerifyStatus("loading");
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(verifyToken)}`)
      .then(() => setVerifyStatus("success"))
      .catch(err => { setVerifyStatus("error"); setResetMessage(err.message); });
  }, [verifyToken]);

  // ── Connexion bancaire (Powens) ──
  // Démarre la connexion : récupère l'URL de la webview Powens et y redirige.
  async function handleBankConnect() {
    setBankLoading(true);
    try {
      const data = await apiFetch("/bank/connect", { method: "POST" });
      if (data && data.webview_url) {
        window.location.href = data.webview_url;
      } else {
        addHectorMessage("La connexion bancaire n'est pas encore disponible.", "#F0C36D");
        setBankLoading(false);
      }
    } catch (err) {
      addHectorMessage(err.message || "Connexion bancaire indisponible pour le moment.", "#F0C36D");
      setBankLoading(false);
    }
  }

  // Récupère l'état de la connexion + le solde synchronisé.
  async function loadBankStatus() {
    try {
      const data = await apiFetch("/bank/balance");
      setBankConnected(!!(data && data.connected));
      if (data && data.solde != null) setBankSolde(data.solde);
    } catch {
      // silencieux : pas de banque reliée ou backend pas encore prêt
    }
  }

  // Débranche la banque (retour à la saisie manuelle).
  async function handleBankDisconnect() {
    setBankLoading(true);
    try {
      await apiFetch("/bank/disconnect", { method: "POST" });
      setBankConnected(false);
      setBankSolde(null);
      addHectorMessage("Banque débranchée. Tu peux saisir ton solde à la main quand tu veux.", "#5DCAA5");
    } catch (err) {
      addHectorMessage(err.message || "Impossible de débrancher pour le moment.", "#F0C36D");
    } finally {
      setBankLoading(false);
    }
  }

  // Traite le retour de la webview Powens (/bank-callback?connection_id=...).
  useEffect(() => {
    if (!bankCallbackConnId) return;
    if (!token) return; // il faut être authentifié pour enregistrer la connexion
    setBankSyncing(true);
    apiFetch("/bank/callback", {
      method: "POST",
      body: JSON.stringify({ connection_id: parseInt(bankCallbackConnId, 10) }),
    })
      .then(data => {
        setBankConnected(true);
        if (data && data.solde != null) setBankSolde(data.solde);
      })
      .catch(() => {})
      .finally(() => {
        // Nettoie l'URL (retire /bank-callback et les paramètres) et revient à l'app.
        window.history.replaceState({}, "", "/");
        setBankSyncing(false);
      });
  }, [bankCallbackConnId, token]);

  async function handleResendVerification() {
    setResendVerifStatus("sending");
    try {
      await apiFetch("/auth/send-verification", { method: "POST" });
      setResendVerifStatus("sent");
    } catch (err) {
      setError(err.message);
      setResendVerifStatus("");
    }
  }

  function handleLogout() {
    safeStorage.removeItem("token");
    clearLocalAccountData();
    setToken(null);
    setProfile(null);
    setEstimateData(null);
    setIncomeList([]);
    setMobileMenuOpen(false);
    setNav("dashboard");
  }

  const [exportingData, setExportingData] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleExportData() {
    setExportingData(true);
    try {
      const data = await apiFetch("/account/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hector-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingData(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "SUPPRIMER") return;
    setDeletingAccount(true);
    try {
      await apiFetch("/account", { method: "DELETE" });
      safeStorage.clear();
      setToken(null);
      setProfile(null);
      setEstimateData(null);
      setIncomeList([]);
      setMobileMenuOpen(false);
      setNav("dashboard");
    } catch (err) {
      setError(err.message);
      setDeletingAccount(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/profile", { method: "POST", body: JSON.stringify(profileForm) });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Lookup SIRET pendant l'onboarding (optionnel — pré-remplit la raison sociale).
  async function handleOnbLookupSiret() {
    const siretClean = (onbSiret || "").replace(/\s/g, "");
    if (!siretClean) return;
    setOnbSiretStatus("loading");
    setOnbSiretMessage("");
    setOnbSiretData(null);
    try {
      const data = await apiFetch(`/siret/lookup?siret=${encodeURIComponent(siretClean)}`);
      setOnbSiretData(data);
      setOnbSiretStatus("success");
      setOnbSiretMessage(data.raison_sociale ? `✓ Trouvé : ${data.raison_sociale}` : "Établissement trouvé");
    } catch (err) {
      setOnbSiretStatus("error");
      setOnbSiretMessage(err.message || "SIRET introuvable");
    }
  }

  // Onboarding minimal : enregistre activité + périodicité + solde, puis affiche le premier
  // résultat AVANT de basculer sur le Cockpit. C'est l'étape qui décide de l'activation.
  async function handleOnboardingComplete(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Profil (statut auto_entrepreneur par défaut, ACRE/libératoire à false — affinables plus tard)
      const trainVal = onbTrainDeVie !== "" ? parseFloat(onbTrainDeVie) : null;
      await apiFetch("/profile", { method: "POST", body: JSON.stringify({ ...profileForm, depenses_mensuelles: trainVal }) });
      if (trainVal != null) setDepensesMensuelles(String(trainVal));
      // 2. Solde saisi pendant l'onboarding
      const soldeVal = onbSolde !== "" ? parseFloat(onbSolde) : null;
      if (soldeVal != null) {
        await apiFetch("/profile/solde", { method: "POST", body: JSON.stringify({ solde: soldeVal }) });
        setPanique(prev => ({ ...prev, solde: String(soldeVal) }));
        safeStorage.setItem("soldeUpdatedAt", new Date().toISOString());
      }
      // 2bis. SIRET saisi pendant l'onboarding (si validé via lookup INSEE)
      if (onbSiretData && onbSiretData.siret) {
        try {
          await apiFetch("/profile/siret", {
            method: "POST",
            body: JSON.stringify({ siret: onbSiretData.siret, raison_sociale: onbSiretData.raison_sociale }),
          });
        } catch {}
      }
      // 3. Passer à l'étape aha moment (premier revenu) avant le cockpit
      setOnbStep("aha");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Quitte l'onboarding vers le Cockpit (recharge tout : onboarding_complete passe à true côté UI)
  async function handleEnterCockpit() {
    setLoading(true);
    try {
      await loadEverything();
      setNav("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Brique 4b : choisir le statut pendant l'onboarding ───
  async function handleOnboardingStatut(statut, tentative = 1) {
    if (statut === "auto_entrepreneur") {
      // Flux auto-entrepreneur classique : on passe au formulaire d'onboarding habituel.
      setProfileForm({ ...profileForm, statut: "auto_entrepreneur" });
      setOnbStep("form");
      return;
    }
    // Intermittent : on enregistre le statut + on marque l'onboarding comme fait,
    // puis on file direct au cockpit intermittent (qui a son propre flux d'entrée).
    setLoading(true);
    try {
      await apiFetch("/profile/statut", { method: "POST", body: JSON.stringify({ statut: "intermittent" }) });
      await apiFetch("/profile/complete-onboarding", { method: "POST" });
      await loadEverything();
      // IMPORTANT : on purge landingStatut dès le succès. Sinon l'écran de transition
      // "Je prépare ton espace" reste affiché tant que ce flag existe, et seul un
      // rafraîchissement manuel débloque. On le retire avant de naviguer.
      resetLandingStatut();
      setOnbStep("done");
      setNav("dashboard");
      // Nouvelle inscription intermittent → on lance la visite guidée.
      // On purge le flag pour qu'un nouveau compte la voie toujours, même si
      // ce navigateur en avait déjà vu une (ex : un compte AE précédent).
      safeStorage.removeItem("hector_walkthrough_done");
      setShowWalkthrough(true);
    } catch (err) {
      // Échec (réseau, backend qui se réveille…) : on réessaie TOUT SEUL jusqu'à 3 fois,
      // avec une pause grandissante. L'utilisateur n'a rien à faire — surtout pas vider un cache.
      if (tentative < 3) {
        setLoading(false);
        await new Promise(r => setTimeout(r, tentative * 1500));
        return handleOnboardingStatut(statut, tentative + 1);
      }
      // Après 3 essais ratés : là seulement on montre l'erreur + le bouton Réessayer.
      setError(err.message);
      landingStatutApplied.current = false;
    } finally {
      setLoading(false);
    }
  }

  // Si l'utilisateur a déjà choisi son statut sur la landing (avant inscription),
  // on applique ce choix automatiquement à l'onboarding au lieu de le redemander.
  const landingStatutApplied = useRef(false);
  useEffect(() => {
    if (landingStatutApplied.current) return;
    if (token && profile && !profile.onboarding_complete && onbStep === "statut" && landingStatut) {
      landingStatutApplied.current = true;
      handleOnboardingStatut(landingStatut);
    }
  }, [token, profile, onbStep, landingStatut]);

  // Ceinture de sécurité : si l'onboarding est déjà terminé mais qu'un landingStatut
  // traîne encore (state ou localStorage), on le purge pour ne JAMAIS rester bloqué
  // sur l'écran "Je prépare ton espace". Un rafraîchissement ne doit pas être nécessaire.
  useEffect(() => {
    if (profile && profile.onboarding_complete && landingStatut) {
      resetLandingStatut();
    }
  }, [profile, landingStatut]);

  async function handleLookupSiret() {
    if (!profilSiret) return;
    setSiretLookupStatus("loading");
    setSiretLookupMessage("");
    try {
      const data = await apiFetch(`/siret/lookup?siret=${encodeURIComponent(profilSiret)}`);
      if (data.raison_sociale) setProfilEntreprise(data.raison_sociale);
      await apiFetch("/profile/siret", {
        method: "POST",
        body: JSON.stringify({ siret: data.siret, raison_sociale: data.raison_sociale }),
      });
      setSiretLookupStatus("success");
      setSiretLookupMessage(data.raison_sociale ? `Trouvé : ${data.raison_sociale}` : "Établissement trouvé");
    } catch (err) {
      setSiretLookupStatus("error");
      setSiretLookupMessage(err.message);
    }
  }

  const [profileDetailsSaving, setProfileDetailsSaving] = useState(false);
  const [profileDetailsSaved, setProfileDetailsSaved] = useState(false);

  async function handleSaveProfileDetails() {
    setProfileDetailsSaving(true);
    try {
      await apiFetch("/profile/details", {
        method: "POST",
        body: JSON.stringify({
          prenom: profilPrenom || null,
          nom: profilNom || null,
          telephone: profilTelephone || null,
          entreprise: profilEntreprise || null,
          depenses_mensuelles: depensesMensuelles !== "" ? parseFloat(depensesMensuelles) : null,
        }),
      });
      setProfileDetailsSaved(true);
      setTimeout(() => setProfileDetailsSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProfileDetailsSaving(false);
    }
  }

  const [statutSaving, setStatutSaving] = useState(false);
  async function handleChangeStatut(nouveauStatut) {
    if (!profile || profile.statut === nouveauStatut) return;
    setStatutSaving(true);
    try {
      await apiFetch("/profile/statut", {
        method: "POST",
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      setProfile({ ...profile, statut: nouveauStatut });
      setNav("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setStatutSaving(false);
    }
  }

  // ─── Brique 5.1 : charge l'état du cockpit intermittent depuis le backend ───
  async function loadIntermittentCockpit() {
    setInterCockpitLoading(true);
    setInterCockpitError("");
    try {
      const [data, activites] = await Promise.all([
        apiFetch("/intermittent/cockpit"),
        apiFetch("/intermittent/activites"),
      ]);
      setInterCockpit(data);
      setInterActivites(activites);
      // Détection d'un franchissement de palier (pour la célébration).
      const heures = data ? data.total_heures : 0;
      let palierAtteint = PALIERS_INTERMITTENT[0];
      for (const p of PALIERS_INTERMITTENT) { if (heures >= p.seuil) palierAtteint = p; }
      const prev = prevPalierRef.current;
      if (prev && palierAtteint.seuil > prev.seuil) {
        // On vient de monter d'au moins un palier → on fête.
        setCelebPalier(palierAtteint);
      }
      prevPalierRef.current = palierAtteint;
    } catch (err) {
      setInterCockpitError(err.message || "Impossible de charger ton cockpit.");
    } finally {
      setInterCockpitLoading(false);
    }
  }

  // ─── Brique 5.2 : ajouter une activité ───
  async function handleAddActivite() {
    const nombre = parseFloat(interForm.nombre);
    if (!interForm.date || !nombre || nombre <= 0) {
      setError("Renseigne une date et un nombre valide.");
      return;
    }
    setInterSaving(true);
    try {
      await apiFetch("/intermittent/activite", {
        method: "POST",
        body: JSON.stringify({
          date: interForm.date,
          type_activite: interForm.type_activite,
          nombre,
          employeur: interForm.employeur || null,
          estime: !!interForm.estime,
        }),
      });
      setInterForm({ date: "", type_activite: "cachet_isole", nombre: "", employeur: "", estime: false });
      setInterShowAdd(false);
      await loadIntermittentCockpit();
      setHectorPop(true); setTimeout(() => setHectorPop(false), 650);
    } catch (err) {
      setError(err.message);
    } finally {
      setInterSaving(false);
    }
  }

  // ─── Scan d'AEM : envoie la photo/PDF au backend (Claude Vision), récupère les champs lus ───
  // Le document peut contenir PLUSIEURS attestations (un employeur regroupe souvent tous les
  // contrats du mois dans un seul fichier). On les met en file : on valide la 1ère, puis la suivante.
  async function handleScanAEM(file) {
    setAemUploading(true);
    setAemError("");
    setAemExtrait(null);
    setAemQueue([]);
    setAemTotal(0);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/intermittent/aem/extract", { method: "POST", body: form });
      // Le backend renvoie { aems: [...] }. Compatibilité : si un seul objet arrive, on l'emballe.
      const liste = Array.isArray(data?.aems) ? data.aems : (data ? [data] : []);
      if (liste.length === 0) {
        setAemError("Je n'ai rien trouvé d'exploitable sur ce document. Réessaie avec une photo plus nette.");
        return;
      }
      // Transforme chaque AEM lue en formulaire éditable.
      const toForm = (d) => ({
        employeur: d.employeur || "",
        date: d.date || "",
        date_fin: d.date_fin || "",
        type_activite: d.type_activite || "cachet_isole",
        nombre: d.nombre != null ? String(d.nombre) : "",
        salaire_brut: d.salaire_brut != null ? String(d.salaire_brut) : "",
        filename: d.filename || file.name,
        aem_r2_key: d.aem_r2_key || null,
      });
      const forms = liste.map(toForm);
      setAemTotal(forms.length);
      setAemExtrait(forms[0]);        // la 1ère à valider
      setAemQueue(forms.slice(1));    // les suivantes en attente
    } catch (err) {
      setAemError(err.message || "Lecture impossible. Réessaie avec une photo plus nette.");
    } finally {
      setAemUploading(false);
    }
  }

  // ─── Confirme l'AEM lue : crée l'activité avec brut + aem_recue=true ───
  async function handleConfirmAEM() {
    const nombre = parseFloat(aemExtrait.nombre);
    if (!aemExtrait.date || !nombre || nombre <= 0) {
      setAemError("Vérifie la date et le nombre avant d'enregistrer.");
      return;
    }
    setAemSaving(true);
    setAemError("");
    try {
      await apiFetch("/intermittent/activite", {
        method: "POST",
        body: JSON.stringify({
          date: aemExtrait.date,
          date_fin: aemExtrait.date_fin || null,
          type_activite: aemExtrait.type_activite,
          nombre,
          employeur: aemExtrait.employeur || null,
          salaire_brut: aemExtrait.salaire_brut !== "" ? parseFloat(aemExtrait.salaire_brut) : null,
          aem_recue: true,
          aem_filename: aemExtrait.filename || null,
          aem_r2_key: aemExtrait.aem_r2_key || null,
        }),
      });
      // S'il reste des AEM dans la file (document multi-attestations), on enchaîne sur la suivante.
      if (aemQueue.length > 0) {
        setAemExtrait(aemQueue[0]);
        setAemQueue(aemQueue.slice(1));
        await loadIntermittentCockpit(); // rafraîchit le compteur d'heures au fur et à mesure
        setAemSaving(false);
        return; // on reste sur l'écran de validation pour la suivante
      }
      // Plus rien en file : on termine.
      setAemExtrait(null);
      setAemTotal(0);
      await loadIntermittentCockpit();
      setInterNav("activites");
    } catch (err) {
      setAemError(err.message);
    } finally {
      setAemSaving(false);
    }
  }

  // ─── Passe une AEM de la file sans l'enregistrer (ex : doublon ou erreur de lecture) ───
  function handleSkipAEM() {
    setAemError("");
    if (aemQueue.length > 0) {
      setAemExtrait(aemQueue[0]);
      setAemQueue(aemQueue.slice(1));
    } else {
      setAemExtrait(null);
      setAemTotal(0);
    }
  }

  // ─── Ouvre le document AEM original dans une visionneuse overlay (sans quitter l'app) ───
  async function voirDocumentAEM(activiteId, filename) {
    setDocViewer({ url: null, filename: filename || "Document", loading: true });
    try {
      const data = await apiFetch(`/intermittent/activite/${activiteId}/document`, { method: "GET" });
      if (data && data.url) {
        setDocViewer({ url: data.url, filename: filename || "Document", loading: false });
      } else {
        setDocViewer(null);
        alert("Document introuvable.");
      }
    } catch (err) {
      setDocViewer(null);
      alert("Impossible d'ouvrir le document pour l'instant.");
    }
  }

  // ─── Impression du récapitulatif de revenus (PDF via le navigateur) ───
  // ─── Centre de calcul : pose une question, Hector "réfléchit" puis répond ───
  // reponseObj = { text, questions } déjà calculé par le moteur (dans le rendu).
  function poserQuestionCalc(label, reponseObj) {
    // 1. Ajoute la question de l'utilisateur
    setCalcConvo(prev => [...prev, { role: "me", text: label }]);
    // 2. Hector réfléchit
    setCalcThinking(true);
    // 3. Après un court délai, il répond (on transmet toute la matière du moteur)
    setTimeout(() => {
      setCalcThinking(false);
      setCalcConvo(prev => [...prev, {
        role: "bot",
        text: reponseObj.text,
        questions: reponseObj.suite || reponseObj.questions || [],
        pourquoi: reponseObj.pourquoi || null,
        calcul: reponseObj.calcul || null,
        manque: reponseObj.manque || false,
        estimation: reponseObj.estimation || false,
        simulateur: reponseObj.simulateur || false,
      }]);
    }, 1100);
  }

  // ─── Moteur "Que se passe-t-il si…" : RÈGLE D'OR — Hector calcule TOUS les chiffres lui-même.
  // L'IA ne sert qu'à comprendre une question non reconnue ; elle ne fabrique jamais un nombre.
  function calculerScenarioEtSi(question) {
    const q = (question || "").toLowerCase();
    // Données réelles du dossier (déterministes).
    // On part du total OFFICIEL du backend (c.total_heures, déjà filtré sur 365j)
    // pour ne JAMAIS contredire le cockpit. Secours : recalcul fenêtre glissante.
    const acts = interActivites || [];
    const heuresActuelles = (c && typeof c.total_heures === "number") ? c.total_heures : heuresFenetre(acts);
    const seuil = (c && c.seuil) || valeurDe("seuilHeures");
    const manque = Math.max(0, seuil - heuresActuelles);
    const dateAnniv = c && c.date_anniversaire ? new Date(c.date_anniversaire) : null;
    const joursAnniv = dateAnniv ? Math.ceil((dateAnniv - new Date()) / 86400000) : null;
    // Extrait un nombre de la question (ex "3 cachets", "8 heures", "15 jours")
    const num = (() => { const m = q.match(/(\d+([.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) : null; })();
    const fmtH = (h) => Math.round(h);

    // ─ Scénario 1 : accepter des cachets ─
    if (/(accepte|prends?|fais|ajoute).*(cachet)/.test(q) || (/cachet/.test(q) && /(et si|si je)/.test(q))) {
      const n = num || 1;
      const ajout = n * valeurDe("cachetHeures");
      const apres = heuresActuelles + ajout;
      const secu = apres >= seuil;
      return {
        ouv: secu ? "Ça sent bon." : "Regardons.",
        text: `Avec ${n} cachet${n > 1 ? "s" : ""} (${ajout}h), tu passerais de ${fmtH(heuresActuelles)}h à ${fmtH(apres)}h. ${secu ? `Tu franchirais tes ${seuil}h — tes droits seraient sécurisés. Si c'était mon dossier, je ne laisserais pas filer ce contrat.` : `Il te manquerait encore ${fmtH(seuil - apres)}h ≈ ${Math.ceil((seuil - apres) / 12)} cachets. Ça t'avance bien, mais ça ne suffit pas encore.`}`,
      };
    }
    // ─ Scénario 2 : accepter des heures ─
    if (/(accepte|prends?|fais|ajoute).*(heure|h\b)/.test(q) || (/heure/.test(q) && /(et si|si je)/.test(q))) {
      const n = num || 0;
      const apres = heuresActuelles + n;
      const secu = apres >= seuil;
      return {
        ouv: secu ? "Ça sent bon." : "Regardons.",
        text: `Avec ${n}h de plus, tu passerais de ${fmtH(heuresActuelles)}h à ${fmtH(apres)}h. ${secu ? `Tu atteindrais tes ${seuil}h — c'est sécurisé.` : `Il te manquerait encore ${fmtH(seuil - apres)}h.`}`,
      };
    }
    // ─ Scénario 3 : refuser / annuler un contrat ─
    if (/(refuse|annule|laisse tomber|rate)/.test(q)) {
      const n = num || null;
      if (n) {
        const perte = /heure/.test(q) ? n : n * valeurDe("cachetHeures");
        const apres = Math.max(0, heuresActuelles - perte);
        return {
          ouv: "Je préfère te prévenir.",
          text: `Si tu refuses ${/heure/.test(q) ? `${n}h` : `${n} cachet${n > 1 ? "s" : ""}`}, tu resterais à ${fmtH(heuresActuelles)}h (ces heures ne s'ajouteraient pas). Tu aurais donc toujours ${fmtH(manque)}h à trouver ailleurs. À ta place, je ne refuserais pas sans avoir une autre piste.`,
        };
      }
      return {
        ouv: "Regardons.",
        text: `Aujourd'hui tu es à ${fmtH(heuresActuelles)}h, il te manque ${fmtH(manque)}h. Refuser un contrat te laisse à ce niveau — dis-moi combien de cachets il représentait et je te dis précisément ce que tu perdrais.`,
      };
    }
    // ─ Scénario 4 : pause / vacances / ne pas travailler un mois ─
    if (/(vacances|pause|arr[êe]te|travaille pas|ne travaille|repos|congé)/.test(q) && !/maladie|maternit/.test(q)) {
      return {
        ouv: manque > 0 ? "Je préfère te prévenir." : "On peut souffler.",
        text: manque > 0
          ? `Si tu fais une pause, ton compteur reste à ${fmtH(heuresActuelles)}h — il ne baisse pas tout de suite, mais il n'avance pas non plus. Or il te manque ${fmtH(manque)}h${joursAnniv ? ` et il te reste ${joursAnniv} jours avant ton renouvellement` : ""}. Une pause courte, ça va ; un mois entier, je garderais un œil sur le calendrier.`
          : `Tu as déjà tes ${seuil}h, donc une pause ne met pas tes droits en danger dans l'immédiat. Profite — je veille.`,
      };
    }
    // ─ Scénario 5 : maladie / maternité ─
    if (/(maladie|malade|maternit|accident|arrêt)/.test(q)) {
      return {
        ouv: "Celui-là mérite qu'on s'y attarde.",
        text: `Les arrêts maladie et congés maternité ont des règles spéciales (neutralisation de période, parfois assimilation d'heures) que je ne calcule pas encore précisément — je ne veux pas te donner un chiffre à l'aveugle. Pour ce cas, je te conseille de vérifier avec France Travail ou un conseiller. Ce que je peux te dire de sûr : tu es à ${fmtH(heuresActuelles)}h aujourd'hui.`,
        prudent: true,
      };
    }
    // ─ Scénario 6 : atteindre 507h avant une date / tournée ─
    if (/(507|atteindre|objectif|avant|tournée|tournee)/.test(q)) {
      if (/tournée|tournee/.test(q) && num) {
        const ajout = num * 8; // une tournée ~ heures (estimation prudente : on demande à préciser)
        return {
          ouv: "Regardons ensemble.",
          text: `Une tournée, ça dépend du nombre de cachets ou d'heures déclarés — dis-moi ça précisément (ex : "tournée de 10 cachets") et je te calcule l'impact exact. Pour l'instant tu es à ${fmtH(heuresActuelles)}h, il te manque ${fmtH(manque)}h.`,
        };
      }
      return {
        ouv: manque > 0 ? "Voyons ça." : "On peut souffler.",
        text: manque > 0
          ? `Pour atteindre tes ${seuil}h, il te manque ${fmtH(manque)}h ≈ ${Math.ceil(manque / 12)} cachets${joursAnniv ? `, et il te reste ${joursAnniv} jours avant ton renouvellement` : ""}. ${joursAnniv && joursAnniv > 0 ? `Ça fait environ ${(Math.ceil(manque / 12) / (joursAnniv / 7)).toFixed(1)} cachets par semaine à tenir.` : "Renseigne ta date anniversaire et je te dirai à quel rythme aller."}`
          : `Tu as déjà tes ${seuil}h — l'objectif est atteint. 🎉`,
      };
    }
    // Aucun scénario reconnu → on signale qu'on passe la main à l'IA (avec contexte chiffré)
    return null;
  }

  // Traite la question libre "Et si…" : déterministe d'abord, IA en secours (sans inventer de chiffre)
  async function poserEtSi() {
    const question = etSiInput.trim();
    if (!question || etSiLoading) return;
    setEtSiInput("");
    setCalcConvo(prev => [...prev, { role: "me", text: question }]);
    setCalcThinking(true);

    // 1. Hector tente de calculer lui-même (déterministe)
    const scenario = calculerScenarioEtSi(question);
    if (scenario) {
      setTimeout(() => {
        setCalcThinking(false);
        setCalcConvo(prev => [...prev, { role: "bot", text: scenario.text, ouv: scenario.ouv, questions: [] }]);
      }, 1100);
      return;
    }

    // 2. Scénario non reconnu → on demande à l'IA de comprendre, MAIS en lui interdisant d'inventer.
    //    On lui fournit les chiffres réels pour qu'elle reformule sans calculer.
    const acts = interActivites || [];
    const heuresActuelles = Math.round((c && typeof c.total_heures === "number") ? c.total_heures : heuresFenetre(acts));
    const seuil = (c && c.seuil) || valeurDe("seuilHeures");
    const contexte = `Données réelles de l'utilisateur (NE LES MODIFIE PAS, n'invente AUCUN autre chiffre) : heures actuelles = ${heuresActuelles}h, seuil = ${seuil}h, il manque = ${Math.max(0, seuil - heuresActuelles)}h.`;
    const consigne = `Tu es Hector, un chien fidèle qui veille sur le dossier d'un intermittent du spectacle. Réponds à la question avec chaleur, en tutoyant, comme un copilote ("si c'était mon dossier..."). RÈGLE ABSOLUE : n'invente jamais une heure, une date ou une projection chiffrée. Utilise UNIQUEMENT les chiffres fournis. Si la question demande un calcul que tu ne peux pas faire avec ces seuls chiffres, dis honnêtement que tu préfères ne pas répondre à l'aveugle et invite à préciser ou à vérifier avec France Travail. Sois bref (3-4 phrases).`;
    try {
      const data = await apiFetch("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: `${consigne}\n\n${contexte}\n\nQuestion : ${question}` }] }),
      });
      setCalcThinking(false);
      setCalcConvo(prev => [...prev, { role: "bot", text: data.reply, ouv: null, questions: [] }]);
    } catch (err) {
      setCalcThinking(false);
      setCalcConvo(prev => [...prev, { role: "bot", ouv: "Hmm.", text: `Je n'ai pas réussi à analyser celle-là. Reformule autrement, ou pose-moi une des questions ci-dessous. Ce que je sais de sûr : tu es à ${heuresActuelles}h sur ${seuil}h.`, questions: [] }]);
    }
  }

  // ─── Moteur "Que se passe-t-il si…" : fin ───

  function imprimerRecapRevenus(recap, prenom, nom) {
    const nomComplet = [prenom, nom].filter(Boolean).join(" ") || "—";
    const aujourdhui = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n);
    const lignesHTML = recap.lignes.map(l => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e9f0;">${l.label}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e9f0;text-align:center;">${l.contrats}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e9f0;text-align:center;">${l.employeurs}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e5e9f0;text-align:right;font-weight:600;">${l.brut > 0 ? fmt(Math.round(l.brut)) + " &euro;" : "&mdash;"}</td>
      </tr>`).join("");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Recapitulatif de revenus - ${nomComplet}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #1a2b42; margin: 0; padding: 40px; line-height: 1.5; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0A2540; padding-bottom: 18px; margin-bottom: 24px; }
        .brand { font-size: 22px; font-weight: bold; color: #0A2540; }
        .brand span { color: #378ADD; }
        .meta { text-align: right; font-size: 12px; color: #5a6b80; }
        h1 { font-size: 19px; color: #0A2540; margin: 0 0 4px; }
        .sub { font-size: 13px; color: #5a6b80; margin-bottom: 24px; }
        .who { background: #f4f7fb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 14px; }
        .who b { color: #0A2540; }
        .stats { display: flex; gap: 14px; margin-bottom: 24px; }
        .stat { flex: 1; border: 1px solid #dde5ee; border-radius: 8px; padding: 14px; text-align: center; }
        .stat .v { font-size: 22px; font-weight: bold; color: #0A2540; }
        .stat .l { font-size: 11px; color: #5a6b80; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
        th { background: #0A2540; color: white; padding: 9px 12px; text-align: left; font-size: 12px; }
        th:nth-child(2), th:nth-child(3) { text-align: center; }
        th:last-child { text-align: right; }
        tfoot td { padding: 11px 12px; font-weight: bold; border-top: 2px solid #0A2540; }
        .note { font-size: 10.5px; color: #8595a8; margin-top: 22px; border-top: 1px solid #e5e9f0; padding-top: 14px; font-family: Arial, sans-serif; line-height: 1.6; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="head">
        <div class="brand">H<span>&euro;</span>CTOR</div>
        <div class="meta">Document genere le ${aujourdhui}<br>par l'utilisateur via H&euro;CTOR</div>
      </div>
      <h1>Recapitulatif de revenus</h1>
      <div class="sub">Intermittent du spectacle &middot; periode ${recap.periodeLabel}</div>
      <div class="who"><b>${nomComplet}</b><br>Revenus d'activite declares sur les 12 derniers mois</div>
      <div class="stats">
        <div class="stat"><div class="v">${fmt(recap.totalBrut)} &euro;</div><div class="l">Total brut sur la periode</div></div>
        <div class="stat"><div class="v">${fmt(recap.moyenneMensuelle)} &euro;</div><div class="l">Moyenne mensuelle*</div></div>
        <div class="stat"><div class="v">${recap.totalContrats}</div><div class="l">Contrats declares</div></div>
      </div>
      <table>
        <thead><tr><th>Mois</th><th>Contrats</th><th>Employeurs</th><th>Salaire brut</th></tr></thead>
        <tbody>${lignesHTML}</tbody>
        <tfoot><tr><td>Total</td><td style="text-align:center;">${recap.totalContrats}</td><td style="text-align:center;">${recap.employeursUniques}</td><td style="text-align:right;">${fmt(recap.totalBrut)} &euro;</td></tr></tfoot>
      </table>
      <div class="note">
        * Moyenne calculee sur les mois travailles uniquement.<br>
        Ce document est un recapitulatif personnel etabli a partir des donnees saisies par l'utilisateur dans l'application H&euro;CTOR. Il ne constitue pas une attestation officielle de France Travail, d'un employeur ou de tout autre organisme, et n'a pas de valeur juridique ou fiscale. Pour un document officiel, l'utilisateur doit s'adresser aux organismes competents.
      </div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Autorise les fenetres pop-up pour generer le PDF."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 350);
  }

  // ─── Reporter les heures déjà faites (saisie de départ) ───
  async function handleReport() {
    const nombre = parseFloat(reportForm.nombre);
    if (!nombre || nombre <= 0) {
      setError("Indique un nombre valide.");
      return;
    }
    // On ancre le report à une date cohérente dans la fenêtre de 12 mois,
    // selon la période choisie, pour que le moteur vieillisse les heures justement.
    const aujourdhui = new Date();
    let joursEnArriere;
    if (reportForm.periode === "recent") joursEnArriere = 60;       // ~2 mois
    else if (reportForm.periode === "ancien") joursEnArriere = 300;  // ~10 mois
    else joursEnArriere = 180;                                       // réparti sur l'année (~6 mois)
    const d = new Date(aujourdhui.getTime() - joursEnArriere * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    // Unité : "heures" enregistre des heures réelles ; "cachets" = cachets isolés (12h).
    const type_activite = reportForm.unite === "cachets" ? "cachet_isole" : "heures";
    setReportSaving(true);
    try {
      await apiFetch("/intermittent/activite", {
        method: "POST",
        body: JSON.stringify({
          date: dateStr,
          type_activite,
          nombre,
          employeur: "Report (heures déjà faites)",
        }),
      });
      setReportForm({ unite: "heures", nombre: "", periode: "annee" });
      setReportOpen(false);
      await loadIntermittentCockpit();
    } catch (err) {
      setError(err.message);
    } finally {
      setReportSaving(false);
    }
  }

  // ─── Brique 5.2 : supprimer une activité ───
  async function handleDeleteActivite(id) {
    try {
      await apiFetch(`/intermittent/activite/${id}`, { method: "DELETE" });
      await loadIntermittentCockpit();
    } catch (err) {
      setError(err.message);
    }
  }

  // ─── Modifier une activité existante ───
  function startEditActivite(a) {
    setInterEditId(a.id);
    setInterEditForm({
      date: a.date || "",
      type_activite: a.type_activite || "cachet_isole",
      nombre: String(a.nombre ?? ""),
      employeur: a.employeur || "",
      estime: a.estime === true,
    });
  }
  async function handleSaveEditActivite() {
    const nombre = parseFloat(interEditForm.nombre);
    if (!interEditForm.date || !nombre || nombre <= 0) {
      setError("Renseigne une date et un nombre valide.");
      return;
    }
    setInterEditSaving(true);
    try {
      await apiFetch(`/intermittent/activite/${interEditId}`, {
        method: "PUT",
        body: JSON.stringify({
          date: interEditForm.date,
          type_activite: interEditForm.type_activite,
          nombre,
          employeur: interEditForm.employeur || null,
          estime: !!interEditForm.estime,
        }),
      });
      setInterEditId(null);
      await loadIntermittentCockpit();
    } catch (err) {
      setError(err.message);
    } finally {
      setInterEditSaving(false);
    }
  }

  // ─── Brique 5.4 : "Parle à Hector" — simuler un contrat ───
  async function handleSimuler() {
    const nombre = parseFloat(simForm.nombre);
    if (!nombre || nombre <= 0) {
      setError("Indique un nombre pour simuler.");
      return;
    }
    setSimLoading(true);
    setSimResult(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiFetch("/intermittent/simuler", {
        method: "POST",
        body: JSON.stringify({
          date: today,
          type_activite: simForm.type_activite,
          nombre,
        }),
      });
      setSimResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSimLoading(false);
    }
  }

  // ─── Brique 5.5 : enregistrer la date anniversaire ───
  async function handleSaveAnniversaire() {
    setAnniversaireSaving(true);
    try {
      await apiFetch("/profile/date-anniversaire", {
        method: "POST",
        body: JSON.stringify({ date_anniversaire: anniversaireInput || null }),
      });
      setAnniversaireEdit(false);
      await loadIntermittentCockpit();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnniversaireSaving(false);
    }
  }

  // ─── Import attestation ARE : Hector LIT (date anniversaire + montant journalier),
  // il ne calcule rien. On affiche ce que France Travail a déjà décidé. ───
  // BACKEND À FAIRE — endpoint POST /intermittent/are/extract (multipart "file"),
  // qui doit renvoyer un JSON : { date_anniversaire: "AAAA-MM-JJ"|null,
  //   montant_journalier: number|null, filename: string }.
  async function handleImportARE(file) {
    setAreUploading(true);
    setAreError("");
    setAreExtrait(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/intermittent/are/extract", { method: "POST", body: form });
      // Pré-remplit l'écran de vérification avec ce qu'Hector a lu (tout reste éditable).
      setAreExtrait({
        date_anniversaire: data.date_anniversaire || "",
        montant_journalier: data.montant_journalier != null ? String(data.montant_journalier) : "",
        filename: data.filename || file.name,
      });
    } catch (err) {
      setAreError(err.message || "Lecture impossible. Réessaie avec un document plus net.");
    } finally {
      setAreUploading(false);
    }
  }

  // ─── Confirme l'ARE lue : enregistre la date anniversaire (+ le montant journalier,
  // affiché tel quel, jamais recalculé). ───
  async function handleConfirmARE() {
    if (!areExtrait || !areExtrait.date_anniversaire) {
      setAreError("Vérifie la date anniversaire avant d'enregistrer.");
      return;
    }
    setAreSaving(true);
    setAreError("");
    try {
      const mj = areExtrait.montant_journalier !== "" ? parseFloat(areExtrait.montant_journalier) : null;
      // BACKEND À FAIRE — accepter un champ optionnel "montant_journalier" sur cet endpoint
      // (ou un endpoint dédié) pour stocker le montant lu et le ressortir dans le cockpit.
      await apiFetch("/profile/date-anniversaire", {
        method: "POST",
        body: JSON.stringify({
          date_anniversaire: areExtrait.date_anniversaire || null,
          montant_journalier: mj != null && !isNaN(mj) ? mj : null,
        }),
      });
      setAreExtrait(null);
      await loadIntermittentCockpit();
    } catch (err) {
      setAreError(err.message);
    } finally {
      setAreSaving(false);
    }
  }

  // Déclenche le chargement quand l'utilisateur est intermittent et connecté.
  useEffect(() => {
    if (token && profile && profile.statut === "intermittent") {
      loadIntermittentCockpit();
      // Walkthrough intermittent au premier accès (indépendant de loadEverything,
      // qui appelle des endpoints AE pouvant échouer pour un intermittent).
      if (profile.onboarding_complete && !safeStorage.getItem("hector_walkthrough_done")) {
        setShowWalkthrough(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, profile?.statut]);

  function addHectorMessage(text, couleur) {
    const id = Date.now() + Math.random();
    setHectorMessages(prev => [...prev.slice(-1), { id, text, couleur: couleur || "#5DCAA5" }]);
    setTimeout(() => setHectorMessages(prev => prev.filter(m => m.id !== id)), 7000);
  }

  async function handleAddIncome(e) {
    e.preventDefault();
    try {
      const montant = parseFloat(incomeForm.amount) || 0;
      await apiFetch("/income", { method: "POST", body: JSON.stringify({ date: incomeForm.date, amount: montant, description: incomeForm.description || null }) });
      const taux = estimateData?.taux_global_pct || 21.2;
      const urssaf = Math.round(montant * taux / 100);
      const reste = Math.round(montant - urssaf);
      if (montant > 0) addHectorMessage(`${formatEUR(montant)} encaissés 🎉 Je mets ${formatEUR(urssaf)} de côté pour l'URSSAF. Il te reste vraiment ${formatEUR(reste)} à toi.`);
      setIncomeForm({ date: "", amount: "", description: "" });
      setShowAddIncome(false);
      await loadEverything();
      setNav("dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUploadInvoice(file) {
    setUploadingFile(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/income/extract", { method: "POST", body: form });
      setFactureExtraite({
        amount: String(data.amount),
        date: data.date,
        filename: data.filename,
        client: data.client || "",
        description: data.description || "",
        numero_facture: data.numero_facture || "",
        tva_pct: data.tva_pct,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleConfirmFacture(force = false) {
    try {
      await apiFetch("/income/confirm", {
        method: "POST",
        body: JSON.stringify({
          date: factureExtraite.date,
          amount: parseFloat(factureExtraite.amount) || 0,
          client: factureExtraite.client || null,
          description: factureExtraite.description || null,
          numero_facture: factureExtraite.numero_facture || null,
          filename: factureExtraite.filename || null,
          force,
        }),
      });
      const montant = parseFloat(factureExtraite.amount) || 0;
      const taux = estimateData?.taux_global_pct || 21.2;
      const urssaf = Math.round(montant * taux / 100);
      const reste = Math.round(montant - urssaf);
      if (montant > 0) addHectorMessage(`Facture enregistrée ✓ Je mets ${formatEUR(urssaf)} de côté pour l'URSSAF. Il te reste ${formatEUR(reste)} à toi.`);
      setFactureExtraite(null);
      setShowAddIncome(false);
      await loadEverything();
    } catch (err) {
      if (err.detail?.code === "DOUBLON_POTENTIEL") {
        setFactureExtraite(f => ({ ...f, doublon: err.detail }));
      } else {
        setError(err.message);
      }
    }
  }

  async function handleDeleteIncome(id) {
    try {
      await apiFetch(`/income/${id}`, { method: "DELETE" });
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  function addFactureLigne() {
    setFactureForm(f => ({ ...f, lignes: [...f.lignes, { description: "", quantite: 1, prix_unitaire: "" }] }));
  }

  function updateLigne(i, field, value) {
    setFactureForm(f => {
      const lignes = [...f.lignes];
      lignes[i] = { ...lignes[i], [field]: value };
      return { ...f, lignes };
    });
  }

  function totalFacture() {
    return factureForm.lignes.reduce((sum, l) => sum + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
  }

  async function loadInvoices() {
    setInvoicesLoading(true);
    try {
      const [list, summary] = await Promise.all([apiFetch("/invoices"), apiFetch("/invoices/summary")]);
      setInvoicesList(list);
      setInvoicesSummary(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setInvoicesLoading(false);
    }
  }

  function resetFactureForm() {
    setFactureForm({ client_nom: "", client_email: "", client_adresse: "", date_emission: todayISO, date_echeance: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
    setEditingInvoiceId(null);
  }

  function startEditInvoice(inv) {
    setFactureForm({
      client_nom: inv.client_nom || "",
      client_email: inv.client_email || "",
      client_adresse: inv.client_adresse || "",
      date_emission: inv.date_emission || todayISO,
      date_echeance: inv.date_echeance || "",
      lignes: (inv.lignes && inv.lignes.length > 0) ? inv.lignes : [{ description: "", quantite: 1, prix_unitaire: "" }],
      notes: inv.notes || "",
    });
    setEditingInvoiceId(inv.id);
    setShowNewFacture(true);
  }

  const [loadingPdf, setLoadingPdf] = useState(false);

  async function handleViewInvoicePdf(inv) {
    setLoadingPdf(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/invoices/${inv.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Impossible de générer le PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleSendInvoice(inv) {
    setSendingInvoice(true);
    setSendInvoiceStatus("");
    setSendInvoiceError("");
    try {
      const updated = await apiFetch(`/invoices/${inv.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          emitter_nom: profilEntreprise || `${profilPrenom} ${profilNom}`.trim() || null,
          emitter_adresse: profilAdresse || null,
          emitter_siret: profilSiret || null,
          message: sendInvoiceMessage || null,
        }),
      });
      setSendInvoiceStatus("sent");
      setViewingInvoice(updated);
      await loadInvoices();
    } catch (err) {
      setSendInvoiceStatus("error");
      setSendInvoiceError(err.message);
    } finally {
      setSendingInvoice(false);
    }
  }

  // ─── Devis ───

  async function loadQuotes() {
    setQuotesLoading(true);
    try {
      const [list, summary] = await Promise.all([apiFetch("/quotes"), apiFetch("/quotes/summary")]);
      setQuotesList(list);
      setQuotesSummary(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuotesLoading(false);
    }
  }

  function resetQuoteForm() {
    setQuoteForm({ client_nom: "", client_email: "", client_adresse: "", date_emission: todayISO, date_validite: "", lignes: [{ description: "", quantite: 1, prix_unitaire: "" }], notes: "" });
    setEditingQuoteId(null);
  }

  function startEditQuote(q) {
    setQuoteForm({
      client_nom: q.client_nom || "",
      client_email: q.client_email || "",
      client_adresse: q.client_adresse || "",
      date_emission: q.date_emission || todayISO,
      date_validite: q.date_validite || "",
      lignes: (q.lignes && q.lignes.length > 0) ? q.lignes : [{ description: "", quantite: 1, prix_unitaire: "" }],
      notes: q.notes || "",
    });
    setEditingQuoteId(q.id);
    setShowNewQuote(true);
  }

  function addQuoteLigne() {
    setQuoteForm(f => ({ ...f, lignes: [...f.lignes, { description: "", quantite: 1, prix_unitaire: "" }] }));
  }

  function updateQuoteLigne(i, field, value) {
    setQuoteForm(f => {
      const lignes = [...f.lignes];
      lignes[i] = { ...lignes[i], [field]: value };
      return { ...f, lignes };
    });
  }

  function totalQuote() {
    return quoteForm.lignes.reduce((sum, l) => sum + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
  }

  async function saveQuote(statutVoulu) {
    const lignes = quoteForm.lignes.map(l => ({
      description: l.description,
      quantite: parseFloat(l.quantite) || 0,
      prix_unitaire: parseFloat(l.prix_unitaire) || 0,
    }));
    try {
      if (editingQuoteId) {
        await apiFetch(`/quotes/${editingQuoteId}`, {
          method: "PUT",
          body: JSON.stringify({
            client_nom: quoteForm.client_nom,
            client_email: quoteForm.client_email || null,
            client_adresse: quoteForm.client_adresse || null,
            date_emission: quoteForm.date_emission,
            date_validite: quoteForm.date_validite || null,
            lignes,
            notes: quoteForm.notes || null,
          }),
        });
      } else {
        await apiFetch("/quotes", {
          method: "POST",
          body: JSON.stringify({
            client_nom: quoteForm.client_nom,
            client_email: quoteForm.client_email || null,
            client_adresse: quoteForm.client_adresse || null,
            date_emission: quoteForm.date_emission,
            date_validite: quoteForm.date_validite || null,
            lignes,
            notes: quoteForm.notes || null,
            statut: statutVoulu || "brouillon",
          }),
        });
      }
      setShowNewQuote(false);
      resetQuoteForm();
      await loadQuotes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleQuoteStatus(id, statut) {
    try {
      await apiFetch(`/quotes/${id}/status`, { method: "PATCH", body: JSON.stringify({ statut }) });
      await loadQuotes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteQuote(id) {
    try {
      await apiFetch(`/quotes/${id}`, { method: "DELETE" });
      await loadQuotes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSendQuote(q) {
    setSendingQuote(true);
    setSendQuoteStatus("");
    setSendQuoteError("");
    try {
      const updated = await apiFetch(`/quotes/${q.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          emitter_nom: profilEntreprise || `${profilPrenom} ${profilNom}`.trim() || null,
          emitter_adresse: profilAdresse || null,
          emitter_siret: profilSiret || null,
          message: sendQuoteMessage || null,
        }),
      });
      setSendQuoteStatus("sent");
      setViewingQuote(updated);
      await loadQuotes();
    } catch (err) {
      setSendQuoteStatus("error");
      setSendQuoteError(err.message);
    } finally {
      setSendingQuote(false);
    }
  }

  async function handleConvertQuote(q) {
    setConvertingQuote(true);
    try {
      await apiFetch(`/quotes/${q.id}/convert`, { method: "POST" });
      setViewingQuote(null);
      await loadQuotes();
      setNav("factures");
    } catch (err) {
      setError(err.message);
    } finally {
      setConvertingQuote(false);
    }
  }

  const QUOTE_STATUT_INFO = {
    brouillon: { label: "Brouillon", bg: "#F1F2EE", color: "#5B6573" },
    envoye: { label: "Envoyé", bg: "#E6F1FB", color: "#0C447C" },
    accepte: { label: "Accepté", bg: "#E1F5EE", color: "#0F6E56" },
    refuse: { label: "Refusé", bg: "#FCEBEB", color: "#A32D2D" },
    expire: { label: "Expiré", bg: "#FAEEDA", color: "#854F0B" },
  };


  async function saveFacture(statutVoulu) {
    const lignes = factureForm.lignes.map(l => ({
      description: l.description,
      quantite: parseFloat(l.quantite) || 0,
      prix_unitaire: parseFloat(l.prix_unitaire) || 0,
    }));
    try {
      if (editingInvoiceId) {
        await apiFetch(`/invoices/${editingInvoiceId}`, {
          method: "PUT",
          body: JSON.stringify({
            client_nom: factureForm.client_nom,
            client_email: factureForm.client_email || null,
            client_adresse: factureForm.client_adresse || null,
            date_emission: factureForm.date_emission,
            date_echeance: factureForm.date_echeance || null,
            lignes,
            notes: factureForm.notes || null,
          }),
        });
      } else {
        await apiFetch("/invoices", {
          method: "POST",
          body: JSON.stringify({
            client_nom: factureForm.client_nom,
            client_email: factureForm.client_email || null,
            client_adresse: factureForm.client_adresse || null,
            date_emission: factureForm.date_emission,
            date_echeance: factureForm.date_echeance || null,
            lignes,
            notes: factureForm.notes || null,
            statut: statutVoulu || "brouillon",
          }),
        });
      }
      setShowNewFacture(false);
      resetFactureForm();
      await loadInvoices();
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleInvoiceStatus(id, statut) {
    try {
      await apiFetch(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ statut }) });
      if (statut === "payee") {
        const inv = invoicesList.find(i => i.id === id);
        if (inv) addHectorMessage(`Facture encaissée ✓ Je recalcule ton disponible avec ces ${formatEUR(inv.montant)}.`);
      }
      await loadInvoices();
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteInvoice(id) {
    try {
      await apiFetch(`/invoices/${id}`, { method: "DELETE" });
      await loadInvoices();
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  function invoiceIsOverdue(inv) {
    if (!["envoyee", "impayee"].includes(inv.statut) || !inv.date_echeance) return false;
    return new Date(inv.date_echeance) < new Date(todayISO);
  }

  function joursDeRetard(inv) {
    if (!inv.date_echeance) return 0;
    return Math.max(0, Math.round((new Date(todayISO) - new Date(inv.date_echeance)) / 86400000));
  }

  const INVOICE_STATUT_INFO = {
    brouillon: { label: "Brouillon", bg: "#F1F2EE", color: "#5B6573" },
    envoyee: { label: "Envoyée", bg: "#E6F1FB", color: "#0C447C" },
    payee: { label: "Payée", bg: "#E1F5EE", color: "#0F6E56" },
    impayee: { label: "Impayée", bg: "#E24B4A", color: "white" },
  };

  useEffect(() => {
    if ((nav === "factures" || nav === "contacts") && token) loadInvoices();
  }, [nav, token]);

  useEffect(() => {
    if (nav === "devis" && token) loadQuotes();
  }, [nav, token]);

  useEffect(() => {
    if (viewingQuote && sendQuoteStatus !== "sent") {
      setSendQuoteMessage(
        `Bonjour ${viewingQuote.client_nom || ""},\n\nVeuillez trouver ci-dessous notre devis ${viewingQuote.numero || ""}.\n\nCordialement,\n${profilPrenom || profilEntreprise || ""}`
      );
    }
  }, [viewingQuote?.id]);

  // ────────────────────────────────────────────────────────────
  // Frais d'entreprise
  // ────────────────────────────────────────────────────────────

  const CATEGORIES_FRAIS = [
    { id: "logiciels", label: "Logiciels" },
    { id: "abonnements", label: "Abonnements" },
    { id: "taxi", label: "Taxi" },
    { id: "repas", label: "Repas" },
    { id: "materiel", label: "Matériel" },
    { id: "coworking", label: "Coworking" },
    { id: "telephone_internet", label: "Téléphone / Internet" },
    { id: "autre", label: "Autre" },
  ];

  function labelCategorie(id) {
    return CATEGORIES_FRAIS.find(c => c.id === id)?.label || "Autre";
  }

  async function loadExpenses() {
    setExpensesLoading(true);
    try {
      const [list, summary] = await Promise.all([apiFetch("/expenses"), apiFetch("/expenses/summary")]);
      setExpensesList(list);
      setExpensesSummary(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setExpensesLoading(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    try {
      const montant = parseFloat(expenseForm.montant) || 0;
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date: expenseForm.date,
          montant,
          categorie: expenseForm.categorie,
          description: expenseForm.description || null,
        }),
      });
      if (montant > 0) addHectorMessage(`Frais de ${formatEUR(montant)} enregistré. Je l'ai déduit de ton disponible — chaque euro que je connais, c'est un euro que tu ne perdras pas.`, "#8BA5C0");
      setExpenseForm({ date: "", montant: "", categorie: "autre", description: "" });
      setShowAddExpense(false);
      await loadExpenses();
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteExpense(id) {
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
      await loadExpenses();
      await loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUploadExpenseInvoice(file) {
    setUploadingExpenseFile(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await apiFetch("/expenses/extract", { method: "POST", body: form });
      // Nettoyer la description : virer les headers de tableau PDF mal parsés
      const descBrute = data.description || "";
      const motsParasites = ["qté", "quantite", "prix unitaire", "taxe", "montant", "total", "designation", "désignation", "libellé", "libelle", "tva", "ht", "ttc"];
      const descPropre = motsParasites.some(m => descBrute.toLowerCase().includes(m)) ? "" : descBrute;
      setExpenseForm({
        date: data.date,
        montant: String(data.amount),
        categorie: "autre",
        description: descPropre,
      });
      setShowAddExpense(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingExpenseFile(false);
    }
  }

  useEffect(() => {
    if (nav === "frais" && token) loadExpenses();
  }, [nav, token]);


  async function askAI(e) {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);
    try {
      const data = await apiFetch("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      setAiMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setAiMessages(m => [...m, { role: "assistant", content: `Erreur : ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  }

  // --- Chat Hector intermittent : même endpoint, le backend détecte le statut ---
  async function askInterChat(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!interChatInput.trim() || interChatLoading) return;
    const userMsg = { role: "user", content: interChatInput };
    const newMessages = [...interChat, userMsg];
    setInterChat(newMessages);
    setInterChatInput("");
    setInterChatLoading(true);
    try {
      const data = await apiFetch("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      setInterChat(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setInterChat(m => [...m, { role: "assistant", content: `Erreur : ${err.message}` }]);
    } finally {
      setInterChatLoading(false);
    }
  }

  // --- Hector prépare un devis ou une facture : parse le bloc [[DOC:{...}]] d'un message ---
  function parseDevisBlock(content) {
    if (!content) return null;
    const m = content.match(/\[\[DOC:(\{.*?\})\]\]/s);
    if (!m) return null;
    try {
      const data = JSON.parse(m[1]);
      if (!data.client_nom || !Array.isArray(data.lignes) || data.lignes.length === 0) return null;
      const type = data.type === "facture" ? "facture" : "devis";
      const montant = data.lignes.reduce((s, l) => s + (Number(l.quantite) || 1) * (Number(l.prix_unitaire) || 0), 0);
      return { data, type, montant, cleanText: content.replace(/\[\[DOC:\{.*?\}\]\]/s, "").trim() };
    } catch {
      return null;
    }
  }

  async function handleCreateQuoteFromAssistant(devis, msgIndex) {
    setDevisCreating(msgIndex);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const isFacture = devis.type === "facture";
      const endpoint = isFacture ? "/invoices" : "/quotes";
      const payload = {
        client_nom: devis.data.client_nom,
        client_email: devis.data.client_email || null,
        client_adresse: devis.data.client_adresse || null,
        date_emission: today,
        lignes: devis.data.lignes.map(l => ({ description: l.description || "", quantite: Number(l.quantite) || 1, prix_unitaire: Number(l.prix_unitaire) || 0 })),
        notes: devis.data.notes || null,
        statut: "brouillon",
      };
      if (isFacture) payload.date_echeance = null;
      else payload.date_validite = null;
      const created = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setDevisCreated(prev => ({ ...prev, [msgIndex]: created.numero || true }));
      if (isFacture) { loadInvoices && loadInvoices(); }
      else { loadQuotes && loadQuotes(); }
    } catch (err) {
      setAiMessages(m => [...m, { role: "assistant", content: `Je n'ai pas réussi à créer le document : ${err.message}. Tu peux le faire à la main dans Facturer.` }]);
    } finally {
      setDevisCreating(null);
    }
  }

  // --- Dictée vocale : parle à Hector, ça remplit la barre (tu relis avant d'envoyer) ---
  const speechSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggleVoiceInput() {
    if (!speechSupported) return;
    // Si on écoute déjà, on arrête.
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      setAiInput((finalText + interim).trim());
    };
    recognition.onerror = () => { setIsListening(false); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    setIsListening(true);
    recognition.start();
  }

  const revenusParMois = Array.from({ length: 12 }, (_, i) => {
    const total = incomeList.filter(e => new Date(e.date).getMonth() === i && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + e.amount, 0);
    const taux = estimateData?.taux_global_pct ? estimateData.taux_global_pct / 100 : 0.214;
    return { mois: MOIS[i], total, urssaf: Math.round(total * taux * 100) / 100 };
  });
  const maxRevenu = Math.max(...revenusParMois.map(m => m.total), 1);

  // --- Fraîcheur du solde (rituel de mise à jour manuelle) ---
  // Stockée en localStorage, zéro dépendance backend. Le solde est "périmé" au-delà de 7 jours.
  const soldeUpdatedAt = safeStorage.getItem("soldeUpdatedAt") || "";
  const soldeJours = (() => {
    if (!soldeUpdatedAt || panique.solde === "") return null;
    const diff = Date.now() - new Date(soldeUpdatedAt).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  })();
  const soldePerime = soldeJours !== null && soldeJours >= 7;
  const soldeFraicheur = (() => {
    if (panique.solde === "") return null;
    if (soldeJours === null) return null;
    if (soldeJours === 0) return "à jour aujourd'hui";
    if (soldeJours === 1) return "mis à jour hier";
    return `mis à jour il y a ${soldeJours} jours`;
  })();

  // --- Calcul central : "Disponible aujourd'hui" ---
  // Source unique de verite, reutilisee partout : dashboard, simulateur d'achat, mode panique, score sante
  const soldeNum = parseFloat(panique.solde) || 0;
  // Autres revenus (salaire, etc.) : ajoutés au disponible UNIQUEMENT si l'utilisateur le choisit.
  // ⚠️ N'entrent JAMAIS dans le calcul URSSAF (qui ne porte que sur le CA auto-entrepreneur).
  const autresRevenusNum = parseFloat(autresRevenus) || 0;
  const bonusAutresRevenus = inclureAutresRevenus ? autresRevenusNum : 0;
  const urssafProvision = estimateData?.disponible !== false
    ? (estimateData?.montant_a_provisionner || 0) +
      (estimateData?.periode_precedente?.jours_restants > 0
        ? Math.round((estimateData.ca_periode_precedente || 0) * ((estimateData?.taux_global_pct || 0) / 100) * 100) / 100
        : 0)
    : 0;
  const activiteInfo = ACTIVITES.find(a => a.id === profile?.activite);
  const revenuImposableAnnuel = activiteInfo ? (estimateData?.ca_annuel || 0) * (1 - activiteInfo.abattement) : 0;
  const impotsAnnuelEstime = Math.round(revenuImposableAnnuel * (parseFloat(tmi) / 100));
  const impotsNum = profile?.versement_liberatoire ? 0 : Math.round((impotsAnnuelEstime / 12) * 100) / 100;
  const cfeNum = parseFloat(panique.cfe) || 0;
  const fraisMoisNum = expensesSummary?.frais_mois || 0;
  const totalChargesAVenir = urssafProvision + impotsNum + cfeNum + fraisMoisNum;
  const securiteNum = parseFloat(objectifSecurite) || 0;
  const disponibleAujourdhui = panique.solde !== "" ? Math.round((soldeNum + bonusAutresRevenus - totalChargesAVenir - securiteNum) * 100) / 100 : null;
  // Argent reellement sur le compte apres charges, AVANT reserve - ne doit jamais etre clampe a 0 a tort
  const argentDisponibleBrut = panique.solde !== "" ? Math.round((soldeNum + bonusAutresRevenus - totalChargesAVenir) * 100) / 100 : null;
  const reserveAtteinte = panique.solde !== "" ? (soldeNum - totalChargesAVenir) >= securiteNum : null;
  const manqueReserveDashboard = (panique.solde !== "" && !reserveAtteinte) ? Math.round((securiteNum - Math.max(0, soldeNum - totalChargesAVenir)) * 100) / 100 : 0;

  // --- Niveau unifié : une seule source de vérité pour le statut financier ---
  // rouge = déficit réel (avant même la réserve) · orange = réserve entamée · vert = situation saine
  const niveauFinancier = argentDisponibleBrut === null ? null
    : argentDisponibleBrut < 0 ? "rouge"
    : disponibleAujourdhui < 0 ? "orange"
    : "vert";

  // --- Score sante HECTOR /100 : 5 composantes ponderees ---
  function calculScoreSante() {
    if (panique.solde === "" || !estimateData || estimateData.disponible === false) return null;
    const dettesNum = parseFloat(panique.dettes) || 0;

    // A. Tresorerie vs charges a venir (30 pts)
    let ptsTreso;
    if (totalChargesAVenir <= 0) ptsTreso = soldeNum >= 0 ? 30 : 0;
    else ptsTreso = Math.max(0, Math.min(30, Math.round((soldeNum / totalChargesAVenir) * 15)));

    // B. Reserve de securite couverte (20 pts)
    let ptsReserve;
    if (securiteNum <= 0) ptsReserve = 20;
    else ptsReserve = Math.max(0, Math.min(20, Math.round(((soldeNum - totalChargesAVenir) / securiteNum) * 20)));

    // C. URSSAF specifiquement provisionnee (20 pts)
    let ptsUrssaf;
    if (urssafProvision <= 0) ptsUrssaf = 20;
    else ptsUrssaf = Math.max(0, Math.min(20, Math.round((soldeNum / urssafProvision) * 20)));

    // D. Regularite du CA mois par mois (15 pts)
    const moisActifs = revenusParMois.filter(m => m.total > 0);
    let ptsRegularite = 7;
    if (moisActifs.length >= 2) {
      const moyenne = moisActifs.reduce((s, m) => s + m.total, 0) / moisActifs.length;
      const variance = moisActifs.reduce((s, m) => s + Math.pow(m.total - moyenne, 2), 0) / moisActifs.length;
      const cv = moyenne > 0 ? Math.sqrt(variance) / moyenne : 1;
      ptsRegularite = Math.max(0, Math.min(15, Math.round((1 - Math.min(cv, 1)) * 15)));
    }

    // E. Endettement vs CA annuel (15 pts)
    let ptsDette;
    if (dettesNum <= 0) ptsDette = 15;
    else {
      const ratioDette = dettesNum / Math.max(estimateData.ca_annuel || 1, 1);
      ptsDette = Math.max(0, Math.min(15, Math.round((1 - Math.min(ratioDette, 1)) * 15)));
    }

    return { total: Math.max(0, Math.min(100, ptsTreso + ptsReserve + ptsUrssaf + ptsRegularite + ptsDette)), ptsTreso, ptsReserve, ptsUrssaf, ptsRegularite, ptsDette };
  }
  const scoreDetail = calculScoreSante();
  const scoreSante = scoreDetail?.total ?? null;
  function scoreInfo(s) {
    if (s === null) return { label: "—", color: "#8BA5C0", desc: "Renseignez votre solde dans Scanner Financier pour calculer votre score." };
    if (s >= 75) return { label: "Excellent", color: "#1D9E75", desc: "Trésorerie, réserve et provisions sont solides." };
    if (s >= 45) return { label: "Correct", color: "#EF9F27", desc: "Quelques points de vigilance à surveiller." };
    return { label: "Risque élevé", color: "#E24B4A", desc: "Plusieurs indicateurs sont dans le rouge — agissez rapidement." };
  }

  // --- Coach prix : modele simplifie "combien facturez-vous", avec bornes realistes ---
  const tarifNum = parseFloat(tarifMontant) || 0;
  const hParJourCoach = Math.min(24, Math.max(0.5, parseFloat(heuresParJour) || 7)); // borne 0.5-24h/jour
  const hParPrestation = Math.min(200, Math.max(0.25, parseFloat(heuresParPrestation) || 3)); // borne realiste
  const jParSemaineCoach = Math.min(7, Math.max(0.5, parseFloat(joursParSemaineCoach) || 5)); // borne 0.5-7j/semaine
  const tauxHoraireReel = (() => {
    if (tarifNum <= 0) return null;
    if (tarifUnite === "heure") return Math.round(tarifNum * 100) / 100;
    if (tarifUnite === "jour") return Math.round((tarifNum / hParJourCoach) * 100) / 100;
    if (tarifUnite === "prestation") return Math.round((tarifNum / hParPrestation) * 100) / 100;
    return null;
  })();
  const revenuJournalierCoach = tauxHoraireReel !== null ? Math.round(tauxHoraireReel * hParJourCoach * 100) / 100 : null;
  const revenuMensuelCoach = revenuJournalierCoach !== null ? Math.round(revenuJournalierCoach * jParSemaineCoach * 4.33) : null;
  const revenuAnnuelCoach = revenuMensuelCoach !== null ? revenuMensuelCoach * 12 : null;
  const objHoraireNum = parseFloat(objectifHoraire) || 0;
  const ecartPctVersObjectif = (tauxHoraireReel !== null && tauxHoraireReel > 0 && objHoraireNum > 0)
    ? Math.round(((objHoraireNum - tauxHoraireReel) / tauxHoraireReel) * 100)
    : null;
  const niveauTarif = tauxHoraireReel === null ? null
    : tauxHoraireReel < 25 ? "rouge" : tauxHoraireReel < 45 ? "jaune" : "vert";
  const haussePctNum = Math.min(100, Math.max(0, parseFloat(haussePct) || 0));
  const tauxHoraireApresHausse = tauxHoraireReel !== null ? Math.round(tauxHoraireReel * (1 + haussePctNum / 100) * 100) / 100 : null;
  const gainMensuelHausse = (revenuMensuelCoach !== null && tauxHoraireApresHausse !== null && tauxHoraireReel)
    ? Math.round(revenuMensuelCoach * (haussePctNum / 100))
    : null;
  const gainAnnuelHausse = gainMensuelHausse !== null ? gainMensuelHausse * 12 : null;

  const [revenuViseMensuel, setRevenuViseMensuel] = useState("");
  const [quickAskQuestions, setQuickAskQuestions] = useState([
    "Combien puis-je me verser ce mois-ci ?",
    "Puis-je acheter un MacBook à 2000€ ?",
    "Quand vais-je dépasser mon plafond ?",
    "Mon activité est-elle en bonne santé ?",
  ]);

  // --- Simulateur de vie : combien gagner pour vivre comme je veux ---
  const revenuViseNum = parseFloat(revenuViseMensuel) || 0;
  const tauxGlobalDec = estimateData ? (estimateData.taux_global_pct || 0) / 100 : 0;
  const caMensuelNecessaire = (revenuViseNum > 0 && tauxGlobalDec < 1) ? Math.round(revenuViseNum / (1 - tauxGlobalDec)) : null;
  const caAnnuelNecessaire = caMensuelNecessaire !== null ? caMensuelNecessaire * 12 : null;
  const urssafAnnuelleVie = caAnnuelNecessaire !== null ? Math.round(caAnnuelNecessaire * tauxGlobalDec) : null;
  const impotsAnnuelsVie = (() => {
    if (caAnnuelNecessaire === null || profile?.versement_liberatoire || !activiteInfo) return 0;
    const revenuImposable = caAnnuelNecessaire * (1 - activiteInfo.abattement);
    return Math.round(revenuImposable * (parseFloat(tmi) / 100));
  })();
  const depassePlafondVie = caAnnuelNecessaire !== null && estimateData?.plafond ? caAnnuelNecessaire > estimateData.plafond : false;

  // --- TVA : detection du depassement du seuil de franchise en base ---
  const seuilTva = activiteInfo?.seuilTva || null;
  const pourcentageSeuilTva = seuilTva && estimateData?.ca_annuel != null ? Math.round((estimateData.ca_annuel / seuilTva) * 100) : null;
  const tvaProche = pourcentageSeuilTva !== null && pourcentageSeuilTva >= 80;
  const tvaDepasse = pourcentageSeuilTva !== null && pourcentageSeuilTva >= 100;

  // --- Mode salaire : combien puis-je me verser (3 niveaux) ---
  const baseSalaire = Math.max(0, disponibleAujourdhui || 0);
  const salairePrudent = Math.round(baseSalaire * 0.4);
  const salaireRecommande = Math.round(baseSalaire * 0.7);
  const salaireMaximum = Math.round(baseSalaire);

  // --- Mois de survie (si l'activite s'arrete demain) ---
  const moisEcoulesAnnee = new Date().getMonth() + 1;
  const moyenneMensuelleCA = estimateData?.ca_annuel != null ? estimateData.ca_annuel / moisEcoulesAnnee : 0;
  const moyenneMensuelleFrais = expensesSummary?.frais_annee ? expensesSummary.frais_annee / moisEcoulesAnnee : 0;
  const baseMensuelleSecurite = moyenneMensuelleFrais > 0 ? moyenneMensuelleFrais : moyenneMensuelleCA;

  // --- Sérénité d'Hector : jours de tranquillité + paliers acquis ---
  // RÈGLE STRICTE : on calcule les jours UNIQUEMENT sur le train de vie déclaré.
  // Pas de fallback (ni CA, ni frais) : ça produisait des résultats absurdes
  // (ex : 25 € de solde → 216 jours parce que les frais déclarés étaient minuscules).
  // Sans train de vie réaliste, Hector reste en mode accueil et invite à le renseigner.
  const trainDeVieNum = parseFloat(depensesMensuelles) || 0;
  const depenseJournaliere = trainDeVieNum > 0 ? trainDeVieNum / 30 : 0;
  // Cas 1 : disponible négatif → 0 jour, alerte directe (pas besoin du train de vie pour le savoir).
  // Cas 2 : train de vie connu + disponible positif → calcul normal.
  // Cas 3 : ni l'un ni l'autre → null (mode accueil).
  let joursTranquillite;
  if (argentDisponibleBrut !== null && argentDisponibleBrut < 0) {
    joursTranquillite = 0;
  } else if (argentDisponibleBrut !== null && argentDisponibleBrut >= 0 && depenseJournaliere > 0) {
    joursTranquillite = Math.max(0, Math.floor(argentDisponibleBrut / depenseJournaliere));
  } else {
    joursTranquillite = null;
  }
  // Date concrète "jusqu'au ..."
  const dateTranquillite = joursTranquillite !== null
    ? new Date(Date.now() + joursTranquillite * 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;
  // Les 6 niveaux-lieux (accomplissements permanents, ne régressent jamais).
  const PALIERS_SERENITE = [
    { seuil: 7, nom: "Hector arrive", court: "7 jours", img: "/niveau-1.png" },
    { seuil: 30, nom: "Son panier", court: "30 jours", img: "/niveau-2.png" },
    { seuil: 90, nom: "Sa niche", court: "90 jours", img: "/niveau-3.png" },
    { seuil: 180, nom: "Son jardin", court: "180 jours", img: "/niveau-4.png" },
    { seuil: 365, nom: "Sa maison", court: "365 jours", img: "/niveau-5.png" },
    { seuil: 730, nom: "Son domaine", court: "730 jours", img: "/niveau-6.png" },
  ];
  const palierRecordRef = useRef(0);
  if (joursTranquillite !== null && joursTranquillite > palierRecordRef.current) {
    palierRecordRef.current = joursTranquillite;
  }
  // Pour cette V1, les niveaux acquis suivent les jours ACTUELS (cohérent avec la situation
  // présente). La logique "record permanent" sera réactivée quand elle sera persistée en base.
  const joursRecord = joursTranquillite || 0;
  const palierAcquisIndex = PALIERS_SERENITE.reduce((acc, p, i) => joursRecord >= p.seuil ? i : acc, -1);
  const palierActuel = palierAcquisIndex >= 0 ? PALIERS_SERENITE[palierAcquisIndex] : null;
  // Niveau ACTUEL (où tu es maintenant, selon tes jours du moment) — distinct du record acquis.
  const palierActuelIndex = (joursTranquillite !== null)
    ? PALIERS_SERENITE.reduce((acc, p, i) => joursTranquillite >= p.seuil ? i : acc, -1)
    : -1;
  // Les 4 états émotionnels d'Hector selon les jours ACTUELS (pas le record).
  function etatHector(j) {
    if (j === null) return { id: "accueil", label: "En attente", couleur: "#FAC775", pastille: "#FAC775",
      titre: "Réveille Hector 🐾", mot: "Pour veiller sur ta tranquillité, j'ai besoin de savoir combien tu dépenses par mois pour vivre. Dis-le moi, et je me mets au travail tout de suite !", img: "/hector-attentif.png", accueil: true };
    if (j >= 90) return { id: "serein", label: "Sérénité", couleur: "#5DCAA5", pastille: "#5DCAA5",
      mot: "Tout va bien, profite ! Je veille sur ta sérénité.", img: "/hector-serein.png" };
    if (j >= 30) return { id: "attentif", label: "Attentif", couleur: "#FAC775", pastille: "#FAC775",
      mot: "Tout va bien, restons attentifs. Gardons un œil ensemble.", img: "/hector-attentif.png" };
    if (j >= 7) return { id: "vigilant", label: "Vigilant", couleur: "#EF9F27", pastille: "#EF9F27",
      mot: "On devrait renforcer un peu ta réserve. Je suis là.", img: "/hector-vigilant.png" };
    return { id: "alerte", label: "Alerte", couleur: "#E24B4A", pastille: "#E24B4A",
      mot: "Viens, on regarde ça ensemble. On va s'en sortir !", img: "/hector-alerte.png" };
  }
  const hectorEtat = etatHector(joursTranquillite);

  // ─── STREAK ÉMOTIONNEL : jours consécutifs d'ouverture ───
  // Calcul au render (pas d'effet de bord ici). La mise à jour se fait dans un useEffect plus bas.
  const streakCount = parseInt(safeStorage.getItem("streakCount") || "0", 10);
  // Paliers émotionnels : Hector évolue avec la fidélité, pas avec un chiffre froid
  const PALIERS_STREAK = [
    { seuil: 365, emoji: "👑", titre: "Gardien légendaire du foyer", mot: "365 jours ensemble. Hector est devenu le gardien légendaire de ta tranquillité. Personne ne veille mieux que lui." },
    { seuil: 180, emoji: "🦴", titre: "Hector adulte", mot: "180 jours. Hector a grandi, il est désormais un adulte serein et solide. Vous formez une vraie équipe." },
    { seuil: 90, emoji: "🏡", titre: "Niche améliorée", mot: "90 jours de fidélité. Hector a maintenant une belle niche, confortable et sûre. Il se sent chez lui." },
    { seuil: 30, emoji: "🧸", titre: "Hector reçoit un jouet", mot: "30 jours d'affilée ! Hector est heureux, il a même reçu un jouet. Continue, il adore ce rituel." },
    { seuil: 14, emoji: "🌱", titre: "Hector grandit", mot: "14 jours ensemble. Hector grandit grâce à toi. Tu prends soin de ta tranquillité, et ça se voit." },
    { seuil: 7, emoji: "🛏️", titre: "Hector dort dans son panier", mot: "7 jours d'affilée. Hector dort paisiblement dans son panier — il se sent en sécurité avec toi." },
  ];
  const palierStreakActuel = PALIERS_STREAK.find(p => streakCount >= p.seuil) || null;
  const prochainPalierStreak = [...PALIERS_STREAK].reverse().find(p => streakCount < p.seuil) || null;

  // ─── BRIEFING DU MATIN : Hector a "réfléchi pendant la nuit" ───
  // Construit un briefing structuré et contextuel selon la vraie situation financière.
  const briefingMatin = (() => {
    const prenom = profilPrenom || "";
    const heure = new Date().getHours();
    const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";
    const dispo = argentDisponibleBrut;

    // Ce qu'Hector "garde au chaud"
    const gardeAuChaud = [];
    if (urssafProvision > 0) gardeAuChaud.push({ label: "URSSAF", montant: urssafProvision });
    if (impotsNum > 0) gardeAuChaud.push({ label: "Impôts", montant: impotsNum });
    if (securiteNum > 0) gardeAuChaud.push({ label: "Réserve de sécurité", montant: securiteNum });

    // Analyse + conseil selon l'état
    let ton, analyse, conseil, alerte = null;
    if (dispo === null) {
      ton = "neutre";
      analyse = "Je n'ai pas encore assez d'infos pour veiller sur toi. Donne-moi ton solde, et je me mets au travail.";
      conseil = "Renseigne ton solde bancaire pour que je commence à calculer ta tranquillité.";
    } else if (joursTranquillite !== null && joursTranquillite < 7) {
      ton = "alerte";
      alerte = `Ta tréso tient environ ${joursTranquillite} jour${joursTranquillite > 1 ? "s" : ""} à ton rythme de vie actuel. On reste vigilants ensemble.`;
      analyse = "Ton coussin de sécurité est mince en ce moment. Rien de dramatique, mais on garde l'œil ouvert.";
      conseil = "Évite les dépenses non essentielles cette semaine, et priorise les encaissements en attente.";
    } else if (joursTranquillite !== null && joursTranquillite < 30) {
      ton = "vigilant";
      analyse = `Ta situation est correcte : tu as de quoi tenir environ ${joursTranquillite} jours sereinement.`;
      conseil = "Si tu peux, renforce un peu ta réserve ce mois-ci pour passer en zone confortable.";
    } else {
      ton = "serein";
      analyse = reserveAtteinte
        ? "Ton activité est stable et ta réserve de sécurité est constituée. Tu es en bonne posture."
        : "Ton activité est stable. Continue comme ça, ta réserve se construit.";
      conseil = reserveAtteinte
        ? "Tu peux te verser un complément ce mois-ci sans prendre de risque."
        : "Mets un peu de côté ce mois-ci pour finir de constituer ta réserve, et tu seras totalement tranquille.";
    }

    return { salut, prenom, dispo, gardeAuChaud, ton, analyse, conseil, alerte };
  })();

  // ─── PENSÉE PPa : conseil rare, seulement si CA modeste, max 1× / 60 jours ───
  // Hector suggère de vérifier l'éligibilité à la Prime d'activité. Il ne promet rien.
  const penseePPa = (() => {
    if (argentDisponibleBrut === null) return null;        // pas assez d'infos → silence
    if (!(moyenneMensuelleCA > 0)) return null;            // pas de CA connu → silence
    if (moyenneMensuelleCA > 3000) return null;            // CA clairement trop élevé → on ne dit rien
    const force = safeStorage.getItem("hectorForce") === "ppa";
    // Anti-répétition : pas plus d'une fois tous les 60 jours
    if (!force) {
      const derniere = safeStorage.getItem("hectorPPaVue");
      if (derniere) {
        const jours = (Date.now() - new Date(derniere).getTime()) / 86400000;
        if (jours < 60) return null;
      }
      // Rare : ~1 jour sur 5 quand les conditions sont réunies
      const today = new Date().toISOString().slice(0, 10);
      const seed = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
      if (seed % 5 !== 2) return null;
    }
    return "🐾 Dis donc… tu sais que pas mal d'indépendants ont droit à la Prime d'activité sans le savoir ? C'est la CAF qui complète quand les revenus sont modestes. Ça vaut peut-être le coup de faire une simu sur caf.fr — c'est gratuit et ça prend 5 minutes. Je dis ça, je dis rien.";
  })();

  // ─── LES PENSÉES D'HECTOR : rares, contextuelles, jamais forcées ───
  // Règle d'or : si Hector n'a rien de vrai à dire, il ne dit RIEN.
  // Une pensée par jour MAX, et seulement ~1 jour sur 3 (sélection déterministe par date).
  const penseeHector = (() => {
    if (argentDisponibleBrut === null) return null; // pas assez d'infos → silence
    const force = safeStorage.getItem("hectorForce") === "pensee";
    const today = new Date().toISOString().slice(0, 10);
    // Déterminisme : un "dé" basé sur la date, stable sur la journée
    const seed = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
    // ~1 jour sur 3 seulement : si le seed n'est pas dans le bon tiers, silence
    if (!force && seed % 3 !== 0) return null;
    // Déjà vue aujourd'hui ? On la garde affichée mais on ne régénère pas
    // Pool contextuel : on ne pioche que dans ce qui correspond à la VRAIE situation
    let pool = [];
    if (joursTranquillite !== null && joursTranquillite < 7) {
      pool = [
        "Je garde un œil sur les dépenses, ne t'inquiète pas. On traverse ça ensemble.",
        "C'est un peu serré en ce moment, mais je suis là. On va remonter la pente.",
      ];
    } else if (reserveAtteinte === true) {
      pool = [
        "Je suis fier de toi aujourd'hui.",
        "La maison est calme, j'aime quand tout est sous contrôle.",
        "J'ai vérifié les réserves cette nuit, tout va bien.",
        "Tu travailles dur ces derniers temps, ça se voit.",
      ];
    } else {
      pool = [
        "Tu avances bien. Encore un petit effort et la maison sera totalement à l'abri.",
        "Je veille, même quand tu ne regardes pas. Tout est sous mon œil.",
      ];
    }
    if (pool.length === 0) return null;
    return "🐾 " + pool[seed % pool.length];
  })();

  // ─── SOUVENIR À RAPPELER : Hector se souvient, en langage humain ───
  // Affiché rarement (~1 jour sur 4), un seul à la fois, le plus émouvant disponible.
  const souvenirHector = (() => {
    let souvenirs;
    try { souvenirs = JSON.parse(safeStorage.getItem("hectorSouvenirs") || "{}"); } catch { return null; }
    const force = safeStorage.getItem("hectorForce") === "souvenir";
    const today = new Date().toISOString().slice(0, 10);
    const seed = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
    if (!force && seed % 4 !== 1) return null; // ~1 jour sur 4
    const formatDate = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); } catch { return ""; } };
    // On ne rappelle pas un souvenir tout frais (au moins quelques jours d'écart)
    const assezAncien = (iso) => { try { return force || (Date.now() - new Date(iso).getTime()) > 5 * 86400000; } catch { return false; } };
    const candidats = [];
    if (souvenirs.premiere_reserve && assezAncien(souvenirs.premiere_reserve))
      candidats.push(`Je me souviens du jour où on a sécurisé ta réserve pour la première fois, le ${formatDate(souvenirs.premiere_reserve)}. Depuis, la maison est beaucoup plus solide.`);
    if (souvenirs.sortie_alerte && assezAncien(souvenirs.sortie_alerte))
      candidats.push(`Tu te souviens quand on était en zone d'alerte ? Regarde où on en est aujourd'hui. Le chemin parcouru, c'est grâce à toi.`);
    if (souvenirs.record_treso && assezAncien(souvenirs.record_treso))
      candidats.push(`Le ${formatDate(souvenirs.record_treso)}, tu as atteint ton meilleur niveau de trésorerie. Je l'ai noté quelque part dans ma tête de chien.`);
    if (souvenirs.premier_positif && assezAncien(souvenirs.premier_positif))
      candidats.push(`Je repense parfois au ${formatDate(souvenirs.premier_positif)}, le premier jour où tu es passé dans le vert. C'était le début de quelque chose.`);
    if (streakCount >= 100)
      candidats.push(`Ça fait plus de 100 jours qu'on fait ça ensemble, toi et moi. Je ne suis qu'un chien, mais je crois que je me suis attaché.`);
    if (candidats.length === 0) return null;
    return "🐾 " + candidats[seed % candidats.length];
  })();
  const securitePrecise = moyenneMensuelleFrais > 0; // true si base sur vos vrais Frais d'entreprise, false si approxime sur le CA
  const tresorerieApresDettes = soldeNum - totalChargesAVenir;
  const moisSurvie = baseMensuelleSecurite > 0 && panique.solde !== "" ? Math.max(0, Math.round((tresorerieApresDettes / baseMensuelleSecurite) * 10) / 10) : null;
  const joursSurvie = moisSurvie !== null ? Math.round(moisSurvie * 30) : null;
  const dateRupture = joursSurvie !== null ? new Date(Date.now() + joursSurvie * 86400000) : null;

  // ─── SOUVENIRS D'HECTOR : détecte et mémorise les moments marquants ───
  // Stockés en localStorage avec la date du jour où ils sont survenus pour la 1ère fois.
  // Hector pourra les rappeler plus tard, en langage humain.
  useEffect(() => {
    if (!token || argentDisponibleBrut === null) return;
    const lire = () => { try { return JSON.parse(safeStorage.getItem("hectorSouvenirs") || "{}"); } catch { return {}; } };
    const souvenirs = lire();
    const today = new Date().toISOString().slice(0, 10);
    let modifie = false;
    const noter = (cle) => { if (!souvenirs[cle]) { souvenirs[cle] = today; modifie = true; } };

    // Première réserve de sécurité atteinte
    if (reserveAtteinte === true) noter("premiere_reserve");
    // Premier mois positif (disponible brut > 0)
    if (argentDisponibleBrut > 0) noter("premier_positif");
    // Record de trésorerie : on garde le max vu
    const recordActuel = parseFloat(safeStorage.getItem("hectorRecordTreso") || "0");
    if (argentDisponibleBrut > recordActuel && argentDisponibleBrut > 0) {
      safeStorage.setItem("hectorRecordTreso", String(argentDisponibleBrut));
      if (recordActuel > 0) noter("record_treso"); // pas au tout premier (sinon trivial)
    }
    // Sortie de zone d'alerte : on a connu l'alerte, et là on n'y est plus
    if (joursTranquillite !== null && joursTranquillite < 7) {
      if (!souvenirs._aDejaEteEnAlerte) { souvenirs._aDejaEteEnAlerte = today; modifie = true; }
    } else if (souvenirs._aDejaEteEnAlerte && joursTranquillite !== null && joursTranquillite >= 30) {
      noter("sortie_alerte");
    }

    if (modifie) safeStorage.setItem("hectorSouvenirs", JSON.stringify(souvenirs));
  }, [token, argentDisponibleBrut, reserveAtteinte, joursTranquillite]);

  // ─── MOTEUR DE DÉCISION D'HECTOR — 100% local, zéro crédit, totalement transparent ───
  // Simule l'impact d'un achat ou d'un versement sur la situation réelle.
  // Retourne un verdict 🟢🟠🔴 + tout le détail du raisonnement (pour le bouton "Pourquoi ?").
  // RÈGLE : ne devine jamais. Si données insuffisantes → verdict "inconnu" + message honnête.
  function verdictHector(montant, type = "achat") {
    const m = parseFloat(montant) || 0;
    const regime = getRegime(profile?.activite);
    // Données nécessaires : un solde renseigné
    if (panique.solde === "" || argentDisponibleBrut === null) {
      return {
        verdict: "inconnu",
        titre: "Il me manque une info",
        message: "Donne-moi d'abord ton solde bancaire, et je pourrai te répondre précisément.",
        details: null,
      };
    }
    if (m <= 0) {
      return { verdict: "inconnu", titre: "Indique un montant", message: "Dis-moi combien tu veux dépenser ou te verser.", details: null };
    }

    // Situation AVANT
    const dispoAvant = argentDisponibleBrut; // après charges, avant réserve
    const joursAvant = joursTranquillite;
    // Situation APRÈS (un achat ou un versement réduit le disponible d'autant)
    const dispoApres = Math.round((dispoAvant - m) * 100) / 100;
    const depenseJour = (parseFloat(depensesMensuelles) || 0) / 30;
    const joursApres = depenseJour > 0 ? Math.max(0, Math.floor(Math.max(0, dispoApres) / depenseJour)) : null;
    // Réserve : est-elle préservée après l'opération ?
    const reserveApres = dispoApres >= securiteNum;
    const passeSousReserve = !reserveApres && dispoAvant >= securiteNum; // l'opération entame la réserve
    const passeNegatif = dispoApres < 0;

    // Verdict
    let verdict, titre, message;
    if (passeNegatif) {
      verdict = "rouge";
      titre = type === "versement" ? "Pas ce montant, là" : "Je te déconseille cet achat";
      message = `Si tu ${type === "versement" ? "te verses" : "sors"} ${formatEUR(m)}, tu passes en négatif (${formatEUR(dispoApres)}). Ça veut dire que tu n'aurais plus de quoi couvrir tes charges à venir.`;
    } else if (passeSousReserve) {
      verdict = "orange";
      titre = "Possible, mais prudence";
      message = `Tu peux le faire, mais ça entame ta réserve de sécurité. Il te resterait ${formatEUR(dispoApres)}, en dessous de ta réserve de ${formatEUR(securiteNum)}.`;
    } else {
      verdict = "vert";
      titre = type === "versement" ? "Oui, tu peux te le verser" : "Oui, tu peux y aller";
      message = `Après ${type === "versement" ? "ce versement" : "cet achat"}, il te reste ${formatEUR(dispoApres)} et ta réserve de sécurité reste intacte. C'est raisonnable.`;
    }

    return {
      verdict,
      titre,
      message,
      details: {
        regimeLabel: regime.label,
        tauxCotisations: regime.tauxCotisations,
        abattementFiscal: regime.abattementFiscal,
        seuilTVA: regime.seuilTVA,
        montant: m,
        type,
        dispoAvant,
        dispoApres,
        reserve: securiteNum,
        reserveApres,
        joursAvant,
        joursApres,
        version: FISCALITE.version,
      },
    };
  }

  // --- Projections fin de mois / fin d'annee, pour le Dashboard ---
  const aujourdhui = new Date();
  const jourDuMois = aujourdhui.getDate();
  const joursDansLeMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0).getDate();
  const caCeMoisCi = revenusParMois[aujourdhui.getMonth()]?.total || 0;
  const projectionFinMois = jourDuMois > 0 ? Math.round((caCeMoisCi / jourDuMois) * joursDansLeMois) : caCeMoisCi;
  const projectionFinAnnee = estimateData ? Math.round(moyenneMensuelleCA * 12) : null;

  if (legalPage) {
    return <LegalPageView page={legalPage} onBack={() => setLegalPage(null)} />;
  }

  if (resetToken) {
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={110} dark />
          <h1 style={S.authHero}>Nouveau mot de passe</h1>
          <p style={S.authSub}>Choisissez un nouveau mot de passe pour votre compte H€CTOR.</p>
        </div>
        <div style={S.authRight}>
          <div style={S.authCard}>
            {resetStatus === "success" ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h2 style={S.authTitle}>Mot de passe mis à jour</h2>
                <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 20 }}>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                <button style={S.btnPrimary} onClick={() => { window.location.href = "/"; }}>Aller à la connexion</button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <h2 style={S.authTitle}>Nouveau mot de passe</h2>
                {resetStatus === "error" && <div style={S.errorBanner}>{resetMessage}</div>}
                <label style={S.label}>Nouveau mot de passe
                  <input style={S.input} type="password" value={resetPassword1} onChange={e => setResetPassword1(e.target.value)} minLength={8} required />
                </label>
                <label style={S.label}>Confirmer le mot de passe
                  <input style={S.input} type="password" value={resetPassword2} onChange={e => setResetPassword2(e.target.value)} minLength={8} required />
                </label>
                <button style={S.btnPrimary} type="submit" disabled={resetStatus === "loading"}>{resetStatus === "loading" ? "…" : "Valider le nouveau mot de passe"}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (verifyToken) {
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={110} dark />
          <h1 style={S.authHero}>Vérification de votre email</h1>
        </div>
        <div style={S.authRight}>
          <div style={{ ...S.authCard, textAlign: "center" }}>
            {verifyStatus === "loading" && <p style={{ fontSize: 13, color: "#6B7A8D" }}>Vérification en cours…</p>}
            {verifyStatus === "success" && (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <h2 style={S.authTitle}>Email confirmé !</h2>
                <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 20 }}>Votre adresse email est maintenant vérifiée.</p>
                <button style={S.btnPrimary} onClick={() => { window.location.href = "/"; }}>Continuer vers H€CTOR</button>
              </>
            )}
            {verifyStatus === "error" && (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                <h2 style={S.authTitle}>Lien invalide ou expiré</h2>
                <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 20 }}>Reconnectez-vous à H€CTOR, vous pourrez demander un nouveau lien depuis votre profil.</p>
                <button style={S.btnPrimary} onClick={() => { window.location.href = "/"; }}>Aller à la connexion</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN DE CHOIX DE STATUT — affiché quand on n'est pas connecté et qu'aucun
  // statut n'a encore été choisi. Les deux "portes" : auto-entrepreneur (en
  // premier, produit le plus avancé) et intermittent (fake door + email).
  if (!token && !landingStatut) {
    const carte = (statut, hectorImg, fallbackIcon, titre, sousTitre) => (
      <button
        type="button"
        onClick={() => chooseLandingStatut(statut)}
        style={{ width: "100%", background: "#11203a", border: "1px solid #2a3a55", borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#5DCAA5"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#2a3a55"}
      >
        <div style={{ width: 64, height: 64, borderRadius: 12, background: "#0a1322", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          <NiveauImage src={hectorImg} fallbackIcon={fallbackIcon} fallbackColor="#3a5169" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "white", fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{titre}</div>
          <div style={{ color: "#8BA5C0", fontSize: 12.5, lineHeight: 1.5 }}>{sousTitre}</div>
        </div>
        <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18 }} />
      </button>
    );
    return (
      <div style={{ background: "#07192E", minHeight: "100vh", color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{CSS}</style>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
            <Logo size={32} dark />
          </div>
          <div style={{ color: "white", fontSize: 22, fontWeight: 700, lineHeight: 1.35, marginBottom: 6 }}>Salut, moi c'est Hector.</div>
          <div style={{ color: "#8BA5C0", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>Avant de veiller sur ta tranquillité,<br />dis-moi qui tu es.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {carte("auto_entrepreneur", "/hector-panier.png", "ti-dog", "Je suis auto-entrepreneur", "Je te dis ce que tu peux vraiment dépenser, sans l'URSSAF qui surprend.")}
            {carte("intermittent", "/hector-clap.png", "ti-movie", "Je suis intermittent du spectacle", "Je compte tes heures et tes cachets vers tes 507h.")}
          </div>
          <div style={{ marginTop: 22, color: "#6B8299", fontSize: 11.5, lineHeight: 1.5 }}>
            <i className="ti ti-info-circle" aria-hidden="true" /> Tu fais les deux ? Choisis pour commencer,<br />tu pourras activer l'autre cockpit plus tard.
          </div>
        </div>
      </div>
    );
  }

  // LANDING INTERMITTENT — jumelle visuelle de la landing AE, cerveau "heures".
  // Toutes les features sont des aperçus (le module n'est pas codé) : chaque bouton
  // ouvre la modale "à venir + email" (fake door pour mesurer la demande réelle).
  if (!token && landingStatut === "intermittent") {
    const submitIntermittent = async () => {
      const email = intermittentEmail.trim();
      if (!email || !email.includes("@")) return;
      setIntermittentSending(true);
      try {
        // ⚠️ REMPLACE cette URL par TON endpoint Formspree (formspree.io, gratuit).
        await fetch("https://formspree.io/f/TON_ID_FORMSPREE", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, statut: "intermittent", source: "landing_hector" }),
        });
        setIntermittentSent(true);
      } catch {
        setIntermittentSent(true);
      } finally {
        setIntermittentSending(false);
      }
    };
    // L'intermittent est désormais OUVERT : les boutons mènent au formulaire
    // d'inscription présent sur cette même landing (section plus bas).
    const ouvrirAvenir = () => {
      setAuthMode("register");
      setTimeout(() => {
        document.getElementById("inter-auth-section")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    };

    // Simulateur heures OU cachets (1 cachet = 12h). Pas de mélange : soit l'un, soit l'autre.
    const saisieNum = Math.max(0, parseInt(simCachetsLanding) || 0);
    const heuresCalc = simModeLanding === "cachets" ? saisieNum * 12 : saisieNum;
    const totalDemo = Math.min(507, heuresCalc);
    const manqueDemo = Math.max(0, 507 - totalDemo);

    return (
      <div style={{ background: "#07192E", minHeight: "100vh", color: "white", fontFamily: "inherit" }}>
        <style>{CSS}</style>

        {/* ===== NAVBAR ===== */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,25,46,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={32} dark />
            <button onClick={() => chooseLandingStatut("auto_entrepreneur")} title="Passer en mode auto-entrepreneur" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 20, padding: "5px 11px", color: "#5DCAA5", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
              <i className="ti ti-dog" aria-hidden="true" /> Passer en mode auto-entrepreneur <i className="ti ti-arrow-right" aria-hidden="true" style={{ opacity: 0.7, fontSize: 13 }} />
            </button>
          </div>
          <button onClick={() => { setAuthMode("login"); setTimeout(() => document.getElementById("inter-auth-section")?.scrollIntoView({ behavior: "smooth" }), 50); }} style={{ background: "#5DCAA5", border: "none", color: "#07192E", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Se connecter
          </button>
        </nav>

        {/* ===== HERO ===== */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "48px 20px 32px" : "72px 40px 48px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 40, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#5DCAA5", marginBottom: 20, textTransform: "uppercase" }}>Ton cockpit d'intermittent</div>
            <h1 style={{ fontSize: isMobile ? 26 : 48, fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px", color: "white" }}>
              Ne te demande plus<br />où tu en es.<br />
              <span style={{ color: "#5DCAA5" }}>H€CTOR compte tes<br />heures pour toi.</span>
            </h1>
            <p style={{ fontSize: 16, color: "#B5D4F4", lineHeight: 1.65, margin: "0 0 32px", maxWidth: 460 }}>
              H€CTOR additionne tes cachets et tes heures automatiquement, et te dit si tu es dans les temps pour ton renouvellement. Pour que tu dormes tranquille.
            </p>
            <button onClick={ouvrirAvenir} style={{ background: "#5DCAA5", color: "#07192E", border: "none", borderRadius: 10, padding: "15px 28px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              Créer mon compte gratuitement <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {["Aucune carte bancaire", "Sans engagement", "507h sous contrôle"].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8BA5C0" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", position: "relative", marginLeft: isMobile ? 0 : -40 }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
              <img src="/hector-clap.png" alt="Hector sur un plateau de tournage" style={{ width: "100%", display: "block", objectFit: "contain", filter: "brightness(1.15) contrast(1.05)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,25,46,0) 60%, #07192E 98%)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(7,25,46,0) 55%, #07192E 100%)" }} />
            </div>
          </div>
        </section>

        {/* ===== BLOC PROBLÈME + SIMULATEUR CACHETS→HEURES ===== */}
        <section style={{ maxWidth: 1160, margin: "0 auto 0", padding: isMobile ? "0 20px 32px" : "0 40px 40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "stretch" }}>
            <div style={{ background: "rgba(226,75,74,0.07)", border: "1px solid rgba(226,75,74,0.25)", borderRadius: 14, padding: isMobile ? "18px 20px" : "22px 32px", display: "flex", alignItems: "flex-start", gap: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(226,75,74,0.15)", border: "1px solid rgba(226,75,74,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F09595" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#F09595", marginBottom: 10, textTransform: "uppercase" }}>Le problème</div>
                <div style={{ fontSize: isMobile ? 15 : 17, color: "#EAF2FB", lineHeight: 1.6 }}>
                  Tu fais plein de cachets.<br />
                  Tu te crois <strong style={{ color: "white" }}>large</strong>.<br />
                  Puis la date anniversaire arrive.
                </div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5DCAA5", textTransform: "uppercase", marginBottom: 12 }}>Calcule tes heures</div>
              {/* Toggle heures / cachets */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: 3 }}>
                {[
                  { v: "heures", label: "En heures" },
                  { v: "cachets", label: "En cachets" },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setSimModeLanding(opt.v)}
                    style={{ flex: 1, background: simModeLanding === opt.v ? "#5DCAA5" : "transparent", color: simModeLanding === opt.v ? "#04342C" : "#8BA5C0", border: "none", borderRadius: 6, padding: "7px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <input type="number" value={simCachetsLanding} min="0" onChange={e => setSimCachetsLanding(e.target.value)}
                  style={{ width: "100%", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 6, padding: "8px 70px 8px 12px", fontSize: 15, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box" }} />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#5DCAA5", fontSize: 12, fontWeight: 700 }}>{simModeLanding === "cachets" ? "cachets" : "heures"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#0d2440", borderRadius: 8, padding: "10px 14px", border: "1px solid #1e3a5f" }}>
                  <div style={{ fontSize: 9, color: "#8BA5C0", marginBottom: 3 }}>{simModeLanding === "cachets" ? "1 cachet = 12h, soit" : "ça fait"}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#5DCAA5" }}>{heuresCalc} h</div>
                </div>
                <div style={{ flex: 1, background: "rgba(93,202,165,0.07)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(93,202,165,0.25)" }}>
                  <div style={{ fontSize: 9, color: "#5DCAA5", marginBottom: 3 }}>Sur tes 507h</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{totalDemo} / 507 h</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== DÉMO COMPTEUR + PARLE À HECTOR ===== */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "0 20px 48px" : "0 40px 56px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          <div style={{ background: "rgba(93,202,165,0.06)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#5DCAA5", marginBottom: 18, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#5DCAA5", fontSize: 14 }}>✓</span> H€CTOR calcule pour toi
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 20, textAlign: "center" }}>444 h faites</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Tes cachets cette année", val: "37 cachets" },
                { label: "Convertis en heures (× 12h)", val: "+ 444 h" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, color: "#B5D4F4" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "#5DCAA5", fontSize: 15 }}>✓</span> {r.label}</span>
                  <span style={{ color: "#5DCAA5", fontWeight: 600 }}>{r.val}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid rgba(93,202,165,0.2)", paddingTop: 16, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#8BA5C0", marginBottom: 4 }}>il te manque</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#5DCAA5" }}>63 h</div>
              <div style={{ fontSize: 13, color: "#B5D4F4", marginTop: 6 }}>Au rythme actuel, tu renouvelleras sans problème.</div>
            </div>
          </div>

          <div style={{ background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.25)", borderRadius: 16, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: ACCENT, marginBottom: 18, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: ACCENT, fontSize: 14 }}>💬</span> Parle à H€CTOR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: ACCENT, color: "white", borderRadius: "12px 12px 3px 12px", padding: "10px 14px", fontSize: 13.5, maxWidth: "85%", fontWeight: 500, lineHeight: 1.45 }}>
                  Si j'accepte ce contrat de 15 jours,<br />ça me fait combien d'heures ?
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", alignSelf: "flex-end", marginLeft: 6, whiteSpace: "nowrap" }}>10:42</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <img src="/hector-tete.png" alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ background: "rgba(255,255,255,0.07)", color: "#EAF2FB", borderRadius: "12px 12px 12px 3px", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.45 }}>
                  <span style={{ color: "#5DCAA5" }}>✓</span> +85 h → tu passes à 529 h. Tu sécurises ton renouvellement.
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", whiteSpace: "nowrap" }}>10:42</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: ACCENT, color: "white", borderRadius: "12px 12px 3px 12px", padding: "10px 14px", fontSize: 13.5, maxWidth: "85%", fontWeight: 500 }}>
                  Et il me reste combien avant ma date anniversaire ?
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", alignSelf: "flex-end", marginLeft: 6, whiteSpace: "nowrap" }}>10:45</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <img src="/hector-tete.png" alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ background: "rgba(255,255,255,0.07)", color: "#EAF2FB", borderRadius: "12px 12px 12px 3px", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.45 }}>
                  <span style={{ color: "#5DCAA5" }}>✓</span> 47 jours. Je garde un œil dessus avec toi.
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", whiteSpace: "nowrap" }}>10:45</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== GRILLE FEATURES ===== */}
        <section style={{ background: "rgba(255,255,255,0.025)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "40px 20px" : "52px 40px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#5DCAA5", textAlign: "center", marginBottom: 36, textTransform: "uppercase" }}>Tout ce qu'H€CTOR fera pour toi</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 16 : 24 }}>
              {[
                { icon: "ti-gauge", t: "Compteur 507h", d: "Où tu en es, en direct. Tes cachets convertis et additionnés tout seuls." },
                { icon: "ti-calendar-clock", t: "Alerte renouvellement", d: "Hector te prévient des mois avant ta date anniversaire, jamais pris de court." },
                { icon: "ti-folder", t: "Coffre à AEM", d: "Prends tes attestations en photo, Hector lit les heures et range tout." },
                { icon: "ti-message", t: "Simulateur de contrat", d: "« Si j'accepte ce contrat, ça me fait combien d'heures ? » Hector te répond." },
                { icon: "ti-eye", t: "Calcul transparent", d: "Hector ne devine jamais. Il montre toujours le détail de ses calculs." },
                { icon: "ti-file-text", t: "Attestation revenus", d: "Un récap propre de tes revenus à présenter à un proprio ou une banque." },
              ].map(f => (
                <div key={f.t} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px" }}>
                  <i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 22, color: "#5DCAA5" }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "white", margin: "10px 0 6px" }}>{f.t}</div>
                  <div style={{ fontSize: 13, color: "#8BA5C0", lineHeight: 1.55 }}>{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA FINAL + FORMULAIRE D'INSCRIPTION ===== */}
        <section id="inter-auth-section" style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "48px 20px" : "64px 40px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 48, alignItems: "center" }}>
          {/* Gauche — promesse */}
          <div>
            <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 16px" }}>
              Dors enfin tranquille<br />sur tes 507 heures.
            </h2>
            <p style={{ fontSize: 15, color: "#8BA5C0", lineHeight: 1.6, margin: "0 0 24px" }}>
              Hector veille pendant que tu fais ton métier.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Ton compteur 507h toujours à jour",
                "Cachets et heures comptés automatiquement",
                "Alerté avant ta date anniversaire",
              ].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: isMobile ? 13 : 14, color: "#B5D4F4", wordBreak: "break-word" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Droite — formulaire (identique à la landing AE) */}
          <div style={{ background: "white", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 28px", boxSizing: "border-box", width: "100%" }}>
            {forgotMode ? (
              <div>
                <h2 style={{ ...S.authTitle, marginBottom: 16 }}>Mot de passe oublié</h2>
                {forgotStatus === "sent" ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
                    <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 20, lineHeight: 1.6 }}>
                      Si un compte existe avec <strong>{forgotEmail}</strong>, vous recevrez un lien de réinitialisation.
                    </p>
                    <button type="button" style={S.btnSecondary} onClick={() => { setForgotMode(false); setForgotStatus(""); setForgotEmail(""); }}>Retour à la connexion</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword}>
                    <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                    <label style={S.label}>Email<input style={S.input} type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required /></label>
                    <button style={S.btnPrimary} type="submit" disabled={forgotStatus === "loading"}>{forgotStatus === "loading" ? "…" : "Envoyer le lien"}</button>
                    <p style={S.switchAuth}><button type="button" style={S.linkBtn} onClick={() => setForgotMode(false)}>← Retour à la connexion</button></p>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleAuth}>
                <h2 style={{ ...S.authTitle, marginBottom: 20 }}>{authMode === "login" ? "Connexion" : "Créer mon compte intermittent"}</h2>
                {!pwaDismissed && <InstallBanner pwaPrompt={pwaPrompt} onInstall={handleInstallClick} onDismiss={dismissPwa} showHelp={showInstallHelp} compact />}
                {error && <div style={S.errorBanner}>{error}</div>}
                <div ref={googleButtonRefInter} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }} />
                <p style={S.orDivider}>ou avec un email</p>
                <label style={S.label}>Email<input style={S.input} type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required /></label>
                <label style={S.label}>Mot de passe<input style={S.input} type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} minLength={8} required /></label>
                {authMode === "login" && (
                  <p style={{ textAlign: "right", marginTop: -8, marginBottom: 14 }}>
                    <button type="button" style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => setForgotMode(true)}>Mot de passe oublié ?</button>
                  </p>
                )}
                <button style={{ ...S.btnPrimary, background: "#5DCAA5", color: "#07192E" }} type="submit" disabled={loading}>
                  {loading ? "…" : authMode === "login" ? "Se connecter" : "Créer mon compte gratuitement"}
                </button>
                <p style={S.switchAuth}>
                  {authMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
                  <button type="button" style={S.linkBtn} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                    {authMode === "login" ? "Créer un compte" : "Se connecter"}
                  </button>
                </p>
              </form>
            )}
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "24px 40px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { page: "mentions", label: "Mentions légales" },
              { page: "cgu", label: "CGU" },
              { page: "confidentialite", label: "Confidentialité" },
            ].map(l => (
              <button key={l.page} type="button" style={{ background: "none", border: "none", color: "#4A6280", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setLegalPage(l.page)}>{l.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4A6280" }}>Fait avec 🐾 pour les intermittents</div>
        </footer>

        {/* ===== MODALE "À VENIR" + EMAIL (fake door) ===== */}
        {showIntermittentAvenir && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,12,24,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowIntermittentAvenir(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#0d1f38", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 18, padding: isMobile ? "28px 22px" : "36px 40px", maxWidth: 440, width: "100%", textAlign: "center", position: "relative" }}>
              <button onClick={() => setShowIntermittentAvenir(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#4A6280", fontSize: 20, cursor: "pointer", fontFamily: "inherit" }} aria-label="Fermer"><i className="ti ti-x" aria-hidden="true" /></button>
              <div style={{ width: 96, height: 96, margin: "0 auto 18px", borderRadius: 16, background: "#0a1322", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <NiveauImage src="/hector-clap.png" fallbackIcon="ti-movie" fallbackColor="#3a5169" />
              </div>
              {!intermittentSent ? (
                <>
                  <div style={{ color: "white", fontSize: 21, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>Hector arrive très bientôt.</div>
                  <div style={{ color: "#8BA5C0", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>On prépare le cockpit intermittent avec soin. Laisse ton email, tu seras le premier prévenu — et tu auras le tarif fondateur.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input type="email" value={intermittentEmail} onChange={e => setIntermittentEmail(e.target.value)} placeholder="ton@email.fr" onKeyDown={e => { if (e.key === "Enter") submitIntermittent(); }}
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "12px 14px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", textAlign: "center" }} />
                    <button type="button" onClick={submitIntermittent} disabled={intermittentSending}
                      style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: intermittentSending ? "default" : "pointer", fontFamily: "inherit", opacity: intermittentSending ? 0.6 : 1 }}>
                      {intermittentSending ? "…" : "Préviens-moi 🐾"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: "white", fontSize: 21, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>C'est noté, merci !</div>
                  <div style={{ color: "#8BA5C0", fontSize: 14, lineHeight: 1.6 }}>Je te préviens dès qu'Hector est prêt à compter tes heures. À très vite. 🐾</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Landing auto-entrepreneur (atteinte uniquement si landingStatut === "auto_entrepreneur",
  // les cas null et "intermittent" étant déjà gérés par les deux blocs ci-dessus).
  if (!token) {
    const scrollToAuth = () => { document.getElementById("hector-auth-section")?.scrollIntoView({ behavior: "smooth" }); };
    return (
      <div style={{ background: "#07192E", minHeight: "100vh", color: "white", fontFamily: "inherit" }}>
        <style>{CSS}</style>

        {/* ===== NAVBAR ===== */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,25,46,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={32} dark />
            <button
              onClick={() => chooseLandingStatut("intermittent")}
              title="Passer en mode intermittent"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 20, padding: "5px 11px", color: "#5DCAA5", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}
            >
              <i className="ti ti-movie" aria-hidden="true" /> Passer en mode intermittent <i className="ti ti-arrow-right" aria-hidden="true" style={{ opacity: 0.7, fontSize: 13 }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => { setAuthMode("login"); scrollToAuth(); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Se connecter
            </button>
            <button onClick={() => { setAuthMode("register"); scrollToAuth(); }} style={{ background: "#5DCAA5", border: "none", color: "#07192E", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Créer un compte
            </button>
          </div>
        </nav>

        {/* ===== HERO ===== */}
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "48px 20px 32px" : "72px 40px 48px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 40, alignItems: "center" }}>
          {/* Gauche */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#5DCAA5", marginBottom: 20, textTransform: "uppercase" }}>Ton cockpit financier</div>
            <h1 style={{ fontSize: isMobile ? 26 : 48, fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px", color: "white" }}>
              Ne te demande plus<br />combien tu gagnes.<br />
              <span style={{ color: "#5DCAA5" }}>H€CTOR te montre ce que<br />tu peux vraiment dépenser.</span>
            </h1>
            <p style={{ fontSize: 16, color: "#B5D4F4", lineHeight: 1.65, margin: "0 0 32px", maxWidth: 460 }}>
              H€CTOR calcule automatiquement tes charges, prépare tes devis et tes factures, puis te montre ce qui est réellement à toi.
            </p>
            <button onClick={() => { setAuthMode("register"); scrollToAuth(); }} style={{ background: "#5DCAA5", color: "#07192E", border: "none", borderRadius: 10, padding: "15px 28px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              Créer mon compte gratuitement <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="7" y1="15" x2="7" y2="15" strokeWidth="3"/></svg>, t: "Aucune carte bancaire" },
                { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>, t: "Sans engagement" },
                { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, t: "Setup en 2 minutes" },
              ].map(r => (
                <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8BA5C0" }}>
                  {r.svg}
                  {r.t}
                </div>
              ))}
            </div>
          </div>
          {/* Droite — photo Hector */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", position: "relative", marginLeft: isMobile ? 0 : -40 }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
              <img src="/hector-panier.png" alt="Hector dans son panier" style={{ width: "100%", display: "block", objectFit: "contain", filter: "brightness(1.15) contrast(1.05)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,25,46,0) 60%, #07192E 98%)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(7,25,46,0) 55%, #07192E 100%)" }} />
            </div>
          </div>
        </section>

        {/* ===== BLOC PROBLÈME + SIMULATEUR CÔTE À CÔTE ===== */}
        <section style={{ maxWidth: 1160, margin: "0 auto 0", padding: isMobile ? "0 20px 32px" : "0 40px 40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "stretch" }}>
            {/* Bloc problème */}
            <div style={{ background: "rgba(226,75,74,0.07)", border: "1px solid rgba(226,75,74,0.25)", borderRadius: 14, padding: isMobile ? "18px 20px" : "22px 32px", display: "flex", alignItems: "flex-start", gap: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(226,75,74,0.15)", border: "1px solid rgba(226,75,74,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F09595" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#F09595", marginBottom: 10, textTransform: "uppercase" }}>Le problème</div>
                <div style={{ fontSize: isMobile ? 15 : 17, color: "#EAF2FB", lineHeight: 1.6 }}>
                  Tu encaisses <strong style={{ color: "white" }}>5 000 €</strong>.<br />
                  Tu crois pouvoir les dépenser.<br />
                  Puis l'URSSAF arrive.
                </div>
              </div>
            </div>
            {/* Simulateur mini */}
            {(() => {
              const caNum = Math.max(0, parseFloat(simCaLanding) || 0);
              const taux = parseFloat(simActLanding);
              const urssaf = Math.round(caNum * taux);
              const dispo = Math.max(0, Math.round(caNum * (1 - taux)));
              const fmt = n => n.toLocaleString("fr-FR") + " €";
              return (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5DCAA5", textTransform: "uppercase", marginBottom: 12 }}>Essaie avec ton propre CA</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type="number" value={simCaLanding} min="0"
                        onChange={e => setSimCaLanding(e.target.value)}
                        style={{ width: "100%", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 6, padding: "8px 28px 8px 12px", fontSize: 15, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box" }}
                      />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#5DCAA5", fontSize: 13, fontWeight: 700 }}>€</span>
                    </div>
                    <select
                      value={simActLanding} onChange={e => setSimActLanding(e.target.value)}
                      style={{ flex: 1, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "white", outline: "none", boxSizing: "border-box" }}
                    >
                      <option value="0.212">Services (21,2%)</option>
                      <option value="0.256">Libéral BNC (25,6%)</option>
                      <option value="0.123">Vente (12,3%)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, background: "#0d2440", borderRadius: 8, padding: "10px 14px", border: "1px solid #1e3a5f" }}>
                      <div style={{ fontSize: 9, color: "#8BA5C0", marginBottom: 3 }}>URSSAF à mettre de côté</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#FAC775" }}>{fmt(urssaf)}</div>
                    </div>
                    <div style={{ flex: 1, background: "rgba(93,202,165,0.07)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(93,202,165,0.25)" }}>
                      <div style={{ fontSize: 9, color: "#5DCAA5", marginBottom: 3 }}>Il te reste</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#5DCAA5" }}>{fmt(dispo)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>


        <section style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "0 20px 48px" : "0 40px 56px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
          {/* Démo calcul */}
          <div style={{ background: "rgba(93,202,165,0.06)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#5DCAA5", marginBottom: 18, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#5DCAA5", fontSize: 14 }}>✓</span> H€CTOR calcule pour toi
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 20, textAlign: "center" }}>5 000 € encaissés</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                { label: "URSSAF", val: "- 1 060 €" },
                { label: "Réserve de sécurité", val: "- 800 €" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, color: "#B5D4F4" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#5DCAA5", fontSize: 15 }}>✓</span> {r.label}
                  </span>
                  <span style={{ color: "#FAC775", fontWeight: 600 }}>{r.val}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid rgba(93,202,165,0.2)", paddingTop: 16, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#8BA5C0", marginBottom: 4 }}>= réellement disponibles</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#5DCAA5" }}>3 140 €</div>
            </div>
          </div>

          {/* Démo chat */}
          <div style={{ background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.25)", borderRadius: 16, padding: "24px 28px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: ACCENT, marginBottom: 18, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: ACCENT, fontSize: 14 }}>💬</span> Parle à H€CTOR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: ACCENT, color: "white", borderRadius: "12px 12px 3px 12px", padding: "10px 14px", fontSize: 13.5, maxWidth: "85%", fontWeight: 500, lineHeight: 1.45 }}>
                  Prépare un devis pour Martin,<br />500 € de consulting
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", alignSelf: "flex-end", marginLeft: 6, whiteSpace: "nowrap" }}>10:42</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <img src="/hector-tete.png" alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ background: "rgba(255,255,255,0.07)", color: "#EAF2FB", borderRadius: "12px 12px 12px 3px", padding: "10px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#5DCAA5" }}>✓</span> Devis créé
                  <span style={{ marginLeft: 8, color: ACCENT, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>📄 Voir le PDF</span>
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", whiteSpace: "nowrap" }}>10:42</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: ACCENT, color: "white", borderRadius: "12px 12px 3px 12px", padding: "10px 14px", fontSize: 13.5, maxWidth: "85%", fontWeight: 500 }}>
                  Transforme-le en facture
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", alignSelf: "flex-end", marginLeft: 6, whiteSpace: "nowrap" }}>10:45</div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <img src="/hector-tete.png" alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                <div style={{ background: "rgba(255,255,255,0.07)", color: "#EAF2FB", borderRadius: "12px 12px 12px 3px", padding: "10px 14px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#5DCAA5" }}>✓</span> Facture créée
                  <span style={{ marginLeft: 8, color: "#8BA5C0", fontSize: 12 }}>📄</span>
                </div>
                <div style={{ fontSize: 10, color: "#4A6280", whiteSpace: "nowrap" }}>10:45</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== GRILLE FEATURES ===== */}
        <section style={{ background: "rgba(255,255,255,0.025)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "40px 20px" : "52px 40px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#5DCAA5", textAlign: "center", marginBottom: 36, textTransform: "uppercase" }}>Tout ce qu'H€CTOR fait pour toi</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 16 : 24 }}>
              {[
                { emoji: "📊", t: "Savoir ce que tu peux dépenser", d: "Saisis tes revenus, Hector calcule ce qui est vraiment à toi après charges." },
                { emoji: "📄", t: "Devis & factures automatiques", d: "Crée, envoie, convertis en quelques secondes — ou dicte à Hector." },
                { emoji: "📷", t: "Scan de frais", d: "Prends une photo de ta facture, Hector l'enregistre et la classe." },
                { emoji: "🛡️", t: "Réserve de sécurité", d: "Hector met de côté ce qu'il faut pour que tu sois tranquille à chaque déclaration." },
                { emoji: "📈", t: "Suivi simple et clair", d: "Tableaux de bord pensés pour les indépendants, pas pour les comptables." },
                { emoji: "🔒", t: "Tes données, ton contrôle", d: "Saisie manuelle ou, bientôt, connexion bancaire en lecture seule : c'est toi qui choisis." },
              ].map(f => (
                <div key={f.t} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "18px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                  <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{f.emoji}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginBottom: 5, lineHeight: 1.3 }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: "#6B8299", lineHeight: 1.55 }}>{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA FINAL + FORMULAIRE ===== */}
        <section id="hector-auth-section" style={{ maxWidth: 1160, margin: "0 auto", padding: isMobile ? "48px 20px" : "64px 40px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 48, alignItems: "center" }}>
          {/* Gauche — social proof sobre */}
          <div>
            <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 16px" }}>
              Reprends enfin le contrôle<br />de ta trésorerie.
            </h2>
            <p style={{ fontSize: 15, color: "#8BA5C0", lineHeight: 1.6, margin: "0 0 24px" }}>
              50 auto-entrepreneurs utilisent déjà H€CTOR en beta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Zéro surprise à la déclaration URSSAF",
                "Devis et factures en quelques secondes",
                "Toujours savoir ce que tu peux dépenser",
              ].map(t => (
                <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: isMobile ? 13 : 14, color: "#B5D4F4", wordBreak: "break-word" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 1, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Droite — formulaire */}
          <div style={{ background: "white", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 28px", boxSizing: "border-box", width: "100%" }}>
            {forgotMode ? (
              <div>
                <h2 style={{ ...S.authTitle, marginBottom: 16 }}>Mot de passe oublié</h2>
                {forgotStatus === "sent" ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📧</div>
                    <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 20, lineHeight: 1.6 }}>
                      Si un compte existe avec <strong>{forgotEmail}</strong>, vous recevrez un lien de réinitialisation.
                    </p>
                    <button type="button" style={S.btnSecondary} onClick={() => { setForgotMode(false); setForgotStatus(""); setForgotEmail(""); }}>Retour à la connexion</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword}>
                    <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                    <label style={S.label}>Email<input style={S.input} type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required /></label>
                    <button style={S.btnPrimary} type="submit" disabled={forgotStatus === "loading"}>{forgotStatus === "loading" ? "…" : "Envoyer le lien"}</button>
                    <p style={S.switchAuth}><button type="button" style={S.linkBtn} onClick={() => setForgotMode(false)}>← Retour à la connexion</button></p>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleAuth}>
                <h2 style={{ ...S.authTitle, marginBottom: 20 }}>{authMode === "login" ? "Connexion" : "Créer un compte"}</h2>
                {!pwaDismissed && <InstallBanner pwaPrompt={pwaPrompt} onInstall={handleInstallClick} onDismiss={dismissPwa} showHelp={showInstallHelp} compact />}
                {error && <div style={S.errorBanner}>{error}</div>}
                <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }} />
                <p style={S.orDivider}>ou avec un email</p>
                <label style={S.label}>Email<input style={S.input} type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required /></label>
                <label style={S.label}>Mot de passe<input style={S.input} type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} minLength={8} required /></label>
                {authMode === "login" && (
                  <p style={{ textAlign: "right", marginTop: -8, marginBottom: 14 }}>
                    <button type="button" style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => setForgotMode(true)}>Mot de passe oublié ?</button>
                  </p>
                )}
                <button style={{ ...S.btnPrimary, background: "#5DCAA5", color: "#07192E" }} type="submit" disabled={loading}>
                  {loading ? "…" : authMode === "login" ? "Se connecter" : "Créer mon compte gratuitement"}
                </button>
                {authMode === "register" && (
                  <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
                    {[
                      { svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>, t: "Sans engagement" },
                      { svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>, t: "Annulation en 1 clic" },
                    ].map(r => (
                      <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8BA5C0" }}>
                        {r.svg} {r.t}
                      </div>
                    ))}
                  </div>
                )}
                <p style={S.switchAuth}>
                  {authMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
                  <button type="button" style={S.linkBtn} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Créer un compte" : "Se connecter"}</button>
                </p>
                {authMode === "register" && (
                  <p style={{ fontSize: 11, color: "#8BA5C0", textAlign: "center", marginTop: 4 }}>
                    En créant un compte, vous acceptez les <button type="button" style={{ ...S.linkBtn, fontSize: 11 }} onClick={() => setLegalPage("cgu")}>CGU</button> et la <button type="button" style={{ ...S.linkBtn, fontSize: 11 }} onClick={() => setLegalPage("confidentialite")}>Politique de confidentialité</button>.
                  </p>
                )}
              </form>
            )}
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "24px 20px" : "28px 40px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", maxWidth: 1160, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Logo size={24} dark />
            <span style={{ fontSize: 11, color: "#4A6280" }}>L'assistant financier des indépendants.</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "Mentions légales", page: "mentions" },
              { label: "CGU", page: "cgu" },
              { label: "Confidentialité", page: "confidentialite" },
            ].map(l => (
              <button key={l.page} type="button" style={{ background: "none", border: "none", color: "#4A6280", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setLegalPage(l.page)}>{l.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#4A6280" }}>Fait avec 🐾 pour les indépendants</div>
        </footer>
      </div>
    );
  }

  if (profile && !profile.onboarding_complete) {
    const onbSoldeNum = parseFloat(onbSolde) || 0;
    const onbPremierRevenuNum = parseFloat(onbPremierRevenu) || 0;
    const tauxOnb = profileForm.activite === "bic_vente" ? 12.3 : profileForm.activite === "bnc" ? 25.6 : 21.2;
    const urssafOnb = Math.round(onbPremierRevenuNum * tauxOnb / 100);
    const resteOnb = Math.round(onbPremierRevenuNum - urssafOnb);

    // ─── PHASE STATUT (Brique 4b) : qui es-tu ? Pré-rempli par la landing. ───
    if (onbStep === "statut") {
      // Si l'utilisateur a déjà choisi son statut sur la landing, on n'affiche pas
      // le choix une 2e fois : on montre un court écran de transition pendant que
      // le useEffect applique le choix automatiquement.
      if (landingStatut) {
        return (
          <div style={{ minHeight: "100vh", background: "#07192E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
            <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#0a1322", border: "2px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }} className="hector-breathe">
              <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
            </div>
            {error ? (
              <div style={{ textAlign: "center", maxWidth: 320 }}>
                <div style={{ color: "#FAC775", fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>Hmm, la préparation a coincé. C'est peut-être juste la connexion qui a hésité.</div>
                <button type="button" disabled={loading} onClick={() => { setError(""); landingStatutApplied.current = false; handleOnboardingStatut(landingStatut); }}
                  style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
                  {loading ? "Nouvelle tentative…" : "Réessayer"}
                </button>
              </div>
            ) : (
              <div style={{ color: "#8BA5C0", fontSize: 14 }}>Je prépare ton espace…</div>
            )}
          </div>
        );
      }
      const carteOnb = (statut, img, fallbackIcon, titre, sousTitre) => (
        <button type="button" disabled={loading} onClick={() => handleOnboardingStatut(statut)}
          style={{ width: "100%", background: "#11203a", border: "1px solid #2a3a55", borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, marginBottom: 12 }}
          onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = "#5DCAA5")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a3a55")}>
          <div style={{ width: 64, height: 64, borderRadius: 12, background: "#0a1322", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            <NiveauImage src={img} fallbackIcon={fallbackIcon} fallbackColor="#3a5169" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "white", fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{titre}</div>
            <div style={{ color: "#8BA5C0", fontSize: 12.5, lineHeight: 1.5 }}>{sousTitre}</div>
          </div>
          <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18 }} />
        </button>
      );
      return (
        <div style={{ background: "#0a1322", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <style>{CSS}</style>
          <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
            <Logo size={40} dark />
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", margin: "20px 0 8px" }}>Bienvenue ! Dis-moi qui tu es.</h1>
            <p style={{ fontSize: 14, color: "#8BA5C0", margin: "0 0 28px", lineHeight: 1.5 }}>
              Je m'adapte à ton activité. Tu pourras changer à tout moment dans les réglages.
            </p>
            {carteOnb("auto_entrepreneur", "/hector-tete.png", "ti-briefcase", "Je suis auto-entrepreneur", "Je te dis ce que tu peux vraiment dépenser, sans l'URSSAF qui surprend.")}
            {carteOnb("intermittent", "/hector-clap.png", "ti-movie", "Je suis intermittent du spectacle", "Je compte tes heures et tes cachets vers tes 507h.")}
          </div>
        </div>
      );
    }

    // ─── PHASE AHA : premier revenu avant cockpit ───
    if (onbStep === "aha") {
      return (
        <div style={S.authPage}>
          <style>{CSS}</style>
          <div style={S.authLeft}>
            <div style={{ position: "relative", width: 130, height: 130, margin: "0 auto" }}>
              <div style={{ position: "absolute", inset: -10, borderRadius: "50%", background: "radial-gradient(circle, rgba(93,202,165,0.25) 0%, transparent 70%)" }} />
              <div style={{ width: 130, height: 130, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(93,202,165,0.35)", position: "relative", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
                <img src="/hector-tete.png" alt="Hector" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            </div>
            <h1 style={{ ...S.authHero, marginTop: 24 }}>Une dernière chose.</h1>
            <p style={S.authSub}>Dis-moi ton dernier encaissement. Je te montre exactement ce qu'il te reste après l'URSSAF.</p>
          </div>
          <div style={S.authRight}>
            <div style={S.authCard}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7A8D", marginBottom: 12 }}>Ton dernier encaissement :</div>
              <input
                style={{ ...S.input, fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 16 }}
                type="number" step="0.01" inputMode="decimal"
                placeholder="Ex : 2 500"
                value={onbPremierRevenu}
                onChange={e => setOnbPremierRevenu(e.target.value)}
                autoFocus
              />
              {onbPremierRevenuNum > 0 && (
                <div style={{ background: "#F4F9FF", border: "1px solid #D6E8FA", borderRadius: 12, padding: "16px 18px", marginBottom: 16, animation: "fadeInDown 0.35s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B7A8D", marginBottom: 8 }}>
                    <span>URSSAF à mettre de côté</span>
                    <span style={{ color: "#FAC775", fontWeight: 700 }}>−{formatEUR(urssafOnb)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: "#0A2540", borderTop: "1px solid #E2EBF6", paddingTop: 8 }}>
                    <span>Il te reste vraiment</span>
                    <span style={{ color: "#1D9E75" }}>{formatEUR(resteOnb)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5DCAA5", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🐾</span> C'est ça, ton vrai disponible. Pas de mauvaise surprise.
                  </div>
                </div>
              )}
              <button
                style={S.btnPrimary}
                onClick={async () => {
                  if (onbPremierRevenuNum > 0) {
                    try {
                      await apiFetch("/income", { method: "POST", body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), amount: onbPremierRevenuNum, description: "Premier revenu" }) });
                    } catch {}
                  }
                  handleEnterCockpit();
                }}
              >
                Voir mon cockpit →
              </button>
              <button
                style={{ ...S.linkBtn, marginTop: 12, fontSize: 12, color: "#8BA5C0", display: "block", textAlign: "center", width: "100%" }}
                onClick={handleEnterCockpit}
              >
                Passer pour l'instant
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ─── PHASE RÉSULTAT : le premier "tu peux dépenser X €" ───
    if (onbStep === "result") {
      return (
        <div style={S.authPage}>
          <style>{CSS}</style>
          <div style={S.authLeft}>
            <Logo size={110} dark />
            <h1 style={S.authHero}>C'est prêt.</h1>
            <p style={S.authSub}>Voici ton premier chiffre. Il deviendra de plus en plus précis à mesure que tu ajoutes tes revenus et tes frais.</p>
          </div>
          <div style={S.authRight}>
            <div style={S.authCard}>
              <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7A8D", marginBottom: 8 }}>💰 Ce que tu peux dépenser aujourd'hui</div>
                <div style={{ fontSize: 44, fontWeight: 700, color: "#1D9E75", lineHeight: 1.1 }}>{formatEUR(onbSoldeNum)}</div>
                <p style={{ fontSize: 12, color: "#8BA5C0", margin: "14px auto 0", maxWidth: 320, lineHeight: 1.6 }}>
                  Pour l'instant, tu n'as encore enregistré aucun revenu — donc rien n'est dû à l'URSSAF ni aux impôts. Dès que tu ajoutes une rentrée d'argent, H€CTOR met automatiquement de côté ce que tu devras, et ce chiffre devient ton <strong>vrai</strong> disponible.
                </p>
              </div>

              <div style={{ marginTop: 22, padding: "14px 16px", background: "#F4F9FF", border: "1px solid #D6E8FA", borderRadius: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0A2540", margin: "0 0 8px" }}>À partir de maintenant, H€CTOR :</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    "Calcule ton URSSAF et tes impôts en temps réel",
                    "Te dit toujours ce que tu peux dépenser sans danger",
                    "Crée tes devis et factures",
                    "T'alerte avant chaque renouvellement",
                  ].map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#28425E" }}>
                      <span style={{ color: "#1D9E75", flexShrink: 0 }}>✓</span>{t}
                    </div>
                  ))}
                </div>
              </div>

              <button style={{ ...S.btnPrimary, marginTop: 18 }} onClick={handleEnterCockpit} disabled={loading}>
                {loading ? "…" : "Aller sur mon Cockpit →"}
              </button>
              <p style={{ fontSize: 11, color: "#8BA5C0", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                ACRE, versement libératoire, SIRET, réserve de sécurité : tu pourras affiner tout ça depuis ton profil pour un calcul encore plus précis.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // ─── PHASE FORM : 3 questions, rien de plus ───
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={110} dark />
          <h1 style={S.authHero}>3 questions,<br />et tu sais tout.</h1>
          <p style={S.authSub}>En moins d'une minute, H€CTOR te dira exactement combien tu peux dépenser sans te mettre en danger avec l'URSSAF, les impôts et la TVA.</p>
        </div>
        <div style={S.authRight}>
          <form style={S.authCard} onSubmit={handleOnboardingComplete}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ ...S.authTitle, marginBottom: 0 }}>On y va</h2>
              <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#8BA5C0", whiteSpace: "nowrap" }} onClick={handleLogout}>
                {profile?.email ? `Pas ${profile.email} ?` : "Ce n'est pas vous ?"} Déconnexion
              </button>
            </div>
            {error && <div style={S.errorBanner}>{error}</div>}

            {/* Question 1 — activité */}
            <p style={S.sectionLabel}>1. Quel est ton type d'activité ?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {ACTIVITES.map(a => (
                <button type="button" key={a.id} onClick={() => setProfileForm({ ...profileForm, activite: a.id })}
                  style={{ ...S.statutCard, ...(profileForm.activite === a.id ? S.statutCardActive : {}), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{a.label}</span>
                  <span style={{ fontSize: 12, color: "#8BA5C0" }}>{a.taux} URSSAF</span>
                </button>
              ))}
            </div>

            {/* Question 2 — périodicité */}
            <p style={S.sectionLabel}>2. Tu déclares à l'URSSAF...</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ id: "mensuelle", label: "Tous les mois" }, { id: "trimestrielle", label: "Tous les 3 mois" }].map(opt => (
                <button type="button" key={opt.id} onClick={() => setProfileForm({ ...profileForm, periodicite: opt.id })}
                  style={{ ...S.statutCard, flex: 1, textAlign: "center", ...(profileForm.periodicite === opt.id ? S.statutCardActive : {}) }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Question 3 — solde */}
            <p style={S.sectionLabel}>3. Combien y a-t-il sur ton compte, là, maintenant ?</p>
            <input
              style={{ ...S.input, fontSize: 20, fontWeight: 600, padding: "14px 16px" }}
              type="number" step="0.01" inputMode="text" placeholder="Exemple : 1750 €"
              value={onbSolde} onChange={e => setOnbSolde(e.target.value)} autoFocus
            />
            <p style={{ fontSize: 11, color: "#8BA5C0", margin: "8px 0 20px", lineHeight: 1.5 }}>
              Pour l'instant, ouvre l'appli de ta banque, lis ton solde et recopie-le ici (10 sec). Bientôt tu pourras aussi le synchroniser automatiquement, si tu veux.
            </p>

            <p style={S.sectionLabel}>4. Environ combien dépenses-tu par mois pour vivre ?</p>
            <input
              style={{ ...S.input, fontSize: 20, fontWeight: 600, padding: "14px 16px" }}
              type="number" step="50" inputMode="decimal" placeholder="Exemple : 1800 €"
              value={onbTrainDeVie} onChange={e => setOnbTrainDeVie(e.target.value)}
            />
            <p style={{ fontSize: 11, color: "#8BA5C0", margin: "8px 0 20px", lineHeight: 1.5 }}>
              Loyer, courses, abonnements, dépenses perso importantes — juste une estimation, tu pourras la modifier après. Ça permet à Hector de veiller sur ta tranquillité dès maintenant.
            </p>

            <p style={S.sectionLabel}>5. Ton SIRET <span style={{ fontWeight: 400, color: "#8BA5C0" }}>(optionnel)</span></p>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                type="text" inputMode="numeric" placeholder="14 chiffres"
                value={onbSiret} onChange={e => { setOnbSiret(e.target.value); setOnbSiretStatus(""); setOnbSiretMessage(""); setOnbSiretData(null); }}
              />
              <button type="button" style={{ ...S.btnSecondary, width: "auto", padding: "10px 18px", whiteSpace: "nowrap" }}
                onClick={handleOnbLookupSiret} disabled={!onbSiret || onbSiretStatus === "loading"}>
                {onbSiretStatus === "loading" ? "…" : "Vérifier"}
              </button>
            </div>
            {onbSiretStatus === "success" && (
              <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, margin: "4px 0 16px" }}>{onbSiretMessage}</p>
            )}
            {onbSiretStatus === "error" && (
              <p style={{ fontSize: 12, color: "#A32D2D", margin: "4px 0 16px" }}>{onbSiretMessage}</p>
            )}
            {onbSiretStatus === "" && (
              <p style={{ fontSize: 11, color: "#8BA5C0", margin: "4px 0 20px", lineHeight: 1.5 }}>
                Si tu le renseignes, H€CTOR récupère automatiquement ta raison sociale et ton adresse pour tes factures. Tu peux aussi le faire plus tard dans ton profil.
              </p>
            )}

            <button style={S.btnPrimary} type="submit" disabled={loading || onbSolde === ""}>
              {loading ? "…" : "Voir ce que je peux dépenser →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══ BRIQUE 5.1 — COCKPIT INTERMITTENT (compteur 507h vivant) ═══
  // Branché sur GET /intermittent/cockpit. Affiche l'état calculé par le moteur :
  // total d'heures, manquant, barre de progression, état d'Hector, verdict (niveau C).
  // Suivi indicatif, ne remplace pas France Travail.
  if (profile && profile.statut === "intermittent") {
    const c = interCockpit;
    const pct = c ? Math.min(100, c.pourcentage) : 0;
    const etatLabels = {
      oeuf: "Hector couve", chiot: "Hector chiot", ado: "Hector ado",
      filet: "Seuil du filet franchi", adulte: "Hector adulte", niche: "Droits sécurisés",
    };
    // Palier actuel + prochain palier (pour l'affichage immersif d'Hector au centre)
    const heuresActuelles = c ? c.total_heures : 0;
    let palierActuel = PALIERS_INTERMITTENT[0];
    for (const p of PALIERS_INTERMITTENT) {
      if (heuresActuelles >= p.seuil) palierActuel = p;
    }
    const idxActuel = PALIERS_INTERMITTENT.indexOf(palierActuel);
    const palierSuivant = idxActuel < PALIERS_INTERMITTENT.length - 1 ? PALIERS_INTERMITTENT[idxActuel + 1] : null;
    const heuresAvantSuivant = palierSuivant ? Math.max(0, palierSuivant.seuil - heuresActuelles) : 0;
    // Prochain objectif exprimé en cachets (≈), plus parlant qu'en heures seules.
    const cachetsAvantSuivant = palierSuivant ? Math.ceil(heuresAvantSuivant / 12) : 0;
    // "Pensée d'Hector" : une phrase vivante, à la 1re personne, choisie selon la situation.
    // 4 rôles possibles (me parle / me rassure / me dit où aller / me félicite).
    const penseesHector = (() => {
      if (c && c.droits_securises) {
        return [
          "Tes droits sont sécurisés. Je veille, repose-toi un peu. 🐾",
          "On l'a fait. Maintenant chaque heure, c'est du bonus.",
          "Je suis fier de nous. Tu peux souffler.",
        ];
      }
      if (palierSuivant && heuresAvantSuivant <= 24) {
        return [
          `Plus que ${heuresAvantSuivant}h et je deviens ${palierSuivant.nom}. On y est presque !`,
          `Encore un petit effort — ${cachetsAvantSuivant} cachet${cachetsAvantSuivant > 1 ? "s" : ""} et je grandis. 🐾`,
          "Je sens qu'on approche. Continue, ne lâche rien.",
        ];
      }
      if (heuresActuelles === 0) {
        return [
          "On démarre ensemble. Ajoute ton premier cachet, je compte tout. 🐾",
          "Chaque grande carrière commence par une première heure.",
          "J'ai hâte de grandir avec toi.",
        ];
      }
      return [
        "Chaque heure te rapproche de ta niche. 🐾",
        "Tu avances plus vite que tu ne le crois.",
        "J'adore quand tu ajoutes un nouveau contrat.",
        `Encore ${heuresAvantSuivant}h et je deviens ${palierSuivant ? palierSuivant.nom : "Gardien"}.`,
      ];
    })();
    // On choisit une pensée stable par session (basée sur les heures, pour ne pas clignoter à chaque render).
    const penseeHector = penseesHector[heuresActuelles % penseesHector.length];

    // ═══ "HECTOR CALCULE POUR TOI" : traduit les chiffres en réponses simples ═══
    // Petit helper d'affichage de date "12 août".
    const formatDateCourt = (iso) => {
      try {
        const d = new Date(iso);
        const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
        return `${d.getDate()} ${MOIS[d.getMonth()]}`;
      } catch { return iso; }
    };
    // Deux cercles : sûr (arithmétique) = Hector affirme ; estimé (rythme/projection) = Hector estime.
    const calc = (() => {
      const seuil = c ? c.seuil : valeurDe("seuilHeures");
      const heures = heuresActuelles;
      const manque = Math.max(0, (c ? c.manquant : seuil - heures));
      const secu = c ? c.droits_securises : false;
      const cachetsManquants = Math.ceil(manque / valeurDe("cachetHeures"));

      // — Projection (cercle estimé) : à partir du rythme des 3 derniers mois d'activités —
      const now = new Date();
      const il3mois = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const recent = (interActivites || []).filter(a => { const d = new Date(a.date); return !isNaN(d) && d >= il3mois && d <= now; });
      let heuresRecentes = 0;
      recent.forEach(a => { heuresRecentes += heuresDe(a); });
      const rythmeMensuel = heuresRecentes / 3; // h/mois sur les 3 derniers mois
      const aUnRythme = rythmeMensuel > 0;
      const moisPourCombler = aUnRythme ? Math.ceil(manque / rythmeMensuel) : null;
      let dateProjection = null;
      if (aUnRythme && moisPourCombler != null && manque > 0) {
        const dp = new Date(now.getFullYear(), now.getMonth() + moisPourCombler, now.getDate());
        const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
        dateProjection = `${MOIS[dp.getMonth()]} ${dp.getFullYear()}`;
      }

      // — Date anniversaire (cercle estimé) —
      const joursAnniv = c ? c.jours_avant_anniversaire : null;
      const aDateAnniv = c && c.date_anniversaire && joursAnniv != null && joursAnniv >= 0;
      // À ce rythme, est-ce que j'y serai à temps ?
      let dansLesTemps = null; // true / false / null (inconnu)
      if (secu) {
        dansLesTemps = true;
      } else if (aDateAnniv && aUnRythme && moisPourCombler != null) {
        const moisDispo = joursAnniv / 30;
        dansLesTemps = moisPourCombler <= moisDispo;
      }

      // — Clause de rattrapage (cercle estimé) : zone 338–506h —
      const filet = c ? c.filet_atteint : false;
      const procheRattrapage = !secu && heures >= (valeurDe("rattrapageSeuilMin") - 38) && heures < valeurDe("seuilHeures"); // on alerte dès qu'on s'en approche

      // — Le conseil concret (question 4 : dois-je agir ?) —
      let conseilNiveau, conseilTitre, conseilTexte;
      if (secu) {
        conseilNiveau = "green";
        conseilTitre = "Tu peux souffler";
        conseilTexte = aDateAnniv
          ? `Tes droits sont sécurisés jusqu'à ton renouvellement du ${formatDateCourt(c.date_anniversaire)}. Chaque heure en plus, c'est du bonus pour après.`
          : "Tes droits sont sécurisés. Continue à déclarer, ça prépare ton prochain renouvellement.";
      } else if (dansLesTemps === true) {
        conseilNiveau = "green";
        conseilTitre = "Tu es sur la bonne voie";
        conseilTexte = `À ton rythme actuel (~${Math.round(rythmeMensuel)}h/mois), tu devrais atteindre tes 507h${dateProjection ? ` vers ${dateProjection}` : ""}${aDateAnniv ? `, avant ton renouvellement` : ""}. Garde la cadence.`;
      } else if (dansLesTemps === false) {
        conseilNiveau = "orange";
        conseilTitre = "Il faut accélérer";
        conseilTexte = `À ton rythme actuel, tu risques de ne pas atteindre 507h avant ton renouvellement du ${formatDateCourt(c.date_anniversaire)}. Il te faudrait environ ${cachetsManquants} cachet${cachetsManquants > 1 ? "s" : ""} de plus — cherche des contrats dès maintenant.`;
      } else if (manque > 0) {
        conseilNiveau = "blue";
        conseilTitre = "Continue à déclarer";
        conseilTexte = aUnRythme
          ? `Il te manque ${manque}h ≈ ${cachetsManquants} cachet${cachetsManquants > 1 ? "s" : ""}. À ton rythme${dateProjection ? `, tu y seras vers ${dateProjection}` : ""}. Renseigne ta date anniversaire pour que je te dise si c'est à temps.`
          : `Il te manque ${manque}h ≈ ${cachetsManquants} cachet${cachetsManquants > 1 ? "s" : ""}. Ajoute tes contrats au fur et à mesure, je suis ton avancée.`;
      } else {
        conseilNiveau = "green";
        conseilTitre = "Objectif atteint";
        conseilTexte = "Tu as tes 507h. Bravo !";
      }

      return {
        heures, seuil, manque, secu, cachetsManquants,
        rythmeMensuel: Math.round(rythmeMensuel), aUnRythme, dateProjection,
        aDateAnniv, joursAnniv, dansLesTemps,
        filet, procheRattrapage,
        conseilNiveau, conseilTitre, conseilTexte,
      };
    })();

    // ═══ COACH : le verdict-héros + projections parlantes (voix d'Hector qui veille) ═══
    const coach = (() => {
      const heures = calc.heures, seuil = calc.seuil, manque = calc.manque;
      const pctChemin = Math.min(100, Math.round((heures / seuil) * 100));
      // Rythme par semaine (plus parlant que par mois)
      const rythmeSemaine = calc.rythmeMensuel / 4.33;
      const cachetsSemaine = rythmeSemaine / 12; // en cachets isolés
      // Rythme conseillé pour tenir le renouvellement (si date anniv connue)
      let cachetsConseillesSemaine = null;
      if (calc.aDateAnniv && calc.joursAnniv > 0 && manque > 0) {
        const semainesDispo = calc.joursAnniv / 7;
        cachetsConseillesSemaine = (manque / 12) / semainesDispo;
      }

      // Comparaison mois-à-mois (ce mois vs mois précédent)
      const now = new Date();
      const heuresDuMois = (offset) => {
        const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return (interActivites || []).reduce((s, a) => {
          const d = new Date(a.date);
          if (isNaN(d) || d.getMonth() !== ref.getMonth() || d.getFullYear() !== ref.getFullYear()) return s;
          return s + heuresDe(a);
        }, 0);
      };
      const hCeMois = Math.round(heuresDuMois(0));
      const hMoisDernier = Math.round(heuresDuMois(1));
      let compa = null;
      if (hMoisDernier > 0 || hCeMois > 0) {
        if (hCeMois > hMoisDernier && hMoisDernier > 0) compa = { sens: "up", txt: `Tu fais mieux que le mois dernier (${hMoisDernier}h → ${hCeMois}h). On garde cette énergie. 🐾` };
        else if (hCeMois < hMoisDernier && hCeMois >= 0 && hMoisDernier > 0) compa = { sens: "down", txt: `Le mois dernier tu étais à ${hMoisDernier}h, ce mois-ci ${hCeMois}h. Ton rythme ralentit — si tu peux, ne lâche pas.` };
      }

      // Jours depuis le dernier contrat (le chien remarque l'inactivité)
      let joursInactif = null;
      if ((interActivites || []).length > 0) {
        const derniere = (interActivites || []).map(a => new Date(a.date)).filter(d => !isNaN(d)).sort((a, b) => b - a)[0];
        if (derniere) joursInactif = Math.floor((now - derniere) / 86400000);
      }

      // LE VERDICT-HÉROS : niveau + grande phrase, dans la voix d'Hector qui veille
      let niveau, titre, phrase;
      if (calc.secu) {
        niveau = "green";
        titre = "Je veille, tu peux souffler.";
        phrase = calc.aDateAnniv
          ? `Tes droits sont sécurisés jusqu'à ton renouvellement du ${formatDateCourt(c.date_anniversaire)}. Pour moi, on est tranquilles.`
          : "Tes 507h sont là. Je continue à monter la garde sur ton dossier.";
      } else if (calc.dansLesTemps === true) {
        niveau = "green";
        titre = "Je pense qu'on est sur la bonne voie.";
        phrase = `À ton rythme, je nous vois atteindre les 507h${calc.dateProjection ? ` vers ${calc.dateProjection}` : ""}${calc.aDateAnniv ? `, avant ton renouvellement` : ""}. Si c'était mon dossier, je continuerais comme ça.`;
      } else if (calc.dansLesTemps === false) {
        niveau = "orange";
        titre = "Il va falloir accélérer un peu.";
        phrase = `Il te reste ${calc.joursAnniv} jours et environ ${calc.cachetsManquants} cachets à décrocher. C'est jouable, mais à ta place je chercherais des contrats dès maintenant.`;
      } else if (manque > 0) {
        niveau = "blue";
        titre = "On avance, je garde un œil.";
        phrase = calc.aUnRythme
          ? `Il te manque ${manque}h ≈ ${calc.cachetsManquants} cachets.${calc.dateProjection ? ` À ton rythme, je nous vois y arriver vers ${calc.dateProjection}.` : ""} Renseigne ta date anniversaire et je te dirai si on est dans les temps.`
          : `Il te manque ${manque}h ≈ ${calc.cachetsManquants} cachets. Ajoute tes contrats au fur et à mesure, je suis ton avancée de près.`;
      } else {
        niveau = "green";
        titre = "On l'a fait. 🎉";
        phrase = "Tu as tes 507h. Je suis fier de nous.";
      }

      return { niveau, titre, phrase, pctChemin, rythmeSemaine, cachetsSemaine, cachetsConseillesSemaine, compa, joursInactif, hCeMois, hMoisDernier };
    })();

    // ═══ ÉTAT ÉMOTIONNEL (le héros) : 1 état clair en 3 tons, voix d'Hector ═══
    // 🟢 sécurisé (certain) · 🟡 en bonne voie (continue) · 🔴 ça se joue (agis vite)
    // Règle : 🟢 UNIQUEMENT si droits_securises (donnée certaine du moteur).
    // Une projection positive ne donne JAMAIS de vert.
    const etat = (() => {
      const manque = calc.manque;
      const joursAnniv = calc.aDateAnniv ? calc.joursAnniv : null;

      // 🟢 SÉCURISÉ — seul cas vert : le moteur confirme les droits.
      if (calc.secu) {
        return {
          ton: "green", emoji: "🟢", titre: "Tes droits sont sécurisés",
          bg: "rgba(93,202,165,0.1)", bd: "rgba(93,202,165,0.3)", tc: "#5DCAA5", st: "#BFE6D6",
          phrase: calc.aDateAnniv
            ? `C'est bon jusqu'à ton renouvellement du ${formatDateCourt(c.date_anniversaire)}. Je monte la garde, tu peux souffler. 🐾`
            : "Tes 507h sont là. Je continue à veiller sur ton dossier, tranquille. 🐾",
        };
      }

      // 🔴 ÇA SE JOUE — date connue + à ce rythme on n'y arrive pas, ou très peu de temps.
      const urgent = (calc.dansLesTemps === false) ||
        (joursAnniv != null && joursAnniv <= 30 && manque > 24);
      if (urgent) {
        return {
          ton: "red", emoji: "🔴", titre: "Là, ça se joue",
          bg: "rgba(226,83,61,0.1)", bd: "rgba(226,83,61,0.3)", tc: "#F0997F", st: "#F0C4B8",
          phrase: joursAnniv != null
            ? `Il te reste ${joursAnniv} jour${joursAnniv > 1 ? "s" : ""} et ${calc.cachetsManquants} cachet${calc.cachetsManquants > 1 ? "s" : ""} à décrocher. C'est jouable, mais ne laisse rien passer ce mois-ci.`
            : `Il te manque ${calc.cachetsManquants} cachet${calc.cachetsManquants > 1 ? "s" : ""}. À ta place, je chercherais des contrats dès maintenant.`,
        };
      }

      // 🟡 EN BONNE VOIE — par défaut quand il manque des heures.
      // Titre + phrase dynamiques selon le manque, pour éviter un ton faux
      // ("plus que 159h" sonne faux). 4 paliers : proche → loin.
      let titreAmber, phraseAmber;
      if (manque <= 24) {
        titreAmber = "Tu y es presque";
        phraseAmber = `Plus que ${manque} heure${manque > 1 ? "s" : ""} — tu touches au but. Encore un petit effort. 🐾`;
      } else if (manque <= 72) {
        titreAmber = "En bonne voie";
        phraseAmber = `Tu avances bien : ${manque} heures à faire. Continue comme ça, je surveille le reste. 🐾`;
      } else if (manque <= 150) {
        titreAmber = "Tu construis ton renouvellement";
        phraseAmber = `Il te reste ${manque} heures. Tu les construis cachet après cachet — je suis ton avancée de près. 🐾`;
      } else {
        titreAmber = "On le prépare ensemble";
        phraseAmber = `Le renouvellement est encore loin (${manque} heures), mais pas d'inquiétude : on va le préparer étape par étape. 🐾`;
      }
      return {
        ton: "amber", emoji: "🟡", titre: titreAmber,
        bg: "rgba(250,199,117,0.1)", bd: "rgba(250,199,117,0.3)", tc: "#FAC775", st: "#EDD9B0",
        phrase: phraseAmber,
      };
    })();

    // ═══ CHECKLIST DE RENOUVELLEMENT (vraie checklist, pas déco) ═══
    // Ordre logique : période → AEM → heures → seuil → dossier.
    // Chaque ligne : badge + libellé + statut court à droite.
    const checklist = (() => {
      const acts = interActivites || [];
      const nbActs = acts.length;
      // AEM : une activité a son AEM si aem_recue===true OU issue d'un scan OCR.
      const sansAEM = acts.filter(a => !(a.aem_recue === true || a.source === "ocr"));
      const aemOK = nbActs > 0 && sansAEM.length === 0;
      // Heures réellement comptabilisées = total moteur (déjà filtré 365j côté backend).
      const heures = calc.heures;
      const seuilOK = calc.secu || calc.manque <= 0;
      // Période de réf : calculée côté front → fiable mais pas "certaine" (jamais 🟢).
      // Poids visuel réduit : badge 🟠 conservé (honnêteté) mais statut en gris neutre,
      // pour que l'œil aille d'abord au vrai problème (🔴 AEM), pas ici.
      const periodeStatut = c && c.date_anniversaire
        ? { badge: "🟠", txt: "12 mois · fiable", coul: "#7E97B3" }
        : { badge: "🟠", txt: "à préciser", coul: "#7E97B3" };

      const lignes = [
        {
          id: "periode", label: "Période de référence calculée",
          badge: periodeStatut.badge, statut: periodeStatut.txt, coul: periodeStatut.coul,
          fait: true, // étape "traitée" (fiable), compte dans la barre
        },
        {
          id: "aem", label: "AEM présentes",
          badge: aemOK ? "🟢" : "🔴",
          statut: nbActs === 0 ? "aucun contrat" : (aemOK ? `${nbActs} / ${nbActs}` : `${sansAEM.length} manquante${sansAEM.length > 1 ? "s" : ""}`),
          coul: aemOK ? "#5DCAA5" : "#F0997F",
          fait: aemOK,
        },
        {
          id: "heures", label: "Heures comptabilisées",
          badge: nbActs > 0 ? "🟢" : "⬜",
          statut: nbActs > 0 ? `${heures} h` : "à saisir",
          coul: nbActs > 0 ? "#5DCAA5" : "#5A7798",
          fait: nbActs > 0,
        },
        {
          id: "seuil", label: `Seuil ${calc.seuil} h atteint`,
          badge: seuilOK ? "🟢" : "🔴",
          statut: seuilOK ? "atteint" : `il manque ${calc.manque} h`,
          coul: seuilOK ? "#5DCAA5" : "#F0997F",
          fait: seuilOK,
        },
        {
          id: "dossier", label: "Dossier prêt à préparer",
          badge: seuilOK ? "🟢" : "⬜",
          statut: seuilOK ? "prêt" : "en attente",
          coul: seuilOK ? "#5DCAA5" : "#5A7798",
          fait: seuilOK,
          attente: !seuilOK, // grisé tant que le seuil n'est pas atteint
        },
      ];
      const faits = lignes.filter(l => l.fait).length;
      return { lignes, faits, total: lignes.length };
    })();

    // ═══ ANALYSES D'HECTOR : il remarque des choses (patterns que l'utilisateur ne voit pas) ═══
    const analyses = (() => {
      const acts = interActivites || [];
      const out = [];
      if (acts.length < 2) return out; // pas assez de matière pour analyser

      const hOf = (a) => heuresDe(a);
      const totalH = acts.reduce((s, a) => s + hOf(a), 0);

      // 1. Meilleur employeur (part des heures)
      const parEmployeur = {};
      acts.forEach(a => {
        const e = (a.employeur || "").trim();
        if (!e) return;
        parEmployeur[e] = (parEmployeur[e] || 0) + hOf(a);
      });
      const employeurs = Object.entries(parEmployeur).sort((a, b) => b[1] - a[1]);
      if (employeurs.length > 0 && totalH > 0) {
        const [nom, h] = employeurs[0];
        const pct = Math.round((h / totalH) * 100);
        if (pct >= 30) {
          out.push({
            id: "employeur", icon: "ti-building", ton: pct >= 60 ? "attention" : "info",
            court: `${nom} = ${pct}% de tes heures`,
            long: pct >= 60
              ? `${nom} représente ${pct}% de toutes tes heures. C'est ton pilier — mais si ce lien s'arrêtait, ça ferait un vrai trou. Si c'était mon dossier, je chercherais à diversifier un peu mes employeurs pour être plus serein.`
              : `Ton principal employeur, ${nom}, pèse ${pct}% de tes heures. C'est une belle relation de confiance. Je garde juste un œil à ce que tu ne dépendes pas trop d'un seul donneur d'ouvrage.`,
          });
        }
      }

      // 2. Évolution du rythme (3 derniers mois vs 3 précédents)
      const now = new Date();
      const heuresEntre = (moisDebut, moisFin) => {
        const debut = new Date(now.getFullYear(), now.getMonth() - moisDebut, 1);
        const fin = new Date(now.getFullYear(), now.getMonth() - moisFin + 1, 0);
        return acts.reduce((s, a) => { const d = new Date(a.date); return (!isNaN(d) && d >= debut && d <= fin) ? s + hOf(a) : s; }, 0);
      };
      const recent = heuresEntre(2, 0);   // 3 derniers mois
      const avant = heuresEntre(5, 3);    // les 3 mois d'avant
      if (avant > 0) {
        if (recent < avant * 0.7) {
          out.push({
            id: "rythme", icon: "ti-trending-down", ton: "attention",
            court: "ton rythme ralentit",
            long: `J'ai remarqué que tu travailles moins ces 3 derniers mois (${Math.round(recent)}h) qu'avant (${Math.round(avant)}h). Rien d'alarmant en soi, mais je préfère te le dire : si tu vises ton renouvellement, c'est le moment de ne pas trop lever le pied.`,
          });
        } else if (recent > avant * 1.3) {
          out.push({
            id: "rythme", icon: "ti-trending-up", ton: "positif",
            court: "ton rythme accélère",
            long: `Belle dynamique : tu travailles plus ces 3 derniers mois (${Math.round(recent)}h) que sur la période d'avant (${Math.round(avant)}h). On est sur une bonne lancée — je suis plutôt confiant.`,
          });
        }
      }

      // 3. Comparaison mois courant vs même type de mois (déjà calculé dans coach.compa, on en fait une analyse)
      if (coach.compa) {
        out.push({
          id: "mois", icon: coach.compa.sens === "up" ? "ti-calendar-up" : "ti-calendar-down",
          ton: coach.compa.sens === "up" ? "positif" : "attention",
          court: coach.compa.sens === "up" ? "meilleur mois que le précédent" : "mois plus calme que le précédent",
          long: coach.compa.txt,
        });
      }

      return out;
    })();
    const aDesAnalyses = analyses.length > 0;

    // ═══ FENÊTRE GLISSANTE (cercle estimé) : quelles heures vont sortir de la période 12 mois ? ═══
    // Logique : chaque activité "compte" pendant 12 mois après sa date. Au-delà, elle sort de la fenêtre.
    // C'est NOTRE estimation côté front (pas le moteur validé) → toujours présentée comme "d'après mes calculs".
    const fenetre = (() => {
      const now = new Date();
      const lignes = (interActivites || []).map(a => {
        const d = new Date(a.date);
        if (isNaN(d)) return null;
        const sortie = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()); // +12 mois
        const h = heuresDe(a);
        const joursAvantSortie = Math.ceil((sortie - now) / 86400000);
        return { date: a.date, employeur: a.employeur, heures: h, sortie, joursAvantSortie, dansLaFenetre: sortie > now };
      }).filter(Boolean);
      // Heures qui sortent dans les 30 / 60 / 90 prochains jours
      const sortent30 = lignes.filter(l => l.dansLaFenetre && l.joursAvantSortie <= 30).reduce((s, l) => s + l.heures, 0);
      const sortent60 = lignes.filter(l => l.dansLaFenetre && l.joursAvantSortie <= 60).reduce((s, l) => s + l.heures, 0);
      const sortent90 = lignes.filter(l => l.dansLaFenetre && l.joursAvantSortie <= 90).reduce((s, l) => s + l.heures, 0);
      // La prochaine activité qui va sortir (la plus proche du renouvellement)
      const prochainesSorties = lignes.filter(l => l.dansLaFenetre).sort((a, b) => a.joursAvantSortie - b.joursAvantSortie).slice(0, 3);
      const totalDansFenetre = lignes.filter(l => l.dansLaFenetre).reduce((s, l) => s + l.heures, 0);
      return { sortent30: Math.round(sortent30), sortent60: Math.round(sortent60), sortent90: Math.round(sortent90), prochainesSorties, totalDansFenetre: Math.round(totalDansFenetre), aDesActivites: lignes.length > 0 };
    })();

    // ═══ DÉTECTION D'ERREURS : Hector veille sur ton dossier ═══
    // 5 cas fiables, calculés depuis les données qu'on a déjà. Aucune anomalie → rien ne s'affiche.
    const anomalies = (() => {
      const out = [];
      const acts = interActivites || [];
      const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
      const fmt = (iso) => { try { const d = new Date(iso); return `${d.getDate()} ${MOIS[d.getMonth()]}`; } catch { return iso; } };

      // 1. AEM manquantes (activités sans AEM reçue)
      const sansAEM = acts.filter(a => !(a.aem_recue === true || a.source === "ocr"));
      if (sansAEM.length > 0) {
        out.push({
          id: "aem", niveau: "orange", icon: "ti-file-alert",
          titre: `${sansAEM.length} AEM manquante${sansAEM.length > 1 ? "s" : ""}`,
          texte: sansAEM.length === 1
            ? `Je n'ai pas l'AEM de ton contrat${sansAEM[0].employeur ? ` chez ${sansAEM[0].employeur}` : ""} du ${fmt(sansAEM[0].date)}. Sans elle, ces heures n'existent pas pour France Travail — relance ton employeur.`
            : `Il me manque les AEM de ${sansAEM.length} de tes contrats. Sans elles, ces heures ne comptent pas. Scanne-les ou relance tes employeurs.`,
          action: "coffre", actionLabel: "Scanner une AEM",
        });
      }

      // 2. Employeur non renseigné
      const sansEmp = acts.filter(a => !a.employeur || !a.employeur.trim());
      if (sansEmp.length > 0) {
        out.push({
          id: "emp", niveau: "blue", icon: "ti-building-off",
          titre: `${sansEmp.length} contrat${sansEmp.length > 1 ? "s" : ""} sans employeur`,
          texte: `Tu n'as pas précisé l'employeur ${sansEmp.length === 1 ? `du ${fmt(sansEmp[0].date)}` : `de ${sansEmp.length} contrats`}. C'est utile pour ton actualisation et pour repérer une AEM manquante.`,
          action: "activites", actionLabel: "Compléter",
        });
      }

      // 3. Salaire brut manquant
      const sansBrut = acts.filter(a => !a.salaire_brut);
      if (sansBrut.length > 0 && sansBrut.length < acts.length) {
        out.push({
          id: "brut", niveau: "blue", icon: "ti-currency-euro-off",
          titre: `${sansBrut.length} contrat${sansBrut.length > 1 ? "s" : ""} sans salaire`,
          texte: `Le brut manque sur ${sansBrut.length === 1 ? `ton contrat du ${fmt(sansBrut[0].date)}` : `${sansBrut.length} contrats`}. Ajoute-le pour un récap d'actualisation complet.`,
          action: "activites", actionLabel: "Compléter",
        });
      }

      // 4. Trou suspect : un mois vide entouré de mois actifs
      if (acts.length >= 3) {
        const moisActifs = new Set(acts.map(a => { const d = new Date(a.date); return `${d.getFullYear()}-${d.getMonth()}`; }));
        const dates = acts.map(a => new Date(a.date)).filter(d => !isNaN(d)).sort((a, b) => a - b);
        if (dates.length >= 2) {
          const premier = dates[0], dernier = dates[dates.length - 1];
          const cur = new Date(premier.getFullYear(), premier.getMonth(), 1);
          const trous = [];
          while (cur <= dernier) {
            const clef = `${cur.getFullYear()}-${cur.getMonth()}`;
            if (!moisActifs.has(clef)) trous.push(`${MOIS[cur.getMonth()]} ${cur.getFullYear()}`);
            cur.setMonth(cur.getMonth() + 1);
          }
          if (trous.length > 0 && trous.length <= 2) {
            out.push({
              id: "trou", niveau: "blue", icon: "ti-calendar-question",
              titre: `Rien de déclaré en ${trous.join(", ")}`,
              texte: `Je ne vois aucune activité ${trous.length === 1 ? `en ${trous[0]}` : `sur ${trous.length} mois`}, alors que tu travailles avant et après. Si tu as bossé, pense à l'ajouter — sinon tout va bien.`,
              action: "activites", actionLabel: "Vérifier",
            });
          }
        }
      }

      // 5. Doublon potentiel (même date + employeur + nombre + type)
      const vus = {};
      let doublon = null;
      for (const a of acts) {
        const clef = `${a.date}|${(a.employeur || "").trim().toLowerCase()}|${a.nombre}|${a.type_activite}`;
        if (vus[clef]) { doublon = a; break; }
        vus[clef] = true;
      }
      if (doublon) {
        out.push({
          id: "doublon", niveau: "blue", icon: "ti-copy",
          titre: "Doublon possible",
          texte: `Tu as deux contrats identiques le ${fmt(doublon.date)}${doublon.employeur ? ` chez ${doublon.employeur}` : ""}. Si c'est une erreur de saisie, supprime-en un pour ne pas fausser ton compteur.`,
          action: "activites", actionLabel: "Vérifier",
        });
      }

      return out;
    })();
    const aDesAnomalies = anomalies.length > 0;

    // ═══ NEXT ACTION UNIQUE : une seule prochaine action, toujours ═══
    // Priorité : AEM manquante > heures > prêt. (Défini après `anomalies`, qu'il lit.)
    // `suivant` = l'objectif d'après (logique 2 temps : règle l'urgent, puis vise le reste).
    const nextAction = (() => {
      if (calc.secu) {
        return { icon: "ti-shield-check", txt: "Ton dossier est prêt à préparer.", nav: "attestation", suivant: null };
      }
      const manque = calc.manque;
      const phraseHeures = manque > 0
        ? `Encore ${manque} h ≈ ${calc.cachetsManquants} cachet${calc.cachetsManquants > 1 ? "s" : ""} pour sécuriser tes droits.`
        : null;
      // S'il y a une anomalie AEM manquante, elle prime (sans elle, les heures n'existent pas pour FT).
      const aemAnomalie = (anomalies || []).find(a => a.id === "aem");
      if (aemAnomalie) {
        return { icon: "ti-file-alert", txt: aemAnomalie.titre + " — à compléter.", nav: "coffre", suivant: phraseHeures };
      }
      if (manque > 0) {
        return { icon: "ti-arrow-right", txt: phraseHeures, nav: "activites", suivant: null };
      }
      return { icon: "ti-shield-check", txt: "Ton dossier est prêt à préparer.", nav: "attestation", suivant: null };
    })();

    // ═══ PROJECTION : "Quand pourrais-je renouveler ?" (3 scénarios, TOUS conditionnels) ═══
    // 🔵 uniquement. Toujours "tu pourrais", jamais "tu atteindras".
    const projection = (() => {
      if (calc.secu) return { dispo: false };
      const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
      const now = new Date();
      const seuil = calc.seuil;
      const heures = calc.heures;
      const manque = calc.manque;

      // Scénario 1 — Au rythme actuel (réutilise la date déjà calculée par calc).
      const rythme = calc.aUnRythme
        ? { label: "Au rythme actuel", valeur: calc.dateProjection ? calc.dateProjection : "à préciser", ok: !!calc.dateProjection, note: calc.dateProjection ? `~${calc.rythmeMensuel}h/mois` : "ajoute des contrats pour estimer" }
        : { label: "Au rythme actuel", valeur: "pas encore d'estimation", ok: false, note: "il me faut un peu d'historique" };

      // Scénario 2 — Sans nouveau contrat (plancher backend si dispo).
      const sansContrat = (c && c.projection_disponible)
        ? {
            label: "Sans nouveau contrat",
            valeur: c.projection_plancher_securise ? `${c.projection_plancher_heures}h — ça passe` : "renouvellement compromis",
            ok: !!c.projection_plancher_securise,
            note: c.projection_plancher_securise ? null : `il manquerait ${c.projection_plancher_manquant}h`,
          }
        : null;

      // Scénario 3 — Avec 2 cachets de plus par mois (12h/cachet).
      const cachetsSup = 2;
      const hSup = cachetsSup * 12; // par mois
      let avecCachets = null;
      if (manque > 0 && hSup > 0) {
        const moisNec = Math.ceil(manque / hSup);
        const d = new Date(now.getFullYear(), now.getMonth() + moisNec, 1);
        avecCachets = {
          label: `Avec ${cachetsSup} cachets/mois en plus`,
          valeur: `${MOIS[d.getMonth()]} ${d.getFullYear()}`,
          ok: true,
          note: `soit ${moisNec} mois`,
        };
      }

      const scenarios = [rythme, sansContrat, avecCachets].filter(Boolean);
      return { dispo: scenarios.length > 0, scenarios };
    })();

    // ═══ TIMELINE : heures faites par mois + heures qui sortent de la fenêtre ═══
    // Vue d'ensemble visuelle des 12 derniers mois + les 3 prochains (pour montrer les sorties à venir).
    const timeline = (() => {
      const MOIS_COURT = ["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];
      const now = new Date();
      const acts = (interActivites || []).map(a => {
        const d = new Date(a.date);
        if (isNaN(d)) return null;
        return { d, heures: heuresDe(a), sortie: new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()) };
      }).filter(Boolean);
      // On construit 12 mois passés (dont le mois courant) + 3 mois futurs
      const buckets = [];
      for (let i = -11; i <= 3; i++) {
        const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const heuresFaites = acts.filter(a => a.d.getFullYear() === m.getFullYear() && a.d.getMonth() === m.getMonth()).reduce((s, a) => s + a.heures, 0);
        // Heures qui SORTENT ce mois-là (date de sortie tombe dans ce mois)
        const heuresSortantes = acts.filter(a => a.sortie.getFullYear() === m.getFullYear() && a.sortie.getMonth() === m.getMonth()).reduce((s, a) => s + a.heures, 0);
        buckets.push({
          label: MOIS_COURT[m.getMonth()],
          annee: m.getFullYear(),
          mois: m.getMonth(),
          heuresFaites: Math.round(heuresFaites),
          heuresSortantes: Math.round(heuresSortantes),
          futur: i > 0,
          courant: i === 0,
        });
      }
      const maxHeures = Math.max(60, ...buckets.map(b => b.heuresFaites));
      const aDesDonnees = acts.length > 0;
      return { buckets, maxHeures, aDesDonnees };
    })();

    // ═══ RÉCAPITULATIF DE REVENUS (pour bailleur / banque) ═══
    // Synthèse des revenus déclarés sur les 12 derniers mois. Document personnel, PAS officiel.
    const recapRevenus = (() => {
      const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
      const now = new Date();
      const debut = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const acts = (interActivites || []).filter(a => { const d = new Date(a.date); return !isNaN(d) && d >= debut; });
      // Agrégat par mois
      const parMois = {};
      let totalBrut = 0, totalAvecBrut = 0, totalContrats = 0;
      acts.forEach(a => {
        const d = new Date(a.date);
        const clef = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        if (!parMois[clef]) parMois[clef] = { label: `${MOIS[d.getMonth()]} ${d.getFullYear()}`, brut: 0, contrats: 0, employeurs: new Set() };
        const brut = parseFloat(a.salaire_brut) || 0;
        parMois[clef].brut += brut;
        parMois[clef].contrats += 1;
        if (a.employeur) parMois[clef].employeurs.add(a.employeur);
        totalBrut += brut;
        if (brut > 0) totalAvecBrut += 1;
        totalContrats += 1;
      });
      const lignes = Object.keys(parMois).sort().reverse().map(k => ({ ...parMois[k], employeurs: parMois[k].employeurs.size }));
      const moisAvecRevenu = lignes.filter(l => l.brut > 0).length;
      const moyenneMensuelle = moisAvecRevenu > 0 ? totalBrut / moisAvecRevenu : 0;
      const employeursUniques = new Set(acts.map(a => a.employeur).filter(Boolean)).size;
      const periodeLabel = `${MOIS[debut.getMonth()]} ${debut.getFullYear()} – ${MOIS[now.getMonth()]} ${now.getFullYear()}`;
      // % de contrats avec brut renseigné (pour avertir si incomplet)
      const completude = totalContrats > 0 ? Math.round((totalAvecBrut / totalContrats) * 100) : 0;
      return { lignes, totalBrut: Math.round(totalBrut), moyenneMensuelle: Math.round(moyenneMensuelle), totalContrats, employeursUniques, periodeLabel, completude, aDesDonnees: acts.length > 0 };
    })();
    // Fiches pédagogiques (Conseils) — contenu vérifié sur sources officielles
    // (France Travail, Audiens) en juin 2026. Pédagogie pure, pas de conseil personnalisé.
    const FICHES_CONSEILS = [
      {
        icon: "ti-clock-hour-4", titre: "Les 507 heures, c'est quoi ?",
        texte: "Pour ouvrir ou renouveler tes droits, tu dois justifier d'au moins 507 heures de travail sur les 12 mois qui précèdent ta dernière fin de contrat. C'est une fenêtre glissante : à chaque examen, France Travail regarde les 12 derniers mois. Une fois les droits ouverts, tu es indemnisé pour 12 mois, jusqu'à ta date anniversaire.",
      },
      {
        icon: "ti-arrows-shuffle", titre: "Annexe 8 ou annexe 10 ?",
        texte: "L'annexe 8 concerne les techniciens, payés en heures réelles. L'annexe 10 concerne les artistes, payés au cachet. Pour le décompte des droits, un cachet d'artiste compte forfaitairement pour 12h. Tu peux cumuler des heures des deux annexes ; c'est celle où tu as le plus d'heures qui s'applique.",
      },
      {
        icon: "ti-calendar-clock", titre: "La date anniversaire",
        texte: "C'est le jour où tes droits sont réexaminés, 12 mois après la fin de contrat qui a ouvert tes droits. Elle change chaque année (on parle de date « flottante »). C'est le moment décisif : il faut avoir tes 507h dans les 12 mois précédents. Anticiper est la clé — c'est pour ça qu'Hector te montre où tu en es en permanence.",
      },
      {
        icon: "ti-lifebuoy", titre: "La clause de rattrapage (338h)",
        texte: "Si à ta date anniversaire tu n'as pas tes 507h mais que tu as cumulé entre 338 et 506 heures, un mécanisme de rattrapage peut prolonger ton indemnisation jusqu'à 6 mois, au même taux. Les heures faites pendant cette période comptent pour rouvrir tes droits. C'est un vrai filet de sécurité.",
      },
      {
        icon: "ti-baby-carriage", titre: "Congé maternité, accident : heures assimilées",
        texte: "Certaines périodes comptent comme du temps de travail pour tes 507h, même sans contrat : congé maternité/paternité et accident du travail sont assimilés à hauteur de 5 heures par jour. Des heures de formation ou d'enseignement artistique peuvent aussi être retenues sous conditions. Pense à les déclarer.",
      },
      {
        icon: "ti-umbrella", titre: "Les congés spectacles (Audiens)",
        texte: "Tes congés payés d'intermittent ne sont pas versés par ton employeur, mais par la Caisse des Congés Spectacles, gérée par Audiens. Tes employeurs cotisent à chaque contrat. Tu dois faire ta demande chaque année, à partir de mi-avril et avant le 31 mars suivant, depuis ton espace Congés Spectacles. C'est de l'argent qui t'attend — ne l'oublie pas.",
      },
    ];
    // ═══ MODULE ACTUALISATION : calcul du récap réel du mois à déclarer ═══
    // On déclare le mois civil écoulé. La fenêtre d'actualisation court ~du 28 au 15.
    const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    const maintenant = new Date();
    // Mois à déclarer selon le cycle France Travail :
    // l'actualisation d'un mois s'ouvre vers le 28 de CE mois et court jusqu'au 15 du mois suivant.
    // - du 16 à la fin du mois (donc à l'approche de l'ouverture du 28) : on déclare le MOIS COURANT
    //   (ex : le 26 juin, l'actu qui s'ouvre le 28 juin concerne JUIN, pas mai).
    // - du 1er au 15 : la fenêtre du mois précédent est encore ouverte → on déclare le MOIS PRÉCÉDENT
    //   (ex : le 5 juillet, on termine l'actu de juin).
    const jourCourant = maintenant.getDate();
    const decalageMois = jourCourant >= 16 ? 0 : -1;
    const moisDecl = new Date(maintenant.getFullYear(), maintenant.getMonth() + decalageMois, 1);
    const moisDeclLabel = `${MOIS_FR[moisDecl.getMonth()]} ${moisDecl.getFullYear()}`;
    const moisDeclNom = MOIS_FR[moisDecl.getMonth()];
    // Activités tombant dans le mois à déclarer
    const actusDuMois = (interActivites || []).filter(a => {
      if (!a || !a.date) return false;
      const d = new Date(a.date);
      return !isNaN(d) && d.getMonth() === moisDecl.getMonth() && d.getFullYear() === moisDecl.getFullYear();
    });
    // Agrégat par employeur
    const parEmployeur = {};
    let totalHeuresMois = 0, totalCachetsMois = 0, totalBrutMois = 0, brutManquant = false;
    actusDuMois.forEach(a => {
      const emp = (a.employeur && a.employeur.trim()) || "Employeur non précisé";
      const nb = parseFloat(a.nombre) || 0;
      const h = heuresDe(a);
      const estCachet = a.type_activite === "cachet_isole" || a.type_activite === "cachet_groupe";
      const brut = parseFloat(a.salaire_brut) || 0; // champ pas encore saisi en V1 → souvent 0
      if (!brut) brutManquant = true;
      totalHeuresMois += h;
      if (estCachet) totalCachetsMois += nb;
      totalBrutMois += brut;
      if (!parEmployeur[emp]) parEmployeur[emp] = { nom: emp, cachets: 0, heures: 0, brut: 0, aemRecue: a.aem_recue === true };
      parEmployeur[emp].heures += h;
      if (estCachet) parEmployeur[emp].cachets += nb;
      parEmployeur[emp].brut += brut;
    });
    const employeursMois = Object.values(parEmployeur);
    const nbEmployeursMois = employeursMois.length;
    // Détection des manques pour la check-list intelligente
    const aemManquantes = employeursMois.filter(e => !e.aemRecue);
    // Indice de confiance : vert si tout est là, orange sinon. (Logique volontairement simple en V1.)
    const actuProblemes = [];
    if (aemManquantes.length > 0) actuProblemes.push({ type: "aem", count: aemManquantes.length, emps: aemManquantes });
    if (brutManquant && actusDuMois.length > 0) actuProblemes.push({ type: "brut" });
    const actuVide = actusDuMois.length === 0;
    const actuNiveau = actuVide ? "vide" : actuProblemes.length === 0 ? "green" : "orange";
    const actuConfiance = actuVide ? null : actuProblemes.length === 0 ? 99 : Math.max(70, 99 - actuProblemes.length * 12);
    // Déjà actualisé ce mois ?
    const actuClef = `${moisDecl.getFullYear()}-${String(moisDecl.getMonth() + 1).padStart(2, "0")}`;
    const dejaActualise = (actuHistorique || []).some(h => h.clef === actuClef);
    // Fenêtre : on considère l'actualisation "ouverte" entre le 28 et le 15. Sinon "à venir".
    const actuOuverte = jourCourant >= 28 || jourCourant <= 15;
    const joursAvantOuverture = jourCourant < 28 ? (28 - jourCourant) : 0;

    // Les entrées du menu intermittent (reflètent les 6 promesses de la landing)
    const interMenuItems = [
      { id: "cockpit", icon: "ti-gauge", label: "Cockpit", dispo: true },
      { id: "actu", icon: "ti-clipboard-check", label: "Actualisation", dispo: true, badge: !dejaActualise && (actuOuverte || joursAvantOuverture <= 3) },
      { id: "calcul", icon: "ti-calculator", label: "Calcul des heures", dispo: true },
      { id: "hector", icon: "ti-message-2", label: "Parle à Hector", dispo: true },
      { id: "activites", icon: "ti-calendar-event", label: "Mes activités", dispo: true },
      { id: "conseils", icon: "ti-book", label: "Comprendre", dispo: true },
      { id: "attestation", icon: "ti-folder", label: "Mes documents", dispo: true },
      { id: "coffre", icon: "ti-camera", label: "Scanner une AEM", dispo: true },
    ];
    const interSidebar = (
      <div style={{ width: 220, flexShrink: 0, background: "rgba(7,25,46,0.6)", borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", padding: "16px 12px", minHeight: "100vh" }}>
        <div style={{ padding: "4px 8px 16px" }}><Logo size={30} dark /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {interMenuItems.map(item => {
            const actif = interNav === item.id;
            return (
              <button key={item.id} type="button" disabled={!item.dispo}
                onClick={() => { if (item.dispo) { setInterNav(item.id); setInterMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, background: actif ? "rgba(93,202,165,0.12)" : "transparent", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: actif ? "#5DCAA5" : (item.dispo ? "#B5D4F4" : "#4A6280"), fontWeight: actif ? 700 : 500, cursor: item.dispo ? "pointer" : "default", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 17, flexShrink: 0 }} />
                <span>{item.label}</span>
                {item.badge && <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "#5DCAA5", flexShrink: 0, boxShadow: "0 0 0 3px rgba(93,202,165,0.2)" }} />}
                {!item.dispo && <span style={{ marginLeft: "auto", fontSize: 9, color: "#4A6280", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 5px" }}>bientôt</span>}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 2 }}>
          <button type="button" onClick={() => { setInterNav("reglages"); setInterMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: interNav === "reglages" ? "rgba(93,202,165,0.12)" : "transparent", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: interNav === "reglages" ? "#5DCAA5" : "#B5D4F4", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
            <i className="ti ti-settings" aria-hidden="true" style={{ fontSize: 17 }} /> Réglages
          </button>
          <button type="button" onClick={() => { setShowWalkthrough(true); setInterMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: "#B5D4F4", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
            <i className="ti ti-help-circle" aria-hidden="true" style={{ fontSize: 17 }} /> Aide — Visite guidée
          </button>
          <button type="button" onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: "#8BA5C0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
            <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 17 }} /> Déconnexion
          </button>
        </div>
      </div>
    );

    return (
      <div style={{ background: "#07192E", minHeight: "100vh", color: "white", fontFamily: "inherit", display: "flex" }}>
        <style>{CSS}</style>

        {/* ═══ CÉLÉBRATION DE PALIER ═══ */}
        {celebPalier && (
          <div onClick={() => setCelebPalier(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(4,12,24,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "celebrIn 0.3s ease", overflow: "hidden", cursor: "pointer" }}>
            {/* confettis */}
            {Array.from({ length: 36 }).map((_, i) => {
              const colors = ["#5DCAA5", "#378ADD", "#FAC775", "#9FCBF5", "#E8F4FF"];
              const left = (i * 2.78) % 100;
              const delay = (i % 12) * 0.12;
              const dur = 2.2 + (i % 5) * 0.4;
              const size = 7 + (i % 4) * 3;
              return <div key={i} style={{ position: "absolute", top: "-6vh", left: `${left}%`, width: size, height: size * 0.5, background: colors[i % colors.length], borderRadius: 1, animation: `confettiFall ${dur}s ${delay}s ease-in forwards`, opacity: 0 }} />;
            })}
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", zIndex: 1, maxWidth: 380, width: "100%", background: "linear-gradient(160deg,#0d2440,#0a1322)", border: "1px solid rgba(93,202,165,0.4)", borderRadius: 22, padding: "30px 26px 26px", textAlign: "center", animation: "celebrCard 0.6s cubic-bezier(.34,1.56,.64,1)", cursor: "default", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", margin: "0 auto 18px", overflow: "hidden", border: "3px solid rgba(93,202,165,0.5)", boxShadow: "0 0 0 10px rgba(93,202,165,0.08)", background: "#0a1322" }} className="hector-breathe">
                <NiveauImage src={celebPalier.img} fallbackIcon="ti-trophy" fallbackColor="#5DCAA5" />
              </div>
              <div style={{ fontSize: 11, color: "#5DCAA5", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>Nouveau palier débloqué</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 10, lineHeight: 1.1 }}>Hector est {celebPalier.nom} ! 🎉</h2>
              <p style={{ fontSize: 14, color: "#B5D4F4", lineHeight: 1.6, marginBottom: 22 }}>{celebPalier.sous}. Tu avances exactement comme il faut — je suis fier de nous. 🐾</p>
              <button type="button" onClick={() => setCelebPalier(null)} style={{ width: "100%", background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Continuer 🐾</button>
            </div>
          </div>
        )}

        {/* Visionneuse de document AEM (overlay) */}
        {docViewer && (
          <div onClick={() => setDocViewer(null)} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(4,12,24,0.9)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 0 : 24, animation: "celebrIn 0.25s ease" }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 820, height: isMobile ? "100%" : "90vh", background: "#0c1f38", borderRadius: isMobile ? 0 : 16, overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(93,202,165,0.25)" }}>
              {/* En-tête */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                <i className="ti ti-file-text" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docViewer.filename}</div>
                {docViewer.url && (
                  <a href={docViewer.url} target="_blank" rel="noopener noreferrer" style={{ color: "#9FCBF5", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid rgba(159,203,245,0.3)", borderRadius: 7 }}>
                    <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 14 }} /> {!isMobile && "Onglet"}
                  </a>
                )}
                <button type="button" onClick={() => setDocViewer(null)} style={{ background: "transparent", border: "none", color: "#8BA5C0", fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </div>
              {/* Contenu */}
              <div style={{ flex: 1, background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
                {docViewer.loading ? (
                  <div style={{ color: "#8BA5C0", fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", border: "1.5px solid rgba(93,202,165,0.4)", overflow: "hidden" }} className="hector-breathe">
                      <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                    </div>
                    🐾 Je récupère ton document…
                  </div>
                ) : /\.(jpg|jpeg|png|webp)$/i.test(docViewer.filename) ? (
                  <img src={docViewer.url} alt={docViewer.filename} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <iframe src={docViewer.url} title={docViewer.filename} style={{ width: "100%", height: "100%", border: "none" }} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sidebar desktop */}
        {!isMobile && interSidebar}

        {/* Sidebar mobile (drawer) */}
        {isMobile && interMenuOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)" }} onClick={() => setInterMenuOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 201 }}>{interSidebar}</div>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,25,46,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button type="button" onClick={() => setInterMenuOpen(true)} aria-label="Menu" style={{ background: "transparent", border: "none", color: "white", fontSize: 22, cursor: "pointer", padding: 0 }}>
                <i className="ti ti-menu-2" aria-hidden="true" />
              </button>
            )}
            <span style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 600, background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 20, padding: "5px 12px" }}>Mode intermittent</span>
          </div>
          <button type="button" disabled={statutSaving} onClick={() => handleChangeStatut("auto_entrepreneur")}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#8BA5C0", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: statutSaving ? 0.6 : 1 }}>
            ← Mode auto-entrepreneur
          </button>
        </nav>

        <div style={{ maxWidth: (interNav === "cockpit" || interNav === "calcul") ? 920 : 560, margin: "0 auto", padding: "40px 20px 80px" }}>

          {/* ─── Bannière d'installation PWA (écran d'accueil) ─── */}
          {!pwaDismissed && (
            <InstallBanner pwaPrompt={pwaPrompt} onInstall={handleInstallClick} onDismiss={dismissPwa} showHelp={showInstallHelp} />
          )}

          {/* Chargement */}
          {interCockpitLoading && !c && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#6B8299" }}>
              <div style={{ fontSize: 14 }}>Hector calcule tes heures…</div>
            </div>
          )}

          {/* Erreur */}
          {interCockpitError && !c && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ color: "#E8927C", fontSize: 14, marginBottom: 16 }}>{interCockpitError}</div>
              <button type="button" onClick={loadIntermittentCockpit}
                style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Réessayer
              </button>
            </div>
          )}

          {/* Le compteur vivant */}
          {c && (
            <>
              {/* Bandeau Hector générique retiré : il répétait la même phrase sur chaque page.
                  Hector ne s'exprime plus que là où il a un vrai message (cockpit, actualisation…). */}
              {false && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "#0a1322", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <NiveauImage src="/hector-clap.png" fallbackIcon="ti-movie" fallbackColor="#3a5169" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#5DCAA5", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{etatLabels[c.hector_etat] || "Hector veille"}</div>
                  <div style={{ fontSize: 14, color: "#B5D4F4", marginTop: 2 }}>{c.hector_message}</div>
                </div>
              </div>
              )}

              {/* ═══ PAGE COCKPIT : 2 colonnes — Hector (gauche) + infos (droite) ═══ */}
              {interNav === "cockpit" && (<>



              {/* ═══ EN-TÊTE COCKPIT : Hector + état (le héros) ═══ */}
              <div style={{ background: etat.bg, border: `1px solid ${etat.bd}`, borderRadius: 16, padding: "18px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#07192E", border: `1px solid ${etat.bd}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    <NiveauImage src="/hector-tete.png" fallbackIcon="ti-paw" fallbackColor={etat.tc} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{etat.emoji}</span>
                      <div style={{ fontSize: 21, fontWeight: 800, color: etat.tc, lineHeight: 1.1 }}>{etat.titre}</div>
                    </div>
                    <div style={{ fontSize: 14, color: etat.st, marginTop: 6, lineHeight: 1.55 }}>{etat.phrase}</div>
                  </div>
                </div>
              </div>

              {/* ═══ OBJECTIF (en gros) + jauge renouvellement ═══ */}
              <div style={{ background: "#0a1322", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
                {!calc.secu ? (
                  <>
                    <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.25, marginBottom: 4 }}>
                      Plus que <span style={{ color: "#5DCAA5" }}>{calc.manque} h</span> pour sécuriser tes droits.
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5A7798", marginBottom: 16 }}>
                      {calc.heures} / {calc.seuil} h validées · ≈ {calc.cachetsManquants} cachet{calc.cachetsManquants > 1 ? "s" : ""}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 19, fontWeight: 800, color: "white", lineHeight: 1.25, marginBottom: 16 }}>
                    Tes <span style={{ color: "#5DCAA5" }}>{calc.seuil} h</span> sont là. 🎉
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                  <div style={{ fontSize: 12, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Renouvellement</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#5DCAA5" }}>{coach.pctChemin}%</div>
                </div>
                <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${coach.pctChemin}%`, background: "#5DCAA5", borderRadius: 6, transition: "width 0.7s cubic-bezier(.4,1.4,.6,1)" }} />
                </div>
                {fenetre.aDesActivites && fenetre.sortent60 > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                    <span style={{ fontSize: 11, color: "#5DCAA5" }}>🟢 {calc.heures} h certaines</span>
                    <span style={{ fontSize: 11, color: "#5A7798" }}>·</span>
                    <span style={{ fontSize: 11, color: "#7FB8F0" }}>🔵 {fenetre.sortent60} h sortent dans 60 j</span>
                  </div>
                )}
              </div>

              {/* ═══ NEXT ACTION UNIQUE ═══ */}
              <button type="button" onClick={() => setInterNav(nextAction.nav)}
                style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "rgba(55,138,221,0.1)", border: "1px solid rgba(55,138,221,0.3)", borderRadius: 14, padding: "15px 18px", marginBottom: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(127,184,240,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className={`ti ${nextAction.icon}`} aria-hidden="true" style={{ fontSize: 20, color: "#7FB8F0" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "#7FB8F0", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Ta prochaine action</div>
                  <div style={{ fontSize: 15, color: "white", fontWeight: 700, marginTop: 2 }}>{nextAction.txt}</div>
                  {nextAction.suivant && (
                    <div style={{ fontSize: 12, color: "#7E97B3", marginTop: 4 }}>Puis : {nextAction.suivant}</div>
                  )}
                </div>
                <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 18, color: "#7FB8F0", flexShrink: 0 }} />
              </button>

              {/* ═══ CHECKLIST DE RENOUVELLEMENT ═══ */}
              <div style={{ background: "#0a1322", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Ta checklist de renouvellement</div>
                  <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 700 }}>{checklist.faits} / {checklist.total}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {checklist.lignes.map(l => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 11, opacity: l.attente ? 0.5 : 1 }}>
                      <span style={{ fontSize: 16 }}>{l.badge}</span>
                      <div style={{ flex: 1, fontSize: 13.5, color: l.attente ? "#B5D4F4" : "#E8F4FF" }}>{l.label}</div>
                      <span style={{ fontSize: 11, color: l.coul }}>{l.statut}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerte détection d'erreurs (seulement si Hector a repéré quelque chose) */}
              {aDesAnomalies && (
                <button type="button" onClick={() => setInterNav("calcul")}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "rgba(250,199,117,0.08)", border: "1px solid rgba(250,199,117,0.28)", borderRadius: 14, padding: "13px 16px", marginBottom: 16, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a1322", border: "1.5px solid rgba(250,199,117,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    <NiveauImage src="/hector-tete.png" fallbackIcon="ti-alert-triangle" fallbackColor="#FAC775" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#FAE3B6" }}>J'ai repéré {anomalies.length} chose{anomalies.length > 1 ? "s" : ""} à vérifier 🐾</div>
                    <div style={{ fontSize: 12, color: "#C9A861", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{anomalies.map(a => a.titre).join(" · ")}</div>
                  </div>
                  <i className="ti ti-chevron-right" aria-hidden="true" style={{ color: "#FAC775", fontSize: 18, flexShrink: 0 }} />
                </button>
              )}

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>

                {/* ───────── COLONNE GAUCHE : Hector (la star) ───────── */}
                <div className={hectorPop ? "hector-pop" : ""} style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(93,202,165,0.2)", background: "#0a1322", animation: "paliersHalo 6s ease-in-out infinite" }}>
                  {/* Header immersif Hector (agrandi : il est la star) */}
                  <div style={{ position: "relative", width: "100%", height: isMobile ? 380 : 470, overflow: "hidden" }}>
                    {/* halo doux derrière Hector */}
                    <div style={{ position: "absolute", top: "32%", left: "50%", width: 280, height: 280, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(93,202,165,0.18), transparent 65%)", animation: "hectorHalo 5s ease-in-out infinite", pointerEvents: "none" }} />
                    <img src={palierActuel.img} alt={`Hector ${palierActuel.nom}`} className="hector-breathe"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", display: "block" }} />

                    {/* Badge palier en haut à droite */}
                    <div style={{ position: "absolute", top: 14, right: 14, textAlign: "right", background: "rgba(10,19,34,0.55)", backdropFilter: "blur(4px)", border: "1px solid rgba(159,203,245,0.25)", borderRadius: 10, padding: "7px 12px", zIndex: 2 }}>
                      <div style={{ fontSize: 9.5, color: "#9FCBF5", letterSpacing: 1.2, fontWeight: 600, opacity: 0.85 }}>PALIER {idxActuel + 1}</div>
                      <div style={{ fontSize: 15, color: "#9FCBF5", fontWeight: 800, lineHeight: 1.1 }}>{palierActuel.nom.toUpperCase()}</div>
                    </div>

                    {/* Fondu vers le fond de la carte */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 190, background: "linear-gradient(to bottom, transparent 0%, rgba(10,19,34,0.55) 42%, #0a1322 100%)", zIndex: 1 }} />

                    {/* Titre + message en bas à gauche */}
                    <div style={{ position: "absolute", bottom: 16, left: 20, right: 20, zIndex: 2 }}>
                      <div style={{ fontSize: 28, color: "white", fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                        Hector {palierActuel.nom}
                      </div>
                      <div style={{ fontSize: 13.5, color: "#D6E8FA", lineHeight: 1.55, marginTop: 5, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                        {c.hector_message}
                      </div>
                    </div>
                  </div>

                  {/* ── Progression en phrase + barre ── */}
                  <div style={{ padding: "16px 22px 18px" }}>
                    <div style={{ fontSize: 14, color: "white", fontWeight: 700, marginBottom: 10 }}>
                      Tu as déjà parcouru <span style={{ color: "#5DCAA5" }}>{coach.pctChemin}%</span> du chemin.
                    </div>
                    <div style={{ height: 10, background: "#07192E", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c.droits_securises ? "linear-gradient(90deg,#1D9E75,#5DCAA5)" : "linear-gradient(90deg,#2C6E8F,#378ADD)", borderRadius: 6, transition: "width 0.7s cubic-bezier(.4,1.4,.6,1)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6B8299", marginTop: 6 }}>
                      <span>{c.total_heures}h faites</span>
                      <span>Objectif · {c.seuil}h</span>
                    </div>

                    {/* Invitation à renseigner la date anniversaire si absente */}
                    {!c.date_anniversaire && (
                      <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, background: "rgba(250,199,117,0.06)", border: "1px solid rgba(250,199,117,0.2)", borderRadius: 10, padding: "11px 13px" }}>
                        <i className="ti ti-calendar-question" aria-hidden="true" style={{ color: "#FAC775", fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12, color: "#D6E8FA", lineHeight: 1.45 }}>
                          Renseigne ta <strong>date de renouvellement</strong> pour que je te dise si tu vas renouveler tes droits, pas juste où tu en es aujourd'hui.
                        </div>
                      </div>
                    )}

                    {/* Comparaison mois-à-mois (le chien remarque) */}
                    {coach.compa && (
                      <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start", gap: 9, background: coach.compa.sens === "up" ? "rgba(93,202,165,0.07)" : "rgba(250,199,117,0.06)", border: `1px solid ${coach.compa.sens === "up" ? "rgba(93,202,165,0.2)" : "rgba(250,199,117,0.2)"}`, borderRadius: 10, padding: "11px 13px" }}>
                        <i className={`ti ${coach.compa.sens === "up" ? "ti-trending-up" : "ti-trending-down"}`} aria-hidden="true" style={{ color: coach.compa.sens === "up" ? "#5DCAA5" : "#FAC775", fontSize: 17, flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 12.5, color: "#D6E8FA", lineHeight: 1.45 }}>{coach.compa.txt}</div>
                      </div>
                    )}

                  </div>

                  {/* ── ACCROCHE ANALYSE D'HECTOR (il remarque des choses) ── */}
                  {aDesAnalyses && (
                    <button type="button" onClick={() => setInterNav("calcul")}
                      style={{ width: "100%", textAlign: "left", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 22px", display: "flex", alignItems: "center", gap: 11, background: "rgba(55,138,221,0.05)", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <i className="ti ti-bulb" aria-hidden="true" style={{ color: "#7FB8F0", fontSize: 18, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#7FB8F0", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>J'ai remarqué</div>
                        <div style={{ fontSize: 13, color: "#D6E8FA", marginTop: 2 }}>{analyses[0].court}{analyses.length > 1 ? ` · +${analyses.length - 1}` : ""}</div>
                      </div>
                      <i className="ti ti-chevron-right" aria-hidden="true" style={{ color: "#7FB8F0", fontSize: 16, flexShrink: 0 }} />
                    </button>
                  )}

                  {/* ── PENSÉE D'HECTOR (il est vivant) ── */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 22px 18px", display: "flex", alignItems: "center", gap: 11, background: "rgba(93,202,165,0.04)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      <NiveauImage src="/hector-tete.png" fallbackIcon="ti-paw" fallbackColor="#5DCAA5" />
                    </div>
                    <div style={{ fontSize: 13, color: "#D6E8FA", lineHeight: 1.5, fontStyle: "italic" }}>{penseeHector}</div>
                  </div>
                </div>



                {/* ───────── COLONNE DROITE : anniversaire + verdict + frise ───────── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Brique 5.5 : date anniversaire (date de renouvellement des droits) ── */}
              <div style={{ background: "rgba(250,199,117,0.06)", border: "1px solid rgba(250,199,117,0.2)", borderRadius: 14, padding: "16px 20px" }}>
                {!anniversaireEdit && c.date_anniversaire && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <i className="ti ti-calendar-clock" aria-hidden="true" style={{ color: "#FAC775", fontSize: 22 }} />
                      <div>
                        <div style={{ fontSize: 11, color: "#C9A861", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Date anniversaire</div>
                        <div style={{ fontSize: 14, color: "white", fontWeight: 600, marginTop: 1 }}>
                          {c.jours_avant_anniversaire != null && c.jours_avant_anniversaire >= 0
                            ? `Dans ${c.jours_avant_anniversaire} jour${c.jours_avant_anniversaire > 1 ? "s" : ""}`
                            : "Renouvellement dépassé"}
                          <span style={{ color: "#8BA5C0", fontWeight: 400, fontSize: 12 }}> · {c.date_anniversaire}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#9A8050", marginTop: 3, fontStyle: "italic" }}>
                          C'est la date à laquelle France Travail étudie ton renouvellement.
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setAnniversaireInput(c.date_anniversaire || ""); setAnniversaireEdit(true); }}
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      Modifier
                    </button>
                  </div>
                )}
                {!anniversaireEdit && !c.date_anniversaire && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <i className="ti ti-calendar-plus" aria-hidden="true" style={{ color: "#FAC775", fontSize: 22 }} />
                      <div style={{ fontSize: 13, color: "#B5D4F4", lineHeight: 1.5 }}>
                        Renseigne ta date anniversaire pour qu'Hector te prévienne avant ton renouvellement.
                        <span style={{ display: "block", fontSize: 11.5, color: "#8BA5C0", marginTop: 3, fontStyle: "italic" }}>C'est la date à laquelle France Travail étudie ton renouvellement.</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setAnniversaireInput(""); setAnniversaireEdit(true); }}
                      style={{ background: "#FAC775", color: "#412402", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Ajouter
                    </button>
                  </div>
                )}
                {anniversaireEdit && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input type="date" value={anniversaireInput} onChange={e => setAnniversaireInput(e.target.value)}
                      style={{ flex: "1 1 160px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    <button type="button" disabled={anniversaireSaving} onClick={handleSaveAnniversaire}
                      style={{ background: "#FAC775", color: "#412402", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: anniversaireSaving ? "default" : "pointer", fontFamily: "inherit", opacity: anniversaireSaving ? 0.6 : 1 }}>
                      {anniversaireSaving ? "…" : "Enregistrer"}
                    </button>
                    <button type="button" onClick={() => setAnniversaireEdit(false)}
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      Annuler
                    </button>
                  </div>
                )}

                {/* ── Import attestation ARE : Hector lit la date anniversaire + le montant (ne calcule rien) ── */}
                {!anniversaireEdit && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(250,199,117,0.15)" }}>
                    {areExtrait ? (
                      // Écran de vérification : ce qu'Hector a lu, éditable avant enregistrement.
                      <div>
                        <div style={{ fontSize: 12.5, color: "#FAE3B6", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                          <i className="ti ti-file-check" aria-hidden="true" style={{ fontSize: 16 }} /> Voici ce que j'ai lu sur ton attestation
                        </div>
                        <div style={{ fontSize: 11.5, color: "#9A8050", marginBottom: 12, fontStyle: "italic" }}>Vérifie et corrige si besoin — je n'affiche que ce que France Travail a écrit, je ne calcule rien.</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: "#C9A861", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Date anniversaire</label>
                            <input type="date" value={areExtrait.date_anniversaire} onChange={e => setAreExtrait({ ...areExtrait, date_anniversaire: e.target.value })}
                              style={{ width: "100%", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: "#C9A861", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Montant journalier (€)</label>
                            <input type="text" inputMode="text" value={areExtrait.montant_journalier} onChange={e => setAreExtrait({ ...areExtrait, montant_journalier: e.target.value })}
                              placeholder="ex : 52,30"
                              style={{ width: "100%", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                        </div>
                        {areError && <div style={{ fontSize: 12, color: "#F0A0A0", marginTop: 9 }}>{areError}</div>}
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          <button type="button" disabled={areSaving} onClick={handleConfirmARE}
                            style={{ background: "#FAC775", color: "#412402", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: areSaving ? "default" : "pointer", fontFamily: "inherit", opacity: areSaving ? 0.6 : 1 }}>
                            {areSaving ? "Enregistrement…" : "C'est bon, enregistre"}
                          </button>
                          <button type="button" onClick={() => { setAreExtrait(null); setAreError(""); }}
                            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Bouton d'import (upload PDF/photo de l'attestation ARE).
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <i className="ti ti-file-upload" aria-hidden="true" style={{ color: "#FAC775", fontSize: 20, flexShrink: 0 }} />
                          <div style={{ fontSize: 12.5, color: "#B5D4F4", lineHeight: 1.5 }}>
                            Tu as ton attestation France Travail ?
                            <span style={{ display: "block", fontSize: 11.5, color: "#8BA5C0", marginTop: 2 }}>Glisse-la, je lis ta date anniversaire et ton montant journalier pour toi.</span>
                          </div>
                        </div>
                        <label style={{ background: areUploading ? "rgba(250,199,117,0.4)" : "#FAC775", color: "#412402", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: areUploading ? "default" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                          <i className="ti ti-upload" aria-hidden="true" style={{ fontSize: 15 }} />
                          {areUploading ? "Lecture…" : "Importer mon ARE"}
                          <input type="file" accept="image/*,application/pdf" disabled={areUploading} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handleImportARE(f); e.target.value = ""; }}
                            style={{ display: "none" }} />
                        </label>
                      </div>
                    )}
                    {areError && !areExtrait && <div style={{ fontSize: 12, color: "#F0A0A0", marginTop: 9 }}>{areError}</div>}
                  </div>
                )}
              </div>

              {/* ── Brique 5.3 : la frise des paliers (Progression) ── */}
              <div style={{ background: "#0a1322", border: "1px solid rgba(93,202,165,0.15)", borderRadius: 14, padding: "18px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "white", marginBottom: 2, textAlign: "center" }}>Progression</div>
                <div style={{ fontSize: 10.5, color: "#6B8299", marginBottom: 16, textAlign: "center" }}>Chaque heure déclarée le fait grandir avec toi.</div>
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "0 2px" }}>
                  {PALIERS_INTERMITTENT.map((p, i) => {
                    const acquis = c.total_heures >= p.seuil;
                    const iciMaintenant = i === idxActuel;
                    const ligneAcquise = i < PALIERS_INTERMITTENT.length - 1 && c.total_heures >= PALIERS_INTERMITTENT[i + 1].seuil;
                    const couleurActif = p.etat === "gardien" ? "#5DCAA5" : "#378ADD";
                    return (
                      <div key={p.etat} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
                        {i < PALIERS_INTERMITTENT.length - 1 && (
                          <div style={{ position: "absolute", top: 20, left: "50%", width: "100%", height: 2, background: ligneAcquise ? "#5DCAA5" : "rgba(255,255,255,0.06)", zIndex: 0 }} />
                        )}
                        <div style={{ position: "relative", zIndex: 1, width: 40, height: 40, borderRadius: "50%", margin: "0 auto 6px", overflow: "hidden", background: "#16314E",
                          border: iciMaintenant ? `2px solid ${couleurActif}` : (acquis ? "2px solid #5DCAA5" : "2px solid rgba(255,255,255,0.1)"),
                          opacity: acquis ? 1 : 0.35,
                          boxShadow: iciMaintenant ? `0 0 0 4px ${couleurActif}30` : "none",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <NiveauImage src={p.img} fallbackIcon={acquis ? "ti-check" : "ti-lock"} fallbackColor={acquis ? "#5DCAA5" : "#6B86A3"} />
                        </div>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: (acquis || iciMaintenant) ? "white" : "#3A5170", lineHeight: 1.2 }}>{p.nom}</div>
                        <div style={{ fontSize: 8.5, color: iciMaintenant ? couleurActif : (acquis ? "#9FE1CB" : "#2A4060") }}>
                          {iciMaintenant ? "tu es ici" : (acquis ? "✓" : p.court)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══ PROJECTION : "Quand pourrais-je renouveler ?" ═══ */}
              {projection.dispo && (
              <div style={{ background: "linear-gradient(160deg,#0d2440,#0a1322)", border: "1px solid rgba(55,138,221,0.25)", borderRadius: 16, padding: "18px 20px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(127,184,240,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="ti ti-calendar-event" aria-hidden="true" style={{ color: "#7FB8F0", fontSize: 18 }} />
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "white" }}>Quand pourrais-tu renouveler ?</div>
                </div>
                <div style={{ fontSize: 11.5, color: "#7E97B3", marginBottom: 14, lineHeight: 1.45 }}>
                  Des estimations, pas des certitudes — elles dépendent de ce qui va se passer.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {projection.scenarios.map((s, i) => (
                    <div key={i} style={{ background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.18)", borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🔵</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "#8FB4D8" }}>{s.label}</div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: s.ok ? "white" : "#F0997F", lineHeight: 1.2, marginTop: 1 }}>
                          {s.ok ? "tu pourrais y être " : ""}{s.valeur}
                        </div>
                        {s.note && <div style={{ fontSize: 10.5, color: "#6B8299", marginTop: 1 }}>{s.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {!calc.aDateAnniv && (
                  <div style={{ fontSize: 10.5, color: "#6B8299", marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
                    🐾 Ajoute ta date de renouvellement ci-dessus pour affiner ces estimations.
                  </div>
                )}
              </div>
              )}

                </div>{/* ── fin colonne droite ── */}
              </div>{/* ── fin grille 2 colonnes ── */}

              {/* ═══ ACTIONS (tout en bas : on agit après avoir lu) ═══ */}
              <div style={{ marginTop: 4 }}>
                    {/* LE gros bouton : Hector fait les calculs */}
                    <button type="button" onClick={() => setInterNav("calcul")}
                      style={{ width: "100%", marginTop: 16, background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 11, padding: "15px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                      <i className="ti ti-calculator" aria-hidden="true" style={{ fontSize: 18 }} /> Analyser ma situation
                    </button>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => setInterNav("activites")}
                        style={{ flex: 1, background: "transparent", color: "#9FCBF5", border: "1px solid rgba(159,203,245,0.3)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 15 }} /> Ajouter un contrat
                      </button>
                      <button type="button" onClick={() => setInterNav("coffre")}
                        style={{ flex: 1, background: "transparent", color: "#9FCBF5", border: "1px solid rgba(159,203,245,0.3)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <i className="ti ti-camera" aria-hidden="true" style={{ fontSize: 15 }} /> Scanner une AEM
                      </button>
                    </div>
              </div>

              </>)}

              {/* ═══ PAGE ACTUALISATION — "Hector a déjà bossé pour toi" ═══ */}
              {interNav === "actu" && (<>

              {/* Mode recopie guidé (plein écran) — affiché si actuGuideStep !== null */}
              {actuGuideStep !== null && (() => {
                const empList = employeursMois.length > 0 ? employeursMois : [];
                const steps = [
                  { label: "Étape 1 sur 4", say: "Copie ce montant", type: "value", value: brutManquant ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(totalBrutMois)), unit: "€", note: brutManquant ? "Brut à compléter dans tes contrats" : "Ton brut total du mois" },
                  { label: "Étape 2 sur 4", say: "Copie ce nombre d'heures", type: "value", value: String(Math.round(totalHeuresMois)), unit: "h", note: `Tes ${totalCachetsMois} cachet${totalCachetsMois > 1 ? "s" : ""} convertis` },
                  { label: "Étape 3 sur 4", say: "Coche tes employeurs", type: "emps" },
                  { label: "Fini", say: "", type: "done" },
                ];
                const s = steps[actuGuideStep];
                const copier = (txt, id) => { try { navigator.clipboard?.writeText(String(txt)); } catch {} setActuCopied(id); setTimeout(() => setActuCopied(""), 1400); };
                const marquerFait = () => {
                  const entry = { clef: actuClef, label: moisDeclLabel, date: new Date().toISOString(), heures: Math.round(totalHeuresMois), cachets: totalCachetsMois, brut: Math.round(totalBrutMois), employeurs: nbEmployeursMois };
                  const next = [entry, ...(actuHistorique || []).filter(h => h.clef !== actuClef)].slice(0, 24);
                  setActuHistorique(next);
                  safeStorage.setItem("actuHistorique", JSON.stringify(next));
                };
                return (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(4,12,24,0.94)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ maxWidth: 440, width: "100%", background: "#0c1f38", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 22, padding: "22px 20px 20px", position: "relative" }}>
                      <button type="button" onClick={() => setActuGuideStep(null)} style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", color: "#4A6280", fontSize: 19, cursor: "pointer", fontFamily: "inherit" }}><i className="ti ti-x" aria-hidden="true" /></button>
                      {/* progression */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 24, paddingRight: 28 }}>
                        {steps.map((_, i) => (
                          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < actuGuideStep ? "#5DCAA5" : i === actuGuideStep ? "rgba(93,202,165,0.55)" : "rgba(255,255,255,0.1)" }} />
                        ))}
                      </div>
                      {s.type === "done" ? (
                        <div style={{ textAlign: "center", padding: "6px 0" }}>
                          <div style={{ width: 82, height: 82, borderRadius: "50%", background: "radial-gradient(circle at 50% 35%, #12304f, #0a1322)", border: "2px solid rgba(93,202,165,0.45)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", boxShadow: "0 0 0 8px rgba(93,202,165,0.05)", overflow: "hidden" }}>
                            <NiveauImage src="/hector-tete.png" fallbackIcon="ti-mood-happy" fallbackColor="#5DCAA5" />
                          </div>
                          <h2 style={{ fontSize: 21, fontWeight: 800, color: "white", marginBottom: 10 }}>C'est fait ! 🐾</h2>
                          <p style={{ fontSize: 14, color: "#B5D4F4", lineHeight: 1.6, marginBottom: 22 }}>J'ai archivé ton mois de {moisDeclNom}.<br />Repose-toi, je reprends le 28.</p>
                          <button type="button" onClick={() => { marquerFait(); setActuGuideStep(null); }} style={{ width: "100%", background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Merci Hector</button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#5DCAA5", textTransform: "uppercase", textAlign: "center" }}>{s.label}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", margin: "14px 0 20px" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                              <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                            </div>
                            <div style={{ fontSize: 14, color: "white", fontWeight: 700 }}>{s.say}</div>
                          </div>
                          {s.type === "value" && (
                            <div style={{ background: "#07192E", border: "1.5px dashed rgba(93,202,165,0.4)", borderRadius: 16, padding: "26px 18px", textAlign: "center", marginBottom: 14 }}>
                              <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 12, lineHeight: 1.4 }}>{s.note}</div>
                              <div style={{ fontSize: 46, fontWeight: 800, color: "white", lineHeight: 1, letterSpacing: 0.5 }}>{s.value}<span style={{ fontSize: 22, color: "#6B8299", fontWeight: 600 }}> {s.unit}</span></div>
                              <button type="button" onClick={() => copier(s.value, "step" + actuGuideStep)} style={{ marginTop: 18, width: "100%", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "rgba(93,202,165,0.15)", color: "#5DCAA5", border: "1.5px solid rgba(93,202,165,0.35)", borderRadius: 11, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                <i className={`ti ${actuCopied === "step" + actuGuideStep ? "ti-check" : "ti-copy"}`} aria-hidden="true" /> {actuCopied === "step" + actuGuideStep ? "Copié !" : "Copier"}
                              </button>
                            </div>
                          )}
                          {s.type === "emps" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                              {empList.length === 0 && <div style={{ textAlign: "center", color: "#6B8299", fontSize: 13, padding: 16 }}>Aucun employeur ce mois-ci.</div>}
                              {empList.map((e, i) => {
                                const checked = actuEmpChecked[i];
                                return (
                                  <div key={i} onClick={() => setActuEmpChecked(prev => ({ ...prev, [i]: !prev[i] }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#07192E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                                    <div>
                                      <div style={{ color: "#E8F4FF", fontWeight: 700, fontSize: 14 }}>{e.nom}</div>
                                      <div style={{ color: "#8BA5C0", fontSize: 12, marginTop: 2 }}>{e.cachets > 0 ? `${e.cachets} cachet${e.cachets > 1 ? "s" : ""} · ` : ""}{Math.round(e.heures)}h{e.brut > 0 ? ` · ${new Intl.NumberFormat("fr-FR").format(Math.round(e.brut))} €` : ""}</div>
                                    </div>
                                    <i className={`ti ${checked ? "ti-square-check-filled" : "ti-square"}`} aria-hidden="true" style={{ fontSize: 22, color: "#5DCAA5", flexShrink: 0 }} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                            {actuGuideStep > 0 && <button type="button" onClick={() => setActuGuideStep(actuGuideStep - 1)} style={{ background: "transparent", color: "#8BA5C0", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "15px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retour</button>}
                            <button type="button" onClick={() => setActuGuideStep(actuGuideStep + 1)} style={{ flex: 1, background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{actuGuideStep === steps.length - 2 ? "C'est recopié ✓" : "Suivant"}</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── État VIDE : pas d'activité ce mois ── */}
              {actuVide && !dejaActualise && (
                <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
                  <div style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 16px", background: "radial-gradient(circle at 50% 35%, #12304f, #0a1322)", border: "2px solid rgba(93,202,165,0.45)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(93,202,165,0.05)", overflow: "hidden" }}>
                    <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.3, maxWidth: 420, margin: "0 auto 8px" }}>Pour {moisDeclNom}, je n'ai aucune activité enregistrée.</h1>
                  <p style={{ fontSize: 13.5, color: "#8BA5C0", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 20px" }}>Ajoute tes contrats du mois pour que je te prépare ton actualisation. Et n'oublie pas : même un mois sans cachet, il faut t'actualiser sur France Travail.</p>
                  <button type="button" onClick={() => { setInterNav("activites"); }} style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 11, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ajouter mes contrats</button>
                </div>
              )}

              {/* ── État DÉJÀ FAIT (raconte le mois, ne liste pas) ── */}
              {dejaActualise && (
                <div style={{ padding: "20px 0 8px", maxWidth: 480, margin: "0 auto" }}>
                  {/* 1. Le mois est le héros */}
                  <div style={{ textAlign: "center", marginBottom: 22 }}>
                    <div style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 16px", background: "radial-gradient(circle at 50% 35%, #12304f, #0a1322)", border: "2px solid rgba(93,202,165,0.45)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(93,202,165,0.05)", overflow: "hidden" }}>
                      <NiveauImage src="/hector-tete.png" fallbackIcon="ti-mood-happy" fallbackColor="#5DCAA5" />
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1.25, margin: "0 auto 8px" }}>✅ {moisDeclNom} terminé</h1>
                    <p style={{ fontSize: 13.5, color: "#8FB4D8", lineHeight: 1.6, maxWidth: 400, margin: "0 auto" }}>
                      {totalCachetsMois > 0 ? `${totalCachetsMois} cachet${totalCachetsMois > 1 ? "s" : ""} ajouté${totalCachetsMois > 1 ? "s" : ""}. ` : ""}{Math.round(totalHeuresMois)} heures enregistrées. Tout est cohérent.
                    </p>
                  </div>

                  {/* 2. Stats en phrase (icône + espace, pas des KPI) */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 22, marginBottom: 22, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i className="ti ti-ticket" aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
                      <span style={{ fontSize: 14, color: "#E8F4FF" }}><strong style={{ fontWeight: 800 }}>{totalCachetsMois}</strong> cachet{totalCachetsMois > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i className="ti ti-clock" aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
                      <span style={{ fontSize: 14, color: "#E8F4FF" }}><strong style={{ fontWeight: 800 }}>{Math.round(totalHeuresMois)}</strong> heures</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i className="ti ti-building" aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
                      <span style={{ fontSize: 14, color: "#E8F4FF" }}><strong style={{ fontWeight: 800 }}>{employeursMois.length}</strong> employeur{employeursMois.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* 3. Le détail : cartes (pas un tableau) sous ~10 lignes, sinon tableau */}
                  {actusDuMois.length > 0 && (() => {
                    const tri = [...actusDuMois].sort((a, b) => new Date(a.date) - new Date(b.date));
                    const enTableau = tri.length >= 10;
                    if (enTableau) {
                      // Vue tableau compacte (beaucoup de lignes)
                      return (
                        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "8px 4px", marginBottom: 22 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: "#6B8299", textTransform: "uppercase" }}>
                            <span style={{ width: 44, flexShrink: 0 }}>Date</span>
                            <span style={{ flex: 1 }}>Employeur</span>
                            <span style={{ width: 56, textAlign: "right", flexShrink: 0 }}>Heures</span>
                            <span style={{ width: 54, textAlign: "right", flexShrink: 0 }}>Source</span>
                          </div>
                          {tri.map((a, i) => {
                            const h = Math.round(heuresDe(a));
                            const dO = new Date(a.date);
                            const dc = String(dO.getDate()).padStart(2, "0") + "/" + String(dO.getMonth() + 1).padStart(2, "0");
                            const estAem = a.aem_recue === true || a.source === "ocr";
                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <span style={{ width: 44, fontSize: 12, color: "#9FCBF5", flexShrink: 0 }}>{dc}</span>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: a.employeur ? "#E8F4FF" : "#FAC775", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.employeur || "À compléter"}</span>
                                <span style={{ width: 56, textAlign: "right", fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0 }}>{h} h</span>
                                <span style={{ width: 54, textAlign: "right", fontSize: 10.5, fontWeight: 600, color: estAem ? "#5DCAA5" : "#8BA5C0", flexShrink: 0 }}>{estAem ? "AEM" : "Manuel"}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    // Vue cartes riches (peu de lignes)
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                        {tri.map((a, i) => {
                          const estCachet = a.type_activite === "cachet_isole" || a.type_activite === "cachet_groupe";
                          const nb = parseFloat(a.nombre) || 0;
                          const h = Math.round(heuresDe(a));
                          const aEmp = a.employeur && a.employeur.trim();
                          const dO = new Date(a.date);
                          const dateLong = dO.getDate() + " " + MOIS_FR[dO.getMonth()];
                          const estAem = a.aem_recue === true || a.source === "ocr";
                          return (
                            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "15px 17px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 800, color: "white" }}>{dateLong}</span>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: estAem ? "#5DCAA5" : "#8BA5C0", display: "inline-flex", alignItems: "center", gap: 4, background: estAem ? "rgba(93,202,165,0.12)" : "rgba(255,255,255,0.05)", borderRadius: 6, padding: "3px 8px" }}>
                                  <i className={`ti ${estAem ? "ti-file-check" : "ti-pencil"}`} aria-hidden="true" style={{ fontSize: 12 }} /> {estAem ? "AEM" : "Manuel"}
                                </span>
                              </div>
                              {aEmp ? (
                                <div style={{ fontSize: 13, color: "#E8F4FF", display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                                  <i className="ti ti-building" aria-hidden="true" style={{ fontSize: 15, color: "#7FB8F0" }} />{a.employeur}
                                </div>
                              ) : (
                                <div onClick={() => { setInterEditId(a.id); setInterEditForm({ date: a.date, type_activite: a.type_activite, nombre: a.nombre, employeur: "", estime: a.estime === true }); setInterNav("activites"); }}
                                  style={{ fontSize: 13, color: "#FAC775", display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 10, cursor: "pointer" }}>
                                  <i className="ti ti-alert-circle" aria-hidden="true" style={{ fontSize: 15 }} /> Employeur à compléter
                                </div>
                              )}
                              <div style={{ display: "flex", gap: 18 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <i className="ti ti-ticket" aria-hidden="true" style={{ fontSize: 15, color: "#5DCAA5" }} />
                                  <span style={{ fontSize: 13, color: "#E8F4FF" }}><strong style={{ fontWeight: 800 }}>{nb}</strong> {estCachet ? `cachet${nb > 1 ? "s" : ""}` : "h"}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <i className="ti ti-clock" aria-hidden="true" style={{ fontSize: 15, color: "#5DCAA5" }} />
                                  <span style={{ fontSize: 13, color: "#E8F4FF" }}><strong style={{ fontWeight: 800 }}>{h}</strong> heures</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* 5. Célébration + lien avec le cockpit */}
                  {(() => {
                    const pct = calc.seuil > 0 ? Math.min(100, Math.round((calc.heures / calc.seuil) * 100)) : 0;
                    return (
                      <div style={{ background: "linear-gradient(160deg, rgba(93,202,165,0.1), rgba(10,19,34,0.4))", border: "1px solid rgba(93,202,165,0.28)", borderRadius: 16, padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                            <NiveauImage src="/hector-tete.png" fallbackIcon="ti-paw" fallbackColor="#5DCAA5" />
                          </div>
                          <div style={{ fontSize: 13.5, color: "#E8F4FF", lineHeight: 1.6 }}>
                            Ces <strong style={{ color: "#5DCAA5", fontWeight: 800 }}>{Math.round(totalHeuresMois)} heures</strong> viennent d'être ajoutées à ton dossier. Tu passes maintenant à <strong style={{ color: "#5DCAA5", fontWeight: 800 }}>{calc.heures} h validées</strong>{calc.secu ? " — tes droits sont sécurisés ✓" : `, soit ${pct} % vers ton renouvellement.`}
                          </div>
                        </div>
                        {!calc.secu && (
                          <div style={{ marginTop: 12, height: 8, background: "#07192E", borderRadius: 5, overflow: "hidden" }}>
                            <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg,#2C6E8F,#5DCAA5)", borderRadius: 5, transition: "width 0.7s ease" }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── État NORMAL : Hector a préparé l'actualisation ── */}
              {!actuVide && !dejaActualise && (<>

                {/* 1. LA PRÉSENCE */}
                <div style={{ textAlign: "center", marginBottom: 26 }}>
                  <div style={{ width: 88, height: 88, borderRadius: "50%", margin: "0 auto 16px", background: "radial-gradient(circle at 50% 35%, #12304f, #0a1322)", border: "2px solid rgba(93,202,165,0.45)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(93,202,165,0.05), 0 10px 30px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                    <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                  </div>
                  <h1 style={{ fontSize: 21, fontWeight: 800, color: "white", lineHeight: 1.3, maxWidth: 420, margin: "0 auto" }}>Salut 🐾 J'ai préparé ton actualisation de {moisDeclNom}.</h1>
                  <div style={{ fontSize: 12.5, color: "#6B8299", marginTop: 8 }}>
                    {actuOuverte ? "Elle est ouverte — tu peux y aller" : `Elle ouvre dans ${joursAvantOuverture} jour${joursAvantOuverture > 1 ? "s" : ""}`}
                  </div>
                </div>

                {/* 2. LE VERDICT */}
                <div style={{ borderRadius: 16, padding: "18px 20px", marginBottom: 26, border: `1px solid ${actuNiveau === "green" ? "rgba(93,202,165,0.3)" : "rgba(250,199,117,0.28)"}`, background: actuNiveau === "green" ? "rgba(93,202,165,0.08)" : "rgba(250,199,117,0.07)", display: "flex", alignItems: "center", gap: 15 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: actuNiveau === "green" ? "rgba(93,202,165,0.15)" : "rgba(250,199,117,0.15)" }}>{actuNiveau === "green" ? "🟢" : "🟠"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: actuNiveau === "green" ? "white" : "#FAE3B6", lineHeight: 1.3 }}>
                      {actuNiveau === "green" ? "J'ai tout vérifié. Tu peux y aller tranquille." : "Presque prêt. Jette un œil ci-dessous."}
                    </div>
                  </div>
                  {actuConfiance != null && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: actuNiveau === "green" ? "#5DCAA5" : "#FAC775" }}>{actuConfiance}%</div>
                      <div style={{ fontSize: 9, color: "#6B8299", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>confiance</div>
                    </div>
                  )}
                </div>

                {/* 3. LA PREUVE — ce que j'ai fait */}
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "white", margin: "0 2px 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>✅</span> Voilà ce que j'ai fait pour toi</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 15px" }}>
                    <div style={{ width: 21, height: 21, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginTop: 1, background: "rgba(93,202,165,0.15)", color: "#5DCAA5" }}><i className="ti ti-check" aria-hidden="true" /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: "#E8F4FF", lineHeight: 1.4 }}>J'ai trouvé {actusDuMois.length} activité{actusDuMois.length > 1 ? "s" : ""} chez {nbEmployeursMois} employeur{nbEmployeursMois > 1 ? "s" : ""}</div></div>
                  </div>
                  {aemManquantes.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 15px" }}>
                      <div style={{ width: 21, height: 21, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginTop: 1, background: "rgba(93,202,165,0.15)", color: "#5DCAA5" }}><i className="ti ti-check" aria-hidden="true" /></div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: "#E8F4FF", lineHeight: 1.4 }}>Tout est cohérent, j'ai agrégé ton mois</div></div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(250,199,117,0.06)", border: "1px solid rgba(250,199,117,0.22)", borderRadius: 12, padding: "12px 15px" }}>
                      <div style={{ width: 21, height: 21, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginTop: 1, background: "rgba(250,199,117,0.18)", color: "#FAC775" }}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#FAE3B6", lineHeight: 1.4 }}>Il me manque {aemManquantes.length} AEM</div>
                        <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 2, lineHeight: 1.45 }}>{aemManquantes.map(e => e.nom).join(", ")} — sans elle{aemManquantes.length > 1 ? "s" : ""}, ces heures ne comptent pas.</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setInterNav("activites")} style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer", borderRadius: 7, padding: "6px 11px", border: "1px solid #FAC775", background: "#FAC775", color: "#412402" }}>Voir mes activités</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. LE RÉSULTAT — voilà ton mois */}
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "white", margin: "0 2px 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>📋</span> Et voilà ton mois, prêt à recopier</div>
                <div style={{ background: "linear-gradient(160deg,#11203a,#0d1a30)", border: "1px solid rgba(93,202,165,0.2)", borderRadius: 16, padding: "18px 20px", marginBottom: 28 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 9, marginBottom: 4 }}>
                    <div style={{ textAlign: "center", padding: "6px 4px" }}><div style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{nbEmployeursMois}</div><div style={{ fontSize: 10, color: "#8BA5C0", marginTop: 6 }}>employeur{nbEmployeursMois > 1 ? "s" : ""}</div></div>
                    <div style={{ textAlign: "center", padding: "6px 4px" }}><div style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{totalCachetsMois}</div><div style={{ fontSize: 10, color: "#8BA5C0", marginTop: 6 }}>cachets</div></div>
                    <div style={{ textAlign: "center", padding: "6px 4px" }}><div style={{ fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1 }}>{Math.round(totalHeuresMois)}<span style={{ fontSize: 13, color: "#6B8299", fontWeight: 600 }}>h</span></div><div style={{ fontSize: 10, color: "#8BA5C0", marginTop: 6 }}>heures</div></div>
                    <div style={{ textAlign: "center", padding: "6px 4px" }}><div style={{ fontSize: 22, fontWeight: 800, color: brutManquant ? "#6B8299" : "white", lineHeight: 1 }}>{brutManquant ? "—" : new Intl.NumberFormat("fr-FR").format(Math.round(totalBrutMois))}<span style={{ fontSize: 13, color: "#6B8299", fontWeight: 600 }}>€</span></div><div style={{ fontSize: 10, color: "#8BA5C0", marginTop: 6 }}>brut</div></div>
                  </div>
                  {employeursMois.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      {employeursMois.map((e, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                          <span style={{ color: "#D6E8FA", display: "flex", alignItems: "center", gap: 8 }}><i className="ti ti-building" aria-hidden="true" style={{ color: "#5A7088", fontSize: 14 }} /> {e.nom}</span>
                          <span style={{ color: "#8BA5C0" }}>{e.cachets > 0 ? `${e.cachets} cachet${e.cachets > 1 ? "s" : ""}` : `${Math.round(e.heures)}h`}{e.brut > 0 ? ` · ${new Intl.NumberFormat("fr-FR").format(Math.round(e.brut))} €` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {brutManquant && (
                    <div style={{ marginTop: 12, fontSize: 11, color: "#8BA5C0", lineHeight: 1.5, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 12px" }}>
                      🐾 Je n'ai pas encore tes salaires bruts. Ajoute-les sur tes contrats pour un récap complet.
                    </div>
                  )}
                </div>

                {/* 5. LA PASSATION */}
                <button type="button" onClick={() => { setActuGuideStep(0); setActuEmpChecked({}); }} style={{ width: "100%", fontFamily: "inherit", fontSize: 15.5, fontWeight: 700, cursor: "pointer", background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 13, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                  <i className="ti ti-player-play" aria-hidden="true" style={{ fontSize: 18 }} /> M'actualiser sereinement
                </button>
                <div style={{ fontSize: 10.5, color: "#45596F", textAlign: "center", lineHeight: 1.5, marginTop: 14 }}>C'est toujours toi qui valides sur France Travail.</div>
              </>)}

              {/* ── Historique des actualisations ── */}
              {(actuHistorique || []).length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#6B8299", textTransform: "uppercase", margin: "0 2px 14px" }}>Tes actualisations</div>
                  <div style={{ position: "relative", paddingLeft: 8 }}>
                    {actuHistorique.map((h, i) => {
                      const dernier = i === actuHistorique.length - 1;
                      return (
                        <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
                          {/* Colonne frise : point + trait */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(93,202,165,0.15)", border: "1.5px solid rgba(93,202,165,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <i className="ti ti-check" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 14 }} />
                            </div>
                            {!dernier && <div style={{ width: 2, flex: 1, background: "rgba(93,202,165,0.2)", minHeight: 18 }} />}
                          </div>
                          {/* Contenu du mois */}
                          <div style={{ flex: 1, paddingBottom: dernier ? 0 : 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "white", marginBottom: 5 }}>{h.label}</div>
                            <div style={{ display: "flex", gap: 16 }}>
                              <span style={{ fontSize: 12, color: "#8FB4D8", display: "inline-flex", alignItems: "center", gap: 5 }}><i className="ti ti-ticket" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />{h.cachets} cachet{h.cachets > 1 ? "s" : ""}</span>
                              <span style={{ fontSize: 12, color: "#8FB4D8", display: "inline-flex", alignItems: "center", gap: 5 }}><i className="ti ti-clock" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />{h.heures} h</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {actuHistorique.length >= 3 && (
                    <div style={{ fontSize: 11.5, color: "#5DCAA5", textAlign: "center", marginTop: 16, fontWeight: 600 }}>🐾 Tu t'actualises sans faute depuis {actuHistorique.length} mois. Continue comme ça.</div>
                  )}
                </div>
              )}
              </>)}

              {/* ═══ PAGE CENTRE DE CALCUL HECTOR — conversationnel ═══ */}
              {interNav === "calcul" && (<>

              {/* En-tête */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <NiveauImage src="/hector-tete.png" fallbackIcon="ti-calculator" fallbackColor="#5DCAA5" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Centre de calcul 🐾</div>
                  <div style={{ fontSize: 12.5, color: "#8BA5C0" }}>Demande-moi, je regarde ton dossier.</div>
                </div>
              </div>

              {/* ── EN RÉSUMÉ ── */}
              {(() => {
                const nbAem = (interActivites || []).filter(a => !(a.aem_recue === true || a.source === "ocr")).length;
                let phrase;
                if (calc.secu && nbAem === 0) phrase = "Ton dossier est complet et tes droits sont sécurisés. Rien à signaler. 🐾";
                else if (calc.secu && nbAem > 0) phrase = "Tes droits sont sécurisés, mais il te manque " + nbAem + " AEM. Récupère-les et ton dossier sera nickel.";
                else if (nbAem > 0) phrase = "Il te manque " + calc.manque + " h et " + nbAem + " AEM. Si tu règles les AEM, ton dossier sera déjà plus propre.";
                else phrase = "Il te manque " + calc.manque + " h pour sécuriser tes droits. Continue à déclarer tes contrats.";
                return (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "rgba(93,202,165,0.06)", border: "1px solid rgba(93,202,165,0.22)", borderRadius: 14, padding: "14px 16px", marginBottom: 22 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      <NiveauImage src="/hector-tete.png" fallbackIcon="ti-paw" fallbackColor="#5DCAA5" />
                    </div>
                    <div style={{ fontSize: 13.5, color: "#E8F4FF", lineHeight: 1.55 }}><span style={{ color: "#5DCAA5", fontWeight: 700 }}>En résumé :</span> {phrase}</div>
                  </div>
                );
              })()}


              {/* ═══ GRILLE 2 COLONNES (gauche large / droite étroite) ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: 16, alignItems: "start", marginBottom: 22 }}>

                {/* ───────── COLONNE GAUCHE ───────── */}
                <div>
              {/* ── 0. CE QUE J'AI DÉTECTÉ (carte unique, style maquette) ── */}
              {aDesAnomalies && (
                <div style={{ background: "rgba(226,83,61,0.07)", border: "1px solid rgba(226,83,61,0.28)", borderRadius: 16, padding: "20px 22px", marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 18 }}>🔴</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Ce que j'ai détecté</div>
                    </div>
                    <span style={{ fontSize: 10.5, color: "#F0997F", background: "rgba(226,83,61,0.15)", border: "1px solid rgba(226,83,61,0.3)", borderRadius: 7, padding: "3px 9px", fontWeight: 700 }}>{anomalies.length} {anomalies.length > 1 ? "anomalies" : "anomalie"}</span>
                  </div>
                  {(() => {
                    const nbAem = (interActivites || []).filter(a => !(a.aem_recue === true || a.source === "ocr")).length;
                    const nbOrange = anomalies.filter(a => a.niveau === "orange" && a.id !== "aem").length;
                    let conf = 100 - (nbAem * 6) - (nbOrange * 4);
                    if (conf < 40) conf = 40;
                    const note = nbAem > 0
                      ? "Il me reste " + nbAem + " AEM à vérifier pour être sûr à 100 %."
                      : "Toutes tes AEM connues ont été analysées.";
                    const cc = conf >= 85 ? "#5DCAA5" : conf >= 65 ? "#FAC775" : "#F0997F";
                    return (
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 11, padding: "12px 14px", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 12, color: "#A9C2DC", fontWeight: 600 }}>Confiance de l'analyse</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: cc }}>{conf} %</span>
                        </div>
                        <div style={{ height: 7, background: "#07192E", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ width: conf + "%", height: "100%", background: cc, borderRadius: 5, transition: "width 0.6s ease" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#7E97B3", marginTop: 7, lineHeight: 1.45 }}>{note}</div>
                      </div>
                    );
                  })()}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[
                      { cle: "crit", label: "🚨 À corriger immédiatement", tc: "#F0997F", items: anomalies.filter(a => a.id === "aem") },
                      { cle: "verif", label: "⚠️ À vérifier", tc: "#FAC775", items: anomalies.filter(a => a.id !== "aem" && a.niveau === "orange") },
                      { cle: "info", label: "💡 Information", tc: "#7FB8F0", items: anomalies.filter(a => a.id !== "aem" && a.niveau === "blue") },
                    ].filter(g => g.items.length > 0).map(g => (
                      <div key={g.cle}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: g.tc, marginBottom: 8, letterSpacing: 0.3 }}>{g.label}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                          {g.items.map(an => {
                            const pal = {
                              orange: { bg: "rgba(250,199,117,0.07)", bd: "rgba(250,199,117,0.25)", tc: "#FAC775" },
                              blue: { bg: "rgba(55,138,221,0.06)", bd: "rgba(55,138,221,0.22)", tc: "#7FB8F0" },
                            }[an.niveau];
                            return (
                              <div key={an.id} style={{ background: pal.bg, border: "1px solid " + pal.bd, borderRadius: 12, padding: "13px 15px" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                                  <i className={"ti " + an.icon} aria-hidden="true" style={{ color: pal.tc, fontSize: 19, flexShrink: 0, marginTop: 1 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: an.niveau === "orange" ? "#FAE3B6" : "#D6E8FA" }}>{an.titre}</div>
                                    <div style={{ fontSize: 12.5, color: "#A9C2DC", lineHeight: 1.5, marginTop: 3 }}>{an.texte}</div>
                                    <button type="button" onClick={() => setInterNav(an.action)}
                                      style={{ marginTop: 9, background: "transparent", border: "1px solid " + pal.bd, color: pal.tc, borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                      {an.actionLabel}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message rassurant si tout est clean */}
              {!aDesAnomalies && (interActivites || []).length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(93,202,165,0.07)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
                  <i className="ti ti-shield-check" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 20, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#D6E8FA", lineHeight: 1.5 }}>🐾 J'ai vérifié ton dossier, tout est cohérent. Rien à signaler.</div>
                </div>
              )}

              {/* ── CE QUE JE PENSE ── */}
              {(() => {
                const aemAno = (anomalies || []).find(a => a.id === "aem");
                let opinion = null;
                if (aemAno) opinion = "Je pense que ton plus gros risque vient des AEM manquantes. Sans elles, des heures que tu as bel et bien travaillées ne comptent pas pour France Travail. Une fois réglées, ton dossier sera beaucoup plus fiable.";
                else if (!calc.secu && calc.manque > 0) opinion = "Je pense que tu es sur la bonne pente, mais il te reste " + calc.manque + " h à sécuriser. Si tu gardes ton rythme actuel, ça devrait le faire — surtout, ne laisse pas passer un mois creux.";
                else if (calc.secu) opinion = "Honnêtement, ton dossier est solide. Tes droits sont là. Chaque heure en plus, c'est du bonus pour ton prochain renouvellement.";
                if (!opinion) return null;
                return (
                  <div style={{ background: "linear-gradient(160deg, rgba(93,202,165,0.08), rgba(10,19,34,0.4))", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "20px 22px", marginBottom: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <NiveauImage src="/hector-tete.png" fallbackIcon="ti-paw" fallbackColor="#5DCAA5" />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Ce que je pense 🐾</div>
                    </div>
                    <div style={{ fontSize: 13.5, color: "#E8F4FF", lineHeight: 1.6 }}>{opinion}</div>
                  </div>
                );
              })()}

              {(() => {
                // ───────── MOTEUR DE RÉPONSES : fabrique ce qu'Hector dit, à partir des vraies données ─────────
                // Règle d'or : Hector ne fait JAMAIS semblant d'avoir une donnée. S'il manque la date
                // anniversaire, il le dit et invite à l'ajouter, au lieu d'inventer une projection.
                const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
                const dateAnnivTxt = c && c.date_anniversaire ? `${new Date(c.date_anniversaire).getDate()} ${MOIS[new Date(c.date_anniversaire).getMonth()]}` : null;
                // Les données qu'Hector "consulte" (citées dans chaque réponse)
                const bases = [
                  `${calc.heures} heures déclarées`,
                  `${totalCachetsMois >= 0 ? (interActivites || []).filter(a => a.type_activite !== "heures").reduce((s, a) => s + (parseFloat(a.nombre) || 0), 0) : 0} cachets au total`,
                  dateAnnivTxt ? `date anniversaire : ${dateAnnivTxt}` : null,
                  calc.aUnRythme ? `ton activité des 3 derniers mois` : null,
                ].filter(Boolean);

                // Ouvertures émotionnelles selon le niveau
                const ouverture = {
                  green: ["Ça sent bon.", "On peut souffler.", "Je suis plutôt confiant."],
                  orange: ["Je préfère te prévenir.", "Celui-là mérite qu'on s'y attarde.", "Je garde un œil dessus."],
                  blue: ["Regardons ça ensemble.", "Bonne question.", "Voyons où tu en es."],
                }[calc.conseilNiveau === "orange" ? "orange" : calc.secu || calc.dansLesTemps ? "green" : "blue"];
                const pickOuv = () => ouverture[Math.floor(Math.random() * ouverture.length)];

                // Le moteur : chaque question → { text, questions:[ids], pourquoi }
                const R = {};

                R.renouveler = () => {
                  if (calc.secu) return {
                    ouv: "On peut souffler.",
                    text: `D'après ce que je vois, tes droits sont déjà sécurisés${dateAnnivTxt ? ` jusqu'à ton renouvellement du ${dateAnnivTxt}` : ""}. Tu as tes 507h. Pour moi, on est tranquilles — et chaque heure que tu ajoutes prépare déjà ton prochain renouvellement.`,
                    pourquoi: `Tu es à ${calc.heures}h, au-dessus du seuil de ${calc.seuil}h requis. C'est ce seuil, atteint dans ta période de référence, qui ouvre le renouvellement.`,
                    suite: ["combien_manque", "rythme", "si_pause"],
                  };
                  if (!dateAnnivTxt) return {
                    ouv: "Il me manque une info.",
                    text: `Pour te dire si tu vas renouveler, j'ai besoin de ta date anniversaire — c'est elle qui fixe le renouvellement où on examine tes droits. Sans elle, je ne veux pas te donner une réponse à l'aveugle.`,
                    manque: true,
                    suite: ["combien_manque", "combien_cachets"],
                  };
                  if (calc.dansLesTemps === true) return {
                    ouv: "Ça sent bon.",
                    text: `Je nous vois bien. Il te manque ${calc.manque}h, et à ton rythme actuel${calc.dateProjection ? ` tu atteindrais les 507h vers ${calc.dateProjection}` : ""}, avant ton renouvellement du ${dateAnnivTxt}. Si c'était mon dossier, je continuerais sur cette lancée.`,
                    pourquoi: `Tu fais ~${calc.rythmeMensuel}h/mois. Il te reste ${calc.joursAnniv} jours avant le ${dateAnnivTxt}, soit assez de temps pour combler les ${calc.manque}h manquantes à ce rythme.`,
                    estimation: true,
                    suite: ["combien_cachets", "si_contrat", "rythme"],
                  };
                  return {
                    ouv: "Je préfère te prévenir.",
                    text: `Pour l'instant, à ton rythme actuel, j'ai peur qu'on n'y arrive pas avant ton renouvellement du ${dateAnnivTxt}. Il te manque ${calc.manque}h ≈ ${calc.cachetsManquants} cachets, et il te reste ${calc.joursAnniv} jours. Ce n'est pas perdu — mais à ta place, je chercherais des contrats dès maintenant.`,
                    pourquoi: `À ${calc.rythmeMensuel}h/mois, il faudrait environ ${Math.ceil(calc.manque / Math.max(1, calc.rythmeMensuel))} mois pour combler les ${calc.manque}h. Or il ne reste que ${Math.round(calc.joursAnniv / 30)} mois avant le ${dateAnnivTxt}.`,
                    estimation: true,
                    suite: ["rythme", "combien_cachets", "si_contrat"],
                  };
                };

                R.combien_manque = () => {
                  if (calc.manque <= 0) return {
                    ouv: "On peut souffler.",
                    text: `Plus rien ! Tu es à ${calc.heures}h, tu as dépassé les ${calc.seuil}h. Tes droits sont là.`,
                    pourquoi: `Le seuil d'ouverture des droits est de ${calc.seuil}h sur la période de référence. Tu es à ${calc.heures}h.`,
                    suite: ["renouveler", "si_pause"],
                  };
                  return {
                    ouv: pickOuv(),
                    text: `Il te manque exactement ${calc.manque}h pour atteindre tes ${calc.seuil}h. En cachets, ça fait environ ${calc.cachetsManquants} cachets. Tu en as déjà parcouru ${coach.pctChemin}% du chemin — c'est plus que tu ne crois.`,
                    pourquoi: `${calc.seuil}h (le seuil) − ${calc.heures}h (tes heures déclarées) = ${calc.manque}h. Je convertis en cachets sur la base d'un cachet = 12h, donc ${calc.manque} ÷ 12 ≈ ${calc.cachetsManquants}.`,
                    calcul: `${calc.seuil} h requises\n− ${calc.heures} h déjà déclarées\n─────────────\n= ${calc.manque} h restantes\n\n${calc.manque} ÷ 12 h par cachet ≈ ${calc.cachetsManquants} cachets`,
                    suite: ["combien_cachets", "rythme", "si_contrat"],
                  };
                };

                R.si_contrat = () => ({
                  ouv: "Celui-là mérite qu'on s'y attarde.",
                  text: `Dis-moi combien de cachets on te propose, je te dis tout de suite où ça te mène. Utilise les boutons ci-dessous : je calcule l'impact exact sur tes droits.`,
                  simulateur: true,
                  pourquoi: `Je prends tes ${calc.heures}h actuelles, j'ajoute les heures du contrat (12h par cachet), et je regarde si on franchit les ${calc.seuil}h.`,
                  suite: ["combien_cachets", "renouveler", "rythme"],
                });

                R.combien_cachets = () => {
                  if (calc.manque <= 0) return {
                    ouv: "On peut souffler.",
                    text: `Aucun, tu y es déjà ! Tes ${calc.seuil}h sont atteintes.`,
                    suite: ["renouveler", "si_pause"],
                  };
                  return {
                    ouv: "Voyons ça précisément.",
                    text: `Si c'était mon dossier, je viserais environ ${calc.cachetsManquants} cachets pour être tranquille. C'est ce qu'il faut pour transformer tes ${calc.manque}h manquantes en droits sécurisés.`,
                    pourquoi: `${calc.manque}h manquantes ÷ 12h par cachet ≈ ${calc.cachetsManquants} cachets.`,
                    suite: ["rythme", "si_contrat", "renouveler"],
                  };
                };

                R.rythme = () => {
                  if (!calc.aUnRythme) return {
                    ouv: "Il me manque une info.",
                    text: `Je ne peux pas encore estimer ton rythme : je n'ai pas assez d'activité déclarée sur les 3 derniers mois. Ajoute tes contrats récents (ou scanne tes AEM), et je te dirai exactement à quelle cadence aller.`,
                    manque: true,
                    suite: ["combien_cachets", "combien_manque"],
                  };
                  const cadenceConseillee = coach.cachetsConseillesSemaine;
                  return {
                    ouv: pickOuv(),
                    text: `En ce moment, tu tournes à environ ${(coach.cachetsSemaine).toFixed(1)} cachet${coach.cachetsSemaine >= 2 ? "s" : ""}/semaine (${calc.rythmeMensuel}h/mois).${cadenceConseillee ? ` Pour ton renouvellement, je viserais plutôt ${cadenceConseillee.toFixed(1)} cachets/semaine.` : ""} ${cadenceConseillee && cadenceConseillee > coach.cachetsSemaine ? "Il va falloir pousser un peu." : "Tu es sur la bonne cadence."}`,
                    pourquoi: `Je calcule ton rythme sur tes activités des 3 derniers mois : ${calc.rythmeMensuel}h/mois ÷ 4,33 semaines ÷ 12h ≈ ${coach.cachetsSemaine.toFixed(1)} cachets/semaine.${cadenceConseillee ? ` La cadence conseillée = ${calc.manque}h restantes ÷ le temps avant ton renouvellement.` : ""}`,
                    estimation: true,
                    suite: ["combien_cachets", "renouveler", "si_contrat"],
                  };
                };

                R.si_pause = () => {
                  if (!fenetre.aDesActivites) return {
                    ouv: "Il me manque une info.",
                    text: `Je n'ai pas encore assez d'activité pour estimer ça. Ajoute tes contrats et je te dirai précisément ce que tu peux te permettre comme pause.`,
                    manque: true,
                    suite: ["combien_manque", "rythme"],
                  };
                  return {
                    ouv: fenetre.sortent30 > 0 ? "Je préfère te prévenir." : "Regardons ça ensemble.",
                    text: fenetre.sortent30 > 0
                      ? `Attention : ${fenetre.sortent30}h vont sortir de ta période dans le mois qui vient. Si tu fais une pause maintenant sans rien ajouter, ton total va baisser de ${fenetre.sortent30}h. À ta place, je ne resterais pas inactif trop longtemps en ce moment.`
                      : `Bonne nouvelle : aucune de tes heures ne sort de ta période dans les 30 prochains jours. Tu peux faire une pause sans perdre de terrain dans l'immédiat.${fenetre.sortent90 > 0 ? ` Mais d'ici 3 mois, ${fenetre.sortent90}h sortiront — garde-le en tête.` : ""}`,
                    pourquoi: `Tes 507h se comptent sur 12 mois glissants. Chaque heure "sort" 12 mois après l'avoir faite. Je regarde lesquelles arrivent à échéance bientôt.`,
                    estimation: true,
                    suite: ["combien_manque", "renouveler", "rythme"],
                  };
                };

                R.que_faire = () => {
                  const aemAno = (anomalies || []).find(a => a.id === "aem");
                  const etapes = [];
                  if (aemAno) etapes.push("récupérer tes AEM manquantes (ce sont des heures déjà travaillées qui ne comptent pas encore)");
                  if (!calc.secu && calc.manque > 0) etapes.push(`viser ${calc.manque}h ≈ ${calc.cachetsManquants} cachets pour atteindre tes 507h`);
                  if (etapes.length === 0) return {
                    ouv: "Bonne nouvelle.",
                    text: "Pour l'instant, tu n'as rien d'urgent à faire : ton dossier est propre et tes droits sont sécurisés. Continue à déclarer tes contrats au fur et à mesure, et on garde le cap.",
                    suite: ["renouveler", "rythme", "si_pause"],
                  };
                  const txt = etapes.length === 1
                    ? `Le plus important maintenant, c'est de ${etapes[0]}.`
                    : `Dans l'ordre : d'abord ${etapes[0]}. Ensuite, ${etapes[1]}.`;
                  return {
                    ouv: "Voici ce que je ferais à ta place.",
                    text: txt + " Concentre-toi là-dessus, le reste suivra.",
                    pourquoi: aemAno
                      ? "Les AEM manquantes sont prioritaires car elles débloquent des heures que tu as déjà faites — c'est le gain le plus rapide avant de chercher de nouveaux contrats."
                      : `Il te manque ${calc.manque}h sur les ${calc.seuil}h requises. C'est l'écart à combler avant ton renouvellement.`,
                    suite: ["combien_cachets", "renouveler", "rythme"],
                  };
                };

                // Catalogue des questions (label affiché + icône)
                const QUESTIONS = {
                  que_faire: { icon: "ti-target-arrow", label: "Que dois-je faire maintenant ?" },
                  renouveler: { icon: "ti-calendar-check", label: "Est-ce que je vais renouveler ?" },
                  combien_manque: { icon: "ti-target", label: "Combien me manque-t-il ?" },
                  si_contrat: { icon: "ti-briefcase", label: "Si j'accepte un contrat ?" },
                  combien_cachets: { icon: "ti-ticket", label: "Combien de cachets viser ?" },
                  rythme: { icon: "ti-run", label: "Quel rythme dois-je tenir ?" },
                  si_pause: { icon: "ti-player-pause", label: "Si je ne travaille plus un mois ?" },
                };

                const lancer = (id) => {
                  const rep = R[id]();
                  poserQuestionCalc(QUESTIONS[id].label, { ...rep, bases, qid: id });
                };

                return (
                  <>
                    {/* Zone de conversation */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: calcConvo.length === 0 ? 0 : 18 }}>

                      {/* Fil de la conversation */}
                      {calcConvo.map((m, i) => (
                        m.role === "me" ? (
                          <div key={i} style={{ alignSelf: "flex-end", background: "#378ADD", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 14px", fontSize: 13.5, maxWidth: "85%", fontWeight: 600 }}>{m.text}</div>
                        ) : (
                          <div key={i} style={{ display: "flex", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                              <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                            </div>
                            <div style={{ maxWidth: "88%" }}>
                              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "4px 14px 14px 14px", padding: "13px 15px", fontSize: 13.5, color: "#E8F4FF", lineHeight: 1.55 }}>
                                {m.ouv && <div style={{ fontWeight: 700, color: "#5DCAA5", marginBottom: 6 }}>🐾 {m.ouv}</div>}
                                {/* Données citées */}
                                {m.bases && !m.manque && (
                                  <div style={{ background: "rgba(93,202,165,0.06)", borderRadius: 8, padding: "9px 11px", marginBottom: 10 }}>
                                    <div style={{ fontSize: 10.5, color: "#5DCAA5", fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>Je me base sur</div>
                                    {m.bases.map((b, j) => (
                                      <div key={j} style={{ fontSize: 11.5, color: "#B5D4F4", lineHeight: 1.7 }}>✓ {b}</div>
                                    ))}
                                  </div>
                                )}
                                <div>{m.text}</div>
                                {/* Simulateur intégré si la réponse le demande */}
                                {m.simulateur && (
                                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                                    {[1, 2, 3, 5, 10].map(n => {
                                      const apres = calc.heures + n * 12;
                                      const secuApres = apres >= calc.seuil;
                                      return (
                                        <button key={n} type="button" onClick={() => poserQuestionCalc(`Et si j'accepte ${n} cachet${n > 1 ? "s" : ""} ?`, { ouv: secuApres ? "Ça sent bon." : "Voyons.", text: secuApres ? `Avec ${n} cachet${n > 1 ? "s" : ""}, tu passes de ${calc.heures}h à ${apres}h. Tu franchis les ${calc.seuil}h — tes droits seraient sécurisés. Celui-là, à ta place, je ne le laisserais pas filer.` : `Avec ${n} cachet${n > 1 ? "s" : ""}, tu passes de ${calc.heures}h à ${apres}h. Il te manquerait encore ${calc.seuil - apres}h ≈ ${Math.ceil((calc.seuil - apres) / 12)} cachets. Ça aide, mais ça ne suffit pas encore.`, bases, suite: ["combien_cachets", "rythme", "renouveler"], qid: "si_contrat_res" })}
                                          style={{ flex: "1 1 auto", minWidth: 46, background: "#0d2440", color: "#B5D4F4", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                          +{n}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Si une donnée manque, bouton d'action */}
                                {m.manque && (
                                  <button type="button" onClick={() => setInterNav(m.text.includes("date anniversaire") ? "cockpit" : "activites")} style={{ marginTop: 11, background: "#FAC775", color: "#412402", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                    {m.text.includes("date anniversaire") ? "Ajouter ma date anniversaire" : "Ajouter mes contrats"}
                                  </button>
                                )}
                                {/* Bouton Pourquoi ? — hiérarchie : badge → raisonnement → règles officielles */}
                                {m.pourquoi && (
                                  <div style={{ marginTop: 10 }}>
                                    {/* Badge de confiance (toujours visible) */}
                                    <div style={{ marginBottom: 8 }}>
                                      <BadgeConfiance niveau={m.manque ? "manquant" : (m.estimation ? "estimation" : (moteurHeuresValide() ? "certain" : "fiable"))} />
                                    </div>
                                    {m.showPourquoi ? (
                                      <div style={{ background: "rgba(55,138,221,0.08)", border: "1px solid rgba(55,138,221,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#B5D4F4", lineHeight: 1.5 }}>
                                        {/* Niveau 1 : ce sur quoi Hector s'est basé (chaleureux) */}
                                        <b style={{ color: "#7FB8F0" }}>Je me suis basé sur :</b>
                                        <div style={{ marginTop: 6 }}>
                                          {c && <div>✅ Tes {c.total_heures}h déclarées</div>}
                                          {c && c.date_anniversaire && <div>✅ Ta date anniversaire</div>}
                                          <div>✅ Les règles officielles de France Travail en vigueur</div>
                                        </div>
                                        {/* Niveau 2 : voir le calcul (arithmétique nue) */}
                                        {m.calcul && (
                                          <div style={{ marginTop: 10 }}>
                                            <button type="button" onClick={() => setCalcConvo(prev => prev.map((x, j) => j === i ? { ...x, showCalcul: !x.showCalcul } : x))}
                                              style={{ background: "transparent", border: "1px solid rgba(127,184,240,0.3)", color: "#7FB8F0", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                              <i className="ti ti-calculator" aria-hidden="true" style={{ fontSize: 13 }} /> Voir le calcul
                                            </button>
                                            {m.showCalcul && (
                                              <div style={{ marginTop: 7, fontFamily: "monospace", fontSize: 12.5, color: "#D6E8FA", background: "rgba(0,0,0,0.2)", borderRadius: 7, padding: "10px 12px", whiteSpace: "pre-line" }}>{m.calcul}</div>
                                            )}
                                          </div>
                                        )}
                                        {/* Niveau 3 : voir les règles officielles (technique, sur demande) */}
                                        {c && Array.isArray(c.regles_appliquees) && c.regles_appliquees.length > 0 && (
                                          <div style={{ marginTop: 10 }}>
                                            <button type="button" onClick={() => setCalcConvo(prev => prev.map((x, j) => j === i ? { ...x, showRegles: !x.showRegles } : x))}
                                              style={{ background: "transparent", border: "1px solid rgba(127,184,240,0.25)", color: "#8BA5C0", borderRadius: 7, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                              <i className="ti ti-book-2" aria-hidden="true" style={{ fontSize: 13 }} /> Voir le détail réglementaire
                                            </button>
                                            {m.showRegles && (
                                              <div style={{ marginTop: 7 }}>
                                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: "#8BA5C0", lineHeight: 1.55 }}>
                                                  {c.regles_appliquees.map((r, k) => (<li key={k} style={{ marginBottom: 3 }}>{r}</li>))}
                                                </ul>
                                                {c.version_referentiel && (
                                                  <div style={{ fontSize: 10, color: "#5A7088", marginTop: 7 }}>Référentiel version {c.version_referentiel}.</div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <button type="button" onClick={() => setCalcConvo(prev => prev.map((x, j) => j === i ? { ...x, showPourquoi: true } : x))}
                                        style={{ background: "transparent", border: "1px solid rgba(127,184,240,0.3)", color: "#7FB8F0", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                        🐾 Pourquoi ?
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Questions liées */}
                              {m.questions && m.questions.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <div style={{ fontSize: 11.5, color: "#8BA5C0", marginBottom: 7, marginLeft: 2 }}>🐾 On continue ?</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {m.questions.map(qid => QUESTIONS[qid] && (
                                      <button key={qid} type="button" onClick={() => lancer(qid)}
                                        style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "10px 13px", fontSize: 12.5, color: "#D6E8FA", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                                        <i className={`ti ${QUESTIONS[qid].icon}`} aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 16, flexShrink: 0 }} /> {QUESTIONS[qid].label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      ))}

                      {/* Hector réfléchit : séquence d'analyse */}
                      {calcThinking && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                            <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "4px 14px 14px 14px", padding: "13px 15px", fontSize: 12.5, color: "#B5D4F4", lineHeight: 1.9, minWidth: 220 }}>
                            <div style={{ fontWeight: 700, color: "#5DCAA5", marginBottom: 4 }}>🐾 Je regarde ton dossier…</div>
                            <div className="analyse-step" style={{ animationDelay: "0.1s" }}>✓ Je retrouve tes contrats…</div>
                            <div className="analyse-step" style={{ animationDelay: "0.35s" }}>✓ Je recompte tes heures…</div>
                            <div className="analyse-step" style={{ animationDelay: "0.6s" }}>✓ Je compare avec ta date anniversaire…</div>
                            <div className="analyse-step" style={{ animationDelay: "0.85s" }}>✓ J'estime ton rythme…</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── LE CHAMP SIGNATURE : "Que se passe-t-il si…" ── */}
                    <div style={{ background: "linear-gradient(135deg, rgba(93,202,165,0.08), rgba(55,138,221,0.05))", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 14, padding: "16px 16px 14px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <i className="ti ti-sparkles" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18 }} />
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: "white" }}>Que se passe-t-il si… ?</div>
                      </div>
                      <div style={{ fontSize: 12, color: "#8FB4D8", lineHeight: 1.5, marginBottom: 12 }}>Je connais ton dossier par cœur — pose-moi ta question ou choisis-en une plus bas.</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="text" value={etSiInput} onChange={e => setEtSiInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") poserEtSi(); }}
                          placeholder="Ex : et si j'accepte 3 cachets ?" disabled={etSiLoading || calcThinking}
                          style={{ flex: 1, background: "#07192E", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "white", outline: "none", fontFamily: "inherit" }} />
                        <button type="button" onClick={poserEtSi} disabled={etSiLoading || calcThinking || !etSiInput.trim()}
                          style={{ background: "#5DCAA5", border: "none", borderRadius: 10, width: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: etSiInput.trim() ? "pointer" : "default", flexShrink: 0, opacity: etSiInput.trim() ? 1 : 0.5 }}>
                          <i className="ti ti-send" aria-hidden="true" style={{ fontSize: 18, color: "#04342C" }} />
                        </button>
                      </div>
                      {/* Suggestions rapides */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                        {["Et si je ne travaille pas un mois ?", "Et si je refuse 8 cachets ?", "Et si j'ajoute 5 cachets ?"].map((s, i) => (
                          <button key={i} type="button" onClick={() => { setEtSiInput(s); }}
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9FCBF5", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Questions de départ (toujours visibles en bas si conversation vide) */}
                    {calcConvo.length === 0 && !calcThinking && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B8299", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginLeft: 2 }}>Qu'est-ce qui t'inquiète ?</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                          {Object.keys(QUESTIONS).map(qid => (
                            <button key={qid} type="button" onClick={() => lancer(qid)}
                              style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 11, padding: "13px 15px", fontSize: 14, color: "#E8F4FF", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                              <i className={`ti ${QUESTIONS[qid].icon}`} aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18, flexShrink: 0 }} /> {QUESTIONS[qid].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommencer si conversation entamée */}
                    {calcConvo.length > 0 && (
                      <button type="button" onClick={() => setCalcConvo([])} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#8BA5C0", borderRadius: 9, padding: "10px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>
                        <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize: 14, marginRight: 6 }} /> Nouvelle question
                      </button>
                    )}
                  </>
                );
              })()}

              {/* Lien discret vers le scan (le détail conversationnel a déjà tout dit) */}
              <button type="button" onClick={() => setInterNav("coffre")}
                style={{ width: "100%", background: "rgba(93,202,165,0.08)", color: "#5DCAA5", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 12, padding: "13px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <i className="ti ti-camera-plus" aria-hidden="true" style={{ fontSize: 16 }} /> Scanner mes AEM pour des calculs plus justes
              </button>

                </div>

                {/* ───────── COLONNE DROITE ───────── */}
                <div>
              {/* ── CE QUE J'AI REMARQUÉ (analyses d'Hector) ── */}
              {aDesAnalyses && (
                <div style={{ background: "#0a1322", border: "1px solid rgba(93,202,165,0.18)", borderRadius: 16, padding: "20px 22px", marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
                    <span style={{ fontSize: 18 }}>🟢</span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Ce que j'ai analysé</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {analyses.map(an => {
                      const pal = {
                        positif: { bg: "rgba(93,202,165,0.06)", tc: "#5DCAA5" },
                        attention: { bg: "rgba(250,199,117,0.06)", tc: "#FAC775" },
                        info: { bg: "rgba(55,138,221,0.06)", tc: "#7FB8F0" },
                      }[an.ton];
                      return (
                        <div key={an.id} style={{ background: pal.bg, borderRadius: 11, padding: "12px 14px" }}>
                          <i className={`ti ${an.icon}`} aria-hidden="true" style={{ color: pal.tc, fontSize: 17 }} />
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#E8F4FF", marginTop: 6 }}>{an.court}</div>
                          <div style={{ fontSize: 11.5, color: "#A9C2DC", lineHeight: 1.5, marginTop: 4 }}>{an.long}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 3. TIMELINE DES HEURES (vue d'ensemble visuelle) ── */}
              {timeline.aDesDonnees && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 24px 20px", marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <i className="ti ti-chart-bar" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 17 }} />
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "white" }}>Tes heures, mois par mois</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#8BA5C0", lineHeight: 1.45, marginBottom: 16 }}>
                    Tes heures déclarées, et le marqueur ⚠️ quand certaines vont sortir de ta période.
                  </div>

                  {/* Le graphe en barres */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 3 : 5, height: 130, marginBottom: 8 }}>
                    {timeline.buckets.map((b, i) => {
                      const h = b.heuresFaites > 0 ? Math.max(4, (b.heuresFaites / timeline.maxHeures) * 110) : (b.futur ? 0 : 2);
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
                          {/* badge heures qui sortent */}
                          {b.heuresSortantes > 0 && (
                            <div style={{ fontSize: 8.5, color: "#FAC775", fontWeight: 700, marginBottom: 3, whiteSpace: "nowrap" }} title={`${b.heuresSortantes}h sortent`}>⚠️{b.heuresSortantes}</div>
                          )}
                          {/* valeur au-dessus de la barre */}
                          {b.heuresFaites > 0 && (
                            <div style={{ fontSize: 8.5, color: b.courant ? "#5DCAA5" : "#8BA5C0", fontWeight: 600, marginBottom: 2 }}>{b.heuresFaites}</div>
                          )}
                          {/* la barre */}
                          <div style={{
                            width: "100%", maxWidth: 26, height: h, borderRadius: "4px 4px 0 0",
                            background: b.futur
                              ? "repeating-linear-gradient(45deg, rgba(250,199,117,0.15), rgba(250,199,117,0.15) 3px, transparent 3px, transparent 6px)"
                              : b.courant ? "linear-gradient(180deg,#5DCAA5,#1D9E75)" : "linear-gradient(180deg,#2C6E8F,#378ADD)",
                            border: b.heuresSortantes > 0 ? "1px solid rgba(250,199,117,0.5)" : "none",
                            transition: "height 0.5s ease",
                          }} />
                          {/* label mois */}
                          <div style={{ fontSize: 8.5, color: b.courant ? "#5DCAA5" : "#6B8299", fontWeight: b.courant ? 700 : 500, marginTop: 5, whiteSpace: "nowrap" }}>{b.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Légende */}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 10.5, color: "#8BA5C0", marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "#378ADD" }} /> heures faites</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "#5DCAA5" }} /> ce mois</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>⚠️ heures qui sortent</span>
                  </div>
                  {(() => {
                    const passes = (timeline.buckets || []).filter(b => !b.futur && b.heuresFaites > 0);
                    if (passes.length === 0) return null;
                    const best = passes.reduce((m, b) => b.heuresFaites > m.heuresFaites ? b : m, passes[0]);
                    const trois = passes.slice(-3);
                    const monte = trois.length === 3 && trois[0].heuresFaites < trois[1].heuresFaites && trois[1].heuresFaites < trois[2].heuresFaites;
                    const concl = monte
                      ? "Tu progresses depuis 3 mois — garde cette dynamique."
                      : "Ton meilleur mois est " + best.label + " avec " + best.heuresFaites + " h.";
                    return (
                      <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 600, marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
                        <i className="ti ti-chart-line" aria-hidden="true" style={{ fontSize: 15 }} />{concl}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── 4. FENÊTRE GLISSANTE (cercle estimé) ── */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <i className="ti ti-history-toggle" aria-hidden="true" style={{ color: "#FAC775", fontSize: 17 }} />
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "white" }}>Ta fenêtre de 12 mois</div>
                </div>
                <div style={{ fontSize: 10, color: "#FAC775", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 12 }}>D'après mes calculs · à vérifier</div>
                {!fenetre.aDesActivites ? (
                  <div style={{ fontSize: 13, color: "#8BA5C0", lineHeight: 1.5 }}>Ajoute tes contrats pour que j'analyse ta période glissante.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#D6E8FA", lineHeight: 1.55, marginBottom: 12 }}>
                      Tes 507h se comptent sur les 12 derniers mois. Chaque heure « sort » de ce décompte 12 mois après l'avoir faite.
                    </div>
                    {fenetre.sortent90 > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div style={{ background: "rgba(250,199,117,0.08)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 800, color: "#FAC775", lineHeight: 1 }}>{fenetre.sortent30}h</div>
                          <div style={{ fontSize: 9.5, color: "#8BA5C0", marginTop: 4 }}>sous 30j</div>
                        </div>
                        <div style={{ background: "rgba(250,199,117,0.06)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 800, color: "#FAC775", lineHeight: 1 }}>{fenetre.sortent60}h</div>
                          <div style={{ fontSize: 9.5, color: "#8BA5C0", marginTop: 4 }}>sous 60j</div>
                        </div>
                        <div style={{ background: "rgba(250,199,117,0.04)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 800, color: "#FAC775", lineHeight: 1 }}>{fenetre.sortent90}h</div>
                          <div style={{ fontSize: 9.5, color: "#8BA5C0", marginTop: 4 }}>sous 90j</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#D6E8FA", lineHeight: 1.5 }}>
                        🐾 Bonne nouvelle : aucune de tes heures ne sort de ta période dans les 3 prochains mois.
                      </div>
                    )}
                    {fenetre.sortent30 > 0 && (
                      <div style={{ background: "rgba(250,199,117,0.06)", border: "1px solid rgba(250,199,117,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, color: "#FAE3B6", lineHeight: 1.5 }}>
                        ⚠️ <b>{fenetre.sortent30}h</b> vont sortir de ta période dans le mois qui vient. Si tu n'ajoutes rien, ton total va baisser d'autant. Anticipe.
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── MÉMOIRE DE CARRIÈRE (placeholder — à construire) ── */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(159,203,245,0.3)", borderRadius: 16, padding: "20px 22px", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <i className="ti ti-paw" aria-hidden="true" style={{ color: "#9FCBF5", fontSize: 18 }} />
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "white" }}>Mémoire de carrière</div>
                  <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#FAC775", background: "rgba(250,199,117,0.12)", border: "1px solid rgba(250,199,117,0.3)", borderRadius: 6, padding: "3px 8px", fontWeight: 700, letterSpacing: 0.4 }}>BIENTÔT</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#8FB4D8", lineHeight: 1.55 }}>
                  Bientôt, Hector se souviendra de tes meilleurs mois, de tes employeurs récurrents et de tes records. 🐾
                </div>
              </div>

                </div>

              </div>{/* ── fin grille 2 colonnes ── */}

              {/* Transparence : version du référentiel de règles utilisé */}
              <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 9 }}>
                <i className="ti ti-shield-check" aria-hidden="true" style={{ color: "#6B8299", fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 10.5, color: "#5A7088", lineHeight: 1.5 }}>
                  Mes calculs s'appuient sur les règles officielles du régime (seuil {valeurDe("seuilHeures")}h, un cachet d'artiste compté {valeurDe("cachetHeures")}h, clause de rattrapage dès {valeurDe("rattrapageSeuilMin")}h). Référentiel version {VERSION_REFERENTIEL.version}. Ces valeurs sont issues des textes Unédic et France Travail, et restent à confirmer avec un conseiller pour ta situation précise.
                </div>
              </div>
              </>)}

              {/* ═══ PAGE MES DOCUMENTS ═══ */}
              {interNav === "attestation" && (<>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <NiveauImage src="/hector-tete.png" fallbackIcon="ti-folder" fallbackColor="#5DCAA5" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Mes documents 🐾</div>
                  <div style={{ fontSize: 12.5, color: "#8BA5C0" }}>Tout ce que j'ai préparé à partir de tes AEM.</div>
                </div>
              </div>

              {/* Onglets */}
              <div style={{ display: "flex", gap: 6, marginBottom: 18, background: "#0a1322", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 4 }}>
                {[
                  { id: "revenus", label: "Revenus", icon: "ti-file-text" },
                  { id: "aem", label: "Mes AEM", icon: "ti-file-check" },
                  { id: "actualisations", label: "Actualisations", icon: "ti-clipboard-check" },
                ].map(t => (
                  <button key={t.id} type="button" onClick={() => setDocTab(t.id)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: docTab === t.id ? "#5DCAA5" : "transparent", color: docTab === t.id ? "#04342C" : "#8BA5C0", border: "none", borderRadius: 7, padding: "9px 6px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize: 15 }} /> {!isMobile && t.label}
                  </button>
                ))}
              </div>

              {/* ─── SECTION REVENUS ─── */}
              {docTab === "revenus" && (<>
              {!recapRevenus.aDesDonnees ? (
                <div style={{ textAlign: "center", padding: "30px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, color: "#8BA5C0", fontSize: 13.5, lineHeight: 1.6 }}>
                  Ajoute tes contrats avec leur salaire brut pour que je génère ton récap de revenus.<br />Le plus simple : scanne tes AEM, je remplis tout.
                  <div style={{ marginTop: 16 }}>
                    <button type="button" onClick={() => setInterNav("coffre")} style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Scanner une AEM</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Avertissement si données incomplètes */}
                  {recapRevenus.completude < 100 && (
                    <div style={{ background: "rgba(250,199,117,0.07)", border: "1px solid rgba(250,199,117,0.25)", borderRadius: 12, padding: "12px 15px", marginBottom: 14, fontSize: 12.5, color: "#FAE3B6", lineHeight: 1.5 }}>
                      🐾 {recapRevenus.completude}% de tes contrats ont un salaire renseigné. Pour un récap complet et crédible, complète les bruts manquants — sinon le total sera sous-évalué.
                    </div>
                  )}

                  {/* Aperçu du document */}
                  <div style={{ background: "white", borderRadius: 14, padding: isMobile ? "20px 18px" : "28px 30px", marginBottom: 16, color: "#1a2b42" }}>
                    {/* En-tête */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0A2540", paddingBottom: 14, marginBottom: 18 }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 800, color: "#0A2540" }}>H<span style={{ color: "#378ADD" }}>€</span>CTOR</div>
                      <div style={{ textAlign: "right", fontSize: 11, color: "#5a6b80", lineHeight: 1.5 }}>Document généré le<br />{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#0A2540", marginBottom: 3 }}>Récapitulatif de revenus</div>
                    <div style={{ fontSize: 12.5, color: "#5a6b80", marginBottom: 18 }}>Intermittent du spectacle · {recapRevenus.periodeLabel}</div>
                    <div style={{ background: "#f4f7fb", borderRadius: 8, padding: "12px 16px", marginBottom: 18, fontSize: 13.5 }}>
                      <b style={{ color: "#0A2540" }}>{[profilPrenom, profilNom].filter(Boolean).join(" ") || "Ton nom"}</b><br />
                      <span style={{ color: "#5a6b80", fontSize: 12.5 }}>Revenus déclarés sur les 12 derniers mois</span>
                    </div>
                    {/* Stats */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 100px", border: "1px solid #dde5ee", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0A2540" }}>{new Intl.NumberFormat("fr-FR").format(recapRevenus.totalBrut)} €</div>
                        <div style={{ fontSize: 10.5, color: "#5a6b80", marginTop: 3 }}>Total brut</div>
                      </div>
                      <div style={{ flex: "1 1 100px", border: "1px solid #dde5ee", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0A2540" }}>{new Intl.NumberFormat("fr-FR").format(recapRevenus.moyenneMensuelle)} €</div>
                        <div style={{ fontSize: 10.5, color: "#5a6b80", marginTop: 3 }}>Moyenne / mois</div>
                      </div>
                      <div style={{ flex: "1 1 100px", border: "1px solid #dde5ee", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0A2540" }}>{recapRevenus.totalContrats}</div>
                        <div style={{ fontSize: 10.5, color: "#5a6b80", marginTop: 3 }}>Contrats</div>
                      </div>
                    </div>
                    {/* Tableau */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#0A2540", color: "white" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left" }}>Mois</th>
                            <th style={{ padding: "8px 10px", textAlign: "center" }}>Contrats</th>
                            <th style={{ padding: "8px 10px", textAlign: "center" }}>Employeurs</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Brut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recapRevenus.lignes.map((l, i) => (
                            <tr key={i}>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e9f0" }}>{l.label}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e9f0", textAlign: "center" }}>{l.contrats}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e9f0", textAlign: "center" }}>{l.employeurs}</td>
                              <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e9f0", textAlign: "right", fontWeight: 600 }}>{l.brut > 0 ? new Intl.NumberFormat("fr-FR").format(Math.round(l.brut)) + " €" : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td style={{ padding: "10px", borderTop: "2px solid #0A2540" }}>Total</td>
                            <td style={{ padding: "10px", borderTop: "2px solid #0A2540", textAlign: "center" }}>{recapRevenus.totalContrats}</td>
                            <td style={{ padding: "10px", borderTop: "2px solid #0A2540", textAlign: "center" }}>{recapRevenus.employeursUniques}</td>
                            <td style={{ padding: "10px", borderTop: "2px solid #0A2540", textAlign: "right" }}>{new Intl.NumberFormat("fr-FR").format(recapRevenus.totalBrut)} €</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div style={{ fontSize: 10, color: "#8595a8", marginTop: 16, lineHeight: 1.6 }}>
                      Document personnel établi à partir des données saisies dans H€CTOR. Ne constitue pas une attestation officielle et n'a pas de valeur juridique. Pour un document officiel, s'adresser aux organismes compétents.
                    </div>
                  </div>

                  {/* Bouton télécharger */}
                  <button type="button" onClick={() => imprimerRecapRevenus(recapRevenus, profilPrenom, profilNom)}
                    style={{ width: "100%", background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 12, padding: "15px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                    <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 18 }} /> Télécharger en PDF
                  </button>
                  <div style={{ fontSize: 10.5, color: "#5A7088", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
                    Le PDF s'ouvre dans une nouvelle fenêtre. Choisis « Enregistrer en PDF » dans les options d'impression.
                  </div>
                </>
              )}
              </>)}

              {/* ─── SECTION MES AEM ─── */}
              {docTab === "aem" && (() => {
                const aems = (interActivites || []).filter(a => a.aem_recue === true || a.source === "ocr");
                if (aems.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "30px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, color: "#8BA5C0", fontSize: 13.5, lineHeight: 1.6 }}>
                      Tu n'as pas encore scanné d'AEM.<br />Photographie-les, je les range ici automatiquement.
                      <div style={{ marginTop: 16 }}>
                        <button type="button" onClick={() => setInterNav("coffre")} style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Scanner une AEM</button>
                      </div>
                    </div>
                  );
                }
                const fmtDate = (iso) => { try { const d = new Date(iso); const M = ["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"]; return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`; } catch { return iso; } };
                return (
                  <>
                    <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 14, lineHeight: 1.5 }}>
                      {aems.length} AEM scannée{aems.length > 1 ? "s" : ""}. 🐾 Tes documents originaux sont conservés en sécurité — tu peux les rouvrir à tout moment.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {aems.map((a, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(93,202,165,0.15)", borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(93,202,165,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <i className="ti ti-file-check" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 19 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "white" }}>{a.employeur || "Employeur à compléter"}</div>
                            <div style={{ fontSize: 11.5, color: "#8BA5C0", marginTop: 1 }}>{fmtDate(a.date)}{a.salaire_brut ? ` · ${new Intl.NumberFormat("fr-FR").format(a.salaire_brut)} € brut` : ""}</div>
                          </div>
                          {a.a_document && (
                            <button type="button" onClick={() => voirDocumentAEM(a.id, a.aem_filename)}
                              style={{ background: "transparent", border: "1px solid rgba(93,202,165,0.35)", color: "#5DCAA5", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: 15 }} /> Voir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* ─── SECTION ACTUALISATIONS ─── */}
              {docTab === "actualisations" && (
                (actuHistorique || []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, color: "#8BA5C0", fontSize: 13.5, lineHeight: 1.6 }}>
                    Aucune actualisation enregistrée pour l'instant.<br />Une fois que tu t'actualises avec Hector, l'historique apparaît ici.
                    <div style={{ marginTop: 16 }}>
                      <button type="button" onClick={() => setInterNav("actu")} style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Voir l'actualisation</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 14, lineHeight: 1.5 }}>
                      Ton historique d'actualisations — une preuve de ta régularité.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {actuHistorique.map((h, i) => (
                        <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ color: "#E8F4FF", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 9 }}>
                            <i className="ti ti-circle-check-filled" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 17 }} /> {h.label}
                          </span>
                          <span style={{ color: "#8BA5C0", fontSize: 11.5 }}>{h.cachets} cachets · {h.heures}h</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
              </>)}

              {/* ═══ PAGE SCANNER UNE AEM ═══ */}
              {interNav === "coffre" && (<>

              {/* Présence d'Hector + promesse */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto 14px", background: "radial-gradient(circle at 50% 35%, #12304f, #0a1322)", border: "2px solid rgba(93,202,165,0.45)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(93,202,165,0.05)", overflow: "hidden" }}>
                  <NiveauImage src="/hector-tete.png" fallbackIcon="ti-camera" fallbackColor="#5DCAA5" />
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1.3, maxWidth: 420, margin: "0 auto 8px" }}>Photographie ton AEM, je lis tout 🐾</h1>
                <p style={{ fontSize: 13, color: "#8BA5C0", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>Employeur, cachets, heures, salaire brut — je remplis tout pour toi. Tu n'as qu'à vérifier. <strong style={{ color: "#9FCBF5", fontWeight: 700 }}>Plusieurs attestations dans un même fichier ? Je les lis toutes.</strong></p>
              </div>

              {/* Zone d'upload (si pas de résultat en cours) */}
              {!aemExtrait && (
                <>
                  <label style={{ display: "block", border: "1.5px dashed rgba(93,202,165,0.4)", borderRadius: 16, padding: "32px 20px", textAlign: "center", cursor: aemUploading ? "default" : "pointer", background: "rgba(93,202,165,0.04)" }}>
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={aemUploading}
                      onChange={e => e.target.files[0] && handleScanAEM(e.target.files[0])} style={{ display: "none" }} />
                    {aemUploading ? (
                      <div>
                        <div style={{ fontSize: 30, marginBottom: 10 }}>🐾</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#5DCAA5" }}>Hector lit ton AEM…</div>
                        <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 4 }}>Quelques secondes</div>
                      </div>
                    ) : (
                      <div>
                        <i className="ti ti-camera-plus" aria-hidden="true" style={{ fontSize: 34, color: "#5DCAA5" }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: "white", marginTop: 10 }}>Photo ou PDF de ton AEM</div>
                        <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 4 }}>Touche ici pour choisir un fichier</div>
                      </div>
                    )}
                  </label>
                  {aemError && (
                    <div style={{ marginTop: 14, background: "rgba(226,75,74,0.08)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#F09595", lineHeight: 1.5 }}>{aemError}</div>
                  )}
                  <div style={{ marginTop: 20, fontSize: 11.5, color: "#5A7088", lineHeight: 1.6, textAlign: "center" }}>
                    🐾 Une AEM, c'est l'attestation que ton employeur t'envoie après chaque contrat. Scanne-la dès que tu la reçois : je la range et je l'ajoute à ton compteur.
                  </div>
                </>
              )}

              {/* Écran de vérification (si Hector a lu quelque chose) */}
              {aemExtrait && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "20px 20px 22px" }}>
                  {/* Bannière mise en avant quand le document contient plusieurs attestations */}
                  {aemTotal > 1 && (
                    <div style={{ background: "linear-gradient(135deg, rgba(93,202,165,0.18), rgba(93,202,165,0.06))", border: "1px solid rgba(93,202,165,0.45)", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 26, flexShrink: 0 }}>🎉</span>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "white", lineHeight: 1.25 }}>
                          J'ai trouvé {aemTotal} attestations dans ce document !
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: "#C2E6D8", lineHeight: 1.5, marginBottom: 12 }}>
                        Je te les fais valider une par une — tu es sur la <strong style={{ color: "white" }}>n°{aemTotal - aemQueue.length}</strong> sur {aemTotal}.
                      </div>
                      {/* Petite frise de progression */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {Array.from({ length: aemTotal }).map((_, idx) => {
                          const courante = aemTotal - aemQueue.length - 1;
                          const fait = idx < courante;
                          const active = idx === courante;
                          return (
                            <div key={idx} style={{ flex: 1, height: 6, borderRadius: 3, background: fait ? "#5DCAA5" : active ? "rgba(93,202,165,0.6)" : "rgba(255,255,255,0.12)", transition: "background 0.3s ease" }} />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      <NiveauImage src="/hector-tete.png" fallbackIcon="ti-dog" fallbackColor="#5DCAA5" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>
                        {aemTotal > 1 ? "Attestation " + (aemTotal - aemQueue.length) + " sur " + aemTotal : "Voilà ce que j'ai lu 🐾"}
                      </div>
                      <div style={{ fontSize: 12, color: "#8BA5C0" }}>
                        {aemTotal > 1
                          ? "Vérifie et enregistre, je passe à la suivante."
                          : "Vérifie et corrige si besoin, puis enregistre."}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600 }}>Employeur
                      <input type="text" value={aemExtrait.employeur} onChange={e => setAemExtrait({ ...aemExtrait, employeur: e.target.value })} placeholder="Nom de la structure"
                        style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 110px" }}>Début
                        <input type="date" value={aemExtrait.date} onChange={e => setAemExtrait({ ...aemExtrait, date: e.target.value })}
                          style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </label>
                      <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 110px" }}>Fin <span style={{ color: "#5A7088", fontWeight: 400 }}>(si période)</span>
                        <input type="date" value={aemExtrait.date_fin} onChange={e => setAemExtrait({ ...aemExtrait, date_fin: e.target.value })}
                          style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </label>
                      <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 130px" }}>Type
                        <select value={aemExtrait.type_activite} onChange={e => setAemExtrait({ ...aemExtrait, type_activite: e.target.value })}
                          style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                          <option value="cachet_isole">Cachets (artiste · 12h)</option>
                          <option value="heures">Heures (technicien)</option>
                        </select>
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 130px" }}>{aemExtrait.type_activite === "heures" ? "Nombre d'heures" : "Nombre de cachets"}
                        <input type="number" min="0" value={aemExtrait.nombre} onChange={e => setAemExtrait({ ...aemExtrait, nombre: e.target.value })}
                          style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </label>
                      <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 130px" }}>Salaire brut (€)
                        <input type="number" min="0" value={aemExtrait.salaire_brut} onChange={e => setAemExtrait({ ...aemExtrait, salaire_brut: e.target.value })} placeholder="Optionnel"
                          style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      </label>
                    </div>
                  </div>

                  {aemError && (
                    <div style={{ marginTop: 14, fontSize: 12.5, color: "#F09595" }}>{aemError}</div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button type="button" disabled={aemSaving} onClick={handleConfirmAEM}
                      style={{ flex: 1, background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 10, padding: 14, fontSize: 14.5, fontWeight: 700, cursor: aemSaving ? "default" : "pointer", fontFamily: "inherit", opacity: aemSaving ? 0.6 : 1 }}>
                      {aemSaving ? "…" : (aemQueue.length > 0 ? "Enregistre et suivante →" : "C'est juste, enregistre ✓")}
                    </button>
                    {aemQueue.length > 0 ? (
                      <button type="button" disabled={aemSaving} onClick={handleSkipAEM}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 10, padding: "14px 18px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                        Passer
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setAemExtrait(null); setAemQueue([]); setAemTotal(0); setAemError(""); }}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 10, padding: "14px 18px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                        Annuler
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#5A7088", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                    Je fais de mon mieux pour bien lire, mais vérifie toujours — une AEM mal scannée, ça arrive.
                  </div>
                </div>
              )}
              </>)}

              {/* ═══ PAGE PARLE À HECTOR ═══ */}
              {interNav === "hector" && (<>

              {/* ── Le chat Hector intermittent (assistant expert du régime) ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a1322", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <NiveauImage src="/hector-tete.png" fallbackIcon="ti-message" fallbackColor="#3a5169" />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>Parle à Hector</div>
                  <div style={{ fontSize: 12.5, color: "#8BA5C0" }}>Ton expert du régime intermittent. Pose-lui tes questions.</div>
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                {/* Fil de discussion */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14, maxHeight: 420, overflowY: "auto" }}>
                  {interChat.length === 0 && (
                    <div style={{ textAlign: "center", padding: "12px 8px" }}>
                      <div style={{ fontSize: 13, color: "#8BA5C0", lineHeight: 1.6, marginBottom: 14 }}>
                        Demande-moi ce que tu veux sur ton régime : tes 507h, les annexes, ta date anniversaire, la clause de rattrapage, les congés spectacles… Je suis là pour rendre tout ça clair.
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          "C'est quoi exactement la date anniversaire ?",
                          "Combien d'heures il me reste pour mes droits ?",
                          "Comment marche la clause de rattrapage ?",
                          "Un cachet, ça compte pour combien d'heures ?",
                        ].map(q => (
                          <button key={q} type="button" onClick={() => { setInterChatInput(q); }}
                            style={{ background: "rgba(55,138,221,0.08)", border: "1px solid rgba(55,138,221,0.2)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#B5D4F4", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {interChat.map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "85%", background: m.role === "user" ? "#378ADD" : "rgba(255,255,255,0.06)", color: m.role === "user" ? "white" : "#E8F4FF", borderRadius: 14, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {interChatLoading && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ background: "rgba(255,255,255,0.06)", color: "#8BA5C0", borderRadius: 14, padding: "10px 14px", fontSize: 13.5 }}>Hector réfléchit…</div>
                    </div>
                  )}
                </div>
                {/* Saisie */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={interChatInput} onChange={e => setInterChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") askInterChat(e); }}
                    placeholder="Écris ta question à Hector…"
                    style={{ flex: 1, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <button type="button" onClick={askInterChat} disabled={interChatLoading || !interChatInput.trim()}
                    style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 15, fontWeight: 700, cursor: (interChatLoading || !interChatInput.trim()) ? "default" : "pointer", fontFamily: "inherit", opacity: (interChatLoading || !interChatInput.trim()) ? 0.5 : 1, flexShrink: 0 }}>
                    <i className="ti ti-send" aria-hidden="true" />
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: "#5A7088", textAlign: "center", lineHeight: 1.5, marginTop: 10 }}>
                  Hector connaît ton régime en profondeur. Pour le montant exact de ton allocation, il te guidera vers le simulateur officiel de France Travail.
                </div>
              </div>

              {/* ── Brique 5.4 : "Quoi accepter" — le conseiller de décision ── */}
              <div id="inter-simulateur" style={{ background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <i className="ti ti-phone-call" aria-hidden="true" style={{ color: "#378ADD", fontSize: 16 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>On te propose un contrat ?</div>
                </div>
                <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 14 }}>
                  Dis-moi ce qu'on te propose, je te dis si tu dois accepter. 🐾
                </div>

                {/* Boutons rapides cachets (pour décider vite, au téléphone) */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {[1, 2, 3, 5, 10].map(n => (
                    <button key={n} type="button" onClick={() => { setSimForm({ ...simForm, nombre: String(n) }); setSimResult(null); }}
                      style={{ flex: "1 1 auto", minWidth: 46, background: simForm.nombre === String(n) ? "#378ADD" : "#0d2440", color: simForm.nombre === String(n) ? "white" : "#B5D4F4", border: `1px solid ${simForm.nombre === String(n) ? "#378ADD" : "#1e3a5f"}`, borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <input type="number" min="0" value={simForm.nombre} onChange={e => { setSimForm({ ...simForm, nombre: e.target.value }); setSimResult(null); }}
                    placeholder="ou tape un nombre"
                    style={{ flex: "1 1 110px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  <select value={simForm.type_activite} onChange={e => { setSimForm({ ...simForm, type_activite: e.target.value }); setSimResult(null); }}
                    style={{ flex: "1 1 150px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                    <option value="cachet_isole">cachets (12h)</option>
                    <option value="heures">heures</option>
                  </select>
                </div>
                <button type="button" disabled={simLoading} onClick={handleSimuler}
                  style={{ width: "100%", background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14.5, fontWeight: 700, cursor: simLoading ? "default" : "pointer", fontFamily: "inherit", opacity: simLoading ? 0.6 : 1 }}>
                  {simLoading ? "Hector réfléchit…" : "Je dois accepter ?"}
                </button>

                {/* Verdict décisionnel d'Hector */}
                {simResult && (() => {
                  // On calcule un verdict tranché à partir des champs du moteur + la date anniversaire connue côté front.
                  const secu = simResult.securise_apres;
                  const dejaSecu = c.droits_securises; // déjà sécurisé AVANT ce contrat
                  const manque = simResult.manquant_apres || 0;
                  const passeLaBarre = secu && !dejaSecu; // ce contrat précis fait franchir les 507h
                  // Formatage de la date anniversaire pour le verdict
                  let dateAnnivTxt = "";
                  if (c.date_anniversaire) {
                    try {
                      const d = new Date(c.date_anniversaire);
                      const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
                      dateAnnivTxt = `${d.getDate()} ${MOIS[d.getMonth()]}`;
                    } catch {}
                  }
                  // Choix du verdict
                  let niveau, emoji, titre, sous;
                  if (passeLaBarre) {
                    niveau = "green"; emoji = "🎯"; titre = "Fonce, c'est LE contrat";
                    sous = dateAnnivTxt ? `Il te fait passer les 507h et sécurise ton renouvellement du ${dateAnnivTxt}.` : "Il te fait passer les 507h et sécurise tes droits.";
                  } else if (dejaSecu) {
                    niveau = "blue"; emoji = "👍"; titre = "Prends-le si tu peux";
                    sous = "Tes droits sont déjà sécurisés. Celui-là, c'est du bonus pour la suite.";
                  } else if (secu) {
                    niveau = "green"; emoji = "✅"; titre = "Accepte les yeux fermés";
                    sous = dateAnnivTxt ? `Avec lui, tes droits sont sécurisés pour ton renouvellement du ${dateAnnivTxt}.` : "Avec lui, tes droits sont sécurisés.";
                  } else {
                    niveau = "orange"; emoji = "🟠"; titre = "Ça aide, mais continue à chercher";
                    sous = `Bon à prendre, mais il te manquera encore ${manque}h après${dateAnnivTxt ? ` pour ton renouvellement du ${dateAnnivTxt}` : ""}.`;
                  }
                  const palette = {
                    green: { bg: "rgba(93,202,165,0.12)", bd: "rgba(93,202,165,0.4)", tc: "#5DCAA5" },
                    blue: { bg: "rgba(55,138,221,0.1)", bd: "rgba(55,138,221,0.35)", tc: "#7FB8F0" },
                    orange: { bg: "rgba(250,199,117,0.1)", bd: "rgba(250,199,117,0.35)", tc: "#FAC775" },
                  }[niveau];
                  return (
                    <div style={{ marginTop: 14, background: palette.bg, border: `1px solid ${palette.bd}`, borderRadius: 12, padding: "16px 16px" }}>
                      {/* Verdict en tête, gros */}
                      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                        <div style={{ fontSize: 28, flexShrink: 0 }}>{emoji}</div>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: palette.tc, lineHeight: 1.2 }}>{titre}</div>
                          <div style={{ fontSize: 12.5, color: "#D6E8FA", lineHeight: 1.5, marginTop: 3 }}>{sous}</div>
                        </div>
                      </div>
                      {/* Les chiffres qui justifient, en dessous */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#5DCAA5", background: "rgba(93,202,165,0.1)", borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>+{simResult.heures_ajoutees}h</span>
                        <span style={{ fontSize: 11, color: "#B5D4F4", background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "3px 8px" }}>{simResult.total_avant}h → {simResult.total_apres}h</span>
                        {!secu && (
                          <span style={{ fontSize: 11, color: "#FAC775", background: "rgba(250,199,117,0.1)", borderRadius: 6, padding: "3px 8px" }}>il manquerait {manque}h</span>
                        )}
                        {secu && (
                          <span style={{ fontSize: 11, color: "#5DCAA5", background: "rgba(93,202,165,0.15)", borderRadius: 6, padding: "3px 8px", fontWeight: 600 }}>✓ 507h atteintes</span>
                        )}
                      </div>
                      {!c.date_anniversaire && (
                        <div style={{ fontSize: 10.5, color: "#8BA5C0", marginTop: 11, lineHeight: 1.5 }}>
                          🐾 Renseigne ta date anniversaire sur le cockpit pour que je te dise si c'est à temps pour ton renouvellement.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              </>)}

              {/* ═══ PAGE MES ACTIVITÉS ═══ */}
              {interNav === "activites" && (<>

              {/* ── Reporter les heures déjà faites (saisie de départ) ── */}
              <div style={{ background: "rgba(93,202,165,0.06)", border: "1px solid rgba(93,202,165,0.2)", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }} onClick={() => setReportOpen(v => !v)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="ti ti-history" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 20 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Tu as déjà des heures ?</div>
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 1 }}>Reporte tes heures ou cachets déjà faits pour démarrer ton compteur au bon endroit.</div>
                    </div>
                  </div>
                  <i className={`ti ${reportOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" style={{ color: "#8BA5C0", fontSize: 18, flexShrink: 0 }} />
                </div>

                {reportOpen && (
                  <div style={{ marginTop: 16 }}>
                    {/* Unité : heures ou cachets */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      {[{ id: "heures", label: "En heures" }, { id: "cachets", label: "En cachets" }].map(u => (
                        <button key={u.id} type="button" onClick={() => setReportForm({ ...reportForm, unite: u.id })}
                          style={{ flex: 1, background: reportForm.unite === u.id ? "#5DCAA5" : "transparent", color: reportForm.unite === u.id ? "#04342C" : "#B5D4F4", border: `1px solid ${reportForm.unite === u.id ? "#5DCAA5" : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {u.label}
                        </button>
                      ))}
                    </div>

                    {/* Nombre */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <input type="number" min="0" value={reportForm.nombre} onChange={e => setReportForm({ ...reportForm, nombre: e.target.value })}
                        placeholder={reportForm.unite === "cachets" ? "Ex : 22" : "Ex : 280"}
                        style={{ flex: 1, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      <span style={{ fontSize: 14, color: "#8BA5C0", minWidth: 60 }}>{reportForm.unite === "cachets" ? "cachets" : "heures"}</span>
                    </div>

                    {/* Aperçu de l'équivalent en heures */}
                    {parseFloat(reportForm.nombre) > 0 && (
                      <div style={{ fontSize: 12.5, color: "#5DCAA5", marginBottom: 12 }}>
                        {reportForm.unite === "cachets"
                          ? `Soit ${Math.round(parseFloat(reportForm.nombre) * 12)} h (1 cachet = 12h) ajoutées à ton compteur.`
                          : `${Math.round(parseFloat(reportForm.nombre))} h ajoutées à ton compteur.`}
                      </div>
                    )}

                    {/* Période (pour la fenêtre glissante de 12 mois) */}
                    <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 8 }}>Ces heures, tu les as faites plutôt :</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      {[{ id: "recent", label: "Récemment" }, { id: "annee", label: "Sur l'année" }, { id: "ancien", label: "Il y a un moment" }].map(p => (
                        <button key={p.id} type="button" onClick={() => setReportForm({ ...reportForm, periode: p.id })}
                          style={{ flex: "1 1 auto", background: reportForm.periode === p.id ? "rgba(93,202,165,0.15)" : "transparent", color: reportForm.periode === p.id ? "#5DCAA5" : "#8BA5C0", border: `1px solid ${reportForm.periode === p.id ? "rgba(93,202,165,0.4)" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <button type="button" disabled={reportSaving} onClick={handleReport}
                      style={{ width: "100%", background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, cursor: reportSaving ? "default" : "pointer", fontFamily: "inherit", opacity: reportSaving ? 0.6 : 1 }}>
                      {reportSaving ? "…" : "Reporter ces heures"}
                    </button>
                    <div style={{ fontSize: 10.5, color: "#5A7088", textAlign: "center", lineHeight: 1.5, marginTop: 10 }}>
                      Tu pourras toujours ajuster ou ajouter tes cachets un par un ci-dessous.
                    </div>
                  </div>
                )}
              </div>

              {/* ── Brique 5.2 : saisie + liste des activités ── */}
              <div id="inter-activites" style={{ marginTop: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#B5D4F4", textTransform: "uppercase", letterSpacing: 0.5 }}>Tes activités</div>
                  <button type="button" onClick={() => setInterShowAdd(v => !v)}
                    style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <i className={`ti ${interShowAdd ? "ti-x" : "ti-plus"}`} aria-hidden="true" />
                    {interShowAdd ? "Fermer" : "Ajouter"}
                  </button>
                </div>

                {/* Formulaire d'ajout */}
                {interShowAdd && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="date" value={interForm.date} onChange={e => setInterForm({ ...interForm, date: e.target.value })}
                        style={{ flex: "1 1 140px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      <select value={interForm.type_activite} onChange={e => setInterForm({ ...interForm, type_activite: e.target.value })}
                        style={{ flex: "1 1 140px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                        <option value="cachet_isole">Cachet (artiste · 12h)</option>
                        <option value="heures">Heures (technicien)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="number" min="0" value={interForm.nombre} onChange={e => setInterForm({ ...interForm, nombre: e.target.value })}
                        placeholder={interForm.type_activite === "heures" ? "Nb d'heures" : "Nb de cachets"}
                        style={{ flex: "1 1 120px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      <input type="text" value={interForm.employeur} onChange={e => setInterForm({ ...interForm, employeur: e.target.value })}
                        placeholder="Employeur (optionnel)"
                        style={{ flex: "1 1 160px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.18)", borderRadius: 8, padding: "9px 11px" }}>
                      <i className="ti ti-info-circle" aria-hidden="true" style={{ color: "#9FCBF5", fontSize: 14, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 11.5, color: "#8FB4D8", lineHeight: 1.45 }}>
                        Ajoute ici uniquement tes contrats <strong style={{ color: "#C8E0F5" }}>déjà réalisés ou déjà signés</strong>. Pour tester un contrat possible, utilise le simulateur <strong style={{ color: "#C8E0F5" }}>« Que se passe-t-il si… »</strong>.
                      </div>
                    </div>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer", background: interForm.estime ? "rgba(55,138,221,0.10)" : "rgba(255,255,255,0.02)", border: "1px solid " + (interForm.estime ? "rgba(55,138,221,0.4)" : "rgba(255,255,255,0.1)"), borderRadius: 8, padding: "10px 12px" }}>
                      <input type="checkbox" checked={!!interForm.estime} onChange={e => setInterForm({ ...interForm, estime: e.target.checked })}
                        style={{ marginTop: 2, width: 16, height: 16, accentColor: "#378ADD", flexShrink: 0, cursor: "pointer" }} />
                      <div>
                        <div style={{ fontSize: 12.5, color: "#C8E0F5", fontWeight: 600 }}>C'est une estimation (je n'ai pas encore l'AEM)</div>
                        <div style={{ fontSize: 11, color: "#8FB4D8", lineHeight: 1.4, marginTop: 2 }}>Coche si tu déclares de mémoire en attendant la paie. Tu corrigeras quand l'attestation arrivera.</div>
                      </div>
                    </label>
                    {interForm.estime && (() => {
                      const histo = historiqueEmployeur(interActivites, interForm.employeur, interForm.type_activite);
                      if (!histo) return null;
                      const estCachet = interForm.type_activite !== "heures";
                      const unite = estCachet ? "cachets" : "h";
                      return (
                        <div style={{ background: "rgba(55,138,221,0.07)", border: "1px solid rgba(55,138,221,0.25)", borderRadius: 8, padding: "11px 13px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                            <i className="ti ti-history" aria-hidden="true" style={{ fontSize: 15, color: "#9FCBF5" }} />
                            <div style={{ fontSize: 12.5, color: "#C8E0F5", fontWeight: 700 }}>
                              Chez {interForm.employeur.trim()}, tu as déjà fait :
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: "#9FCBF5", lineHeight: 1.6 }}>
                            {histo.derniers.map((d, i) => (
                              <span key={i}>
                                {formatPeriode({ date: d.date })} · <strong style={{ color: "#E8F4FF" }}>{d.nombre} {estCachet ? "cachet" + (d.nombre > 1 ? "s" : "") : "h"}</strong>
                                {i < histo.derniers.length - 1 ? "  ·  " : ""}
                              </span>
                            ))}
                          </div>
                          {histo.count > 1 && (
                            <div style={{ fontSize: 11.5, color: "#8FB4D8", marginTop: 6 }}>
                              Moyenne sur tes {histo.count} derniers contrats : <strong style={{ color: "#C8E0F5" }}>≈ {histo.moyenne} {unite}</strong>. À toi de voir ce qui colle.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <button type="button" disabled={interSaving} onClick={handleAddActivite}
                      style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: interSaving ? "default" : "pointer", fontFamily: "inherit", opacity: interSaving ? 0.6 : 1 }}>
                      {interSaving ? "Enregistrement…" : "Enregistrer"}
                    </button>
                  </div>
                )}

                {/* Liste des activités */}
                {interActivites.length === 0 && !interShowAdd && (
                  <div style={{ textAlign: "center", padding: "24px 16px", color: "#5A7088", fontSize: 13, background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
                    Aucune activité pour l'instant. Ajoute ton premier cachet pour qu'Hector commence à compter. 🐾
                  </div>
                )}
                {interActivites.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* En-tête de colonnes (style tableau) */}
                    <div style={{ display: "flex", alignItems: "center", padding: "4px 14px", fontSize: 10.5, color: "#5A7088", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <div style={{ width: 96, flexShrink: 0 }}>Date</div>
                      <div style={{ flex: 1, minWidth: 0 }}>Employeur</div>
                      <div style={{ width: 90, flexShrink: 0, textAlign: "right" }}>Volume</div>
                      <div style={{ width: 96, flexShrink: 0 }} />
                    </div>
                    {interActivites.map(a => {
                      const typeLabel = a.type_activite === "heures" ? `${a.nombre}h` :
                        `${a.nombre} cachet${a.nombre > 1 ? "s" : ""}`;
                      // Mode édition de cette ligne
                      if (interEditId === a.id) {
                        return (
                          <div key={a.id} style={{ background: "rgba(55,138,221,0.06)", border: "1px solid rgba(55,138,221,0.25)", borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                              <input type="date" value={interEditForm.date} onChange={e => setInterEditForm({ ...interEditForm, date: e.target.value })}
                                style={{ flex: "1 1 130px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                              <select value={interEditForm.type_activite} onChange={e => setInterEditForm({ ...interEditForm, type_activite: e.target.value })}
                                style={{ flex: "1 1 130px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}>
                                <option value="heures">heures réelles</option>
                                <option value="cachet_isole">cachets (artiste · 12h)</option>
                              </select>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                              <input type="number" min="0" value={interEditForm.nombre} onChange={e => setInterEditForm({ ...interEditForm, nombre: e.target.value })} placeholder="Nombre"
                                style={{ flex: "1 1 90px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                              <input type="text" value={interEditForm.employeur} onChange={e => setInterEditForm({ ...interEditForm, employeur: e.target.value })} placeholder="Employeur (optionnel)"
                                style={{ flex: "1 1 130px", background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10, fontSize: 12, color: "#9FCBF5" }}>
                              <input type="checkbox" checked={!!interEditForm.estime} onChange={e => setInterEditForm({ ...interEditForm, estime: e.target.checked })}
                                style={{ width: 15, height: 15, accentColor: "#378ADD", cursor: "pointer" }} />
                              Estimation (décoche une fois l'AEM reçue et le chiffre confirmé)
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="button" disabled={interEditSaving} onClick={handleSaveEditActivite}
                                style={{ flex: 1, background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, cursor: interEditSaving ? "default" : "pointer", fontFamily: "inherit", opacity: interEditSaving ? 0.6 : 1 }}>
                                {interEditSaving ? "…" : "Enregistrer"}
                              </button>
                              <button type="button" onClick={() => setInterEditId(null)}
                                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#8BA5C0", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        );
                      }
                      const typeLabelComplet = a.type_activite === "heures" ? "Heures réelles" : "Cachets";
                      const estAEM = a.aem_recue === true || a.source === "ocr";
                      const detailOuvert = aemDetailId === a.id;
                      return (
                        <div key={a.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${detailOuvert ? "rgba(93,202,165,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", padding: "11px 14px", gap: 8 }}>
                            {/* Date */}
                            <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: "#9FB6CE", fontVariantNumeric: "tabular-nums" }}>{formatPeriode(a)}</div>
                            {/* Employeur */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, color: a.employeur ? "white" : "#5A7088", fontWeight: a.employeur ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {a.employeur || "—"}
                              </span>
                              {estAEM && (
                                <span style={{ fontSize: 9.5, color: "#5DCAA5", background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 5, padding: "2px 6px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <i className="ti ti-file-check" aria-hidden="true" style={{ fontSize: 11 }} /> AEM
                                </span>
                              )}
                              {a.estime === true && (
                                <span style={{ fontSize: 9.5, color: "#9FCBF5", background: "rgba(55,138,221,0.14)", border: "1px solid rgba(55,138,221,0.4)", borderRadius: 5, padding: "2px 6px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <i className="ti ti-bulb" aria-hidden="true" style={{ fontSize: 11 }} /> Estimé
                                </span>
                              )}
                            </div>
                            {/* Volume (heures/cachets) */}
                            <div style={{ width: 90, flexShrink: 0, textAlign: "right", fontSize: 13, color: "white", fontWeight: 700 }}>{typeLabel}</div>
                            {/* Actions */}
                            <div style={{ width: 96, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                              {estAEM && (
                                <button type="button" onClick={() => setAemDetailId(detailOuvert ? null : a.id)} aria-label="Revoir l'AEM"
                                  style={{ background: "transparent", border: "none", color: detailOuvert ? "#5DCAA5" : "#6B8299", cursor: "pointer", fontSize: 16, padding: 6 }}>
                                  <i className={`ti ${detailOuvert ? "ti-eye-off" : "ti-eye"}`} aria-hidden="true" />
                                </button>
                              )}
                              <button type="button" onClick={() => startEditActivite(a)} aria-label="Modifier"
                                style={{ background: "transparent", border: "none", color: "#6B8299", cursor: "pointer", fontSize: 16, padding: 6 }}>
                                <i className="ti ti-pencil" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => { if (window.confirm("Supprimer cette activité ?")) handleDeleteActivite(a.id); }} aria-label="Supprimer"
                                style={{ background: "transparent", border: "none", color: "#6B8299", cursor: "pointer", fontSize: 16, padding: 6 }}>
                                <i className="ti ti-trash" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          {/* Panneau "revoir ce qu'Hector a lu sur l'AEM" */}
                          {detailOuvert && (
                            <div style={{ borderTop: "1px solid rgba(93,202,165,0.15)", background: "rgba(93,202,165,0.04)", padding: "12px 14px" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#5DCAA5", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                <i className="ti ti-file-check" aria-hidden="true" /> Ce que j'ai lu sur cette AEM
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12.5 }}>
                                <div><span style={{ color: "#6B8299" }}>Employeur</span><br /><span style={{ color: "#E8F4FF", fontWeight: 600 }}>{a.employeur || "—"}</span></div>
                                <div><span style={{ color: "#6B8299" }}>Date</span><br /><span style={{ color: "#E8F4FF", fontWeight: 600 }}>{a.date_fin && a.date_fin !== a.date ? "du " + a.date + " au " + a.date_fin : a.date}</span></div>
                                <div><span style={{ color: "#6B8299" }}>Type</span><br /><span style={{ color: "#E8F4FF", fontWeight: 600 }}>{typeLabelComplet}</span></div>
                                <div><span style={{ color: "#6B8299" }}>{a.type_activite === "heures" ? "Heures" : "Cachets"}</span><br /><span style={{ color: "#E8F4FF", fontWeight: 600 }}>{a.nombre}</span></div>
                                <div><span style={{ color: "#6B8299" }}>Salaire brut</span><br /><span style={{ color: "#E8F4FF", fontWeight: 600 }}>{a.salaire_brut ? `${new Intl.NumberFormat("fr-FR").format(a.salaire_brut)} €` : "—"}</span></div>
                                {a.aem_filename && <div><span style={{ color: "#6B8299" }}>Fichier</span><br /><span style={{ color: "#8BA5C0", fontWeight: 500, fontSize: 11.5, wordBreak: "break-all" }}>{a.aem_filename}</span></div>}
                              </div>
                              {a.a_document ? (
                                <button type="button" onClick={() => voirDocumentAEM(a.id, a.aem_filename)}
                                  style={{ marginTop: 12, background: "transparent", border: "1px solid rgba(93,202,165,0.35)", color: "#5DCAA5", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
                                  <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: 15 }} /> Voir le document original
                                </button>
                              ) : (
                                <div style={{ fontSize: 10.5, color: "#5A7088", marginTop: 10, lineHeight: 1.5 }}>
                                  🐾 Le document original de cette AEM n'a pas été conservé (scannée avant l'activation du coffre). Les prochaines seront gardées en sécurité.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Avertissement indicatif */}
              <div style={{ fontSize: 11, color: "#5A7088", textAlign: "center", lineHeight: 1.5, marginBottom: 8 }}>
                {c.avertissement}
              </div>
              </>)}

              {/* ═══ PAGE COMPRENDRE (conseils) ═══ */}
              {interNav === "conseils" && (<>
              {/* ── Conseils : fiches pédagogiques pour comprendre le régime ── */}
              <div id="inter-conseils" style={{ marginTop: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <i className="ti ti-book" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18 }} />
                  <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>Comprendre ton régime</div>
                </div>
                <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 16, lineHeight: 1.5 }}>
                  Hector t'explique l'essentiel, sans jargon. Pour ne plus jamais te sentir perdu.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {FICHES_CONSEILS.map((f, i) => (
                    <details key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
                      <summary style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", listStyle: "none" }}>
                        <i className={`ti ${f.icon}`} aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 18, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{f.titre}</span>
                        <i className="ti ti-chevron-down" aria-hidden="true" style={{ color: "#6B8299", fontSize: 16 }} />
                      </summary>
                      <div style={{ fontSize: 13, color: "#B5D4F4", lineHeight: 1.7, marginTop: 10, paddingLeft: 28 }}>
                        {f.texte}
                      </div>
                    </details>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: "#5A7088", textAlign: "center", lineHeight: 1.5, marginTop: 14 }}>
                  Informations générales à jour de 2026, basées sur les sources officielles (France Travail, Audiens).
                  Ta situation personnelle peut varier — en cas de doute, contacte France Travail Spectacle.
                </div>
              </div>
              </>)}

              {/* ═══ PAGE RÉGLAGES ═══ */}
              {interNav === "reglages" && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#0a1322", border: "1.5px solid rgba(93,202,165,0.4)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  <NiveauImage src="/hector-tete.png" fallbackIcon="ti-settings" fallbackColor="#5DCAA5" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "white" }}>Réglages</div>
                  <div style={{ fontSize: 12.5, color: "#8BA5C0" }}>{profile?.email}</div>
                </div>
              </div>

              {/* Mes infos */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 14 }}>Mes infos</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 140px" }}>Prénom
                    <input type="text" value={profilPrenom} onChange={e => setProfilPrenom(e.target.value)} placeholder="Ton prénom"
                      style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, flex: "1 1 140px" }}>Nom
                    <input type="text" value={profilNom} onChange={e => setProfilNom(e.target.value)} placeholder="Ton nom"
                      style={{ width: "100%", marginTop: 5, background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </label>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <button type="button" onClick={handleSaveProfileDetails} disabled={profileDetailsSaving}
                    style={{ background: "#5DCAA5", color: "#04342C", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: profileDetailsSaving ? "default" : "pointer", fontFamily: "inherit", opacity: profileDetailsSaving ? 0.6 : 1 }}>
                    {profileDetailsSaving ? "…" : "Enregistrer"}
                  </button>
                  {profileDetailsSaved && <span style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 600 }}>✓ Enregistré</span>}
                </div>
                <div style={{ fontSize: 11, color: "#5A7088", marginTop: 12, lineHeight: 1.5 }}>
                  🐾 Ta date anniversaire se règle directement sur le cockpit, là où je surveille ton renouvellement.
                </div>
              </div>

              {/* Mon statut */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 4 }}>Mon statut</div>
                <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 14, lineHeight: 1.5 }}>Tu es en mode intermittent du spectacle. Tu peux basculer vers le cockpit auto-entrepreneur à tout moment.</div>
                <button type="button" disabled={statutSaving} onClick={() => handleChangeStatut("auto_entrepreneur")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#B5D4F4", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: statutSaving ? "default" : "pointer", fontFamily: "inherit", opacity: statutSaving ? 0.6 : 1 }}>
                  <i className="ti ti-briefcase" aria-hidden="true" style={{ fontSize: 16 }} /> {statutSaving ? "…" : "Passer en mode auto-entrepreneur"}
                </button>
              </div>

              {/* Mes données (RGPD) */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 4 }}>Mes données</div>
                <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 14, lineHeight: 1.5 }}>Conformément au RGPD, tu peux exporter toutes tes données ou supprimer définitivement ton compte.</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" onClick={handleExportData} disabled={exportingData}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#B5D4F4", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: exportingData ? "default" : "pointer", fontFamily: "inherit", opacity: exportingData ? 0.6 : 1 }}>
                    <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 15 }} /> {exportingData ? "Export…" : "Exporter mes données"}
                  </button>
                  <button type="button" onClick={() => setShowDeleteAccount(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid rgba(226,75,74,0.4)", color: "#F09595", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 15 }} /> Supprimer mon compte
                  </button>
                </div>
                {showDeleteAccount && (
                  <div style={{ marginTop: 14, padding: "14px 16px", background: "rgba(226,75,74,0.07)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F09595", marginBottom: 6 }}>⚠️ Cette action est irréversible</div>
                    <p style={{ fontSize: 12, color: "#E8C4C4", margin: "0 0 10px", lineHeight: 1.5 }}>
                      Toutes tes données (profil, activités, AEM, actualisations) seront définitivement supprimées. Pense à exporter avant si besoin.
                    </p>
                    <p style={{ fontSize: 12, color: "#E8C4C4", margin: "0 0 8px" }}>Tape <strong>SUPPRIMER</strong> pour confirmer :</p>
                    <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER"
                      style={{ background: "#0d2440", border: "1px solid #1e3a5f", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "white", outline: "none", fontFamily: "inherit", marginBottom: 10, maxWidth: 240, width: "100%", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={handleDeleteAccount} disabled={deleteConfirmText !== "SUPPRIMER" || deletingAccount}
                        style={{ background: "#E24B4A", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: (deleteConfirmText !== "SUPPRIMER" || deletingAccount) ? "default" : "pointer", fontFamily: "inherit", opacity: (deleteConfirmText !== "SUPPRIMER" || deletingAccount) ? 0.5 : 1 }}>
                        {deletingAccount ? "Suppression…" : "Supprimer définitivement"}
                      </button>
                      <button type="button" onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); }}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#8BA5C0", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Aide + déconnexion */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setShowWalkthrough(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#B5D4F4", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  <i className="ti ti-help-circle" aria-hidden="true" style={{ fontSize: 15 }} /> Revoir la visite guidée
                </button>
                <button type="button" onClick={handleLogout}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#8BA5C0", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 15 }} /> Déconnexion
                </button>
              </div>

              <p style={{ fontSize: 11, color: "#5A7088", textAlign: "center", marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
                <button type="button" style={{ background: "none", border: "none", color: "#5A7088", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }} onClick={() => setLegalPage("mentions")}>Mentions légales</button>
                <span>·</span>
                <button type="button" style={{ background: "none", border: "none", color: "#5A7088", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }} onClick={() => setLegalPage("cgu")}>CGU</button>
                <span>·</span>
                <button type="button" style={{ background: "none", border: "none", color: "#5A7088", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }} onClick={() => setLegalPage("confidentialite")}>Confidentialité</button>
              </p>
              </>)}
            </>
          )}
        {/* ===== WALKTHROUGH (rendu aussi dans la vue intermittente) ===== */}
      {showWalkthrough && (() => {
        const estIntermittent = profile && profile.statut === "intermittent";
        // Parcours dédié intermittent du spectacle (le côté "507h / cachets / AEM").
        const wtStepsIntermittent = [
          {
            img: "/hector-tete.png",
            timerLabel: "BIENVENUE SUR H€CTOR",
            title: "Bonjour, moi c'est H€CTOR.",
            sub: "Je suis ton copilote pour le régime intermittent. Mon job : compter tes heures vers tes 507h, veiller sur ta date anniversaire, et te dire où tu en es — sans que tu aies à sortir la calculatrice. En 2 minutes, je te montre tout ce que je sais faire.",
            items: [
              { icon: "ti-check", text: "Je ne remplace pas France Travail — je t'aide à y voir clair" },
              { icon: "ti-check", text: "Tu déclares tes contrats, je m'occupe des calculs" },
              { icon: "ti-check", text: "Tu peux passer cette visite à tout moment" },
            ],
            next: "Découvrir",
          },
          {
            img: "/hector-1.png",
            timerLabel: "LE COCKPIT — TON COMPTEUR 507H",
            title: "Tes 507h, toujours à jour.",
            sub: "C'est ta page d'accueil. Je convertis tes cachets en heures (1 cachet = 12h), j'additionne tout sur les 12 derniers mois glissants, et je te montre où tu en es vers les 507h qui ouvrent tes droits. Hector grandit visuellement avec ta progression, du chiot au gardien.",
            items: [
              { icon: "ti-gauge", text: "Ton total d'heures en direct, sur la fenêtre de 12 mois" },
              { icon: "ti-ticket", text: "Tes cachets convertis et additionnés automatiquement" },
              { icon: "ti-trophy", text: "Tes paliers débloqués au fil de tes heures" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-2.png",
            timerLabel: "LA DATE ANNIVERSAIRE",
            title: "Je veille sur ton renouvellement.",
            sub: "La date anniversaire, c'est le jour où France Travail réexamine tes droits. Renseigne-la une fois, et je te montre en permanence combien de jours il te reste — et si tu es dans les temps pour avoir tes 507h avant. Plus jamais pris(e) de court.",
            items: [
              { icon: "ti-calendar-event", text: "Le compte à rebours jusqu'à ton renouvellement" },
              { icon: "ti-bell", text: "Je t'alerte si le rythme n'est pas suffisant" },
              { icon: "ti-pencil", text: "Modifiable à tout moment depuis le cockpit" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-3.png",
            timerLabel: "MES ACTIVITÉS",
            title: "Ajoute un contrat en quelques secondes.",
            sub: "Dans « Mes activités », chaque cachet ou période d'heures se déclare en un instant : la date, l'employeur, le nombre. Tu peux aussi reporter d'un coup les heures que tu avais déjà faites avant d'arriver sur Hector, pour démarrer ton compteur au bon endroit.",
            items: [
              { icon: "ti-plus", text: "Saisie rapide : date, employeur, cachets ou heures" },
              { icon: "ti-history", text: "Report de tes heures déjà faites pour bien démarrer" },
              { icon: "ti-pencil", text: "Tout reste modifiable ou supprimable à tout moment" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-4.png",
            timerLabel: "SCANNER UNE AEM",
            title: "Photographie ton AEM, je lis tout.",
            sub: "L'AEM, c'est l'attestation que ton employeur t'envoie après chaque contrat. Prends-la en photo (ou PDF) : je lis l'employeur, les cachets, les heures et le salaire brut, et je remplis tout pour toi. Plusieurs attestations dans un seul fichier ? Je les détecte toutes. Tu n'as plus qu'à vérifier. Tes documents sont rangés en sécurité.",
            items: [
              { icon: "ti-camera", text: "Scan photo ou PDF : je lis et je remplis les champs" },
              { icon: "ti-eye-check", text: "Tu vérifies, tu corriges si besoin, tu valides" },
              { icon: "ti-folder", text: "Tes AEM conservées, consultables quand tu veux" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-5.png",
            timerLabel: "L'ACTUALISATION",
            title: "Chaque mois, ton récap prêt à recopier.",
            sub: "Au moment de t'actualiser auprès de France Travail, je te prépare le récap du mois écoulé : tes employeurs, tes cachets, tes heures, ton brut. Un mode guidé t'accompagne champ par champ pour recopier sans erreur, et je te signale s'il manque une AEM.",
            items: [
              { icon: "ti-list-check", text: "Le récap du mois, employeur par employeur" },
              { icon: "ti-clipboard-check", text: "Un mode guidé pour recopier sans te tromper" },
              { icon: "ti-alert-triangle", text: "Une alerte si une AEM manque encore à l'appel" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-1.png",
            timerLabel: "LE CALCUL DES HEURES",
            title: "Pose-moi tes questions.",
            sub: "« Combien me manque-t-il ? », « Si j'accepte ce contrat ? », « Et si je fais une pause ? ». Je réponds avec tes vrais chiffres, jamais à l'aveugle. Et avec le champ « Que se passe-t-il si… », tu me poses n'importe quel scénario en langage normal et je le calcule.",
            items: [
              { icon: "ti-target", text: "Combien d'heures il te reste, en cachets concrets" },
              { icon: "ti-briefcase", text: "L'impact exact d'un contrat avant de l'accepter" },
              { icon: "ti-message-circle", text: "« Que se passe-t-il si… » : ton scénario, ma réponse chiffrée" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-2.png",
            timerLabel: "PARLE À HECTOR",
            title: "Ton expert du régime, dispo 24h/24.",
            sub: "Une question sur les annexes 8 et 10, la clause de rattrapage, les congés spectacles, ta date anniversaire ? Écris-moi dans « Parle à Hector ». Je connais ton régime en profondeur et je t'explique tout simplement, sans jargon. Et je peux te dire si tu dois accepter un contrat qu'on te propose.",
            items: [
              { icon: "ti-message-2", text: "Un chat expert du régime intermittent" },
              { icon: "ti-phone-call", text: "« On te propose un contrat ? » : je te dis si tu acceptes" },
              { icon: "ti-bulb", text: "Des réponses claires, sans jargon administratif" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-3.png",
            timerLabel: "COMPRENDRE & MES DOCUMENTS",
            title: "Pour ne plus jamais te sentir perdu(e).",
            sub: "Dans « Comprendre », des fiches claires t'expliquent l'essentiel : les 507h, les annexes, la clause de rattrapage, les congés spectacles. Et dans « Mes documents », je te génère un récapitulatif de tes revenus à présenter à un proprio ou une banque, et je range tes AEM et actualisations.",
            items: [
              { icon: "ti-book", text: "Des fiches pédago pour comprendre ton régime" },
              { icon: "ti-file-text", text: "Un récap de revenus pour proprio ou banque" },
              { icon: "ti-folders", text: "Tes AEM et actualisations archivées au même endroit" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-6.png",
            timerLabel: "LA CONFIANCE",
            title: "Je te montre toujours mon raisonnement.",
            sub: "Sur chaque calcul, un badge te dit à quel point tu peux t'y fier, et un bouton « Pourquoi ? » t'explique mon raisonnement — avec les règles officielles sur lesquelles je m'appuie. Tu n'as jamais à me croire sur parole. Commence par déclarer un contrat ou scanner une AEM, et c'est parti !",
            items: [
              { icon: "ti-shield-check", text: "Un badge de confiance sur chaque réponse" },
              { icon: "ti-help-circle", text: "« Pourquoi ? » : mon raisonnement, étape par étape" },
              { icon: "ti-book", text: "Cette visite est retrouvable via « Aide » dans le menu" },
            ],
            next: "C'est parti !",
          },
        ];
        const wtStepsAuto = [
          {
            img: "/hector-tete.png",
            timerLabel: "BIENVENUE SUR H€CTOR",
            title: "Bonjour, moi c'est H€CTOR.",
            sub: "Je vais t'aider à savoir exactement ce que tu peux dépenser — sans mauvaise surprise. En 2 minutes, tu vas comprendre comment je calcule tes charges, prépare tes devis et protège ta trésorerie.",
            items: [
              { icon: "ti-check", text: "Zéro case à remplir pour commencer" },
              { icon: "ti-check", text: "Ton premier revenu suffit à tout démarrer" },
              { icon: "ti-check", text: "Tu peux passer à tout moment" },
            ],
            next: "Découvrir",
          },
          {
            img: "/niveau-1.png",
            timerLabel: "LE COCKPIT + L'ASSISTANT",
            title: "Fini les mauvaises surprises URSSAF.",
            sub: "Le Cockpit est ton tableau de bord principal. Tu y vois en temps réel ce que tu peux vraiment dépenser après charges. L'Assistant répond à toutes tes questions fiscales — par texte ou dictée vocale.",
            items: [
              { icon: "ti-check", text: "Situation saine / Fragile / Déficit en un coup d'œil" },
              { icon: "ti-check", text: "Charges URSSAF + impôts calculées automatiquement" },
              { icon: "ti-mic", text: "Assistant disponible par texte ou dictée vocale" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-2.png",
            timerLabel: "REVENUS, FRAIS & FACTURATION",
            title: "Encaisser, dépenser, facturer — tout au même endroit.",
            sub: "Ajoute un revenu ou une dépense en quelques secondes. Crée un devis, convertis-le en facture en 1 clic, et envoie-le directement par email avec PDF.",
            items: [
              { icon: "ti-check", text: "Encaisser / Frais : revenus et dépenses professionnelles" },
              { icon: "ti-check", text: "Mes factures : PDF professionnel + envoi email intégré" },
              { icon: "ti-check", text: "Mes devis : convertis en facture en 1 clic" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-3.png",
            timerLabel: "LES OUTILS",
            title: "Simule avant de décider.",
            sub: "H€CTOR met à ta disposition 5 outils de simulation pour prendre les bonnes décisions : combien te verser, si tu peux te permettre un achat, combien facturer pour vivre correctement.",
            items: [
              { icon: "ti-cash", text: "Mode Salaire — combien puis-je me verser ce mois ?" },
              { icon: "ti-shopping-cart", text: "Mode Achat — puis-je me permettre cette dépense ?" },
              { icon: "ti-target", text: "Combien gagner ? + Simulateur fiscal + Mes tarifs" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-4.png",
            timerLabel: "SUIVI & PILOTAGE",
            title: "Pilote ton activité sur le long terme.",
            sub: "Score H€CTOR note ta santé financière sur 100. Revenus te donne une vue annuelle de ton CA. Contacts centralise tes clients. Actualités et Conseils te tiennent informé des obligations fiscales.",
            items: [
              { icon: "ti-heart-rate-monitor", text: "Score H€CTOR — ta santé financière sur 100" },
              { icon: "ti-chart-bar", text: "Revenus, Contacts, Modèles de documents" },
              { icon: "ti-bell", text: "Actualités fiscales + Conseils auto-entrepreneur" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-5.png",
            timerLabel: "LA SÉRÉNITÉ D'HECTOR",
            title: "Hector grandit avec toi.",
            sub: "Chaque jour où ta trésorerie est saine, Hector avance vers son domaine. De sa première nuit chez toi jusqu'à son château — c'est ton activité qui le fait progresser.",
            items: [
              { icon: "ti-dog", text: "Hector arrive → Son panier → Sa niche → Son jardin" },
              { icon: "ti-home", text: "Sa maison → Son domaine (6 niveaux à débloquer)" },
              { icon: "ti-check", text: "Plus tu es régulier, plus vite il progresse" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-6.png",
            timerLabel: "TU ES PRÊT(E) !",
            title: "Ta trésorerie ne te réserve plus de mauvaises surprises.",
            sub: "Commence par ajouter ton premier revenu. En 10 secondes, H€CTOR te dit exactement ce que tu peux dépenser aujourd'hui.",
            items: [
              { icon: "ti-receipt-2", text: "Ajouter un revenu ou une dépense" },
              { icon: "ti-file-plus", text: "Créer mon premier devis" },
              { icon: "ti-help-circle", text: "Retrouver cette visite via « Aide » dans le menu" },
            ],
            next: "C'est parti !",
          },
        ];
        const wtSteps = estIntermittent ? wtStepsIntermittent : wtStepsAuto;
        const WalkthroughModal = () => {
          const [wtStep, setWtStep] = useState(0);
          const s = wtSteps[wtStep];
          const closeWalkthrough = () => {
            safeStorage.setItem("hector_walkthrough_done", "1");
            setShowWalkthrough(false);
          };
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(10,37,64,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ background: "#0A2540", border: "1px solid rgba(55,138,221,0.35)", borderRadius: 18, padding: isMobile ? "28px 20px 24px" : "36px 36px 28px", maxWidth: 440, width: "100%", position: "relative", boxSizing: "border-box" }}>
                {/* Barre de progression */}
                <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: `${((wtStep + 1) / wtSteps.length) * 100}%`, background: "#378ADD", borderRadius: "18px 0 0 0", transition: "width 0.35s ease" }} />
                {/* Bouton fermer */}
                <button onClick={closeWalkthrough} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "rgba(181,212,244,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Passer <i className="ti ti-x" style={{ fontSize: 11 }} />
                </button>
                {/* Dots */}
                <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 20 }}>
                  {wtSteps.map((_, i) => (
                    <div key={i} style={{ height: 5, width: i === wtStep ? 16 : 5, borderRadius: i === wtStep ? 3 : "50%", background: i === wtStep ? "#378ADD" : "rgba(181,212,244,0.2)", transition: "all 0.2s" }} />
                  ))}
                </div>
                {/* Timer label */}
                <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(181,212,244,0.45)", marginBottom: 18 }}>{s.timerLabel}</div>
                {/* Avatar image niveau */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <img src={s.img} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", objectPosition: "center 40%", border: "2px solid rgba(55,138,221,0.5)", background: "#0d2d4a" }} />
                </div>
                {/* Titre */}
                <p style={{ color: "white", fontSize: 18, fontWeight: 500, textAlign: "center", margin: "0 0 10px", lineHeight: 1.35 }}>{s.title}</p>
                {/* Sous-titre */}
                <p style={{ color: "#B5D4F4", fontSize: 13.5, textAlign: "center", lineHeight: 1.65, margin: "0 auto 18px", maxWidth: 340 }}>{s.sub}</p>
                {/* Items */}
                <div style={{ background: "rgba(55,138,221,0.1)", border: "0.5px solid rgba(55,138,221,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 22 }}>
                  {s.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, color: "#B5D4F4", fontSize: 13, padding: "4px 0" }}>
                      <i className={`ti ${it.icon}`} style={{ color: "#5DCAA5", fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                      <span>{it.text}</span>
                    </div>
                  ))}
                </div>
                {/* Navigation */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  {wtStep > 0 && (
                    <button onClick={() => setWtStep(wtStep - 1)} style={{ background: "transparent", color: "#B5D4F4", border: "0.5px solid rgba(181,212,244,0.3)", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                      Retour
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (wtStep < wtSteps.length - 1) setWtStep(wtStep + 1);
                      else closeWalkthrough();
                    }}
                    style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {s.next} {wtStep < wtSteps.length - 1 ? <i className="ti ti-arrow-right" /> : <i className="ti ti-check" />}
                  </button>
                </div>
              </div>
            </div>
          );
        };
        return <WalkthroughModal key="walkthrough" />;
      })()}

        </div>
        </div>
      </div>
    );
  }


  const userInitials = (profile?.email || "").slice(0, 2).toUpperCase();

  return (
    <div style={isMobile ? { ...S.appWrap, display: "block" } : S.appWrap}>
      <style>{CSS}</style>

      {isMobile && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: INK, position: "fixed", top: 0, left: 0, right: 0, zIndex: 90, height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <Logo size={28} dark />
          <div style={{ width: 40 }} />
        </div>
      )}

      {isMobile && mobileMenuOpen && (
        <div style={S.sidebarBackdrop} onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside
        style={
          isMobile
            ? { ...S.sidebar, position: "fixed", top: 0, left: 0, height: "100vh", width: 250, zIndex: 80, transform: mobileMenuOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease" }
            : { ...S.sidebar, ...(sidebarOpen ? {} : S.sidebarClosed) }
        }
      >
        <div style={S.sidebarTop}>
          {(!isMobile && !sidebarOpen) ? <LogoIcon size={32} /> : <Logo size={36} dark />}
          {isMobile && (
            <button style={{ ...S.navItem, padding: "4px 8px", width: "auto", marginLeft: "auto" }} onClick={() => setMobileMenuOpen(false)}>
              <i className="ti ti-x" aria-hidden="true" style={{ fontSize: 20 }} />
            </button>
          )}
        </div>

        {(isMobile || sidebarOpen) && (profilPrenom || profilEntreprise) && (
          <div style={S.sidebarGreeting}>
            {profilPrenom && <div style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{profilPrenom} 👋</div>}
            {profilEntreprise && <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 2 }}>{profilEntreprise}{profile?.statut === "auto_entrepreneur" ? " · Auto-entrepreneur" : ""}</div>}
          </div>
        )}

        {/* ─── NAVIGATION PRINCIPALE — 5 entrées cockpit ───
            Les ids techniques (dashboard, factures, frais, declaration, echeances,
            assistant) sont INCHANGÉS : tous les `nav === "..."` et `setNav("...")`
            existants continuent de fonctionner. Seuls les labels et le regroupement
            changent. "Préparer" est un groupe qui ouvre declaration + echeances. */}
        {[
          { id: "dashboard", icon: "ti-gauge", label: "Cockpit" },
          { id: "assistant", icon: "ti-message-2", label: "Hector" },
          { id: "revenus", icon: "ti-chart-bar", label: "Mes revenus" },
          { id: "frais", icon: "ti-receipt-2", label: "Encaisser / Frais" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
            {(isMobile || sidebarOpen) && <span style={S.navLabel}>{item.label}</span>}
          </button>
        ))}

        {/* Groupe "Facturer" : factures + devis (même flux commercial). */}
        <button
          style={{ ...S.navItem, ...((nav === "factures" || nav === "devis") ? S.navItemActive : {}) }}
          onClick={() => setFacturerOpen(!facturerOpen)}
        >
          <i className="ti ti-file-invoice" aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
          {(isMobile || sidebarOpen) && <span style={S.navLabel}>Facturer</span>}
          {(isMobile || sidebarOpen) && <i className={`ti ${facturerOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" style={{ fontSize: 14, marginLeft: "auto" }} />}
        </button>
        {facturerOpen && (isMobile || sidebarOpen) && [
          { id: "factures", icon: "ti-file-invoice", label: "Mes factures" },
          { id: "devis", icon: "ti-file-description", label: "Mes devis" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, paddingLeft: 28, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ ...S.navLabel, fontSize: 12 }}>{item.label}</span>
          </button>
        ))}

        {/* Groupe "Préparer" : déclaration + échéances. Actif si l'un des deux est ouvert. */}
        <button
          style={{ ...S.navItem, ...((nav === "declaration" || nav === "echeances") ? S.navItemActive : {}) }}
          onClick={() => setPrepareOpen(!prepareOpen)}
        >
          <i className="ti ti-clipboard-check" aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
          {(isMobile || sidebarOpen) && <span style={S.navLabel}>Préparer</span>}
          {(isMobile || sidebarOpen) && <i className={`ti ${prepareOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" style={{ fontSize: 14, marginLeft: "auto" }} />}
        </button>
        {prepareOpen && (isMobile || sidebarOpen) && [
          { id: "declaration", icon: "ti-clipboard-check", label: "Ma déclaration" },
          { id: "echeances", icon: "ti-calendar-due", label: "Mes échéances" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, paddingLeft: 28, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ ...S.navLabel, fontSize: 12 }}>{item.label}</span>
          </button>
        ))}

        {/* (Assistant remonté en 2e position dans le groupe principal ci-dessus) */}

        {/* ─── OUTILS — tout le reste, accessible mais secondaire. Rien n'est supprimé. ─── */}
        <button style={{ ...S.navItem, borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, paddingTop: 14 }} onClick={() => setOutilsOpen(!outilsOpen)}>
          <i className="ti ti-dots" aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }} />
          {(isMobile || sidebarOpen) && <span style={S.navLabel}>Outils</span>}
          {(isMobile || sidebarOpen) && <i className={`ti ${outilsOpen ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" style={{ fontSize: 14, marginLeft: "auto" }} />}
        </button>
        {outilsOpen && (isMobile || sidebarOpen) && [
          { id: "salaire", icon: "ti-cash", label: "Mode Salaire" },
          { id: "achat", icon: "ti-shopping-cart", label: "Mode Achat" },
          { id: "simulateur", icon: "ti-chart-pie", label: "Simulateur fiscal" },
          { id: "coach", icon: "ti-target-arrow", label: "Mes tarifs" },
          { id: "contacts", icon: "ti-address-book", label: "Contacts" },
          { id: "conseils", icon: "ti-star", label: "Conseils" },
          { id: "modeles", icon: "ti-template", label: "Modèles" },
          { id: "abonnement", icon: "ti-crown", label: "Abonnement" },
          { id: "profil", icon: "ti-user", label: "Profil" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, paddingLeft: 28, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ ...S.navLabel, fontSize: 12 }}>{item.label}</span>
          </button>
        ))}
        <button style={{ ...S.navItem, marginTop: 4 }} onClick={() => setShowWalkthrough(true)}>
          <i className="ti ti-help-circle" aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
          {(isMobile || sidebarOpen) && <span style={{ ...S.navLabel, fontSize: 12 }}>Aide — Visite guidée</span>}
        </button>
        <button style={{ ...S.navItem, marginTop: 4 }} disabled={statutSaving} onClick={() => handleChangeStatut("intermittent")} title="Passer en mode intermittent">
          <i className="ti ti-movie" aria-hidden="true" style={{ fontSize: 15, flexShrink: 0, color: "#5DCAA5" }} />
          {(isMobile || sidebarOpen) && <span style={{ ...S.navLabel, fontSize: 12, color: "#5DCAA5" }}>{statutSaving ? "…" : "Mode intermittent"}</span>}
        </button>
        <div style={S.sidebarBottom}>
          <div style={S.userRow}>
            <div style={S.avatar}>{userInitials}</div>
            {(isMobile || sidebarOpen) && <button style={S.linkBtn} onClick={handleLogout}>Déconnexion</button>}
          </div>
        </div>
      </aside>

      <main style={isMobile ? { ...S.mainContent, padding: "72px 14px 16px" } : S.mainContent}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {error && <div style={S.errorBanner}>{error}</div>}

        {nav !== "dashboard" && (
          <button
            onClick={() => setNav("dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(10,37,64,0.15)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, color: INK, cursor: "pointer", marginBottom: 16 }}
          >
            ← Retour au cockpit
          </button>
        )}

        {!emailVerified && profile?.onboarding_complete && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap", background: "#E6F1FB", border: "1px solid #B5D4F4", borderRadius: 10, padding: "10px 16px", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#0C447C", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ti ti-mail" aria-hidden="true" style={{ fontSize: 16 }} />
              Pensez à vérifier votre adresse email.
            </span>
            {resendVerifStatus === "sent" ? (
              <span style={{ fontSize: 12, color: "#0F6E56", fontWeight: 600 }}>✓ Email envoyé</span>
            ) : (
              <button style={{ ...S.linkBtn, fontSize: 12 }} onClick={handleResendVerification} disabled={resendVerifStatus === "sending"}>
                {resendVerifStatus === "sending" ? "Envoi…" : "Renvoyer l'email de vérification"}
              </button>
            )}
          </div>
        )}

        {/* ─── Bannière d'installation PWA (écran d'accueil) ─── */}
        {!pwaDismissed && (
          <InstallBanner pwaPrompt={pwaPrompt} onInstall={handleInstallClick} onDismiss={dismissPwa} showHelp={showInstallHelp} />
        )}

        {nav === "dashboard" && estimateData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── BRIEFING DU MATIN D'HECTOR ── */}
            {(() => {
              const b = briefingMatin;
              const couleurTon = b.ton === "alerte" ? "#E24B4A" : b.ton === "vigilant" ? "#EF9F27" : b.ton === "serein" ? "#5DCAA5" : "#8BA5C0";
              const ouvert = briefingOuvert || !briefingVuAujourdhui;
              const marquerVu = () => {
                safeStorage.setItem("briefingVu", new Date().toISOString().slice(0, 10));
                setBriefingVuAujourdhui(true);
                setBriefingOuvert(false);
              };
              if (!ouvert) {
                return (
                  <button
                    onClick={() => setBriefingOuvert(true)}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: "#0a1322", border: `1px solid ${couleurTon}33`, borderRadius: 12, padding: "10px 16px", cursor: "pointer", textAlign: "left", width: "100%" }}
                  >
                    <HectorTete size={28} />
                    <span style={{ fontSize: 13, color: "#B5D4F4", flex: 1 }}>Revoir le briefing d'Hector du jour</span>
                    <span style={{ fontSize: 12, color: couleurTon }}>Ouvrir →</span>
                  </button>
                );
              }
              return (
                <div style={{ background: "linear-gradient(135deg, #0a1322 0%, #0e1b30 100%)", border: `1px solid ${couleurTon}44`, borderRadius: 16, padding: "20px 22px", position: "relative", animation: "fadeInDown 0.4s ease" }}>
                  <button onClick={marquerVu} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#4A6280", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", border: `2px solid ${couleurTon}55`, flexShrink: 0 }}>
                      <img src="/hector-tete.png" alt="Hector" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "white" }}>🐾 {b.salut}{b.prenom ? ` ${b.prenom}` : ""}</div>
                      <div style={{ fontSize: 11, color: "#6B8299" }}>Ton briefing du {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
                    </div>
                  </div>

                  {b.dispo !== null && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 2 }}>💰 Ce que tu peux dépenser aujourd'hui</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: b.dispo >= 0 ? "#5DCAA5" : "#F09595", fontVariantNumeric: "tabular-nums" }}>
                        {b.dispo < 0 ? "−" : ""}{formatEUR(Math.abs(b.dispo))}
                      </div>
                    </div>
                  )}

                  {b.gardeAuChaud.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 6 }}>🧾 Ce que je garde au chaud pour toi</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {b.gardeAuChaud.map(g => (
                          <div key={g.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                            <span style={{ color: "#8BA5C0" }}>{g.label} : </span>
                            <span style={{ color: "white", fontWeight: 700 }}>{formatEUR(g.montant)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {b.alerte && (
                    <div style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#F09595", marginBottom: 4 }}>⚠️ Attention</div>
                      <div style={{ fontSize: 13, color: "#E8C4C4", lineHeight: 1.5 }}>{b.alerte}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 4 }}>📈 Mon analyse</div>
                    <div style={{ fontSize: 13, color: "#D6E4F2", lineHeight: 1.5 }}>{b.analyse}</div>
                  </div>

                  <div style={{ background: `${couleurTon}14`, border: `1px solid ${couleurTon}33`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: couleurTon, marginBottom: 4 }}>🎯 Mon conseil du jour</div>
                    <div style={{ fontSize: 13, color: "#E4EEF8", lineHeight: 1.5 }}>{b.conseil}</div>
                  </div>

                  {/* Souvenir : Hector se souvient (prioritaire car plus rare et plus fort) */}
                  {souvenirHector && (
                    <div style={{ marginTop: 14, fontSize: 13, color: "#C9B8E0", lineHeight: 1.6, fontStyle: "italic", paddingLeft: 12, borderLeft: "2px solid rgba(150,120,200,0.4)" }}>
                      {souvenirHector}
                    </div>
                  )}
                  {/* Conseil PPa : rare et utile, prioritaire sur la pensée du jour mais sous le souvenir */}
                  {!souvenirHector && penseePPa && (
                    <div style={{ marginTop: 14, fontSize: 13, color: "#9FB8CE", lineHeight: 1.6, fontStyle: "italic", paddingLeft: 12, borderLeft: "2px solid rgba(55,138,221,0.45)" }}>
                      {penseePPa}
                      <a
                        href="https://www.caf.fr"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { try { safeStorage.setItem("hectorPPaVue", new Date().toISOString()); } catch {} }}
                        style={{ display: "inline-block", marginTop: 6, color: "#378ADD", fontStyle: "normal", fontWeight: 600, textDecoration: "none" }}
                      >
                        Faire la simulation sur caf.fr →
                      </a>
                    </div>
                  )}
                  {/* Pensée du jour : seulement si pas de souvenir ni de conseil PPa (on ne surcharge pas) */}
                  {!souvenirHector && !penseePPa && penseeHector && (
                    <div style={{ marginTop: 14, fontSize: 13, color: "#9FB8CE", lineHeight: 1.6, fontStyle: "italic", paddingLeft: 12, borderLeft: "2px solid rgba(255,255,255,0.15)" }}>
                      {penseeHector}
                    </div>
                  )}

                  {streakCount > 0 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🔥</span>
                      <span style={{ fontSize: 13, color: "#FAC775", fontWeight: 700 }}>{streakCount} jour{streakCount > 1 ? "s" : ""} avec Hector</span>
                      {palierStreakActuel && <span style={{ fontSize: 12, color: "#8BA5C0" }}>· {palierStreakActuel.emoji} {palierStreakActuel.titre}</span>}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── RANGÉE 2 COLONNES : Disponible + Checklist ── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
            {/* ── OBJECTIF : DISPONIBLE + JAUGE RÉSERVE (style cockpit) ── */}
            <div style={{ background: "#0a1322", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
              {argentDisponibleBrut !== null ? (() => {
                const reserveConstituee = reserveAtteinte ? securiteNum : Math.max(0, securiteNum - manqueReserveDashboard);
                const reservePct = securiteNum > 0 ? Math.min(100, Math.round((reserveConstituee / securiteNum) * 100)) : 0;
                return (
                  <>
                    <div style={{ fontSize: 12.5, color: "#8BA5C0", marginBottom: 4 }}>Disponible aujourd'hui</div>
                    <div style={{ fontSize: 42, fontWeight: 800, color: argentDisponibleBrut >= 0 ? "#5DCAA5" : "#F09595", lineHeight: 1, letterSpacing: -1 }}>
                      {argentDisponibleBrut < 0 ? "−" : ""}{formatEUR(Math.abs(argentDisponibleBrut))}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#5A7798", marginTop: 6, marginBottom: 16 }}>une fois l'URSSAF et ta réserve mises de côté</div>
                    {securiteNum > 0 && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 11, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Réserve de sécurité</span>
                          <span style={{ fontSize: 13, color: "#5DCAA5", fontWeight: 800 }}>{reservePct}%</span>
                        </div>
                        <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${reservePct}%`, background: "#5DCAA5", borderRadius: 6, transition: "width 0.7s cubic-bezier(.4,1.4,.6,1)" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#6B8299", marginTop: 6 }}>
                          <span>{formatEUR(reserveConstituee)} constitués</span>
                          <span>Objectif · {formatEUR(securiteNum)}</span>
                        </div>
                      </>
                    )}
                  </>
                );
              })() : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <i className="ti ti-wallet" aria-hidden="true" style={{ fontSize: 20, color: "#7FB8F0", flexShrink: 0 }} />
                    <div style={{ fontSize: 13.5, color: "#B5D4F4", lineHeight: 1.5 }}>Renseigne ton solde bancaire pour voir ton disponible et ta réserve de sécurité.</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#6B8299", whiteSpace: "nowrap" }}>💳 Solde bancaire</span>
                    <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 220 }}>
                      <input
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "10px 30px 10px 12px", fontSize: 15, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        type="number" step="0.01" inputMode="text"
                        placeholder="Ex : 3 500"
                        value={panique.solde}
                        onChange={e => { setPanique({ ...panique, solde: e.target.value }); safeStorage.setItem("soldeUpdatedAt", new Date().toISOString()); }}
                      />
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#5DCAA5", fontWeight: 700 }}>€</span>
                    </div>
                    {soldeSaveStatus === "saving" && <span style={{ fontSize: 11, color: "#8BA5C0" }}>⏳</span>}
                    {soldeSaveStatus === "saved" && <span style={{ fontSize: 11, color: "#5DCAA5" }}>✓</span>}
                  </div>
                </div>
              )}
            </div>

            {/* ── TA PROCHAINE ACTION (style cockpit) ── */}
            {(() => {
              if (panique.solde === "") return null;
              const action = incomeList.length === 0
                ? { txt: "Ajoute ton premier revenu", sub: "Hector mettra l'URSSAF de côté automatiquement", icon: "ti-plus", nav: "revenus" }
                : reserveAtteinte === false
                ? { txt: "Renforce ta réserve de sécurité", sub: `Il te manque ${formatEUR(manqueReserveDashboard)}`, icon: "ti-shield-half", nav: "revenus" }
                : { txt: "Tout est à jour, profite", sub: "Hector veille, tu peux souffler", icon: "ti-check", nav: "revenus" };
              return (
                <button type="button" onClick={() => setNav(action.nav)}
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "rgba(55,138,221,0.1)", border: "1px solid rgba(55,138,221,0.3)", borderRadius: 14, padding: "15px 18px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#07192E", border: "1.5px solid rgba(127,184,240,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={`ti ${action.icon}`} aria-hidden="true" style={{ fontSize: 20, color: "#7FB8F0" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#7FB8F0", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Ta prochaine action</div>
                    <div style={{ fontSize: 15, color: "white", fontWeight: 700, marginTop: 2 }}>{action.txt}</div>
                    {action.sub && <div style={{ fontSize: 12, color: "#7E97B3", marginTop: 4 }}>{action.sub}</div>}
                  </div>
                  <i className="ti ti-chevron-right" aria-hidden="true" style={{ fontSize: 18, color: "#7FB8F0", flexShrink: 0 }} />
                </button>
              );
            })()}

            {/* ── CHECKLIST DE SÉRÉNITÉ (style cockpit) ── */}
            {(() => {
              const items = [
                { label: "Solde bancaire renseigné", ok: panique.solde !== "" },
                { label: "Revenus du mois enregistrés", ok: incomeList.length > 0 },
                { label: "URSSAF provisionnée", ok: urssafProvision > 0 },
                { label: "Réserve de sécurité constituée", ok: reserveAtteinte === true },
              ];
              const faits = items.filter(i => i.ok).length;
              return (
                <div style={{ background: "#0a1322", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Ta checklist de sérénité</div>
                    <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 700 }}>{faits} / {items.length}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {items.map(it => (
                      <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 11, opacity: it.ok ? 1 : 0.55 }}>
                        <i className={`ti ${it.ok ? "ti-circle-check-filled" : "ti-circle"}`} aria-hidden="true" style={{ fontSize: 18, color: it.ok ? "#5DCAA5" : "#FAC775", flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13.5, color: it.ok ? "#E8F4FF" : "#B5D4F4" }}>{it.label}</div>
                        <span style={{ fontSize: 11, color: it.ok ? "#5DCAA5" : "#FAC775" }}>{it.ok ? "fait" : "à faire"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            </div>

            {/* ── HERO : HECTOR + MONTANT DISPONIBLE ── */}
            <div style={{ background: "#0a1322", border: `1px solid ${hectorEtat ? hectorEtat.couleur + "33" : "rgba(55,138,221,0.2)"}`, borderRadius: 16, overflow: "hidden", position: "relative" }}>
              {isMobile ? (
                /* MOBILE : layout horizontal Hector + montant */
                <div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
                    {/* Hector mini à droite */}
                    <div style={{ padding: "16px 16px 0", flex: 1 }}>
                      {hectorEtat && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, background: `${hectorEtat.couleur}1F`, border: `1px solid ${hectorEtat.couleur}44`, borderRadius: 999, padding: "3px 10px" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: hectorEtat.pastille, display: "inline-block" }} />
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: hectorEtat.couleur, textTransform: "uppercase" }}>{hectorEtat.label}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "#C2D4E6", lineHeight: 1.5, marginBottom: 14 }}>
                        {argentDisponibleBrut !== null
                          ? (hectorEtat?.mot || "Hector veille sur toi.")
                          : (panique.solde === "" ? "Recopie ton solde ci-dessous pour que je me mette au travail." : "Ajoute un revenu pour voir ton disponible.")}
                      </div>
                    </div>
                    <div style={{ width: 100, flexShrink: 0, position: "relative", overflow: "hidden" }}>
                      <HectorImage etat={hectorEtat} size={120} cover />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, #0a1322 0%, rgba(10,19,34,0) 40%)" }} />
                    </div>
                  </div>
                  {/* Bande solde mobile */}
                  <div style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#6B8299", whiteSpace: "nowrap" }}>💳</span>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${soldePerime ? "#F0C36D" : "rgba(255,255,255,0.12)"}`, borderRadius: 7, padding: "7px 28px 7px 10px", fontSize: 14, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                        type="number" step="0.01" inputMode="text"
                        placeholder="Solde bancaire"
                        value={panique.solde}
                        onChange={e => { setPanique({ ...panique, solde: e.target.value }); safeStorage.setItem("soldeUpdatedAt", new Date().toISOString()); }}
                      />
                      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#5DCAA5", fontWeight: 700 }}>€</span>
                    </div>
                    {soldeSaveStatus === "saving" && <span style={{ fontSize: 10, color: "#8BA5C0" }}>⏳</span>}
                    {soldeSaveStatus === "saved" && <span style={{ fontSize: 10, color: "#5DCAA5" }}>✓</span>}
                    {dateTranquillite && joursTranquillite > 0 && (
                      <span style={{ fontSize: 10, color: hectorEtat?.couleur || "#5DCAA5", fontWeight: 700, whiteSpace: "nowrap" }}>{joursTranquillite}j</span>
                    )}
                  </div>
                </div>
              ) : (
                /* DESKTOP : hero en grille comme la landing — Hector entier, jamais cropé */
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", minHeight: 240, position: "relative", overflow: "hidden" }}>
                    {/* Contenu à gauche */}
                    <div style={{ position: "relative", zIndex: 2, padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      {hectorEtat && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14, background: `${hectorEtat.couleur}1F`, border: `1px solid ${hectorEtat.couleur}44`, borderRadius: 999, padding: "4px 12px", width: "fit-content" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: hectorEtat.pastille, display: "inline-block" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: hectorEtat.couleur, textTransform: "uppercase" }}>{hectorEtat.label}</span>
                          {joursTranquillite > 0 && <span style={{ fontSize: 10, color: hectorEtat.couleur, opacity: 0.7 }}>· {joursTranquillite} jours</span>}
                        </div>
                      )}
                      <div style={{ fontSize: 14, color: "#C2D4E6", lineHeight: 1.6, marginBottom: 6, maxWidth: 420 }}>
                        {argentDisponibleBrut !== null
                          ? (hectorEtat?.mot || "Hector veille sur toi.")
                          : (panique.solde === "" ? "Recopie ton solde ci-dessous et je me mets au travail tout de suite." : "Ajoute un revenu pour voir ton disponible.")}
                      </div>
                    </div>
                    {/* Hector dans sa colonne — entier, jamais cropé, fondu comme la landing */}
                    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                      <img
                        src={hectorEtat?.img || "/hector-tete.png"}
                        alt="Hector"
                        style={{ width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain", objectPosition: "center bottom", display: "block", filter: "brightness(1.1)" }}
                      />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(10,19,34,0) 65%, #0a1322 100%)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,19,34,0) 75%, #0a1322 100%)", pointerEvents: "none" }} />
                    </div>
                  </div>
                  {/* Bande solde */}
                  <div style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                      <span style={{ fontSize: 12, color: "#6B8299", whiteSpace: "nowrap" }}>💳 Solde bancaire</span>
                      <div style={{ position: "relative", flex: 1, maxWidth: 180 }}>
                        <input
                          style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${soldePerime ? "#F0C36D" : "rgba(255,255,255,0.12)"}`, borderRadius: 7, padding: "6px 32px 6px 10px", fontSize: 14, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                          type="number" step="0.01" inputMode="text"
                          placeholder="Ex : 3 500"
                          value={panique.solde}
                          onChange={e => { setPanique({ ...panique, solde: e.target.value }); safeStorage.setItem("soldeUpdatedAt", new Date().toISOString()); }}
                        />
                        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#5DCAA5", fontWeight: 700 }}>€</span>
                      </div>
                      {soldeFraicheur && <span style={{ fontSize: 10, color: soldePerime ? "#FAC775" : "#5DCAA5", whiteSpace: "nowrap" }}>· {soldeFraicheur}</span>}
                      {soldeSaveStatus === "saving" && <span style={{ fontSize: 10, color: "#8BA5C0" }}>⏳</span>}
                      {soldeSaveStatus === "saved" && <span style={{ fontSize: 10, color: "#5DCAA5" }}>✓</span>}
                      {soldePerime && <span style={{ fontSize: 10, color: "#FAC775", background: "rgba(240,195,109,0.1)", border: "1px solid rgba(240,195,109,0.3)", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>⚠️ Solde périmé — remets-le à jour</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      {dateTranquillite && joursTranquillite > 0 && (
                        <div style={{ fontSize: 11, color: "#8BA5C0" }}>
                          <span style={{ color: hectorEtat?.couleur || "#5DCAA5", fontWeight: 700 }}>{joursTranquillite}j</span> de tranquillité · jusqu'au {dateTranquillite}
                        </div>
                      )}
                      {estimateData.periode_courante?.jours_restants <= 30 && (
                        <div style={{ background: "rgba(239,159,39,0.15)", border: "1px solid rgba(239,159,39,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#FAC775", fontWeight: 600 }}>
                          ⏱ Déclaration dans {estimateData.periode_courante.jours_restants}j
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── CONNEXION BANCAIRE (Powens, lecture seule) — accordéon pleine largeur ── */}
            <div style={{ background: "#0a1322", border: "1px solid rgba(55,138,221,0.35)", borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div onClick={() => setBankCardOpen(o => !o)} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: bankCardOpen ? 10 : 0, flexWrap: "wrap", cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(55,138,221,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="ti ti-building-bank" aria-hidden="true" style={{ fontSize: 19, color: "#5DA9F0" }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>Connexion bancaire</div>
                {bankConnected
                  ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#5DCAA5", background: "rgba(93,202,165,0.15)", border: "1px solid rgba(93,202,165,0.4)", borderRadius: 999, padding: "3px 10px" }}>Connectée</span>
                  : BANK_BIENTOT
                    ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#FAC775", background: "rgba(250,199,117,0.15)", border: "1px solid rgba(250,199,117,0.45)", borderRadius: 999, padding: "3px 10px" }}>Bientôt</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#9FD0FF", background: "rgba(55,138,221,0.2)", border: "1px solid rgba(55,138,221,0.45)", borderRadius: 999, padding: "3px 10px" }}>Optionnel</span>}
                <i className={`ti ti-chevron-${bankCardOpen ? "up" : "down"}`} aria-hidden="true" style={{ fontSize: 18, color: "#6B8299", marginLeft: "auto" }} />
              </div>

              {bankCardOpen && (<>
              {bankSyncing ? (
                <p style={{ fontSize: 13.5, color: "#DCE8F5", lineHeight: 1.6, margin: 0 }}>
                  🔄 Synchronisation de ta banque en cours…
                </p>
              ) : bankConnected ? (
                <>
                  <p style={{ fontSize: 13.5, color: "#DCE8F5", lineHeight: 1.6, margin: "0 0 6px" }}>
                    Ta banque est reliée : ton solde se met à jour tout seul, en lecture seule.
                    {bankSolde != null && <> Dernier solde lu : <strong style={{ color: "#FFFFFF" }}>{formatEUR(bankSolde)}</strong>.</>}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button type="button" onClick={loadBankStatus} disabled={bankLoading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(55,138,221,0.15)", border: "1px solid rgba(55,138,221,0.4)", color: "#9FD0FF", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: bankLoading ? "default" : "pointer", fontFamily: "inherit", opacity: bankLoading ? 0.6 : 1 }}>
                      <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize: 15 }} /> Rafraîchir le solde
                    </button>
                    <button type="button" onClick={handleBankDisconnect} disabled={bankLoading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#8BA5C0", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: bankLoading ? "default" : "pointer", fontFamily: "inherit", opacity: bankLoading ? 0.6 : 1 }}>
                      <i className="ti ti-unlink" aria-hidden="true" style={{ fontSize: 15 }} /> Débrancher
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13.5, color: "#DCE8F5", lineHeight: 1.6, margin: "0 0 14px" }}>
                    {BANK_BIENTOT
                      ? <>Bientôt, tu pourras <strong style={{ color: "#FFFFFF" }}>relier ton compte</strong> pour que ton solde se mette à jour tout seul. On finalise la mise en service avec notre partenaire bancaire — en attendant, continue en <strong style={{ color: "#FFFFFF" }}>saisie manuelle</strong>.</>
                      : <>Relie ton compte pour que ton solde se mette à jour <strong style={{ color: "#FFFFFF" }}>tout seul</strong> — fini de le recopier à la main. C'est <strong style={{ color: "#FFFFFF" }}>toi qui choisis</strong> : tu peux aussi continuer en saisie manuelle.</>}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: 16, color: "#5DCAA5", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: "#C2D4E6", lineHeight: 1.5 }}><strong style={{ color: "#FFFFFF" }}>Lecture seule.</strong> H€CTOR lit ton solde, jamais bouger ton argent (règle européenne DSP2).</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <i className="ti ti-shield-lock" aria-hidden="true" style={{ fontSize: 16, color: "#5DCAA5", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: "#C2D4E6", lineHeight: 1.5 }}><strong style={{ color: "#FFFFFF" }}>Partenaire agréé.</strong> La connexion passe par Powens, agréé par la Banque de France. Tes identifiants ne transitent jamais par H€CTOR.</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <i className="ti ti-hand-stop" aria-hidden="true" style={{ fontSize: 16, color: "#5DCAA5", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 12.5, color: "#C2D4E6", lineHeight: 1.5 }}><strong style={{ color: "#FFFFFF" }}>Débranchable quand tu veux.</strong></span>
                    </div>
                  </div>
                  {BANK_BIENTOT ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(250,199,117,0.12)", border: "1px solid rgba(250,199,117,0.4)", color: "#FAC775", borderRadius: 9, padding: "11px 20px", fontSize: 14, fontWeight: 700 }}>
                      <i className="ti ti-clock" aria-hidden="true" style={{ fontSize: 16 }} /> Bientôt disponible
                    </div>
                  ) : (
                    <button type="button" onClick={handleBankConnect} disabled={bankLoading}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#378ADD", border: "none", color: "#FFFFFF", borderRadius: 9, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: bankLoading ? "default" : "pointer", fontFamily: "inherit", opacity: bankLoading ? 0.7 : 1 }}>
                      <i className="ti ti-link" aria-hidden="true" style={{ fontSize: 16 }} />
                      {bankLoading ? "Ouverture…" : "Connecter ma banque"}
                    </button>
                  )}
                </>
              )}
              </>)}
            </div>

            {/* ── MESSAGES HECTOR ── */}
            {hectorMessages.map(msg => (
              <div key={msg.id} style={{ background: "#0a1322", border: `1px solid ${msg.couleur}44`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, position: "relative", animation: "fadeInDown 0.3s ease" }}>
                <HectorTete size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "white", lineHeight: 1.5 }}>{msg.text}</div>
                  <div style={{ marginTop: 6, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: msg.couleur, width: "100%", animation: "shrink 7s linear forwards" }} />
                  </div>
                </div>
                <button onClick={() => setHectorMessages(prev => prev.filter(m => m.id !== msg.id))} style={{ background: "none", border: "none", color: "#4A6280", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
            ))}

            {/* ── HECTOR UNIFIÉ : écrire librement OU décision rapide ── */}
            <div style={{ background: "linear-gradient(135deg, #0a1322 0%, #10233f 100%)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(93,202,165,0.4)", flexShrink: 0 }}>
                  <img src="/hector-tete.png" alt="Hector" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Parle à Hector</div>
                  <div style={{ fontSize: 12, color: "#8BA5C0" }}>Pose ta question, ou vérifie un achat / un versement. Il répond avec tes vrais chiffres.</div>
                </div>
              </div>

              {/* Champ texte libre → assistant IA */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "white", outline: "none", fontFamily: "inherit" }}
                  placeholder={isMobile ? "Pose ta question..." : "Ex : je peux m'acheter un Mac à 2 000 € ce mois ?"}
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && aiInput.trim()) { setNav("assistant"); } }}
                />
                {speechSupported && (
                  <button
                    onClick={() => { if (!isListening) { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const r = new SR(); r.lang = "fr-FR"; r.onresult = ev => setAiInput(ev.results[0][0].transcript); r.onend = () => setIsListening(false); r.start(); setIsListening(true); } else setIsListening(false); }}
                    style={{ width: 44, height: 44, background: isListening ? "#E0533D" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 10, color: isListening ? "white" : "#8BA5C0", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isListening ? "⏹" : "🎤"}
                  </button>
                )}
                <button
                  onClick={() => { if (aiInput.trim()) setNav("assistant"); }}
                  style={{ width: 44, height: 44, background: "#5DCAA5", border: "none", borderRadius: 10, color: "#07192E", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                  →
                </button>
              </div>

              {/* Décision rapide instantanée (moteur local, zéro attente) */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: "#6B8299", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>⚡ Vérification rapide</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {[{ id: "achat", label: "🛒 Puis-je acheter ?" }, { id: "versement", label: "💸 Puis-je me verser ?" }].map(opt => (
                    <button key={opt.id} onClick={() => { setParlerType(opt.id); setParlerVerdict(null); }}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${parlerType === opt.id ? "#5DCAA5" : "rgba(255,255,255,0.15)"}`, background: parlerType === opt.id ? "rgba(93,202,165,0.12)" : "transparent", color: parlerType === opt.id ? "#5DCAA5" : "#8BA5C0" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "11px 32px 11px 14px", fontSize: 16, fontWeight: 700, color: "white", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      type="number" inputMode="decimal" placeholder={parlerType === "versement" ? "Montant à te verser" : "Prix de l'achat"}
                      value={parlerMontant}
                      onChange={e => { setParlerMontant(e.target.value); setParlerVerdict(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { setParlerVerdict(verdictHector(parlerMontant, parlerType)); setParlerPourquoi(false); } }}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#5DCAA5", fontWeight: 700 }}>€</span>
                  </div>
                  <button onClick={() => { setParlerVerdict(verdictHector(parlerMontant, parlerType)); setParlerPourquoi(false); }}
                    style={{ background: "rgba(93,202,165,0.15)", color: "#5DCAA5", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 10, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Vérifier
                  </button>
                </div>

                {/* Verdict */}
                {parlerVerdict && (() => {
                  const v = parlerVerdict;
                  const coul = v.verdict === "vert" ? "#5DCAA5" : v.verdict === "orange" ? "#EF9F27" : v.verdict === "rouge" ? "#E24B4A" : "#8BA5C0";
                  const emoji = v.verdict === "vert" ? "🟢" : v.verdict === "orange" ? "🟠" : v.verdict === "rouge" ? "🔴" : "🐾";
                  return (
                    <div style={{ marginTop: 12, background: `${coul}12`, border: `1px solid ${coul}44`, borderRadius: 12, padding: "16px 18px", animation: "fadeInDown 0.3s ease" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{emoji}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: coul }}>{v.titre}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#E4EEF8", lineHeight: 1.6 }}>{v.message}</div>

                      {v.details && (
                        <>
                          <button onClick={() => setParlerPourquoi(!parlerPourquoi)}
                            style={{ marginTop: 12, background: "none", border: "none", color: coul, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                            {parlerPourquoi ? "Masquer le détail" : "Pourquoi ? Voir mon raisonnement"} {parlerPourquoi ? "▲" : "▼"}
                          </button>
                          {parlerPourquoi && (
                            <div style={{ marginTop: 12, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "14px 16px", fontSize: 12, color: "#B5D4F4", lineHeight: 1.8 }}>
                              <div style={{ fontWeight: 700, color: "white", marginBottom: 8 }}>🐾 Voici exactement comment j'ai calculé :</div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Régime utilisé</span><span style={{ color: "white" }}>{v.details.regimeLabel}</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Taux cotisations URSSAF</span><span style={{ color: "white" }}>{(v.details.tauxCotisations * 100).toFixed(1)} %</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Abattement fiscal</span><span style={{ color: "white" }}>{(v.details.abattementFiscal * 100).toFixed(0)} %</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Seuil TVA</span><span style={{ color: "white" }}>{formatEUR(v.details.seuilTVA)}</span></div>
                              <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Disponible avant</span><span style={{ color: "white" }}>{formatEUR(v.details.dispoAvant)}</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{v.details.type === "versement" ? "Versement" : "Achat"}</span><span style={{ color: coul }}>−{formatEUR(v.details.montant)}</span></div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Disponible après</span><span style={{ color: "white" }}>{formatEUR(v.details.dispoApres)}</span></div>
                              <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
                              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Réserve de sécurité</span><span style={{ color: "white" }}>{formatEUR(v.details.reserve)} {v.details.reserveApres ? "✓ préservée" : "⚠️ entamée"}</span></div>
                              {v.details.joursAvant !== null && v.details.joursApres !== null && (
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Jours de tranquillité</span><span style={{ color: "white" }}>{v.details.joursAvant} j → {v.details.joursApres} j</span></div>
                              )}
                              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#6B8299", fontStyle: "italic" }}>
                                Estimation régime micro-entrepreneur (règles {v.details.version}). Ne remplace pas un expert-comptable. ACRE, activité mixte ou dépassement de seuil peuvent modifier ces montants — à vérifier selon ton cas exact.
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── SÉRÉNITÉ D'HECTOR — visible pour tous ── */}
            {hectorEtat && (
              <div style={{ background: "#0a1322", border: `1px solid ${hectorEtat.accueil ? "rgba(55,138,221,0.2)" : hectorEtat.couleur + "22"}`, borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 2 }}>🐾 Le foyer d'Hector grandit avec toi</div>
                    <div style={{ fontSize: 11, color: "#6B8299" }}>
                      {hectorEtat.accueil
                        ? "Chaque jour où ta trésorerie est saine, Hector avance vers son domaine."
                        : dateTranquillite && joursTranquillite > 0
                          ? `Jusqu'au ${dateTranquillite} · ${hectorEtat.mot}`
                          : hectorEtat.mot}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: hectorEtat.accueil ? "#4A6280" : hectorEtat.couleur, lineHeight: 1 }}>
                      {hectorEtat.accueil ? "—" : joursTranquillite}
                    </div>
                    <div style={{ fontSize: 10, color: "#6B8299" }}>jours de tranquillité</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "0 4px" }}>
                  {PALIERS_SERENITE.map((p, i) => {
                    const acquis = !hectorEtat.accueil && i <= palierAcquisIndex;
                    const iciMaintenant = !hectorEtat.accueil && i === palierActuelIndex;
                    const ligneAcquise = !hectorEtat.accueil && i < palierAcquisIndex;
                    return (
                      <div key={p.seuil} style={{ flex: 1, textAlign: "center", position: "relative", minWidth: 0 }}>
                        {i < PALIERS_SERENITE.length - 1 && (
                          <div style={{ position: "absolute", top: isMobile ? 20 : 28, left: "50%", width: "100%", height: 2, background: ligneAcquise ? "#5DCAA5" : "rgba(255,255,255,0.06)", zIndex: 0 }} />
                        )}
                        <div style={{ position: "relative", zIndex: 1, width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, borderRadius: "50%", margin: "0 auto 6px", overflow: "hidden", background: "#16314E",
                          border: iciMaintenant ? `2px solid ${hectorEtat.couleur}` : (acquis ? "2px solid #5DCAA5" : "2px solid rgba(255,255,255,0.1)"),
                          opacity: (acquis || iciMaintenant) ? 1 : 0.35,
                          boxShadow: iciMaintenant ? `0 0 0 4px ${hectorEtat.couleur}30` : "none" }}>
                          <NiveauImage src={p.img} fallbackIcon={acquis ? "ti-check" : "ti-lock"} fallbackColor={acquis ? "#5DCAA5" : "#6B86A3"} />
                        </div>
                        <div style={{ fontSize: isMobile ? 8.5 : 10, fontWeight: 600, color: (acquis || iciMaintenant) ? "white" : "#3A5170", lineHeight: 1.2 }}>{p.nom}</div>
                        <div style={{ fontSize: 8.5, color: iciMaintenant ? hectorEtat.couleur : (acquis ? "#9FE1CB" : "#2A4060") }}>
                          {iciMaintenant ? "tu es ici" : (acquis ? "✓ atteint" : p.court)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hectorEtat.accueil && (
                  <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(55,138,221,0.08)", borderRadius: 8, fontSize: 11.5, color: "#8BA5C0", lineHeight: 1.5 }}>
                    💡 Commence par renseigner ton <strong style={{ color: "#B5D4F4" }}>train de vie mensuel</strong> dans ton profil, puis ajoute tes revenus. Hector calculera combien de jours il peut veiller sur toi.
                  </div>
                )}
              </div>
            )}

            {/* ── AVIS PREMIÈRE CONNEXION ── */}
            {hectorEtat?.accueil && (
              <div style={{ background: "#0a1322", border: "1px solid rgba(93,202,165,0.2)", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 8 }}>
                  {panique.solde !== "" ? "✓ Solde enregistré — plus qu'une étape !" : "Commençons par le commencement 🐾"}
                </div>
                <div style={{ fontSize: 12, color: "#8BA5C0", lineHeight: 1.6, marginBottom: 14 }}>
                  {panique.solde !== ""
                    ? "Ajoute maintenant ton premier revenu encaissé. H€CTOR calculera automatiquement l'URSSAF à mettre de côté et te dira ce que tu peux vraiment dépenser."
                    : "1. Renseigne ton solde bancaire dans la carte en haut — ouvre ton appli de banque, lis le chiffre, recopie-le. 10 secondes.\n2. Ajoute tes revenus encaissés.\nH€CTOR s'occupe du reste."}
                </div>
                <button style={{ background: "#5DCAA5", color: "#07192E", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  onClick={() => setNav("revenus")}>
                  + Ajouter mon premier revenu
                </button>
              </div>
            )}

            {/* ── TRAIN DE VIE ── */}
            {trainDeVieNum > 0 && (
              <div style={{ background: "rgba(55,138,221,0.05)", border: "1px solid rgba(55,138,221,0.15)", borderRadius: 12, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8BA5C0" }}>Train de vie mensuel</div>
                  <div style={{ fontSize: 10, color: "#4A6280", marginTop: 2 }}>Tes dépenses perso estimées par mois</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{formatEUR(trainDeVieNum)}</div>
                  {joursTranquillite !== null && trainDeVieNum > 0 && (
                    <div style={{ fontSize: 10, color: "#6B8299" }}>
                      {Math.floor(argentDisponibleBrut / (trainDeVieNum / 30))} jours couverts
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 3 CARTES SECONDAIRES ── */}
            {argentDisponibleBrut !== null && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                {/* Que faire maintenant */}
                <div style={{ background: "#0d2440", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5DCAA5", marginBottom: 6 }}>⚡ Que faire maintenant ?</div>
                  {niveauFinancier === "vert" ? (
                    <>
                      <div style={{ fontSize: 11, color: "#8BA5C0", marginBottom: 8 }}>Tu peux te verser en toute sécurité</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#5DCAA5", marginBottom: 2 }}>{formatEUR(Math.max(0, argentDisponibleBrut * 0.7))}</div>
                      <div style={{ fontSize: 10, color: "#6B8299", marginBottom: 8 }}>estimation prudentielle (70% du disponible)</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button onClick={() => setNav("salaire")} style={{ background: "none", border: "none", color: ACCENT, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>💸 Calculer mon salaire →</button>
                        <button onClick={() => setNav("achat")} style={{ background: "none", border: "none", color: "#8BA5C0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>🛒 Simuler un achat →</button>
                      </div>
                    </>
                  ) : niveauFinancier === "orange" ? (
                    <>
                      <div style={{ fontSize: 11, color: "#FAC775", marginBottom: 8 }}>Ta réserve de sécurité n'est pas encore atteinte</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#FAC775", marginBottom: 2 }}>{formatEUR(manqueReserveDashboard)}</div>
                      <div style={{ fontSize: 10, color: "#6B8299", marginBottom: 8 }}>manquants pour atteindre ta réserve</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button onClick={() => setNav("achat")} style={{ background: "none", border: "none", color: ACCENT, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>Analyser la situation →</button>
                        <button onClick={() => { setAiInput("Ma réserve de sécurité n'est pas encore atteinte. Que faire ?"); setNav("assistant"); }} style={{ background: "none", border: "none", color: "#8BA5C0", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>Demander à Hector →</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: "#F09595", marginBottom: 8 }}>Tes charges dépassent ton solde</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#F09595", marginBottom: 2 }}>−{formatEUR(Math.abs(argentDisponibleBrut))}</div>
                      <div style={{ fontSize: 10, color: "#6B8299", marginBottom: 8 }}>de déficit actuellement</div>
                      <button onClick={() => { setAiInput("Ma trésorerie est dans le rouge. Qu'est-ce que je peux faire concrètement ?"); setNav("assistant"); }}
                        style={{ background: "none", border: "none", color: "#F09595", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>En parler à Hector →</button>
                    </>
                  )}
                </div>

                {/* Seuil annuel */}
                <div style={{ background: "#0d2440", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Plafond auto-entrepreneur</div>
                  <div style={{ fontSize: 11, color: "#8BA5C0", marginBottom: 8 }}>
                    {formatEUR(estimateData.ca_annuel || 0)} encaissés sur {formatEUR(estimateData.plafond || 77700)} max
                  </div>
                  <div style={{ height: 4, background: "#1e3a5f", borderRadius: 999, marginBottom: 10 }}>
                    <div style={{ height: "100%", background: ACCENT, borderRadius: 999, width: `${Math.min(100, Math.round(((estimateData.ca_annuel || 0) / (estimateData.plafond || 77700)) * 100))}%`, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{formatEUR(Math.max(0, (estimateData.plafond || 77700) - (estimateData.ca_annuel || 0)))}</div>
                  <div style={{ fontSize: 10, color: "#6B8299", marginBottom: 8 }}>encore encaissables avant le plafond</div>
                  <button onClick={() => setNav("simulateur")} style={{ background: "none", border: "none", color: ACCENT, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>Voir le simulateur fiscal →</button>
                </div>

                {/* Réserve de sécurité */}
                <div style={{ background: "#0d2440", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#FAC775", marginBottom: 6 }}>🛡️ Réserve de sécurité</div>
                  <div style={{ fontSize: 11, color: "#8BA5C0", marginBottom: 8 }}>
                    {reserveAtteinte
                      ? "Objectif atteint — tu es bien protégé"
                      : "Objectif pas encore atteint"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: reserveAtteinte ? "#5DCAA5" : "#FAC775", marginBottom: 2 }}>{formatEUR(securiteNum)}</div>
                  <div style={{ fontSize: 10, color: reserveAtteinte ? "#5DCAA5" : "#FAC775", marginBottom: 8 }}>
                    {reserveAtteinte ? "✓ Réserve constituée" : `Il manque ${formatEUR(manqueReserveDashboard)} pour l'atteindre`}
                  </div>
                  <button onClick={() => setNav("profil")} style={{ background: "none", border: "none", color: ACCENT, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textAlign: "left" }}>Modifier l'objectif →</button>
                </div>
              </div>
            )}

          </div>
        )}



        {nav === "echeances" && (() => {
          const today = new Date();
          const joursEntre = (d) => Math.round((d - today) / 86400000);

          const echeances = [];

          // URSSAF — dynamique, basé sur estimateData
          if (estimateData && estimateData.disponible !== false && estimateData.periode_courante) {
            const jUrssaf = estimateData.periode_courante.jours_restants;
            echeances.push({
              id: "urssaf",
              label: "Déclaration URSSAF",
              montant: estimateData.montant_a_provisionner || 0,
              estime: false,
              dateLabel: formatDate(estimateData.periode_courante.date_limite_declaration),
              jours: jUrssaf,
            });
          }

          // CFE — date fixe (15 décembre), montant = ce que l'utilisateur a renseigné
          let dateCfe = new Date(today.getFullYear(), 11, 15);
          if (dateCfe < today) dateCfe = new Date(today.getFullYear() + 1, 11, 15);
          echeances.push({
            id: "cfe",
            label: "CFE",
            montant: parseFloat(panique.cfe) || 0,
            estime: !panique.cfe || parseFloat(panique.cfe) === 0,
            dateLabel: formatDate(dateCfe),
            jours: joursEntre(dateCfe),
          });

          // Impôts — date fixe (15 mai), uniquement si pas de versement libératoire
          if (!profile?.versement_liberatoire) {
            let dateImpots = new Date(today.getFullYear(), 4, 15);
            if (dateImpots < today) dateImpots = new Date(today.getFullYear() + 1, 4, 15);
            echeances.push({
              id: "impots",
              label: "Déclaration de revenus",
              montant: impotsAnnuelEstime || 0,
              estime: true,
              dateLabel: formatDate(dateImpots),
              jours: joursEntre(dateImpots),
            });
          }

          echeances.sort((a, b) => a.jours - b.jours);

          function statutEcheance(j) {
            if (j < 0) return { color: "#A32D2D", bg: "#FCEBEB", border: "#E24B4A", label: `En retard de ${Math.abs(j)} jour${Math.abs(j) > 1 ? "s" : ""}` };
            if (j <= 30) return { color: "#854F0B", bg: "#FAEEDA", border: "#EF9F27", label: `Dans ${j} jour${j > 1 ? "s" : ""}` };
            return { color: "#0F6E56", bg: "#E1F5EE", border: "#1D9E75", label: `Dans ${j} jours` };
          }

          const totalProche = echeances.filter(e => e.jours <= 30).reduce((s, e) => s + e.montant, 0);

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>📅 Échéances</h1><p style={S.pageSub}>Ce que vous devez, et avant quand</p></div>
              </div>

              {echeances.length === 0 ? (
                <div style={S.card}><p style={S.empty}>Renseignez votre profil pour voir vos échéances.</p></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {echeances.map(e => {
                    const st = statutEcheance(e.jours);
                    return (
                      <div key={e.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>{e.label}</div>
                          <div style={{ fontSize: 13, color: st.color, marginTop: 2 }}>{st.label}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 600, color: INK }}>{e.estime ? "~ " : ""}{formatEUR(e.montant)}</div>
                          <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 2 }}>échéance {e.dateLabel}</div>
                        </div>
                        <button
                          style={{ ...S.btnPrimarySmall, flexShrink: 0, ...(e.jours < 0 ? { background: "#A32D2D" } : {}) }}
                          onClick={() => setNav("declaration")}
                        >
                          {e.id === "urssaf" ? "Préparer" : "Comprendre"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {echeances.length > 0 && (
                <div style={{ marginTop: 14, padding: "14px 18px", background: "#F7F9F5", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="ti ti-info-circle" aria-hidden="true" style={{ fontSize: 18, color: "#6B7A8D", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#5B6573" }}>Total à provisionner sur les 30 prochains jours : <strong style={{ color: INK }}>{formatEUR(totalProche)}</strong></span>
                </div>
              )}

              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
                Les dates CFE et impôts sont des estimations basées sur les échéances habituelles — vérifiez toujours sur le site officiel.
              </p>
            </div>
          );
        })()}

        {/* État vide commun : ces 3 pages ont besoin de revenus déclarés pour s'afficher.
            Sans données, on affiche une invite au lieu d'une page blanche. */}
        {["declaration", "simvie", "simulateur"].includes(nav) && (!estimateData || estimateData.disponible === false) && (
          <div>
            <div style={{ ...S.card, textAlign: "center", padding: "40px 28px", maxWidth: 480, margin: "40px auto 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
              <h2 style={{ fontSize: 19, color: "#0A2540", fontWeight: 700, marginBottom: 8 }}>Il me faut d'abord un revenu</h2>
              <p style={{ fontSize: 14, color: "#6B7A8D", lineHeight: 1.55, marginBottom: 22 }}>
                Pour préparer ça, j'ai besoin que tu enregistres au moins une rentrée d'argent. Dès que c'est fait, je calcule tout automatiquement et cette page se remplit toute seule.
              </p>
              <button style={{ ...S.btnPrimary, maxWidth: 260, margin: "0 auto" }} onClick={() => setNav("revenus")}>
                Ajouter un revenu
              </button>
            </div>
          </div>
        )}

        {nav === "declaration" && estimateData && estimateData.disponible !== false && (() => {
          const periodeAffichee = declarationPeriode || estimateData.periode_courante?.label || "";
          const caAffiche = declarationCa !== "" ? parseFloat(declarationCa) || 0 : estimateData.ca_periode_courante;
          const cotisationsAffichees = declarationCotisations !== ""
            ? parseFloat(declarationCotisations) || 0
            : declarationCa !== ""
              ? Math.round((parseFloat(declarationCa) || 0) * ((estimateData.taux_global_pct || 0) / 100) * 100) / 100
              : estimateData.montant_a_provisionner;
          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>📋 Préparer ma déclaration</h1><p style={S.pageSub}>Tout est pré-rempli, modifiez si besoin</p></div>
                <button style={S.btnSecondary} onClick={() => setNav("revenus")}>Voir mes revenus</button>
              </div>

              <div style={{ ...S.card, textAlign: "center", padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Période de déclaration</div>
                <input style={{ ...S.input, textAlign: "center", fontWeight: 600 }} type="text" placeholder={estimateData.periode_courante?.label} value={declarationPeriode} onChange={e => setDeclarationPeriode(e.target.value)} />
                <div style={{ fontSize: 13, color: "#854F0B", marginTop: 8 }}>à déclarer avant le {formatDate(estimateData.periode_courante?.date_limite_declaration)} ({estimateData.periode_courante?.jours_restants}j restants)</div>
              </div>

              <div style={{ ...S.card, marginTop: 14 }}>
                {/* CA à déclarer */}
                <div style={{ padding: "14px 0", borderBottom: "1px solid #EEF2F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#6B7A8D" }}>📊 CA à déclarer</span>
                    {!editingDeclarationCa && <span style={{ fontSize: 11, color: "#8BA5C0" }}>Clique sur le montant pour modifier</span>}
                  </div>
                  {editingDeclarationCa ? (
                    <input
                      style={{ ...S.input, fontSize: 28, fontWeight: 800, textAlign: "center" }}
                      type="number" step="0.01" autoFocus
                      value={declarationCa !== "" ? declarationCa : String(estimateData.ca_periode_courante)}
                      onChange={e => setDeclarationCa(e.target.value)}
                      onBlur={() => setEditingDeclarationCa(false)}
                    />
                  ) : (
                    <div
                      onClick={() => setEditingDeclarationCa(true)}
                      style={{ fontSize: 32, fontWeight: 800, color: "#0A2540", textAlign: "center", padding: "8px 0", cursor: "pointer", borderRadius: 8, transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >{formatEUR(caAffiche)}</div>
                  )}
                </div>

                {/* Cotisations */}
                <div style={{ padding: "14px 0", borderBottom: "1px solid #EEF2F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: "#6B7A8D" }}>💰 Cotisations estimées <span style={{ fontSize: 11, color: "#8BA5C0" }}>({estimateData.taux_global_pct}%)</span></span>
                    {!editingDeclarationCotisations && <span style={{ fontSize: 11, color: "#8BA5C0" }}>Clique sur le montant pour modifier</span>}
                  </div>
                  {editingDeclarationCotisations ? (
                    <input
                      style={{ ...S.input, fontSize: 28, fontWeight: 800, textAlign: "center" }}
                      type="number" step="0.01" autoFocus
                      value={declarationCotisations !== "" ? declarationCotisations : String(cotisationsAffichees)}
                      onChange={e => setDeclarationCotisations(e.target.value)}
                      onBlur={() => setEditingDeclarationCotisations(false)}
                    />
                  ) : (
                    <div
                      onClick={() => setEditingDeclarationCotisations(true)}
                      style={{ fontSize: 32, fontWeight: 800, color: "#854F0B", textAlign: "center", padding: "8px 0", cursor: "pointer", borderRadius: 8, transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >{formatEUR(cotisationsAffichees)}</div>
                  )}
                </div>

                {/* Activité */}
                <div style={{ padding: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7A8D" }}>🏷️ Activité / statut</span>
                  <span style={{ fontSize: 12, color: "#0A2540", fontWeight: 600 }}>{ACTIVITES.find(a => a.id === profile?.activite)?.label || "—"} · Auto-entrepreneur</span>
                </div>

                {(declarationCa !== "" || declarationCotisations !== "" || declarationPeriode !== "") && (
                  <button style={{ ...S.linkBtn, marginTop: 4 }} onClick={() => { setDeclarationCa(""); setDeclarationCotisations(""); setDeclarationPeriode(""); }}>↺ Revenir aux valeurs calculées par H€CTOR</button>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button
                  style={{ ...S.btnSecondary, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(String(caAffiche));
                    setCaCopie(true);
                    setTimeout(() => setCaCopie(false), 2000);
                  }}
                >
                  <i className={`ti ${caCopie ? "ti-check" : "ti-copy"}`} aria-hidden="true" style={{ fontSize: 16 }} />
                  {caCopie ? "CA copié !" : "Copier le CA"}
                </button>
                <button
                  style={{ ...S.btnSecondary, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(String(cotisationsAffichees));
                    setMontantCopie(true);
                    setTimeout(() => setMontantCopie(false), 2000);
                  }}
                >
                  <i className={`ti ${montantCopie ? "ti-check" : "ti-copy"}`} aria-hidden="true" style={{ fontSize: 16 }} />
                  {montantCopie ? "Cotisations copiées !" : "Copier les cotisations"}
                </button>
                <a
                  href="https://www.autoentrepreneur.urssaf.fr"
                  target="_blank" rel="noopener noreferrer"
                  style={{ ...S.btnPrimarySmall, flex: "1 1 140px", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
                >
                  <i className="ti ti-external-link" aria-hidden="true" style={{ fontSize: 16 }} />
                  Ouvrir URSSAF
                </a>
              </div>

              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
                H€CTOR prépare les montants, mais ne déclare pas à votre place — vérifiez toujours avant de valider sur le site officiel.
              </p>

              <div style={{ ...S.card, marginTop: 14 }}>
                <button
                  style={{ ...S.btnSecondary, width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                  onClick={() => {
                    const entry = { periode: periodeAffichee, ca: caAffiche, cotisations: cotisationsAffichees, date: new Date().toISOString() };
                    const next = [entry, ...historiqueDeclarations].slice(0, 12);
                    setHistoriqueDeclarations(next);
                    safeStorage.setItem("historiqueDeclarations", JSON.stringify(next));
                  }}
                >
                  <i className="ti ti-check" aria-hidden="true" style={{ fontSize: 16 }} />
                  Marquer cette déclaration comme faite
                </button>

                {historiqueDeclarations.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.cardTitle}>Historique</div>
                    {historiqueDeclarations.map((h, i) => (
                      <div key={i} style={S.paniqueLine}>
                        <span style={S.paniqueLineLabel}>{h.periode} <span style={{ color: "#8BA5C0", fontSize: 11 }}>· déclaré le {new Date(h.date).toLocaleDateString("fr-FR")}</span></span>
                        <span style={{ fontSize: 13 }}>{formatEUR(h.ca)} CA · <strong>{formatEUR(h.cotisations)}</strong></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {nav === "achat" && (() => {
          const solde = soldeNum;
          const urssaf = urssafProvision;
          const cfe = cfeNum;
          const chargesFutures = totalChargesAVenir;
          const apresReserve = disponibleAujourdhui ?? 0;

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>🛒 Mode Achat</h1><p style={S.pageSub}>Puis-je acheter ça sans me mettre en danger ?</p></div>
              </div>

              {panique.solde === "" ? (
                <div style={S.card}><p style={S.empty}>Renseignez d'abord votre solde sur le <button style={S.linkBtn} onClick={() => setNav("dashboard")}>Dashboard</button> pour utiliser ce simulateur.</p></div>
              ) : (
                <>
                  <div style={S.explainBanner}>
                    Vous avez <strong>{formatEUR(argentDisponibleBrut)}</strong> disponibles. Après maintien de votre réserve de sécurité, votre marge prudente est de <strong>{formatEUR(Math.max(0, apresReserve))}</strong>.
                    <span style={{ display: "block", fontSize: 11, color: "#5B82A8", marginTop: 4 }}>C'est cette marge prudente que H€CTOR utilise pour ses recommandations d'achat ci-dessous.</span>
                  </div>

                  <div style={{ ...S.card, border: `2px solid ${ACCENT}` }}>
                    <div style={S.cardTitle}>Puis-je me permettre cette dépense ?</div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                      <input style={{ ...S.input, flex: 1 }} type="number" step="0.01" placeholder="Ex : Jaguar E-PACE → tapez 18000" value={achatMontant} onChange={e => setAchatMontant(e.target.value)} />
                    </div>
                    {achatMontant && parseFloat(achatMontant) > 0 && (() => {
                      const montant = parseFloat(achatMontant);
                      const tresorerieApres = solde - montant;
                      const resteApres = apresReserve - montant;
                      const ratioApres = solde > 0 ? resteApres / solde : -1;

                      let verdict = "ok", verdictLabel = "✅ Recommandé", verdictColor = "#0F6E56", verdictBg = "#E1F5EE";
                      if (resteApres < 0) { verdict = "non"; verdictLabel = "❌ Déconseillé"; verdictColor = "#A32D2D"; verdictBg = "#FCEBEB"; }
                      else if (ratioApres < 0.15) { verdict = "prudence"; verdictLabel = "⚠️ Prudence"; verdictColor = "#854F0B"; verdictBg = "#FAEEDA"; }

                      const moisSurvieApres = baseMensuelleSecurite > 0 ? Math.max(0, Math.round(((tresorerieApres - chargesFutures) / baseMensuelleSecurite) * 10) / 10) : null;
                      const joursSurvieApres = moisSurvieApres !== null ? Math.round(moisSurvieApres * 30) : null;

                      return (
                        <div>
                          <div style={{ ...S.achatResult, background: verdictBg, color: verdictColor, marginBottom: 12 }}>
                            <i className={`ti ${verdict === "ok" ? "ti-circle-check" : verdict === "prudence" ? "ti-alert-triangle" : "ti-circle-x"}`} aria-hidden="true" style={{ fontSize: 26 }} />
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{verdictLabel}</div>
                          </div>

                          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#F7F9F5", borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: "#8BA5C0", textTransform: "uppercase" }}>Disponible avant</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{formatEUR(Math.max(0, apresReserve))}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", fontSize: 18, color: "#8BA5C0" }}>→</div>
                            <div style={{ flex: 1, textAlign: "center", padding: "10px", background: "#F7F9F5", borderRadius: 8 }}>
                              <div style={{ fontSize: 10, color: "#8BA5C0", textTransform: "uppercase" }}>Disponible après</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: resteApres < 0 ? "#A32D2D" : "#1D9E75" }}>{formatEUR(Math.max(0, resteApres))}</div>
                            </div>
                          </div>

                          {moisSurvieApres !== null && (
                            <div style={S.paniqueLine}>
                              <span style={S.paniqueLineLabel}>🛡️ Sécurité après achat</span>
                              <span style={{ fontWeight: 600, color: moisSurvieApres >= 3 ? "#1D9E75" : moisSurvieApres >= 1 ? "#854F0B" : "#A32D2D" }}>{moisSurvieApres} mois ({joursSurvieApres}j)</span>
                            </div>
                          )}
                          <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Impact sur vos provisions (URSSAF/CFE)</span><span>{chargesFutures <= 0 ? "— aucune provision en cours" : tresorerieApres < chargesFutures ? "⚠️ menacées" : "✅ préservées"}</span></div>
                          <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 8 }}>
                            {verdict === "ok" && "Cet achat ne compromet ni vos charges futures ni votre réserve de sécurité."}
                            {verdict === "prudence" && "L'achat passe, mais il ne vous restera presque plus de marge ensuite."}
                            {verdict === "non" && <>Il vous manquerait <strong>{formatEUR(Math.abs(resteApres))}</strong> pour garder votre réserve de sécurité intacte.</>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ ...S.card, marginTop: 14 }}>
                    <div style={S.cardTitle}><i className="ti ti-skull" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />💀 Que se passe-t-il si je retire tout ?</div>
                    {!showRetraitTout ? (
                      <button style={{ ...S.btnPrimary, background: "#A32D2D" }} onClick={() => setShowRetraitTout(true)}>Simuler le retrait total</button>
                    ) : (
                      <div style={{ ...S.achatResult, background: "#FCEBEB", color: "#A32D2D", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
                          Dans {estimateData?.periode_courante?.jours_restants ?? "?"} jours, vos charges arrivent quand même :
                        </div>
                        <div style={S.netRow}><span>URSSAF</span><span>{formatEUR(urssaf)}</span></div>
                        <div style={S.netRow}><span>CFE</span><span>{formatEUR(cfe)}</span></div>
                        <div style={{ ...S.netRow, fontWeight: 700, borderTop: "1px solid #F7C1C1", paddingTop: 6, marginTop: 4 }}>
                          <span>Manque estimé</span><span>{formatEUR(chargesFutures)}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                          {chargesFutures > 0 ? "🔴 Très mauvaise idée" : "🟢 Vous n'avez rien à provisionner pour l'instant"}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {nav === "simvie" && estimateData && estimateData.disponible !== false && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>🎯 Combien dois-je gagner ?</h1><p style={S.pageSub}>Pour vivre comme tu veux, combien faut-il facturer ?</p></div>
            </div>

            <div style={S.card}>
              <label style={S.label}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Je veux gagner net, par mois</span>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px", marginTop: 8 }} type="number" step="100" placeholder="Ex : 5000" value={revenuViseMensuel} onChange={e => setRevenuViseMensuel(e.target.value)} />
              </label>
            </div>

            {caMensuelNecessaire !== null && (
              <>
                <div style={{ ...S.card, marginTop: 14, textAlign: "center", padding: "32px 24px", background: INK }}>
                  <div style={{ fontSize: 12, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>CA mensuel nécessaire</div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: "#5DCAA5", marginTop: 6 }}>{formatEUR(caMensuelNecessaire)}</div>
                  <div style={{ fontSize: 13, color: "#B5D4F4", marginTop: 8 }}>soit {formatEUR(caAnnuelNecessaire)} de CA sur l'année</div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Le détail</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>CA annuel nécessaire</span><span style={{ fontWeight: 600 }}>{formatEUR(caAnnuelNecessaire)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>URSSAF (sur l'année)</span><span style={{ color: "#854F0B" }}>−{formatEUR(urssafAnnuelleVie)}</span></div>
                  {impotsAnnuelsVie > 0 && <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Impôts estimés (sur l'année)</span><span style={{ color: "#854F0B" }}>−{formatEUR(impotsAnnuelsVie)}</span></div>}
                  <div style={S.paniqueResult}>
                    <span style={S.paniqueResultLabel}>Revenu net mensuel obtenu</span>
                    <span style={{ ...S.paniqueResultValue, fontSize: 28, color: "#1D9E75" }}>{formatEUR(revenuViseNum)}/mois</span>
                  </div>
                </div>

                {depassePlafondVie && (
                  <div style={{ ...S.card, marginTop: 14, background: "#FCEBEB", border: "1px solid #E24B4A" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 20, color: "#A32D2D", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 13, color: "#A32D2D" }}>
                        Ce CA dépasserait le plafond auto-entrepreneur ({formatEUR(estimateData.plafond)}/an). Pour viser ce niveau de revenu durablement, il faudra envisager un passage en société.
                      </div>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
                  Calcul basé sur votre taux de cotisations actuel ({estimateData.taux_global_pct}%) et votre tranche d'imposition.
                </p>
              </>
            )}
          </div>
        )}

        {nav === "salaire" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>💸 Combien puis-je me verser ?</h1><p style={S.pageSub}>Trois niveaux, selon votre tolérance au risque</p></div></div>
            {panique.solde === "" ? (
              <div style={S.card}><p style={S.empty}>Renseignez d'abord votre solde dans <button style={S.linkBtn} onClick={() => setNav("dashboard")}>Dashboard</button> pour voir ce calcul.</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { emoji: "🟢", label: "Prudent", desc: "Marge confortable, idéal en période incertaine", montant: salairePrudent, color: "#1D9E75", border: "1px solid #EEF2F7" },
                  { emoji: "🔵", label: "Recommandé", desc: "Bon équilibre entre revenu et sécurité", montant: salaireRecommande, color: ACCENT, border: `2px solid ${ACCENT}` },
                  { emoji: "🔴", label: "Maximum", desc: "Tout le disponible — zéro marge supplémentaire après", montant: salaireMaximum, color: "#A32D2D", border: "1px solid #EEF2F7" },
                ].map(niveau => {
                  const tresorerieRestante = soldeNum - niveau.montant;
                  const moisApres = baseMensuelleSecurite > 0 ? Math.max(0, Math.round(((tresorerieRestante - totalChargesAVenir) / baseMensuelleSecurite) * 10) / 10) : null;
                  return (
                    <div key={niveau.label} style={{ ...S.card, border: niveau.border }}>
                      <div style={S.salaireRow}>
                        <div><div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{niveau.emoji} {niveau.label}</div><div style={{ fontSize: 11, color: "#8BA5C0" }}>{niveau.desc}</div></div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: niveau.color }}>{formatEUR(niveau.montant)}</div>
                      </div>
                      {moisApres !== null && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7A8D", marginTop: 10, paddingTop: 10, borderTop: "0.5px solid #EEF2F7" }}>
                          <span>Trésorerie restante</span>
                          <span style={{ fontWeight: 600 }}>{formatEUR(Math.max(0, tresorerieRestante))} · 🛡️ {moisApres} mois de sécurité</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p style={{ fontSize: 11, color: "#8BA5C0", textAlign: "center" }}>
                  Basé sur votre disponible après charges et réserve de sécurité ({formatEUR(disponibleAujourdhui || 0)}).
                </p>
              </div>
            )}
          </div>
        )}

        {nav === "simulateur" && estimateData && estimateData.disponible !== false && (() => {
          const caInput = parseFloat(simFiscalCa) || 0;
          const caAnnuelSim = simFiscalPeriode === "mensuel" ? caInput * 12 : caInput;
          const caAffiche = caInput;
          const tauxUrssaf = (estimateData.taux_global_pct || 0) / 100;
          const cotisationsSim = Math.round(caAffiche * tauxUrssaf * 100) / 100;
          const impotsSim = (() => {
            if (profile?.versement_liberatoire || !activiteInfo) return 0;
            const revenuImposable = caAnnuelSim * (1 - activiteInfo.abattement);
            const impotAnnuel = revenuImposable * (parseFloat(tmi) / 100);
            return Math.round((simFiscalPeriode === "mensuel" ? impotAnnuel / 12 : impotAnnuel) * 100) / 100;
          })();
          const disponibleSim = Math.max(0, Math.round((caAffiche - cotisationsSim - impotsSim) * 100) / 100);
          const total = Math.max(caAffiche, 1);
          const pctCotis = (cotisationsSim / total) * 100;
          const pctImpots = (impotsSim / total) * 100;
          const pctDispo = (disponibleSim / total) * 100;

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>📊 Simulateur fiscal</h1><p style={S.pageSub}>Modifiez votre CA et voyez l'impact en direct</p></div>
              </div>

              <div style={S.card}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => setSimFiscalPeriode("mensuel")} style={{ ...S.toggleBtn, ...(simFiscalPeriode === "mensuel" ? S.toggleBtnActive : {}) }}>Par mois</button>
                  <button type="button" onClick={() => setSimFiscalPeriode("annuel")} style={{ ...S.toggleBtn, ...(simFiscalPeriode === "annuel" ? S.toggleBtnActive : {}) }}>Par an</button>
                </div>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px" }} type="number" step="100" value={simFiscalCa} onChange={e => setSimFiscalCa(e.target.value)} />
              </div>

              <div style={{ ...S.card, marginTop: 14 }}>
                <div style={S.cardTitle}>Répartition de votre CA</div>
                <div style={S.simBarTrack}>
                  {pctDispo > 0 && <div style={{ ...S.simBarSeg, width: `${pctDispo}%`, background: "#1D9E75" }} />}
                  {pctCotis > 0 && <div style={{ ...S.simBarSeg, width: `${pctCotis}%`, background: "#EF9F27" }} />}
                  {pctImpots > 0 && <div style={{ ...S.simBarSeg, width: `${pctImpots}%`, background: "#A32D2D" }} />}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: 11, color: "#6B7A8D" }}>
                  <span><span style={{ ...S.legendDot, background: "#1D9E75" }} />Disponible {Math.round(pctDispo)}%</span>
                  <span><span style={{ ...S.legendDot, background: "#EF9F27" }} />URSSAF {Math.round(pctCotis)}%</span>
                  {impotsSim > 0 && <span><span style={{ ...S.legendDot, background: "#A32D2D" }} />Impôts {Math.round(pctImpots)}%</span>}
                </div>
              </div>

              <div style={S.kpiGrid} className="kpi-grid-r" >
                <div style={S.kpiCard}><span style={S.kpiLabel}>CA {simFiscalPeriode === "mensuel" ? "mensuel" : "annuel"}</span><span style={S.kpiValue}>{formatEUR(caAffiche)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Cotisations URSSAF</span><span style={{ ...S.kpiValue, color: "#854F0B" }}>{formatEUR(cotisationsSim)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Impôts estimés</span><span style={{ ...S.kpiValue, color: "#A32D2D" }}>{formatEUR(impotsSim)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Revenu réellement disponible</span><span style={{ ...S.kpiValue, color: "#1D9E75" }}>{formatEUR(disponibleSim)}</span></div>
              </div>
              {/* ─── TEST RAPIDE — déplacé du Cockpit (Étape 4) ─── */}
            <div style={{ ...S.card, marginBottom: 20 }}>
              <div style={S.cardTitle}>
                <span><i className="ti ti-calculator" aria-hidden="true" style={{ fontSize: 16, marginRight: 6, verticalAlign: -2 }} />Test rapide d'un autre montant</span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button style={S.linkBtn} onClick={() => setNav("revenus")}>+ Ajouter un revenu →</button>
                  {simCa && <button style={S.linkBtn} onClick={() => setSimCa("")}>↺ Réinitialiser</button>}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 12px" }}>Testez un montant sans l'ajouter à vos revenus.</p>
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <input style={{ ...S.input, flex: "1 1 160px" }} type="number" placeholder="Exemple : 3000€" value={simCa} onChange={e => setSimCa(e.target.value)} />
                <select style={{ ...S.input, flex: "1 1 200px" }} value={simActivite} onChange={e => setSimActivite(e.target.value)}>
                  <option value="vente">Vente de marchandises (12,3%)</option>
                  <option value="services">Prestations de services (21,2%)</option>
                  <option value="bnc">Profession libérale (25,6%)</option>
                </select>
              </div>
              {(() => {
                const tauxSim = { vente: 0.123, services: 0.212, bnc: 0.256 }[simActivite];
                const caSim = parseFloat(simCa) || 0;
                const urssafSim = Math.round(caSim * tauxSim * 100) / 100;
                const netSim = Math.round((caSim - urssafSim) * 100) / 100;
                if (caSim <= 0) return null;
                return (
                  <div style={{ display: "flex", gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>À mettre de côté</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: "#854F0B" }}>{formatEUR(urssafSim)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>Argent réellement disponible</div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: ACCENT }}>{formatEUR(netSim)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>
          );
        })()}

        {nav === "score" && (() => {
          const info = scoreInfo(scoreSante);
          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Score H€CTOR</h1><p style={S.pageSub}>Votre santé financière en un coup d'œil</p></div></div>
              <div style={{ ...S.card, textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: info.color, lineHeight: 1 }}>{scoreSante !== null ? `${scoreSante}` : "—"}<span style={{ fontSize: 24, color: "#8BA5C0" }}>/100</span></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: info.color, marginTop: 10 }}>{info.label}</div>
                <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 8, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{info.desc}</div>
              </div>
              {scoreSante !== null && (
                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Détail du calcul</div>
                  {[
                    { label: "Trésorerie vs charges à venir", icon: "ti-coin", pts: scoreDetail.ptsTreso, max: 30 },
                    { label: "Réserve de sécurité couverte", icon: "ti-shield", pts: scoreDetail.ptsReserve, max: 20 },
                    { label: "URSSAF provisionnée", icon: "ti-receipt", pts: scoreDetail.ptsUrssaf, max: 20 },
                    { label: "Régularité du CA mensuel", icon: "ti-chart-line", pts: scoreDetail.ptsRegularite, max: 15 },
                    { label: "Endettement", icon: "ti-credit-card", pts: scoreDetail.ptsDette, max: 15 },
                  ].map((f, i) => (
                    <div key={i} style={S.scoreDetailRow}>
                      <span style={S.paniqueLineLabel}><i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />{f.label}</span>
                      <div style={S.scoreBarTrack}><div style={{ ...S.scoreBarFill, width: `${(f.pts / f.max) * 100}%`, background: f.pts / f.max > 0.6 ? "#1D9E75" : f.pts / f.max > 0.3 ? "#EF9F27" : "#E24B4A" }} /></div>
                      <span style={{ fontSize: 12, color: "#6B7A8D", width: 50, textAlign: "right" }}>{f.pts}/{f.max}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "0.5px solid #EEF2F7" }}>
                    <span style={{ fontSize: 12, color: "#6B7A8D" }}><i className="ti ti-credit-card" aria-hidden="true" style={{ fontSize: 14, marginRight: 6 }} />Dettes / emprunts en cours</span>
                    <input style={S.inlineEditValue} type="number" step="0.01" value={panique.dettes} onChange={e => setPanique({ ...panique, dettes: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {nav === "coach" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>💪 Est-ce que je facture assez ?</h1><p style={S.pageSub}>Ton vrai taux horaire, et si tu te sous-vends</p></div></div>

            <div style={S.card}>
              <label style={S.label}>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>Combien facturez-vous actuellement ?</span>
                <input style={{ ...S.input, fontSize: 22, fontWeight: 600, padding: "14px 16px", marginTop: 8 }} type="number" step="1" placeholder="Ex : 500" value={tarifMontant} onChange={e => setTarifMontant(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {[{ id: "jour", l: "par jour" }, { id: "heure", l: "par heure" }, { id: "prestation", l: "par prestation" }].map(u => (
                  <button key={u.id} type="button" onClick={() => setTarifUnite(u.id)} style={{ ...S.toggleBtn, ...(tarifUnite === u.id ? S.toggleBtnActive : {}) }}>{u.l}</button>
                ))}
              </div>
              {tarifUnite === "jour" && (
                <label style={{ ...S.label, marginTop: 12 }}>Heures travaillées par jour
                  <input style={S.input} type="number" min="0.5" max="24" value={heuresParJour} onChange={e => setHeuresParJourCoach(e.target.value)} />
                </label>
              )}
              {tarifUnite === "prestation" && (
                <label style={{ ...S.label, marginTop: 12 }}>Heures passées en moyenne par prestation
                  <input style={S.input} type="number" min="0.25" max="200" value={heuresParPrestation} onChange={e => setHeuresParPrestation(e.target.value)} />
                </label>
              )}
              <label style={{ ...S.label, marginTop: 12 }}>Jours travaillés par semaine <span style={{ fontWeight: 400, color: "#8BA5C0" }}>(pour estimer vos revenus mensuels)</span>
                <input style={S.input} type="number" min="0.5" max="7" value={joursParSemaineCoach} onChange={e => setJoursParSemaineCoach(e.target.value)} />
              </label>
            </div>

            {tauxHoraireReel !== null && (
              <>
                <div style={{ ...S.card, marginTop: 14, textAlign: "center", padding: "32px 24px" }}>
                  <div style={S.paniqueResultLabel}>Votre vrai revenu horaire</div>
                  <div style={{ ...S.paniqueResultValue, fontSize: 48, color: niveauTarif === "rouge" ? "#A32D2D" : niveauTarif === "jaune" ? "#854F0B" : "#1D9E75" }}>{formatEUR(tauxHoraireReel)}<span style={{ fontSize: 20 }}>/h</span></div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: niveauTarif === "rouge" ? "#A32D2D" : niveauTarif === "jaune" ? "#854F0B" : "#1D9E75", marginTop: 8 }}>
                    {niveauTarif === "rouge" && "🔴 Vous êtes sous-facturé"}
                    {niveauTarif === "jaune" && "🟡 Tarif dans la moyenne"}
                    {niveauTarif === "vert" && "🟢 Bien facturé, au-dessus de la moyenne"}
                  </div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>Vos revenus, à tous les horizons</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par heure</span><span style={{ fontWeight: 600 }}>{formatEUR(tauxHoraireReel)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par jour</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuJournalierCoach)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par mois</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuMensuelCoach)}</span></div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Par an</span><span style={{ fontWeight: 600 }}>{formatEUR(revenuAnnuelCoach)}</span></div>
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>📈 Impact concret d'une hausse de tarifs</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    {[5, 10, 20].map(p => (
                      <button key={p} type="button" onClick={() => setHaussePct(String(p))} style={{ ...S.toggleBtn, flex: "0 1 auto", padding: "8px 16px", ...(haussePct === String(p) ? S.toggleBtnActive : {}) }}>+{p}%</button>
                    ))}
                    <input style={{ ...S.input, width: 70 }} type="number" min="0" max="100" value={haussePct} onChange={e => setHaussePct(e.target.value)} />
                    <span style={{ fontSize: 13, color: INK }}>%</span>
                  </div>
                  {tauxHoraireApresHausse !== null && (
                    <>
                      <div style={S.paniqueLine}><span style={S.paniqueLineLabel}>Nouveau tarif horaire</span><span style={{ fontWeight: 600, color: "#1D9E75" }}>{formatEUR(tauxHoraireApresHausse)}/h</span></div>
                      <div style={{ ...S.netRow, marginTop: 10, fontSize: 15 }}>
                        <span>Gain concret</span>
                        <span style={{ fontWeight: 700, color: "#1D9E75" }}>+{formatEUR(gainMensuelHausse)}/mois · +{formatEUR(gainAnnuelHausse)}/an</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#8BA5C0", marginTop: 6 }}>Sans travailler une heure de plus.</div>
                    </>
                  )}
                </div>

                <div style={{ ...S.card, marginTop: 14 }}>
                  <div style={S.cardTitle}>🎯 Pour atteindre votre objectif</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <input style={{ ...S.input, width: 100 }} type="number" value={objectifHoraire} onChange={e => setObjectifHoraire(e.target.value)} />
                    <span style={{ fontSize: 14, color: INK }}>€/h</span>
                  </div>
                  {ecartPctVersObjectif !== null && (
                    ecartPctVersObjectif > 0 ? (
                      <div style={{ fontSize: 14, color: "#5B6573" }}>
                        Pour atteindre {formatEUR(objHoraireNum)}/h, augmentez vos tarifs de <strong style={{ color: "#1D9E75", fontSize: 18 }}>+{ecartPctVersObjectif}%</strong>.
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: "#1D9E75" }}>
                        🎉 Vous dépassez déjà cet objectif !
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14, textAlign: "center" }}>
              Comparaison indicative (moyenne basse ~25€/h, moyenne ~45€/h pour des indépendants en France).
            </p>
          </div>
        )}

        {nav === "societe" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Passage en société ?</h1><p style={S.pageSub}>Auto-entrepreneur, SASU ou EURL — où en êtes-vous</p></div></div>
            {estimateData && estimateData.disponible !== false && (() => {
              const pct = estimateData.pourcentage_plafond;
              let niveau = "vert", titre = "Pas encore nécessaire", texte = "Votre activité reste confortablement dans le cadre du régime micro-entrepreneur.";
              if (pct > 80) { niveau = "rouge"; titre = "À étudier sérieusement"; texte = "Vous approchez du plafond. Une société vous permettrait de continuer à grandir sans limite de CA, avec une vraie déduction des charges."; }
              else if (pct > 50) { niveau = "orange"; titre = "À garder en tête"; texte = "Pas urgent, mais commencez à vous renseigner — le passage en société prend du temps à préparer."; }
              const colors = { vert: "#1D9E75", orange: "#EF9F27", rouge: "#E24B4A" };
              return (
                <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: colors[niveau], flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{titre}</div>
                    <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>{texte}</div>
                  </div>
                </div>
              );
            })()}
            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>Les grandes différences</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12 }}>
                <div><strong>Auto-entrepreneur</strong><p style={{ color: "#6B7A8D" }}>Simple, % fixe sur le CA, plafonné</p></div>
                <div><strong>EURL</strong><p style={{ color: "#6B7A8D" }}>Charges déductibles, IS ou IR, comptabilité complète</p></div>
                <div><strong>SASU</strong><p style={{ color: "#6B7A8D" }}>Statut assimilé salarié, charges plus lourdes mais protection sociale renforcée</p></div>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 14 }}>Cette analyse est indicative. Un expert-comptable reste indispensable avant de changer de statut.</p>
            </div>
          </div>
        )}

        {nav === "modeles" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Modèles</h1><p style={S.pageSub}>Des textes prêts à copier-coller</p></div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { titre: "Relance impayé", texte: "Bonjour [Nom],\n\nJe me permets de revenir vers vous concernant la facture [N°] du [date], d'un montant de [montant]€, dont l'échéance est dépassée.\n\nPourriez-vous me confirmer la date de règlement prévue ?\n\nBien à vous," },
                { titre: "Hausse de tarifs", texte: "Bonjour [Nom],\n\nJe vous informe qu'à compter du [date], mes tarifs évoluent à [nouveau tarif].\n\nCette révision reflète [raison : montée en compétence / coûts / etc.]. Je reste à votre disposition pour en discuter.\n\nCordialement," },
                { titre: "Email de prospection", texte: "Bonjour [Nom],\n\nJe me permets de vous contacter au sujet de [besoin identifié]. Je propose [votre service] et pense pouvoir vous aider sur ce point.\n\nSeriez-vous disponible pour un échange rapide cette semaine ?\n\nBien à vous," },
                { titre: "CGV simplifiées", texte: "Conditions Générales de Vente\n\n1. Les prestations sont facturées au tarif en vigueur au moment de la commande.\n2. Le règlement est dû à réception de facture, sauf accord contraire.\n3. Tout retard de paiement entraîne des pénalités au taux légal en vigueur.\n4. TVA non applicable, article 293 B du CGI." },
              ].map((m, i) => (
                <div key={i} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{m.titre}</span>
                    <button style={S.btnSecondary} onClick={() => navigator.clipboard?.writeText(m.texte)}>
                      <i className="ti ti-copy" aria-hidden="true" style={{ fontSize: 14, marginRight: 4 }} />Copier
                    </button>
                  </div>
                  <pre style={S.modelText}>{m.texte}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "revenus" && (() => {
          // Garde : si les estimations ne sont pas encore chargées, on évite tout crash.
          if (!estimateData) {
            return (
              <div>
                <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                  <div><h1 style={S.pageTitle}>Mes revenus</h1><p style={S.pageSub}>Les factures que vous émettez à vos clients — pas vos dépenses</p></div>
                </div>
                <div style={{ ...S.card, textAlign: "center", padding: "40px 20px", color: "#8BA5C0" }}>Chargement de tes revenus…</div>
              </div>
            );
          }
          const moisActuel = new Date().getMonth();
          const anneeActuelle = new Date().getFullYear();
          // Gardes défensives : une ligne corrompue (date invalide, amount null, description non-string)
          // ne doit PAS faire planter toute la page Revenus.
          const incomeListSafe = (incomeList || []).filter(e => {
            if (!e || typeof e !== "object") return false;
            if (typeof e.amount !== "number" || isNaN(e.amount)) return false;
            const d = new Date(e.date);
            if (isNaN(d.getTime())) return false;
            return true;
          });
          const incomeCeMois = incomeListSafe.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === moisActuel && d.getFullYear() === anneeActuelle;
          });
          const caMoisCi = incomeCeMois.reduce((s, e) => s + (e.amount || 0), 0);
          const nbFactures = incomeCeMois.length;
          const factureMoyenne = nbFactures > 0 ? Math.round((caMoisCi / nbFactures) * 100) / 100 : 0;
          const parClientRevenus = {};
          incomeListSafe.forEach(e => {
            const desc = typeof e.description === "string" ? e.description : "";
            const cle = (desc.match(/Client\s*:\s*([^—]+)/)?.[1] || "").trim() || "Non précisé";
            parClientRevenus[cle] = (parClientRevenus[cle] || 0) + (e.amount || 0);
          });
          const meilleurClientRevenus = Object.entries(parClientRevenus).filter(([k]) => k !== "Non précisé").sort((a, b) => b[1] - a[1])[0];
          const urssafAProvisionner = estimateData ? Math.round(caMoisCi * ((estimateData.taux_global_pct || 0) / 100) * 100) / 100 : 0;

          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>Mes revenus</h1><p style={S.pageSub}>Les factures que vous émettez à vos clients — pas vos dépenses</p></div>
                <button style={S.btnPrimarySmall} onClick={() => setShowAddIncome(!showAddIncome)}>+ Ajouter</button>
              </div>

              <div style={isMobile ? { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr" } : S.kpiGrid}>
                <div style={S.kpiCard}><span style={S.kpiLabel}>CA ce mois</span><span style={S.kpiValue}>{formatEUR(caMoisCi)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Factures / revenus</span><span style={S.kpiValue}>{nbFactures}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Facture moyenne</span><span style={S.kpiValue}>{formatEUR(factureMoyenne)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Meilleur client</span><span style={{ ...S.kpiValue, fontSize: 16 }}>{meilleurClientRevenus?.[0] || "—"}</span></div>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", margin: "-12px 0 16px" }}>≈ {formatEUR(urssafAProvisionner)} à provisionner d'URSSAF sur le CA de ce mois.</p>

              {/* ─── PROGRESSION & OBJECTIFS — déplacés du Cockpit (Étape 3) ─── */}
            {(() => {
              const objM = parseFloat(objectifMensuel) || 0;
              const pctM = objM > 0 ? Math.min(100, Math.round((caCeMoisCi / objM) * 100)) : 0;
              const objA = parseFloat(objectifAnnuel) || 0;
              const pctA = objA > 0 ? Math.min(100, Math.round(((estimateData?.ca_annuel || 0) / objA) * 100)) : 0;
              const PRESETS_MENSUEL = [2000, 4000, 6000];
              const PRESETS_ANNUEL = [10000, 25000, 50000, 100000];
              return (
                <>
                  <div style={{ ...S.card, marginTop: 14, border: `2px solid ${ACCENT}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>🎯 Objectif du mois</span>
                      {objectifMensuel !== "" && <span style={{ fontSize: 13, fontWeight: 700, color: pctM >= 100 ? "#1D9E75" : ACCENT }}>{pctM}%</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#8BA5C0", margin: "2px 0 0", lineHeight: 1.5 }}>
                      Le montant de chiffre d'affaires que vous visez à encaisser ce mois-ci. Sert juste à suivre votre progression — aucune incidence sur vos calculs financiers.
                    </p>
                    {objectifMensuel === "" && !editingObjectifMensuel ? (
                      <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                        <p style={{ fontSize: 13, color: "#8BA5C0", margin: "0 0 10px" }}>Aucun objectif défini</p>
                        <button style={S.btnSecondary} onClick={() => setEditingObjectifMensuel(true)}>Définir mon objectif</button>
                      </div>
                    ) : objectifMensuel === "" && editingObjectifMensuel ? (
                      <div style={{ padding: "8px 0 4px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {PRESETS_MENSUEL.map(v => (
                            <button key={v} type="button" style={{ ...S.toggleBtn, flex: "0 1 auto", padding: "6px 14px" }} onClick={() => { setObjectifMensuel(String(v)); setEditingObjectifMensuel(false); }}>{formatEUR(v)}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input style={{ ...S.input, flex: 1 }} type="number" placeholder="Montant personnalisé" autoFocus onBlur={e => { if (e.target.value) setObjectifMensuel(e.target.value); }} onKeyDown={e => { if (e.key === "Enter" && e.target.value) setObjectifMensuel(e.target.value); }} />
                          <button style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => setEditingObjectifMensuel(false)}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 10, color: "#8BA5C0", marginBottom: 6 }}>basé sur vos revenus encaissés enregistrés, pas sur votre solde bancaire</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 10px" }}>
                          <span style={{ fontSize: 24, fontWeight: 700, color: INK }}>{formatEUR(caCeMoisCi)}</span>
                          <span style={{ fontSize: 13, color: "#8BA5C0" }}>sur</span>
                          <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "#8BA5C0" }} />
                          <input style={S.objectifInputBig} type="number" value={objectifMensuel} onChange={e => setObjectifMensuel(e.target.value)} />
                          <span style={{ fontSize: 12, color: objectifSaved ? "#1D9E75" : "transparent", transition: "opacity 0.3s", marginLeft: 4 }}>✓ enregistré</span>
                        </div>
                        <div style={{ ...S.progressTrack, height: 10 }}><div style={{ ...S.progressFill, background: pctM >= 100 ? "#1D9E75" : ACCENT, width: `${pctM}%`, transition: "width 0.3s ease" }} /></div>
                        {caCeMoisCi === 0 ? (
                          <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>Aucun revenu enregistré ce mois-ci — <button style={S.linkBtn} onClick={() => setNav("revenus")}>en ajouter un</button></div>
                        ) : pctM >= 100 ? (
                          <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 6, fontWeight: 600 }}>🎉 Objectif du mois atteint !</div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>encore {formatEUR(Math.max(0, objM - caCeMoisCi))} pour l'atteindre</div>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ ...S.card, marginTop: 14, marginBottom: 20, border: "1.5px solid #5DCAA5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>🗓️ Objectif de l'année</span>
                      {objectifAnnuel !== "" && <span style={{ fontSize: 13, fontWeight: 700, color: pctA >= 100 ? "#1D9E75" : "#5DCAA5" }}>{pctA}%</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#8BA5C0", margin: "2px 0 0", lineHeight: 1.5 }}>
                      Le chiffre d'affaires que vous visez sur l'année complète. Une simple jauge de motivation — ne modifie aucun calcul de cotisations ou de disponible.
                    </p>
                    {objectifAnnuel === "" && !editingObjectifAnnuel ? (
                      <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                        <p style={{ fontSize: 13, color: "#8BA5C0", margin: "0 0 10px" }}>Aucun objectif défini</p>
                        <button style={S.btnSecondary} onClick={() => setEditingObjectifAnnuel(true)}>Définir mon objectif</button>
                      </div>
                    ) : objectifAnnuel === "" && editingObjectifAnnuel ? (
                      <div style={{ padding: "8px 0 4px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {PRESETS_ANNUEL.map(v => (
                            <button key={v} type="button" style={{ ...S.toggleBtn, flex: "0 1 auto", padding: "6px 14px" }} onClick={() => { setObjectifAnnuel(String(v)); setEditingObjectifAnnuel(false); }}>{formatEUR(v)}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input style={{ ...S.input, flex: 1 }} type="number" placeholder="Montant personnalisé" autoFocus onBlur={e => { if (e.target.value) setObjectifAnnuel(e.target.value); }} onKeyDown={e => { if (e.key === "Enter" && e.target.value) setObjectifAnnuel(e.target.value); }} />
                          <button style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => setEditingObjectifAnnuel(false)}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 10, color: "#8BA5C0", marginBottom: 6 }}>basé sur vos revenus encaissés enregistrés, pas sur votre solde bancaire</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 10px" }}>
                          <span style={{ fontSize: 24, fontWeight: 700, color: INK }}>{formatEUR(estimateData?.ca_annuel || 0)}</span>
                          <span style={{ fontSize: 13, color: "#8BA5C0" }}>sur</span>
                          <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "#8BA5C0" }} />
                          <input style={{ ...S.objectifInputBig, color: "#0F6E56", borderColor: "#5DCAA5", background: "#F0FAF6" }} type="number" value={objectifAnnuel} onChange={e => setObjectifAnnuel(e.target.value)} />
                          <span style={{ fontSize: 12, color: objectifAnnuelSaved ? "#1D9E75" : "transparent", transition: "opacity 0.3s", marginLeft: 4 }}>✓ enregistré</span>
                        </div>
                        <div style={S.progressTrack}><div style={{ ...S.progressFill, background: "#5DCAA5", width: `${pctA}%`, transition: "width 0.3s ease" }} /></div>
                        {(estimateData?.ca_annuel || 0) === 0 && (
                          <div style={{ fontSize: 12, color: "#8BA5C0", marginTop: 6 }}>Aucun revenu enregistré cette année — <button style={S.linkBtn} onClick={() => setNav("revenus")}>en ajouter un</button></div>
                        )}
                      </>
                    )}
                  </div>
                </>
              );
            })()}


              {showAddIncome && !factureExtraite && (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "#854F0B", background: "#FAEEDA", border: "1px solid #FAC775", borderRadius: 8, padding: "8px 12px", margin: "0 0 12px" }}>
                    ⚠️ Importez ici uniquement les factures que <strong>vous</strong> émettez à vos clients (revenu encaissé). Pas vos factures fournisseurs ou dépenses (téléphone, matériel, abonnements...).
                  </p>
                  <label style={S.dropZoneSmall}>
                    <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => e.target.files[0] && handleUploadInvoice(e.target.files[0])} style={{ display: "none" }} />
                    {uploadingFile ? "Lecture en cours…" : "＋ Importer une facture client (PDF, JPG, PNG)"}
                  </label>
                  <p style={S.orDivider}>ou saisie manuelle</p>
                  <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={handleAddIncome}>
                    <input style={S.input} type="date" value={incomeForm.date} onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })} required />
                    <input style={S.input} type="number" step="0.01" placeholder="Montant reçu du client €" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} required />
                    {incomeForm.amount && parseFloat(incomeForm.amount) > 0 && (() => {
                      const taux = estimateData?.taux_global_pct ? estimateData.taux_global_pct / 100 : 0.214;
                      const brut = parseFloat(incomeForm.amount);
                      const urssaf = Math.round(brut * taux * 100) / 100;
                      const net = Math.round((brut - urssaf) * 100) / 100;
                      return (
                        <div style={S.netPreview}>
                          <div style={S.netRow}><span style={{ color: "#854F0B" }}>URSSAF à mettre de côté ({estimateData?.taux_global_pct ?? 21.4}%)</span><span style={{ color: "#854F0B" }}>−{formatEUR(urssaf)}</span></div>
                          <div style={{ ...S.netRow, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 4 }}><span style={{ fontWeight: 500 }}>Dans votre poche</span><span style={{ fontWeight: 600, color: ACCENT }}>{formatEUR(net)}</span></div>
                        </div>
                      );
                    })()}
                    <input style={S.input} type="text" placeholder="Description (optionnel)" value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} />
                    <button style={S.btnPrimary} type="submit">Ajouter</button>
                  </form>
                </div>
              )}

              {/* ─── ECRAN DE CONFIRMATION OBLIGATOIRE avant tout enregistrement ─── */}
              {factureExtraite && (() => {
                const montant = parseFloat(factureExtraite.amount) || 0;
                const tauxPct = estimateData?.taux_global_pct ?? 21.4;
                const urssafSurFacture = Math.round(montant * (tauxPct / 100) * 100) / 100;
                const nouveauCaAnnuel = (estimateData?.ca_annuel || 0) + montant;

                // Comparatif avant / apres, sur les VRAIES variables du Dashboard
                const caMoisAvant = caCeMoisCi;
                const caMoisApres = caCeMoisCi + montant;
                const dispoAvant = argentDisponibleBrut ?? 0;
                const chargesApres = totalChargesAVenir + urssafSurFacture;
                const dispoApres = Math.max(0, Math.round((soldeNum + montant - chargesApres) * 100) / 100);

                return (
                  <div style={{ ...S.card, marginBottom: 16, border: `2px solid ${ACCENT}`, padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "18px 20px 14px" }}>
                      <div style={S.cardTitle}>📄 Facture détectée — vérifiez avant de valider</div>
                      <p style={{ fontSize: 11, color: "#8BA5C0", margin: "-8px 0 14px" }}>Détection automatique, tous les champs sont modifiables.</p>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 6 }}>
                        <label style={S.label}>Montant détecté
                          <input style={S.input} type="number" step="0.01" value={factureExtraite.amount} onChange={e => setFactureExtraite({ ...factureExtraite, amount: e.target.value })} />
                        </label>
                        <label style={S.label}>Date
                          <input style={S.input} type="date" value={factureExtraite.date} onChange={e => setFactureExtraite({ ...factureExtraite, date: e.target.value })} />
                        </label>
                        <label style={S.label}>Client {!factureExtraite.client && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détecté — renseignez-le" value={factureExtraite.client} onChange={e => setFactureExtraite({ ...factureExtraite, client: e.target.value })} />
                        </label>
                        <label style={S.label}>Description {!factureExtraite.description && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détectée — renseignez-la" value={factureExtraite.description} onChange={e => setFactureExtraite({ ...factureExtraite, description: e.target.value })} />
                        </label>
                        <label style={S.label}>N° de facture {!factureExtraite.numero_facture && <span style={S.aVerifierTag}>à vérifier</span>}
                          <input style={S.input} type="text" placeholder="Non détecté — renseignez-le" value={factureExtraite.numero_facture} onChange={e => setFactureExtraite({ ...factureExtraite, numero_facture: e.target.value })} />
                        </label>
                      </div>
                      {factureExtraite.tva_pct != null && (
                        <p style={{ fontSize: 11, color: "#8BA5C0", margin: "0 0 10px" }}>TVA détectée sur le document : {factureExtraite.tva_pct}% — à vérifier, non utilisée dans le calcul.</p>
                      )}
                    </div>

                    {/* ─── LE COMPARATIF QUI CREE L'EFFET WOW ─── */}
                    <div style={{ background: INK, padding: "20px" }}>
                      <div style={{ fontSize: 12, color: "#5DCAA5", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>⚡ Cette facture va immédiatement</div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                        <div style={S.impactCompareCard}>
                          <div style={{ fontSize: 11, color: "#8BA5C0" }}>CA du mois</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 15, color: "#7A93AD", textDecoration: "line-through" }}>{formatEUR(caMoisAvant)}</span>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#5DCAA5" }}>{formatEUR(caMoisApres)}</span>
                          </div>
                        </div>
                        <div style={S.impactCompareCard}>
                          <div style={{ fontSize: 11, color: "#8BA5C0" }}>Disponible réel</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 15, color: "#7A93AD", textDecoration: "line-through" }}>{formatEUR(dispoAvant)}</span>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize: 14, color: "#5DCAA5" }} />
                            <span style={{ fontSize: 22, fontWeight: 700, color: "#5DCAA5" }}>{formatEUR(dispoApres)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={S.impactRowDark}>✓ Ajoute <strong style={{ color: "white" }}>{formatEUR(montant)}</strong> à votre chiffre d'affaires</div>
                        <div style={S.impactRowDark}>✓ Augmente votre URSSAF estimée de <strong style={{ color: "#FAC775" }}>{formatEUR(urssafSurFacture)}</strong></div>
                        <div style={S.impactRowDark}>✓ Met à jour vos projections (fin de mois, fin d'année)</div>
                        <div style={S.impactRowDark}>✓ Fait avancer votre objectif mensuel ({formatEUR(nouveauCaAnnuel)} de CA annuel après ajout)</div>
                        <div style={S.impactRowDark}>✓ Apparaît dans votre historique de revenus</div>
                      </div>
                      <p style={{ fontSize: 10, color: "#7A93AD", marginTop: 12 }}>
                        Le "Disponible réel" ci-dessus suppose que ce montant arrive sur ton compte. Pense à mettre à jour ton solde sur le Cockpit une fois le virement reçu — c'est ce qui garde ton chiffre fiable.
                      </p>
                    </div>

                    {factureExtraite.doublon && (
                      <div style={{ ...S.doublonWarning, margin: "0 20px 16px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 20, color: "#854F0B", flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#633806" }}>⚠️ Facture potentiellement déjà importée</div>
                            <div style={{ fontSize: 12, color: "#854F0B", marginTop: 4 }}>
                              Une entrée similaire existe déjà : {formatEUR(factureExtraite.doublon.existing_amount)} le {formatDate(factureExtraite.doublon.existing_date)}{factureExtraite.doublon.existing_description ? ` — ${factureExtraite.doublon.existing_description}` : ""}.
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                              <button style={S.linkBtn} onClick={() => { setNav("revenus"); }}>Voir l'ancienne facture</button>
                              <button style={{ ...S.linkBtn, color: "#A32D2D" }} onClick={() => handleConfirmFacture(true)}>Importer quand même</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, padding: "16px 20px" }}>
                      <button style={S.btnPrimary} onClick={() => handleConfirmFacture(false)}>✓ Confirmer et tout mettre à jour</button>
                      <button style={S.btnSecondary} onClick={() => setFactureExtraite(null)}>Annuler</button>
                    </div>
                  </div>
                );
              })()}

              <div style={S.card}>
                {incomeListSafe.length === 0 ? <p style={S.empty}>Aucun revenu enregistré.</p> : incomeListSafe.map(entry => (
                  <div key={entry.id} style={S.incomeRow}>
                    <div style={{ flex: 1 }}>
                      <span style={S.incomeAmt}>{formatEUR(entry.amount)}</span>
                      <span style={S.incomeMeta}>{formatDate(entry.date)}{entry.description ? ` · ${entry.description}` : ""}</span>
                    </div>
                    <span style={{ ...S.badge, ...S.badgeGreen }}>✓ Comptabilisée</span>
                    <span style={{ ...S.badge, ...(entry.source === "facture" ? S.badgeBlue : S.badgeGray) }}>{entry.source === "facture" ? "Import" : "Manuel"}</span>
                    <button style={S.deleteBtn} onClick={() => handleDeleteIncome(entry.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {nav === "factures" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>Factures clients</h1><p style={S.pageSub}>Suivez ce qui a été payé ou non</p></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnSecondary} onClick={() => { setNav("revenus"); setShowAddIncome(true); }}>📄 Importer une facture client</button>
                <button style={S.btnPrimarySmall} onClick={() => { resetFactureForm(); setShowNewFacture(!showNewFacture); }}>+ Nouvelle facture</button>
              </div>
            </div>

            {invoicesSummary && (
              <div style={isMobile ? { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr" } : S.kpiGrid}>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Facturé</span><span style={S.kpiValue}>{formatEUR(invoicesSummary.facture_total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Payé</span><span style={{ ...S.kpiValue, color: "#1D9E75" }}>{formatEUR(invoicesSummary.paye_total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>En attente</span><span style={{ ...S.kpiValue, color: "#854F0B" }}>{formatEUR(invoicesSummary.en_attente_total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Impayées</span><span style={{ ...S.kpiValue, color: "#A32D2D" }}>{invoicesSummary.impayees_count}</span></div>
              </div>
            )}

            {showNewFacture && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>{editingInvoiceId ? "Modifier la facture" : "Nouvelle facture"}</h3>

                <div style={{ background: "#F7F9F5", border: "1px solid #DDE5EE", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Émetteur (mentions obligatoires)</div>
                  {(profilEntreprise || profilPrenom) && profilSiret && profilAdresse ? (
                    <div style={{ fontSize: 13, color: INK, lineHeight: 1.6 }}>
                      <strong>{profilEntreprise || `${profilPrenom} ${profilNom}`.trim()}</strong><br />
                      {profilAdresse}<br />
                      SIRET : {profilSiret}{profile?.statut === "auto_entrepreneur" && <> · Auto-entrepreneur, dispensé d'immatriculation au RCS et au RM</>}
                      <button type="button" style={{ ...S.linkBtn, fontSize: 11, display: "block", marginTop: 6 }} onClick={() => setNav("profil")}>Modifier dans Profil →</button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 12, color: "#854F0B", margin: "0 0 10px" }}>⚠️ Complétez ces informations une fois — elles seront ensuite préremplies sur toutes vos factures.</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {!(profilEntreprise || profilPrenom) && (
                          <input style={S.input} placeholder="Votre nom ou nom d'entreprise" value={profilEntreprise} onChange={e => setProfilEntreprise(e.target.value)} />
                        )}
                        {!profilAdresse && (
                          <input style={S.input} placeholder="Adresse professionnelle (ex : 12 rue de la Paix, 75002 Paris)" value={profilAdresse} onChange={e => setProfilAdresse(e.target.value)} />
                        )}
                        {!profilSiret && (
                          <input style={S.input} placeholder="SIRET (14 chiffres)" value={profilSiret} onChange={e => setProfilSiret(e.target.value)} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input style={S.input} placeholder="Nom du client" value={factureForm.client_nom} onChange={e => setFactureForm({ ...factureForm, client_nom: e.target.value })} />
                  <input style={S.input} placeholder="Email du client" type="email" value={factureForm.client_email} onChange={e => setFactureForm({ ...factureForm, client_email: e.target.value })} />
                </div>
                <input style={{ ...S.input, marginBottom: 10 }} placeholder="Adresse du client" value={factureForm.client_adresse} onChange={e => setFactureForm({ ...factureForm, client_adresse: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Date d'émission
                    <input style={S.input} type="date" value={factureForm.date_emission} onChange={e => setFactureForm({ ...factureForm, date_emission: e.target.value })} />
                  </label>
                  <label style={{ ...S.label, marginBottom: 0 }}>Échéance (optionnel)
                    <input style={S.input} type="date" value={factureForm.date_echeance} onChange={e => setFactureForm({ ...factureForm, date_echeance: e.target.value })} />
                  </label>
                </div>
                <div style={S.factureHeaderRow}>
                  <span style={{ flex: 3, fontSize: 12, color: "#6B7A8D" }}>Description</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "center" }}>Qté</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Prix unitaire</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Total</span>
                </div>
                {factureForm.lignes.map((l, i) => (
                  <div key={i} style={S.factureRow}>
                    <input style={{ ...S.input, flex: 3 }} placeholder="Prestation" value={l.description} onChange={e => updateLigne(i, "description", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "center" }} type="number" min="1" value={l.quantite} onChange={e => updateLigne(i, "quantite", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "right" }} type="number" step="0.01" placeholder="0,00" value={l.prix_unitaire} onChange={e => updateLigne(i, "prix_unitaire", e.target.value)} />
                    <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 500, padding: "0 8px" }}>{formatEUR((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}</span>
                  </div>
                ))}
                <button style={{ ...S.linkBtn, marginBottom: 16 }} onClick={addFactureLigne}>+ Ajouter une ligne</button>
                <div style={{ ...S.netPreview, marginBottom: 12 }}>
                  <div style={{ ...S.netRow, fontWeight: 600 }}><span>Total HT</span><span>{formatEUR(totalFacture())}</span></div>
                  <div style={{ ...S.netRow, fontSize: 11, color: "#6B7A8D" }}><span>TVA non applicable — article 293 B du CGI</span><span>0,00 €</span></div>
                  <div style={{ ...S.netRow, fontWeight: 600, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 4 }}><span>Total TTC</span><span>{formatEUR(totalFacture())}</span></div>
                </div>
                <textarea style={{ ...S.input, height: 60, resize: "none" }} placeholder="Notes (optionnel)" value={factureForm.notes} onChange={e => setFactureForm({ ...factureForm, notes: e.target.value })} />
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={S.btnPrimary} onClick={() => saveFacture(editingInvoiceId ? undefined : "brouillon")}>{editingInvoiceId ? "Enregistrer les modifications" : "Enregistrer en brouillon"}</button>
                  {!editingInvoiceId && <button style={S.btnSecondary} onClick={() => saveFacture("envoyee")}>Enregistrer et marquer envoyée</button>}
                  <button style={S.btnSecondary} onClick={() => { setShowNewFacture(false); resetFactureForm(); }}>Annuler</button>
                </div>
                <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10 }}>
                  Cette facture ne compte dans votre CA encaissé que lorsqu'elle est marquée « Payée ».
                </p>
              </div>
            )}

            <div style={S.card}>
              {invoicesLoading ? (
                <p style={S.empty}>Chargement…</p>
              ) : invoicesList.length === 0 ? (
                <p style={S.empty}>Aucune facture créée. Commencez par en créer une !</p>
              ) : invoicesList.map(inv => {
                const overdue = invoiceIsOverdue(inv);
                const info = INVOICE_STATUT_INFO[inv.statut] || INVOICE_STATUT_INFO.brouillon;
                return (
                  <div key={inv.id} onClick={() => setViewingInvoice(inv)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: "0.5px solid #EEF2F7", background: overdue ? "#FCEBEB" : "transparent", margin: overdue ? "0 -20px" : 0, paddingLeft: overdue ? 20 : 0, paddingRight: overdue ? 20 : 0, cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{inv.client_nom}</div>
                      {overdue ? (
                        <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 2 }}>
                          <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 13, verticalAlign: -2 }} /> {inv.numero} · en retard de {joursDeRetard(inv)}j (échéance {formatDate(inv.date_echeance)})
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                          {inv.numero} · émise le {formatDate(inv.date_emission)}{inv.date_echeance ? ` · échéance ${formatDate(inv.date_echeance)}` : ""}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 600, color: INK, minWidth: 80, textAlign: "right", flexShrink: 0 }}>{formatEUR(inv.montant)}</span>
                    {inv.statut === "envoyee" || inv.statut === "impayee" ? (
                      <select onClick={e => e.stopPropagation()} style={{ ...S.toggleBtn, flex: "0 0 auto", padding: "5px 8px", fontSize: 11 }} value={inv.statut} onChange={e => handleInvoiceStatus(inv.id, e.target.value)}>
                        <option value="envoyee">Envoyée</option>
                        <option value="impayee">Impayée</option>
                        <option value="payee">Marquer payée</option>
                      </select>
                    ) : (
                      <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{info.label}</span>
                    )}
                    {inv.statut === "brouillon" && (
                      <button onClick={e => { e.stopPropagation(); handleInvoiceStatus(inv.id, "envoyee"); }} style={{ ...S.linkBtn, fontSize: 11, whiteSpace: "nowrap" }}>Marquer envoyée</button>
                    )}
                    <button aria-label="Voir" onClick={e => { e.stopPropagation(); setViewingInvoice(inv); }} style={{ background: "none", border: "1px solid #DDE5EE", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D", flexShrink: 0, cursor: "pointer" }}>
                      <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: 15 }} />
                    </button>
                    <button aria-label="PDF" onClick={e => { e.stopPropagation(); handleViewInvoicePdf(inv); }} style={{ background: "none", border: "1px solid #DDE5EE", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D", flexShrink: 0, cursor: "pointer" }}>
                      <i className="ti ti-file-type-pdf" aria-hidden="true" style={{ fontSize: 15 }} />
                    </button>
                    <button aria-label="Modifier" onClick={e => { e.stopPropagation(); startEditInvoice(inv); }} style={{ background: "none", border: "1px solid #DDE5EE", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D", flexShrink: 0, cursor: "pointer" }}>
                      <i className="ti ti-edit" aria-hidden="true" style={{ fontSize: 15 }} />
                    </button>
                    <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); handleDeleteInvoice(inv.id); }} style={S.deleteBtn}>✕</button>
                  </div>
                );
              })}
            </div>
            {invoicesList.length > 0 && (
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10, textAlign: "center" }}>
                Seules les factures « Payée » comptent dans votre CA encaissé.
              </p>
            )}

            {viewingInvoice && (() => {
              const inv = viewingInvoice;
              const info = INVOICE_STATUT_INFO[inv.statut] || INVOICE_STATUT_INFO.brouillon;
              const lignes = inv.lignes && inv.lignes.length > 0 ? inv.lignes : [];
              const totalHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
              return (
                <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 16 }} onClick={() => setViewingInvoice(null)}>
                  <div style={{ background: "white", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "28px 28px 24px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{inv.numero}</div>
                        <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8, display: "inline-block", marginTop: 6 }}>{info.label}</span>
                      </div>
                      <button aria-label="Fermer" onClick={() => setViewingInvoice(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#8BA5C0", cursor: "pointer", padding: 4 }}>✕</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", marginBottom: 6 }}>Émetteur</div>
                        <div style={{ fontSize: 13, color: INK, lineHeight: 1.6 }}>
                          <strong>{profilEntreprise || `${profilPrenom} ${profilNom}`.trim() || "—"}</strong><br />
                          {profilAdresse || <span style={{ color: "#C0392B" }}>Adresse manquante</span>}<br />
                          {profilSiret ? `SIRET : ${profilSiret}` : <span style={{ color: "#C0392B" }}>SIRET manquant</span>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", marginBottom: 6 }}>Client</div>
                        <div style={{ fontSize: 13, color: INK, lineHeight: 1.6 }}>
                          <strong>{inv.client_nom}</strong><br />
                          {inv.client_adresse || "—"}<br />
                          {inv.client_email || ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 13 }}>
                      <div><span style={{ color: "#8BA5C0" }}>Émise le </span><strong>{formatDate(inv.date_emission)}</strong></div>
                      {inv.date_echeance && <div><span style={{ color: "#8BA5C0" }}>Échéance </span><strong>{formatDate(inv.date_echeance)}</strong></div>}
                    </div>

                    <div style={{ border: "1px solid #EEF2F7", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#F7F9F5", fontSize: 11, color: "#6B7A8D", fontWeight: 600 }}>
                        <span style={{ flex: 3 }}>Description</span>
                        <span style={{ flex: 1, textAlign: "center" }}>Qté</span>
                        <span style={{ flex: 1, textAlign: "right" }}>PU</span>
                        <span style={{ flex: 1, textAlign: "right" }}>Total</span>
                      </div>
                      {lignes.map((l, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, padding: "10px 12px", fontSize: 13, borderTop: "1px solid #EEF2F7" }}>
                          <span style={{ flex: 3, color: INK }}>{l.description}</span>
                          <span style={{ flex: 1, textAlign: "center", color: "#6B7A8D" }}>{l.quantite}</span>
                          <span style={{ flex: 1, textAlign: "right", color: "#6B7A8D" }}>{formatEUR(l.prix_unitaire)}</span>
                          <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: INK }}>{formatEUR((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "#F7F9F5", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}><span>Total HT</span><span>{formatEUR(totalHT)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7A8D", marginTop: 4 }}><span>TVA non applicable — article 293 B du CGI</span><span>0,00 €</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 8 }}><span>Total TTC</span><span>{formatEUR(inv.montant)}</span></div>
                    </div>

                    {inv.notes && (
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 16, lineHeight: 1.5 }}>
                        <strong>Notes :</strong> {inv.notes}
                      </div>
                    )}

                    <div style={{ background: "#F7F9F5", border: "1px solid #DDE5EE", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 8 }}>
                        <i className="ti ti-mail" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Envoyer au client
                      </div>
                      {!inv.client_email ? (
                        <p style={{ fontSize: 12, color: "#854F0B", margin: 0 }}>
                          Aucun email renseigné pour ce client. <button type="button" style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => { setViewingInvoice(null); startEditInvoice(inv); }}>Ajouter un email →</button>
                        </p>
                      ) : sendInvoiceStatus === "sent" ? (
                        <p style={{ fontSize: 12, color: "#0F6E56", fontWeight: 600, margin: 0 }}>✓ Facture envoyée à {inv.client_email}</p>
                      ) : (
                        <>
                          <p style={{ fontSize: 12, color: "#8BA5C0", margin: "0 0 8px" }}>Sera envoyée à <strong>{inv.client_email}</strong></p>
                          <textarea
                            style={{ ...S.input, height: 50, resize: "none", marginBottom: 8 }}
                            placeholder="Message personnalisé (optionnel)"
                            value={sendInvoiceMessage}
                            onChange={e => setSendInvoiceMessage(e.target.value)}
                          />
                          {sendInvoiceStatus === "error" && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 8px" }}>{sendInvoiceError}</p>}
                          <button style={S.btnSecondary} onClick={() => handleSendInvoice(inv)} disabled={sendingInvoice}>
                            {sendingInvoice ? "Envoi…" : <><i className="ti ti-send" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Envoyer la facture</>}
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button style={S.btnPrimary} onClick={() => handleViewInvoicePdf(inv)} disabled={loadingPdf}>
                        <i className="ti ti-file-type-pdf" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />{loadingPdf ? "Génération…" : "Voir / Télécharger le PDF"}
                      </button>
                      <button style={S.btnSecondary} onClick={() => { setViewingInvoice(null); startEditInvoice(inv); }}>
                        <i className="ti ti-edit" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Modifier
                      </button>
                      <button style={S.btnSecondary} onClick={() => { setViewingInvoice(null); setSendInvoiceStatus(""); setSendInvoiceMessage(""); }}>Fermer</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {nav === "devis" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>Devis</h1><p style={S.pageSub}>Préparez vos propositions commerciales</p></div>
              <button style={S.btnPrimarySmall} onClick={() => { resetQuoteForm(); setShowNewQuote(!showNewQuote); }}>+ Nouveau devis</button>
            </div>

            {quotesSummary && (
              <div style={isMobile ? { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr" } : S.kpiGrid}>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Total devis</span><span style={S.kpiValue}>{formatEUR(quotesSummary.total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Acceptés</span><span style={{ ...S.kpiValue, color: "#1D9E75" }}>{formatEUR(quotesSummary.accepte_total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>En attente</span><span style={{ ...S.kpiValue, color: "#854F0B" }}>{formatEUR(quotesSummary.en_attente_total)}</span></div>
                <div style={S.kpiCard}><span style={S.kpiLabel}>Taux de conversion</span><span style={S.kpiValue}>{quotesSummary.taux_conversion !== null ? `${quotesSummary.taux_conversion}%` : "—"}</span></div>
              </div>
            )}

            {showNewQuote && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>{editingQuoteId ? "Modifier le devis" : "Nouveau devis"}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input style={S.input} placeholder="Nom du client" value={quoteForm.client_nom} onChange={e => setQuoteForm({ ...quoteForm, client_nom: e.target.value })} />
                  <input style={S.input} placeholder="Email du client" type="email" value={quoteForm.client_email} onChange={e => setQuoteForm({ ...quoteForm, client_email: e.target.value })} />
                </div>
                <input style={{ ...S.input, marginBottom: 10 }} placeholder="Adresse du client" value={quoteForm.client_adresse} onChange={e => setQuoteForm({ ...quoteForm, client_adresse: e.target.value })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <label style={{ ...S.label, marginBottom: 0 }}>Date d'émission
                    <input style={S.input} type="date" value={quoteForm.date_emission} onChange={e => setQuoteForm({ ...quoteForm, date_emission: e.target.value })} />
                  </label>
                  <label style={{ ...S.label, marginBottom: 0 }}>Valable jusqu'au (optionnel)
                    <input style={S.input} type="date" value={quoteForm.date_validite} onChange={e => setQuoteForm({ ...quoteForm, date_validite: e.target.value })} />
                  </label>
                </div>
                <div style={S.factureHeaderRow}>
                  <span style={{ flex: 3, fontSize: 12, color: "#6B7A8D" }}>Description</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "center" }}>Qté</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Prix unitaire</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>Total</span>
                </div>
                {quoteForm.lignes.map((l, i) => (
                  <div key={i} style={S.factureRow}>
                    <input style={{ ...S.input, flex: 3 }} placeholder="Prestation" value={l.description} onChange={e => updateQuoteLigne(i, "description", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "center" }} type="number" min="1" value={l.quantite} onChange={e => updateQuoteLigne(i, "quantite", e.target.value)} />
                    <input style={{ ...S.input, flex: 1, textAlign: "right" }} type="number" step="0.01" placeholder="0,00" value={l.prix_unitaire} onChange={e => updateQuoteLigne(i, "prix_unitaire", e.target.value)} />
                    <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 500, padding: "0 8px" }}>{formatEUR((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}</span>
                  </div>
                ))}
                <button style={{ ...S.linkBtn, marginBottom: 16 }} onClick={addQuoteLigne}>+ Ajouter une ligne</button>
                <div style={{ ...S.netPreview, marginBottom: 12 }}>
                  <div style={{ ...S.netRow, fontWeight: 600 }}><span>Total HT</span><span>{formatEUR(totalQuote())}</span></div>
                  <div style={{ ...S.netRow, fontSize: 11, color: "#6B7A8D" }}><span>TVA non applicable — article 293 B du CGI</span><span>0,00 €</span></div>
                  <div style={{ ...S.netRow, fontWeight: 600, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 4 }}><span>Total TTC</span><span>{formatEUR(totalQuote())}</span></div>
                </div>
                <textarea style={{ ...S.input, height: 60, resize: "none" }} placeholder="Notes (optionnel)" value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} />
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={S.btnPrimary} onClick={() => saveQuote(editingQuoteId ? undefined : "brouillon")}>{editingQuoteId ? "Enregistrer les modifications" : "Enregistrer en brouillon"}</button>
                  {!editingQuoteId && <button style={S.btnSecondary} onClick={() => saveQuote("envoye")}>Enregistrer et marquer envoyé</button>}
                  <button style={S.btnSecondary} onClick={() => { setShowNewQuote(false); resetQuoteForm(); }}>Annuler</button>
                </div>
              </div>
            )}

            <div style={S.card}>
              {quotesLoading ? (
                <p style={S.empty}>Chargement…</p>
              ) : quotesList.length === 0 ? (
                <p style={S.empty}>Aucun devis créé. Commencez par en créer un !</p>
              ) : quotesList.map(q => {
                const info = QUOTE_STATUT_INFO[q.statut] || QUOTE_STATUT_INFO.brouillon;
                return (
                  <div key={q.id} onClick={() => setViewingQuote(q)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", borderBottom: "0.5px solid #EEF2F7", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{q.client_nom}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                        {q.numero} · émis le {formatDate(q.date_emission)}{q.date_validite ? ` · valable jusqu'au ${formatDate(q.date_validite)}` : ""}
                        {q.converted_invoice_id && <span style={{ color: "#0F6E56", fontWeight: 600 }}> · converti en facture</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 600, color: INK, minWidth: 80, textAlign: "right", flexShrink: 0 }}>{formatEUR(q.montant)}</span>
                    {q.statut === "envoye" ? (
                      <select onClick={e => e.stopPropagation()} style={{ ...S.toggleBtn, flex: "0 0 auto", padding: "5px 8px", fontSize: 11 }} value={q.statut} onChange={e => handleQuoteStatus(q.id, e.target.value)}>
                        <option value="envoye">Envoyé</option>
                        <option value="accepte">Marquer accepté</option>
                        <option value="refuse">Marquer refusé</option>
                        <option value="expire">Marquer expiré</option>
                      </select>
                    ) : (
                      <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{info.label}</span>
                    )}
                    <button aria-label="Voir" onClick={e => { e.stopPropagation(); setViewingQuote(q); }} style={{ background: "none", border: "1px solid #DDE5EE", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D", flexShrink: 0, cursor: "pointer" }}>
                      <i className="ti ti-eye" aria-hidden="true" style={{ fontSize: 15 }} />
                    </button>
                    <button aria-label="Modifier" onClick={e => { e.stopPropagation(); startEditQuote(q); }} style={{ background: "none", border: "1px solid #DDE5EE", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D", flexShrink: 0, cursor: "pointer" }}>
                      <i className="ti ti-edit" aria-hidden="true" style={{ fontSize: 15 }} />
                    </button>
                    <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); handleDeleteQuote(q.id); }} style={S.deleteBtn}>✕</button>
                  </div>
                );
              })}
            </div>

            {viewingQuote && (() => {
              const q = viewingQuote;
              const info = QUOTE_STATUT_INFO[q.statut] || QUOTE_STATUT_INFO.brouillon;
              const lignes = q.lignes && q.lignes.length > 0 ? q.lignes : [];
              const totalHT = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
              return (
                <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 16 }} onClick={() => setViewingQuote(null)}>
                  <div style={{ background: "white", borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "28px 28px 24px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{q.numero}</div>
                        <span style={{ background: info.bg, color: info.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8, display: "inline-block", marginTop: 6 }}>{info.label}</span>
                      </div>
                      <button aria-label="Fermer" onClick={() => setViewingQuote(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#8BA5C0", cursor: "pointer", padding: 4 }}>✕</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", marginBottom: 6 }}>Émetteur</div>
                        <div style={{ fontSize: 13, color: INK, lineHeight: 1.6 }}>
                          <strong>{profilEntreprise || `${profilPrenom} ${profilNom}`.trim() || "—"}</strong><br />
                          {profilAdresse || <span style={{ color: "#C0392B" }}>Adresse manquante</span>}<br />
                          {profilSiret ? `SIRET : ${profilSiret}` : <span style={{ color: "#C0392B" }}>SIRET manquant</span>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", marginBottom: 6 }}>Client</div>
                        <div style={{ fontSize: 13, color: INK, lineHeight: 1.6 }}>
                          <strong>{q.client_nom}</strong><br />
                          {q.client_adresse || "—"}<br />
                          {q.client_email || ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 13 }}>
                      <div><span style={{ color: "#8BA5C0" }}>Émis le </span><strong>{formatDate(q.date_emission)}</strong></div>
                      {q.date_validite && <div><span style={{ color: "#8BA5C0" }}>Valable jusqu'au </span><strong>{formatDate(q.date_validite)}</strong></div>}
                    </div>

                    <div style={{ border: "1px solid #EEF2F7", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                      <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "#F7F9F5", fontSize: 11, color: "#6B7A8D", fontWeight: 600 }}>
                        <span style={{ flex: 3 }}>Description</span>
                        <span style={{ flex: 1, textAlign: "center" }}>Qté</span>
                        <span style={{ flex: 1, textAlign: "right" }}>PU</span>
                        <span style={{ flex: 1, textAlign: "right" }}>Total</span>
                      </div>
                      {lignes.map((l, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, padding: "10px 12px", fontSize: 13, borderTop: "1px solid #EEF2F7" }}>
                          <span style={{ flex: 3, color: INK }}>{l.description}</span>
                          <span style={{ flex: 1, textAlign: "center", color: "#6B7A8D" }}>{l.quantite}</span>
                          <span style={{ flex: 1, textAlign: "right", color: "#6B7A8D" }}>{formatEUR(l.prix_unitaire)}</span>
                          <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: INK }}>{formatEUR((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "#F7F9F5", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}><span>Total HT</span><span>{formatEUR(totalHT)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7A8D", marginTop: 4 }}><span>TVA non applicable — article 293 B du CGI</span><span>0,00 €</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #DDE5EE", paddingTop: 8, marginTop: 8 }}><span>Total TTC</span><span>{formatEUR(q.montant)}</span></div>
                    </div>

                    {q.notes && (
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 16, lineHeight: 1.5 }}>
                        <strong>Notes :</strong> {q.notes}
                      </div>
                    )}

                    {q.converted_invoice_id ? (
                      <div style={{ background: "#E1F5EE", border: "1px solid #5DCAA5", borderRadius: 10, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                        <i className="ti ti-circle-check" aria-hidden="true" style={{ fontSize: 18, color: "#0F6E56" }} />
                        <span style={{ fontSize: 13, color: "#0F6E56", fontWeight: 600 }}>Déjà converti en facture</span>
                      </div>
                    ) : (
                      <div style={{ background: "#F4F9FF", border: "1px solid #D6E8FA", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>
                          <i className="ti ti-arrow-right-circle" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Devis accepté ?
                        </div>
                        <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 10px" }}>Convertissez-le en facture sans tout retaper.</p>
                        <button style={S.btnPrimary} onClick={() => handleConvertQuote(q)} disabled={convertingQuote}>
                          {convertingQuote ? "Conversion…" : "Convertir en facture"}
                        </button>
                      </div>
                    )}

                    <div style={{ background: "#F7F9F5", border: "1px solid #DDE5EE", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 8 }}>
                        <i className="ti ti-mail" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Envoyer au client
                      </div>
                      {!q.client_email ? (
                        <p style={{ fontSize: 12, color: "#854F0B", margin: 0 }}>
                          Aucun email renseigné pour ce client. <button type="button" style={{ ...S.linkBtn, fontSize: 12 }} onClick={() => { setViewingQuote(null); startEditQuote(q); }}>Ajouter un email →</button>
                        </p>
                      ) : sendQuoteStatus === "sent" ? (
                        <p style={{ fontSize: 12, color: "#0F6E56", fontWeight: 600, margin: 0 }}>✓ Devis envoyé à {q.client_email}</p>
                      ) : (
                        <>
                          <p style={{ fontSize: 12, color: "#8BA5C0", margin: "0 0 8px" }}>Sera envoyé à <strong>{q.client_email}</strong></p>
                          <textarea
                            style={{ ...S.input, height: 50, resize: "none", marginBottom: 8 }}
                            placeholder="Message personnalisé (optionnel)"
                            value={sendQuoteMessage}
                            onChange={e => setSendQuoteMessage(e.target.value)}
                          />
                          {sendQuoteStatus === "error" && <p style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 8px" }}>{sendQuoteError}</p>}
                          <button style={S.btnSecondary} onClick={() => handleSendQuote(q)} disabled={sendingQuote}>
                            {sendingQuote ? "Envoi…" : <><i className="ti ti-send" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Envoyer le devis</>}
                          </button>
                        </>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={S.btnPrimary} onClick={() => { setViewingQuote(null); startEditQuote(q); }}>
                        <i className="ti ti-edit" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />Modifier
                      </button>
                      <button style={S.btnSecondary} onClick={() => { setViewingQuote(null); setSendQuoteStatus(""); setSendQuoteMessage(""); }}>Fermer</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {nav === "frais" && (() => {
          const plusGrosPoste = expensesSummary?.par_categorie?.[0] || null;
          const totalAnnee = expensesSummary?.frais_annee || 0;
          return (
            <div>
              <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
                <div><h1 style={S.pageTitle}>Frais d'entreprise</h1><p style={S.pageSub}>Vos dépenses professionnelles</p></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ ...S.btnSecondary, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                    <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => e.target.files[0] && handleUploadExpenseInvoice(e.target.files[0])} style={{ display: "none" }} />
                    {uploadingExpenseFile ? "Lecture…" : "📄 Importer une facture"}
                  </label>
                  <button style={S.btnPrimarySmall} onClick={() => setShowAddExpense(!showAddExpense)}>+ Ajouter un frais</button>
                </div>
              </div>

              {expensesSummary && (
                <div style={isMobile ? { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr" } : { ...S.kpiGrid, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <div style={S.kpiCard}><span style={S.kpiLabel}>Frais du mois</span><span style={S.kpiValue}>{formatEUR(expensesSummary.frais_mois)}</span></div>
                  <div style={S.kpiCard}><span style={S.kpiLabel}>Frais de l'année</span><span style={S.kpiValue}>{formatEUR(totalAnnee)}</span></div>
                  <div style={S.kpiCard}><span style={S.kpiLabel}>Plus gros poste</span><span style={{ ...S.kpiValue, fontSize: 16 }}>{plusGrosPoste ? `${labelCategorie(plusGrosPoste.categorie)} (${formatEUR(plusGrosPoste.montant)})` : "—"}</span></div>
                  <div style={S.kpiCard}><span style={S.kpiLabel}>Moyenne mensuelle</span><span style={{ ...S.kpiValue, fontSize: 18 }}>{moyenneMensuelleFrais > 0 ? formatEUR(moyenneMensuelleFrais) : "—"}</span></div>
                </div>
              )}

              {expensesSummary?.par_categorie?.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.cardTitle}>Répartition par catégorie (cette année)</div>
                  {expensesSummary.par_categorie.map(c => {
                    const pct = totalAnnee > 0 ? Math.round((c.montant / totalAnnee) * 100) : 0;
                    return (
                      <div key={c.categorie} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: INK, width: 140, flexShrink: 0 }}>{labelCategorie(c.categorie)}</span>
                        <div style={{ flex: 1, height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: ACCENT }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#8BA5C0", width: 36, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: INK, width: 70, textAlign: "right", flexShrink: 0 }}>{formatEUR(c.montant)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {showAddExpense && (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 500 }}>Nouveau frais</h3>
                  <form style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={handleAddExpense}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <input style={S.input} type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                      <input style={S.input} type="number" step="0.01" placeholder="Montant €" value={expenseForm.montant} onChange={e => setExpenseForm({ ...expenseForm, montant: e.target.value })} required />
                    </div>
                    <select style={S.input} value={expenseForm.categorie} onChange={e => setExpenseForm({ ...expenseForm, categorie: e.target.value })}>
                      {CATEGORIES_FRAIS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <input style={S.input} type="text" placeholder="Description (optionnel, ex : Adobe Creative Cloud)" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={S.btnPrimary} type="submit">Ajouter</button>
                      <button type="button" style={S.btnSecondary} onClick={() => setShowAddExpense(false)}>Annuler</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={S.card}>
                {expensesLoading ? (
                  <p style={S.empty}>Chargement…</p>
                ) : expensesList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 20px" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 8 }}>Aucun frais enregistré</div>
                    <div style={{ fontSize: 13, color: "#8BA5C0", marginBottom: 16 }}>Importe une facture ou ajoute un frais manuellement.</div>
                  </div>
                ) : expensesList.map(exp => (
                  <div key={exp.id}
                    onClick={() => setSelectedExpense(exp)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "0.5px solid #EEF2F7", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧾</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exp.description || labelCategorie(exp.categorie)}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{formatDate(exp.date)}</div>
                    </div>
                    <span style={{ background: "#E6F1FB", color: "#0C447C", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{labelCategorie(exp.categorie)}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: INK, minWidth: 60, textAlign: "right", flexShrink: 0 }}>{formatEUR(exp.montant)}</span>
                    <button aria-label="Supprimer" onClick={e => { e.stopPropagation(); handleDeleteExpense(exp.id); }} style={S.deleteBtn}>✕</button>
                  </div>
                ))}
              </div>

              {/* Modal détail frais — rendu au niveau principal via portal ci-dessous */}
            </div>
          );
        })()}

        {nav === "contacts" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>Contacts</h1><p style={S.pageSub}>Vos clients</p></div>
              <button style={S.btnPrimarySmall} onClick={() => setShowAddContact(!showAddContact)}>+ Ajouter</button>
            </div>
            {showAddContact && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input style={S.input} placeholder="Nom / Société" value={contactForm.nom} onChange={e => setContactForm({ ...contactForm, nom: e.target.value })} />
                  <input style={S.input} placeholder="Email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
                  <input style={S.input} placeholder="SIRET (optionnel)" value={contactForm.siret} onChange={e => setContactForm({ ...contactForm, siret: e.target.value })} />
                  <input style={S.input} placeholder="Adresse" value={contactForm.adresse} onChange={e => setContactForm({ ...contactForm, adresse: e.target.value })} />
                </div>
                <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={handleAddContact}>Enregistrer</button>
              </div>
            )}
            {invoicesList.filter(i => i.statut === "payee").length > 0 && (() => {
              const payees = invoicesList.filter(i => i.statut === "payee");
              const parClient = {};
              payees.forEach(f => { parClient[f.client_nom] = (parClient[f.client_nom] || 0) + f.montant; });
              const totalCa = Object.values(parClient).reduce((a, b) => a + b, 0);
              const meilleur = Object.entries(parClient).sort((a, b) => b[1] - a[1])[0];
              const concentration = meilleur && totalCa > 0 ? Math.round((meilleur[1] / totalCa) * 100) : 0;
              return (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.cardTitle}>Analyse client</div>
                  <div style={S.paniqueLine}><span style={S.paniqueLineLabel}><i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#EF9F27" }} />Meilleur client</span><span style={{ fontWeight: 600 }}>{meilleur?.[0]} ({formatEUR(meilleur?.[1])})</span></div>
                  {concentration >= 50 && (
                    <div style={{ ...S.achatResult, background: "#FAEEDA", color: "#854F0B", marginTop: 10 }}>
                      <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 18 }} />
                      <div style={{ fontSize: 12 }}><strong>{concentration}%</strong> de votre CA facturé vient d'un seul client. Risque de dépendance élevé.</div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={S.card}>
              {contactsLoading ? <p style={S.empty}>Chargement…</p> : contacts.length === 0 ? <p style={S.empty}>Aucun contact. Ajoutez vos clients pour pré-remplir vos factures.</p> : contacts.map(c => (
                <div key={c.id} style={S.incomeRow}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: "#0C447C", flexShrink: 0 }}>{c.nom.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <span style={S.incomeAmt}>{c.nom}</span>
                    <span style={S.incomeMeta}>{c.email}{c.siret ? ` · SIRET ${c.siret}` : ""}</span>
                  </div>
                  <button aria-label="Supprimer" onClick={() => handleDeleteContact(c.id)} style={S.deleteBtn}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "profil" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div><h1 style={S.pageTitle}>👤 Profil</h1><p style={S.pageSub}>Personnalisez H€CTOR</p></div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={S.profilAvatar}>{(profilPrenom?.[0] || profile?.email?.[0] || "?").toUpperCase()}{profilNom?.[0]?.toUpperCase() || ""}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{profilPrenom || profilNom ? `${profilPrenom} ${profilNom}`.trim() : "Complétez votre profil"}</div>
                  <div style={{ fontSize: 12, color: "#8BA5C0" }}>{profile?.email}</div>
                </div>
              </div>

              {/* ── Statut du compte (bascule auto-entrepreneur / intermittent) ── */}
              <div style={{ background: "#F7FAFC", border: "1px solid #E2E9F0", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>Ton statut</div>
                <div style={{ fontSize: 12, color: "#8BA5C0", marginBottom: 12 }}>Change le cockpit affiché par H€CTOR. Réversible à tout moment.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { id: "auto_entrepreneur", label: "Auto-entrepreneur", icon: "ti-briefcase" },
                    { id: "intermittent", label: "Intermittent du spectacle", icon: "ti-movie" },
                  ].map(opt => {
                    const actif = profile?.statut === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={statutSaving}
                        onClick={() => handleChangeStatut(opt.id)}
                        style={{
                          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                          background: actif ? "#5DCAA5" : "white",
                          color: actif ? "#04342C" : INK,
                          border: `1.5px solid ${actif ? "#5DCAA5" : "#E2E9F0"}`,
                          borderRadius: 8, padding: "12px 10px", fontSize: 12.5, fontWeight: 600,
                          cursor: statutSaving ? "default" : "pointer", fontFamily: "inherit",
                          opacity: statutSaving ? 0.6 : 1,
                        }}
                      >
                        <i className={`ti ${opt.icon}`} aria-hidden="true" style={{ fontSize: 20 }} />
                        {opt.label}
                        {actif && <span style={{ fontSize: 10, fontWeight: 700 }}>✓ Actif</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <label style={S.label}>Prénom
                  <input style={S.input} type="text" value={profilPrenom} onChange={e => setProfilPrenom(e.target.value)} placeholder="Ex : Jean" />
                </label>
                <label style={S.label}>Nom
                  <input style={S.input} type="text" value={profilNom} onChange={e => setProfilNom(e.target.value)} placeholder="Ex : Dupont" />
                </label>
                <label style={S.label}>Téléphone
                  <input style={S.input} type="tel" value={profilTelephone} onChange={e => setProfilTelephone(e.target.value)} placeholder="Ex : 06 12 34 56 78" />
                </label>
                <label style={S.label}>Entreprise
                  <input style={S.input} type="text" value={profilEntreprise} onChange={e => setProfilEntreprise(e.target.value)} placeholder="Ex : Mon Entreprise" />
                </label>
                <label style={S.label}>SIRET
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...S.input, flex: 1 }} type="text" value={profilSiret} onChange={e => { setProfilSiret(e.target.value); setSiretLookupStatus(""); }} placeholder="123 456 789 00012" />
                    <button type="button" style={{ ...S.btnPrimary, width: "auto", padding: "0 16px", whiteSpace: "nowrap" }} onClick={handleLookupSiret} disabled={!profilSiret || siretLookupStatus === "loading"}>
                      {siretLookupStatus === "loading" ? "…" : "Vérifier"}
                    </button>
                  </div>
                  {siretLookupMessage && (
                    <p style={{ fontSize: 11, marginTop: 4, color: siretLookupStatus === "error" ? "#C0392B" : "#2E8B57" }}>
                      {siretLookupStatus === "error" ? "⚠️ " : "✓ "}{siretLookupMessage}
                    </p>
                  )}
                </label>
                <label style={S.label}>Statut juridique
                  <input style={{ ...S.input, background: "#FAFBFC", color: "#8BA5C0" }} type="text" value={profile?.statut === "auto_entrepreneur" ? "Auto-entrepreneur" : profile?.statut || "—"} readOnly />
                </label>
                <label style={{ ...S.label, gridColumn: isMobile ? "auto" : "1 / -1" }}>Adresse professionnelle <span style={{ fontWeight: 400, color: "#8BA5C0" }}>(obligatoire sur vos factures)</span>
                  <input style={S.input} type="text" value={profilAdresse} onChange={e => setProfilAdresse(e.target.value)} placeholder="Ex : 12 rue de la Paix, 75002 Paris" />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <button type="button" style={{ ...S.btnPrimary, width: "auto", padding: "10px 20px" }} onClick={handleSaveProfileDetails} disabled={profileDetailsSaving}>
                  {profileDetailsSaving ? "…" : "Enregistrer"}
                </button>
                {profileDetailsSaved && <span style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600 }}>✓ Enregistré</span>}
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10 }}>
                Activité : {ACTIVITES.find(a => a.id === profile?.activite)?.label || "—"} · pour changer de statut ou d'activité, contactez le support.
              </p>
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>🛡️ Réserve de sécurité & fiscalité</div>
              <p style={{ fontSize: 11, color: "#8BA5C0", margin: "-8px 0 14px" }}>
                Modifiable ici à tout moment — y compris en cas de déficit, où ce réglage n'apparaît pas ailleurs.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <label style={S.label}>Réserve de sécurité
                  <input style={S.input} type="number" step="50" value={objectifSecurite} onChange={e => setObjectifSecurite(e.target.value)} placeholder="Ex : 3000" />
                </label>
                <label style={S.label}>Tranche marginale d'imposition (TMI)
                  <select style={S.input} value={tmi} onChange={e => setTmi(e.target.value)}>
                    {TMI_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label style={S.label}>Cotisation Foncière des Entreprises (CFE)
                  <input style={S.input} type="number" step="0.01" value={panique.cfe} onChange={e => setPanique({ ...panique, cfe: e.target.value })} placeholder="Souvent ~200 €/an" />
                  <span style={{ fontSize: 10, color: "#8BA5C0", marginTop: 4, display: "block" }}>Impôt local annuel dû par la plupart des entreprises, même sans local. Variable selon la commune.</span>
                </label>
                <label style={S.label}>Mon train de vie mensuel
                  <input style={S.input} type="number" step="50" value={depensesMensuelles} onChange={e => setDepensesMensuelles(e.target.value)} placeholder="Ex : 1800 €/mois" />
                  <span style={{ fontSize: 10, color: "#8BA5C0", marginTop: 4, display: "block" }}>Ce que tu dépenses environ chaque mois pour vivre. Sert à Hector pour calculer tes jours de tranquillité.</span>
                </label>
                <label style={S.label}>Mes autres revenus mensuels (optionnel)
                  <input style={S.input} type="number" step="50" inputMode="text" value={autresRevenus} onChange={e => setAutresRevenus(e.target.value)} placeholder="Ex : salaire 1 800 €/mois" />
                  <span style={{ fontSize: 10, color: "#8BA5C0", marginTop: 4, display: "block" }}>Salaire ou autre revenu en dehors de ton auto-entreprise. Hector ne calcule jamais d'URSSAF dessus — c'est juste pour avoir une vue complète de ce que tu peux te permettre.</span>
                  {autresRevenusNum > 0 && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: 12, color: INK, fontWeight: 500 }}>
                      <input type="checkbox" checked={inclureAutresRevenus} onChange={e => setInclureAutresRevenus(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      Inclure ce revenu dans « ce que je peux dépenser »
                    </label>
                  )}
                </label>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 2 }}>Sauvegardé automatiquement, synchronisé sur tous vos appareils.</p>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EEF2F7" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 6 }}>Fixer ma réserve en mois de sécurité</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[1, 3, 6].map(m => (
                    <button key={m} type="button"
                      onClick={() => setObjectifSecurite(String(Math.round(baseMensuelleSecurite * m)))}
                      style={{ ...S.toggleBtn, flex: "0 1 auto", padding: "6px 14px" }}>
                      {m} mois
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>🔒 Tes données bancaires</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#5B6573" }}>C'est toi qui gardes le contrôle</span>
                <span style={{ ...S.badge, ...S.badgeGreen }}>🟢 Tes données chez toi</span>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10, lineHeight: 1.5 }}>
                Aujourd'hui, tu mets ton solde à jour à la main en 10 secondes : tes identifiants bancaires ne nous sont jamais demandés. Bientôt, tu pourras choisir de connecter ton compte en lecture seule, via un partenaire agréé par la Banque de France — H€CTOR pourra lire ton solde, jamais toucher à ton argent. Connexion ou saisie manuelle : ce sera ton choix, à tout moment.
              </p>
            </div>

            <div style={{ ...S.card, marginTop: 14 }}>
              <div style={S.cardTitle}>🔒 Mes données</div>
              <p style={{ fontSize: 12, color: "#6B7A8D", margin: "0 0 14px", lineHeight: 1.5 }}>
                Conformément au RGPD, vous pouvez exporter l'ensemble de vos données ou supprimer définitivement votre compte H€CTOR.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" style={S.btnSecondary} onClick={handleExportData} disabled={exportingData}>
                  <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />
                  {exportingData ? "Export en cours…" : "Exporter mes données"}
                </button>
                <button type="button" style={{ ...S.btnSecondary, color: "#A32D2D", borderColor: "#E24B4A" }} onClick={() => setShowDeleteAccount(true)}>
                  <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} />
                  Supprimer mon compte
                </button>
              </div>

              {showDeleteAccount && (
                <div style={{ marginTop: 16, padding: "14px 16px", background: "#FCEBEB", border: "1px solid #F7C1C1", borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#791F1F", marginBottom: 6 }}>
                    ⚠️ Cette action est irréversible
                  </div>
                  <p style={{ fontSize: 12, color: "#791F1F", margin: "0 0 10px", lineHeight: 1.5 }}>
                    Toutes vos données (profil, revenus, factures, frais) seront définitivement supprimées. Pensez à exporter vos données avant si besoin.
                  </p>
                  <p style={{ fontSize: 12, color: "#791F1F", margin: "0 0 8px" }}>
                    Tapez <strong>SUPPRIMER</strong> pour confirmer :
                  </p>
                  <input
                    style={{ ...S.input, marginBottom: 10, maxWidth: 240 }}
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="SUPPRIMER"
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      style={{ ...S.btnPrimary, width: "auto", padding: "10px 20px", background: "#A32D2D" }}
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "SUPPRIMER" || deletingAccount}
                    >
                      {deletingAccount ? "Suppression…" : "Supprimer définitivement"}
                    </button>
                    <button type="button" style={S.btnSecondary} onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p style={{ fontSize: 11, color: "#B0B6C0", textAlign: "center", marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
              <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("mentions")}>Mentions légales</button>
              <span>·</span>
              <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("cgu")}>CGU</button>
              <span>·</span>
              <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("confidentialite")}>Confidentialité</button>
            </p>
          </div>
        )}

        {nav === "actualites" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Actualités fiscales</h1><p style={S.pageSub}>Les dernières nouvelles URSSAF et impôts</p></div></div>
            <div style={S.card}>
              {NEWS.map((n, i) => (
                <div key={i} style={{ ...S.newsItem, padding: "14px 0" }}>
                  <span style={S.newsSource}>{n.source}</span>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ ...S.newsTitle, fontSize: 14, fontWeight: 500 }}>{n.title}</a>
                  <span style={S.newsDate}>{n.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "conseils" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Conseils & optimisation</h1><p style={S.pageSub}>Pour tirer le meilleur de ton statut auto-entrepreneur</p></div></div>

            {/* ── TES DROITS FORMATION (CFP / CPF / FAF) ── */}
            {(() => {
              const act = profile?.activite || "services";
              const tauxCfp = FISCALITE.cfp[act] ?? FISCALITE.cfp.services;
              const caAnnuel = estimateData?.ca_annuel || 0;
              const cfpVersee = Math.round(caAnnuel * tauxCfp * 100) / 100;
              const faf = FISCALITE.formation.fafParActivite[act] || "ton FAF";
              return (
                <div style={{ background: "linear-gradient(135deg, #0a1322 0%, #10233f 100%)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>🎓</span>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>Tes droits à la formation</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#D6E4F2", lineHeight: 1.6, marginBottom: 14 }}>
                    Avec tes cotisations, tu paies la CFP (Contribution à la Formation Professionnelle). En échange, tu as des droits à la formation que beaucoup d'auto-entrepreneurs oublient d'utiliser. C'est de l'argent pour te former.
                  </div>
                  {caAnnuel > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#B5D4F4" }}>
                      Cette année, tu as versé environ <strong style={{ color: "#5DCAA5" }}>{formatEUR(cfpVersee)}</strong> de CFP.
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "#8BA5C0", lineHeight: 1.6 }}>
                        Mon calcul : ton CA de {formatEUR(caAnnuel)} × {(tauxCfp * 100).toFixed(1).replace(".", ",")} % (le taux CFP pour ton activité) = {formatEUR(cfpVersee)}.
                        <br />Ce taux est de 0,1 % pour la vente, 0,2 % pour les services et professions libérales, 0,3 % pour les artisans.
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>💳</span>
                      <div style={{ fontSize: 12.5, color: "#D6E4F2", lineHeight: 1.5 }}>
                        <strong>Ton CPF</strong> : crédité jusqu'à 500 €/an (plafond 5 000 €). Solde exact et formations sur <a href="https://www.moncompteformation.gouv.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#5DCAA5", fontWeight: 700, textDecoration: "underline" }}>moncompteformation.gouv.fr</a>.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🏛️</span>
                      <div style={{ fontSize: 12.5, color: "#D6E4F2", lineHeight: 1.5 }}>
                        <strong>Ton FAF ({faf})</strong> : une enveloppe annuelle en plus (souvent 600 € à 1 400 €). À demander avant le 31 décembre, sinon elle est perdue.
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "#6B8299", fontStyle: "italic" }}>
                    🐾 Les montants CPF et FAF ci-dessus sont les maximums prévus par la loi, pas ton solde réel. Ton vrai solde n'est visible que sur les plateformes officielles. Je voulais juste que tu saches que ces droits existent — beaucoup passent à côté.
                  </div>
                </div>
              );
            })()}

            <div style={S.card}>
              {CONSEILS.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: i < CONSEILS.length - 1 ? "1px solid #EEF2F7" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.emoji}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>{c.titre}</div>
                    <div style={{ fontSize: 13, color: "#5B6573", lineHeight: 1.55 }}>{c.texte}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "assistant" && (
          <div>
            {/* Header premium : grande tête d'Hector, titre fort, ambiance copilote */}
            <div style={{ background: "linear-gradient(135deg, #0A2540 0%, #1B4068 100%)", borderRadius: 16, padding: isMobile ? "20px 18px" : "24px 28px", marginBottom: 16, display: "flex", alignItems: "center", gap: isMobile ? 14 : 22, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <HectorTete size={isMobile ? 80 : 110} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "white", margin: 0, lineHeight: 1.15 }}>Hector, ton copilote</h1>
                <p style={{ fontSize: isMobile ? 13 : 14, color: "#B5D4F4", margin: "6px 0 0", lineHeight: 1.5 }}>Il connaît tes chiffres, prépare tes devis, et te dit ce que tu peux vraiment dépenser.</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "rgba(93,202,165,0.15)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 999, padding: "3px 10px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#5DCAA5", display: "inline-block", animation: "pulse 2s infinite" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#5DCAA5" }}>En ligne</span>
                </div>
              </div>
            </div>
            {aiMessages.length <= 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {quickAskQuestions.map(q => (
                  <button key={q} style={S.quickAskChip} onClick={() => { setAiInput(q); }}>{q}</button>
                ))}
              </div>
            )}
            <div style={{ ...S.card, display: "flex", flexDirection: "column", height: "calc(100vh - 260px)" }}>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
                {aiMessages.map((m, i) => {
                  const devis = m.role === "assistant" ? parseDevisBlock(m.content) : null;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
                      <div style={{ ...S.aiMsg, ...(m.role === "user" ? S.aiMsgUser : S.aiMsgBot) }}>{devis ? devis.cleanText : m.content}</div>
                      {devis && (
                        <div style={{ background: "#F4F9FF", border: `1px solid ${ACCENT}`, borderRadius: 12, padding: 16, maxWidth: 380, width: "100%" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <i className={`ti ${devis.type === "facture" ? "ti-file-invoice" : "ti-file-description"}`} aria-hidden="true" style={{ fontSize: 16 }} /> {devis.type === "facture" ? "Facture préparée" : "Devis préparé"} par Hector
                          </div>
                          <div style={{ fontSize: 13, color: INK, marginBottom: 4 }}><strong>Client :</strong> {devis.data.client_nom}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "8px 0", paddingLeft: 4 }}>
                            {devis.data.lignes.map((l, j) => (
                              <div key={j} style={{ fontSize: 12.5, color: "#42566B", display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span>{l.description || "Prestation"}{(Number(l.quantite) || 1) > 1 ? ` × ${l.quantite}` : ""}</span>
                                <span style={{ whiteSpace: "nowrap" }}>{formatEUR((Number(l.quantite) || 1) * (Number(l.prix_unitaire) || 0))}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ borderTop: "1px solid #D6E8FA", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: INK }}>
                            <span>Total</span><span>{formatEUR(devis.montant)}</span>
                          </div>
                          {devisCreated[i] ? (
                            <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1D9E75" }}>
                              ✅ {devis.type === "facture" ? "Facture créée" : "Devis créé"}{typeof devisCreated[i] === "string" ? ` (${devisCreated[i]})` : ""} — <button style={{ ...S.linkBtn, fontSize: 13 }} onClick={() => setNav(devis.type === "facture" ? "factures" : "devis")}>le voir →</button>
                            </div>
                          ) : (
                            <button
                              style={{ ...S.btnPrimary, marginTop: 12, opacity: devisCreating === i ? 0.6 : 1 }}
                              disabled={devisCreating === i}
                              onClick={() => handleCreateQuoteFromAssistant(devis, i)}
                            >
                              {devisCreating === i ? "Création…" : `Créer ${devis.type === "facture" ? "cette facture" : "ce devis"} ✓`}
                            </button>
                          )}
                          <div style={{ fontSize: 10, color: "#8BA5C0", marginTop: 8, textAlign: "center" }}>Tu pourras le modifier ou l'envoyer ensuite dans {devis.type === "facture" ? "Mes factures" : "Mes devis"}.</div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {aiLoading && <div style={{ ...S.aiMsg, ...S.aiMsgBot, color: "#8BA5C0" }}>H€CTOR réfléchit…</div>}
              </div>
              <form style={{ display: "flex", gap: 10, borderTop: "1px solid #DDE5EE", paddingTop: 14 }} onSubmit={askAI}>
                <input style={{ ...S.input, flex: 1 }} placeholder={isListening ? "🎤 Je t'écoute…" : "Pose ta question à H€CTOR…"} value={aiInput} onChange={e => setAiInput(e.target.value)} />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={isListening ? "Arrêter" : "Parler à Hector"}
                    style={{
                      ...S.btnPrimarySmall,
                      background: isListening ? "#E0533D" : "#EAF2FB",
                      color: isListening ? "white" : ACCENT,
                      border: `1px solid ${isListening ? "#E0533D" : "#CFE0F2"}`,
                      minWidth: 44,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: isListening ? "pulse 1.2s infinite" : "none",
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{isListening ? "⏹" : "🎤"}</span>
                  </button>
                )}
                <button style={S.btnPrimarySmall} type="submit" disabled={aiLoading}>Envoyer</button>
              </form>
            </div>
          </div>
        )}


        {nav === "abonnement" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Abonnement</h1><p style={S.pageSub}>H€CTOR est gratuit pendant la bêta. Voici ce qui est prévu — tu ne paies rien pour l'instant.</p></div></div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 360px))", gap: 16, justifyContent: "center" }}>
              {PLANS.map((p, i) => (
                <div key={i} style={{ ...S.card, ...(i === 1 ? { border: `2px solid ${ACCENT}` } : {}), position: "relative" }}>
                  {p.badge && <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: ACCENT, color: "white", fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 20 }}>{p.badge}</span>}
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK, marginBottom: 4 }}>{p.nom}</div>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: ACCENT }}>{p.prix}</span>
                    <span style={{ fontSize: 13, color: "#6B7A8D" }}>{p.periode}</span>
                  </div>
                  {p.features.map((f, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D4452", marginBottom: 8, lineHeight: 1.4 }}>
                      <span style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                    </div>
                  ))}
                  {i === 0 ? (
                    <button style={{ ...S.btnPrimary, marginTop: 16, background: "white", color: ACCENT, border: `1px solid ${ACCENT}` }} onClick={() => setNav("dashboard")}>
                      Continuer gratuitement
                    </button>
                  ) : (
                    <button style={{ ...S.btnPrimary, marginTop: 16, background: "#EEF2F7", color: "#9098A6", cursor: "not-allowed", border: "1px solid #DDE5EE" }} disabled>
                      Gratuit pendant la bêta
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>
      {/* ===== WALKTHROUGH ONBOARDING / AIDE ===== */}
      {showWalkthrough && (() => {
        const estIntermittent = profile && profile.statut === "intermittent";
        // Parcours dédié intermittent du spectacle (le côté "507h / cachets / AEM").
        const wtStepsIntermittent = [
          {
            img: "/hector-tete.png",
            timerLabel: "BIENVENUE SUR H€CTOR",
            title: "Bonjour, moi c'est H€CTOR.",
            sub: "Je suis ton copilote pour le régime intermittent. Mon job : compter tes heures vers tes 507h, veiller sur ta date anniversaire, et te dire où tu en es — sans que tu aies à sortir la calculatrice. En 2 minutes, je te montre tout ce que je sais faire.",
            items: [
              { icon: "ti-check", text: "Je ne remplace pas France Travail — je t'aide à y voir clair" },
              { icon: "ti-check", text: "Tu déclares tes contrats, je m'occupe des calculs" },
              { icon: "ti-check", text: "Tu peux passer cette visite à tout moment" },
            ],
            next: "Découvrir",
          },
          {
            img: "/hector-1.png",
            timerLabel: "LE COCKPIT — TON COMPTEUR 507H",
            title: "Tes 507h, toujours à jour.",
            sub: "C'est ta page d'accueil. Je convertis tes cachets en heures (1 cachet = 12h), j'additionne tout sur les 12 derniers mois glissants, et je te montre où tu en es vers les 507h qui ouvrent tes droits. Hector grandit visuellement avec ta progression, du chiot au gardien.",
            items: [
              { icon: "ti-gauge", text: "Ton total d'heures en direct, sur la fenêtre de 12 mois" },
              { icon: "ti-ticket", text: "Tes cachets convertis et additionnés automatiquement" },
              { icon: "ti-trophy", text: "Tes paliers débloqués au fil de tes heures" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-2.png",
            timerLabel: "LA DATE ANNIVERSAIRE",
            title: "Je veille sur ton échéance.",
            sub: "La date anniversaire, c'est le jour où France Travail réexamine tes droits. Renseigne-la une fois, et je te montre en permanence combien de jours il te reste — et si tu es dans les temps pour avoir tes 507h avant. Plus jamais pris(e) de court.",
            items: [
              { icon: "ti-calendar-event", text: "Le compte à rebours jusqu'à ton échéance" },
              { icon: "ti-bell", text: "Je t'alerte si le rythme n'est pas suffisant" },
              { icon: "ti-pencil", text: "Modifiable à tout moment depuis le cockpit" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-3.png",
            timerLabel: "MES ACTIVITÉS",
            title: "Ajoute un contrat en quelques secondes.",
            sub: "Dans « Mes activités », chaque cachet ou période d'heures se déclare en un instant : la date, l'employeur, le nombre. Tu peux aussi reporter d'un coup les heures que tu avais déjà faites avant d'arriver sur Hector, pour démarrer ton compteur au bon endroit.",
            items: [
              { icon: "ti-plus", text: "Saisie rapide : date, employeur, cachets ou heures" },
              { icon: "ti-history", text: "Report de tes heures déjà faites pour bien démarrer" },
              { icon: "ti-pencil", text: "Tout reste modifiable ou supprimable à tout moment" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-4.png",
            timerLabel: "SCANNER UNE AEM",
            title: "Photographie ton AEM, je lis tout.",
            sub: "L'AEM, c'est l'attestation que ton employeur t'envoie après chaque contrat. Prends-la en photo (ou PDF) : je lis l'employeur, les cachets, les heures et le salaire brut, et je remplis tout pour toi. Plusieurs attestations dans un seul fichier ? Je les détecte toutes. Tu n'as plus qu'à vérifier. Tes documents sont rangés en sécurité.",
            items: [
              { icon: "ti-camera", text: "Scan photo ou PDF : je lis et je remplis les champs" },
              { icon: "ti-eye-check", text: "Tu vérifies, tu corriges si besoin, tu valides" },
              { icon: "ti-folder", text: "Tes AEM conservées, consultables quand tu veux" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-5.png",
            timerLabel: "L'ACTUALISATION",
            title: "Chaque mois, ton récap prêt à recopier.",
            sub: "Au moment de t'actualiser auprès de France Travail, je te prépare le récap du mois écoulé : tes employeurs, tes cachets, tes heures, ton brut. Un mode guidé t'accompagne champ par champ pour recopier sans erreur, et je te signale s'il manque une AEM.",
            items: [
              { icon: "ti-list-check", text: "Le récap du mois, employeur par employeur" },
              { icon: "ti-clipboard-check", text: "Un mode guidé pour recopier sans te tromper" },
              { icon: "ti-alert-triangle", text: "Une alerte si une AEM manque encore à l'appel" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-1.png",
            timerLabel: "LE CALCUL DES HEURES",
            title: "Pose-moi tes questions.",
            sub: "« Combien me manque-t-il ? », « Si j'accepte ce contrat ? », « Et si je fais une pause ? ». Je réponds avec tes vrais chiffres, jamais à l'aveugle. Et avec le champ « Que se passe-t-il si… », tu me poses n'importe quel scénario en langage normal et je le calcule.",
            items: [
              { icon: "ti-target", text: "Combien d'heures il te reste, en cachets concrets" },
              { icon: "ti-briefcase", text: "L'impact exact d'un contrat avant de l'accepter" },
              { icon: "ti-message-circle", text: "« Que se passe-t-il si… » : ton scénario, ma réponse chiffrée" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-2.png",
            timerLabel: "PARLE À HECTOR",
            title: "Ton expert du régime, dispo 24h/24.",
            sub: "Une question sur les annexes 8 et 10, la clause de rattrapage, les congés spectacles, ta date anniversaire ? Écris-moi dans « Parle à Hector ». Je connais ton régime en profondeur et je t'explique tout simplement, sans jargon. Et je peux te dire si tu dois accepter un contrat qu'on te propose.",
            items: [
              { icon: "ti-message-2", text: "Un chat expert du régime intermittent" },
              { icon: "ti-phone-call", text: "« On te propose un contrat ? » : je te dis si tu acceptes" },
              { icon: "ti-bulb", text: "Des réponses claires, sans jargon administratif" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-3.png",
            timerLabel: "COMPRENDRE & MES DOCUMENTS",
            title: "Pour ne plus jamais te sentir perdu(e).",
            sub: "Dans « Comprendre », des fiches claires t'expliquent l'essentiel : les 507h, les annexes, la clause de rattrapage, les congés spectacles. Et dans « Mes documents », je te génère un récapitulatif de tes revenus à présenter à un proprio ou une banque, et je range tes AEM et actualisations.",
            items: [
              { icon: "ti-book", text: "Des fiches pédago pour comprendre ton régime" },
              { icon: "ti-file-text", text: "Un récap de revenus pour proprio ou banque" },
              { icon: "ti-folders", text: "Tes AEM et actualisations archivées au même endroit" },
            ],
            next: "Suivant",
          },
          {
            img: "/hector-6.png",
            timerLabel: "LA CONFIANCE",
            title: "Je te montre toujours mon raisonnement.",
            sub: "Sur chaque calcul, un badge te dit à quel point tu peux t'y fier, et un bouton « Pourquoi ? » t'explique mon raisonnement — avec les règles officielles sur lesquelles je m'appuie. Tu n'as jamais à me croire sur parole. Commence par déclarer un contrat ou scanner une AEM, et c'est parti !",
            items: [
              { icon: "ti-shield-check", text: "Un badge de confiance sur chaque réponse" },
              { icon: "ti-help-circle", text: "« Pourquoi ? » : mon raisonnement, étape par étape" },
              { icon: "ti-book", text: "Cette visite est retrouvable via « Aide » dans le menu" },
            ],
            next: "C'est parti !",
          },
        ];
        const wtStepsAuto = [
          {
            img: "/hector-tete.png",
            timerLabel: "BIENVENUE SUR H€CTOR",
            title: "Bonjour, moi c'est H€CTOR.",
            sub: "Je vais t'aider à savoir exactement ce que tu peux dépenser — sans mauvaise surprise. En 2 minutes, tu vas comprendre comment je calcule tes charges, prépare tes devis et protège ta trésorerie.",
            items: [
              { icon: "ti-check", text: "Zéro case à remplir pour commencer" },
              { icon: "ti-check", text: "Ton premier revenu suffit à tout démarrer" },
              { icon: "ti-check", text: "Tu peux passer à tout moment" },
            ],
            next: "Découvrir",
          },
          {
            img: "/niveau-1.png",
            timerLabel: "LE COCKPIT + L'ASSISTANT",
            title: "Fini les mauvaises surprises URSSAF.",
            sub: "Le Cockpit est ton tableau de bord principal. Tu y vois en temps réel ce que tu peux vraiment dépenser après charges. L'Assistant répond à toutes tes questions fiscales — par texte ou dictée vocale.",
            items: [
              { icon: "ti-check", text: "Situation saine / Fragile / Déficit en un coup d'œil" },
              { icon: "ti-check", text: "Charges URSSAF + impôts calculées automatiquement" },
              { icon: "ti-mic", text: "Assistant disponible par texte ou dictée vocale" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-2.png",
            timerLabel: "REVENUS, FRAIS & FACTURATION",
            title: "Encaisser, dépenser, facturer — tout au même endroit.",
            sub: "Ajoute un revenu ou une dépense en quelques secondes. Crée un devis, convertis-le en facture en 1 clic, et envoie-le directement par email avec PDF.",
            items: [
              { icon: "ti-check", text: "Encaisser / Frais : revenus et dépenses professionnelles" },
              { icon: "ti-check", text: "Mes factures : PDF professionnel + envoi email intégré" },
              { icon: "ti-check", text: "Mes devis : convertis en facture en 1 clic" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-3.png",
            timerLabel: "LES OUTILS",
            title: "Simule avant de décider.",
            sub: "H€CTOR met à ta disposition 5 outils de simulation pour prendre les bonnes décisions : combien te verser, si tu peux te permettre un achat, combien facturer pour vivre correctement.",
            items: [
              { icon: "ti-cash", text: "Mode Salaire — combien puis-je me verser ce mois ?" },
              { icon: "ti-shopping-cart", text: "Mode Achat — puis-je me permettre cette dépense ?" },
              { icon: "ti-target", text: "Combien gagner ? + Simulateur fiscal + Mes tarifs" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-4.png",
            timerLabel: "SUIVI & PILOTAGE",
            title: "Pilote ton activité sur le long terme.",
            sub: "Score H€CTOR note ta santé financière sur 100. Revenus te donne une vue annuelle de ton CA. Contacts centralise tes clients. Actualités et Conseils te tiennent informé des obligations fiscales.",
            items: [
              { icon: "ti-heart-rate-monitor", text: "Score H€CTOR — ta santé financière sur 100" },
              { icon: "ti-chart-bar", text: "Revenus, Contacts, Modèles de documents" },
              { icon: "ti-bell", text: "Actualités fiscales + Conseils auto-entrepreneur" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-5.png",
            timerLabel: "LA SÉRÉNITÉ D'HECTOR",
            title: "Hector grandit avec toi.",
            sub: "Chaque jour où ta trésorerie est saine, Hector avance vers son domaine. De sa première nuit chez toi jusqu'à son château — c'est ton activité qui le fait progresser.",
            items: [
              { icon: "ti-dog", text: "Hector arrive → Son panier → Sa niche → Son jardin" },
              { icon: "ti-home", text: "Sa maison → Son domaine (6 niveaux à débloquer)" },
              { icon: "ti-check", text: "Plus tu es régulier, plus vite il progresse" },
            ],
            next: "Suivant",
          },
          {
            img: "/niveau-6.png",
            timerLabel: "TU ES PRÊT(E) !",
            title: "Ta trésorerie ne te réserve plus de mauvaises surprises.",
            sub: "Commence par ajouter ton premier revenu. En 10 secondes, H€CTOR te dit exactement ce que tu peux dépenser aujourd'hui.",
            items: [
              { icon: "ti-receipt-2", text: "Ajouter un revenu ou une dépense" },
              { icon: "ti-file-plus", text: "Créer mon premier devis" },
              { icon: "ti-help-circle", text: "Retrouver cette visite via « Aide » dans le menu" },
            ],
            next: "C'est parti !",
          },
        ];
        const wtSteps = estIntermittent ? wtStepsIntermittent : wtStepsAuto;
        const WalkthroughModal = () => {
          const [wtStep, setWtStep] = useState(0);
          const s = wtSteps[wtStep];
          const closeWalkthrough = () => {
            safeStorage.setItem("hector_walkthrough_done", "1");
            setShowWalkthrough(false);
          };
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(10,37,64,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ background: "#0A2540", border: "1px solid rgba(55,138,221,0.35)", borderRadius: 18, padding: isMobile ? "28px 20px 24px" : "36px 36px 28px", maxWidth: 440, width: "100%", position: "relative", boxSizing: "border-box" }}>
                {/* Barre de progression */}
                <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: `${((wtStep + 1) / wtSteps.length) * 100}%`, background: "#378ADD", borderRadius: "18px 0 0 0", transition: "width 0.35s ease" }} />
                {/* Bouton fermer */}
                <button onClick={closeWalkthrough} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "rgba(181,212,244,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Passer <i className="ti ti-x" style={{ fontSize: 11 }} />
                </button>
                {/* Dots */}
                <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 20 }}>
                  {wtSteps.map((_, i) => (
                    <div key={i} style={{ height: 5, width: i === wtStep ? 16 : 5, borderRadius: i === wtStep ? 3 : "50%", background: i === wtStep ? "#378ADD" : "rgba(181,212,244,0.2)", transition: "all 0.2s" }} />
                  ))}
                </div>
                {/* Timer label */}
                <div style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "rgba(181,212,244,0.45)", marginBottom: 18 }}>{s.timerLabel}</div>
                {/* Avatar image niveau */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <img src={s.img} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", objectPosition: "center 40%", border: "2px solid rgba(55,138,221,0.5)", background: "#0d2d4a" }} />
                </div>
                {/* Titre */}
                <p style={{ color: "white", fontSize: 18, fontWeight: 500, textAlign: "center", margin: "0 0 10px", lineHeight: 1.35 }}>{s.title}</p>
                {/* Sous-titre */}
                <p style={{ color: "#B5D4F4", fontSize: 13.5, textAlign: "center", lineHeight: 1.65, margin: "0 auto 18px", maxWidth: 340 }}>{s.sub}</p>
                {/* Items */}
                <div style={{ background: "rgba(55,138,221,0.1)", border: "0.5px solid rgba(55,138,221,0.3)", borderRadius: 10, padding: "10px 16px", marginBottom: 22 }}>
                  {s.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, color: "#B5D4F4", fontSize: 13, padding: "4px 0" }}>
                      <i className={`ti ${it.icon}`} style={{ color: "#5DCAA5", fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                      <span>{it.text}</span>
                    </div>
                  ))}
                </div>
                {/* Navigation */}
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  {wtStep > 0 && (
                    <button onClick={() => setWtStep(wtStep - 1)} style={{ background: "transparent", color: "#B5D4F4", border: "0.5px solid rgba(181,212,244,0.3)", borderRadius: 8, padding: "10px 16px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                      Retour
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (wtStep < wtSteps.length - 1) setWtStep(wtStep + 1);
                      else closeWalkthrough();
                    }}
                    style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {s.next} {wtStep < wtSteps.length - 1 ? <i className="ti ti-arrow-right" /> : <i className="ti ti-check" />}
                  </button>
                </div>
              </div>
            </div>
          );
        };
        return <WalkthroughModal key="walkthrough" />;
      })()}
      {/* ===== MODAL DÉTAIL FRAIS ===== */}
      {selectedExpense && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,37,64,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setSelectedExpense(null)}>
          <div style={{ background: "white", borderRadius: 16, padding: "28px 28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Frais d'entreprise</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{selectedExpense.description || labelCategorie(selectedExpense.categorie)}</div>
              </div>
              <button onClick={() => setSelectedExpense(null)} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#6B7A8D" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F9FAFB", borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: "#6B7A8D" }}>Montant</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: INK }}>{formatEUR(selectedExpense.montant)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#F9FAFB", borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: "#6B7A8D" }}>Date</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{formatDate(selectedExpense.date)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#F9FAFB", borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: "#6B7A8D" }}>Catégorie</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{labelCategorie(selectedExpense.categorie)}</span>
              </div>
              {selectedExpense.description && (
                <div style={{ padding: "10px 14px", background: "#F9FAFB", borderRadius: 10 }}>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, color: INK }}>{selectedExpense.description}</div>
                </div>
              )}
            </div>
            <button
              onClick={() => { handleDeleteExpense(selectedExpense.id); setSelectedExpense(null); }}
              style={{ width: "100%", background: "#FEE2E2", color: "#991B1B", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Supprimer ce frais
            </button>
          </div>
        </div>
      )}

      {/* Toast global "✓ Sauvegardé" */}
      {savedToast && (
        <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          background: "#1D9E75", color: "white", padding: "12px 22px", borderRadius: 99,
          fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 28px rgba(29,158,117,0.4)", animation: "fadeInUp 0.3s ease-out" }}>
          <i className="ti ti-check" aria-hidden="true" style={{ fontSize: 18 }} />
          Modification enregistrée
        </div>
      )}
    </div>
  );
}

export default Sentry.withErrorBoundary(AppInner, {
  fallback: ({ resetError }) => (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: 18, fontWeight: 600, color: "#0A2540" }}>Hector a eu un petit souci 🐾</p>
      <p style={{ fontSize: 14, color: "#6B7A8D", maxWidth: 380 }}>Quelque chose a coincé de mon côté — j'ai prévenu l'équipe automatiquement. Recharge la page, je reviens tout de suite.</p>
      <button onClick={() => { resetError(); window.location.reload(); }} style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Recharger la page
      </button>
    </div>
  ),
});
