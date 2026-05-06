import axios, { AxiosInstance } from "axios";
import { Market, MarketDetail } from "../types";

export class PolymarketService {
  private client: AxiosInstance;
  private baseURL: string;
  private candidates: string[];

  constructor() {
    // Candidate endpoints to try (env first, then common public endpoints)
    this.candidates = [
      process.env.POLYMARKET_API_BASE,
      "https://api.polymarket.com",
      "https://polymarket.com/api",
      "https://clob.polymarket.com",
    ].filter(Boolean) as string[];

    // Start with the first candidate as baseURL
    this.baseURL = this.candidates[0];
    this.client = axios.create({ baseURL: this.baseURL, timeout: 10000 });
  }

  /**
   * Generic GET request which cycles through candidate base URLs until one succeeds.
   * When a candidate succeeds, it is promoted to the active `baseURL` so subsequent
   * calls use the working endpoint directly.
   */
  private async request(path: string, params?: Record<string, any>) {
    let lastError: any = null;

    for (const candidate of this.candidates) {
      try {
        this.client.defaults.baseURL = candidate;
        const res = await this.client.get(path, { params });
        if (res && (res.status === 200 || res.status === 201)) {
          // promote successful candidate
          this.baseURL = candidate;
          this.client.defaults.baseURL = candidate;
          return res;
        }
      } catch (err: any) {
        lastError = err;
        // try next candidate
      }
    }

    // none worked
    console.error(
      `[PolymarketService] ⛔ No working endpoint found. Last error:`,
      lastError
    );
    throw lastError || new Error("No working Polymarket endpoint found");
  }

  /**
   * Get trending markets from Polymarket
   */
  async getTrendingMarkets(limit: number = 5): Promise<Market[]> {
    try {
      // Using Polymarket API endpoint for markets
      const response = await this.request("/markets", {
        limit,
        orderBy: "volume24h",
        order: "desc",
      });

      return this.formatMarkets(response.data);
    } catch (error) {
      console.error("Error fetching trending markets:", error);
      return this.getMockTrendingMarkets();
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
      const response = await this.request("/markets", {
        category: category.toLowerCase(),
        limit,
        orderBy: "volume24h",
        order: "desc",
      });

      return this.formatMarkets(response.data);
    } catch (error) {
      console.error(`Error searching markets for category ${category}:`, error);
      return this.getMockMarketsByCategory(category);
    }
  }

  /**
   * Get detailed information about a specific market
   */
  async getMarketDetail(marketId: string): Promise<MarketDetail | null> {
    try {
      const response = await this.request(`/markets/${marketId}`);
      return this.formatMarketDetail(response.data);
    } catch (error) {
      console.error(`Error fetching market detail for ${marketId}:`, error);
      return this.getMockMarketDetail(marketId);
    }
  }

  /**
   * Format raw market data from API
   */
  private formatMarkets(data: any): Market[] {
    // Accept several common shapes: array, { markets: [] }, { data: [] }, { data: { markets: [] } }, { results: [] }
    let list: any[] = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray((data as any).data)) {
      // Handle { data: [...] } from clob.polymarket.com
      list = (data as any).data;
    } else if (Array.isArray((data as any).markets)) {
      list = (data as any).markets;
    } else if (Array.isArray((data as any).data?.markets)) {
      list = (data as any).data.markets;
    } else if (Array.isArray((data as any).results)) {
      list = (data as any).results;
    } else {
      console.warn("[formatMarkets] Unrecognized response shape:", Object.keys(data || {}));
      return [];
    }

