# Polycool Bot

Bot Telegram conversationnel pour explorer les marchés de prédiction Polymarket.

## Ce que fait le bot

- découvre les marchés tendance
- affiche les détails d'un marché
- montre les meilleurs traders
- envoie les liens Polymarket correspondants
- répond en conversation naturelle, sans commandes (sauf `/start`)


## Setup avant de lancer

Tu as besoin d'**un seul** token Telegram.

### Obtenir le token

1. Ouvre Telegram et cherche `@BotFather`
2. Envoie `/newbot`
3. Choisis un nom et un username
4. BotFather te renvoie un token (style `123456789:AA...`)
5. Crée un fichier `.env` à la racine du projet :
   ```env
   TELEGRAM_BOT_TOKEN=ton_token_ici
   ```

## Installation et lancement

```bash
npm install
npm run dev
```

Le bot démarre en polling mode et attend tes messages.

## Utilisation rapide

1. Ouvre une conversation avec le bot Telegram
2. Envoie `/start` une seule fois
3. Pose une question en langage naturel

Exemples:
```text
what are trending markets
show me crypto markets
tell me more about the first one
who are the best traders
```

## Pour comprendre le code

Lis [PARCOURS_APPRENTISSAGE.md](PARCOURS_APPRENTISSAGE.md) pour une explication détaillée du fonctionnement interne.
