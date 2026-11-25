# Martin Snauwaert — Immobilier

Site de Martin Snauwaert, agent immobilier agréé IPI à Barbençon (Beaumont), membre du réseau Connexion Immo.

**En ligne : <https://immobiliermartin.be>** — ouvert à l'indexation depuis le 25 novembre 2026.

| | |
|---|---|
| Technique | Next.js 16 (Pages Router), React 19, Node.js 22 ou plus récent |
| Rendu | chaque page est du HTML statique, produit au build ; le navigateur ne reçoit ni React ni le runtime de Next.js |
| Code serveur | deux routes seulement : `/api/demande/` (formulaire → e-mail) et `/api/meteo/` (météo des lacs) |
| Hébergement | VPS administré avec CloudPanel : nginx → `next start` sur le port 4422, processus géré par PM2 via `/home/sites.sh` |
| Données | aucun stockage : ni base de données, ni fichier de demandes |

## Démarrer

```bash
npm ci
cp .env.example .env.local   # facultatif en local : sans mot de passe SMTP, le formulaire n'envoie rien
npm run dev                  # prépare les pages puis lance next dev
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Prépare les pages puis lance `next dev`. Après une modification de `content/` ou `data/`, relancer `npm run prepare-site`. |
| `npm test` | Tests automatisés : règles d'indexation, données structurées, formulaire, secteurs, pages générées, météo. Aucun e-mail réel, aucun appel extérieur. |
| `npm run build` | Prépare les pages, lance `next build` à partir de rien, puis contrôle le résultat (voir « Build »). |
| `npm start` | Sert le site construit (`next start`). |
| `npm run sync` | Réécrit les blocs générés (`<!-- gen:… -->`) des pages de `content/` après une modification de `data/`. |
| `npm run editorial` | Résume l'avancement de la validation éditoriale des pages. |
| `npm run indexnow` | Liste les adresses à notifier à IndexNow ; `-- --send` les envoie. |

## Organisation du dépôt

| Dossier ou fichier | Rôle |
|---|---|
| `content/` | Pages écrites à la main, en HTML : accueil, `/estimation/`, `/preparer-ma-vente/`, `/secteurs/`, pages légales |
| `data/` | Source des pages générées : secteurs (`zones.json`), prestations, guides, actualités, repères locaux sourcés, mentions professionnelles, avis, validation éditoriale |
| `scripts/` | Préparation des pages, métadonnées et données structurées (`seo.cjs`), contrôles du build, rapports |
| `pages/`, `components/` | Routes Next.js, document et mise en page |
| `pages/api/`, `lib/` | Réception du formulaire, envoi par e-mail, reCAPTCHA, météo |
| `public/` | Styles, scripts du site, images, polices, manifeste, service worker, `robots.txt` |
| `tests/` | Tests (`node --test`) |
| `seo.config.json` | Domaine canonique, mode `live` ou `preview`, validations de publication, clé IndexNow |
| `server.config.json` | En-têtes de sécurité, cache et redirections, appliqués par Next.js (`next.config.js`) |
| `.env.example` | Modèle des variables d'environnement, sans aucune valeur |

Les pages de prestation, de commune, de village, les guides et les actualités sont générés au build depuis `data/` : aucun de ces fichiers HTML n'est entretenu à la main. Une page générée n'est publiée que si elle apporte assez de contenu propre ; les autres sont mises de côté (détail dans `SEO.md`).

## Variables d'environnement

Elles se placent dans `.env.local`, à la racine du projet (sur un poste comme sur le serveur). Ce fichier n'est jamais dans Git ; `.env.example` en est le modèle. Next.js le lit **au build et au démarrage** : après toute modification, il faut refaire un build.

| Variable | Rôle |
|---|---|
| `SMTP_PASSWORD` | Mot de passe de la boîte `no-reply@immobiliermartin.be`. **Sa présence active l'envoi par le site** ; sans elle, le formulaire prépare seulement un e-mail que le visiteur envoie lui-même. |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v3, actif seulement si les deux clés sont présentes. |
| `RECAPTCHA_MIN_SCORE` | Seuil reCAPTCHA (défaut `0.5`). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS_NAME`, `SMTP_USER`, `MAIL_FROM`, `MAIL_TO` | Facultatives : les valeurs par défaut sont les bonnes. |

## Formulaire et e-mails

Le site n'a qu'un formulaire, sur `/estimation/`. Il poste à `/api/demande/`, qui transmet la demande par e-mail et n'en garde aucune copie.

