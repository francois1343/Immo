# SEO local — état au 20 novembre 2026

Le site reste un **aperçu non indexable** : `noindex,nofollow` sur chaque page, en-tête Vercel `X-Robots-Tag`, `robots.txt` fermé, sitemap vide. Rien n'est soumis aux moteurs.

## Pages générées

`npm run build` rend les pages locales avec Next.js à partir de `data/` ; aucun fichier HTML n'est entretenu à la main.

| Source | Rôle |
|---|---|
| `data/zones.json` | Communes, villages ciblés, exclusions (géographie validée) |
| `data/services.json` | Prestations : page principale et déclinaisons locales |
| `data/guides.json` | Guides vendeurs, avec leurs sources officielles |
| `data/local.json` | Repères locaux, chacun avec l'adresse de sa source |
| `data/editorial.json` | Validation éditoriale : familles ou pages approuvées, pages retenues |
| `data/reviews.json` | Lien vers les avis ; note et citations seulement si relevées et autorisées |

Familles de routes : `/{prestation}/`, `/secteurs/{commune}/`, `/secteurs/{commune}/{village}/`, `/{prestation}/{commune}/`, `/{prestation}/{commune}/{village}/` (estimation et vente de maison), `/guides/{guide}/`, plus `/plan-du-site/` et `404.html`.

Un village qui porte le nom de sa commune n'a pas de page propre. Un centre exclu (Couvin, Erquelinnes) n'a ni page ni mention « à … ». Aucune page n'attribue à Martin un bureau ailleurs qu'à Barbençon.

## Ce qui est publié, ce qui est mis de côté

Sur 363 déclinaisons possibles, le build en écrit 156. Les autres ne sont pas publiées, et aucune page n'y renvoie :

- **consolidées** dans leur page mère, parce qu'elles n'auraient fait que la répéter : « Agent immobilier » et « Vendre un terrain » par commune (la page de la commune en tient lieu), « Vendre une maison » par village (la page du village en tient lieu) ;
- **brouillons** : « Estimation » pour un village sans repères propres suffisants, « Vendre un appartement » dans une commune sans prix d'appartement publié par Statbel.

Le réglage est dans `data/services.json` (`communePages`, `localityPages`). Un village enrichi dans `data/local.json` retrouve sa page d'estimation au build suivant.

## Publication par phases

Chaque page complète porte une phase : 1 = prestations, guides, communes ; 2 = prestations par commune ; 3 = villages. L'approbation se donne **page par page** dans `approvedRoutes` de `data/editorial.json`, après relecture. `npm run editorial` résume l'avancement ; `npm run editorial -- --phase 1` liste les pages de la phase encore à approuver. Une page non approuvée reste `noindex` et hors du sitemap, même après le lancement.

## Contrôle qualité

`scripts/pages/quality.cjs` classe chaque page :

- `complete` : texte suffisant, assez de repères locaux sourcés qui lui sont propres, pas de quasi-copie d'une page de la même famille (similarité mesurée sur des suites de quatre mots) ;
- `to-review` : tout le reste. Une page à revoir n'est jamais proposée aux moteurs.

Une page n'est indexable que si elle est `complete`, **approuvée** dans `data/editorial.json`, et que le site est en mode `live`. Titre, H1, description ou adresse en double, lien interne cassé, image sans texte alternatif : le build échoue.

Rapports écrits dans `reports/` (hors dépôt, hors export) : `pages.csv` et `pages.json` (une ligne par page : statut, score, mots, repères, similarité, liens entrants, points à traiter), `summary.json`, `indexnow-urls.txt`.

## Passage en mode live

Un seul changement relu, dans le même commit :

1. `seo.config.json` : `origin` définitive, `mode: "live"`, chaque entrée de `publicationChecks` à `true` ;
2. `vercel.json` : retrait de l'en-tête `X-Robots-Tag` ;
3. `data/editorial.json` : familles ou pages approuvées, avec relecteur et date.

Le build refuse le mode `live` tant qu'une validation manque ou que l'en-tête est présent. Il écrit alors le sitemap (pages indexables seulement), un `robots.txt` ouvert et retire le bandeau d'aperçu.

## Données structurées

`RealEstateAgent` (accueil et page « Agent immobilier ») avec les seules valeurs `verified` de `data/professional.json`, et `BreadcrumbList` sur les pages générées. Ni note, ni avis, ni horaires. Pas de `FAQPage` : Google n'affiche plus ce résultat enrichi.

## IndexNow et Search Console

`npm run indexnow` liste ce qui serait envoyé et n'envoie rien. `-- --send` n'envoie que si le site est en mode live, sur un domaine qui n'est pas `*.vercel.app`, avec une clé configurée dont le fichier répond en ligne. IndexNow sert Bing et les moteurs participants. Google passe par Search Console, le sitemap et l'exploration normale ; l'API Indexing de Google ne concerne pas ces pages.

## Mise à jour des données locales

Population et prix : Statbel (annuel). Avant chaque mise à jour, vérifier aussi le statut de l'obligation amiante en Wallonie et les textes cités dans les guides.

Validation : `npm test`, puis `npm run build`.
