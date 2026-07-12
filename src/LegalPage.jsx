// ─────────────────────────────────────────────────────────────────────────────
//  Pages légales (mentions légales, CGU, confidentialité) + leur rendu.
//  Extrait de App.jsx (refactorisation) : contenu identique, simplement déplacé.
//  Seul LegalPageView est exporté ; le reste est interne à ce fichier.
// ─────────────────────────────────────────────────────────────────────────────
import { CSS } from "./theme";

const MENTIONS_LEGALES_MD = `# Mentions légales

**Dernière mise à jour : 20 juin 2026**

## Éditeur du site

L'application TOTOR est éditée par :

**VANILLIA**, société à responsabilité limitée (SARL) au capital de 1 000 €
Siège social : 32 rue Damrémont, 75018 Paris, France
SIREN : 990 086 209
SIRET (siège) : 990 086 209 00014
RCS Paris
Gérant : Camille Gardereau
Contact : bonjour@montotor.fr

## Hébergement

- **Frontend (interface de l'application)** : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis
- **Backend et base de données** : Railway Corporation, États-Unis

Les données peuvent donc être hébergées sur des serveurs situés en dehors de l'Union européenne. Voir la Politique de confidentialité pour le détail des garanties applicables à ces transferts.

## Directeur de la publication

Camille Gardereau, en sa qualité de gérant de VANILLIA.

## Propriété intellectuelle

L'ensemble des éléments composant TOTOR (textes, structure, logiciel, base de données, identité visuelle) est la propriété de VANILLIA, sauf mention contraire. Toute reproduction, représentation, modification ou exploitation non autorisée, totale ou partielle, est interdite.

## Litiges

Les présentes mentions légales sont soumises au droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
`;

const CGU_MD = `# Conditions générales d'utilisation (CGU)

**Dernière mise à jour : 20 juin 2026**

## 1. Objet

Les présentes CGU encadrent l'accès et l'utilisation de l'application TOTOR, éditée par VANILLIA (SARL), destinée à aider les indépendants — notamment les auto-entrepreneurs — à estimer leurs cotisations, suivre leurs revenus et dépenses professionnelles, et gérer leurs obligations déclaratives.

L'utilisation de TOTOR implique l'acceptation pleine et entière des présentes CGU.

## 2. Description du service

TOTOR propose, à la date des présentes :

- l'estimation du montant des cotisations sociales à provisionner, sur la base des informations renseignées par l'utilisateur ;
- le suivi des revenus encaissés et des factures clients ;
- le suivi des frais professionnels ;
- des simulateurs (achat, rémunération, fiscalité) ;
- un assistant conversationnel basé sur l'intelligence artificielle ;
- la recherche d'informations d'entreprise via le répertoire Sirene de l'INSEE.

**TOTOR ne se substitue pas à un expert-comptable, un avocat ou tout autre professionnel du chiffre ou du droit.** Les montants et estimations affichés sont indicatifs et calculés à partir des informations fournies par l'utilisateur ; ils ne constituent ni un conseil personnalisé, ni une déclaration officielle auprès des organismes compétents (URSSAF, impôts, etc.). L'utilisateur reste seul responsable de l'exactitude de ses déclarations et du respect de ses obligations légales et fiscales.

## 3. Inscription et compte utilisateur

L'accès à TOTOR nécessite la création d'un compte (par email/mot de passe ou via connexion Google). L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Il est responsable de toute activité réalisée depuis son compte.

Un utilisateur ne peut créer qu'un compte correspondant à sa propre identité ou à celle de l'entreprise qu'il représente légalement.

## 4. Tarifs

À la date des présentes, TOTOR est proposé gratuitement, dans une version bêta. VANILLIA se réserve la possibilité d'introduire ultérieurement des offres payantes ; les utilisateurs en seront informés préalablement, et aucune modification tarifaire ne sera appliquée rétroactivement sans consentement.

## 5. Obligations de l'utilisateur

L'utilisateur s'engage à :

- ne pas utiliser TOTOR à des fins frauduleuses ou illégales ;
- ne pas tenter de contourner les mesures de sécurité de l'application ;
- ne pas extraire ou réutiliser massivement les données ou le code de l'application ;
- ne renseigner que des données qu'il a le droit de communiquer (ses propres données ou celles de son entreprise).

## 6. Disponibilité du service

TOTOR étant en version bêta, VANILLIA ne garantit pas une disponibilité continue du service. Des interruptions, bugs ou pertes de données ponctuelles peuvent survenir. L'utilisateur est invité à conserver une copie de ses documents importants (factures, justificatifs) en dehors de l'application.

## 7. Responsabilité

VANILLIA met en œuvre des moyens raisonnables pour assurer l'exactitude des calculs proposés, sans garantir l'absence totale d'erreur. La responsabilité de VANILLIA ne saurait être engagée en cas de dommage résultant d'une décision prise par l'utilisateur sur la seule base des informations fournies par TOTOR, ou en cas d'interruption du service.

## 8. Résiliation

L'utilisateur peut supprimer son compte à tout moment depuis l'application ou en en faisant la demande à bonjour@montotor.fr. VANILLIA se réserve le droit de suspendre ou supprimer un compte en cas de manquement aux présentes CGU.

## 9. Modification des CGU

VANILLIA peut modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation de TOTOR après modification vaut acceptation des nouvelles CGU.

## 10. Droit applicable

Les présentes CGU sont soumises au droit français. Tout litige relève, à défaut de résolution amiable, des tribunaux français compétents.

## Contact

Pour toute question relative aux présentes CGU : bonjour@montotor.fr
`;

