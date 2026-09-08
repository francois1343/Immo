# Martin Snauwaert Immobilier

Landing page en français pour présenter un service d'estimation immobilière à Beaumont et dans les communes voisines.

## Aperçu

Le site comprend :

- une présentation de l'accompagnement proposé ;
- une section dédiée au marché immobilier local ;
- un formulaire de demande d'estimation ;
- une mise en page adaptée aux écrans d'ordinateur et de mobile.

## Lancer le site

Ce projet ne nécessite aucune installation. Ouvrez simplement `index.html` dans un navigateur, ou utilisez l'extension **Live Server** de Visual Studio Code pour un aperçu local.

## Structure

```text
.
├── index.html  # contenu et formulaire
├── index.css   # styles et règles responsive
└── README.md   # documentation du projet
```

## Formulaire

Le formulaire envoie actuellement les données vers `/api/submit-lead`. Cette route doit être implémentée côté serveur avant une mise en production, afin de traiter les demandes de manière sécurisée.

## Responsive

L'interface s'adapte notamment aux écrans de moins de 768 px : navigation sur plusieurs lignes, contenu en une colonne, champs du formulaire faciles à utiliser au doigt et tailles de texte réduites.
