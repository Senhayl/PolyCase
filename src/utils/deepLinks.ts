export class DeepLinkGenerator {
  static generateMarketLink(slug: string): string {
    // Polymarket market pages use the slug
    if (!slug) return "https://polymarket.com";
    return `https://polymarket.com/market/${slug}`;
  }

  static generateTraderLink(walletAddress: string): string {
    // Link directly to trader's profile on Polymarket
    return `https://polymarket.com/${walletAddress}`;
  }

  static formatMarketMessage(
    index: number,
    question: string,
    yesProbability: number,
    marketSlug: string
  ): string {
    const yesPercent = (yesProbability * 100).toFixed(0);
    const noPercent = (100 - yesProbability * 100).toFixed(0);
    const link = this.generateMarketLink(marketSlug);
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
