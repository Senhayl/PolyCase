# Parcours d'apprentissage complet

Ce document sert à comprendre le code Polycool Bot en profondeur.

Le but n'est pas seulement de savoir ce que fait le bot. Le but est de comprendre pourquoi chaque fichier existe, comment les données circulent, comment une phrase de l'utilisateur devient une réponse Telegram, et comment modifier le projet sans le casser.

Si tu veux juste utiliser le bot, lis le [README.md](README.md).
Si tu veux vraiment comprendre le code, lis ce document dans l'ordre.

---

## 1. Comment lire ce parcours

Il y a 3 façons de l'utiliser.

1. Lecture rapide: tu survoles tous les chapitres pour avoir la carte mentale du projet.
2. Lecture sérieuse: tu lis chaque chapitre et tu ouvres les fichiers cités dans ton éditeur.
3. Lecture active: tu modifies un petit morceau de code après chaque chapitre pour vérifier que tu as compris.

Le meilleur apprentissage, ici, c'est de lire un chapitre puis d'ouvrir le fichier correspondant.

---

## 2. Vision globale du projet

Le bot est organisé autour d'une idée simple:

- l'utilisateur écrit un message naturel
- le bot essaie de comprendre l'intention
- si besoin, il récupère des données marchés ou traders
- il formate une réponse lisible
- il renvoie le résultat dans Telegram

Le code principal est volontairement séparé en plusieurs pièces.

- [src/index.ts](src/index.ts) orchestre le bot Telegram
- [src/services/conversationHandler.ts](src/services/conversationHandler.ts) comprend le message et fabrique la réponse
- [src/services/polymarket.ts](src/services/polymarket.ts) récupère ou simule les données de marché
- [src/types.ts](src/types.ts) décrit les formes de données utilisées partout
- [src/utils/deepLinks.ts](src/utils/deepLinks.ts) fabrique les liens vers l'app Polycool
- [src/data/mockTraders.ts](src/data/mockTraders.ts) fournit des traders de secours

Si tu mémorises seulement une phrase, retiens celle-ci:

`index.ts` reçoit le message, `conversationHandler.ts` décide quoi répondre, `polymarket.ts` apporte les données, `deepLinks.ts` rend les éléments cliquables.

---

## 3. Ordre conseillé pour comprendre le code

Lis dans cet ordre.

1. [src/types.ts](src/types.ts)
2. [src/utils/deepLinks.ts](src/utils/deepLinks.ts)
3. [src/data/mockTraders.ts](src/data/mockTraders.ts)
4. [src/services/polymarket.ts](src/services/polymarket.ts)
5. [src/services/conversationHandler.ts](src/services/conversationHandler.ts)
6. [src/index.ts](src/index.ts)

Pourquoi cet ordre?

- les types expliquent les objets manipulés
- les liens expliquent le rendu des messages
- les traders mock expliquent le fallback
- le service Polymarket explique d'où viennent les données
- le handler explique la logique métier
- le fichier d'entrée montre comment tout se connecte

---

## 4. `src/types.ts`: la forme des données

Ce fichier est la base du projet.

Il ne contient pas le comportement du bot. Il contient la description de ce que le bot manipule.

### 4.1. `Market`

`Market` représente un marché simple.

Les champs importants:

- `id`: identifiant du marché
- `question`: texte affiché à l'utilisateur
- `yesPrice`: probabilité du oui, sous forme décimale entre 0 et 1
- `noPrice`: probabilité du non, sous forme décimale entre 0 et 1
- `liquidity`: liquidité estimée
- `volume24h`: volume sur 24 heures
- `category`: catégorie du marché
- `createdAt`: date de création si disponible

Ce qu'il faut comprendre:

- le bot travaille souvent avec des pourcentages, mais le code stocke les probabilités en décimal
- par exemple `0.42` veut dire `42%`
- cette représentation est pratique pour calculer et formater

### 4.2. `MarketDetail`

