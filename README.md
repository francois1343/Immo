# Martin — Immo

Site Next.js 16 (Pages Router, React 19), entièrement rendu en pages statiques au build, aux couleurs de Connexion Immo.

| Dossier | Rôle |
|---|---|
| `pages/`, `components/`, `lib/` | Routes, document, mise en page et balises d'en-tête (Next.js) |
| `content/` | Pages écrites à la main, en HTML |
| `data/` | Données des pages générées, des secteurs et des mentions |
| `public/` | Styles, scripts du site, images, polices, manifeste, service worker, `robots.txt` |
| `scripts/` | Préparation des pages, métadonnées SEO, contrôles du build, rapports |

Les pages sont livrées sans le runtime client de Next.js : le navigateur ne reçoit que le HTML, les feuilles de style et les petits scripts de `public/` (`site.js`, `estimation.js`). La politique de sécurité stricte (`script-src 'self'`) et le poids des pages restent ceux d'avant la migration. Les en-têtes et redirections sont déclarés une seule fois, dans `vercel.json` ; `next.config.js` les reprend hors de Vercel.

`npm run dev` prépare les pages puis lance `next dev` ; après une modification de `content/` ou `data/`, relancer `npm run prepare-site`. En développement, React s'exécute dans le navigateur : le contenu des pages (`<main>`) lui est remis tel quel, parce que les scripts du site y travaillent, et les en-têtes de sécurité ne sont appliqués qu'au site construit.

Pages écrites à la main (dans `content/`) : accueil, `/estimation/`, `/preparer-ma-vente/`, `/secteurs/` et pages légales. Les pages de prestation, de commune, de village et les guides sont générées au build depuis `data/` (voir `SEO.md`). `/vendre-beaumont-barbencon/` redirige vers `/secteurs/beaumont/`.
Les anciens chemins `/Back/estimation.html`, `/Back/formulaire.html` et l’ancre d’estimation restent utilisables.

## Demandes

Le formulaire prépare un message en mémoire. Le visiteur le relit puis ouvre sa propre messagerie vers `martin.s@connexionimmo.be`, ou copie le texte. Il doit envoyer le message lui-même. Aucun service de réception, CRM distant ni confirmation d’envoi n’est simulé. Les données saisies ne sont pas persistées par le site.

## Aperçu et diffusion

`npm run build` prépare les pages et leurs métadonnées, lance `next build` à partir de rien, puis contrôle le résultat : fichiers publics autorisés, pages attendues, absence de script en ligne et de runtime Next.js, liens internes ; les rapports vont dans `reports/`. `npm test` vérifie les anciens points d’entrée, le mode aperçu et le cache par route. `npm start` sert le site construit ; ne pas tester la PWA en `file://`.

Cette version reste un **aperçu non indexable**, avec mention visible. Aucun domaine public définitif n’est renseigné. Le contenu légal (entité responsable, BCE/TVA, traitement et conservation des messages) et l’identité Connexion Immo doivent être validés avant diffusion commerciale. Le domaine canonique, le sitemap et l’indexation seront activés ensemble après validation ; ne pas simplement retirer noindex sans ces vérifications.

Le service worker ne force pas l’activation d’une nouvelle version et met en cache chaque route sous son propre chemin. Il ne stocke pas les champs du formulaire. Les anciennes expériences restent dans Git mais hors de l’export public.

## Secteurs et mentions professionnelles

Deux fichiers sont la source unique : `data/zones.json` (communes, villages ciblés, exclusions, priorité, activation) et `data/professional.json` (mentions de Martin, avec un statut par information). Après une modification : `npm run sync`, puis `npm test`. Les pages contiennent des blocs `<!-- gen:… -->` réécrits par cette commande ; ne pas les modifier à la main. Le build les régénère de toute façon.

Une exclusion vise une localité, jamais un code postal : Couvin et Erquelinnes partagent leur code avec des villages ciblés. Le pied de page n'affiche qu'une information `verified` avec `footer: true` ; le contrôle des données refuse toute autre combinaison. `node scripts/campaign-links.cjs estimation-2027-01` liste les liens suivis par support et secteur, sans rien générer d'autre.
