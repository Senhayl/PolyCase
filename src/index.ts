import { Telegraf, Context } from "telegraf";
import { Message } from "telegraf/types";
import dotenv from "dotenv";
import axios from "axios";

import { PolymarketService } from "./services/polymarket";
import { ConversationHandler } from "./services/conversationHandler";
import { TraderService } from "./services/traders";
import { IntentType, ConversationContext, Market } from "./types";
import { transcribeVoiceOggOpus } from "./services/transcription";

dotenv.config();

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (
  !telegramBotToken ||
  telegramBotToken === "your_telegram_bot_token_here" ||
  !/^\d+:[\w-]{30,}$/.test(telegramBotToken)
) {
  throw new Error(
    "Invalid TELEGRAM_BOT_TOKEN. Copy .env.example to .env and set the token from @BotFather."
  );
}

interface BotContext extends Context {
  session?: ConversationContext;
}

// Initialize services
const polymarketService = new PolymarketService();
const traderService = new TraderService();

// User contexts (in production, use a database)
const userContexts = new Map<number, ConversationContext>();

// Initialize bot
const bot = new Telegraf<BotContext>(telegramBotToken);

async function handleUserText(ctx: any, userId: number, userMessage: string) {
  const context = getContext(userId);

  // Show typing indicator
  await ctx.sendChatAction("typing");

  // Parse user intent
  const intent = ConversationHandler.parseIntent(userMessage);

  // Store in history
  context.conversationHistory.push({
    role: "user",
    content: userMessage,
    timestamp: Date.now(),
  });

  let response: string;
  let markets: Market[] = [];

  // Fetch data based on intent
  if (intent.type === IntentType.TRENDING_MARKETS || intent.type === IntentType.CATEGORY_MARKETS) {
    if (intent.type === IntentType.CATEGORY_MARKETS && intent.keywords) {
      markets = await polymarketService.searchMarkets(intent.keywords[0], 5);
    } else {
      markets = await polymarketService.getTrendingMarkets(5);
    }

    // Store markets for follow-up reference
    context.lastViewedMarkets = markets;

    response = ConversationHandler.generateResponse(intent, markets);
  } else if (intent.type === IntentType.MARKET_DETAILS) {
    // Get reference to previously shown market
    const markets = context.lastViewedMarkets;

    let refIndex = ConversationHandler.getReferenceIndex(intent.reference, markets?.length);

    if (markets && intent.marketQuery) {
      const q = intent.marketQuery.toLowerCase();
      const idx = markets.findIndex((m) => {
        const question = (m.question || "").toLowerCase();
        const slug = (m.slug || "").toLowerCase();
        return question.includes(q) || slug.includes(q);
      });

      if (idx >= 0) refIndex = idx;
    }

    if (markets && markets[refIndex]) {
      const market = markets[refIndex];
      context.lastMarketId = market.id;

      const marketDetail = await polymarketService.getMarketDetail(market.id);
      response = ConversationHandler.generateResponse(intent, undefined, marketDetail || undefined);
    } else {
      response = "I don't have a market to show details for. Ask about trending markets first!";
    }
  } else if (intent.type === IntentType.TOP_TRADERS) {
    // Fetch top traders
    const traders = await traderService.getTopTraders(5);
    response = ConversationHandler.generateResponse(intent, undefined, undefined, traders);
  } else {
    response = ConversationHandler.generateResponse(intent);
  }

  // Store bot response in history
  context.conversationHistory.push({
    role: "assistant",
    content: response,
    timestamp: Date.now(),
  });

  // Send response
  await ctx.reply(response, {
    parse_mode: "Markdown",
    link_preview_options: {
      is_disabled: true,
    },
  });
}

/**
 * Get or create user context
 */
function getContext(userId: number): ConversationContext {
  if (!userContexts.has(userId)) {
    userContexts.set(userId, {
      userId,
      conversationHistory: [],
    });
  }
  return userContexts.get(userId)!;
}