`MarketDetail` hérite de `Market`.

Il ajoute:

- `topTraders`: traders liés au marché, si on les a
- `orderBook`: carnet d'ordres, avec `bids` et `asks`

Le rôle de `MarketDetail` est de représenter une version plus riche d'un marché, lorsqu'on veut montrer plus que juste le titre et le prix.

### 4.3. `Trader`

`Trader` décrit un trader.

Les champs importants:

- `address`: adresse du wallet
- `winRate`: taux de réussite, décimal entre 0 et 1
- `pnl`: profit ou perte
- `totalTrades`: nombre total de trades si connu
- `volume`: volume total si connu

### 4.4. `ConversationContext`

`ConversationContext` est la mémoire d'un utilisateur.

Il contient:

- `userId`: identifiant Telegram
- `lastMarketId`: dernier marché consulté
- `lastViewedMarkets`: liste des marchés affichés récemment
- `conversationHistory`: historique des messages échangés

Ce type est très important parce qu'il permet au bot de comprendre des phrases comme:

- "tell me more about the first one"
- "what about that market"

Sans contexte, le bot oublierait tout entre deux messages.

### 4.5. `Message`

`Message` représente un message stocké dans l'historique.

Chaque message a:

- `role`: `user` ou `assistant`
- `content`: texte du message
- `timestamp`: heure d'enregistrement

Cette structure est simple, mais elle est utile si tu veux plus tard analyser la conversation ou brancher une vraie mémoire persistante.

### 4.6. `IntentType`

`IntentType` liste les intentions reconnues par le bot.

Les intentions actuelles sont:

- `TRENDING_MARKETS`
- `CATEGORY_MARKETS`
- `SEARCH_MARKETS`
- `MARKET_DETAILS`
- `TOP_TRADERS`
- `TRADER_DETAILS`
- `GREETING`
- `HELP`
- `UNKNOWN`

Important:

- certaines valeurs existent dans l'énumération mais ne sont pas toutes utilisées partout
- le projet peut évoluer vers plus d'intentions sans casser la structure

### 4.7. `ParsedIntent`

`ParsedIntent` est le résultat de l'analyse d'un message.

Il contient:

- `type`: le type d'intention détecté
- `keywords`: mots-clés éventuels
- `reference`: référence comme `first`, `second`, `third`, ou un nombre

Ce type est le pont entre le message brut et la logique du bot.

### 4.8. Ce que tu dois retenir

Le fichier `types.ts` répond à une question simple:

"De quoi le reste du code a-t-il besoin pour parler de marchés, de traders et de conversation?"

---

## 5. `src/utils/deepLinks.ts`: les liens vers l'app Polycool

Ce fichier transforme une donnée interne en lien cliquable.

Il contient la logique pour ouvrir un marché ou un trader dans l'app via Telegram.

### 5.1. `BOT_USERNAME`

Le fichier lit `BOT_USERNAME` depuis l'environnement.

S'il n'existe pas, il utilise `PolycoolApp_bot`.

Pourquoi c'est important?

- le lien final dépend du nom du bot
- si tu changes de bot, tu ne dois pas réécrire toute la logique

### 5.2. `REF_CODE`

`REF_CODE` est un code de référence fixé à `2BWKT3G5`.

Il sert à suivre l'origine des liens.

Ce n'est pas une logique métier centrale. C'est un détail de tracking.

### 5.3. `generateMarketLink(marketId)`

Cette méthode construit un lien Telegram vers un marché.

Le format est:

`https://t.me/<BOT_USERNAME>/PolycoolApp?startapp=market_<marketId>_ref_<REF_CODE>`

Exemple logique:

- marché `90178`
- lien généré: `...startapp=market_90178_ref_2BWKT3G5`

### 5.4. `generateTraderLink(walletAddress)`

Cette méthode fait la même chose pour un trader.

Le format devient:

`...startapp=leader_<walletAddress>_ref_<REF_CODE>`

