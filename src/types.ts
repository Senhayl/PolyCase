// Market types
export interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  liquidity?: number;
  volume24h?: number;
  category?: string;
  createdAt?: string;
}

export interface MarketDetail extends Market {
  topTraders?: Trader[];
  orderBook?: {
    bids: Array<{ price: number; amount: number }>;
    asks: Array<{ price: number; amount: number }>;
  };
}

// Trader types
export interface Trader {
  address: string;
  winRate: number;
  pnl: number;
  totalTrades?: number;
  volume?: number;
}

// Conversation types
export interface ConversationContext {
  userId: number;
  lastMarketId?: string;
  lastViewedMarkets?: Market[];
  conversationHistory: Message[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Intent types
export enum IntentType {
  TRENDING_MARKETS = "TRENDING_MARKETS",
  CATEGORY_MARKETS = "CATEGORY_MARKETS",
  MARKET_DETAILS = "MARKET_DETAILS",
  TOP_TRADERS = "TOP_TRADERS",
  HELP = "HELP",
  UNKNOWN = "UNKNOWN",
}

export interface ParsedIntent {
  type: IntentType;
  keywords?: string[];
  reference?: "first" | "second" | "third" | number;
}
