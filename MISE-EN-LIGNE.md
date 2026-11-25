# Mise en ligne — serveur, déploiement et validations

État au 25 novembre 2026. Le site est servi par un VPS administré avec CloudPanel ; aucun service tiers d'hébergement d'application n'intervient. Aucune valeur secrète ne figure dans ce fichier ni ailleurs dans le dépôt, qui est public.

## Le serveur

| | |
|---|---|
| Accès | `ssh root@xyplore.com` (clé SSH) |
| Dossier du site | `/home/immobiliermartin/htdocs/immobiliermartin.be` (clone Git de ce dépôt) |
| Port de l'application | `4422` (écoute locale ; le pare-feu n'ouvre que 22, 80 et 443) |
| nginx | hôte virtuel créé par CloudPanel : HTTPS, `http://` → `https://`, `www` → domaine nu, puis `proxy_pass` vers `127.0.0.1:4422` avec `X-Forwarded-Host`, `X-Forwarded-Proto` et `X-Forwarded-For` |
| Processus | PM2, **toujours par `/home/sites.sh`**, jamais par les commandes `pm2` directes |
| Déclaration du site | bloc `immobiliermartin` dans `/home/ecosystem.config.js` (`npm start`, `PORT: 4422`) |
| Node.js | 22 ou plus récent (`engines` de `package.json`) |

Les en-têtes de sécurité, le cache et les redirections sont dans `server.config.json` et appliqués par Next.js lui-même : rien n'est à recopier dans nginx.

## Déployer une nouvelle version

Depuis le poste : `npm test`, `npm run build`, puis `git push`. Sur le serveur :

```bash
ssh root@xyplore.com
cd /home/immobiliermartin/htdocs/immobiliermartin.be
sudo -u immobiliermartin git pull --ff-only
sudo -u immobiliermartin npm ci          # seulement si package-lock.json a changé
bash /home/sites.sh build immobiliermartin
chown -R immobiliermartin:immobiliermartin .
bash /home/sites.sh list                 # le site doit répondre 200 sur :4422
```

`sites.sh build` lance `npm run build` en priorité basse et ne redémarre le site **que si le build a réussi** : un build en échec laisse la version en ligne intacte. Le build refait les contrôles du dépôt (pages attendues, liens internes, balises, fichiers publics) et s'arrête à la première anomalie.

Autres commandes utiles : `bash /home/sites.sh logs immobiliermartin`, `restart immobiliermartin`, `stop immobiliermartin`. Première installation : cloner le dépôt dans le dossier, créer `.env.local`, `npm ci`, `npm run build`, ajouter le bloc dans `/home/ecosystem.config.js`, puis `bash /home/sites.sh start immobiliermartin`.

## Variables d'environnement

Elles sont dans un seul fichier, **`.env.local` à la racine du dossier du site sur le serveur** (jamais dans Git : `.env*` est ignoré ; droits `600`, propriétaire `immobiliermartin`). Next.js le lit au build et au démarrage. Chaque changement demande un **nouveau build** (`sites.sh build`) : la page lit ses réglages au moment du build.

| Variable | Obligatoire | Secret | Rôle |
|---|---|---|---|
| `SMTP_PASSWORD` | oui | **oui** | Mot de passe de la boîte `no-reply@immobiliermartin.be`. Sa présence active l'envoi par le site. |
| `RECAPTCHA_SITE_KEY` | pour reCAPTCHA | non | Clé du site, transmise à la page. |
| `RECAPTCHA_SECRET_KEY` | pour reCAPTCHA | **oui** | Clé secrète, lue par le serveur seulement. |
| `RECAPTCHA_MIN_SCORE` | non | non | Seuil entre 0 et 1. Défaut : `0.5`. |
| `SMTP_HOST` | non | non | Défaut : `mail.immobiliermartin.be`. |
| `SMTP_PORT` | non | non | Défaut : `465`. |
| `SMTP_TLS_NAME` | non | non | Nom vérifié dans le certificat. Défaut : `mail.lwspanel.com`. |
| `SMTP_USER` | non | non | Défaut : `no-reply@immobiliermartin.be`. |
| `MAIL_FROM` | non | non | Expéditeur. Défaut : la valeur de `SMTP_USER`. |
| `MAIL_TO` | non | non | Destinataire des demandes. Défaut : `info@immobiliermartin.be`. |

Les valeurs par défaut sont les bonnes : seules les trois premières lignes sont à saisir. Tant que `SMTP_PASSWORD` est absent, le formulaire n'envoie rien : il prépare un e-mail que le visiteur envoie depuis sa propre messagerie.

## Courrier

Le site envoie par le serveur SMTP de la boîte (LWS), authentifié : `mail.immobiliermartin.be`, port 465, TLS vérifié contre `mail.lwspanel.com`. Expéditeur `no-reply@immobiliermartin.be`, destinataire `info@immobiliermartin.be`, « Répondre à » = l'adresse du visiteur.

Constat DNS du 25 novembre 2026 : `MX` → `mail.immobiliermartin.be` (`213.255.195.52`, LWS) ; SPF `v=spf1 mx:immobiliermartin.be a:mail.immobiliermartin.be a:mailphp.lws-hosting.com -all` ; DMARC `p=quarantine`. Comme l'envoi passe par le serveur LWS, il est couvert par ce SPF : **ne jamais envoyer directement depuis le VPS** (son adresse n'est pas autorisée et le message serait rejeté). Ne pas toucher aux enregistrements `MX`, `mail` ni `TXT` du courrier.