### 5.5. `formatMarketMessage(...)`

Cette fonction fabrique le texte affiché dans la liste des marchés.

Elle affiche:

- le numéro du marché dans la liste
- la question du marché
- le pourcentage du oui
- un lien `[View Market](...)`

Ce point est important:

- le message est lisible par un humain
- le lien est cliquable dans Telegram

### 5.6. `formatTraderMessage(...)`

Cette fonction formate un trader.

Elle affiche:

- une adresse raccourcie
- le taux de victoire
- le PnL
- un lien cliquable

L'adresse est raccourcie pour ne pas noyer la conversation avec un wallet trop long.

### 5.7. Ce qu'il faut comprendre

`deepLinks.ts` ne décide jamais quoi montrer.

Il ne fait que transformer des données en texte utile et en lien utile.

---

## 6. `src/data/mockTraders.ts`: les données de secours

Ce fichier contient une liste de traders fictifs ou de secours.

Pourquoi il existe?

- parce que l'API peut échouer
- parce qu'on veut garder le bot utile même sans accès complet aux données
- parce qu'on veut tester le rendu sans dépendre d'une source externe

### 6.1. Ce que contiennent les objets

Chaque trader a:

- une adresse
- un winRate
- un pnl
- parfois un `totalTrades`
- parfois un `volume`

### 6.2. Comment ce fichier est utilisé

Le service de conversation l'utilise comme fallback.

Autrement dit:

- si le bot doit afficher des traders mais n'a pas de réponse externe fiable
- il utilise cette liste

### 6.3. Ce qu'il faut retenir

Ce fichier n'est pas une simulation décorative.

Il permet au bot de rester fonctionnel même quand la vraie donnée manque.

---

## 7. `src/services/polymarket.ts`: le service de données

Ce fichier est le client réseau du projet.

Il essaie d'appeler Polymarket, puis convertit la réponse en objets simples utilisables par le reste du code.

### 7.1. Le constructeur

Le constructeur fait deux choses:

1. il lit `POLYMARKET_API_BASE` dans l'environnement
2. il crée un client Axios avec un timeout de 10 secondes

Le timeout évite que le bot reste bloqué trop longtemps si le service externe répond mal.

### 7.2. `getTrendingMarkets(limit = 5)`

Cette méthode essaie de récupérer des marchés tendance.

Le flux réel:

1. appel HTTP sur `/markets`
2. paramètres: `limit`, tri par volume, ordre descendant
3. formatage des données retournées
4. en cas d'erreur, fallback sur des marchés mock

Ce qu'il faut retenir:

- le service ne laisse pas l'erreur remonter directement
- il choisit d'être tolérant aux pannes

### 7.3. `searchMarkets(category, limit = 5)`

Cette méthode essaie de filtrer les marchés par catégorie ou mot-clé.

Elle fonctionne pareil que la méthode précédente, mais elle ajoute le paramètre `category`.

Si la requête échoue, elle appelle `getMockMarketsByCategory(category)`.

### 7.4. `getMarketDetail(marketId)`

Cette méthode charge le détail d'un marché précis.

Si l'API échoue, elle retourne un détail mock construit à partir des marchés de secours.

### 7.5. `formatMarkets(data)`

Cette méthode transforme les données brutes en tableau de `Market`.

Elle fait un travail essentiel:

- convertir les noms de champs possibles
- fournir des valeurs par défaut si les champs manquent
- limiter la liste aux 5 premiers marchés

Pourquoi ce travail est utile?

- parce que les API ne sont pas toujours régulières
- parce que le reste du code veut des données propres

### 7.6. `formatMarketDetail(data)`

Cette méthode fait la même chose, mais pour une seule fiche marché détaillée.

Elle ajoute aussi `orderBook` si les données existent.

### 7.7. `getMockTrendingMarkets()`

Cette méthode retourne une liste fixe de marchés de secours.

Elle sert à garantir que le bot montre toujours quelque chose de cohérent.

