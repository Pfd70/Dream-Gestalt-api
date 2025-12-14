module.exports = async (req, res) => {
  try {
    // Basic CORS (so WordPress can call it later)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "Endpoint is live. Send a POST with JSON { dream, context }."
      });
    }

    const body = req.body || {};
    const dream = body.dream;
    const context = body.context || {};

    if (!dream || typeof dream !== "string") {
      return res.status(400).json({ error: "Dream text is required (string)." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in Vercel env vars." });
    }

    const system =
      "You are a Gestalt-oriented dream reflection assistant. " +
      "Treat every dream element as an aspect of the dreamer. " +
      "Stay phenomenological. Avoid symbolic certainty. Use gentle, invitational language. " +
      "Do not diagnose. Do not claim definitive meanings.";

    const developer =
      "Output with headings:\n" +
      "1) What stands out\n" +
      "2) Possible Gestalt themes\n" +
      "3) Felt-sense prompts\n" +
      "4) One safe experiment\n" +
      "5) Grounding close\n\n" +
      "Constraints: No symbolic dictionary. No certainty. Warm, uncomplicated tone.";

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: [
          { role: "system", content: system },
          { role: "developer", content: developer },
          {
            role: "user",
            content:
              `Dream text:\n${dream}\n\n` +
              `Optional context:\n${JSON.stringify(context, null, 2)}`
          }
        ]
      })
    });

    const textRaw = await r.text(); // safer than r.json() (prevents crash on non-JSON)
    if (!r.ok) {
      return res.status(500).json({ error: "OpenAI API error", details: textRaw });
    }

    const data = JSON.parse(textRaw);

    const reflection =
      (data.output || [])
        .flatMap(o => o.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("\n\n") || "No reflection text returned.";

    return res.status(200).json({ reflection });
  } catch (err) {
    return res.status(500).json({ error: "Function crashed", details: String(err) });
  }
};