Vérifier la connexion sans rien envoyer, depuis le dossier du site sur le serveur :

```bash
node --env-file=.env.local -e 'import("./lib/inquiry-mail.mjs").then(async (m) => { const s = m.mailSettings(); await require("nodemailer").createTransport(m.transportOptions(s)).verify(); console.log("SMTP OK :", s.user, "→", s.to); })'
```

## Protections du formulaire

| Protection | État | Dépend de |
|---|---|---|
| Champ piège invisible (`website`) | **active** dès que le formulaire envoie | rien |
| Limite de 5 envois par 10 minutes et par adresse IP | **active** dès que le formulaire envoie | l'en-tête `X-Real-IP` posé par nginx |
| Envoi accepté seulement depuis le site lui-même (en-tête `Origin`), en JSON, 8 Ko au plus | **active** | les en-têtes `X-Forwarded-Host` et `X-Forwarded-Proto` posés par nginx |
| Validation des champs par le serveur, une seule transmission par demande | **active** | rien |
| Google reCAPTCHA v3 | **inactive** tant que les deux clés ne sont pas dans `.env.local` | `RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` |

Le site tourne en une seule instance : le compteur d'envois, tenu en mémoire, est donc exact (il repart de zéro à chaque redémarrage).

Quand reCAPTCHA est actif, le serveur interroge Google pour chaque demande et refuse si l'un de ces points manque : réponse `success`, action `estimation`, nom de domaine égal à celui du site, jeton de moins de deux minutes et demie, score au moins égal au seuil. Une panne ou une lenteur de Google est un refus, pas un passe-droit. Le motif du refus est écrit dans les journaux (`sites.sh logs immobiliermartin`), jamais le jeton, l'adresse IP ni la demande.

### Clés reCAPTCHA (compte Google)

1. Ouvrir la console d'administration reCAPTCHA de Google avec le compte Google retenu pour le site.
2. Créer une clé de type **reCAPTCHA v3** (clé « basée sur un score »).
3. Domaine : `immobiliermartin.be`.
4. Copier la clé du site dans `RECAPTCHA_SITE_KEY` et la clé secrète dans `RECAPTCHA_SECRET_KEY` (`.env.local`), puis `sites.sh build`.
5. Contrôle sans rien envoyer : `https://immobiliermartin.be/inquiry-config.js` doit contenir la clé du site, et jamais la clé secrète.
6. Mettre à jour la politique de confidentialité (`content/politique-confidentialite.html`) : le paragraphe « Prévue, pas encore active » devient une protection en place.

## Validation intégrée, sur le domaine définitif

1. Une demande réelle depuis un téléphone : confirmation « Demande envoyée », e-mail arrivé dans `info@immobiliermartin.be`, expéditeur `no-reply@immobiliermartin.be`, réponse à l'e-mail adressée au visiteur.
2. Console reCAPTCHA de Google : la demande apparaît, avec un score ; ajuster `RECAPTCHA_MIN_SCORE` au besoin.
3. Console du navigateur sur `/estimation/` : aucune erreur de politique de sécurité (Content-Security-Policy) quand reCAPTCHA se charge.
4. Avec un bloqueur de contenu : le message d'échec propose le téléphone et l'e-mail préparé, sans fausse confirmation.
5. `bash /home/sites.sh logs immobiliermartin` : aucune erreur SMTP, aucun secret.

## Ouverture à l'indexation (après feu vert)

Décrite dans `SEO.md`, « Passage en mode live » : un seul commit relu (`mode: "live"`, validations de `seo.config.json`, retrait de l'en-tête `X-Robots-Tag` dans `server.config.json`, pages approuvées dans `data/editorial.json`), puis un déploiement. Ensuite :

1. Google Search Console : ajouter la propriété `immobiliermartin.be` (validation par enregistrement DNS `TXT` chez LWS), soumettre `https://immobiliermartin.be/sitemap.xml`.
2. Bing Webmaster Tools : importer la propriété depuis Search Console.
3. IndexNow : `npm run indexnow` liste ce qui partirait ; `npm run indexnow -- --send` envoie.
4. Fiche Google Business Profile : renseigner `https://immobiliermartin.be/` comme site web, avec les mêmes nom, adresse et téléphone que le site.

## IndexNow

La clé est dans `seo.config.json` et le build publie `/<clé>.txt`. Rien n'est soumis : `npm run indexnow` liste seulement ce qui partirait, et `-- --send` refuse tant que le site est en aperçu ou sans page approuvée. L'automatisation (pages nouvelles ou modifiées, journal, pas de doublon) est à construire après l'ouverture officielle.

## Tester sans envoyer d'e-mail

Avec un `.env.local` qui contient le vrai mot de passe, une demande valide postée sur un serveur local part réellement. Pour tout essai local :

- tests automatisés : `npm test` (transport SMTP fictif, réponses de Google simulées, aucun destinataire réel) ;
- serveur local : le construire et le lancer avec `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_PASSWORD=fictif`, ce qui rend tout envoi impossible ;
- parcours dans un navigateur : simuler les réponses de `/api/demande/`.
