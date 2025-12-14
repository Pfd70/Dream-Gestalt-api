module.exports = async (req, res) => {
  const FORMAT_VERSION = "fmt-v4";

  try {
    // Basic CORS (so WordPress can call it later)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(204).end();

    // Health check (browser friendly)
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "Endpoint is live. Send a POST with JSON { dream, context }.",
        formatVersion: FORMAT_VERSION
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
        formatVersion: FORMAT_VERSION
      });
    }

    const body = req.body || {};
    const dream = body.dream;
    const context = body.context || {};

    if (!dream || typeof dream !== "string") {
      return res.status(400).json({
        error: "Dream text is required (string).",
        formatVersion: FORMAT_VERSION
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY in Vercel env vars.",
        formatVersion: FORMAT_VERSION
      });
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
NEVER number sections.
NEVER prefix headings with numbers, letters, or symbols.
Do NOT use formats like "1)", "2.", "Step 1", or similar.

Use this exact structure:

### What stands out
- 3–6 bullet points grounded directly in the dream text.

### Possible Gestalt themes
- 2–4 short paragraphs.
- Phenomenological, experiential language only.
- No symbolic certainty or diagnosis.

### Felt-sense prompts
- 4–7 open-ended, body-oriented questions.

### One gentle experiment
- ONE invitation only.
- Maximum 3 bullet points total.
- No timing (no “5–10 minutes”).
- No named techniques (do not say “two-chair” or similar).

### Grounding close
- 2–4 calm sentences to help the reader settle.

Hard constraints:
- If you catch yourself numbering sections, STOP and rewrite without numbers.
- Do not explain Gestalt theory.
- Keep the tone warm, calm, and professional.
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
      return res.status(500).json({
        error: "OpenAI API error",
        details: textRaw,
        formatVersion: FORMAT_VERSION
      });
    }

    const data = JSON.parse(textRaw);

    let reflection =
      (data.output || [])
        .flatMap(o => o.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("\n\n") || "No reflection text returned.";

    // GUARANTEE: strip numbered prefixes at the start of any line
    reflection = reflection.replace(/^\s*\d+\s*[\)\.\-:]\s*/gm, "");
    reflection = reflection.replace(/^\s*step\s*\d+\s*[:\)\.\-]\s*/gmi, "");

    // If headings lost their ###, restore common ones
    reflection = reflection.replace(/^(What stands out)\s*$/gmi, "### $1");
    reflection = reflection.replace(/^(Possible Gestalt themes)\s*$/gmi, "### $1");
    reflection = reflection.replace(/^(Felt-sense prompts)\s*$/gmi, "### $1");
    reflection = reflection.replace(/^(One gentle experiment)\s*$/gmi, "### $1");
    reflection = reflection.replace(/^(Grounding close)\s*$/gmi, "### $1");

    return res.status(200).json({
      reflection,
      formatVersion: FORMAT_VERSION
    });
  } catch (err) {
    return res.status(500).json({
      error: "Function crashed",
      details: String(err)
    });
  }
};
Then test (PowerShell)
powershell
Copy code
$response = Invoke-RestMethod `
  -Method Post `
  -Uri "https://dream-gestalt-api.vercel.app/api/dream" `
  -ContentType "application/json" `
  -Body (@{
    dream = "I visited a large organisation I had been in a previous dream. I gained access by holding a garment as if I belonged to a fashion shoot, found a room with a sports car, and met the owner."
    context = @{ mood = "curious"; recurring = $true }
  } | ConvertTo-Json)

$response.formatVersion
$response.reflection