### 7.8. `getMockMarketsByCategory(category)`

Cette méthode choisit des marchés mock en fonction du thème.

Exemples:

- si la catégorie ressemble à `crypto`, elle retourne des marchés crypto
- si elle ressemble à `econ`, elle retourne des marchés économie
- sinon, elle retourne la liste générale

### 7.9. `getMockMarketDetail(marketId)`

Cette méthode reconstruit un détail de marché localement.

Si le marché n'existe pas dans les mocks, elle retourne un objet minimal avec:

- `question: "Market not found"`
- probabilités à `0.5`

Sinon, elle ajoute un `orderBook` fictif autour du prix du marché.

### 7.10. Ce qu'il faut comprendre

`polymarket.ts` n'est pas juste un wrapper HTTP.

Il joue aussi le rôle de traducteur et de filet de sécurité.

---

## 8. `src/services/conversationHandler.ts`: le coeur logique du bot

Si tu veux comprendre le bot, c'est le fichier le plus important après `index.ts`.

Il prend un message humain et décide quoi faire.

### 8.1. Le rôle général

Ce fichier a deux grandes responsabilités:

1. détecter l'intention du message
2. fabriquer la réponse finale

### 8.2. `parseIntent(message)`

Cette méthode lit un texte brut et tente d'en extraire une intention.

Elle travaille en plusieurs étapes.

#### Étape 1: normalisation

Le message est transformé en minuscule et nettoyé avec `trim()`.

Pourquoi?

- pour rendre la détection plus robuste
- pour éviter que `WHAT ARE TRENDING MARKETS` soit différent de `what are trending markets`

#### Étape 2: marchés tendance

Le code vérifie d'abord si le message ressemble à une demande de marchés tendance.

Il cherche des mots comme:

- trending
- popular
- hot
- top
- what are
- should

et il exige aussi la présence du mot `market`.

L'idée est simple:

- si la phrase parle de marchés et d'un classement ou d'une découverte
- alors on considère que l'utilisateur veut voir les marchés tendance

#### Étape 3: marchés crypto

Le code cherche ensuite des indices liés à la crypto:

- crypto
- btc
- eth
- bitcoin
- ethereum
- coin
- web3

Il ajoute aussi un contexte verbal comme:

- market
- bet
- trade
- explore
- show
- tell

Si tout cela correspond, il retourne `CATEGORY_MARKETS` avec le mot-clé `crypto`.

#### Étape 4: économie

Une autre branche reconnaît les thèmes économiques:

- economy
- recession
- employment
- inflation
- gdp

Si ça matche, il retourne `CATEGORY_MARKETS` avec `economy`.

#### Étape 5: politique

Le code reconnaît aussi les sujets politiques:

- election
- politics
- congress
- senate
- trump
- biden

Et il renvoie aussi `CATEGORY_MARKETS`, mais avec `politics`.

#### Étape 6: détail d'un marché déjà vu

Le bot comprend les formulations du type:

- tell me more about the first one
- explain that
- more detail on the second

Le test cherche deux choses:

- des mots qui indiquent une demande d'explication
- des références comme `first`, `second`, `third`, `one`, `that`

Ensuite le code choisit une référence.

Par défaut, c'est `first`.

Si le message dit `second`, la référence devient `second`.

Si le message dit `third`, la référence devient `third`.

#### Étape 7: top traders

Le code reconnaît aussi les demandes de meilleurs traders.

Il cherche des mots comme:

- top
- best
- leading
- influence

et des mots comme:

- trader
- whale
- account
- player

Si les deux groupes correspondent, il retourne `TOP_TRADERS`.

#### Étape 8: aide ou salutation

Le bot répond aussi aux messages d'accueil ou d'aide.

Il détecte:

- hello
- hi
- hey
- help
- what can

Et il retourne `HELP`.

#### Étape 9: inconnu

Si rien ne matche, il retourne `UNKNOWN`.

