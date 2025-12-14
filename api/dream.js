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
Format the response using Markdown.

Use this exact structure and headings:

### What stands out
- 3–6 bullet points grounded directly in the dream text.

### Possible Gestalt themes
- 2–4 short paragraphs.
- Use phenomenological, experiential language.
- Avoid symbolic certainty or diagnosis.
- Speak in an invitational, non-authoritative tone.

### Felt-sense prompts
- 4–7 open-ended, body-oriented questions.
- Focus on sensation, posture, breath, or felt meaning.

### One gentle experiment
- One simple, safe experiential invitation.
- No intensity, no exposure, no catharsis.
- Suitable for self-reflection.

### Grounding close
- 2–4 calm sentences that help the reader settle and return to the present.

Constraints:
- Do not number sections.
- Do not explain Gestalt theory.
- Do not interpret symbols as fixed meanings.
- Do not give advice or diagnosis.
- Keep the tone warm, clear, and professional.
`;

      

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
