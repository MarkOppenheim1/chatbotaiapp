function normalizeToText(value: any): string {
  if (!value) return "";

  if (typeof value === "string") return value;

  // Gemini sometimes returns array-of-parts
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return part.text;
        if (part?.content) return normalizeToText(part.content);
        return "";
      })
      .join("");
  }

  // Handle object outputs (your new "sources" shape)
  if (typeof value === "object") {
    if (typeof value.output === "string") return value.output;   // { output: "..." }
    if (typeof value.answer === "string") return value.answer;   // { answer: "..." }
    if (typeof value.content === "string") return value.content; // { content: "..." }
  }

  return "";
}

function extractTextFromEvent(json: any): string {
  // Most common LangServe stream shapes:
  // 1) { content: ... } (old)
  // 2) { output: ... }  (new)
  // 3) { data: { output: ... } } (variant)
  const candidate =
    json?.content ??
    json?.output ??
    json?.data?.content ??
    json?.data?.output ??
    json;

  return normalizeToText(candidate);
}

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch("http://localhost:8001/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        input: body.input,   // <-- matches input_messages_key="input"
      },
      config: {
        configurable: {
          session_id: body.session_id,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    return new Response(`Backend error ${res.status}\n${err}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const payload = line.slice("data: ".length).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);
            const text = extractTextFromEvent(json);

            // Debug (uncomment to see *something* even if no text matches)
            // controller.enqueue(`\n[debug keys] ${Object.keys(json).join(",")}\n`);

            if (text) controller.enqueue(text);
          } catch {
            // ignore non-JSON lines
          }
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
