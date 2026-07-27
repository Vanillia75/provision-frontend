// ─────────────────────────────────────────────────────────────────────────────
//  Page « Nouveautés » : tout ce que TOTOR a appris à faire, vague après vague.
//  Accessible connecté ou non (montotor.fr/nouveautes, footers des landings,
//  pieds de page des réglages). Connecté : filtrée sur le métier de l'utilisateur.
//  Pour ajouter une vague : un bloc en TÊTE de VAGUES, en français simple,
//  voix de Totor à la première personne. « qui » : "intermittent" | "ae" | "tous".
// ─────────────────────────────────────────────────────────────────────────────
import { CSS } from "./theme";

const VAGUES = [
  {
    date: "27 juillet 2026",
    titre: "Je sais enfin calculer l'allocation des techniciens",
    items: [
      { qui: "intermittent", texte: "Techniciens et ouvriers du spectacle (annexe 8) : je calcule maintenant votre allocation journalière. Jusqu'ici je me taisais, parce que je n'avais jamais pu vérifier mon calcul sur un vrai dossier de technicien. C'est vérifié : je me suis confronté au simulateur officiel de France Travail sur vingt-quatre situations différentes, et je tombe juste." },
      { qui: "intermittent", texte: "Je ne me tais plus non plus au-dessus de 60 € par jour. Le calcul des cotisations qui me manquait à ce niveau est percé, y compris la règle qui empêche la CSG de faire descendre ton allocation sous un certain plancher." },
      { qui: "intermittent", texte: "J'ai trouvé une erreur chez moi au passage, et je la corrige : le plafond de l'allocation journalière que j'utilisais était trop haut. Pour les très gros salaires, j'annonçais plus que la réalité. C'est réparé." },
      { qui: "intermittent", texte: "Ma règle ne change pas d'un pouce : je ne te donne un chiffre que si je l'ai vérifié ailleurs qu'en moi-même. C'est juste que maintenant, j'en ai vérifié beaucoup plus." },
      { qui: "tous", texte: "Nouveau simulateur en accès libre sur montotor.fr/simulateur-allocation-intermittent : calcule ton allocation journalière sans compte et sans email. Tu peux le partager à qui tu veux, même à quelqu'un qui n'a pas l'application. Et contrairement aux autres, il te donne ton NET, pas seulement ton brut." },
      { qui: "intermittent", texte: "Nouvelle entrée « Simuler une allocation » dans ton menu. Elle s'ouvre déjà remplie avec tes vrais chiffres : tu changes ce que tu veux pour voir l'effet, plus d'heures, un meilleur cachet, l'autre annexe. Ton dossier n'est pas touché, c'est un brouillon." },
      { qui: "intermittent", texte: "Tes actualisations passées se déplient : tape sur une ligne de ton historique et tu revois exactement ce que tu avais déclaré ce mois-là, employeur par employeur, avec la date à laquelle tu l'as fait. Sur l'écran Actualisation comme dans Mes documents." },
      { qui: "ae", texte: "Mon menu ne se cache plus. « Facturer » et « Déclarer » étaient repliés par défaut : beaucoup d'entre vous ne savaient tout simplement pas que je sais faire vos factures, vos devis et préparer votre URSSAF. Ils sont ouverts maintenant. Désolé, c'était ma faute." },
      { qui: "ae", texte: "Nouvelle carte sur ton cockpit si tu n'as encore ni facture ni devis : je te montre ce que je sais faire pour toi. Factures et devis aux normes, bouton « Payer en ligne » pour que tes clients paient par carte sans commission de ma part, relances d'impayés automatiques, et un devis accepté qui devient une facture en un clic. Si tu ne factures jamais, un bouton l'écarte pour de bon." },
    ],
  },
  {
    date: "26 juillet 2026",
    titre: "Ton classeur, et tes différés comptés",
    items: [
      { qui: "intermittent", texte: "Nouvel onglet « Mon classeur » dans Mes documents : dépose tes contrats, bulletins de paie et certificats Congés Spectacles, je les range par employeur. Plus besoin de fouiller la boîte mail de la production le jour où on te les réclame." },
      { qui: "intermittent", texte: "Les différés d'indemnisation (congés payés, salaires) entrent enfin dans l'estimation de ton mois : tu recopies ce qu'il te reste depuis ta notification, je déduis les bons jours et je te dis ce qu'il restera après." },
      { qui: "intermittent", texte: "Dans « Mes AEM », chaque ligne a maintenant son bouton « Voir » : le document original s'il est conservé, sinon tout ce que j'en ai retenu (employeur, période, cachets, brut), avec la modification à un clic." },
      { qui: "intermittent", texte: "Ton compteur d'heures actuel s'affiche en grand sur le cockpit, à côté de ce qu'il te reste à faire." },
    ],
  },
  {
    date: "24 juillet 2026",
    titre: "Ton prochain renouvellement, projeté",
    items: [
      { qui: "intermittent", texte: "« Ton mois en cours » : j'estime ton versement France Travail du mois (jours indemnisés, jours déduits par tes contrats, montant net). Estimation assumée : je me calerai au centime sur ton premier relevé de situation." },
      { qui: "tous", texte: "Je garde le fil de nos conversations : tu retrouves « Parle à Totor » là où on s'était arrêtés, d'un jour à l'autre et d'un appareil à l'autre. Un bouton « Repartir de zéro » efface tout quand tu veux." },
      { qui: "intermittent", texte: "Nouvelle carte « Ton prochain renouvellement » sur ton cockpit : ton allocation journalière projetée à partir des heures et salaires que tu as déjà déclarés, avec le détail du calcul à l'appui." },
      { qui: "intermittent", texte: "La courbe « chaque cachet compte » : tu vois la pente réelle de ton allocation, sans paliers imaginaires." },
      { qui: "intermittent", texte: "Le mini-simulateur dans la carte : « Et si j'ajoute 5 cachets à 200 € ? », et je te réponds tout de suite." },
      { qui: "intermittent", texte: "Le « Que se passe-t-il si » chiffre aussi l'impact sur ton allocation quand tu me donnes le prix du cachet." },
      { qui: "intermittent", texte: "Quand tu me demandes un repère officiel publié (planchers, plafond), je te le donne, daté de sa valeur en cours, au lieu de rester vague." },
      { qui: "intermittent", texte: "Nouvelle catégorie « Autre salaire (hors 507h) » pour tes contrats hors spectacle : comptés dans tes revenus, jamais dans tes heures." },
      { qui: "intermittent", texte: "Saisie sur une période : « au total » par défaut, avec un récapitulatif en direct avant d'enregistrer." },
      { qui: "intermittent", texte: "Quand une AEM scannée correspond à une ligne estimée, je te propose de remplacer l'estimation en un clic." },
      { qui: "intermittent", texte: "Le total de tes cachets s'affiche dans « Mes AEM » et au récapitulatif de revenus." },
    ],
  },
  {
    date: "23 juillet 2026",
    titre: "Ton carnet d'activités aux petits soins",
    items: [
      { qui: "intermittent", texte: "Édition complète d'une activité : dates de début et de fin, salaire brut, prélèvement à la source." },
      { qui: "intermittent", texte: "Alerte doublon : tu tranches « c'est un doublon » ou « non, tout est bon », et l'alerte s'efface." },
      { qui: "intermittent", texte: "Droits sécurisés : ton nombre d'heures exact s'affiche en grand dès que le seuil est passé." },
      { qui: "intermittent", texte: "Scan renforcé : les documents de plusieurs pages sont lus par lots, et je retente tout seul si une page résiste." },
      { qui: "intermittent", texte: "Le petit calendrier des champs de date est enfin lisible sur fond sombre." },
      { qui: "ae", texte: "Totor prend la pose sur ta carte d'accueil : son portrait change avec son humeur." },
    ],
  },
  {
    date: "22 juillet 2026",
    titre: "Tes factures payées en ligne, et une vraie ligne téléphonique",
    items: [
      { qui: "ae", texte: "Tes clients peuvent payer ta facture en ligne, par carte : elle passe « payée » toute seule dès l'encaissement." },
      { qui: "tous", texte: "TOTOR répond au téléphone : une ligne dédiée, réservée aux abonnés. Le numéro t'attend dans ton application." },
    ],
  },
  {
    date: "Mi-juillet 2026",
    titre: "TOTOR dans ta poche",
    items: [
      { qui: "tous", texte: "L'application iOS est disponible sur l'App Store." },
      { qui: "tous", texte: "Connexion avec Apple, en plus de Google et de l'adresse email." },
      { qui: "tous", texte: "7 jours d'essai gratuit de TOTOR Veille depuis l'application mobile." },
      { qui: "intermittent", texte: "Prélèvement à la source : je recopie les montants réellement inscrits sur tes bulletins, jamais une estimation." },
      { qui: "intermittent", texte: "Les offres d'emploi du spectacle se consultent sans compte, directement sur la page d'accueil intermittent." },
      { qui: "ae", texte: "Les relances polies des factures impayées, envoyées pour toi : une seule relance par facture, jamais plus." },
      { qui: "tous", texte: "La promesse est clarifiée : en gratuit, je te montre tout ; avec TOTOR Veille, je m'en occupe." },
    ],
  },
  {
    date: "Au fil de juillet 2026",
    titre: "Tes rendez-vous du 20 et du 28, et le pilotage",
    items: [
      { qui: "intermittent", texte: "L'assistant d'actualisation prépare ton rendez-vous du 28 ligne par ligne, et un email te prévient le jour venu." },
      { qui: "ae", texte: "L'assistant URSSAF fait pareil pour ta déclaration : la période écoulée, les bons montants, et un email le 20." },
      { qui: "ae", texte: "« Je regarde ton mois prochain » : la projection de ton mois à venir, directement sur ton tableau de bord." },
      { qui: "ae", texte: "Le salaire lissé : combien te verser chaque mois sereinement, en trois niveaux (prudent, recommandé, maximum)." },
      { qui: "intermittent", texte: "« Mes jours par employeur » : le suivi de tes jours chez chaque employeur, avec le quota que tu t'es fixé." },
      { qui: "intermittent", texte: "Tes contrats à venir comptent dans la projection, avec leur badge « À venir »." },
    ],
  },
  {
    date: "Juin 2026",
    titre: "Les fondations",
    items: [
      { qui: "intermittent", texte: "Le cockpit : tes heures comptées vers les 507, ta fenêtre de référence, ta date anniversaire, et chaque chiffre expliqué, sources à l'appui." },
      { qui: "intermittent", texte: "Le scan des AEM, GUSO et FCTU : une photo ou un PDF, et tes heures sont déclarées." },
      { qui: "intermittent", texte: "Le simulateur d'allocation journalière, fondé sur les règles officielles publiées." },
      { qui: "intermittent", texte: "L'import de ta notification ARE, pour partir de ton dossier réel." },
      { qui: "ae", texte: "La facturation conforme : factures aux mentions obligatoires, TVA gérée, numérotation propre." },
      { qui: "ae", texte: "Tes cotisations provisionnées à chaque encaissement : tu vois ton disponible réel, pas un solde trompeur." },
      { qui: "tous", texte: "« Parle à Totor » : tu poses ta question, je réponds avec tes chiffres à toi." },
      { qui: "tous", texte: "L'aide qui connaît ton écran : la pastille « Totor · aide », toujours là, jamais décomptée de ton quota." },
      { qui: "tous", texte: "La page « Ce que j'ai appris » : tout ce que je sais faire, métier par métier." },
    ],
  },
];

