import axios, { AxiosInstance } from "axios";
import { Market, MarketDetail } from "../types";

export class PolymarketService {
  private gammaClient: AxiosInstance;

  constructor() {
    // Polymarket Gamma API: reliable for open markets + slugs + prices
    this.gammaClient = axios.create({ baseURL: "https://gamma-api.polymarket.com", timeout: 10000 });
  }

  /**
   * Simple GET wrapper.
   */
  private async requestGamma(path: string, params?: Record<string, any>) {
    return this.gammaClient.get(path, { params });
  }

  private parseJsonArrayString(value: unknown): unknown[] {
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private toNumber(value: unknown, fallback = 0): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Get trending markets from Polymarket
   */
  async getTrendingMarkets(limit: number = 5): Promise<Market[]> {
    try {
      const response = await this.requestGamma("/markets", {
        // Pull a larger batch so we can rank by volume locally.
        limit: 300,
        active: true,
        closed: false,
      });

      const all = this.formatMarkets(response.data);
      // Trending = highest 24h volume among open binary Yes/No markets.
      const filtered = all
        .filter((m) => m.slug && m.question)
        .filter((m) => m.yesPrice > 0 && m.yesPrice < 1)
        .filter((m) => (m.volume24h ?? 0) > 0);

      filtered.sort((a, b) => {
        const volDelta = (b.volume24h ?? 0) - (a.volume24h ?? 0);
        if (volDelta !== 0) return volDelta;
        return (b.liquidity ?? 0) - (a.liquidity ?? 0);
      });

      return filtered.slice(0, limit);
    } catch (error) {
      console.error("Error fetching trending markets:", error);
      return [];
    }
  }

  /**
   * Search for markets by category or keywords
   */
  async searchMarkets(
    category: string,
    limit: number = 5
  ): Promise<Market[]> {
    try {
      const needle = category.toLowerCase().trim();

      const matchesNeedle = (market: Market): boolean => {
        const hay = `${market.question} ${(market.category || "")}`.toLowerCase();

        if (needle === "btc") return /bitcoin|\bbtc\b/i.test(hay);
        if (needle === "eth") return /ethereum|\beth\b/i.test(hay);
        if (needle === "sol") return /solana|\bsol\b/i.test(hay);
        if (needle === "xrp") return /\bxrp\b/i.test(hay);
        if (needle === "doge") return /dogecoin|\bdoge\b/i.test(hay);
        if (needle === "memecoin") return /memecoin/i.test(hay);

        if (needle === "crypto") {
          return [
            /crypto/i,
            /bitcoin|\bbtc\b/i,
            /ethereum|\beth\b/i,
            /solana|\bsol\b/i,
            /\bxrp\b/i,
            /memecoin/i,
            /dogecoin|\bdoge\b/i,
          ].some((re) => re.test(hay));
        }

        if (needle === "politics") {
          return ["politic", "election", "president", "congress", "senate", "trump", "biden"].some((n) =>
            hay.includes(n)
          );
        }

        if (needle === "economy") {
          return ["econom", "inflation", "gdp", "rates", "recession", "unemployment", "fed"].some((n) =>
            hay.includes(n)
          );
        }

        return hay.includes(needle);
      };

      const pageSize = 200;
      const maxPages = 10; // cap to keep latency reasonable
      const results: Market[] = [];
      const seenIds = new Set<string>();

      for (let page = 0; page < maxPages && results.length < limit; page++) {
        const response = await this.requestGamma("/markets", {
          limit: pageSize,
          offset: page * pageSize,
          active: true,
          closed: false,
        });

        const batch = this.formatMarkets(response.data)
          .filter((m) => m.slug && m.question)
          .filter((m) => m.yesPrice > 0 && m.yesPrice < 1);

        if (batch.length === 0) break;

        for (const market of batch) {
          if (results.length >= limit) break;
          if (!market.id || seenIds.has(market.id)) continue;
          if (!matchesNeedle(market)) continue;

          seenIds.add(market.id);
          results.push(market);
        }
      }

      return results;
    } catch (error) {
      console.error(`Error searching markets for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific market
   */
  async getMarketDetail(marketId: string): Promise<MarketDetail | null> {
    try {
      const response = await this.requestGamma(`/markets/${marketId}`);
      return this.formatMarketDetail(response.data);
    } catch (error) {
      console.error(`Error fetching market detail for ${marketId}:`, error);
      return null;
    }
  }

  /**
   * Format raw market data from API
   */
  private formatMarkets(data: any): Market[] {
    if (!Array.isArray(data)) {
      console.warn("[formatMarkets] Expected array from Gamma API, got:", typeof data);
      return [];
    }

    return data
      .map((market) => {
        const outcomes = this.parseJsonArrayString(market.outcomes);
        const outcomePrices = this.parseJsonArrayString(market.outcomePrices);

        const normalizedOutcomes = outcomes
          .map((o) => (typeof o === "string" ? o : ""))
          .map((o) => o.trim());

        const yesIndex = normalizedOutcomes.findIndex((o) => o.toLowerCase() === "yes");
        const noIndex = normalizedOutcomes.findIndex((o) => o.toLowerCase() === "no");

        // Keep only binary Yes/No markets to avoid misleading probabilities.
        if (normalizedOutcomes.length !== 2 || yesIndex === -1 || noIndex === -1) {
          return null;
        }

        const yesRaw = outcomePrices[yesIndex];
        const noRaw = outcomePrices[noIndex];

        const yesPrice = this.clamp01(this.toNumber(yesRaw, 0.5));
        const noPrice = this.clamp01(this.toNumber(noRaw, 0.5));

        return {
          id: String(market.id || ""),
          slug: String(market.slug || ""),
          question: String(market.question || ""),
          yesPrice,
          noPrice,
          liquidity: this.toNumber(market.liquidityNum ?? market.liquidity, 0),
          volume24h: this.toNumber(market.volume24hr ?? market.volume24hrClob ?? market.volume24h, 0),
          category: String(market.groupItemTitle || market.category || "general"),
          createdAt: market.createdAt,
        } as Market;
      })
      .filter((m): m is Market => Boolean(m));
  }

  /**
   * Format detailed market information
   */
  private formatMarketDetail(data: any): MarketDetail {
    const outcomes = this.parseJsonArrayString(data.outcomes);
    const outcomePrices = this.parseJsonArrayString(data.outcomePrices);

    const normalizedOutcomes = outcomes
      .map((o) => (typeof o === "string" ? o : ""))
      .map((o) => o.trim());

    const yesIndex = normalizedOutcomes.findIndex((o) => o.toLowerCase() === "yes");
    const noIndex = normalizedOutcomes.findIndex((o) => o.toLowerCase() === "no");

    const yesRaw = yesIndex >= 0 ? outcomePrices[yesIndex] : undefined;
    const noRaw = noIndex >= 0 ? outcomePrices[noIndex] : undefined;

    const yesPrice = this.clamp01(this.toNumber(yesRaw, 0.5));
    const noPrice = this.clamp01(this.toNumber(noRaw, 0.5));

    return {
      id: String(data.id || ""),
      slug: String(data.slug || ""),
      question: String(data.question || ""),
      yesPrice,
      noPrice,
      liquidity: this.toNumber(data.liquidityNum ?? data.liquidity, 0),
      volume24h: this.toNumber(data.volume24hr ?? data.volume24hrClob ?? data.volume24h, 0),
      category: String(data.groupItemTitle || data.category || "general"),
      createdAt: data.createdAt,
      orderBook: undefined,
    };
  }
}