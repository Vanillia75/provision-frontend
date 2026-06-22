import { useState, useEffect, useRef, useCallback } from "react";
import * as Sentry from "@sentry/react";

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
const GOOGLE_CLIENT_ID = "1008678142157-vnr5cogc1rvhvenemcahi373adnvvpln.apps.googleusercontent.com";

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
  { icon: "ti-star", titre: "ACRE — économisez 50% la 1ère année", texte: "Si vous avez créé votre activité après juillet 2025, vos cotisations sont divisées par 2 pendant 12 mois. Pensez à faire la demande dans les 60 jours." },
  { icon: "ti-chart-bar", titre: "Versement libératoire", texte: "Payez votre impôt sur le revenu en même temps que vos cotisations, à 1,7% de votre CA. Simple et prévisible." },
  { icon: "ti-clock", titre: "Mensuel vs trimestriel", texte: "En mensuel, vous payez de petites sommes régulières. En trimestriel, vous avez plus de trésorerie mais attention aux gros versements." },
  { icon: "ti-alert-triangle", titre: "Surveillez le plafond", texte: "Au-delà de 83 600€ deux années consécutives, vous basculez en régime réel. Anticipez ce changement avec votre comptable." },
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
      "On ne se connecte jamais à ta banque",
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

const MENTIONS_LEGALES_MD = `# Mentions légales

**Dernière mise à jour : 20 juin 2026**

## Éditeur du site

L'application H€CTOR est éditée par :

**VANILLIA**, société à responsabilité limitée (SARL) au capital de 1 000 €
Siège social : 32 rue Damrémont, 75018 Paris, France
SIREN : 990 086 209
SIRET (siège) : 990 086 209 00014
RCS Paris
Gérante : Camille Gardereau
Contact : vanilliabusiness@gmail.com

## Hébergement

- **Frontend (interface de l'application)** : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis
- **Backend et base de données** : Railway Corporation, États-Unis

Les données peuvent donc être hébergées sur des serveurs situés en dehors de l'Union européenne. Voir la Politique de confidentialité pour le détail des garanties applicables à ces transferts.

## Directeur de la publication

Camille Gardereau, en sa qualité de gérante de VANILLIA.

## Propriété intellectuelle

L'ensemble des éléments composant H€CTOR (textes, structure, logiciel, base de données, identité visuelle) est la propriété de VANILLIA, sauf mention contraire. Toute reproduction, représentation, modification ou exploitation non autorisée, totale ou partielle, est interdite.

## Litiges

Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
`;

const CGU_MD = `# Conditions générales d'utilisation (CGU)

**Dernière mise à jour : 20 juin 2026**

## 1. Objet

Les présentes CGU encadrent l'accès et l'utilisation de l'application H€CTOR, éditée par VANILLIA (SARL), destinée à aider les indépendants — notamment les auto-entrepreneurs — à estimer leurs cotisations, suivre leurs revenus et dépenses professionnelles, et gérer leurs obligations déclaratives.

L'utilisation de H€CTOR implique l'acceptation pleine et entière des présentes CGU.

## 2. Description du service

H€CTOR propose, à la date des présentes :

- l'estimation du montant des cotisations sociales à provisionner, sur la base des informations renseignées par l'utilisateur ;
- le suivi des revenus encaissés et des factures clients ;
- le suivi des frais professionnels ;
- des simulateurs (achat, rémunération, fiscalité) ;
- un assistant conversationnel basé sur l'intelligence artificielle ;
- la recherche d'informations d'entreprise via le répertoire Sirene de l'INSEE.

**H€CTOR ne se substitue pas à un expert-comptable, un avocat ou tout autre professionnel du chiffre ou du droit.** Les montants et estimations affichés sont indicatifs et calculés à partir des informations fournies par l'utilisateur ; ils ne constituent ni un conseil personnalisé, ni une déclaration officielle auprès des organismes compétents (URSSAF, impôts, etc.). L'utilisateur reste seul responsable de l'exactitude de ses déclarations et du respect de ses obligations légales et fiscales.

## 3. Inscription et compte utilisateur

L'accès à H€CTOR nécessite la création d'un compte (par email/mot de passe ou via connexion Google). L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Il est responsable de toute activité réalisée depuis son compte.

Un utilisateur ne peut créer qu'un compte correspondant à sa propre identité ou à celle de l'entreprise qu'il représente légalement.

## 4. Tarifs

À la date des présentes, H€CTOR est proposé gratuitement, dans une version bêta. VANILLIA se réserve la possibilité d'introduire ultérieurement des offres payantes ; les utilisateurs en seront informés préalablement, et aucune modification tarifaire ne sera appliquée rétroactivement sans consentement.

## 5. Obligations de l'utilisateur

L'utilisateur s'engage à :

- ne pas utiliser H€CTOR à des fins frauduleuses ou illégales ;
- ne pas tenter de contourner les mesures de sécurité de l'application ;
- ne pas extraire ou réutiliser massivement les données ou le code de l'application ;
- ne renseigner que des données qu'il a le droit de communiquer (ses propres données ou celles de son entreprise).

## 6. Disponibilité du service

H€CTOR étant en version bêta, VANILLIA ne garantit pas une disponibilité continue du service. Des interruptions, bugs ou pertes de données ponctuelles peuvent survenir. L'utilisateur est invité à conserver une copie de ses documents importants (factures, justificatifs) en dehors de l'application.

## 7. Responsabilité

VANILLIA met en œuvre des moyens raisonnables pour assurer l'exactitude des calculs proposés, sans garantir l'absence totale d'erreur. La responsabilité de VANILLIA ne saurait être engagée en cas de dommage résultant d'une décision prise par l'utilisateur sur la seule base des informations fournies par H€CTOR, ou en cas d'interruption du service.

## 8. Résiliation

L'utilisateur peut supprimer son compte à tout moment depuis l'application ou en en faisant la demande à vanilliabusiness@gmail.com. VANILLIA se réserve le droit de suspendre ou supprimer un compte en cas de manquement aux présentes CGU.

## 9. Modification des CGU

VANILLIA peut modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation de H€CTOR après modification vaut acceptation des nouvelles CGU.

## 10. Droit applicable

Les présentes CGU sont soumises au droit français. Tout litige relève, à défaut de résolution amiable, des tribunaux français compétents.

## Contact

Pour toute question relative aux présentes CGU : vanilliabusiness@gmail.com
`;

const CONFIDENTIALITE_MD = `# Politique de confidentialité

**Dernière mise à jour : 20 juin 2026**

La présente politique explique comment VANILLIA (SARL), éditrice de H€CTOR, collecte, utilise et protège les données personnelles des utilisateurs, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.

## 1. Responsable de traitement

**VANILLIA**, SARL au capital de 1 000 €, SIREN 990 086 209, 32 rue Damrémont, 75018 Paris.
Contact pour toute question relative à vos données : **vanilliabusiness@gmail.com**

## 2. Données collectées

### 2.1 Données fournies directement par l'utilisateur

- Données de compte : email, mot de passe (chiffré), ou identifiant Google en cas de connexion via Google OAuth
- Données de profil : prénom, nom, téléphone, nom d'entreprise, SIRET, statut juridique, activité
- Données financières : revenus encaissés, factures clients (montants, dates, noms de clients), frais professionnels, solde bancaire déclaratif, objectifs financiers
- Contenu des échanges avec l'assistant conversationnel (IA)
- Documents importés : factures (PDF, images) téléversées pour extraction automatique de données

### 2.2 Données collectées automatiquement

- Données techniques de connexion (à des fins de sécurité et de bon fonctionnement du service)

H€CTOR n'utilise pas de cookies publicitaires ni de traceurs tiers à des fins de suivi commercial. Certaines préférences d'affichage sont stockées localement dans votre navigateur (stockage local), sans transmission à des tiers.

## 3. Finalités du traitement et bases légales

| Finalité | Base légale |
|---|---|
| Création et gestion du compte utilisateur | Exécution du contrat (CGU) |
| Calcul des estimations de cotisations et fonctionnalités de l'application | Exécution du contrat |
| Recherche d'informations d'entreprise via le répertoire Sirene (INSEE) | Exécution du contrat, à l'initiative de l'utilisateur |
| Réponses de l'assistant conversationnel IA | Exécution du contrat |
| Sécurité, prévention de la fraude | Intérêt légitime |
| Amélioration du service | Intérêt légitime |

## 4. Destinataires des données et sous-traitants

Vos données peuvent être transmises aux prestataires techniques suivants, strictement dans la mesure nécessaire au fonctionnement du service :

- **Railway** (hébergement de la base de données et du serveur applicatif) — États-Unis
- **Vercel** (hébergement de l'interface de l'application) — États-Unis
- **Google** (authentification, si vous choisissez la connexion via Google) — États-Unis
- **Anthropic** (fourniture du modèle d'intelligence artificielle de l'assistant conversationnel ; les messages échangés avec l'assistant, ainsi que le contexte financier nécessaire pour personnaliser la réponse, lui sont transmis) — États-Unis
- **INSEE** (répertoire Sirene, uniquement pour les recherches de SIRET que vous initiez) — France

Certains de ces prestataires sont situés hors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou des mécanismes équivalents proposés par ces prestataires.

VANILLIA ne vend ni ne loue vos données personnelles à des tiers à des fins commerciales.

## 5. Durée de conservation

Vos données sont conservées pendant toute la durée d'utilisation active de votre compte. En cas de suppression de votre compte, vos données sont supprimées ou anonymisées dans un délai raisonnable, sauf obligation légale de conservation plus longue (par exemple, en matière comptable).

## 6. Sécurité

VANILLIA met en œuvre des mesures techniques raisonnables pour protéger vos données (chiffrement des mots de passe, connexions sécurisées). Aucun système n'étant infaillible, VANILLIA ne peut garantir une sécurité absolue.

## 7. Vos droits

Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :

- **Droit d'accès** : obtenir une copie des données vous concernant
- **Droit de rectification** : corriger des données inexactes
- **Droit à l'effacement** : demander la suppression de vos données
- **Droit à la portabilité** : recevoir vos données dans un format structuré
- **Droit d'opposition et de limitation** du traitement, dans les cas prévus par la loi

Vous pouvez exercer ces droits directement depuis l'application (modification ou suppression de votre profil et de vos données) ou en nous contactant à **vanilliabusiness@gmail.com**. Nous nous engageons à répondre dans un délai d'un mois.

Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous estimez que vos droits ne sont pas respectés.

## 8. Décision automatisée

Les estimations et recommandations fournies par H€CTOR (y compris par l'assistant IA) sont indicatives et n'emportent aucune décision automatisée produisant des effets juridiques sur l'utilisateur.

## 9. Modification de la présente politique

Cette politique peut être mise à jour. La date de dernière mise à jour figure en haut de ce document. En cas de modification substantielle, les utilisateurs en seront informés.

## Contact

Pour toute question ou exercice de vos droits : **vanilliabusiness@gmail.com**
`;