const BADGES = {
  intermittent: { label: "Intermittents", couleur: "#8FC2F0", fond: "rgba(55,138,221,0.16)" },
  ae: { label: "Auto-entrepreneurs", couleur: "#7FDCC0", fond: "rgba(93,202,165,0.14)" },
  tous: { label: "Tout le monde", couleur: "#9DB3C8", fond: "rgba(255,255,255,0.07)" },
};

export function NouveautesPage({ onBack, statut }) {
  const SERIF = "'Playfair Display', Georgia, serif";
  // Connecté : on ne montre que ce qui concerne le métier de la personne
  // (séparation stricte des métiers). Sans compte : tout, avec les badges.
  const visibles = statut === "intermittent" ? ["intermittent", "tous"]
    : statut === "auto_entrepreneur" ? ["ae", "tous"] : null;
  const vagues = VAGUES
    .map(v => ({ ...v, items: visibles ? v.items.filter(i => visibles.includes(i.qui)) : v.items }))
    .filter(v => v.items.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#07192E", padding: "32px 20px" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#B5D4F4", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, padding: "6px 2px", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 16 }} /> Retour
        </button>

        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5DCAA5", marginBottom: 10 }}>TOTOR grandit chaque semaine</div>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.2, margin: "0 0 10px" }}>Les nouveautés</h1>
        <p style={{ fontSize: 14, color: "#8BA5C0", lineHeight: 1.7, margin: "0 0 28px", maxWidth: 560 }}>
          Tout ce que j'ai appris à faire depuis le début, vague après vague. Les nouveautés arrivent toutes seules dans ton application, tu n'as rien à installer.
          {visibles ? " Ici, je te montre ce qui concerne ton métier." : ""}
        </p>

        {vagues.map((v, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.09)", padding: "24px 26px", marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#5DCAA5", marginBottom: 6 }}>{v.date}</div>
            <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: "white", margin: "0 0 14px", lineHeight: 1.25 }}>{v.titre}</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {v.items.map((it, j) => {
                const badge = visibles ? null : BADGES[it.qui];
                return (
                  <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
                    <i className="ti ti-check" aria-hidden="true" style={{ color: "#5DCAA5", fontSize: 15, marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: "#C5D4E3", lineHeight: 1.65 }}>
                      {it.texte}
                      {badge && (
                        <span style={{ display: "inline-block", marginLeft: 8, padding: "1.5px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: badge.couleur, background: badge.fond, whiteSpace: "nowrap", verticalAlign: "1px" }}>{badge.label}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <p style={{ fontSize: 12.5, color: "#8BA5C0", lineHeight: 1.7, margin: "24px 0 8px", textAlign: "center" }}>
          Une idée, un manque, un truc qui t'agace ?{" "}
          <a href="mailto:bonjour@montotor.fr" style={{ color: "#5DCAA5", fontWeight: 700, textDecoration: "none" }}>bonjour@montotor.fr</a>
        </p>
      </div>
    </div>
  );
}
