/** One short user-initiated chat completion. Returns null when the key is missing or the call fails. */
export async function completeText(prompt: string, maxTokens = 180): Promise<string | null> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: maxTokens,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt.slice(0, 1200) }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("xai chat", error);
    return null;
  }
}
