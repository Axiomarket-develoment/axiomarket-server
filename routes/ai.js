const express = require("express");
const Groq = require("groq-sdk");

const router = express.Router();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

router.post("/ai-insight", async (req, res) => {
    try {
        const { market } = req.body;
        // console.log(market);

        const prompt = `
You are a professional prediction market analyst.

Analyze this market and give a structured insight with three sections:

1️⃣ Outcome Prediction: Clearly state which option (Yes or No) seems stronger.
2️⃣ Reasoning: Explain why this outcome is likely. Include market sentiment, volatility, recent trends, or other influencing factors.
3️⃣ User Advice: Suggest how a user could play this market responsibly on AxioMarket. Include guidance on using charts, analyzing, choosing Yes/No, and understanding the x multiplier for stakes.

Market:
- Question: ${market.question}
- Type: ${market.marketType}
- Duration: ${market.durationMinutes} minutes

Options:
${market.subMarkets
    .map(
        (s) =>
            `${s.question}: ${s.outcomes
                .map((o) => `${o.label}`) // no odds for now
                .join(", ")}`
    )
    .join("\n")}

Format your response with spacing between sections, professional language, and keep it user-friendly.
`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant", // ✅ replace with your active model
            messages: [
                { role: "system", content: "You are a smart market analyst." },
                { role: "user", content: prompt },
            ],
        });

        const insight = completion.choices[0]?.message?.content;

        res.json({ insight });
    } catch (err) {
        console.error(err);
        res.status(500).json({ insight: "AI insight unavailable." });
    }
});

module.exports = router;