/**
 * Start command
 */
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const context = getContext(userId);
  context.conversationHistory = [];

  await ctx.reply(
    "👋 *Hey — I'm Polycool.*\n\n" +
      "I can help you explore prediction markets.\n\n" +
      "You can ask things like:\n" +
      "• \"what are trending markets\"\n" +
      "• \"show me crypto bets\"\n" +
      "• \"who are the best traders\"\n\n" +
      "Try something 👇",
    {
      parse_mode: "Markdown",
    }
  );
});

/**
 * Handle text messages
 */
bot.on("text", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const userMessage = ctx.message?.text;
  if (!userMessage) return;

  try {
    await handleUserText(ctx, userId, userMessage);
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.reply(
      "Sorry, something went wrong. Try asking about markets or traders again!",
      {
        parse_mode: "Markdown",
      }
    );
  }
});

/**
 * Handle voice messages by transcribing then treating as text.
 */
bot.on("voice", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const voice = (ctx.message as any)?.voice;
  const fileId = voice?.file_id as string | undefined;
  if (!fileId) return;

  await ctx.sendChatAction("typing");

  try {
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const audio = await axios.get(fileLink.href, { responseType: "arraybuffer" });
    const buffer = Buffer.from(audio.data);

    const text = await transcribeVoiceOggOpus(buffer);
    if (!text) {
      await ctx.reply("I couldn't understand that voice message. Try again with clearer audio.", {
        parse_mode: "Markdown",
      });
      return;
    }

    await handleUserText(ctx, userId, text);
  } catch (error: any) {
    const msg = String(error?.message || error);
    console.error("Error handling voice message:", msg, error);

    // GROQ_API_KEY missing
    if (!process.env.GROQ_API_KEY || msg.includes("GROQ_API_KEY")) {
      await ctx.reply(
        "⚠️ Voice transcription isn't configured\\. Set `GROQ_API_KEY` in your `.env`\\. Get a free key at [console\\.groq\\.com](https://console.groq.com)\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    // Invalid or expired API key
    if (
      error?.status === 401 ||
      msg.includes("401") ||
      msg.includes("Incorrect API key") ||
      msg.includes("invalid_api_key") ||
      msg.includes("authentication")
    ) {
      await ctx.reply(
        "⚠️ Your Groq API key is invalid or expired\\. Check `GROQ_API_KEY` in your `.env`\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    // Rate limit
    if (
      (error?.status === 429 || msg.includes("429")) &&
      (msg.includes("rate_limit") || msg.includes("rate limit") || msg.includes("Too Many Requests"))
    ) {
      await ctx.reply(
        "⚠️ Groq rate limit hit\\. Wait a few seconds and try again\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    // Quota exhausted
    if (
      error?.status === 429 ||
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("billing") ||
      msg.includes("insufficient_quota")
    ) {
      await ctx.reply(
        "⚠️ Groq quota exceeded\\. Check your usage at [console\\.groq\\.com](https://console.groq.com)\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    await ctx.reply("Sorry, I couldn't process that voice message. Please try again!", {
      parse_mode: "Markdown",
    });
  }
});

/**
 * Handle other message types
 */
bot.on("message", async (ctx) => {
  // This catches non-text messages (photos, voice, etc.)
  const msg: any = (ctx as any).message;
  if (msg?.text) return;
  if (msg?.voice) return;
  await ctx.reply(
    "I understand text right now. Try asking me about markets or traders! 👇",
    {
      parse_mode: "Markdown",
    }
  );
});

/**
 * Error handling
 */
bot.catch((err, ctx) => {
  console.error("Telegraf error:", err);
  ctx.reply("Something went wrong. Please try again.").catch(console.error);
});

/**
 * Start the bot
 */
async function startBot() {
  try {
    console.log("🚀 Starting Polycool bot...");
    console.log("📨 Using polling mode...");
    await bot.launch();
    console.log("✅ Polycool bot is live!");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

// Start the bot
startBot().catch(console.error);

// Graceful shutdown
process.once("SIGINT", () => {
  console.log("Stopping bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("Stopping bot...");
  bot.stop("SIGTERM");
});

export default bot;