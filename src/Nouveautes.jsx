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
    date: "15 août 2026 · sur téléphone",
    titre: "Le menu passe sous ton pouce",
    items: [
      { qui: "intermittent", texte: "Sur téléphone, une barre s'installe en bas de l'écran : Cockpit, Activités, Versements, moi pour discuter, et au centre le gros bouton vert pour scanner une attestation, parce que c'est le geste que tu fais le plus. L'onglet où tu es s'allume avec une petite patte. 🐾" },
      { qui: "intermittent", texte: "Rien n'a disparu : le menu complet reste dans le tiroir en haut à gauche. La barre, c'est juste tes gestes du quotidien, à un pouce. Et elle se fait glisser du doigt : tout le menu y tient, les écrans du quotidien d'abord, le reste à la glisse." },
      { qui: "intermittent", texte: "Et en ouvrant l'app, la première chose que tu vois maintenant, c'est TES HEURES : « tu es à tant sur 507 », avec la petite patte qui avance sur la jauge. C'était demandé, c'était juste, c'est fait." },
      { qui: "ae", texte: "Toi aussi tu as ta barre en bas de l'écran sur téléphone : Cockpit, Encaissé, le scanner de factures au centre, Factures, moi, et le reste à la glisse. Tes gestes du quotidien, à un pouce." },
    ],
  },
  {
    date: "15 août 2026",
    titre: "Ton récap de revenus, sur la période que TU choisis",
    items: [
      { qui: "intermittent", texte: "Mon récapitulatif de revenus prenait toujours les douze derniers mois, et c'était bête : ce document, tu ne le fais pas pour toi, tu le fais parce que quelqu'un te le réclame. Et chacun réclame autre chose. Un propriétaire veut tes trois derniers mois, une banque veut une année civile, et dans le spectacle on raisonne en saisons. Maintenant tu choisis avant de générer." },
      { qui: "intermittent", texte: "Tu as quatre choix au-dessus du document : les 12 derniers mois, les 3 derniers mois, une année civile, ou une saison de septembre à août. Je ne te propose que les années et les saisons où tu as vraiment travaillé, pour ne pas te faire cliquer sur du vide. Le PDF porte la période choisie, écrite noir sur blanc." },
    ],
  },
  {
    date: "14 août 2026",
    titre: "Je vérifie tes versements France Travail",
    items: [
      { qui: "intermittent", texte: "Nouvelle entrée dans ton menu : « Mes versements ». Scanne ton relevé de situation France Travail, et je compare ce qu'ils t'ont payé à mon propre calcul. Si le compte est bon, je te le dis. S'il manque quelque chose, je te dis combien, pourquoi, et quoi vérifier : un contrat pas saisi, une AEM qui n'est pas arrivée, un taux différent." },
      { qui: "intermittent", texte: "Comme pour les AEM, rien ne s'enregistre sans toi : je te montre ce que j'ai lu, tu corriges si besoin, tu confirmes. Et seul le versement de France Travail fait foi : je compare et j'explique, je ne conteste rien à ta place." },
      { qui: "intermittent", texte: "Au passage, si tu déposes un relevé ou une notification de droits dans « Mes AEM », je ne réponds plus « je ne sais pas lire ce document » : je reconnais ce que c'est et je te dis où ça va." },
      { qui: "intermittent", texte: "Et le scan d'attestations a été durci cette semaine, sur de vrais documents : les contrats d'une journée gardent leur date de fin, les AEM à la police abîmée se lisent quand même, et un document envoyé en plusieurs photos est lu comme un seul document, l'employeur n'est plus perdu en route." },
      { qui: "intermittent", texte: "Et j'ai fait relire tout mon travail de lecture de documents par d'autres yeux que les miens. Six vrais défauts en sont sortis, tous corrigés, et je préfère te le dire que de faire comme s'il n'y en avait jamais eu. Trois concernaient le scan depuis un iPhone : le format de photo de l'appareil était refusé, une photo prise en portrait m'arrivait couchée et je lisais de travers, et quand tu choisissais plusieurs photos d'un coup, ton téléphone me les envoyait toutes sous le même nom, si bien que je relisais trois fois la dernière page." },
      { qui: "intermittent", texte: "Un quatrième me tenait à coeur : quand aucune de tes photos n'était lisible séparément, je relisais le document entier, je le lisais très bien, et je jetais quand même le résultat pour te dire « je n'ai pas réussi à lire ». C'est réparé." },
      { qui: "ae", texte: "Un défaut que je te dois, même si personne ne l'a subi : quand on scannait une facture au format PDF, je pouvais lire 250 € au lieu de 1 250 €. Ma façon de reconnaître un montant ne savait pas gérer les nombres écrits sans séparateur de milliers, c'est-à-dire le cas le plus courant. J'ai vérifié : aucune facture n'avait encore été scannée, donc aucun chiffre d'affaires n'a été faussé. C'est corrigé avant que ça n'arrive à quelqu'un." },
      { qui: "intermittent", texte: "Enfin, un document photographié en plusieurs pages ne compte plus que pour un seul scan de ton quota, comme je te l'avais promis. Il en comptait un par photo." },
    ],
  },
  {
    date: "6 août 2026",
    titre: "Des missions à aller chercher, et ton compte sous double serrure",
    items: [
      { qui: "intermittent", texte: "Je me suis surpris à raconter n'importe quoi, et je le corrige. Quand tu arrivais sans encore m'avoir donné tes contrats, je t'annonçais « tu es à 0 h, plus que 507 h, environ 43 cachets ». C'était faux : je ne savais rien de toi, tu avais peut-être déjà 400 heures de faites. Je ne déduis plus rien d'un dossier vide. Tant que tu ne m'as rien donné, je te dis ce que je fais et je te demande tes contrats, sans inventer un chiffre." },
      { qui: "intermittent", texte: "Une de vous m'a envoyé son relevé France Travail en me disant que mon chiffre ne collait pas au sien, à un euro près. Elle avait raison, et j'avais tort sur un point : le plancher en dessous duquel la CSG n'a pas le droit de faire descendre ton allocation n'est pas un chiffre fixe, il suit le SMIC. Il valait 61 € jusqu'au 31 mai, et 62 € depuis que le SMIC a augmenté le 1er juin. Je le connais maintenant mois par mois, donc quand je regarde un mois passé j'utilise la bonne valeur. Merci à elle." },
      { qui: "intermittent", texte: "« Que se passe-t-il si » ne parle plus que d'heures. Une testeuse m'a dit qu'elle ne voyait pas l'intérêt de cet écran, parce que la réponse serait toujours « oui prends le cachet ». Elle avait raison tant que je ne parlais pas d'argent. Maintenant, quand tu me demandes ce que change un contrat, je te dis aussi ce que ça ferait à ton allocation, en me servant de ton tarif habituel. Et si je ne connais pas encore ton tarif, je te le demande au lieu de me taire." },
      { qui: "intermittent", texte: "Je ne me tais plus non plus sur ta date anniversaire. Je ne la demandais qu'une fois, à l'inscription, et si tu passais outre je ne la réclamais plus jamais. Maintenant elle apparaît dans ton briefing tant que je ne l'ai pas, et sa carte remonte en haut de ton cockpit au lieu d'être tout en bas. Je l'appelle aussi comme France Travail l'appelle, pour que tu la reconnaisses sur leurs courriers." },
      { qui: "tous", texte: "La double vérification (2FA) arrive dans tes Réglages : un code à 6 chiffres en plus de ton mot de passe, généré par ton téléphone. Même si quelqu'un vole ton mot de passe, il n'entre pas. Avec 8 codes de secours si tu perds ton téléphone. (Comptes Google et Apple : votre fournisseur la gère déjà, rien à faire.)" },
      { qui: "tous", texte: "Toutes tes données vivent maintenant en Europe : la base de données a déménagé à Amsterdam, et tes documents étaient déjà stockés en Europe de l'Ouest. C'était important pour moi de te le dire." },
      { qui: "ae", texte: "Nouvelle entrée dans ton menu : « Trouver des missions ». Les mairies, les musées, les hôpitaux, les offices de tourisme et les régions font appel à des indépendants comme toi, et ils sont obligés de publier quand ils cherchent quelqu'un. Le problème, c'est que ces annonces sont écrites pour des acheteurs professionnels, dans un langage auquel personne ne comprend rien. Je vais les chercher et je te les traduis." },
      { qui: "ae", texte: "Tu filtres par métier (photo et vidéo, graphisme, communication, formation, web, événementiel) et par département. Pour chaque consultation ouverte, je te donne qui cherche, quoi, et jusqu'à quand tu peux répondre, avec le lien vers l'annonce officielle." },
      { qui: "ae", texte: "Et je te montre aussi une carte au trésor : les commandes déjà signées près de chez toi, avec leur montant. Ce ne sont pas des offres, ce sont des indices. Depuis avril 2026, sous 60 000 €, un acheteur public choisit son prestataire directement sans publier d'annonce : ces missions là ne s'affichent nulle part, elles se décrochent en allant se présenter. Encore faut-il savoir à qui." },
      { qui: "ae", texte: "Un mot d'honnêteté : il paraît quelques annonces par mois et par métier, pas des dizaines par jour. C'est une veille, pas une place de marché. Repasse de temps en temps plutôt que de guetter, et ne compte pas dessus pour remplir ton mois." },
      { qui: "ae", texte: "Tout vient de sources publiques de l'État (le BOAMP et les données essentielles de la commande publique). Je ne transmets rien de toi à personne pour aller les chercher." },
      { qui: "ae", texte: "Autre chose, et celle-là je te la dois : vous êtes nombreux à vous inquiéter de la facture électronique et de l'échéance du 1er septembre 2026. Deux obligations différentes partent de cette même date, d'où la panique. Le 1er septembre 2026, il faut seulement être capable de RECEVOIR une facture électronique. Émettre les tiennes, ce sera le 1er septembre 2027, et pas avant." },
      { qui: "ae", texte: "Pour pouvoir recevoir, tu as une seule démarche à faire avant septembre : choisir une plateforme agréée par l'État, dans la liste officielle publiée sur impots.gouv.fr. Ce n'est pas automatique, et je préfère te le dire clairement plutôt que de te laisser croire qu'il n'y a rien à faire." },
      { qui: "ae", texte: "Deux choses que beaucoup ignorent, et je préfère être franc. Être en franchise de TVA ne te dispense de rien, la réforme s'applique aussi aux micro-entreprises. Et TOTOR n'est pas lui-même une plateforme agréée, ce n'est pas mon métier : le mien, c'est de te faire tes factures. Pour l'échéance de 2027, tu continueras à les faire ici exactement comme aujourd'hui, et je m'occuperai de les envoyer au bon format en passant par une plateforme agréée." },
    ],
  },
  {
    date: "4 août 2026",
    titre: "Vérifié au centime sur un vrai versement",
    items: [
      { qui: "intermittent", texte: "Le juge que j'attendais est passé : un premier décompte réel de France Travail sur un mois travaillé. Mon estimation du mois tombait au centime près, jours déduits compris. J'avais promis de me caler sur les premiers relevés : c'est fait, et je n'ai rien eu à corriger." },
      { qui: "intermittent", texte: "Ma règle ne bouge pas pour autant : ce que j'affiche reste une estimation, et seul le versement de France Travail fait foi. Mais tu sais maintenant que je compte comme eux." },
      { qui: "intermittent", texte: "La carte « Ton mois » se sert maintenant de ton taux officiel : si tu as importé ton attestation France Travail, je ne te redemande plus ton salaire de référence, je calcule directement avec le taux qu'ils te paient. Merci à celle qui m'a fait remarquer que je réclamais des chiffres qu'on m'avait déjà donnés." },
      { qui: "intermittent", texte: "Le simulateur « Et si j'ajoute des cachets » accepte le total en euros : tes cachets n'ont pas tous le même prix, alors donne-moi juste le nombre et le total, je me débrouille. Et il te dit aussi ce que ces cachets ajouteraient à tes Congés Spectacles." },
      { qui: "intermittent", texte: "« Simuler une allocation » parle enfin cachets : tu peux saisir en cachets ou en heures, comme tu penses. 1 cachet = 12 heures, comme partout." },
      { qui: "intermittent", texte: "Et quand tu me demandes un calcul dans le chat, je te donne maintenant le chemin exact vers le bon écran, au lieu de te renvoyer vaguement vers le cockpit. Désolé pour les détours." },
      { qui: "intermittent", texte: "☀️ Ton briefing du jour est arrivé sur ton cockpit : actualisation ouverte, AEM manquantes, contrats de la semaine... je te dis chaque jour ce qu'il y a à faire. Et quand tout va bien, je te le dis aussi." },
      { qui: "ae", texte: "☀️ Ton briefing du jour est arrivé sur ton cockpit : déclaration URSSAF à préparer, factures en retard... je te dis chaque jour ce qu'il y a à faire. Et quand tout va bien, je te le dis aussi." },
    ],
  },
  {
    date: "28 juillet 2026",
    titre: "Ton compte Google, et me voilà sur Android",
    items: [
      { qui: "tous", texte: "Tu peux maintenant te connecter avec ton compte Google depuis l'application, en un appui, sur Android comme sur iPhone. Plus de mot de passe à retenir." },
      { qui: "tous", texte: "Et si tu t'étais inscrit avec Google sur le site, tu entres désormais directement dans l'application. Avant, il fallait passer par « Mot de passe oublié » pour s'en fabriquer un : ce détour n'existe plus. Il n'aurait jamais dû exister, désolé pour ceux qui l'ont subi." },
      { qui: "tous", texte: "Je suis aussi sur le Play Store depuis le 27 juillet. Si tu es sur Android, tu peux m'installer comme une vraie application, au lieu de passer par ton navigateur." },
    ],
  },
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

  // Le haut réserve la barre d'état de l'iPhone : sans ça, le bouton Retour passe
  // DESSOUS et on ne peut plus sortir de la page autrement qu'en relançant l'app
  // (constaté par le Mac le 27/07/2026).
  return (
    <div style={{ minHeight: "100vh", background: "#07192E", padding: "calc(32px + env(safe-area-inset-top, 0px)) 20px 32px" }}>
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
