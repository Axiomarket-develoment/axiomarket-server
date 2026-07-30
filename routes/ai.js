const express = require("express");
const Groq = require("groq-sdk");

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});





router.post("/ai-insight", async (req, res) => {
  try {
    const { market } = req.body;

    if (!market) {
      return res.status(400).json({
        success: false,
        insight: "No market provided",
      });
    }

    const isFootball =
      market.marketType === "SPORT" ||
      market.marketMode?.startsWith("FOOTBALL");

    const isCrypto =
      market.marketType === "CRYPTO" ||
      market.marketType === "MEME COINS";

    const isSocial =
      market.marketType === "SOCIAL" ||
      market.marketType === "X";

    // -----------------------------------
    // BASE CONTEXT BUILDER
    // -----------------------------------

    const baseContext = `
Market Question: ${market.question}
Market Type: ${market.marketType}
Market Mode: ${market.marketMode || "N/A"}
Start Date: ${market.startDate}
End Date: ${market.endDate}
Duration: ${market.durationMinutes} minutes
`;

    // -----------------------------------
    // FOOTBALL MODE PROMPT (SMART SWITCH)
    // -----------------------------------

    const footballPrompt = `
You are an elite football prediction analyst.

This market is a FOOTBALL market with mode: ${market.marketMode}

EVENT INFO:
- Match: ${market.event?.name}
- League: ${market.event?.league}
- Start Time: ${market.event?.startTime}
- Teams/Players: ${(market.event?.participants || []).join(", ")}

ANALYSIS RULES:
1. Identify strongest likely outcome based on mode:
   - FOOTBALL_MATCH → Home / Draw / Away
   - FOOTBALL_TEAM → Team performance win likelihood
   - FOOTBALL_PLAYER → Player performance impact
   - FOOTBALL_OUTCOME → Specific event outcome probability

2. Consider:
- Form
- Injuries / squad strength
- Head-to-head
- Motivation
- Tactical advantage

3. Output format:
- Prediction
- Reasoning (clear and simple)
- Risk level (Low / Medium / High)
- Betting guidance (safe vs risky angle)

Market Question:
${market.question}
`;

    // -----------------------------------
    // CRYPTO / MEME COINS PROMPT
    // -----------------------------------

    const cryptoPrompt = `
You are a crypto prediction market analyst.

Analyze this asset-based prediction:

- Asset: ${market.metadata?.assetSymbol || market.metadata?.asset}
- Target Price: ${market.metadata?.targetPrice}
- Start Price: ${market.metadata?.startPrice}
- Direction: ${market.metadata?.direction}

TASK:
1. Predict likelihood of YES/NO outcome
2. Explain using:
- Market sentiment
- Volatility
- Momentum
- Macro conditions

3. Give:
- Confidence level (0-100%)
- Risk level (Low / Medium / High)
- Trading advice (simple, no jargon)

Market Question:
${market.question}
`;

    // -----------------------------------
    // SOCIAL / X PROMPT
    // -----------------------------------

    const socialPrompt = `
You are a social prediction analyst.

This market is based on social attention / influence.

Context:
- Username: ${market.metadata?.username}
- Asset: ${market.metadata?.asset}

Analyze:
1. Likelihood of event happening (YES/NO)
2. Social influence strength
3. Virality potential
4. Engagement momentum

Give:
- Prediction
- Reasoning
- Risk level
- Insight for traders

Market Question:
${market.question}
`;

    // -----------------------------------
    // DEFAULT PROMPT (GENERAL MARKETS)
    // -----------------------------------

    const defaultPrompt = `
You are a professional prediction market analyst.

Analyze this market:

${baseContext}

Outcomes:
${
  market.subMarkets
    ?.map(
      (s) =>
        `${s.question}: ${s.outcomes?.map((o) => o.label).join(", ")}`
    )
    .join("\n") || "N/A"
}

TASK:
1. Predict strongest outcome
2. Explain reasoning clearly
3. Give risk level (Low / Medium / High)
4. Give user trading guidance (YES/NO bias, avoid complexity)
`;

    // -----------------------------------
    // PICK PROMPT
    // -----------------------------------

    let prompt = defaultPrompt;

    if (isFootball) prompt = footballPrompt;
    else if (isCrypto) prompt = cryptoPrompt;
    else if (isSocial) prompt = socialPrompt;

    // -----------------------------------
    // GROQ CALL
    // -----------------------------------

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You are a world-class prediction market analyst. Be clear, structured, and non-technical.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const insight =
      completion.choices?.[0]?.message?.content ||
      "AI insight unavailable.";

    return res.json({
      success: true,
      insight,
      meta: {
        marketType: market.marketType,
        marketMode: market.marketMode,
      },
    });
  } catch (err) {
    console.error("AI ERROR:", err);

    return res.status(500).json({
      success: false,
      insight: "AI insight unavailable.",
    });
  }
});

module.exports = router;