### 8.3. Ce que tu dois comprendre sur `parseIntent`

Cette méthode ne fait pas d'intelligence artificielle complexe.

Elle fait du matching déterministe.

Avantage:

- simple à lire
- simple à déboguer
- simple à modifier

Limite:

- elle comprend moins bien les phrases très créatives

### 8.4. `generateResponse(intent, markets, marketDetail, traders)`

Cette méthode est un routeur de rendu.

Elle regarde l'intention et appelle la bonne fonction interne.

Cas par cas:

- `TRENDING_MARKETS` → `buildTrendingMarketsResponse`
- `CATEGORY_MARKETS` → `buildCategoryMarketsResponse`
- `MARKET_DETAILS` → `buildMarketDetailResponse`
- `TOP_TRADERS` → `buildTopTradersResponse`
- `HELP` → `buildHelpResponse`
- sinon → `buildUnknownResponse`

Cette séparation est très saine:

- une méthode comprend l'intention
- une autre construit le texte

### 8.5. `buildTrendingMarketsResponse(markets)`

Cette méthode prend une liste de marchés et construit un texte Telegram.

Si la liste est vide:

- elle renvoie un message d'erreur sympathique

Sinon:

- elle commence par un titre
- elle parcourt les marchés
- elle appelle `DeepLinkGenerator.formatMarketMessage(...)`
- elle ajoute une phrase finale pour inviter l'utilisateur à demander plus de détails

Ce que tu dois noter:

- le handler ne fait pas lui-même le format détaillé
- il délègue à `DeepLinkGenerator`

### 8.6. `buildCategoryMarketsResponse(markets, category)`

Cette méthode est presque la même, mais elle ajoute une catégorie lisible.

Elle appelle `formatCategoryName(category)` pour produire quelque chose de plus joli que `crypto` ou `economy`.

### 8.7. `buildMarketDetailResponse(market)`

C'est la réponse la plus riche.

Elle affiche:

- le titre du marché
- les probabilités oui/non
- la liquidité si elle existe
- le volume 24h si lui aussi existe
- une liste de 3 traders mock
- un lien vers le marché

Point important:

- les traders affichés ici viennent de `mockTraders`
- ils ne sont pas récupérés depuis une API réelle pour l'instant

### 8.8. `buildTopTradersResponse(traders)`

Cette méthode affiche les meilleurs traders.

Elle montre jusqu'à 5 traders et termine avec un rappel invitant à cliquer sur les profils.

### 8.9. `buildHelpResponse()`

Cette méthode explique au bot lui-même ce qu'il peut faire.

Elle est utile pour les premiers messages ou quand l'utilisateur ne sait pas quoi demander.

### 8.10. `buildUnknownResponse()`

Cette méthode sert de filet de secours conversationnel.

Quand le bot ne comprend pas, il ne bloque pas.

Il répond avec des exemples concrets pour remettre l'utilisateur sur les rails.

### 8.11. `formatCategoryName(category)`

Cette petite méthode transforme un mot interne en étiquette lisible.

Exemples:

- `crypto` → `🪙 Crypto`
- `economy` → `💰 Economy`
- `politics` → `🏛️ Politics`

### 8.12. `getReferenceIndex(reference)`

Cette méthode transforme une référence textuelle en index numérique.

Exemples:

- `first` → `0`
- `second` → `1`
- `third` → `2`
- `number` → le nombre lui-même

Si rien n'est fourni, elle renvoie `0`.

Cette méthode est indispensable pour comprendre comment le bot sait ce que veut dire "the first one".

### 8.13. Ce qu'il faut retenir du handler

`conversationHandler.ts` est le cerveau logique du projet.

Il ne parle pas à Telegram directement.
Il ne parle pas à Polymarket directement.
Il décide quoi dire et comment le dire.

---

## 9. `src/index.ts`: le point d'entrée du bot

Ce fichier est l'endroit où tout se connecte.

