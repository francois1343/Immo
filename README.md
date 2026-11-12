# Martin — Immo

Pages HTML/CSS/JavaScript sans dépendance front-end, aux couleurs de Connexion Immo.
Lot du 12 novembre 2026 : accueil, `/estimation/`, `/preparer-ma-vente/` et `/vendre-beaumont-barbencon/`.
Les anciens chemins `/Back/estimation.html`, `/Back/formulaire.html` et l’ancre d’estimation restent utilisables.

## Demandes

Le formulaire prépare un message en mémoire. Le visiteur le relit puis ouvre sa propre messagerie vers `martin.s@connexionimmo.be`, ou copie le texte. Il doit envoyer le message lui-même. Aucun service de réception, CRM distant ni confirmation d’envoi n’est simulé. Les données saisies ne sont pas persistées par le site.

## Aperçu et diffusion

`npm run build` exporte uniquement les fichiers autorisés dans `public-dist`. `npm test` vérifie les anciens points d’entrée, le mode aperçu et le cache par route. Servir la sortie avec un serveur HTTP local ; ne pas tester la PWA en `file://`.

Cette version reste un **aperçu non indexable**, avec mention visible. Aucun domaine public définitif n’est renseigné. Le contenu légal (entité responsable, BCE/TVA, traitement et conservation des messages) et l’identité Connexion Immo doivent être validés avant diffusion commerciale. Le domaine canonique, le sitemap et l’indexation seront activés ensemble après validation ; ne pas simplement retirer noindex sans ces vérifications.

Le service worker ne force pas l’activation d’une nouvelle version et met en cache chaque route sous son propre chemin. Il ne stocke pas les champs du formulaire. Les anciennes expériences restent dans Git mais hors de l’export public.
