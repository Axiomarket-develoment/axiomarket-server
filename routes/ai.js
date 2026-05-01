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

    const isSport = market.marketType === "SPORT";

    // ✅ BUILD PROMPTS INSIDE (so market is accessible)

    const sportPrompt = `
You are a professional football/sports analyst.

Analyze this match and give a structured insight:

1️⃣ Outcome Prediction:
Clearly state which outcome is most likely (Home / Draw / Away).

2️⃣ Match Analysis:
Explain based on:
- Team form (recent matches)
- Head-to-head record
- Squad strength & injuries
- Home vs away advantage
- Motivation (league position, stakes)

3️⃣ Betting Insight:
Give practical advice for a prediction market user:
- Which side looks safer
- Whether the market feels risky or balanced
- DO NOT mention charts, technical indicators, or price movements

Match:
${market.event?.name}

League:
${market.event?.league}

Start Time:
${market.event?.startTime}

Question:
${market.question}
`;

    const defaultPrompt = `
You are a professional prediction market analyst.

Analyze this market and give a structured insight:

1️⃣ Outcome Prediction:
Clearly state whether Yes or No seems stronger.

2️⃣ Reasoning:
Explain using:
- Market sentiment
- Volatility
- Trends
- Momentum

3️⃣ User Advice:
Guide the user on:
- Using charts
- Understanding risk
- Choosing Yes/No
- Using multipliers responsibly

Market:
- Question: ${market.question}
- Type: ${market.marketType}
- Duration: ${market.durationMinutes} minutes

Options:
${market.subMarkets
  ?.map(
    (s) =>
      `${s.question}: ${s.outcomes
        ?.map((o) => o.label)
        .join(", ")}`
  )
  .join("\n")}
`;

    const prompt = isSport ? sportPrompt : defaultPrompt;

    // ✅ GROQ CALL
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: isSport
            ? "You are an expert football analyst."
            : "You are a smart prediction market analyst.",
        },
        { role: "user", content: prompt },
      ],
    });

    const insight =
      completion.choices?.[0]?.message?.content ||
      "AI insight unavailable.";

    res.json({
      success: true,
      insight,
    });
  } catch (err) {
    console.error("AI ERROR:", err);

    res.status(500).json({
      success: false,
      insight: "AI insight unavailable.",
    });
  }
});

module.exports = router;