Si tu veux suivre le chemin complet d'un message, commence ici.

### 9.1. Les imports

Le fichier importe:

- `Telegraf` et `Context` depuis `telegraf`
- `Message` depuis `telegraf/types`
- `dotenv`
- `PolymarketService`
- `ConversationHandler`
- `IntentType`, `ConversationContext`, `Market`

Chaque import a un rôle clair:

- Telegraf parle à Telegram
- dotenv charge les variables d'environnement
- les services gèrent la logique
- les types sécurisent la structure des données

### 9.2. `dotenv.config()`

Cette ligne charge le fichier `.env`.

Sans elle, les variables comme `TELEGRAM_BOT_TOKEN` ne seraient pas disponibles.

### 9.3. `BotContext`

Le code définit un contexte spécial qui étend `Context`.

Il ajoute une propriété optionnelle `session`.

Dans ce projet, ce champ n'est pas le coeur du stockage, car la vraie mémoire utilisateur est dans `userContexts`.

### 9.4. `polymarketService`

Une instance du service est créée une seule fois.

Pourquoi?

- pour éviter de recréer le client HTTP à chaque message
- pour centraliser les appels API

### 9.5. `userContexts`

Le code utilise un `Map<number, ConversationContext>`.

Cela veut dire:

- chaque utilisateur Telegram a son propre contexte
- la clé est son `userId`

Important:

- cette mémoire est en RAM
- si le bot redémarre, elle est perdue

### 9.6. `bot`

Le bot est créé avec le token Telegram.

Si le token est vide, le bot ne pourra pas fonctionner correctement.

### 9.7. `getContext(userId)`

Cette fonction est un utilitaire central.

Son rôle:

1. chercher le contexte existant du user
2. s'il n'existe pas, en créer un
3. retourner le contexte

Pourquoi elle est importante?

- elle évite de répéter le code de création
- elle garantit qu'on a toujours un objet utilisable

### 9.8. Le handler `/start`

Quand l'utilisateur envoie `/start`, le bot:

1. lit l'identifiant de l'utilisateur
2. récupère son contexte
3. vide l'historique de conversation
4. envoie un message d'accueil

Ce reset est volontaire.

Il permet de repartir sur une base propre.

### 9.9. Le message d'accueil

Le texte explique à l'utilisateur:

- qu'il peut demander des marchés
- qu'il peut demander des traders
- qu'il peut demander des marchés crypto

Le bot reste conversationnel.

Il ne dit pas: "utilise telle commande".
Il dit plutôt: "pose-moi une question naturelle".

### 9.10. Le handler `bot.on("text")`

C'est le coeur du flux.

À chaque message texte:

1. le bot lit `userId`
2. il lit le texte envoyé
3. il récupère le contexte de l'utilisateur
4. il affiche l'action de saisie (`typing`)
5. il essaye de comprendre l'intention
6. il stocke le message utilisateur dans l'historique
7. il récupère les données si nécessaire
8. il génère la réponse
9. il stocke la réponse du bot
10. il répond dans Telegram

### 9.11. Le coeur de la logique conditionnelle

Le code distingue plusieurs cas.

#### Cas 1: marchés tendance ou par catégorie

Si l'intention est `TRENDING_MARKETS` ou `CATEGORY_MARKETS`:

- le bot appelle `polymarketService.getTrendingMarkets(5)` ou `searchMarkets(...)`
- il stocke le résultat dans `context.lastViewedMarkets`
- il demande au handler de construire le message

Pourquoi stocker `lastViewedMarkets`?

- pour pouvoir ensuite dire "le premier" ou "le second"

#### Cas 2: détail d'un marché

Si l'intention est `MARKET_DETAILS`:

- le bot traduit la référence textuelle en index numérique
- il cherche le marché correspondant dans `lastViewedMarkets`
- s'il le trouve, il mémorise `lastMarketId`
- il appelle `getMarketDetail(market.id)`
- il génère une réponse détaillée

