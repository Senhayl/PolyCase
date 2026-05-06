import axios, { AxiosInstance } from "axios";
import { Trader } from "../types";

export class TraderService {
  private client: AxiosInstance;
  private dataApiBase = "https://data-api.polymarket.com";

  constructor() {
    this.client = axios.create({
      baseURL: this.dataApiBase,
      timeout: 10000,
    });
  }

  /**
   * Fetch real trader leaderboard data from Polymarket's Data API
   */
  async getTopTraders(limit: number = 5): Promise<Trader[]> {
    try {
      const response = await this.client.get("/v1/leaderboard", {
        params: { limit: Math.min(limit, 50) },
      });

      if (!Array.isArray(response.data)) {
        return [];
      }

      const traders = response.data
        .slice(0, limit)
        .map((item: any) => ({
          address: item.proxyWallet || item.address || "",
          winRate: this.calculateWinRate(item),
          pnl: Math.round(item.pnl || 0),
          totalTrades: item.totalTrades || Math.round((item.vol || 0) / 15000),
          volume: Math.round(item.vol || 0),
        }));

      return traders;
    } catch (error: any) {
      console.error("[TraderService] Failed to fetch traders:", error?.message);
      return [];
    }
  }

  /**
   * Calculate win rate from PnL and volume (estimation based on available data)
   */
  private calculateWinRate(trader: any): number {
    // Rough estimation: assume avg bet size ~$100, and use vol/pnl ratio
    if (!trader.vol || trader.vol === 0) return 0.5;
    
    const estimatedTrades = Math.max(1, trader.vol / 15000);
    const pnlPerTrade = (trader.pnl || 0) / estimatedTrades;
    
    // Assume each winning trade = +$15k and losing trade = -$15k on average
    // win_rate = (trades_won / total_trades)
    // More sophisticated: could use on-chain data but this is a reasonable proxy
    const avgWinAmount = 15000;
    const estimatedWinRate = Math.min(0.95, Math.max(0.05, 0.5 + (pnlPerTrade / (avgWinAmount * 2))));
    
    return parseFloat(estimatedWinRate.toFixed(2));
  }


}