function renderLegalMarkdown(md) {
  const lines = md.split("\n");
  const blocks = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length > 0) {
      blocks.push({ type: "ul", items: listBuffer });
      listBuffer = [];
    }
  }

  function renderInline(text) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ type: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      flushList();
      blocks.push({ type: "h1", text: line.slice(2) });
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("|")) {
      flushList();
      const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
      if (cells.every(c => /^-+$/.test(c))) continue;
      const lastTable = blocks[blocks.length - 1];
      if (lastTable && lastTable.type === "table") lastTable.rows.push(cells);
      else blocks.push({ type: "table", rows: [cells] });
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      blocks.push({ type: "p", text: line });
    }
  }
  flushList();

  return blocks.map((b, i) => {
    if (b.type === "h1") return <h1 key={i} style={{ fontSize: 22, fontWeight: 600, color: INK, margin: "0 0 16px" }}>{renderInline(b.text)}</h1>;
    if (b.type === "h2") return <h2 key={i} style={{ fontSize: 16, fontWeight: 600, color: INK, margin: "24px 0 10px" }}>{renderInline(b.text)}</h2>;
    if (b.type === "ul") return <ul key={i} style={{ margin: "8px 0", paddingLeft: 22 }}>{b.items.map((it, j) => <li key={j} style={{ fontSize: 13, color: "#3D4452", lineHeight: 1.7 }}>{renderInline(it)}</li>)}</ul>;
    if (b.type === "table") {
      const [header, ...rows] = b.rows;
      return (
        <table key={i} style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0", fontSize: 13 }}>
          <thead><tr>{header.map((h, j) => <th key={j} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1.5px solid #DDE5EE", color: INK }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ padding: "6px 10px", borderBottom: "0.5px solid #EEF2F7", color: "#3D4452" }}>{c}</td>)}</tr>)}</tbody>
        </table>
      );
    }
    return <p key={i} style={{ fontSize: 13, color: "#3D4452", lineHeight: 1.7, margin: "8px 0" }}>{renderInline(b.text)}</p>;
  });
}

function LegalPageView({ page, onBack }) {
  const content = page === "mentions" ? MENTIONS_LEGALES_MD : page === "cgu" ? CGU_MD : CONFIDENTIALITE_MD;
  return (
    <div style={{ minHeight: "100vh", background: PAPER, padding: "32px 20px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ ...S.linkBtn, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 16 }} /> Retour
        </button>
        <div style={{ background: "white", borderRadius: 16, border: "0.5px solid #DDE5EE", padding: "32px 36px" }}>
          {renderLegalMarkdown(content)}
        </div>
      </div>
    </div>
  );
}


function formatEUR(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function Logo({ size = 28, dark = false }) {
  // dark=true → logo à texte blanc, pour les fonds foncés (page de connexion, sidebar).
  const ratio = 1348 / 358;
  return (
    <img src={dark ? "/hector-logo-white.png" : "/hector-logo.png"} alt="H€CTOR" height={size} width={Math.round(size * ratio)}
         style={{ height: size, width: "auto", display: "block" }} />
  );
}

function LogoIcon({ size = 32 }) {
  return (
    <img src="/hector-icon.png" alt="H€CTOR" height={size} width={size}
         style={{ height: size, width: size, display: "block", borderRadius: size * 0.22 }} />
  );
}

function AppInner() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [legalPage, setLegalPage] = useState(null);
  const [authMode, setAuthMode] = useState("login");
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
  const [emailVerified, setEmailVerified] = useState(true);
  const [resendVerifStatus, setResendVerifStatus] = useState(""); // "", "sending", "sent"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [nav, setNav] = useState(() => localStorage.getItem("nav") || "dashboard");
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
  const [invoicesList, setInvoicesList] = useState([]);
  const [invoicesSummary, setInvoicesSummary] = useState(null);
  const [expensesList, setExpensesList] = useState([]);
  const [expensesSummary, setExpensesSummary] = useState(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
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
  const [onbStep, setOnbStep] = useState("form");
  const [onbSolde, setOnbSolde] = useState("");

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
  const [soldeSaveStatus, setSoldeSaveStatus] = useState(""); // "", "saving", "saved", "error"
  const soldeMounted = useRef(false);
  const reserveMounted = useRef(false);
  const tmiMounted = useRef(false);
  const [tmi, setTmi] = useState(() => localStorage.getItem("tmi") || "0");
  const [simCa, setSimCa] = useState("");
  const [simActivite, setSimActivite] = useState("services");
  const [objectifAnnuel, setObjectifAnnuel] = useState(() => localStorage.getItem("objectifAnnuel") || "");
  const [objectifMensuel, setObjectifMensuel] = useState(() => localStorage.getItem("objectifMensuel") || "");
  const [objectifSaved, setObjectifSaved] = useState(false);
  const objectifMounted = useRef(false);
  const [objectifAnnuelSaved, setObjectifAnnuelSaved] = useState(false);
  const objectifAnnuelMounted = useRef(false);
  const [editingObjectifMensuel, setEditingObjectifMensuel] = useState(false);
  const [editingObjectifAnnuel, setEditingObjectifAnnuel] = useState(false);
  const [profilPrenom, setProfilPrenom] = useState(() => localStorage.getItem("profilPrenom") || "");
  const [profilNom, setProfilNom] = useState(() => localStorage.getItem("profilNom") || "");
  const [profilTelephone, setProfilTelephone] = useState(() => localStorage.getItem("profilTelephone") || "");
  const [profilEntreprise, setProfilEntreprise] = useState(() => localStorage.getItem("profilEntreprise") || "");
  const [profilSiret, setProfilSiret] = useState(() => localStorage.getItem("profilSiret") || "");
  const [profilAdresse, setProfilAdresse] = useState(() => localStorage.getItem("profilAdresse") || "");
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
    try { return JSON.parse(localStorage.getItem("historiqueDeclarations") || "[]"); } catch { return []; }
  });
  const [objectifSecurite, setObjectifSecurite] = useState(() => localStorage.getItem("objectifSecurite") || "3000");
  const [depensesMensuelles, setDepensesMensuelles] = useState(() => localStorage.getItem("depensesMensuelles") || "");
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);

  useEffect(() => {
    function handleResize() { setIsMobile(window.innerWidth <= 768); }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const googleButtonRef = useRef(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? authHeaders() : {}),
        ...options.headers,
      },
    });
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
     "historiqueDeclarations", "nav"].forEach(key => localStorage.removeItem(key));
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
      .then(data => { clearLocalAccountData(); localStorage.setItem("token", data.token); setToken(data.token); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { localStorage.setItem("objectifAnnuel", objectifAnnuel); }, [objectifAnnuel]);
  useEffect(() => {
    if (!objectifAnnuelMounted.current) { objectifAnnuelMounted.current = true; return; }
    setObjectifAnnuelSaved(true);
    const t = setTimeout(() => setObjectifAnnuelSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifAnnuel]);
  useEffect(() => { localStorage.setItem("objectifMensuel", objectifMensuel); }, [objectifMensuel]);
  useEffect(() => {
    if (!objectifMounted.current) { objectifMounted.current = true; return; }
    setObjectifSaved(true);
    const t = setTimeout(() => setObjectifSaved(false), 1200);
    return () => clearTimeout(t);
  }, [objectifMensuel]);
  useEffect(() => { localStorage.setItem("profilPrenom", profilPrenom); }, [profilPrenom]);
  useEffect(() => { localStorage.setItem("profilNom", profilNom); }, [profilNom]);
  useEffect(() => { localStorage.setItem("profilTelephone", profilTelephone); }, [profilTelephone]);
  useEffect(() => { localStorage.setItem("profilEntreprise", profilEntreprise); }, [profilEntreprise]);
  useEffect(() => { localStorage.setItem("profilSiret", profilSiret); }, [profilSiret]);
  useEffect(() => { localStorage.setItem("profilAdresse", profilAdresse); }, [profilAdresse]);
  useEffect(() => { localStorage.setItem("objectifSecurite", objectifSecurite); }, [objectifSecurite]);
  useEffect(() => { localStorage.setItem("depensesMensuelles", depensesMensuelles); }, [depensesMensuelles]);
  useEffect(() => { localStorage.setItem("tmi", tmi); }, [tmi]);
  useEffect(() => { localStorage.setItem("nav", nav); }, [nav]);

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
      } catch (err) {
        // best-effort, ne bloque pas l'usage si la sauvegarde echoue ponctuellement
      }
    }, 600);
    return () => clearTimeout(t);
  }, [objectifSecurite, token]);

  useEffect(() => {
    if (!tmiMounted.current) { tmiMounted.current = true; return; }
    if (!token) return;
    apiFetch("/profile/settings", {
      method: "POST",
      body: JSON.stringify({ tmi }),
    }).catch(() => {});
  }, [tmi, token]);

  useEffect(() => {
    if (estimateData && estimateData.disponible !== false) {
      const urssafCourante = estimateData.montant_a_provisionner || 0;
      const urssafPrecedente = estimateData.periode_precedente?.jours_restants > 0 ? Math.round(estimateData.ca_periode_precedente * (estimateData.taux_global_pct / 100) * 100) / 100 : 0;
      setPanique(p => ({ ...p, urssaf: String(Math.round((urssafCourante + urssafPrecedente) * 100) / 100) }));
    }
  }, [estimateData]);

  useEffect(() => {
    if (token || !googleButtonRef.current) return;
    function renderButton() {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 360, text: "continue_with" });
      } else {
        setTimeout(renderButton, 200);
      }
    }
    renderButton();
  }, [token, authMode]);

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
      localStorage.setItem("token", data.token);
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
    localStorage.removeItem("token");
    clearLocalAccountData();
    setToken(null);
    setProfile(null);
    setEstimateData(null);
    setIncomeList([]);
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
      localStorage.clear();
      setToken(null);
      setProfile(null);
      setEstimateData(null);
      setIncomeList([]);
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

  // Onboarding minimal : enregistre activité + périodicité + solde, puis affiche le premier
  // résultat AVANT de basculer sur le Cockpit. C'est l'étape qui décide de l'activation.
  async function handleOnboardingComplete(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Profil (statut auto_entrepreneur par défaut, ACRE/libératoire à false — affinables plus tard)
      await apiFetch("/profile", { method: "POST", body: JSON.stringify(profileForm) });
      // 2. Solde saisi pendant l'onboarding
      const soldeVal = onbSolde !== "" ? parseFloat(onbSolde) : null;
      if (soldeVal != null) {
        await apiFetch("/profile/solde", { method: "POST", body: JSON.stringify({ solde: soldeVal }) });
        setPanique(prev => ({ ...prev, solde: String(soldeVal) }));
        localStorage.setItem("soldeUpdatedAt", new Date().toISOString());
      }
      // 3. On affiche le résultat (sans recharger : onboarding_complete reste false tant qu'on
      //    n'a pas appelé loadEverything, donc on garde la main sur l'écran result)
      setOnbStep("result");
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

  async function handleAddIncome(e) {
    e.preventDefault();
    try {
      await apiFetch("/income", { method: "POST", body: JSON.stringify({ date: incomeForm.date, amount: parseFloat(incomeForm.amount), description: incomeForm.description || null }) });
      setIncomeForm({ date: "", amount: "", description: "" });
      setShowAddIncome(false);
      await loadEverything();
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
      await apiFetch("/expenses", {
        method: "POST",
        body: JSON.stringify({
          date: expenseForm.date,
          montant: parseFloat(expenseForm.montant) || 0,
          categorie: expenseForm.categorie,
          description: expenseForm.description || null,
        }),
      });
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
      setExpenseForm({
        date: data.date,
        montant: String(data.amount),
        categorie: "autre",
        description: data.description || "",
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

  // --- Fraîcheur du solde (rituel sans connexion bancaire) ---
  // Stockée en localStorage, zéro dépendance backend. Le solde est "périmé" au-delà de 7 jours.
  const soldeUpdatedAt = localStorage.getItem("soldeUpdatedAt") || "";
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
  const disponibleAujourdhui = panique.solde !== "" ? Math.round((soldeNum - totalChargesAVenir - securiteNum) * 100) / 100 : null;
  // Argent reellement sur le compte apres charges, AVANT reserve - ne doit jamais etre clampe a 0 a tort
  const argentDisponibleBrut = panique.solde !== "" ? Math.round((soldeNum - totalChargesAVenir) * 100) / 100 : null;
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
  const securitePrecise = moyenneMensuelleFrais > 0; // true si base sur vos vrais Frais d'entreprise, false si approxime sur le CA
  const tresorerieApresDettes = soldeNum - totalChargesAVenir;
  const moisSurvie = baseMensuelleSecurite > 0 && panique.solde !== "" ? Math.max(0, Math.round((tresorerieApresDettes / baseMensuelleSecurite) * 10) / 10) : null;
  const joursSurvie = moisSurvie !== null ? Math.round(moisSurvie * 30) : null;
  const dateRupture = joursSurvie !== null ? new Date(Date.now() + joursSurvie * 86400000) : null;

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
          <Logo size={36} dark />
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
          <Logo size={36} dark />
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

  if (!token) {
    const tauxSim = { vente: 0.123, services: 0.212, bnc: 0.256 }[simActivite];
    const caSim = parseFloat(simCa) || 0;
    const urssafSim = Math.round(caSim * tauxSim * 100) / 100;
    const netSim = Math.round((caSim - urssafSim) * 100) / 100;
    return (
      <div style={S.authPage}>
        <style>{CSS}</style>
        <div style={S.authLeft}>
          <Logo size={36} dark />
          <h1 style={S.authHero}>Sache exactement<br />combien tu peux dépenser</h1>
          <p style={S.authSub}>H€CTOR met de côté ce que tu devras à l'URSSAF, aux impôts et à la TVA, et te dit ce qu'il te reste vraiment — sans jamais se connecter à ta banque.</p>

          {/* Démo visuelle : la TRANSFORMATION (brut → disponible), pas juste le résultat */}
          <div style={{ background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.3)", borderRadius: 16, padding: isMobile ? "16px" : "20px 28px", margin: "8px auto", maxWidth: 440, width: "100%" }}>
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.1)", color: "#B5D4F4", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "3px 10px", borderRadius: 999, marginBottom: 14 }}>EXEMPLE DE CALCUL</div>
            <div style={{ fontSize: 14, color: "#EAF2FB", marginBottom: 2 }}>Pour un indépendant ayant encaissé</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "white", marginBottom: 12 }}>5 000 €</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left", maxWidth: 260, margin: "0 auto 14px" }}>
              <div style={{ fontSize: 13, color: "#F0A9A0", display: "flex", justifyContent: "space-between" }}><span>− URSSAF</span><span>−1 050 €</span></div>
              <div style={{ fontSize: 13, color: "#F0A9A0", display: "flex", justifyContent: "space-between" }}><span>− TVA anticipée</span><span>−833 €</span></div>
              <div style={{ fontSize: 13, color: "#F0A9A0", display: "flex", justifyContent: "space-between" }}><span>− Impôts estimés</span><span>−274 €</span></div>
            </div>
            <div style={{ fontSize: 18, color: "#5DCAA5", marginBottom: 8 }}>⬇️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#5DCAA5" }}>🟢 Tu peux vraiment dépenser</div>
            <div style={{ fontSize: isMobile ? 38 : 46, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>2 843 €</div>
            <div style={{ fontSize: 11.5, color: "#8BA5C0", marginTop: 12, lineHeight: 1.5 }}>C'est tout l'intérêt : sur 5 000 € encaissés, une grande partie n'est pas vraiment à toi. H€CTOR te dit ce qui l'est.</div>
          </div>

          {/* Bande compagnon (compacte) : Hector qui prépare les devis quand on lui parle */}
          <div style={{ background: "linear-gradient(135deg, #0E2E4F 0%, #1B4068 100%)", border: "1px solid rgba(93,202,165,0.25)", borderRadius: 14, padding: isMobile ? "14px 14px" : "16px 20px", margin: "4px auto 8px", maxWidth: 560, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <i className="ti ti-paw" aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "white" }}>Et tu n'es plus seul·e : Hector prépare tes devis quand tu lui parles</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ alignSelf: "flex-end", background: ACCENT, color: "white", borderRadius: "12px 12px 3px 12px", padding: "6px 11px", fontSize: 12, maxWidth: "85%" }}>
                « Hector, prépare un devis pour Martin, 500 € de consulting »
              </div>
              <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.08)", color: "#EAF2FB", borderRadius: "12px 12px 12px 3px", padding: "6px 11px", fontSize: 12, maxWidth: "85%" }}>
                « C'est noté — voilà ton devis prêt. On le relit ensemble ? » ✓
              </div>
            </div>
          </div>


          <div style={isMobile ? { ...S.authFeatures, gridTemplateColumns: "1fr" } : S.authFeatures}>
            {[
              { icon: "ti-radar-2", t: "Ce que tu peux vraiment dépenser", d: "En un coup d'œil, sans te mettre en danger" },
              { icon: "ti-calculator", t: "URSSAF, impôts & TVA anticipés", d: "Recalculés en temps réel selon tes revenus encaissés" },
              { icon: "ti-file-invoice", t: "Devis & factures", d: "Crée, numérote, envoie par email et télécharge en PDF — ou demande à Hector" },
              { icon: "ti-message-circle", t: "Hector, ton compagnon", d: "Il connaît tes chiffres et prépare tes devis quand tu lui parles" },
              { icon: "ti-receipt-2", t: "Scan de tes frais", d: "Photographie une facture, H€CTOR en extrait le montant" },
              { icon: "ti-lock", t: "Tes données restent chez toi", d: "Aucune connexion bancaire, aucun accès à ton compte" },
            ].map(f => (
              <div key={f.t} style={S.authFeatureCard}>
                <i className={`ti ${f.icon}`} aria-hidden="true" style={{ fontSize: 18, color: "#5DCAA5" }} />
                <div>
                  <div style={S.authFeatureTitle}>{f.t}</div>
                  <div style={S.authFeatureDesc}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={S.simWidget}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8BA5C0", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              Essayez sans créer de compte
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input style={S.simInput} type="number" placeholder="CA encaissé" value={simCa} onChange={e => setSimCa(e.target.value)} />
              <select style={S.simSelect} value={simActivite} onChange={e => setSimActivite(e.target.value)}>
                <option value="vente">Vente (12,3%)</option>
                <option value="services">Services (21,2%)</option>
                <option value="bnc">Libéral (25,6%)</option>
              </select>
            </div>
            {caSim > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#8BA5C0" }}>À mettre de côté URSSAF</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#FAC775" }}>{formatEUR(urssafSim)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#8BA5C0" }}>Dans votre poche</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#5DCAA5" }}>{formatEUR(netSim)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={S.authRight}>
          {forgotMode ? (
            <div style={S.authCard}>
              <h2 style={S.authTitle}>Mot de passe oublié</h2>
              {forgotStatus === "sent" ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📧</div>
                  <p style={{ fontSize: 13, color: "#3D4452", marginBottom: 20, lineHeight: 1.6 }}>
                    Si un compte existe avec l'adresse <strong>{forgotEmail}</strong>, vous allez recevoir un email avec un lien pour réinitialiser votre mot de passe.
                  </p>
                  <button type="button" style={S.btnSecondary} onClick={() => { setForgotMode(false); setForgotStatus(""); setForgotEmail(""); }}>Retour à la connexion</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <p style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>Entrez votre email, nous vous enverrons un lien pour le réinitialiser.</p>
                  <label style={S.label}>Email<input style={S.input} type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required /></label>
                  <button style={S.btnPrimary} type="submit" disabled={forgotStatus === "loading"}>{forgotStatus === "loading" ? "…" : "Envoyer le lien"}</button>
                  <p style={S.switchAuth}>
                    <button type="button" style={S.linkBtn} onClick={() => setForgotMode(false)}>← Retour à la connexion</button>
                  </p>
                </form>
              )}
            </div>
          ) : (
            <form style={S.authCard} onSubmit={handleAuth}>
              <h2 style={S.authTitle}>{authMode === "login" ? "Connexion" : "Créer un compte"}</h2>
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
              <button style={S.btnPrimary} type="submit" disabled={loading}>{loading ? "…" : authMode === "login" ? "Se connecter" : "Créer mon compte"}</button>
              <p style={S.switchAuth}>
                {authMode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
                <button type="button" style={S.linkBtn} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Créer un compte" : "Se connecter"}</button>
              </p>
              {authMode === "register" && (
                <p style={{ fontSize: 11, color: "#8BA5C0", textAlign: "center", marginTop: 4 }}>
                  En créant un compte, vous acceptez les <button type="button" style={{ ...S.linkBtn, fontSize: 11 }} onClick={() => setLegalPage("cgu")}>CGU</button> et la <button type="button" style={{ ...S.linkBtn, fontSize: 11 }} onClick={() => setLegalPage("confidentialite")}>Politique de confidentialité</button>.
                </p>
              )}
              <p style={{ fontSize: 11, color: "#B0B6C0", textAlign: "center", marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
                <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("mentions")}>Mentions légales</button>
                <span>·</span>
                <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("cgu")}>CGU</button>
                <span>·</span>
                <button type="button" style={{ ...S.linkBtn, fontSize: 11, color: "#B0B6C0" }} onClick={() => setLegalPage("confidentialite")}>Confidentialité</button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (profile && !profile.onboarding_complete) {
    const onbSoldeNum = parseFloat(onbSolde) || 0;

    // ─── PHASE RÉSULTAT : le premier "tu peux dépenser X €" ───
    if (onbStep === "result") {
      return (
        <div style={S.authPage}>
          <style>{CSS}</style>
          <div style={S.authLeft}>
            <Logo size={36} dark />
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
                    "T'alerte avant chaque échéance",
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
          <Logo size={36} dark />
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
              type="number" step="0.01" inputMode="decimal" placeholder="Exemple : 1750"
              value={onbSolde} onChange={e => setOnbSolde(e.target.value)} autoFocus
            />
            <p style={{ fontSize: 11, color: "#8BA5C0", margin: "8px 0 20px", lineHeight: 1.5 }}>
              H€CTOR ne se connecte jamais à ta banque. Ouvre l'appli de ta banque, lis le solde, recopie-le ici.
            </p>

            <button style={S.btnPrimary} type="submit" disabled={loading || onbSolde === ""}>
              {loading ? "…" : "Voir ce que je peux dépenser →"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const userInitials = (profile?.email || "").slice(0, 2).toUpperCase();

  return (
    <div style={isMobile ? { ...S.appWrap, display: "block" } : S.appWrap}>
      <style>{CSS}</style>

      {isMobile && (
        <div style={S.mobileTopbar}>
          <button style={{ ...S.navItem, padding: "6px 8px", width: "auto" }} onClick={() => setMobileMenuOpen(true)}>
            <i className="ti ti-menu-2" aria-hidden="true" style={{ fontSize: 24, color: "white" }} />
          </button>
          <Logo size={22} dark />
          <div style={{ width: 36 }} />
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
          {(!isMobile && !sidebarOpen) ? <LogoIcon size={32} /> : <Logo size={28} dark />}
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
          { id: "assistant", icon: "ti-message-2", label: "Assistant" },
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
          { id: "simvie", icon: "ti-target", label: "Combien gagner ?" },
          { id: "simulateur", icon: "ti-chart-pie", label: "Simulateur fiscal" },
          { id: "coach", icon: "ti-target-arrow", label: "Mes tarifs" },
          { id: "score", icon: "ti-heart-rate-monitor", label: "Score H€CTOR" },
          { id: "revenus", icon: "ti-chart-bar", label: "Revenus" },
          { id: "contacts", icon: "ti-address-book", label: "Contacts" },
          { id: "actualites", icon: "ti-bell", label: "Actualités" },
          { id: "conseils", icon: "ti-star", label: "Conseils" },
          { id: "modeles", icon: "ti-template", label: "Modèles" },
          { id: "societe", icon: "ti-building", label: "Passage société" },
          { id: "abonnement", icon: "ti-crown", label: "Abonnement" },
          { id: "profil", icon: "ti-user", label: "Profil" },
        ].map(item => (
          <button key={item.id} style={{ ...S.navItem, paddingLeft: 28, ...(nav === item.id ? S.navItemActive : {}) }} onClick={() => { setNav(item.id); setMobileMenuOpen(false); }}>
            <i className={`ti ${item.icon}`} aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ ...S.navLabel, fontSize: 12 }}>{item.label}</span>
          </button>
        ))}
        <div style={S.sidebarBottom}>

          {!isMobile && (
            <button style={S.navItem} onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className={`ti ${sidebarOpen ? "ti-layout-sidebar-left-collapse" : "ti-layout-sidebar-left-expand"}`} aria-hidden="true" style={{ fontSize: 18 }} />
            </button>
          )}
          <div style={S.userRow}>
            <div style={S.avatar}>{userInitials}</div>
            {(isMobile || sidebarOpen) && <button style={S.linkBtn} onClick={handleLogout}>Déconnexion</button>}
          </div>
        </div>
      </aside>

      <main style={isMobile ? { ...S.mainContent, padding: "16px 14px" } : S.mainContent}>
        {error && <div style={S.errorBanner}>{error}</div>}

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

        {nav === "dashboard" && estimateData && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}>
              <div>
                <h1 style={S.pageTitle}>Bonjour 👋</h1>
                <p style={S.pageSub}>Votre situation en un coup d'œil</p>
              </div>
              {estimateData.periode_courante?.jours_restants <= 30 && (
                <div style={S.alertChip}>
                  <i className="ti ti-clock" style={{ fontSize: 13 }} aria-hidden="true" />
                  Déclaration dans {estimateData.periode_courante.jours_restants}j
                </div>
              )}
            </div>

            {/* ─── RITUEL DU SOLDE — le cœur de H€CTOR sans connexion bancaire ───
                Saisie en 10 secondes, fraîcheur affichée en permanence, recalcul instantané.
                La fraîcheur est gérée en localStorage (soldeUpdatedAt) — aucune dépendance backend. */}
            <div style={{ ...S.soldeInputCard, ...(soldePerime ? { border: "1px solid #F0C36D", background: "#FFF8EC" } : {}) }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  💳 Combien y a-t-il sur ton compte, là, maintenant ?
                  {soldeFraicheur && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: soldePerime ? "#B7791F" : "#1D9E75" }}>
                      · {soldeFraicheur}
                    </span>
                  )}
                </span>
                <input
                  style={S.soldeInput}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Exemple : 1750"
                  value={panique.solde}
                  onChange={e => { setPanique({ ...panique, solde: e.target.value }); localStorage.setItem("soldeUpdatedAt", new Date().toISOString()); }}
                />
                <span style={{ fontSize: 11, color: "#8BA5C0", lineHeight: 1.5 }}>
                  H€CTOR ne se connecte jamais à ta banque — tes données restent chez toi. Ouvre l'appli de ta banque, lis le solde, recopie-le ici. 10 secondes, et tu sais exactement ce que tu peux dépenser.
                </span>
              </label>
              {soldeSaveStatus === "saving" && <span style={{ ...S.badge, background: "#F1F2EE", color: "#5B6573", flexShrink: 0 }}>⏳ Enregistrement…</span>}
              {soldeSaveStatus === "saved" && <span style={{ ...S.badge, ...S.badgeGreen, flexShrink: 0 }}>🟢 Pris en compte</span>}
              {soldeSaveStatus === "error" && <span style={{ ...S.badge, background: "#FCEBEB", color: "#A32D2D", flexShrink: 0 }}>⚠️ Non enregistré</span>}
            </div>

            {/* Rappel doux : le check hebdo. N'apparaît que si le solde est saisi mais périmé. */}
            {soldePerime && panique.solde !== "" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF8EC", border: "1px solid #F0C36D", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                <i className="ti ti-clock-hour-4" aria-hidden="true" style={{ fontSize: 18, color: "#B7791F", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#8A5A1A", lineHeight: 1.5 }}>
                  Ton solde date de {soldeJours} jours. 10 secondes pour le remettre à jour, et ton chiffre redevient fiable.
                </span>
              </div>
            )}

            {estimateData.ca_annuel === 0 && (
              <div style={S.onboardingNotice}>
                <i className="ti ti-info-circle" aria-hidden="true" style={{ fontSize: 20, color: ACCENT, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                    {panique.solde !== "" ? "Plus qu'une étape" : "Pour savoir ce que tu peux vraiment dépenser"}
                  </div>
                  <div style={{ fontSize: 12, color: "#5B6573", marginTop: 4, lineHeight: 1.6 }}>
                    {panique.solde !== ""
                      ? "Ajoute ton premier revenu encaissé : H€CTOR mettra automatiquement de côté ce que tu devras à l'URSSAF, et tu sauras vraiment ce que tu peux dépenser."
                      : "Indique ton solde ci-dessus, puis ajoute tes revenus encaissés."}
                  </div>
                </div>
                <button style={S.btnSecondary} onClick={() => setNav("revenus")}>+ Ajouter un revenu</button>
              </div>
            )}

            {/* ─── LA STAR : Argent réellement disponible, jamais masqué par la réserve ─── */}
            {argentDisponibleBrut !== null && argentDisponibleBrut < 0 ? (
              <div style={{ ...S.heroDispo, background: "#5C1A1A" }}>
                <div style={S.heroDispoLabel}>🔴 Déficit</div>
                <div style={{ ...S.heroDispoValue, color: "#F09595" }}>−{formatEUR(Math.abs(argentDisponibleBrut))}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#F7C1C1", maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                  Il manque <strong>{formatEUR(Math.abs(argentDisponibleBrut))}</strong> pour couvrir les charges prévues.
                </div>
                <div style={{ marginTop: 20, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "14px 18px", textAlign: "left", maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#F0997B", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Charges prises en compte</div>
                  <div style={S.heroDetailRow}><span style={{ color: "#F7C1C1" }}>URSSAF</span><span style={{ color: "#F7C1C1" }}>{formatEUR(urssafProvision)}</span></div>
                  <div style={S.heroDetailRow}><span style={{ color: "#F7C1C1" }}>Impôts</span><span style={{ color: "#F7C1C1" }}>{formatEUR(impotsNum)}</span></div>
                  <div style={S.heroDetailRow}><span style={{ color: "#F7C1C1" }}>CFE</span><span style={{ color: "#F7C1C1" }}>{formatEUR(cfeNum)}</span></div>
                  <div style={S.heroDetailRow}><span style={{ color: "#F7C1C1" }}>Frais d'entreprise (ce mois)</span><span style={{ color: "#F7C1C1" }}>{formatEUR(fraisMoisNum)}</span></div>
                  <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 6, fontWeight: 700 }}>
                    <span style={{ color: "white" }}>Total charges</span><span style={{ color: "white" }}>{formatEUR(totalChargesAVenir)}</span>
                  </div>
                  <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 6 }}>
                    <span style={{ color: "#F7C1C1" }}>Argent sur le compte</span><span style={{ color: "#F7C1C1" }}>{formatEUR(soldeNum)}</span>
                  </div>
                  <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 6, fontWeight: 700 }}>
                    <span style={{ color: "#F09595" }}>Déficit</span><span style={{ color: "#F09595" }}>−{formatEUR(Math.abs(argentDisponibleBrut))}</span>
                  </div>
                </div>
                <details style={{ marginTop: 14, textAlign: "left" }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "#F0997B", textAlign: "center" }}>Voir le calcul avancé (modifier CFE...)</summary>
                  <div style={{ marginTop: 12, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={S.heroDetailRow}>
                      <span style={{ color: "#F7C1C1" }}>CFE</span>
                      <span style={{ color: "#F7C1C1" }}>{formatEUR(cfeNum)}</span>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <button style={{ ...S.linkBtnLight, fontSize: 11 }} onClick={() => setNav("profil")}>⚙️ Régler la CFE et ma réserve dans mon profil →</button>
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              <div style={S.heroDispo}>
                {niveauFinancier !== null && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: niveauFinancier === "orange" ? "#5DA9E8" : "#5DCAA5", marginBottom: 10 }}>
                    {niveauFinancier === "orange" ? "🔵 Tout va bien — tu construis ta réserve" : "✅ Ton activité est saine"}
                  </div>
                )}
                <div style={S.heroDispoLabel}>
                  {argentDisponibleBrut === null ? "💰 Ce que tu peux dépenser" : niveauFinancier === "rouge" ? "Attention à ta trésorerie" : "🟢 Tu peux dépenser sans risque jusqu'à"}
                </div>
                {argentDisponibleBrut !== null ? (
                  <div style={{ ...S.heroDispoValue, color: soldePerime ? "#6E8199" : (niveauFinancier === "orange" ? "#5DA9E8" : "#5DCAA5"), opacity: soldePerime ? 0.55 : 1 }}>{formatEUR(argentDisponibleBrut)}</div>
                ) : (
                  <div style={S.dispoEmpty}>Renseigne ton solde ci-dessus pour voir ce chiffre</div>
                )}
                {niveauFinancier === "orange" && (() => {
                  const pctReserve = securiteNum > 0 ? Math.max(0, Math.min(100, Math.round((argentDisponibleBrut / securiteNum) * 100))) : 0;
                  return (
                    <div style={{ marginTop: 14, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                      <p style={{ fontSize: 13, color: "#B5D4F4", lineHeight: 1.5, margin: "0 0 10px" }}>
                        Vous construisez votre réserve de sécurité.
                      </p>
                      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: "#B5D4F4", marginBottom: 8 }}>
                          <span>Réserve de sécurité</span>
                          <span><strong style={{ color: "white" }}>{formatEUR(argentDisponibleBrut)} / {formatEUR(securiteNum)}</strong> <span style={{ color: "#5DCAA5", fontWeight: 700 }}>· {pctReserve}%</span></span>
                        </div>
                        <div style={{ height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(pctReserve, pctReserve > 0 ? 2 : 0)}%`, background: ACCENT, borderRadius: 999 }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {moisSurvie !== null && securitePrecise && (
                  <div style={{ ...S.heroDispoSub, marginTop: 4, fontSize: 12 }}>
                    🕐 soit environ {moisSurvie} mois de sécurité
                  </div>
                )}
                {disponibleAujourdhui !== null && (
                  <details style={{ marginTop: 16, textAlign: "left" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: "#8BA5C0", textAlign: "center" }}>Voir d'où vient ce chiffre</summary>
                    <div style={{ marginTop: 12, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={S.heroDetailRow}>
                        <span>CA encaissé cette année</span>
                        <span>{estimateData.ca_annuel === 0 ? <span style={{ color: "#7A93AD", fontStyle: "italic", fontSize: 12 }}>Aucun revenu enregistré pour le moment</span> : formatEUR(estimateData.ca_annuel)}</span>
                      </div>
                      <div style={S.heroDetailRow}><span>Argent sur le compte</span><span>{formatEUR(soldeNum)}</span></div>
                      <div style={S.heroDetailRow}><span style={{ color: "#FAC775" }}>− URSSAF</span><span style={{ color: "#FAC775" }}>{formatEUR(urssafProvision)}</span></div>
                      <div style={S.heroDetailRow}><span style={{ color: "#FAC775" }}>− Impôts</span><span style={{ color: "#FAC775" }}>{formatEUR(impotsNum)}</span></div>
                      <div style={S.heroDetailRow}>
                        <span style={{ color: "#FAC775" }}>− Cotisation Foncière des Entreprises <span title="Impôt local annuel dû par la plupart des entreprises, même sans local professionnel dédié. Souvent autour de 200€/an pour un auto-entrepreneur, mais variable selon la commune." style={{ cursor: "help", borderBottom: "1px dotted #7A93AD" }}>(CFE) ⓘ</span></span>
                        <span style={{ color: "#FAC775" }}>{formatEUR(cfeNum)}</span>
                      </div>
                      <div style={S.heroDetailRow}>
                        <span style={{ color: "#FAC775" }}>− Frais d'entreprise (ce mois) <button style={{ ...S.linkBtnLight, fontSize: 10, marginLeft: 4 }} onClick={() => setNav("frais")}>voir détail →</button></span>
                        <span style={{ color: "#FAC775" }}>{formatEUR(fraisMoisNum)}</span>
                      </div>
                      <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 6, marginTop: 2 }}>
                        <span style={{ color: "#5DCAA5" }}>= Argent disponible (avant réserve)</span><span style={{ color: "#5DCAA5" }}>{formatEUR(argentDisponibleBrut)}</span>
                      </div>
                      <div style={S.heroDetailRow}>
                        <span style={{ color: "#B5D4F4" }}>− Objectif de réserve <span style={{ fontSize: 10, color: "#7A93AD" }}>({securiteNum > 0 && baseMensuelleSecurite > 0 ? `≈ ${Math.round(securiteNum / baseMensuelleSecurite * 10) / 10} mois` : "modifiable dans ton profil"})</span></span>
                        <span style={{ color: "#B5D4F4" }}>{formatEUR(securiteNum)}</span>
                      </div>
                      {reserveAtteinte ? (
                        <div style={{ ...S.heroDetailRow, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, marginTop: 4, fontWeight: 700 }}>
                          <span style={{ color: "#5DCAA5" }}>= Argent réellement disponible</span><span style={{ color: "#5DCAA5" }}>{formatEUR(Math.max(0, disponibleAujourdhui))}</span>
                        </div>
                      ) : (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 10, marginTop: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, fontWeight: 700, color: "#FAC775", marginBottom: 6 }}>
                            <span>⚠️ Réserve de sécurité en cours</span>
                            <span>{formatEUR(Math.max(0, argentDisponibleBrut))} / {formatEUR(securiteNum)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#B5D4F4", lineHeight: 1.5 }}>
                            Cet argent n'est pas encore "à toi en sécurité" : H€CTOR te recommande d'atteindre {formatEUR(securiteNum)} de réserve avant de le considérer comme libre. Tu peux ajuster cet objectif plus bas.
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                        <button style={{ ...S.linkBtnLight, fontSize: 12 }} onClick={() => setNav("profil")}>
                          ⚙️ Régler ma réserve de sécurité et la CFE dans mon profil →
                        </button>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {argentDisponibleBrut !== null && disponibleAujourdhui > 0 && (
              <div style={S.explainBanner}>
                Mode Achat et Mode Salaire utilisent votre <strong>marge prudente</strong> (réserve de sécurité déduite) : <strong>{formatEUR(disponibleAujourdhui)}</strong>.
              </div>
            )}

            {panique.solde !== "" && (() => {
              const manque = (disponibleAujourdhui ?? 0) < 0 ? Math.abs(disponibleAujourdhui) : 0;
              const recos = [];
              if (manque > 0) {
                recos.push({ icon: "ti-alert-triangle", text: `Mettre ${formatEUR(manque)} de côté pour couvrir vos charges et votre réserve de sécurité.`, urgent: true });
              }
              if (urssafProvision > 0 && estimateData?.periode_courante?.jours_restants <= 14) {
                recos.push({ icon: "ti-calendar-due", text: `Déclarer et payer vos cotisations URSSAF avant le ${formatDate(estimateData.periode_courante.date_limite_declaration)} (${estimateData.periode_courante.jours_restants}j restants).`, urgent: estimateData.periode_courante.jours_restants <= 7 });
              }
              if ((disponibleAujourdhui ?? 0) > securiteNum * 0.5 && (disponibleAujourdhui ?? 0) > 0) {
                recos.push({ icon: "ti-cash", text: `Vous avez de la marge — vous pourriez vous verser jusqu'à ${formatEUR(salaireRecommande)} sans risque (voir Mode Salaire).`, urgent: false });
              }
              if (tvaProche) {
                recos.push({ icon: "ti-receipt-tax", text: `Vous approchez du seuil de TVA (${pourcentageSeuilTva}%) — anticipez ce changement.`, urgent: tvaDepasse });
              }
              if (recos.length === 0) {
                recos.push({ icon: "ti-check", text: "Rien à signaler pour l'instant — votre situation est stable.", urgent: false });
              }
              return (
                <div style={{ ...S.card, marginBottom: 14 }}>
                  <div style={S.cardTitle}>🎯 Que faire maintenant ?</div>
                  {recos.slice(0, 3).map((r, i) => (
                    <div key={i} style={S.recoRow}>
                      <span style={{ ...S.recoNum, background: r.urgent ? "#FCEBEB" : "#E6F1FB", color: r.urgent ? "#A32D2D" : "#0C447C" }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: INK, lineHeight: 1.5 }}>{r.text}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={S.card}>
              <div style={S.cardTitle}>Seuil annuel
                <span style={S.cardSub}>{formatEUR(estimateData.ca_annuel)} / {formatEUR(estimateData.plafond)}</span>
              </div>
              <div style={S.progressTrack}><div style={{ ...S.progressFill, width: `${Math.min(estimateData.pourcentage_plafond, 100)}%` }} /></div>
              <span style={S.kpiSub}>Vous pouvez encore encaisser <strong>{formatEUR(estimateData.plafond - estimateData.ca_annuel)}</strong> avant le plafond</span>
            </div>

            {tvaProche && (
              <div style={{ ...S.card, marginTop: 14, background: tvaDepasse ? "#FCEBEB" : "#FAEEDA", border: `1px solid ${tvaDepasse ? "#E24B4A" : "#EF9F27"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="ti ti-receipt-tax" aria-hidden="true" style={{ fontSize: 20, color: tvaDepasse ? "#A32D2D" : "#854F0B" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: tvaDepasse ? "#A32D2D" : "#854F0B" }}>
                      {tvaDepasse ? "🔴 Franchise TVA dépassée" : "🟠 Vous approchez du seuil TVA"}
                    </div>
                    <div style={{ fontSize: 12, color: tvaDepasse ? "#A32D2D" : "#854F0B", marginTop: 2 }}>
                      Seuil de {formatEUR(seuilTva)} ({pourcentageSeuilTva}% atteint){tvaDepasse ? " — vous devez désormais facturer et reverser la TVA." : ", au-delà vous devrez facturer la TVA."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── ASSISTANT mis en avant : carte copilote avec questions cliquables ─── */}
            <div style={{ ...S.card, marginTop: 20, background: "linear-gradient(135deg, #0A2540 0%, #1B4068 100%)", border: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <i className="ti ti-message-circle-2" aria-hidden="true" style={{ fontSize: 22, color: "#5DCAA5" }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>Demande à H€CTOR</span>
              </div>
              <p style={{ fontSize: 12.5, color: "#B5D4F4", margin: "0 0 14px", lineHeight: 1.5 }}>
                Ton copilote connaît tes chiffres. Pose-lui une vraie question, il te répond avec ta situation à toi.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Combien je peux me verser ?",
                  "Je peux me faire ce resto ?",
                  "Combien mettre de côté ce mois ?",
                  "Suis-je en sécurité ?",
                ].map(q => (
                  <button key={q}
                    style={{ background: "rgba(255,255,255,0.10)", color: "white", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}
                    onClick={() => {
                      setQuickAskQuestions([
                        q,
                        "Combien puis-je me verser ?",
                        "Puis-je faire un achat important ?",
                        "Combien dois-je mettre de côté ce mois-ci ?",
                      ]);
                      setNav("assistant");
                    }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
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
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-chart-bar" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />CA à déclarer</span>
                  {editingDeclarationCa ? (
                    <input
                      style={{ ...S.inlineEditValue, width: 110 }}
                      type="number" step="0.01" autoFocus
                      value={declarationCa !== "" ? declarationCa : String(estimateData.ca_periode_courante)}
                      onChange={e => setDeclarationCa(e.target.value)}
                      onBlur={() => setEditingDeclarationCa(false)}
                    />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#0A2540" }}>{formatEUR(caAffiche)}</strong>
                      <button type="button" style={{ ...S.linkBtn, fontSize: 11, padding: 0 }} onClick={() => setEditingDeclarationCa(true)}>✎ Modifier</button>
                    </span>
                  )}
                </div>
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-receipt" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#EF9F27" }} />Cotisations estimées <span style={{ fontWeight: 400, color: "#8BA5C0", fontSize: 11 }}>({estimateData.taux_global_pct}%)</span></span>
                  {editingDeclarationCotisations ? (
                    <input
                      style={{ ...S.inlineEditValue, width: 110 }}
                      type="number" step="0.01" autoFocus
                      value={declarationCotisations !== "" ? declarationCotisations : String(cotisationsAffichees)}
                      onChange={e => setDeclarationCotisations(e.target.value)}
                      onBlur={() => setEditingDeclarationCotisations(false)}
                    />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#854F0B" }}>{formatEUR(cotisationsAffichees)}</strong>
                      <button type="button" style={{ ...S.linkBtn, fontSize: 11, padding: 0 }} onClick={() => setEditingDeclarationCotisations(true)}>✎ Modifier</button>
                    </span>
                  )}
                </div>
                <div style={S.paniqueLine}>
                  <span style={S.paniqueLineLabel}><i className="ti ti-id" aria-hidden="true" style={{ fontSize: 15, marginRight: 8, color: "#8BA5C0" }} />Activité / statut</span>
                  <span style={{ fontSize: 12, color: "#6B7A8D" }}>{ACTIVITES.find(a => a.id === profile?.activite)?.label || "—"} · {profile?.statut === "auto_entrepreneur" ? "Auto-entrepreneur" : profile?.statut}</span>
                </div>
                {(declarationCa !== "" || declarationCotisations !== "" || declarationPeriode !== "") && (
                  <button style={{ ...S.linkBtn, marginTop: 8 }} onClick={() => { setDeclarationCa(""); setDeclarationCotisations(""); setDeclarationPeriode(""); }}>↺ Revenir aux valeurs calculées par H€CTOR</button>
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
                    localStorage.setItem("historiqueDeclarations", JSON.stringify(next));
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
          const moisActuel = new Date().getMonth();
          const anneeActuelle = new Date().getFullYear();
          const incomeCeMois = incomeList.filter(e => new Date(e.date).getMonth() === moisActuel && new Date(e.date).getFullYear() === anneeActuelle);
          const caMoisCi = incomeCeMois.reduce((s, e) => s + e.amount, 0);
          const nbFactures = incomeCeMois.length;
          const factureMoyenne = nbFactures > 0 ? Math.round((caMoisCi / nbFactures) * 100) / 100 : 0;
          const parClientRevenus = {};
          incomeList.forEach(e => {
            const cle = (e.description?.match(/Client\s*:\s*([^—]+)/)?.[1] || "").trim() || "Non précisé";
            parClientRevenus[cle] = (parClientRevenus[cle] || 0) + e.amount;
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
              const pctA = objA > 0 ? Math.min(100, Math.round((estimateData.ca_annuel / objA) * 100)) : 0;
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
                          <span style={{ fontSize: 24, fontWeight: 700, color: INK }}>{formatEUR(estimateData.ca_annuel)}</span>
                          <span style={{ fontSize: 13, color: "#8BA5C0" }}>sur</span>
                          <i className="ti ti-pencil" aria-hidden="true" style={{ fontSize: 13, color: "#8BA5C0" }} />
                          <input style={{ ...S.objectifInputBig, color: "#0F6E56", borderColor: "#5DCAA5", background: "#F0FAF6" }} type="number" value={objectifAnnuel} onChange={e => setObjectifAnnuel(e.target.value)} />
                          <span style={{ fontSize: 12, color: objectifAnnuelSaved ? "#1D9E75" : "transparent", transition: "opacity 0.3s", marginLeft: 4 }}>✓ enregistré</span>
                        </div>
                        <div style={S.progressTrack}><div style={{ ...S.progressFill, background: "#5DCAA5", width: `${pctA}%`, transition: "width 0.3s ease" }} /></div>
                        {estimateData.ca_annuel === 0 && (
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
                {incomeList.length === 0 ? <p style={S.empty}>Aucun revenu enregistré.</p> : incomeList.map(entry => (
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
                  <p style={S.empty}>Aucun frais enregistré.</p>
                ) : expensesList.map(exp => (
                  <div key={exp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "0.5px solid #EEF2F7" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: INK }}>{exp.description || labelCategorie(exp.categorie)}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{formatDate(exp.date)}</div>
                    </div>
                    <span style={{ background: "#E6F1FB", color: "#0C447C", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{labelCategorie(exp.categorie)}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: INK, minWidth: 60, textAlign: "right", flexShrink: 0 }}>{formatEUR(exp.montant)}</span>
                    <button aria-label="Supprimer" onClick={() => handleDeleteExpense(exp.id)} style={S.deleteBtn}>✕</button>
                  </div>
                ))}
              </div>
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
                <span style={{ fontSize: 13, color: "#5B6573" }}>H€CTOR ne se connecte jamais à ta banque</span>
                <span style={{ ...S.badge, ...S.badgeGreen }}>🟢 Privé par conception</span>
              </div>
              <p style={{ fontSize: 11, color: "#8BA5C0", marginTop: 10, lineHeight: 1.5 }}>
                Tes identifiants bancaires ne nous sont jamais demandés et tes transactions ne quittent jamais ta banque. Tu mets ton solde à jour en 10 secondes sur le Cockpit, et H€CTOR fait le reste. C'est plus simple, et c'est toi qui gardes le contrôle.
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
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Conseils & optimisation</h1><p style={S.pageSub}>Personnalisés selon votre situation</p></div></div>
            <div style={S.card}>
              {CONSEILS.map((c, i) => (
                <div key={i} style={S.conseilItem}>
                  <div style={S.conseilIcon}><i className={`ti ${c.icon}`} aria-hidden="true" style={{ fontSize: 16 }} /></div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 4 }}>{c.titre}</div>
                    <div style={{ fontSize: 13, color: "#5B6573", lineHeight: 1.5 }}>{c.texte}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nav === "assistant" && (
          <div>
            <div style={isMobile ? { ...S.pageHeader, flexDirection: "column", alignItems: "flex-start", gap: 10 } : S.pageHeader}><div><h1 style={S.pageTitle}>Ton copilote</h1><p style={S.pageSub}>Il connaît tes chiffres et te conseille pour de vrai</p></div></div>
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
                    <i className={`ti ${isListening ? "ti-microphone-filled" : "ti-microphone"}`} aria-hidden="true" style={{ fontSize: 18 }} />
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
      </main>
    </div>
  );
}

export default Sentry.withErrorBoundary(AppInner, {
  fallback: ({ resetError }) => (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: 18, fontWeight: 600, color: "#0A2540" }}>Une erreur inattendue est survenue</p>
      <p style={{ fontSize: 14, color: "#6B7A8D", maxWidth: 380 }}>L'équipe H€CTOR a été automatiquement prévenue. Vous pouvez réessayer ou recharger la page.</p>
      <button onClick={() => { resetError(); window.location.reload(); }} style={{ background: "#378ADD", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Recharger la page
      </button>
    </div>
  ),
});

const INK = "#0A2540";
const ACCENT = "#378ADD";
const PAPER = "#F0F4F8";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,83,61,0.5); } 50% { box-shadow: 0 0 0 6px rgba(224,83,61,0); } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: ${PAPER}; }
  button { font-family: inherit; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  input, select, textarea, button { transition: border-color 0.15s, background 0.15s, transform 0.1s; }
  input:focus, select:focus, textarea:focus { border-color: #378ADD !important; box-shadow: 0 0 0 3px rgba(55,138,221,0.12); }
  button:active { transform: scale(0.98); }
`;

const S = {
  authPage: { display: "flex", flexDirection: "column", minHeight: "100vh", background: INK },
  authLeft: { padding: "48px 24px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 640, margin: "0 auto", width: "100%" },
  authHero: { fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: "white", margin: "24px 0 12px", lineHeight: 1.2 },
  authSub: { fontSize: 14, color: "#8BA5C0", lineHeight: 1.5, margin: "0 0 24px" },
  authFeatures: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  authFeatureCard: { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px" },
  authFeatureTitle: { fontSize: 12, fontWeight: 600, color: "white", lineHeight: 1.3 },
  authFeatureDesc: { fontSize: 11, color: "#8BA5C0", lineHeight: 1.4, marginTop: 3 },
  simWidget: { marginTop: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 18 },
  simInput: { flex: 1, fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  simSelect: { flex: 1, fontFamily: "inherit", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", outline: "none", background: "rgba(255,255,255,0.08)", color: "white" },
  authRight: { width: "100%", maxWidth: 460, margin: "0 auto", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px 48px", borderRadius: "20px 20px 0 0" },
  authCard: { width: "100%", background: "white", borderRadius: 16, border: "0.5px solid #DDE5EE", padding: 32 },
  authTitle: { fontSize: 20, fontWeight: 600, color: INK, margin: "0 0 20px" },
  appWrap: { display: "flex", minHeight: "100vh", background: PAPER },
  mobileTopbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: INK, position: "sticky", top: 0, zIndex: 60 },
  sidebarBackdrop: { position: "fixed", inset: 0, background: "rgba(10,37,64,0.5)", zIndex: 75 },
  sidebar: { width: 220, background: INK, display: "flex", flexDirection: "column", padding: "20px 0", flexShrink: 0, transition: "width 0.2s" },
  sidebarClosed: { width: 64 },
  sidebarTop: { padding: "0 16px 24px", display: "flex", justifyContent: "center" },
  sidebarBottom: { marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 0 0" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", fontSize: 13, color: "#8BA5C0", cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", borderLeft: "3px solid transparent" },
  navItemActive: { color: "white", background: "rgba(255,255,255,0.06)", borderLeftColor: ACCENT },
  navLabel: { whiteSpace: "nowrap" },
  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 18px" },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 600, flexShrink: 0 },
  mainContent: { flex: 1, padding: "28px 32px", overflowY: "auto" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 600, color: INK, margin: 0 },
  pageSub: { fontSize: 13, color: "#6B7A8D", margin: "4px 0 0" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 },
  kpiCard: { background: "white", borderRadius: 12, border: "0.5px solid #DDE5EE", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 },
  kpiLabel: { fontSize: 11, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 24, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" },
  kpiSub: { fontSize: 11, color: "#8BA5C0" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "white", borderRadius: 12, border: "0.5px solid #DDE5EE", padding: "18px 20px", marginBottom: 0 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: INK, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardSub: { fontSize: 12, color: "#6B7A8D", fontWeight: 400 },
  monthRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #F0F4F8" },
  monthName: { fontSize: 11, color: "#6B7A8D", width: 28, flexShrink: 0 },
  barTrack: { flex: 1, height: 6, background: "#EEF2F7", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, background: ACCENT },
  monthAmt: { fontSize: 12, color: INK, width: 72, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  monthUrssaf: { fontSize: 11, color: "#854F0B", width: 68, textAlign: "right" },
  progressTrack: { height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden", margin: "8px 0 6px" },
  progressFill: { height: "100%", borderRadius: 4, background: ACCENT },
  newsItem: { padding: "8px 0", borderBottom: "0.5px solid #EEF2F7" },
  newsSource: { fontSize: 10, color: "#0F6E56", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block" },
  newsTitle: { fontSize: 12, color: INK, marginTop: 2, display: "block", textDecoration: "none", lineHeight: 1.4 },
  newsDate: { fontSize: 11, color: "#8BA5C0", display: "block", marginTop: 2 },
  urssafLink: { fontSize: 12, color: ACCENT, textDecoration: "none", display: "block", marginTop: 10 },
  alertChip: { background: "#FAEEDA", color: "#633806", fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 },
  conseilItem: { display: "flex", gap: 12, padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  conseilIcon: { width: 30, height: 30, borderRadius: 8, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#0C447C" },
  aiMsg: { maxWidth: "70%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.5 },
  aiMsgBot: { background: "#F0F4F8", color: INK, borderRadius: "4px 12px 12px 12px" },
  aiMsgUser: { background: ACCENT, color: "white", borderRadius: "12px 4px 12px 12px" },
  incomeRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  incomeAmt: { display: "block", fontSize: 14, fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums" },
  incomeMeta: { display: "block", fontSize: 12, color: "#6B7A8D", marginTop: 2 },
  badge: { fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" },
  badgeGreen: { background: "#E1F5EE", color: "#0F6E56" },
  badgeGray: { background: "#F1F2EE", color: "#5B6573" },
  badgeBlue: { background: "#E6F1FB", color: "#0C447C" },
  badgeOrange: { background: "#FAEEDA", color: "#633806" },
  deleteBtn: { background: "none", border: "none", color: "#B0B6A8", cursor: "pointer", fontSize: 14, padding: 4 },
  netPreview: { background: "#F7F9F5", border: "1px solid #DDE5EE", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 },
  netRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5B6573" },
  factureHeaderRow: { display: "flex", gap: 8, marginBottom: 6, paddingBottom: 6, borderBottom: "0.5px solid #DDE5EE" },
  factureRow: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center" },
  dropZoneSmall: { display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed #DDE5EE", borderRadius: 8, padding: "14px 16px", cursor: "pointer", fontSize: 13, color: "#5B6573", background: "white", marginBottom: 12 },
  empty: { fontSize: 13, color: "#8BA5C0", textAlign: "center", padding: "24px 0" },
  bankCard: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 10px", border: "1px dashed #DDE5EE", borderRadius: 10, background: "#FAFBFC", cursor: "not-allowed" },
  bankHero: { background: "white", border: "0.5px solid #DDE5EE", borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 16 },
  dispoHero: { background: INK, borderRadius: 14, padding: "22px 26px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 },
  dispoLabel: { fontSize: 12, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  dispoValue: { fontSize: 36, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" },
  dispoSub: { fontSize: 11, color: "#8BA5C0", marginTop: 4 },
  dispoEmpty: { fontSize: 13, color: "#B5D4F4", marginTop: 6, maxWidth: 320 },
  dispoPlaisirLabel: { fontSize: 11, color: "#8BA5C0", fontWeight: 600 },
  dispoPlaisirValue: { fontSize: 22, fontWeight: 700, color: "#FAC775", marginTop: 2 },
  linkBtnLight: { background: "none", border: "none", color: "#5DCAA5", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" },
  objectifInput: { width: 110, fontFamily: "inherit", fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid #DDE5EE", textAlign: "right" },
  objectifInputBig: { width: 90, fontFamily: "inherit", fontSize: 18, fontWeight: 600, color: ACCENT, padding: "4px 8px", borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: "#F4F9FF" },
  achatResult: { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10 },
  modelText: { fontSize: 12, color: "#3D4452", whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#FAFBFC", border: "1px solid #EEF2F7", borderRadius: 8, padding: "12px 14px", margin: 0, lineHeight: 1.6 },
  inlineEditValue: { width: 90, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#854F0B", padding: "4px 8px", borderRadius: 6, border: "1px solid #EEF2F7", textAlign: "right" },
  askHectorBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: `linear-gradient(135deg, ${ACCENT}, #2563A8)`, color: "white", border: "none", borderRadius: 14, padding: "16px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 18, boxShadow: "0 4px 14px rgba(55,138,221,0.3)" },
  quickAskChip: { background: "white", border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 20, padding: "8px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  salaireRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  recoRow: { display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0" },
  recoNum: { width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  scoreDetailRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0" },
  scoreBarTrack: { flex: 1, height: 6, background: "#EEF2F7", borderRadius: 3, overflow: "hidden" },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  simBarTrack: { display: "flex", height: 36, borderRadius: 10, overflow: "hidden", background: "#EEF2F7" },
  simBarSeg: { height: "100%", transition: "width 0.2s ease" },
  legendDot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 5, verticalAlign: 1 },
  toggleBtn: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #DDE5EE", background: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "#5B6358" },
  toggleBtnActive: { border: `1.5px solid ${ACCENT}`, background: "#E6F1FB", color: "#0C447C" },
  paniqueLine: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5B6573", padding: "9px 0", borderBottom: "0.5px solid #EEF2F7" },
  paniqueLineLabel: { display: "flex", alignItems: "center" },
  paniqueResult: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 20, marginTop: 8 },
  paniqueResultLabel: { fontSize: 12, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  paniqueResultValue: { fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  checkRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0" },
  diagGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" },
  compteursRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, marginBottom: 18 },
  compteurCard: { background: "white", border: "0.5px solid #DDE5EE", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 2, textAlign: "center" },
  compteurLabel: { fontSize: 11, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 },
  compteurValue: { fontSize: 20, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 },
  compteurSub: { fontSize: 11, color: "#8BA5C0" },
  heroDispo: { background: INK, borderRadius: 16, padding: "30px 28px", marginBottom: 16, textAlign: "center" },
  heroDispoLabel: { fontSize: 13, color: "#8BA5C0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  heroDispoValue: { fontSize: 52, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 },
  heroDispoSub: { fontSize: 14, color: "#B5D4F4", marginTop: 10 },
  soldeInputCard: { display: "flex", alignItems: "center", gap: 14, background: "white", border: "1px solid #DDE5EE", borderRadius: 12, padding: "12px 16px", marginBottom: 14 },
  onboardingNotice: { display: "flex", alignItems: "center", gap: 14, background: "#E6F1FB", border: "1px solid #B5D4F4", borderRadius: 12, padding: "14px 16px", marginBottom: 14, flexWrap: "wrap" },
  explainBanner: { background: "#F4F9FF", border: "1px solid #D6E8FA", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#28425E", marginBottom: 14, lineHeight: 1.5 },
  impactRow: { fontSize: 13, color: "#3D4452", padding: "4px 0" },
  impactCompareCard: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px" },
  impactRowDark: { fontSize: 13, color: "#C5D4E3", padding: "4px 0" },
  doublonWarning: { background: "#FAEEDA", border: "1px solid #EF9F27", borderRadius: 10, padding: "14px 16px" },
  aVerifierTag: { fontSize: 9, fontWeight: 600, color: "#854F0B", background: "#FAEEDA", padding: "1px 6px", borderRadius: 6, marginLeft: 6, textTransform: "uppercase" },
  soldeInput: { border: "none", outline: "none", fontSize: 18, fontWeight: 600, color: INK, width: "100%", padding: 0 },
  sidebarGreeting: { padding: "0 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 },
  profilAvatar: { width: 52, height: 52, borderRadius: "50%", background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "#0C447C", flexShrink: 0 },
  heroDetailRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#B5D4F4", padding: "4px 0" },
  projRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#5B6573", padding: "10px 0", borderBottom: "0.5px solid #EEF2F7" },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 500, color: "#3D4452", marginBottom: 14 },
  checkboxLabel: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#3D4452", marginBottom: 12, lineHeight: 1.4 },
  input: { fontFamily: "inherit", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid #DDE5EE", outline: "none", width: "100%" },
  btnPrimary: { width: "100%", background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnPrimarySmall: { background: ACCENT, color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnSecondary: { background: "white", color: ACCENT, border: `1px solid ${ACCENT}`, borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  linkBtn: { background: "none", border: "none", color: ACCENT, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" },
  statutCard: { position: "relative", textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid #DDE5EE", background: "white", fontSize: 14, fontWeight: 500, cursor: "pointer", color: INK, width: "100%" },
  statutCardActive: { border: `1.5px solid ${ACCENT}`, background: "#E6F1FB" },
  statutCardDisabled: { color: "#9098A6", cursor: "not-allowed", background: "#F7F8F5" },
  comingSoon: { float: "right", fontSize: 10, fontWeight: 600, background: "#EDEAE0", color: "#8A7F5C", padding: "2px 8px", borderRadius: 6 },
  orDivider: { textAlign: "center", fontSize: 12, color: "#8A9182", margin: "8px 0" },
  errorBanner: { background: "#FCEBEB", color: "#A32D2D", border: "1px solid #F7C1C1", borderRadius: 8, padding: "12px 16px", fontSize: 14, marginBottom: 16 },
  switchAuth: { fontSize: 13, color: "#5B6573", textAlign: "center", marginTop: 16 },
  echeanceBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "14px 18px", marginBottom: 20, gap: 12 },
  echeanceBannerNormal: { background: "#E6F1FB", color: "#0C447C", border: "1px solid #B5D4F4" },
  echeanceBannerWarning: { background: "#FAEEDA", color: "#633806", border: "1px solid #FAC775" },
  echeanceBannerUrgent: { background: "#FCEBEB", color: "#791F1F", border: "1px solid #F7C1C1" },
};