Si le marché n'existe pas dans le contexte:

- il dit à l'utilisateur de demander d'abord des marchés tendance

#### Cas 3: autre intention

Pour tout le reste:

- le bot délègue à `ConversationHandler.generateResponse(intent)`

Cela couvre notamment l'aide et les messages inconnus.

### 9.12. L'historique de conversation

Le code ajoute deux entrées:

- le message utilisateur
- la réponse du bot

Cette trace permet plus tard de revoir la conversation.

### 9.13. Le handler `bot.on("message")`

Ce handler attrape les messages qui ne sont pas du texte.

Par exemple:

- photos
- voix
- autres formats

Le bot répond qu'il comprend seulement le texte pour l'instant.

### 9.14. `bot.catch(...)`

Cette fonction récupère les erreurs Telegraf globales.

Elle évite que le bot tombe silencieusement.

### 9.15. `startBot()`

Cette fonction lance le bot.

Elle distingue deux environnements:

- production: webhook
- développement: polling

#### En production

Le bot construit une URL de webhook avec `RAILWAY_URL`.

Puis il appelle `setWebhook(...)`.

#### En développement

Le bot utilise `launch()` en mode polling.

Le polling demande régulièrement s'il y a de nouveaux messages.

### 9.16. Pourquoi cette séparation?

Parce que le mode local et le mode déployé ne se comportent pas pareil.

- en local, polling est simple
- en production, webhook est plus adapté

### 9.17. Fermeture propre

Le code écoute `SIGINT` et `SIGTERM`.

Cela permet d'arrêter le bot proprement quand le processus se ferme.

### 9.18. Ce qu'il faut retenir du fichier d'entrée

`index.ts` ne contient pas toute l'intelligence.

Il contient l'assemblage:

- la connexion à Telegram
- la gestion du contexte
- l'appel aux services
- l'envoi des réponses

---

## 10. Le chemin complet d'un message

Voici le vrai trajet d'un message utilisateur.

### Exemple: "what are trending markets"

1. Telegram envoie le texte au bot
2. `src/index.ts` reçoit l'événement `text`
3. le bot récupère le `userId`
4. `ConversationHandler.parseIntent(...)` détecte `TRENDING_MARKETS`
5. `PolymarketService.getTrendingMarkets(5)` tente une requête réseau
6. si la requête échoue, le fallback mock est utilisé
7. `ConversationHandler.generateResponse(...)` transforme la liste en message Telegram
8. `DeepLinkGenerator.formatMarketMessage(...)` ajoute des liens cliquables
9. le bot répond à l'utilisateur
10. l'historique de conversation est mis à jour

### Exemple: "tell me more about the first one"

1. l'intention détectée est `MARKET_DETAILS`
2. `getReferenceIndex("first")` renvoie `0`
3. le bot cherche le premier marché de `lastViewedMarkets`
4. il appelle `getMarketDetail(...)`
5. il affiche les probabilités, la liquidité, le volume et les traders

Ce second exemple montre pourquoi la mémoire locale est utile.

---

## 11. Pourquoi le bot est structuré comme ça

Le projet évite de tout mettre dans un seul fichier.

### Avantages

- plus facile à lire
- plus facile à modifier
- plus facile à tester
- plus facile à expliquer

### Limites

- il faut apprendre à suivre plusieurs fichiers
- la mémoire utilisateur est temporaire
- la détection des intentions reste simple

Cette structure est un bon compromis pour un projet pédagogique et pratique.

---

## 12. Comment modifier le code sans te perdre

Cette section est importante si tu veux devenir autonome.

### 12.1. Ajouter un nouveau type d'intention

Si tu veux reconnaître une nouvelle demande:

1. ajoute ou réutilise une valeur dans `IntentType`
2. ajoute la détection dans `parseIntent(...)`
3. ajoute la branche de réponse dans `generateResponse(...)`
4. ajoute la fonction de rendu si nécessaire

