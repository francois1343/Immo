# Mise en ligne — configuration à faire, dans l'ordre

État au 23 novembre 2026. Le site reste un aperçu non indexable tant que les étapes 1 à 5 ne sont pas faites et validées. Aucune valeur secrète ne figure dans ce fichier ni ailleurs dans le dépôt, qui est public.

## Protections du formulaire : ce qui est actif, ce qui ne l'est pas

| Protection | État | Dépend de |
|---|---|---|
| Champ piège invisible (`website`) | **active** dès que le formulaire envoie | rien |
| Limite de 5 envois par 10 minutes et par adresse IP | **active** dès que le formulaire envoie | rien (voir la limite ci-dessous) |
| Envoi accepté seulement depuis le site lui-même (en-tête `Origin`), en JSON, 8 Ko au plus | **active** | rien |
| Validation des champs par le serveur, une seule transmission par demande | **active** | rien |
| Google reCAPTCHA v3 | **inactive** tant que les deux clés ne sont pas dans Vercel | `RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` |

Tant que `SMTP_PASSWORD` est absent de Vercel, le formulaire n'envoie rien du tout : il prépare un e-mail que le visiteur envoie depuis sa propre messagerie. C'est l'état de la production aujourd'hui.

Quand reCAPTCHA est actif, le serveur interroge Google pour chaque demande et refuse si l'un de ces points manque : réponse `success`, action `estimation`, nom de domaine égal à celui du site, jeton de moins de deux minutes et demie, score au moins égal au seuil. Une panne ou une lenteur de Google est un refus, pas un passe-droit. Le motif du refus est écrit dans les journaux du serveur (jamais le jeton, l'adresse IP ni la demande).

Limite connue : le compteur d'envois est tenu en mémoire par chaque instance du serveur. Sur Vercel, plusieurs instances peuvent coexister, donc la limite réelle peut dépasser 5. Pour une limite stricte, ajouter une règle de limitation de débit dans le pare-feu Vercel sur `/api/demande/`.

## 1. Variables d'environnement dans Vercel

Projet `martin-immo` → Settings → Environment Variables. Cocher « Sensitive » pour les secrets. Chaque ajout ou changement demande un **nouveau déploiement** : la page lit ses réglages au moment du build.

| Variable | Obligatoire | Secret | Rôle |
|---|---|---|---|
| `SMTP_PASSWORD` | oui | **oui** | Mot de passe de la boîte d'envoi. Sa présence active l'envoi par le site. |
| `RECAPTCHA_SITE_KEY` | pour reCAPTCHA | non | Clé du site, transmise à la page. |
| `RECAPTCHA_SECRET_KEY` | pour reCAPTCHA | **oui** | Clé secrète, lue par le serveur seulement. |
| `RECAPTCHA_MIN_SCORE` | non | non | Seuil entre 0 et 1. Défaut : `0.5`. |
| `SMTP_HOST` | non | non | Défaut : `mail.immobiliermartin.be`. |
| `SMTP_PORT` | non | non | Défaut : `465`. |
| `SMTP_TLS_NAME` | non | non | Nom vérifié dans le certificat. Défaut : `mail.lwspanel.com`. |
| `SMTP_USER` | non | non | Défaut : `no-reply@immobiliermartin.be`. |
| `MAIL_FROM` | non | non | Expéditeur. Défaut : la valeur de `SMTP_USER`. |
| `MAIL_TO` | non | non | Destinataire des demandes. Défaut : `info@immobiliermartin.be`. |

Les valeurs par défaut sont celles utilisées aujourd'hui : seules les trois premières lignes sont à saisir. Une seule des deux clés reCAPTCHA ne suffit pas : sans les deux, reCAPTCHA reste éteint et la page ne charge rien de Google.

Choisir l'environnement « Production » pour le site public. Pour essayer sur un aperçu de branche, les ajouter aussi à « Preview ».

## 2. Clés reCAPTCHA (compte Google)

