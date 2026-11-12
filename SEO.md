# Préparation SEO — 12 novembre 2026

Le site reste un aperçu de travail `noindex,nofollow`, également protégé par l'en-tête Vercel `X-Robots-Tag` et un `robots.txt` restrictif. L'hébergement en ligne ne signifie pas une validation commerciale ou juridique.

Le build génère des URL canoniques absolues, descriptions et métadonnées de partage pour les huit pages HTML autorisées. Les anciennes pages `Back/estimation.html` et `Back/formulaire.html` pointent vers `/estimation/` comme version canonique. Un sitemap XML valide mais vide est publié : **zéro page annoncée comme indexable**.

`seo.config.json` centralise l'origine canonique et cinq points de contrôle non validés : identité professionnelle, droits marque/photos, confidentialité/conservation, essai réel du parcours mobile et adéquation de l'hébergement commercial. Mettre un booléen à `true` ne suffit pas à publier : le script refuse tout mode autre que `preview`. Une prochaine livraison devra modifier ensemble HTML, en-têtes, robots et sitemap après vérification des éléments réels.

Pas de fausse fiche d'entreprise JSON-LD, note client, résultat d'estimation, adresse d'agence ou promesse de référencement ajouté. Les textes restent relisibles et le formulaire prépare seulement un e-mail.

Source technique : [Google Search Central — URL canoniques](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

Validation : `npm test`, puis `npm run build`. Contrôler les URL générées sous `public-dist`, les anciennes routes et l'absence de fuite de fichiers de travail.
