# Polycool Bot

Bot Telegram conversationnel pour explorer les marchés de prédiction Polymarket — sans commandes, juste du langage naturel.

## Ce que fait le bot

- Découvre les marchés tendance classés par volume 24h
- Recherche des marchés par catégorie (crypto, politique, économie…)
- Affiche les probabilités détaillées, la liquidité et le volume 24h d'un marché
- Liste les meilleurs traders Polymarket avec leur taux de victoire et leur PnL
- Envoie des liens directs Polymarket pour chaque résultat
- Comprend les messages vocaux (transcrits via Groq Whisper)

---

## Approche

Le bot repose sur un pipeline simple **intention → récupération → formatage** :

1. **Détection d'intention** (`conversationHandler.ts`) — classification par regex du message de l'utilisateur parmi cinq intentions : `TRENDING_MARKETS`, `CATEGORY_MARKETS`, `MARKET_DETAILS`, `TOP_TRADERS`, `HELP`. Aucun LLM ici, ce qui maintient une latence faible et un coût nul.

2. **Récupération des données** (`polymarket.ts`) — toutes les données de marchés proviennent de la [Gamma API](https://gamma-api.polymarket.com) publique (sans authentification). Les marchés tendance sont classés localement par volume 24h après récupération d'un grand lot. La recherche par catégorie pagine jusqu'à 5 000 marchés pour trouver des correspondances.

3. **Formatage des réponses** — les réponses sont construites en Markdown avec des emojis et des liens Polymarket, envoyées directement via Telegraf.

4. **Support vocal** (`transcription.ts`) — les messages vocaux Telegram sont téléchargés en buffer OGG/Opus et envoyés à l'API Whisper de Groq, puis la transcription est traitée comme du texte normal.

L'état de la conversation (derniers marchés vus, historique) est conservé en mémoire par utilisateur dans une simple `Map`. Pas de base de données, pas d'état externe.

---

## Compromis

**Détection d'intention par regex vs. LLM**
Les regex sont rapides, gratuites et prévisibles, mais elles échouent sur tout ce qui sort des patterns attendus. Un classificateur LLM gérerait bien mieux les formulations ambiguës ou multilingues, au prix d'une latence et d'un coût API supplémentaires.

**Session en mémoire**
Stocker le contexte utilisateur dans une `Map` est simple mais tout est perdu à chaque redémarrage. Si deux instances tournaient en parallèle (ex. pour scaler), les utilisateurs perdraient leur session. Un store Redis ou une base légère réglerait ce problème.

**Pas de données order book**
La Gamma API n'expose pas la profondeur du carnet d'ordres de manière fiable. Le champ `orderBook` dans `MarketDetail` est toujours `undefined` pour l'instant — l'interface est prête mais les données manquent.

**Polling vs. webhooks**
Le bot tourne en mode polling, ce qui convient au développement et au faible trafic, mais gaspille des ressources et ajoute de la latence par rapport aux webhooks. Passer aux webhooks nécessite un endpoint HTTPS public. ( J'ai deja utilise tout mon abonnement free Railway sur projets perso).

**Détection d'intention principalement en anglais**
Les patterns regex sont majoritairement en anglais. Quelques ordinaux français (`dernier`, `première`) sont gérés, mais les messages en langue mixte restent fragiles.

---

## Ce que j'améliorerais avec plus de temps

- **Remplacer les regex par un petit appel LLM** (ex. un prompt structuré Claude/Groq) pour extraire l'intention et les entités de manière fiable, dans n'importe quelle langue et surtout lorsque le prompt est incompris car aucun mot-cles ne match.
- **Passer aux webhooks** pour réduire la latence et la charge CPU en production.
- **Ajouter une watchlist de marchés** — permettre aux utilisateurs de sauvegarder des marchés et recevoir une notification quand la probabilité bouge de plus de X%.
- **Implémenter l'affichage du carnet d'ordres** dès qu'une source de données fiable est identifiée (l'API CLOB de Polymarket nécessite une authentification).
- **Ajouter des tests** — le parseur d'intentions et les formateurs de réponses sont des fonctions pures, très faciles à tester unitairement.
- **Limiter le débit par utilisateur** pour éviter qu'un seul utilisateur ne surcharge l'API Polymarket.

---

## Installation

### Prérequis

Deux tokens sont nécessaires :

| Variable | Où l'obtenir |
|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) sur Telegram → `/newbot` |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys → Create (gratuit) |

### Configurer l'environnement

Crée un fichier `.env` à la racine du projet :

```env
TELEGRAM_BOT_TOKEN=123456789:AA...
GROQ_API_KEY=gsk_...
```

`GROQ_API_KEY` n'est requis que pour la transcription des messages vocaux. Le bot fonctionne sans pour les messages texte.

Un fichier .env.example fait office de template pour la creation du .env

### Installer et lancer

```bash
npm install
npm run dev
```

Le bot démarre en mode polling et attend tes messages.

---

## Utilisation

1. Ouvre une conversation avec ton bot sur Telegram
2. Envoie `/start` une seule fois
3. Pose une question en langage naturel

```
what are trending markets
show me crypto markets
tell me more about the first one
who are the best traders
```

Les messages vocaux fonctionnent de la même façon — parle, le bot transcrit et répond.

---

## Déploiement

Le projet inclut un `Procfile` et un `railway.json` pour un déploiement en un clic sur [Railway](https://railway.app). Définis les deux variables d'environnement dans le dashboard Railway et déploie.