    return list.slice(0, 5).map((market) => {
      // Extract YES and NO prices from tokens array
      let yesPrice = 0.5;
      let noPrice = 0.5;
      if (Array.isArray(market.tokens) && market.tokens.length >= 2) {
        yesPrice = market.tokens[0]?.price ?? 0.5;
        noPrice = market.tokens[1]?.price ?? 0.5;
      }

      return {
        id: market.question_id || market.condition_id || market.id || "",
        question: market.question || market.title || "",
        yesPrice,
        noPrice,
        liquidity: market.liquidity || 0,
        volume24h: market.volume_24h || market.volume24h || 0,
        category: (market.tags && market.tags[0]) || market.category || "general",
        createdAt: market.created_at || market.createdAt,
      };
    });
  }

  /**
   * Format detailed market information
   */
  private formatMarketDetail(data: any): MarketDetail {
    // Extract YES and NO prices from tokens array
    let yesPrice = 0.5;
    let noPrice = 0.5;
    if (Array.isArray(data.tokens) && data.tokens.length >= 2) {
      yesPrice = data.tokens[0]?.price ?? 0.5;
      noPrice = data.tokens[1]?.price ?? 0.5;
    }

    return {
      id: data.question_id || data.condition_id || data.id || data.market_id || "",
      question: data.question || data.title || "",
      yesPrice,
      noPrice,
      liquidity: data.liquidity || 0,
      volume24h: data.volume_24h || data.volume24h || 0,
      category: (data.tags && data.tags[0]) || data.category || "general",
      createdAt: data.created_at || data.createdAt,
      orderBook: data.order_book
        ? {
            bids: data.order_book.bids || [],
            asks: data.order_book.asks || [],
          }
        : undefined,
    };
  }

  /**
   * Mock data for trending markets (fallback)
   */
  private getMockTrendingMarkets(): Market[] {
    return [
      {
        id: "90178",
        question: "Will ETH hit $5,000 by end of 2026?",
        yesPrice: 0.42,
        noPrice: 0.58,
        liquidity: 1200000,
        volume24h: 450000,
        category: "crypto",
      },
      {
        id: "90179",
        question: "Will BTC reach $100k by 2026?",
        yesPrice: 0.68,
        noPrice: 0.32,
        liquidity: 2500000,
        volume24h: 890000,
        category: "crypto",
      },
      {
        id: "90180",
        question: "Will there be a major recession in 2026?",
        yesPrice: 0.35,
        noPrice: 0.65,
        liquidity: 800000,
        volume24h: 320000,
        category: "economy",
      },
      {
        id: "90181",
        question: "Will AI regulations pass in the US by 2026?",
        yesPrice: 0.56,
        noPrice: 0.44,
        liquidity: 600000,
        volume24h: 210000,
        category: "politics",
      },
      {
        id: "90182",
        question: "Will US unemployment stay below 4% in 2026?",
        yesPrice: 0.61,
        noPrice: 0.39,
        liquidity: 450000,
        volume24h: 165000,
        category: "economy",
      },
    ];
  }

  /**
   * Mock data for category search (fallback)
   */
  private getMockMarketsByCategory(category: string): Market[] {
    const categoryLower = category.toLowerCase();

    if (categoryLower.includes("crypto")) {
      return [
        {
          id: "90178",
          question: "Will ETH hit $5,000 by end of 2026?",
          yesPrice: 0.42,
          noPrice: 0.58,
          liquidity: 1200000,
          volume24h: 450000,
          category: "crypto",
        },
        {
          id: "90179",
          question: "Will BTC reach $100k by 2026?",
          yesPrice: 0.68,
          noPrice: 0.32,
          liquidity: 2500000,
          volume24h: 890000,
          category: "crypto",
        },
      ];
    }

    if (categoryLower.includes("econ")) {
      return [
        {
          id: "90180",
          question: "Will there be a major recession in 2026?",
          yesPrice: 0.35,
          noPrice: 0.65,
          liquidity: 800000,
          volume24h: 320000,
          category: "economy",
        },
        {
          id: "90182",
          question: "Will US unemployment stay below 4% in 2026?",
          yesPrice: 0.61,
          noPrice: 0.39,
          liquidity: 450000,
          volume24h: 165000,
          category: "economy",
        },
      ];
    }

    return this.getMockTrendingMarkets();
  }

  /**
   * Mock market detail (fallback)
   */
  private getMockMarketDetail(marketId: string): MarketDetail {
    const market = this.getMockTrendingMarkets().find(
      (m) => m.id === marketId
    );

    if (!market) {
      return {
        id: marketId,
        question: "Market not found",
        yesPrice: 0.5,
        noPrice: 0.5,
      };
    }

    return {
      ...market,
      orderBook: {
        bids: [
          { price: market.yesPrice - 0.01, amount: 50000 },
          { price: market.yesPrice - 0.02, amount: 100000 },
        ],
        asks: [
          { price: market.yesPrice + 0.01, amount: 45000 },
          { price: market.yesPrice + 0.02, amount: 95000 },
        ],
      },
    };
  }
}
