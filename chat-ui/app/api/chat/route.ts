function normalizeGeminiContent(content: any): string {
    if (!content) return "";

    // Already a string
    if (typeof content === "string") {
        return content;
    }

    // Array of parts
    if (Array.isArray(content)) {
        return content
        .map((part) => {
            if (typeof part === "string") return part;
            if (part?.text) return part.text;
            return "";
        })
        .join("");
    }

    return "";
}

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch("http://localhost:8001/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        input: body.input,
      },
      config: {
        configurable: {
            session_id: body.session_id,
        },
      },
    }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split SSE events
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.replace("data: ", ""));
              if (json.content) {
                
                //#controller.enqueue(json.content);
                controller.enqueue(normalizeGeminiContent(json.content));
              }
            } catch {
              // Ignore non-JSON lines
            }
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