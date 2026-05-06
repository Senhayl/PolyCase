# Polycool Bot

Bot Telegram conversationnel pour explorer des marchés de prédiction et ouvrir les liens dans l'app Polycool.

## Ce que fait le bot

- découvre les marchés tendance
- affiche les détails d’un marché
- montre des traders intéressants
- envoie des deep links vers l’app Polycool
- répond en conversation naturelle, sans commandes, sauf `/start`

## Utilisation rapide

1. Ouvre une conversation avec le bot Telegram.
2. Envoie `/start` une seule fois.
3. Pose ensuite une question en langage naturel.

Exemples:

```text
what are trending markets
show me crypto markets
tell me more about the first one
who are the best traders
```

## Setup avant de lancer

Avant de faire `npm install` ou `npm run dev`, vérifie ces 3 informations.

### 1. Le token Telegram

Le bot a besoin du token fourni par @BotFather.

Comment le trouver:

1. Ouvre Telegram et cherche `@BotFather`.
2. Envoie `/newbot` si tu n'as pas encore créé le bot.
3. Choisis un nom puis un username disponible.
4. BotFather te renvoie un token du style `123456789:AA...`.
5. Copie ce token tel quel, sans espace ni guillemets.

### 2. Le bot username

Le bot a aussi besoin du username public du bot Telegram.

Comment le trouver:

1. Dans la conversation BotFather, regarde le username que tu as choisi.
2. Il ressemble à `PolycoolApp_bot`.
3. Utilise exactement ce nom dans la configuration.

### 3. L'API Polymarket

Le bot utilise l'API Polymarket publique par défaut.

Comment la trouver:

1. Pour l'usage normal, garde `https://clob.polymarket.com`.
2. Tu n'as pas besoin de chercher une autre URL pour commencer.
3. Ne change cette valeur que si tu sais exactement quel endpoint tu veux utiliser.

## Fichier de configuration

Le plus simple est de créer un fichier `.env` à la racine du projet.

```env
TELEGRAM_BOT_TOKEN=ton_token_botfather
BOT_USERNAME=PolycoolApp_bot
POLYMARKET_API_BASE=https://clob.polymarket.com
RAILWAY_URL=http://localhost:3000
NODE_ENV=development
```

### Ce que chaque variable fait

- `TELEGRAM_BOT_TOKEN` obligatoire: le token donné par @BotFather
- `BOT_USERNAME` obligatoire: le nom public du bot Telegram
- `POLYMARKET_API_BASE` optionnel: l'URL de l'API Polymarket si tu veux la changer
- `RAILWAY_URL` utile en production: sert à construire le webhook
- `NODE_ENV` obligatoire en pratique: `development` en local, `production` sur Railway

### Vérifier avant de lancer

- le fichier `.env` existe bien
- `TELEGRAM_BOT_TOKEN` n'est pas la valeur d'exemple
- le bot Telegram a bien été créé via @BotFather
- tu es dans le dossier racine du projet

## Installation locale

```bash
npm install
npm run dev
```

## Déploiement

Le projet est prévu pour Railway. Une fois les variables d’environnement configurées, Railway peut lancer et redéployer automatiquement le bot.

## Pour comprendre le code en détail

Lis [PARCOURS_APPRENTISSAGE.md](PARCOURS_APPRENTISSAGE.md). C’est le guide à suivre si tu veux vraiment comprendre le fonctionnement interne du bot, fichier par fichier.
