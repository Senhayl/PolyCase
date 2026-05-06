const BOT_USERNAME = process.env.BOT_USERNAME || "PolycoolApp_bot";
const REF_CODE = "2BWKT3G5"; // Reference code for tracking

export class DeepLinkGenerator {
  static generateMarketLink(marketId: string): string {
    return `https://t.me/${BOT_USERNAME}/PolycoolApp?startapp=market_${marketId}_ref_${REF_CODE}`;
  }

  static generateTraderLink(walletAddress: string): string {
    // Link directly to trader's profile on Polymarket
    return `https://polymarket.com/${walletAddress}`;
  }

  static formatMarketMessage(
    index: number,
    question: string,
    yesProbability: number,
    marketId: string
  ): string {
    const yesPercent = (yesProbability * 100).toFixed(0);
    const noPercent = (100 - yesProbability * 100).toFixed(0);
    const link = this.generateMarketLink(marketId);
    return `${index}. ${question} (${yesPercent}%)\n[View Market](${link})`;
  }

  static formatTraderMessage(
    index: number,
    address: string,
    winRate: number,
    pnl: number
  ): string {
    const link = this.generateTraderLink(address);
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return `${index}. [${shortAddress}](${link})\n   Win Rate: ${(winRate * 100).toFixed(1)}% | PnL: $${pnl.toFixed(0)}`;
  }
}
