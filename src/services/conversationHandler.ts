import { IntentType, ParsedIntent, Market, MarketDetail, Trader } from "../types";
import { DeepLinkGenerator } from "../utils/deepLinks";
import { TraderService } from "./traders";

export class ConversationHandler {
  /**
   * Parse user message and extract intent
   */
  static parseIntent(message: string): ParsedIntent {
    const lowerMessage = message.toLowerCase().trim();

    // Trending/discover markets - more flexible matching
    if (
      (/trending|popular|hot|discover|explore|what.*market|market.*trend/i.test(lowerMessage) ||
        (/(top|hot|trending).*market/i.test(lowerMessage)) ||
        (/^(trending|markets|show me|what|discover)/i.test(lowerMessage) && /market/i.test(lowerMessage)))
    ) {
      return { type: IntentType.TRENDING_MARKETS };
    }

    // Crypto markets
    if (
      /crypto|btc|eth|sol|xrp|doge|memecoin|bitcoin|ethereum|solana|dogecoin|coin|web3/i.test(lowerMessage) &&
      (/market|bet|trade|explore/i.test(lowerMessage) || /show|tell/i.test(lowerMessage))
    ) {
      const keyword =
        /\b(btc|bitcoin)\b/i.test(lowerMessage)
          ? "btc"
          : /\b(eth|ethereum)\b/i.test(lowerMessage)
            ? "eth"
            : /\b(sol|solana)\b/i.test(lowerMessage)
              ? "sol"
              : /\b(xrp)\b/i.test(lowerMessage)
                ? "xrp"
                : /\b(doge|dogecoin)\b/i.test(lowerMessage)
                  ? "doge"
                  : /memecoin/i.test(lowerMessage)
                    ? "memecoin"
                    : "crypto";

      return {
        type: IntentType.CATEGORY_MARKETS,
        keywords: [keyword],
      };
    }

    // Economy/recession markets
    if (
      /econom|recession|employ|inflation|gdp/i.test(lowerMessage)
    ) {
      return {
        type: IntentType.CATEGORY_MARKETS,
        keywords: ["economy"],
      };
    }

    // Politics markets
    if (/election|politic|congress|senate|trump|biden/i.test(lowerMessage)) {
      return {
        type: IntentType.CATEGORY_MARKETS,
        keywords: ["politics"],
      };
    }

    // Market details
    // Supports:
    // - "tell me more about the first one"
    // - "tell me more about 5" / "details #5"
    // - "tell me more about ecuador" (matches last shown market title/slug)
    if (/tell|more|detail|details|about|explain|info|infos|information|plus d'?info|d[ée]tails?/i.test(lowerMessage)) {
      // Numeric reference (1-based, user-friendly)
      const numMatch = lowerMessage.match(/(?:^|\s|#)(\d{1,2})(?:\s|$)/);
      if (numMatch) {
        const n = Number.parseInt(numMatch[1], 10);
        if (Number.isFinite(n) && n > 0) {
          return { type: IntentType.MARKET_DETAILS, reference: n };
        }
      }

      // Ordinal reference
      if (/first|second|third|one|that|last|latest|dernier|derni[eè]re/i.test(lowerMessage)) {
        let reference: "first" | "second" | "third" | "last" | number = "first";
        if (/second/i.test(lowerMessage)) reference = "second";
        if (/third/i.test(lowerMessage)) reference = "third";
        if (/last|latest|dernier|derni[eè]re/i.test(lowerMessage)) reference = "last";
        return { type: IntentType.MARKET_DETAILS, reference };
      }

      // Free-text query after "about" / "sur" / "a propos de"
      const queryMatch = lowerMessage.match(/(?:about|sur|concernant|regarding|à propos de|a propos de)\s+(.+)$/i);
      if (queryMatch) {
        const q = queryMatch[1]
          .replace(/^(the|this|that|ce|cet|cette|le|la|les)\s+/i, "")
          .replace(/[^\p{L}\p{N}\s-]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (q.length >= 2) {
          return { type: IntentType.MARKET_DETAILS, marketQuery: q };
        }
      }
    }

    // Top traders
    if (
      (/top|best|leading|influenc|biggest|successful/i.test(lowerMessage) ||
        /^(who|show me|tell me)/i.test(lowerMessage) ||
        /trader/i.test(lowerMessage)) &&
      /trader|whale|account|player|profile|user|address/i.test(lowerMessage)
    ) {
      return { type: IntentType.TOP_TRADERS };
    }

    // Help/greeting
    if (/^hello|hi|hey|help|what can/i.test(lowerMessage)) {
      return { type: IntentType.HELP };
    }

    return { type: IntentType.UNKNOWN };
  }

  /**
   * Generate bot response based on intent
   */
  static generateResponse(
    intent: ParsedIntent,
    markets?: Market[],
    marketDetail?: MarketDetail,
    traders?: Trader[]
  ): string {
    switch (intent.type) {
      case IntentType.TRENDING_MARKETS:
        return this.buildTrendingMarketsResponse(markets || []);

      case IntentType.CATEGORY_MARKETS:
        return this.buildCategoryMarketsResponse(
          markets || [],
          intent.keywords?.[0] || "general"
        );

      case IntentType.MARKET_DETAILS:
        return this.buildMarketDetailResponse(marketDetail);

      case IntentType.TOP_TRADERS:
        return this.buildTopTradersResponse(traders || []);

      case IntentType.HELP:
        return this.buildHelpResponse();

      default:
        return this.buildUnknownResponse();
    }
  }

  /**
   * Build response for trending markets
   */
  private static buildTrendingMarketsResponse(markets: Market[]): string {
    if (markets.length === 0) {
      return "Sorry, I couldn't fetch trending markets right now. Try asking about crypto markets or top traders!";
    }

    let response = "🔥 *Trending Markets Right Now:*\n\n";

    markets.forEach((market, index) => {
      const yesPercent = (market.yesPrice * 100).toFixed(0);
      response += DeepLinkGenerator.formatMarketMessage(
        index + 1,
        market.question,
        market.yesPrice,
        market.slug
      );
      response += "\n\n";
    });

    response += "_Want more details on one? Just ask: 'tell me more about the first one'_";

    return response;
  }

  /**
   * Build response for category markets
   */
  private static buildCategoryMarketsResponse(
    markets: Market[],
    category: string
  ): string {
    if (markets.length === 0) {
      return `No ${category} markets found right now. Try asking about trending markets!`;
    }

    const categoryDisplay = this.formatCategoryName(category);
    let response = `📊 *${categoryDisplay} Markets:*\n\n`;

    markets.forEach((market, index) => {
      response += DeepLinkGenerator.formatMarketMessage(
        index + 1,
        market.question,
        market.yesPrice,
        market.slug
      );
      response += "\n\n";
    });

    response += "_Want details on any of these? Just say 'tell me more about the second one'_";

    return response;
  }

  /**
   * Build response for market details
   */
  private static buildMarketDetailResponse(
    market: MarketDetail | undefined
  ): string {
    if (!market) {
      return "I couldn't fetch that market's details. Try another one!";
    }

    let response = `📈 *${market.question}*\n\n`;

    response += `*Probabilities:*\n`;
    response += `✅ Yes: ${(market.yesPrice * 100).toFixed(1)}%\n`;
    response += `❌ No: ${(market.noPrice * 100).toFixed(1)}%\n\n`;

    if (market.liquidity) {
      response += `💧 *Liquidity:* $${(market.liquidity / 1000000).toFixed(1)}M\n`;
    }

    if (market.volume24h) {
      response += `📊 *24h Volume:* $${(market.volume24h / 1000).toFixed(0)}K\n\n`;
    }

    if (market.orderBook && market.orderBook.bids && market.orderBook.bids.length > 0) {
      response += `*Order Book Depth:*\n`;
      response += `💰 Bids: ${market.orderBook.bids.length} | Asks: ${market.orderBook.asks?.length || 0}\n\n`;
    }

    response += "\n" + DeepLinkGenerator.generateMarketLink(market.slug);

    return response;
  }

  /**
   * Build response for top traders
   */
  private static buildTopTradersResponse(traders: Trader[]): string {
    if (traders.length === 0) {
      return "No trader data available right now.";
    }

    let response = "🏆 *Top Traders Right Now:*\n\n";

    traders.slice(0, 5).forEach((trader, index) => {
      response += DeepLinkGenerator.formatTraderMessage(
        index + 1,
        trader.address,
        trader.winRate,
        trader.pnl
      );
      response += "\n\n";
    });

    response += "_Click on any trader to see their portfolio_";

    return response;
  }

  /**
   * Build help/greeting response
   */
  private static buildHelpResponse(): string {
    return (
      `👋 *Hey! I'm Polycool.*\n\n` +
      `I help you explore prediction markets and find great opportunities.\n\n` +
      `You can ask me things like:\n` +
      `• "what are trending markets"\n` +
      `• "show me crypto bets"\n` +
      `• "who are the best traders"\n` +
      `• "tell me more about the first one"\n\n` +
      `Just chat naturally — no commands needed! 👇`
    );
  }

  /**
   * Build response for unknown intent
   */
  private static buildUnknownResponse(): string {
    return (
      `🤔 I didn't quite catch that. Try asking:\n\n` +
      `• "what are trending markets"\n` +
      `• "show me crypto markets"\n` +
      `• "who are the best traders"\n` +
      `• "tell me more about that market"\n\n` +
      `What would you like to explore?`
    );
  }

  /**
   * Format category name for display
   */
  private static formatCategoryName(category: string): string {
    const names: { [key: string]: string } = {
      crypto: "🪙 Crypto",
      economy: "💰 Economy",
      politics: "🏛️ Politics",
      sports: "⚽ Sports",
      tech: "💻 Tech",
    };

    return names[category.toLowerCase()] || `📊 ${category}`;
  }

  /**
   * Get reference index (first -> 0, second -> 1, etc)
   */
  static getReferenceIndex(
    reference: "first" | "second" | "third" | "last" | number | undefined,
    total?: number
  ): number {
    // Users naturally say "1" to mean first item.
    if (typeof reference === "number") return Math.max(0, reference - 1);
    if (reference === "second") return 1;
    if (reference === "third") return 2;
    if (reference === "last") {
      if (typeof total === "number" && Number.isFinite(total) && total > 0) return total - 1;
      return 0;
    }
    return 0; // default to first
  }
}
