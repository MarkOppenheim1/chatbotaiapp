import { BACKEND_URL } from "@/app/lib/backend";

function normalizeParts(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  // Gemini style parts: [{text:"..."}, ...]
  if (Array.isArray(value)) {
    return value
      .map((p) => {
        if (typeof p === "string") return p;
        if (p?.text) return p.text;
        if (p?.content) return normalizeParts(p.content);
        return "";
      })
      .join("");
  }

  // LangChain BaseMessage-like {content:"..."}
  if (typeof value === "object" && typeof value.content === "string") {
    return value.content;
  }

  return "";
}

/**
 * Unwrap common LangServe/LangChain wrappers until we find a string or message content.
 * This handles cases like:
 *  - { output: "..." }
 *  - { output: { output: "..." } }
 *  - { output: { kwargs: { content: "..." } } }
 *  - { output: { message: { content: "..." } } }
 *  - { output: { content: [...] } }
 */
function extractAnswerText(json: any): string {
  if (!json) return "";

  // Streaming variants: sometimes nested under data
  let v = json?.data ?? json;

  // Ignore run_id-only frames
  if (v?.run_id && Object.keys(v).length === 1) return "";

  // If the event is { output: ..., sources: ... }, start from output
  if (v?.output !== undefined) v = v.output;

  // Unwrap repeated "output" nesting
  // (LangServe can wrap your output inside another output)
  for (let i = 0; i < 6; i++) {
    if (v && typeof v === "object" && "output" in v) {
      const next = (v as any).output;
      // prevent infinite loop if output points to itself
      if (next === v) break;
      v = next;
      continue;
    }
    break;
  }

  // Direct string
  if (typeof v === "string") return v;

  // Try common containers
  if (v?.answer && typeof v.answer === "string") return v.answer;
  if (v?.content) {
    const t = normalizeParts(v.content);
    if (t) return t;
  }
  if (v?.message) {
    const t = normalizeParts(v.message?.content ?? v.message);
    if (t) return t;
  }
  if (v?.kwargs) {
    const t = normalizeParts(v.kwargs?.content ?? v.kwargs);
    if (t) return t;
  }
  if (v?.lc_kwargs) {
    const t = normalizeParts(v.lc_kwargs?.content ?? v.lc_kwargs);
    if (t) return t;
  }

  // Last resort: if object has any stringy fields
  if (typeof v === "object") {
    const candidates = [
      v?.text,
      v?.completion,
      v?.result,
      v?.value,
      v?.final,
      v?.message?.content,
      v?.kwargs?.content,
      v?.lc_kwargs?.content,
    ];
    for (const c of candidates) {
      const t = normalizeParts(c);
      if (t) return t;
    }
  }

  return "";
}

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { input: body.input },
      config: { configurable: { session_id: body.session_id } },
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

        // Keep your original approach (works in practice) but handle CRLF
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let rawLine of lines) {
          const line = rawLine.replace(/\r$/, ""); // strip CR
          if (!line.startsWith("data: ")) continue;

          const payload = line.slice("data: ".length).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);

            // 🔍 TEMP DEBUG (uncomment for 1 run if needed)
            // controller.enqueue(`\n[debug] ${payload}\n`);

            const text = extractAnswerText(json);
            if (text) controller.enqueue(text);
          } catch {
            // ignore non-JSON
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
