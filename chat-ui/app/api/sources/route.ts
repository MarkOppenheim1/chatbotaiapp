import { BACKEND_URL } from "@/app/lib/backend";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Accept either a plain string or an object { input: "..." }
    const inputPayload =
      typeof body.input === "string" ? { input: body.input } : body.input ?? {};

    const res = await fetch(`${BACKEND_URL}/sources/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: inputPayload,
        config: {
          configurable: {
            session_id: body.session_id,
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "Upstream error", status: res.status, body: text }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    // Prefer top-level sources, but also handle alternative shapes
    const sources = data.sources ?? data.output?.sources ?? [];

    return new Response(JSON.stringify({ sources }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