const CONFIDENTIALITE_MD = `# Politique de confidentialité

**Dernière mise à jour : 20 juin 2026**

La présente politique explique comment VANILLIA (SARL), éditrice de TOTOR, collecte, utilise et protège les données personnelles des utilisateurs, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.

## 1. Responsable de traitement

**VANILLIA**, SARL au capital de 1 000 €, SIREN 990 086 209, 32 rue Damrémont, 75018 Paris.
Contact pour toute question relative à vos données : **bonjour@montotor.fr**

## 2. Données collectées

### 2.1 Données fournies directement par l'utilisateur

- Données de compte : email, mot de passe (chiffré), ou identifiant Google en cas de connexion via Google OAuth
- Données de profil : prénom, nom, téléphone, nom d'entreprise, SIRET, statut juridique, activité
- Données financières : revenus encaissés, factures clients (montants, dates, noms de clients), frais professionnels, solde bancaire déclaratif, objectifs financiers
- Contenu des échanges avec l'assistant conversationnel (IA)
- Documents importés : factures, attestations employeur mensuelles (AEM), attestations France Travail et justificatifs (PDF, images ou photos) téléversés pour extraction automatique de données

### 2.2 Données collectées automatiquement

- Données techniques de connexion (à des fins de sécurité et de bon fonctionnement du service)

TOTOR n'utilise pas de cookies publicitaires ni de traceurs tiers à des fins de suivi commercial. Certaines préférences d'affichage sont stockées localement dans votre navigateur (stockage local), sans transmission à des tiers.

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

- **Railway** : hébergement de la base de données et du serveur applicatif (États-Unis).
- **Vercel** : hébergement de l'interface de l'application (États-Unis).
- **Cloudflare** : stockage sécurisé des documents que vous importez (attestations, justificatifs) et des sauvegardes chiffrées de la base.
- **Anthropic** : modèle d'intelligence artificielle qui répond à l'assistant conversationnel ET qui lit automatiquement les documents et photos que vous importez (factures, attestations) pour en extraire les informations. Les messages échangés et le contenu des documents importés lui sont transmis (États-Unis).
- **Resend** : envoi des emails du service (vérification d'adresse, rappels d'échéance, relances de factures) (États-Unis).
- **Stripe** : traitement des paiements de l'abonnement. Vos coordonnées bancaires de paiement sont saisies directement chez Stripe et ne transitent jamais par nos serveurs (États-Unis et Irlande).
- **Enable Banking** : connexion bancaire optionnelle, en lecture seule, uniquement si vous l'activez, pour synchroniser votre solde. Prestataire agréé dans l'Union européenne (Finlande). Vos identifiants bancaires ne transitent jamais par nos serveurs.
- **Sentry** : diagnostic technique des erreurs de l'application, sans vos données financières ni votre identité (hébergé dans l'Union européenne).
- **Google** : authentification, uniquement si vous choisissez la connexion via Google (États-Unis).
- **INSEE** : répertoire Sirene, uniquement pour les recherches de SIRET que vous initiez (France).

Certains de ces prestataires sont situés hors de l'Union européenne. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou des mécanismes équivalents proposés par ces prestataires.

VANILLIA ne vend ni ne loue vos données personnelles à des tiers à des fins commerciales.

## 5. Durée de conservation

Vos données sont conservées pendant toute la durée d'utilisation active de votre compte. En cas de suppression de votre compte, vos données sont supprimées immédiatement de la base active, sauf obligation légale de conservation plus longue (par exemple, en matière comptable).

Par mesure de sécurité, des sauvegardes chiffrées de la base sont réalisées quotidiennement. Les données d'un compte supprimé peuvent subsister dans ces sauvegardes pendant un maximum de 30 jours après la suppression, avant d'en disparaître définitivement. Ces sauvegardes sont chiffrées, ne sont jamais accessibles publiquement, et ne servent qu'à restaurer le service en cas d'incident.

## 6. Sécurité

VANILLIA met en œuvre des mesures techniques raisonnables pour protéger vos données (chiffrement des mots de passe, connexions sécurisées). Aucun système n'étant infaillible, VANILLIA ne peut garantir une sécurité absolue.

## 7. Vos droits

Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :

- **Droit d'accès** : obtenir une copie des données vous concernant
- **Droit de rectification** : corriger des données inexactes
- **Droit à l'effacement** : demander la suppression de vos données
- **Droit à la portabilité** : recevoir vos données dans un format structuré
- **Droit d'opposition et de limitation** du traitement, dans les cas prévus par la loi

Vous pouvez exercer ces droits directement depuis l'application (modification ou suppression de votre profil et de vos données) ou en nous contactant à **bonjour@montotor.fr**. Nous nous engageons à répondre dans un délai d'un mois.

Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous estimez que vos droits ne sont pas respectés.

## 8. Décision automatisée

Les estimations et recommandations fournies par TOTOR (y compris par l'assistant IA) sont indicatives et n'emportent aucune décision automatisée produisant des effets juridiques sur l'utilisateur.

## 9. Modification de la présente politique

Cette politique peut être mise à jour. La date de dernière mise à jour figure en haut de ce document. En cas de modification substantielle, les utilisateurs en seront informés.

## Contact

Pour toute question ou exercice de vos droits : **bonjour@montotor.fr**
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
    return parts.map((part, i) => (i % 2 === 1 ? <strong key={i} style={{ color: "#FFFFFF" }}>{part}</strong> : part));
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("### ")) {
      flushList();
      blocks.push({ type: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
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

  const SERIF = "'Playfair Display', Georgia, serif";
  return blocks.map((b, i) => {
    if (b.type === "h1") return <h1 key={i} style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 18px" }}>{renderInline(b.text)}</h1>;
    if (b.type === "h2") return <h2 key={i} style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: "white", margin: "28px 0 10px" }}>{renderInline(b.text)}</h2>;
    if (b.type === "h3") return <h3 key={i} style={{ fontSize: 14.5, fontWeight: 700, color: "#E8F4FF", margin: "18px 0 6px" }}>{renderInline(b.text)}</h3>;
    if (b.type === "ul") return <ul key={i} style={{ margin: "8px 0", paddingLeft: 22 }}>{b.items.map((it, j) => <li key={j} style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75 }}>{renderInline(it)}</li>)}</ul>;
    if (b.type === "table") {
      const [header, ...rows] = b.rows;
      return (
        <table key={i} style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0", fontSize: 13.5 }}>
          <thead><tr>{header.map((h, j) => <th key={j} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.16)", color: "#8BA5C0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#E8F4FF" }}>{c}</td>)}</tr>)}</tbody>
        </table>
      );
    }
    return <p key={i} style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "8px 0" }}>{renderInline(b.text)}</p>;
  });
}

// Page contact : même écrin que les pages légales, contenu dédié (email cliquable,
// que le rendu markdown des pages légales ne sait pas faire).
function ContactContent() {
  const SERIF = "'Playfair Display', Georgia, serif";
  return (
    <>
      <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 18px" }}>Contacte-nous</h1>
      <p style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "8px 0 22px" }}>
        Une question, un souci, une idée ? Écris-nous, on te répond avec plaisir. On est une petite équipe, on lit tout.
      </p>
      <a href="mailto:bonjour@montotor.fr"
        style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#5DCAA5", color: "#04342C", borderRadius: 11, padding: "13px 22px", fontSize: 14.5, fontWeight: 700, textDecoration: "none" }}>
        <i className="ti ti-mail" aria-hidden="true" style={{ fontSize: 17 }} />
        bonjour@montotor.fr
      </a>
      <p style={{ fontSize: 12.5, color: "#8BA5C0", lineHeight: 1.6, margin: "18px 0 0" }}>
        On répond en général sous 48 heures.
      </p>
    </>
  );
}

// Page « Suppression de compte » : exigée par Google Play (et utile à tous).
// Accessible sans connexion, même écrin sombre que les pages légales.
function SuppressionCompteContent() {
  const SERIF = "'Playfair Display', Georgia, serif";
  const pStyle = { fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.75, margin: "8px 0" };
  const h2Style = { fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: "white", margin: "28px 0 10px" };
  return (
    <>
      <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 18px" }}>Supprimer ton compte TOTOR</h1>
      <p style={pStyle}>
        Ton compte t'appartient, et le supprimer est simple et définitif. Cette page explique comment faire, et ce que deviennent tes données. Pour toute question : <a href="mailto:bonjour@montotor.fr" style={{ color: "#5DCAA5", fontWeight: 700 }}>bonjour@montotor.fr</a>.
      </p>

      <h2 style={h2Style}>Depuis l'application (recommandé)</h2>
      <p style={pStyle}>
        Connecte-toi à TOTOR, ouvre <strong style={{ color: "white" }}>Réglages</strong>, puis descends jusqu'au bouton <strong style={{ color: "white" }}>« Supprimer mon compte »</strong>. Une confirmation t'est demandée (tu tapes le mot SUPPRIMER pour éviter toute fausse manipulation), et la suppression est immédiate.
      </p>

      <h2 style={h2Style}>Par email, si tu préfères</h2>
      <p style={pStyle}>
        Écris-nous à <a href="mailto:bonjour@montotor.fr" style={{ color: "#5DCAA5", fontWeight: 700 }}>bonjour@montotor.fr</a> depuis l'adresse de ton compte, en demandant sa suppression. On s'en occupe et on te confirme, en général sous 48 heures et au plus tard sous un mois.
      </p>

      <h2 style={h2Style}>Ce qui est supprimé</h2>
      <p style={pStyle}>
        Tout ce qui te concerne : ton compte et ton email, ton profil, les données financières que tu as saisies (revenus, dépenses, factures, activités, montants), les documents et photos que tu as importés (AEM, attestations, justificatifs), tes échanges avec l'assistant et tes traces de connexion. La suppression de la base active est immédiate.
      </p>

      <h2 style={h2Style}>Ce qui peut être conservé, et combien de temps</h2>
      <p style={pStyle}>
        Par sécurité, des sauvegardes chiffrées de la base sont réalisées régulièrement : les données d'un compte supprimé peuvent y subsister au maximum <strong style={{ color: "white" }}>30 jours</strong> avant d'en disparaître définitivement. Ces sauvegardes ne sont jamais accessibles publiquement et ne servent qu'à restaurer le service en cas d'incident. Enfin, si la loi nous impose de conserver certains éléments plus longtemps (par exemple des pièces comptables liées à un abonnement payant), ils sont gardés uniquement le temps légal, puis supprimés.
      </p>

      <p style={{ ...pStyle, marginTop: 22, color: "#8BA5C0", fontSize: 12.5 }}>
        Application concernée : TOTOR (montotor.fr). Détails complets dans notre politique de confidentialité, accessible depuis le pied de page du site.
      </p>
    </>
  );
}

export function LegalPageView({ page, onBack }) {
  const content = page === "mentions" ? MENTIONS_LEGALES_MD : page === "cgu" ? CGU_MD : CONFIDENTIALITE_MD;
  return (
    <div style={{ minHeight: "100vh", background: "#07192E", padding: "32px 20px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#B5D4F4", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, padding: "6px 2px", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 16 }} /> Retour
        </button>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)", padding: "32px 36px" }}>
          {page === "contact" ? <ContactContent /> : page === "suppression-compte" ? <SuppressionCompteContent /> : renderLegalMarkdown(content)}
        </div>
      </div>
    </div>
  );
}
