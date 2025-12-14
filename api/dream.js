module.exports = async (req, res) => {
  const FORMAT_VERSION = "fmt-v5"; // change this each time you deploy to confirm

  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Version header so you can confirm you're hitting the new deploy
    res.setHeader("X-Format-Version", FORMAT_VERSION);

    if (req.method === "OPTIONS") return res.status(204).end();

    // Simple browser check
    if (req.method === "GET") {
     return res.status(200).json({ reflection });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed", formatVersion: FORMAT_VERSION });
    }

    const body = req.body || {};
    const dream = body.dream;
    const context = body.context || {};

    if (!dream || typeof dream !== "string") {
      return res.status(400).json({ error: "Dream text is required (string).", formatVersion: FORMAT_VERSION });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in Vercel env vars.", formatVersion: FORMAT_VERSION });
    }

    const system =
      "You are a Gestalt-oriented dream reflection assistant. " +
      "Treat every dream element as an aspect of the dreamer. " +
      "Stay phenomenological. Avoid symbolic certainty. " +
      "Use gentle, invitational language. " +
      "Do not diagnose. Do not claim definitive meanings.";

    const developer = `
Format the response using Markdown.

Use ONLY Markdown headings (###) for section titles.
NEVER number sections or prefix headings with numbers (no "1)", "2.", "Step 1", etc).

Use this exact structure:

### What stands out
- 3–6 bullet points grounded directly in the dream text.

### Possible Gestalt themes
- 2–4 short paragraphs.

### Felt-sense prompts
- 4–7 open-ended, body-oriented questions.

### One gentle experiment
- ONE invitation only.
- Maximum 3 bullet points total.
- No timing.
- No named techniques.

### Grounding close
- 2–4 calm sentences.

Hard constraints:
- If you numbered anything, rewrite with no numbers.
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

    const textRaw = await r.text();
    if (!r.ok) {
      return res.status(500).json({ error: "OpenAI API error", details: textRaw, formatVersion: FORMAT_VERSION });
    }

    const data = JSON.parse(textRaw);

    let reflection =
      (data.output || [])
        .flatMap(o => o.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("\n\n") || "No reflection text returned.";

    // ✅ BULLETPROOF numbering strip (line-by-line)
    reflection = reflection
      .split(/\r?\n/)
      .map(line => line.replace(/^\s*(?:\uFEFF)?\d+\s*[\)\.\-:]\s*/u, "")) // removes "1) ", "2. ", "3 - ", "4:"
      .map(line => line.replace(/^\s*(?:\uFEFF)?step\s*\d+\s*[:\)\.\-]\s*/iu, "")) // removes "Step 1:"
      .join("\n");

    return res.status(200).json({ reflection });
  } catch (err) {
    return res.status(500).json({ error: "Function crashed", details: String(err) });
  }
};

