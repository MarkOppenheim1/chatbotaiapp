import { BACKEND_URL } from "@/app/lib/backend";

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${BACKEND_URL}/chat/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: body.session_id,
    }),
  });

  if (!res.ok) {
    return new Response("Failed to clear chat", { status: 500 });
  }

  return new Response(JSON.stringify({ status: "cleared" }), {
    headers: { "Content-Type": "application/json" },
  });
}
