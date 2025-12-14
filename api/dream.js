export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { dream, context } = req.body || {};

  if (!dream) {
    return res.status(400).json({ error: "Dream text is required" });
  }

  const system = `
You are a Gestalt-oriented dream reflection assistant.
Treat every dream element as an aspect of the dreamer.
Stay phenomenological. Avoid symbolic certainty.
Use gentle, invitational language.
`;

  const developer = `
Output with headings:
1) What stands out
2) Possible Gestalt themes
3) Felt-sense prompts
4) One safe experiment
5) Grounding close
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5",
      input: [
        { role: "system", content: system },
        { role: "developer", content: developer },
        {
          role: "user",
          content: \`Dream:\\n\${dream}\\n\\nContext:\\n\${JSON.stringify(context || {}, null, 2)}\`
        }
      ]
    })
  });

  const data = await response.json();

  const text =
    (data.output || [])
      .flatMap(o => o.content || [])
      .filter(c => c.type === "output_text")
      .map(c => c.text)
      .join("\\n\\n") || "No response generated.";

  res.status(200).json({ reflection: text });
}