1. Ouvrir la console d'administration reCAPTCHA de Google avec le compte Google retenu pour le site.
2. Créer une clé de type **reCAPTCHA v3** (clé « basée sur un score »).
3. Domaines : le domaine définitif, sans `https://` (par exemple `immobiliermartin.be`, qui couvre aussi `www`). Pour un essai sur un aperçu, ajouter aussi `vercel.app`.
4. Copier la clé du site dans `RECAPTCHA_SITE_KEY` et la clé secrète dans `RECAPTCHA_SECRET_KEY` (étape 1), puis redéployer.
5. Contrôle sans rien envoyer : `https://<site>/inquiry-config.js` doit contenir la clé du site, et jamais la clé secrète.
6. Mettre à jour la politique de confidentialité (`content/politique-confidentialite.html`) : le paragraphe « Prévue, pas encore active » devient une protection en place.

## 3. Domaine, DNS et HTTPS

Constat du 23 novembre 2026 : `immobiliermartin.be` et `www` pointent vers `145.223.80.28` et ne répondent pas en HTTPS ; le courrier passe par `mail.immobiliermartin.be` (`213.255.195.52`, LWS).

1. Vercel → projet → Settings → Domains : ajouter le domaine nu et `www`, choisir lequel redirige vers l'autre.
2. Chez le gestionnaire DNS du domaine, saisir **les valeurs que Vercel affiche** pour ce projet (en général un enregistrement `A` pour le domaine nu et un `CNAME` pour `www`).
3. **Ne pas toucher** aux enregistrements `MX`, à l'enregistrement `mail` ni aux enregistrements `TXT` du courrier (SPF, DKIM) : sinon la réception des demandes et la boîte `info@` s'arrêtent.
4. Attendre que Vercel indique le domaine comme valide : le certificat HTTPS est alors émis et renouvelé automatiquement. Vérifier que `http://` redirige vers `https://` et que la variante non retenue redirige vers l'autre.
5. `seo.config.json` : remplacer `origin` par l'adresse définitive. Les adresses canoniques, le sitemap et IndexNow en dépendent.

## 4. Validation intégrée, avec les vraies clés

À faire une seule fois, sur le domaine définitif, **avec l'accord explicite** pour l'unique envoi réel :

1. Une demande réelle depuis un téléphone : confirmation « Demande envoyée », e-mail arrivé dans `info@immobiliermartin.be`, réponse à l'e-mail adressée au visiteur.
2. Console reCAPTCHA de Google : la demande apparaît, avec un score ; ajuster `RECAPTCHA_MIN_SCORE` au besoin.
3. Console du navigateur sur `/estimation/` : aucune erreur de politique de sécurité (Content-Security-Policy) quand reCAPTCHA se charge.
4. Avec un bloqueur de contenu : le message d'échec propose le téléphone et l'e-mail préparé, sans fausse confirmation.
5. Journaux Vercel : aucune erreur SMTP, aucun secret.
6. Changer ensuite le mot de passe SMTP, comme prévu, et mettre à jour `SMTP_PASSWORD`.

## 5. Ouverture à l'indexation (après feu vert)

Décrite dans `SEO.md`, « Passage en mode live » : un seul commit relu (`mode: "live"`, validations de `seo.config.json`, retrait de l'en-tête `X-Robots-Tag` dans `vercel.json`, pages approuvées dans `data/editorial.json`). Ensuite seulement : sitemap dans Google Search Console (procédure distincte), puis IndexNow.

## IndexNow

La clé est dans `seo.config.json` et le build publie `/<clé>.txt`. Rien n'est soumis : `npm run indexnow` liste seulement ce qui partirait, et `-- --send` refuse tant que le site est en aperçu, sur une adresse `*.vercel.app`, ou sans page approuvée. L'automatisation (pages nouvelles ou modifiées, journal, pas de doublon) est à construire après l'ouverture officielle.

## Tester sans envoyer d'e-mail

`.env.local` contient le vrai mot de passe sur le poste : une demande valide postée sur un serveur local part réellement. Pour tout essai local :

- tests automatisés : `npm test` (transport SMTP fictif, réponses de Google simulées, aucun destinataire réel) ;
- serveur local : le construire et le lancer avec `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_PASSWORD=fictif`, ce qui rend tout envoi impossible ;
- parcours dans un navigateur : simuler les réponses de `/api/demande/`.