| | |
|---|---|
| Serveur SMTP | `mail.immobiliermartin.be`, port 465, connexion chiffrée et vérifiée |
| Expéditeur | `no-reply@immobiliermartin.be` (sert uniquement à l'envoi) |
| Destinataire | `info@immobiliermartin.be` |
| Répondre à | l'adresse du visiteur, s'il l'a indiquée |

Protections contre les robots et les abus :

- **champ piège invisible** (`website`) : une demande qui le remplit reçoit une réponse de succès et n'est pas transmise ;
- **limite d'envois** : cinq par dix minutes et par adresse IP (lue dans l'en-tête `X-Real-IP` posé par nginx) ;
- **origine** : la route refuse toute demande qui ne vient pas du site lui-même, qui n'est pas du JSON ou qui dépasse 8 Ko ;
- **validation par le serveur** de chaque champ, et une seule transmission par demande (clé d'idempotence) ;
- **Google reCAPTCHA v3**, dès que ses deux clés sont configurées. Sans elles, aucune page ne charge quoi que ce soit de Google. Seule `/estimation/` autorise Google dans sa politique de sécurité.

Si l'envoi échoue, la page propose d'appeler Martin ou d'ouvrir un e-mail déjà rédigé, sans fausse confirmation.

## SEO

Le site est en mode `live` : `robots.txt` ouvert (seul `/api/` est fermé), sitemap de toutes les pages approuvées, adresses canoniques sur `https://immobiliermartin.be`.

- **Une page n'est indexable que si** elle est complète (contrôle automatique de `scripts/pages/quality.cjs`), approuvée dans `data/editorial.json`, et que le site est en mode `live`. Les pages légales, le plan du site et la page 404 restent `noindex`.
- **Données structurées** : un bloc JSON-LD par page, en graphe — `WebSite`, `WebPage`, `RealEstateAgent`, `BreadcrumbList`, `Service`, `Article`, `FAQPage` selon la page. Seules les valeurs vérifiées de `data/professional.json` sont publiées ; ni note ni avis tant qu'ils ne sont pas relevés et autorisés dans `data/reviews.json`.
- **Garde-fous du build** : titre, H1, description ou adresse en double, lien interne cassé, image sans texte alternatif, script en ligne → le build échoue.
- **Repasser en aperçu** : remettre ensemble `mode: "preview"` dans `seo.config.json` et l'en-tête `X-Robots-Tag: noindex, nofollow` dans `server.config.json`. Le build refuse toute combinaison incohérente.

Détail des familles de pages, des phases de publication, du contrôle qualité et d'IndexNow : `SEO.md`.

## Sécurité

Les en-têtes sont déclarés une seule fois, dans `server.config.json` : politique de sécurité de contenu stricte (`script-src 'self'`, aucun script en ligne), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, permissions du navigateur fermées. `next dev` ne les applique pas (son rechargement à chaud serait bloqué) : ils valent pour le site construit.

Aucun secret n'est dans le dépôt, qui est public. Aucun outil publicitaire ni de mesure d'audience n'est chargé.

## Build

`npm run build` enchaîne trois étapes :

1. `scripts/prepare.cjs` : pages (écrites à la main et générées) avec leurs métadonnées, sitemap, `robots.txt`, réglages du formulaire ;
2. `next build` : chaque page rendue en HTML statique ;
3. contrôles sur le résultat : fichiers publics autorisés seulement, pages attendues toutes rendues, aucun runtime Next.js dans les pages, liens internes, balises. Les rapports vont dans `reports/` (hors dépôt).

Le service worker met en cache chaque route sous son propre chemin, ne force pas l'activation d'une nouvelle version et ne stocke jamais les champs du formulaire.

## Mise en production

Résumé — la procédure complète, le serveur, le courrier et les validations sont dans `MISE-EN-LIGNE.md`.

```bash
# sur le poste
npm test && npm run build && git push

# sur le serveur
ssh root@xyplore.com
cd /home/immobiliermartin/htdocs/immobiliermartin.be
sudo -u immobiliermartin git pull --ff-only
sudo -u immobiliermartin npm ci            # seulement si package-lock.json a changé
bash /home/sites.sh build immobiliermartin # build, puis redémarrage seulement si le build a réussi
chown -R immobiliermartin:immobiliermartin .
```

Le processus se gère **uniquement par `/home/sites.sh`** (`build`, `restart`, `logs`, `list`), jamais par les commandes `pm2` directes.

## Secteurs et mentions professionnelles

Deux fichiers sont la source unique : `data/zones.json` (communes, villages ciblés, exclusions, priorité, activation) et `data/professional.json` (mentions de Martin, avec un statut par information). Après une modification : `npm run sync`, puis `npm test`.

Une exclusion vise une localité, jamais un code postal : Couvin et Erquelinnes partagent leur code avec des villages ciblés. Le pied de page n'affiche qu'une information `verified` avec `footer: true`. `node scripts/campaign-links.cjs estimation-2027-01` liste les liens suivis par support et secteur.

## Documentation

| Fichier | Contenu |
|---|---|
| `MISE-EN-LIGNE.md` | Serveur, déploiement, variables, courrier (DNS, SPF), protections du formulaire, validations, Search Console |
| `SEO.md` | Pages générées, contrôle qualité, publication, données structurées, IndexNow, rubriques éditoriales |
| `AGENTS.md` | Consignes pour les assistants de code (version de Next.js) |