### 12.2. Ajouter une nouvelle catégorie de marchés

Tu peux suivre la logique déjà utilisée pour `crypto`, `economy` et `politics`.

Tu dois modifier:

- `parseIntent(...)` pour reconnaître les mots-clés
- `formatCategoryName(...)` pour l'affichage
- éventuellement `PolymarketService.getMockMarketsByCategory(...)`

### 12.3. Remplacer les mocks par de vraies données traders

Pour faire ça proprement:

1. ajoute une méthode dans `PolymarketService`
2. récupère la donnée depuis une vraie source
3. branche-la dans `buildMarketDetailResponse(...)` ou `buildTopTradersResponse(...)`

### 12.4. Remplacer la mémoire en RAM par une base de données

Aujourd'hui le bot stocke le contexte dans un `Map`.

Pour aller plus loin:

1. crée une table `conversation_context`
2. charge le contexte depuis la base au début du message
3. sauvegarde le contexte après chaque réponse

Cette évolution est logique si tu veux garder l'historique après redémarrage.

---

## 13. Exercices de compréhension

Ces exercices sont là pour vérifier que tu as vraiment compris le code.

### Exercice 1: retrouver le rôle de chaque fichier

Réponds sans regarder le code:

- [src/index.ts](src/index.ts)
- [src/services/conversationHandler.ts](src/services/conversationHandler.ts)
- [src/services/polymarket.ts](src/services/polymarket.ts)
- [src/types.ts](src/types.ts)
- [src/utils/deepLinks.ts](src/utils/deepLinks.ts)
- [src/data/mockTraders.ts](src/data/mockTraders.ts)

### Exercice 2: suivre un message

Prends cette phrase:

`show me crypto markets`

Et explique:

1. quelle intention elle déclenche
2. quelle méthode récupère les données
3. quelle méthode formate la réponse
4. quels liens sont ajoutés

### Exercice 3: comprendre un détail de marché

Prends cette phrase:

`tell me more about the second one`

Et explique:

1. comment le bot détermine que c'est un détail
2. comment il sait que c'est le second marché
3. où il va chercher l'information
4. comment il fabrique le message final

### Exercice 4: comprendre le fallback

Explique ce qui se passe si l'API Polymarket ne répond pas.

Indique:

- où l'erreur est attrapée
- quelles données de secours sont utilisées
- pourquoi le bot reste utilisable

---

## 14. Ce qu'il faut absolument retenir

Si tu ne dois retenir que 10 idées, ce sont celles-ci:

1. `types.ts` décrit les objets utilisés dans tout le projet.
2. `index.ts` reçoit les messages Telegram et orchestre le flux.
3. `conversationHandler.ts` comprend l'intention et fabrique le texte.
4. `polymarket.ts` récupère les données ou utilise des mocks.
5. `deepLinks.ts` transforme les données en liens cliquables.
6. `mockTraders.ts` fournit des traders de secours.
7. Le bot fonctionne par intentions, pas par commandes complexes.
8. La mémoire utilisateur est stockée en RAM dans un `Map`.
9. Le fallback est volontaire pour éviter les blocages.
10. Chaque message suit un chemin clair et lisible.

---

## 15. Si tu veux aller encore plus loin

Quand tu auras compris ce parcours, tu pourras travailler sur:

- une vraie base de données pour la mémoire utilisateur
- de vraies données traders
- une meilleure compréhension linguistique
- des boutons Telegram au lieu d'un simple texte
- la transcription vocale
- des notifications en temps réel

Mais avant ça, maîtrise bien le flux actuel.

Le bon réflexe, c'est de pouvoir expliquer ce projet sans ouvrir le code:

- quel fichier reçoit le message
- quel fichier comprend l'intention
- quel fichier récupère la donnée
- quel fichier formate la réponse
- quel fichier fabrique les liens

Si tu sais répondre à ces 5 points, tu comprends déjà l'architecture du bot.
