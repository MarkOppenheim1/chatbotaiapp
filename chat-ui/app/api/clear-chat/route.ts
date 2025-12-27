export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch("http://127.0.0.1:8001/chat/clear", {
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
