# Martin Snauwaert Immobilier

Landing page en français pour présenter un service d'estimation immobilière à Beaumont et dans les communes voisines.

## Aperçu

Le site comprend :

- une présentation de l'accompagnement proposé ;
- une section dédiée au marché immobilier local ;
- un formulaire de demande d'estimation ;
- une carte de présentation prête à recevoir la photo de l'agent ;
- un formulaire d'estimation visible dès le premier écran ;
- une mise en page adaptée aux écrans d'ordinateur et de mobile.

## Lancer le site

Ce site ne nécessite aucune installation. Ouvrez simplement `index.html` dans un navigateur, ou utilisez l'extension **Live Server** de Visual Studio Code pour un aperçu local.

## Structure

```text
.
├── index.html  # contenu et formulaire
├── index.css   # styles et règles responsive
├── assets/     # identité visuelle Connexion Immo
└── README.md   # documentation du site
```

## Photo de l'agent

La carte de présentation contient actuellement un emplacement réservé. Lorsque la photo sera disponible, ajoutez-la dans `assets/`, puis remplacez le bloc `.agent-photo-placeholder` dans `index.html` par une balise `<img>` utilisant la classe `agent-photo`.

## Formulaire

Le formulaire envoie actuellement les données vers `/api/submit-lead`. Cette route doit être implémentée côté serveur avant une mise en production, afin de traiter les demandes de manière sécurisée.

## Responsive

L'interface s'adapte aux tablettes et aux téléphones : navigation simplifiée, contenu en une colonne, formulaire placé directement sous l'introduction et champs faciles à utiliser au doigt.

## Installation comme application

Le site est configuré comme une Progressive Web App (PWA). Le manifeste, les icônes et le service worker permettent de l'installer et de consulter l'interface déjà chargée sans connexion.

La proposition d'installation apparaît uniquement lorsque le navigateur confirme que l'application est installable. Le choix est mémorisé dans le navigateur après installation ou fermeture de la notification. Pour réinitialiser ce choix pendant le développement :

```js
localStorage.removeItem("martin-immo-install-state");
```

Les fonctionnalités PWA nécessitent un hébergement en HTTPS en production. Elles fonctionnent également sur `localhost` pendant le développement.
