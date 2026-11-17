# Lot 1A — formulaire d'estimation (version locale)

17 novembre 2026. Branche locale `feat/estimation-lot1a`. Rien n'est poussé ni déployé.

## Ce que fait la page

- Deux étapes : le bien (commune, type, calendrier), puis les coordonnées (prénom, téléphone, e-mail
  facultatif, préférence de rappel facultative, précision facultative).
- La préférence de rappel est présentée comme une indication, jamais comme un rendez-vous.
- Les réponses restent dans la page : ni stockage du navigateur, ni cookie, ni cache.
- **Aucune réception n'est branchée.** `inquiry-config.js` contient une adresse vide : la page n'envoie rien
  et prépare, comme avant, un message que le visiteur envoie depuis sa messagerie.
- Le jour où une adresse de réception est renseignée, la même page envoie la demande, affiche la confirmation
  seulement après enregistrement, et propose l'appel et l'e-mail préparé en cas d'échec.

## Fichiers

| Fichier | Rôle |
|---|---|
| `estimation/index.html`, `estimation.css`, `estimation.js` | Page, styles, comportement |
| `inquiry-core.js` | Règles de validation, partagées par la page et par le futur serveur |
| `inquiry-config.js` | Adresse de réception et clé anti-robot, vides |
| `server/inquiry-handler.mjs` | Réception de référence, indépendante de l'hébergeur ; non déployée, hors build |
| `scripts/dev-server.mjs` | Démonstration locale sur 127.0.0.1, réception simulée en mémoire |
| `tests/inquiry.test.mjs` | 15 tests |

Dépendance ajoutée : `libphonenumber-js` 1.13.16, copiée dans `vendor/` au build et chargée seulement à
l'étape des coordonnées (43 Ko compressés). Le reste du formulaire pèse 8 Ko compressés.

## Essayer en local

```
npm install
npm run build
npm run dev        # mode messagerie : http://127.0.0.1:4173/estimation/
npm run dev:api    # réception simulée en mémoire, données fictives uniquement
```

## Tests du 17 novembre 2026

`npm test` : 20 tests réussis sur 20 (5 existants, 15 nouveaux).

Contrôle dans Chromium, données fictives :

| Contrôle | Résultat |
|---|---|
| Largeurs 360, 390, 768 et 1440 px, plus 320 px | Aucun défilement horizontal ; toutes les cibles font au moins 44 px |
| Mode messagerie | Aucune requête d'envoi ; message préparé ; retour en arrière sans perte ; aucun stockage |
| Erreurs | Message sous chaque champ, annonce du nombre d'erreurs, focus sur le premier champ, saisie conservée |
| Téléphones | Formats belges et français acceptés ; numéros étrangers ou incomplets refusés |
| Clavier seul | Ordre logique, focus visible, groupes de choix aux flèches, Entrée valide l'étape, champ piège hors tabulation |
| Réception simulée | Panne sans perte de saisie, réessai réussi, une seule demande enregistrée, repli e-mail, champ piège sans enregistrement |
| Préremplissage par l'adresse | Commune reprise ; valeurs dangereuses ignorées |
| Texte agrandi à 200 %, animations réduites | Aucun débordement |
| Politique de sécurité de production | Aucune ressource bloquée, aucune erreur JavaScript |

Non testé : lecteur d'écran réel, Safari iOS et Firefox, téléphones physiques, vrai service Turnstile.

## Ce que la réception de référence refuse déjà

Méthode autre que POST, origine différente du site, corps non JSON ou supérieur à 4 Ko, clé anti-doublon
absente, jeton anti-robot absent ou refusé par le serveur, champs invalides, débit excessif par adresse.
Un champ piège rempli reçoit une réponse d'apparence normale et rien n'est conservé. La réponse ne renvoie
jamais de donnée personnelle.

## Adaptations selon l'hébergeur

Le formulaire lui-même ne change pas. Seuls changent l'enveloppe autour de `server/inquiry-handler.mjs` et
trois adaptateurs : stockage, limite de débit, alerte.

| Point | Vercel | Hostinger, application Node gérée | BeHostings, mutualisé (Passenger) |
|---|---|---|---|
| Enveloppe | Fonction `api/demande.mjs` de dix lignes | Serveur HTTP Node, port fourni par `PORT` | Même serveur, lancé par un fichier `.cjs` qui importe le module |
| Fichiers statiques et en-têtes | `vercel.json` | Servis par le serveur Node, ou `.htaccess` | Idem ; garder `public_html` sous contrôle |
| Stockage des demandes | Blob privé | MySQL inclus, ou stockage S3 externe | Fichiers hors de la racine web, ou MySQL |
| Limite de débit | Règle de pare-feu, complétée en mémoire partagée | Table MySQL | Fichier ou MySQL |
| Adresse du visiteur | En-tête fourni par la plateforme | À confirmer derrière le serveur frontal | À confirmer derrière Apache |
| Secrets | Variables d'environnement | Variables d'environnement du panneau | Variables de l'application Node |
| Déploiement | Envoi sur GitHub | Envoi sur GitHub | Git de DirectAdmin si activé, sinon SFTP |

Dans tous les cas, avant ouverture au public :

1. Renseigner `endpoint` et `turnstileSiteKey` dans `inquiry-config.js`.
2. Autoriser `https://challenges.cloudflare.com` dans `script-src` et `frame-src` de la politique de sécurité.
3. Brancher la vérification du jeton côté serveur (appel `siteverify` de Cloudflare, clé secrète en variable
   d'environnement).
4. Mettre à jour la politique de confidentialité et le texte d'information sous le bouton.
5. Remplacer les tests qui garantissent aujourd'hui qu'aucune réception n'est branchée.

## Conditions d'ouverture au public (non remplies)

Responsable du traitement, durée de conservation, délai de rappel annoncé, mentions légales, autorisations de
marque, hébergement autorisant l'usage commercial.

## Recette visuelle du 17 novembre 2026

Six corrections : question « Quand souhaitez-vous vendre ? » au-dessus des quatre boutons de calendrier ; un seul
retour en arrière à l'étape 2 (lien « ← Modifier ») ; message général d'erreur placé au-dessus du bouton principal ;
aide du téléphone masquée quand l'erreur s'affiche ; bordures et texte d'exemple assombris (3,75 et 5,2 pour 1) ;
mention « facultatif » insécable. Contrôlé à 320, 360, 390, 768 et 1440 px et au zoom de 200 %.
Limite connue : sous 213 px de largeur utile, l'en-tête commun du site impose un léger défilement horizontal.
