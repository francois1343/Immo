# Martin Snauwaert Immobilier

Site vitrine en français consacré à l’estimation et à l’accompagnement immobilier de proximité dans la Botte du Hainaut et le Sud namurois.

## Fonctionnalités

- formulaire d’estimation accessible dès la page d’accueil ;
- informations adaptées au type de bien sélectionné (maison ou terrain) ;
- présentation de l’expertise locale et de la méthode d’accompagnement ;
- carte de contact personnalisée avec la photo de Martin Snauwaert ;
- parcours conversationnels dédiés à l’estimation et à la prise de contact ;
- pages de mentions légales et de politique de confidentialité ;
- interface responsive pour ordinateur, tablette et téléphone ;
- installation possible en tant que Progressive Web App (PWA).

## Lancer le site localement

Le projet ne nécessite ni compilation ni installation de dépendances. Il est toutefois préférable de le servir avec un serveur HTTP local afin de tester correctement le service worker, la PWA et les chemins de navigation.

Avec l’extension **Live Server** de Visual Studio Code, ouvrez `index.html`, puis choisissez **Open with Live Server**.

## Structure du projet

```text
.
├── index.html                    # page d’accueil et formulaire principal
├── index.css                     # styles principaux et responsive
├── app.js                        # formulaire progressif et installation PWA
├── fonts.css                     # polices locales
├── mentions-legales.html         # informations légales
├── politique-confidentialite.html
├── legal.css                     # styles des pages légales
├── manifest.webmanifest          # configuration PWA
├── service-worker.js             # cache et fonctionnement hors connexion
├── Back/
│   ├── estimation.html           # assistant d’estimation
│   ├── estimation.css
│   ├── estimation.js
│   ├── formulaire.html           # parcours de prise de contact
│   ├── formulaire.css
│   └── formulaire.js
└── assets/                       # logos, photo, icônes et polices
```

## Identité visuelle

La photo de Martin est stockée dans `assets/ms.jpg`. Les logos Connexion Immo, les favicons, les icônes PWA et les polices locales se trouvent également dans `assets/`.

La carte de présentation est limitée à `430px` de hauteur sur ordinateur. Elle redevient automatiquement fluide sur tablette et mobile afin de conserver une lecture confortable.

## Formulaires

Le formulaire principal de `index.html` envoie ses données en `POST` vers `/api/submit-lead`. Cette route doit être créée côté serveur avant la mise en production afin de valider, protéger et transmettre les demandes.

Les parcours présents dans `Back/formulaire.html` et `Back/estimation.html` fonctionnent actuellement côté navigateur : ils simulent la progression et la confirmation, mais n’envoient pas encore les données à un service distant.

## Responsive et accessibilité

La mise en page passe en une colonne sur les écrans étroits. La photo de l’agent, les formulaires, les cartes de contenu et la navigation disposent de règles spécifiques pour la tablette et le mobile.

Les formulaires utilisent des libellés explicites, des champs adaptés au clavier mobile, des attributs d’autocomplétion et des zones cliquables dimensionnées pour un usage tactile.

## Installation comme application

Le manifeste et le service worker permettent d’installer le site comme une PWA et de retrouver les ressources déjà mises en cache hors connexion.

La proposition d’installation apparaît uniquement lorsque le navigateur confirme que l’application est installable. Le choix de l’utilisateur est mémorisé dans le navigateur. Pour le réinitialiser pendant le développement :

```js
localStorage.removeItem("martin-immo-install-state");
```

En production, les fonctionnalités PWA nécessitent un hébergement en HTTPS. Elles fonctionnent également sur `localhost` pendant le développement.

## Avant la mise en production

- implémenter et sécuriser la route `/api/submit-lead` ;
- connecter les deux parcours de `Back/` au système de traitement retenu ;
- compléter les informations encore signalées comme manquantes dans les mentions légales ;
- vérifier les liens, le cache PWA et les formulaires sur l’URL définitive.
